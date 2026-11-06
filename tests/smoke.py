"""Smoke tests for Daybook. Run from the project root:  python tests/smoke.py
Needs:  pip install playwright && playwright install chromium
Starts its own static server for ./www, so nothing else has to be running."""
import asyncio, json, functools, tempfile, threading, http.server
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(tempfile.gettempdir())
PORT = 8765
URL = f'http://localhost:{PORT}/index.html'
failures = []

def check(name, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''))
    if not ok: failures.append(name)

def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / 'www'))
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def desktop(b):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800}, accept_downloads=True)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(300)
    check('first run is empty with demo option', await pg.locator('.empty [data-act=demo]').count() == 1)
    await pg.click('[data-act=newhabit] >> nth=0'); await pg.fill('#mName', 'Drink water'); await pg.keyboard.press('Enter')
    check('add habit', await pg.locator('.gname .nb', has_text='Drink water').count() == 1)
    await pg.click('.gname .nb'); await pg.fill('#mName', 'Drink 2L water'); await pg.click('[data-act=msave]')
    check('rename habit via edit modal', await pg.locator('.gname .nb', has_text='Drink 2L water').count() == 1)
    await pg.click('.gname .nb'); await pg.fill('[data-cf=habit][data-k="0"]', '18'); await pg.click('[data-act=msave]'); await pg.reload()
    check('custom habit colour via RGB saves', await pg.evaluate("JSON.parse(localStorage.getItem('daybook-v2')).habits[0].color") == '#125cf6')
    await pg.locator('.cell:not([disabled])').first.click(); await pg.reload(); await pg.wait_for_timeout(200)
    check('check-in persists after reload', await pg.locator('.cell.on').count() == 1)
    check('saved data has version field', await pg.evaluate("JSON.parse(localStorage.getItem('daybook-v2')).v") == 1)
    await pg.click('.gname .nb'); await pg.click('[data-act=mdel]'); await pg.click('[data-act=mdel]')
    check('two-step delete', await pg.locator('.gname .nb').count() == 0)
    await pg.click('.empty [data-act=demo]'); await pg.wait_for_timeout(150)
    check('demo data loads', await pg.locator('.hrow').count() == 9)
    await pg.click('#gearBtn'); await pg.click('#menu [data-act=demo]')
    check('demo asks before replacing data', 'Tap again' in await pg.locator('#menu [data-act=demo]').inner_text())
    await pg.keyboard.press('Escape'); await pg.click('#gearBtn')
    async with pg.expect_download() as dl: await pg.click('#menu [data-act=export]')
    path = OUT / 'daybook-backup.json'; await (await dl.value).save_as(str(path))
    check('export backup', len(json.loads(path.read_text())['habits']) == 15)
    await pg.click('#gearBtn'); await pg.click('#menu [data-act=fresh]'); await pg.click('#menu [data-act=fresh]')
    check('start fresh', await pg.locator('.hrow').count() == 0)
    await pg.click('#gearBtn')
    async with pg.expect_file_chooser() as fc: await pg.click('#menu [data-act=import]')
    await (await fc.value).set_files(str(path)); await pg.wait_for_timeout(200)
    check('import backup', await pg.locator('.hrow').count() == 9)
    for view in ['tasks', 'insights', 'goals', 'today']:
        await pg.evaluate(f"location.hash='{view}'"); await pg.wait_for_timeout(150)
        check(f'{view} view renders', await pg.locator('#main > *').count() > 0)
    await pg.evaluate("location.hash='tasks'"); await pg.wait_for_timeout(150)
    await pg.locator('[data-act=tadd]').nth(6).click(); await pg.keyboard.type('Test task'); await pg.keyboard.press('Enter')
    check('add task', await pg.locator('.tk', has_text='Test task').count() == 1)
    await pg.locator('.tk span', has_text='Test task').click(); await pg.keyboard.press('End'); await pg.keyboard.type(' edited'); await pg.keyboard.press('Enter')
    await pg.reload(); await pg.wait_for_timeout(200)
    check('edit task text persists', await pg.locator('.tk span', has_text='Test task edited').count() == 1)
    await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(150)
    await pg.locator('.goal h3').first.click(); await pg.keyboard.press('Control+A'); await pg.keyboard.press('Delete'); await pg.keyboard.press('Enter')
    t0 = await pg.locator('.goal h3').first.inner_text()
    await pg.locator('.goal h3').first.click(); await pg.keyboard.press('Control+A'); await pg.keyboard.type('Renamed goal'); await pg.keyboard.press('Enter')
    await pg.reload(); await pg.wait_for_timeout(200)
    check('empty goal title is restored, edit persists', bool(t0.strip()) and await pg.locator('.goal h3').first.inner_text() == 'Renamed goal')
    await pg.evaluate("location.hash='insights'"); await pg.wait_for_timeout(150)
    box = await pg.locator('#ichart').bounding_box()
    await pg.mouse.move(box['x'] + box['width'] * .7, box['y'] + 100); await pg.wait_for_timeout(100)
    check('insights chart hover tooltip', '%' in await pg.locator('#tip').inner_text())
    await pg.click('[data-act=gear]'); await pg.click('[data-act=paccent][data-v="#f472b6"]'); await pg.click('[data-act=ptheme][data-v=light]')
    await pg.reload(); await pg.wait_for_timeout(200)
    check('customize accent and theme persist', await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()") == '#f472b6' and await pg.evaluate("document.documentElement.classList.contains('light')"))
    await pg.click('[data-act=gear]'); await pg.fill('[data-cf=accent][data-k=hex]', '#ff8800')
    rgb = [await pg.input_value(f'[data-cf=accent][data-k="{i}"]') for i in range(3)]
    await pg.fill('[data-cf=accent][data-k="2"]', '255')
    check('accent hex and RGB inputs sync', rgb == ['255', '136', '0'] and await pg.input_value('[data-cf=accent][data-k=hex]') == '#ff88ff' and await pg.evaluate("JSON.parse(localStorage.getItem('daybook-prefs')).accent") == '#ff88ff')
    await pg.evaluate("localStorage.removeItem('daybook-prefs')"); await pg.reload()
    await pg.evaluate("""localStorage.setItem('daybook-v2',JSON.stringify({habits:[{id:'x\\"><img src=x onerror=window.pwn=1>',name:'H',type:'daily',color:'red\\"><img src=x onerror=window.pwn=1>'}],log:{},tasks:{},goals:[{id:'g',title:'G',area:'Health',pct:'<img src=x onerror=window.pwn=1>'}],journal:{}}))""")
    await pg.reload(); await pg.wait_for_timeout(200); await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(200)
    check('malicious saved data is sanitised', not await pg.evaluate('window.pwn') and await pg.locator('.goal .pc').first.inner_text() == '0%')
    await pg.evaluate("localStorage.removeItem('daybook-v2')")
    await pg.evaluate("location.hash='achievements'"); await pg.wait_for_timeout(150)
    await pg.click('[data-act=newquit] >> nth=0'); await pg.fill('#qName', 'Smoking')
    await pg.fill('#qSince', await pg.evaluate("(()=>{const d=new Date(Date.now()-10*864e5-2*36e5);const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())})()"))
    await pg.click('[data-act=qsave]'); await pg.reload(); await pg.wait_for_timeout(200)
    check('quit streak counts days since and persists', (await pg.locator('.ach .pc').first.inner_text()).startswith('10') and await pg.locator('.miles span').count() == 3)
    await pg.click('[data-act=editquit]'); await pg.click('[data-act=qreset]'); await pg.click('[data-act=qreset]')
    check('restart keeps best streak', (await pg.locator('.ach .pc').first.inner_text()).startswith('0') and 'Best: 10' in await pg.locator('.ach').first.inner_text())
    check('no JS errors (desktop)', not errs, errs)
    await ctx.close()

async def mobile(b):
    ctx = await b.new_context(viewport={'width': 390, 'height': 800}, has_touch=True, is_mobile=True)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.click('.empty [data-act=demo]'); await pg.wait_for_timeout(150)
    await pg.evaluate("document.querySelector('.gcard').scrollLeft=300")
    await pg.evaluate("document.querySelectorAll('.cell:not([disabled])')[2].click()"); await pg.wait_for_timeout(100)
    check('grid keeps horizontal scroll after a tap', await pg.evaluate("document.querySelector('.gcard').scrollLeft") == 300)
    await pg.evaluate("location.hash='insights'"); await pg.wait_for_timeout(150)
    await pg.click('[data-act=menu][data-m=range]'); await pg.click('[data-act=pick][data-m=range][data-v="30"]')
    check('insights dropdown usable on phone', 'LAST 30 DAYS' in (await pg.locator('[data-act=menu][data-m=range]').inner_text()).upper())
    await pg.evaluate("location.hash='tasks'"); await pg.wait_for_timeout(150)
    check('task delete visible on touch', float(await pg.evaluate("getComputedStyle(document.querySelector('.tkx')).opacity")) > .5)
    check('no JS errors (mobile)', not errs, errs)
    await ctx.close()

async def main():
    srv = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await desktop(b); await mobile(b)
        await b.close()
    srv.shutdown()
    print(f"\n{len(failures)} failure(s)" if failures else "\nAll checks passed")
    raise SystemExit(1 if failures else 0)

asyncio.run(main())
