"""Real-device check on the BlueStacks instance named "Groundwork Habits testing" (run before every release).
python tests/device_android.py [path-to-apk]     (default: the newest dist/*-Android.apk)
Finds the instance in BlueStacks' config by its display name (GROUNDWORK_TEST_INSTANCE to change it), starts it if needed,
connects only to that instance's adb port, installs the APK and checks: reminder in the background, Yes from the
notification without opening the app, the answer applied, the calendar fetched natively, export opens Save to.
Needs ADB turned on in that instance's BlueStacks settings."""
import asyncio, glob, os, re, subprocess, sys, time, pathlib
from playwright.async_api import async_playwright

NAME = os.environ.get('GROUNDWORK_TEST_INSTANCE', 'Groundwork Habits testing')
ROOT = pathlib.Path(__file__).resolve().parent.parent
fails = []
def check(name, ok, info=''):
    print(('PASS ' if ok else 'FAIL ') + name + (('  ' + str(info)[:300]) if not ok and info else ''))
    if not ok: fails.append(name)

def bluestacks():
    import winreg
    k = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\BlueStacks_nxt')
    data = winreg.QueryValueEx(k, 'UserDefinedDir')[0]; inst = winreg.QueryValueEx(k, 'InstallDir')[0]
    return pathlib.Path(data) / 'bluestacks.conf', pathlib.Path(inst)

def instance(conf):
    t = conf.read_text(encoding='utf-8', errors='replace')
    m = re.search(r'bst\.instance\.([^.]+)\.display_name="' + re.escape(NAME) + '"', t)
    if not m: sys.exit(f'No BlueStacks instance called "{NAME}"')
    iid = m.group(1); port = re.search(r'bst\.instance\.' + re.escape(iid) + r'\.status\.adb_port="(\d+)"', t)
    return iid, port.group(1) if port else None

def main():
    apk = sys.argv[1] if len(sys.argv) > 1 else max(glob.glob(str(ROOT / 'dist' / '*-Android.apk')), key=os.path.getmtime)
    conf, inst = bluestacks(); iid, port = instance(conf)
    ser = None
    for attempt in range(40):
        iid, port = instance(conf)
        if port:
            subprocess.run(['adb', 'connect', '127.0.0.1:' + port], capture_output=True)
            ser = '127.0.0.1:' + port
            if subprocess.run(['adb', '-s', ser, 'shell', 'getprop', 'sys.boot_completed'], capture_output=True, text=True).stdout.strip() == '1': break
        if attempt == 0:
            print(f'Starting BlueStacks instance "{NAME}" ({iid})'); subprocess.Popen([str(inst / 'HD-Player.exe'), '--instance', iid])
        time.sleep(5)
    else: sys.exit('The instance did not start or ADB is off in its settings')
    print('Device:', ser, 'APK:', apk)
    D = ['adb', '-s', ser]
    sh = lambda *a: subprocess.run(D + ['shell', *a], capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
    r = subprocess.run(D + ['install', '-r', apk], capture_output=True, text=True)
    check('APK installs', 'Success' in r.stdout, r.stdout + r.stderr)
    sh('pm', 'grant', 'com.groundwork.habits', 'android.permission.POST_NOTIFICATIONS')
    sh('am', 'force-stop', 'com.groundwork.habits'); sh('am', 'start', '-n', 'com.groundwork.habits/.MainActivity'); time.sleep(6)
    asyncio.run(run(D, sh))
    print(f'\n{len(fails)} failure(s)' if fails else '\nAll device checks passed'); sys.exit(1 if fails else 0)

def resumed(sh):
    m = re.search(r'(?:mResumedActivity|topResumedActivity)[^\n]*?(\S+/\S+)', sh('dumpsys', 'activity', 'activities')); return m.group(1) if m else '?'

async def page(p, D, sh):
    pid = sh('pidof', 'com.groundwork.habits').strip()
    subprocess.run(D + ['forward', 'tcp:9444', 'localabstract:webview_devtools_remote_' + pid], capture_output=True)
    b = await p.chromium.connect_over_cdp('http://127.0.0.1:9444'); return b, b.contexts[0].pages[0]

async def run(D, sh):
    async with async_playwright() as p:
        b, pg = await page(p, D, sh)
        info = await pg.evaluate("""(()=>{const n=new Date(Date.now()+65000),t=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0'),
          k=n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
          localStorage.setItem('groundwork-tips','1');
          localStorage.setItem('groundwork-v2',JSON.stringify({v:1,habits:[{id:'hdev',name:'Device test habit',type:'daily',color:'#22d3be',rem:{t,m:'ask'}}],log:{},tasks:{},goals:[]}));
          return {t,k}})()""")
        await pg.reload(); await pg.wait_for_timeout(2000); await pg.evaluate("GroundworkTest.remSync()"); await pg.wait_for_timeout(1500)
        wid = await pg.evaluate("Capacitor.Plugins.GroundworkNative.bioAvailable()")
        print('fingerprint available on this device:', wid)
        await b.close()
        sh('input', 'keyevent', '3'); time.sleep(2)
        posted = False
        for _ in range(60):
            if 'Device test habit' in sh('dumpsys', 'notification', '--noredact'): posted = True; break
            time.sleep(3)
        check('reminder notification posted while Groundwork Habits is in the background', posted)
        if posted:
            sh('cmd', 'statusbar', 'expand-notifications'); time.sleep(2)
            sh('uiautomator', 'dump', '/sdcard/ui.xml'); xml = sh('cat', '/sdcard/ui.xml')
            m = re.search(r'text="(?:Yes, done|YES, DONE)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
            if not m:
                t = re.search(r'text="Device test habit"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
                if t: sh('input', 'swipe', t.group(1), t.group(2), t.group(1), str(int(t.group(2)) + 300)); time.sleep(1)
                sh('uiautomator', 'dump', '/sdcard/ui.xml'); xml = sh('cat', '/sdcard/ui.xml')
                m = re.search(r'text="(?:Yes, done|YES, DONE)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
            check('notification shows Yes, done and No', bool(m))
            if m:
                sh('input', 'tap', str((int(m.group(1)) + int(m.group(3))) // 2), str((int(m.group(2)) + int(m.group(4))) // 2)); time.sleep(3)
                r = resumed(sh); check('tapping Yes does not open Groundwork Habits', 'com.groundwork.habits' not in r, r)
                check('the notification goes away after Yes', 'Device test habit' not in sh('dumpsys', 'notification', '--noredact'))
        sh('cmd', 'statusbar', 'collapse'); sh('am', 'start', '-n', 'com.groundwork.habits/.MainActivity'); time.sleep(4)
        b, pg = await page(p, D, sh); await pg.wait_for_timeout(1500)
        check('the Yes answer is applied when Groundwork Habits opens', await pg.evaluate(f"!!(GroundworkTest.state().log.hdev||{{}})['{info['k']}']"))
        cal = await pg.evaluate("Capacitor.Plugins.GroundworkNative.fetchCal({url:'https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics'})")
        check('calendar downloads natively', cal.get('ok') and 'VCALENDAR' in cal.get('text', ''), cal.get('error'))
        check('calendar refuses a local address', not (await pg.evaluate("Capacitor.Plugins.GroundworkNative.fetchCal({url:'https://127.0.0.1/x.ics'})")).get('ok'))
        wd = await pg.evaluate("Capacitor.Plugins.GroundworkNative.widget({data:{title:'Test',items:[{h:'hdev',k:'x',name:'Widget row',done:false}]}}).then(()=>'ok')")
        check('home-screen widget accepts data', wd == 'ok')
        wt = await pg.evaluate("Capacitor.Plugins.GroundworkNative.widget({data:{title:'Test',items:[{h:'hdev',k:'2020-01-01',name:'Widget row',done:false}]},tasks:{title:'Tasks today',items:[{h:'t1',k:'x',name:'Task row',done:false}]}}).then(()=>'ok')")
        check('tasks widget accepts data', wt == 'ok')
        # quick settings tile: a tap ticks the first open habit without opening the app
        sh('cmd', 'statusbar', 'add-tile', 'com.groundwork.habits/app.groundwork.nativebridge.QsTile'); time.sleep(7)  # the shade creates the tile a few seconds later
        sh('cmd', 'statusbar', 'click-tile', 'com.groundwork.habits/app.groundwork.nativebridge.QsTile'); time.sleep(3)
        # the app applies the answer at once (the answer event), so look at the habit itself
        ticked = await pg.evaluate("!!(GroundworkTest.state().log.hdev||{})['2020-01-01']")
        check('quick settings tile ticks the next open habit', ticked)
        sh('cmd', 'statusbar', 'remove-tile', 'com.groundwork.habits/app.groundwork.nativebridge.QsTile'); sh('cmd', 'statusbar', 'collapse')
        # the system back button: leaves Settings, steps back to Today, then needs two backs to leave the app
        await pg.evaluate("location.hash='today'"); await pg.wait_for_timeout(300); await pg.evaluate("location.hash='goals'"); await pg.wait_for_timeout(300); await pg.evaluate("location.hash='settings/appearance'"); await pg.wait_for_timeout(500)
        sh('input', 'keyevent', '4'); await pg.wait_for_timeout(700); h1 = await pg.evaluate("location.hash")
        if h1 == '#settings': sh('input', 'keyevent', '4'); await pg.wait_for_timeout(700); h1 = await pg.evaluate("location.hash")
        h2 = await pg.evaluate("location.hash")
        sh('input', 'keyevent', '4'); await pg.wait_for_timeout(500); hint = await pg.evaluate("document.getElementById('toast').hidden?'':document.getElementById('toast').textContent"); still = 'com.groundwork.habits' in resumed(sh)
        check('back leaves Settings to the screen it came from', h1 == '#goals' and h2 == '#goals', [h1, h2])
        check('first back outside Settings shows a hint and keeps the app open', still and 'again' in hint, [hint, still])
        await b.close(); sh('input', 'keyevent', '4'); time.sleep(2); r = resumed(sh)
        check('second back leaves the app', 'com.groundwork.habits' not in r, r)
        sh('am', 'start', '-n', 'com.groundwork.habits/.MainActivity'); time.sleep(4); b, pg = await page(p, D, sh); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelector('[data-act=gear]').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#main [data-act=export]').click()"); await b.close(); time.sleep(3)
        r = resumed(sh); check('Export opens the Android Save to screen', 'documentsui' in r.lower(), r); sh('input', 'keyevent', '4')

main()
