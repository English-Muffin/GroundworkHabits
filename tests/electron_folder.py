"""Desktop app: data folder storage. Needs `npm install`. Run: python tests/electron_folder.py"""
import asyncio, json, os, tempfile, pathlib, subprocess, time
from playwright.async_api import async_playwright

def kill(proc):
    subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], capture_output=True) if os.name == 'nt' else proc.kill()

ROOT = pathlib.Path(__file__).resolve().parent.parent
fails = 0
def check(name, ok):
    global fails; fails += not ok; print(('PASS ' if ok else 'FAIL ') + name, flush=True)

async def main():
    tmp = pathlib.Path(tempfile.mkdtemp()); prof, folder = tmp / 'profile', tmp / 'Drive'
    prof.mkdir(); folder.mkdir()
    (prof / 'config.json').write_text(json.dumps({'folder': str(folder)}))
    (folder / 'daybook.json').write_text(json.dumps({'habits': [{'id': 'a', 'name': 'From folder', 'type': 'daily', 'color': '#8b5cf6'}], 'log': {}, 'tasks': {}, 'goals': [], 'journal': {}}))
    exe = ROOT / 'node_modules' / 'electron' / 'dist' / ('electron.exe' if os.name == 'nt' else 'electron')
    async with async_playwright() as p:
        proc, b, pg = await launch(p, exe, prof, {}); await pg.wait_for_selector('.gname .nb')
        check('loads data from the chosen folder', await pg.locator('.gname .nb', has_text='From folder').count() == 1)
        await pg.click('[data-act=gear]')
        check('menu shows the data folder', str(folder) in await pg.locator('.mpath').first.inner_text())
        await pg.keyboard.press('Escape')
        await pg.click('[data-act=newhabit] >> nth=0'); await pg.fill('#mName', 'Saved to folder'); await pg.keyboard.press('Enter')
        await pg.wait_for_timeout(600)
        names = [h['name'] for h in json.loads((folder / 'daybook.json').read_text())['habits']]
        check('writes changes to the folder', 'Saved to folder' in names)
        d = json.loads((folder / 'daybook.json').read_text()); d['habits'].append({'id': 'b', 'name': 'Synced in', 'type': 'daily', 'color': '#3b82f6'})
        (folder / 'daybook.json').write_text(json.dumps(d))
        await pg.evaluate("window.dispatchEvent(new Event('focus'))"); await pg.wait_for_timeout(200)
        check('picks up outside changes on focus', await pg.locator('.gname .nb', has_text='Synced in').count() == 1)
        # mini widget: opens in its own window and stays in sync with the main window
        await pg.evaluate("window.daybookFS.widget()")
        wpg = None
        for _ in range(40):
            wpg = next((x for c in b.contexts for x in c.pages if x.url.endswith('#widget')), None)
            if wpg: break
            await asyncio.sleep(.25)
        await wpg.wait_for_selector('.trow')
        await wpg.locator('.trow', has_text='Saved to folder').locator('.cell').click(); await asyncio.sleep(.4)
        await pg.evaluate("location.hash='today'"); await asyncio.sleep(.3)
        check('widget window ticks a habit and the main window updates', await pg.locator('.trow', has_text='Saved to folder').locator('.cell.on').count() == 1)
        await b.close(); kill(proc)
        await choose_flow(p, exe, tmp)
    print('\nAll checks passed' if not fails else f'\n{fails} failed'); raise SystemExit(1 if fails else 0)

PORT = [9340]
async def launch(p, exe, prof, env):
    PORT[0] += 1
    proc = subprocess.Popen([str(exe), str(ROOT), f'--remote-debugging-port={PORT[0]}'], env={**os.environ, 'DAYBOOK_USER_DATA': str(prof), **env})
    b = None
    for _ in range(60):
        try: b = await p.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT[0]}'); break
        except Exception: await asyncio.sleep(.5)
    assert b, 'could not connect to Electron'
    while not b.contexts or not b.contexts[0].pages: await asyncio.sleep(.2)
    pg = b.contexts[0].pages[0]; await pg.wait_for_selector('#main')
    return proc, b, pg

async def choose_flow(p, exe, tmp):
    drive = tmp / 'Drive2'; drive.mkdir()
    old = {'habits': [{'id': 'o', 'name': 'Old save', 'type': 'daily', 'color': '#8b5cf6'}], 'log': {}, 'tasks': {}, 'goals': [], 'journal': {}}
    (drive / 'daybook.json').write_text(json.dumps(old))
    names = lambda: [h['name'] for h in json.loads((drive / 'daybook.json').read_text())['habits']]
    # answers: cancel; load -> back out; replace
    prof = tmp / 'p2'; prof.mkdir()
    proc, b, pg = await launch(p, exe, prof, {'DAYBOOK_TEST_PICK': str(drive), 'DAYBOOK_TEST_ANSWERS': '2,1,1,0'})
    await pg.click('[data-act=newhabit] >> nth=0'); await pg.fill('#mName', 'Current'); await pg.keyboard.press('Enter')
    async def pick():
        await pg.click('[data-act=gear]'); await pg.click('[data-act=pickdir]'); await pg.wait_for_timeout(500)
    await pick()
    check('cancel keeps current data and folder unused', await pg.locator('.gname .nb', has_text='Current').count() == 1 and names() == ['Old save'] and 'folder' not in json.loads((prof / 'config.json').read_text() if (prof / 'config.json').exists() else '{}'))
    await pick()
    check('backing out of the load warning changes nothing', await pg.locator('.gname .nb', has_text='Current').count() == 1 and names() == ['Old save'])
    await pick()
    check('replace writes current data and keeps a copy of the old save', names() == ['Current'] and len(list(drive.glob('daybook-replaced-*.json'))) == 1)
    await b.close(); kill(proc)
    # load path: confirm both prompts
    (drive / 'daybook.json').write_text(json.dumps(old))
    prof = tmp / 'p3'; prof.mkdir()
    proc, b, pg = await launch(p, exe, prof, {'DAYBOOK_TEST_PICK': str(drive), 'DAYBOOK_TEST_ANSWERS': '1,0'})
    await pick()
    check('load after warning shows the folder save', await pg.locator('.gname .nb', has_text='Old save').count() == 1)
    await b.close(); kill(proc)

asyncio.run(main())
