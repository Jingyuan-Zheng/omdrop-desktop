# Omdrop Desktop managed Nautilus provider
"""Nautilus 4 menu provider; radio and transfer work happens outside Nautilus."""
import os
import subprocess
import shutil
import gi

gi.require_version('Nautilus', '4.0')
from gi.repository import Gio, GLib, GObject, Nautilus


class OmdropMenuProvider(GObject.GObject, Nautilus.MenuProvider):
    def get_file_items(self, *args):
        files = args[-1]
        if not files:
            return []
        paths = []
        for file in files:
            path = file.get_location().get_path()
            if file.is_directory() or not path or not os.path.isfile(path) or not os.access(path, os.R_OK):
                return []
            paths.append(path)
        helper = os.path.join(GLib.get_user_data_dir(), 'omdrop-desktop', 'send-window.py')
        configured = os.environ.get('OMDROP_CLI', '')
        local = os.path.join(os.environ.get('XDG_BIN_HOME', os.path.join(GLib.get_home_dir(), '.local/bin')), 'omdrop')
        cli = configured if os.path.isabs(configured) else (local if os.access(local, os.X_OK) else shutil.which('omdrop'))
        if not os.path.isfile(helper) or not cli or not os.access(cli, os.X_OK):
            return []
        item = Nautilus.MenuItem(name='OmdropDesktop::SendFiles', label='Send with Omdrop…',
                                 tip='Send selected files to a nearby Apple device using AirDrop',
                                 icon='document-send-symbolic')
        item.connect('activate', self._activate, helper, paths)
        return [item]

    def _activate(self, _item, helper, paths):
        # argv preserves spaces, quotes, newlines and non-ASCII filenames.
        env = os.environ.copy()
        env['PATH'] = '/usr/bin:/bin:' + env.get('PATH', '')
        try:
            subprocess.Popen(['/usr/bin/python3', helper, '--', *paths], env=env,
                             start_new_session=True, stdin=subprocess.DEVNULL)
        except OSError as error:
            print('Omdrop Nautilus:', error)
