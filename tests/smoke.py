"""Smoke tests for Daybook. Run from the project root:  python tests/smoke.py
Needs:  pip install playwright && playwright install chromium
Starts its own static server for ./www, so nothing else has to be running."""
import asyncio, json, functools, tempfile, threading, http.server, os, subprocess
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
    await ctx.add_init_script("localStorage.getItem('daybook-tips')||localStorage.setItem('daybook-tips','1')")
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
    await pg.evaluate("location.hash='tasks'"); await pg.wait_for_timeout(150)
    await pg.locator('[data-act=tadd]').nth(0).click(); await pg.keyboard.type('Past task'); await pg.keyboard.press('Enter')
    past = pg.locator('.tk', has_text='Past task').locator('.cb')
    if await pg.evaluate("new Date().getDay()") > 0:  # Sunday has no earlier day in the week
        x1 = await past.get_attribute('class'); await past.click(); on = await past.get_attribute('class'); await past.click(); x2 = await past.get_attribute('class')
        check('missed past task shows X, toggles to done and back', 'cbx' in x1.split() and 'on' in on.split() and 'cbx' in x2.split())
    box = await pg.locator('#mchart').bounding_box()
    await pg.mouse.move(box['x'] + box['width'] * .3, box['y'] + 60); await pg.wait_for_timeout(100)
    check('mindset chart hover tooltip', len(await pg.locator('#mchart .tip small').inner_text()) > 3 and await pg.locator('#mchart path').count() == 6)
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
    await pg.click('[data-act=ptheme][data-v=amoled]'); await pg.reload(); await pg.wait_for_timeout(150)
    check('AMOLED theme is pure black and persists', await pg.evaluate("document.documentElement.classList.contains('amoled')&&getComputedStyle(document.body).backgroundColor==='rgb(0, 0, 0)'&&getComputedStyle(document.querySelector('.card,.gcard,.sum')).backgroundColor==='rgb(0, 0, 0)'"))
    await pg.evaluate("localStorage.removeItem('daybook-prefs')"); await pg.reload()
    cal = await pg.evaluate(r"""(()=>{
      const T=window.DaybookTest,S=T.state(),applyCalendar=T.applyCalendar,parseIcs=T.parseIcs,tasksToIcs=T.tasksToIcs;
      const d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.getFullYear()+String(x.getMonth()+1).padStart(2,'0')+String(x.getDate()).padStart(2,'0')};
      const ics=(evs)=>'BEGIN:VCALENDAR\r\n'+evs.map(e=>'BEGIN:VEVENT\r\nUID:'+e[0]+'\r\nDTSTART;VALUE=DATE:'+e[1]+'\r\nSUMMARY:'+e[2]+'\r\nEND:VEVENT\r\n').join('')+'END:VCALENDAR\r\n';
      const all=()=>Object.keys(S.tasks).flatMap(k=>S.tasks[k].items.filter(i=>i.cal).map(i=>k.replace(/-/g,'')+'|'+i.text));
      applyCalendar(parseIcs(ics([['a',d(1),'Dentist\\, 3pm'],['b',d(2),'Long summary that is\r\n  folded'],['old',d(-400),'Too old']])));
      const r1=all().sort();
      applyCalendar(parseIcs(ics([['a',d(3),'Dentist moved']])));
      const r2=all();
      // a deleted (hidden) calendar event stays hidden after a resync
      const kk=Object.keys(S.tasks).find(k=>S.tasks[k].items.some(i=>i.cal==='a'));S.tasks[kk].items.find(i=>i.cal==='a').hidden=true;
      applyCalendar(parseIcs(ics([['a',d(3),'Dentist moved']])));
      const hiddenKept=S.tasks[kk].items.some(i=>i.cal==='a'&&i.hidden);
      // a calendar task the user moved keeps its new day on the next sync
      applyCalendar(parseIcs(ics([['m',d(4),'Movable']])));const mk=Object.keys(S.tasks).find(k=>S.tasks[k].items.some(i=>i.cal==='m'));const mi=S.tasks[mk].items.find(i=>i.cal==='m');
      S.tasks[mk].items=S.tasks[mk].items.filter(i=>i!==mi);mi.pin=true;(S.tasks['2099-01-01']={items:[mi],mind:null});
      applyCalendar(parseIcs(ics([['m',d(4),'Movable renamed']])));const pinKept=S.tasks['2099-01-01'].items.some(i=>i.cal==='m'&&i.text==='Movable renamed');
      const out=tasksToIcs();
      return {r1,r2,exp:[d(1)+'|Dentist, 3pm',d(2)+'|Long summary that is folded'].sort(),moved:[d(3)+'|Dentist moved'],
        hiddenKept,pinKept,icsOk:out.includes('BEGIN:VEVENT')&&!out.includes('Dentist')&&out.includes('Test task edited')};
    })()""")
    check('calendar import adds, folds, unescapes and skips old events', cal['r1'] == cal['exp'])
    check('calendar resync moves changed events and removes deleted ones', cal['r2'] == cal['moved'])
    check('tasks export to .ics without calendar-imported events', cal['icsOk'])
    check('deleted calendar event stays hidden after resync', cal['hiddenKept'])
    check('moved calendar task stays on its new day after resync', cal['pinKept'])
    await pg.evaluate("""localStorage.setItem('daybook-v2',JSON.stringify({habits:[{id:'x\\"><img src=x onerror=window.pwn=1>',name:'H',type:'daily',color:'red\\"><img src=x onerror=window.pwn=1>'},{id:'u',name:'U',type:'daily',color:'#3b82f6',track:'amount',unit:'\\"><img src=x onerror=window.pwn=1>'}],log:{},tasks:{},goals:[{id:'g',title:'G',area:'Health',pct:'<img src=x onerror=window.pwn=1>'}],amt:{},journal:{}}))""")
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
    await pg.evaluate("""localStorage.setItem('daybook-v2',JSON.stringify({habits:[],log:{},tasks:{},goals:[{id:'g',title:'Keep me',area:'Health',pct:40}],journal:{},quits:[{id:'q',name:'Smoking',since:'2025-01-01T08:00',best:0}]}))"""); await pg.reload(); await pg.wait_for_timeout(150)
    await pg.click('[data-act=gear]'); await pg.click('#menu [data-act=demo]'); await pg.wait_for_timeout(100)
    check('demo asks first when only goals/streaks exist', 'Keep me' in await pg.evaluate("localStorage.getItem('daybook-v2')") and 'Tap again' in await pg.locator('#menu [data-act=demo]').inner_text())
    await pg.keyboard.press('Escape'); await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(150)
    await pg.click('[data-act=gdel]'); one = await pg.locator('.goal').count(); await pg.click('[data-act=gdel]')
    check('goal delete needs two taps', one == 1 and await pg.locator('.goal').count() == 0)
    # --- features: targets, undo, reorder, notes, review, heatmap, toggles ---
    await pg.evaluate("location.hash='today'"); await pg.evaluate("localStorage.setItem('daybook-v2','{}');localStorage.removeItem('daybook-prefs')"); await pg.reload(); await pg.wait_for_timeout(150)
    await pg.evaluate("location.hash='habits'"); await pg.wait_for_timeout(100)
    for nm, tg in [('Water', '3'), ('Read', '1')]:
        await pg.click('[data-act=newhabit] >> nth=0'); await pg.fill('#mName', nm)
        if tg != '1': await pg.click('[data-act=mtrack][data-v=count]'); await pg.fill('#mTarget', tg)
        await pg.click('[data-act=msave]')
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(100)
    water = pg.locator('.trow', has_text='Water').locator('.cell')
    await water.click(); await water.click()
    two = await water.inner_text(); on2 = 'on' in (await water.get_attribute('class')).split()
    await water.click(); on3 = 'on' in (await water.get_attribute('class')).split(); await water.click(); off4 = 'on' not in (await water.get_attribute('class')).split()
    check('habit target counts taps, completes at target, then resets', two.strip() == '2' and not on2 and on3 and off4)
    await pg.locator('.trow', has_text='Read').locator('[data-act=note]').click(); await pg.fill('#nText', 'Chapter 3'); await pg.click('[data-act=nsave]'); await pg.reload(); await pg.wait_for_timeout(150)
    check('habit note saves and shows on Today', 'Chapter 3' in await pg.locator('.trow', has_text='Read').inner_text())
    await pg.evaluate("location.hash='habits'"); await pg.wait_for_timeout(150)
    gb = await pg.locator('.hrow', has_text='Read').locator('.grip').bounding_box(); tb = await pg.locator('.hrow').first.bounding_box()
    await pg.mouse.move(gb['x'] + 6, gb['y'] + 10); await pg.mouse.down()
    await pg.mouse.move(gb['x'] + 6, tb['y'] + 8, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(100)
    first = lambda: pg.locator('.hrow .gname .nb').first.inner_text()
    check('drag a habit to the top', (await first()).strip().lower() == 'read')
    await pg.locator('.hrow', has_text='Read').locator('.grip').focus(); await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(100)
    check('arrow key on the grip moves a habit down', (await first()).strip().lower() == 'water')
    await pg.click('.gname .nb >> text=Water'); await pg.click('[data-act=mdel]'); await pg.click('[data-act=mdel]'); gone = await pg.locator('.hrow').count()
    await pg.click('#toast [data-act=undo]'); await pg.wait_for_timeout(100)
    check('undo restores a deleted habit', gone == 1 and await pg.locator('.hrow').count() == 2)
    await pg.evaluate("location.hash='insights'"); await pg.wait_for_timeout(150)
    check('insights shows weekly review and heatmap', await pg.locator('.review').count() == 1 and await pg.locator('.hgrid .hcol').count() == 26)
    await pg.click('[data-act=gear]'); folded = await pg.locator('#menu [data-act=feat]').count() == 0
    await pg.click('[data-act=featfold]'); await pg.click('[data-act=feat][data-v=heatmap]'); await pg.click('[data-act=feat][data-v=ach]')
    check('Features section starts collapsed', folded)
    check('feature toggles hide the heatmap and the Achievements tab', await pg.locator('.heat').count() == 0 and await pg.locator('#nav a[href="#achievements"]').count() == 0)
    await pg.evaluate("localStorage.removeItem('daybook-prefs')")
    # --- drag to rearrange: tasks between days, Today cards, goals; switch off hides grips ---
    await pg.evaluate("""(()=>{const p=n=>String(n).padStart(2,'0'),k=d=>d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()),s=new Date();s.setDate(s.getDate()-s.getDay());const m=new Date(s);m.setDate(s.getDate()+1);
      localStorage.setItem('daybook-v2',JSON.stringify({habits:[{id:'h1',name:'Walk',type:'daily',color:'#3b82f6'}],log:{},journal:{},quits:[],
        goals:[{id:'g1',title:'First goal',area:'Health',pct:10},{id:'g2',title:'Second goal',area:'Money',pct:20}],
        tasks:{[k(s)]:{items:[{id:'t1',text:'Move me',done:false},{id:'t2',text:'Stay',done:false}],mind:null}}}));localStorage.removeItem('daybook-prefs');window.__mon=k(m)})()""")
    await pg.evaluate("location.hash='tasks'"); await pg.reload(); await pg.wait_for_timeout(200)
    mon = await pg.evaluate("window.__mon") or await pg.evaluate("""(()=>{const p=n=>String(n).padStart(2,'0'),s=new Date();s.setDate(s.getDate()-s.getDay()+1);return s.getFullYear()+'-'+p(s.getMonth()+1)+'-'+p(s.getDate())})()""")
    gb = await pg.locator('.tk', has_text='Move me').locator('.grip').bounding_box(); tb = await pg.locator(f'.tlist[data-k="{mon}"]').bounding_box()
    await pg.mouse.move(gb['x'] + 5, gb['y'] + 8); await pg.mouse.down(); await pg.mouse.move(tb['x'] + 30, tb['y'] + 4, steps=10); await pg.mouse.up(); await pg.wait_for_timeout(150)
    moved = await pg.evaluate(f"JSON.parse(localStorage.getItem('daybook-v2')).tasks['{mon}'].items.map(i=>i.text)")
    check('drag a task to another day', moved == ['Move me'])
    await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(150)
    await pg.locator('.goal', has_text='Second goal').locator('.grip').focus(); await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(100)
    check('move a goal card with the arrow keys', 'Second goal' in await pg.locator('.goal').first.inner_text())
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(150)
    gb = await pg.locator('#main > [data-id="daily"] > .grip').bounding_box(); tb = await pg.locator('#main > [data-id="thero"]').bounding_box()
    await pg.mouse.move(gb['x'] + 10, gb['y'] + 6); await pg.mouse.down(); await pg.mouse.move(tb['x'] + 300, tb['y'] + 10, steps=10); await pg.mouse.up(); await pg.wait_for_timeout(150)
    await pg.reload(); await pg.wait_for_timeout(200)
    check('Today card order is remembered', await pg.locator('#main > [data-drag="cards"]').first.get_attribute('data-id') == 'daily')
    await pg.click('[data-act=gear]'); await pg.click('[data-act=featfold]'); await pg.click('[data-act=feat][data-v=drag]')
    check('drag switch off hides every grip', await pg.locator('#main .grip').count() == 0)
    await pg.evaluate("localStorage.removeItem('daybook-prefs')")
    # --- category change, days per week, repeating tasks, search, CSV, focus timer, PIN lock ---
    await pg.evaluate("location.hash='habits'"); await pg.evaluate("""localStorage.setItem('daybook-v2',JSON.stringify({habits:[{id:'h1',name:'Swim',type:'daily',color:'#3b82f6'}],log:{},goals:[],journal:{},quits:[],
      tasks:{[(d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date())]:{items:[{id:'t1',text:'Write report',done:false},{id:'t2',text:'Call bank',done:false}],mind:null}}}));localStorage.removeItem('daybook-prefs')"""); await pg.reload(); await pg.wait_for_timeout(150)
    await pg.click('.gname .nb >> text=Swim'); await pg.click('[data-act=mtype][data-v=weekly]'); await pg.click('[data-act=msave]')
    check('edit a habit from daily to weekly', await pg.evaluate("JSON.parse(localStorage.getItem('daybook-v2')).habits[0].type") == 'weekly' and await pg.locator('.wrow', has_text='Swim').count() == 1)
    await pg.click('.gname .nb >> text=Swim'); await pg.click('[data-act=mtype][data-v=daily]'); await pg.fill('#mPer', '3'); await pg.click('[data-act=msave]')
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(150)
    await pg.locator('.trow', has_text='Swim').locator('.cell').click()
    check('days-per-week habit shows weekly progress', '1/3 this week' in await pg.locator('.trow', has_text='Swim').inner_text())
    await pg.evaluate("location.hash='tasks'"); await pg.wait_for_timeout(150)
    # repeating task: weekly on this weekday until the end of the year, then delete one and the later repeats
    k0 = await pg.evaluate("(()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())})()")
    await pg.click(f'[data-act=tadd][data-k="{k0}"]'); await pg.fill('#taskInput', 'Weekly review'); await pg.select_option('#tRep', 'w')
    until_shown = await pg.locator('#tUntil').is_visible(); await pg.select_option('#tUntil', 'y'); await pg.locator('#taskInput').press('Enter'); await pg.wait_for_timeout(100)
    reps = await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('daybook-v2'));return Object.entries(d.tasks).filter(([k,t])=>t.items.some(i=>i.text==='Weekly review')).map(([k])=>k).sort()})()")
    want = await pg.evaluate(f"(()=>{{const o=[],d=new Date('{k0}T00:00'),y=d.getFullYear(),p=n=>String(n).padStart(2,'0');for(;d.getFullYear()===y;d.setDate(d.getDate()+7))o.push(d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()));return o}})()")
    # amount habit: log km, reach the goal
    await pg.evaluate("location.hash='habits'"); await pg.wait_for_timeout(100)
    await pg.click('[data-act=newhabit] >> nth=0'); await pg.fill('#mName', 'Run'); await pg.click('[data-act=mtrack][data-v=amount]')
    await pg.fill('#mUnit', 'km'); await pg.fill('#mGoal', '5'); await pg.click('[data-act=msave]')
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(100)
    run = pg.locator('.trow', has_text='Run')
    await run.locator('.cell').click(); await pg.fill('#aVal', '3.5'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(100)
    part = await run.locator('.cell').inner_text(); part_on = 'on' in (await run.locator('.cell').get_attribute('class')).split()
    await run.locator('.cell').click(); await pg.click('[data-act=amtstep][data-v="1"]'); await pg.click('[data-act=amtstep][data-v="1"]'); await pg.click('[data-act=amtsave]'); await pg.wait_for_timeout(100)
    meta = await run.inner_text(); done = 'on' in (await run.locator('.cell').get_attribute('class')).split()
    saved = await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('daybook-v2'));const h=d.habits.find(x=>x.name==='Run');return [h.track,h.unit,h.goal,Object.values(d.amt[h.id])[0]]})()")
    check('amount habit logs km and completes at its goal', part.strip() == '3.5' and not part_on and done and '5.5 / 5 km today' in meta and saved == ['amount', 'km', 5, 5.5])
    await pg.evaluate("location.hash='tasks'"); await pg.wait_for_timeout(100)
    check('repeating task lands on every matching day', until_shown and reps == want)
    await pg.locator('.tk', has_text='Weekly review').first.locator('[data-act=tdel]').click(); await pg.click('#toast [data-act=tdelrep]'); await pg.wait_for_timeout(100)
    left = await pg.evaluate("Object.values(JSON.parse(localStorage.getItem('daybook-v2')).tasks).flatMap(t=>t.items).filter(i=>i.text==='Weekly review').length")
    check('delete one repeat and the later ones', left == 0)
    await pg.click('[data-act=search]'); await pg.fill('#sq', 'bank')
    hits = await pg.locator('.shit').count(); await pg.locator('.shit').first.click(); await pg.wait_for_timeout(150)
    check('search finds a task and opens the Tasks tab', hits >= 1 and pg.url.endswith('#tasks') and await pg.locator('#modal .mod').count() == 0)
    async with pg.expect_download() as dl:
        await pg.click('[data-act=gear]'); await pg.click('[data-act=csv]')
    csv = open(await (await dl.value).path(), encoding='utf-8-sig').read()
    check('CSV export has habits and tasks', csv.startswith('Type,Date,Item') and 'Call bank' in csv and 'Swim' in csv)
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(150)
    await pg.click('[data-act=focusnew]'); await pg.select_option('#fTask', 't1'); await pg.click('[data-act=fstart]'); await pg.wait_for_timeout(1200)
    bar = await pg.locator('#focusbar').inner_text(); await pg.click('#focusbar [data-act=fstop]'); await pg.wait_for_timeout(100)
    check('focus timer runs for a task and stops', '24:5' in bar and 'Write report' in bar and await pg.locator('#focusbar').is_hidden())
    await pg.click('[data-act=gear]'); await pg.click('[data-act=pinset]'); await pg.fill('#pin1', '2468'); await pg.fill('#pin2', '2468'); await pg.click('[data-act=pinsave]'); await pg.wait_for_timeout(200)
    await pg.reload(); await pg.wait_for_timeout(200)
    hidden = await pg.locator('#main').inner_text() == '' and await pg.locator('#lock').is_visible()
    await pg.fill('#pinIn', '1111'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200); wrong = await pg.locator('#lock').is_visible()
    await pg.fill('#pinIn', '2468'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
    check('PIN lock hides data and only the right PIN opens it', hidden and wrong and await pg.locator('#lock').is_hidden() and await pg.locator('.trow').count() > 0)
    await pg.evaluate("localStorage.removeItem('daybook-prefs')"); await pg.reload()
    fresh = await b.new_context(); fp = await fresh.new_page(); await fp.goto(URL); await fp.wait_for_timeout(200)
    first = await fp.locator('.mod.tips').count() == 1; await fp.click('[data-act=tipsok]'); await fp.reload(); await fp.wait_for_timeout(150)
    check('tips show on first open only', first and await fp.locator('.mod.tips').count() == 0); await fresh.close()
    check('no JS errors (desktop)', not errs, errs)
    await ctx.close()

async def mobile(b):
    ctx = await b.new_context(viewport={'width': 390, 'height': 800}, has_touch=True, is_mobile=True)
    await ctx.add_init_script("localStorage.getItem('daybook-tips')||localStorage.setItem('daybook-tips','1')")
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
    # real touch events: press and hold a habit row, then drag it to the top (no grip needed)
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(200)
    rows = pg.locator('[data-drop=habits-daily] > .trow'); await rows.nth(2).evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(100)
    nm = lambda i: rows.nth(i).locator('.nm').evaluate('e=>e.firstChild.textContent')
    want = await nm(2); a = await rows.nth(2).locator('.nm').bounding_box(); t = await rows.nth(0).locator('.nm').bounding_box()
    cdp = await ctx.new_cdp_session(pg); x, y = a['x'] + 20, a['y'] + a['height'] / 2
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]}); await pg.wait_for_timeout(600)
    for i in range(1, 9):
        await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y + (t['y'] - 6 - y) * i / 8}]})
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await pg.wait_for_timeout(200)
    check('touch: press and hold, then drag a habit to the top', await nm(0) == want)
    check('no JS errors (mobile)', not errs, errs)
    await ctx.close()

def syntax_check():
    import shutil, re as _re, tempfile, os as _os
    node = shutil.which('node')
    if not node: return
    html = open(os.path.join(os.path.dirname(__file__), '..', 'www', 'index.html'), encoding='utf-8').read()
    js = max(_re.findall(r'<script>(.*?)</script>', html, _re.S), key=len)
    f = tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8'); f.write(js); f.close()
    r = subprocess.run([node, '--check', f.name], capture_output=True, text=True); _os.unlink(f.name)
    check('app script has no syntax errors', r.returncode == 0, (r.stderr or '')[:300])
    if r.returncode: raise SystemExit(1)

async def main():
    syntax_check()
    srv = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await desktop(b); await mobile(b)
        await b.close()
    srv.shutdown()
    print(f"\n{len(failures)} failure(s)" if failures else "\nAll checks passed")
    raise SystemExit(1 if failures else 0)

asyncio.run(main())
