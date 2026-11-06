// Bridge for saving data to a folder the user picks (e.g. a Google Drive / OneDrive / Dropbox synced folder).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('daybookFS', {
  folder: () => ipcRenderer.sendSync('fs:folder'),          // current folder path or ''
  read: () => ipcRenderer.sendSync('fs:read'),              // file text or null
  write: text => ipcRenderer.sendSync('fs:write', text),     // true/false; sync so a save on close is never lost
  choose: () => ipcRenderer.invoke('fs:choose'),            // resolves {folder, mode: 'replace'|'load'} or null if cancelled
  reset: () => ipcRenderer.sendSync('fs:reset')
});
