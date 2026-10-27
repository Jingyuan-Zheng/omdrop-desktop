import {_, tr} from './i18n.js';
export const WINDOWS = [
    ['once', _('接收一个文件后关闭')], ['1m', _('1 分钟')], ['5m', _('5 分钟')],
    ['10m', _('10 分钟')], ['15m', _('15 分钟')], ['30m', _('30 分钟')],
    ['60m', _('1 小时')], ['forever', _('直到手动关闭')],
];

export function describeStatus(s, elapsed = 0) {
    if (!s) return _('正在读取状态…');
    if (s.visible === null) return _('无线后端不可用');
    if (!s.receiving) return _('未开启接收');
    let remaining = s.remaining;
    const mode = s.mode === 'once' ? _('收到一个文件后关闭') : _('直到手动关闭');
    let timing = mode;
    if (Number.isFinite(remaining)) {
        remaining = Math.max(0, remaining - elapsed);
        timing = remaining === 0 ? _('正在关闭…') : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
    }
    return `${s.visible ? _('附近设备可见') : _('接收服务已启动，等待无线广播')} · ${timing}`;
}

export function normalizePeers(list, names = new Map()) {
    if (!Array.isArray(list)) throw new Error(_('设备列表格式错误'));
    const seen = new Set();
    return list.filter(p => p && typeof p.mac === 'string' && /^[0-9a-f:]{17}$/i.test(p.mac))
        .map(p => ({...p, mac: p.mac.toLowerCase()}))
        .filter(p => !seen.has(p.mac) && seen.add(p.mac))
        .map(p => ({mac: p.mac, name: p.name || names.get(p.mac) || '',
            rssi: Number.isFinite(p.rssi) ? p.rssi : null}));
}

// Bearing is deliberately decorative: RSSI gives strength, not direction.
export function radarPoint(peer, width, height) {
    let hash = 0;
    for (const c of peer.mac) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    const angle = (hash % 360) * Math.PI / 180;
    const strength = peer.rssi === null ? 0 : Math.max(0, Math.min(1, (peer.rssi + 90) / 60));
    const r = Math.min(width, height) * 0.43 * (0.95 - strength * 0.7);
    return {x: width / 2 + Math.sin(angle) * r, y: height / 2 - Math.cos(angle) * r};
}
