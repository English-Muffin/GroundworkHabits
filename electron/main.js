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
ipcMain.handle('fs:choose', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose where Daybook saves your data', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const c = readCfg(); c.folder = r.filePaths[0]; writeCfg(c);
  return { folder: c.folder, text: readData() };
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
