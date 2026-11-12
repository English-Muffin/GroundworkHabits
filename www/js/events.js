/* Groundwork Habits: The delegated click/input/key handlers (every data-act action).
   The js/ files are classic scripts loaded in order (index.html) and share one scope, like one big file. */
'use strict';
/* ---------- events ---------- */
const findH=id=>S.habits.find(h=>h.id===id);
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');
  const act=t&&t.dataset.act;
  if(t&&act==='ovclose'&&e.target!==t)return; // clicks inside the dialog
  let changed=false;
  if(menuOpen&&act!=='gear'&&!(e.target.closest('#menu'))){menuOpen=false;changed=true}
  if(insMenu&&act!=='menu'&&act!=='pick'){insMenu=null;changed=true}
  if(addingTask&&!e.target.closest('.tadd')&&act!=='tadd'){addingTask=null;addingText='';repSel={rep:'',until:'m',open:''};changed=true;if(e.target.dataset.et)focusSel='[data-i="'+e.target.dataset.i+'"][data-et]'}
  if(confirmDemo&&act!=='demo')confirmDemo=false;
  if(confirmGoal&&act!=='gdel')confirmGoal=null;
  if(confirmPinOff&&act!=='pinoff')confirmPinOff=false;
  if(lockForgot&&act!=='pinforgot')lockForgot=false;
  if(confirmReset&&act!=='fresh'){confirmReset=false;changed=true}
  if(!t){if(changed)render();return}
  let persist=true;
  switch(act){
    case 'gear':persist=false;if(view!=='settings')location.hash='settings';return;
    case 'setback':persist=false;location.hash=setSec&&!wideSet()?'settings':setBack;return;
    case 'ptheme':P.theme=t.dataset.v;applyPrefs();persist=false;break;
    case 'paccent':setColor('accent',t.dataset.v);persist=false;break;
    case 'demo':if(!TESTING)break;
      if(hasData()&&!confirmDemo){confirmDemo=true;persist=false;break}
      S=seed();confirmDemo=false;menuOpen=false;toast('Demo data loaded');if(view==='settings'){save();location.hash=setBack;return}break;
    case 'pickdir':persist=false;menuOpen=false;DFS.choose().then(res=>{if(!res)return;dataDir=res.folder;fileText=null;
      if(res.mode==='load'&&readFile()){render();toast('Loaded the save from that folder')}else{writeFile();render();toast('Groundwork Habits now saves to that folder')}});break;
    case 'resetdir':DFS.reset();dataDir='';fileText=null;persist=false;toast('Saving to app storage only');break;
    case 'calexport':menuOpen=false;persist=false;shareFile(tasksToIcs(),'groundwork-tasks-'+dk(TODAY)+'.ics','text/calendar','Groundwork Habits tasks','Calendar file downloaded. Import it in Google Calendar: Settings, Import & export');break;
    case 'calset':menuOpen=false;persist=false;modal={kind:'cal',url:''};focusSel='#calUrl';break;
    case 'calsave':{const u=($('#calUrl').value||'').trim().replace(/^webcal:/i,'https:');
      if(!/^https:\/\/\S+$/i.test(u)){$('#calUrl').focus();toast('Paste the calendar’s secret iCal address (starts with https://)');return}
      P.cal=u;applyPrefs();modal=null;persist=false;pullCalendar(true);break}
    case 'calsync':menuOpen=false;persist=false;pullCalendar(true);break;
    case 'caloff':{P.cal='';P.calAt=0;applyPrefs();Object.keys(S.tasks).forEach(k=>{S.tasks[k].items=S.tasks[k].items.filter(it=>!it.cal)});toast('Calendar sync stopped');break}
    case 'csv':menuOpen=false;persist=false;shareFile(toCsv(),'groundwork-'+dk(TODAY)+'.csv','text/csv','Groundwork Habits spreadsheet','Spreadsheet downloaded');break;
    case 'export':menuOpen=false;persist=false;exportData();break;
    case 'import':menuOpen=false;persist=false;$('#impFile').click();break;
    case 'impext':{persist=false;const f=document.createElement('input');f.type='file';f.accept='.zip,.csv,.json,text/csv,application/json,application/zip';
      f.onchange=()=>{const file=f.files[0];if(!file)return;parseExternal(file).then(d=>{if(!d.habits.length&&!d.tasks.length){toast('Nothing to import in that file');return}modal={kind:'impext',d};render()}).catch(()=>toast('That file can’t be read. Use a Loop export, a Habitica export or a .csv'))};f.click();break}
    case 'impextok':{const r=mergeExternal(modal.d);modal=null;toast('Imported: '+r.nh+' new habits, '+r.nc+' check-ins, '+r.nt+' tasks');break}
    case 'fresh':
      if(confirmReset){S=empty();hist=[];redos=[];histJ=null;P.cal='';P.calAt=0;applyPrefs();confirmReset=false;menuOpen=false;toast('Everything erased');if(view==='settings'){save();location.hash=setBack;return}}else{confirmReset=true;persist=false}break;
    case 'goto':location.hash=t.dataset.v;persist=false;return;
    case 'mprev':{const d=new Date(vy,vm-1,1);vy=d.getFullYear();vm=d.getMonth();persist=false;break}
    case 'mnext':{const d=new Date(vy,vm+1,1);vy=d.getFullYear();vm=d.getMonth();persist=false;break}
    case 'tab':tab=t.dataset.v;persist=false;break;
    case 'cell':{const h=findH(t.dataset.h);if(isAmt(h)){openAmt(h,t.dataset.d);persist=false;break}tap(h,t.dataset.d);break}
    case 'wcell':{const h=findH(t.dataset.h),y=view==='today'?TODAY.getFullYear():vy,m=view==='today'?TODAY.getMonth():vm,k=wkey(y,m,t.dataset.w);if(isAmt(h)){openAmt(h,k);persist=false;break}tap(h,k);break}
    case 'mcell':{const h=findH(t.dataset.h),y=view==='today'?TODAY.getFullYear():vy,m=view==='today'?TODAY.getMonth():vm,k=mkey(y,m);if(isAmt(h)){openAmt(h,k);persist=false;break}tap(h,k);break}
    case 'edithabit':{const h=findH(t.dataset.h);if(!h)break;modal={kind:'habit',rest:(h.rest||[]).slice(),id:h.id,type:h.type,origType:h.type,color:/^#[0-9a-f]{6}$/.test(h.color)?h.color:COLORS[0],name:h.name,target:h.target||1,per:h.per||7,track:h.track||((h.target||1)>1?'count':'check'),unit:h.unit||'',goal:h.goal||0,rem:h.rem?h.rem.m:'',remT:h.rem?h.rem.t:'09:00',fz:Object.assign({off:false,every:7,max:3},h.fz||{}),confirm:false};focusSel='#mName';persist=false;break}
    case 'mdel':
      if(modal&&modal.id){if(modal.confirm){const i=S.habits.findIndex(h=>h.id===modal.id),h=S.habits[i],bk={log:S.log[h.id],count:S.count[h.id],notes:S.notes[h.id],amt:S.amt[h.id]};
        pushUndo(()=>{putBack(S.habits,i,h);Object.keys(bk).forEach(x=>{if(bk[x])S[x][h.id]=bk[x]})});S.habits=S.habits.filter(h=>h.id!==modal.id);delete S.log[modal.id];delete S.count[modal.id];delete S.notes[modal.id];modal=null;toastUndo('Habit deleted')}else{modal.confirm=true;persist=false}}break;
    case 'newhabit':modal={kind:'habit',rest:[],type:view==='habits'?tab:'daily',color:COLORS[0],name:'',target:1,per:7,track:'check',unit:'',goal:0,rem:'',remT:'09:00'};focusSel='#mName';persist=false;break;
    case 'newgoal':modal={kind:'goal',area:goalArea||'Health',title:'',due:'',pin:false,steps:[],pct:0,gk:'pct',unit:'',log:[]};focusSel='#gTitle';persist=false;break;
    case 'gopen':{const g=S.goals.find(x=>x.id===t.dataset.g);if(!g)break;modal={kind:'goal',id:g.id,title:g.title,area:g.area,due:g.due||'',pin:!!g.pin,steps:(g.steps||[]).map(x=>Object.assign({},x)),pct:g.pct,
      gk:gKind(g),unit:g.unit||'',target:g.target,start:g.start,log:(g.log||[]).map(x=>Object.assign({},x)),habit:g.habit,since:g.since,recur:g.recur?Object.assign({},g.recur):null,arch:!!g.arch,newTasks:[]};persist=false;break}
    case 'grec':goalForm();modal.recur=modal.recur?null:{v:undefined,every:'m',from:dk(TODAY)};persist=false;break;
    case 'gtaskadd':{goalForm();const tx=($('#gStep').value||'').trim(),du=$('#gStepDue').value;if(!tx){$('#gStep').focus();persist=false;return}
      (modal.newTasks=modal.newTasks||[]).push({text:tx.slice(0,200),k:/^\d{4}-\d{2}-\d{2}$/.test(du)?du:dk(TODAY)});focusSel='#gStep';persist=false;break}
    case 'gtaskdel':goalForm();modal.newTasks.splice(+t.dataset.i,1);persist=false;break;
    case 'garch':{const g=S.goals.find(x=>x.id===t.dataset.g);if(!g)break;if(g.arch)delete g.arch;else{g.arch=true;delete g.pin}if(modal&&modal.kind==='goal')modal=null;toast(g.arch?'Goal archived':'Goal restored');break}
    case 'gfold':goalArchOpen=!goalArchOpen;persist=false;break;
    case 'gkind':goalForm();modal.gk=t.dataset.v;if(modal.gk==='habit'&&!modal.habit&&S.habits[0])modal.habit=S.habits[0].id;persist=false;break;
    case 'gidea':{goalForm();const x=(IDEAS[AREAS.includes(modal.area)?modal.area:'']||[])[+t.dataset.i];if(!x)break;modal.title=tx(x[0]);modal.gk=x[1];modal.unit=x[2]||'';modal.target=x[3];
      if(x[1]==='habit'&&!modal.habit&&S.habits[0])modal.habit=S.habits[0].id;persist=false;break}
    case 'glogdel':goalForm();modal.log.splice(+t.dataset.i,1);persist=false;break;
    case 'gval':modal={kind:'gval',g:t.dataset.g};focusSel='#gvAmt';persist=false;break;
    case 'gvalsave':{const g=S.goals.find(x=>x.id===modal.g),v=parseFloat(($('#gvAmt').value||'').replace(',','.')),d=$('#gvDate').value;
      if(!g||!Number.isFinite(v)||Math.abs(v)>1e12){$('#gvAmt').focus();persist=false;return}
      (g.log=g.log||[]).push({d:/^\d{4}-\d{2}-\d{2}$/.test(d)?d:dk(TODAY),v});g.pct=gPct(g);modal=null;if(g.pct>=100)toast('Goal reached: '+g.title);break}
    case 'areanew':modal={kind:'area',name:'',color:COLORS[(S.areas||[]).length%COLORS.length]};focusSel='#arName';persist=false;break;
    case 'areaedit':{const a=(S.areas||[]).find(x=>x.name===t.dataset.v);if(!a)break;modal={kind:'area',old:a.name,name:a.name,color:a.color};persist=false;break}
    case 'arcolor':modal.name=$('#arName').value;modal.color=t.dataset.v;persist=false;break;
    case 'areasave':{const n=($('#arName').value||'').replace(/[<>"'&`=]/g,'').trim().slice(0,24);persist=false;
      if(!n){$('#arName').focus();return}
      if(n!==modal.old&&allAreas().includes(n)){toast('There’s already an area called '+n);$('#arName').focus();return}
      S.areas=S.areas||[];if(modal.old){const a=S.areas.find(x=>x.name===modal.old);if(a){a.name=n;a.color=modal.color}S.goals.forEach(g=>{if(g.area===modal.old)g.area=n});if(goalArea===modal.old)goalArea=n}
      else S.areas.push({name:n,color:modal.color});modal=null;persist=true;break}
    case 'areadel':{if(S.goals.some(g=>g.area===modal.old)){toast('Move or delete this area’s goals first');persist=false;break}
      if(!modal.confirm){modal.confirm=true;persist=false;break}S.areas=(S.areas||[]).filter(x=>x.name!==modal.old);if(goalArea===modal.old)goalArea='';modal=null;break}
    case 'gpin':{const g=S.goals.find(x=>x.id===t.dataset.g);if(g){if(g.pin)delete g.pin;else g.pin=true}break}
    case 'garea':goalArea=goalArea===t.dataset.v?'':t.dataset.v;persist=false;break;
    case 'gstep':{goalForm();if(!modal.steps)modal.steps=[];const x=modal.steps[+t.dataset.i];if(x)x.done=!x.done;persist=false;break}
    case 'gstepdel':goalForm();modal.steps.splice(+t.dataset.i,1);persist=false;break;
    case 'gstepadd':{goalForm();const tx=($('#gStep').value||'').trim(),du=$('#gStepDue').value;if(!tx){$('#gStep').focus();persist=false;return}
      modal.steps.push(Object.assign({id:uid(),text:tx.slice(0,200),done:false},/^\d{4}-\d{2}-\d{2}$/.test(du)?{due:du}:{}));focusSel='#gStep';persist=false;break}
    case 'mtype':modal.type=t.dataset.v;persist=false;break;
    case 'testnote':persist=false;if(LN){LN.requestPermissions().then(()=>LN.schedule({notifications:[{id:9,title:'Groundwork Habits',body:tx('Notifications work'),schedule:{at:new Date(Date.now()+1500)}}]})).then(()=>toast('Test notification sent')).catch(()=>toast('Notifications are blocked. Allow them in Android settings'))}
      else if('Notification' in window)Notification.requestPermission().then(x=>{if(x==='granted'){new Notification('Groundwork Habits',{body:tx('Notifications work')});toast('Test notification sent')}else toast('Notifications are blocked. Allow them in your system settings')});else toast('Reminders aren’t supported here yet');break;
    case 'quick':modal={kind:'quick'};focusSel='#qTask';persist=false;break;
    case 'qtask':{const v=($('#qTask').value||'').trim();if(!v){$('#qTask').focus();persist=false;return}const k=dk(TODAY);(S.tasks[k]=S.tasks[k]||{items:[],mind:null}).items.push({id:uid(),text:v.slice(0,100),done:false});
      $('#qTask').value='';focusSel='#qTask';toast('Task added for today');break}
    case 'qhabit':{const h=findH(t.dataset.h);if(h){L(h)[dk(TODAY)]=1;if(S.count[h.id])delete S.count[h.id][dk(TODAY)];toast(h.name+' done')}break}
    case 'qgoal':{const g=S.goals.find(x=>x.id===$('#qGoal').value),v=parseFloat(($('#qAmt').value||'').replace(',','.'));if(!g||!Number.isFinite(v)){$('#qAmt').focus();persist=false;return}
      (g.log=g.log||[]).push({d:dk(TODAY),v});g.pct=gPct(g);toast('Added '+fmtU(v,g.unit)+' to '+g.title);$('#qAmt').value='';break}
    case 'impok':{persist=false;const pin=$('#impPin').value,txt=modal.text;deriveKey(pin,encSalt(txt)).then(k=>decText(txt,k)).then(j=>{modal=null;applyImport(JSON.parse(j))}).catch(()=>{toast('Wrong PIN, or not a Groundwork Habits backup');const e=$('#impPin');if(e){e.value='';e.focus()}});return}
    case 'baknow':persist=false;menuOpen=false;autoBackup(true);break;
    case 'bakopen':persist=false;if(DFS&&DFS.openBackups)DFS.openBackups();break;
    case 'apick':persist=false;menuOpen=false;NB.pickFolder().then(async r=>{if(!r||!r.picked)return;P.andDir=r.name;applyPrefs();
      let ex=null;try{ex=(await NB.readFolder()).text}catch(e){}
      if(ex&&ex!==fileText){modal={kind:'afold',text:ex};render()}else{andText=null;andWrite();render();toast('Groundwork Habits now saves to '+r.name)}}).catch(e=>toast(e&&e.message||'That folder can’t be used'));break;
    case 'afoldkeep':modal=null;andText=null;andWrite();toast('Groundwork Habits now saves to '+P.andDir);break;
    case 'afoldload':if(!modal.confirm){modal.confirm=true;persist=false;break}{const t=modal.text;modal=null;persist=false;andApply(t,true)}break;
    case 'afoldno':modal=null;persist=false;NB.clearFolder();P.andDir='';applyPrefs();break;
    case 'aclear':persist=false;NB.clearFolder();P.andDir='';applyPrefs();toast('Saving on this phone only');break;
    case 'exactok':persist=false;$('#toast').hidden=true;if(NB&&NB.openExactSettings)NB.openExactSettings();break;
    case 'askyes':alarmStop();remYes(t.dataset.h,t.dataset.k);if(ASK){window.close();return}modal=null;break;
    case 'askno':alarmStop();if(ASK){window.close();return}modal=null;persist=false;break;
    case 'mtrack':{const g=x=>{const e=$(x);return e?e.value:null};if(g('#mUnit')!==null)modal.unit=g('#mUnit');if(g('#mGoal')!==null)modal.goal=g('#mGoal');if(g('#mTarget')!==null)modal.target=g('#mTarget');modal.track=t.dataset.v;persist=false;break}
    case 'mrem':modal.rem=t.dataset.v;persist=false;break;
    case 'tpl':modal={kind:'tpl'};tplTab=t.dataset.v||'habits';tplDay=view==='tasks'&&taskWeek?'':'';persist=false;break;
    case 'tpltab':tplTab=t.dataset.v;persist=false;break;
    case 'tpladd':{if(tplTab==='tasks'){const e=$('#tplDay');tplDay=e?e.value:''}const n=tplAdd(+t.dataset.v);modal=null;
      toast(n?(tplTab==='habits'?'Habits added':tplTab==='tasks'?'Tasks added':'Goals added'):'Already added');
      const go=tplTab==='habits'?'habits':tplTab==='tasks'?'tasks':'goals';if(tplTab==='habits')tab='daily';if(view!==go&&view!=='today')location.hash=go;break}
    case 'histundo':persist=false;$('#toast').hidden=true;if(histStep(true)){render();toast('Undone')}break;
    case 'diag':persist=false;(navigator.clipboard?navigator.clipboard.writeText(diagText()):Promise.reject()).then(()=>toast('Diagnostics copied. Paste them into your bug report'),()=>shareFile(diagText(),'groundwork-diagnostics.txt','text/plain','Diagnostics','Diagnostics saved'));break;
    case 'demoreset':if(!DEMO)break;S=seed();hist=[];redos=[];histJ=null;toast('Example data restored');break;
    case 'toastclose':persist=false;$('#toast').hidden=true;break;
    case 'yearimg':persist=false;yearImage();break;
    case 'sharecard':persist=false;progressImage(t.dataset.v,t.dataset.i);break;
    case 'gview':goalView=t.dataset.v;persist=false;break;
    case 'updauto':P.updAuto=!P.updAuto;applyPrefs();if(P.updAuto)updCheck(true);persist=false;break;
    case 'updinstall':persist=false;updInstall();break;
    case 'updnow':persist=false;updCheck(true,true);break;
    case 'mrest':{const i=+t.dataset.v,r=modal.rest=modal.rest||[];if(r.includes(i))r.splice(r.indexOf(i),1);else if(r.length<6)r.push(i);else toast('Keep at least one day to do the habit');persist=false;break}
    case 'mcolor':setColor('habit',t.dataset.v);persist=false;break;
    case 'cset':setColor(t.dataset.f,t.dataset.v);persist=t.dataset.f==='accent'?false:false;break;
    case 'tabnames':P.tabNames=P.tabNames===false;applyPrefs();persist=false;break;
    case 'cpopen':cpOpen[t.dataset.f]=!cpOpen[t.dataset.f];persist=false;break;
    case 'trem':{const it=findT(t.dataset.i,t.dataset.k);if(!it)break;modal={kind:'trem',k:t.dataset.k,i:it.id,rem:it.rem?it.rem.m:'',remT:it.rem?it.rem.t:'09:00'};addingTask=null;persist=false;break}
    case 'tremsave':{const it=findT(modal.i,modal.k);if(!it){modal=null;break}const rt=($('#mRemT')||{}).value||modal.remT;
      it.rem=modal.rem&&/^([01]\d|2[0-3]):[0-5]\d$/.test(rt)?{t:rt,m:modal.rem}:undefined;if(!it.rem)delete it.rem;else{remAsk();remSkip(it.id,modal.k,it.rem)}modal=null;break}
    case 'modalclose':case 'ovclose':if(modal&&modal.kind==='tips')try{localStorage.setItem('groundwork-tips','1')}catch(e){}modal=null;persist=false;break;
    case 'msave':{
      const nm=($('#mName').value||'').trim();if(!nm){$('#mName').focus();return}
      const tg=modal.track==='count'&&$('#mTarget')?clamp(Math.round(+$('#mTarget').value)||2,2,99):1,tr=modal.track,un=tr==='amount'?(($('#mUnit')||{}).value||'').replace(/[<>"'&`=]/g,'').trim().slice(0,12):'',gl=tr==='amount'?Math.max(0,+(($('#mGoal')||{}).value)||0):0,per=modal.type==='daily'&&$('#mPer')?clamp(Math.round(+$('#mPer').value)||7,1,7):7,rt=($('#mRemT')||{}).value||modal.remT,rem=modal.rem&&/^([01]\d|2[0-3]):[0-5]\d$/.test(rt)?{t:rt,m:modal.rem}:null;
      if(rem)remAsk();
      const chD=$('#mCh')?+$('#mCh').value||0:0,chSet=h=>{if(!chD||h.type!=='daily'){delete h.ch;return}if(!h.ch||h.ch.days!==chD)h.ch={from:dk(TODAY),days:chD}};
      if(modal.fz&&$('#mFzE')){modal.fz={off:!$('#mFzOn').checked,every:clamp(Math.round(+$('#mFzE').value)||7,3,30),max:clamp(Math.round(+$('#mFzM').value)||3,1,5)}}
      if(modal.id){const h=findH(modal.id);if(h){chSet(h);h.name=nm;h.color=modal.color;h.target=tg;h.per=per;if(modal.type==='daily'&&modal.rest&&modal.rest.length)h.rest=modal.rest.slice().sort();else delete h.rest;h.track=tr;h.unit=un;h.goal=gl;if(JSON.stringify(h.rem||null)!==JSON.stringify(rem))remSkipToday(h.id,rem);h.rem=rem;if(modal.fz){const f=modal.fz;h.fz=f.off||f.every!==7||f.max!==3?{off:!!f.off,every:f.every,max:f.max}:null;if(!h.fz)delete h.fz}if(h.type!==modal.type){h.type=modal.type;if(view==='habits')tab=h.type}const c=S.count[h.id]||{};Object.keys(c).forEach(k=>{if(c[k]>=tg||tg<2){if(c[k]>=tg)L(h)[k]=1;delete c[k]}})}modal=null;break}
      const id=uid();S.habits.push(Object.assign({id,name:nm,type:modal.type,color:modal.color,target:tg,per,track:tr,unit:un,goal:gl,rem},modal.type==='daily'&&modal.rest&&modal.rest.length?{rest:modal.rest.slice().sort()}:{}));chSet(findH(id));remSkipToday(id,rem);S.log[id]={};
      if(view==='habits')tab=modal.type;modal=null;break}
    case 'gsave':{
      const ti=($('#gTitle').value||'').trim();if(!ti){$('#gTitle').focus();return}
      goalForm();const f={title:ti.slice(0,80),area:modal.area,pct:clamp(+modal.pct||0,0,100)};
      const g=modal.id?S.goals.find(x=>x.id===modal.id):null,o=g||{id:uid()};Object.assign(o,f);
      if(/^\d{4}-\d{2}-\d{2}$/.test(modal.due))o.due=modal.due;else delete o.due;if(modal.pin)o.pin=true;else delete o.pin;
      const k=modal.gk;
      if((k==='num'||k==='habit')&&!(modal.target>0)){toast('Set a target above 0');const e=$('#gTarget');if(e)e.focus();return}
      if(k==='range'&&(modal.start===undefined||modal.target===undefined||modal.start===modal.target)){toast('Set a start and a different target');const e=$('#gStart');if(e)e.focus();return}
      if(k==='habit'&&!findH(modal.habit)){toast('Pick a habit');return}
      if(k==='num'&&modal.recur&&!(Number.isFinite(modal.recur.v)&&modal.recur.v!==0&&/^\d{4}-\d{2}-\d{2}$/.test(modal.recur.from))){toast('Set the amount and start date to add automatically');return}
      if(k==='tasks'&&!(modal.newTasks||[]).length&&!(modal.id&&gTasks({id:modal.id}).length)){toast('Add at least one task');const e=$('#gStep');if(e)e.focus();return}
      const oldRec=o.recur;['kind','unit','target','start','log','habit','since','recur'].forEach(x=>delete o[x]);if(k!=='steps')delete o.steps;
      if(k!=='pct')o.kind=k;
      if(k==='steps'&&modal.steps.length)o.steps=modal.steps;
      if(k==='num'||k==='range'){o.unit=modal.unit;o.target=modal.target;o.log=modal.log;if(k==='range')o.start=modal.start}
      if(k==='habit'){o.habit=modal.habit;o.target=Math.round(modal.target);o.since=/^\d{4}-\d{2}-\d{2}$/.test(modal.since||'')?modal.since:dk(TODAY)}
      if(k==='num'&&modal.recur){o.recur={v:modal.recur.v,every:modal.recur.every,from:modal.recur.from};if(oldRec&&oldRec.last&&oldRec.from===o.recur.from&&oldRec.every===o.recur.every)o.recur.last=oldRec.last}
      if(k==='tasks')(modal.newTasks||[]).forEach(x=>(S.tasks[x.k]=S.tasks[x.k]||{items:[],mind:null}).items.push({id:uid(),text:x.text,done:false,goal:o.id}));
      o.pct=gPct(o);
      if(!g)S.goals.push(o);applyRecurring();o.pct=gPct(o);modal=null;break}
    case 'newquit':modal={kind:'quit',name:'',since:nowLocal()};focusSel='#qName';persist=false;break;
    case 'editquit':{const q=S.quits.find(x=>x.id===t.dataset.q);if(!q)break;modal={kind:'quit',id:q.id,name:q.name,since:q.since};focusSel='#qName';persist=false;break}
    case 'qsave':{
      const nm=($('#qName').value||'').trim(),sv=$('#qSince').value.slice(0,16);if(!nm){$('#qName').focus();return}
      if(!QT.test(sv)||new Date(sv)>new Date()){$('#qSince').focus();toast('Pick a date and time that isn’t in the future');return}
      if(modal.id){const q=S.quits.find(x=>x.id===modal.id);if(q){q.name=nm;q.since=sv}}else S.quits.push({id:uid(),name:nm,since:sv,best:0});modal=null;break}
    case 'qreset':{if(modal.confirm!=='reset'){modal.confirm='reset';persist=false;break}
      const q=S.quits.find(x=>x.id===modal.id);if(q){q.best=Math.max(q.best||0,qDays(q));q.since=nowLocal()}modal=null;toast('Streak restarted. You’ve got this.');break}
    case 'qdel':{if(modal.confirm!=='del'){modal.confirm='del';persist=false;break}
      {const i=S.quits.findIndex(x=>x.id===modal.id),q=S.quits[i];if(q)pushUndo(()=>putBack(S.quits,i,q))}S.quits=S.quits.filter(x=>x.id!==modal.id);modal=null;toastUndo('Streak deleted');break}
    case 'undo':if(!undoLast()){persist=false;break}toast(undos.length?'Restored. '+undos.length+' more to undo':'Restored');break;
    case 'note':modal={kind:'note',h:t.dataset.h,k:t.dataset.k,text:(S.notes[t.dataset.h]||{})[t.dataset.k]||''};focusSel='#nText';persist=false;break;
    case 'nsave':{const v=($('#nText').value||'').trim().slice(0,300),n=S.notes[modal.h]||(S.notes[modal.h]={});if(v)n[modal.k]=v;else delete n[modal.k];modal=null;break}
    case 'feat':{const k=t.dataset.v,on=!feat(k);P.feat=Object.assign({},P.feat,{[k]:on});if(k==='reminder'&&on){const n=new Date(),[hh,mm]=(P.remTime||'21:00').split(':').map(Number);P.remDay=n.getHours()*60+n.getMinutes()>=hh*60+mm?dk(TODAY):''}applyPrefs();persist=false;
      if(k==='reminder')syncNativeReminder();
      if(k==='remnames')syncReminders();
      if(k==='reminder'&&on&&!LN&&'Notification' in window&&Notification.permission!=='granted')Notification.requestPermission().then(x=>{if(x!=='granted'){P.feat=Object.assign({},P.feat,{reminder:false});applyPrefs();toast('Notifications are blocked. Allow them in your system settings')}render()});
      if(k==='ach'&&!on&&view==='achievements'){location.hash='habits'}break}
    case 'resetlayout':P.layout={};applyPrefs();persist=false;toast('Card layout reset');break;
    case 'focusnew':modal={kind:'focus'};focusSel='#fMin';persist=false;break;
    case 'fstart':{const min=clamp(Math.round(+$('#fMin').value)||25,1,180),id=$('#fTask').value,it=id?todo((S.tasks[dk(TODAY)]||{items:[]}).items).find(i=>i.id===id):null;
      P.focusMin=min;applyPrefs();focusRun={k:dk(TODAY),id:it?it.id:'',text:it?it.text:'',end:Date.now()+min*6e4};modal=null;persist=false;
      if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();focusTick();break}
    case 'fpause':if(focusRun){if(focusRun.paused){focusRun.end=Date.now()+focusRun.left;focusRun.paused=false}else{focusRun.left=focusRun.end-Date.now();focusRun.paused=true}}persist=false;focusTick();break;
    case 'fstop':focusRun=null;persist=false;focusTick();break;
    case 'fmark':{const f=lastFocus,it=f&&(S.tasks[f.k]||{items:[]}).items.find(i=>i.id===f.id);if(it)it.done=true;$('#toast').hidden=true;lastFocus=null;break}
    case 'search':modal={kind:'search',q:''};menuOpen=false;focusSel='#sq';persist=false;break;
    case 'sgo':{const v=t.dataset.v,k=t.dataset.k;modal=null;persist=false;
      if(v==='tasks'&&/^\d{4}-\d{2}-\d{2}$/.test(k))taskWeek=wkStart(new Date(k+'T00:00'));
      if(v==='habits'){if(/^\d{4}-\d{2}/.test(k)){vy=+k.slice(0,4);vm=+k.slice(5,7)-1;tab=k.includes('W')?'weekly':k.length===7?'monthly':'daily'}else if(['daily','weekly','monthly'].includes(k))tab=k}
      if(location.hash!=='#'+v){location.hash=v;return}break}
    case 'pinset':modal={kind:'pin'};menuOpen=false;focusSel='#pin1';persist=false;break;
    case 'pinsave':{const a=$('#pin1').value,b=$('#pin2').value;persist=false;
      if(!/^\d{4,8}$/.test(a)){toast('Use 4 to 8 digits');$('#pin1').focus();return}
      if(a!==b){toast('The two PINs don’t match');$('#pin2').focus();return}
      const salt=[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
      if(P.bio&&NB){NB.bioDisable();P.bio=false}
      deriveKey(a,salt).then(async key=>{encKey=key;P.lock={salt,enc:1,check:await encText('groundwork',key,salt)};applyPrefs();save();if(bioOk&&!P.bioNo){bioPin=a;setTimeout(()=>toastAct('Unlock with your fingerprint too?','Turn on','bioon'),1800)}if(dataDir){fileJson=null;writeFile()}modal=null;toast('PIN set. Your data is now encrypted');render()});return}
    case 'pinoff':if(!confirmPinOff){confirmPinOff=true;persist=false;break}if(P.bio&&NB){NB.bioDisable();P.bio=false}P.lock=null;encKey=null;confirmPinOff=false;applyPrefs();fileJson=null;persist=true;toast('PIN removed');break;
    case 'unlock':persist=false;tryUnlock();return;
    case 'bio':persist=false;bioTry();return;
    case 'bioon':persist=false;$('#toast').hidden=true;{const pin=bioPin;bioPin='';NB.bioEnable({pin,title:tx('Confirm your fingerprint')}).then(r=>{if(r&&r.ok){P.bio=true;applyPrefs();toast('Fingerprint unlock is on')}else if(r&&r.why!=='cancelled')toast('Fingerprint unlock is not available')})}break;
    case 'biooff':persist=false;NB.bioDisable();P.bio=false;P.bioNo=true;applyPrefs();toast('Fingerprint unlock is off');break;
    case 'bioask':persist=false;menuOpen=false;modal={kind:'biopin'};focusSel='#bioPin';break;
    case 'biook':{persist=false;const pin=$('#bioPin').value;deriveKey(pin,P.lock.salt).then(k=>decText(P.lock.check,k)).then(()=>{modal=null;render();P.bioNo=false;bioPin=pin;
      NB.bioEnable({pin,title:tx('Confirm your fingerprint')}).then(r=>{bioPin='';if(r&&r.ok){P.bio=true;applyPrefs();toast('Fingerprint unlock is on');render()}})}).catch(()=>{toast('Wrong PIN');const e=$('#bioPin');if(e){e.value='';e.focus()}});return}
    case 'pinforgot':persist=false;if(!lockForgot){lockForgot=true;break}
      // keep a data folder copy (just stop using it) so a synced backup survives; erase this device
      if(dataDir&&DFS){DFS.reset();dataDir=''}S=empty();hist=[];redos=[];histJ=null;P.lock=null;encKey=null;encWait=false;applyPrefs();locked=false;lockForgot=false;save();toast('PIN removed and data on this device erased');break;
    case 'widget':menuOpen=false;persist=false;if(DFS&&DFS.widget)DFS.widget();break;
    case 'wmain':persist=false;if(DFS&&DFS.showMain)DFS.showMain();break;
    case 'featfold':featOpen=!featOpen;persist=false;break;
    case 'tipsok':modal=null;persist=false;try{localStorage.setItem('groundwork-tips','1')}catch(e){}break;
    case 'tipsshow':modal={kind:'tips'};menuOpen=false;persist=false;break;
    case 'tdelrep':{if(!lastDel)break;let n=0;const gone=[];Object.keys(S.tasks).forEach(k=>{if(k>lastDel.k){S.tasks[k].items.forEach((it,i)=>{if(it.rep===lastDel.rep)gone.push([k,i,it])});const b=S.tasks[k].items.length;S.tasks[k].items=S.tasks[k].items.filter(i=>i.rep!==lastDel.rep);n+=b-S.tasks[k].items.length}});
      if(gone.length)pushUndo(()=>gone.forEach(([k,i,it])=>putBack((S.tasks[k]=S.tasks[k]||{items:[],mind:null}).items,i,it)));
      lastDel=null;toastUndo(n?'Deleted '+(n+1)+' tasks':'No later repeats');break}
    case 'amtstep':{const i=$('#aVal');i.value=fmtN(Math.max(0,(+i.value||0)+ +t.dataset.v));persist=false;return}
    case 'amtsave':case 'amtclear':{const h=findH(modal.h);if(h)setAmt(h,modal.k,act==='amtclear'?0:$('#aVal').value);modal=null;break}
    case 'gdel':if(confirmGoal!==t.dataset.g){confirmGoal=t.dataset.g;persist=false;break}
      {const i=S.goals.findIndex(g=>g.id===t.dataset.g),g=S.goals[i];if(g)pushUndo(()=>putBack(S.goals,i,g))}S.goals=S.goals.filter(g=>g.id!==t.dataset.g);confirmGoal=null;if(modal&&modal.kind==='goal')modal=null;toastUndo('Goal deleted');break;
    case 'tprev':taskWeek=addDays(taskWeek,-7);persist=false;break;
    case 'tnext':taskWeek=addDays(taskWeek,7);persist=false;break;
    case 'tnow':taskWeek=wkStart(TODAY);persist=false;break;
    case 'tdone':{const day=S.tasks[t.dataset.k],it=day.items.find(i=>i.id===t.dataset.i);it.done=!it.done;break}
    case 'tdel':{const k=t.dataset.k,day=S.tasks[k],it=day.items.find(i=>i.id===t.dataset.i);if(!it)break;const ix=day.items.indexOf(it);
      pushUndo(it.cal?()=>{const x=((S.tasks[k]||{}).items||[]).find(y=>y.id===it.id);if(x)x.hidden=false}:()=>putBack((S.tasks[k]=S.tasks[k]||{items:[],mind:null}).items,ix,it));lastDel=it&&it.rep?{rep:it.rep,k:t.dataset.k}:null;toastUndo('Task deleted',lastDel?['Delete later repeats too','tdelrep']:null);if(it&&it.cal)it.hidden=true;else day.items=day.items.filter(i=>i.id!==t.dataset.i);break}
    case 'tadd':addingTask=t.dataset.k;addingText='';repSel={rep:'',until:'m',open:''};focusSel='#taskInput';persist=false;break;
    case 'taddgo':persist=false;if(!addTask(t.dataset.k))return;return;
    case 'repmenu':repSel.open=repSel.open===t.dataset.v?'':t.dataset.v;persist=false;break;
    case 'reppick':repSel[t.dataset.m]=t.dataset.v;repSel.open='';persist=false;if(!TOUCH)focusSel='#taskInput';break;
    case 'tcopy':{
      const k=t.dataset.k,prev=dk(addDays(new Date(k+'T00:00:00'),-1)),src=((S.tasks[prev]||{items:[]}).items).filter(i=>!i.cal); // calendar events are not copied
      if(!src.length){toast('Nothing to copy from the day before');persist=false;break}
      (S.tasks[k]=S.tasks[k]||{items:[],mind:null}).items=src.map(i=>({id:uid(),text:i.text,done:false}));break}
    case 'mind':openMind[t.dataset.k]=!openMind[t.dataset.k];persist=false;break;
    case 'menu':insMenu=insMenu===t.dataset.m?null:t.dataset.m;persist=false;break;
    case 'pick':if(t.dataset.m==='habit')insHabit=t.dataset.v;else insRange=+t.dataset.v;insMenu=null;persist=false;break;
    case 'lb':lbTab=t.dataset.v;persist=false;break;
  }
  if(persist)save();
  render();
});

document.addEventListener('keydown',e=>{
  // Ctrl/Cmd+Z outside text fields undoes the latest delete
  // Ctrl+Z undoes deletes, then the last change of any kind, Ctrl+Shift+Z / Ctrl+Y redoes it (text fields keep their own undo)
  const zk=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&(zk==='z'||zk==='y')&&!isField(e.target)&&!locked){const back=zk==='z'&&!e.shiftKey;e.preventDefault();
    // deletes first come back in place (later edits kept), as before; then any other change steps back through the history
    if(back&&undos.length){undoLast();save();render();toast(undos.length?'Restored. '+undos.length+' more to undo':'Restored');return}
    if(histStep(back)){render();toast(back?'Undone':'Redone')}else toast(back?'Nothing to undo':'Nothing to redo');return}
  if(e.target.id==='aVal'&&e.key==='Enter'){e.preventDefault();const b=$('[data-act=amtsave]');if(b)b.click();return}
  if(e.target.id==='pinIn'&&e.key==='Enter'){e.preventDefault();tryUnlock();return}
  if(e.target.id==='taskInput'){
    if(e.key==='Enter'){
      e.preventDefault();const v=e.target.value.trim(),k=e.target.dataset.k;
      if(v)addTask(k);
    }else if(e.key==='Escape'){addingTask=null;addingText='';repSel={rep:'',until:'m',open:''};render()}
  }
  if(e.target.dataset&&(e.target.dataset.et||e.target.dataset.eg)&&(e.key==='Enter'||e.key==='Escape')){e.preventDefault();e.target.blur();return}
  if(modal&&e.key==='Escape'){if(modal.kind==='tips')try{localStorage.setItem('groundwork-tips','1')}catch(_){}modal=null;render()}
  if(modal&&e.key==='Enter'&&e.target.id==='gvAmt'){e.preventDefault();$('[data-act=gvalsave]').click();return}
  if(modal&&e.key==='Enter'&&['qTask','qAmt','bioPin'].includes(e.target.id)){e.preventDefault();$('[data-act='+({qTask:'qtask',qAmt:'qgoal',bioPin:'biook'})[e.target.id]+']').click();return}
  if(modal&&e.key==='Enter'&&e.target.id==='impPin'){e.preventDefault();$('[data-act=impok]').click();return}
  if(modal&&e.key==='Enter'&&e.target.id==='arName'){e.preventDefault();$('[data-act=areasave]').click();return}
  if(modal&&e.key==='Enter'&&e.target.id==='gStep'){e.preventDefault();const b=$('[data-act=gstepadd]')||$('[data-act=gtaskadd]');if(b)b.click();return}
  if(modal&&e.key==='Enter'&&(e.target.id==='mName'||e.target.id==='gTitle'||e.target.id==='qName'||e.target.id==='calUrl')){e.preventDefault();const b=$('[data-act="'+({habit:'msave',quit:'qsave',cal:'calsave'}[modal.kind]||'gsave')+'"]');if(b)b.click()}
  if(e.key==='Escape'&&(menuOpen||insMenu)){menuOpen=false;insMenu=null;render()}
  else if(e.key==='Escape'&&view==='settings'&&!modal&&e.target.id==='setQ'&&setQ){setQ='';e.target.value='';filterSettings()}
  else if(e.key==='Escape'&&view==='settings'&&!modal&&(!isField(e.target)||e.target.id==='setQ')){location.hash=setSec&&!wideSet()?'settings':setBack}
});

document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='mName'&&modal)modal.name=t.value;
  if(t.id==='arName'&&modal)modal.name=t.value;
  if(t.id==='mTarget'&&modal)modal.target=t.value;
  if(t.id==='mPer'&&modal)modal.per=t.value;
  if(t.id==='mUnit'&&modal)modal.unit=t.value;
  if(t.id==='mGoal'&&modal)modal.goal=t.value;
  if(t.id==='setQ'){setQ=t.value;filterSettings();return}
  if(t.id==='mRemT'&&modal)modal.remT=t.value;
  if(t.id==='taskInput')addingText=t.value;
  if(t.id==='sq'&&modal){modal.q=t.value;$('#sres').innerHTML=searchHtml(t.value)}
  if(t.id==='nText'&&modal)modal.text=t.value;
  if(t.id==='gTitle'&&modal)modal.title=t.value;
  if(t.id==='gPct'&&modal){modal.pct=+t.value;const b=$('#gPctV');if(b)b.textContent=t.value+'%'}
  if(t.id==='reflect'){S.journal[mkey(TODAY.getFullYear(),TODAY.getMonth())]=t.value;save()}
  if(t.dataset&&t.dataset.mind){
    const k=t.dataset.mind,f=t.dataset.f,day=(S.tasks[k]=S.tasks[k]||{items:[],mind:null});
    if(!day.mind)day.mind={energy:5,focus:5,motivation:5};
    day.mind[f]=+t.value;const b=document.getElementById('b-'+k+'-'+f);if(b)b.textContent=t.value;save();
  }
  // inline edits: write to S without re-render; empty text is not saved and is restored on blur
  if(t.dataset&&t.dataset.cf){const f=t.dataset.cf,k=t.dataset.k;let v;
    if(k==='h'||k==='s'||k==='l')v=hslHex(...['h','s','l'].map(x=>+$('[data-cf="'+f+'"][data-k="'+x+'"]').value));
    else if(k==='hex'){v=t.value.trim().toLowerCase().replace(/^#?/,'#');if(/^#[0-9a-f]{3}$/.test(v))v='#'+[...v.slice(1)].map(c=>c+c).join('');if(!/^#[0-9a-f]{6}$/.test(v))v=null}
    if(v)setColor(f,v,t)}
  if(t.dataset&&(t.dataset.et||t.dataset.eg)){
    const v=t.textContent.replace(/\s+/g,' ').trim(),o=t.dataset.et?((S.tasks[t.dataset.et]||{items:[]}).items.find(x=>x.id===t.dataset.i)):S.goals.find(x=>x.id===t.dataset.eg);
    if(o&&v){o[t.dataset.et?'text':'title']=v;save()}
  }
});
document.addEventListener('focusout',e=>{const d=e.target.dataset;if(d&&(d.et||d.eg)&&!e.target.textContent.trim())render()});
document.addEventListener('change',e=>{
  if(e.target.id==='impFile'){
    const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
    if(f.size>50e6){toast('That file is too big to be a Groundwork Habits backup');return}
    const r=new FileReader();
    r.onload=()=>{try{
      if(isEnc(r.result)){modal={kind:'impin',text:r.result};focusSel='#impPin';render();return}
      applyImport(JSON.parse(r.result));
    }catch(err){toast('That file is not a Groundwork Habits backup')}};
    r.readAsText(f);return;
  }
  if(e.target.dataset&&e.target.dataset.mind){render()}
  if(e.target.id==='lockSel'){P.lockIdle=+e.target.value;applyPrefs();render();return}
  if(e.target.id==='bakSel'){P.bakEvery=+e.target.value;applyPrefs();autoBackup();return}
  if(e.target.id==='heatSel'){P.heatM=e.target.value==='auto'?undefined:+e.target.value;applyPrefs();render();return}
  if(e.target.id==='langSel'){P.lang=e.target.value||undefined;if(!P.lang)delete P.lang;applyPrefs();location.reload();return}
  if(e.target.id==='gArea'&&modal&&modal.kind==='goal'){goalForm();if(!modal.id)render()}
  if(e.target.id==='remTime'&&/^\d{2}:\d{2}$/.test(e.target.value)){P.remTime=e.target.value;P.remDay='';applyPrefs();syncNativeReminder()}
});
