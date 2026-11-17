"""Clicks every button on every screen (desktop and phone width, demo data) and fails on a scroll jump (the page
moving up more than 200 px while you stay on the same screen with no dialog open), a JavaScript error or a console
error, and runs axe-core (WCAG 2 A/AA) on every screen and every dialog it opens, in dark and light. Outside
addresses get an empty answer, so nothing reaches the network. Run: python tests/clickall.py (needs npm install)"""
import asyncio, subprocess, sys, time, pathlib
AXE = pathlib.Path(__file__).resolve().parent.parent.joinpath('node_modules', 'axe-core', 'axe.min.js').read_text(encoding='utf-8')
RUN = "async()=>(await axe.run('#main,#modal,header,nav',{resultTypes:['violations'],runOnly:['wcag2a','wcag2aa']})).violations.map(v=>v.id+' ('+v.impact+'): '+v.nodes[0].target.join(' '))"
from playwright.async_api import async_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8796','--directory','www'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
SKIP={'lookreset','cwipe','erase','reset','gear','setback','demo','csign','gcalsign','creconnect','exportjson','exportcsv','csv','calexport','impfile','impext','updcheck','openbackups','testnote','widget','share','yearimg','print'}
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for w,h,th in [(1280,800,'dark'),(390,844,'dark'),(1280,800,'light')]:
      ctx=await b.new_context(viewport={'width':w,'height':h},has_touch=w<800,is_mobile=w<800,bypass_csp=True)
      await ctx.add_init_script("localStorage.setItem('groundwork-tips','1');localStorage.getItem('groundwork-prefs')||localStorage.setItem('groundwork-prefs',JSON.stringify({theme:'%s'}))" % th)
      await ctx.route('https://**/*', lambda r: r.fulfill(status=200, body='{}', headers={'content-type':'application/json'}))
      pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append('pageerror '+str(e)[:160])); pg.on('console',lambda m: m.type=='error' and errs.append('console '+m.text[:160]))
      await pg.goto('http://localhost:8796/'); await pg.wait_for_timeout(300); await pg.click('[data-act=demo] >> nth=0'); await pg.wait_for_timeout(400); await pg.add_script_tag(content=AXE); dlgs=set()
      for view in ['today','habits','tasks','goals','insights','achievements','settings']:
        await pg.evaluate("v=>location.hash=v",view); await pg.wait_for_timeout(300)
        for x in await pg.evaluate(RUN): errs.append(f'a11y {view}: {x}')
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
          if y0>200 and y1<y0-200 and hv==view and not modal: errs.append(f"jump {view}: {info['a']} {y0:.0f} -> {y1:.0f}")
          await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
          if hv!=view or await pg.evaluate("!!document.querySelector('#modal [role=dialog]')"): await pg.evaluate("v=>{location.hash=v}",view); await pg.wait_for_timeout(250)
      for e in sorted(set(errs)): print(f'FAIL {w}px {th} {e}'); fails.extend(errs)
      print(f'{w}px {th}: {len(set(errs))} problem(s), {len(dlgs)} dialogs checked'); await ctx.close()
    await b.close()
fails=[]
try: asyncio.run(main())
finally: srv.kill()
print('All checks passed' if not fails else f'{len(set(fails))} problem(s)'); sys.exit(1 if fails else 0)
