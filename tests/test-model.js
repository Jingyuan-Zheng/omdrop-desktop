import Gio from 'gi://Gio';
import {_, tr, isChinese} from '../extension/i18n.js';
import {WINDOWS, describeStatus, normalizePeers, radarPoint} from '../extension/model.js';

const chinese = ARGV[0] === 'zh';
function assert(value, message) { if (!value) throw new Error(message); }
assert(isChinese(['zh_CN.UTF-8']), 'Simplified Chinese');
assert(isChinese(['zh_TW.UTF-8']), 'Traditional Chinese');
assert(!isChinese(['en_IE.UTF-8', 'zh_CN']), 'preferred English wins');
assert(!isChinese(['fr_FR.UTF-8', 'C']), 'other locales use English');
assert(isChinese() === chinese, 'runtime locale choice');
assert(_('接收文件') === (chinese ? '接收文件' : 'Receive files'), 'menu translation');
assert(tr('中文', 'English') === (chinese ? '中文' : 'English'), 'dynamic translation');
assert(WINDOWS.length === 8, 'all receive windows');
assert(WINDOWS[0][1] === (chinese ? '接收一个文件后关闭' : 'One file, then off'), 'window translation');
assert(describeStatus({receiving:true,visible:true,remaining:61},2).includes('0:59'), 'countdown');
assert(describeStatus({receiving:true,visible:null}) === _('无线后端不可用'), 'unavailable radio');
assert(describeStatus({receiving:false,visible:false}) === _('未开启接收'), 'off state');
assert(describeStatus({receiving:true,visible:false,mode:'once'}).includes(_('收到一个文件后关闭')), 'one-file state');
const peers = normalizePeers([{mac:'02:AA:00:00:00:01',rssi:-40}, {mac:'02:aa:00:00:00:01'}, {mac:'bad'}], new Map([['02:aa:00:00:00:01','Demo']]));
assert(peers.length === 1 && peers[0].name === 'Demo', 'deduplication and name cache');
assert(Number.isFinite(radarPoint(peers[0],280,200).x), 'bounded radar position');
for (const file of ['extension.js','model.js','client.js']) {
    const [, bytes] = Gio.File.new_for_path(`extension/${file}`).load_contents(null);
    const text = new TextDecoder().decode(bytes);
    for (const match of text.matchAll(/_\(('(?:\\.|[^'\\])*')\)/g)) {
        const key = match[1].slice(1,-1).replace(/\\n/g,'\n');
        if (!chinese) assert(!/[\u3400-\u9fff]/.test(_(key)), `Missing translation: ${key}`);
    }
}
print(`PASS: model and ${chinese ? 'Chinese' : 'English'} UI`);
