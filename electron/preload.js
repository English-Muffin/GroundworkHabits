// Bridge for saving data to a folder the user picks (e.g. a Google Drive / OneDrive / Dropbox synced folder).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('groundworkFS', {
  folder: () => ipcRenderer.sendSync('fs:folder'),          // current folder path or ''
  read: () => ipcRenderer.sendSync('fs:read'),              // file text or null
  write: text => ipcRenderer.sendSync('fs:write', text),     // true/false; sync so a save on close is never lost
  choose: () => ipcRenderer.invoke('fs:choose'),            // resolves {folder, mode: 'replace'|'load'} or null if cancelled
  reset: () => ipcRenderer.sendSync('fs:reset'),
  widget: () => ipcRenderer.send('win:widget'),
  backup: (name, text) => ipcRenderer.invoke('fs:backup', name, text), // weekly backup, resolves to the folder or null
  openBackups: () => ipcRenderer.send('fs:openBackups'),            // open the mini widget window
  showMain: () => ipcRenderer.send('win:main'),
  ask: (h, k) => ipcRenderer.send('win:ask', h, k),           // habit reminder pop-up with Yes/No
  onFlush: cb => ipcRenderer.on('app:flush', async () => { try { await cb(); } catch (e) {} ipcRenderer.send('app:flushed'); }), // finish saving before close
  fetchCal: url => ipcRenderer.invoke('cal:fetch', url),       // {ok, text} | {ok:false, error}
  updateCheck: () => ipcRenderer.invoke('upd:check'),          // {ok, update, version, page, auto, ...}
  updateInstall: () => ipcRenderer.invoke('upd:install')       // installs the update found by updateCheck (main keeps its details)
});
