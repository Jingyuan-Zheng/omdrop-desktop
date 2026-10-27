"""User-session paths, without per-machine configuration."""
import os
import shutil
from gi.repository import GLib


def cli_path():
    configured = os.environ.get('OMDROP_CLI')
    if configured and os.path.isabs(configured):
        return configured
    local = os.path.join(os.environ.get('XDG_BIN_HOME', os.path.join(GLib.get_home_dir(), '.local/bin')), 'omdrop')
    if os.access(local, os.X_OK):
        return local
    return shutil.which('omdrop') or local
