const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
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
// https only on every redirect hop, 5 MB and 20 s caps, no cookies. The public-address check runs inside the
// socket's DNS lookup, so the address that was checked is the one connected to (no rebinding window).
const https = require('https');
const dns = require('dns');
const { BlockList, isIP } = require('net');
const CAL_MAX = 5e6;
const blocked = new BlockList();
[['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
 ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]]
  .forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv4'));
[['::', 96], ['::1', 128], ['100::', 64], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]]
  .forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv6'));
// IPv6 forms that carry an IPv4 address (mapped, NAT64, 6to4) are judged by that IPv4 address
function embeddedV4(a) {
  const h = a.toLowerCase(), dotted = h.match(/(\d+\.\d+\.\d+\.\d+)$/);
  const hex = (x, y) => [parseInt(x, 16) >> 8, parseInt(x, 16) & 255, parseInt(y, 16) >> 8, parseInt(y, 16) & 255].join('.');
  if (dotted && /^(::ffff:|64:ff9b:)/.test(h)) return dotted[1];
  let m = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/) || h.match(/^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (m) return hex(m[1], m[2]);
  m = h.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4}):/);
  return m ? hex(m[1], m[2]) : null;
}
// IPv6 fails closed: only global unicast (2000::/3) outside special-purpose ranges; 6to4/NAT64/mapped use their IPv4
const global6 = new BlockList(); global6.addSubnet('2000::', 3, 'ipv6');
[['2001::', 32], ['2001:db8::', 32], ['2002::', 16]].forEach(([a, p]) => blocked.addSubnet(a, p, 'ipv6'));
const isPublic = a => {
  if (isIP(a) === 4) return !blocked.check(a, 'ipv4');
  if (isIP(a) !== 6) return false;
  const v4 = embeddedV4(a);
  if (v4) return !blocked.check(v4, 'ipv4');
  return global6.check(a, 'ipv6') && !blocked.check(a, 'ipv6');
};
function safeLookup(host, opts, cb) {
  dns.lookup(host, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || !addrs.every(a => isPublic(a.address))) return cb(Object.assign(new Error('private address'), { code: 'EPRIVATE' }));
    opts && opts.all ? cb(null, addrs) : cb(null, addrs[0].address, addrs[0].family);
  });
}
function getOnce(u, signal) {
  return new Promise((resolve, reject) => {
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && !isPublic(host)) return reject(Object.assign(new Error('private address'), { code: 'EPRIVATE' }));
    const req = https.get(u, { lookup: safeLookup, signal, headers: { 'User-Agent': 'Daybook calendar sync', Accept: 'text/calendar' } }, res => {
      if (res.socket.remoteAddress && !isPublic(res.socket.remoteAddress)) { res.destroy(); return reject(Object.assign(new Error('private address'), { code: 'EPRIVATE' })); }
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve({ redirect: String(res.headers.location) }); } // parsed by the caller, inside its try
      if (res.statusCode !== 200) { res.resume(); return resolve({ status: res.statusCode }); }
      if (+res.headers['content-length'] > CAL_MAX) { res.destroy(); return resolve({ big: true }); }
      const parts = []; let size = 0;
      res.on('data', c => { size += c.length; if (size > CAL_MAX) { res.destroy(); resolve({ big: true }); } else parts.push(c); });
      res.on('end', () => resolve({ text: Buffer.concat(parts).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}
ipcMain.handle('cal:fetch', async (e, url) => {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
  try {
    let u = new URL(url);
    for (let hop = 0; ; hop++) {
      if (u.protocol !== 'https:' || /^(localhost|.*\.(localhost|local|internal))\.?$/i.test(u.hostname)) return { ok: false, error: 'The address must be a public https:// link' };
      const r = await getOnce(u, ctl.signal);
      if (r.redirect) { if (hop >= 5) return { ok: false, error: 'Too many redirects' }; u = new URL(r.redirect, u); continue; }
      if (r.big) return { ok: false, error: 'That calendar is too large' };
      if (r.status) return { ok: false, error: r.status === 404 ? 'Calendar address not found. Copy the secret iCal address again' : 'Calendar returned an error (' + r.status + ')' };
      if (!r.text.includes('BEGIN:VCALENDAR')) return { ok: false, error: 'That address is not an iCal calendar' };
      return { ok: true, text: r.text };
    }
  } catch (err) {
    if (err && err.code === 'EPRIVATE') return { ok: false, error: 'The address must be a public https:// link' };
    return { ok: false, error: ctl.signal.aborted ? 'Your calendar took too long to respond' : 'Could not reach your calendar' };
  } finally { clearTimeout(timer); }
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
