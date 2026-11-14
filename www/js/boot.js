/* Groundwork Habits: Clock refresh, reminders, notifications, service worker, first render.
   The js/ files are classic scripts loaded in order (index.html) and share one scope, like one big file. */
'use strict';
/* keep "today" correct if the app stays open past midnight */
function refreshToday(){
  autoBackup();andRead();pushWidget();if(applyRecurring()){save();render()}
  if(dataDir&&!save.t&&readFile())render(); // picks up changes synced from another device
  const n=sod(new Date());if(dk(n)===dk(TODAY))return;
  const wasCur=isCurM(vy,vm),wasWeek=dk(taskWeek)===dk(wkStart(TODAY));
  TODAY=n;if(wasCur){vy=n.getFullYear();vm=n.getMonth()}if(wasWeek)taskWeek=wkStart(n);
  render();
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday()});
// the heatmap fits its weeks to the width: redraw when the window size changes that number
window.addEventListener('resize',()=>{clearTimeout(heatCard.t);heatCard.t=setTimeout(()=>{if(view==='insights'&&!P.heatM&&!modal&&!drag){const w=clamp(Math.floor((Math.max(260,$('#main').clientWidth-48)+3)/14),8,53);if(w!==heatCard.w)render()}},200)});
window.addEventListener('focus',refreshToday);
window.addEventListener('storage',e=>{
  if(e.key===KEY&&e.newValue&&!encWait){if(isEnc(e.newValue)){if(encKey)decText(e.newValue,encKey).then(j=>{if(j!==JSON.stringify(S)){S=clean(JSON.parse(j));if(!modal&&!drag)render()}}).catch(()=>{})}
    else if(e.newValue!==JSON.stringify(S)){try{S=clean(JSON.parse(e.newValue));if(!modal&&!drag)render()}catch(_){}}}
  if(e.key==='groundwork-locked'){lockNow(false);return}
  if(e.key===PKEY&&e.newValue){try{const was=P.lock&&P.lock.salt;Object.assign(P,JSON.parse(e.newValue));if(P.lock&&P.lock.salt!==was){locked=true;encKey=null}if(!P.lock){P.lock=null;encKey=null}const d=document.documentElement;d.style.setProperty('--accent',P.accent);d.classList.toggle('light',P.theme==='light');d.classList.toggle('amoled',P.theme==='amoled');d.classList.toggle('notabnames',P.tabNames===false);if(!modal&&!drag)render()}catch(_){}}
});
if(TESTING)window.GroundworkTest={tx,parseExternal,mergeExternal,tplAdd,parseIcs,applyCalendar,tasksToIcs,state:()=>S,remCheck:()=>checkHabitReminders(),remSync:()=>syncReminders(),remTake:()=>takeAnswers()}; // smoke tests only
pullCalendar();let calTick=0;
// daily reminder: a notification at the chosen time if daily habits are still open (only while Groundwork Habits is running)
// Android app: a real daily notification scheduled with Capacitor Local Notifications (works when the app is closed)
const LN=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.LocalNotifications;
async function syncNativeReminder(){
  if(!LN)return;
  try{
    await LN.cancel({notifications:[{id:1}]}).catch(()=>{});
    if(!feat('reminder'))return;
    const pr=await LN.requestPermissions();if(pr.display!=='granted'){toast('Notifications are blocked. Allow them in Android settings');return}
    const [hour,minute]=(P.remTime||'21:00').split(':').map(Number);
    await LN.schedule({notifications:[{id:1,title:'Groundwork Habits',body:'Time to check in on today’s habits.',schedule:{on:{hour,minute},allowWhileIdle:true}}]});
  }catch(e){toast('Could not set the reminder')}
}
function checkReminder(){
  if(LN)return; // the Android app uses the scheduled notification instead
  if(!feat('reminder')||!('Notification' in window)||Notification.permission!=='granted')return;
  const n=new Date(),[hh,mm]=(P.remTime||'21:00').split(':').map(Number),k=dk(TODAY);
  if(P.remDay===k||n.getHours()*60+n.getMinutes()<hh*60+mm)return;
  P.remDay=k;applyPrefs();const t=doneToday();
  if(t.total&&t.done<t.total)try{new Notification('Groundwork Habits',{body:(t.total-t.done)+' of '+t.total+' habits still to do today. You’ve got this.',tag:'groundwork-reminder'})}catch(e){}
}
/* per-habit reminders: h.rem={t:'HH:MM', m:'ask'|'alarm'}. Android schedules real notifications with Yes/No buttons;
   desktop opens a small always-on-top pop-up, the web app shows a notification and an in-app question (only while running) */
const pKey=(h,d)=>h.type==='daily'?dk(d):h.type==='weekly'?wkey(d.getFullYear(),d.getMonth(),Math.ceil(d.getDate()/7)):mkey(d.getFullYear(),d.getMonth());
// notifications can hide what they are about (Settings > Features); the lock screen on Android always gets a plain version
const remTitle=(name,what)=>feat('remnames')?name:'Groundwork Habits',remBody=(q,what)=>tx(feat('remnames')?q:'A '+what+' reminder is waiting for your answer');
const perWord=h=>({daily:'today',weekly:'this week',monthly:'this month'})[h.type];
function remYes(id,k){const t=findT(id,k);if(t){t.done=true;save();render();return}const h=findH(id);if(!h||!/^\d{4}-\d{2}(-\d{2}|-W\d)?$/.test(k))return;L(h)[k]=1;if(S.count[h.id])delete S.count[h.id][k];save();render()}
// a reminder set after its time today starts tomorrow
function remSkipToday(id,rem){if(!rem)return;const n=new Date(),[hh,mm]=rem.t.split(':').map(Number);P.remFired=Object.assign({},P.remFired,{[id]:n.getHours()*60+n.getMinutes()>=hh*60+mm?dk(TODAY):''});applyPrefs()}
// a task reminder for today whose time has passed does not go off straight away
function remSkip(id,k,rem){const n=new Date(),[hh,mm]=rem.t.split(':').map(Number);if(k===dk(TODAY)&&n.getHours()*60+n.getMinutes()>=hh*60+mm){P.remFired=Object.assign({},P.remFired,{[id]:k});applyPrefs()}}
function remAsk(){if(!LN&&'Notification' in window&&Notification.permission==='default')Notification.requestPermission()}
function askHtml(id,k){const t=findT(id,k);if(t)return '<div class="ask"><div class="lbl">Task reminder</div><b>'+esc(t.text)+'</b><p class="sub">'+(t.done?'Already done. Nice work.':'Have you done it?')+'</p>'
    +'<div class="row"><button class="btn ghost" data-act="askno">'+(t.done?'Close':'No')+'</button>'+(t.done?'':'<button class="btn" data-act="askyes" data-h="'+t.id+'" data-k="'+k+'">Yes, done</button>')+'</div></div>';
  const h=findH(id);if(!h)return '<div class="ask"><p class="sub">This habit no longer exists.</p><div class="row"><button class="btn" data-act="askno">Close</button></div></div>';
  const done=!!L(h)[k];
  return '<div class="ask"><div class="lbl">Reminder</div><b>'+esc(h.name)+'</b><p class="sub">'+(done?'Already done '+perWord(h)+'. Nice work.':'Have you done it '+perWord(h)+'?')+'</p>'
    +'<div class="row"><button class="btn ghost" data-act="askno">'+(done?'Close':'No')+'</button>'+(done?'':'<button class="btn" data-act="askyes" data-h="'+h.id+'" data-k="'+k+'">Yes, done</button>')+'</div></div>'}
const goalDue=()=>{const o=[];S.goals.forEach(g=>{if(!g.due||g.arch||gPct(g)>=100)return;[[7,'is due in a week'],[0,'is due today']].forEach(([n,txt])=>{const d=addDays(new Date(g.due+'T00:00'),-n);d.setHours(9,0,0,0);o.push([g,'gd'+n+'-'+g.id,d,g.title+' '+txt])})});return o};
let alarmT=null;
function alarmStop(){clearInterval(alarmT);alarmT=null}
function alarmStart(){ // short beeps every 1.5 s for up to a minute
  alarmStop();let n=0;const beep=()=>{try{const A=alarmStart.a||(alarmStart.a=new (window.AudioContext||window.webkitAudioContext)()),o=A.createOscillator(),g=A.createGain();o.frequency.value=880;o.connect(g);g.connect(A.destination);g.gain.setValueAtTime(.2,A.currentTime);g.gain.exponentialRampToValueAtTime(.001,A.currentTime+.5);o.start();o.stop(A.currentTime+.5)}catch(e){}if(++n>=40)alarmStop()};
  beep();alarmT=setInterval(beep,1500)}
function checkHabitReminders(){
  if(LN||WIDGET||encWait)return;const n=new Date(),now=n.getHours()*60+n.getMinutes(),d=dk(TODAY);
  S.habits.forEach(h=>{if(!h.rem||h.arch)return;const [hh,mm]=h.rem.t.split(':').map(Number),k=pKey(h,TODAY);
    if(isRest(h,TODAY)||(P.remFired||{})[h.id]===d||now<hh*60+mm)return;P.remFired=Object.assign({},P.remFired,{[h.id]:d});applyPrefs();if(L(h)[k])return;
    if(DFS&&DFS.ask){DFS.ask(h.id,k);return}
    try{if('Notification' in window&&Notification.permission==='granted'){const x=new Notification(remTitle(h.name),{body:remBody('Have you done it '+perWord(h)+'?','habit'),tag:'groundwork-h-'+h.id,requireInteraction:true,silent:h.rem.m!=='alarm'});x.onclick=()=>{window.focus();x.close()}}}catch(e){}
    if(!modal&&!locked){modal={kind:'ask',h:h.id,k};render()}if(h.rem.m==='alarm')alarmStart()});
  goalDue().forEach(([g,key,at,txt])=>{if(dk(at)!==d||n<at||(P.remFired||{})[key]===d)return;P.remFired=Object.assign({},P.remFired,{[key]:d});applyPrefs();
    try{if('Notification' in window&&Notification.permission==='granted')new Notification('Groundwork Habits',{body:feat('remnames')?txt:'A goal deadline is coming up',tag:'groundwork-'+key})}catch(e){}toast(txt)});
  ((S.tasks[d]||{}).items||[]).forEach(it=>{if(!it.rem||it.done||it.hidden||it.cal)return;const [hh,mm]=it.rem.t.split(':').map(Number);
    if((P.remFired||{})[it.id]===d||now<hh*60+mm)return;P.remFired=Object.assign({},P.remFired,{[it.id]:d});applyPrefs();
    if(DFS&&DFS.ask){DFS.ask(it.id,d);return}
    try{if('Notification' in window&&Notification.permission==='granted'){const x=new Notification(remTitle(it.text),{body:remBody('Have you done it?','task'),tag:'groundwork-t-'+it.id,requireInteraction:true,silent:it.rem.m!=='alarm'});x.onclick=()=>{window.focus();x.close()}}}catch(e){}
    if(!modal&&!locked){modal={kind:'ask',h:it.id,k:d};render()}if(it.rem.m==='alarm')alarmStart()})}
if(ASK){const h=findH(ASK.h),t=findT(ASK.h,ASK.k);if(h&&h.rem&&h.rem.m==='alarm'&&!L(h)[ASK.k]||t&&t.rem&&t.rem.m==='alarm'&&!t.done)alarmStart()}
// Android: the GroundworkNative plugin posts the notifications; Yes/No are stored natively and applied here when the app runs
async function takeAnswers(){
  if(!NB||encWait)return;try{const r=await NB.takeAnswers();(r.answers||[]).forEach(a=>{if(a.a==='yes')remYes(a.h,a.k)})}catch(e){}
}
async function syncReminders(){
  if(!NB||WIDGET||encWait)return;
  try{
    const hs=S.habits.filter(h=>h.rem&&!h.arch),now0=new Date(),end=addDays(now0,14),ts=[];
    Object.keys(S.tasks).forEach(k=>{const d=new Date(k+'T00:00');if(d<sod(now0)||d>end)return;S.tasks[k].items.forEach(it=>{if(it.rem&&!it.done&&!it.hidden&&!it.cal)ts.push([k,it])})});
    if((hs.length||ts.length||S.goals.some(g=>g.due))&&LN){const pr=await LN.checkPermissions();if(pr.display!=='granted'&&(await LN.requestPermissions()).display!=='granted'){toast('Notifications are blocked. Allow them in Android settings');return}}
    // shortcut: schedules the next 14 days and reschedules on every change and app open; a phone left untouched for 2 weeks stops reminding
    const now=new Date(),items=[];
    hs.slice(0,25).forEach((h,i)=>{const [hh,mm]=h.rem.t.split(':').map(Number);
      for(let d=0;d<14;d++){const at=new Date(now.getFullYear(),now.getMonth(),now.getDate()+d,hh,mm),k=pKey(h,at);if(at<=now||L(h)[k]||isRest(h,at))continue;
        items.push({id:1000+i*20+d,at:at.getTime(),title:remTitle(h.name),body:remBody('Have you done it '+perWord(h)+'?','habit'),h:h.id,k,alarm:h.rem.m==='alarm',rep:h.type,yes:tx('Yes, done'),no:tx('No')})}});
    ts.slice(0,200).forEach(([k,it],n)=>{const [hh,mm]=it.rem.t.split(':').map(Number),at=new Date(k+'T00:00');at.setHours(hh,mm);if(at>now)items.push({id:2000+n,at:at.getTime(),title:remTitle(it.text),body:remBody('Have you done it?','task'),h:it.id,k,alarm:it.rem.m==='alarm',yes:tx('Yes, done'),no:tx('No')})});
    goalDue().forEach(([g,key,at,txt],n)=>{if(at>now&&at-now<60*864e5)items.push({id:4000+n,at:at.getTime(),title:'Groundwork Habits',body:tx(feat('remnames')?txt:'A goal deadline is coming up'),h:g.id,k:key,info:true})});
    const res=await NB.schedule({items});
    // Android 14+: alarms ring on time only with the user's OK, otherwise they can be a few minutes late
    if(res&&res.exact===false&&items.some(x=>x.alarm)&&!syncReminders.asked){syncReminders.asked=true;toastAct('Alarms may be a few minutes late','Allow exact alarms','exactok')}
  }catch(e){}
}
if(NB&&!WIDGET){NB.addListener('answer',takeAnswers);document.addEventListener('visibilitychange',()=>{if(!document.hidden)takeAnswers()})}
if(applyRecurring())save();
takeAnswers().then(syncReminders);
setTimeout(()=>{autoBackup();andRead()},3000);
checkReminder();checkHabitReminders();
// desktop updates: "Check for updates" (manual) or once a day when switched on. The installed app downloads the new
// setup, checks it and installs over itself (the old version is removed once the new one works); the portable app and
// macOS have no installer, so they open the release page
function updCheck(now,manual){if(!UPD||WIDGET||ASK||(!manual&&!P.updAuto))return;if(!now&&Date.now()-(P.updAt||0)<864e5)return;P.updAt=Date.now();applyPrefs();
  UPD.updateCheck().then(r=>{if(r&&r.ok&&r.update){updCheck.info=r;if(manual||!modal&&!encWait){modal={kind:'upd'};render()}else toastAct('Version '+r.version+' is available','See','updshow')}else if(now)toast(r&&r.ok?'You have the latest version':'Couldn’t check for updates')})}
// finish any pending save first: the app closes while the setup runs
async function updInstall(){const u=updCheck.info;if(!u)return;if(!u.auto){window.open(u.page,'_blank');return}toast('Downloading the update…');try{if(save.t)writeFile();await save.p}catch(e){}const r=await UPD.updateInstall();if(!r||!r.ok)toast(r&&r.error==='permission'?'Allow installs from Groundwork Habits, then tap Install again':(r&&r.error)||'Update failed')}
setTimeout(()=>updCheck(false),8000);
setInterval(()=>{refreshToday();checkReminder();checkHabitReminders();if(++calTick%15===0)pullCalendar();if(view==='achievements'&&!modal&&!menuOpen)render()},60000); // keep streak clocks ticking
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)&&!window.Capacitor&&!window.__TAURI_INTERNALS__){ // desktop and Android ship their files: no offline cache that could serve an old version
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
if(DEMO){document.body.insertAdjacentHTML('afterbegin','<div class="demobar" role="note"><span>'+tx('Demo with example data. Changes stay in this browser.')+'</span><button class="link" data-act="demoreset">'+tx('Reset')+'</button><a class="link" href="'+RELEASES+'" target="_blank" rel="noopener">'+tx('Get the app')+'</a></div>');document.documentElement.classList.add('isdemo')}
else if(!WIDGET&&!locked){try{if(!localStorage.getItem('groundwork-tips'))modal={kind:'tips'}}catch(e){}} // first open: show the tips once
// iPhone/iPad Safari: apps install from the Share sheet, which people rarely find; say so once
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
if(IOS&&!navigator.standalone&&!WIDGET&&!window.Capacitor)try{if(!localStorage.getItem('groundwork-ioshint'))setTimeout(()=>{localStorage.setItem('groundwork-ioshint','1');toastAct('Install it: tap Share, then Add to Home Screen','OK','toastclose')},4000)}catch(e){}
// the IndexedDB copy is newer than localStorage's (localStorage was full): use it
idbGet().then(r=>{if(!r||WIDGET)return;let at=0;try{at=+localStorage.getItem(KEY+'-at')||0;if(r.t===localStorage.getItem(KEY))return}catch(e){}if(r.at<=at)return;
  if(isEnc(r.t)){idbLate=r.t;return}try{S=clean(JSON.parse(r.t));histJ=histOf();if(!modal)render()}catch(e){}});
render();
