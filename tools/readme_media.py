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
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=os.environ.get('APP_ROOT', str(ROOT))))  # APP_ROOT: serve another checkout
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
    await pg.reload()  # prefs are read at start-up; a hash change alone keeps the old theme
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
</style></head><body><div id=glow></div><div id=scene><div id=plane><img id=a1></div></div><div id=dof></div><div id=vig></div><div id=cap></div></body></html>"""


async def gif(b):
    """Hero video like the first draft: the app window on a 3D stage, the camera gliding from a start pose to an end
    pose in each scene (one eased move per scene), the app close enough to overflow the frame, big
    captions at the top, depth-of-field bands and a vignette hiding the cropped edges. A fresh start is built up live in nav order: Habits, Tasks, Goals, Insights, Streaks,
    Make it yours, then the window pulls back. App frames are captured live (2x), then shown as images on the stage."""
    import base64
    OW, OH, FPS, SCALE = 1280, 720, 16, 0.9375
    F = int(1000 / FPS)
    frames = []
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    # no first-run tips, and no test-only buttons in the video
    await ctx.add_init_script("""localStorage.setItem('groundwork-tips','1');document.addEventListener('DOMContentLoaded',()=>{
        const s=document.createElement('style');s.textContent='[data-act=demo]{display:none!important}';document.head.appendChild(s)})""")
    # Sunday 29 March: the whole task week is today or later (nothing shows as missed), and March has 29 days to fill
    pg = await ctx.new_page(); await pg.clock.set_fixed_time('2026-03-29T10:30:00')
    await pg.goto(f'http://127.0.0.1:{PORT}/www/index.html#habits'); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(400)
    sctx = await b.new_context(viewport={'width': OW, 'height': OH}, device_scale_factor=1)
    st = await sctx.new_page()
    stage = ROOT / 'out' / 'stage.html'; stage.parent.mkdir(exist_ok=True); stage.write_text(STAGE, encoding='utf-8')
    await st.goto(f'http://127.0.0.1:{PORT}/out/stage.html'); await st.evaluate('document.fonts.ready')

    def ease(t): return t * t * (3 - 2 * t)
    S = {'u': None, 'dirty': True, 'cap': '', 'ct': 0, 'ac': '#9cc96b', 'a': None, 'c': None, 't': 0, 'n': 1}

    def scene(cap, a, c, secs):
        # the first draft's camera: one smoothstep-eased glide from pose a to pose c over the scene
        # pose = (x, y, z, rotateX, rotateY, rotateZ)
        S.update(cap=cap, a=a, c=c, t=0, n=secs * 1000, ct=0)

    async def frame(n=1):
        if S['dirty']:
            S['u'] = 'data:image/jpeg;base64,' + base64.b64encode(await pg.screenshot(type='jpeg', quality=90)).decode(); S['dirty'] = False
        for _ in range(n):
            e = ease(min(1, S['t'] / S['n'])); x, y, z, rx, ry, rz = [p + (q - p) * e for p, q in zip(S['a'], S['c'])]
            k = ease(min(1, S['ct'] / 400))
            await st.evaluate("""([u,tf,cap,k,ac])=>{const s=id=>{const i=document.getElementById(id);if(i.dataset.s!==u){i.src=u;i.dataset.s=u}return i};
                const a=s('a1');document.getElementById('plane').style.transform=tf;document.documentElement.style.setProperty('--ac',ac);
                const c=document.getElementById('cap');if(c.dataset.t!==cap){c.innerHTML=cap;c.dataset.t=cap}
                c.style.opacity=k;c.style.transform='translateY('+(1-k)*24+'px)';c.style.filter='blur('+(1-k)*8+'px)';
                return a.decode().then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}""",
                [S['u'], f'translate3d({x:.2f}px,{y:.2f}px,{z:.2f}px) rotateX({rx:.3f}deg) rotateY({ry:.3f}deg) rotateZ({rz:.3f}deg)', S['cap'], k, S['ac']])
            im = Image.open(io.BytesIO(await st.screenshot(type='jpeg', quality=94))).convert('RGB')
            frames.append(im.resize((int(OW * SCALE), int(OH * SCALE)), Image.LANCZOS))
            S['t'] += F; S['ct'] += F

    async def hold(ms): await frame(max(1, round(ms / F)))

    async def act(fn, n=1):
        await fn(); await pg.wait_for_timeout(40); S['dirty'] = True; await frame(n)

    async def typ(text):
        for i in range(0, len(text), 3):
            await pg.keyboard.type(text[i:i + 3]); S['dirty'] = True; await frame()

    async def click(sel, n=1):
        await act(lambda: pg.locator(sel).first.click(), n)

    async def go(v):
        await pg.evaluate("v=>location.hash=v", v); await pg.wait_for_timeout(350)
        await pg.evaluate("()=>{const t=document.getElementById('toast');if(t)t.hidden=true;scrollTo(0,0)}"); S['dirty'] = True

    t0 = 0
    def mark(label):
        nonlocal t0
        now = len(frames) * F; print(f'{t0 / 1000:5.1f}-{now / 1000:5.1f}s {label}'); t0 = now

    # 1 Habits: the empty guide, four habits typed in, then the month filled up to today with some days missed
    scene('Build the <b>groundwork</b><small>Habits, tasks and goals in one calm place</small>', (0, 160, -900, 38, 0, -14), (0, 40, -260, 26, 0, -8), 2.4)
    await hold(2400); mark('empty Habits')
    scene('Add your <b>habits</b>', (-120, 60, -120, 22, -6, -6), (60, 20, 40, 14, 4, -3), 2.5)
    for name in ('Read 10 pages', 'Morning run', 'Meditate', 'Drink water'):
        await click('#main [data-act=newhabit]', 2); await typ(name); await hold(120); await click('[data-act=msave]', 2)
    mark('habits added')
    ids = await pg.evaluate('window.GroundworkTest.state().habits.map(h=>h.id)')
    scene('Tick off every <b>day</b><small>Streaks, freezes and rest days</small>', (260, 120, -200, 40, 0, -18), (-200, -40, -40, 30, 0, -10), 6.3)
    for d in range(1, 30):
        for j, h in enumerate(ids):
            if d == 29 or (d * 7 + j * 3) % 10 < 8:     # about one in five days missed, like real life
                await act(lambda: pg.locator(f'#main button[data-act=cell][data-h="{h}"][data-d="2026-03-{d:02d}"]').click(), 1)
    await hold(500); mark('month grid ticked')
    # 2 Tasks: Sunday to Saturday, 2-4 a day, most ticked but not all, so the day rings differ
    await go('tasks')
    week = [('2026-03-29', ['Plan the week', 'Meal prep', 'Call mum'], 3), ('2026-03-30', ['Team stand-up', 'Gym class'], 2),
            ('2026-03-31', ['Book the dentist', 'Pay rent', 'Read chapter 3', 'Laundry'], 2), ('2026-04-01', ['Grocery run', 'Finish the report'], 1),
            ('2026-04-02', ['Yoga class', 'Reply to emails', 'Fix the bike'], 3), ('2026-04-03', ['Dinner with Sam', 'Water the plants'], 1),
            ('2026-04-04', ['Long run', 'Clean the flat', 'Movie night'], 1)]
    scene('Plan the <b>week</b>', (0, -180, -300, 48, 0, 12), (0, 120, -160, 34, 0, 6), 9.4)
    for day, items, _ in week:
        await click(f'[data-act=tadd][data-k="{day}"]', 1)
        for t in items:
            await typ(t); await pg.keyboard.press('Enter')
            await act(lambda: pg.evaluate("()=>{const i=document.getElementById('taskInput');if(i)i.value=''}"), 1)  # the focused field keeps its text
        await act(lambda: pg.keyboard.press('Escape'), 1)
    for day, _, done in week:
        for _ in range(done): await click(f'.tlist[data-k="{day}"] [data-act=tdone][aria-pressed=false]', 2)
    await hold(600); mark('Tasks week')
    # 3 Goals: the empty guide, then a goal that fills
    await go('goals')
    scene('Goals you can <b>measure</b>', (-260, 40, -60, 18, 16, 0), (200, 0, -120, 22, -12, 0), 3.6)
    await hold(1100)
    await click('#main [data-act=newgoal]', 2); await typ('Run a half marathon'); await hold(150)
    for v in range(5, 71, 5):
        await act(lambda: pg.evaluate("v=>{const r=document.getElementById('gPct');r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}))}", v), 1)
    await click('[data-act=gsave]', 3); await hold(800); mark('goal')
    # 4 Insights, with data
    await go('insights')
    scene('See what’s <b>working</b><small>Consistency, heatmaps, leaderboards</small>', (0, 220, -700, 50, 0, -20), (0, 0, -180, 24, 0, -6), 3.0)
    await hold(3000); mark('Insights')
    # 5 Streaks: a quit streak with its milestones, and a habit challenge in the list
    await pg.evaluate("()=>{window.GroundworkTest.state().habits[0].ch={from:'2026-03-10',days:30}}")
    await go('achievements')
    scene('Keep your <b>streaks</b><small>Quit streaks, milestones and challenges</small>', (-220, 100, -200, 30, 10, -12), (160, 10, 0, 22, -8, -4), 2.1)
    await hold(400)
    await click('#main [data-act=newquit]', 2); await typ('No sugar')
    await act(lambda: pg.evaluate("()=>{const i=document.getElementById('qSince');i.value='2026-03-15T08:00';i.dispatchEvent(new Event('input',{bubbles:true}))}"), 1)
    await click('[data-act=qsave]', 3); await hold(1100); mark('Streaks')
    # 6 Make it yours: accents (the glow follows), then the themes
    await go('settings/appearance')
    scene('Make it <b>yours</b>', (180, 40, -120, 20, -10, -4), (-160, 0, -60, 24, 10, -2), 4.7)
    await hold(300)
    for c in ['#22d3be', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#9cc96b']:
        await pg.locator(f'#main [data-act=cset][data-f=accent][data-v="{c}"]').click(); await pg.wait_for_timeout(150); S['ac'] = c; S['dirty'] = True; await hold(450)
    for t in ['light', 'amoled', 'dark']:
        await pg.locator(f'[data-act=ptheme][data-v={t}]').click(); await pg.wait_for_timeout(150); S['dirty'] = True; await hold(600)
    mark('Make it yours')
    # 7 the window pulls back and sinks away, like the first draft
    await go('habits')
    scene('Groundwork Habits<small>Private and offline · Windows, macOS, Android, web</small>', (0, 40, -260, 26, 0, -8), (0, 140, -1100, 42, 0, -16), 3.2)
    await hold(3200); mark('ending')
    await sctx.close(); await ctx.close()
    # every frame lasts the same; the encoder only merges frames that are identical, adding their time together
    frames[0].save(OUT / 'intro.webp', save_all=True, append_images=frames[1:], duration=F, loop=0, quality=48, method=4)
    n = len(frames)
    for i in range(0, n, max(1, n // 10)): frames[i].save(ROOT / 'out' / f'intro-frame-{i}.png')
    print(n, 'frames', round(n * F / 1000, 1), 's', FPS, 'fps')


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
