import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from gi.repository import Gio, GLib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'nautilus'))


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


menu = load('omdrop_menu_test', ROOT / 'nautilus/omdrop-desktop.py')
sender = load('omdrop_sender_test', ROOT / 'nautilus/send-window.py')


class File:
    def __init__(self, uri, directory=False):
        self.uri, self.directory = uri, directory
    def get_location(self):
        return Gio.File.new_for_uri(self.uri)
    def is_directory(self):
        return self.directory


class NautilusTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='omdrop-menu-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'omdrop-desktop').mkdir()
        (self.root / 'omdrop-desktop/send-window.py').touch()
        self.files = [self.root / 'space name.txt', self.root / "quote'中文\nfile.txt"]
        for path in self.files:
            path.write_text('fixture')
        self.provider = menu.OmdropMenuProvider()

    def test_menu_and_argv(self):
        infos = [File(path.as_uri()) for path in self.files]
        with patch.object(GLib, 'get_user_data_dir', return_value=str(self.root)), patch.dict(os.environ, {'OMDROP_CLI':str(ROOT/'tests/fixtures/mock-cli.py')}):
            items = self.provider.get_file_items(infos)
        self.assertEqual(len(items),1)
        self.assertEqual(items[0].props.label,'Send with Omdrop…')
        with patch.object(menu.subprocess,'Popen') as launch:
            items[0].emit('activate')
        self.assertEqual(launch.call_args.args[0][-3:], ['--', *map(str,self.files)])

    def test_exclusions(self):
        self.assertEqual(self.provider.get_file_items([]), [])
        self.assertEqual(self.provider.get_file_items([File(self.root.as_uri(), True)]), [])
        self.assertEqual(self.provider.get_file_items([File('sftp://example.invalid/demo')]), [])

    def test_validation(self):
        sender.validate_files([str(path) for path in self.files])
        for paths in ([], [str(self.root)], [str(self.files[0]),str(self.files[0])], ['relative.txt']):
            with self.assertRaises(ValueError):
                sender.validate_files(paths)

    def test_job_progress_and_cancel(self):
        loop = GLib.MainLoop()
        results, lines = [], []
        def finished(rc, text, error):
            results.append((rc,text,error))
            loop.quit()
            return GLib.SOURCE_REMOVE
        with patch.object(sender,'CLI', str(ROOT/'tests/fixtures/mock-cli.py')):
            job = sender.Job(['test-delay'], finished, lines.append, timeout=0.1)
            watchdog = GLib.timeout_add_seconds(10, lambda: (loop.quit(), GLib.SOURCE_REMOVE)[1])
            loop.run()
            GLib.source_remove(watchdog)
        self.assertEqual(results[0][0],130)
        self.assertTrue(job.cancelled)


if __name__ == '__main__':
    unittest.main()
