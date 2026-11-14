/* Groundwork Habits: Tasks and Insights views, weekly review, year heatmap, year in review, in-place rendering (morph).
   The js/ files are classic scripts loaded in order (index.html) and share one scope, like one big file. */
'use strict';
/* ---------- Tasks ---------- */
const findT=(id,k)=>((S.tasks[k]||{}).items||[]).find(x=>x.id===id);
function remPicker(what){return '<div class="lbl" style="font-size:9px">Reminder</div><div class="seg trk">'+[['','Off'],['ask','Yes or no'],['alarm','Alarm']].map(x=>'<button class="'+(modal.rem===x[0]?'on':'')+'" data-act="mrem" data-v="'+x[0]+'" aria-pressed="'+(modal.rem===x[0])+'">'+x[1]+'</button>').join('')+'</div>'
  +(modal.rem?'<div class="remcfg"><input class="field" type="time" id="mRemT" aria-label="Reminder time" value="'+esc(modal.remT||'09:00')+'"><p class="sub" style="margin:0">'+(modal.rem==='alarm'?'Rings and vibrates at this time, with Yes and No buttons.':'A quiet notification that stays until you answer Yes or No.')+' Skipped once the '+what+' is done.</p></div>':'')}
// read the goal form's fields into modal (before a re-render or save)
function goalForm(){const v=x=>{const e=$(x);return e?e.value:null},n=x=>{const t=v(x);if(t===null)return;const f=parseFloat(String(t).replace(',','.'));return Number.isFinite(f)?f:undefined};
  if(v('#gTitle')!==null)modal.title=v('#gTitle');if(v('#gArea')!==null)modal.area=v('#gArea');if(v('#gDue')!==null)modal.due=v('#gDue');
  const p=$('#gPin');if(p)modal.pin=p.checked;if(v('#gPct')!==null)modal.pct=+v('#gPct');
  if(v('#gUnit')!==null)modal.unit=v('#gUnit').replace(/[<>"'&`=]/g,'').trim().slice(0,12);if(v('#gTarget')!==null)modal.target=n('#gTarget');if(v('#gStart')!==null)modal.start=n('#gStart');
  if(v('#gHabit')!==null)modal.habit=v('#gHabit');if(v('#gSince')!==null)modal.since=v('#gSince');
  if(modal.recur&&v('#gRecV')!==null){modal.recur.v=n('#gRecV');modal.recur.every=v('#gRecE');modal.recur.from=v('#gRecF')}}
function taskChip(k,it){
  // a past day's unfinished task shows as missed (X); tapping still toggles it done and back
  const miss=feat('missed')&&!it.done&&k<dk(TODAY);
  if(it.cal)return taskChipHtml(k,it,miss).replace('<span contenteditable="plaintext-only"','<span class="calb" title="From Google Calendar" aria-label="From Google Calendar"></span><span contenteditable="plaintext-only"');
  return taskChipHtml(k,it,miss);
}
function taskChipHtml(k,it,miss){
  return '<div class="tk '+(it.done?'done':miss?'miss':'')+'" data-drag="tasks" data-id="'+it.id+'">'+GRIP('task')+'<button class="cb '+(it.done?'on':miss?'cbx':'')+'" data-act="tdone" data-k="'+k+'" data-i="'+it.id+'" role="checkbox" aria-checked="'+it.done+'" aria-label="'+esc(it.text)+(miss?', missed. Tap to mark as done':'')+'">'+(it.done?CHECK:miss?XMARK:'')+'</button><span contenteditable="plaintext-only" role="textbox" aria-label="Task text" data-et="'+k+'" data-i="'+it.id+'">'+esc(it.text)+'</span>'+(it.goal&&S.goals.some(g=>g.id===it.goal)?'<span class="tkg" title="Part of: '+esc(S.goals.find(g=>g.id===it.goal).title)+'" aria-label="Part of a goal">'+ic('goals')+'</span>':'')+(it.cal?'':'<button class="tkb'+(it.rem?' on':'')+'" data-act="trem" data-k="'+k+'" data-i="'+it.id+'" aria-label="'+(it.rem?'Reminder at '+it.rem.t+'. Change':'Add a reminder')+'">'+ic('bell')+'</button>')+'<button class="tkx" data-act="tdel" data-k="'+k+'" data-i="'+it.id+'" aria-label="Delete task">&times;</button></div>';
}
// dates a repeating task lands on, from its first day up to the chosen end (capped)
function repeatDates(k,rep,until){
  const d0=new Date(k+'T00:00'),end=until==='y'?new Date(d0.getFullYear(),11,31):until==='3m'?new Date(d0.getFullYear(),d0.getMonth()+3,d0.getDate()):new Date(d0.getFullYear(),d0.getMonth()+1,0);
  const out=[];for(let d=new Date(d0);d<=end&&out.length<400;d=addDays(d,1)){const w=d.getDay();
    const sameW=w===d0.getDay(),nth=x=>Math.floor((x.getDate()-1)/7);
    if(rep==='d'||(rep==='wd'&&w>0&&w<6)||(rep==='w'&&sameW)||(rep==='m'&&d.getDate()===d0.getDate())
      ||(rep==='w2'&&sameW&&Math.round((d-d0)/864e5)%14===0)              // every 2 weeks
      ||(rep==='mn'&&sameW&&nth(d)===nth(d0))                             // e.g. the second Tuesday of every month
      ||(rep==='ml'&&sameW&&d.getDate()+7>dim(d.getFullYear(),d.getMonth())))out.push(dk(d))}
  return out;
}
let addingText='',repSel={rep:'',until:'m',open:''};
// add the typed task (and its repeats) to day k
function addTask(k){
  const v=(($('#taskInput')||{}).value||addingText).trim();if(!v){const i=$('#taskInput');if(i)i.focus();return false}
  const days=repSel.rep?repeatDates(k,repSel.rep,repSel.until):[k],sid=repSel.rep?uid():'';
  days.forEach(x=>(S.tasks[x]=S.tasks[x]||{items:[],mind:null}).items.push(Object.assign({id:uid(),text:v,done:false},sid?{rep:sid}:{})));
  addingText='';repSel={rep:'',until:'m',open:''};save();focusSel='#taskInput';render();if(days.length>1)toast('Added on '+pl(days.length,'day'));return true;
}
function taskAdder(k,copy){
  const items=vis((S.tasks[k]||{items:[]}).items);
  const d=new Date(k+'T00:00'),nth=['first','second','third','fourth','fifth'][Math.floor((d.getDate()-1)/7)];
  const RO=[['','Doesn’t repeat'],['d','Every day'],['wd','Every weekday (Mon to Fri)'],['w','Every week on '+DAYS[d.getDay()]],['w2','Every 2 weeks on '+DAYS[d.getDay()]],['m','Every month on day '+d.getDate()],['mn','Every month on the '+nth+' '+DAYS[d.getDay()]],['ml','Every month on the last '+DAYS[d.getDay()]]];
  const UO=[['m','Until the end of the month'],['3m','For 3 months'],['y','Until the end of the year']];
  const lab=(L,v)=>(L.find(x=>x[0]===v)||L[0])[1],menu=(m,L,v)=>'<div class="rlist" role="listbox" aria-label="'+(m==='rep'?'Repeat':'Repeat until')+'">'+L.map(x=>'<button role="option" aria-selected="'+(x[0]===v)+'" class="'+(x[0]===v?'on':'')+'" data-act="reppick" data-m="'+m+'" data-v="'+x[0]+'"><span>'+x[1]+'</span>'+(x[0]===v?CHECK:'')+'</button>').join('')+'</div>';
  let o=addingTask===k?'<div class="tadd"><div class="tinr"><input class="tin" id="taskInput" data-k="'+k+'" maxlength="100" placeholder="New task" aria-label="New task" value="'+esc(addingText)+'"><button class="btn tgo" data-act="taddgo" data-k="'+k+'">Add</button></div>'
    +'<div class="trep"><button class="rsel'+(repSel.open==='rep'?' open':'')+'" data-act="repmenu" data-v="rep" aria-haspopup="listbox" aria-expanded="'+(repSel.open==='rep')+'">'+ic('repeat')+'<span>'+lab(RO,repSel.rep)+'</span>'+ic('down')+'</button>'
    +(repSel.rep?'<button class="rsel'+(repSel.open==='until'?' open':'')+'" data-act="repmenu" data-v="until" aria-haspopup="listbox" aria-expanded="'+(repSel.open==='until')+'"><span>'+lab(UO,repSel.until)+'</span>'+ic('down')+'</button>':'')+'</div>'
    +(repSel.open==='rep'?menu('rep',RO,repSel.rep):repSel.open==='until'?menu('until',UO,repSel.until):'')
    +'<p class="sub tadd-h">'+(TOUCH?'Tap Add when you’re done':'Enter to add, Esc to cancel')+'</p></div>':'<button class="addt" data-act="tadd" data-k="'+k+'">+ Add task</button>';
  if(copy&&!items.length)o+='<button class="cpy" data-act="tcopy" data-k="'+k+'">Copy yesterday’s list</button>';
  return o;
}
// month calendar (modal tmonth): tasks per day for a whole month; tapping a day opens its week
function monthCal(first){const y=first.getFullYear(),m=first.getMonth(),n=dim(y,m),lead=first.getDay(),td=dk(TODAY);
  let o='<div class="mcal">'+[0,1,2,3,4,5,6].map(i=>'<span class="mcw" aria-hidden="true">'+new Intl.DateTimeFormat(LANG,{weekday:'narrow'}).format(new Date(2026,2,1+i))+'</span>').join('')+'<span></span>'.repeat(lead);
  for(let d=1;d<=n;d++){const k=dkey(y,m,d),t=todo((S.tasks[k]||{items:[]}).items),dn=t.filter(x=>x.done).length;
    o+='<button class="mcd'+(t.length?(dn===t.length?' all':' has'):'')+(k===td?' now':'')+'" data-act="tmday" data-k="'+k+'" aria-label="'+d+' '+MONTHS[m]+': '+pl(t.length,'task')+(t.length?', '+dn+' done':'')+'"><b>'+d+'</b>'+(t.length?'<small>'+dn+'/'+t.length+'</small>':'')+'</button>'}
  return o+'</div>'}
function vTasks(){
  const days=[];for(let i=0;i<7;i++)days.push(addDays(taskWeek,i));
  const data=days.map(d=>{const t=S.tasks[dk(d)]||{items:[],mind:null};const td=todo(t.items);return {d,k:dk(d),items:vis(t.items),todo:td,mind:t.mind,done:td.filter(i=>i.done).length}});
  const tot=data.reduce((s,x)=>s+x.todo.length,0),done=data.reduce((s,x)=>s+x.done,0),pct=tot?Math.round(done/tot*100):0,mx=Math.max(1,...data.map(x=>x.todo.length));
  const isNow=dk(taskWeek)===dk(wkStart(TODAY));
  const e=addDays(taskWeek,6);
  const range=p2(taskWeek.getDate())+' '+MONR[taskWeek.getMonth()]+' – '+p2(e.getDate())+' '+MONR[e.getMonth()]+' '+e.getFullYear();
  const H=110;
  let o='<div class="ttop"><section class="card wk"><div class="wkhead"><div><div class="lbl" style="font-size:9px">WEEK STARTING</div><span class="wkpill">'+range+'</span></div>'
   +'<div class="wknav"><button data-act="tpl" data-v="tasks" class="wktpl">Templates</button><button data-act="tprev" aria-label="Previous week">'+ic('prev')+'</button><button data-act="tnow">'+(isNow?'This week':'Go to this week')+'</button><button data-act="tnext" aria-label="Next week">'+ic('next')+'</button><button data-act="tmonth">Month</button></div></div>'
   +'<div class="wkbody"><div class="ovp"><div class="t">Overall progress</div><div class="bars">'+data.map(x=>{
      const th=x.todo.length?Math.max(10,x.todo.length/mx*H):6,fh=x.todo.length?x.done/mx*H:0;
      return '<div class="bcol"><div class="bt" style="height:'+th+'px"><i style="height:'+fh+'px"></i></div><span>'+x.d.toLocaleDateString('en-GB',{weekday:'short'})+'</span></div>'}).join('')+'</div></div>'
   +'<div class="ovr">'+ring(pct,92,8,'<span class="big">'+pct+'%</span>')+'<span>'+done+' / '+tot+' completed</span></div></div></section>';
  // mindset chart
  // same look as the Insights consistency chart: smooth curves, soft gradient fill, hover/tap readout
  mindSeries=data;
  const pts=f=>data.map((x,i)=>[+MX(i).toFixed(2),+MY(x.mind?x.mind[f]:0).toFixed(2)]);
  const line=(f,c,g)=>{const d=smooth(pts(f));return '<defs><linearGradient id="'+g+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:'+c+'" stop-opacity=".18"/><stop offset="1" style="stop-color:'+c+'" stop-opacity="0"/></linearGradient></defs>'
    +'<path d="'+d+' L'+MX(6).toFixed(2)+',100 L'+MX(0).toFixed(2)+',100 Z" fill="url(#'+g+')"/><path d="'+d+'" fill="none" style="stroke:'+c+'" stroke-width="2" vector-effect="non-scaling-stroke"/>'};
  o+='<section class="card mind"><div class="t">Mindset tracker</div><div class="leg"><span><i style="background:var(--red)"></i>Energy</span><span><i style="background:var(--teal)"></i>Focus</span><span><i style="background:var(--purple)"></i>Motivation</span></div>'
   +'<div class="ichart mchart" id="mchart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Mindset trend for the week" role="img">'+MF.map(f=>line(f[0],f[1],'mg-'+f[0])).join('')+'</svg>'
   +'<div class="vl"></div>'+MF.map(f=>'<div class="dt" data-f="'+f[0]+'" style="border-color:'+f[1]+'"></div>').join('')+'<div class="tip"><small></small><b></b></div></div>'
   +'<div class="mx">'+data.map(x=>'<span>'+x.d.toLocaleDateString('en-GB',{weekday:'short'})+'</span>').join('')+'</div></section></div>';
  // day columns
  o+='<div class="days">'+data.map(x=>{
    const p=x.todo.length?Math.round(x.done/x.todo.length*100):0,open=!!openMind[x.k],m=x.mind||{};
    return '<section class="day '+(x.k===dk(TODAY)?'now':'')+'" style="--o:'+(isNow?(x.d.getDay()-TODAY.getDay()+7)%7:x.d.getDay())+'"><h3>'+DAYS[x.d.getDay()]+'</h3><div class="dt">'+dmy(x.d)+'</div>'
     +ring(p,70,7,'<span style="font-size:15px">'+p+'%</span>')+'<div class="tl">TASKS</div>'
     +'<div class="tlist" data-drop="tasks" data-k="'+x.k+'">'+x.items.map(it=>taskChip(x.k,it)).join('')+'</div>'+taskAdder(x.k,true)
     +'<button class="mh '+(open?'open':'')+'" data-act="mind" data-k="'+x.k+'" aria-expanded="'+open+'"><span class="lbl">MINDSET</span><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>'
     +(open?'<div class="ms">'+[['energy','Energy'],['focus','Focus'],['motivation','Motivation']].map(f=>'<div class="r"><div><span>'+f[1]+'</span><span class="bdg" id="b-'+x.k+'-'+f[0]+'">'+(m[f[0]]!=null?m[f[0]]:5)+'</span></div><input type="range" min="0" max="10" step="1" value="'+(m[f[0]]!=null?m[f[0]]:5)+'" data-mind="'+x.k+'" data-f="'+f[0]+'" aria-label="'+f[1]+' on '+DAYS[x.d.getDay()]+'"></div>').join('')+'</div>':'')
     +'<div class="cnt"><span>Completed</span><b class="t">'+x.done+'</b></div><div class="cnt"><span>Not completed</span><b>'+(x.todo.length-x.done)+'</b></div></section>';
  }).join('')+'</div>';
  return o;
}

/* ---------- Insights ---------- */
function smooth(pts){let d='M'+pts[0][0]+','+pts[0][1];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],cx=(a[0]+b[0])/2;d+=' C'+cx+','+a[1]+' '+cx+','+b[1]+' '+b[0]+','+b[1]}return d}
function series(n,off,hid){
  const out=[],hh=hid==='all'?null:S.habits.find(h=>h.id===hid),l=hh?L(hh):{};
  for(let i=n-1;i>=0;i--){const d=addDays(TODAY,-i-off);out.push({d,v:hid==='all'?dayPct(d):(l[dk(d)]?100:0)})}
  return out;
}
const avgOf=a=>a.length?Math.round(a.reduce((s,x)=>s+x.v,0)/a.length):0;
/* weekly review: the last 7 days at a glance (Insights always, Today on Sundays) */
function reviewCard(){
  const days=[...Array(7)].map((_,i)=>addDays(TODAY,i-6)),prev=days.map(d=>addDays(d,-7)),dh=byType('daily').length;
  const avg=a=>Math.round(a.reduce((s,d)=>s+dayPct(d),0)/7),hp=avg(days),diff=hp-avg(prev);
  let tt=0,td=0;const md={energy:[],focus:[],motivation:[]};
  days.forEach(d=>{const t=S.tasks[dk(d)];if(!t)return;const a=todo(t.items);tt+=a.length;td+=a.filter(x=>x.done).length;if(t.mind)Object.keys(md).forEach(f=>md[f].push(t.mind[f]))});
  const best=byType('daily').map(h=>({h,s:curStreak(h)})).sort((a,b)=>b.s-a.s)[0],lo=days[0].getTime();
  const miles=S.quits.flatMap(q=>MILES.filter(x=>{const at=qDate(q).getTime()+x*864e5;return at>=lo&&at<=Date.now()}).map(x=>esc(q.name)+' reached '+dur(x)));
  const mood=!feat('mind')?'':md.energy.length?MF.map(f=>'<span style="color:'+f[1]+'">'+f[2]+' '+(md[f[0]].reduce((a,b)=>a+b,0)/md[f[0]].length).toFixed(1)+'</span>').join(' · '):'<span class="muted">Not logged this week</span>';
  return '<section class="card review"><div class="ch"><span class="lbl">Your week in review</span><span class="sub" style="margin:0">'+days[0].getDate()+' '+MON3[days[0].getMonth()]+' – '+TODAY.getDate()+' '+MON3[TODAY.getMonth()]+'</span></div><div class="rvg">'
   +'<div><div class="lbl" style="font-size:9px">Habits</div><b>'+(dh?hp+'%':'–')+'</b>'+(dh?'<span class="sub" style="margin:0;color:'+(diff>=0?'var(--teal)':'var(--red)')+'">'+(diff>=0?'+':'')+diff+'% vs last week</span>':'')+'</div>'
   +'<div><div class="lbl" style="font-size:9px">Tasks</div><b>'+td+' / '+tt+'</b><span class="sub" style="margin:0">done</span></div>'
   +'<div><div class="lbl" style="font-size:9px">Best streak</div><b>'+(best&&best.s?best.s+'d':'–')+'</b><span class="sub" style="margin:0">'+(best&&best.s?esc(best.h.name):'Tick a daily habit to start one')+'</span></div>'
   +(feat('mind')?'<div><div class="lbl" style="font-size:9px">Mindset</div><span class="sub" style="margin:0">'+mood+'</span></div>':'')+'</div>'
   +(miles.length?'<div class="miles" style="margin-top:12px">'+miles.map(x=>'<span>'+x+'</span>').join('')+'</div>':'')+'</section>';
}
/* year heatmap: the last 53 weeks of daily habits, one square per day; fills wide screens, scrolls (newest in view) on phones */
function heatCard(){
  if(!byType('daily').length)return '';
  // auto: as many weeks as fit the card without scrolling (about 6 months on a phone, a year on a wide screen)
  const avail=Math.max(260,(($('#main')||{}).clientWidth||innerWidth)-48),W=P.heatM?Math.round(P.heatM*4.35):clamp(Math.floor((avail+3)/14),8,53),MO=Math.max(1,Math.round(W/4.35)),start=wkStart(addDays(TODAY,-7*(W-1)));heatCard.w=W;let cols='',perfect=0,months='';
  for(let w=0;w<W;w++){let c='';const first=addDays(start,w*7);months+='<span>'+(first.getDate()<=7?MON3[first.getMonth()]:'')+'</span>';
    for(let d=0;d<7;d++){const day=addDays(start,w*7+d);if(day>TODAY){c+='<i class="hz"></i>';continue}
      const v=dayPct(day);if(v===100)perfect++;
      c+='<i class="h'+(v===0?0:v<34?1:v<67?2:3)+'" title="'+day.getDate()+' '+MON3[day.getMonth()]+': '+v+'%"></i>'}
    cols+='<div class="hcol">'+c+'</div>'}
  return '<section class="card heat"><div class="ch"><span class="lbl">Last '+MO+(MO===1?' month':' months')+'</span><span class="hctl"><select class="mini-sel" id="heatSel" aria-label="Months shown" data-nt>'+[['auto','Auto'],[3,'3'],[6,'6'],[12,'12']].map(x=>'<option value="'+x[0]+'"'+(String(P.heatM||'auto')===String(x[0])?' selected':'')+'>'+x[1]+'</option>').join('')+'</select><span class="sub hleg" style="margin:0">Less <i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i> More</span></span></div>'
   +'<div class="hwrap" style="--hw:'+W+'"><div class="hmon">'+months+'</div><div class="hgrid" role="img" aria-label="'+('Daily habit completion for the last '+MO+' months')+'">'+cols+'</div></div><div class="sub">'+perfect+' perfect '+(perfect===1?'day':'days')+' in the last '+MO+(MO===1?' month':' months')+'</div></section>';
}
function vInsights(){
  const dh=byType('daily');
  if(!dh.length)return emptyBox('insights','Your charts are growing','Insights show up once you have daily habits. Tick them for a few days and your consistency, heatmap and best days appear here.',NEWH+demoBtn());
  if(insHabit!=='all'&&!S.habits.some(h=>h.id===insHabit))insHabit='all';
  insSeries=series(insRange,0,insHabit);
  const big=avgOf(insSeries),hn=insHabit==='all'?'Overall':S.habits.find(h=>h.id===insHabit).name;
  const n=insSeries.length,X=i=>n>1?i/(n-1)*100:50,Y=v=>10+(100-v)*.78;
  const pts=insSeries.map((s,i)=>[+X(i).toFixed(2),+Y(s.v).toFixed(2)]),path=smooth(pts);
  const thisW=avgOf(series(7,0,'all')),lastW=avgOf(series(7,7,'all')),diff=thisW-lastW;
  let bestS=0;dh.forEach(h=>{bestS=Math.max(bestS,curStreak(h))});
  const needs=dh.map(h=>({h,p:habitPct(h,7)})).sort((a,b)=>a.p-b.p)[0].h.name;
  const step=Math.max(1,Math.ceil(n/8));
  const xl=insSeries.map((s,i)=>(i%step===0||i===n-1)?'<span>'+s.d.getDate()+' '+MON3[s.d.getMonth()]+'</span>':'').join('');
  const dd=(m,label,items)=>'<div class="selb"><button data-act="menu" data-m="'+m+'" class="'+(insMenu===m?'open':'')+'" aria-haspopup="listbox" aria-expanded="'+(insMenu===m)+'">'+esc(label)+'<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>'
    +(insMenu===m?'<div class="dd" role="listbox">'+items.map(i=>'<button role="option" class="'+(i[2]?'on':'')+'" data-act="pick" data-m="'+m+'" data-v="'+esc(i[0])+'">'+esc(i[1])+'</button>').join('')+'</div>':'')+'</div>';
  let o=(feat('review')?reviewCard():'')+'<section class="card ibig"><div class="lbl" style="font-size:9px">'+(insHabit==='all'?'OVERALL CONSISTENCY':esc(hn).toUpperCase())+'</div><div class="big">'+big+'%</div>'
   +'<div class="sel">'+dd('habit',hn,[['all','Overall',insHabit==='all']].concat(dh.map(h=>[h.id,h.name,insHabit===h.id])))
   +dd('range','Last '+insRange+' days',[7,14,30].map(r=>[String(r),'Last '+r+' days',insRange===r]))+'</div>'
   +'<div class="ichart" id="ichart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Consistency over the last '+insRange+' days"><defs><linearGradient id="ig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--teal)" stop-opacity=".3"/><stop offset="1" style="stop-color:var(--teal)" stop-opacity="0"/></linearGradient></defs><path d="'+path+' L100,100 L0,100 Z" fill="url(#ig)"/><path d="'+path+'" fill="none" style="stroke:var(--teal)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'
   +'<div class="vl" id="vl"></div><div class="dt" id="dt"></div><div class="tip" id="tip"><small></small><b></b></div></div><div class="ix">'+xl+'</div></section>';
  if(feat('heatmap'))o+=heatCard();
  o+='<div class="card stat q" data-card="thisweek"><div class="lbl">THIS WEEK</div><div class="v">'+thisW+'%</div></div>'
   +'<div class="card stat q" data-card="vsweek"><div class="lbl">VS LAST WEEK</div><div class="v" style="color:'+(diff>=0?'var(--teal)':'var(--red)')+'">'+(diff>=0?'+':'')+diff+'%</div></div>'
   +'<div class="card stat q" data-card="beststreak"><div class="lbl">BEST STREAK</div><div class="v">'+FLAME+bestS+'</div></div>'
   +'<div class="card stat q" data-card="needs"><div class="lbl">NEEDS ATTENTION</div><div class="v" style="font-size:16px">'+esc(needs)+'</div></div>';
  // leaderboard
  const ty={daily:'daily',weekly:'weekly',monthly:'monthly'}[lbTab];
  const lh=byType(ty).map(h=>{let p=0;
    if(ty==='daily')p=habitPct(h,30);
    else if(ty==='weekly')p=weeklyStats(h,TODAY.getFullYear(),TODAY.getMonth()).pct;
    else{let c=0,n=0;for(let k=0;k<3;k++){const d=new Date(TODAY.getFullYear(),TODAY.getMonth()-k,1),on=L(h)[mkey(d.getFullYear(),d.getMonth())];if(on)c++;if(on||!pausedM(h,d.getFullYear(),d.getMonth()))n++}p=n?Math.round(c/n*100):0}
    return {h,p}}).sort((a,b)=>b.p-a.p).slice(0,5);
  const MC=['#facc15','#cbd5e1','#d08a4a','#555','#555'];
  o+='<section class="card h" data-card="leader"><div class="ch"><span class="lbl">HABIT LEADERBOARD</span><div class="dwm">'+[['daily','D'],['weekly','W'],['monthly','M']].map(t=>'<button data-act="lb" data-v="'+t[0]+'" role="checkbox" aria-checked="'+(lbTab===t[0])+'" class="'+(lbTab===t[0]?'on':'')+'" aria-label="'+t[0]+'">'+t[1]+'</button>').join('')+'</div></div>'
   +(lh.length?lh.map((x,i)=>'<div class="lrow"><span>'+medal(MC[i])+'</span><div><div class="top"><span>'+esc(x.h.name)+'</span><b>'+x.p+'%</b></div><div class="tr"><i style="width:'+x.p+'%"></i></div></div></div>').join(''):'<p class="muted" style="font-size:12px">No '+ty+' habits yet.</p>')+'</section>';
  const ts=dh.map(h=>({h,s:curStreak(h)})).sort((a,b)=>b.s-a.s).slice(0,5);
  o+='<section class="card h" data-card="topstreaks"><div class="ch"><span class="lbl">TOP STREAKS</span></div>'+ts.map((x,i)=>'<div class="lrow"><span>'+medal(MC[i])+'</span><div><div class="top"><span>'+esc(x.h.name)+'</span><b>'+x.s+'d</b></div><div class="tr"><i style="width:'+Math.max(3,Math.min(100,x.s/30*100))+'%"></i></div></div></div>').join('')+'</section>';
  // goals + tasks
  const gd=S.goals.filter(g=>gPct(g)>=100).length,ga=S.goals.length?Math.round(S.goals.reduce((s,g)=>s+gPct(g),0)/S.goals.length):0;
  let tt=0,td=0;for(let i=0;i<7;i++){const t=S.tasks[dk(addDays(wkStart(TODAY),i))];if(t){const a=todo(t.items);tt+=a.length;td+=a.filter(x=>x.done).length}}
  const tp=tt?Math.round(td/tt*100):0;
  o+='<section class="card h" data-card="goalsum"><div class="ch"><span class="lbl">GOALS</span><button class="link" data-act="goto" data-v="goals">Open →</button></div><div class="bigv">'+gd+' / '+S.goals.length+' completed</div><div class="goal"><div class="tr"><i style="width:'+ga+'%"></i></div></div><div class="sub">Average progress '+ga+'%</div></section>'
   +'<section class="card h" data-card="taskweek"><div class="ch"><span class="lbl">TASKS THIS WEEK</span><button class="link" data-act="goto" data-v="tasks">Open →</button></div><div class="bigv">'+tp+'%</div><div class="goal"><div class="tr"><i style="width:'+tp+'%"></i></div></div><div class="sub">Of this week’s tasks are done</div></section>';
  o+=yearCard();
  const rk=mkey(TODAY.getFullYear(),TODAY.getMonth());
  o+='<section class="card"><h3 style="margin:0 0 12px;font-size:15px;font-weight:600">Monthly Reflection</h3><textarea class="field" id="reflect" placeholder="How was this month? What did you learn?" aria-label="Monthly reflection">'+esc(S.journal[rk]||'')+'</textarea></section>';
  return o;
}
/* year in review: this year's numbers so far, and a picture of them to share */
function yearStats(){const y=String(TODAY.getFullYear()),days=Math.floor((TODAY-new Date(TODAY.getFullYear(),0,1))/864e5)+1;let checks=0,perfect=0,best=0,top=null,topN=0;
  S.habits.forEach(h=>{const ks=Object.keys(L(h)).filter(k=>k.startsWith(y));checks+=ks.length;if(h.type==='daily'&&ks.length>topN){topN=ks.length;top=h}
    if(h.type==='daily'){let run=0;for(let i=0;i<days;i++){const d=new Date(TODAY.getFullYear(),0,1+i);if(L(h)[dk(d)]){run++;best=Math.max(best,run)}else if(!isRest(h,d))run=0}}});
  for(let i=0;i<days;i++)if(byType('daily').length&&dayPct(new Date(TODAY.getFullYear(),0,1+i))===100)perfect++;
  let tasks=0;Object.keys(S.tasks).forEach(k=>{if(k.startsWith(y))tasks+=S.tasks[k].items.filter(t=>t.done&&!t.hidden).length});
  return {year:y,checks,perfect,best,top:top?top.name:'',topN,tasks,goals:S.goals.filter(g=>gPct(g)>=100).length,quit:S.quits.reduce((m,q)=>Math.max(m,qDays(q)),0)}}
function yearCard(){const s=yearStats(),st=(v,l)=>'<div class="ys"><b>'+v+'</b><span>'+l+'</span></div>';
  return '<section class="card yearc" data-card="year"><div class="ch"><span class="lbl">'+s.year+' SO FAR</span><button class="btn ghost" data-act="yearimg">Share as image</button></div><div class="ysg">'
   +st(s.checks,'check-ins')+st(s.perfect,'perfect days')+st(s.best+'d','longest streak')+st(s.tasks,'tasks done')+st(s.goals,'goals reached')+(s.quit?st(s.quit+'d','longest quit streak'):'')+'</div>'
   +(s.top?'<p class="sub" style="margin:12px 0 0"><span>Most kept</span> <b data-nt>'+esc(s.top)+'</b> · <span>'+s.topN+' days</span></p>':'')+'</section>'}
// a 1080×1350 picture in the current theme and accent: the logo, the year, the numbers
async function yearImage(){const s=yearStats(),c=document.createElement('canvas');c.width=1080;c.height=1350;const g=c.getContext('2d'),cs=getComputedStyle(document.documentElement);
  const bg=cs.getPropertyValue('--bg').trim()||'#080808',card=cs.getPropertyValue('--card').trim()||'#0f0f0f',tx2=cs.getPropertyValue('--text').trim()||'#f2f2f2',mu=cs.getPropertyValue('--muted').trim()||'#6f6f6f',ac=cs.getPropertyValue('--teal').trim()||'#9cc96b';
  await document.fonts.ready;const F=(w,px)=>w+' '+px+'px "Space Grotesk",system-ui,sans-serif';
  g.fillStyle=bg;g.fillRect(0,0,1080,1350);
  const bar=(x,y,w,h,col,a)=>{g.globalAlpha=a;g.fillStyle=col;g.beginPath();g.roundRect(x,y,w,h,h/2);g.fill();g.globalAlpha=1};
  bar(96,150,96,22,ac,1);bar(84,180,120,22,ac,.65);bar(72,210,144,22,ac,.35);
  g.fillStyle=tx2;g.font=F(700,120);g.fillText(s.year,250,228);g.fillStyle=mu;g.font=F(500,38);g.fillText(tx('so far, in Groundwork Habits'),254,282);
  const items=[[s.checks,'check-ins'],[s.perfect,'perfect days'],[s.best+'d','longest streak'],[s.tasks,'tasks done'],[s.goals,'goals reached'],[s.quit?s.quit+'d':'-','longest quit streak']];
  items.forEach(([v,l],i)=>{const x=72+(i%2)*480,y=380+Math.floor(i/2)*250;g.fillStyle=card;g.beginPath();g.roundRect(x,y,456,220,36);g.fill();
    g.fillStyle=i===0?ac:tx2;g.font=F(700,96);g.fillText(String(v),x+40,y+128);g.fillStyle=mu;g.font=F(500,34);g.fillText(tx(l),x+40,y+180)});
  if(s.top){g.fillStyle=mu;g.font=F(500,34);g.fillText(tx('Most kept'),72,1185);g.fillStyle=tx2;g.font=F(700,44);g.fillText(s.top.length>34?s.top.slice(0,33)+'…':s.top,72,1240)}
  g.fillStyle=mu;g.font=F(500,28);g.fillText('Groundwork Habits',72,1300);
  const blob=await new Promise(ok=>c.toBlob(ok,'image/png'));shareFile(blob,'groundwork-'+s.year+'.png','image/png','Groundwork Habits '+s.year,'Image saved')}
// a picture of one habit or goal to share: big number, a short line, the last 28 days (habit) or a progress bar (goal)
async function progressImage(kind,id){const h=kind==='h'?findH(id):null,gl=kind==='g'?S.goals.find(x=>x.id===id):null;if(!h&&!gl)return;
  const c=document.createElement('canvas');c.width=1080;c.height=1080;const g=c.getContext('2d'),cs=getComputedStyle(document.documentElement);
  const v=n=>cs.getPropertyValue(n).trim(),bg=v('--bg')||'#080808',card=v('--card')||'#0f0f0f',t2=v('--text')||'#f2f2f2',mu=v('--muted')||'#6f6f6f',ac=(h&&h.color)||v('--teal')||'#9cc96b';
  await document.fonts.ready;const F=(w,px)=>w+' '+px+'px "Space Grotesk",system-ui,sans-serif',fit=(s,n)=>s.length>n?s.slice(0,n-1)+'…':s;
  g.fillStyle=bg;g.fillRect(0,0,1080,1080);
  const bar=(x,y,w,hh,col,a)=>{g.globalAlpha=a;g.fillStyle=col;g.beginPath();g.roundRect(x,y,w,hh,hh/2);g.fill();g.globalAlpha=1};
  bar(96,96,64,16,ac,1);bar(88,118,80,16,ac,.65);bar(80,140,96,16,ac,.35);
  g.fillStyle=mu;g.font=F(500,34);g.fillText(tx(h?'Habit':'Goal'),200,128);g.fillStyle=t2;g.font=F(700,64);g.fillText(fit(h?h.name:gl.title,26),80,290);
  if(h){const st=curStreak(h),l=L(h),days=[...Array(28)].map((_,i)=>dk(addDays(TODAY,i-27))),done=days.filter(k=>l[k]).length;
    g.fillStyle=ac;g.font=F(700,220);g.fillText(String(st),80,540);g.fillStyle=mu;g.font=F(500,40);g.fillText(tx(st===1?'day in a row':'days in a row'),88,610);
    days.forEach((k,i)=>{const x=80+(i%14)*66,y=690+Math.floor(i/14)*72;bar(x,y,52,52,l[k]?ac:card,l[k]?1:1)});
    g.fillStyle=t2;g.font=F(500,38);g.fillText(done+' / 28 '+tx('days'),80,900)}
  else{const p=gPct(gl),ln=gLine(gl).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&'),f=gForecast(gl);
    g.fillStyle=ac;g.font=F(700,220);g.fillText(p+'%',80,540);if(ln){g.fillStyle=t2;g.font=F(500,40);g.fillText(fit(tx(ln),44),88,620)}
    bar(80,690,920,40,card,1);if(p>0)bar(80,690,Math.max(40,920*p/100),40,ac,1);
    if(f){g.fillStyle=mu;g.font=F(500,36);g.fillText(tx(f.txt),80,800)}else if(gl.due){g.fillStyle=mu;g.font=F(500,36);g.fillText(tx('Due')+' '+dmy(new Date(gl.due+'T00:00')),80,800)}}
  g.fillStyle=mu;g.font=F(500,28);g.fillText('Groundwork Habits',80,1000);
  const blob=await new Promise(ok=>c.toBlob(ok,'image/png'));shareFile(blob,'groundwork-'+(h?'habit':'goal')+'.png','image/png','Groundwork Habits','Image saved')}
const MF=[['energy','var(--red)','Energy'],['focus','var(--teal)','Focus'],['motivation','var(--purple)','Motivation']];
const MX=i=>(i+.5)/7*100,MY=v=>96-(v/10)*64;let mindSeries=[];
// sets an element's handlers, removing the ones set by an earlier render
function onlyOn(el,map){(el._on||[]).forEach(([t,f])=>el.removeEventListener(t,f));el._on=Object.entries(map);el._on.forEach(([t,f])=>el.addEventListener(t,f))}
/* render updates the page in place: only nodes that differ change, so a tap re-lays out one row, not the whole screen,
   and scroll positions and focus survive. Children are matched by position. */
function morph(a,b){
  if(a.nodeType!==b.nodeType||a.nodeName!==b.nodeName){a.replaceWith(b);return}
  if(a.nodeType!==1){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return}
  if(a.isEqualNode(b))return;
  for(const at of [...a.attributes])if(!b.hasAttribute(at.name))a.removeAttribute(at.name);
  for(const at of [...b.attributes])if(a.getAttribute(at.name)!==at.value)a.setAttribute(at.name,at.value);
  if(a.nodeName==='INPUT'||a.nodeName==='TEXTAREA'||a.nodeName==='SELECT'){if(a!==document.activeElement&&a.value!==b.value)a.value=b.value;if(a.checked!==b.checked)a.checked=b.checked}
  morphKids(a,b)}
function morphKids(a,b){const ac=a.childNodes,bc=[...b.childNodes];
  bc.forEach((n,i)=>{if(i<ac.length)morph(ac[i],n);else a.appendChild(n)});
  while(ac.length>bc.length)a.removeChild(a.lastChild)}
function bindMind(){
  const box=$('#mchart');if(!box||!mindSeries.length)return;
  const vl=box.querySelector('.vl'),tip=box.querySelector('.tip'),dots=box.querySelectorAll('.dt');
  function at(ev){
    const r=box.getBoundingClientRect(),i=clamp(Math.floor((ev.clientX-r.left)/r.width*7),0,6),x=mindSeries[i],m=x.mind||{},lx=MX(i)/100*r.width;
    vl.style.left=lx+'px';vl.style.opacity=1;
    dots.forEach(d=>{d.style.left=lx+'px';d.style.top=MY(m[d.dataset.f]||0)/100*r.height+'px';d.style.opacity=1});
    tip.style.left=clamp(lx,60,r.width-60)+'px';tip.style.top=Math.max(40,MY(Math.max(m.energy||0,m.focus||0,m.motivation||0))/100*r.height)+'px';tip.style.opacity=1;
    tip.firstChild.textContent=x.d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    tip.lastChild.innerHTML=x.mind?MF.map(f=>'<span style="color:'+f[1]+'">'+m[f[0]]+'</span>').join(' · '):'<span style="color:var(--muted)">Not logged</span>';
  }
  onlyOn(box,{pointermove:at,pointerdown:at,pointerleave:()=>{vl.style.opacity=0;tip.style.opacity=0;dots.forEach(d=>d.style.opacity=0)}});
}
function bindChart(){
  const box=$('#ichart');if(!box||!insSeries.length)return;
  const vl=$('#vl'),dt=$('#dt'),tip=$('#tip'),n=insSeries.length;
  function at(ev){
    const r=box.getBoundingClientRect(),x=clamp(ev.clientX-r.left,0,r.width),i=n>1?Math.round(x/r.width*(n-1)):0,s=insSeries[i];
    const lx=n>1?i/(n-1)*r.width:r.width/2,ly=(10+(100-s.v)*.78)/100*r.height;
    vl.style.left=lx+'px';vl.style.opacity=1;dt.style.left=lx+'px';dt.style.top=ly+'px';dt.style.opacity=1;
    tip.style.left=clamp(lx,40,r.width-40)+'px';tip.style.top=ly+'px';tip.style.opacity=1;
    tip.firstChild.textContent=s.d.getDate()+' '+MON3[s.d.getMonth()];tip.lastChild.textContent=s.v+'%';
  }
  onlyOn(box,{pointermove:at,pointerdown:at,pointerleave:()=>{vl.style.opacity=0;dt.style.opacity=0;tip.style.opacity=0}});
}

