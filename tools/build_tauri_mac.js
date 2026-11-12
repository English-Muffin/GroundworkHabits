// Groundwork Habits for macOS on Tauri, the full app or Lite (after `node tools/edition.js lite`). Run on a Mac:
// builds tauri/ for Apple Silicon and Intel, joins them into one universal binary (lipo), wraps it in a .app with an
// icon and Info.plist, signs it ad hoc (Apple Silicon refuses unsigned code; this is not a Developer ID signature)
// and zips it. Output: dist/mac-universal/<productName>.app and dist/<Name>-<version>-mac-universal.zip.
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist'), pkg = require(path.join(root, 'package.json'));
const product = pkg.build.productName, lite = /Lite$/.test(product);
const core = fs.readFileSync(path.join(root, 'www', 'js', 'core.js'), 'utf8'), conf = JSON.parse(fs.readFileSync(path.join(root, 'tauri', 'tauri.conf.json'), 'utf8'));
if (core.includes('const LITE=true;') !== lite || conf.productName !== product) throw new Error('package.json, www/ and tauri.conf.json are not the same edition: run tools/edition.js on a clean checkout');
const run = (cmd, args, opts) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const tauri = path.join(root, 'tauri'), targets = ['aarch64-apple-darwin', 'x86_64-apple-darwin'];
for (const t of targets) run('cargo', ['build', '--release', '--target', t, ...(lite ? [] : ['--features', 'full'])], { cwd: tauri });

const app = path.join(dist, 'mac-universal', product + '.app'), contents = path.join(app, 'Contents');
fs.rmSync(app, { recursive: true, force: true });
fs.mkdirSync(path.join(contents, 'MacOS'), { recursive: true }); fs.mkdirSync(path.join(contents, 'Resources'), { recursive: true });
run('lipo', ['-create', '-output', path.join(contents, 'MacOS', product), ...targets.map(t => path.join(tauri, 'target', t, 'release', 'groundwork-habits'))]);

// the icon: every size macOS asks for, from the 1024 px source
const set = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-icon-')) + '/icon.iconset';
fs.mkdirSync(set);
for (const s of [16, 32, 128, 256, 512]) {
  run('sips', ['-z', String(s), String(s), path.join(root, 'assets', 'icon.png'), '--out', path.join(set, `icon_${s}x${s}.png`)], { stdio: 'ignore' });
  run('sips', ['-z', String(s * 2), String(s * 2), path.join(root, 'assets', 'icon.png'), '--out', path.join(set, `icon_${s}x${s}@2x.png`)], { stdio: 'ignore' });
}
run('iconutil', ['-c', 'icns', set, '-o', path.join(contents, 'Resources', 'icon.icns')]);

const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const plist = {
  CFBundleName: product, CFBundleDisplayName: product, CFBundleExecutable: product, CFBundleIdentifier: conf.identifier,
  CFBundleVersion: pkg.version, CFBundleShortVersionString: pkg.version, CFBundlePackageType: 'APPL', CFBundleIconFile: 'icon',
  LSMinimumSystemVersion: '10.15', LSApplicationCategoryType: 'public.app-category.productivity', NSHighResolutionCapable: true,
};
fs.writeFileSync(path.join(contents, 'Info.plist'), '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n'
  + Object.entries(plist).map(([k, v]) => `  <key>${k}</key>${v === true ? '<true/>' : `<string>${esc(v)}</string>`}`).join('\n') + '\n</dict></plist>\n');

run('codesign', ['--force', '--deep', '--sign', '-', app]);
const zip = path.join(dist, `${product.replace(/ /g, '-')}-${pkg.version}-mac-universal.zip`);
fs.rmSync(zip, { force: true });
run('ditto', ['-c', '-k', '--keepParent', app, zip]);
console.log(`${product}: ${(fs.statSync(zip).size / 1e6).toFixed(1)} MB zip`);
