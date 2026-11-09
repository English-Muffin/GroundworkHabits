// Release builds only (CI, on a v* tag): turn off the testing features (demo data, the window.GroundworkTest hook).
// Local test builds in dist/ keep them. Fails loudly if the switch is missing so a release can't ship with them on by accident.
const fs = require('fs'), f = require('path').join(__dirname, '..', 'www', 'js', 'core.js');
const s = fs.readFileSync(f, 'utf8'), on = 'const TESTING=true;';
if (!s.includes(on)) { console.error('release_strip: "' + on + '" not found in www/js/core.js'); process.exit(1); }
fs.writeFileSync(f, s.replace(on, 'const TESTING=false;'));
console.log('release_strip: testing features off');
