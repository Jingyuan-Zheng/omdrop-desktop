# Installation paths and recovery

Run the scripts as your desktop user. `XDG_DATA_HOME` defaults to
`~/.local/share`.

| Target | Installed path below XDG_DATA_HOME |
| --- | --- |
| Shell extension | `gnome-shell/extensions/omdrop-desktop@local/` |
| Nautilus provider | `nautilus-python/extensions/omdrop-desktop.py` |
| GTK helper | `omdrop-desktop/send-window.py` and `runtime.py` |
| Recoverable old versions | `omdrop-desktop-backups/<UTC timestamp>/` |

Only the `window` preference is saved in the extension's GSettings schema,
`org.gnome.shell.extensions.omdrop-desktop`. Receiving settings remain owned by
upstream Omdrop. The extension UUID is a local/distribution identifier, not a
claim to an official GNOME Extensions listing.

The installer stages files and compiles schemas before replacing targets. It
refuses unrecognized targets and symlinked installation paths. It backs up its
own previous version before installing. If a copy fails, the changed targets
are rolled back. Keep backups until you are satisfied with an update.

`--no-enable` skips calls to the GNOME extension manager. `--data-dir /absolute/path`
installs into an isolated data root and always skips GNOME settings changes;
this is primarily for packaging and tests. Neither flag installs a backend.

On GNOME 46, newly discovered extensions and already-imported JavaScript can
require a session restart. On Wayland, save work, log out and log in. The scripts
never force a restart. Nautilus likewise loads Python extensions at process
startup; restart it only after file operations finish.

To recover after uninstall, move the relevant `shell`, `helper` or `provider`
entry from the printed backup directory back to the target path above, then
reload the corresponding application. `gnome-extensions install` bypasses the
script's ownership markers; use the GNOME extension tool to uninstall a Shell
zip that was installed directly rather than through this repository's installer.
