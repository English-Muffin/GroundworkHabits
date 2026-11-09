"""Smoke tests for Groundwork Habits. Run from the project root:  python tests/smoke.py
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
    await ctx.add_init_script("localStorage.getItem('groundwork-tips')||localStorage.setItem('groundwork-tips','1')")
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(300)
    check('first run is empty with demo option', await pg.locator('.empty [data-act=demo]').count() == 1)
    await pg.click('[data-act=newhabit] >> nth=0'); await pg.fill('#mName', 'Drink water'); await pg.keyboard.press('Enter')
    check('add habit', await pg.locator('.gname .nb', has_text='Drink water').count() == 1)
    await pg.click('.gname .nb'); await pg.fill('#mName', 'Drink 2L water'); await pg.click('[data-act=msave]')
    check('rename habit via edit modal', await pg.locator('.gname .nb', has_text='Drink 2L water').count() == 1)
    await pg.click('.gname .nb'); await pg.click('#modal .cmore'); await pg.fill('[data-cf=habit][data-k=hex]', '#125cf6'); await pg.click('[data-act=msave]'); await pg.reload()
    check('custom habit colour from the in-app picker saves', await pg.evaluate("JSON.parse(localStorage.getItem('groundwork-v2')).habits[0].color") == '#125cf6')
    await pg.click('.gname .nb'); await pg.click('#modal .cmore'); await pg.keyboard.press('Escape'); await pg.click('.gname .nb'); await pg.wait_for_timeout(100)
    check('the colour sliders start closed when a dialog opens again', await pg.locator('#modal .cpp').count() == 0); await pg.keyboard.press('Escape')
    await pg.locator('.cell:not([disabled])').first.click(); await pg.reload(); await pg.wait_for_timeout(200)
    check('check-in persists after reload', await pg.locator('.cell.on').count() == 1)
    check('saved data has version field', await pg.evaluate("JSON.parse(localStorage.getItem('groundwork-v2')).v") == 1)
    await pg.click('.gname .nb'); await pg.click('[data-act=mdel]'); await pg.click('[data-act=mdel]')
    check('two-step delete', await pg.locator('.gname .nb').count() == 0)
    await pg.click('.empty [data-act=demo]'); await pg.wait_for_timeout(150)
    check('demo data loads', await pg.locator('.hrow').count() == 9)
    await pg.click('#gearBtn'); await pg.click('#main [data-act=demo]')
    check('demo asks before replacing data', 'Tap again' in await pg.locator('#main [data-act=demo]').inner_text())
    await pg.keyboard.press('Escape'); await pg.click('#gearBtn')
    async with pg.expect_download() as dl: await pg.click('#main [data-act=export]')
    path = OUT / 'groundwork-backup.json'; await (await dl.value).save_as(str(path))
    check('export backup', len(json.loads(path.read_text())['habits']) == 15)
    await pg.click('#gearBtn'); await pg.click('#main [data-act=fresh]'); await pg.click('#main [data-act=fresh]')
    check('start fresh', await pg.locator('.hrow').count() == 0)
    await pg.click('#gearBtn')
    async with pg.expect_file_chooser() as fc: await pg.click('#main [data-act=import]')
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
    await pg.locator('.goal2 h3 .nb').first.click(); await pg.fill('#gTitle', ''); await pg.click('[data-act=gsave]')
    t0 = 'kept' if await pg.locator('#modal .mgoal').count() == 1 else ''
    await pg.fill('#gTitle', 'Renamed goal'); await pg.click('[data-act=gsave]')
    await pg.reload(); await pg.wait_for_timeout(200)
    check('empty goal title is restored, edit persists', bool(t0.strip()) and await pg.locator('.goal2 h3').first.inner_text() == 'Renamed goal')
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
    await pg.click('[data-act=gear]'); await pg.click('[data-act=cset][data-f=accent][data-v="#f472b6"]'); await pg.click('[data-act=ptheme][data-v=light]')
    await pg.reload(); await pg.wait_for_timeout(200)
    check('customize accent and theme persist', await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()") == '#f472b6' and await pg.evaluate("document.documentElement.classList.contains('light')"))
    await pg.click('[data-act=gear]'); await pg.click('#main .cmore'); await pg.fill('[data-cf=accent][data-k=hex]', '#ff8800')
    hsl = [await pg.input_value(f'[data-cf=accent][data-k={k}]') for k in 'hsl']
    await pg.fill('[data-cf=accent][data-k=l]', '25')
    check('accent hex and hue/saturation/lightness sliders sync', hsl == ['32', '100', '50'] and await pg.input_value('[data-cf=accent][data-k=hex]') == '#804400' and await pg.evaluate("JSON.parse(localStorage.getItem('groundwork-prefs')).accent") == '#804400', hsl)
    await pg.fill('[data-cf=accent][data-k=h]', '210'); await pg.fill('[data-cf=accent][data-k=s]', '80'); await pg.fill('[data-cf=accent][data-k=l]', '0'); await pg.fill('[data-cf=accent][data-k=l]', '100')
    hs = [await pg.input_value(f'[data-cf=accent][data-k={k}]') for k in 'hs']; await pg.fill('[data-cf=accent][data-k=l]', '50')
    check('lightness at black or white keeps hue and saturation where they were', hs == ['210', '80'] and await pg.input_value('[data-cf=accent][data-k=hex]') == '#1980e6', [hs, await pg.input_value('[data-cf=accent][data-k=hex]')])
    await pg.click('[data-act=tabnames]'); await pg.wait_for_timeout(100)
    check('tab names can be hidden (icons only) and the choice is saved', await pg.evaluate("document.documentElement.classList.contains('notabnames')") and await pg.evaluate("JSON.parse(localStorage.getItem('groundwork-prefs')).tabNames") is False)
    await pg.click('[data-act=tabnames]'); await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(200)
    await pg.click('[data-act=areanew]'); await pg.fill('#arName', 'Faith'); await pg.click('#modal .cmore'); await pg.fill('[data-cf=area][data-k=hex]', '#0ea5e9'); await pg.click('[data-act=areasave]'); await pg.wait_for_timeout(100)
    check('a new life area can take a custom colour from the picker (name kept while picking)', {'name': 'Faith', 'color': '#0ea5e9'} in (await pg.evaluate("JSON.parse(localStorage.getItem('groundwork-v2')).areas") or []))
    await pg.evaluate("location.hash='settings/appearance'"); await pg.wait_for_timeout(200)
    await pg.click('[data-act=ptheme][data-v=amoled]'); await pg.reload(); await pg.wait_for_timeout(150)
    check('AMOLED theme is pure black and persists', await pg.evaluate("document.documentElement.classList.contains('amoled')&&getComputedStyle(document.body).backgroundColor==='rgb(0, 0, 0)'&&getComputedStyle(document.querySelector('.card,.gcard,.sum,.sgrp')).backgroundColor==='rgb(0, 0, 0)'"))
    await pg.evaluate("localStorage.removeItem('groundwork-prefs')"); await pg.reload()
    cal = await pg.evaluate(r"""(()=>{
      const T=window.GroundworkTest,S=T.state(),applyCalendar=T.applyCalendar,parseIcs=T.parseIcs,tasksToIcs=T.tasksToIcs;
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
    await pg.evaluate("""localStorage.setItem('groundwork-v2',JSON.stringify({habits:[{id:'x\\"><img src=x onerror=window.pwn=1>',name:'H',type:'daily',color:'red\\"><img src=x onerror=window.pwn=1>'},{id:'u',name:'U',type:'daily',color:'#3b82f6',track:'amount',unit:'\\"><img src=x onerror=window.pwn=1>'}],log:{},tasks:{},goals:[{id:'g',title:'G',area:'Health',pct:'<img src=x onerror=window.pwn=1>'}],amt:{},journal:{}}))""")
    await pg.reload(); await pg.wait_for_timeout(200); await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(200)
    check('malicious saved data is sanitised', not await pg.evaluate('window.pwn') and await pg.locator('.goal2 .g2b b').first.inner_text() == '0%')
    await pg.evaluate("localStorage.removeItem('groundwork-v2')")
    await pg.evaluate("location.hash='achievements'"); await pg.wait_for_timeout(150)
    await pg.click('[data-act=newquit] >> nth=0'); await pg.fill('#qName', 'Smoking')
    await pg.fill('#qSince', await pg.evaluate("(()=>{const d=new Date(Date.now()-10*864e5-2*36e5);const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())})()"))
    await pg.click('[data-act=qsave]'); await pg.reload(); await pg.wait_for_timeout(200)
    check('quit streak counts days since and persists', (await pg.locator('.ach .pc').first.inner_text()).startswith('10') and await pg.locator('.miles span').count() == 3)
    await pg.click('[data-act=editquit]'); await pg.click('[data-act=qreset]'); await pg.click('[data-act=qreset]')
    check('restart keeps best streak', (await pg.locator('.ach .pc').first.inner_text()).startswith('0') and 'Best: 10' in await pg.locator('.ach').first.inner_text())
    await pg.evaluate("""localStorage.setItem('groundwork-v2',JSON.stringify({habits:[],log:{},tasks:{},goals:[{id:'g',title:'Keep me',area:'Health',pct:40}],journal:{},quits:[{id:'q',name:'Smoking',since:'2025-01-01T08:00',best:0}]}))"""); await pg.reload(); await pg.wait_for_timeout(150)
    await pg.click('[data-act=gear]'); await pg.click('#main [data-act=demo]'); await pg.wait_for_timeout(100)
    check('demo asks first when only goals/streaks exist', 'Keep me' in await pg.evaluate("localStorage.getItem('groundwork-v2')") and 'Tap again' in await pg.locator('#main [data-act=demo]').inner_text())
    await pg.keyboard.press('Escape'); await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(150)
    await pg.locator('.goal2 h3 .nb').first.click(); await pg.click('[data-act=gdel]'); one = await pg.locator('.goal2').count(); await pg.click('[data-act=gdel]')
    check('goal delete needs two taps', one == 1 and await pg.locator('.goal2').count() == 0)
    # --- features: targets, undo, reorder, notes, review, heatmap, toggles ---
    await pg.evaluate("location.hash='today'"); await pg.evaluate("localStorage.setItem('groundwork-v2','{}');localStorage.removeItem('groundwork-prefs')"); await pg.reload(); await pg.wait_for_timeout(150)
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
    check('insights shows weekly review and heatmap', await pg.locator('.review').count() == 1 and await pg.locator('.hgrid .hcol').count() == 53)
    await pg.click('[data-act=gear]'); sw = await pg.locator('#main [data-act=feat][data-v=heatmap]').get_attribute('role')
    noach = await pg.locator('[data-act=feat][data-v=ach]').count(); await pg.click('[data-act=feat][data-v=heatmap]')
    await pg.evaluate("location.hash='insights'"); await pg.wait_for_timeout(200)
    check('feature switches are real switches (role=switch)', sw == 'switch')
    check('the heatmap can be switched off; the Streaks tab has no switch and always shows', noach == 0 and await pg.locator('.heat').count() == 0 and await pg.locator('#nav a[href="#achievements"]').count() == 1)
    await pg.evaluate("localStorage.removeItem('groundwork-prefs')")
    # --- drag to rearrange: tasks between days, Today cards, goals; switch off hides grips ---
    await pg.evaluate("""(()=>{const p=n=>String(n).padStart(2,'0'),k=d=>d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()),s=new Date();s.setDate(s.getDate()-s.getDay());const m=new Date(s);m.setDate(s.getDate()+1);
      localStorage.setItem('groundwork-v2',JSON.stringify({habits:[{id:'h1',name:'Walk',type:'daily',color:'#3b82f6'}],log:{},journal:{},quits:[],
        goals:[{id:'g1',title:'First goal',area:'Health',pct:10},{id:'g2',title:'Second goal',area:'Money',pct:20}],
        tasks:{[k(s)]:{items:[{id:'t1',text:'Move me',done:false},{id:'t2',text:'Stay',done:false}],mind:null}}}));localStorage.removeItem('groundwork-prefs');window.__mon=k(m)})()""")
    await pg.evaluate("location.hash='tasks'"); await pg.reload(); await pg.wait_for_timeout(200)
    mon = await pg.evaluate("window.__mon") or await pg.evaluate("""(()=>{const p=n=>String(n).padStart(2,'0'),s=new Date();s.setDate(s.getDate()-s.getDay()+1);return s.getFullYear()+'-'+p(s.getMonth()+1)+'-'+p(s.getDate())})()""")
    gb = await pg.locator('.tk', has_text='Move me').locator('.grip').bounding_box(); tb = await pg.locator(f'.tlist[data-k="{mon}"]').bounding_box()
    await pg.mouse.move(gb['x'] + 5, gb['y'] + 8); await pg.mouse.down(); await pg.mouse.move(tb['x'] + 30, tb['y'] + 4, steps=10); await pg.mouse.up(); await pg.wait_for_timeout(150)
    moved = await pg.evaluate(f"JSON.parse(localStorage.getItem('groundwork-v2')).tasks['{mon}'].items.map(i=>i.text)")
    check('drag a task to another day', moved == ['Move me'])
    await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(150)
    await pg.locator('.goal2', has_text='Second goal').locator('.grip').focus(); await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(100)
    check('move a goal card with the arrow keys', 'Second goal' in await pg.locator('.goal2').first.inner_text())
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(150)
    gb = await pg.locator('#main > [data-id="daily"] > .grip').bounding_box(); tb = await pg.locator('#main > [data-id="thero"]').bounding_box()
    await pg.mouse.move(gb['x'] + 10, gb['y'] + 6); await pg.mouse.down(); await pg.mouse.move(tb['x'] + 300, tb['y'] + 10, steps=10); await pg.mouse.up(); await pg.wait_for_timeout(150)
    await pg.reload(); await pg.wait_for_timeout(200)
    check('Today card order is remembered', await pg.locator('#main > [data-drag="cards"]').first.get_attribute('data-id') == 'daily')
    await pg.click('[data-act=gear]'); await pg.click('[data-act=feat][data-v=drag]'); await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(150)
    check('drag switch off hides every grip', await pg.locator('#main .grip').count() == 0)
    await pg.evaluate("localStorage.removeItem('groundwork-prefs')")
    # --- category change, days per week, repeating tasks, search, CSV, focus timer, PIN lock ---
    await pg.evaluate("location.hash='habits'"); await pg.evaluate("""localStorage.setItem('groundwork-v2',JSON.stringify({habits:[{id:'h1',name:'Swim',type:'daily',color:'#3b82f6'}],log:{},goals:[],journal:{},quits:[],
      tasks:{[(d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date())]:{items:[{id:'t1',text:'Write report',done:false},{id:'t2',text:'Call bank',done:false}],mind:null}}}));localStorage.removeItem('groundwork-prefs')"""); await pg.reload(); await pg.wait_for_timeout(150)
    await pg.click('.gname .nb >> text=Swim'); await pg.click('[data-act=mtype][data-v=weekly]'); await pg.click('[data-act=msave]')
    check('edit a habit from daily to weekly', await pg.evaluate("JSON.parse(localStorage.getItem('groundwork-v2')).habits[0].type") == 'weekly' and await pg.locator('.wrow', has_text='Swim').count() == 1)
    await pg.click('.gname .nb >> text=Swim'); await pg.click('[data-act=mtype][data-v=daily]'); await pg.fill('#mPer', '3'); await pg.click('[data-act=msave]')
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(150)
    await pg.locator('.trow', has_text='Swim').locator('.cell').click()
    check('days-per-week habit shows weekly progress', '1/3 this week' in await pg.locator('.trow', has_text='Swim').inner_text())
    await pg.evaluate("location.hash='tasks'"); await pg.wait_for_timeout(150)
    # repeating task: weekly on this weekday until the end of the year, then delete one and the later repeats
    k0 = await pg.evaluate("(()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())})()")
    await pg.click(f'[data-act=tadd][data-k="{k0}"]'); await pg.fill('#taskInput', 'Weekly review')
    await pg.click('[data-act=repmenu][data-v=rep]'); await pg.click('[data-act=reppick][data-m=rep][data-v=w]')
    typed_kept = await pg.input_value('#taskInput') == 'Weekly review'
    until_shown = await pg.locator('[data-act=repmenu][data-v=until]').is_visible()
    await pg.click('[data-act=repmenu][data-v=until]'); await pg.click('[data-act=reppick][data-m=until][data-v=y]'); await pg.locator('#taskInput').press('Enter'); await pg.wait_for_timeout(100)
    until_shown = until_shown and typed_kept
    reps = await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('groundwork-v2'));return Object.entries(d.tasks).filter(([k,t])=>t.items.some(i=>i.text==='Weekly review')).map(([k])=>k).sort()})()")
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
    saved = await pg.evaluate("(()=>{const d=JSON.parse(localStorage.getItem('groundwork-v2'));const h=d.habits.find(x=>x.name==='Run');return [h.track,h.unit,h.goal,Object.values(d.amt[h.id])[0]]})()")
    check('amount habit logs km and completes at its goal', part.strip() == '3.5' and not part_on and done and '5.5 / 5 km today' in meta and saved == ['amount', 'km', 5, 5.5])
    await pg.evaluate("location.hash='tasks'"); await pg.wait_for_timeout(100)
    check('repeating task lands on every matching day', until_shown and reps == want)
    await pg.locator('.tk', has_text='Weekly review').first.locator('[data-act=tdel]').click(); await pg.click('#toast [data-act=tdelrep]'); await pg.wait_for_timeout(100)
    left = await pg.evaluate("Object.values(JSON.parse(localStorage.getItem('groundwork-v2')).tasks).flatMap(t=>t.items).filter(i=>i.text==='Weekly review').length")
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
    await pg.click('[data-act=gear]'); await pg.click('[data-act=pinset]'); await pg.fill('#pin1', '2468'); await pg.fill('#pin2', '2468'); await pg.click('[data-act=pinsave]'); await pg.wait_for_timeout(1500)
    raw = await pg.evaluate("localStorage.getItem('groundwork-v2')")
    check('with a PIN the saved data is encrypted (no readable names)', raw.startswith('enc1:') and 'Swim' not in raw and 'Write report' not in raw, raw[:60])
    async with pg.expect_download() as dl: await pg.click('[data-act=gear]'); await pg.click('#main [data-act=export]')
    encf = await (await dl.value).path(); enct = open(encf, encoding='utf-8').read()
    ctx2 = await b.new_context(); p2 = await ctx2.new_page(); await p2.goto(URL); await p2.wait_for_timeout(200)
    await p2.evaluate("localStorage.setItem('groundwork-tips','1')"); await p2.reload()
    await p2.click('[data-act=gear]'); await p2.set_input_files('#impFile', encf); await p2.wait_for_timeout(300)
    await p2.fill('#impPin', '1111'); await p2.click('[data-act=impok]'); await p2.wait_for_timeout(1500); wrongk = await p2.locator('#impPin').count()
    await p2.fill('#impPin', '2468'); await p2.click('[data-act=impok]'); await p2.wait_for_timeout(1500)
    check('with a PIN the exported backup is encrypted and imports only with that PIN', enct.startswith('enc1:') and 'Swim' not in enct and wrongk == 1 and await p2.evaluate("GroundworkTest.state().habits.some(h=>h.name==='Swim')"))
    await ctx2.close()
    await pg.evaluate("location.hash='today'"); await pg.reload(); await pg.wait_for_timeout(300)
    hidden = await pg.locator('#main').inner_text() == '' and await pg.locator('#lock').is_visible()
    await pg.fill('#pinIn', '1111'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500); wrong = await pg.locator('#lock').is_visible()
    await pg.fill('#pinIn', '2468'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
    check('PIN lock hides data and only the right PIN opens it', hidden and wrong and await pg.locator('#lock').is_hidden() and await pg.locator('.trow').count() > 0)
    await pg.locator('.trow').first.locator('.cell').click(); await pg.wait_for_timeout(800)
    await pg.reload(); await pg.wait_for_timeout(300); await pg.fill('#pinIn', '2468'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1500)
    check('changes made while unlocked are saved encrypted and come back', await pg.locator('.trow').count() > 0 and await pg.evaluate("GroundworkTest.state().habits.length") > 0)
    # a PIN set before encryption existed is upgraded on the next unlock
    await pg.evaluate("""(async()=>{const p=JSON.parse(localStorage.getItem('groundwork-prefs')),h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ab12:1357')))].map(x=>x.toString(16).padStart(2,'0')).join('');
      p.lock={salt:'ab12',hash:h};localStorage.setItem('groundwork-prefs',JSON.stringify(p));localStorage.setItem('groundwork-v2',JSON.stringify(GroundworkTest.state()))})()""")
    await pg.reload(); await pg.wait_for_timeout(300); await pg.fill('#pinIn', '1357'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1800)
    up = await pg.evaluate("[localStorage.getItem('groundwork-v2').slice(0,5),!!JSON.parse(localStorage.getItem('groundwork-prefs')).lock.enc,!JSON.parse(localStorage.getItem('groundwork-prefs')).lock.hash]")
    check('an old PIN is upgraded to encryption on unlock', up == ['enc1:', True, True] and await pg.locator('#lock').is_hidden(), up)
    await pg.click('[data-act=gear]'); await pg.click('[data-act=pinoff]'); await pg.click('[data-act=pinoff]'); await pg.wait_for_timeout(500)
    check('removing the PIN saves the data readable again', await pg.evaluate("localStorage.getItem('groundwork-v2').startsWith('{')"))
    await pg.evaluate("localStorage.removeItem('groundwork-prefs')"); await pg.reload()
    fresh = await b.new_context(); fp = await fresh.new_page(); await fp.goto(URL); await fp.wait_for_timeout(200)
    first = await fp.locator('.mod.tips').count() == 1; await fp.click('[data-act=tipsok]'); await fp.reload(); await fp.wait_for_timeout(150)
    check('tips show on first open only', first and await fp.locator('.mod.tips').count() == 0); await fresh.close()
    check('no JS errors (desktop)', not errs, errs)
    # data saved before the rename (old key names) is carried over on first start
    mig = await b.new_context(); mp = await mig.new_page()
    await mp.add_init_script("if(!sessionStorage.getItem('m')){sessionStorage.setItem('m','1');localStorage.setItem('daybook-v2',JSON.stringify({v:1,habits:[{id:'old1',name:'Old habit',type:'daily',color:'#9cc96b'}],log:{},tasks:{},goals:[]}));localStorage.setItem('daybook-tips','1')}")
    await mp.goto(URL); await mp.wait_for_timeout(300)
    check('rename: old saved data and prefs are migrated', await mp.evaluate("localStorage.getItem('groundwork-tips')==='1'&&window.GroundworkTest.state().habits.some(h=>h.name==='Old habit')"))
    await mig.close()
    await ctx.close()

async def bigwindow(b):
    ctx = await b.new_context(viewport={'width': 1920, 'height': 1080})
    await ctx.add_init_script("localStorage.setItem('groundwork-tips','1')")
    pg = await ctx.new_page(); await pg.goto(URL + '#tasks'); await pg.wait_for_timeout(300)
    w = await pg.evaluate("document.querySelector('.days').getBoundingClientRect().width")
    check('big window: the layout grows and scales with the window', w > 1500 and await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), w)
    await ctx.close()

async def recurring(b):
    ctx = await b.new_context(); pg = await ctx.new_page(); await pg.goto(URL); await pg.wait_for_timeout(200)
    r = await pg.evaluate("""(()=>{const P=GroundworkTest.parseIcs,f=d=>d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'),k=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      const t=new Date();t.setHours(0,0,0,0);const mon=new Date(t);mon.setDate(t.getDate()-((t.getDay()+6)%7)-14); // a Monday two weeks back
      const NL=String.fromCharCode(13,10),ev=(x)=>['BEGIN:VEVENT',...x,'END:VEVENT'].join(NL),cal=(...e)=>['BEGIN:VCALENDAR',...e,'END:VCALENDAR'].join(NL);
      const ex=new Date(mon);ex.setDate(mon.getDate()+7);const mv=new Date(mon);mv.setDate(mon.getDate()+9);const mvTo=new Date(mon);mvTo.setDate(mon.getDate()+10);
      const out=P(cal(ev(['UID:w','DTSTART;VALUE=DATE:'+f(mon),'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6','EXDATE;VALUE=DATE:'+f(ex),'SUMMARY:Gym'])
        ,ev(['UID:w','RECURRENCE-ID;VALUE=DATE:'+f(mv),'DTSTART;VALUE=DATE:'+f(mvTo),'SUMMARY:Gym moved'])
        ,ev(['UID:m','DTSTART:'+f(new Date(t.getFullYear(),t.getMonth(),1))+'T090000','RRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL='+f(new Date(t.getFullYear(),t.getMonth()+3,0)),'SUMMARY:Review'])));
      const gym=out.filter(e=>e.uid.startsWith('w_')).map(e=>e.day+'|'+e.text).sort(),rev=out.filter(e=>e.uid.startsWith('m_'));
      const want=[0,2,7,9,14,16].filter(x=>x!==7&&x!==9).map(x=>{const d=new Date(mon);d.setDate(mon.getDate()+x);return k(d)+'|Gym'});want.push(k(mvTo)+'|Gym moved');
      return [JSON.stringify(gym)===JSON.stringify(want.sort()),gym,want,rev.length>=2&&rev.every(e=>new Date(e.day+'T00:00').getDay()===5&&e.time==='09:00')]})()""")
    tz = await pg.evaluate("""(()=>{const NL=String.fromCharCode(13,10),P=GroundworkTest.parseIcs,t=new Date(),y=t.getFullYear(),m=String(t.getMonth()+1).padStart(2,'0'),d=String(t.getDate()).padStart(2,'0');
      const cal=x=>['BEGIN:VCALENDAR','BEGIN:VEVENT',...x,'END:VEVENT','END:VCALENDAR'].join(NL);
      const ny=P(cal(['UID:tz1','DTSTART;TZID=America/New_York:'+y+m+d+'T090000','SUMMARY:NY call']))[0],
        win=P(cal(['UID:tz2','DTSTART;TZID="W. Europe Standard Time":'+y+m+d+'T090000','SUMMARY:Berlin call']))[0];
      const want=(z)=>{const f=new Intl.DateTimeFormat('en-GB',{timeZone:z,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});for(let h=0;h<48;h++)for(const mi of [0,30]){const c=new Date(y,t.getMonth(),t.getDate(),0,0);c.setMinutes(h*60+mi-720);if(f.format(c)==='09:00'&&new Intl.DateTimeFormat('en-CA',{timeZone:z}).format(c)===y+'-'+m+'-'+d)return String(c.getHours()).padStart(2,'0')+':'+String(c.getMinutes()).padStart(2,'0')}};
      return [ny.time,want('America/New_York'),win.time,want('Europe/Berlin')]})()""")
    check('calendar times with a time zone (IANA and Windows names) convert to this device’s time', tz[0] == tz[1] and tz[2] == tz[3], tz)
    check('repeating calendar events expand (weekly days, count, skipped and moved dates, last Friday monthly)', r[0] and r[3], r)
    await ctx.close()

async def undoHistory(b):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
    await ctx.add_init_script("localStorage.setItem('groundwork-tips','1')")
    pg = await ctx.new_page(); await pg.goto(URL); await pg.wait_for_timeout(200)
    await pg.click('[data-act=gear]'); await pg.click('#main [data-act=demo]'); await pg.goto(URL + '#goals'); await pg.wait_for_timeout(300)
    names = lambda: pg.evaluate("GroundworkTest.state().goals.map(g=>g.title)")
    before = await names()
    for _ in range(2):
        await pg.locator('.goal2 h3 .nb').first.click(); await pg.click('#modal [data-act=gdel]'); await pg.click('#modal [data-act=gdel]'); await pg.wait_for_timeout(100)
    await pg.click('[data-act=newgoal]'); await pg.fill('#gTitle', 'Kept goal'); await pg.click('[data-act=gsave]')
    await pg.keyboard.press('Control+z'); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200)
    after = await names()
    check('undo history: two deletes come back in place and a later edit is kept', after == before + ['Kept goal'], [before, after])
    await ctx.close()

async def insightsBoxes(b):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 900})
    await ctx.add_init_script("localStorage.setItem('groundwork-tips','1')")
    pg = await ctx.new_page(); await pg.goto(URL); await pg.wait_for_timeout(200)
    await pg.click('[data-act=gear]'); await pg.click('#main [data-act=demo]'); await pg.goto(URL + '#insights'); await pg.wait_for_timeout(300)
    ids = lambda: pg.evaluate("[...document.querySelectorAll('#main>[data-drag=cards]')].map(e=>e.dataset.id)")
    before = await ids()
    await pg.locator('#main>[data-id=needs]>.grip').focus(); await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(200)
    after = await ids(); i = after.index('needs')
    await pg.reload(); await pg.wait_for_timeout(300); kept = await ids()
    check('Insights: each box drags on its own (move one stat box, order is kept)', all(x in before for x in ['thisweek','vsweek','beststreak','needs','leader','topstreaks','goalsum','taskweek']) and after[i+1] == 'beststreak' and kept == after, [before, after])
    await ctx.close()

async def goalsAndFreezes(b):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
    await ctx.add_init_script("localStorage.setItem('groundwork-tips','1')")
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL + '#goals'); await pg.wait_for_timeout(200)
    await pg.click('.empty [data-act=newgoal]'); await pg.fill('#gTitle', 'Run a half marathon'); await pg.select_option('#gArea', 'Fitness'); await pg.fill('#gDue', '2099-06-14')
    await pg.click('[data-act=gkind][data-v=steps]')
    for st in ['Run 5 km', 'Run 10 km', 'Run 16 km', 'Run 21 km']:
        await pg.fill('#gStep', st); await pg.keyboard.press('Enter')
    await pg.click('[data-act=gstep][data-i="0"]'); await pg.check('#gPin'); await pg.click('[data-act=gsave]'); await pg.wait_for_timeout(150)
    g = await pg.evaluate("GroundworkTest.state().goals[0]")
    card = await pg.locator('.goal2').first.inner_text()
    check('goal with steps, deadline and pin: progress follows the steps', g['pct'] == 25 and g['pin'] and g['due'] == '2099-06-14' and len(g['steps']) == 4 and 'Pinned'.upper() in (await pg.locator('.g2t').nth(1).inner_text()).upper() and '25%' in card and 'days to go' in card and 'Next step: Run 10 km' in card, [g, card])
    await pg.click('[data-act=newgoal]'); await pg.fill('#gTitle', 'Save money'); await pg.select_option('#gArea', 'Money'); await pg.click('[data-act=gsave]')
    await pg.click('[data-act=garea][data-v=Money]'); only = await pg.locator('.goal2').all_inner_texts()
    await pg.click('[data-act=garea][data-v=Money]'); both = await pg.locator('.goal2').count()
    check('tapping a life area shows only its goals', len(only) == 1 and 'Save money' in only[0] and both == 2)
    await pg.locator('.goal2', has_text='Run a half').locator('[data-act=gpin]').click()
    check('unpin from the card', not await pg.evaluate("!!GroundworkTest.state().goals.find(g=>g.title.startsWith('Run')).pin"))
    # freezes: 7 days done in a row, then a missed day, then done again: the streak carries on with a freeze used
    await pg.evaluate("""(()=>{const k=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
      const log={};for(let i=10;i>=3;i--)log[k(i)]=1;log[k(1)]=1;log[k(0)]=1; // day 2 missed
      const s=GroundworkTest.state();localStorage.setItem('groundwork-v2',JSON.stringify(Object.assign({},s,{habits:[{id:'hf',name:'Stretch',type:'daily',color:'#22d3be'}],log:{hf:log}})))})()""")
    await pg.goto(URL + '#today'); await pg.reload(); await pg.wait_for_timeout(300)
    row = await pg.locator('.trow', has_text='Stretch').inner_text()
    check('streak freeze: a missed day after 7 in a row keeps the streak (10 days, freeze used)', '10' in row and await pg.locator('.fzpill').count() == 0, row)
    # measurable goals: money added up, a from-to value, a habit count; custom areas
    await pg.goto(URL + '#goals'); await pg.wait_for_timeout(200)
    await pg.click('.g2sum [data-act=newgoal]'); await pg.select_option('#gArea', 'Money'); await pg.wait_for_timeout(100)
    await pg.locator('[data-act=gidea]', has_text='emergency').click(); await pg.fill('#gTarget', '10000'); await pg.click('[data-act=gsave]')
    card = pg.locator('.goal2', has_text='emergency fund')
    await card.locator('[data-act=gval]').click(); await pg.fill('#gvAmt', '6500'); await pg.click('[data-act=gvalsave]')
    await card.locator('[data-act=gval]').click(); await pg.fill('#gvAmt', '-500'); await pg.click('[data-act=gvalsave]')
    mtxt = await card.inner_text()
    check('money goal: amounts add up towards the target (€6,000 of €10,000, 60%)', '€6,000 of €10,000' in mtxt and '60%' in mtxt, mtxt)
    await pg.click('.g2sum [data-act=newgoal]'); await pg.fill('#gTitle', 'Weight'); await pg.click('[data-act=gkind][data-v=range]')
    await pg.fill('#gUnit', 'kg'); await pg.fill('#gStart', '85'); await pg.fill('#gTarget', '78'); await pg.click('[data-act=gsave]')
    wc = pg.locator('.goal2', has_text='Weight'); await wc.locator('[data-act=gval]').click(); await pg.fill('#gvAmt', '81.5'); await pg.click('[data-act=gvalsave]')
    check('from-to goal: 85 to 78 kg, now 81.5 is 50%', '50%' in await wc.inner_text() and '81.5 kg now' in await wc.inner_text())
    await pg.click('.g2sum [data-act=newgoal]'); await pg.fill('#gTitle', 'Stretch 20 times'); await pg.click('[data-act=gkind][data-v=habit]')
    await pg.fill('#gTarget', '20'); await pg.fill('#gSince', '2000-01-01'); await pg.click('[data-act=gsave]')
    hc = await pg.locator('.goal2', has_text='Stretch 20').inner_text()
    check('habit goal counts the habit’s ticks (10 of 20, 50%)', '10 of 20 times' in hc and '50%' in hc, hc)
    await pg.click('[data-act=areanew]'); await pg.fill('#arName', 'Pets'); await pg.click('[data-act=areasave]')
    await pg.click('.g2sum [data-act=newgoal]'); await pg.select_option('#gArea', 'Pets'); await pg.fill('#gTitle', 'Train the dog'); await pg.click('[data-act=gsave]')
    await pg.click('[data-act=areaedit][data-v=Pets]'); await pg.fill('#arName', 'Animals'); await pg.click('[data-act=areasave]')
    ar = await pg.evaluate("[GroundworkTest.state().areas.map(a=>a.name),GroundworkTest.state().goals.find(g=>g.title==='Train the dog').area]")
    await pg.click('[data-act=areaedit][data-v=Animals]'); await pg.click('[data-act=areadel]'); blocked = await pg.locator('#modal .mod').count()
    check('custom area: add, use, rename (goals follow), delete blocked while it has goals', ar == [['Animals'], 'Animals'] and blocked == 1, ar)
    if await pg.locator('#modal [data-act=modalclose]').count(): await pg.click('#modal [data-act=modalclose]')
    await pg.reload(); await pg.wait_for_timeout(300)
    check('measures and areas survive a reload', '€6,000 of €10,000' in await pg.locator('.goal2', has_text='emergency fund').inner_text() and await pg.locator('[data-act=garea][data-v=Animals]').count() == 1)
    # repeating contribution, history line, archive, a goal made of tasks, deadline notice
    await pg.goto(URL + '#goals'); await pg.wait_for_timeout(200)
    await pg.click('.g2sum [data-act=newgoal]'); await pg.fill('#gTitle', 'Holiday fund'); await pg.click('[data-act=gkind][data-v=num]'); await pg.fill('#gUnit', '€'); await pg.fill('#gTarget', '1000')
    await pg.click('#gRec'); await pg.fill('#gRecV', '100'); await pg.select_option('#gRecE', 'm')
    from datetime import date
    t = date.today(); start = date(t.year - 1 if t.month <= 2 else t.year, (t.month - 3) % 12 + 1, 1)
    await pg.fill('#gRecF', start.isoformat()); await pg.click('[data-act=gsave]'); await pg.wait_for_timeout(200)
    hol = await pg.evaluate("GroundworkTest.state().goals.find(g=>g.title==='Holiday fund')")
    hc = pg.locator('.goal2', has_text='Holiday fund')
    check('repeating contribution adds €100 on the 1st of each month since the start (3 so far) and draws a history line', len(hol['log']) == 3 and all(x.get('a') for x in hol['log']) and '€300 of €1,000' in await hc.inner_text() and await hc.locator('.g2sp svg').count() == 1, hol)
    await pg.reload(); await pg.wait_for_timeout(300)
    check('repeating contribution is not added twice after a reload', len(await pg.evaluate("GroundworkTest.state().goals.find(g=>g.title==='Holiday fund').log")) == 3)
    await pg.click('.g2sum [data-act=newgoal]'); await pg.fill('#gTitle', 'Launch the website'); await pg.click('[data-act=gkind][data-v=tasks]')
    for txt in ['Buy the domain', 'Write the homepage']:
        await pg.fill('#gStep', txt); await pg.click('[data-act=gtaskadd]')
    await pg.click('[data-act=gsave]'); await pg.wait_for_timeout(200)
    await pg.goto(URL + '#today'); await pg.wait_for_timeout(300)
    linked = await pg.locator('.tk', has_text='Buy the domain').locator('.tkg').count()
    await pg.locator('.tk', has_text='Buy the domain').locator('[data-act=tdone]').click(); await pg.goto(URL + '#goals'); await pg.wait_for_timeout(300)
    tc = await pg.locator('.goal2', has_text='Launch the website').inner_text()
    check('a goal made of tasks: tasks appear on their day, ticking one fills the goal (1 of 2, 50%)', linked == 1 and '1 of 2 tasks done' in tc and '50%' in tc, tc)
    await pg.locator('.goal2', has_text='Stretch 20').locator('[data-act=gopen]').click(); await pg.click('#modal [data-act=garch]'); await pg.wait_for_timeout(150)
    gone = await pg.locator('.goal2', has_text='Stretch 20').count()
    await pg.click('[data-act=gfold]'); back = await pg.locator('.g2arch .goal2', has_text='Stretch 20').count()
    check('archive hides a goal; it shows under Archived and can be restored', gone == 0 and back == 1)
    await pg.locator('.g2arch .goal2', has_text='Stretch 20').locator('[data-act=garch]').click()
    await pg.evaluate("""(()=>{const s=GroundworkTest.state(),d=new Date();d.setDate(d.getDate()+7);s.goals[0].due=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      localStorage.setItem('groundwork-v2',JSON.stringify(s));const p=JSON.parse(localStorage.getItem('groundwork-prefs')||'{}');p.remFired={};localStorage.setItem('groundwork-prefs',JSON.stringify(p))})()""")
    await pg.reload(); await pg.wait_for_timeout(300); await pg.evaluate("GroundworkTest.remCheck()"); await pg.wait_for_timeout(200)
    hour = await pg.evaluate("new Date().getHours()")
    toastt = await pg.locator('#toast').inner_text()
    check('goal deadline: a week before, Groundwork Habits says the goal is due in a week', hour < 9 or 'is due in a week' in toastt, toastt)
    # quick add: a task for today, tick a habit, add to an amount goal
    await pg.goto(URL + '#today'); await pg.wait_for_timeout(200)
    await pg.click('#nav .navq'); await pg.fill('#qTask', 'Quick task'); await pg.keyboard.press('Enter')
    await pg.select_option('#qGoal', label='Holiday fund (€)'); await pg.fill('#qAmt', '50'); await pg.click('[data-act=qgoal]')
    st = await pg.evaluate("(()=>{const s=GroundworkTest.state(),d=new Date(),k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');return [s.tasks[k].items.some(i=>i.text==='Quick task'),s.goals.find(g=>g.title==='Holiday fund').log.some(x=>x.v===50&&!x.a)]})()")
    check('quick add: a task for today and an amount for a goal from one dialog', st == [True, True], st)
    if await pg.locator('#modal [data-act=modalclose]').count(): await pg.click('#modal [data-act=modalclose]')
    # per-habit freeze settings: switching freezes off for Stretch ends its streak at the missed day
    await pg.goto(URL + '#habits'); await pg.wait_for_timeout(200)
    await pg.locator('.gname .nb', has_text='Stretch').click(); await pg.uncheck('#mFzOn'); await pg.click('[data-act=msave]')
    await pg.goto(URL + '#today'); await pg.wait_for_timeout(200)
    row = await pg.locator('.trow', has_text='Stretch').inner_text()
    check('freezes can be switched off per habit (the streak then counts only the last run)', await pg.evaluate("GroundworkTest.state().habits.find(h=>h.name==='Stretch').fz.off") and '10' not in row, row)
    await pg.click('[data-act=gear]'); href = await pg.locator('#set-about a[href$="/releases/latest"]').get_attribute('href')
    check('settings About has Check for updates (releases page) and the version', href.endswith('/releases/latest') and 'Groundwork Habits 1.' in await pg.locator('#set-about').inner_text())
    check('no JS errors (goals, freezes)', not errs, errs)
    await ctx.close()

async def languages(b):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.evaluate("localStorage.setItem('groundwork-tips','1');localStorage.setItem('groundwork-prefs',JSON.stringify({lang:'de'}))"); await pg.reload(); await pg.wait_for_timeout(300)
    nav = await pg.locator('#nav').inner_text()
    await pg.click('[data-act=gear]'); await pg.select_option('#langSel', 'en'); await pg.wait_for_timeout(600)
    nav2 = await pg.locator('#nav').inner_text()
    check('language: German shows German labels and dates, switching back to English works', 'Heute' in nav and 'Gewohnheiten' in nav and 'Today' in nav2 and not errs, [nav, nav2, errs])
    await ctx.close()

async def newFeatures(b):
    import base64, io, zipfile, datetime as _d
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.evaluate("localStorage.setItem('groundwork-tips','1')"); await pg.reload(); await pg.wait_for_timeout(200)
    t = _d.date.today(); ymd = lambda d: d.strftime('%Y-%m-%d')
    # in-app pickers: date, list, date+time; no system pop-up
    await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(200); await pg.click('[data-act=newgoal]'); await pg.wait_for_timeout(150)
    await pg.click('#gDue'); await pg.wait_for_timeout(150); sheet = await pg.locator('#pick .pkbox.pk-date').count()
    await pg.click('#pick [data-act=pkday][data-v="20"]'); due = await pg.input_value('#gDue')
    await pg.click('#gArea'); await pg.click('#pick .pkl button >> nth=3'); area = await pg.input_value('#gArea')
    check('in-app date and list pickers set the field (no system pop-up)', sheet == 1 and due.endswith('-20') and area == 'Money' and await pg.locator('#pick:not([hidden])').count() == 0, [sheet, due, area])
    await pg.keyboard.press('Escape'); await pg.evaluate("location.hash='achievements'"); await pg.wait_for_timeout(200)
    await pg.click('[data-act=newquit]'); await pg.wait_for_timeout(150); await pg.click('#qSince'); await pg.wait_for_timeout(150)
    await pg.click('#pick [data-act=pkday] >> nth=0'); await pg.click('#pick [data-act=pktime][data-k=hh][data-v="7"]'); await pg.click('#pick [data-act=pktime][data-k=mm][data-v="30"]'); await pg.click('#pick [data-act=pkok]')
    since = await pg.input_value('#qSince')
    check('in-app date and time picker fills a date-time field', since.endswith('T07:30'), since)
    await pg.keyboard.press('Escape')
    # rest days: a rest day neither breaks the streak nor counts in Today's total
    wd = (t.weekday() + 1) % 7; y = t - _d.timedelta(days=1); y2 = t - _d.timedelta(days=2)
    await pg.evaluate(f"""(()=>{{const s=GroundworkTest.state();s.habits.push({{id:'hr',name:'Rested',type:'daily',color:'#22c55e',target:1,per:7,track:'check',rest:[{(wd + 6) % 7}]}});s.log.hr={{'{ymd(y2)}':1}};localStorage.setItem('groundwork-v2',JSON.stringify(s))}})()""")
    await pg.reload(); await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(200)
    row = await pg.locator('.trow', has_text='Rested').inner_text()
    check('a rest day keeps the streak going (yesterday was a rest day)', '1' in row, row)
    await pg.locator('.trow', has_text='Rested').locator('.nb, .nm').first.click() if False else None
    await pg.evaluate("location.hash='habits'"); await pg.wait_for_timeout(150); await pg.locator('.gname .nb', has_text='Rested').click(); await pg.wait_for_timeout(150)
    await pg.click(f'[data-act=mrest][data-v="{wd}"]'); await pg.click('[data-act=msave]'); await pg.wait_for_timeout(150)
    rest = await pg.evaluate("GroundworkTest.state().habits.find(h=>h.id==='hr').rest")
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(200)
    check('rest days are set in the habit dialog and today shows "Rest day"', wd in rest and 'Rest day' in await pg.locator('.trow', has_text='Rested').inner_text(), rest)
    # templates
    await pg.evaluate("location.hash='habits'"); await pg.wait_for_timeout(150); await pg.click('[data-act=tpl] >> nth=0'); await pg.click('[data-act=tpladd][data-v="0"]'); await pg.wait_for_timeout(150)
    await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(150); await pg.click('.g2bt [data-act=tpl]'); await pg.click('[data-act=tpladd][data-v="5"]'); await pg.wait_for_timeout(150)
    st = await pg.evaluate("(()=>{const s=GroundworkTest.state();return [s.habits.map(h=>h.name),s.goals.filter(g=>g.habit).map(g=>!!s.habits.find(h=>h.id===g.habit))]})()")
    check('templates add a habit pack, and goal packs create and link their habits', 'Make the bed' in st[0] and len(st[1]) == 3 and all(st[1]), st)
    # goal timeline and year card
    await pg.evaluate(f"(()=>{{const s=GroundworkTest.state();s.goals.push({{id:'gt',title:'Timeline goal',area:'Health',pct:0,kind:'steps',due:'{ymd(t + _d.timedelta(days=40))}',steps:[{{id:'s1',text:'First step',done:false,due:'{ymd(t + _d.timedelta(days=5))}'}}]}});localStorage.setItem('groundwork-v2',JSON.stringify(s))}})()")
    await pg.reload(); await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(150); await pg.click('[data-act=gview][data-v=timeline]'); await pg.wait_for_timeout(150)
    tl = await pg.locator('.gtl').inner_text()
    check('goal timeline lists dated steps before the deadline', tl.index('First step') < tl.index('Timeline goal') and 'In 5 days' in tl, tl[:200])
    await pg.evaluate("location.hash='insights'"); await pg.wait_for_timeout(200)
    check('insights shows this year so far', await pg.locator('.yearc .ys').count() >= 5 and 'SO FAR' in await pg.locator('.yearc .lbl').inner_text())
    # imports: Loop export (.zip), Habitica (.json), a long CSV
    z = io.BytesIO(); zf = zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED)
    zf.writestr('Habits.csv', 'Position,Name\n001,Meditate\n002,Run\n')
    zf.writestr('Checkmarks.csv', f'Date,Meditate,Run\n{ymd(t)},2,-1\n{ymd(y)},2,5000\n{ymd(y2)},0,2\n'); zf.close()
    b64 = base64.b64encode(z.getvalue()).decode()
    r = await pg.evaluate("b=>GroundworkTest.parseExternal(new File([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],'Loop Habits CSV 2026.zip')).then(d=>[d.src,d.habits.map(h=>h.name+':'+Object.keys(h.log).length+':'+Object.keys(h.amt).length)])", b64)
    check('imports a Loop Habit Tracker export (.zip): ticks and amounts', r[0] == 'Loop Habit Tracker' and 'Meditate:2:0' in r[1] and 'Run:1:1' in r[1], r)
    hab = '{"tasks":{"dailys":[{"text":"Floss","history":[{"date":' + str(int(_d.datetime(t.year, t.month, t.day, 12).timestamp() * 1000)) + ',"completed":true}]}],"todos":[{"text":"Call mum","completed":false}]}}'
    r2 = await pg.evaluate("j=>GroundworkTest.parseExternal(new File([j],'user-data.json')).then(d=>{const m=GroundworkTest.mergeExternal(d);return [d.src,m]})", hab)
    csv = f'Date,Habit,Status\n{ymd(y)},Floss,done\n{ymd(y2)},Stretch,yes\n'
    r3 = await pg.evaluate("c=>GroundworkTest.parseExternal(new File([c],'export.csv')).then(d=>{const m=GroundworkTest.mergeExternal(d);return [d.src,m]})", csv)
    fl = await pg.evaluate("(()=>{const s=GroundworkTest.state(),h=s.habits.find(x=>x.name==='Floss');return Object.keys(s.log[h.id]).length})()")
    check('imports Habitica (habits and to-dos) and a CSV, merging same-named habits', r2[0] == 'Habitica' and r2[1]['nh'] == 1 and r2[1]['nt'] == 1 and r3[1]['nh'] == 1 and fl == 2, [r2, r3, fl])
    await pg.evaluate("location.hash='settings/data'"); await pg.wait_for_timeout(150)
    check('settings offers importing from another app', await pg.locator('[data-act=impext]').count() == 1)
    check('no JS errors (new features)', not errs, errs)
    await ctx.close()

async def tasksAndSettings(b):
    # phones: in this week's Tasks today's card is on top, the days after it follow, then the earlier ones
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}); pg = await ctx.new_page(); await pg.goto(URL)
    await pg.evaluate("localStorage.setItem('groundwork-tips','1')"); await pg.goto(URL + '#tasks'); await pg.wait_for_timeout(300)
    tops = await pg.evaluate("[...document.querySelectorAll('.days .day')].map(d=>[d.querySelector('.dt').textContent,d.getBoundingClientRect().top]).sort((a,b)=>a[1]-b[1]).map(x=>x[0])")
    import datetime as _d
    t = _d.date.today(); want = [(t + _d.timedelta(days=i)) for i in range(7)]; wk0 = t - _d.timedelta(days=(t.weekday() + 1) % 7)
    want = [d if d < wk0 + _d.timedelta(days=7) else d - _d.timedelta(days=7) for d in want]
    check('phone Tasks: today first, then the following days, then the earlier ones', tops == [d.strftime('%d/%m/%Y') for d in want], tops)
    await ctx.close()
    # tall desktop window: scrolling Settings marks every section in turn, the short last ones included
    for w, h in ((2000, 1135), (2560, 1400)):
        ctx = await b.new_context(viewport={'width': w, 'height': h}); pg = await ctx.new_page(); await pg.goto(URL)
        await pg.evaluate("localStorage.setItem('groundwork-tips','1')"); await pg.goto(URL + '#settings'); await pg.wait_for_timeout(300)
        seen = []
        for _ in range(80):
            on = await pg.evaluate("(document.querySelector('.snav a.on')||{}).dataset.sec")
            if not seen or seen[-1] != on: seen.append(on)
            await pg.mouse.wheel(0, 60); await pg.wait_for_timeout(30)
        secs = await pg.evaluate("[...document.querySelectorAll('.spane .ssec')].map(x=>x.dataset.sec)")
        check(f'settings side list marks every section in order while scrolling ({w}px)', seen == secs, [seen, secs])
        await ctx.close()

async def heatAndBackup(b):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True); pg = await ctx.new_page()
    await pg.goto(URL); await pg.evaluate("localStorage.setItem('groundwork-tips','1')"); await pg.reload()
    await pg.evaluate("location.hash='settings/data'"); await pg.wait_for_timeout(200); await pg.click('#main [data-act=demo]'); await pg.goto(URL + '#insights'); await pg.wait_for_timeout(400)
    st = await pg.evaluate("(()=>{const w=document.querySelector('.hwrap');return [document.querySelectorAll('.hgrid .hcol').length,w.scrollWidth<=w.clientWidth+1,document.querySelector('.heat .lbl').textContent]})()")
    check('heatmap on a phone shows only the weeks that fit (no sideways scrolling)', 18 <= st[0] <= 30 and st[1] and 'months' in st[2], st)
    await pg.select_option('#heatSel', '12'); await pg.wait_for_timeout(300)
    n12 = await pg.evaluate("document.querySelectorAll('.hgrid .hcol').length")
    check('heatmap months can be chosen (12 months = 52 weeks, scrolls on a phone)', n12 == 52 and await pg.evaluate("JSON.parse(localStorage.getItem('groundwork-prefs')).heatM") == 12, n12)
    await ctx.close()
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); pg = await ctx.new_page(); await pg.goto(URL)
    await pg.evaluate("localStorage.setItem('groundwork-tips','1')"); await pg.reload()
    check('quick add sits in the nav, between Tasks and Goals', await pg.evaluate("(()=>{const k=[...document.querySelectorAll('#nav>*')];const i=k.findIndex(e=>e.classList.contains('navq'));return k[i-1].getAttribute('href')==='#tasks'&&k[i+1].getAttribute('href')==='#goals'})()"))
    await ctx.close()

async def settingsPage(b):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL + '#habits'); await pg.evaluate("localStorage.setItem('groundwork-tips','1')"); await pg.reload()
    await pg.click('[data-act=gear]'); await pg.wait_for_timeout(200)
    secs = await pg.locator('#main .spane .ssec').count(); navs = await pg.locator('#main .snav a').count()
    await pg.fill('#setQ', 'backup'); await pg.wait_for_timeout(100)
    vis = await pg.evaluate("[...document.querySelectorAll('.spane .srow')].filter(r=>r.offsetParent).map(r=>r.textContent)")
    await pg.fill('#setQ', 'zzzz'); none = await pg.locator('.snone').is_visible(); await pg.fill('#setQ', '')
    check('settings page: all 8 sections with a side list; search keeps only matching rows', secs == 8 and navs == 8 and 0 < len(vis) < 12 and all('ackup' in v or 'Back' in v or 'Import' in v or 'xport' in v for v in vis) and none, vis)
    lk = await pg.locator('#bakSel').count()
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    check('Esc leaves settings back to where you were', pg.url.endswith('#habits'), [pg.url, lk])
    await ctx.close()
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True); pg = await ctx.new_page()
    await pg.goto(URL + '#today'); await pg.evaluate("localStorage.setItem('groundwork-tips','1')"); await pg.reload()
    await pg.click('[data-act=gear]'); await pg.wait_for_timeout(200)
    lst = await pg.locator('.slist .srow').count(); status = await pg.locator('.slist .srow', has_text='Security').inner_text()
    await pg.locator('.slist .srow', has_text='Security').click(); await pg.wait_for_timeout(200)
    one = [await pg.locator('.sett').inner_text(), await pg.locator('.spane .ssec').count()]
    await pg.click('[data-act=setback]'); await pg.wait_for_timeout(200); back1 = pg.url.endswith('#settings')
    await pg.click('[data-act=setback]'); await pg.wait_for_timeout(200)
    check('phone settings: list with status, a section on its own page, back goes list then the app', lst == 8 and 'No PIN' in status and one == ['Security', 1] and back1 and pg.url.endswith('#today'), [lst, status, one, pg.url])
    check('no JS errors (settings)', not errs, errs)
    await ctx.close()

async def gridDrag(b):
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
    await ctx.add_init_script("localStorage.setItem('groundwork-tips','1')")
    pg = await ctx.new_page(); await pg.goto(URL); await pg.wait_for_timeout(200)
    await pg.evaluate("location.hash='settings/data'"); await pg.wait_for_timeout(200); await pg.click('#main [data-act=demo]'); await pg.goto(URL + '#habits'); await pg.wait_for_timeout(300)
    g = pg.locator('.hrow .grip').nth(1); bx = await g.bounding_box()
    await pg.mouse.move(bx['x'] + 5, bx['y'] + 5); await pg.mouse.down(); await pg.mouse.move(bx['x'] + 5, bx['y'] + 60, steps=4)
    st = await pg.evaluate("(()=>{const g=document.querySelector('.dghost'),src=document.querySelector('.dsrc');return [g&&g.classList.contains('gname'),g&&g.getBoundingClientRect().width<400,getComputedStyle(src).opacity,getComputedStyle(src.querySelector('.gname')).opacity]})()")
    await pg.mouse.up()
    check('dragging a habit row: compact name ghost, pinned columns stay opaque', st == [True, True, '1', '1'], st)
    await ctx.close()

async def reminders(b):
    TK = "(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()"
    ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
    await ctx.add_init_script("localStorage.getItem('groundwork-tips')||localStorage.setItem('groundwork-tips','1')")
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(300)
    await pg.click('[data-act=newhabit]'); await pg.fill('#mName', 'Stretch')
    await pg.click('[data-act=mrem][data-v=ask]'); await pg.fill('#mRemT', '00:00'); await pg.click('[data-act=msave]')
    rem = await pg.evaluate("JSON.parse(localStorage.getItem('groundwork-v2')).habits[0].rem")
    await pg.evaluate("GroundworkTest.remCheck()"); early = await pg.locator('#modal .ask').count()
    await pg.evaluate("(()=>{const p=JSON.parse(localStorage.getItem('groundwork-prefs'));p.remFired={};localStorage.setItem('groundwork-prefs',JSON.stringify(p))})()")
    await pg.reload(); await pg.wait_for_timeout(300)
    asked = await pg.locator('#modal .ask', has_text='Stretch').count()
    await pg.click('#modal [data-act=askyes]')
    done = await pg.evaluate(f"(()=>{{const s=JSON.parse(localStorage.getItem('groundwork-v2'));return !!s.log[s.habits[0].id][{TK}]}})()")
    check('habit reminder saves, skips a time already passed, asks Yes/No and marks done', rem == {'t': '00:00', 'm': 'ask'} and early == 0 and asked == 1 and done)
    await pg.click('.gname .nb'); off = await pg.locator('[data-act=mrem][data-v=""]').get_attribute('aria-pressed') == 'false'
    await pg.click('[data-act=mrem][data-v=""]'); await pg.click('[data-act=msave]')
    check('habit reminder can be switched off', off and await pg.evaluate("JSON.parse(localStorage.getItem('groundwork-v2')).habits[0].rem") is None)
    # task reminder: bell on the task, Yes or no at a time, asks and marks the task done
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(200)
    await pg.locator('.ttasks [data-act=tadd]').click(); await pg.keyboard.type('Call the bank'); await pg.keyboard.press('Enter'); await pg.keyboard.press('Escape')
    await pg.locator('.tk', has_text='Call the bank').hover(); await pg.locator('.tk', has_text='Call the bank').locator('[data-act=trem]').click()
    await pg.click('[data-act=mrem][data-v=alarm]'); await pg.fill('#mRemT', '00:00'); await pg.click('[data-act=tremsave]')
    trem = await pg.evaluate(f"GroundworkTest.state().tasks[{TK}].items.find(i=>i.text==='Call the bank').rem")
    await pg.evaluate("GroundworkTest.remCheck()"); early = await pg.locator('#modal .ask').count()
    on = await pg.locator('.tk', has_text='Call the bank').locator('.tkb.on').count()
    await pg.evaluate("(()=>{const p=JSON.parse(localStorage.getItem('groundwork-prefs'));p.remFired={};localStorage.setItem('groundwork-prefs',JSON.stringify(p))})()")
    await pg.reload(); await pg.wait_for_timeout(300)
    asked = await pg.locator('#modal .ask', has_text='Call the bank').count()
    await pg.click('#modal [data-act=askyes]')
    tdone = await pg.evaluate(f"JSON.parse(localStorage.getItem('groundwork-v2')).tasks[{TK}].items.find(i=>i.text==='Call the bank').done")
    check('task reminder: set from the bell, skips a passed time, asks and Yes ticks the task', trem == {'t': '00:00', 'm': 'alarm'} and early == 0 and on == 1 and asked == 1 and tdone)
    check('no JS errors (reminders)', not errs, errs); await ctx.close()
    # Android: fake LocalNotifications (permissions) and GroundworkNative (scheduling, answers, calendar) plugins
    ctx = await b.new_context(viewport={'width': 390, 'height': 800})
    await ctx.add_init_script("""localStorage.setItem('groundwork-tips','1');window.__nb={items:[],answers:[],cb:null,url:''};
      window.Capacitor={Plugins:{LocalNotifications:{checkPermissions:async()=>({display:'granted'}),requestPermissions:async()=>({display:'granted'}),cancel:async()=>{},schedule:async()=>{}},
        GroundworkNative:{schedule:async o=>{__nb.items=o.items;return {exact:true}},takeAnswers:async()=>{const a=__nb.answers;__nb.answers=[];return {answers:a}},addListener:(n,f)=>{if(n==='back')__nb.back=f;else __nb.cb=f},exitApp:async()=>{__nb.exited=true},
          saveFile:async o=>{__nb.saved=o;return {saved:true}},pickFolder:async()=>({picked:true,name:'Drive'}),widget:async o=>{__nb.widget=o.data},bioAvailable:async()=>({ok:true,on:!!localStorage.getItem('__bio')}),bioEnable:async o=>{localStorage.setItem('__bio',o.pin);return {ok:true}},bioUnlock:async()=>({ok:!!localStorage.getItem('__bio'),pin:localStorage.getItem('__bio')}),bioDisable:async()=>{localStorage.removeItem('__bio')},readFolder:async()=>(__nb.ftext?{text:__nb.ftext}:{}),writeFolder:async o=>{__nb.ftext=o.text},clearFolder:async()=>{},backup:async o=>{__nb.bak=o;return {where:'Drive/backups'}},fetchCal:async o=>{__nb.url=o.url;return {ok:true,text:['BEGIN:VCALENDAR','BEGIN:VEVENT','UID:e1','DTSTART;VALUE=DATE:'+(d=>d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0'))(new Date()),'SUMMARY:Phone event','END:VEVENT','END:VCALENDAR'].join(String.fromCharCode(13,10))}}}}};""")
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(200)
    await pg.evaluate(f"""(()=>{{const k={TK};localStorage.setItem('groundwork-v2',JSON.stringify({{v:1,habits:[{{id:'ha',name:'Walk',type:'daily',color:'#22d3be',rem:{{t:'23:59',m:'ask'}}}},{{id:'hb',name:'Read',type:'daily',color:'#22d3be',rem:{{t:'23:59',m:'alarm'}}}}],log:{{hb:{{[k]:1}}}},tasks:{{'2099-01-01':{{items:[{{id:'tf',text:'Too far',done:false,rem:{{t:'09:00',m:'ask'}}}}]}},[(d=>{{d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}})(new Date())]:{{items:[{{id:'tt',text:'Dentist call',done:false,rem:{{t:'08:15',m:'alarm'}}}}]}}}},goals:[]}}))}})()""")
    await pg.reload(); await pg.wait_for_timeout(300); await pg.evaluate("GroundworkTest.remSync()"); await pg.wait_for_timeout(200)
    sc = await pg.evaluate("__nb.items.map(n=>[n.h,n.alarm,n.k,typeof n.at])")
    a = [x for x in sc if x[0] == 'ha']; bb = [x for x in sc if x[0] == 'hb']
    late = await pg.evaluate("new Date().getHours()*60+new Date().getMinutes()>=1439")
    tk = await pg.evaluate("__nb.items.filter(n=>n.h==='tt'||n.h==='tf').map(n=>[n.h,n.title,n.alarm])")
    reps = await pg.evaluate("[...new Set(__nb.items.filter(n=>n.h==='ha').map(n=>n.rep))]")
    check('habit reminders tell Android their period so it can keep them going', reps == ['daily'], reps)
    check('Android schedules task reminders in the next 14 days only', tk == [['tt', 'Dentist call', True]])
    await pg.evaluate("__nb.answers=[{h:'tt',k:Object.keys(GroundworkTest.state().tasks).find(k=>GroundworkTest.state().tasks[k].items.some(i=>i.id==='tt')),a:'yes'}];__nb.cb()"); await pg.wait_for_timeout(300)
    check('Android Yes on a task reminder ticks the task', await pg.evaluate("Object.values(GroundworkTest.state().tasks).some(d=>d.items.some(i=>i.id==='tt'&&i.done))"))
    await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(100); await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(100); await pg.evaluate("location.hash='settings/appearance'"); await pg.wait_for_timeout(150)
    await pg.evaluate("__nb.back()"); await pg.wait_for_timeout(150); h1 = await pg.evaluate("location.hash")
    if h1 == '#settings': await pg.evaluate("__nb.back()"); await pg.wait_for_timeout(150); h1 = await pg.evaluate("location.hash")
    h2 = h1
    await pg.evaluate("__nb.back()"); await pg.wait_for_timeout(100); hint = await pg.locator('#toast').inner_text(); early = await pg.evaluate("!!__nb.exited")
    await pg.evaluate("__nb.back()"); await pg.wait_for_timeout(100)
    check('Android back leaves Settings to the screen it came from; elsewhere the first back asks and the second leaves', h1 == '#goals' and await pg.evaluate("location.hash") == '#goals' and 'again' in hint and not early and await pg.evaluate("!!__nb.exited"), [h1, h2, hint])
    check('Android schedules 14 days of reminders natively and skips a day already done',
          len(a) in (13, 14) and (late or (len(a) == 14 and len(bb) == 13)) and a[0][1] is False and bb[0][1] is True and a[0][3] == 'number')
    await pg.evaluate(f"__nb.answers=[{{h:'ha',k:{TK},a:'yes'}},{{h:'hb',k:'2020-01-01',a:'no'}}];__nb.cb()"); await pg.wait_for_timeout(300)
    check('Yes answered in the notification (app closed) is applied when the app runs', await pg.evaluate(f"!!JSON.parse(localStorage.getItem('groundwork-v2')).log.ha[{TK}]") and not await pg.evaluate("!!JSON.parse(localStorage.getItem('groundwork-v2')).log.hb['2020-01-01']"))
    await pg.wait_for_timeout(1700)
    today = await pg.evaluate(TK)
    check('a habit answered Yes drops out of the schedule', not any(x[0] == 'ha' and x[2] == today for x in await pg.evaluate("__nb.items.map(n=>[n.h,n.alarm,n.k])")))
    await pg.evaluate("location.hash='settings/calendar'"); await pg.wait_for_timeout(200); await pg.click('[data-act=calset]'); await pg.fill('#calUrl', 'webcal://calendar.google.com/x/basic.ics'); await pg.click('[data-act=calsave]'); await pg.wait_for_timeout(400)
    check('Android calendar sync fetches natively and adds events', await pg.evaluate("__nb.url") == 'https://calendar.google.com/x/basic.ics' and await pg.evaluate("Object.values(GroundworkTest.state().tasks).some(d=>d.items.some(i=>i.text==='Phone event'&&i.cal))"))
    pct = await pg.evaluate("location.hash='today'") or await pg.wait_for_timeout(200) or await pg.evaluate("document.querySelector('.thero,.today-ring,#main').innerText")
    k_cal = await pg.evaluate("Object.keys(GroundworkTest.state().tasks).find(k=>GroundworkTest.state().tasks[k].items.some(i=>i.text==='Phone event'))")
    await pg.evaluate("location.hash='tasks'"); await pg.wait_for_timeout(200)
    ring = await pg.locator(f'.day:has([data-k="{k_cal}"]) .ringw').first.inner_text()
    check('calendar events count towards the day’s progress', ring.split('%')[0].strip().endswith(' 0') or ring.strip().startswith('0%'), ring)
    await pg.evaluate(f"GroundworkTest.state().tasks['{k_cal}'].items.find(i=>i.text==='Phone event').done=true"); await pg.evaluate("location.hash='today'"); await pg.evaluate("location.hash='tasks'"); await pg.wait_for_timeout(200)
    ring2 = await pg.locator(f'.day:has([data-k="{k_cal}"]) .ringw').first.inner_text()
    check('a done calendar event raises the progress ring', int(''.join(c for c in ring2.split('%')[0] if c.isdigit()) or 0) > 0, ring2)
    await pg.evaluate("(()=>{const p=JSON.parse(localStorage.getItem('groundwork-prefs'));p.feat=Object.assign({},p.feat,{remnames:false});localStorage.setItem('groundwork-prefs',JSON.stringify(p))})()")
    await pg.reload(); await pg.wait_for_timeout(300); await pg.evaluate("GroundworkTest.remSync()"); await pg.wait_for_timeout(200)
    check('hidden names: reminders say Groundwork Habits instead of the habit or task', await pg.evaluate("__nb.items.length>0&&__nb.items.every(n=>n.title==='Groundwork Habits'&&!/Walk|Read|Dentist/.test(n.body))"))
    await pg.evaluate("location.hash='settings/data'"); await pg.wait_for_timeout(200); await pg.click('#main [data-act=export]'); await pg.wait_for_timeout(300)
    check('Android export opens the save-to picker with the backup', await pg.evaluate("!!(__nb.saved&&__nb.saved.name.startsWith('groundwork-backup-')&&JSON.parse(__nb.saved.text).habits)"))
    await pg.evaluate("location.hash='settings/data'"); await pg.wait_for_timeout(200); await pg.click('#main [data-act=apick]'); await pg.wait_for_timeout(1500)
    wrote = await pg.evaluate("!!(__nb.ftext&&JSON.parse(__nb.ftext).habits.length)")
    await pg.evaluate("(()=>{const d=JSON.parse(__nb.ftext);d.habits[0].name='Changed on another phone';__nb.ftext=JSON.stringify(d)})()")
    await pg.evaluate("window.dispatchEvent(new Event('focus'))"); await pg.wait_for_timeout(800)
    check('Android data folder: saves groundwork.json there and picks up changes from another device', wrote and await pg.evaluate("GroundworkTest.state().habits[0].name") == 'Changed on another phone')
    await pg.evaluate("location.hash='settings/data'"); await pg.wait_for_timeout(200); await pg.click('#main [data-act=baknow]'); await pg.wait_for_timeout(500)
    check('Back up now writes a dated backup file', await pg.evaluate(r"!!(__nb.bak&&/^groundwork-backup-\d{4}-\d{2}-\d{2}\.json$/.test(__nb.bak.name)&&JSON.parse(__nb.bak.text).habits)"))
    await pg.wait_for_timeout(800)
    wd = await pg.evaluate("__nb.widget")
    check('Android widget gets today’s daily habits with their done state', wd and len(wd['items']) == 2 and {x['h'] for x in wd['items']} == {'ha', 'hb'} and not wd['locked'], wd)
    await pg.evaluate("location.hash='settings/security'"); await pg.wait_for_timeout(200); await pg.click('[data-act=pinset]'); await pg.fill('#pin1', '4321'); await pg.fill('#pin2', '4321'); await pg.click('[data-act=pinsave]'); await pg.wait_for_timeout(2600)
    await pg.locator('#toast [data-act=bioon]').click(); await pg.wait_for_timeout(300)
    wd2 = await pg.evaluate("__nb.widget")
    check('fingerprint unlock can be turned on after setting a PIN; the widget then hides names', await pg.evaluate("localStorage.getItem('__bio')") == '4321' and wd2['locked'] and wd2['items'] == [])
    await pg.reload(); await pg.wait_for_timeout(2500)
    check('with fingerprint on, Groundwork Habits unlocks without typing the PIN', await pg.locator('#lock').is_hidden() and await pg.evaluate("GroundworkTest.state().habits.length") == 2)
    check('no JS errors (Android reminders)', not errs, errs); await ctx.close()

async def mobile(b):
    ctx = await b.new_context(viewport={'width': 390, 'height': 800}, has_touch=True, is_mobile=True)
    await ctx.add_init_script("localStorage.getItem('groundwork-tips')||localStorage.setItem('groundwork-tips','1')")
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
    # phone keyboard: the new-task field and its repeat menu scroll into view, the bottom bar hides
    await pg.evaluate("location.hash='tasks'"); await pg.wait_for_timeout(200)
    k0 = await pg.evaluate("(()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())})()")
    await pg.locator(f'[data-act=tadd][data-k="{k0}"]').tap(); await pg.set_viewport_size({'width': 390, 'height': 430}); await pg.wait_for_timeout(700)
    vis = await pg.evaluate("(()=>{const r=document.querySelector('.tadd').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()")
    check('phone keyboard: new task box stays visible, bottom bar hidden', vis and await pg.locator('.pnav').is_hidden())
    await pg.set_viewport_size({'width': 390, 'height': 800})
    check('no JS errors (mobile)', not errs, errs)
    await ctx.close()

def syntax_check():
    import shutil, re as _re, tempfile, os as _os
    node = shutil.which('node')
    if not node: return
    js = open(os.path.join(os.path.dirname(__file__), '..', 'www', 'app.js'), encoding='utf-8').read()
    f = tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8'); f.write(js); f.close()
    r = subprocess.run([node, '--check', f.name], capture_output=True, text=True); _os.unlink(f.name)
    check('app script has no syntax errors', r.returncode == 0, (r.stderr or '')[:300])
    if r.returncode: raise SystemExit(1)

async def main():
    syntax_check()
    srv = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await desktop(b); await bigwindow(b); await gridDrag(b); await settingsPage(b); await tasksAndSettings(b); await newFeatures(b); await heatAndBackup(b); await languages(b); await insightsBoxes(b); await goalsAndFreezes(b); await undoHistory(b); await recurring(b); await reminders(b); await mobile(b)
        await b.close()
    srv.shutdown()
    print(f"\n{len(failures)} failure(s)" if failures else "\nAll checks passed")
    raise SystemExit(1 if failures else 0)

asyncio.run(main())
