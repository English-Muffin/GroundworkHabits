const { app, BrowserWindow, Menu, shell, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

/* ---- optional data folder: config lives in userData, data in <folder>/daybook.json ---- */
const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch (e) { return {}; } };
const writeCfg = c => fs.writeFileSync(cfgPath(), JSON.stringify(c));
const dataFile = () => { const f = readCfg().folder; return f ? path.join(f, 'daybook.json') : null; };
const readData = () => { const f = dataFile(); try { return f ? fs.readFileSync(f, 'utf8') : null; } catch (e) { return null; } };
ipcMain.on('fs:folder', e => { e.returnValue = readCfg().folder || ''; });
ipcMain.on('fs:read', e => { e.returnValue = readData(); });
ipcMain.on('fs:reset', e => { const c = readCfg(); delete c.folder; writeCfg(c); e.returnValue = true; });
ipcMain.on('fs:write', (e, text) => {
  const f = dataFile(); if (!f || typeof text !== 'string') { e.returnValue = false; return; }
  try { fs.writeFileSync(f + '.tmp', text); fs.renameSync(f + '.tmp', f); e.returnValue = true; } catch (err) { e.returnValue = false; } // tmp+rename: never a half-written file
});
// calendar feed: fetched here because the page itself is blocked by CORS.
// https only on every redirect hop, no local/private hosts, isolated cookie-less session, 5 MB and 20 s caps
const CAL_MAX = 5e6;
const { BlockList, isIP } = require('net');
const { lookup } = require('dns').promises;
const blocked = new BlockList();
[['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16]]
  .forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv4'));
[['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10]].forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv6'));
// every address the host resolves to must be public.
// shortcut: DNS could still change between this check and the connection (rebinding); pin the IP if this ever fetches more than calendar text
async function publicHost(host) {
  host = host.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host || host === 'localhost' || /\.(localhost|local|internal)$/.test(host)) return false;
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true, verbatim: true });
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) is checked as the IPv4 address inside it
  const bad = a => { const m = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i); return m ? blocked.check(m[1], 'ipv4') : blocked.check(a, isIP(a) === 6 ? 'ipv6' : 'ipv4'); };
  return addrs.length > 0 && !addrs.some(a => bad(a.address));
}
ipcMain.handle('cal:fetch', async (e, url) => {
  const ses = session.fromPartition('calendar-feed');
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
  try {
    let u = new URL(url), res;
    for (let hop = 0; ; hop++) {
      if (u.protocol !== 'https:' || !(await publicHost(u.hostname))) return { ok: false, error: 'The address must be a public https:// link' };
      res = await ses.fetch(u.href, { redirect: 'manual', signal: ctl.signal });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        if (hop >= 5) return { ok: false, error: 'Too many redirects' };
        u = new URL(res.headers.get('location'), u); continue;
      }
      break;
    }
    if (!res.ok) return { ok: false, error: res.status === 404 ? 'Calendar address not found. Copy the secret iCal address again' : 'Calendar returned an error (' + res.status + ')' };
    if (+res.headers.get('content-length') > CAL_MAX) return { ok: false, error: 'That calendar is too large' };
    const reader = res.body.getReader(), parts = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > CAL_MAX) { ctl.abort(); return { ok: false, error: 'That calendar is too large' }; }
      parts.push(Buffer.from(value));
    }
    const text = Buffer.concat(parts).toString('utf8');
    if (!text.includes('BEGIN:VCALENDAR')) return { ok: false, error: 'That address is not an iCal calendar' };
    return { ok: true, text };
  } catch (err) { return { ok: false, error: ctl.signal.aborted ? 'Your calendar took too long to respond' : 'Could not reach your calendar' }; }
  finally { clearTimeout(timer); }
});
// tests: DAYBOOK_TEST_PICK = folder to "pick", DAYBOOK_TEST_ANSWERS = comma list of message box button indexes
const testAnswers = (process.env.DAYBOOK_TEST_ANSWERS || '').split(',').filter(Boolean).map(Number);
const ask = async opts => testAnswers.length ? testAnswers.shift() : (await dialog.showMessageBox(win, opts)).response;
ipcMain.handle('fs:choose', async () => {
  let folder = process.env.DAYBOOK_TEST_PICK;
  if (!folder) {
    const r = await dialog.showOpenDialog(win, { title: 'Choose where Daybook saves your data', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    folder = r.filePaths[0];
  }
  const file = path.join(folder, 'daybook.json');
  let mode = 'replace';
  if (fs.existsSync(file)) {
    let info = '';
    try { const st = fs.statSync(file), d = JSON.parse(fs.readFileSync(file, 'utf8'));
      info = `

That save was last changed ${st.mtime.toLocaleString()} and has ${(d.habits || []).length} habits and ${(d.goals || []).length} goals.`; } catch (e) {}
    const a = await ask({ type: 'question', title: 'Daybook', message: 'There’s already a Daybook save in this folder.',
      detail: 'Do you want to replace it with your current data, or load the save that’s in the folder?' + info,
      buttons: ['Replace with my current data', 'Load the save in this folder', 'Cancel'], defaultId: 0, cancelId: 2, noLink: true });
    if (a === 2) return null;
    if (a === 1) {
      const b = await ask({ type: 'warning', title: 'Daybook', message: 'Load the save from this folder?',
        detail: 'This will overwrite the data you have now with the save from the folder. Make sure it isn’t an old save before continuing. Your current data can’t be recovered afterwards unless you’ve exported a backup.',
        buttons: ['Load folder save', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true });
      if (b !== 0) return null;
      mode = 'load';
    } else {
      // keep the file being replaced, just in case
      try { fs.copyFileSync(file, path.join(folder, `daybook-replaced-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`)); } catch (e) {}
    }
  }
  const c = readCfg(); c.folder = folder; writeCfg(c);
  return { folder, mode };
});

if (process.env.DAYBOOK_USER_DATA) app.setPath('userData', process.env.DAYBOOK_USER_DATA); // tests use a throwaway profile
if (!app.requestSingleInstanceLock()) app.quit();

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 420, minHeight: 600,
    backgroundColor: '#080808', title: 'Daybook',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  // only web links leave the app; the window itself never navigates away from the bundled page
  win.webContents.setWindowOpenHandler(({ url }) => {
    try { if (['https:', 'http:'].includes(new URL(url).protocol)) shell.openExternal(url); } catch (e) {}
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
