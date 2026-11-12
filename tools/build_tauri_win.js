// Groundwork Habits for Windows on Tauri, the full app or Lite (after `node tools/edition.js lite`): compiles tauri/
// (the app's www/ embedded in one exe, using Windows' own WebView2), then makes the installer around it with
// build_setup.js. The exe needs no launcher, so the portable download is the exe itself. Output in dist/.
// The full app is built with `--features full` (data folder, calendar, updates, the move from Electron); Lite without.
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist'), pkg = require(path.join(root, 'package.json'));
const product = pkg.build.productName, lite = /Lite$/.test(product);
const core = fs.readFileSync(path.join(root, 'www', 'js', 'core.js'), 'utf8'), conf = JSON.parse(fs.readFileSync(path.join(root, 'tauri', 'tauri.conf.json'), 'utf8'));
// the three must agree, or the exe would carry one edition's name and the other's app
if (core.includes('const LITE=true;') !== lite || conf.productName !== product) throw new Error('package.json, www/ and tauri.conf.json are not the same edition: run tools/edition.js on a clean checkout');
// keep the shell's version in step with the app's
for (const f of ['Cargo.toml', 'tauri.conf.json']) {
  const p = path.join(root, 'tauri', f), s = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, f === 'Cargo.toml' ? s.replace(/^version = ".*"$/m, `version = "${pkg.version}"`) : s.replace(/"version": "[^"]*"/, `"version": "${pkg.version}"`));
}
execFileSync('cargo', ['build', '--release', ...(lite ? [] : ['--features', 'full'])], { cwd: path.join(root, 'tauri'), stdio: 'inherit' });
const exe = path.join(root, 'tauri', 'target', 'release', 'groundwork-habits.exe'), named = product + '.exe';
const app = path.join(dist, lite ? 'win-unpacked-lite' : 'win-unpacked-tauri');
fs.rmSync(app, { recursive: true, force: true }); fs.mkdirSync(app, { recursive: true });
fs.copyFileSync(exe, path.join(app, named)); // the installer and its uninstaller expect this name
const file = product.replace(/ /g, '-');
fs.copyFileSync(exe, path.join(dist, `${file}-${pkg.version}-Windows-portable.exe`));
execFileSync(process.execPath, [path.join(__dirname, 'build_setup.js')], { env: { ...process.env, APP_DIR: app }, stdio: 'inherit' });
console.log(`${product} exe: ${(fs.statSync(exe).size / 1e6).toFixed(1)} MB`);
