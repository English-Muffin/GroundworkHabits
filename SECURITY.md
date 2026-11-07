# Security policy

Daybook stores everything on the user's device and has no server. The parts that touch the outside
world are the desktop app's calendar download (`electron/main.js`), the data folder, backup import and
the PIN lock.

## Reporting a vulnerability

Please don't open a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/English-Muffin/GroundworkHabits/security/advisories/new)
for this repository instead, with the version, the platform and the steps to reproduce it.

## Supported versions

Only the latest release gets fixes.

## Good to know

- The PIN lock hides data on screen; it does not encrypt the saved data.
- Builds are not code-signed yet. Download them only from this repository's releases, and compare the
  `.sha256` file next to each download.
