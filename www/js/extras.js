/* Groundwork Habits: Import from other apps, in-app pickers, calendar feeds.
   The js/ files are classic scripts loaded in order (index.html) and share one scope, like one big file. */
'use strict';
/* ---------- import from other apps (merged into the current data, never replacing it) ----------
   Loop Habit Tracker (its export .zip, or Checkmarks.csv from it), Habitica (data export .json), and any .csv:
   wide (a date column, then one column per habit) or long (date, name, done/status rows, as this app's own spreadsheet export). */
const csvRows=t=>{const out=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];
  if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
  else if(c==='"')q=true;else if(c===','||c===';'&&!t.includes(',')){row.push(f);f=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(f);if(row.some(x=>x.trim()))out.push(row);row=[];f=''}else f+=c}
  row.push(f);if(row.some(x=>x.trim()))out.push(row);return out};
// a date in most export formats: 2026-03-18, 18/03/2026, 2026-03-18T10:00:00Z, or milliseconds
function impDate(v){v=String(v||'').trim();let m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);if(m)return dkey(+m[1],+m[2]-1,+m[3]);
  m=/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(v);if(m)return dkey(+m[3],+m[2]-1,+m[1]);
  if(/^\d{12,14}$/.test(v)){const d=new Date(+v);if(!isNaN(d))return dk(d)}return null}
// the files of a .zip (stored or deflated), read with the browser's own decompressor
async function unzip(buf){const v=new DataView(buf),u8=new Uint8Array(buf),out={};let e=buf.byteLength-22;while(e>=0&&v.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('zip');
  let p=v.getUint32(e+16,true);const n=v.getUint16(e+10,true);
  for(let i=0;i<n;i++){if(v.getUint32(p,true)!==0x02014b50)break;const meth=v.getUint16(p+10,true),csz=v.getUint32(p+20,true),nl=v.getUint16(p+28,true),xl=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),off=v.getUint32(p+42,true);
    const name=new TextDecoder().decode(u8.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;if(name.endsWith('/')||csz>20e6)continue;
    const lo=off+30+v.getUint16(off+26,true)+v.getUint16(off+28,true),raw=u8.subarray(lo,lo+csz);
    out[name]=meth===0?new TextDecoder().decode(raw):meth===8?await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text():null}
  return out}
const TRUE=/^(1|2|y|yes|x|true|done|completed|✓|✔)$/i;
function impWide(rows,loop){const H=rows[0].slice(1),hs=H.map(n=>({name:String(n).trim(),log:{},amt:{},num:false}));
  rows.slice(1).forEach(r=>{const k=impDate(r[0]);if(!k)return;H.forEach((_,j)=>{const raw=String(r[j+1]||'').trim(),x=+raw;if(!raw)return;
    if(loop){if(x===2)hs[j].log[k]=1;else if(x>3||x<-1){hs[j].num=true;if(x>0)hs[j].amt[k]=x/1000}}else if(TRUE.test(raw))hs[j].log[k]=1}),0});
  return {habits:hs.filter(h=>h.name&&(Object.keys(h.log).length||Object.keys(h.amt).length)),tasks:[]}}
function impLong(rows){const hd=rows[0].map(x=>String(x).trim().toLowerCase()),col=re=>hd.findIndex(x=>re.test(x));
  const di=col(/^(date|day|datum|fecha|data)$/),ni=col(/^(item|habit|name|task|title)$/),si=col(/^(status|done|completed|value|result)$/),ti=col(/^type$/);
  if(di<0||ni<0)return null;const by={},tasks=[];
  rows.slice(1).forEach(r=>{const k=impDate(r[di]),nm=String(r[ni]||'').trim(),st=String(si<0?'done':r[si]||'').trim(),ty=ti<0?'habit':String(r[ti]||'').toLowerCase();if(!k||!nm)return;
    if(/^task/.test(ty)){tasks.push({k,text:nm.slice(0,100),done:/^(done|1|yes|true|completed)$/i.test(st)});return}
    if(!/^habit/.test(ty))return;const h=by[nm]=by[nm]||{name:nm,log:{},amt:{}};if(/^(done|completed)$/i.test(st)||TRUE.test(st))h.log[k]=1});
  return {habits:Object.values(by),tasks}}
function impHabitica(j){const T=j.tasks||{},hs=[],tasks=[];
  (T.dailys||[]).forEach(d=>{const h={name:String(d.text||'').trim().slice(0,60),log:{},amt:{}};(d.history||[]).forEach(x=>{const k=impDate(x.date);if(k&&x.completed)h.log[k]=1});if(h.name)hs.push(h)});
  (T.todos||[]).forEach(t=>{if(t.completed||!t.text)return;const k=impDate(t.date)||dk(TODAY);tasks.push({k:k<dk(TODAY)?dk(TODAY):k,text:String(t.text).trim().slice(0,100),done:false})});
  return {habits:hs,tasks}}
async function parseExternal(file){const nm=file.name.toLowerCase();
  if(nm.endsWith('.json')){const j=JSON.parse(await file.text());if(j&&j.tasks&&(j.tasks.dailys||j.tasks.todos))return Object.assign(impHabitica(j),{src:'Habitica'});throw new Error('json')}
  if(nm.endsWith('.zip')){const f=await unzip(await file.arrayBuffer()),key=Object.keys(f).find(k=>/(^|\/)Checkmarks\.csv$/i.test(k)&&k.split('/').length<=2);if(!key)throw new Error('zip');return Object.assign(impWide(csvRows(f[key]),true),{src:'Loop Habit Tracker'})}
  const rows=csvRows((await file.text()).replace(/^\uFEFF/,''));if(rows.length<2)throw new Error('csv');
  const long=impLong(rows);if(long&&(long.habits.length||long.tasks.length))return Object.assign(long,{src:'CSV'});
  if(impDate(rows[1][0])){const loop=rows.slice(1).some(r=>r.slice(1).some(x=>/^(-1|2|3)$/.test(String(x).trim())));return Object.assign(impWide(rows,loop),{src:loop?'Loop Habit Tracker':'CSV'})}
  throw new Error('csv')}
// merge: a habit with the same name (any case) gets the extra days; others are added as daily habits
function mergeExternal(d){let nh=0,nc=0,nt=0;
  d.habits.forEach((x,i)=>{let h=S.habits.find(y=>y.name.toLowerCase()===x.name.toLowerCase());
    if(!h){const amt=Object.keys(x.amt).length>0&&x.num;h={id:uid(),name:x.name.slice(0,60),type:'daily',color:COLORS[(S.habits.length+i)%COLORS.length],target:1,per:7,track:amt?'amount':'check',unit:'',goal:0,rem:null};S.habits.push(h);S.log[h.id]={};nh++}
    const l=L(h);Object.keys(x.log).forEach(k=>{if(!l[k]){l[k]=1;nc++}});
    if(Object.keys(x.amt).length){const a=S.amt[h.id]=S.amt[h.id]||{};Object.keys(x.amt).forEach(k=>{a[k]=Math.round(x.amt[k]*100)/100})}});
  d.tasks.slice(0,2000).forEach(t=>{const day=S.tasks[t.k]=S.tasks[t.k]||{items:[],mind:null};if(day.items.some(i=>i.text===t.text))return;day.items.push({id:uid(),text:t.text,done:t.done});nt++});
  return {nh,nc,nt}}
/* ---------- in-app pickers ----------
   Every date, time, date+time and dropdown field opens the app's own picker instead of the system pop-up (Android's grey dialogs,
   Windows' list). The field keeps its value and gets the usual input/change events, so the code that reads it is unchanged. */
let pk=null; // {el,type,y,m,d,hh,mm}
const PKSEL='input[type=date],input[type=time],input[type=datetime-local],select';
function pkOpen(el){const t=el.tagName==='SELECT'?'select':el.type,v=el.value||'',n=new Date();
  const dm=/^(\d{4})-(\d{2})-(\d{2})/.exec(v),tm=/(\d{2}):(\d{2})$/.exec(v);
  pk={el,type:t,y:dm?+dm[1]:n.getFullYear(),m:dm?+dm[2]-1:n.getMonth(),d:dm?+dm[3]:null,hh:tm?+tm[1]:9,mm:tm?+tm[2]:0};pkDraw()}
function pkClose(){pk=null;const w=$('#pick');if(w){w.hidden=true;w.innerHTML=''}}
function pkSet(v){const el=pk.el;el.value=v;pkClose();el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));if(document.contains(el))el.focus({preventScroll:true})}
function pkCal(){const f=new Date(pk.y,pk.m,1),lead=f.getDay(),n=dim(pk.y,pk.m),mn=pk.el.min||'',mx=pk.el.max||'',sel=pk.d?dkey(pk.y,pk.m,pk.d):'',tod=dk(TODAY);
  let g='';for(let i=0;i<lead;i++)g+='<span></span>';
  for(let d=1;d<=n;d++){const k=dkey(pk.y,pk.m,d),off=(mn&&k<mn.slice(0,10))||(mx&&k>mx.slice(0,10));
    g+='<button class="pkd'+(k===sel?' on':'')+(k===tod?' now':'')+'" data-act="pkday" data-v="'+d+'"'+(off?' disabled':'')+' aria-label="'+d+' '+MONTHS[pk.m]+'" aria-pressed="'+(k===sel)+'">'+d+'</button>'}
  return '<div class="pkh"><button class="pkn" data-act="pkmon" data-v="-1" aria-label="Previous month">'+ic('prev')+'</button><b><span>'+MONTHS[pk.m]+'</span> '+pk.y+'</b><button class="pkn" data-act="pkmon" data-v="1" aria-label="Next month">'+ic('next')+'</button></div>'
   +'<div class="pkw">'+DAYS.map(x=>'<span>'+new Intl.DateTimeFormat(LANG,{weekday:'narrow'}).format(new Date(2026,2,1+DAYS.indexOf(x)))+'</span>').join('')+'</div><div class="pkg">'+g+'</div>'}
const pkCol=(k,n,cur)=>'<div class="pkc" role="listbox" aria-label="'+(k==='hh'?'Hour':'Minute')+'">'+Array.from({length:n},(_,i)=>'<button role="option" class="'+(i===cur?'on':'')+'" aria-selected="'+(i===cur)+'" data-act="pktime" data-k="'+k+'" data-v="'+i+'">'+p2(i)+'</button>').join('')+'</div>';
function pkDraw(){let w=$('#pick');if(!w){w=document.createElement('div');w.id='pick';document.body.appendChild(w)}
  const t=pk.type,el=pk.el,lbl=(el.getAttribute('aria-label')||((el.labels&&el.labels[0])||{}).textContent||'').trim();let body='',foot='';
  if(t==='select'){body='<div class="pkl" role="listbox">'+[...el.options].map((o,i)=>'<button role="option" class="'+(o.selected?'on':'')+'" aria-selected="'+o.selected+'" data-act="pkopt" data-v="'+i+'"'+(o.disabled?' disabled':'')+'><span>'+esc(o.textContent)+'</span>'+(o.selected?CHECK:'')+'</button>').join('')+'</div>'}
  else{if(t!=='time')body+=pkCal();
    if(t!=='date')body+='<div class="pkt">'+pkCol('hh',24,pk.hh)+'<b>:</b>'+pkCol('mm',60,pk.mm)+'</div>';
    foot='<div class="pkf">'+(el.required?'':'<button class="btn ghost" data-act="pkclear">Clear</button>')+(t!=='time'?'<button class="btn ghost" data-act="pktoday">Today</button>':'')+'<span></span><button class="btn ghost" data-act="pkcancel">Cancel</button><button class="btn" data-act="pkok"'+(t!=='time'&&!pk.d?' disabled':'')+'>Set</button></div>'}
  w.innerHTML='<div class="pkov" data-act="pkcancel"></div><div class="pkbox pk-'+t+'" role="dialog" aria-modal="true" aria-label="'+esc(lbl||'Choose')+'">'+(lbl?'<div class="pkt0">'+esc(lbl)+'</div>':'')+body+foot+'</div>';
  trDom(w);w.hidden=false;w.querySelectorAll('.pkc .on').forEach(b=>b.parentNode.scrollTop=b.offsetTop-b.parentNode.clientHeight/2+b.offsetHeight/2);
  const f=w.querySelector('.pkl .on,.pkd.on,.pkd.now,.pkc .on,.pkbox button:not([disabled])');if(f)f.focus({preventScroll:true})}
function pkAct(act,t){if(!pk)return;const T=pk.type;
  if(act==='pkcancel')return pkClose();
  if(act==='pkopt'){pk.el.selectedIndex=+t.dataset.v;return pkSet(pk.el.value)}
  if(act==='pkmon'){pk.m+=+t.dataset.v;if(pk.m<0){pk.m=11;pk.y--}if(pk.m>11){pk.m=0;pk.y++}return pkDraw()}
  if(act==='pktoday'){pk.y=TODAY.getFullYear();pk.m=TODAY.getMonth();pk.d=TODAY.getDate();if(T==='date')return pkSet(dk(TODAY));return pkDraw()}
  if(act==='pkday'){pk.d=+t.dataset.v;if(T==='date')return pkSet(dkey(pk.y,pk.m,pk.d));return pkDraw()}
  if(act==='pktime'){pk[t.dataset.k]=+t.dataset.v;t.parentNode.querySelectorAll('button').forEach(b=>{const on=b===t;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});return}
  if(act==='pkclear')return pkSet('');
  if(act==='pkok'){const tm=p2(pk.hh)+':'+p2(pk.mm);return pkSet(T==='time'?tm:dkey(pk.y,pk.m,pk.d)+(T==='datetime-local'?'T'+tm:''))}}
// pointer: stop the system pop-up and open ours; keyboard: Enter, Space or Alt+Down on the field opens ours too (typing a date still works)
document.addEventListener('pointerdown',e=>{const el=e.target.closest&&e.target.closest(PKSEL);if(el&&!el.disabled&&!el.closest('#pick'))e.preventDefault()},true);
// Android's web view opens its own dialog from the touch itself, so on touch screens ours opens at touchstart (that also cancels the click)
document.addEventListener('touchstart',e=>{const el=e.target.closest&&e.target.closest(PKSEL);if(!el||el.disabled||el.closest('#pick'))return;e.preventDefault();pkOpen(el)},{capture:true,passive:false});
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('#pick [data-act]');if(t){e.stopPropagation();pkAct(t.dataset.act,t);return}
  const el=e.target.closest&&e.target.closest(PKSEL);if(!el||el.disabled)return;e.preventDefault();pkOpen(el)},true);
document.addEventListener('keydown',e=>{if(pk&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();pkClose();return}
  const el=e.target;if(!el.matches||!el.matches(PKSEL))return;
  if(e.key==='Enter'||(el.tagName==='SELECT'&&(e.key===' '||e.key==='F4'))||(e.altKey&&e.key==='ArrowDown')){e.preventDefault();e.stopImmediatePropagation();pkOpen(el)}},true);

// Android back: close what's open (dialog, menu, task input, colour sliders), leave Settings or step out of a settings section; anywhere else a second back within 2 s leaves the app
let backAt=0;
function onBack(){
  if(pk){pkClose();return}
  if(!locked){
    if(modal){if(modal.kind==='tips')try{localStorage.setItem('groundwork-tips','1')}catch(_){}modal=null;render();return}
    if(menuOpen||insMenu||addingTask||(cpOpen.accent&&view==='settings')){menuOpen=false;insMenu=null;addingTask=null;cpOpen={};render();return}
    if(view==='settings'){location.hash=setSec&&!wideSet()?'settings':setBack;return}}
  if(Date.now()-backAt<2000){if(NB&&NB.exitApp)NB.exitApp();return}
  backAt=Date.now();toast('Press back again to leave');
}
if(NB&&!WIDGET)NB.addListener('back',onBack);
window.addEventListener('hashchange',()=>{
  const v=(location.hash||'#habits').slice(1),was=view;
  if(!WIDGET&&routeTo(v)){menuOpen=false;insMenu=null;addingTask=null;modal=null;if(view==='settings'&&was!=='settings'){setBack=was;setQ=''}render();
    if(view==='settings'&&was==='settings'&&setSec&&wideSet()){const e=$('#set-'+setSec);if(e){markSec(setSec);spyHold=Date.now()+1200;e.scrollIntoView({block:'start',behavior:'smooth'})}}else window.scrollTo(0,0)}
});
async function shareFile(text,name,type,title,done){
  if(NB&&NB.saveFile){try{const r=await NB.saveFile(text instanceof Blob?{name,type,base64:await new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(String(f.result).split(',')[1]);f.readAsDataURL(text)})}:{name,type,text});if(r&&r.saved)toast('Saved '+name)}catch(e){toast('Export failed')}return} // Android: pick where to save
  try{
    if(/Android|iPhone|iPad/i.test(navigator.userAgent)&&navigator.canShare){
      const file=new File([text],name,{type});
      if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title});return}
    }
  }catch(err){if(err&&err.name==='AbortError')return}
  try{
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;
    document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);toast(done);
  }catch(err){toast('Export failed')}
}
// spreadsheet export; cells that start with = + - @ are prefixed so spreadsheets don't run them as formulas
function toCsv(){
  const q=v=>{v=String(v==null?'':v);if(/^[=+\-@]/.test(v))v="'"+v;return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v},rows=[['Type','Date','Item','Status','Value','Note']];
  S.habits.forEach(h=>{const l=L(h),c=S.count[h.id]||{},n=S.notes[h.id]||{},a=S.amt[h.id]||{};new Set([...Object.keys(l),...Object.keys(c),...Object.keys(n),...Object.keys(a)]).forEach(k=>rows.push(['Habit ('+h.type+')',k,h.name,l[k]?'done':'partial',a[k]?a[k]+' '+(h.unit||''):l[k]?(h.target||1):(c[k]||''),n[k]||'']))});
  Object.keys(S.tasks).sort().forEach(k=>{const t=S.tasks[k];vis(t.items).forEach(i=>rows.push([i.cal?'Calendar event':'Task',k,i.text,i.done?'done':k<dk(TODAY)?'missed':'open','','']));
    if(t.mind)rows.push(['Mindset',k,'Energy / Focus / Motivation','',t.mind.energy+' / '+t.mind.focus+' / '+t.mind.motivation,''])});
  S.goals.forEach(g=>{const p=gPct(g);rows.push(['Goal',g.due||'',g.title,p>=100?'completed':'in progress',p+'%'+(gLine(g)?' ('+gLine(g).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&')+')':''),g.area])});
  S.quits.forEach(x=>rows.push(['Streak',x.since.slice(0,10),x.name,'',qDays(x)+' days','best '+Math.max(x.best||0,qDays(x))+' days']));
  Object.entries(S.journal).forEach(([k,v])=>{if(v)rows.push(['Reflection',k,'','','',v])});
  return '\ufeff'+rows.map(r=>r.map(q).join(',')).join('\r\n');
}
// the backup file: encrypted with the PIN's key when a PIN is set (import asks for that PIN)
async function backupText(){const j=JSON.stringify(S,null,1);return encOn()&&encKey?encText(j,encKey,P.lock.salt):j}
async function exportData(){const t=await backupText();shareFile(t,'groundwork-backup-'+dk(TODAY)+(isEnc(t)?'-encrypted':'')+'.json','application/json','Groundwork Habits backup',isEnc(t)?'Encrypted backup downloaded. Importing it asks for your PIN':'Backup downloaded')}
// weekly automatic backup: desktop to <data folder or app data>/backups, Android to the chosen folder's backups or app storage; newest 8 kept
async function autoBackup(force){
  if(encWait||locked&&!encKey||WIDGET||!hasData())return;const can=DFS&&DFS.backup||NB&&NB.backup;if(!can)return;
  const every=P.bakEvery===undefined?7:P.bakEvery;if(!force&&(!every||Date.now()-(P.bakAt||0)<every*864e5))return;
  try{const t=await backupText(),name='groundwork-backup-'+dk(TODAY)+'.json',where=DFS&&DFS.backup?await DFS.backup(name,t):(await NB.backup({name,text:t})).where;
    if(where){P.bakAt=Date.now();P.bakWhere=String(where).slice(0,300);applyPrefs();if(force)toast('Backup saved')}else if(force)toast('Backup failed')}catch(e){if(force)toast('Backup failed')}}
// a plain-text report for bug reports: version, platform, sizes and recent errors; never names, notes or other content
function diagText(){const n=o=>Object.keys(o||{}).length;
  return ['Groundwork Habits '+APPV+(TESTING?' (test build)':''),'Platform: '+(DFS?'desktop':NB?'android':'web')+' · '+navigator.userAgent,'Language: '+LANG+' · theme '+P.theme+' · screen '+innerWidth+'x'+innerHeight,
    'Data: '+S.habits.length+' habits, '+n(S.tasks)+' task days, '+S.goals.length+' goals, '+S.quits.length+' streaks, '+JSON.stringify(S).length+' bytes'+(P.lock?' · PIN on':'')+(dataDir||P.andDir?' · data folder on':''),
    'Features off: '+(FEAT.filter(f=>!feat(f[0])).map(f=>f[0]).join(', ')||'none'),'Recent errors:'].concat(ERRS.length?ERRS:['none']).join('\n')}
// checks a backup's shape before anything is replaced; clean() then keeps only known fields
function backupProblem(d){const o=x=>x===undefined||(x&&typeof x==='object'&&!Array.isArray(x)),a=x=>x===undefined||Array.isArray(x);
  if(!d||typeof d!=='object'||Array.isArray(d)||!Array.isArray(d.habits))return 'That file is not a Groundwork Habits backup';
  if(+d.v>DATA_V)return 'This backup is from a newer version of Groundwork Habits. Update the app, then import it';
  if(!o(d.log)||!o(d.tasks)||!a(d.goals)||!a(d.quits)||!o(d.journal)||!o(d.notes)||!o(d.count)||!o(d.amt))return 'That backup is damaged, so nothing was changed';
  return null}
function applyImport(d){const bad=backupProblem(d);if(bad){toast(bad);return}S=clean(d);save();if(view==='settings')location.hash=setBack;render();toastAct('Backup restored','Undo','histundo')}

/* ---------- Google Calendar (no login) ----------
   In: the desktop app reads a calendar's "secret address in iCal format" and mirrors its events into tasks.
   Out: tasks export as an .ics file the user imports in Google Calendar (same UIDs, so re-importing updates). */
const icsEsc=t=>String(t).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
const icsUnesc=t=>t.replace(/\\n/gi,' ').replace(/\\([,;\\])/g,'$1');
function tasksToIcs(){
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Groundwork Habits//Tasks//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:Groundwork Habits tasks'],stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  Object.keys(S.tasks).sort().forEach(k=>S.tasks[k].items.forEach(it=>{if(it.cal||!it.text.trim())return; // calendar events stay in the calendar
    const d=k.replace(/-/g,''),n=dk(addDays(new Date(k+'T00:00'),1)).replace(/-/g,'');
    L.push('BEGIN:VEVENT','UID:'+it.id+'@groundwork','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+d,'DTEND;VALUE=DATE:'+n,'SUMMARY:'+icsEsc((it.done?'[done] ':'')+it.text),'TRANSP:TRANSPARENT','END:VEVENT')}));
  L.push('END:VCALENDAR');return L.join('\r\n')+'\r\n';
}
// parse VEVENTs into {uid,text,day}; shortcut: recurring events (RRULE) only appear on their first date, expand RRULE if users need repeats
// a DTSTART / UNTIL / EXDATE value as a Date: UTC (Z) and TZID times are converted to this device's time zone; floating times stay as written
const WINTZ={'W. Europe Standard Time':'Europe/Berlin','GMT Standard Time':'Europe/London','Romance Standard Time':'Europe/Paris','Central Europe Standard Time':'Europe/Budapest','Central European Standard Time':'Europe/Warsaw',
  'E. Europe Standard Time':'Europe/Chisinau','GTB Standard Time':'Europe/Athens','FLE Standard Time':'Europe/Kiev','Russian Standard Time':'Europe/Moscow','Eastern Standard Time':'America/New_York','Central Standard Time':'America/Chicago',
  'Mountain Standard Time':'America/Denver','Pacific Standard Time':'America/Los_Angeles','E. South America Standard Time':'America/Sao_Paulo','India Standard Time':'Asia/Kolkata','China Standard Time':'Asia/Shanghai',
  'Tokyo Standard Time':'Asia/Tokyo','AUS Eastern Standard Time':'Australia/Sydney','UTC':'UTC','Coordinated Universal Time':'UTC'};
function zoned(y,mo,d,h,mi,s,tz){
  tz=WINTZ[tz]||(String(tz).match(/([A-Za-z_]+\/[A-Za-z_+-]+(?:\/[A-Za-z_]+)?)$/)||[])[1]||tz;
  try{const f=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}),
    off=t=>{const p={};f.formatToParts(new Date(t)).forEach(x=>p[x.type]=x.value);return Date.UTC(+p.year,p.month-1,+p.day,+p.hour%24,+p.minute,+p.second)-t},w=Date.UTC(y,mo-1,d,h,mi,s);
    let t=w-off(w);t=w-off(t);return new Date(t)}catch(e){return null}} // unknown zone name: caller falls back to local time
function icsDate(v,tz){const m=String(v).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);if(!m)return null;
  if(m[7])return new Date(Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5],+m[6]));
  if(m[4]&&tz){const z=zoned(+m[1],+m[2],+m[3],+m[4],+m[5],+m[6],tz);if(z)return z}
  return new Date(+m[1],m[2]-1,+m[3],+(m[4]||0),+(m[5]||0))}
const icsTz=key=>(key.match(/;TZID=("?)([^;:"]+)\1/i)||[])[2]||'';
function parseIcs(txt){
  const lines=txt.replace(/\r?\n[ \t]/g,'').split(/\r?\n/),evs=[];let ev=null;
  for(const ln of lines){
    if(ln==='BEGIN:VEVENT'){ev={ex:new Set()};continue}
    if(ln==='END:VEVENT'){if(ev&&ev.uid&&ev.day&&ev.status!=='CANCELLED')evs.push(ev);ev=null;continue}
    if(!ev)continue;
    const i=ln.indexOf(':');if(i<0)continue;const rk=ln.slice(0,i),key=rk.toUpperCase(),val=ln.slice(i+1),name=key.split(';')[0];
    if(name==='UID')ev.uid=val.trim();
    else if(name==='SUMMARY')ev.text=icsUnesc(val).trim();
    else if(name==='STATUS')ev.status=val.trim().toUpperCase();
    else if(name==='RRULE')ev.rrule=val.trim().toUpperCase();
    else if(name==='EXDATE')val.split(',').forEach(x=>{const d=icsDate(x.trim(),icsTz(rk));if(d)ev.ex.add(dk(d))});
    else if(name==='RECURRENCE-ID'){const d=icsDate(val.trim(),icsTz(rk));if(d)ev.rid=dk(d)}
    else if(name==='DTSTART'){const d=icsDate(val,icsTz(rk));if(!d)continue;
      ev.day=dk(d);ev.time=/T\d{6}/.test(val)&&!/VALUE=DATE(?!-)/.test(key)?p2(d.getHours())+':'+p2(d.getMinutes()):''}
  }
  // repeating events: one task per date inside the synced window; a moved or edited single date (RECURRENCE-ID) replaces that date
  const lo=sod(addDays(TODAY,-30)),hi=sod(addDays(TODAY,90)),out=[],moved={};
  evs.forEach(e=>{if(e.rid)(moved[e.uid]=moved[e.uid]||new Set()).add(e.rid)});
  evs.forEach(e=>{
    if(e.rid){out.push(Object.assign({},e,{uid:e.uid+'_'+e.rid}));return}
    if(!e.rrule){out.push(e);return}
    const skip=moved[e.uid]||new Set();
    expandRule(e.rrule,new Date(e.day+'T00:00'),lo,hi).forEach(d=>{const k=dk(d);if(!e.ex.has(k)&&!skip.has(k))out.push(Object.assign({},e,{day:k,uid:e.uid+'_'+k}))});
  });
  return out;
}
// dates an RRULE produces between lo and hi (DAILY, WEEKLY, MONTHLY, YEARLY with INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY)
// shortcut: BYMONTH, BYSETPOS and WKST are ignored; rare in personal calendars
function expandRule(rule,s,lo,hi){
  const r={};rule.split(';').forEach(p=>{const q=p.split('=');r[q[0]]=q[1]||''});
  const WD={SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6},iv=Math.max(1,parseInt(r.INTERVAL)||1),cnt=parseInt(r.COUNT)||0,until=r.UNTIL?icsDate(r.UNTIL):null;
  const by=(r.BYDAY||'').split(',').map(x=>x.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/)).filter(Boolean).map(m=>({n:parseInt(m[1])||0,w:WD[m[2]]}));
  const bmd=(r.BYMONTHDAY||'').split(',').map(Number).filter(x=>x&&Math.abs(x)<=31);
  const out=[];let n=0;
  const i0=r.FREQ==='DAILY'&&!cnt?Math.max(0,Math.floor((lo-s)/864e5/iv)-1):0; // long-running daily events: start near the window
  for(let i=i0;i<i0+5000;i++){
    let c=[];
    if(r.FREQ==='DAILY')c=[addDays(s,i*iv)];
    else if(r.FREQ==='WEEKLY'){const w0=addDays(s,-s.getDay()+i*iv*7);c=(by.length?by.map(b=>b.w):[s.getDay()]).map(w=>addDays(w0,w))}
    else if(r.FREQ==='MONTHLY'){const y=s.getFullYear(),m=s.getMonth()+i*iv,last=new Date(y,m+1,0).getDate();
      if(by.length)by.forEach(b=>{const all=[];for(let d=1;d<=last;d++){const x=new Date(y,m,d);if(x.getDay()===b.w)all.push(x)}
        if(!b.n)c.push(...all);else{const x=b.n>0?all[b.n-1]:all[all.length+b.n];if(x)c.push(x)}});
      else (bmd.length?bmd:[s.getDate()]).forEach(d=>{const dd=d>0?d:last+d+1;if(dd>=1&&dd<=last)c.push(new Date(y,m,dd))})}
    else if(r.FREQ==='YEARLY'){const x=new Date(s.getFullYear()+i*iv,s.getMonth(),s.getDate());if(x.getMonth()===s.getMonth())c=[x]}
    else return [s];
    c.sort((a,b)=>a-b);
    for(const d of c){if(d<s)continue;if(until&&d>until||cnt&&n>=cnt)return out;n++;if(d>hi)return out;if(d>=lo)out.push(d)}
    if(c.length&&c[0]>hi)return out;
  }
  return out;
}
// mirror events from 30 days back to 90 days ahead into tasks (a calendar task the user moved, pin=true, keeps its day); returns count of events applied
function applyCalendar(evs){
  const lo=dk(addDays(TODAY,-30)),hi=dk(addDays(TODAY,90)),seen=new Set(),where={};
  Object.keys(S.tasks).forEach(k=>S.tasks[k].items.forEach(it=>{if(it.cal)where[it.cal]={k,it}}));
  let n=0;
  evs.forEach(e=>{if(e.day<lo||e.day>hi||seen.has(e.uid))return;seen.add(e.uid);n++;
    const text=((e.time?e.time+' ':'')+(e.text||'(No title)')).slice(0,200),w=where[e.uid];
    if(w){w.it.text=text;if(w.k!==e.day&&!w.it.pin){S.tasks[w.k].items=S.tasks[w.k].items.filter(x=>x!==w.it);(S.tasks[e.day]=S.tasks[e.day]||{items:[],mind:null}).items.push(w.it)}}
    else (S.tasks[e.day]=S.tasks[e.day]||{items:[],mind:null}).items.push({id:uid(),text,done:false,cal:e.uid})});
  // events deleted in the calendar disappear here too (only inside the synced window)
  Object.keys(S.tasks).forEach(k=>{if(k<lo||k>hi)return;S.tasks[k].items=S.tasks[k].items.filter(it=>!it.cal||seen.has(it.cal))});
  return n;
}
async function pullCalendar(manual){
  if(!calFetch||!P.cal||encWait)return;
  let r;try{r=await calFetch(P.cal)}catch(e){}
  if(!r||!r.ok){if(manual)toast(r&&r.error?r.error:'Could not reach your calendar');return}
  const n=applyCalendar(parseIcs(r.text));P.calAt=Date.now();applyPrefs();save();if(!modal&&!addingTask)render();if(manual)toast(n+' calendar events synced');
}
