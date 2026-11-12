// Turns this checkout into Groundwork Habits Lite: `node tools/edition.js lite` (CI runs it before the Lite builds).
// Lite is the same app with LITE=true (offline only, no extras: see www/js/core.js) and its own name and app ID,
// so it installs next to the full app. It edits files in place: run it on a CI checkout or a copy, never commit the result.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
if (process.argv[2] !== 'lite') { console.error('usage: node tools/edition.js lite'); process.exit(1); }

const NAME = 'Groundwork Habits Lite', ID = 'com.groundwork.habits.lite';
// every edit must apply exactly once, so a renamed line fails the build instead of shipping a half-Lite app
function edit(file, from, to) {
  const f = path.join(root, file), s = fs.readFileSync(f, 'utf8'), n = s.split(from).length - 1;
  if (n !== 1) { console.error(`edition: expected "${from}" once in ${file}, found ${n}`); process.exit(1); }
  fs.writeFileSync(f, s.replace(from, to));
}
edit('www/js/core.js', 'const LITE=false;', 'const LITE=true;');
edit('package.json', '"name": "groundwork-habits",', '"name": "groundwork-habits-lite",'); // npm's package name
edit('package.json', '"appId": "com.groundwork.habits",', `"appId": "${ID}",`);
edit('package.json', '"productName": "Groundwork Habits"', `"productName": "${NAME}"`);
edit('capacitor.config.json', '"appId": "com.groundwork.habits",', `"appId": "${ID}",`);
edit('capacitor.config.json', '"appName": "Groundwork Habits",', `"appName": "${NAME}",`);
edit('www/manifest.webmanifest', '"name": "Groundwork Habits",', `"name": "${NAME}",`);
edit('www/manifest.webmanifest', '"short_name": "Groundwork",', '"short_name": "Groundwork Lite",');
edit('tauri/tauri.conf.json', '"productName": "Groundwork Habits",', `"productName": "${NAME}",`); // the Windows Tauri build
edit('tauri/tauri.conf.json', '"identifier": "com.groundwork.habits",', `"identifier": "${ID}",`);
console.log('edition: ' + NAME + ' (' + ID + ')');
