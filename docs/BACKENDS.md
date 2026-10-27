# Backends and the Debian integration baseline

Omdrop Desktop is a frontend. Install exactly one appropriate radio backend,
then the upstream Omdrop CLI. Read the current upstream requirements before
changing networking:

- [omdrop-owl](https://github.com/t4t5/omdrop-owl): userspace AWDL for supported PC Wi-Fi adapters.
- [omdrop-awdl](https://github.com/brentkearney/omdrop-awdl): appropriate Apple/Broadcom systems.
- [Omdrop](https://github.com/brentkearney/omdrop-plugin): CLI, receiving service, certificates, contacts and sender orchestration.

This repository installs neither firmware nor drivers, changes no NetworkManager
configuration, opens no firewall ports and downloads no dependencies automatically.
The backend must supply its own root-owned polkit helper and network setup.

## Debian/Ubuntu notes for Omdrop 0.16.1

The tested source commit is `6af4908310a4fcd1ba7800fcc7b83156bbd7ee77`.
Its Omarchy panel does not run in GNOME. Its CLI can be installed separately, but
this baseline needs three small Debian adaptations: prefer system Python, replace
Arch's missing `vercmp` with `dpkg --compare-versions`, and locate `libkeyutils`
through the dynamic loader instead of assuming an Arch library path.

The MIT-licensed adaptation is preserved in
[`patches/omdrop-0.16.1-debian.patch`](../patches/omdrop-0.16.1-debian.patch).
Apply it only to the pinned baseline, in a separate upstream checkout:

```sh
git clone https://github.com/brentkearney/omdrop-plugin.git omdrop-cli
cd omdrop-cli
git checkout --detach 6af4908310a4fcd1ba7800fcc7b83156bbd7ee77
# Replace /path/to/omdrop-desktop with this repository's actual location.
git apply --check /path/to/omdrop-desktop/patches/omdrop-0.16.1-debian.patch
git apply /path/to/omdrop-desktop/patches/omdrop-0.16.1-debian.patch
```

Install `bin`, `share`, `manifest.json`, `README.md` and `LICENSE` together at
`${XDG_DATA_HOME:-$HOME/.local/share}/omdrop` (preserve any existing installation
before replacing it). Then run its `bin/omdrop setup` as your user. That setup
creates the receiver service, command link, identity and link handlers; it has
side effects distinct from installing this frontend.

For this baseline, use the system Python dependencies `python3-libarchive-c`,
`python3-gi`, `python3-pil`, `python3-zeroconf`, `python3-ifaddr`, `python3-dbus`
and the system `keyutils`, `openssl`, `bluez`, `iw`, `iproute2` and `pkexec`
tools. The radio backend package may already install these.
Run `omdrop doctor` and `omdrop --version` before using the GUI.

If UFW is active, follow upstream's narrowly scoped rule for IPv6 link-local
traffic on `awdl0`, TCP port 8771. This frontend does not add or widen a rule.
Do not use Omdrop's Arch-specific `install-driver` workflow on Debian/Ubuntu.

Later upstream releases may fix these differences. Do not force this patch onto
a different version. Independently installed newer backends are not represented
as tested by this repository.
