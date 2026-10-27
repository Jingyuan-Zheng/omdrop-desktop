# Migrating an earlier private installation

The first private build used a different extension UUID/schema, a Nautilus
provider named `omdrop-nautilus.py`, and a helper directory named
`omdrop-nautilus`. The public package uses new names so that it does not silently
overwrite an unrelated or locally edited installation.

1. Turn receiving off and finish/cancel transfers.
2. Find the previous UUID with `gnome-extensions list` and disable it with
   `gnome-extensions disable OLD_UUID`, substituting the actual UUID.
3. If the old provider exists, move
   `~/.local/share/nautilus-python/extensions/omdrop-nautilus.py` to a backup
   directory outside the Python extension search path. Keep the old helper if
   you may want to roll back.
4. Install this package, then log out and log in. Restart Files after any file
   operations finish.

The new extension starts with the default 10-minute window. Set the window in
its menu if needed. No contacts, identities, download paths or backend files
need to be moved. Avoid leaving both panel extensions enabled or both Nautilus
providers loaded, since that would create duplicate controls and menu items.
