/* Groundwork Habits: Habit logic, streak freezes, small renderers, the Habits and Today views.
   The js/ files are classic scripts loaded in order (index.html) and share one scope, like one big file. */
'use strict';
/* ---------- habit logic ---------- */
const L=h=>S.log[h.id]||(S.log[h.id]={});
// targets: "8 glasses a day" = 8 taps. log[k] still marks done (so every stat keeps working); count[k] holds partial taps
function tap(h,k){const l=L(h),T=h.target||1;if(T<2){if(S.count[h.id])delete S.count[h.id][k];if(l[k])delete l[k];else l[k]=1;return}
  const c=S.count[h.id]||(S.count[h.id]={}),n=(c[k]||(l[k]?T:0))+1;
  if(n>T){delete c[k];delete l[k]}else{c[k]=n;if(n>=T)l[k]=1;else delete l[k]}}
// amount habits ("5 km", "30 pages"): amt[k] holds the number; log[k] marks done once the goal is reached
const isAmt=h=>h.track==='amount',amtOf=(h,k)=>(S.amt[h.id]||{})[k]||0,fmtN=v=>String(Math.round(v*100)/100);
const unitOf=h=>h.unit||'';
function setAmt(h,k,v){const a=S.amt[h.id]||(S.amt[h.id]={}),l=L(h);v=Math.max(0,Math.round((+v||0)*100)/100);
  if(v>0)a[k]=v;else delete a[k];if(v>0&&v>=(h.goal||0))l[k]=1;else delete l[k]}
const monthAmt=(h,y,m)=>Object.entries(S.amt[h.id]||{}).filter(([k])=>k.startsWith(y+'-'+p2(m+1))).reduce((s,[,v])=>s+v,0);
const cellIn=(h,k,on)=>isAmt(h)?(amtOf(h,k)?'<span class="cn'+(on?' on':'')+'">'+fmtN(amtOf(h,k))+'</span>':''):on?CHECK:((h.target||1)>1&&(S.count[h.id]||{})[k]?'<span class="cn">'+S.count[h.id][k]+'</span>':'');
const noteTitle=(h,k)=>feat('notes')&&(S.notes[h.id]||{})[k]?' title="'+esc(S.notes[h.id][k])+'"':'';
const tgt=(h,k)=>isAmt(h)?', '+fmtN(amtOf(h,k))+' '+esc(unitOf(h))+(h.goal?' of '+fmtN(h.goal):''):(h.target||1)>1?', '+((S.count[h.id]||{})[k]||(L(h)[k]?h.target:0))+' of '+h.target:'';
const byType=t=>S.habits.filter(h=>h.type===t);
const isCurM=(y,m)=>y===TODAY.getFullYear()&&m===TODAY.getMonth();
const isFutM=(y,m)=>new Date(y,m,1)>TODAY;
const dkey=(y,m,d)=>y+'-'+p2(m+1)+'-'+p2(d);
const wkey=(y,m,w)=>y+'-'+p2(m+1)+'-W'+w;
const mkey=(y,m)=>y+'-'+p2(m+1);

function dailyStats(h,y,m){
  // a day saved by a streak freeze keeps the run going (it does not count as done)
  const n=dim(y,m),l=L(h),fz=feat('freeze')&&(h.per||7)===7?freezeOf(h).frozen:new Set(),ok=k=>l[k]||fz.has(k)||isRest(h,k);let checks=0,run=0,best=0;
  let rest=0;for(let d=1;d<=n;d++){const k=dkey(y,m,d);if(l[k]){checks++;run++;best=Math.max(best,run)}else if(isRest(h,k))rest++;else if(!fz.has(k))run=0}
  let last=isCurM(y,m)?TODAY.getDate():(isFutM(y,m)?0:n),d=last;
  if(isCurM(y,m)&&d>0&&!l[dkey(y,m,d)])d--;
  let cur=0;while(d>=1&&ok(dkey(y,m,d))){if(l[dkey(y,m,d)])cur++;d--}
  return {pct:Math.min(100,Math.round(checks/Math.max(1,n-rest)*100)),cur,best};
}
function weeklyStats(h,y,m){
  const wn=Math.ceil(dim(y,m)/7),l=L(h),pz=w=>pausedW(h,y,m,w);
  const el=isCurM(y,m)?Math.ceil(TODAY.getDate()/7):(isFutM(y,m)?0:wn);
  let done=0,run=0,best=0,off=0;
  for(let w=1;w<=wn;w++){if(l[wkey(y,m,w)]){done++;run++;best=Math.max(best,run)}else if(pz(w)){if(w<=el)off++}else run=0}
  let w=el,cur=0;if(isCurM(y,m)&&w>0&&!l[wkey(y,m,w)])w--;
  while(w>=1&&(l[wkey(y,m,w)]||pz(w))){if(l[wkey(y,m,w)])cur++;w--}
  return {pct:el-off>0?Math.min(100,Math.round(done/(el-off)*100)):0,cur,best,wn,el};
}
// days-per-week habits: how many days this week (Sunday start) are done
const weekDone=h=>{const l=L(h),s=wkStart(TODAY);let n=0;for(let i=0;i<7;i++){const d=addDays(s,i);if(d<=TODAY&&l[dk(d)])n++}return n};
/* streak freezes (every-day habits): every 7 days done in a row earns a freeze (up to 3); a missed day uses one
   and the streak carries on. Worked out from the history, so nothing extra is stored. */
let fzCache=new Map();
/* every day key (and weekday) from the earliest day asked for to today, built once and shared by all habits:
   replaying years of history per habit with Date objects made each tap slow */
let dayL={end:'',keys:[],dows:[]};
function daysFrom(first){const end=dk(TODAY);if(dayL.end!==end)dayL={end,keys:[],dows:[]};
  if(first<=end&&(!dayL.keys.length||dayL.keys[0]>first)){const keys=[],dows=[];for(let d=new Date(first+'T00:00'),k=dk(d);k<=end;d=addDays(d,1),k=dk(d)){keys.push(k);dows.push(d.getDay())}dayL.keys=keys;dayL.dows=dows}
  const i=first>end?dayL.keys.length:dayL.keys.indexOf(first);return {keys:dayL.keys,dows:dayL.dows,i:i<0?dayL.keys.length:i}}
function freezeOf(h){
  if(fzCache.has(h.id))return fzCache.get(h.id);
  const l=L(h),keys=Object.keys(l).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort(),res={tokens:0,frozen:new Set(),streak:0,best:0};
  const fs=h.fz||{every:7,max:3};
  if(keys.length&&(h.per||7)===7&&feat('freeze')&&!fs.off){let run=0;const end=dk(TODAY),D=daysFrom(keys[0]),rs=h.rest&&h.rest.length?h.rest:null;
    for(let i=D.i;i<D.keys.length;i++){const k=D.keys[i];
      if(l[k]){res.streak++;run++;if(run%fs.every===0&&res.tokens<fs.max){res.tokens++}}
      else if(k===end||(rs&&rs.includes(D.dows[i]))||(h.off&&pausedK(h,k))||(h.skip&&h.skip.includes(k))){}
      else if(res.streak&&res.tokens){res.tokens--;res.frozen.add(k)}
      else{res.streak=0;run=0}
      res.best=Math.max(res.best,res.streak)}}
  fzCache.set(h.id,res);return res}
const freezeTotal=()=>byType('daily').reduce((n,h)=>n+freezeOf(h).tokens,0);
const curStreak=h=>{if(feat('freeze')&&(h.per||7)===7&&!(h.fz&&h.fz.off))return freezeOf(h).streak;const l=L(h);let d=TODAY;if(!l[dk(d)])d=addDays(d,-1);let n=0;for(let i=0;i<5000&&(l[dk(d)]||isRest(h,d));i++){if(l[dk(d)])n++;d=addDays(d,-1)}return n};
const dayPct=date=>{const k=dk(date),hs=byType('daily').filter(h=>L(h)[k]||!isRest(h,date));if(!hs.length)return 0;return Math.round(hs.filter(h=>L(h)[k]).length/hs.length*100)};
const habitPct=(h,n)=>{const l=L(h);let c=0;for(let i=0;i<n;i++)if(l[dk(addDays(TODAY,-i))])c++;return Math.round(c/n*100)};
// rest days: planned days off for an every-day habit; they neither count nor break a streak (a tick on one still counts)
// paused habits: h.off=[{f,t?}] day ranges (t missing = still paused); paused days count like rest days
// a week (days 1-7, 8-14 … of the month) or a month counts as paused when any of its days is
const pausedSpan=(h,a,b)=>!!h.off&&h.off.some(p=>p.f<=b&&(!p.t||p.t>=a)),pausedW=(h,y,m,w)=>pausedSpan(h,dkey(y,m,(w-1)*7+1),dkey(y,m,Math.min(w*7,dim(y,m)))),pausedM=(h,y,m)=>pausedSpan(h,dkey(y,m,1),dkey(y,m,dim(y,m)));
const pausedK=(h,k)=>!!h.off&&h.off.some(p=>k>=p.f&&(!p.t||k<=p.t)),pausedNow=h=>pausedK(h,dk(TODAY));
// skipped days (h.skip, day keys from Today's skip button) count like rest days too
const isRest=(h,d)=>((h.off||h.skip)&&(k=>(h.skip&&h.skip.includes(k))||(h.off&&pausedK(h,k)))(typeof d==='string'?d:dk(d)))||!!(h.rest&&h.rest.length&&(h.per||7)===7&&h.rest.includes((typeof d==='string'?new Date(d+'T00:00'):d).getDay()));
const doneToday=()=>{const k=dk(TODAY),hs=byType('daily').filter(h=>!pausedNow(h)&&(L(h)[k]||!isRest(h,TODAY)));return {done:hs.filter(h=>L(h)[k]).length,total:hs.length}};

/* ---------- small renderers ---------- */
function ring(p,size,sw,inner,cls){
  const r=(size-sw)/2,C=2*Math.PI*r,c=size/2;
  return '<div class="ringw '+(cls||'')+'" style="width:'+size+'px;height:'+size+'px"><svg viewBox="0 0 '+size+' '+size+'" aria-hidden="true"><circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="var(--track)" stroke-width="'+sw+'"/>'
   +(p>0?'<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="var(--teal)" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+(C*(1-p/100))+'" transform="rotate(-90 '+c+' '+c+')"/>':'')
   +'</svg><div class="rin">'+inner+'</div></div>';
}
const statCell=st=>'<span>'+st.pct+'%</span><span class="s f">'+FLAME+st.cur+'</span><span class="s t">'+STAR+st.best+'</span>';
const GRIP=(what,cls)=>feat('drag')?'<button class="grip'+(cls?' '+cls:'')+'" type="button" aria-label="Move '+what+'. Drag, or use the arrow keys">'+ic('grip')+'</button>':'';
const nameCell=h=>'<div class="gname" style="--c:'+h.color+'">'+(P.hsort?'':GRIP('habit'))+'<span class="tdot"></span><button class="nm nb" data-act="edithabit" data-h="'+h.id+'" title="'+esc(h.name)+'. Tap to edit">'+esc(h.name)+'</button>'+(pausedNow(h)?'<span class="pzb">Paused</span>':'')+'</div>';
/* empty screens: a small drawing made from the logo's layers (follows the accent), a title, a line and the next step */
const EART={'habits':'<rect x="38" y="14" width="56" height="20" rx="10" class="eo"/><rect x="24" y="44" width="84" height="20" rx="10" class="eo"/><rect x="10" y="74" width="112" height="20" rx="10" class="ef"/>', 'goals':'<rect x="10" y="78" width="44" height="18" rx="9" class="ef" opacity=".35"/><rect x="44" y="56" width="44" height="18" rx="9" class="ef" opacity=".65"/><rect x="78" y="34" width="44" height="18" rx="9" class="ef"/><path d="M100 30V8" class="ep"/><path d="M100 8h16l-4 5 4 5h-16z" class="et"/>', 'insights':'<path d="M8 98h116" class="ep2"/><rect x="18" y="80" width="18" height="14" rx="6" class="ef" opacity=".45"/><rect x="44" y="70" width="18" height="24" rx="6" class="ef" opacity=".65"/><rect x="70" y="56" width="18" height="38" rx="6" class="ef" opacity=".85"/><rect x="96" y="20" width="18" height="74" rx="6" class="eo"/>', 'streaks':'<rect x="24" y="72" width="84" height="22" rx="11" class="ef"/><path d="M66 14c10 12 18 20 18 32a18 18 0 0 1-36 0c0-8 5-13 9-18 1 6 3 9 6 10-2-8 0-16 3-24z" fill="var(--flame)"/><path d="M66 40c4 5 7 8 7 12a7 7 0 0 1-14 0c0-4 3-7 7-12z" fill="var(--star)"/>', 'timeline':'<rect x="10" y="20" width="60" height="16" rx="8" class="ef" opacity=".5"/><rect x="40" y="46" width="72" height="16" rx="8" class="ef" opacity=".8"/><rect x="24" y="72" width="56" height="16" rx="8" class="eo"/><path d="M10 100h112" class="ep2"/>'};
const emptyBox=(art,title,text,btns)=>'<div class="empty eart"><svg viewBox="0 0 132 110" aria-hidden="true">'+EART[art]+'</svg><b>'+title+'</b><p>'+text+'</p>'+(btns?'<div class="erow">'+btns+'</div>':'')+'</div>';
const demoBtn=()=>TESTING?' <button class="btn ghost" data-act="demo">Load demo data</button>':'';
const NEWH='<button class="btn" data-act="newhabit">+ New Habit</button> <button class="btn ghost" data-act="tpl" data-v="habits">Templates</button>';
const emptyHabits=()=>emptyBox('habits','Lay the first layer','Small daily habits are the groundwork. Start with one you can do in two minutes.',NEWH+demoBtn());

/* ---------- Habits view ---------- */
function summary(){
  const cur=isCurM(vy,vm),t=doneToday();
  return '<div class="sum"><div><div class="lbl">'+MONTHS[vm].toUpperCase()+' '+vy+'</div><b>'+(cur?t.done+'/'+t.total+' habits done today':'Monthly summary')+'</b></div>'
   +'<div class="nav"><button class="circ-btn" data-act="mprev" aria-label="Previous month">'+ic('prev')+'</button><button class="circ-btn" data-act="mnext" aria-label="Next month">'+ic('next')+'</button></div>'
   +(cur&&t.total?'<div class="bar"><i style="width:'+Math.round(t.done/t.total*100)+'%"></i></div>':'')+'</div>';
}
// Habits page order (P.hsort, per device): your own order, longest streak, A–Z, or most missed in the month shown; sorted lists have no drag grips
const HSORTS=[['','Your order'],['streak','Longest streak'],['name','A–Z'],['missed','Most missed this month']];
function sortH(hs){const k=P.hsort,y=TODAY.getFullYear(),m=TODAY.getMonth();if(!k)return hs;
  const miss=h=>{const l=L(h);if(h.type==='weekly'){const st=weeklyStats(h,vy,vm);let d=0;for(let w=1;w<=st.el;w++)if(l[wkey(vy,vm,w)])d++;return st.el-d}if(h.type==='monthly')return isFutM(vy,vm)||l[mkey(vy,vm)]?0:1;
    const last=isCurM(vy,vm)?TODAY.getDate()-1:isFutM(vy,vm)?0:dim(vy,vm);let n=0;for(let d=1;d<=last;d++){const kk=dkey(vy,vm,d);if(!l[kk]&&!isRest(h,kk))n++}return n};
  const str=h=>h.type==='daily'?curStreak(h):h.type==='weekly'?weeklyStats(h,y,m).cur:Object.keys(L(h)).filter(x=>/^\d{4}-\d{2}$/.test(x)).length;
  const v=k==='streak'?str:k==='missed'?miss:null;
  return hs.slice().sort((a,b)=>v?v(b)-v(a)||a.name.localeCompare(b.name,LANG):a.name.localeCompare(b.name,LANG))}
function vHabits(){
  let out=summary();
  out+='<div class="tabs"><div class="seg" role="tablist">'+['daily','weekly','monthly'].map(t=>'<button role="tab" aria-selected="'+(tab===t)+'" class="'+(tab===t?'on':'')+'" data-act="tab" data-v="'+t+'">'+t+'</button>').join('')+'</div><span class="tabbt"><select class="mini-sel hsort" id="hSort" aria-label="Sort habits">'+HSORTS.map(x=>'<option value="'+x[0]+'"'+((P.hsort||'')===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select><button class="btn ghost" data-act="tpl" data-v="habits">Templates</button><button class="btn" data-act="newhabit">+ New Habit</button></span></div>';
  if(tab==='daily')out+=dailyGrid();else if(tab==='weekly')out+=weeklyList();else out+=monthlyList();
  return out;
}
function dailyGrid(){
  const hs=sortH(byType('daily'));if(!hs.length)return emptyHabits();
  const n=dim(vy,vm),pts=[];
  for(let d=1;d<=n;d++){const date=new Date(vy,vm,d);pts.push(date>TODAY?0:dayPct(date))}
  const yy=v=>12+(100-v)*.76;
  const curve=smooth(pts.map((v,i)=>[+((i+.5)/n*100).toFixed(2),+yy(v).toFixed(2)])); // same curve as the Insights chart
  const area=curve+' L'+((pts.length-.5)/n*100).toFixed(2)+',100 L'+(.5/n*100).toFixed(2)+',100 Z';
  const avg=Math.round(hs.reduce((s,h)=>s+dailyStats(h,vy,vm).pct,0)/hs.length);
  let o='<div class="gcard"><div class="gin" data-drop="habits-daily" style="--n:'+n+'">';
  o+='<div class="grow chartrow"><div class="gname"><span class="tdot"></span><span class="lbl" style="flex:1;min-width:0;color:var(--g4a);font-size:8px">TREND</span></div>'
   +'<div class="gchart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--teal)" stop-opacity=".3"/><stop offset="1" style="stop-color:var(--teal)" stop-opacity="0"/></linearGradient></defs><path d="'+area+'" fill="url(#ga)"/><path d="'+curve+'" fill="none" style="stroke:var(--teal)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'
   +pts.map((v,i)=>'<span class="pt" style="left:'+((i+.5)/n*100)+'%;top:'+yy(v)+'%"></span>').join('')+'</div>'
   +'<div class="gstat"><div class="avg"><small>AVG</small><b>'+avg+'%</b></div></div></div>';
  o+='<div class="grow hdr"><div class="gname">HABIT</div>';
  for(let d=1;d<=n;d++)o+='<div class="dn '+(isCurM(vy,vm)&&d===TODAY.getDate()?'now':'')+'">'+d+'</div>';
  o+='<div class="gstat">STATS</div></div>';
  hs.forEach(h=>{
    const l=L(h),st=dailyStats(h,vy,vm),fzs=feat('freeze')?freezeOf(h).frozen:null;
    o+='<div class="grow hrow" data-drag="habits-daily" data-id="'+h.id+'">'+nameCell(h);
    for(let d=1;d<=n;d++){
      const k=dkey(vy,vm,d),fut=new Date(vy,vm,d)>TODAY,on=!!l[k];
      o+='<div class="cellw"><button class="cell '+(on?'on':fzs&&fzs.has(k)?'fz-day':isRest(h,k)?'rest':'')+'" data-act="cell" data-h="'+h.id+'" data-d="'+k+'" '+(fut?'disabled':'')+' role="checkbox" aria-checked="'+on+'" aria-label="'+esc(h.name)+', '+d+' '+MONTHS[vm]+tgt(h,k)+(on?'':fzs&&fzs.has(k)?', '+tx('Saved by a streak freeze'):isRest(h,k)?', '+tx('Rest day'):'')+'"'+noteTitle(h,k)+'>'+cellIn(h,k,on)+'</button></div>';
    }
    o+='<div class="gstat"><button class="nb gsb" data-act="hdetail" data-h="'+h.id+'" aria-label="Details for '+esc(h.name)+'">'+statCell(st)+'</button></div></div>';
  });
  return o+'</div></div>';
}
function weeklyList(){
  const hs=sortH(byType('weekly'));if(!hs.length)return emptyHabits();
  const wn=Math.ceil(dim(vy,vm)/7),el=isCurM(vy,vm)?Math.ceil(TODAY.getDate()/7):(isFutM(vy,vm)?0:wn);
  let o='<div class="wscroll"><div class="wcard" data-drop="habits-weekly" style="--w:'+wn+'"><div class="wrow h"><div class="gname lbl">HABIT</div>';
  for(let w=1;w<=wn;w++)o+='<div class="c lbl">W'+w+'</div>';
  o+='<div class="gstat lbl">STATS</div></div>';
  hs.forEach(h=>{
    const l=L(h),st=weeklyStats(h,vy,vm);
    o+='<div class="wrow" data-drag="habits-weekly" data-id="'+h.id+'">'+nameCell(h);
    for(let w=1;w<=wn;w++){const on=!!l[wkey(vy,vm,w)];
      o+='<div class="c"><button class="cell '+(on?'on':pausedW(h,vy,vm,w)?'rest':'')+'" data-act="wcell" data-h="'+h.id+'" data-w="'+w+'" '+(w>el?'disabled':'')+' role="checkbox" aria-checked="'+on+'" aria-label="'+esc(h.name)+', week '+w+tgt(h,wkey(vy,vm,w))+'">'+cellIn(h,wkey(vy,vm,w),on)+'</button></div>'}
    o+='<div class="gstat"><button class="nb gsb" data-act="hdetail" data-h="'+h.id+'" aria-label="Details for '+esc(h.name)+'">'+statCell(st)+'</button></div></div>';
  });
  return o+'</div></div>';
}
function monthlyList(){
  const hs=sortH(byType('monthly'));if(!hs.length)return emptyHabits();
  return '<div class="mlist" data-drop="habits-monthly">'+hs.map(h=>{
    const on=!!L(h)[mkey(vy,vm)],fut=isFutM(vy,vm);
    return '<div class="mrow" data-drag="habits-monthly" data-id="'+h.id+'" style="--c:'+h.color+'">'+(P.hsort?'':GRIP('habit'))+'<button class="cell '+(on?'on':pausedM(h,vy,vm)?'rest':'')+'" data-act="mcell" data-h="'+h.id+'" '+(fut?'disabled':'')+' role="checkbox" aria-checked="'+on+'" aria-label="'+esc(h.name)+tgt(h,mkey(vy,vm))+'">'+cellIn(h,mkey(vy,vm),on)+'</button><span class="tdot"></span><button class="nm nb" data-act="edithabit" data-h="'+h.id+'" title="'+esc(h.name)+'. Tap to edit">'+esc(h.name)+'</button><span class="st '+(on?'d':'')+'">'+(on?'Done':'Pending')+'</span></div>';
  }).join('')+'</div>';
}

/* ---------- habit details (modal hdetail): streaks, check-ins, the last 26 weeks, the last 6 months, notes and pauses ---------- */
function bestStreak(h){if(feat('freeze')&&(h.per||7)===7&&!(h.fz&&h.fz.off))return freezeOf(h).best;
  const l=L(h),ks=Object.keys(l).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort();if(!ks.length)return 0;const D=daysFrom(ks[0]);let run=0,best=0;
  for(let i=D.i;i<D.keys.length;i++){const k=D.keys[i];if(l[k]){run++;best=Math.max(best,run)}else if(!isRest(h,k)&&k!==D.keys[D.keys.length-1])run=0}return best}
function habitDetail(h){
  const l=L(h),fmt=new RegExp(h.type==='daily'?'^\\d{4}-\\d{2}-\\d{2}$':h.type==='weekly'?'-W\\d$':'^\\d{4}-\\d{2}$'),n=Object.keys(l).filter(k=>fmt.test(k)).length;
  const y=TODAY.getFullYear(),m=TODAY.getMonth(),stat=(a,b)=>'<div class="hds"><b>'+a+'</b><span class="sub" style="margin:0">'+b+'</span></div>';
  // count and amount habits: a total per month ("42 km", "×120") and the best month ever
  const cnt=(h.target||1)>1&&!isAmt(h),tot=pre=>isAmt(h)?Object.entries(S.amt[h.id]||{}).reduce((s,[k,v])=>k.startsWith(pre)?s+v:s,0):cnt?Object.keys(l).filter(k=>k.startsWith(pre)).length*h.target+Object.entries(S.count[h.id]||{}).reduce((s,[k,v])=>k.startsWith(pre)&&!l[k]?s+v:s,0):0;
  const fmtT=v=>isAmt(h)?fmtN(v)+(unitOf(h)?' '+esc(unitOf(h)):''):'×'+v;
  let best=null;if(isAmt(h)||cnt)new Set(Object.keys(l).concat(Object.keys(S.amt[h.id]||{}),Object.keys(S.count[h.id]||{})).map(k=>k.slice(0,7))).forEach(pre=>{const v=tot(pre);if(v>0&&(!best||v>best.v))best={pre,v}});
  let o='<div class="hdstats">'+(h.type==='daily'?stat(FLAME+curStreak(h),'Current streak')+stat(STAR+bestStreak(h),'Best streak'):h.type==='weekly'?stat(FLAME+weeklyStats(h,y,m).cur,'Current streak'):'')+stat(n,'Check-ins')+(best?stat(fmtT(best.v),'Best month: '+MON3[+best.pre.slice(5,7)-1]+' '+best.pre.slice(0,4)):'')+'</div>';
  if(h.type==='daily'){const W=26,start=wkStart(addDays(TODAY,-7*(W-1)));let cols='',months='';
    for(let w=0;w<W;w++){let c='';const first=addDays(start,w*7);months+='<span>'+(first.getDate()<=7?MON3[first.getMonth()]:'')+'</span>';
      for(let d=0;d<7;d++){const day=addDays(start,w*7+d),k=dk(day);c+=day>TODAY?'<i class="hz"></i>':'<i class="h'+(l[k]?3:0)+'"></i>'}
      cols+='<div class="hcol">'+c+'</div>'}
    o+='<div class="lbl" style="font-size:9px">Last 6 months</div><div class="hwrap hdh" style="--hw:'+W+'"><div class="hmon">'+months+'</div><div class="hgrid" role="img" aria-label="Days done in the last 6 months">'+cols+'</div></div>'}
  o+='<div class="lbl" style="font-size:9px">Each month</div><div class="hdm">';
  for(let i=5;i>=0;i--){const d=new Date(y,m-i,1),Y=d.getFullYear(),M=d.getMonth(),p=h.type==='daily'?dailyStats(h,Y,M).pct:h.type==='weekly'?weeklyStats(h,Y,M).pct:(l[mkey(Y,M)]?100:0);
    const tt=isAmt(h)||cnt?tot(Y+'-'+p2(M+1)):0;o+='<span>'+MON3[M]+'</span><div class="tr"><i style="width:'+p+'%"></i></div><b>'+p+'%'+(tt?' · '+fmtT(tt):'')+'</b>'}
  o+='</div>';
  const nt=Object.entries(S.notes[h.id]||{}).sort((a,b)=>a[0]<b[0]?1:-1).slice(0,5);
  if(nt.length)o+='<div class="lbl" style="font-size:9px">Notes</div>'+nt.map(([k,v])=>'<p class="sub hdn" style="margin:0"><b>'+esc(k)+'</b> <span data-nt>'+esc(v)+'</span></p>').join('');
  if(h.off&&h.off.length)o+='<div class="lbl" style="font-size:9px">Pauses</div>'+h.off.map(p=>'<p class="sub" style="margin:0">'+esc(p.f)+' – '+(p.t?esc(p.t):'<span>now</span>')+'</p>').join('');
  return o}

/* ---------- Today ---------- */
// "never miss twice": an every-day habit missed yesterday (not a rest day) that already had history before then
// challenges: h.ch={from,days} "30 days of …", counted from the start day; done when every day of it is ticked
const chDay=h=>h.ch?Math.floor((TODAY-new Date(h.ch.from+'T00:00'))/864e5)+1:0;
const chDone=h=>{if(!h.ch)return 0;const l=L(h);let n=0;for(let i=0;i<h.ch.days;i++){const k=dk(addDays(new Date(h.ch.from+'T00:00'),i));if(k>dk(TODAY))break;if(l[k]||isRest(h,k))n++}return n};
function chLine(h){const d=chDay(h),n=chDone(h);if(!h.ch)return '';if(n>=h.ch.days)return 'Challenge complete: '+h.ch.days+' of '+h.ch.days+' days';
  return d>h.ch.days?'Challenge ended: '+n+' of '+h.ch.days+' days':'Challenge: day '+Math.max(1,d)+' of '+h.ch.days+' · '+n+' done'}
const missTwice=h=>{if(!feat('twice')||(h.per||7)<7)return false;const y=addDays(TODAY,-1),yk=dk(y),l=L(h);return !l[yk]&&!isRest(h,y)&&Object.keys(l).some(x=>x<yk)};
// times of day on Today: the part of the day you are in comes first, then later ones, anytime, then earlier ones
const TODS=[['m','Morning'],['a','Afternoon'],['e','Evening']];
function todRows(hs,row){if(!hs.some(h=>h.tod))return hs.map(row).join('');const c=new Date().getHours()<12?0:new Date().getHours()<17?1:2;
  return TODS.slice(c).concat([['','Anytime']],TODS.slice(0,c)).map(([t,n])=>{const r=hs.filter(h=>(h.tod||'')===t);return r.length?'<h3 class="todh">'+n+'</h3>'+r.map(row).join(''):''}).join('')}
function vToday(){
  const t=doneToday(),pct=t.total?Math.round(t.done/t.total*100):0,k=dk(TODAY);
  const wn=Math.ceil(TODAY.getDate()/7),y=TODAY.getFullYear(),m=TODAY.getMonth();
  const day=S.tasks[k]||{items:[],mind:null};
  let o='<section class="card thero">'+ring(pct,190,16,'<div class="tpct">'+pct+'%</div><div class="lbl" style="font-size:10px">Today</div>')
   +'<div><div class="tdate">'+DAYS[TODAY.getDay()]+' '+TODAY.getDate()+' '+MONTHS[m]+'</div><div class="muted" style="margin-top:4px">'+t.done+' / '+t.total+' habits completed</div></div>'
   +(feat('freeze')&&freezeTotal()?'<div class="fzpill">'+ic('snow')+freezeTotal()+(freezeTotal()===1?' streak freeze':' streak freezes')+' saved up</div>':'')+'</section>'
   +'<section class="card ttasks"><div class="ch"><span class="lbl">Tasks today</span><span>'+(feat('focus')?'<button class="link" data-act="focusnew" style="margin-inline-end:14px">Focus</button>':'')+'<button class="link" data-act="goto" data-v="tasks">Open</button></span></div>'
   +'<div class="tlist" data-drop="tasks" data-k="'+k+'">'+vis(day.items).map(it=>taskChip(k,it)).join('')+'</div>'+(vis(day.items).length?'':'<p class="muted" style="margin:0 0 8px;font-size:12px">Nothing planned yet.</p>')
   +taskAdder(k,false)+'</section>';
  if(feat('streaks')&&feat('ach')&&S.quits.length)o+='<section class="card tstreaks"><div class="ch"><span class="lbl">Streaks</span><button class="link" data-act="goto" data-v="achievements">Open</button></div><div class="tsg">'
    +S.quits.map(q=>{const d=qDays(q),nx=MILES.find(x=>x>d);return '<div class="tsi"><div class="lbl" style="font-size:9px">'+esc(q.name)+'</div><b>'+d+(d===1?' day':' days')+'</b><span class="sub" style="margin:0">'+(nx?'Next: '+dur(nx):'Every milestone reached')+'</span></div>'}).join('')+'</div></section>';
  if(feat('review')&&TODAY.getDay()===0)o+=reviewCard();
  const sec=(title,rows)=>rows?'<section class="sec" data-card="'+title.toLowerCase()+'" data-drop="habits-'+title.toLowerCase()+'"><h2>'+title+'</h2>'+rows+'</section>':'';
  const drow=h=>{const on=!!L(h)[k],c=curStreak(h),fz=feat('freeze')?freezeOf(h).tokens:0;
    const rs=!on&&isRest(h,TODAY),sk=!!(h.skip&&h.skip.includes(k));
    return '<div class="trow'+(on?' on':'')+(rs?' rest':'')+'" data-drag="habits-daily" data-id="'+h.id+'">'+GRIP('habit')+'<button class="cell '+(on?'on':'')+'" data-act="cell" data-h="'+h.id+'" data-d="'+k+'" role="checkbox" aria-checked="'+on+'" aria-label="'+esc(h.name)+tgt(h,k)+'">'+cellIn(h,k,on)+'</button><span class="tdot" style="--c:'+h.color+'"></span><span class="nm">'+esc(h.name)+(feat('notes')&&(S.notes[h.id]||{})[k]?'<small class="hnote">'+esc(S.notes[h.id][k])+'</small>':'')+(h.ch&&chDay(h)<=h.ch.days+1?'<small class="hnote chal">'+chLine(h)+'</small>':'')+(rs?'<small class="hnote">'+(sk?'Skipped today':'Rest day')+'</small>':!on&&missTwice(h)?'<small class="hnote twice">'+ic('alert')+'Missed yesterday. Don’t miss twice</small>':'')+'</span>'+(!on&&(sk||!rs)?'<button class="nbtn skb'+(sk?' on':'')+'" data-act="hskip" data-h="'+h.id+'" role="checkbox" aria-checked="'+sk+'" aria-label="Skip today: '+esc(h.name)+'">'+ic('skip')+'</button>':'')+(feat('notes')?'<button class="nbtn" data-act="note" data-h="'+h.id+'" data-k="'+k+'" aria-label="'+((S.notes[h.id]||{})[k]?'Edit':'Add')+' note for '+esc(h.name)+'">'+ic('note')+'</button>':'')+(isAmt(h)?'<span class="meta amt'+(on?' met':'')+'">'+(amtOf(h,k)?fmtN(amtOf(h,k))+(h.goal?' / '+fmtN(h.goal):'')+' '+esc(unitOf(h))+' today':'Tap to log '+esc(unitOf(h)||'amount'))+(monthAmt(h,y,m)?' · '+fmtN(monthAmt(h,y,m))+' this month':'')+'</span>':(h.per||7)<7?(n=>'<span class="meta wkp'+(n>=h.per?' met':'')+'">'+Math.min(n,h.per)+'/'+h.per+' this week</span>')(weekDone(h)):(fz?'<span class="fz" title="'+fz+(fz===1?' streak freeze':' streak freezes')+' saved up" aria-label="'+fz+(fz===1?' streak freeze':' streak freezes')+'">'+ic('snow')+fz+'</span>':'')+(c?'<span class="meta" style="color:var(--flame)">'+FLAME+c+'</span>':''))+'</div>'};
  o+=sec('Daily',todRows(byType('daily').filter(h=>!pausedNow(h)),drow));
  o+=sec('Weekly',byType('weekly').filter(h=>!pausedNow(h)).map(h=>{const on=!!L(h)[wkey(y,m,wn)];
    return '<div class="trow'+(on?' on':'')+'" data-drag="habits-weekly" data-id="'+h.id+'">'+GRIP('habit')+'<button class="cell '+(on?'on':'')+'" data-act="wcell" data-h="'+h.id+'" data-w="'+wn+'" role="checkbox" aria-checked="'+on+'" aria-label="'+esc(h.name)+tgt(h,wkey(y,m,wn))+'">'+cellIn(h,wkey(y,m,wn),on)+'</button><span class="tdot" style="--c:'+h.color+'"></span><span class="nm">'+esc(h.name)+'</span><span class="meta">This week</span></div>'}).join(''));
  o+=sec('Monthly',byType('monthly').filter(h=>!pausedNow(h)).map(h=>{const on=!!L(h)[mkey(y,m)];
    return '<div class="trow'+(on?' on':'')+'" data-drag="habits-monthly" data-id="'+h.id+'">'+GRIP('habit')+'<button class="cell '+(on?'on':'')+'" data-act="mcell" data-h="'+h.id+'" role="checkbox" aria-checked="'+on+'" aria-label="'+esc(h.name)+tgt(h,mkey(y,m))+'">'+cellIn(h,mkey(y,m),on)+'</button><span class="tdot" style="--c:'+h.color+'"></span><span class="nm">'+esc(h.name)+'</span><span class="meta">This month</span></div>'}).join(''));
  if(!S.habits.length)o+=emptyBox('habits','Lay the first layer','Add your first habit to start your day. Pick one you can do in two minutes.',NEWH+demoBtn());
  return o;
}

