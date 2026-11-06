"""Desktop app: data folder storage. Needs `npm install`. Run: python tests/electron_folder.py"""
import asyncio, json, os, tempfile, pathlib, subprocess, time
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
fails = 0
def check(name, ok):
    global fails; fails += not ok; print(('PASS ' if ok else 'FAIL ') + name)

async def main():
    tmp = pathlib.Path(tempfile.mkdtemp()); prof, folder = tmp / 'profile', tmp / 'Drive'
    prof.mkdir(); folder.mkdir()
    (prof / 'config.json').write_text(json.dumps({'folder': str(folder)}))
    (folder / 'daybook.json').write_text(json.dumps({'habits': [{'id': 'a', 'name': 'From folder', 'type': 'daily', 'color': '#8b5cf6'}], 'log': {}, 'tasks': {}, 'goals': [], 'journal': {}}))
    exe = ROOT / 'node_modules' / 'electron' / 'dist' / ('electron.exe' if os.name == 'nt' else 'electron')
    async with async_playwright() as p:
        proc = subprocess.Popen([str(exe), str(ROOT), '--remote-debugging-port=9339'], env={**os.environ, 'DAYBOOK_USER_DATA': str(prof)})
        for _ in range(40):
            try: b = await p.chromium.connect_over_cdp('http://127.0.0.1:9339'); break
            except Exception: time.sleep(.5)
        while not b.contexts or not b.contexts[0].pages: await asyncio.sleep(.2)
        pg = b.contexts[0].pages[0]; await pg.wait_for_selector('.gname .nb')
        check('loads data from the chosen folder', await pg.locator('.gname .nb', has_text='From folder').count() == 1)
        await pg.click('[data-act=gear]')
        check('menu shows the data folder', str(folder) in await pg.locator('.mpath').inner_text())
        await pg.keyboard.press('Escape')
        await pg.click('[data-act=newhabit] >> nth=0'); await pg.fill('#mName', 'Saved to folder'); await pg.keyboard.press('Enter')
        await pg.wait_for_timeout(600)
        names = [h['name'] for h in json.loads((folder / 'daybook.json').read_text())['habits']]
        check('writes changes to the folder', 'Saved to folder' in names)
        d = json.loads((folder / 'daybook.json').read_text()); d['habits'].append({'id': 'b', 'name': 'Synced in', 'type': 'daily', 'color': '#3b82f6'})
        (folder / 'daybook.json').write_text(json.dumps(d))
        await pg.evaluate("window.dispatchEvent(new Event('focus'))"); await pg.wait_for_timeout(200)
        check('picks up outside changes on focus', await pg.locator('.gname .nb', has_text='Synced in').count() == 1)
        proc.kill()
    print('\nAll checks passed' if not fails else f'\n{fails} failed'); raise SystemExit(1 if fails else 0)

asyncio.run(main())
