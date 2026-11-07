"""Screenshot comparison for the light and dark themes (local only: fonts render differently on other systems).
python tests/visual.py           compare against tests/visual/*.png, write diffs to out/visual/
UPDATE=1 python tests/visual.py  accept the current look as the new baseline (after checking the screenshots)
The clock is fixed and the demo data is seeded, so the same code gives the same pixels."""
import asyncio, functools, http.server, os, pathlib, sys, threading
from PIL import Image, ImageChops
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE, OUT = ROOT / 'tests' / 'visual', ROOT / 'out' / 'visual'
PORT, UPDATE, LIMIT = 8790, os.environ.get('UPDATE') == '1', 0.004   # fail when more than 0.4% of pixels change
SHOTS = [(w, h, th, v) for th in ('light', 'dark') for (w, h) in ((1280, 800),) for v in ('today', 'habits', 'tasks', 'goals', 'insights')] \
      + [(390, 844, 'light', v) for v in ('today', 'habits', 'tasks')]

def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / 'www'))
    handler.log_message = lambda *a, **k: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def main():
    BASE.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    srv, bad = serve(), []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h, th, v in SHOTS:
            ctx = await b.new_context(viewport={'width': w, 'height': h}, reduced_motion='reduce')
            await ctx.add_init_script("localStorage.setItem('daybook-tips','1')")
            pg = await ctx.new_page()
            await pg.clock.set_fixed_time('2026-03-18T10:30:00')
            await pg.goto(f'http://127.0.0.1:{PORT}/index.html')
            await pg.evaluate("t=>localStorage.setItem('daybook-prefs',JSON.stringify({theme:t,feat:{reminder:false}}))", th)
            await pg.reload(); await pg.click('[data-act=gear]'); await pg.click('#menu [data-act=demo]')
            await pg.goto(f'http://127.0.0.1:{PORT}/index.html#{v}'); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(400)
            await pg.evaluate("document.getElementById('toast').hidden=true")
            name = f'{v}-{th}-{w}.png'; cur = OUT / name
            await pg.screenshot(path=str(cur), full_page=True); await ctx.close()
            ref = BASE / name
            if UPDATE or not ref.exists():
                ref.write_bytes(cur.read_bytes()); print('BASELINE', name); continue
            a, c = Image.open(ref).convert('RGB'), Image.open(cur).convert('RGB')
            if a.size != c.size:
                bad.append(name); print(f'FAIL {name}: size {a.size} -> {c.size}'); continue
            diff = ImageChops.difference(a, c).convert('L').point(lambda x: 255 if x > 24 else 0)
            share = sum(diff.histogram()[255:]) / (a.size[0] * a.size[1])
            if share > LIMIT:
                bad.append(name); diff.save(OUT / ('diff-' + name)); print(f'FAIL {name}: {share:.2%} of pixels changed (see out/visual/diff-{name})')
            else:
                print(f'PASS {name} ({share:.2%})')
        await b.close()
    srv.shutdown()
    print(f'\n{len(bad)} screen(s) changed' if bad else '\nAll screens match')
    sys.exit(1 if bad else 0)

asyncio.run(main())
