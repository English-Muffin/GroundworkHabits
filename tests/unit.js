// Unit tests for the app's pure logic, in plain Node (no browser): node tests/unit.js
// The www/js files are loaded into one sandbox in index.html's order, with a stub DOM that absorbs every call.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const www = path.join(__dirname, '..', 'www');
const order = [...fs.readFileSync(path.join(www, 'index.html'), 'utf8').matchAll(/<script src="js\/(\w+)\.js">/g)].map(m => m[1]);

// anything you touch on it is another stub; calling it returns a stub
const stub = () => new Proxy(function () {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === Symbol.iterator ? function* () {} : k === 'then' ? undefined : stub(),
  apply: () => stub(), construct: () => stub(), set: () => true,
});
const store = new Map();
// a signed-in Google Calendar for the paging test (calEvents reads its token at load)
store.set('groundwork-v2-gcal', JSON.stringify({ tok: 'T', exp: 4e12, rt: '' }));
const sandbox = {
  console, Date, Math, JSON, Intl, Promise, Set, Map, URL, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
  TextEncoder, TextDecoder, crypto: globalThis.crypto, atob, btoa,
  localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: () => null, length: 0 },
  sessionStorage: { getItem: () => null, setItem: () => {} },
  document: stub(), navigator: { userAgent: 'node', language: 'en', platform: 'node', maxTouchPoints: 0 }, location: { hash: '#today', reload() {} },
  indexedDB: undefined, matchMedia: () => ({ matches: false, addEventListener() {} }), getComputedStyle: () => stub(),
  addEventListener() {}, innerWidth: 1280, innerHeight: 800,
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const src = order.map(n => fs.readFileSync(path.join(www, 'js', n + '.js'), 'utf8').replace("'use strict';", '')).join('\n');
// the files share one scope; the tail hands the functions under test (and a way to set "today") to this script
vm.runInContext("'use strict';\n" + src + `
;globalThis.__T={backupPrefs,restorePrefs,getP:()=>P,freezeOf,curStreak,repeatDates,gPct,gForecast,gLine,clean,backupProblem,missTwice,chDone,chLine,histStep,
  setToday:d=>{TODAY=d},setS:x=>{S=x;fzCache.clear()},getS:()=>S,dk,addDays,empty,merge3,syncIn,gEvent,cloud:()=>CLOUD,parseIcs:typeof parseIcs==='function'?parseIcs:null};`, sandbox, { filename: 'app' });
const T = sandbox.__T;

let fails = 0, n = 0;
const pending = [], fail = (name, e) => { fails++; console.log('FAIL ' + name + '\n  ' + e.message); };
// a test may be async: its result is waited for before the summary
const test = (name, fn) => { n++; try { const r = fn(); if (r && r.then) pending.push(r.then(() => console.log('PASS ' + name), e => fail(name, e))); else console.log('PASS ' + name); } catch (e) { fail(name, e); } };
const same = (a, b) => assert.deepStrictEqual(Array.from(a), b); // arrays from the sandbox are another realm's Array
const day = s => new Date(s + 'T00:00');
const habit = (log, extra) => { const S = T.empty(); const h = Object.assign({ id: 'h1', name: 'Read', type: 'daily', color: '#9cc96b', target: 1, per: 7, track: 'check' }, extra); S.habits.push(h); S.log.h1 = log; T.setS(S); return h; };
const days = (from, n, skip = []) => { const o = {}; for (let i = 0; i < n; i++) { const k = T.dk(T.addDays(day(from), i)); if (!skip.includes(k)) o[k] = 1; } return o; };

T.setToday(day('2026-03-18'));

// calendar repeat rules (RRULE): one task per date in the window, 30 days back to 90 ahead
const ics = rule => T.parseIcs(['BEGIN:VEVENT', 'UID:e1', 'SUMMARY:Ev', 'DTSTART;VALUE=DATE:20260302', 'RRULE:' + rule, 'END:VEVENT'].join('\n')).map(e => e.day);
test('calendar: weekly on Monday and Wednesday, 4 dates', () => same(ics('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4'), ['2026-03-02', '2026-03-04', '2026-03-09', '2026-03-11']));
test('calendar: second Tuesday of each month until May', () => same(ics('FREQ=MONTHLY;BYDAY=2TU;UNTIL=20260531'), ['2026-03-10', '2026-04-14', '2026-05-12']));
test('calendar: last weekday of the month (BYSETPOS=-1)', () => same(ics('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=3'), ['2026-03-31', '2026-04-30', '2026-05-29']));
test('calendar: monthly on the last day (BYMONTHDAY=-1)', () => same(ics('FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3'), ['2026-03-31', '2026-04-30', '2026-05-31']));
test('calendar: yearly on the first Monday of June (BYMONTH + BYDAY)', () => same(ics('FREQ=YEARLY;BYMONTH=6;BYDAY=1MO;COUNT=1'), ['2026-06-01']));
test('calendar: a crafted rule (huge BYDAY list, BYMONTH that never matches) finishes quickly', () => {
  const t0 = Date.now(); ics('FREQ=MONTHLY;BYDAY=' + Array(50000).fill('MO').join(',')); ics('FREQ=MONTHLY;BYMONTH=2;BYMONTHDAY=31');
  assert.ok(Date.now() - t0 < 500, 'took ' + (Date.now() - t0) + ' ms');
});
test('calendar: EXDATE skips one date', () => same(T.parseIcs(['BEGIN:VEVENT', 'UID:e2', 'DTSTART;VALUE=DATE:20260302', 'RRULE:FREQ=DAILY;COUNT=3', 'EXDATE;VALUE=DATE:20260303', 'END:VEVENT'].join('\n')).map(e => e.day), ['2026-03-02', '2026-03-04']));

test('repeat: every 2 weeks lands on the same weekday, 14 days apart', () => {
  same(T.repeatDates('2026-03-03', 'w2', 'm'), ['2026-03-03', '2026-03-17', '2026-03-31']);
});
test('repeat: second Tuesday of each month', () => {
  same(T.repeatDates('2026-03-10', 'mn', '3m').slice(0, 3), ['2026-03-10', '2026-04-14', '2026-05-12']);
});
test('repeat: last Friday of each month', () => {
  same(T.repeatDates('2026-03-27', 'ml', '3m').slice(0, 3), ['2026-03-27', '2026-04-24', '2026-05-29']);
});
test('repeat: weekdays skip the weekend', () => {
  same(T.repeatDates('2026-03-13', 'wd', 'm').slice(0, 3), ['2026-03-13', '2026-03-16', '2026-03-17']);
});
test('streak: 10 days in a row up to today', () => {
  const h = habit(days('2026-03-09', 10)); assert.strictEqual(T.curStreak(h), 10);
});
test('freezes: 7 days in a row earn one, and one missed day keeps the streak', () => {
  const h = habit(days('2026-03-01', 18, ['2026-03-12'])); const f = T.freezeOf(h);
  assert.ok(f.frozen.has('2026-03-12'), 'the missed day is frozen'); assert.strictEqual(f.streak, 17);
});
test('freezes: a rest day is skipped, not frozen', () => {
  const h = habit(days('2026-03-01', 18, ['2026-03-12'])); h.rest = [new Date('2026-03-12T00:00').getDay()]; const f = T.freezeOf(h);
  assert.ok(!f.frozen.has('2026-03-12'), 'rest days need no freeze'); assert.strictEqual(f.streak, 17);
});
test('pause: paused days are skipped, not frozen, and weeks in a pause keep the weekly run', () => {
  const h = habit(days('2026-03-01', 18, ['2026-03-11', '2026-03-12'])); h.off = [{ f: '2026-03-11', t: '2026-03-12' }]; const f = T.freezeOf(h);
  assert.ok(!f.frozen.has('2026-03-11') && !f.frozen.has('2026-03-12'), 'paused days need no freeze'); assert.strictEqual(f.streak, 16);
  const w = habit({ '2026-03-W1': 1 }); w.type = 'weekly'; w.off = [{ f: '2026-03-08' }]; const st = sandbox.weeklyStats(w, 2026, 2);
  assert.strictEqual(st.cur, 1); assert.strictEqual(st.pct, 100);
});
test('save writes the whole state with its save time in one pass', () => {
  habit({}); sandbox.save(); const saved = JSON.parse(store.get('groundwork-v2'));
  assert.ok(saved.at > 0); assert.strictEqual(saved.habits[0].name, T.getS().habits[0].name); assert.deepStrictEqual(Object.keys(saved).sort(), Object.keys(T.getS()).sort());
});
test('never miss twice: marked after one missed day, not after a done day', () => {
  const h = habit(days('2026-03-01', 16)); assert.strictEqual(T.missTwice(h), true); // done up to the 16th, missed the 17th
  const h2 = habit(days('2026-03-01', 17)); assert.strictEqual(T.missTwice(h2), false);
});
test('challenge: 30 days from the 1st, 18 done by the 18th', () => {
  const h = habit(days('2026-03-01', 18), { ch: { from: '2026-03-01', days: 30 } });
  assert.strictEqual(T.chDone(h), 18); assert.match(T.chLine(h), /day 18 of 30/);
});
test('goal: amount goal percent and forecast at the pace so far', () => {
  const g = { id: 'g', title: 'Save', kind: 'num', target: 1000, unit: '€', log: [{ d: '2026-03-01', v: 170 }, { d: '2026-03-10', v: 170 }] };
  assert.strictEqual(T.gPct(g), 34); const f = T.gForecast(g); assert.ok(f && f.at > day('2026-03-18'), 'forecast in the future');
  assert.strictEqual(T.dk(f.at), '2026-04-20'); // 34% in 17 days (2%/day) → 66% more in 33 days
});
test('goal: no forecast with under a week of history', () => {
  assert.strictEqual(T.gForecast({ id: 'g', title: 'x', kind: 'num', target: 10, log: [{ d: '2026-03-15', v: 2 }] }), null);
});
test('backup check: refuses non-backups, damaged and newer-version files', () => {
  assert.ok(T.backupProblem(null)); assert.ok(T.backupProblem({ habits: {} })); assert.ok(T.backupProblem({ habits: [], log: [] }));
  assert.match(T.backupProblem({ v: 99, habits: [] }), /newer version/); assert.strictEqual(T.backupProblem({ v: 1, habits: [], log: {} }), null);
});
test('clean: drops unknown fields and unsafe values, keeps challenges', () => {
  const d = T.clean({ habits: [{ id: 'a', name: 'X', color: 'red;}', evil: 1, ch: { from: '2026-03-01', days: 999 } }], log: {} });
  assert.strictEqual(d.habits[0].evil, undefined); assert.match(d.habits[0].color, /^#[0-9a-f]{6}$/); assert.strictEqual(d.habits[0].ch.days, 365);
});
test('clean: keeps the last save time (the Android data folder keeps the newest copy)', () => {
  assert.strictEqual(T.clean({ habits: [], log: {}, at: 1763000000000 }).at, 1763000000000); assert.strictEqual(T.clean({ habits: [], log: {}, at: 'x' }).at, 0);
});
test('undo history: undo and redo step through saved changes', () => {
  habit({}); const S = T.getS(); sandbox.save(); S.habits[0].name = 'One'; sandbox.save();
  T.getS().habits[0].name = 'Two'; sandbox.save(); // a burst within 1.5 s is one step
  assert.ok(T.histStep(true)); assert.strictEqual(T.getS().habits[0].name, 'Read');
  assert.ok(T.histStep(false)); assert.strictEqual(T.getS().habits[0].name, 'Two');
});
test('backups carry settings, never the PIN, calendar link or folders', () => {
  const P = T.getP(); Object.assign(P, { theme: 'light', accent: '#60a5fa', feat: { mind: false }, lock: { salt: 's', enc: 1 }, cal: 'https://secret.ics', andDir: 'x' });
  const b = T.backupPrefs();
  assert.strictEqual(b.theme, 'light'); assert.strictEqual(b.accent, '#60a5fa'); assert.strictEqual(b.feat.mind, false);
  assert.ok(!('lock' in b) && !('cal' in b) && !('andDir' in b), 'secrets and device state stay out');
});
test('restoring settings keeps only valid values and never touches the PIN', () => {
  const P = T.getP(); P.theme = 'dark'; P.accent = '#9cc96b'; P.lock = null;
  T.restorePrefs({ theme: 'amoled', accent: 'red;}', lock: { salt: 'evil' }, feat: { twice: false }, remTime: '25:99', hsort: 'name' });
  assert.strictEqual(P.hsort, 'name', 'habit sort order comes back'); T.restorePrefs({ hsort: '<b>' }); assert.strictEqual(P.hsort, 'name', 'bad sort ignored');
  assert.strictEqual(P.theme, 'amoled'); assert.strictEqual(P.accent, '#9cc96b', 'bad colour ignored');
  assert.strictEqual(P.lock, null, 'PIN from a file ignored'); assert.strictEqual(P.feat.twice, false); assert.notStrictEqual(P.remTime, '25:99');
});


// sync merge: base = the copy both devices last agreed on
test('sync merge: ticks, new habits and tasks from both devices are all kept', () => {
  const base = { habits: [{ id: 'a', name: 'Read' }], log: { a: { '2026-03-01': 1 } }, tasks: { '2026-03-02': { items: [{ id: 't1', text: 'Milk', done: false }] } } };
  const phone = JSON.parse(JSON.stringify(base)); phone.log.a['2026-03-02'] = 1; phone.habits.push({ id: 'b', name: 'Run' }); phone.tasks['2026-03-02'].items[0].done = true;
  const pc = JSON.parse(JSON.stringify(base)); pc.log.a['2026-03-03'] = 1; pc.habits.push({ id: 'c', name: 'Write' }); pc.tasks['2026-03-02'].items.push({ id: 't2', text: 'Bread', done: false });
  const m = JSON.parse(JSON.stringify(T.merge3(base, phone, pc, true)));
  assert.deepStrictEqual(Object.keys(m.log.a).sort(), ['2026-03-01', '2026-03-02', '2026-03-03']);
  assert.deepStrictEqual(m.habits.map(h => h.id), ['a', 'b', 'c']);
  assert.deepStrictEqual(m.tasks['2026-03-02'].items.map(t => t.id + t.done), ['t1true', 't2false']);
});
test('sync merge: a delete on one device wins unless the other changed that thing', () => {
  const base = { habits: [{ id: 'a', name: 'Read' }, { id: 'b', name: 'Run' }], log: { a: { d1: 1, d2: 1 } } };
  const l = { habits: [{ id: 'b', name: 'Run' }], log: { a: { d1: 1 } } };
  const r = { habits: [{ id: 'a', name: 'Read' }, { id: 'b', name: 'Run fast' }], log: { a: { d1: 1, d2: 1 } } };
  const m = JSON.parse(JSON.stringify(T.merge3(base, l, r, false)));
  assert.deepStrictEqual(m.habits, [{ id: 'b', name: 'Run fast' }]); assert.deepStrictEqual(m.log.a, { d1: 1 });
  const r2 = { habits: [{ id: 'a', name: 'Read more' }, { id: 'b', name: 'Run' }] };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.merge3({ habits: base.habits }, { habits: l.habits }, r2, false))).habits.map(h => h.name), ['Read more', 'Run']);
});
test('sync merge: the same field changed on both devices keeps the newer save', () => {
  const b = { habits: [{ id: 'a', name: 'Read' }] }, l = { habits: [{ id: 'a', name: 'Read 10' }] }, r = { habits: [{ id: 'a', name: 'Read 20' }] };
  assert.strictEqual(T.merge3(b, l, r, true).habits[0].name, 'Read 10'); assert.strictEqual(T.merge3(b, l, r, false).habits[0].name, 'Read 20');
});
test('sync in: no agreed copy takes the incoming save; a change only here is kept and written out', () => {
  const S0 = T.empty(); S0.habits.push({ id: 'a', name: 'Read', type: 'daily', color: '#9cc96b' }); T.setS(S0);
  const base = JSON.stringify(T.getS()), inc = JSON.parse(base); inc.at = 5;
  assert.strictEqual(T.syncIn(inc, null).out, false);
  T.getS().habits[0].name = 'Read more'; const r = T.syncIn(inc, base); assert.strictEqual(r.out, true); assert.strictEqual(r.s.habits[0].name, 'Read more');
});


test('Google Drive uploads avoid multipart (the Android WebView fails those before they reach Google)', () => {
  assert.ok(!/uploadType=multipart/.test(fs.readFileSync(path.join(www, 'js', 'cloud.js'), 'utf8')));
});


// Google Calendar events as tasks: all-day dates stay, timed events land on this device's local day and time
test('calendar: all-day events keep their date, cancelled and broken ones are dropped', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(T.gEvent({ id: 'a', summary: 'Holiday', start: { date: '2026-03-10' } }))), { uid: 'g:a', day: '2026-03-10', time: '', text: 'Holiday' });
  assert.strictEqual(T.gEvent({ id: 'b', status: 'cancelled', start: { date: '2026-03-10' } }), null);
  assert.strictEqual(T.gEvent({ id: 'c' }), null);
  assert.strictEqual(T.gEvent({ id: 'd', start: { dateTime: 'not a date' } }), null);
  assert.strictEqual(T.gEvent({ id: 'e', start: { date: '2026-03-10' } }).text, '', 'no title stays empty (applyCalendar shows "(No title)")');
});
test('calendar: a late-evening event in another time zone lands on the next day here', () => {
  const was = process.env.TZ; process.env.TZ = 'Europe/Lisbon';
  try {
    const x = T.gEvent({ id: 'f', summary: 'Call', start: { dateTime: '2026-03-10T23:30:00-08:00' } }); // 07:30 the next morning in Lisbon (UTC+0 in March)
    assert.strictEqual(x.day, '2026-03-11'); assert.strictEqual(x.time, '07:30');
    const y = T.gEvent({ id: 'g', summary: 'Late', start: { dateTime: '2026-07-01T23:59:00+01:00' } }); // summer: Lisbon is UTC+1, same moment
    assert.strictEqual(y.day, '2026-07-01'); assert.strictEqual(y.time, '23:59');
  } finally { if (was === undefined) delete process.env.TZ; else process.env.TZ = was; }
});
test('calendar: more than one page of events is read to the end', async () => {
  const pages = { '': { items: [{ id: '1', start: { date: '2026-03-01' } }], nextPageToken: 'p2' }, p2: { items: [{ id: '2', start: { date: '2026-03-02' } }] } };
  let calls = 0;
  sandbox.fetch = async url => { calls++; const tok = new URL(url).searchParams.get('pageToken') || ''; return { ok: true, status: 200, json: async () => pages[tok] }; };
  const evs = await T.cloud().calEvents('2026-02-01', '2026-04-30');
  assert.deepStrictEqual(Array.from(evs, e => e.uid), ['g:1', 'g:2']); assert.strictEqual(calls, 2);
});

Promise.all(pending).then(() => { console.log(`\n${n - fails} of ${n} unit tests passed`); process.exit(fails ? 1 : 0); });
