# Security policy

Groundwork Habits stores everything on the user's device and has no server. The parts that touch the outside
world are the desktop app's calendar download (`tauri/src/full.rs` and `tauri/src/net.rs` on Windows,
`electron/main.js` on macOS), the update check, the data folder, backup import and
the PIN lock.

## Reporting a vulnerability

Please don't open a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/English-Muffin/GroundworkHabits/security/advisories/new)
for this repository instead, with the version, the platform and the steps to reproduce it.

## Editions

Groundwork Habits Lite has no network code at all: no calendar, no update check, no data folder. The Windows
Lite build is compiled without it.

## Supported versions

Only the latest release gets fixes.

## Good to know

- With a PIN set, the saved data, exports and weekly backups are encrypted (AES-GCM, key derived from the
  PIN with PBKDF2). Settings such as theme and accent are not. A short PIN can be guessed by someone who
  has a copy of the file, so use a longer one if that matters to you.
- Builds are not code-signed yet. Download them only from this repository's releases, and compare the
  `.sha256` file next to each download. The desktop updater installs a download only if it comes from
  GitHub and its SHA-256 matches.
- The calendar download only connects over https to public addresses (checked when it connects), with
  a 5 MB and 20 s limit.
- Settings are saved in backups, but never the PIN, fingerprint, calendar link or folders.
