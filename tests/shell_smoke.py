"""Explicitly opt-in private compositor test; does not replace the desktop."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
UUID = 'omdrop-desktop@local'


def parent():
    if not shutil.which('gnome-shell') or not shutil.which('dbus-run-session'):
        raise SystemExit('Install GNOME Shell 46 and dbus-run-session for this optional test.')
    with tempfile.TemporaryDirectory(prefix='omdrop-shell-test-') as temp:
        base = Path(temp)
        extensions = base/'data/gnome-shell/extensions'
        shutil.copytree(ROOT/'extension', extensions/UUID)
        subprocess.run(['glib-compile-schemas','--strict',str(extensions/UUID/'schemas')],check=True)
        shutil.copytree(ROOT/'tests/shell-harness',extensions/'omdrop-test@local')
        env = os.environ.copy()
        env.update(XDG_DATA_HOME=str(base/'data'),XDG_CONFIG_HOME=str(base/'config'),
                   OMDROP_ISOLATED_TEST='1',OMDROP_CLI=str(ROOT/'tests/fixtures/mock-cli.py'))
        # Set isolation variables before starting D-Bus so activated services
        # inherit them too. Never point dconf at the real user's configuration.
        result = subprocess.run(['dbus-run-session','--',sys.executable,__file__,'--inside'],env=env)
        raise SystemExit(result.returncode)


def inside():
    from gi.repository import Gio, GLib
    if os.environ.get('OMDROP_ISOLATED_TEST') != '1':
        raise SystemExit('Private test flag required')
    subprocess.run(['gsettings','set','org.gnome.shell','enabled-extensions',
                    "['omdrop-test@local', 'omdrop-desktop@local']"],check=True)
    subprocess.run(['gsettings','set','org.gnome.shell','disable-user-extensions','false'],check=True)
    wayland_display = f'omdrop-desktop-test-{os.getpid()}'
    shell = subprocess.Popen(['gnome-shell','--headless','--wayland','--no-x11',
                              '--wayland-display',wayland_display,
                              '--virtual-monitor','1280x960','--mode=user'])
    bus = Gio.bus_get_sync(Gio.BusType.SESSION,None)
    def evaluate(code):
        ok,value = bus.call_sync('org.gnome.Shell','/org/gnome/Shell','org.gnome.Shell','Eval',
                               GLib.Variant('(s)',(code,)),GLib.VariantType.new('(bs)'),
                               Gio.DBusCallFlags.NONE,10000,None).unpack()
        if not ok:
            raise RuntimeError(value or 'Test shell not ready')
        return json.loads(value) if value else None
    try:
        for _ in range(40):
            time.sleep(0.5)
            try:
                if evaluate('global.context.unsafe_mode'):
                    break
            except Exception:
                continue
        else:
            raise RuntimeError('Private compositor did not become ready')
        state = evaluate("global.odTest=Main.extensionManager.lookup('omdrop-desktop@local').stateObj; ({alive:global.odTest._alive,state:Main.extensionManager.lookup('omdrop-desktop@local').state})")
        assert state['alive'] and state['state']==1,state
        evaluate('Main.overview.hide(); global.odTest._button.menu.open(); true')
        time.sleep(1)
        expected = '接收文件' if os.environ.get('LANGUAGE','').startswith('zh') else 'Receive files'
        assert evaluate('global.odTest._switch.label.text')==expected
        evaluate('global.odTest._state.receiving=true; global.odTest._state.visible=true; global.odTest._scanWanted=true; global.odTest._render(); global.odTest._loadPeers(); true')
        time.sleep(0.5)
        assert evaluate('global.odTest._rows.size')==2
        evaluate('global.odTest._prompt("Demo","Test dialog","Demo computer",()=>{}); true')
        assert evaluate('global.odTest._dialogs.size')==1
        evaluate('for (const d of global.odTest._dialogs) d.close(); global.odTest.disable(); true')
        time.sleep(0.3)
        evaluate('global.odTest.enable(); true')
        assert evaluate('global.odTest._alive')
        print('PASS: private GNOME load, locale, menu, radar, device rows, dialog and re-enable',flush=True)
        gtk_env = os.environ.copy()
        gtk_env.update(GDK_BACKEND='wayland',WAYLAND_DISPLAY=wayland_display,
                       GTK_USE_PORTAL='0',GTK_A11Y='none',GTK_IM_MODULE='simple')
        subprocess.run([sys.executable,str(ROOT/'tests/ui_smoke.py')],env=gtk_env,check=True,timeout=45)
    finally:
        shell.terminate()
        try:
            shell.wait(timeout=8)
        except subprocess.TimeoutExpired:
            shell.kill()
            shell.wait()


if __name__=='__main__':
    inside() if '--inside' in sys.argv else parent()
