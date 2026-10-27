# Attribution and boundaries

Omdrop Desktop is an independent GNOME frontend inspired by and adapted from
the behavior of [Omdrop](https://github.com/brentkearney/omdrop-plugin), copyright
2026 Brent Kearney, distributed under the MIT License. The upstream notice is
retained in [docs/UPSTREAM-LICENSE](docs/UPSTREAM-LICENSE). The original QML panel
is not bundled; this repository supplies a GJS panel and a GTK4 file-sending UI.
The Debian compatibility patch changes upstream MIT-licensed CLI code.

The source baseline used for integration was Omdrop 0.16.1, upstream commit
`6af4908310a4fcd1ba7800fcc7b83156bbd7ee77`. Compatibility with later versions
requires testing; this is not an upstream-supported release.

The [omdrop-owl](https://github.com/t4t5/omdrop-owl),
[OWL](https://github.com/jedbillyb/owl) and
[omdrop-awdl](https://github.com/brentkearney/omdrop-awdl) radio implementations
are external dependencies. None of their binaries, radio helper scripts,
firmware, sound recordings or full source trees are included. Their own
licenses apply to those separately installed projects. This repository's MIT
license does not relicense those projects.

GTK, PyGObject, GJS, GLib and GNOME Shell are platform dependencies, not vendored
code. The small AirDrop-style symbolic icon in `extension/` was created for this
frontend. AirDrop is a trademark of Apple Inc. This project is not affiliated
with Apple or endorsed by the upstream Omdrop projects.
