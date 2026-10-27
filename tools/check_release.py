#!/usr/bin/python3
"""Inspect public source archives and produce SHA-256 checksums."""
import hashlib
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BAD_PARTS = {'.git', '__pycache__', '.aws', '.omdrop', 'node_modules'}
BAD_SUFFIXES = {'.pem', '.key', '.p12', '.cms', '.pcap', '.pcapng', '.pyc', '.log'}
PRIVATE_PATH = re.compile(rb'/(?:home|media)/[A-Za-z0-9_\-]+/')
KEY = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
TOKEN = re.compile(rb'(?<![A-Za-z0-9])(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})')


def check(name, payload):
    path = Path(name)
    if set(path.parts) & BAD_PARTS or path.suffix in BAD_SUFFIXES:
        raise ValueError(f'Non-public artifact: {name}')
    if PRIVATE_PATH.search(payload) or KEY.search(payload) or TOKEN.search(payload):
        raise ValueError(f'Potential private data in {name}; inspect locally before release')


def main():
    # Check source allowlisted by Git semantics, excluding generated artifacts.
    for folder in ('extension', 'nautilus', 'tools', 'scripts', 'tests', 'docs', 'patches', '.github'):
        for path in (ROOT/folder).rglob('*'):
            if path.is_file() and '__pycache__' not in path.parts:
                check(str(path.relative_to(ROOT)), path.read_bytes())
    archives = sorted((ROOT/'dist').glob('*.zip'))
    if len(archives) != 2:
        raise ValueError('Build exactly the two release zip files first')
    for archive in archives:
        with zipfile.ZipFile(archive) as bundle:
            if bundle.testzip() is not None:
                raise ValueError(f'Corrupt archive: {archive.name}')
            for name in bundle.namelist():
                check(name,bundle.read(name))
    sums = ''.join(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n' for path in archives)
    (ROOT/'dist/SHA256SUMS').write_text(sums)
    print('PASS: source and both archives contain no detected local paths, credentials, keys or runtime artifacts')
    print(sums,end='')


if __name__ == '__main__':
    main()
