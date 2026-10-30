#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
if ! command -v xvfb-run >/dev/null 2>&1; then
    echo 'Install xvfb to run this display-isolated GTK4 smoke test.' >&2
    exit 1
fi
exec env GDK_BACKEND=x11 GSK_RENDERER=cairo GTK_A11Y=none xvfb-run -a /usr/bin/python3 tests/ui_smoke.py
