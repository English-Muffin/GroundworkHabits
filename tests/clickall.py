"""Clicks every button on every screen (desktop and phone width, demo data) and fails on a scroll jump (the page
moving up more than 200 px while you stay on the same screen with no dialog open), a JavaScript error or a console
error, runs axe-core (WCAG 2 A/AA) on every screen and every dialog it opens, and checks the keyboard (Tab always
moves on and shows a focus ring; in a dialog it stays inside, and Esc closes it), in dark and light,
in Arabic (right to left) and on the Lite edition (a LITE=true copy of www/). Outside
addresses get an empty answer, so nothing reaches the network. Run: python tests/clickall.py (needs npm install)"""
import asyncio, subprocess, sys, time, pathlib
sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # Arabic names in the report on a Windows console
AXE = pathlib.Path(__file__).resolve().parent.parent.joinpath('node_modules', 'axe-core', 'axe.min.js').read_text(encoding='utf-8')
# where keyboard focus is: tag, label, whether it shows a focus ring, and whether it sits inside an open dialog
FOC = "(()=>{const e=document.activeElement;if(!e||e===document.body)return null;const c=getComputedStyle(e),ring=(c.outlineStyle!=='none'&&parseFloat(c.outlineWidth)>0)||c.boxShadow!=='none';return {id:e.tagName+'.'+(e.dataset.act||e.id||e.className||'').toString().slice(0,30)+'#'+[...document.querySelectorAll('*')].indexOf(e),ring,inDlg:!!e.closest('#modal'),dlg:!!document.querySelector('#modal [role=dialog]')}})()"
async def tabs(pg, n):
    out = []
    for _ in range(n):
        await pg.keyboard.press('Tab'); out.append(await pg.evaluate(FOC))
    return out
RUN = "async()=>(await axe.run('#main,#modal,header,nav',{resultTypes:['violations'],runOnly:['wcag2a','wcag2aa']})).violations.map(v=>v.id+' ('+v.impact+'): '+v.nodes[0].target.join(' '))"
from playwright.async_api import async_playwright
import shutil, tempfile
LITEDIR=pathlib.Path(tempfile.mkdtemp())/'www'; shutil.copytree('www',LITEDIR); c=LITEDIR/'js'/'core.js'; t=c.read_text(encoding='utf-8'); assert t.count('const LITE=false;')==1; c.write_text(t.replace('const LITE=false;','const LITE=true;'),encoding='utf-8')
srv=subprocess.Popen([sys.executable,'-m','http.server','8796','--directory','www'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
lsrv=subprocess.Popen([sys.executable,'-m','http.server','8798','--directory',str(LITEDIR)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
SKIP={'lookreset','cwipe','erase','reset','gear','setback','demo','csign','gcalsign','creconnect','exportjson','exportcsv','csv','calexport','impfile','impext','updcheck','openbackups','testnote','widget','share','yearimg','print'}
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for w,h,th,lang,lite in [(1280,800,'dark','',0),(390,844,'dark','',0),(1280,800,'light','',0),(1280,800,'dark','ar',0),(390,844,'dark','',1)]:
      ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=w<800,is_mobile=w<800,bypass_csp=True)
      await ctx.add_init_script("localStorage.setItem('groundwork-tips','1');const k=%s?'groundwork-lite-prefs':'groundwork-prefs';localStorage.getItem(k)||localStorage.setItem(k,JSON.stringify(Object.assign({theme:'%s'},'%s'?{lang:'%s'}:{})))" % ('true' if lite else 'false',th,lang,lang))
      await ctx.route('https://**/*', lambda r: r.fulfill(status=200, body='{}', headers={'content-type':'application/json'}))
      pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append('pageerror '+str(e)[:160])); pg.on('console',lambda m: m.type=='error' and errs.append('console '+m.text[:160]))
      await pg.goto('http://localhost:%d/' % (8798 if lite else 8796)); await pg.wait_for_timeout(300); await pg.click('[data-act=demo] >> nth=0'); await pg.wait_for_timeout(400); await pg.add_script_tag(content=AXE); dlgs=set()
      got=await pg.evaluate("[document.dir,document.documentElement.classList.contains('lite')]")
      if got!=['rtl' if lang in ('ar','he') else got[0], bool(lite)]: errs.append(f'setup: expected rtl={lang} lite={lite}, got {got}')
      for view in ['today','habits','tasks','goals','insights','achievements','settings']:
        await pg.evaluate("v=>location.hash=v",view); await pg.wait_for_timeout(300)
        for x in await pg.evaluate(RUN): errs.append(f'a11y {view}: {x}')
        # keyboard: Tab moves on every press and the focused element always shows a ring
        await pg.evaluate("document.activeElement&&document.activeElement.blur();scrollTo(0,0)")
        fs = await tabs(pg, 40); ids = [f['id'] for f in fs if f]
        if len(ids) < 10 or any(ids[i] == ids[i-1] for i in range(1, len(ids))): errs.append(f'keyboard {view}: focus stuck or missing {ids[:6]}')
        for f in fs:
            if f and not f['ring']: errs.append(f"keyboard {view}: no focus ring on {f['id'].split('#')[0]}")
        n=await pg.evaluate("document.querySelectorAll('#main [data-act]').length"); seen=set()
        for i in range(min(n,160)):
          info=await pg.evaluate("i=>{const e=document.querySelectorAll('#main [data-act]')[i];return e?{a:e.dataset.act,tag:e.tagName,vis:!!e.offsetParent}:null}",i)
          if not info or not info['vis'] or info['a'] in SKIP or info['tag'] in ('SELECT','INPUT','TEXTAREA') or info['a'] in seen: continue
          seen.add(info['a'])
          await pg.evaluate("i=>document.querySelectorAll('#main [data-act]')[i].scrollIntoView({block:'center'})",i); await pg.wait_for_timeout(50)
          y0=await pg.evaluate("scrollY")
          try: await pg.evaluate("i=>document.querySelectorAll('#main [data-act]')[i].click()",i)
          except Exception as e: errs.append('click '+info['a']); continue
          await pg.wait_for_timeout(300)
          y1=await pg.evaluate("scrollY"); hv=await pg.evaluate("location.hash.slice(1).split('/')[0]")
          modal=await pg.evaluate("!!document.querySelector('#modal [role=dialog]')")
          kind=await pg.evaluate("(()=>{const d=document.querySelector('#modal [role=dialog]'),h=d&&d.querySelector('h1,h2,h3,[id$=ttl],.mttl');return d?(h?h.textContent:d.getAttribute('aria-label')||d.className).trim().slice(0,40):''})()") if modal else ''
          if modal and kind not in dlgs:
              dlgs.add(kind)
              for x in await pg.evaluate(RUN): errs.append(f'a11y dialog {kind} (from {info["a"]}): {x}')
              # keyboard in a dialog: Tab stays inside it, every stop shows a ring, Esc closes it
              for f in await tabs(pg, 25):
                  if not f or not f['inDlg']: errs.append(f'keyboard dialog {kind}: focus left the dialog'); break
                  if not f['ring']: errs.append(f"keyboard dialog {kind}: no focus ring on {f['id'].split('#')[0]}")
              await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
              if await pg.evaluate("!!document.querySelector('#modal [role=dialog]')"): errs.append(f'keyboard dialog {kind}: Esc does not close it')
          if y0>200 and y1<y0-200 and hv==view and not modal: errs.append(f"jump {view}: {info['a']} {y0:.0f} -> {y1:.0f}")
          await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
          if hv!=view or await pg.evaluate("!!document.querySelector('#modal [role=dialog]')"): await pg.evaluate("v=>{location.hash=v}",view); await pg.wait_for_timeout(250)
      tag=f'{w}px {th}'+(' '+lang if lang else '')+(' Lite' if lite else '')
      for e in sorted(set(errs)): print(f'FAIL {tag} {e}'); fails.extend(errs)
      print(f'{tag}: {len(set(errs))} problem(s), {len(dlgs)} dialogs checked'); await ctx.close()
    await b.close()
fails=[]
try: asyncio.run(main())
finally: srv.kill(); lsrv.kill(); shutil.rmtree(LITEDIR.parent, ignore_errors=True)
print('All checks passed' if not fails else f'{len(set(fails))} problem(s)'); sys.exit(1 if fails else 0)
