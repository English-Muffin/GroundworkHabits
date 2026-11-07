"""Makes the README media from the real app: assets/readme/intro.gif (a short feature tour) and the screenshots.
python tools/readme_media.py          (needs Playwright + Pillow; fixed clock and demo data, so it is repeatable)
Run it before a release when the look changed; check the files before committing."""
import asyncio, functools, http.server, io, pathlib, threading
from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'readme'
PORT = 8797
FONT = ROOT / 'www' / 'fonts' / 'space-grotesk-latin.woff2'


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def serve():
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=str(ROOT / 'www')))
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
    await ctx.add_init_script("localStorage.setItem('daybook-tips','1')")
    pg = await ctx.new_page()
    await pg.clock.set_fixed_time('2026-03-18T10:30:00')
    base = f'http://127.0.0.1:{PORT}/index.html'
    await pg.goto(base)
    prefs = {'theme': theme, 'accent': accent, 'feat': {'reminder': False}}
    if lang:
        prefs['lang'] = lang
    await pg.evaluate("p=>localStorage.setItem('daybook-prefs',JSON.stringify(p))", prefs)
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


async def gif(b):
    W, H, SCALE = 1280, 800, 0.75
    frames, durs = [], []
    ctx, pg, base = await page(b, W, H)
    font = caption_font(26)

    async def snap(text, ms=110):
        im = Image.open(io.BytesIO(await pg.screenshot())).convert('RGB')
        if text:
            d = ImageDraw.Draw(im, 'RGBA')
            tw = d.textlength(text, font=font); x = (W - tw) / 2
            d.rounded_rectangle((x - 22, H - 86, x + tw + 22, H - 36), 25, fill=(0, 0, 0, 200))
            d.text((x, H - 78), text, font=font, fill=(255, 255, 255))
        frames.append(im.resize((int(W * SCALE), int(H * SCALE)), Image.LANCZOS)); durs.append(ms)

    async def hold(text, ms):
        await snap(text, ms)

    # 1 Today: tick the open habits one by one
    await go(pg, base, 'today'); await hold('Groundwork Habits: habits, tasks and goals in one place', 2200)
    cells = pg.locator('.sec .trow:not(.on) .cell')
    for _ in range(min(3, await cells.count())):
        await cells.first.click(); await pg.wait_for_timeout(350); await snap('Tick today’s habits', 380)
    await hold('Tick today’s habits', 900)
    # 2 Habits month grid
    await go(pg, base, 'habits'); await hold('Every habit, every day of the month, with streaks', 2000)
    # 3 Tasks week
    await go(pg, base, 'tasks'); await hold('Plan the week, track your mindset', 1900)
    # 4 Goals
    await go(pg, base, 'goals'); await hold('Measurable goals in every life area', 1900)
    await pg.mouse.wheel(0, 520); await pg.wait_for_timeout(450); await hold('Measurable goals in every life area', 1500)
    # 5 Insights
    await go(pg, base, 'insights'); await hold('Insights: consistency, heatmap, leaderboards', 1900)
    # 6 Make it yours: accents and themes
    await go(pg, base, 'settings/appearance')
    for c in ['#22d3be', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#9cc96b']:
        await pg.click(f'#main [data-act=cset][data-f=accent][data-v="{c}"]'); await pg.wait_for_timeout(200); await snap('Any accent colour', 520)
    for t in ['light', 'amoled', 'dark']:
        await pg.click(f'[data-act=ptheme][data-v={t}]'); await pg.wait_for_timeout(250); await snap('Dark, AMOLED and light themes', 800)
    await go(pg, base, 'today'); await hold('Private and offline. Windows, macOS, Android and web.', 2600)
    await ctx.close()
    # a palette per frame: the accent changes during the tour, one shared palette would bend those colours
    q = [f.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for f in frames]
    q[0].save(OUT / 'intro.gif', save_all=True, append_images=q[1:], duration=durs, loop=0, optimize=True, disposal=1)


async def main():
    OUT.mkdir(parents=True, exist_ok=True); srv = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await screenshots(b); await gif(b)
        await b.close()
    srv.shutdown()
    for f in sorted(OUT.iterdir()):
        print(f'{f.name:22} {f.stat().st_size / 1e6:5.2f} MB')

asyncio.run(main())
