// Writes www/js/keys.js: the Google sign-in IDs for cloud sync, kept out of the repository (GitHub's push protection
// refuses them). CI fills them from the repository secrets GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
// GOOGLE_WEB_CLIENT_ID (passed as GROUNDWORK_* env); a local build reads keys.local.json at the repository root
// (git-ignored). With neither, the file is written empty and the Google option stays hidden. Run by dist:win,
// dist:mac, android_prepare.sh and the Pages workflow.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let local = {};
try { local = JSON.parse(fs.readFileSync(path.join(root, 'keys.local.json'), 'utf8')); } catch (e) {}
const pick = (env, key) => String(process.env[env] || local[key] || '').trim();
const keys = { google: pick('GROUNDWORK_GOOGLE_ID', 'google'), googleSecret: pick('GROUNDWORK_GOOGLE_SECRET', 'googleSecret'), googleWeb: pick('GROUNDWORK_GOOGLE_WEB_ID', 'googleWeb') };
for (const k in keys) if (!/^[\w.-]*$/.test(keys[k])) { console.error('keys: ' + k + ' has characters a sign-in ID never has'); process.exit(1); }
fs.writeFileSync(path.join(root, 'www', 'js', 'keys.js'), '// written by tools/keys.js; not in git\nwindow.GW_KEYS=' + JSON.stringify(keys) + ';\n');
console.log('keys: Google sign-in ' + (keys.google && keys.googleWeb ? 'set' : 'not set'));
