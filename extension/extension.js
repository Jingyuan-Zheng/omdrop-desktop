import {_, tr} from './i18n.js';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {Client} from './client.js';
import {WINDOWS, describeStatus, normalizePeers, radarPoint} from './model.js';
import {soundPath} from './paths.js';

export default class OmdropExtension extends Extension {
    enable() {
        this._alive = true;
        this._client = new Client();
        this._settings = this.getSettings();
        this._dialogs = new Set();
        this._names = new Map();
        this._peers = [];
        this._rows = new Map();
        this._state = null;
        this._busy = false;
        this._polling = this._pollAgain = this._pollError = this._peerLoading = false;
        this._sendJob = this._namesJob = null;
        this._statusAt = 0;
        this._voices = [];
        this._sweepAngle = 0;
        this._epoch = 0;
        this._scanWanted = false;
        this._lastStatus = this._lastPeers = this._lastNames = 0;
        this._button = new PanelMenu.Button(0, 'Omdrop · AirDrop');
        this._icon = new St.Icon({gicon: Gio.icon_new_for_string(`${this.path}/airdrop-symbolic.svg`), style_class: 'system-status-icon'});
        this._button.add_child(this._icon);
        this._button.menu.box.add_style_class_name('omdrop-menu');
        // GNOME's ordinary popup has no scrolling; the full radar menu needs it
        // on small displays, with large text, and when a submenu is expanded.
        this._scroll = new St.ScrollView({overlay_scrollbars: true});
        this._scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._button.menu._boxPointer.bin.set_child(null);
        this._scroll.add_child(this._button.menu.box);
        this._button.menu._boxPointer.bin.set_child(this._scroll);
        Main.panel.addToStatusArea(this.uuid, this._button);
        this._buildMenu();
        this._button.connect('button-press-event', (_actor, event) => {
            if (event.get_button() !== 3) return Clutter.EVENT_PROPAGATE;
            this._toggle(!this._state?.receiving);
            return Clutter.EVENT_STOP;
        });
        this._button.menu.connect('open-state-changed', (_menu, open) => {
            if (open) {
                const monitor = Main.layoutManager.findMonitorForActor(this._button) || Main.layoutManager.primaryMonitor;
                const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
                this._scroll.style = `max-height: ${Math.max(240, Math.min(780, (monitor.height - 110) / scale))}px;`;
                this._refresh();
            }
            else this._stopNames();
        });
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        });
        this._radarTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            if (this._scanning()) {
                const angle = (Date.now() % 6000) / 6000 * Math.PI * 2;
                const travelled = (angle - this._sweepAngle + Math.PI * 2) % (Math.PI * 2);
                const [w, h] = [this._radar.width, this._radar.height];
                for (const peer of this._peers) {
                    if (!peer.name) continue;
                    const point = radarPoint(peer, w, h);
                    const bearing = (Math.atan2(point.x - w / 2, h / 2 - point.y) + Math.PI * 2) % (Math.PI * 2);
                    const distance = (bearing - this._sweepAngle + Math.PI * 2) % (Math.PI * 2);
                    if (travelled < 0.5 && distance > 0 && distance <= travelled) {
                        const tone = Math.max(1, Math.min(5, Math.round(((peer.rssi ?? -90) + 90) / 15) + 1));
                        this._playSound(`contact-${tone}.wav`);
                    }
                }
                this._sweepAngle = angle;
                this._radar.queue_repaint();
            }
            return GLib.SOURCE_CONTINUE;
        });
        this._refresh();
    }

    _item(menu, label, action) {
        const item = new PopupMenu.PopupMenuItem(label);
        if (action) item.connect('activate', action);
        else item.reactive = false;
        menu.addMenuItem(item);
        return item;
    }

    _text(menu, text, style = '') {
        const row = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        const label = new St.Label({text, style_class: `omdrop-status ${style}`, x_expand: true});
        label.clutter_text.line_wrap = true;
        label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        row.add_child(label);
        menu.addMenuItem(row);
        return label;
    }

    _buildMenu() {
        const menu = this._button.menu;
        this._text(menu, 'Omdrop · AirDrop', 'omdrop-heading');
        this._statusLabel = this._text(menu, _('正在读取状态…'));
        this._text(menu, tr('部分网卡在 AirDrop 开启时会暂时断开 Wi-Fi', 'Some adapters temporarily disconnect Wi-Fi while AirDrop is on'), 'omdrop-detail');
        this._switch = new PopupMenu.PopupSwitchMenuItem(_('接收文件'), false);
        menu.addMenuItem(this._switch);
        this._switch.connect('toggled', (_item, value) => this._toggle(value));
        this._windowMenu = new PopupMenu.PopupSubMenuMenuItem(_('可见时限'));
        menu.addMenuItem(this._windowMenu);
        this._windowRows = new Map();
        for (const [arg, label] of WINDOWS) {
            const item = this._item(this._windowMenu.menu, label, () => {
                this._settings.set_string('window', arg);
                this._render();
                if (this._state?.receiving) this._act(['on', arg]);
            });
            this._windowRows.set(arg, item);
        }
        this._audienceMenu = new PopupMenu.PopupSubMenuMenuItem(_('允许接收来源'));
        menu.addMenuItem(this._audienceMenu);
        this._everyone = this._item(this._audienceMenu.menu, _('所有人'), () => this._act(['visibility', 'everyone']));
        this._contacts = this._item(this._audienceMenu.menu, _('仅联系人'), () => this._act(['visibility', 'contacts']));
        this._sendersMenu = new PopupMenu.PopupSubMenuMenuItem(_('管理联系人'));
        menu.addMenuItem(this._sendersMenu);
        this._sendersMenu.menu.connect('open-state-changed', (_m, open) => { if (open) this._loadSenders(); });
        this._item(this._sendersMenu.menu, _('添加 Apple ID 邮箱或电话…'), () => this._addSender());
        this._nameItem = this._item(menu, _('设备名称…'), () => this._prompt(_('设备名称'), _('苹果设备将看到这个名称'), this._state?.name || '', value => this._act(['name', value])));
        this._dirItem = this._item(menu, _('保存目录…'), () => this._act(['dir', '--pick'], 0));
        this._item(menu, _('打开接收目录'), () => {
            const uri = Gio.File.new_for_path(this._state?.dir || GLib.get_home_dir()).get_uri();
            Gio.AppInfo.launch_default_for_uri_async(uri, global.create_app_launch_context(0, -1), null, (_o, result) => {
                try { Gio.AppInfo.launch_default_for_uri_finish(result); } catch (e) { this._error(e); }
            });
        });
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._scanSwitch = new PopupMenu.PopupSwitchMenuItem(_('发送到附近设备 / 雷达'), false);
        menu.addMenuItem(this._scanSwitch);
        this._scanSwitch.connect('toggled', (_item, on) => {
            this._scanWanted = on;
            if (on && !this._state?.receiving) this._toggle(true);
            if (!on) this._stopNames();
            this._render();
        });
        this._radarRow = new PopupMenu.PopupBaseMenuItem({reactive: false, can_focus: false});
        this._radar = new St.DrawingArea({style_class: 'omdrop-radar', reactive: true});
        this._radarRow.add_child(this._radar);
        menu.addMenuItem(this._radarRow);
        this._radar.connect('repaint', area => this._paintRadar(area));
        this._radar.connect('button-press-event', (_area, event) => {
            const [ok, x, y] = this._radar.transform_stage_point(...event.get_coords());
            if (!ok) return Clutter.EVENT_PROPAGATE;
            const [w, h] = [this._radar.width, this._radar.height];
            const peer = this._peers.find(p => {
                const pt = radarPoint(p, w, h);
                return Math.hypot(x - pt.x, y - pt.y) < 14;
            });
            if (peer) this._chooseSend(peer);
            return Clutter.EVENT_STOP;
        });
        this._scanLabel = this._text(menu, _('开启后查找附近设备；雷达位置不代表真实方向'), 'omdrop-detail');
        this._peersSection = new PopupMenu.PopupMenuSection();
        menu.addMenuItem(this._peersSection);
        this._transfer = this._text(menu, '', 'omdrop-detail');
        this._cancel = this._item(menu, _('取消发送'), () => {
            this._sendJob?.cancel();
            this._transfer.text = _('正在取消发送…');
        });
        this._cancel.visible = false;
        this._sound = new PopupMenu.PopupSwitchMenuItem(_('雷达提示音'), true);
        menu.addMenuItem(this._sound);
        this._sound.connect('toggled', (_item, value) => this._act(['sound', value ? 'on' : 'off']));
        const advanced = new PopupMenu.PopupSubMenuMenuItem(_('诊断与设置'));
        menu.addMenuItem(advanced);
        this._item(advanced.menu, _('检查运行环境'), () => this._report(['doctor'], _('运行环境检查')));
        this._item(advanced.menu, _('查看 AirDrop 身份'), () => this._report(['identity'], _('AirDrop 身份')));
        this._item(advanced.menu, _('传输容量上限…'), async () => {
            try {
                const value = await this._client.run(['limit']).promise;
                if (this._alive) this._prompt(_('传输容量上限'), _('占当前可用磁盘空间的百分比（1–90）'), value, v => this._act(['limit', v]));
            } catch (e) { this._error(e); }
        });
        this._item(advanced.menu, _('刷新状态'), () => this._refresh());
        this._item(advanced.menu, _('关于 GNOME 移植'), () => this._dialog('Omdrop Desktop · 0.1.0', tr('GNOME Shell 46 桌面前端。\n需要 Omdrop 命令行和兼容的无线后端。\n雷达距离反映信号强度，角度不代表方向。\n停用扩展不会自动关闭已经开启的接收窗口。', 'GNOME Shell 46 desktop frontend.\nRequires the Omdrop CLI and a compatible radio backend.\nRadar distance reflects signal strength; angles do not show direction.\nDisabling this extension does not stop an active receive window.')));
        this._errorLabel = this._text(menu, '', 'omdrop-error');
        this._render();
    }

    _dialog(title, message, entry = null, accept = null) {
        if (!this._alive) return;
        this._button.menu.close();
        const dialog = new ModalDialog.ModalDialog();
        this._dialogs.add(dialog);
        dialog.connect('destroy', () => this._dialogs?.delete(dialog));
        dialog.contentLayout.add_child(new St.Label({text: title, style_class: 'omdrop-heading'}));
        const label = new St.Label({text: message, style: 'max-width: 600px; margin-top: 12px;'});
        label.clutter_text.line_wrap = true;
        label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        dialog.contentLayout.add_child(label);
        let field;
        const finish = () => {
            const value = field?.get_text().trim();
            if (field && !value) return;
            dialog.close();
            if (accept) accept(value);
        };
        if (entry !== null) {
            field = new St.Entry({text: entry, style_class: 'omdrop-entry', can_focus: true});
            dialog.contentLayout.add_child(field);
            field.clutter_text.connect('activate', finish);
            dialog.setInitialKeyFocus(field);
        }
        dialog.setButtons(accept ? [
            {label: _('取消'), action: () => dialog.close(), key: Clutter.KEY_Escape},
            {label: entry === null ? _('确定') : _('保存'), action: finish, default: true},
        ] : [{label: _('关闭'), action: () => dialog.close(), key: Clutter.KEY_Escape, default: true}]);
        dialog.open();
    }

    _prompt(title, hint, initial, callback) { this._dialog(title, hint, initial, callback); }

    _error(error) {
        if (!this._alive) return;
        this._errorLabel.text = String(error.message || error).slice(0, 700);
        this._errorLabel.visible = true;
        Main.notify('Omdrop', this._errorLabel.text);
    }

    async _report(args, title) {
        try {
            const result = await this._client.run(args).promise;
            if (this._alive) this._dialog(title, result || _('没有其他信息'));
        } catch (e) { this._error(e); }
    }

    async _act(args, timeout = 180000) {
        if (this._busy || !this._alive) return false;
        const client = this._client;
        this._busy = true;
        this._epoch++;
        this._errorLabel.text = '';
        this._render();
        let success = false;
        try { await this._client.run(args, {timeout}).promise; success = true; }
        catch (e) { if (this._client === client) this._error(e); }
        finally {
            if (this._alive && this._client === client) {
                this._busy = false;
                this._epoch++;
                this._refresh();
                this._render();
            }
        }
        return success;
    }

    async _toggle(on) {
        if (this._busy) { this._render(); return; }
        if (!on && this._sendJob) {
            this._dialog(_('正在发送文件'), _('关闭接收会中断传输。请先使用“取消发送”，再关闭接收。'));
            this._render();
            return;
        }
        await this._act(on ? ['on', this._settings.get_string('window')] : ['off']);
        if (this._alive && !this._state?.receiving) this._stopNames();
    }

    async _refresh() {
        if (!this._alive) return;
        if (this._polling) { this._pollAgain = true; return; }
        const client = this._client;
        this._polling = true;
        const epoch = this._epoch;
        try {
            const state = await this._client.json(['status', '--json']);
            if (this._alive && this._client === client && epoch === this._epoch) {
                this._state = state;
                this._pollError = false;
                this._statusAt = GLib.get_monotonic_time();
                this._render();
            }
        } catch (e) { if (this._client === client) { if (!this._pollError) this._error(e); this._pollError = true; } }
        finally {
            if (this._client === client) {
                this._polling = false;
                this._lastStatus = Date.now();
                if (this._alive && this._pollAgain) { this._pollAgain = false; this._refresh(); }
            }
        }
    }

    _tick() {
        const now = Date.now();
        if (now - this._lastStatus >= (this._button.menu.isOpen ? 3000 : 10000)) this._refresh();
        if (this._state?.receiving) this._render();
        if (this._scanning()) {
            if (now - this._lastPeers > 2000) this._loadPeers();
            if (!this._namesJob && now - this._lastNames > 5000) this._lookupNames();
            this._radar.queue_repaint();
        }
    }

    _scanning() { return this._alive && this._scanWanted && this._button.menu.isOpen && this._state?.receiving && !this._busy; }

    _render() {
        if (!this._alive || !this._statusLabel) return;
        const s = this._state;
        const elapsed = this._statusAt ? Math.floor((GLib.get_monotonic_time() - this._statusAt) / 1000000) : 0;
        this._statusLabel.text = this._busy ? _('正在应用更改，请稍候…') : describeStatus(s, elapsed);
        this._switch.setToggleState(!!s?.receiving);
        this._switch.setSensitive(!this._busy);
        this._icon.opacity = s?.receiving ? 255 : 150;
        if (s?.visible) this._icon.add_style_class_name('omdrop-active');
        else this._icon.remove_style_class_name('omdrop-active');
        const window = this._settings.get_string('window');
        this._windowMenu.label.text = tr('可见时限：', 'Stay visible for: ') + (WINDOWS.find(w => w[0] === window)?.[1] || window);
        for (const [key, item] of this._windowRows) item.setOrnament(key === window ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
        this._windowMenu.setSensitive(!this._busy);
        this._audienceMenu.setSensitive(!this._busy);
        this._nameItem.setSensitive(!this._busy);
        this._dirItem.setSensitive(!this._busy);
        const contacts = s?.visibility === 'contacts';
        this._audienceMenu.label.text = tr('允许接收：', 'Who can send: ') + (contacts ? _('仅联系人') : _('所有人'));
        this._everyone.setOrnament(!contacts ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
        this._contacts.setOrnament(contacts ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
        this._sendersMenu.label.text = `${_('管理联系人')} (${s?.senders || 0})${contacts && !s?.senders ? _(' · 空列表拒收所有人') : ''}`;
        this._nameItem.label.text = tr('设备名称：', 'Device name: ') + (s?.name || '…');
        this._dirItem.label.text = tr('保存至：', 'Save to: ') + (s?.dir || '…').replace(GLib.get_home_dir(), '~');
        this._dirItem.label.clutter_text.ellipsize = Pango.EllipsizeMode.MIDDLE;
        this._sound.setToggleState(s?.sound !== false);
        this._sound.setSensitive(!this._busy);
        this._scanSwitch.setToggleState(this._scanWanted);
        this._radarRow.visible = this._scanWanted;
        this._scanLabel.visible = this._scanWanted;
        this._peersSection.actor.visible = this._scanWanted;
        this._errorLabel.visible = !!this._errorLabel.text;
        this._transfer.visible = !!this._transfer.text;
        this._cancel.visible = !!this._sendJob;
    }

    async _loadSenders() {
        try {
            const senders = await this._client.json(['senders', 'list', '--json']);
            if (!this._alive) return;
            this._sendersMenu.menu.removeAll();
            this._item(this._sendersMenu.menu, _('添加 Apple ID 邮箱或电话…'), () => this._addSender());
            for (const id of senders) this._item(this._sendersMenu.menu, tr('移除：', 'Remove: ') + id, () => {
                this._dialog(_('移除联系人'), id, null, async () => {
                    await this._act(['senders', 'remove', id]);
                    if (this._alive) this._loadSenders();
                });
            });
            if (!senders.length) this._item(this._sendersMenu.menu, _('尚未添加联系人'));
        } catch (e) { this._error(e); }
    }

    _addSender() {
        this._prompt(_('添加联系人'), _('填写对方 Apple ID 的邮箱或电话号码'), '', async value => {
            await this._act(['senders', 'add', value]);
            if (this._alive) this._loadSenders();
        });
    }

    async _loadPeers() {
        if (this._peerLoading) return;
        const client = this._client;
        this._peerLoading = true;
        try {
            const list = await this._client.json(['peers', '--json']);
            if (this._alive && this._client === client) { this._peers = normalizePeers(list, this._names); this._renderPeers(); }
        } catch (e) { if (this._client === client && this._scanning()) this._scanLabel.text = e.message.slice(0, 150); }
        finally { if (this._client === client) { this._peerLoading = false; this._lastPeers = Date.now(); } }
    }

    _lookupNames() {
        const client = this._client;
        try {
            const job = this._client.run(['peers', '--json', '-n', '--stream'], {timeout: 60000, line: text => {
                if (!this._alive || this._client !== client) return;
                try {
                    const p = JSON.parse(text);
                    if (p.mac && p.name) {
                        const mac = p.mac.toLowerCase();
                        if (!this._names.has(mac)) this._playSound();
                        this._names.set(mac, p.name);
                        this._peers = normalizePeers(this._peers, this._names);
                        this._renderPeers();
                    }
                } catch (_) { /* stderr progress is not a device record */ }
            }});
            this._namesJob = job;
            job.promise.catch(() => {}).finally(() => {
                if (this._namesJob === job) this._namesJob = null;
                this._lastNames = Date.now();
            });
        } catch (e) { this._error(e); this._lastNames = Date.now(); }
    }

    _stopNames() {
        this._namesJob?.cancel();
        for (const voice of this._voices || []) voice.cancel();
        this._voices = [];
    }

    _renderPeers() {
        if (!this._alive) return;
        const wanted = new Set(this._peers.map(p => p.mac));
        for (const [mac, row] of this._rows) if (!wanted.has(mac)) { row.destroy(); this._rows.delete(mac); }
        for (const peer of this._peers) {
            let row = this._rows.get(peer.mac);
            if (!row) {
                row = this._item(this._peersSection, '', () => this._chooseSend(this._peers.find(p => p.mac === peer.mac) || peer));
                this._rows.set(peer.mac, row);
            }
            row.label.text = `${peer.name || peer.mac}${peer.rssi === null ? '' : ` · ${peer.rssi} dBm`}`;
            row.setSensitive(!this._sendJob);
        }
        this._scanLabel.text = this._peers.length ? tr(`${this._peers.length} 台设备 · 点击设备或雷达圆点发送\n信号强度决定远近，角度不代表真实方向`, `${this._peers.length} device(s) · Click a device or radar dot to send\nDistance reflects signal strength, not physical location`) : _('正在查找… 在苹果设备上开启 AirDrop“所有人”');
        this._radar.queue_repaint();
    }

    _chooseSend(peer) {
        if (this._sendJob || !peer) return;
        const dialog = new ModalDialog.ModalDialog();
        this._dialogs.add(dialog);
        dialog.connect('destroy', () => this._dialogs?.delete(dialog));
        this._button.menu.close();
        dialog.contentLayout.add_child(new St.Label({text: tr('发送到 ', 'Send to ') + (peer.name || peer.mac)}));
        dialog.setButtons([
            {label: _('取消'), key: Clutter.KEY_Escape, action: () => dialog.close()},
            {label: _('发送链接'), action: () => { dialog.close(); this._prompt(_('发送网页链接'), _('输入 http:// 或 https:// 链接'), '', url => {
                if (!/^https?:\/\//i.test(url)) { this._error(new Error('请输入 http 或 https 链接')); return; }
                this._send(peer, ['send', '--to', peer.mac, url]);
            }); }},
            {label: _('选择文件…'), default: true, action: () => { dialog.close(); this._send(peer, ['send', '--pick', '--to', peer.mac]); }},
        ]);
        dialog.open();
    }

    async _send(peer, args) {
        if (!this._alive || this._sendJob) return;
        const client = this._client;
        this._transfer.text = tr(`正在向 ${peer.name || peer.mac} 发送…`, `Sending to ${peer.name || peer.mac}…`);
        try {
            const job = this._client.run(args, {timeout: 0, line: text => {
                if (this._alive && this._client === client && text.trim()) {
                    this._transfer.text = text.trim().slice(-400);
                    this._button.menu.open();
                }
            }});
            this._sendJob = job;
            this._render();
            await job.promise;
            if (this._alive && this._client === client) { this._transfer.text = _('发送完成'); Main.notify('Omdrop', tr('已发送到 ', 'Sent to ') + (peer.name || peer.mac)); }
        } catch (e) {
            if (this._alive && this._client === client) {
                this._transfer.text = this._sendJob?.cancelled ? _('发送已取消') : e.message;
                if (!this._sendJob?.cancelled && e.message !== _('操作未完成')) this._error(e);
            }
        } finally {
            if (this._client === client) {
                this._sendJob = null;
                if (this._alive) { this._button.menu.open(); this._render(); this._renderPeers(); }
            }
        }
    }

    _paintRadar(area) {
        const [w, h] = area.get_surface_size();
        const cr = area.get_context();
        const r = Math.min(w, h) * 0.43;
        cr.setLineWidth(1);
        cr.setSourceRGBA(0.45, 0.8, 0.7, 0.3);
        for (const fraction of [0.33, 0.66, 1]) { cr.arc(w / 2, h / 2, r * fraction, 0, Math.PI * 2); cr.stroke(); }
        cr.moveTo(w / 2 - r, h / 2); cr.lineTo(w / 2 + r, h / 2);
        cr.moveTo(w / 2, h / 2 - r); cr.lineTo(w / 2, h / 2 + r); cr.stroke();
        if (this._scanning()) {
            const angle = (Date.now() % 6000) / 6000 * Math.PI * 2;
            cr.setSourceRGBA(0.5, 0.9, 0.75, 0.6);
            cr.moveTo(w / 2, h / 2); cr.lineTo(w / 2 + Math.sin(angle) * r, h / 2 - Math.cos(angle) * r); cr.stroke();
        }
        for (const peer of this._peers) {
            const p = radarPoint(peer, w, h);
            cr.setSourceRGBA(0.55, 0.95, 0.8, peer.name ? 1 : 0.45);
            cr.arc(p.x, p.y, peer.name ? 5 : 3, 0, Math.PI * 2); cr.fill();
        }
        cr.$dispose();
    }

    _playSound(filename = 'blip.wav') {
        if (!this._scanning() || this._state?.sound === false) return;
        const file = Gio.File.new_for_path(soundPath(filename));
        if (!file.query_exists(null)) return;
        const voice = new Gio.Cancellable();
        if (this._voices.length >= 3) this._voices.shift().cancel();
        this._voices.push(voice);
        try { global.display.get_sound_player().play_from_file(file, 'Omdrop: nearby device', voice); } catch (_) { /* optional audio */ }
    }

    disable() {
        this._alive = false;
        this._stopNames();
        if (this._timer) GLib.Source.remove(this._timer);
        if (this._radarTimer) GLib.Source.remove(this._radarTimer);
        this._timer = 0;
        this._radarTimer = 0;
        this._client?.close();
        for (const dialog of this._dialogs || []) dialog.destroy();
        this._dialogs?.clear();
        this._button?.destroy();
        this._button = null;
        this._settings = null;
        this._client = null;
        this._rows?.clear();
    }
}
