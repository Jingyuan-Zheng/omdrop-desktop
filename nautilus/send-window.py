#!/usr/bin/python3
"""GTK4 device picker and progress window for selected Nautilus files."""
import json
import os
import signal
import subprocess
import sys
import threading
import gi
from runtime import cli_path

gi.require_version('Gtk', '4.0')
from gi.repository import Gio, GLib, Gtk

CLI = cli_path()


def validate_files(paths):
    if not paths:
        raise ValueError('Select files in the file manager first.')
    names = set()
    for path in paths:
        if not os.path.isabs(path) or not os.path.isfile(path) or not os.access(path, os.R_OK):
            raise ValueError('Only readable local files can be sent. Compress folders first.')
        name = os.path.basename(path)
        if name in names:
            raise ValueError('Files have duplicate names. Rename them or send them separately.')
        names.add(name)


class Job:
    def __init__(self, args, done, progress=None, timeout=60):
        self.cancelled = False
        self.proc = None
        self.lock = threading.Lock()
        self.thread = threading.Thread(target=self._run, args=(args, done, progress, timeout), daemon=True)
        self.thread.start()

    def _run(self, args, done, progress, timeout):
        env = os.environ.copy()
        env['PATH'] = '/usr/bin:/bin:' + env.get('PATH', '')
        try:
            with self.lock:
                if self.cancelled:
                    GLib.idle_add(done, 130, '', 'Cancelled')
                    return
                self.proc = subprocess.Popen([CLI, *args], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                             stderr=subprocess.STDOUT, text=True, errors='replace',
                                             env=env, start_new_session=True)
            timer = threading.Timer(timeout, self.cancel) if timeout else None
            if timer:
                timer.daemon = True
                timer.start()
            text = ''
            try:
                for line in self.proc.stdout:
                    text = (text + line)[-65536:]
                    if progress and line.strip():
                        GLib.idle_add(progress, line.strip()[-600:])
                rc = self.proc.wait()
            finally:
                self.proc.stdout.close()
                if timer:
                    timer.cancel()
            GLib.idle_add(done, 130 if self.cancelled else rc, text.strip(), 'Cancelled or timed out' if self.cancelled else '')
        except Exception as error:
            GLib.idle_add(done, 1, '', str(error))

    def cancel(self):
        with self.lock:
            if self.cancelled:
                return
            self.cancelled = True
            proc = self.proc
        if proc and proc.poll() is None:
            try:
                # omdrop handles TERM and tears down its detached sender group.
                proc.terminate()
            except ProcessLookupError:
                pass
            def reap():
                try:
                    proc.wait(timeout=6)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(proc.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
            threading.Thread(target=reap, daemon=True).start()


class SendWindow(Gtk.Application):
    def __init__(self, files):
        super().__init__(application_id='org.omdrop.Desktop.Send', flags=Gio.ApplicationFlags.NON_UNIQUE)
        self.files = files
        self.alive = True
        self.jobs = set()
        self.busy = False
        self.scanning = False
        self.receiving = False
        self.peers = {}
        self.send_job = None
        self.scan_job = None
        self.scan_generation = 0
        self._closing_hold = False
        self.timer = 0
        self.connect('activate', self.activate_window)

    def label(self, text, box):
        label = Gtk.Label(label=text, wrap=True, xalign=0, selectable=True)
        box.append(label)
        return label

    def activate_window(self, _app):
        self.window = Gtk.ApplicationWindow(application=self, title='Omdrop · Send files', default_width=540, default_height=560)
        self.window.connect('close-request', self.close)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14,
                      margin_top=20, margin_bottom=20, margin_start=20, margin_end=20)
        self.window.set_child(box)
        title = self.label(f'Send {len(self.files)} file(s)', box)
        title.add_css_class('title-2')
        summary = ', '.join(os.path.basename(path) for path in self.files)
        self.label(summary[:250] + ('…' if len(summary) > 250 else ''), box)
        self.label('Some adapters temporarily disconnect Wi-Fi while AirDrop is on. A receive window started here lasts 10 minutes. Closing this window does not turn AirDrop off; use the button below.', box)
        controls = Gtk.Box(spacing=8)
        box.append(controls)
        self.start = Gtk.Button(label='Enable AirDrop and find devices')
        self.start.connect('clicked', self.start_radio)
        controls.append(self.start)
        self.refresh = Gtk.Button(label='Refresh')
        self.refresh.connect('clicked', lambda *_: self.scan())
        self.refresh.set_sensitive(False)
        controls.append(self.refresh)
        self.status = self.label('Checking receive status…', box)
        scroll = Gtk.ScrolledWindow(vexpand=True, min_content_height=180)
        self.listbox = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE)
        self.listbox.add_css_class('boxed-list')
        scroll.set_child(self.listbox)
        box.append(scroll)
        self.progress = self.label('', box)
        self.cancel = Gtk.Button(label='Cancel transfer')
        self.cancel.connect('clicked', lambda *_: self.cancel_send())
        self.cancel.set_visible(False)
        box.append(self.cancel)
        self.stop = Gtk.Button(label='Turn off AirDrop and restore Wi-Fi')
        self.stop.connect('clicked', self.stop_radio)
        self.stop.set_sensitive(False)
        box.append(self.stop)
        try:
            validate_files(self.files)
        except ValueError as error:
            self.status.set_text(str(error))
            self.start.set_sensitive(False)
        else:
            self.run_job(['status', '--json'], self.initial_status)
        self.window.present()

    def run_job(self, args, done, progress=None, timeout=60):
        def finished(rc, text, error):
            self.jobs.discard(job)
            if self.alive:
                done(rc, text, error)
            elif self._closing_hold and not self.jobs:
                self._closing_hold = False
                self.release()
            return GLib.SOURCE_REMOVE
        job = Job(args, finished, progress, timeout)
        self.jobs.add(job)
        return job

    def initial_status(self, rc, text, error):
        try:
            if rc:
                raise ValueError(error or text)
            self.receiving = bool(json.loads(text)['receiving'])
        except (ValueError, KeyError) as failure:
            self.status.set_text(f'Could not read status: {failure}')
            return
        if self.receiving:
            self.start.set_label('Find nearby devices')
            self.stop.set_sensitive(True)
            self.refresh.set_sensitive(True)
            self.scan()
        else:
            self.status.set_text('Ready. Click “Enable AirDrop and find devices”.')

    def start_radio(self, *_):
        if self.busy or self.scanning:
            return
        if self.receiving:
            self.scan()
            return
        self.busy = True
        self.set_buttons()
        self.status.set_text('Starting the AirDrop radio. Please wait…')
        def started(rc, text, error):
            self.busy = False
            if rc:
                self.status.set_text(error or text or 'Could not start AirDrop')
            else:
                self.receiving = True
                self.start.set_label('Find nearby devices')
                self.scan()
            self.set_buttons()
        self.run_job(['on', '10m'], started, timeout=180)

    def set_buttons(self):
        self.start.set_sensitive(not self.busy and not self.scanning)
        self.refresh.set_sensitive(self.receiving and not self.busy and not self.scanning)
        self.stop.set_sensitive(self.receiving and not self.busy)
        for row in self.peers.values():
            row.set_sensitive(not self.busy)

    def scan(self):
        if self.scanning or self.busy or not self.receiving or not self.alive:
            return
        self.scanning = True
        self.scan_generation += 1
        generation = self.scan_generation
        self.set_buttons()
        self.status.set_text('Finding devices… Set AirDrop to “Everyone” on your Apple device.')
        def listed(rc, text, error):
            if generation != self.scan_generation:
                return
            self.scanning = False
            try:
                if rc:
                    raise ValueError(error or text)
                # Warnings/progress on stderr may precede the final JSON array.
                # Validate the whole candidate; never parse individual devices
                # out of an unsuccessful or truncated operation.
                peers = None
                for line in reversed(text.splitlines()):
                    try:
                        candidate = json.loads(line)
                    except ValueError:
                        continue
                    if isinstance(candidate, list):
                        peers = candidate
                        break
                if not isinstance(peers, list):
                    raise ValueError('Invalid device list')
            except ValueError as failure:
                self.status.set_text(f'Discovery failed: {failure}')
                self.set_buttons()
                return
            wanted = set()
            for peer in peers:
                if not isinstance(peer, dict):
                    continue
                mac = peer.get('mac')
                if not isinstance(mac, str):
                    continue
                wanted.add(mac)
                label = f'{peer.get("name") or mac}  ·  {peer.get("rssi", "?")} dBm'
                if mac in self.peers:
                    self.peers[mac].set_label(label)
                else:
                    button = Gtk.Button(label=label, margin_top=6, margin_bottom=6)
                    button.connect('clicked', lambda _b, address=mac: self.send(address))
                    self.listbox.append(button)
                    self.peers[mac] = button
            for mac in list(self.peers):
                if mac not in wanted:
                    self.listbox.remove(self.peers.pop(mac).get_parent())
            self.status.set_text(f'Found {len(wanted)} device(s). Click one to send your files.' if wanted else 'No devices found. Open AirDrop on your Apple device, then click Refresh.')
            self.set_buttons()
        self.scan_job = self.run_job(['peers', '--json', '-n'], listed, timeout=65)

    def send(self, mac):
        if self.busy:
            return
        self.scan_generation += 1
        self.scan_job.cancel() if self.scan_job else None
        self.scanning = False
        self.busy = True
        self.set_buttons()
        self.cancel.set_visible(True)
        self.progress.set_text('Sending… Accept the transfer on your Apple device.')
        def progress(line):
            if self.alive:
                self.progress.set_text(line)
            return GLib.SOURCE_REMOVE
        def sent(rc, text, error):
            self.busy = False
            self.send_job = None
            self.cancel.set_visible(False)
            self.progress.set_text('Transfer complete.' if rc == 0 else error or text[-1000:] or 'Transfer failed')
            self.set_buttons()
        self.send_job = self.run_job(['send', '--to', mac, '--', *self.files], sent, progress, timeout=0)

    def cancel_send(self):
        if self.send_job:
            self.send_job.cancel()
            self.progress.set_text('Cancelling transfer…')

    def stop_radio(self, *_):
        if self.busy:
            return
        self.scan_generation += 1
        if self.scan_job:
            self.scan_job.cancel()
        self.scanning = False
        self.busy = True
        self.set_buttons()
        def stopped(rc, text, error):
            self.busy = False
            if rc:
                self.status.set_text(error or text)
            else:
                self.receiving = False
                self.start.set_label('Enable AirDrop and find devices')
                self.status.set_text('AirDrop is off. Restoring Wi-Fi.')
            self.set_buttons()
        self.run_job(['off'], stopped)

    def close(self, *_):
        self.alive = False
        if self.jobs and not self._closing_hold:
            # Keep the main loop alive until TERM cleanup (or its bounded
            # fallback) finishes, including when the last window closes.
            self._closing_hold = True
            self.hold()
        for job in list(self.jobs):
            job.cancel()
        return False


if __name__ == '__main__':
    files = sys.argv[1:]
    if files[:1] == ['--']:
        files = files[1:]
    raise SystemExit(SendWindow(files).run([sys.argv[0]]))
