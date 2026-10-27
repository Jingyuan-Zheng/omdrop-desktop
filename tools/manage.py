#!/usr/bin/python3
"""Build and manage this user's frontend files. Never touches radio settings."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
UUID = 'omdrop-desktop@local'
MARKER = '.omdrop-desktop-owned'
PROVIDER_HEADER = b'# Omdrop Desktop managed Nautilus provider\n'


def data_home():
    return Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share')).absolute()


def targets(base, component):
    result = []
    if component in ('all', 'shell'):
        result.append(('shell', base / 'gnome-shell/extensions' / UUID))
    if component in ('all', 'nautilus'):
        result.extend([('helper', base / 'omdrop-desktop'),
                       ('provider', base / 'nautilus-python/extensions/omdrop-desktop.py')])
    return result


def owned(kind, path):
    if path.is_symlink():
        return False
    if kind == 'provider':
        return path.is_file() and path.read_bytes().startswith(PROVIDER_HEADER)
    return path.is_dir() and (path / MARKER).is_file() and (path / MARKER).read_text().strip() == UUID


def validate_targets(entries):
    # Check every target before changing any target.
    for kind, path in entries:
        if path.exists() or path.is_symlink():
            if not owned(kind, path):
                raise RuntimeError(f'Refusing to replace an unrecognized file/directory: {path}')
        for parent in path.parents:
            if parent.is_symlink():
                raise RuntimeError(f'Refusing a symlinked installation path: {parent}')


def backup_root(base):
    # Keep recoverable removals beside this install's data root, including
    # isolated --data-dir installs. No user identities or backend files move.
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    return base / 'omdrop-desktop-backups' / stamp


def shell_control(action, args):
    if args.no_enable or args.data_dir is not None or args.component == 'nautilus':
        return
    executable = shutil.which('gnome-extensions')
    if not executable:
        print('GNOME extension tool not found. Enable Omdrop Desktop after logging in.')
        return
    result = subprocess.run([executable, action, UUID], capture_output=True, text=True)
    if result.returncode:
        print('GNOME has not loaded the extension yet. Log out, log in, then run:')
        print(f'  gnome-extensions enable {UUID}')


def install(args):
    base = (args.data_dir or data_home()).absolute()
    entries = targets(base, args.component)
    validate_targets(entries)
    if args.component in ('all', 'shell') and not shutil.which('glib-compile-schemas'):
        raise RuntimeError('Install glib-compile-schemas (Debian/Ubuntu: libglib2.0-bin) first.')
    if args.data_dir is None:
        legacy = [base / 'nautilus-python/extensions/omdrop-nautilus.py']
        for metadata in (base / 'gnome-shell/extensions').glob('*/metadata.json'):
            try:
                if json.loads(metadata.read_text()).get('settings-schema') == 'org.gnome.shell.extensions.omdrop':
                    legacy.append(metadata.parent)
            except (OSError, ValueError):
                continue
        if any(path.exists() for path in legacy):
            print('NOTE: a previous private Omdrop frontend is installed. See docs/MIGRATION.md to avoid duplicate menus.')
    with tempfile.TemporaryDirectory(prefix='omdrop-desktop-stage-') as temp:
        staging = Path(temp)
        for kind, target in entries:
            prepared = staging / kind
            if kind == 'shell':
                shutil.copytree(ROOT / 'extension', prepared, ignore=shutil.ignore_patterns('gschemas.compiled', '__pycache__'))
                subprocess.run(['glib-compile-schemas', '--strict', str(prepared / 'schemas')], check=True)
                (prepared / MARKER).write_text(UUID + '\n')
            elif kind == 'helper':
                prepared.mkdir()
                for name in ('send-window.py', 'runtime.py'):
                    shutil.copy2(ROOT / 'nautilus' / name, prepared / name)
                (prepared / MARKER).write_text(UUID + '\n')
            else:
                shutil.copy2(ROOT / 'nautilus/omdrop-desktop.py', prepared)
        saved = backup_root(base)
        changed = []
        try:
            for kind, target in entries:
                target.parent.mkdir(parents=True, exist_ok=True)
                previous = None
                if target.exists():
                    saved.mkdir(parents=True, exist_ok=True)
                    previous = saved / kind
                    shutil.move(str(target), previous)
                changed.append((kind, target, previous))
                prepared = staging / kind
                if prepared.is_dir():
                    shutil.copytree(prepared, target)
                else:
                    shutil.copy2(prepared, target)
                print(f'Installed {target}')
        except Exception:
            # Only remove exact newly created, owned targets while rolling
            # back; never remove a broad data directory.
            for kind, target, previous in reversed(changed):
                if target.exists():
                    if target.is_dir():
                        shutil.rmtree(target)
                    else:
                        target.unlink()
                if previous and previous.exists():
                    shutil.move(str(previous), target)
            raise
        if saved.exists():
            print(f'Previous files saved to {saved}')
    shell_control('enable', args)
    print('Restart Files to load its menu when no file operations are running.')
    print('Wayland: log out and back in to load new GNOME Shell code.')


def uninstall(args):
    base = (args.data_dir or data_home()).absolute()
    entries = [(kind, path) for kind, path in targets(base, args.component) if path.exists() or path.is_symlink()]
    validate_targets(entries)
    if not entries:
        print('No Omdrop Desktop files installed in this data directory.')
        return
    shell_control('disable', args)
    saved = backup_root(base)
    saved.mkdir(parents=True)
    for kind, path in entries:
        shutil.move(str(path), saved / kind)
    print(f'Frontend removed. Recoverable files: {saved}')
    print('The Omdrop backend, certificates, contacts and settings were left in place.')


def package(_args):
    version = (ROOT / 'VERSION').read_text().strip()
    output = ROOT / 'dist'
    output.mkdir(exist_ok=True)
    archive = output / f'{UUID}.shell-extension.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted((ROOT / 'extension').rglob('*')):
            if path.is_file() and path.name != 'gschemas.compiled':
                bundle.write(path, path.relative_to(ROOT / 'extension'))
        for name in ('LICENSE', 'NOTICE.md'):
            bundle.write(ROOT / name, name)
    source = output / f'omdrop-desktop-{version}.zip'
    # This allowlist intentionally excludes .git, local configs, recordings,
    # logs, screenshots and build directories.
    paths = []
    for directory in ('extension', 'nautilus', 'tools', 'scripts', 'tests', 'docs', 'patches', '.github'):
        paths.extend((ROOT / directory).rglob('*'))
    paths.extend(ROOT / name for name in ('README.md', 'LICENSE', 'NOTICE.md', 'VERSION', 'Makefile', '.gitignore', '.gitattributes', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md'))
    with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(paths):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc' and path.name != 'gschemas.compiled':
                bundle.write(path, f'omdrop-desktop-{version}/{path.relative_to(ROOT)}')
    print(archive)
    print(source)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for command in ('install', 'uninstall'):
        item = sub.add_parser(command)
        item.add_argument('--component', choices=('all', 'shell', 'nautilus'), default='all')
        item.add_argument('--data-dir', type=Path, help='isolated data root; skips GNOME settings changes')
        item.add_argument('--no-enable', action='store_true', help='do not invoke gnome-extensions')
    sub.add_parser('package')
    args = parser.parse_args()
    if getattr(args, 'data_dir', None) is not None:
        args.data_dir = args.data_dir.absolute()
        if args.data_dir == Path('/') or len(args.data_dir.parts) < 3:
            parser.error('--data-dir must be a specific user data directory')
    try:
        globals()[args.command](args)
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'Error: {error}\n')


if __name__ == '__main__':
    main()
