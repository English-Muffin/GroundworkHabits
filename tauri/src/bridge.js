// Runs in every window before the app's scripts: gives the app its desktop bridge, window.groundworkFS (it began as
// the Electron app's preload), backed by the commands in main.rs. Lite has no data folder, calendar or
// updates, so those calls answer "none". Web notifications and new-window links are routed to the desktop too.
(function () {
  if (window.groundworkFS) return;
  // this runs before Tauri's own script defines __TAURI_INTERNALS__: look it up when a call happens
  const T = () => window.__TAURI_INTERNALS__;
  const call = (cmd, args) => T() ? T().invoke(cmd, args || {}) : Promise.reject(new Error('Tauri not ready'));
  let flushCb = null, answerCb = null;
  window.groundworkFS = {
    folder: () => '', read: () => null, write: () => false, choose: () => Promise.resolve(null), reset: () => true,
    backup: (name, text, keep) => call('backup', { name, text, keep: Number(keep) || 8 }).catch(() => null),
    openBackups: () => { call('open_backups').catch(() => {}); },
    listBackups: () => call('backups_list'),
    readBackup: name => call('backup_read', { name: String(name) }),
    widget: () => { call('widget').catch(() => {}); },
    showMain: () => { call('show_main').catch(() => {}); },
    ask: (h, k) => { call('ask', { h, k }).catch(() => {}); },
    // resolves null, or the reason when starting with the computer could not be set up
    tray: (on, login, open, quick, quit) => call('tray', { on: !!on, login: !!login, open: open ? String(open) : null, quick: quick ? String(quick) : null, quit: quit ? String(quit) : null }).then(() => null, e => String(e || 'error')),
    trayTip: text => { call('tray_tip', { text: String(text) }).catch(() => {}); },
    // Windows: a reminder notification with Yes / Later / No buttons; false = not possible here (use ask instead)
    askToast: (id, k, title, body, yes, later, no) => call('ask_toast', { id: String(id), k: String(k), title: String(title), body: String(body), yes: String(yes), later: String(later), no: String(no) }).catch(() => false),
    // Windows: a notification whose click opens the app and sends { id, a: 'open' } to onAnswer
    openToast: (id, title, body) => call('open_toast', { id: String(id), title: String(title), body: String(body) }).catch(() => false),
    onAnswer: cb => { answerCb = cb; },
    onFlush: cb => { flushCb = cb; },
  };
  // the full app (built with --features full) answers on a local "gw" address with its data folder; Lite has none.
  // Synchronous on purpose: the page reads and writes the folder file synchronously, like the Electron preload
  // Windows (WebView2) serves custom schemes as http://<scheme>.localhost, macOS (WebKit) as <scheme>://localhost
  const GW = location.protocol === 'tauri:' ? 'gw://localhost' : 'http://gw.localhost';
  const gw = (method, path, body) => { try { const x = new XMLHttpRequest(); x.open(method, GW + path, false); x.send(body === undefined ? null : body); return x; } catch (e) { return null; } };
  const probe = gw('GET', '/folder');
  if (probe && probe.status === 200) {
    Object.assign(window.groundworkFS, {
      folder: () => { const x = gw('GET', '/folder'); return x && x.status === 200 ? x.responseText : ''; },
      read: () => { const x = gw('GET', '/read'); return x && x.status === 200 ? x.responseText : null; },
      write: text => { const x = gw('POST', '/write', String(text)); return !!x && x.responseText === '1'; },
      reset: () => { gw('POST', '/reset'); return true; },
      choose: () => call('choose').catch(() => null),
      fetchCal: url => call('fetch_cal', { url: String(url) }).catch(() => ({ ok: false, error: 'Could not reach your calendar' })),
      updateCheck: () => call('update_check').catch(() => ({ ok: false })),
      updateInstall: () => call('update_install').catch(() => ({ ok: false, error: 'Download failed' })),
      oauth: url => call('oauth', { url: String(url) }).catch(() => ({ ok: false, error: 'Could not sign in' })),
    });
    // first start after the move from Electron: put the saved data back before the app reads it
    try {
      if (!localStorage.getItem('groundwork-v2') && !localStorage.getItem('daybook-v2')) {
        const x = gw('GET', '/electron'), old = x && x.status === 200 ? JSON.parse(x.responseText || '{}') : {};
        Object.keys(old).forEach(k => { if (/^(groundwork|daybook)-/.test(k) && localStorage.getItem(k) === null) localStorage.setItem(k, old[k]); });
      }
      gw('POST', '/electron-done');
    } catch (e) {}
  }
  // closing: finish the last save, then tell the shell it may close
  (function listen() {
    if (!T()) return setTimeout(listen, 20);
    call('plugin:event|listen', { event: 'app:flush', target: { kind: 'Any' }, handler: T().transformCallback(async () => {
      try { if (flushCb) await flushCb(); } catch (e) {}
      call('flushed').catch(() => {});
    }) }).catch(() => {});
    // a button on a reminder notification (askToast): { id, k, a: 'yes' | 'later' | 'no' }
    call('plugin:event|listen', { event: 'ask:answer', target: { kind: 'Any' }, handler: T().transformCallback(e => { try { if (answerCb) answerCb(e.payload); } catch (x) {} }) }).catch(() => {});
  })();
  // the daily reminder uses the web Notification API: send it to the system notification instead
  function N(title, opts) { call('notify', { title: String(title), body: String((opts && opts.body) || '') }).catch(() => {}); this.close = () => {}; }
  N.permission = 'granted'; N.requestPermission = () => Promise.resolve('granted');
  window.Notification = N;
  // links that would open a new window (target=_blank, window.open) open in the browser instead
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a && (a.target === '_blank' || /^https?:/.test(a.getAttribute('href')))) { e.preventDefault(); call('open_external', { url: a.href }).catch(() => {}); }
  }, true);
  window.open = url => { call('open_external', { url: String(url) }).catch(() => {}); return null; };
})();
