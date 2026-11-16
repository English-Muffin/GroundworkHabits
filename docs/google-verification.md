# Google verification: demo video for Calendar access

Google reviews apps that ask for "sensitive" access before the public can use them. Groundwork Habits asks for
`calendar.readonly` (Settings > Calendar > Sign in with Google), which is sensitive, so Google wants a short video
that shows the whole sign-in and what the app does with the calendar. `drive.appdata` (cloud sync) is not sensitive
and needs no video.

## Before recording

1. In the Google Cloud console (project `groundwork-habits`):
   - **APIs & Services > Library:** Google Calendar API is enabled.
   - **Google Auth Platform > Data access:** `.../auth/calendar.readonly` is listed, with this justification:
     "Groundwork Habits shows the events of the user's main Google Calendar as tasks in its weekly planner, so
     appointments and to-dos are in one place. It only reads events; it never changes the calendar. Events stay on
     the user's device."
   - **Branding:** home page, privacy policy and terms links are set and the site is verified (Search Console).
2. In your Google Calendar, add two or three events for this week (for example "Dentist" tomorrow 09:30 and
   "Team call" on Thursday), so they are easy to spot in the app.
3. Use the web app, so the browser's address bar is visible: https://english-muffin.github.io/GroundworkHabits/
   In Settings > Calendar, sign out first if it is already connected (Stop calendar sync).
4. Record the screen at 1080p or higher, in English, with no other tabs or notifications showing.

## Shot list (about 1 to 2 minutes)

1. **The app and where the feature lives (10 s).** Show the Groundwork Habits web app, then open Settings >
   Calendar. Point at "Sign in with Google", with its text "Shows the events of your main Google Calendar as
   tasks. Read-only".
2. **Start sign-in (5 s).** Click Sign in with Google.
3. **The consent screen (20 s).** Google's sign-in page opens. Before choosing the account, click into the
   **address bar** and slowly scroll through the URL so `client_id=134391100722-mepsh1du...` is readable (this is
   the web client ID; Google requires it to be visible). Choose your account.
4. **The permissions (15 s).** On the consent page, show the app name "Groundwork Habits" and the line about seeing
   your calendar events. Hover over it, then click Continue / Allow.
5. **Back in the app (10 s).** The app returns to Settings > Calendar and shows "Connected to Google Calendar as
   <your email>" and the toast "N calendar events synced".
6. **How the data is used (25 s).** Open Tasks. Show the week with "09:30 Dentist" and "Team call" on their days,
   next to normal tasks. Say or caption: "Events are read from the main calendar and shown as tasks. The app never
   changes the calendar."
7. **Removing access (15 s).** Go back to Settings > Calendar and click "Stop calendar sync". Show that the calendar
   tasks are gone. Optionally show https://myaccount.google.com/permissions where access can be removed.
8. **Privacy policy (10 s).** Open https://english-muffin.github.io/GroundworkHabits/privacy.html and scroll to
   "Google user data".

## Submitting

1. Upload the video to YouTube as **Unlisted**.
2. In Google Auth Platform > Verification centre, start verification for the sensitive scope, paste the YouTube
   link and the justification above, and submit.
3. Google usually replies by email within a few days to a few weeks. Until it approves, people see a "Google hasn't
   verified this app" screen and at most 100 people can sign in.
