# Changelog

All notable changes to Groundwork Habits. Versions match the GitHub releases.

## 1.7.6

- The desktop apps run only on Tauri now: the old Electron version is gone. Installs of 1.7.3 or older still
  move their data over on first start.
- Windows releases are ready for code signing through the SignPath Foundation.
- Ready for F-Droid: store texts, icon and screenshots, and a build from source.

## 1.7.5

- **Check for updates installs the update:** on the installed Windows app it downloads the new version,
  checks it and installs over the old one, leaving nothing behind. Automatic updates do the same once a day.
- **macOS runs on Tauri too:** about 6 MB instead of 166 MB, on the Mac's own web engine. Your data moves
  over from the old version on first start.

## 1.7.4

- **Groundwork Habits Lite:** the same app with no online parts and without the extras, for every platform.
- **Windows runs on Tauri:** the installer is 3 MB instead of 102 MB, and the app uses Windows' own
  WebView2. Your data moves over from the old version on first start.
- Backups and exports now include your settings (theme, accent, features), never the PIN or folders.
- The mindset tracker has its own switch in Settings → Features.
- Smaller Android downloads: about 1.8 MB.

## 1.7.3

- **Undo for every change:** Ctrl+Z steps back through anything you changed (deleted items come back first,
  in place), Ctrl+Y redoes it.
- **Never miss twice:** after a missed day, Today marks the habit so one miss doesn't become two.
- **Challenges:** 7, 21, 30, 66 or 100 days of a habit, shown on Today and with a medal on the Streaks tab.
- **Goal forecasts:** when you'll reach an amount, from-to or habit goal at the pace so far.
- More ways to repeat a task: every 2 weeks, the 2nd Tuesday of the month, the last Friday of the month.
- Share any habit or goal as an image.
- New empty screens with a small drawing and the next step, on every tab.
- **In-browser demo** with example data, and the web app on GitHub Pages.
- Android: a small "Next habit" widget, and the app icon without a background. The app ID is now
  `com.groundwork.habits`, so it installs as a new app: export your data from the old one and import it.
- Your data is also kept in the browser database, so a full browser storage never loses a save.
  Backups from a newer version or damaged files are refused before anything changes.
- Settings → About → **Copy diagnostics** for bug reports (no habits, tasks or other data).
- iPhone and iPad: a one-time hint on how to install the web app.
- Accessibility: every control has a name for screen readers, reduced motion stops animations, and
  Windows high-contrast mode is supported.
- Every internal name now uses the new name; data saved under the old one moves across on first start.

## 1.7.2

- Windows: our own installer and uninstaller in the app's style. Pick the folder (type a path or make a new
  one), see the space needed and the progress, cancel safely; an update that fails puts the old version
  back. The uninstaller asks whether to keep or erase your data.

## 1.7.1

- The app's own date, time and list pickers everywhere, instead of the system dialogs.
- Windows portable: just the logo, pulsing, while it starts; it unpacks only once per version, so later starts take
  under a second.
- Rest days per habit: planned days off that don't break a streak or use a freeze.
- Templates: starter packs of habits, task lists and goals (with steps), in every language.
- Import from Loop Habit Tracker, Habitica or a spreadsheet, merged into your data.
- Goals timeline: deadlines and dated steps in order. Insights: your year so far, shareable as an image.
- Android: a tasks widget and a "Next habit" quick settings tile.
- Desktop: optional automatic update check (off by default) that installs a verified update.

## 1.7.0

- A new name, **Groundwork Habits**, with a new layered logo and app icons. Your data, data folder and
  backups carry over untouched.
- Windows: a new installer (`…-Windows-setup.exe`, per user, no admin) opens the app in under a second.
  The portable exe unpacks itself on every start (10 s or more); it now shows a splash while it does.
- A colour picker built into the app for the accent, habits and life areas (hue, saturation, lightness,
  hex). Moss green, the logo's colour, is the default accent.
- Goal cards: history drawn like the Insights chart and a glowing progress bar.
- The Achievements tab is now **Streaks**, always shown. Tab names under the icons can be hidden.
- Android: the back button closes dialogs and leaves Settings; elsewhere it asks before leaving.
- Phones: an even bottom bar, Habits opens at today, and today's task card comes first.
- Settings: the side list now follows the scroll on tall windows.
- The app icon is just the logo, without a background tile.

## 1.6.1

- First published build of the 1.6.0 changes below: the 1.6.0 tag never built because the build workflow file could not be read. Fixed.

## 1.6.0

- Licence changed from MIT to GNU AGPL-3.0-or-later.
- Settings is now a page: sections with a side list on desktop and a list on phones, search across every setting, a short description on each switch, a test notification, an auto-lock delay, and About with privacy, shortcuts and licences.
- Choose how often backups run (off, daily, weekly, monthly); the heatmap shows the months that fit, or a chosen 3, 6 or 12; quick add sits in the middle of the nav.
- Groundwork Habits in 10 more languages: Portuguese, Spanish, French, German, Italian, Dutch, Polish, Russian, Chinese and Japanese (follows the device, or pick one in Settings).
- Weekly automatic backups (desktop and Android), and with a PIN every export and backup is encrypted.
- Android: choose a data folder (a synced folder gives sync between devices), a home-screen widget to tick today's habits, and fingerprint unlock.
- Goals: a history line for amounts and values, repeating contributions (e.g. €500 a month), goals made of tasks, archiving, and a notice a week before and on a deadline.
- Streak freezes can be set per habit (off, how often you earn one, how many you keep).
- Quick add (+) for a task, a habit tick or a goal amount from anywhere.
- The heatmap shows 12 months and fills wide screens; calendar times with a time zone are converted correctly.
- Faster: the screen updates only what changed after a tap.
- Goals can be measured in more ways: an amount towards a target (money saved, km run), from a start value to a target (weight, debt left), or the number of times a habit is done. Each area has ideas to start from.
- Your own life areas next to the built-in ten (rename, recolour, delete).
- Every Insights box can be dragged on its own.
- Spreadsheet export and search show live goal progress.
- New Today look: a percentage ring with the date, and habits as larger cards (two columns on wide screens) with done ones struck through.
- New Goals screen: life areas you can tap to filter, pinned goals first, status badges, an optional deadline, and dated steps that fill the progress bar.
- Streak freezes: every 7 days in a row earns a freeze (up to 3) that saves the streak on a missed day.
- The PIN now encrypts your data on the device and in the data folder.
- Undo works for the last 20 deletes (also Ctrl+Z), without losing later changes.
- Repeating Google Calendar events show on every date.
- Reminders: an option to hide habit and task names, reminders keep coming even if Groundwork Habits isn't opened for weeks, and alarms ask for exact timing on Android 14+.
- The whole habit row lights up on hover; the star streak shows on phones.
- Fonts are built in (works the same offline), a Check for updates link and the version number in the menu.
- Builds: signed Android APKs once the signing secrets are added, and CI checks that the desktop apps start.
- Dragging or selecting a habit no longer shows other days through the name column; the dragged copy is just the habit name.
- Google Calendar events count towards each day’s progress.
- Android: export (backup, spreadsheet, calendar file) asks where to save the file.
- Smaller Windows and macOS downloads (English-only runtime, maximum compression).

## 1.5.0

- Big windows: the layout uses the full width, so columns and cards get larger instead of staying small in the middle.
- Tasks can have a reminder too (tap the bell on a task): Yes or no, or an alarm, with the same Yes and No buttons as habits.

## 1.4.0

- Each habit can have its own reminder: a quiet notification that stays until you answer Yes or No, or a loud alarm. Yes marks the habit done. On Android, Yes and No work straight from the notification without opening the app, even when it’s closed or after a restart; on desktop a small pop-up appears in the corner while Groundwork Habits runs.
- Google Calendar sync now works on Android too.

## 1.3.1

- A spacing scale (4, 8, 12, 16, 24 px) for gaps between blocks; progress rings keep their distance from tasks.
- Phones: the new-task field and its options stay above the keyboard, and the bottom bar hides while typing.
- The repeat options are an in-app menu in the app's style instead of the system picker, with an Add button next to the field.
- Tests: a ring-clearance check and a phone-keyboard check.

## 1.3.0

- Habits can track an amount with a unit and an optional goal (km, pages, hours), next to done/not done and counts.
- Repeating tasks (every day, weekday, week or month) replace task templates. Deleting one offers to delete the later repeats.
- Tasks from Google Calendar can be dragged; a moved one keeps its new day on the next sync.
- Today's ring and task cards are separate cards that can be moved on their own.
- Touch screens: no grip icons (press and hold to drag), and a short set of tips on first open.
- Fixes: progress rings no longer clipped on phones; long task text no longer runs under the delete button.
- Tests: a script syntax check, and overlap and "covered element" checks in the stress test.

## 1.2.1

- Phones: task days stacked full width; habit stats pinned while the grid scrolls; weekly names no longer overlap.
- Calendar tasks no longer pushed aside; words wrap at spaces; accent colour fields spaced.

## 1.2.0

- Drag to rearrange tasks, habits, goals, streaks and dashboard cards (mouse, touch, arrow keys).
- Change a habit's category; days per week; focus timer; search; spreadsheet export; PIN lock.
- Desktop mini widget; Android daily reminder; layout fixes from 320 to 1920 px.

## 1.1.0

- Achievements tab with quit streaks, AMOLED theme, Google Calendar (iCal in, .ics out).
- Undo for deletes, habit targets and notes, weekly review, six-month heatmap, daily reminder, feature switches.
- Smooth charts for the mindset tracker and the habits trend; missed tasks marked with an X.

## 1.0.1

- Picking a data folder that already has a save asks whether to replace it or load it.

## 1.0.0

- First release: habits, weekly tasks, goals and insights; Windows portable, macOS and Android builds.
