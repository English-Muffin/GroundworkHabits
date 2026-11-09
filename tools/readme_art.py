"""README artwork: the hero banner (dark and light), the download buttons and the "How it works" diagrams.
python tools/readme_art.py   (needs Playwright). The app screenshot in the hero comes from the in-browser demo (?demo),
so it shows the real app with example data; the clock is fixed so the output is repeatable."""
import asyncio, functools, http.server, pathlib, threading
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'readme'
PORT = 8798
LOGO = (ROOT / 'assets' / 'logo.svg').read_text(encoding='utf-8')
FONT = '/www/fonts/space-grotesk-latin.woff2'


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


THEME = {
    'dark': dict(bg='#080808', card='#0f0f0f', line='#222', text='#f2f2f2', muted='#8a8a8a', glow='.16', shot='#0b0b0b'),
    'light': dict(bg='#f6f7f3', card='#ffffff', line='#dfe3d8', text='#161a12', muted='#5d6656', glow='.22', shot='#ffffff'),
}


def hero_html(t, shot):
    c = THEME[t]
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:SG;src:url({FONT})}}
html,body{{margin:0;width:1600px;height:560px;overflow:hidden;background:{c['bg']};font-family:SG,sans-serif;color:{c['text']}}}
.glow{{position:absolute;left:820px;top:-80px;width:900px;height:700px;background:radial-gradient(closest-side,#9cc96b,transparent 70%);opacity:{c['glow']};filter:blur(30px)}}
.l{{position:absolute;left:96px;top:118px;width:600px}}
.l svg{{width:76px;height:76px;margin-bottom:22px}}
h1{{font-size:68px;line-height:1;margin:0 0 18px;letter-spacing:-.03em;font-weight:700}}
p{{font-size:25px;line-height:1.4;margin:0;color:{c['muted']}}}
p b{{color:#7fa955;font-weight:600}}
.stage{{position:absolute;left:760px;top:40px;width:1100px;height:640px;perspective:1400px}}
.shot{{width:1100px;height:688px;border-radius:20px;overflow:hidden;transform:rotateX(16deg) rotateY(-18deg) rotateZ(3deg) translateZ(-60px);transform-origin:20% 40%;
  box-shadow:0 0 0 1px {c['line']},0 50px 100px rgba(0,0,0,.35),0 0 80px rgba(156,201,107,.25);background:{c['shot']}}}
.shot img{{width:100%;display:block}}
</style></head><body><div class="glow"></div>
<div class="l">{LOGO}<h1>Groundwork Habits</h1><p>Habits, tasks and goals in one calm place.<br><b>Offline, private, yours.</b></p></div>
<div class="stage"><div class="shot"><img src="{shot}"></div></div></body></html>"""


def diagram_html(t):
    c = THEME[t]
    box = lambda x, y, w, h, title, sub, accent=False: f"""<div class="b{' a' if accent else ''}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"><b>{title}</b><span>{sub}</span></div>"""
    arrow = lambda x1, y1, x2, y2, label='': f"""<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" marker-end="url(#ah)"/>""" + (f"""<text x="{(x1 + x2) / 2}" y="{(y1 + y2) / 2 - 8}">{label}</text>""" if label else '')
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:SG;src:url({FONT})}}
html,body{{margin:0;width:1040px;height:520px;background:{c['bg']};font-family:SG,sans-serif;color:{c['text']};position:relative;overflow:hidden}}
.b{{position:absolute;box-sizing:border-box;border:1.5px solid {c['line']};background:{c['card']};border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:6px}}
.b.a{{border-color:#9cc96b;box-shadow:0 0 30px rgba(156,201,107,.18)}}
.b b{{font-size:17px}}.b span{{font-size:13px;color:{c['muted']};line-height:1.35}}
svg{{position:absolute;inset:0}} line{{stroke:{c['muted']};stroke-width:1.6}} text{{fill:{c['muted']};font:12px SG;text-anchor:middle;paint-order:stroke;stroke:{c['bg']};stroke-width:6px;stroke-linejoin:round}}
.cap{{position:absolute;left:24px;top:18px;font-size:12px;letter-spacing:.12em;color:{c['muted']};font-weight:700}}
</style></head><body><div class="cap">HOW GROUNDWORK HABITS FITS TOGETHER</div>
<svg width="1040" height="520"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{c['muted']}"/></marker></defs>
{arrow(250, 110, 390, 220)}{arrow(250, 250, 390, 250)}{arrow(250, 390, 390, 280)}
{arrow(650, 230, 780, 140, 'every save')}{arrow(650, 260, 780, 260, 'optional')}{arrow(650, 290, 780, 390, 'weekly')}
</svg>
{box(24, 60, 226, 100, 'Windows · macOS', 'Electron wraps the web app; own installer and auto-update')}
{box(24, 200, 226, 100, 'Android', 'Capacitor, plus native reminders, widgets and a quick tile')}
{box(24, 340, 226, 100, 'Any browser', 'Installable web app (PWA) that works offline')}
{box(390, 180, 260, 140, 'The app: www/', 'Plain HTML, CSS and JS, no build step and no server. One data document per device', True)}
{box(780, 80, 236, 110, 'On the device', 'localStorage plus an IndexedDB copy. AES-GCM encrypted with a PIN')}
{box(780, 210, 236, 100, 'Your data folder', 'groundwork.json in a Drive, OneDrive or Dropbox folder keeps devices in step')}
{box(780, 340, 236, 100, 'Backups', 'Automatic, the newest 8 kept; export to JSON or a spreadsheet')}
</body></html>"""


BTN = """<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="48" viewBox="0 0 {w} 48" role="img" aria-label="{label}">
<rect x=".5" y=".5" width="{w1}" height="47" rx="12" fill="{bg}" stroke="{stroke}"/>
<g transform="translate(16 12)" fill="{fg}">{icon}</g>
<text x="52" y="20" font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="11" fill="{fg2}">{top}</text>
<text x="52" y="36" font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="16" font-weight="700" fill="{fg}">{bottom}</text></svg>
"""
ICONS = {
    'windows': '<path d="M0 3.4 9.8 2v9.4H0zm11-1.6L24 0v11.4H11zM0 12.6h9.8V22L0 20.6zm11 0h13V24l-13-1.8z"/>',
    'macos': '<path d="M16.4 12.7c0-3 2.5-4.5 2.6-4.5-1.4-2.1-3.6-2.4-4.4-2.4-1.9-.2-3.6 1.1-4.6 1.1-.9 0-2.4-1.1-3.9-1-2 0-3.9 1.2-4.9 3-2.1 3.7-.5 9.1 1.5 12.1 1 1.4 2.2 3 3.7 3 1.5-.1 2-1 3.8-1s2.3 1 3.9.9c1.6 0 2.6-1.5 3.6-2.9 1.1-1.7 1.6-3.3 1.6-3.4 0 0-3.1-1.2-3.1-4.9zM13.4 3.9c.8-1 1.4-2.4 1.2-3.8-1.2.1-2.6.8-3.5 1.8-.8.9-1.4 2.3-1.2 3.7 1.3.1 2.7-.7 3.5-1.7z"/>',
    'android': '<path d="M3.5 8.6h17v9.6c0 .9-.7 1.6-1.6 1.6H17v3a1.4 1.4 0 0 1-2.8 0v-3h-4.4v3a1.4 1.4 0 0 1-2.8 0v-3H5.1c-.9 0-1.6-.7-1.6-1.6zM0 10a1.4 1.4 0 0 1 2.8 0v6a1.4 1.4 0 0 1-2.8 0zm21.2 0a1.4 1.4 0 0 1 2.8 0v6a1.4 1.4 0 0 1-2.8 0zM3.6 7.6a8.5 8.5 0 0 1 4.6-6.4L7.3-.4a.4.4 0 0 1 .7-.4l1 1.7a8.6 8.6 0 0 1 6 0l1-1.7a.4.4 0 0 1 .7.4l-.9 1.6a8.5 8.5 0 0 1 4.6 6.4zm4.6-3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7.6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>',
    'web': '<path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm7.9 7h-3.5a18 18 0 0 0-1.6-4.6A9.6 9.6 0 0 1 19.9 7zM12 2.4c1 1.3 1.9 2.9 2.4 4.6H9.6c.5-1.7 1.4-3.3 2.4-4.6zM2.7 14.4a9.4 9.4 0 0 1 0-4.8h4a19 19 0 0 0 0 4.8zm1.4 2.6h3.5c.4 1.6 1 3.2 1.6 4.6A9.6 9.6 0 0 1 4.1 17zm3.5-10H4.1a9.6 9.6 0 0 1 5.1-4.6c-.7 1.4-1.2 3-1.6 4.6zM12 21.6c-1-1.3-1.9-2.9-2.4-4.6h4.8c-.5 1.7-1.4 3.3-2.4 4.6zm2.8-7.2H9.2a17 17 0 0 1 0-4.8h5.6a17 17 0 0 1 0 4.8zm.2 7.2c.7-1.4 1.2-3 1.6-4.6h3.5a9.6 9.6 0 0 1-5.1 4.6zm2.3-7.2a19 19 0 0 0 0-4.8h4a9.4 9.4 0 0 1 0 4.8z"/>',
}


def buttons():
    spec = [('windows', 'Download for', 'Windows', 196), ('macos', 'Download for', 'macOS', 180), ('android', 'Download the', 'Android APK', 206),
            ('web', 'Try it in', 'your browser', 200)]
    for name, top, bottom, w in spec:
        primary = name == 'web'
        (OUT / f'badge-{name}.svg').write_text(BTN.format(w=w, w1=w - 1, label=f'{top} {bottom}', top=top, bottom=bottom, icon=ICONS[name],
            bg='#9cc96b' if primary else '#0f0f0f', stroke='#9cc96b' if primary else '#3a3a3a', fg='#14200a' if primary else '#f2f2f2',
            fg2='#2b3d17' if primary else '#a3a3a3'), encoding='utf-8')


async def main():
    OUT.mkdir(parents=True, exist_ok=True); buttons()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{PORT}'
    async with async_playwright() as p:
        b = await p.chromium.launch()
        shots = {}
        for t in ('dark', 'light'):
            ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
            pg = await ctx.new_page(); await pg.clock.set_fixed_time('2026-03-18T10:30:00')
            await pg.add_init_script(f"localStorage.setItem('groundwork-demo-prefs',JSON.stringify({{theme:'{t}',accent:'#9cc96b',feat:{{reminder:false}}}}))")
            await pg.goto(base + '/www/index.html?demo#today'); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(500)
            await pg.add_style_tag(content='.demobar{display:none!important}')
            shots[t] = 'data:image/png;base64,' + __import__('base64').b64encode(await pg.screenshot()).decode()
            await ctx.close()
        pg = await b.new_page(device_scale_factor=2)
        for t in ('dark', 'light'):
            (ROOT / 'out').mkdir(exist_ok=True)
            f = ROOT / 'out' / f'hero-{t}.html'; f.write_text(hero_html(t, shots[t]), encoding='utf-8')
            await pg.set_viewport_size({'width': 1600, 'height': 560}); await pg.goto(f'{base}/out/hero-{t}.html'); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=str(OUT / f'hero-{t}.png'))
            f = ROOT / 'out' / f'diagram-{t}.html'; f.write_text(diagram_html(t), encoding='utf-8')
            await pg.set_viewport_size({'width': 1040, 'height': 520}); await pg.goto(f'{base}/out/diagram-{t}.html'); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=str(OUT / f'architecture-{t}.png'))
        await b.close()
    srv.shutdown()
    for f in sorted(OUT.glob('hero-*')) + sorted(OUT.glob('architecture-*')) + sorted(OUT.glob('badge-*')):
        print(f'{f.name:24} {f.stat().st_size / 1e3:7.1f} kB')

asyncio.run(main())
