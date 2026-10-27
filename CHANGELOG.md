# Changelog

## 0.1.0 — Initial public source preparation

- Package the GNOME Shell 46 frontend, Nautilus provider and GTK4 sender in one repository.
- Provide Chinese / English Shell localization and an English Nautilus UI.
- Discover the external Omdrop CLI through user installation paths, PATH or OMDROP_CLI.
- Use project-neutral identifiers, XDG paths and user-only installation scripts.
- Add schema validation, recoverable upgrades/removal, offline tests and CI.
- Preserve upstream attribution and the pinned Debian CLI compatibility patch.

Earlier private desktop installations used other UUIDs and paths. This release
does not automatically overwrite them; see docs/MIGRATION.md.
