# Daybook

Habits, tasks and goals in one calm place. Works offline. Your data stays on your device.

## Pick how you want to run it

**1. Quickest (Windows or any desktop):** double-click `www/index.html`. It opens in your browser and works offline.

**2. Install it like an app (Windows and Android):**
Upload the `www` folder to any HTTPS static host (Netlify Drop, GitHub Pages, Cloudflare Pages).
- Windows: open the site in Edge or Chrome, then click the install icon in the address bar.
- Android: open the site in Chrome, then menu, then "Install app".
After the first visit it works offline.

**3. Downloadable apps: Windows portable .exe, macOS app, Android .apk**

*Easiest, nothing to install:*
1. Put this folder in a new GitHub repository (branch `main`).
2. Open the Actions tab, choose "Build Windows, macOS and Android apps", press Run workflow.
3. Download the artifacts when it finishes:
   - `Daybook-Windows`: `Daybook-<version>-Windows-portable.exe` (no install, just run it)
   - `Daybook-macOS`: `Daybook-<version>-mac-universal.zip` (unzip, drag Daybook to Applications; Intel and Apple Silicon)
   - `Daybook-Android`: `Daybook-<version>-Android.apk`

*Publish a release for users:* bump `version` in `package.json`, then push a tag, e.g. `git tag v1.0.0 && git push origin v1.0.0`.
The same workflow builds all three and attaches them to a GitHub Release, which gives you one public download page.

*On your own machine:*
- Windows: install Node 20, then `npm install` and `npm run dist:win`. Output goes to `dist/`.
  If it fails with "Cannot create symbolic link", turn on Windows Developer Mode (or run the terminal as admin) once.
- macOS (needs a Mac): `npm install` and `npm run dist:mac`.
- Android: install Node 20, JDK 17 and Android Studio, then
  `npm install`, `npx cap add android`, `npx @capacitor/assets generate --android`,
  `npx cap sync android`, `npx cap open android`, and press Build > Build APK.

## Good to know
- The apps are not code-signed. Windows SmartScreen may say "unknown publisher": choose More info, then Run anyway.
  macOS will say the app "cannot be verified": right-click Daybook, choose Open, then Open again
  (on macOS 15+: try to open it once, then System Settings > Privacy & Security > Open Anyway).
  On Android, allow "install unknown apps" for the app you use to open the APK. A Play Store release needs a signed release build.
- Desktop app: Settings (gear) > Data folder > Choose folder… saves your data as `daybook.json` in any folder.
  Pick your Google Drive, OneDrive or Dropbox folder (with their desktop app installed) and it syncs between PCs automatically.
- Data is otherwise saved locally on each device. Use the gear menu, "Export backup" and "Import backup", to move it between devices.
- The Space Grotesk font loads from Google Fonts on the first online launch and is then cached. Offline before that, a system font is used.
  To bundle it, add the font files under `www/fonts` and an `@font-face` rule in `www/index.html`.
- To ship an update to the installed web version, change `VERSION` in `www/sw.js`.
