const { app, BrowserWindow, Menu, shell, ipcMain, dialog, net } = require('electron');
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
// calendar feed: fetched here because the page itself is blocked by CORS; https only, size-capped
ipcMain.handle('cal:fetch', async (e, url) => {
  try {
    const u = new URL(url); if (u.protocol !== 'https:') return { ok: false, error: 'The address must start with https://' };
    const res = await net.fetch(u.href, { redirect: 'follow' });
    if (!res.ok) return { ok: false, error: res.status === 404 ? 'Calendar address not found. Copy the secret iCal address again' : 'Calendar returned an error (' + res.status + ')' };
    const text = await res.text();
    if (text.length > 5e6 || !text.includes('BEGIN:VCALENDAR')) return { ok: false, error: 'That address is not an iCal calendar' };
    return { ok: true, text };
  } catch (err) { return { ok: false, error: 'Could not reach your calendar' }; }
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
