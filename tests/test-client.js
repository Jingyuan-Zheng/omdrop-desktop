import GLib from 'gi://GLib';
import {Client} from '../extension/client.js';
function assert(value, message) { if (!value) throw new Error(message); }
const loop = new GLib.MainLoop(null,false);
const client = new Client(GLib.build_filenamev([GLib.get_current_dir(),'tests/fixtures/mock-cli.py']));
let error = null;
(async () => {
    assert((await client.json(['status'])).receiving === false, 'status JSON');
    const payload = ['space name.txt', 'quote\"name', 'line\nbreak', '中文.txt', '$(not-a-command)'];
    const echo = JSON.parse(await client.run(['test-echo', ...payload]).promise);
    assert(JSON.stringify(echo) === JSON.stringify(payload), 'argv preserved without shell expansion');
    const lines = [];
    await client.run(['peers','--stream'], {line:text=>lines.push(JSON.parse(text))}).promise;
    assert(lines.length === 2, 'streaming names');
    let failed = false;
    try { await client.run(['test-fail']).promise; } catch (e) { failed = e.message.includes('Expected fixture failure'); }
    assert(failed,'stderr failure propagation');
    let timeout = false;
    try { await client.run(['test-delay'], {timeout:100}).promise; } catch (_) { timeout = true; }
    assert(timeout && client.jobs.size === 0, 'timeout and job cleanup');
    const pending = client.run(['test-delay']);
    client.close();
    try { await pending.promise; } catch (_) { /* expected cancellation */ }
    assert(client.jobs.size === 0, 'disable cleans pending requests');
    print('PASS: client JSON, stream, argv, failure, timeout and shutdown');
})().catch(e=>{error=e;}).finally(()=>{client.close();loop.quit();});
loop.run();
if (error) throw error;
