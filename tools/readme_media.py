"""Makes the README media from the real app: assets/readme/intro.webp (a short feature tour) and the screenshots.
python tools/readme_media.py          (needs Playwright + Pillow; fixed clock and demo data, so it is repeatable)
Run it before a release when the look changed; check the files before committing."""
import asyncio, functools, http.server, io, pathlib, threading
from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'readme'
PORT = 8797
import os
GIF_ONLY = os.environ.get('GIF_ONLY') == '1'
DEBUG = os.environ.get('DEBUG') == '1'
FONT = ROOT / 'www' / 'fonts' / 'space-grotesk-latin.woff2'


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def caption_font(size):
    for f in ('C:/Windows/Fonts/segoeuib.ttf', '/System/Library/Fonts/SFNS.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


async def page(b, w, h, theme='dark', accent='#9cc96b', lang=None):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, reduced_motion='no-preference')
    await ctx.add_init_script("localStorage.setItem('groundwork-tips','1')")
    pg = await ctx.new_page()
    await pg.clock.set_fixed_time('2026-03-18T10:30:00')
    base = f'http://127.0.0.1:{PORT}/www/index.html'
    await pg.goto(base)
    prefs = {'theme': theme, 'accent': accent, 'feat': {'reminder': False}}
    if lang:
        prefs['lang'] = lang
    await pg.evaluate("p=>localStorage.setItem('groundwork-prefs',JSON.stringify(p))", prefs)
    await pg.goto(base + '#settings/data'); await pg.wait_for_timeout(250)
    await pg.click('#main [data-act=demo]'); await pg.wait_for_timeout(200)
    return ctx, pg, base


async def go(pg, base, view):
    await pg.goto(base + '#' + view); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(450)
    await pg.evaluate("document.getElementById('toast').hidden=true")


async def screenshots(b):
    # different accents and themes on purpose, so the README shows the range
    desk = [('today-light', 'today', 'light', '#f472b6'), ('habits', 'habits', 'amoled', '#a78bfa'),
            ('goals', 'goals', 'dark', '#fbbf24'), ('insights', 'insights', 'dark', '#60a5fa'), ('settings', 'settings/appearance', 'light', '#22d3be')]
    for name, view, th, ac in desk:
        ctx, pg, base = await page(b, 1440, 900, th, ac); await go(pg, base, view)
        await pg.screenshot(path=str(OUT / f'{name}.png')); await ctx.close()
    phone = [('phone-today', 'today', 'dark', '#f472b6', None), ('phone-habits', 'habits', 'light', '#9cc96b', None),
             ('phone-tasks', 'tasks', 'amoled', '#fbbf24', None), ('phone-goals', 'goals', 'dark', '#9cc96b', None),
             ('phone-settings', 'settings/appearance', 'dark', '#60a5fa', 'de')]
    for name, view, th, ac, lang in phone:
        ctx, pg, base = await page(b, 390, 844, th, ac, lang); await go(pg, base, view)
        await pg.screenshot(path=str(OUT / f'{name}.png')); await ctx.close()


STAGE = """<!doctype html><html><head><style>
@font-face{font-family:SG;src:url(/www/fonts/space-grotesk-latin.woff2)}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050505;font-family:SG,sans-serif}
#glow{position:fixed;inset:-20%;background:radial-gradient(closest-side,var(--ac,#9cc96b) 0%,transparent 70%);opacity:.18;filter:blur(40px)}
#scene{position:fixed;inset:0;perspective:1400px;perspective-origin:50% 40%}
#plane{position:absolute;left:50%;top:50%;width:1440px;height:900px;margin:-450px 0 0 -720px;transform-style:preserve-3d;border-radius:22px;overflow:hidden;
  box-shadow:0 0 0 1px #ffffff14,0 60px 120px #000c,0 0 90px color-mix(in srgb,var(--ac,#9cc96b) 22%,transparent)}
#plane img{width:1440px;height:900px;border:0;display:block;background:#080808}
#dof{position:fixed;inset:0;backdrop-filter:blur(7px);-webkit-mask:linear-gradient(to bottom,#000 0%,transparent 34%,transparent 66%,#000 100%);mask:linear-gradient(to bottom,#000 0%,transparent 34%,transparent 66%,#000 100%)}
#vig{position:fixed;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 45%,#000a 100%)}
#cap{position:fixed;left:0;right:0;top:44px;text-align:center;color:#fff;font-weight:700;font-size:46px;letter-spacing:-.02em;text-shadow:0 4px 30px #000}
#cap small{display:block;font-size:22px;font-weight:500;color:#cfcfcf;margin-top:8px;letter-spacing:0}
#cap b{color:var(--ac,#9cc96b)}
</style></head><body><div id=glow></div><div id=scene><div id=plane><img id=app></div></div><div id=dof></div><div id=vig></div><div id=cap></div></body></html>"""


async def gif(b):
    """Cinematic tour: real app screens on a tilted 3D screen, a moving camera, depth blur at the edges and big captions.
    Screens are captured flat first, then animated as images (a live app inside a 3D transform crashed headless Chromium)."""
    W, H, FPS, SCALE = 1280, 720, 16, 0.75
    shots = {}
    ctx, pg, base = await page(b, 1440, 900)

    async def cap(name, view=None):
        if view: await go(pg, base, view)
        shots[name] = 'data:image/png;base64,' + __import__('base64').b64encode(await pg.screenshot()).decode()

    await cap('today', 'today')
    cells = pg.locator('.sec .trow:not(.on) .cell')
    for i in range(3):
        if await cells.count(): await cells.first.click(); await pg.wait_for_timeout(450)
        await cap(f'tick{i}')
    for v in ('habits', 'tasks', 'goals', 'insights'): await cap(v, v)
    await go(pg, base, 'settings/appearance')
    cols = ['#22d3be', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#9cc96b']
    for c in cols:
        await pg.click(f'#main [data-act=cset][data-f=accent][data-v="{c}"]'); await pg.wait_for_timeout(250); await cap('acc' + c)
    await ctx.close()

    sctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)
    st = await sctx.new_page()
    stage = ROOT / 'out' / 'stage.html'; stage.parent.mkdir(exist_ok=True); stage.write_text(STAGE, encoding='utf-8')
    await st.goto(f'http://127.0.0.1:{PORT}/out/stage.html'); await st.evaluate('document.fonts.ready')
    frames, durs = [], []

    def ease(t): return t * t * (3 - 2 * t)
    def lerp(a, c, t): return [x + (y - x) * t for x, y in zip(a, c)]

    async def shot(img, cam, capt, capT, ac='#9cc96b'):
        x, y, z, rx, ry, rz = cam; k = ease(min(1, capT / 0.4))
        await st.evaluate("""([src,tf,cap,k,ac])=>{const i=document.getElementById('app');if(i.dataset.s!==src){i.src=src;i.dataset.s=src}
            document.getElementById('plane').style.transform=tf;document.documentElement.style.setProperty('--ac',ac);const c=document.getElementById('cap');
            if(c.dataset.t!==cap){c.innerHTML=cap;c.dataset.t=cap}c.style.opacity=k;c.style.transform='translateY('+(1-k)*24+'px)';c.style.filter='blur('+(1-k)*8+'px)';
            return i.decode()}""", [shots[img], f'translate3d({x}px,{y}px,{z}px) rotateX({rx}deg) rotateY({ry}deg) rotateZ({rz}deg)', capt, k, ac])
        im = Image.open(io.BytesIO(await st.screenshot(type='jpeg', quality=92))).convert('RGB')
        frames.append(im.resize((int(W * SCALE), int(H * SCALE)), Image.LANCZOS)); durs.append(int(1000 / FPS))

    async def scene(imgs, capt, a, c, secs, ac='#9cc96b'):
        n = int(secs * FPS); print('scene', capt[:30], len(frames), flush=True)
        for i in range(n):
            img = imgs[min(len(imgs) - 1, i * len(imgs) // n)] if isinstance(imgs, list) else imgs
            if isinstance(ac, list): a2 = ac[min(len(ac) - 1, i * len(ac) // n)]
            else: a2 = ac
            await shot(img, lerp(a, c, ease(i / max(1, n - 1))), capt, i / FPS, a2)

    await scene('today', 'Build the groundwork<small>Habits, tasks and goals in one calm place</small>', (0, 160, -900, 38, 0, -14), (0, 40, -260, 26, 0, -8), 3.0)
    await scene(['today', 'tick0', 'tick1', 'tick2'], 'Tick today’s <b>habits</b>', (-120, 60, -120, 22, -6, -6), (60, 20, 40, 14, 4, -3), 3.0)
    await scene('habits', 'Every day of the month<small>Streaks, freezes and rest days</small>', (260, 120, -200, 40, 0, -18), (-200, -40, -40, 30, 0, -10), 3.0)
    await scene('tasks', 'Plan the <b>week</b>', (0, -180, -300, 48, 0, 12), (0, 120, -160, 34, 0, 6), 2.6)
    await scene('goals', 'Goals you can <b>measure</b>', (-260, 40, -60, 18, 16, 0), (200, 0, -120, 22, -12, 0), 2.6)
    await scene('insights', 'See what’s <b>working</b><small>Consistency, heatmaps, leaderboards</small>', (0, 220, -700, 50, 0, -20), (0, 0, -180, 24, 0, -6), 3.0)
    await scene(['acc' + c for c in cols], 'Make it <b>yours</b>', (180, 40, -120, 20, -10, -4), (-160, 0, -60, 24, 10, -2), 3.0, cols)
    await scene('tick2', 'Groundwork Habits<small>Private and offline · Windows, macOS, Android, web</small>', (0, 40, -260, 26, 0, -8), (0, 140, -1100, 42, 0, -16), 3.2)
    await sctx.close()
    # animated WebP: full size and frame rate at a third of a GIF's size (GitHub shows it in the README)
    frames[0].save(OUT / 'intro.webp', save_all=True, append_images=frames[1:], duration=durs, loop=0, quality=70, method=4)


async def main():
    OUT.mkdir(parents=True, exist_ok=True); srv = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        if not GIF_ONLY: await screenshots(b)
        await gif(b)
        await b.close()
    srv.shutdown()
    for f in sorted(OUT.iterdir()):
        print(f'{f.name:22} {f.stat().st_size / 1e6:5.2f} MB')

asyncio.run(main())
