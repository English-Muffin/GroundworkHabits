// CI check that a packaged desktop build starts and renders: node tests/launch_check.js <path to the app executable> [extra args]
// (CI also runs it with --disable-gpu: the app ships without Chromium's software Vulkan, so it must render without a GPU)
// Works for Electron and for the Tauri Lite build (WebView2 gets the debugging port from its environment).
// The page sets its title ("Habits | Groundwork Habits") only after the app script has run, so seeing it proves the build works.
const { spawn } = require('child_process'), http = require('http'), path = require('path'), os = require('os'), fs = require('fs');
const exe = process.argv[2];
if (!exe || !fs.existsSync(exe)) { console.error('Executable not found: ' + exe); process.exit(1); }
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'groundwork-launch-'));
const app = spawn(exe, ['--remote-debugging-port=9555', ...process.argv.slice(3)], { env: { ...process.env, GROUNDWORK_USER_DATA: prof, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9555' /* the Tauri Lite build (WebView2) */ }, stdio: 'ignore' });
const pages = () => new Promise(r => http.get('http://127.0.0.1:9555/json', res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { r(JSON.parse(d)); } catch (e) { r([]); } }); }).on('error', () => r([])));
const stop = code => { try { app.kill(); } catch (e) {} process.exit(code); };
app.on('exit', c => { console.error('The app quit during start-up (code ' + c + ')'); process.exit(1); });
(async () => {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const t = (await pages()).map(p => p.title);
    if (t.some(x => / \| Groundwork Habits$/.test(x))) { console.log('Launched and rendered: ' + t.join(', ')); app.removeAllListeners('exit'); stop(0); }
  }
  console.error('The app did not render within 60 s. Pages: ' + JSON.stringify((await pages()).map(p => [p.type, p.url, p.title]))); app.removeAllListeners('exit'); stop(1);
})();
