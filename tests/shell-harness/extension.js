import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
export default class Harness extends Extension {
    enable() {
        if (GLib.getenv('OMDROP_ISOLATED_TEST') === '1') global.context.unsafe_mode = true;
    }
    disable() { global.context.unsafe_mode = false; }
}
