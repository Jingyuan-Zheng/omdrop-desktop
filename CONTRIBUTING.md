# Contributing

Use the system GJS and Python supplied with GNOME 46. This repository has no npm
or pip dependencies. Install the platform packages described in README.md, then
run `make test` before proposing a change. The optional GTK test needs `xvfb`.

Keep Nautilus menu construction nonblocking. Run discovery and transfers outside
the file manager process. Pass file paths as argv with `--`; never interpolate
filenames or peer names into shell commands. Preserve exact file selections and
the distinction between receiver running, radio visible and radio unknown.

The backend owns identities, receive windows and privileges. Do not introduce
root execution into the frontend, replace a user's identity, or silently change
firewall/NetworkManager settings. Keep process cancellation and disable/re-enable
behavior covered by tests when changing asynchronous code.

Shell strings use `extension/i18n.js`. Add an English translation for every new
Chinese source string, or use `tr(chinese, english)` for dynamic strings. The
first preferred session language decides; a secondary Chinese fallback must
not make an English desktop Chinese. Nautilus strings stay English.

Declare additional Shell versions only after testing them. Report a real
Apple-device transfer separately from fixture tests, with hardware, driver,
kernel, backend version, direction and approximate payload size. Redact personal
names, identifiers and addresses. Do not attach certificate files or packet captures.

By contributing, you agree to license your contribution under this repository's
MIT license. Preserve upstream notices when adapting upstream code.
