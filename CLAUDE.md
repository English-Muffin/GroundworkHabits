# Daybook

Habit tracker, weekly task tracker, goal planner and insights in one offline-first app.
Ships as a single static page (`www/index.html`) wrapped for the web (PWA), Windows (Electron) and Android (Capacitor).

The look is modelled on a reference demo video: near-black UI, teal accent, circular check grid.
It has its own name and branding. Keep it that way: do not copy the original product's name, logo or copy.

## Layout
- `www/index.html`  the whole app (CSS + HTML shell + JS in one file, no build step, no dependencies)
- `www/sw.js`  offline cache. Bump `VERSION` whenever shipped files change
- `www/manifest.webmanifest`, `www/icons/`  PWA metadata and icons
- `electron/main.js`  Windows wrapper. `package.json` holds the electron-builder config
- `capacitor.config.json`  Android wrapper (the `android/` folder is generated, never commit it)
- `assets/`  source icon (1024 png, ico) and splash
- `.github/workflows/build.yml`  builds the Windows portable exe, macOS universal zip and the APK in CI
- `tests/smoke.py`  Playwright smoke tests (27 checks, desktop and phone)

## Commands
- Run locally: `python -m http.server 8765 --directory www`, then open http://localhost:8765
- Test: `pip install playwright && playwright install chromium`, then `python tests/smoke.py`. It starts its own server
- Windows portable exe: `npm install && npm run dist:win` (output in `dist/`). macOS zip: `npm run dist:mac` on a Mac
- Release: push a `v*` tag; CI builds Windows, macOS, Android and attaches them to a GitHub Release
- Android app: `npm install && npx cap add android && npx cap sync android && npx cap open android`

## How `www/index.html` works
- State is one object `S`: `{v, habits, log, tasks, goals, journal}` (`v` = data version, migrations go after `let S=load()`), saved to `localStorage` key `daybook-v2` by `save()`.
  - `habits`: `{id, name, type: 'daily'|'weekly'|'monthly', color}`
  - `log[habitId]`: set of keys. Daily `YYYY-MM-DD`, weekly `YYYY-MM-Wn` (W1 = days 1-7 of the month), monthly `YYYY-MM`
  - `tasks['YYYY-MM-DD']`: `{items: [{id, text, done}], mind: {energy, focus, motivation} | null}`
  - `goals`: `{id, title, area, pct}`. `journal['YYYY-MM']`: monthly reflection text
- `render()` rebuilds `#main` from string templates (`vToday`, `vHabits`, `vTasks`, `vGoals`, `vInsights`) and `#modal`.
  It preserves scroll positions, so keep that behaviour if you change it.
- One delegated `click` listener handles every `data-act="..."` button. Add new actions to its `switch`.
  Actions that only change UI state set `persist=false` so nothing is saved.
- Range sliders, textareas and the task input write to `S` directly on `input` and must not trigger a full re-render
  (it would steal focus). Use `focusSel` to re-focus after a deliberate re-render.
- `TODAY` is a `let` and is refreshed on focus, visibility change and every minute (`refreshToday`).
- Dates are local time. Task weeks start on Sunday. Always escape user text with `esc()`.
- Hash routes: `#today #habits #tasks #goals #insights`.

## Design tokens (CSS variables in `:root`)
`--bg #080808`, `--card #0f0f0f`, `--teal #22d3be`, `--red`, `--purple`, `--flame`, `--star`. Font: Space Grotesk (Google Fonts, system fallback).
Dark is the designed theme. Settings > Customize adds accent colours (sets `--teal`) and a light theme (`html.light` overrides the `--gXX` grey tokens, one per original dark grey, and darkens the accent), stored in localStorage `daybook-prefs`, separate from data. Use `var(--teal)` (style, not SVG attributes) for accent colour and `var(--gXX)` tokens, never raw greys, so both themes work. Breakpoints: 900px (stack columns) and 760px (bottom nav, narrower sticky name column).

## Conventions
- Plain modern JS, no frameworks, no build step. Keep it one self-contained file unless there is a strong reason to split.
- UI copy: sentence case, typographic apostrophes (’), no emoji.
- Icon-only buttons need `aria-label`. Keep visible `:focus-visible` outlines.
- Nothing may depend on hover: it must also work by touch.
- Do not add runtime dependencies. Electron/Capacitor/Playwright are dev tools only.

## Gotchas already hit
- Replacing `innerHTML` resets scroll. `render()` saves and restores it.
- The Insights dropdown went under the chart on phones until `.sel` got `position:relative; z-index:20`.
- Hover-only controls (delete buttons) are unusable on touch. Editing and deleting habits now live in the modal (tap the habit name).
- The service worker is skipped inside Electron and Capacitor (see the registration guard at the end of the script).
- Android WebView cannot download blob links. Export uses the Web Share API on mobile and falls back to a download.
  Capacitor Filesystem + Share would be more robust.
- Fonts load from Google Fonts online and fall back to a system font offline.

## Before you finish any change
Run `python tests/smoke.py`. When you fix a bug, add a check for it. Test at 390px wide as well as desktop.

## Ideas not done yet
- Today and Goals screens were designed without a reference. They deserve a polish pass
- Local notifications / daily reminder (Capacitor Local Notifications; Notification API on the web)
- Reorder habits, undo for deletes
- Cloud sync (currently local only, with export/import backup)
- Bundle the font files
- Signed Windows build and a signed Android release build for the Play Store
