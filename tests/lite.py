"""Groundwork Habits Lite: python tests/lite.py
Builds a Lite copy of www/ (LITE=true, as tools/edition.js does) and checks what Lite leaves out is gone
(calendar, update checks, data folder, templates, sharing, focus timer, challenges), that its data uses its own storage keys, and that the core app still works."""
import subprocess, asyncio, functools, http.server, pathlib, shutil, sys, tempfile, threading
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
fails = []
def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(info)[:300]) if not ok and info else ''))
    if not ok: fails.append(name)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

async def main():
    # the desktop app keeps its data under its app ID: Lite must get its own, or it would share the full app's data
    ed = (ROOT / 'tools' / 'edition.js').read_text(encoding='utf-8')
    check('desktop: edition.js gives Lite its own app ID in tauri.conf.json',
          '"identifier": "com.groundwork.habits",' in ed and "ID = 'com.groundwork.habits.lite'" in ed)
    # edition.js must still find every line it edits (a reformatted package.json once broke every Lite build in CI)
    ed_root = pathlib.Path(tempfile.mkdtemp())
    for f in ['tools/edition.js', 'package.json', 'capacitor.config.json', 'www/manifest.webmanifest', 'www/js/core.js', 'tauri/tauri.conf.json']:
        (ed_root / f).parent.mkdir(parents=True, exist_ok=True); shutil.copy(ROOT / f, ed_root / f)
    r = subprocess.run(['node', str(ed_root / 'tools' / 'edition.js'), 'lite'], capture_output=True, text=True)
    check('edition.js turns a copy of the repo into Lite', r.returncode == 0 and '"productName": "Groundwork Habits Lite"' in (ed_root / 'package.json').read_text(encoding='utf-8'), r.stderr)
    tmp = pathlib.Path(tempfile.mkdtemp()) / 'www'
    shutil.copytree(ROOT / 'www', tmp)
    core = tmp / 'js' / 'core.js'; s = core.read_text(encoding='utf-8')
    check('core.js has the LITE switch, off', s.count('const LITE=false;') == 1)
    core.write_text(s.replace('const LITE=false;', 'const LITE=true;'), encoding='utf-8')
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8819), functools.partial(Quiet, directory=str(tmp)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = 'http://127.0.0.1:8819/index.html'
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h in [(1280, 800), (390, 844)]:
            pg = await b.new_page(viewport={'width': w, 'height': h}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.add_init_script("localStorage.setItem('groundwork-tips','1')")
            await pg.goto(url + '#settings/data'); await pg.wait_for_timeout(250)
            await pg.click('#main [data-act=demo]'); await pg.wait_for_timeout(200)
            tag = f' ({w}px)'
            check('Lite: <html> has the lite class' + tag, await pg.evaluate("document.documentElement.classList.contains('lite')"))
            check('Lite: data saved under its own key' + tag, await pg.evaluate("!!localStorage.getItem('groundwork-lite-v2')&&localStorage.getItem('groundwork-v2')===null"))
            for v in ['today', 'habits', 'tasks', 'goals', 'insights', 'achievements']:
                await pg.goto(url + '#' + v); await pg.wait_for_timeout(200)
                vis = await pg.evaluate("""[...document.querySelectorAll('[data-act=tpl],[data-act=sharecard],[data-act=yearimg],[data-act=focusnew]')].filter(e=>e.offsetParent!==null).map(e=>e.outerHTML.slice(0,60))""")
                check(f'Lite: no templates, sharing or focus timer on {v}' + tag, not vis, vis)
            await pg.goto(url + '#settings'); await pg.wait_for_timeout(250)
            txt = await pg.inner_text('#main')
            check('Lite: Settings has no Calendar section' + tag, 'Calendar' not in txt, txt[:200])
            await pg.goto(url + '#settings/data'); await pg.wait_for_timeout(200)
            check('Lite: import from other apps is there (it works offline)' + tag, 'Import from another app' in await pg.inner_text('#main'))
            await pg.goto(url + '#settings/about'); await pg.wait_for_timeout(200)
            check('Lite: About says Lite' + tag, 'Groundwork Habits Lite' in await pg.inner_text('#main'))
            await pg.goto(url + '#tasks'); await pg.wait_for_timeout(200)
            check('Lite: the mindset tracker is there' + tag, await pg.evaluate("!!document.querySelector('.card.mind')&&document.querySelector('.card.mind').offsetParent!==null"))
            await pg.goto(url + '#settings/features'); await pg.wait_for_timeout(200)
            check('Lite: no focus timer switch' + tag, 'Focus timer' not in await pg.inner_text('#main'))
            await pg.goto(url + '#habits'); await pg.wait_for_timeout(200)
            await pg.click('#main [data-act=newhabit]'); await pg.wait_for_timeout(150)
            check('Lite: no challenge picker in the habit dialog' + tag, await pg.locator('#mCh').count() == 0)
            await pg.fill('#mName', 'Stretch'); await pg.click('[data-act=msave]'); await pg.wait_for_timeout(150)
            check('Lite: adding a habit still works' + tag, await pg.evaluate("window.GroundworkTest.state().habits.some(h=>h.name==='Stretch')"))
            check('Lite: no JS errors' + tag, not errs, errs)
            await pg.close()
        await b.close()
    srv.shutdown(); shutil.rmtree(tmp.parent, ignore_errors=True)
    print(f'\n{"All checks passed" if not fails else str(len(fails)) + " failure(s)"}')
    sys.exit(1 if fails else 0)

asyncio.run(main())
