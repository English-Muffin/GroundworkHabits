// CI check that a packaged desktop build starts and renders: node tests/launch_check.js <path to the app executable> [extra args]
// (CI also runs it with --disable-gpu: the app ships without Chromium's software Vulkan, so it must render without a GPU)
// Windows: the Tauri app opens WebView2's debugging port when GROUNDWORK_DEBUG_PORT is set.
// The page sets its title ("Habits | Groundwork Habits") only after the app script has run, so seeing it proves the build works.
const { spawn } = require('child_process'), http = require('http'), path = require('path'), os = require('os'), fs = require('fs');
const exe = process.argv[2];
if (!exe || !fs.existsSync(exe)) { console.error('Executable not found: ' + exe); process.exit(1); }
// macOS runs on Tauri with Safari's engine, which has no debugging port: the app reports what it sees to a file
// (GROUNDWORK_SELFTEST, see tauri/src/main.rs) and quits. Pass --full or --lite to check the edition too
if (process.platform === 'darwin') {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'groundwork-selftest-')), 'report.json');
  const p = spawn(exe, [], { env: { ...process.env, GROUNDWORK_SELFTEST: out }, stdio: 'inherit' });
  const t = setTimeout(() => { console.error('The app did not report within 60 s'); p.kill(); process.exit(1); }, 60000);
  p.on('exit', code => {
    clearTimeout(t);
    if (!fs.existsSync(out)) { console.error('The app quit without a report (code ' + code + ')'); process.exit(1); }
    const r = JSON.parse(fs.readFileSync(out, 'utf8')), want = process.argv[3];
    const bad = [!/ \| Groundwork Habits/.test(r.title) && 'title', r.folder !== 'string' && 'bridge',
      want === '--full' && (!r.gw || r.lite) && 'full app (data folder bridge)', want === '--lite' && (r.gw || !r.lite) && 'Lite (no online parts)', r.sw && 'service worker'].filter(Boolean);
    console.log('Self-test: ' + JSON.stringify(r));
    if (bad.length) { console.error('Failed: ' + bad.join(', ')); process.exit(1); }
    console.log('Launched and rendered: ' + r.title); process.exit(0);
  });
  return;
}
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'groundwork-launch-'));
const app = spawn(exe, ['--remote-debugging-port=9555', ...process.argv.slice(3)], { env: { ...process.env, GROUNDWORK_USER_DATA: prof, GROUNDWORK_DEBUG_PORT: '9555', WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9555' /* the Tauri Lite build (WebView2) */ }, stdio: 'ignore' });
const pages = () => new Promise(r => http.get('http://127.0.0.1:9555/json', res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { r(JSON.parse(d)); } catch (e) { r([]); } }); }).on('error', () => r([])));
const stop = code => { try { app.kill(); } catch (e) {} process.exit(code); };
app.on('exit', c => { console.error('The app quit during start-up (code ' + c + ')'); process.exit(1); });
(async () => {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const t = (await pages()).map(p => p.title);
    if (t.some(x => / \| Groundwork Habits$/.test(x))) { console.log('Launched and rendered: ' + t.join(', ')); app.removeAllListeners('exit'); stop(0); }
  }
  if (process.platform === 'win32') { // diagnostics: did WebView2 start, and did it make its profile?
    const { execSync } = require('child_process'), sh = c => { try { return execSync(c, { encoding: 'utf8' }); } catch (e) { return String(e.message); } };
    console.error(sh('tasklist /FI "IMAGENAME eq msedgewebview2.exe"') + sh('tasklist /FI "PID eq ' + app.pid + '"')
      + sh('netstat -ano -p tcp | findstr LISTENING') + sh('reg query HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge /s') + sh('reg query HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge\\WebView2 /s'));
    for (const id of ['com.groundwork.habits', 'com.groundwork.habits.lite']) console.error(id + ': ' + sh('dir /s /b "' + path.join(process.env.LOCALAPPDATA, id) + '"').split(/\r?\n/).slice(0, 15).join(' | '));
  }
  console.error('The app did not render within 60 s. Pages: ' + JSON.stringify((await pages()).map(p => [p.type, p.url, p.title]))); app.removeAllListeners('exit'); stop(1);
})();
