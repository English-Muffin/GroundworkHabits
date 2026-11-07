# Groundwork Habits (formerly Daybook)

Habit tracker, weekly task tracker, goal planner and insights in one offline-first app.
Ships as a single static page (`www/index.html`) wrapped for the web (PWA), Windows (Electron) and Android (Capacitor).

The look is modelled on a reference demo video: near-black UI, teal accent, circular check grid.
It has its own name and branding (Groundwork Habits: layered "foundation" mark). Do not copy the original product's name, logo or copy. Internal identifiers keep the old name on purpose (localStorage keys, `daybook.json`, `daybookFS`, `DaybookNative`, appId `com.daybook.app`, Electron userData folder `Daybook`) so existing data and installs carry over.

## Layout
- `www/index.html` (HTML shell), `www/app.css`, `www/app.js` (the whole app, no build step, no dependencies), `www/fonts/` (Space Grotesk woff2, SIL OFL)
- `www/sw.js`  offline cache. Bump `VERSION` whenever shipped files change
- `www/manifest.webmanifest`, `www/icons/`  PWA metadata and icons
- `electron/main.js` + `preload.js`  desktop wrapper. The preload exposes `window.daybookFS` so the user can pick a data folder (Settings > Data folder); data is mirrored to `<folder>/daybook.json` (sync, tmp+rename), re-read on focus. Picking a folder that already has a save asks: replace (old file kept as `daybook-replaced-*.json`) or load (second warning). Picking a Google Drive/OneDrive/Dropbox synced folder is the cloud sync story. `package.json` holds the electron-builder config
- `capacitor.config.json`  Android wrapper (the `android/` folder is generated, never commit it)
- `assets/`  source icon (1024 png, ico) and splash
- `.github/workflows/build.yml`  builds the Windows portable exe, macOS universal zip and the APK in CI
- `tests/smoke.py`  Playwright smoke tests (117 checks, plus 13 desktop checks in `tests/electron_folder.py`, desktop and phone)
- `tests/visual.py`  screenshot comparison, light and dark (local only; fixed clock + demo data). `UPDATE=1` accepts a new look after checking the PNGs in `tests/visual/`
- `tests/launch_check.js`  CI: starts the packaged desktop app and waits for it to render
- `tests/device_android.py`  real-device check on the BlueStacks instance named "Daybook testing" (finds it in BlueStacks' config, starts it, connects only to its adb port): reminder in the background, Yes from the notification without opening the app, calendar, widget, Save to. Run before every release
- `tools/i18n/`  translations: `<lang>.txt` (numbered lines matching `source.json`), `build.py` checks them and writes `www/i18n/<lang>.js`
- `native/release.gradle`  applied to the generated `android/app/build.gradle`: version from package.json, release signing from `DAYBOOK_KEYSTORE*` env (CI secrets `ANDROID_KEYSTORE_BASE64/PASSWORD`, `ANDROID_KEY_ALIAS`; the key lives outside the repo)
- `tests/stress.py`  stress test (heavy data, 320-1920px, all themes, random clicks, edge dates); writes report.txt
- `tests/electron_folder.py`  desktop data-folder checks (needs `npm install`; if `node_modules/electron/dist` is empty, unzip Electron from `%LOCALAPPDATA%/electron/Cache` into it)

## Commands
- Run locally: `python -m http.server 8765 --directory www`, then open http://localhost:8765
- Test: `pip install playwright && playwright install chromium`, then `python tests/smoke.py`. It starts its own server
- Windows: `npm install && npm run dist:win` builds the installer (`-Windows-setup.exe`, NSIS one-click, per user; opens in under a second) and the portable exe (unpacks to %TEMP% on every start, ~13 s; `assets/portable-splash.bmp` shows meanwhile). Output in `dist/`. macOS zip: `npm run dist:mac` on a Mac
- README media: `python tools/readme_media.py` records `assets/readme/intro.gif` and the screenshots from the real app (fixed clock, demo data)
- Release: bump `version` in package.json, `APPV` in app.js and the version badge in README.md; refresh README screenshots and feature list (show different accents and themes); run `tests/device_android.py`; push a `v*` tag; CI builds Windows, macOS, Android and attaches them to a GitHub Release
- Android app: `npm install && npx cap add android && npx cap sync android && npx cap open android`
- Local APK build: needs `ANDROID_HOME`; if Gradle fails with "Unable to establish loopback connection", set `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:\tmp\jdk`

## How `www/app.js` works
- State is one object `S`: `{v, habits, log, tasks, goals, journal, quits, count, notes, amt}` (`v` = data version, migrations go after `let S=load()`), saved to `localStorage` key `daybook-v2` by `save()`.
  - `habits`: `{id, name, type: 'daily'|'weekly'|'monthly', color}`
  - `log[habitId]`: set of keys. Daily `YYYY-MM-DD`, weekly `YYYY-MM-Wn` (W1 = days 1-7 of the month), monthly `YYYY-MM`
  - `tasks['YYYY-MM-DD']`: `{items: [{id, text, done, cal?}], mind: {energy, focus, motivation} | null}`
  - `habits[].target` (1-99): taps needed per period. `count[habitId][key]` holds partial taps; `log` still marks done, so stats are unchanged. Use `tap(h,k)` to toggle
  - `habits[].per` (1-7): days per week for daily habits (Today shows `n/per this week`). A habit's type can change; ticks of the old type stay in `log` under their own key format
  - `habits[].track`: `check` | `count` (uses `target`) | `amount` (`unit`, optional `goal`; numbers in `amt[habitId][key]`, `log` marks done once the goal is met; `setAmt()`)
  - task items may carry `goal` (id of a goal measured by tasks), `rem` `{t,m}` (a one-off reminder on that day: bell button `.tkb`, modal `trem`; same engine as habits, ids 2000+ on Android, `findT()`), `rep` (series id of a repeating task, see `repeatDates()`), `cal`/`hidden`/`pin` (calendar events; `pin` = user moved it to another day)
  - `habits[].rem`: `{t:'HH:MM', m:'ask'|'alarm'}` or null, a per-habit reminder (see Habit reminders)
  - `notes[habitId][key]`: short note for that day/week/month
  - `quits`: `{id, name, since: 'YYYY-MM-DDTHH:MM' local, best: days}` quit streaks shown on the Streaks tab (route `#achievements`)
  - `goals`: `{id, title, area, pct, due?, pin?, kind?, steps?, unit?, target?, start?, log?: [{d,v}], habit?, since?}`. `kind` (`gKind`): pct (slider), steps, num (log amounts add up to target, e.g. €; `recur` {v,every:'w'|'m',from,last} adds entries marked `a:1` via `applyRecurring()`), range (start → target, latest logged value), habit (ticks of a habit since a date), tasks (tasks with `goal` = this id, `gTasks`). `arch` hides a goal under Archived. Deadlines (`due`) notify 7 days before and on the day at 09:00 (`goalDue`). `gPct()` is the source of truth (stored `pct` is a copy for exports); `gLine()` the one-line status; `IDEAS` holds starter goals per area.
  - `areas`: custom life areas `[{name,color}]` next to the built-in `AREAS` (`allAreas()`, `areaCol()`); renaming moves goals, deleting needs the area to be empty. Goals screen: life areas filter (`goalArea`), pinned first, edit in the `goal` modal. `journal['YYYY-MM']`: monthly reflection text
- `render()` rebuilds `#main` from string templates (`vToday`, `vHabits`, `vTasks`, `vGoals`, `vInsights`, `vAch`) and `#modal`.
  It preserves scroll positions, so keep that behaviour if you change it.
- One delegated `click` listener handles every `data-act="..."` button. Add new actions to its `switch`.
  Actions that only change UI state set `persist=false` so nothing is saved.
- Range sliders, textareas and the task input write to `S` directly on `input` and must not trigger a full re-render
  (it would steal focus). Use `focusSel` to re-focus after a deliberate re-render.
- `TODAY` is a `let` and is refreshed on focus, visibility change and every minute (`refreshToday`).
- Dates are local time. Task weeks start on Sunday. Always escape user text with `esc()`.
- Hash routes: `#today #habits #tasks #goals #insights #achievements`.

## PIN encryption
Exports and weekly backups are encrypted too when a PIN is set; importing an `enc1:` file asks for that PIN (`impin` modal). Android fingerprint unlock (`Bio.java`) keeps the PIN encrypted by a biometric-bound Keystore key; `bioTry()` runs on the lock screen.
With a PIN, `S` is saved as `enc1:<salt>:<base64>` (AES-GCM, key from PBKDF2 of the PIN, in memory only). Until the PIN is entered `encWait` is true and nothing may save, sync reminders or pull the calendar. Old hash-only PINs upgrade on unlock. Desktop waits for pending encrypted saves before closing (`app:flush`). Each window unlocks itself.

## Streak freezes
Per habit `h.fz` {off, every 3-30, max 1-5} (default every 7, max 3). `freezeOf(h)` replays an every-day habit's history: 7 done in a row earn a freeze (max 3), a missed day uses one. `curStreak` and `dailyStats` honour them; nothing extra is stored. Switch: `feat('freeze')`.

## Translations
English is written in the code and is the key. `index.html` picks the language (`P.lang`, else the device language) and loads `i18n/<lang>.js` before `app.js`; `trDom()` swaps text, placeholders and labels after each render (on the template before `morph`, and on menu/modal/nav/lock), `tx()` translates toasts and notification text. Day and month names come from `Intl`. User content (`NOTR` selector: names, notes, task text) is never translated. New UI text: add it to `tools/i18n/source.json` (or a pattern for text with numbers/names) and every `<lang>.txt`, then run `python tools/i18n/build.py`. Languages: en pt es fr de it nl pl ru zh ja (no right-to-left yet).

## Settings page
`#settings` (and `#settings/<section>`, sections in `SETSECS`) is a page, not a dropdown: `vSettings()` builds it from `setSection(k)` with row helpers `srow`/`sgo`/`sgrp`/`sw` (switches are `role=switch`). Desktop (`wideSet()`): side list + every section on one page, the list follows the scroll (`spySettings`). Phones: the section list with a status line each (`setStatus`), then one section with a back button. Search (`#setQ`, `filterSettings`) hides non-matching rows without re-rendering. The gear opens it, Esc / back returns to `setBack`. Destructive actions sit in the red "Danger zone" group and ask twice. Feature descriptions live in `FEATD`. `P.lockIdle` (minutes) sets the auto-lock.

## Rendering
`render()` builds HTML strings, translates them on a detached template and `morph()`s `#main` in place (only changed nodes update, focus and scroll survive). Elements that bind listeners use `onlyOn()` so re-renders replace them.

## Colour picker
`colorPicker(f,hex,presets,label)` is the only colour control (accent, habit, life area): preset swatches plus a custom swatch (`cpopen`, state in `cpOpen`) that opens hue / saturation / lightness sliders and a hex field inside the card, no system dialog. `setColor(f,hex)` keeps every field in sync without re-rendering; add a target to `COLOR_SET`. Tab names under the nav icons can be hidden (`P.tabNames===false` sets `html.notabnames`); on phones the bar is 7 equal columns.

## Android back button
`DaybookNativePlugin.load()` registers an `OnBackPressedCallback` and sends a `back` event; `onBack()` in app.js closes a dialog or open menu, leaves Settings (like `setback`), steps back through the screens visited (`navHist`, filled on `hashchange`) and then to Today; on Today the first back shows a toast and a second one within 2 s calls `NB.exitApp()`.

## Test-only features
`const TESTING=true` in app.js shows "Load demo data" and exposes `window.DaybookTest` (all tests rely on them). Release builds turn them off: the CI step "Turn off testing features" runs `tools/release_strip.js` on `v*` tags only (it fails if the line is missing). Local `dist/` test builds keep them. Never commit `TESTING=false`.

## Feature switches
`P.feat` (Settings > Features): streak freezes, show names in reminders (`remnames`), streaks on Today, weekly review, year heatmap, habit notes, missed X, Streaks tab, daily reminder (`P.remTime`, Notification API, only while the app runs). Read with `feat(key)`. Deletes push a restore function with `pushUndo()` (up to 20; each puts back only what was deleted) and show `toastUndo()`; Ctrl+Z undoes outside text fields.

## More features
- Search (header): `searchHits()` over tasks, notes, reflections, goals, habits, streaks, templates.
- Focus timer (`focusRun`, bar `#focusbar`), CSV export (`toCsv()`, formula-safe), PIN lock (`P.lock` salted SHA-256; privacy screen only, not encryption; `#lock`).
- Electron build: `electronLanguages: ['en-US']` and maximum compression keep the exe near 65 MB (the app itself is ~330 KB; the rest is Electron).
- Habit grid rows: sticky `.gname`/`.gstat` backgrounds must stay opaque (layer tints over `var(--card)`), and a dragged grid row's ghost is only its name cell.
- Habit reminders (`h.rem`): Android uses the local plugin `native/daybook-native` (`DaybookNative`, a `file:` dependency so `cap sync` picks it up). `syncReminders()` sends the next 14 days (`NB.schedule({items:[{id,at,title,body,h,k,alarm}]})`); Java sets AlarmManager alarms (exact via `USE_EXACT_ALARM`, restored on reboot), posts the notification with Yes/No broadcast actions (channels `dbk-ask` quiet+ongoing, `dbk-alarm` alarm sound + insistent) and stores answers in SharedPreferences without opening the app; `takeAnswers()` applies them on start, resume and the `answer` event. Rescheduled 1.5 s after every `save()`, so a done period is skipped. LocalNotifications is only used for the permission prompt and the old daily reminder. Desktop: `checkHabitReminders()` calls `daybookFS.ask()`, an always-on-top pop-up at `#ask~<habit>~<key>` (`askHtml`). Web: a notification plus the in-app `ask` modal. Alarm mode beeps (`alarmStart`). Fired-today state is `P.remFired` (per device).
- Backups: `autoBackup()` weekly (desktop `daybookFS.backup` to <data folder or app data>/backups; Android `DaybookNative.backup` to the chosen folder's backups or app storage), newest 8 kept, "Back up now" in the menu.
- Android data folder: `DaybookNative.pickFolder` (Storage Access Framework, `Folder.java`); `andWrite()` after saves, `andRead()` on focus (folder wins). Picking a folder with a save asks replace or load (`afold`).
- Android home-screen widget (`WidgetProvider.java`): `pushWidget()` sends today's daily habits after saves (none while a PIN is set); tapping a row records a Yes answer like the notification.
- Quick add: `#quickBtn` (desktop, bottom-right) / `#quickTop` (phones, top bar) opens the `quick` modal: task for today, tick a habit, add to an amount goal.
- Desktop mini widget: `#widget` route (`vWidget`, `html.widget`), opened via `daybookFS.widget()`; windows stay in sync through the `storage` event.
- Android reminder: `@capacitor/local-notifications` (a real `dependencies` entry so `cap sync` picks it up) schedules a daily notification; web/desktop use the Notification API while running.
- Touch dragging uses touch events (grip = immediate, press-and-hold 380 ms anywhere on an item); mouse/pen use pointer events on the grip.

## First run and touch
- First open shows a tips dialog (`tipsHtml`), remembered in localStorage `daybook-tips` (not in prefs). Tests set it with an init script.
- `(pointer:coarse)` hides every grip; touch users press and hold to drag.
- Today's ring (`.thero`) and tasks (`.ttasks`) are separate dashboard cards; `#main.tdash` pairs them side by side on desktop with `grid-auto-flow:dense`.

## Drag to rearrange
Insights is one 12-column grid (`#main.idash`, boxes `.q` quarter / `.h` half), so every box is its own card. Any `[data-drop=LIST]` container whose children are `[data-drag=LIST][data-id]` with a `.grip` button can be reordered by pointer (mouse and touch, `touch-action:none` on the grip) or arrow keys on the grip. `commitDrag()` writes the order: tasks (between days via `.tlist[data-k]`), `habits-<type>`, goals, quits, and `cards` (top-level blocks of Today/Insights, order in `P.layout[view]`). Calendar tasks have no grip. Switch: `feat('drag')`.

## Design tokens (CSS variables in `:root`)
Spacing scale `--sp-1..5` = 4, 8, 12, 16, 24px: 12px between a header and its content, 8px between items, 16-24px around cards. The stress test flags anything closer than 10px to a progress ring.
`--bg #080808`, `--card #0f0f0f`, `--teal` (= `--accent`, default Moss `#9cc96b` to match the logo; `--on` is derived from the accent), `--red`, `--purple`, `--flame`, `--star`. Font: Space Grotesk (bundled, system fallback).
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
- Android WebView cannot download blob links. On Android every export goes through `DaybookNative.saveFile` (system "Save to" picker); elsewhere Web Share on mobile, else a download.
- Fonts are bundled (`www/fonts`), no network needed.

## Before you finish any change
Commits: one per logical change with a specific subject (not one message for everything), so GitHub's file list says what changed where.
After the tests pass, rebuild `dist/` so the user can test before a release: `npm run dist:win` (rename to `Daybook-X.Y.Z-test-Windows-portable.exe`) and the debug APK (`npx cap sync android`, `android/gradlew assembleDebug`, copy to `dist/Daybook-X.Y.Z-test-Android.apk`). Delete older test builds there.
Run all four (and `python tests/device_android.py` before a release): `python tests/smoke.py` (starts with a JS syntax check), `python tests/visual.py`, `LAYOUT_ONLY=1 python tests/stress.py out/` (layout, overlap and covered-element checks at 6 sizes x 3 themes; must report 0 findings) and `python tests/electron_folder.py`. Editing big chunks with scripts has removed neighbouring code before: diff the list of `case '...'` actions and `modal.kind` branches against the previous version after large edits.
Run `python tests/smoke.py`. When you fix a bug, add a check for it. Test at 390px wide as well as desktop.

## Ideas not done yet
- Today and Goals screens were designed without a reference. They deserve a polish pass
- Local notifications / daily reminder (Capacitor Local Notifications; Notification API on the web)
- Undo also covers only the latest delete (any other saved change clears it)
- Google Calendar: no OAuth (user chose no Google Cloud project). Desktop pulls the calendar's secret iCal URL via `cal:fetch` in main, Android via `DaybookNative.fetchCal` (`CalFetch.java`, same rules); the app uses `calFetch` (`P.cal`, every 15 min) and mirrors events into tasks with `cal` = event UID (deleting one sets `hidden`; events count towards progress like other tasks but are never copied); export writes an .ics of non-calendar tasks. Fetch uses Node https with a DNS lookup that only returns public addresses (checked at connect time, so no rebinding window). Real two-way sync / Google Tasks would need an OAuth client ID. Recurring events only show their first date (RRULE not expanded).
- The script runs inside an IIFE; tests reach internals through `window.DaybookTest`.
- Cloud sync on web/Android (desktop has it via a synced data folder); a real Google Drive API login would need an OAuth client ID
- Bundle the font files
- Signed Windows build and a signed Android release build for the Play Store
