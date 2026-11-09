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
;globalThis.__T={freezeOf,curStreak,repeatDates,gPct,gForecast,gLine,clean,backupProblem,missTwice,chDone,chLine,histStep,
  setToday:d=>{TODAY=d},setS:x=>{S=x;fzCache.clear()},getS:()=>S,dk,addDays,empty,parseIcs:typeof parseIcs==='function'?parseIcs:null};`, sandbox, { filename: 'app' });
const T = sandbox.__T;

let fails = 0, n = 0;
const test = (name, fn) => { n++; try { fn(); console.log('PASS ' + name); } catch (e) { fails++; console.log('FAIL ' + name + '\n  ' + e.message); } };
const same = (a, b) => assert.deepStrictEqual(Array.from(a), b); // arrays from the sandbox are another realm's Array
const day = s => new Date(s + 'T00:00');
const habit = (log, extra) => { const S = T.empty(); const h = Object.assign({ id: 'h1', name: 'Read', type: 'daily', color: '#9cc96b', target: 1, per: 7, track: 'check' }, extra); S.habits.push(h); S.log.h1 = log; T.setS(S); return h; };
const days = (from, n, skip = []) => { const o = {}; for (let i = 0; i < n; i++) { const k = T.dk(T.addDays(day(from), i)); if (!skip.includes(k)) o[k] = 1; } return o; };

T.setToday(day('2026-03-18'));

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
test('undo history: undo and redo step through saved changes', () => {
  habit({}); const S = T.getS(); sandbox.save(); S.habits[0].name = 'One'; sandbox.save();
  T.getS().habits[0].name = 'Two'; sandbox.save(); // a burst within 1.5 s is one step
  assert.ok(T.histStep(true)); assert.strictEqual(T.getS().habits[0].name, 'Read');
  assert.ok(T.histStep(false)); assert.strictEqual(T.getS().habits[0].name, 'Two');
});

console.log(`\n${n - fails} of ${n} unit tests passed`);
process.exit(fails ? 1 : 0);
