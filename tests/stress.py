"""Stress test: big data, every view, 6 sizes x 3 themes, layout checks, random clicking, edge dates.
Run: python tests/stress.py <out-folder>   (LAYOUT_ONLY=1 for the layout pass only). Writes report.txt and screenshots."""
import asyncio, subprocess, sys, time, json, random, os
from playwright.async_api import async_playwright
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8780', '--directory', 'www'], stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL); time.sleep(1)
URL = 'http://localhost:8780/index.html'
VIEWS = ['today', 'habits', 'tasks', 'goals', 'insights', 'achievements']
LONG = 'Supercalifragilisticexpialidocious-habit-with-a-really-long-name-that-never-ends'

BIG = r"""(()=>{const p=n=>String(n).padStart(2,'0'),k=d=>d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
 const S={v:1,habits:[],log:{},tasks:{},goals:[],journal:{},quits:[],count:{},notes:{},templates:[]};const now=new Date();
 const C=['#8b5cf6','#3b82f6','#f43f5e','#22c55e','#f59e0b','#ec4899'];
 for(let i=0;i<40;i++){const id='h'+i,ty=i<26?'daily':i<34?'weekly':'monthly';S.habits.push({id,name:(i%5===0?'LONG':'Habit '+i)+(i%7===0?' with emoji-free extra words to wrap':''),type:ty,color:C[i%6],target:i%4===0?8:1,per:i%3===0?3:7});S.log[id]={};S.count[id]={};S.notes[id]={};
   for(let d=0;d<200;d++){const dt=new Date(now);dt.setDate(dt.getDate()-d);if(Math.random()<.6)S.log[id][k(dt)]=1;if(i%4===0&&Math.random()<.3)S.count[id][k(dt)]=3;if(Math.random()<.05)S.notes[id][k(dt)]='Note '+'lorem ipsum '.repeat(10)}
   S.log[id][now.getFullYear()+'-'+p(now.getMonth()+1)+'-W2']=1;S.log[id][now.getFullYear()+'-'+p(now.getMonth()+1)]=1}
 for(let d=-40;d<20;d++){const dt=new Date(now);dt.setDate(dt.getDate()+d);S.tasks[k(dt)]={items:[...Array(12)].map((_,j)=>({id:'t'+d+'_'+j,text:j%4===0?'LONG task '+'word '.repeat(20):'Task '+j,done:Math.random()<.5,...(j===11?{cal:'u'+d}:{})})),mind:{energy:Math.ceil(Math.random()*10),focus:5,motivation:7}}}
 for(let i=0;i<30;i++)S.goals.push({id:'g'+i,title:i%3?'Goal '+i:'LONG',area:'Health',pct:(i*7)%101});
 for(let i=0;i<20;i++)S.quits.push({id:'q'+i,name:i%4?'Quit '+i:'LONG',since:'202'+(i%6)+'-0'+(1+i%9)+'-1'+(i%9)+'T0'+(i%9)+':30',best:i*13});
 for(let i=0;i<20;i++)S.templates.push({id:'tp'+i,name:'Template '+i,items:['A','B','C']});
 S.journal[now.getFullYear()+'-'+p(now.getMonth()+1)]='Reflection '+'text '.repeat(200);
 return JSON.stringify(S).split('LONG').join(LONGNAME)})()""".replace('LONGNAME', json.dumps(LONG))

LAYOUT = r"""(()=>{const out=[],W=document.documentElement.clientWidth;
 if(document.documentElement.scrollWidth>W+1)out.push('page scrolls sideways: '+document.documentElement.scrollWidth+' > '+W);
 const scrollers=[...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return /(auto|scroll|hidden)/.test(s.overflowX)&&e!==document.body&&e!==document.documentElement});
 const inScroller=e=>scrollers.some(s=>s!==e&&s.contains(e));
 document.querySelectorAll('#main *,.top *,#menu *,#modal *').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return;const s=getComputedStyle(e);if(s.visibility==='hidden'||s.position==='fixed')return;
   if(!inScroller(e)&&(r.right>W+1||r.left<-1))out.push('off-screen: '+e.tagName+'.'+e.className+' '+Math.round(r.left)+'..'+Math.round(r.right)+' "'+(e.textContent||'').trim().slice(0,30)+'"');
   if((e.tagName==='BUTTON'||e.classList.contains('lbl'))&&e.scrollWidth>e.clientWidth+2&&s.overflow!=='hidden'&&s.textOverflow!=='ellipsis')out.push('text spills out of '+e.tagName+'.'+e.className+' "'+e.textContent.trim().slice(0,30)+'"');});
 document.querySelectorAll('button,[role=switch],input,select,textarea').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.height&&(r.width<14||r.height<14)&&!e.closest('.dghost'))out.push('tiny control '+e.tagName+'.'+e.className+' '+Math.round(r.width)+'x'+Math.round(r.height))});
 document.querySelectorAll('button:not([aria-label])').forEach(b=>{if(!b.textContent.trim())out.push('icon button without label: '+b.className+' act='+b.dataset.act)});
 // key elements must not be covered by something else: probe points just inside their edges
 const H=innerHeight;if(!document.querySelector('#modal .ov'))document.querySelectorAll('#main .ringw svg, #main .tk span[contenteditable], #main .gname .nb, #main .cell, #main .cb, #main .trow .nm').forEach(e=>{
   const r=e.getBoundingClientRect();if(r.width<6||r.height<6||r.top<70||r.bottom>H-100)return;
   const pts=[[r.left+r.width/2,r.bottom-2],[r.left+r.width/2,r.top+2],[r.left+2,r.top+r.height/2],[r.right-2,r.top+r.height/2]];
   for(const [x,y] of pts){if(x<0||x>W)continue;const t=document.elementFromPoint(x,y);if(t&&!e.contains(t)&&!t.contains(e)&&!t.closest('.pnav,.toast,#focusbar,.gstat,.gname,.rin')){out.push('covered: '+e.tagName+'.'+(typeof e.className==='string'?e.className:'svg')+' by '+t.tagName+'.'+(typeof t.className==='string'?t.className:'')+' "'+(e.textContent||'').trim().slice(0,20)+'"');break}}});
 // breathing room: a progress ring keeps at least 10px from any block it sits next to (spacing rule)
 document.querySelectorAll('#main .ringw').forEach(rg=>{const card=rg.closest('.card,.day,section');if(!card)return;const R=rg.getBoundingClientRect();if(!R.width)return;
   [...card.querySelectorAll('.tk,.tlist>*,.addt,.tl,.mh,.wkbody>*:not(.ovr),.cnt')].forEach(e=>{if(e.contains(rg)||rg.contains(e))return;const B=e.getBoundingClientRect();if(!B.width||!B.height)return;
     const hx=Math.min(R.right,B.right)-Math.max(R.left,B.left),vy=Math.max(B.top-R.bottom,R.top-B.bottom);
     if(hx>0&&vy<10)out.push('too close to a ring ('+Math.round(vy)+'px): '+e.className)})});
 // siblings in normal flow must not overlap (catches clipped rings, grips on top of text, squashed rows)
 const flow=e=>{const s=getComputedStyle(e);return !/absolute|fixed/.test(s.position)&&s.display!=='none'&&s.display!=='inline'&&s.visibility!=='hidden'}; // inline text that wraps has overlapping boxes by nature
 document.querySelectorAll('#main *, #modal *').forEach(p=>{
   if(p.closest('svg,.grow,.wrow,.hgrid,.hmon,.dghost'))return;
   const kids=[...p.children].filter(flow).map(k=>[k,k.getBoundingClientRect()]).filter(([k,r])=>r.width>2&&r.height>2);
   for(let i=0;i<kids.length;i++)for(let j=i+1;j<kids.length;j++){const a=kids[i][1],b=kids[j][1];
     const w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
     if(w>3&&h>3)out.push('overlap in '+p.tagName+'.'+(typeof p.className==='string'?p.className:'')+': '+kids[i][0].className+' / '+kids[j][0].className)}});
 return [...new Set(out)].slice(0,25)})()"""

def dump(findings):
    rep = sorted(((k, sorted(v)) for k, v in findings.items()), key=lambda x: -len(x[1]))
    NL = chr(10)
    open(f'{OUT}/report.txt', 'w', encoding='utf-8').write(NL.join('[%dx] %s%s    e.g. %s' % (len(v), k, NL, ', '.join(v[:4])) for k, v in rep))
    print(len(rep), 'distinct findings')
async def run():
    findings = {}
    def note(key, items):
        for it in items: findings.setdefault(it, set()).add(key)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # 1. layout across sizes and themes with heavy data
        for w, h in [(320, 640), (390, 844), (768, 1024), (1024, 768), (1280, 800), (1920, 1080)]:
            for th in ['dark', 'light', 'amoled']:
                ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=w < 800, is_mobile=w < 800)
                await ctx.add_init_script("localStorage.getItem('groundwork-tips')||localStorage.setItem('groundwork-tips','1')")
                pg = await ctx.new_page(); errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)))
                await pg.goto(URL)
                big = await pg.evaluate(BIG)
                await pg.evaluate("([d,t])=>{localStorage.setItem('groundwork-v2',d);localStorage.setItem('groundwork-prefs',JSON.stringify({theme:t,accent:'#98c4fb',feat:{reminder:false}}))}", [big, th])
                await pg.reload(); await pg.wait_for_timeout(200)
                assert await pg.evaluate("JSON.parse(localStorage.getItem('groundwork-v2')).habits.length") == 40
                for v in VIEWS:
                    await pg.evaluate(f"location.hash='{v}'"); await pg.wait_for_timeout(300)
                    note(f'{w}px {th} {v}', await pg.evaluate(LAYOUT))
                    if th == 'dark': await pg.screenshot(path=f'{OUT}/{w}-{v}.png', full_page=False)
                await pg.keyboard.press('Escape'); await pg.evaluate("s=>{const e=document.querySelector(s);e&&e.click()}", '[data-act=gear]'); await pg.evaluate("s=>{const e=document.querySelector(s);e&&e.click()}", '[data-act=featfold]'); await pg.wait_for_timeout(100)
                note(f'{w}px {th} settings', await pg.evaluate(LAYOUT))
                if th == 'dark': await pg.screenshot(path=f'{OUT}/{w}-settings.png')
                for m in ['newhabit', 'search', 'focusnew']:
                    await pg.keyboard.press('Escape'); await pg.evaluate("location.hash='today'"); await pg.reload(); await pg.wait_for_timeout(150)
                    if await pg.locator(f'[data-act={m}]').count():
                        await pg.evaluate("s=>{const e=document.querySelector(s);e&&e.click()}", f'[data-act={m}]'); await pg.wait_for_timeout(120)
                        note(f'{w}px {th} modal {m}', await pg.evaluate(LAYOUT))
                note(f'{w}px {th} errors', errs)
                await ctx.close()
        if os.environ.get('LAYOUT_ONLY'):
            await b.close(); srv.kill(); dump(findings); return
        # 2. random clicking (monkey) with heavy data, desktop and phone
        SAFE_SKIP = {'fresh', 'demo', 'import', 'export', 'csv', 'calexport', 'pickdir', 'resetdir', 'widget', 'calset', 'pinset', 'pinforgot', 'wmain', 'calsync', 'goto'}
        for w, h in [(1280, 800), (390, 844)]:
            ctx = await b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True); pg = await ctx.new_page()
            await ctx.add_init_script("localStorage.getItem('groundwork-tips')||localStorage.setItem('groundwork-tips','1')"); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL); big = await pg.evaluate(BIG); await pg.evaluate("d=>{localStorage.setItem('groundwork-v2',d);localStorage.removeItem('groundwork-prefs')}", big); await pg.reload()
            random.seed(7 + w)
            for i in range(600):
                if i % 60 == 0: await pg.evaluate(f"location.hash='{random.choice(VIEWS)}'")
                acts = await pg.evaluate("[...document.querySelectorAll('[data-act]')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&!e.disabled}).map((e,i)=>i)")
                if not acts: continue
                idx = random.choice(acts)
                act = await pg.evaluate(f"(()=>{{const e=[...document.querySelectorAll('[data-act]')].filter(e=>{{const r=e.getBoundingClientRect();return r.width&&r.height&&!e.disabled}})[{idx}];return e?e.dataset.act:null}})()")
                if not act or act in SAFE_SKIP: continue
                try:
                    await pg.evaluate(f"(()=>{{const e=[...document.querySelectorAll('[data-act]')].filter(e=>{{const r=e.getBoundingClientRect();return r.width&&r.height&&!e.disabled}})[{idx}];e&&e.click()}})()")
                except Exception as ex: errs.append('click failed ' + act + ': ' + str(ex)[:80])
                if random.random() < .05: await pg.keyboard.press('Escape')
            ok = await pg.evaluate("(()=>{try{const d=JSON.parse(localStorage.getItem('groundwork-v2'));return Array.isArray(d.habits)&&d.habits.length}catch(e){return 'bad: '+e}})()")
            note(f'monkey {w}px errors', errs); note(f'monkey {w}px data after', [] if ok else ['data broken: ' + str(ok)])
            await ctx.close()
        # 3. edge dates via a fixed clock
        for label, iso in [('leap day', '2028-02-29T10:00:00'), ('new year eve 23:59', '2026-12-31T23:59:30'), ('Sunday', '2026-11-08T09:00:00'), ('DST change', '2027-03-28T12:00:00'), ('1st of month', '2027-01-01T08:00:00')]:
            ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); pg = await ctx.new_page()
            await ctx.add_init_script("localStorage.getItem('groundwork-tips')||localStorage.setItem('groundwork-tips','1')"); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.clock.install(time=iso)
            await pg.goto(URL); await pg.evaluate("s=>{const e=document.querySelector(s);e&&e.click()}", '.empty [data-act=demo]'); await pg.wait_for_timeout(100)
            for v in VIEWS:
                await pg.evaluate(f"location.hash='{v}'"); await pg.wait_for_timeout(150)
            if 'eve' in label:
                await pg.clock.run_for(60_000); await pg.evaluate("window.dispatchEvent(new Event('focus'))"); await pg.wait_for_timeout(150)
                await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(150)
                t = (await pg.locator('#main').inner_text()).lower(); errs += [] if '1 jan' in t else ['did not roll over to the new year after midnight']
            await pg.evaluate("location.hash='habits'"); await pg.wait_for_timeout(100)
            await pg.evaluate("for(let i=0;i<3;i++){const b=document.querySelector('[data-act=next]');b&&b.click()}")
            note(f'date {label}', errs); await ctx.close()
        await b.close()
    srv.kill()
    rep = sorted(((k, sorted(v)) for k, v in findings.items()), key=lambda x: -len(x[1]))
    open(f'{OUT}/report.txt', 'w', encoding='utf-8').write('\n'.join(f'[{len(v)}x] {k}\n    e.g. {", ".join(v[:4])}' for k, v in rep))
    print(len(rep), 'distinct findings')
asyncio.run(run())
