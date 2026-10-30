"""Display the actual GTK sender with demo files and an offline backend."""
import importlib.util
from pathlib import Path
import sys
from gi.repository import GLib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'nautilus'))
spec = importlib.util.spec_from_file_location('demo_send_window',ROOT/'nautilus/send-window.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.CLI = str(ROOT/'tests/fixtures/mock-cli.py')
app = module.SendWindow([str(ROOT/'README.md'),str(ROOT/'LICENSE')])


def ready(_app):
    def discover():
        app.receiving = True
        app.start.set_label('Find nearby devices')
        app.stop.set_sensitive(True)
        app.scan()
        return GLib.SOURCE_REMOVE
    GLib.timeout_add(500,discover)


app.connect('activate',ready)
app.run(['omdrop-demo-sender'])
