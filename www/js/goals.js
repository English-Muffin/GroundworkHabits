/* Groundwork Habits: Goals and templates.
   The js/ files are classic scripts loaded in order (index.html) and share one scope, like one big file. */
'use strict';
/* ---------- Goals ---------- */
// goals: summary ring, the 10 life areas (tap one to filter), pinned goals, then the rest. A goal may carry due (YYYY-MM-DD), pin and steps [{id,text,due,done}]; with steps its progress follows them
/* how a goal is measured (g.kind): pct (slider), steps (ticked steps), num (amounts added up to a target, e.g. € saved),
   range (from a start value to a target, e.g. kg or debt left; the latest logged value counts), habit (times a habit was done since a date) */
const gKind=g=>g.kind||(g.steps&&g.steps.length?'steps':'pct');
const gSum=g=>(g.log||[]).reduce((n,x)=>n+x.v,0);
const gLast=g=>{const l=(g.log||[]).slice().sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);return l.length?l[l.length-1].v:g.start};
const gHabitN=g=>{const h=findH(g.habit);if(!h)return 0;const since=g.since||'0000';return Object.keys(L(h)).filter(k=>/-\d{2}$/.test(k)?k>=since:k.slice(0,7)>=since.slice(0,7)).length};
const clampP=x=>Math.max(0,Math.min(100,Math.round(x)));
function gPct(g){const k=gKind(g);
  if(k==='steps')return g.steps&&g.steps.length?Math.round(g.steps.filter(x=>x.done).length/g.steps.length*100):0;
  if(k==='num')return g.target>0?clampP(gSum(g)/g.target*100):0;
  if(k==='range'){const c=gLast(g);return g.start===undefined||g.target===undefined||g.start===g.target||c===undefined?0:clampP((g.start-c)/(g.start-g.target)*100)}
  if(k==='habit')return g.target>0?clampP(gHabitN(g)/g.target*100):0;
  if(k==='tasks'){const t=gTasks(g);return t.length?Math.round(t.filter(x=>x.it.done).length/t.length*100):0}
  return g.pct}
// tasks linked to a goal: [{k (day), it (task)}], oldest first
const gTasks=g=>{const o=[];Object.keys(S.tasks).sort().forEach(k=>S.tasks[k].items.forEach(it=>{if(it.goal===g.id&&!it.hidden)o.push({k,it})}));return o};
// repeating contributions (amount goals): adds g.recur.v every week or month from g.recur.from, up to today; added entries are marked a:1
function applyRecurring(){if(encWait)return false;let ch=false;const today=dk(TODAY);
  S.goals.forEach(g=>{const r=g.recur;if(!r||gKind(g)!=='num'||g.arch)return;let d=new Date((r.last?r.last:r.from)+'T00:00');if(r.last)d=r.every==='w'?addDays(d,7):new Date(d.getFullYear(),d.getMonth()+1,Math.min(+r.from.slice(8),dim(d.getFullYear(),d.getMonth()+1)));
    for(let n=0;n<600&&dk(d)<=today;n++){(g.log=g.log||[]).push({d:dk(d),v:r.v,a:1});r.last=dk(d);ch=true;d=r.every==='w'?addDays(d,7):new Date(d.getFullYear(),d.getMonth()+1,Math.min(+r.from.slice(8),dim(d.getFullYear(),d.getMonth()+1)))}
    if(ch)g.pct=gPct(g)});
  return ch}
// small history line for amount and from-to goals (running total, or each logged value) with the target as a dashed line
function gSpark(g){const k=gKind(g);if(k!=='num'&&k!=='range')return '';const l=(g.log||[]).slice().sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);if(l.length<2)return '';
  let run=0;const pts=l.map(x=>k==='num'?(run+=x.v):x.v);if(k==='range')pts.unshift(g.start);
  const all=pts.concat([g.target]),lo=Math.min(...all),hi=Math.max(...all),y=v=>hi===lo?20:36-(v-lo)/(hi-lo)*32,n=pts.length-1;
  // same look as the Insights chart: smooth curve, soft gradient fill, a dot on each entry, the target as a dashed line
  const P2=pts.map((v,i)=>[+(i/n*100).toFixed(2),+y(v).toFixed(2)]),d=smooth(P2),gid='gsp-'+g.id;
  return '<div class="g2sp"><svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--teal)" stop-opacity=".28"/><stop offset="1" style="stop-color:var(--teal)" stop-opacity="0"/></linearGradient></defs>'
   +'<line x1="0" x2="100" y1="'+y(g.target)+'" y2="'+y(g.target)+'" class="tg"/><path d="'+d+' L100,40 L0,40 Z" fill="url(#'+gid+')"/><path d="'+d+'" class="ln"/></svg>'
   +P2.map(([x,yy])=>'<i style="left:'+x+'%;top:'+(yy/40*100).toFixed(1)+'%"></i>').join('')+'<span class="tgl" style="top:'+(y(g.target)/40*100).toFixed(1)+'%">Goal</span></div>'}
const CUR=/^[€$£¥₹]$/,fmtU=(v,u)=>{const n=(Math.round((+v||0)*100)/100).toLocaleString('en-GB');return u?CUR.test(u)?(v<0?'-':'')+u+n.replace('-',''):n+' '+u:n};
// one line saying where a goal stands, e.g. "€6,500 of €10,000"
function gLine(g){const k=gKind(g),u=g.unit||'';
  if(k==='num')return fmtU(gSum(g),u)+' of '+fmtU(g.target||0,u);
  if(k==='range'){const c=gLast(g);return c===undefined?'Starts at '+fmtU(g.start,u):fmtU(c,u)+' now · goal '+fmtU(g.target,u)+' (from '+fmtU(g.start,u)+')'}
  if(k==='habit'){const h=findH(g.habit);return h?gHabitN(g)+' of '+(g.target||0)+' times · '+esc(h.name):'The linked habit was deleted'}
  if(k==='tasks'){const t=gTasks(g),nx=t.find(x=>!x.it.done);return t.filter(x=>x.it.done).length+' of '+t.length+' tasks done'+(nx?' · next: '+esc(nx.it.text)+' ('+dmy(new Date(nx.k+'T00:00'))+')':'')}
  return ''}
// forecast: when the goal is reached at the pace so far (amount, from-to, habit goals; needs a week of history)
function gForecast(g){const k=gKind(g),p=gPct(g);if(p>=100||p<=0||g.arch||!['num','range','habit'].includes(k))return null;
  const ds=k==='habit'?[g.since].filter(Boolean):(g.log||[]).map(x=>x.d).sort();if(!ds.length)return null;
  const days=Math.round((TODAY-new Date(ds[0]+'T00:00'))/864e5);if(days<7)return null;
  const at=addDays(TODAY,Math.ceil((100-p)/(p/days))),late=g.due&&dk(at)>g.due;
  return {at,late,txt:'At this pace: '+dmy(at)+(g.due?late?' · after your deadline':' · before your deadline':'')}}
const allAreas=()=>AREAS.concat((S.areas||[]).map(a=>a.name));
const areaCol=a=>ACOL[a]||((S.areas||[]).find(x=>x.name===a)||{}).color||'var(--teal)';
// ideas to start from, per life area: [title, measure, unit, target]
const IDEAS={Health:[['Reach a healthy weight','range','kg'],['Sleep 7 hours for 60 nights','habit','',60],['Walk 1,000 km this year','num','km',1000],['Get a full check-up','steps']],
  Fitness:[['Run 500 km this year','num','km',500],['Bench press 100 kg','range','kg',100],['Do 10,000 push-ups','num','reps',10000],['Run a half marathon','steps']],
  Career:[['Send 30 job applications','num','applications',30],['Raise my income','range','€'],['Earn a certification','steps'],['Ship 4 side projects','num','projects',4]],
  Money:[['Save an emergency fund','num','€',10000],['Pay off a debt','range','€',0],['Invest every month','num','€',3000],['Save for a holiday','num','€',2000]],
  Learning:[['Read 12 books','num','books',12],['Practise 100 hours','num','hours',100],['Learn a language to B1','steps'],['Finish an online course','steps']],
  Relationships:[['Plan 12 date nights','num','dates',12],['Call a friend every week','habit','',52],['Meet 5 new people','num','people',5]],
  Family:[['Visit family every month','num','visits',12],['Family dinner every week','habit','',52],['Plan a family trip','steps']],
  Fun:[['Visit 5 new places','num','places',5],['Learn 10 songs','num','songs',10],['Tick off my bucket list','steps']],
  Home:[['Save for a house deposit','num','€',20000],['Declutter every room','steps'],['Renovate a room','steps']],
  Mindset:[['Meditate 100 times','habit','',100],['Journal for 30 days','habit','',30],['Read 20 minutes a day for 90 days','habit','',90]],
  '':[['Reach a number','num','',10],['Go from one value to another','range',''],['Finish a set of steps','steps'],['Build a habit','habit','',30]]};
const MEAS=[['pct','Percent'],['steps','Steps'],['num','Amount'],['range','From → to'],['habit','Habit'],['tasks','Tasks']];
const gLeft=g=>g.due?Math.ceil((new Date(g.due+'T00:00')-TODAY)/864e5):null;
const gState=g=>gPct(g)>=100?['Reached','ok']:gLeft(g)!==null&&gLeft(g)<0?['Overdue','late']:gPct(g)>0?['In progress','on']:['Not started','off'];
const ACOL={Health:'#22c55e',Fitness:'#f43f5e',Career:'#3b82f6',Money:'#f59e0b',Learning:'#8b5cf6',Relationships:'#ec4899',Family:'#fb7185',Fun:'#14b8a6',Home:'#a3a3a3',Mindset:'#6366f1'};
function goalCard(g){const p=gPct(g),st=gState(g),l=gLeft(g),next=(g.steps||[]).find(x=>!x.done),sd=(g.steps||[]).filter(x=>x.done).length;
  return '<section class="card goal2" data-drag="goals" data-id="'+g.id+'">'+GRIP('goal','cg')+'<div class="g2h"><h3><button class="nb" data-act="gopen" data-g="'+g.id+'">'+esc(g.title)+'</button></h3><button class="g2pin'+(g.pin?' on':'')+'" data-act="gpin" data-g="'+g.id+'" aria-pressed="'+!!g.pin+'" aria-label="'+(g.pin?'Unpin':'Pin')+' '+esc(g.title)+'">'+ic('pin')+'</button></div>'
   +'<div class="g2m"><span class="g2st '+st[1]+'">'+st[0]+'</span><span class="g2a"><i style="--c:'+areaCol(g.area)+'"></i>'+esc(g.area)+'</span>'+(l===null||p>=100?'':'<span class="g2d'+(l<0?' late':'')+'">'+(l<0?-l+(l===-1?' day over':' days over'):l===0?'Due today':l+(l===1?' day to go':' days to go'))+'</span>')+(g.steps&&g.steps.length?'<span>'+sd+' of '+g.steps.length+' steps</span>':'')+'</div>'
   +(next?'<div class="g2n">Next step: '+esc(next.text)+(next.due?' · '+dmy(new Date(next.due+'T00:00')):'')+'</div>':'')
   +(gLine(g)?'<div class="g2n g2v"><span>'+gLine(g)+'</span>'+(gKind(g)==='num'||gKind(g)==='range'?'<button class="btn ghost g2add" data-act="gval" data-g="'+g.id+'">'+(gKind(g)==='num'?'+ Add':'Log value')+'</button>':'')+'</div>':'')
   +(()=>{const f=gForecast(g);return f?'<div class="g2n g2fc'+(f.late?' late':'')+'">'+f.txt+'</div>':''})()
   +gSpark(g)+(g.recur&&gKind(g)==='num'?'<div class="g2n" style="color:var(--muted)">Adds '+fmtU(g.recur.v,g.unit)+' every '+(g.recur.every==='w'?'week':'month')+'</div>':'')
   +'<div class="g2b"><div class="tr"><i style="width:'+p+'%"></i></div><b>'+p+'%</b></div>'+(g.arch?'<button class="btn ghost g2add" data-act="garch" data-g="'+g.id+'">Restore</button>':p>=100?'<button class="btn ghost g2add" data-act="garch" data-g="'+g.id+'">Archive</button>':'')+'</section>'}
/* ---------- templates: starter packs for habits, task lists and goals ----------
   habit item: [name, type, track, number, unit, per]  (number = target taps for count, daily goal for amount)
   task pack: texts added to one day; goal item: {t,a,k,u,v,s,st,h} (title, area, kind, unit, target, start, steps, habit name) */
const TPL={
 habits:[
  {n:'Morning routine',d:'Start the day on purpose',i:[['Wake up at the same time'],['Drink a glass of water'],['Make the bed'],['Stretch for 10 minutes'],['Plan the day']]},
  {n:'Evening wind-down',d:'Switch off and sleep better',i:[['No screens after 10 pm'],['Read before bed'],['Lay out tomorrow’s clothes'],['In bed by 11 pm']]},
  {n:'Fitness',d:'Move a little every day',i:[['Workout','daily','check',1,'',4],['Walk','daily','amount',8000,'steps'],['Stretch'],['Drink water','daily','amount',2,'L']]},
  {n:'Mindfulness',d:'Calm, focus and gratitude',i:[['Meditate for 10 minutes'],['Write 3 things I’m grateful for'],['Breathe deeply for 2 minutes'],['Walk outside']]},
  {n:'Healthy eating',d:'Eat well without a diet',i:[['Fruit and vegetables','daily','count',5],['No sugary drinks'],['Cook at home','daily','check',1,'',5],['Plan meals for the week','weekly']]},
  {n:'Study and learning',d:'A little every day adds up',i:[['Study','daily','amount',30,'min'],['Read','daily','amount',10,'pages'],['Learn 10 new words'],['Review my notes','weekly']]},
  {n:'Productivity',d:'Get the important things done',i:[['Plan tomorrow tonight'],['Inbox to zero'],['Deep work','daily','amount',2,'h'],['Weekly review','weekly']]},
  {n:'Home and admin',d:'Stay on top of things',i:[['Tidy for 10 minutes'],['Do the dishes'],['Water the plants','weekly'],['Pay the bills','monthly'],['Deep clean','monthly']]},
  {n:'Digital balance',d:'Less scrolling, more living',i:[['No phone in the first hour'],['Screen time under 2 hours'],['No social media'],['Phone-free meals']]}],
 tasks:[
  {n:'Weekly reset',d:'Plan, clean and shop for the week',i:['Review last week','Plan the week ahead','Clean the kitchen','Do the laundry','Go grocery shopping','Prep meals for 3 days']},
  {n:'Deep clean',d:'The whole home in one go',i:['Dust every room','Vacuum and mop the floors','Clean the bathroom','Clean out the fridge','Change the bed sheets','Take out the recycling']},
  {n:'Trip packing',d:'Leave without forgetting anything',i:['Check passport and tickets','Pack clothes','Pack chargers and adapters','Pack toiletries','Download offline maps','Water the plants and empty the bin']},
  {n:'Moving house',d:'The jobs everyone forgets',i:['Book the movers','Change my address at the bank','Set up internet at the new place','Pack one room','Read the meters','Hand back the keys']},
  {n:'Job hunt',d:'A focused day of applications',i:['Update my CV','Update my online profile','Find 5 jobs to apply for','Send 2 applications','Prepare for an interview','Follow up on applications']},
  {n:'Monthly money check',d:'Ten minutes that save money',i:['Check my bank statements','Pay the bills','Move money to savings','Review my subscriptions','Update my budget']}],
 goals:[
  {n:'Get fit',d:'Running, strength and weight',i:[{t:'Run 5 km without stopping',a:'Fitness',k:'steps',st:['Run 1 km without stopping','Run 3 km','Run 5 km']},{t:'Work out 100 times',a:'Fitness',k:'habit',v:100,h:'Workout'},{t:'Reach a healthy weight',a:'Health',k:'range',u:'kg',s:85,v:78}]},
  {n:'Save money',d:'A safety net and fewer debts',i:[{t:'Build an emergency fund',a:'Money',k:'num',u:'€',v:3000},{t:'Pay off the credit card',a:'Money',k:'range',u:'€',s:2000,v:0},{t:'Save for a holiday',a:'Money',k:'num',u:'€',v:1500}]},
  {n:'Learn a skill',d:'Languages, books and practice',i:[{t:'Learn a language to B1',a:'Learning',k:'steps',st:['Finish a beginner course','Hold a 5-minute conversation','Pass a B1 practice test']},{t:'Read 12 books',a:'Learning',k:'num',u:'books',v:12},{t:'Practise 100 hours',a:'Learning',k:'num',u:'hours',v:100}]},
  {n:'Career growth',d:'Skills, applications and a portfolio',i:[{t:'Earn a certification',a:'Career',k:'steps',st:['Choose the certification','Book the exam','Study for 40 hours','Pass the exam']},{t:'Send 30 job applications',a:'Career',k:'num',u:'applications',v:30},{t:'Build a portfolio',a:'Career',k:'steps',st:['Pick my 3 best projects','Write a short case study for each','Publish it online']}]},
  {n:'Home',d:'A calmer, tidier place to live',i:[{t:'Declutter every room',a:'Home',k:'steps',st:['Bedroom','Kitchen','Living room','Bathroom','Storage']},{t:'Save for a house deposit',a:'Home',k:'num',u:'€',v:20000}]},
  {n:'Mind and wellbeing',d:'Small daily practices',i:[{t:'Meditate 100 times',a:'Mindset',k:'habit',v:100,h:'Meditate for 10 minutes'},{t:'Journal for 30 days',a:'Mindset',k:'habit',v:30,h:'Journal'},{t:'Read 20 minutes a day for 90 days',a:'Mindset',k:'habit',v:90,h:'Read for 20 minutes'}]}]};
let tplTab='habits',tplDay='';
function tplHtml(){const L2=TPL[tplTab],nm=x=>tplTab==='habits'?x[0]:tplTab==='tasks'?x:x.t;
  return '<div class="ov" data-act="ovclose"><div class="mod tplm" role="dialog" aria-modal="true" aria-label="Templates"><h2>Templates</h2>'
   +'<div class="seg" role="tablist">'+[['habits','Habits'],['tasks','Tasks'],['goals','Goals']].map(x=>'<button role="tab" aria-selected="'+(tplTab===x[0])+'" class="'+(tplTab===x[0]?'on':'')+'" data-act="tpltab" data-v="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>'
   +(tplTab==='tasks'?'<label class="gdue"><span class="sub">Add to</span><input class="field" type="date" id="tplDay" value="'+(tplDay||dk(TODAY))+'" aria-label="Add to"></label>':'')
   +'<div class="tpls">'+L2.map((pk,i)=>'<section class="tpl"><div class="tplh"><div><b>'+pk.n+'</b><small>'+pk.d+'</small></div><button class="btn" data-act="tpladd" data-v="'+i+'">Add</button></div><ul>'+pk.i.map(x=>'<li>'+esc(nm(x))+'</li>').join('')+'</ul></section>').join('')+'</div>'
   +'<p class="sub" style="margin:0">Everything a template adds is yours to rename, change or delete.</p><div class="row"><button class="btn ghost" data-act="modalclose">Close</button></div></div></div>'}
// names come from the templates, so show them in the app's language when a translation exists
function tplAdd(i){const pk=TPL[tplTab][i];if(!pk)return;let n=0;const T=x=>tx(x),hasH=nm=>S.habits.find(h=>h.name.toLowerCase()===nm.toLowerCase());
  const mkH=(x,ci)=>{const nm=T(x[0]),ex=hasH(nm);if(ex)return ex;const tr=x[2]||'check',h={id:uid(),name:nm,type:x[1]||'daily',color:COLORS[ci%COLORS.length],target:tr==='count'?x[3]:1,per:x[5]||7,track:tr,unit:tr==='amount'?T(x[4]||''):'',goal:tr==='amount'?x[3]:0,rem:null};S.habits.push(h);S.log[h.id]={};n++;return h};
  if(tplTab==='habits')pk.i.forEach((x,ci)=>mkH(x,ci+S.habits.length));
  if(tplTab==='tasks'){const k=/^\d{4}-\d{2}-\d{2}$/.test(tplDay)?tplDay:dk(TODAY),d=S.tasks[k]=S.tasks[k]||{items:[],mind:null};
    pk.i.forEach(x=>{if(!d.items.some(it=>it.text===T(x))){d.items.push({id:uid(),text:T(x),done:false});n++}})}
  if(tplTab==='goals')pk.i.forEach(x=>{if(S.goals.some(g=>g.title===T(x.t)))return;const g={id:uid(),title:T(x.t),area:x.a,pct:0,kind:x.k,log:[]};
    if(x.u!==undefined)g.unit=T(x.u);if(x.v!==undefined)g.target=x.v;if(x.s!==undefined)g.start=x.s;
    if(x.st)g.steps=x.st.map(t=>({id:uid(),text:T(t),done:false}));
    if(x.h){g.habit=mkH([x.h],S.habits.length).id;g.since=dk(TODAY)}
    S.goals.push(g);n++});
  return n}
let goalArea='',goalArchOpen=false,goalView='cards';
// every goal deadline and dated step, by month; tap one to open its goal
function goalTimeline(gs){const it=[];gs.forEach(g=>{if(g.due)it.push({d:g.due,g,t:'Deadline',done:gPct(g)>=100,due:true});(g.steps||[]).forEach(x=>{if(x.due)it.push({d:x.due,g,t:x.text,done:x.done})})});
  if(!it.length)return emptyBox('timeline','Nothing on the timeline yet','Give a goal a deadline, or its steps dates, and they line up here.','');
  it.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);let o='<div class="gtl">',mo='';const td=dk(TODAY);
  it.forEach(x=>{const d=new Date(x.d+'T00:00'),m=MONTHS[d.getMonth()]+' '+d.getFullYear(),late=!x.done&&x.d<td,left=Math.ceil((d-TODAY)/864e5);
    if(m!==mo){o+='<h3 class="gtm">'+m+'</h3>';mo=m}
    o+='<button class="gti'+(x.done?' done':late?' late':'')+'" data-act="gopen" data-g="'+x.g.id+'"><span class="gtd"><b>'+d.getDate()+'</b><small>'+DAYS[d.getDay()].slice(0,3)+'</small></span><i style="--c:'+areaCol(x.g.area)+'"></i>'
     +'<span class="gtx"><b data-nt>'+esc(x.due?x.g.title:x.t)+'</b><small>'+(x.due?'Deadline':'<span data-nt>'+esc(x.g.title)+'</span>')+'</small></span>'
     +'<span class="gts">'+(x.done?CHECK:late?'Overdue':left===0?'Today':left>0?'In '+left+(left===1?' day':' days'):'')+'</span></button>'});
  return o+'</div>'}
function vGoals(){
  const live=S.goals.filter(g=>!g.arch),done=S.goals.filter(g=>gPct(g)>=100).length,n=S.goals.length,used=new Set(live.map(g=>g.area)).size;
  let o='<div class="card g2sum">'+ring(n?done/n*100:0,92,9,'<b style="font-size:20px">'+done+'/'+n+'</b>')+'<div><div class="lbl">Goals reached</div><b style="font-size:17px">'+(n?'Working across '+used+(used===1?' life area':' of '+allAreas().length+' life areas'):'Pick a life area to start')+'</b></div><span class="g2bt"><button class="btn ghost" data-act="tpl" data-v="goals">Templates</button><button class="btn" data-act="newgoal">+ New Goal</button></span></div>';
  o+='<h2 class="g2t">Life areas</h2><div class="g2areas">'+allAreas().map(a=>{const gs=S.goals.filter(g=>g.area===a),r=gs.filter(g=>gPct(g)>=100).length;
    const cu=!AREAS.includes(a);
    return '<div class="g2aw"><button class="g2area'+(goalArea===a?' on':'')+'" data-act="garea" data-v="'+esc(a)+'" aria-pressed="'+(goalArea===a)+'"><span><i style="--c:'+areaCol(a)+'"></i>'+esc(a)+'</span><small>'+gs.length+(gs.length===1?' goal':' goals')+' · '+r+' reached</small></button>'
      +(cu?'<button class="g2aed" data-act="areaedit" data-v="'+esc(a)+'" aria-label="Edit area '+esc(a)+'">'+ic('pencil')+'</button>':'')+'</div>'}).join('')+'<button class="g2area g2new" data-act="areanew"><span>+ New area</span><small>Your own life area</small></button></div>';
  if(!n)return o+emptyBox('goals','Where are you heading?','Set a goal in any of your 10 life areas. Pick something measurable: a number, steps, or a habit to keep up.','<button class="btn" data-act="newgoal">+ New Goal</button> <button class="btn ghost" data-act="tpl" data-v="goals">Ideas</button>');
  const show=S.goals.filter(g=>!g.arch&&(!goalArea||g.area===goalArea)),pin=show.filter(g=>g.pin),rest=show.filter(g=>!g.pin),arch=S.goals.filter(g=>g.arch&&(!goalArea||g.area===goalArea));
  if(goalArea&&!show.length)o+=emptyBox('goals','No goals in '+esc(goalArea)+' yet','Add one, or pick another life area above.','<button class="btn" data-act="newgoal">+ New Goal</button>');
  o+='<div class="seg gview" role="tablist" aria-label="Goals view">'+[['cards','Cards'],['timeline','Timeline']].map(x=>'<button role="tab" aria-selected="'+(goalView===x[0])+'" class="'+(goalView===x[0]?'on':'')+'" data-act="gview" data-v="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>';
  if(goalView==='timeline')return o+goalTimeline(show);
  if(pin.length)o+='<h2 class="g2t">Pinned</h2><div class="g2list" data-drop="goals">'+pin.map(goalCard).join('')+'</div>';
  if(rest.length)o+='<h2 class="g2t">'+(goalArea?esc(goalArea):pin.length?'Other goals':'All goals')+'</h2><div class="g2list" data-drop="goals">'+rest.map(goalCard).join('')+'</div>';
  if(arch.length)o+='<button class="g2t g2fold" data-act="gfold" aria-expanded="'+goalArchOpen+'">Archived ('+arch.length+') '+ic('down')+'</button>'+(goalArchOpen?'<div class="g2list g2arch">'+arch.map(goalCard).join('')+'</div>':'');
  return o}
