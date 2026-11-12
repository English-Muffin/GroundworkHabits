"""The Windows app on Tauri, full or Lite: python tests/tauri_app.py "<path to Groundwork Habits.exe or ... Lite.exe>"
Starts the real exe with WebView2's debugging port, then checks the desktop bridge, no service worker, backups on disk,
notifications, the mini widget, reminder pop-ups, closing (save first) and that data survives a restart.
The full app also: the move from the Electron app, the data folder (pick, replace keeps the old file, mirror, read),
the calendar refusing local and private addresses, and the update check.
Everything the app keeps on this PC is set aside first and put back at the end, so real data and backups are never
touched: %LOCALAPPDATA%\\<app ID> and %APPDATA%\\<app ID> (Lite) or %APPDATA%\\Groundwork Habits (full). For the move
from Electron, a copy of an existing Electron profile's saved data is used, read-only."""
import asyncio, json, os, pathlib, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.async_api import async_playwright

EXE = sys.argv[1] if len(sys.argv) > 1 else ''
LITE = EXE.endswith('Lite.exe')
ID = 'com.groundwork.habits.lite' if LITE else 'com.groundwork.habits'
ROAM, LOCAL = pathlib.Path(os.environ['APPDATA']), pathlib.Path(os.environ['LOCALAPPDATA'])
DIRS = [LOCAL / ID] + ([ROAM / ID] if LITE else [ROAM / 'Groundwork Habits'])
PORT = 9556
PICK = pathlib.Path(tempfile.mkdtemp(prefix='gh-folder-'))
fails = []
def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(info)[:300]) if not ok and info else ''))
    if not ok: fails.append(name)

def start(env_extra=None):
    env = {**os.environ, 'WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS': f'--remote-debugging-port={PORT}', **(env_extra or {})}
    p = subprocess.Popen([EXE], env=env)
    for _ in range(60):
        try:
            if json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json', timeout=1)): return p
        except Exception: time.sleep(0.5)
    raise RuntimeError('the app did not open its debugging port')

def close_main(pid):
    # WM_CLOSE to the app's main window, like its X button (taskkill would only reach one of the app's windows)
    import ctypes, ctypes.wintypes as W
    u = ctypes.windll.user32; found = []
    def cb(h, _):
        p = W.DWORD(); u.GetWindowThreadProcessId(h, ctypes.byref(p)); n = u.GetWindowTextLengthW(h)
        t = ctypes.create_unicode_buffer(n + 1); u.GetWindowTextW(h, t, n + 1)
        if p.value == pid and u.IsWindowVisible(h) and (t.value.endswith('| Groundwork Habits') or t.value.startswith('Groundwork Habits')) and 'widget' not in t.value and 'reminder' not in t.value: found.append(h)
        return True
    u.EnumWindows(ctypes.WINFUNCTYPE(ctypes.c_bool, W.HWND, W.LPARAM)(cb), 0)
    for h in found: u.PostMessageW(h, 0x0010, 0, 0)
    return bool(found)

def stop(p):
    subprocess.run(['taskkill', '/F', '/T', '/PID', str(p.pid)], capture_output=True)
    time.sleep(1.5)

def urls():
    return [x['url'] for x in json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json'))]

async def main_page(pw):
    b = await pw.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT}')
    for _ in range(40):
        for c in b.contexts:
            for pg in c.pages:
                if 'tauri.localhost' in pg.url and '#widget' not in pg.url and '#ask' not in pg.url: return b, pg
        await asyncio.sleep(0.25)
    raise RuntimeError('main window not found')

async def run(had_electron):
    async with async_playwright() as pw:
        p = start({'GROUNDWORK_TEST_PICK': str(PICK), 'GROUNDWORK_TEST_ANSWERS': '0'})
        try:
            b, pg = await main_page(pw)
            await pg.wait_for_function('window.GroundworkTest&&document.title.includes("Groundwork Habits")', timeout=15000)
            check(('Lite' if LITE else 'the full app') + ' is running', await pg.evaluate('document.documentElement.classList.contains("lite")') == LITE)
            if not LITE and had_electron:
                check('the move from Electron: the saved data is there on the first start', await pg.evaluate("window.GroundworkTest.state().habits.length>0"))
            check('the desktop bridge is there', await pg.evaluate('!!(window.groundworkFS&&groundworkFS.backup&&groundworkFS.widget)'))
            check('no service worker in the desktop app', await pg.evaluate('navigator.serviceWorker?navigator.serviceWorker.getRegistrations().then(r=>r.length===0):true'))
            await pg.evaluate("localStorage.setItem('groundwork-tips','1')")
            await pg.goto(pg.url.split('#')[0] + '#habits'); await pg.wait_for_timeout(400)
            await pg.click('#main [data-act=newhabit]'); await pg.fill('#mName', 'Tauri habit'); await pg.click('[data-act=msave]'); await pg.wait_for_timeout(300)
            check('adding a habit works', await pg.evaluate("window.GroundworkTest.state().habits.some(h=>h.name==='Tauri habit')"))
            where = await pg.evaluate("groundworkFS.backup('groundwork-backup-test.json',JSON.stringify({habits:[]}))")
            check('a backup is written to disk', bool(where) and (pathlib.Path(where) / 'groundwork-backup-test.json').exists(), where)
            check('a bad backup name is refused', await pg.evaluate("groundworkFS.backup('../evil.json','x')") is None)
            check('notifications do not fail', await pg.evaluate("(()=>{try{new Notification('Groundwork Habits',{body:'test'});return true}catch(e){return false}})()"))
            if LITE:
                check('Lite has no online parts in its bridge', await pg.evaluate("!groundworkFS.fetchCal&&!groundworkFS.updateCheck&&groundworkFS.folder()===''"))
            else:
                r = await pg.evaluate("groundworkFS.choose()")
                check('data folder: picking an empty folder', r and r.get('folder') == str(PICK) and r.get('mode') == 'replace', r)
                check('data folder: the app knows it', await pg.evaluate("groundworkFS.folder()") == str(PICK))
                check('data folder: writing mirrors to groundwork.json', await pg.evaluate("groundworkFS.write(JSON.stringify({habits:[{id:'a'}]}))") and (PICK / 'groundwork.json').exists())
                check('data folder: reading it back', await pg.evaluate("JSON.parse(groundworkFS.read()).habits[0].id") == 'a')
                r = await pg.evaluate("groundworkFS.choose()")  # the folder now has a save; the test answer 0 = replace
                check('data folder: replacing a save keeps the old file', r and r.get('mode') == 'replace' and any(f.name.startswith('groundwork-replaced-') for f in PICK.iterdir()), list(PICK.iterdir()))
                for u in ['https://127.0.0.1/cal.ics', 'https://localhost/cal.ics', 'http://example.com/cal.ics', 'https://192.168.1.1/x.ics', 'https://[::1]/x.ics']:
                    r = await pg.evaluate("u=>groundworkFS.fetchCal(u)", u)
                    check(f'calendar refuses {u}', r.get('ok') is False and 'public https' in r.get('error', ''), r)
                r = await pg.evaluate("groundworkFS.updateCheck()")
                check('the update check answers', r.get('ok') is True, r)
                await pg.evaluate("groundworkFS.reset()")
                check('data folder: stop using it', await pg.evaluate("groundworkFS.folder()") == '')
            await pg.evaluate('groundworkFS.widget()')
            for _ in range(20):  # a new window takes a moment to load its page
                await asyncio.sleep(0.5); u = urls()
                if any('#widget' in x for x in u): break
            check('the mini widget opens', any('#widget' in x for x in u), u)
            await pg.evaluate("groundworkFS.ask('testhabit','2026-03-18')")
            for _ in range(20):
                await asyncio.sleep(0.5); u = urls()
                if any('#ask~testhabit~2026-03-18' in x for x in u): break
            check('a reminder pop-up opens', any('#ask~testhabit~2026-03-18' in x for x in u), u)
            # closing the main window like its X button: the page finishes its save, then the app quits with its windows
            close_main(p.pid)
            try: p.wait(timeout=8); closed = True
            except subprocess.TimeoutExpired: closed = False
            check('closing the window saves and exits', closed)
            await b.close()
        finally:
            stop(p)
        p = start()
        try:
            b, pg = await main_page(pw)
            await pg.wait_for_function('window.GroundworkTest', timeout=15000)
            check('data survives closing and reopening', await pg.evaluate("window.GroundworkTest.state().habits.some(h=>h.name==='Tauri habit')"))
            await b.close()
        finally:
            stop(p)

def main():
    if not EXE or not os.path.exists(EXE): sys.exit('usage: python tests/tauri_app.py "<path to the app exe>"')
    # a set-aside folder left by an interrupted run may hold real data: never delete or overwrite it, stop instead
    left = [d.with_name(d.name + '.test-bak') for d in DIRS if d.with_name(d.name + '.test-bak').exists()]
    if left: sys.exit('A folder set aside by an earlier, interrupted run is still there. Check it holds your data, rename it back, then rerun: ' + ', '.join(map(str, left)))
    kept = []
    try:
        for d in DIRS:
            if d.exists(): bak = d.with_name(d.name + '.test-bak'); d.rename(bak); kept.append((d, bak))
        had_electron = False
        if not LITE:  # the move from Electron: a copy of the set-aside Electron profile's saved data, if there is one
            src = ROAM / 'Groundwork Habits.test-bak' / 'Local Storage'
            if src.exists(): shutil.copytree(src, ROAM / 'Groundwork Habits' / 'Local Storage', dirs_exist_ok=True); had_electron = True
        asyncio.run(run(had_electron))
    finally:
        # only the test's own copies go; the set-aside folders come back exactly as they were
        for d, bak in kept:
            shutil.rmtree(d, ignore_errors=True)
            if not d.exists(): bak.rename(d)
            else: print(f'WARNING: could not restore {bak} to {d}: rename it back by hand')
        for d in DIRS:
            if not any(d == k for k, _ in kept): shutil.rmtree(d, ignore_errors=True)
        shutil.rmtree(PICK, ignore_errors=True)
    print(f'\n{len(fails)} failure(s)' if fails else '\nAll checks passed'); sys.exit(1 if fails else 0)

main()
