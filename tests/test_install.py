import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
MANAGER = ROOT / 'tools/manage.py'


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='omdrop-install-test-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name) / 'data'

    def run_manager(self, command, *extra):
        return subprocess.run([sys.executable,str(MANAGER),command,'--data-dir',str(self.base),*extra], capture_output=True,text=True)

    def test_install_upgrade_recoverable_uninstall(self):
        result = self.run_manager('install')
        self.assertEqual(result.returncode,0,result.stderr)
        target = self.base / 'gnome-shell/extensions/omdrop-desktop@local'
        self.assertEqual(json.loads((target/'metadata.json').read_text())['uuid'],'omdrop-desktop@local')
        self.assertTrue((target/'schemas/gschemas.compiled').is_file())
        self.assertTrue((self.base/'omdrop-desktop/runtime.py').exists())
        self.assertEqual(self.run_manager('install').returncode,0)
        self.assertTrue(list((self.base/'omdrop-desktop-backups').iterdir()))
        self.assertEqual(self.run_manager('uninstall').returncode,0)
        self.assertFalse(target.exists())
        self.assertFalse((self.base/'nautilus-python/extensions/omdrop-desktop.py').exists())
        self.assertTrue(list((self.base/'omdrop-desktop-backups').glob('*/shell/metadata.json')))

    def test_unknown_target_is_preserved(self):
        target = self.base/'nautilus-python/extensions/omdrop-desktop.py'
        target.parent.mkdir(parents=True)
        target.write_text('# user-owned data\n')
        result = self.run_manager('install')
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(target.read_text(),'# user-owned data\n')
        self.assertFalse((self.base/'gnome-shell/extensions/omdrop-desktop@local').exists())

    def test_uninstall_refuses_symlink(self):
        self.base.mkdir()
        outside = Path(self.temp.name)/'unrelated'
        outside.mkdir()
        (self.base/'omdrop-desktop').symlink_to(outside,target_is_directory=True)
        result = self.run_manager('uninstall','--component','nautilus')
        self.assertNotEqual(result.returncode,0)
        self.assertTrue(outside.exists())
