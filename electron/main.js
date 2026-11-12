const { app, BrowserWindow, Menu, shell, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');

/* ---- optional data folder: config lives in userData, data in <folder>/groundwork.json ---- */
const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
const readCfg = () => { try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); } catch (e) { return {}; } };
const writeCfg = c => fs.writeFileSync(cfgPath(), JSON.stringify(c));
const dataFile = () => { const f = readCfg().folder; return f ? path.join(f, 'groundwork.json') : null; };
const oldFile = f => path.join(path.dirname(f), 'daybook.json'); // the save's name before the rename; read until the first write
const readData = () => { const f = dataFile(); if (!f) return null; try { return fs.readFileSync(f, 'utf8'); } catch (e) { try { return fs.readFileSync(oldFile(f), 'utf8'); } catch (e2) { return null; } } };
ipcMain.on('fs:folder', e => { e.returnValue = readCfg().folder || ''; });
ipcMain.on('fs:read', e => { e.returnValue = readData(); });
// weekly backups: <data folder or app data>/backups, newest 8 kept
const backupDir = () => { const f = readCfg().folder; return path.join(f || app.getPath('userData'), 'backups'); };
ipcMain.handle('fs:backup', (e, name, text) => {
  if (typeof name !== 'string' || !/^groundwork-backup-[0-9A-Za-z-]{1,40}\.json$/.test(name) || typeof text !== 'string') return null;
  try {
    const d = backupDir(); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), text);
    fs.readdirSync(d).filter(n => n.startsWith('groundwork-backup-')).sort().reverse().slice(8).forEach(n => { try { fs.unlinkSync(path.join(d, n)); } catch (err) {} });
    return d;
  } catch (err) { return null; }
});
ipcMain.on('fs:openBackups', () => { const d = backupDir(); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); });
ipcMain.on('fs:reset', e => { const c = readCfg(); delete c.folder; writeCfg(c); e.returnValue = true; });
ipcMain.on('fs:write', (e, text) => {
  const f = dataFile(); if (!f || typeof text !== 'string') { e.returnValue = false; return; }
  try { fs.writeFileSync(f + '.tmp', text); fs.renameSync(f + '.tmp', f); e.returnValue = true; } catch (err) { e.returnValue = false; return; } // tmp+rename: never a half-written file
  try { fs.unlinkSync(oldFile(f)); } catch (err) {} // the pre-rename save goes once the new one exists, so no stale (unencrypted) copy stays
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
    const req = https.get(u, { lookup: safeLookup, signal, headers: { 'User-Agent': 'Groundwork Habits calendar sync', Accept: 'text/calendar' } }, res => {
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
/* ---- updates (only when the user switches it on): GitHub's latest release; the installed app downloads the setup,
   checks it against the published .sha256 and runs it; the portable exe and macOS only get a link ---- */
const REPO = 'English-Muffin/GroundworkHabits';
const GH_HOSTS = ['api.github.com', 'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com'];
async function getUrl(url, max, accept) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 120000);
  try {
    let u = new URL(url);
    for (let hop = 0; hop < 6; hop++) {
      if (u.protocol !== 'https:' || !GH_HOSTS.includes(u.hostname)) throw new Error('GitHub https only');
      const r = await new Promise((resolve, reject) => {
        const req = https.get(u, { lookup: safeLookup, signal: ctl.signal, headers: { 'User-Agent': 'Groundwork Habits', Accept: accept || '*/*' } }, res => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve({ redirect: String(res.headers.location) }); }
          if (res.statusCode !== 200) { res.resume(); return resolve({ status: res.statusCode }); }
          const parts = []; let size = 0;
          res.on('data', c => { size += c.length; if (size > max) { res.destroy(); reject(new Error('too large')); } else parts.push(c); });
          res.on('end', () => resolve({ body: Buffer.concat(parts) })); res.on('error', reject);
        });
        req.on('error', reject);
      });
      if (r.redirect) { u = new URL(r.redirect, u); continue; }
      if (r.status) throw new Error('HTTP ' + r.status);
      return r.body;
    }
    throw new Error('too many redirects');
  } finally { clearTimeout(timer); }
}
const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
const installed = () => process.platform === 'win32' && !/GroundworkHabits-\d/i.test(process.execPath) && !process.env.PORTABLE_EXECUTABLE_FILE;
let pending = null;
ipcMain.handle('upd:check', async () => {
  try {
    const rel = JSON.parse((await getUrl('https://api.github.com/repos/' + REPO + '/releases/latest', 2e6, 'application/vnd.github+json')).toString('utf8'));
    const v = String(rel.tag_name || '').replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+$/.test(v) || !newer(v, app.getVersion())) return { ok: true, update: false };
    const setup = (rel.assets || []).find(a => /^Groundwork-Habits-\d[\w.-]*-Windows-setup\.exe$/.test(a.name)), sum = (rel.assets || []).find(a => setup && a.name === setup.name + '.sha256');
    const ours = x => { try { const u = new URL(x); return u.protocol === 'https:' && u.hostname === 'github.com' && u.pathname.startsWith('/' + REPO + '/releases/download/'); } catch (e) { return false; } };
    // the download addresses stay here in the main process; the page can only say "install"
    pending = installed() && setup && sum && ours(setup.browser_download_url) && ours(sum.browser_download_url) ? { version: v, setup: setup.browser_download_url, sum: sum.browser_download_url } : null;
    return { ok: true, update: true, version: v, page: 'https://github.com/' + REPO + '/releases/latest', auto: !!pending };
  } catch (e) { return { ok: false }; }
});
ipcMain.handle('upd:install', async () => {
  const info = pending;
  if (!info) return { ok: false, error: 'No update to install' };
  try {
    const exp = (await getUrl(info.sum, 4096)).toString('utf8').trim().split(/\s+/)[0].toLowerCase();
    const buf = await getUrl(info.setup, 400e6, 'application/octet-stream');
    if (require('crypto').createHash('sha256').update(buf).digest('hex') !== exp) return { ok: false, error: 'The download did not match its checksum' };
    const f = path.join(app.getPath('temp'), 'Groundwork-Habits-update-' + info.version + '.exe');
    fs.writeFileSync(f, buf);
    // start the installer only once this app has exited, so it never finds the app still open
    const ps = `Wait-Process -Id ${process.pid} -Timeout 30 -ErrorAction SilentlyContinue; Start-Process -FilePath '${f.replace(/'/g, "''")}' -ArgumentList '/update'`; // the installer shows only its progress, then reopens the app
    require('child_process').spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setTimeout(() => app.quit(), 300);
    return { ok: true };
  } catch (err) { return { ok: false, error: 'Download failed' }; }
});
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
// tests: GROUNDWORK_TEST_PICK = folder to "pick", GROUNDWORK_TEST_ANSWERS = comma list of message box button indexes
const testAnswers = (process.env.GROUNDWORK_TEST_ANSWERS || '').split(',').filter(Boolean).map(Number);
const ask = async opts => testAnswers.length ? testAnswers.shift() : (await dialog.showMessageBox(win, opts)).response;
ipcMain.handle('fs:choose', async () => {
  let folder = process.env.GROUNDWORK_TEST_PICK;
  if (!folder) {
    const r = await dialog.showOpenDialog(win, { title: 'Choose where Groundwork Habits saves your data', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    folder = r.filePaths[0];
  }
  let file = path.join(folder, 'groundwork.json');
  if (!fs.existsSync(file) && fs.existsSync(oldFile(file))) file = oldFile(file);
  let mode = 'replace';
  if (fs.existsSync(file)) {
    let info = '';
    try { const st = fs.statSync(file), d = JSON.parse(fs.readFileSync(file, 'utf8'));
      info = `

That save was last changed ${st.mtime.toLocaleString()} and has ${(d.habits || []).length} habits and ${(d.goals || []).length} goals.`; } catch (e) {}
    const a = await ask({ type: 'question', title: 'Groundwork Habits', message: 'There’s already a Groundwork Habits save in this folder.',
      detail: 'Do you want to replace it with your current data, or load the save that’s in the folder?' + info,
      buttons: ['Replace with my current data', 'Load the save in this folder', 'Cancel'], defaultId: 0, cancelId: 2, noLink: true });
    if (a === 2) return null;
    if (a === 1) {
      const b = await ask({ type: 'warning', title: 'Groundwork Habits', message: 'Load the save from this folder?',
        detail: 'This will overwrite the data you have now with the save from the folder. Make sure it isn’t an old save before continuing. Your current data can’t be recovered afterwards unless you’ve exported a backup.',
        buttons: ['Load folder save', 'Cancel'], defaultId: 1, cancelId: 1, noLink: true });
      if (b !== 0) return null;
      mode = 'load';
    } else {
      // keep the file being replaced, just in case
      try { fs.copyFileSync(file, path.join(folder, `groundwork-replaced-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`)); } catch (e) {}
    }
  }
  const c = readCfg(); c.folder = folder; writeCfg(c);
  return { folder, mode };
});

// the profile (saved data, settings) moved to a folder with the new name: copy the old one across once, and keep it as a fallback
const appData = process.env.GROUNDWORK_APPDATA || app.getPath('appData'); // tests point this at a throwaway folder
const LITE_APP = app.getName() === 'groundwork-habits-lite'; // package.json "name", set by tools/edition.js: Lite gets its own profile and app ID, and nothing to migrate
const newProfile = path.join(appData, LITE_APP ? 'Groundwork Habits Lite' : 'Groundwork Habits'), oldProfile = path.join(appData, 'Daybook');
const moved = path.join(newProfile, 'renamed.txt');
if (!LITE_APP && !process.env.GROUNDWORK_USER_DATA && fs.existsSync(oldProfile) && !fs.existsSync(moved)) try {
  if (fs.existsSync(newProfile)) fs.renameSync(newProfile, newProfile + '-before-rename-' + Date.now()); // a stray folder (e.g. from a test) is set aside, never deleted
  fs.cpSync(oldProfile, newProfile, { recursive: true });
  fs.writeFileSync(moved, 'Copied from ' + oldProfile + ' on ' + new Date().toISOString() + '.');
  fs.rmSync(oldProfile, { recursive: true, force: true }); // only after a complete copy: no second (possibly unencrypted) copy of the data stays behind
} catch (e) {}
app.setPath('userData', newProfile);
app.setAppUserModelId(LITE_APP ? 'com.groundwork.habits.lite' : 'com.groundwork.habits'); // matches the installer's Start menu shortcut, so Windows shows the app's notifications
if (process.env.GROUNDWORK_USER_DATA) app.setPath('userData', process.env.GROUNDWORK_USER_DATA); // tests use a throwaway profile
if (!app.requestSingleInstanceLock()) app.quit();

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 420, minHeight: 600,
    backgroundColor: '#080808', title: 'Groundwork Habits',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  harden(win);
  // encrypted saves are async: let the page finish them before the window closes (at most 2 s)
  let flushed = false;
  win.on('close', e => {
    if (flushed || win.webContents.isCrashed()) return;
    e.preventDefault();
    const w = win, done = () => { clearTimeout(t); ipcMain.removeListener('app:flushed', ok); flushed = true; if (!w.isDestroyed()) w.close(); };
    const ok = ev => { if (ev.sender === w.webContents) done(); }, t = setTimeout(done, 2000);
    ipcMain.on('app:flushed', ok);
    w.webContents.send('app:flush');
  });
}
// only web links leave the app; a window never navigates away from the bundled page
function harden(w) {
  w.webContents.setWindowOpenHandler(({ url }) => {
    try { if (['https:', 'http:'].includes(new URL(url).protocol)) shell.openExternal(url); } catch (e) {}
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
}
// mini widget: small always-on-top window showing today; shares localStorage with the main window
let widget = null;
ipcMain.on('win:widget', () => {
  if (widget && !widget.isDestroyed()) { widget.show(); widget.focus(); return; }
  widget = new BrowserWindow({
    width: 340, height: 560, minWidth: 280, minHeight: 320, alwaysOnTop: true, title: 'Groundwork Habits widget',
    backgroundColor: '#080808', icon: path.join(__dirname, '..', 'assets', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  });
  widget.loadFile(path.join(__dirname, '..', 'www', 'index.html'), { hash: 'widget' });
  harden(widget);
});
// habit reminder: a small always-on-top pop-up in the bottom-right corner with Yes / No (closes itself after an answer)
const asks = new Map();
ipcMain.on('win:ask', (e, h, k) => {
  if (typeof h !== 'string' || typeof k !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(h) || !/^\d{4}-\d{2}(-\d{2}|-W\d)?$/.test(k)) return;
  const old = asks.get(h); if (old && !old.isDestroyed()) { old.showInactive(); return; }
  const wa = screen.getPrimaryDisplay().workArea, n = asks.size;
  const w = new BrowserWindow({
    width: 340, height: 230, x: wa.x + wa.width - 356, y: Math.max(wa.y, wa.y + wa.height - 246 - n * 240),
    frame: false, resizable: false, alwaysOnTop: true, show: false, title: 'Groundwork Habits reminder',
    backgroundColor: '#080808', icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') }
  });
  w.loadFile(path.join(__dirname, '..', 'www', 'index.html'), { hash: 'ask~' + h + '~' + k });
  harden(w); w.once('ready-to-show', () => { w.showInactive(); w.flashFrame(true); });
  asks.set(h, w); w.on('closed', () => asks.delete(h));
});
ipcMain.on('win:main', () => { if (!win || win.isDestroyed()) createWindow(); else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
