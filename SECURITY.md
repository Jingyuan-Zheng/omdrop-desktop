# Security

Only 0.1.x is the initial public packaging line. This project has not received an
independent security audit. It delegates protocol and radio handling to external
Omdrop backends; report protocol/driver vulnerabilities to their maintainers too.

After this repository is uploaded, use GitHub's **Report a vulnerability** feature
if the repository owner has enabled private vulnerability reporting. If no private
channel is available, open an issue requesting a private contact without sharing
the vulnerability details. Do not post credentials, AirDrop identities, private
keys, contacts, device MAC addresses or packet captures.

The maintainers should enable private vulnerability reporting before announcing
the repository. No private email address or remote reporting endpoint is assumed
by this local source package.

Untrusted device names and paths must be displayed as plain text and passed via
argv, never executed as shell code. Reports about unintended file replacement,
privilege changes, identity disclosure or subprocess cleanup are especially useful.
