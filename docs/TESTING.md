# Testing and limits

## Automated offline suite

Run `make test`. It covers:

- User-level installation, schema compilation, recognized upgrades, backups and recoverable uninstall.
- Refusal to overwrite unknown files or follow a symlinked removal target.
- Nautilus file/selection filtering, exact argv handoff and duplicate-basename validation.
- Python and GJS subprocess cancellation, errors, timeouts and resource cleanup.
- Status/countdown behavior, device deduplication, radar coordinates and locale fallback.
- English string coverage for static Shell UI messages.

No test invokes the real `omdrop` CLI. The executable fixture at
`tests/fixtures/mock-cli.py` implements a few deterministic commands and never
accesses networking or a radio helper.

`sh scripts/test-ui.sh` uses Xvfb to exercise the real GTK4 widgets against the
fixture: start, discover, select files, cancel and stop. It does not test an
Apple-device transfer. `sh scripts/test-shell.sh` optionally starts a private
D-Bus session and a headless GNOME compositor to load the actual GJS frontend.
It does not replace the running desktop. Only the isolated test harness enables
its compositor's Eval debug facility; that harness is never installed or bundled
in the Shell extension zip. This test also runs the GTK4 smoke test inside that
private Wayland compositor, so it is an alternative when Xvfb is unavailable.

## Manual end-to-end check

1. Save online work. On exclusive-mode adapters, expect ordinary Wi-Fi to disconnect.
2. Put the recipient's AirDrop in Everyone mode, and open a ten-minute receive window.
3. Wait for visible status; send a small, non-sensitive file from the Apple device.
4. Confirm the saved payload in the selected download folder, not only a success banner.
5. Send a different small file back, accept it on the Apple device, and open it there.
6. Repeat through Nautilus with two distinct filenames and verify both payloads.
7. Cancel a transfer, turn receiving off and confirm ordinary Wi-Fi reconnects.

For exact integrity checks use a non-transformed file and compare its SHA-256 at
both ends where tools are available. Photo apps may transform/export photos, so
do not infer a bug from a different exported-image hash alone.

Record version/hardware facts rather than publishing debug logs wholesale. The
original private integration had a user report of successful receiving, but its
simulated GUI tests did not establish bidirectional Apple transfer reliability.
Fresh source packaging is likewise not an end-to-end certification.
