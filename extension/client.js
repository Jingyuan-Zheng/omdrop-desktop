import {_} from './i18n.js';
import {cliPath} from './paths.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// No shell interpolation. The backend owns radio privileges and transfer cleanup.
export class Client {
    constructor(path = cliPath()) {
        this.path = path;
        this.jobs = new Set();
        this.closed = false;
    }

    run(args, {line = null, timeout = 30000} = {}) {
        if (this.closed) throw new Error(_('扩展已关闭'));
        const flags = Gio.SubprocessFlags.STDOUT_PIPE |
            (line ? Gio.SubprocessFlags.STDERR_MERGE : Gio.SubprocessFlags.STDERR_PIPE);
        const launcher = new Gio.SubprocessLauncher({flags});
        launcher.setenv('PATH', `/usr/bin:/bin:${GLib.getenv('PATH') || ''}`, true);
        const proc = launcher.spawnv([this.path, ...args]);
        const job = {proc, cancelled: false, timer: 0, killTimer: 0};
        this.jobs.add(job);
        job.cancel = () => {
            if (!this.jobs.has(job) || job.cancelled) return;
            job.cancelled = true;
            try { proc.send_signal(15); } catch (_) { /* already exited */ }
            // Allow omdrop's TERM handler to stop the sender/probe group.
            job.killTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 6000, () => {
                job.killTimer = 0;
                try { proc.force_exit(); } catch (_) { /* already exited */ }
                return GLib.SOURCE_REMOVE;
            });
        };
        if (timeout > 0) job.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, () => {
            job.timer = 0;
            job.cancel();
            return GLib.SOURCE_REMOVE;
        });
        job.promise = new Promise((resolve, reject) => {
            if (line) {
                const stream = new Gio.DataInputStream({base_stream: proc.get_stdout_pipe()});
                let tail = '';
                const read = () => stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (s, result) => {
                    try {
                        const [text] = s.read_line_finish_utf8(result);
                        if (text === null) {
                            s.close(null);
                            proc.wait_async(null, (p, res) => {
                                try {
                                    p.wait_finish(res);
                                    if (job.cancelled) reject(new Error(_('已取消')));
                                    else if (p.get_successful()) resolve(tail);
                                    else reject(new Error(tail || _('操作未完成')));
                                } catch (e) { reject(e); }
                            });
                        } else {
                            if (text.trim()) tail = text.trim().slice(-2000);
                            if (!this.closed) line(text);
                            read();
                        }
                    } catch (e) { reject(e); }
                });
                read();
            } else proc.communicate_utf8_async(null, null, (p, result) => {
                try {
                    const [, stdout, stderr] = p.communicate_utf8_finish(result);
                    if (job.cancelled) reject(new Error(_('操作超时或已取消')));
                    else if (p.get_successful()) resolve(stdout.trim());
                    else reject(new Error((stderr || stdout || _('操作失败')).trim().slice(-2000)));
                } catch (e) { reject(e); }
            });
        }).finally(() => {
            if (job.timer) GLib.Source.remove(job.timer);
            if (job.killTimer) GLib.Source.remove(job.killTimer);
            this.jobs.delete(job);
        });
        return job;
    }

    async json(args) { return JSON.parse(await this.run(args).promise); }

    close() {
        this.closed = true;
        for (const job of this.jobs) job.cancel();
    }
}
