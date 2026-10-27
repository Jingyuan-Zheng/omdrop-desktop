"""Run under xvfb-run; all radio commands go to an offline fixture."""
import importlib.util
from pathlib import Path
import sys
from gi.repository import GLib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'nautilus'))
spec = importlib.util.spec_from_file_location('send_window',ROOT/'nautilus/send-window.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.CLI = str(ROOT/'tests/fixtures/mock-cli.py')
app = module.SendWindow([str(ROOT/'README.md'),str(ROOT/'LICENSE')])
errors = []


def guarded(callback):
    def call():
        try:
            callback()
        except Exception as error:
            errors.append(str(error))
            app.close()
            app.quit()
        return GLib.SOURCE_REMOVE
    return call


def start():
    assert app.status.get_text().startswith('Ready.'),app.status.get_text()
    app.start_radio()


def send():
    assert len(app.peers)==2,app.status.get_text()
    app.send('02:00:00:00:00:01')


def cancel():
    assert app.send_job is not None
    app.cancel_send()


def stop():
    assert not app.busy and app.send_job is None,app.progress.get_text()
    assert 'Cancelled' in app.progress.get_text(),app.progress.get_text()
    app.stop_radio()


def finish():
    assert not app.receiving and not app.busy,app.status.get_text()
    print('PASS: GTK status, start, peers, multi-file send, cancel and stop',flush=True)
    app.close()
    app.quit()


def ready(_app):
    print('GTK fixture window ready',flush=True)
    for delay,callback in [(700,start),(1800,send),(2200,cancel),(3000,stop),(4000,finish)]:
        GLib.timeout_add(delay,guarded(callback))


app.connect('activate',ready)
print('Starting GTK fixture test',flush=True)
app.run(['omdrop-ui-smoke'])
if errors:
    raise RuntimeError('; '.join(errors))
