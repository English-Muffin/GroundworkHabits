# Daybook

Habit tracker, weekly task tracker, goal planner and insights in one offline-first app.
Ships as a single static page (`www/index.html`) wrapped for the web (PWA), Windows (Electron) and Android (Capacitor).

The look is modelled on a reference demo video: near-black UI, teal accent, circular check grid.
It has its own name and branding. Keep it that way: do not copy the original product's name, logo or copy.

## Layout
- `www/index.html`  the whole app (CSS + HTML shell + JS in one file, no build step, no dependencies)
- `www/sw.js`  offline cache. Bump `VERSION` whenever shipped files change
- `www/manifest.webmanifest`, `www/icons/`  PWA metadata and icons
- `electron/main.js` + `preload.js`  desktop wrapper. The preload exposes `window.daybookFS` so the user can pick a data folder (Settings > Data folder); data is mirrored to `<folder>/daybook.json` (sync, tmp+rename), re-read on focus. Picking a folder that already has a save asks: replace (old file kept as `daybook-replaced-*.json`) or load (second warning). Picking a Google Drive/OneDrive/Dropbox synced folder is the cloud sync story. `package.json` holds the electron-builder config
- `capacitor.config.json`  Android wrapper (the `android/` folder is generated, never commit it)
- `assets/`  source icon (1024 png, ico) and splash
- `.github/workflows/build.yml`  builds the Windows portable exe, macOS universal zip and the APK in CI
- `tests/smoke.py`  Playwright smoke tests (77 checks, plus 11 desktop checks in `tests/electron_folder.py`, desktop and phone)
- `tests/stress.py`  stress test (heavy data, 320-1920px, all themes, random clicks, edge dates); writes report.txt
- `tests/electron_folder.py`  desktop data-folder checks (needs `npm install`; if `node_modules/electron/dist` is empty, unzip Electron from `%LOCALAPPDATA%/electron/Cache` into it)

## Commands
- Run locally: `python -m http.server 8765 --directory www`, then open http://localhost:8765
- Test: `pip install playwright && playwright install chromium`, then `python tests/smoke.py`. It starts its own server
- Windows portable exe: `npm install && npm run dist:win` (output in `dist/`). macOS zip: `npm run dist:mac` on a Mac
- Release: push a `v*` tag; CI builds Windows, macOS, Android and attaches them to a GitHub Release
- Android app: `npm install && npx cap add android && npx cap sync android && npx cap open android`
- Local APK build: needs `ANDROID_HOME`; if Gradle fails with "Unable to establish loopback connection", set `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:\tmp\jdk`

## How `www/index.html` works
- State is one object `S`: `{v, habits, log, tasks, goals, journal, quits, count, notes, amt}` (`v` = data version, migrations go after `let S=load()`), saved to `localStorage` key `daybook-v2` by `save()`.
  - `habits`: `{id, name, type: 'daily'|'weekly'|'monthly', color}`
  - `log[habitId]`: set of keys. Daily `YYYY-MM-DD`, weekly `YYYY-MM-Wn` (W1 = days 1-7 of the month), monthly `YYYY-MM`
  - `tasks['YYYY-MM-DD']`: `{items: [{id, text, done, cal?}], mind: {energy, focus, motivation} | null}`
  - `habits[].target` (1-99): taps needed per period. `count[habitId][key]` holds partial taps; `log` still marks done, so stats are unchanged. Use `tap(h,k)` to toggle
  - `habits[].per` (1-7): days per week for daily habits (Today shows `n/per this week`). A habit's type can change; ticks of the old type stay in `log` under their own key format
  - `habits[].track`: `check` | `count` (uses `target`) | `amount` (`unit`, optional `goal`; numbers in `amt[habitId][key]`, `log` marks done once the goal is met; `setAmt()`)
  - task items may carry `rem` `{t,m}` (a one-off reminder on that day: bell button `.tkb`, modal `trem`; same engine as habits, ids 2000+ on Android, `findT()`), `rep` (series id of a repeating task, see `repeatDates()`), `cal`/`hidden`/`pin` (calendar events; `pin` = user moved it to another day)
  - `habits[].rem`: `{t:'HH:MM', m:'ask'|'alarm'}` or null, a per-habit reminder (see Habit reminders)
  - `notes[habitId][key]`: short note for that day/week/month
  - `quits`: `{id, name, since: 'YYYY-MM-DDTHH:MM' local, best: days}` quit streaks shown on the Achievements tab
  - `goals`: `{id, title, area, pct}`. `journal['YYYY-MM']`: monthly reflection text
- `render()` rebuilds `#main` from string templates (`vToday`, `vHabits`, `vTasks`, `vGoals`, `vInsights`, `vAch`) and `#modal`.
  It preserves scroll positions, so keep that behaviour if you change it.
- One delegated `click` listener handles every `data-act="..."` button. Add new actions to its `switch`.
  Actions that only change UI state set `persist=false` so nothing is saved.
- Range sliders, textareas and the task input write to `S` directly on `input` and must not trigger a full re-render
  (it would steal focus). Use `focusSel` to re-focus after a deliberate re-render.
- `TODAY` is a `let` and is refreshed on focus, visibility change and every minute (`refreshToday`).
- Dates are local time. Task weeks start on Sunday. Always escape user text with `esc()`.
- Hash routes: `#today #habits #tasks #goals #insights #achievements`.

## Feature switches
`P.feat` (Settings > Features): streaks on Today, weekly review, year heatmap, habit notes, missed X, Achievements tab, daily reminder (`P.remTime`, Notification API, only while the app runs). Read with `feat(key)`. Deletes snapshot `S` (`snap()`) and show `toastUndo()`.

## More features
- Search (header): `searchHits()` over tasks, notes, reflections, goals, habits, streaks, templates.
- Focus timer (`focusRun`, bar `#focusbar`), CSV export (`toCsv()`, formula-safe), PIN lock (`P.lock` salted SHA-256; privacy screen only, not encryption; `#lock`).
- Habit reminders (`h.rem`): Android uses the local plugin `native/daybook-native` (`DaybookNative`, a `file:` dependency so `cap sync` picks it up). `syncReminders()` sends the next 14 days (`NB.schedule({items:[{id,at,title,body,h,k,alarm}]})`); Java sets AlarmManager alarms (exact via `USE_EXACT_ALARM`, restored on reboot), posts the notification with Yes/No broadcast actions (channels `dbk-ask` quiet+ongoing, `dbk-alarm` alarm sound + insistent) and stores answers in SharedPreferences without opening the app; `takeAnswers()` applies them on start, resume and the `answer` event. Rescheduled 1.5 s after every `save()`, so a done period is skipped. LocalNotifications is only used for the permission prompt and the old daily reminder. Desktop: `checkHabitReminders()` calls `daybookFS.ask()`, an always-on-top pop-up at `#ask~<habit>~<key>` (`askHtml`). Web: a notification plus the in-app `ask` modal. Alarm mode beeps (`alarmStart`). Fired-today state is `P.remFired` (per device).
- Desktop mini widget: `#widget` route (`vWidget`, `html.widget`), opened via `daybookFS.widget()`; windows stay in sync through the `storage` event.
- Android reminder: `@capacitor/local-notifications` (a real `dependencies` entry so `cap sync` picks it up) schedules a daily notification; web/desktop use the Notification API while running.
- Touch dragging uses touch events (grip = immediate, press-and-hold 380 ms anywhere on an item); mouse/pen use pointer events on the grip.

## First run and touch
- First open shows a tips dialog (`tipsHtml`), remembered in localStorage `daybook-tips` (not in prefs). Tests set it with an init script.
- `(pointer:coarse)` hides every grip; touch users press and hold to drag.
- Today's ring (`.thero`) and tasks (`.ttasks`) are separate dashboard cards; `#main.tdash` pairs them side by side on desktop with `grid-auto-flow:dense`.

## Drag to rearrange
Any `[data-drop=LIST]` container whose children are `[data-drag=LIST][data-id]` with a `.grip` button can be reordered by pointer (mouse and touch, `touch-action:none` on the grip) or arrow keys on the grip. `commitDrag()` writes the order: tasks (between days via `.tlist[data-k]`), `habits-<type>`, goals, quits, and `cards` (top-level blocks of Today/Insights, order in `P.layout[view]`). Calendar tasks have no grip. Switch: `feat('drag')`.

## Design tokens (CSS variables in `:root`)
Spacing scale `--sp-1..5` = 4, 8, 12, 16, 24px: 12px between a header and its content, 8px between items, 16-24px around cards. The stress test flags anything closer than 10px to a progress ring.
`--bg #080808`, `--card #0f0f0f`, `--teal #22d3be`, `--red`, `--purple`, `--flame`, `--star`. Font: Space Grotesk (Google Fonts, system fallback).
Dark is the designed theme. Settings > Customize adds accent colours (sets `--teal`) an AMOLED theme (`html.amoled`, darkest greys set to #000) and a light theme (`html.light` overrides the `--gXX` grey tokens, one per original dark grey, and darkens the accent), stored in localStorage `daybook-prefs`, separate from data. Use `var(--teal)` (style, not SVG attributes) for accent colour and `var(--gXX)` tokens, never raw greys, so both themes work. Breakpoints: 900px (stack columns) and 760px (bottom nav, narrower sticky name column). From 1500px wide `.app` has no max width (3vw side padding), so columns and cards get larger on big screens; text stays the same size (Windows display scaling handles 4K).

## Conventions
- Plain modern JS, no frameworks, no build step. Keep it one self-contained file unless there is a strong reason to split.
- UI copy: sentence case, typographic apostrophes (’), no emoji.
- Icon-only buttons need `aria-label`. Keep visible `:focus-visible` outlines.
- Nothing may depend on hover: it must also work by touch.
- Do not add runtime dependencies for the web app. Electron/Playwright are dev tools; the only `dependencies` entries are the Capacitor notifications plugin and the local `daybook-native` plugin, both for the Android build.

## Gotchas already hit
- Replacing `innerHTML` resets scroll. `render()` saves and restores it.
- The Insights dropdown went under the chart on phones until `.sel` got `position:relative; z-index:20`.
- Hover-only controls (delete buttons) are unusable on touch. Editing and deleting habits now live in the modal (tap the habit name).
- The service worker is skipped inside Electron and Capacitor (see the registration guard at the end of the script).
- Android WebView cannot download blob links. Export uses the Web Share API on mobile and falls back to a download.
  Capacitor Filesystem + Share would be more robust.
- Fonts load from Google Fonts online and fall back to a system font offline.

## Before you finish any change
Run all three: `python tests/smoke.py` (starts with a JS syntax check), `LAYOUT_ONLY=1 python tests/stress.py out/` (layout, overlap and covered-element checks at 6 sizes x 3 themes; must report 0 findings) and `python tests/electron_folder.py`. Editing big chunks with scripts has removed neighbouring code before: diff the list of `case '...'` actions and `modal.kind` branches against the previous version after large edits.
Run `python tests/smoke.py`. When you fix a bug, add a check for it. Test at 390px wide as well as desktop.

## Ideas not done yet
- Today and Goals screens were designed without a reference. They deserve a polish pass
- Local notifications / daily reminder (Capacitor Local Notifications; Notification API on the web)
- Undo also covers only the latest delete (any other saved change clears it)
- Google Calendar: no OAuth (user chose no Google Cloud project). Desktop pulls the calendar's secret iCal URL via `cal:fetch` in main, Android via `DaybookNative.fetchCal` (`CalFetch.java`, same rules); the app uses `calFetch` (`P.cal`, every 15 min) and mirrors events into tasks with `cal` = event UID (deleting one sets `hidden`; events never count towards completion or get copied); export writes an .ics of non-calendar tasks. Fetch uses Node https with a DNS lookup that only returns public addresses (checked at connect time, so no rebinding window). Real two-way sync / Google Tasks would need an OAuth client ID. Recurring events only show their first date (RRULE not expanded).
- The script runs inside an IIFE; tests reach internals through `window.DaybookTest`.
- Cloud sync on web/Android (desktop has it via a synced data folder); a real Google Drive API login would need an OAuth client ID
- Bundle the font files
- Signed Windows build and a signed Android release build for the Play Store
