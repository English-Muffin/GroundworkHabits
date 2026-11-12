// electron-builder afterPack hook: rebuilds app.asar without node_modules. The only dependencies are the Android
// plugins (Capacitor needs them listed in package.json), and electron-builder packs them whatever the "files" rules
// say: about 1,800 files the desktop app never loads. Keeps the desktop app at electron/, www/ and the icon.
const fs = require('fs'), path = require('path'), os = require('os'), asar = require('@electron/asar');

function findAsar(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name === 'app.asar') return p;
    if (e.isDirectory()) { const f = findAsar(p); if (f) return f; }
  }
  return null;
}

exports.default = async function (context) {
  // Windows: Chromium's software Vulkan (SwiftShader) only serves WebGL/WebGPU on machines without a GPU; the app uses
  // neither, and pages still render without it (tests/launch_check.js runs with the GPU off too). About 6.4 MB.
  for (const f of ['vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'vulkan-1.dll']) fs.rmSync(path.join(context.appOutDir, f), { force: true });
  // shortcut: macOS universal builds merge two asars and refuse files only one has, so the Mac app keeps node_modules; strip in a universal-aware way to shrink it
  if (context.electronPlatformName === 'darwin') return;
  const file = findAsar(context.appOutDir);
  if (!file) throw new Error('after_pack: app.asar not found in ' + context.appOutDir);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-asar-'));
  try {
    asar.extractAll(file, tmp);
    const nm = path.join(tmp, 'node_modules');
    if (!fs.existsSync(nm)) return;
    fs.rmSync(nm, { recursive: true, force: true });
    // the app must still start: its entry point and the page it loads
    for (const need of ['electron/main.js', 'www/index.html']) if (!fs.existsSync(path.join(tmp, need))) throw new Error('after_pack: ' + need + ' missing');
    const before = fs.statSync(file).size;
    await asar.createPackage(tmp, file);
    console.log(`  • after_pack: app.asar without node_modules, ${(before / 1e6).toFixed(1)} MB -> ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
};
