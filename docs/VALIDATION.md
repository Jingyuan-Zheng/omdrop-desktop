# Local preparation validation

Validated on 2026-10-27, before the first public-source commit.

| Check | Result |
| --- | --- |
| Python offline tests | 7 passed |
| GJS model and locale tests | English, Chinese and German-to-English fallback passed |
| GJS client tests | JSON, stream, argv, failure, timeout and shutdown passed |
| User-only installer | Fresh install, schema compilation, upgrade backups and recoverable uninstall passed in temporary data roots |
| Target protection | Unknown files and symlinked targets were preserved/refused |
| GNOME 46 compositor | Private D-Bus/headless session loaded the public extension; locale, menu, radar, rows, dialog and re-enable passed |
| GTK4 window | Private Wayland fixture test passed start, discovery, multi-file send, cancellation and stop |
| Syntax checks | Python source parse, shell script syntax and YAML parse passed |
| Debian compatibility patch | Reverse applicability verified against the adapted pinned Omdrop checkout |
| Release archives | Both zip files built, integrity-checked and scanned; SHA-256 file generated |
| Data review | No detected personal installation paths, credentials, key files, packet captures or runtime logs in public source/packages |

This is a local verification record, not a GitHub Actions result. The workflow
will run after upload. Xvfb was unavailable on the preparation host; GTK4 was
instead verified inside the private Wayland compositor. The fixture checks do
not establish actual bidirectional transfer to an Apple device. See TESTING.md
for the manual end-to-end procedure and known hardware limitations.
