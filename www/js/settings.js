/* Groundwork Habits: Settings page, modals, quit streaks, desktop widget, search.
   The js/ files are classic scripts loaded in order (index.html) and share one scope, like one big file. */
'use strict';
/* ---------- settings page ---------- */
const wideSet=()=>innerWidth>760;
// one setting row: label, optional description, the control on the right; data-s holds extra words for search
const srow=(label,sub,ctl,extra)=>'<div class="srow"'+(extra?' data-s="'+esc(extra)+'"':'')+'><div class="sl"><span>'+label+'</span>'+(sub?'<small>'+sub+'</small>':'')+'</div><div class="sc">'+(ctl||'')+'</div></div>';
const sgrp=(title,rows,cls)=>rows?'<div class="sgrp'+(cls?' '+cls:'')+'">'+(title?'<div class="sgh">'+title+'</div>':'')+rows+'</div>':'';
const sw=(act,v,on,label)=>'<button class="sw2'+(on?' on':'')+'" data-act="'+act+'"'+(v!==undefined?' data-v="'+v+'"':'')+' role="switch" aria-checked="'+!!on+'" aria-label="'+esc(label)+'"><i></i></button>';
const sbtn=(act,label,cls)=>'<button class="btn ghost sbtn'+(cls?' '+cls:'')+'" data-act="'+act+'">'+label+'</button>';
const sgo=(act,label,sub,cls,extra)=>'<button class="srow sgo'+(cls?' '+cls:'')+'" data-act="'+act+'"'+(extra?' data-s="'+esc(extra)+'"':'')+'><div class="sl"><span>'+label+'</span>'+(sub?'<small>'+sub+'</small>':'')+'</div>'+ic('next')+'</button>';
const SETMETA={appearance:['pal','Appearance'],language:['globe','Language'],features:['sliders','Features'],reminders:['bell','Reminders'],calendar:['cal','Calendar'],data:['db','Data & backups'],security:['lock','Security'],about:['info','About']};
function setStatus(k){
  if(k==='appearance')return ({dark:'Dark',amoled:'AMOLED',light:'Light'})[P.theme||'dark']+' · '+((ACCENTS.find(a=>a[1]===P.accent)||['Custom'])[0])+' accent';
  if(k==='language')return P.lang?(LANGS.find(l=>l[0]===P.lang)||['','English'])[1]:'Same as this device';
  if(k==='features')return FEAT.filter(f=>f[0]!=='remnames'&&f[0]!=='reminder'&&feat(f[0])).length+' of '+(FEAT.length-2)+' on';
  if(k==='reminders')return feat('reminder')?'Daily at '+(P.remTime||'21:00'):'Daily reminder off';
  if(k==='calendar')return P.cal?'Connected':'Not connected';
  if(k==='data'){const e=P.bakEvery===undefined?7:P.bakEvery;return (e?({1:'Backs up every day',7:'Backs up every week',30:'Backs up every month'})[e]:'Automatic backup off')+(P.bakAt?' · last '+new Date(P.bakAt).toLocaleDateString():'')}
  if(k==='security')return P.lock?'PIN on'+(P.bio?' · fingerprint on':''):'No PIN'
  return 'Groundwork Habits '+APPV}
function setSection(k){
  let b='';
  if(k==='appearance')b=sgrp('Theme','<div class="sseg">'+[['dark','Dark'],['amoled','AMOLED'],['light','Light']].map(t=>'<button data-act="ptheme" data-v="'+t[0]+'" aria-pressed="'+((P.theme||'dark')===t[0])+'" class="'+((P.theme||'dark')===t[0]?'on':'')+'">'+t[1]+'</button>').join('')+'</div>')
    +sgrp('Accent colour',colorPicker('accent',P.accent,ACCENTS,'Accent colour'))
    +sgrp('Navigation',srow('Tab names','Show the name under each tab icon',sw('tabnames',undefined,P.tabNames!==false,'Tab names')))
    +sgrp('Layout',srow('Reset card layout','Puts the Today and Insights cards back in their original order',sbtn('resetlayout','Reset')));
  if(k==='language')b=sgrp('',srow('Language','Groundwork Habits follows this device’s language unless you pick one. Your own habits and tasks are never translated.','<select class="field ssel" id="langSel" aria-label="Language"><option value="">Same as this device</option>'+LANGS.map(l=>'<option value="'+l[0]+'"'+(l[0]===P.lang?' selected':'')+'>'+l[1]+'</option>').join('')+'</select>','translate'));
  if(k==='features')b=sgrp('',FEAT.filter(f=>f[0]!=='remnames'&&f[0]!=='reminder').map(f=>srow(f[1],FEATD[f[0]],sw('feat',f[0],feat(f[0]),f[1]))).join(''))
    +(DFS&&DFS.widget&&!WIDGET?sgrp('Desktop',sgo('widget','Open the mini widget','A small always-on-top window with today’s habits and tasks')):'');
  if(k==='reminders')b=sgrp('Daily reminder',srow('Daily reminder',FEATD.reminder,sw('feat','reminder',feat('reminder'),'Daily reminder'))
      +(feat('reminder')?(LN||'Notification' in window?srow('Time',LN?'A notification every day, even when Groundwork Habits is closed':'Only while Groundwork Habits is open or in the background','<input type="time" class="field stime" id="remTime" value="'+esc(P.remTime||'21:00')+'" aria-label="Reminder time">'):srow('Reminders aren’t supported here yet','')):''))
    +sgrp('Habit and task reminders',srow('Show names in reminders',FEATD.remnames,sw('feat','remnames',feat('remnames'),'Show names in reminders'))
      +srow('Set a reminder','Open a habit (tap its name) or tap the bell on a task','')
      +(NB&&NB.openExactSettings?sgo('exactok','Allow exact alarms','Android 14 and later: lets alarms ring on time instead of a few minutes late'):'')
      +sgo('testnote','Send a test notification','Checks that notifications reach you'));
  if(k==='calendar')b=sgrp('Google Calendar',calFetch?(P.cal?srow('Connected','Events sync every 15 minutes'+(P.calAt?', last '+new Date(P.calAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''),sbtn('calsync','Sync now'))+sgo('caloff','Stop calendar sync','Removes the calendar events from your tasks','red')
      :sgo('calset','Connect a calendar…','Paste your calendar’s secret iCal address; no Google login needed')):srow('Calendar sync works in the desktop and Android apps',''))
    +sgrp('Export',sgo('calexport','Export tasks to calendar (.ics)','Import the file in Google Calendar: Settings, Import & export'));
  if(k==='data'){const can=(DFS&&DFS.backup)||(NB&&NB.backup),e=P.bakEvery===undefined?7:P.bakEvery;
    b=(can?sgrp('Automatic backup',srow('Back up','Keeps the newest 8 copies'+(P.bakWhere?' in '+esc(P.bakWhere):''),'<select class="field ssel" id="bakSel" aria-label="Automatic backup">'+[[0,'Off'],[1,'Every day'],[7,'Every week'],[30,'Every month']].map(x=>'<option value="'+x[0]+'"'+(e===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select>','automatic backup often')
        +sgo('baknow','Back up now',P.bakAt?'Last backup '+new Date(P.bakAt).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):'No backup yet')+(DFS&&DFS.openBackups?sgo('bakopen','Open backups folder',''):'')):'')
      +(DFS&&!LITE?sgrp('Data folder',srow('Folder',dataDir?esc(dataDir):'App storage (this PC only). Pick a Google Drive, OneDrive or Dropbox folder to sync between computers',sbtn('pickdir',dataDir?'Change':'Choose…'))+(dataDir?sgo('resetdir','Stop using this folder',''):'')):'')
      +(FOLD&&!LITE?sgrp('Data folder',srow('Folder',P.andDir?esc(P.andDir):NB?'This phone only. Pick a folder another app keeps in sync to share data between devices':'This browser only. Pick a Google Drive, OneDrive or Dropbox folder to sync between devices',WEBF&&WEBF.off&&P.andDir?sbtn('areconnect','Reconnect'):sbtn('apick',P.andDir?'Change':'Choose…'))+(P.andDir?sgo('aclear','Stop using this folder',''):'')):'')
      +(!FOLD&&!DFS&&!NB&&!LITE&&!DEMO?sgrp('Data folder',srow('Folder','This browser can’t sync through a folder. Use Export and Import to move your data',sbtn('export','Export')+sbtn('import','Import'))):'')
      +sgrp('Export and import',sgo('export','Export backup',P.lock?'Encrypted with your PIN':'A file with all your data')+sgo('csv','Export as spreadsheet (.csv)','For Excel, Numbers or Google Sheets')+sgo('impext','Import from another app','Loop Habit Tracker, Habitica or a spreadsheet (.csv). Adds to your data')+sgo('import','Import backup','Replaces the data on this device'))
      +sgrp('Danger zone',(TESTING?sgo('demo',confirmDemo?'Tap again: replace my data with demo':'Load demo data','Example habits, tasks and goals'):'')+sgo('fresh',confirmReset?'Tap again to erase everything':'Start fresh','Erases everything on this device','red'),'danger')}
  if(k==='security')b=sgrp('App lock',!canLock?srow('Not available here',''):P.lock?
      sgo('pinset','Change PIN…','')+(bioOk?srow('Fingerprint unlock','Unlock with your fingerprint instead of typing the PIN',sw(P.bio?'biooff':'bioask',undefined,P.bio,'Fingerprint unlock')):'')
      +srow('Lock after','Without use; Groundwork Habits also locks a minute after you leave it','<select class="field ssel" id="lockSel" aria-label="Lock after">'+[1,5,15,30].map(m=>'<option value="'+m+'"'+((P.lockIdle||5)===m?' selected':'')+'>'+m+' min</option>').join('')+'</select>')
      +sgo('pinoff',confirmPinOff?'Tap again to remove the PIN':'Remove PIN','Your data is decrypted and saved readable again','red')
    :sgo('pinset','Set a PIN…','Locks Groundwork Habits and encrypts your data on this device and in backups'))
    +sgrp('',srow('How the lock works','Locks when Groundwork Habits opens, after a minute in the background or the time above without use. It hides your data on screen and encrypts what’s saved on this device and in backups.',''));
  if(k==='about')b=sgrp('',srow('Groundwork Habits '+(LITE?'Lite ':'')+APPV,'Habits, tasks and goals in one calm place',(UPD?'<button class="btn ghost sbtn" data-act="updnow">Check for updates</button>':'<a class="btn ghost sbtn" href="'+RELEASES+'" target="_blank" rel="noopener">Check for updates</a>'))+(UPD?srow('Check for updates automatically','Once a day, asks GitHub if a new version is out. Off by default: nothing is sent unless you turn it on.',sw('updauto',undefined,!!P.updAuto,'Check for updates automatically')):'')+sgo('tipsshow','Show tips','The short introduction from the first start')+sgo('diag','Copy diagnostics','Version, device and recent errors for a bug report. No habits, tasks or other data'))
    +sgrp('Privacy',srow('Your data stays with you','No account, no ads, no tracking. Everything is saved on your devices, and only goes where you send it: your backups, your data folder, your calendar link.',''))
    +(wideSet()?sgrp('Keyboard shortcuts',[['Ctrl+Z','Undo the latest delete'],['Esc','Close a dialog or leave settings'],['Enter','Add the task or save the dialog'],['Arrow keys','Move the focused card, habit, goal or task']].map(x=>srow(x[1],'','<kbd>'+x[0]+'</kbd>','shortcut')).join('')):'')
    +sgrp('Licences',srow('Groundwork Habits','GNU AGPL-3.0 licence','','license open source')+srow('Space Grotesk font','SIL Open Font License',''));
  return b}
function vSettings(){
  const one=setSec&&!wideSet(),secs=one?[setSec]:SETSECS;
  // the page title is already in the header; a heading only names the open section on phones
  let o=(one||!wideSet()?'<div class="sethead"><button class="gear sback" data-act="setback" aria-label="Back">'+ic('back')+'</button>'+(one?'<h1 class="sett">'+SETMETA[setSec][1]+'</h1>':'')+'</div>':'')
   +'<div class="ssearch">'+ic('search')+'<input class="field" id="setQ" type="search" placeholder="Search settings" aria-label="Search settings" value="'+esc(setQ)+'" autocomplete="off"></div><p class="sub snone" hidden>No settings match.</p>';
  const nav='<nav class="snav" aria-label="Settings sections">'+SETSECS.map(k=>'<a href="#settings/'+k+'" data-sec="'+k+'" class="'+(k===(setSec||'appearance')?'on':'')+'">'+ic(SETMETA[k][0])+'<span>'+SETMETA[k][1]+'</span></a>').join('')+'</nav>';
  const list='<div class="sgrp slist">'+SETSECS.map(k=>'<a class="srow sgo" href="#settings/'+k+'"><span class="si">'+ic(SETMETA[k][0])+'</span><div class="sl"><span>'+SETMETA[k][1]+'</span><small>'+setStatus(k)+'</small></div>'+ic('next')+'</a>').join('')+'</div>';
  const body=secs.map(k=>'<section class="ssec" id="set-'+k+'" data-sec="'+k+'">'+(one?'':'<h2>'+SETMETA[k][1]+'</h2>')+setSection(k)+'</section>').join('');
  if(wideSet())return o+'<div class="setwrap">'+nav+'<div class="spane">'+body+'</div></div>';
  return o+(one?'<div class="spane">'+body+'</div>':list+'<div class="spane sall">'+body+'</div>')}
// search: hide rows that don't match (accents and case ignored); on phones the results replace the section list
const fold=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function filterSettings(){const q=fold(setQ).trim(),m=$('#main');if(!m)return;m.classList.toggle('sq',!!q);let any=false;
  m.querySelectorAll('.spane .ssec').forEach(sec=>{let n=0;sec.querySelectorAll('.sgrp').forEach(g=>{let gn=0;g.querySelectorAll('.srow').forEach(r=>{const hit=!q||fold(r.textContent+' '+(r.dataset.s||'')+' '+(g.querySelector('.sgh')||{}).textContent+' '+sec.dataset.sec).includes(q);r.hidden=!hit;if(hit)gn++});
      const extra=g.querySelector('.sseg,.sacc,.cpk');if(extra&&q){const hit=fold(g.textContent+' '+sec.dataset.sec).includes(q);g.querySelectorAll('.sseg,.sacc,.sacc2,.cpk').forEach(x=>x.hidden=!hit);if(hit)gn++}else{g.querySelectorAll('.sseg,.sacc,.sacc2,.cpk').forEach(x=>x.hidden=false);if(extra)gn++}
      g.hidden=!gn;n+=gn});sec.hidden=!n;if(n)any=true});
  const none=m.querySelector('.snone');if(none)none.hidden=!q||any}
// desktop: the side list follows the section in view
let setObs=null;
// the side list follows the scroll: the section nearest the top is marked; at the very bottom the last one is (short last sections never
// reach the top on a tall window); right after a click the clicked section stays marked while the page scrolls to it
let spyHold=0;const markSec=k=>$$('.snav a').forEach(a=>a.classList.toggle('on',a.dataset.sec===k));
function spyNow(){if(view!=='settings'||!wideSet()||Date.now()<spyHold)return;const secs=$$('.spane .ssec');if(!secs.length)return;
  const max=document.documentElement.scrollHeight-innerHeight,rem=Math.max(0,max-scrollY),span=Math.min(innerHeight*.7,max),
    line=rem<span?120+(innerHeight-160)*(1-rem/span):120;
  let cur=secs[0];for(const x of secs)if(x.getBoundingClientRect().top<=line)cur=x;markSec(cur.dataset.sec)}
function spySettings(){if(setObs)setObs.disconnect();setObs=null;spyNow()}
window.addEventListener('scroll',()=>{if(view==='settings')spyNow()},{passive:true});
/* ---------- modal ---------- */
/* achievements: quit streaks ("stopped smoking"), counted from a date and time */
const qDate=q=>new Date(q.since),qDays=q=>Math.max(0,Math.floor((Date.now()-qDate(q))/864e5));
const MILES=[1,3,7,14,30,60,90,180,365,730,1095,1825,3650];
const nowLocal=()=>{const d=new Date();return dk(d)+'T'+p2(d.getHours())+':'+p2(d.getMinutes())};
const dur=d=>d>=365?(Math.floor(d/365)+(d>=730?' years':' year')):d>=30?(Math.floor(d/30)+(d>=60?' months':' month')):d+(d===1?' day':' days');
/* desktop widget: today's ring, daily habits and tasks in a small always-on-top window */
function vWidget(){
  const t=doneToday(),pct=t.total?Math.round(t.done/t.total*100):0,k=dk(TODAY),day=S.tasks[k]||{items:[]};
  return '<div class="wtop">'+ring(pct,86,9,'<b style="font-size:18px">'+t.done+'/'+t.total+'</b>')+'<div><div class="lbl" style="font-size:9px">'+DAYS[TODAY.getDay()]+' '+TODAY.getDate()+' '+MON3[TODAY.getMonth()]+'</div><b style="font-size:16px">'+(t.total&&t.done===t.total?'All done today':pct+'% of habits')+'</b><br><button class="link" data-act="wmain">Open Groundwork Habits</button></div></div>'
   +'<div class="lbl" style="font-size:9px;margin:14px 0 6px">Habits</div>'
   +(byType('daily').map(h=>{const on=!!L(h)[k];return '<div class="trow"><button class="cell '+(on?'on':'')+'" data-act="cell" data-h="'+h.id+'" data-d="'+k+'" role="checkbox" aria-checked="'+on+'" aria-label="'+esc(h.name)+tgt(h,k)+'">'+cellIn(h,k,on)+'</button><span class="nm">'+esc(h.name)+'</span></div>'}).join('')||'<p class="sub">No daily habits yet.</p>')
   +'<div class="lbl" style="font-size:9px;margin:14px 0 6px">Tasks today</div>'+'<div class="tlist" data-drop="tasks" data-k="'+k+'">'+vis(day.items).map(it=>taskChip(k,it)).join('')+'</div>'+(vis(day.items).length?'':'<p class="sub">Nothing planned.</p>')+taskAdder(k,false);
}
function vAch(){
  let o='<div class="sum"><div><div class="lbl">STREAKS</div><b>Things you’ve stopped, and how long it’s been</b></div><button class="btn" data-act="newquit">+ New streak</button></div>';
  if(!S.quits.length)return o+emptyBox('streaks','Start a quit streak','Track something you’ve stopped, like smoking or sugar. Pick when you stopped and watch the streak grow.','<button class="btn" data-act="newquit">+ New streak</button>')+chList();
  return o+'<div class="gg" data-drop="quits" data-axis="x">'+S.quits.map(q=>{
    const ms=Math.max(0,Date.now()-qDate(q)),d=Math.floor(ms/864e5),h=Math.floor(ms/36e5)%24,m=Math.floor(ms/6e4)%60;
    const next=MILES.find(x=>x>d),got=MILES.filter(x=>x<=d),best=Math.max(q.best||0,d),prev=got.length?got[got.length-1]:0;
    const pct=next?Math.round((d-prev)/(next-prev)*100):100;
    return '<section class="card goal ach" data-drag="quits" data-id="'+q.id+'">'+GRIP('streak','cg')+'<div class="hd"><button class="nb" data-act="editquit" data-q="'+q.id+'" aria-label="Edit '+esc(q.name)+'">'+esc(q.name)+'</button>'+(d>=best&&d>0?'<span class="badge">Best yet</span>':'')+'</div>'
     +'<div class="pc">'+d+'<small> '+(d===1?'day':'days')+'</small></div><div class="sub" style="margin-top:0">'+h+'h '+m+'m · since '+dmy(qDate(q))+' '+q.since.slice(11)+'</div>'
     +'<div class="tr"><i style="width:'+pct+'%"></i></div>'
     +'<div class="sub" style="margin-top:0">'+(next?'Next: '+dur(next)+' in '+(next-d)+(next-d===1?' day':' days'):'Every milestone reached')+(best>d?' · Best: '+best+' days':'')+'</div>'
     +(got.length?'<div class="miles">'+got.map(x=>'<span>'+dur(x)+'</span>').join('')+'</div>':'')
     +'</section>'}).join('')+'</div>'+chList();
}
// habit challenges ("30 days of …"), running and finished
function chList(){const hs=S.habits.filter(h=>h.ch);if(!hs.length)return '';
  return '<section class="card chl"><div class="lbl">Challenges</div>'+hs.map(h=>{const n=chDone(h),ok=n>=h.ch.days;return '<div class="chr'+(ok?' ok':'')+'"><span class="tdot" style="--c:'+h.color+'"></span><span class="nm">'+esc(h.name)+'</span><span class="meta">'+chLine(h)+'</span>'+(ok?medal(h.color):'')+'</div>'}).join('')+'</section>'}
/* search across tasks, notes, reflections, goals, habits and streaks */
function searchHits(q){
  q=q.trim().toLowerCase();if(q.length<2)return [];
  const out=[],has=t=>String(t).toLowerCase().includes(q),add=(text,sub,v,k)=>{if(out.length<60)out.push({text,sub,v,k})};
  Object.keys(S.tasks).sort().reverse().forEach(k=>vis(S.tasks[k].items).forEach(i=>{if(has(i.text))add(i.text,'Task · '+dmy(new Date(k+'T00:00'))+(i.done?' · done':''),'tasks',k)}));
  S.habits.forEach(h=>{if(has(h.name))add(h.name,'Habit · '+h.type,'habits',h.type);
    Object.entries(S.notes[h.id]||{}).sort().reverse().forEach(([k,v])=>{if(has(v))add(v,'Note · '+h.name+' · '+(k.length===10?dmy(new Date(k+'T00:00')):k),'habits',k)})});
  Object.entries(S.journal).sort().reverse().forEach(([k,v])=>{if(v&&has(v))add(v.slice(0,120),'Reflection · '+MONTHS[+k.slice(5)-1]+' '+k.slice(0,4),'insights','')});
  S.goals.forEach(g=>{if(has(g.title))add(g.title,'Goal · '+g.area+' · '+gPct(g)+'%','goals','')});
  S.quits.forEach(x=>{if(has(x.name))add(x.name,'Streak · '+qDays(x)+' days','achievements','')});
  return out;
}
function searchHtml(q){
  const hits=searchHits(q),mk=t=>{const i=t.toLowerCase().indexOf(q.trim().toLowerCase());return i<0?esc(t):esc(t.slice(0,i))+'<mark>'+esc(t.slice(i,i+q.trim().length))+'</mark>'+esc(t.slice(i+q.trim().length))};
  if(q.trim().length<2)return '<p class="sub" style="margin:0">Type at least 2 letters.</p>';
  return hits.length?hits.map(h=>'<button class="shit" data-act="sgo" data-v="'+h.v+'" data-k="'+esc(h.k)+'"><span>'+mk(h.text)+'</span><small>'+esc(h.sub)+'</small></button>').join(''):'<p class="sub" style="margin:0">Nothing found.</p>';
}
const TOUCH=matchMedia('(pointer:coarse)').matches;
function tipsHtml(){
  const tips=[
    ['Move things around',TOUCH?'Press and hold a task, habit, goal or card, then drag it. Tasks can go to another day.':'Drag the dotted grip on tasks, habits, goals and cards, or focus it and use the arrow keys. Tasks can go to another day.'],
    ['Edit a habit','Tap its name to change the name, colour, category, how often, or to track an amount like km, hours or pages.'],
    ['Tick and fix','Tap a box to tick it. Unticked tasks on past days show a red X; tap it if you just forgot.'],
    ['Repeat a task','When adding a task, use the dropdown under it to repeat it every day, weekday, week or month.'],
    ['Search and settings','The magnifier searches everything. The gear has themes, colours, features, backups and the app lock.'],
    ['Your data stays here',LITE?'Everything is saved on this device and never leaves it. Export a backup from settings.':'Everything is saved on this device. Export a backup from settings, or choose a synced folder on desktop.']];
  return '<div class="ov" data-act="ovclose"><div class="mod tips" role="dialog" aria-modal="true" aria-label="Welcome to Groundwork Habits"><h2>Welcome to Groundwork Habits</h2><p class="sub" style="margin:0">A few things worth knowing:</p><ol class="tipl">'
   +tips.map(t=>'<li><b>'+t[0]+'</b><span>'+t[1]+'</span></li>').join('')+'</ol><div class="row"><button class="btn" data-act="tipsok">Got it</button></div></div></div>';
}
function openAmt(h,k){modal={kind:'amt',h:h.id,k};focusSel='#aVal'}
function vModal(){
  if(!modal)return '';
  if(modal.kind==='tips')return tipsHtml();
  if(modal.kind==='habit'){
    return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="'+(modal.id?'Edit habit':'New habit')+'"><h2>'+(modal.id?'Edit habit':'New habit')+'</h2>'
     +'<input class="field" id="mName" maxlength="60" placeholder="Habit name" value="'+esc(modal.name||'')+'" aria-label="Habit name">'
     +'<div class="seg">'+['daily','weekly','monthly'].map(t=>'<button class="'+(modal.type===t?'on':'')+'" data-act="mtype" data-v="'+t+'" aria-pressed="'+(modal.type===t)+'">'+t+'</button>').join('')+'</div>'
     +(modal.id&&modal.type!==modal.origType?'<p class="sub" style="margin:0">Ticks you made as '+modal.origType+' stay saved and come back if you switch back. The '+modal.type+' history starts empty.</p>':'')
     +colorPicker('habit',modal.color,CNAMED,'Colour')
     +(modal.type==='daily'?'<label class="sub" style="margin:0" for="mPer">Days per week (7 = every day)</label><input class="field" type="number" inputmode="numeric" min="1" max="7" id="mPer" value="'+(modal.per||7)+'">'
     +'<div class="sub" style="margin:0">Rest days</div><div class="rdays" role="group" aria-label="Rest days">'+[0,1,2,3,4,5,6].map(i=>'<button class="'+((modal.rest||[]).includes(i)?'on':'')+'" data-act="mrest" data-v="'+i+'" role="checkbox" aria-checked="'+(modal.rest||[]).includes(i)+'" aria-label="'+DAYS[i]+'">'+new Intl.DateTimeFormat(LANG,{weekday:'narrow'}).format(new Date(2026,2,1+i))+'</button>').join('')+'</div>'
     +'<p class="sub" style="margin:0">Planned days off: they don’t break the streak or use a freeze. For every-day habits (7 days a week).</p>':'')
     +'<div class="lbl" style="font-size:9px">How to track it</div><div class="seg trk">'+[['check','Done or not'],['count','Count'],['amount','Amount']].map(x=>'<button class="'+(modal.track===x[0]?'on':'')+'" data-act="mtrack" data-v="'+x[0]+'" aria-pressed="'+(modal.track===x[0])+'">'+x[1]+'</button>').join('')+'</div>'
     +(modal.track==='count'?'<label class="sub" style="margin:0" for="mTarget">Times per '+{daily:'day',weekly:'week',monthly:'month'}[modal.type]+', e.g. 8 glasses</label><input class="field" type="number" inputmode="numeric" min="2" max="99" id="mTarget" value="'+Math.max(2,modal.target||8)+'">':'')
     +(modal.track==='amount'?'<div class="amtcfg"><div><label class="sub" style="margin:0" for="mUnit">Unit</label><input class="field" id="mUnit" list="units" maxlength="12" placeholder="km, pages, hours…" value="'+esc(modal.unit||'')+'"><datalist id="units">'+['km','miles','hours','minutes','pages','steps','glasses','reps','€'].map(u=>'<option value="'+u+'">').join('')+'</datalist></div>'
       +'<div><label class="sub" style="margin:0" for="mGoal">Goal per '+{daily:'day',weekly:'week',monthly:'month'}[modal.type]+' (optional)</label><input class="field" id="mGoal" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 5" value="'+(modal.goal||'')+'"></div></div>':'')
     +(modal.id&&modal.type==='daily'&&feat('freeze')&&modal.fz?'<div class="lbl" style="font-size:9px">Streak freezes</div><div class="fzcfg"><label class="chk"><input type="checkbox" id="mFzOn"'+(modal.fz.off?'':' checked')+'> On</label>'
       +'<label class="sub">Earn one every <input class="field mini" type="number" inputmode="numeric" min="3" max="30" id="mFzE" value="'+modal.fz.every+'" aria-label="Days in a row to earn a freeze"> days</label><label class="sub">Keep up to <input class="field mini" type="number" inputmode="numeric" min="1" max="5" id="mFzM" value="'+modal.fz.max+'" aria-label="Most freezes saved up"></label></div>':'')
     +(modal.type==='daily'&&!LITE?(()=>{const c=(findH(modal.id)||{}).ch,v=modal.chDays!==undefined?modal.chDays:c?c.days:0;return '<label class="sub" style="margin:0" for="mCh">Challenge</label><select class="field" id="mCh">'+[[0,'No challenge'],[7,'7 days'],[21,'21 days'],[30,'30 days'],[66,'66 days'],[100,'100 days']].map(x=>'<option value="'+x[0]+'"'+(+v===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select>'+(c?'<p class="sub" style="margin:0">'+chLine(findH(modal.id))+'</p>':'')})():'')
     +remPicker('habit')
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button>'+(modal.id?'<button class="btn ghost" data-act="sharecard" data-v="h" data-i="'+modal.id+'">Share</button>':'')+(modal.id?'<button class="btn danger" data-act="mdel">'+(modal.confirm?'Tap again to delete':'Delete')+'</button>':'')+'<button class="btn" data-act="msave">'+(modal.id?'Save':'Add habit')+'</button></div></div></div>';
  }
  if(modal.kind==='ask')return '<div class="ov"><div class="mod" role="alertdialog" aria-modal="true" aria-label="Reminder">'+askHtml(modal.h,modal.k)+'</div></div>';
  if(modal.kind==='gval'){const g=S.goals.find(x=>x.id===modal.g);if(!g){modal=null;return ''}const num=gKind(g)==='num';
    return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="'+(num?'Add to goal':'Log value')+'"><h2>'+(num?'Add to goal':'Log the current value')+'</h2><p class="sub" style="margin:0">'+esc(g.title)+' · '+gLine(g)+'</p>'
     +'<div class="gfl"><label class="gdue"><span class="sub">'+(num?'Amount'+(g.unit?' ('+esc(g.unit)+')':'')+', minus to take out':'Value'+(g.unit?' ('+esc(g.unit)+')':''))+'</span><input class="field" id="gvAmt" type="number" inputmode="decimal" step="any" aria-label="Amount"></label>'
     +'<label class="gdue"><span class="sub">Date</span><input class="field" type="date" id="gvDate" value="'+dk(TODAY)+'" aria-label="Date"></label></div>'
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="gvalsave">'+(num?'Add':'Save')+'</button></div></div></div>'}
  if(modal.kind==='tpl')return tplHtml();
  if(modal.kind==='impext'){const d=modal.d,c=d.habits.reduce((n,h)=>n+Object.keys(h.log).length,0),ex=d.habits.filter(h=>S.habits.some(y=>y.name.toLowerCase()===h.name.toLowerCase())).length;
    return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="Import"><h2>Import from '+esc(d.src)+'</h2>'
     +'<p class="sub" style="margin:0"><span>'+d.habits.length+' habits with '+c+' check-ins</span>'+(d.tasks.length?' · <span>'+d.tasks.length+' tasks</span>':'')+'</p>'+(ex?'<p class="sub" style="margin:0">'+ex+' of the habits already exist here and get the extra days.</p>':'')+'<p class="sub" style="margin:0">Nothing you have is removed.</p>'
     +(d.habits.length?'<div class="tpl"><ul>'+d.habits.slice(0,30).map(h=>'<li>'+esc(h.name)+'</li>').join('')+(d.habits.length>30?'<li>+'+(d.habits.length-30)+'</li>':'')+'</ul></div>':'')
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="impextok">Import</button></div></div></div>'}
  if(modal.kind==='area')return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="'+(modal.old?'Edit area':'New area')+'"><h2>'+(modal.old?'Edit area':'New life area')+'</h2>'
     +'<input class="field" id="arName" maxlength="24" placeholder="e.g. Faith, Pets, Side business" value="'+esc(modal.name||'')+'" aria-label="Area name">'
     +colorPicker('area',modal.color,CNAMED,'Colour')
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button>'+(modal.old?'<button class="btn danger" data-act="areadel">'+(modal.confirm?'Tap again to delete':'Delete')+'</button>':'')+'<button class="btn" data-act="areasave">'+(modal.old?'Save':'Add area')+'</button></div></div></div>';
  if(modal.kind==='impin')return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="Encrypted backup"><h2>Encrypted backup</h2><p class="sub" style="margin:0">Enter the PIN that was set when this backup was made. Restoring replaces the data on this device.</p>'
     +'<input class="field" id="impPin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN" aria-label="PIN">'
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="impok">Restore</button></div></div></div>';
  if(modal.kind==='afold')return '<div class="ov"><div class="mod" role="dialog" aria-modal="true" aria-label="Data folder"><h2>There’s already a Groundwork Habits save here</h2><p class="sub" style="margin:0">Replace it with the data on this phone, or load the save from the folder? Loading overwrites what’s on this phone.</p>'
     +'<div class="row" style="flex-wrap:wrap"><button class="btn ghost" data-act="afoldno">Cancel</button><button class="btn ghost" data-act="afoldload">'+(modal.confirm?'Tap again: load the folder save':'Load the folder save')+'</button><button class="btn" data-act="afoldkeep">Replace with my data</button></div></div></div>';
  if(modal.kind==='biopin')return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="Fingerprint unlock"><h2>Fingerprint unlock</h2><p class="sub" style="margin:0">Enter your PIN once to turn it on.</p>'
     +'<input class="field" id="bioPin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN" aria-label="PIN">'
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="biook">Continue</button></div></div></div>';
  if(modal.kind==='quick'){const k=dk(TODAY),open=byType('daily').filter(h=>!L(h)[k]),ng=S.goals.filter(g=>!g.arch&&gKind(g)==='num');
    return '<div class="ov" data-act="ovclose"><div class="mod mquick" role="dialog" aria-modal="true" aria-label="Quick add"><h2>Quick add</h2>'
     +'<div class="lbl" style="font-size:9px">Task for today</div><div class="tinr"><input class="field tin" id="qTask" maxlength="100" placeholder="New task" aria-label="New task for today"><button class="btn tgo" data-act="qtask">Add</button></div>'
     +(open.length?'<div class="lbl" style="font-size:9px">Tick a habit</div><div class="qhab">'+open.map(h=>'<button class="chip" data-act="qhabit" data-h="'+h.id+'"><i style="background:'+h.color+'"></i>'+esc(h.name)+'</button>').join('')+'</div>':'')
     +(ng.length?'<div class="lbl" style="font-size:9px">Add to a goal</div><div class="tinr"><select class="field" id="qGoal" aria-label="Goal">'+ng.map(g=>'<option value="'+g.id+'">'+esc(g.title)+(g.unit?' ('+esc(g.unit)+')':'')+'</option>').join('')+'</select><input class="field" id="qAmt" type="number" inputmode="decimal" step="any" placeholder="Amount" aria-label="Amount" style="max-width:120px"><button class="btn tgo" data-act="qgoal">Add</button></div>':'')
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Close</button></div></div></div>'}
  if(modal.kind==='trem'){const it=findT(modal.i,modal.k);if(!it){modal=null;return ''}
    return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="Task reminder"><h2>Reminder</h2><p class="sub" style="margin:0">'+esc(it.text)+' · '+dmy(new Date(modal.k+'T00:00'))+'</p>'+remPicker('task')
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="tremsave">Save</button></div></div></div>'}
  if(modal.kind==='note'){const h=findH(modal.h);
    return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="Note"><h2>Note</h2><p class="sub" style="margin:0">'+esc(h?h.name:'')+' · '+dmy(new Date(modal.k+'T00:00'))+'</p>'
     +'<textarea class="field" id="nText" maxlength="300" placeholder="e.g. Ran 5 km, felt great" aria-label="Note">'+esc(modal.text||'')+'</textarea>'
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="nsave">Save note</button></div></div></div>'}
  if(modal.kind==='focus'){const open=todo(((S.tasks[dk(TODAY)]||{items:[]}).items)).filter(i=>!i.done);
    return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="Focus timer"><h2>Focus timer</h2>'
     +'<label class="sub" style="margin:0" for="fTask">Work on</label><select class="field" id="fTask"><option value="">No task, just focus</option>'+open.map(i=>'<option value="'+i.id+'">'+esc(i.text)+'</option>').join('')+'</select>'
     +'<label class="sub" style="margin:0" for="fMin">Minutes</label><input class="field" type="number" inputmode="numeric" min="1" max="180" id="fMin" value="'+(P.focusMin||25)+'">'
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="fstart">Start</button></div></div></div>'}
  if(modal.kind==='search')return '<div class="ov" data-act="ovclose"><div class="mod msearch" role="dialog" aria-modal="true" aria-label="Search"><h2>Search</h2>'
     +'<input class="field" id="sq" type="search" placeholder="Tasks, notes, goals, habits…" aria-label="Search" value="'+esc(modal.q||'')+'" autocomplete="off">'
     +'<div id="sres" class="sres" aria-live="polite">'+searchHtml(modal.q||'')+'</div></div></div>';
  if(modal.kind==='pin')return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="Set a PIN"><h2>'+(P.lock?'Change PIN':'Set a PIN')+'</h2>'
     +'<p class="sub" style="margin:0">4 to 8 digits. If you forget it, the only way back in is to erase the data on this device (a data folder copy is kept).</p>'
     +'<input class="field" id="pin1" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="New PIN" aria-label="New PIN">'
     +'<input class="field" id="pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" placeholder="Repeat the PIN" aria-label="Repeat the PIN">'
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="pinsave">Save PIN</button></div></div></div>';
  if(modal.kind==='amt'){const h=findH(modal.h);if(!h){modal=null;return ''}const v=amtOf(h,modal.k),u=unitOf(h);
    const when=modal.k.length===10?dmy(new Date(modal.k+'T00:00')):modal.k.includes('W')?'week '+modal.k.slice(-1)+', '+MONTHS[+modal.k.slice(5,7)-1]:MONTHS[+modal.k.slice(5,7)-1];
    return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="'+esc(h.name)+'"><h2>'+esc(h.name)+'</h2><p class="sub" style="margin:0">'+when+(h.goal?' · goal '+fmtN(h.goal)+' '+esc(u):'')+'</p>'
     +'<div class="amtrow"><button class="btn ghost" data-act="amtstep" data-v="-1" aria-label="Less">−</button><input class="field" id="aVal" type="number" inputmode="decimal" min="0" step="any" value="'+(v||'')+'" placeholder="0" aria-label="Amount in '+esc(u||'units')+'"><span class="amtu">'+esc(u)+'</span><button class="btn ghost" data-act="amtstep" data-v="1" aria-label="More">+</button></div>'
     +'<div class="row">'+(v?'<button class="btn ghost" data-act="amtclear">Clear</button>':'')+'<button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="amtsave">Save</button></div></div></div>'}
  if(modal.kind==='cal')return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="Connect Google Calendar"><h2>Connect Google Calendar</h2>'
     +'<p class="sub" style="margin:0;font-size:12px;line-height:1.5">In Google Calendar on a computer: Settings, pick your calendar under “Settings for my calendars”, then copy <b>Secret address in iCal format</b> and paste it here. Groundwork Habits adds events from the last 30 days and next 90 days to your tasks and refreshes every 15 minutes. Keep this address private.</p>'
     +'<input class="field" id="calUrl" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" aria-label="Secret iCal address" spellcheck="false">'
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="calsave">Connect</button></div></div></div>';
  if(modal.kind==='quit'){const t=modal.id?'Edit streak':'New streak';
    return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="'+t+'"><h2>'+t+'</h2>'
     +'<input class="field" id="qName" maxlength="60" placeholder="What did you stop? e.g. Smoking" value="'+esc(modal.name||'')+'" aria-label="What did you stop">'
     +'<label class="sub" for="qSince" style="margin:0">When did you stop?</label><input class="field" type="datetime-local" id="qSince" max="'+nowLocal()+'" value="'+modal.since+'">'
     +(modal.id?'<button class="btn ghost" data-act="qreset">'+(modal.confirm==='reset'?'Tap again: restart from now':'I slipped, restart the streak')+'</button>':'')
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button>'+(modal.id?'<button class="btn danger" data-act="qdel">'+(modal.confirm==='del'?'Tap again to delete':'Delete')+'</button>':'')+'<button class="btn" data-act="qsave">'+(modal.id?'Save':'Start streak')+'</button></div></div></div>'}
  const st=modal.steps||[],k=modal.gk,u=modal.unit||'',ar=modal.area,ideas=modal.id?[]:(IDEAS[AREAS.includes(ar)?ar:'']||[]);
  const fld=(id,lab,val,ty,ph)=>'<label class="gdue"><span class="sub">'+lab+'</span><input class="field" id="'+id+'" type="'+(ty||'text')+'"'+(ty==='number'?' inputmode="decimal" step="any"':' maxlength="12"')+' value="'+esc(val===undefined||val===null?'':String(val))+'" placeholder="'+(ph||'')+'" aria-label="'+lab+'"></label>';
  let body='';
  if(k==='steps')body='<div class="gsteps">'+st.map((x,i)=>'<div class="gstep'+(x.done?' done':'')+'"><button class="cb '+(x.done?'on':'')+'" data-act="gstep" data-i="'+i+'" role="checkbox" aria-checked="'+x.done+'" aria-label="'+esc(x.text)+'">'+(x.done?CHECK:'')+'</button><span>'+esc(x.text)+(x.due?'<small>'+dmy(new Date(x.due+'T00:00'))+'</small>':'')+'</span><button class="x" data-act="gstepdel" data-i="'+i+'" aria-label="Remove step">&times;</button></div>').join('')
    +'<div class="gstepadd"><input class="field" id="gStep" maxlength="200" placeholder="Add a step, e.g. Run 10 km" aria-label="New step"><input class="field" type="date" id="gStepDue" aria-label="Step date (optional)"><button class="btn ghost" data-act="gstepadd">Add</button></div></div>'
    +'<p class="sub" style="margin:0">'+(st.length?'Progress follows the steps: '+Math.round(st.filter(x=>x.done).length/st.length*100)+'%':'Add the steps that get you there; ticking them fills the bar.')+'</p>';
  else if(k==='num')body='<div class="gfl">'+fld('gUnit','Unit, e.g. € or km',u,'text','€')+fld('gTarget','Target',modal.target,'number','10000')+'</div><p class="sub" style="margin:0">Add what you put in (or take out) from the goal card; the bar fills towards the target.</p>'
    +'<label class="chk"><input type="checkbox" id="gRec"'+(modal.recur?' checked':'')+' data-act="grec"> Add an amount automatically</label>'
    +(modal.recur?'<div class="gfl3">'+fld('gRecV','Amount',modal.recur.v,'number','500')+'<label class="gdue"><span class="sub">Every</span><select class="field" id="gRecE" aria-label="Every"><option value="m"'+(modal.recur.every==='m'?' selected':'')+'>Month</option><option value="w"'+(modal.recur.every==='w'?' selected':'')+'>Week</option></select></label>'
      +'<label class="gdue"><span class="sub">Starting</span><input class="field" type="date" id="gRecF" value="'+esc(modal.recur.from||dk(TODAY))+'" aria-label="Starting"></label></div>':'');
  else if(k==='tasks'){const lt=modal.id?gTasks({id:modal.id}):[];body='<div class="gsteps">'+lt.map(x=>'<div class="gstep'+(x.it.done?' done':'')+'"><span>'+esc(x.it.text)+'<small>'+dmy(new Date(x.k+'T00:00'))+'</small></span></div>').join('')
    +(modal.newTasks||[]).map((x,i)=>'<div class="gstep"><span>'+esc(x.text)+'<small>'+dmy(new Date(x.k+'T00:00'))+' · new</small></span><button class="x" data-act="gtaskdel" data-i="'+i+'" aria-label="Remove task">&times;</button></div>').join('')
    +'<div class="gstepadd"><input class="field" id="gStep" maxlength="200" placeholder="A task for this goal" aria-label="New task"><input class="field" type="date" id="gStepDue" value="'+dk(TODAY)+'" aria-label="Day"><button class="btn ghost" data-act="gtaskadd">Add</button></div></div>'
    +'<p class="sub" style="margin:0">These tasks show up on their day in Tasks; ticking them there fills this goal.</p>'}
  else if(k==='range')body='<div class="gfl3">'+fld('gUnit','Unit',u,'text','kg')+fld('gStart','Start',modal.start,'number','85')+fld('gTarget','Target',modal.target,'number','78')+'</div><p class="sub" style="margin:0">Log the current value from the goal card; it works up (income) or down (weight, debt left).</p>';
  else if(k==='habit')body=S.habits.length?'<div class="gfl"><label class="gdue"><span class="sub">Habit</span><select class="field" id="gHabit" aria-label="Habit">'+S.habits.map(h=>'<option value="'+h.id+'"'+(modal.habit===h.id?' selected':'')+'>'+esc(h.name)+'</option>').join('')+'</select></label>'
      +fld('gTarget','Times',modal.target,'number','100')+'</div>'+'<label class="gdue"><span class="sub">Counting from</span><input class="field" type="date" id="gSince" value="'+esc(modal.since||dk(TODAY))+'" aria-label="Counting from"></label><p class="sub" style="margin:0">Every tick of that habit since then counts.</p>'
    :'<p class="sub" style="margin:0">Add a habit first, then link it here.</p>';
  else body='<label class="sub" for="gPct" style="margin:0">Progress: <b id="gPctV">'+(+modal.pct||0)+'%</b></label><input type="range" id="gPct" min="0" max="100" step="5" value="'+(+modal.pct||0)+'" aria-label="Progress">';
  const lg=(k==='num'||k==='range')&&modal.log&&modal.log.length?'<div class="lbl" style="font-size:9px">'+(k==='num'?'Added':'Logged')+'</div><div class="gsteps glog">'+modal.log.map((x,i)=>[x,i]).sort((a,b)=>a[0].d<b[0].d?1:-1).slice(0,8).map(([x,i])=>'<div class="gstep"><span>'+fmtU(x.v,u)+'<small>'+dmy(new Date(x.d+'T00:00'))+'</small></span><button class="x" data-act="glogdel" data-i="'+i+'" aria-label="Remove entry">&times;</button></div>').join('')+'</div>':'';
  return '<div class="ov" data-act="ovclose"><div class="mod mgoal" role="dialog" aria-modal="true" aria-label="'+(modal.id?'Edit goal':'New goal')+'"><h2>'+(modal.id?'Edit goal':'New goal')+'</h2>'
   +(ideas.length?'<div class="gideas" role="group" aria-label="Ideas"><span class="sub">Ideas</span>'+ideas.map((x,i)=>'<button class="chip" data-act="gidea" data-i="'+i+'">'+esc(tx(x[0]))+'</button>').join('')+'</div>':'')
   +'<input class="field" id="gTitle" maxlength="80" placeholder="What do you want to achieve?" value="'+esc(modal.title||'')+'" aria-label="Goal title">'
   +'<div class="gfl"><select class="field" id="gArea" aria-label="Life area">'+allAreas().map(a=>'<option '+(ar===a?'selected':'')+'>'+esc(a)+'</option>').join('')+'</select>'
   +'<label class="gdue"><span class="sub">Finish by (optional)</span><input class="field" type="date" id="gDue" value="'+esc(modal.due||'')+'" aria-label="Finish by"></label></div>'
   +'<label class="chk"><input type="checkbox" id="gPin"'+(modal.pin?' checked':'')+'> Pin to the top</label>'
   +'<div class="lbl" style="font-size:9px">How do you measure it?</div><div class="seg gmeas">'+MEAS.map(x=>'<button class="'+(k===x[0]?'on':'')+'" data-act="gkind" data-v="'+x[0]+'" aria-pressed="'+(k===x[0])+'">'+x[1]+'</button>').join('')+'</div>'
   +body+lg
   +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button>'+(modal.id?'<button class="btn ghost" data-act="sharecard" data-v="g" data-i="'+modal.id+'">Share</button><button class="btn ghost" data-act="garch" data-g="'+modal.id+'">'+(modal.arch?'Restore':'Archive')+'</button><button class="btn danger" data-act="gdel" data-g="'+modal.id+'">'+(confirmGoal===modal.id?'Tap again to delete':'Delete')+'</button>':'')+'<button class="btn" data-act="gsave">'+(modal.id?'Save':'Add goal')+'</button></div></div></div>';
}

