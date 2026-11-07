# Changelog

All notable changes to Daybook. Versions match the GitHub releases.

## Unreleased

- New Today look: a percentage ring with the date, and habits as larger cards (two columns on wide screens) with done ones struck through.
- New Goals screen: life areas you can tap to filter, pinned goals first, status badges, an optional deadline, and dated steps that fill the progress bar.
- Streak freezes: every 7 days in a row earns a freeze (up to 3) that saves the streak on a missed day.
- The PIN now encrypts your data on the device and in the data folder.
- Undo works for the last 20 deletes (also Ctrl+Z), without losing later changes.
- Repeating Google Calendar events show on every date.
- Reminders: an option to hide habit and task names, reminders keep coming even if Daybook isn't opened for weeks, and alarms ask for exact timing on Android 14+.
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

- Each habit can have its own reminder: a quiet notification that stays until you answer Yes or No, or a loud alarm. Yes marks the habit done. On Android, Yes and No work straight from the notification without opening the app, even when it’s closed or after a restart; on desktop a small pop-up appears in the corner while Daybook runs.
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
