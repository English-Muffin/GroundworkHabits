/* Groundwork Habits: render(), drag to rearrange, focus timer, app lock.
   The js/ files are classic scripts loaded in order (index.html) and share one scope, like one big file. */
'use strict';
/* ---------- render ---------- */
let focusSel=null;
let lastView=null;
function render(){
  fzCache=new Map();if(!modal){cpOpen.habit=false;cpOpen.area=false} // dialog pickers start closed next time
  if(view!=='settings')cpOpen.accent=false;
  const keep=['.gcard','.wscroll','.days','.dd'].map(q=>{const el=$(q);return el?[q,el.scrollLeft,el.scrollTop]:null}).filter(Boolean),sy=window.scrollY;
  const vi=VIEWS.find(v=>v[0]===view)||(view==='settings'?['settings','Settings','gear']:ASK?['ask','Reminder','home']:['widget','Widget','home']);
  $('#nav').innerHTML=views().map(v=>'<a href="#'+v[0]+'" aria-label="'+v[1]+'" title="'+v[1]+'" class="'+(v[0]===view?'on':'')+'"'+(v[0]===view?' aria-current="page"':'')+'>'+ic(v[2])+'<span>'+v[1]+'</span>'+'</a>').join('').replace('<a href="#goals"','<button class="navq" data-act="quick" aria-label="Quick add" title="Quick add">'+ic('plus')+'</button><a href="#goals"'); // quick add sits in the middle, between Tasks and Goals
  $('#ttl').textContent=view==='tasks'?'Task Tracker':vi[1];
  $('#gearBtn').innerHTML=ic('gear');$('#gearBtn').classList.toggle('on',view==='settings');$('#gearBtn').setAttribute('aria-current',view==='settings'?'page':'false');$('#searchBtn').innerHTML=ic('search');
  document.title=vi[1]+' | Groundwork Habits';
  const lk=$('#lock');lk.hidden=!locked;document.body.classList.toggle('locked',locked);
  if(locked){$('#main').innerHTML='';$('#menu').hidden=true;$('#modal').innerHTML='';if(!lk.firstChild){lk.innerHTML=lockHtml();trDom(lk)}else lk.querySelector('[data-act=pinforgot]').textContent=lockForgot?'Tap again: remove the PIN and erase the data on this device':'Forgot your PIN?';
    if(!lk.contains(document.activeElement))setTimeout(()=>{const i=$('#pinIn');if(i)i.focus()},0);return}
  lk.innerHTML='';
  const tpl=document.createElement('div');tpl.innerHTML=({today:vToday,habits:vHabits,tasks:vTasks,goals:vGoals,insights:vInsights,achievements:vAch,settings:vSettings,widget:vWidget,ask:()=>askHtml(ASK.h,ASK.k)})[view]();
  // Today and Insights: every top-level block is a card that can be dragged; their order comes from P.layout
  if((view==='today'||view==='insights')&&feat('drag')){const seen={},kids=[...tpl.children];
    kids.forEach(el=>{const base=el.dataset.card||el.className.split(' ').filter(c=>c&&c!=='card')[0]||'block',n=seen[base]=(seen[base]||0)+1;
      el.dataset.drag='cards';el.dataset.id=base+(n>1?n:'');el.insertAdjacentHTML('afterbegin',GRIP('card','cg'))});
    const ord=((P.layout||{})[view]||[]).flatMap(x=>x==='tgrid'?['thero','ttasks']:[x]),pos=el=>{const i=ord.indexOf(el.dataset.id);return i<0?1000+kids.indexOf(el):i};
    kids.slice().sort((a,b)=>pos(a)-pos(b)).forEach(el=>tpl.appendChild(el))}
  trDom(tpl);if(lastView!==view)$('#main').innerHTML='';morphKids($('#main'),tpl);
  const mn=$('#menu');mn.hidden=!menuOpen;
  mn.innerHTML='';
  $('#modal').innerHTML=vModal();['#modal','#menu','#nav','#ttl'].forEach(q=>trDom($(q)));document.title=tx(vi[1])+' | Groundwork Habits';
  keep.forEach(k=>{const el=$(k[0]);if(el){el.scrollLeft=k[1];el.scrollTop=k[2]}});
  if(lastView===view&&sy>0)window.scrollTo(0,sy);
  // opening Habits on a narrow screen: scroll the month so today sits next to the pinned stats column
  // Tasks on a narrow window (days in a sideways row that doesn't fit): start scrolled to today
  if(view==='tasks'&&lastView!==view){const g=$('.days'),n=$('.days .day.now');if(g&&n&&g.scrollWidth>g.clientWidth)g.scrollLeft=Math.max(0,n.offsetLeft-g.offsetLeft-8)}
  if(view==='habits'&&lastView!==view){const g=$('.gcard'),n=$('.hdr .dn.now'),st=$('.gcard .gstat');if(g&&n&&st&&g.scrollWidth>g.clientWidth)g.scrollLeft=Math.max(0,n.offsetLeft+n.offsetWidth-(g.clientWidth-st.offsetWidth)+4)}
  lastView=view;
  const box=$('#main');delete box.dataset.drop;box.classList.toggle('tdash',view==='today');box.classList.toggle('idash',view==='insights');if(view==='insights')box.dataset.axis='x';else delete box.dataset.axis;
  if((view==='today'||view==='insights')&&feat('drag'))box.dataset.drop='cards';
  if(view==='insights'){bindChart();const hw=$('.hwrap');if(hw)hw.scrollLeft=hw.scrollWidth}
  if(view==='tasks')bindMind();
  if(view==='settings'){filterSettings();spySettings()}
  if(focusSel){const el=$(focusSel);if(el)el.focus();focusSel=null}
  if(repSel.open){const l=$('.rlist');if(l)l.scrollIntoView({block:'nearest',behavior:'smooth'})} // the open repeat menu is never hidden behind the bottom bar
}
/* ---------- drag to rearrange (mouse, touch and arrow keys) ----------
   [data-drop=list] holds [data-drag=list][data-id] items; each item has a .grip handle.
   The DOM is reordered live while dragging, then commitDrag() writes the new order to S (or P for dashboard cards). */
let drag=null;
function commitDrag(list,conts){
  const ids=c=>[...c.querySelectorAll(':scope>[data-drag="'+list+'"]')].map(n=>n.dataset.id);
  if(list==='tasks'){
    const all={},inDom=new Set();Object.keys(S.tasks).forEach(k=>S.tasks[k].items.forEach(i=>all[i.id]=i));
    conts.forEach(c=>ids(c).forEach(id=>inDom.add(id)));
    const before={};Object.keys(S.tasks).forEach(k=>S.tasks[k].items.forEach(i=>before[i.id]=k));
    conts.forEach(c=>ids(c).forEach(id=>{const it=all[id];if(it&&it.cal&&before[id]!==c.dataset.k)it.pin=true}));
    conts.forEach(c=>{const k=c.dataset.k,day=S.tasks[k]||(S.tasks[k]={items:[],mind:null});
      day.items=ids(c).map(id=>all[id]).filter(Boolean).concat(day.items.filter(i=>!inDom.has(i.id)))}); // calendar/hidden items keep their place at the end
  }else if(list.startsWith('habits-')){
    const ty=list.slice(7),q=ids(conts[0]).map(findH).filter(Boolean);
    if(q.length===byType(ty).length){let j=0;S.habits=S.habits.map(h=>h.type===ty?q[j++]:h)}
  }else if(list==='goals'||list==='quits'){
    const a=S[list],o=ids(conts[0]);S[list]=o.map(id=>a.find(x=>x.id===id)).filter(Boolean).concat(a.filter(x=>!o.includes(x.id)));
  }else if(list==='cards'){P.layout=Object.assign({},P.layout,{[view]:ids(conts[0])});applyPrefs();render();return}
  save();render();
}
function dropAt(x,y){
  const el=document.elementFromPoint(x,y),c=el&&el.closest('[data-drop="'+drag.list+'"]');if(!c)return;
  const sibs=[...c.querySelectorAll(':scope>[data-drag="'+drag.list+'"]')].filter(n=>n!==drag.it);
  if(!sibs.length){if(drag.it.parentElement!==c)c.appendChild(drag.it);return}
  let best=null,bd=1e9;for(const n of sibs){const b=n.getBoundingClientRect(),d=Math.hypot(x-(b.left+b.width/2),y-(b.top+b.height/2));if(d<bd){bd=d;best=n}}
  const b=best.getBoundingClientRect(),sameRow=y>b.top&&y<b.bottom;
  const before=c.dataset.axis==='x'&&sameRow?x<b.left+b.width/2:y<b.top+b.height/2;
  const ref=before?best:best.nextSibling;if(ref!==drag.it&&drag.it.nextSibling!==ref)c.insertBefore(drag.it,ref);
}
function startDrag(it,x,y){
  const src=it.querySelector(':scope>.gname')||it,b=src.getBoundingClientRect(),gh=src.cloneNode(true); // grid rows: drag just the name, the full row is wider than the screen
  gh.removeAttribute('data-drag');gh.classList.add('dghost');Object.assign(gh.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px'});
  document.body.appendChild(gh);document.body.classList.add('dragging');it.classList.add('dsrc');
  drag={it,gh,list:it.dataset.drag,from:it.parentElement,dx:x-b.left,dy:y-b.top,moved:false};
}
function moveDrag(x,y){
  drag.moved=true;drag.gh.style.left=(x-drag.dx)+'px';drag.gh.style.top=(y-drag.dy)+'px';
  if(y<70)window.scrollBy(0,-14);else if(y>innerHeight-70)window.scrollBy(0,14);
  const sc=drag.it.closest('.days,.gcard,.wscroll');if(sc){const b=sc.getBoundingClientRect();if(x<b.left+40)sc.scrollLeft-=14;else if(x>b.right-40)sc.scrollLeft+=14}
  dropAt(x,y);
}
function endDrag(){
  if(!drag)return;const d=drag;drag=null;d.gh.remove();d.it.classList.remove('dsrc');document.body.classList.remove('dragging');
  if(d.moved)commitDrag(d.list,[...new Set([d.from,d.it.parentElement])]);
}
const dragItem=t=>{const it=t.closest&&t.closest('[data-drag]'),c=it&&it.parentElement;return c&&c.dataset.drop===it.dataset.drag?it:null};
// mouse and pen: grab the grip
document.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||e.button>0||!feat('drag'))return;
  const g=e.target.closest&&e.target.closest('.grip'),it=g&&dragItem(g);if(!it)return;
  e.preventDefault();startDrag(it,e.clientX,e.clientY);try{g.setPointerCapture(e.pointerId)}catch(_){}
});
document.addEventListener('pointermove',e=>{if(drag&&!drag.touch&&e.pointerType!=='touch'){e.preventDefault();moveDrag(e.clientX,e.clientY)}},{passive:false});
document.addEventListener('pointerup',e=>{if(drag&&!drag.touch)endDrag()});
document.addEventListener('pointercancel',e=>{if(drag&&!drag.touch)endDrag()});
// touch: touch the grip and drag, or press and hold anywhere on the item. Touch events (not pointer events) so we can stop the page scrolling
let hold=null;const dropHold=()=>{if(hold){clearTimeout(hold.timer);hold=null}};
document.addEventListener('touchstart',e=>{
  dropHold();if(drag||e.touches.length>1||!feat('drag'))return;
  const t=e.touches[0],it=dragItem(e.target);if(!it)return;
  if(e.target.closest('.grip')){e.preventDefault();startDrag(it,t.clientX,t.clientY);drag.touch=true;return}
  if(e.target.closest('input,textarea,select,a,[type=range]'))return;
  hold={it,x:t.clientX,y:t.clientY,timer:setTimeout(()=>{const h=hold;hold=null;if(!h||drag)return;
    if(document.activeElement&&document.activeElement.isContentEditable)document.activeElement.blur();
    try{getSelection().removeAllRanges()}catch(_){}if(navigator.vibrate)navigator.vibrate(12);
    startDrag(h.it,h.x,h.y);drag.touch=true},380)};
},{passive:false});
document.addEventListener('touchmove',e=>{
  const t=e.touches[0];
  if(hold){if(Math.hypot(t.clientX-hold.x,t.clientY-hold.y)>10)dropHold();return} // moved first: it is a scroll
  if(drag&&drag.touch){e.preventDefault();moveDrag(t.clientX,t.clientY)}
},{passive:false});
const touchEnd=e=>{dropHold();if(drag&&drag.touch){if(e.cancelable)e.preventDefault();endDrag()}}; // preventDefault stops the tap that would follow
document.addEventListener('touchend',touchEnd,{passive:false});document.addEventListener('touchcancel',touchEnd);
document.addEventListener('contextmenu',e=>{if(drag||hold)e.preventDefault()});
document.addEventListener('keydown',e=>{
  const g=e.target;if(!g.classList||!g.classList.contains('grip')||!/^Arrow(Up|Down|Left|Right)$/.test(e.key))return;
  const it=g.closest('[data-drag]'),c=it.parentElement,list=it.dataset.drag;e.preventDefault();
  let to=c;
  if(list==='tasks'&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){ // tasks hop to the previous/next day
    const cs=[...document.querySelectorAll('[data-drop="tasks"]')],n=cs[cs.indexOf(c)+(e.key==='ArrowLeft'?-1:1)];if(!n)return;to=n;to.appendChild(it);
  }else{
    const sibs=[...c.querySelectorAll(':scope>[data-drag="'+list+'"]')],d=/Up|Left/.test(e.key)?-1:1,n=sibs[sibs.indexOf(it)+d];if(!n)return;
    c.insertBefore(it,d<0?n:n.nextSibling);
  }
  focusSel='[data-drag="'+list+'"][data-id="'+it.dataset.id+'"] > .grip';commitDrag(list,[...new Set([c,to])]);
});

// undo history for deletes: each entry puts back only what was deleted, so later edits are kept (newest last, up to 20)
let lastDel=null;const undos=[];
function pushUndo(fn){undos.push(fn);if(undos.length>20)undos.shift()}
function undoLast(){const f=undos.pop();if(!f)return false;f();return true}
const putBack=(arr,i,x)=>{if(!arr.some(y=>y.id===x.id))arr.splice(Math.min(i,arr.length),0,x)};
let toastAction=null;
function toastAct(msg,label,act){const t=$('#toast');t.innerHTML=esc(tx(msg))+'<button class="tundo" data-act="'+act+'">'+esc(tx(label))+'</button>';t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true;toastAction=null},10000)}
function notify(title,body){try{if('Notification' in window&&Notification.permission==='granted')new Notification(title,{body,tag:'groundwork-'+title})}catch(e){}}
function beep(){try{const a=new (window.AudioContext||window.webkitAudioContext)();[0,.35].forEach(t=>{const o=a.createOscillator(),g=a.createGain();o.frequency.value=880;g.gain.setValueAtTime(.0001,a.currentTime+t);g.gain.exponentialRampToValueAtTime(.2,a.currentTime+t+.02);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+t+.25);o.connect(g).connect(a.destination);o.start(a.currentTime+t);o.stop(a.currentTime+t+.3)})}catch(e){}}
function toastUndo(msg,more){const t=$('#toast');t.innerHTML=esc(tx(msg))+(more?'<button class="tundo" data-act="'+more[1]+'">'+esc(tx(more[0]))+'</button>':'')+'<button class="tundo" data-act="undo">'+tx('Undo')+'</button>';t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},6000)}
/* focus timer: one running session, shown as a bar; keeps counting when you switch tabs */
let focusRun=null,lastFocus=null;
function focusTick(){
  const bar=$('#focusbar');if(!bar)return;if(!focusRun){bar.hidden=true;return}
  const ms=focusRun.paused?focusRun.left:focusRun.end-Date.now();
  if(ms<=0){const f=focusRun;focusRun=null;lastFocus=f;bar.hidden=true;beep();notify('Focus session done',f.text?'Nice work on “'+f.text+'”.':'Time for a short break.');
    if(f.id)toastAct('Focus session done','Mark task done','fmark');else toast('Focus session done. Take a short break.');return}
  const m=Math.floor(ms/6e4),sec=Math.floor(ms/1e3)%60;bar.hidden=false;
  bar.innerHTML='<b>'+p2(m)+':'+p2(sec)+'</b><span class="ft">'+esc(focusRun.text||'Focus')+'</span><button data-act="fpause">'+(focusRun.paused?'Resume':'Pause')+'</button><button data-act="fstop" aria-label="Stop focus timer">&times;</button>';
}
setInterval(focusTick,1000);
/* app lock: a PIN (salted SHA-256 in prefs) hides everything on open and after a minute in the background.
   It is a privacy screen, not encryption: the saved data itself is not encrypted. */
const canLock=!!(window.crypto&&crypto.subtle);
let locked=!!(P.lock&&(P.lock.hash||P.lock.enc))||encWait,lockTries=0,lockUntil=0,lockForgot=false,hiddenAt=0;
async function pinHash(pin,salt){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+pin));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function lockHtml(){return '<div class="lockbox" role="dialog" aria-modal="true" aria-label="Groundwork Habits is locked"><div class="lic">'+ic('lock')+'</div><h2>Groundwork Habits is locked</h2>'
  +'<input id="pinIn" class="field" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="Enter your PIN" aria-label="PIN">'
  +'<button class="btn" data-act="unlock">Unlock</button>'+(P.bio&&NB&&NB.bioUnlock?'<button class="btn ghost" data-act="bio">'+ic('finger')+' Use fingerprint</button>':'')+'<p class="sub" id="pinMsg" role="alert" style="margin:0;min-height:16px"></p>'
  +'<button class="link" data-act="pinforgot">'+(lockForgot?'Tap again: remove the PIN and erase the data on this device':'Forgot your PIN?')+'</button></div>'}
// checks the PIN; with encryption it also makes the key and opens the saved data. A PIN from before encryption is upgraded here
async function openWithPin(pin){
  const raw=idbLate||localStorage.getItem(KEY);
  if(P.lock&&P.lock.hash&&!P.lock.enc){if(await pinHash(pin,P.lock.salt)!==P.lock.hash)return false;
    encKey=await deriveKey(pin,P.lock.salt);P.lock={salt:P.lock.salt,enc:1,check:await encText('groundwork',encKey,P.lock.salt)};applyPrefs();save();if(dataDir){fileJson=null;writeFile()}return true}
  const salt=P.lock&&P.lock.salt||encSalt(raw);if(!salt)return false;
  try{const key=await deriveKey(pin,salt);
    if(P.lock&&P.lock.check)await decText(P.lock.check,key);
    if(isEnc(raw)){const j=await decText(raw,key);if(encWait){S=clean(JSON.parse(j));encWait=false}}
    encWait=false;encKey=key;if(!P.lock||!P.lock.enc){P.lock={salt,enc:1,check:await encText('groundwork',key,salt)};applyPrefs()}return true}catch(e){return false}}
function unlocked(pin){locked=false;lockTries=0;lockForgot=false;if(dataDir)readFile();andRead();autoBackup();takeAnswers().then(syncReminders);pushWidget();render();
  if(bioOk&&!P.bio&&!P.bioNo&&pin){bioPin=pin;toastAct('Unlock with your fingerprint next time?','Turn on','bioon')}}
// fingerprint / face unlock (Android): the PIN is kept encrypted by a key only the fingerprint can open
let bioOk=false,bioPin='';if(NB&&NB.bioAvailable&&!WIDGET)NB.bioAvailable().then(r=>{bioOk=!!r.ok;if(P.bio&&!r.on){P.bio=false;applyPrefs()}if(locked&&P.bio&&bioOk)bioTry()}).catch(()=>{});
async function bioTry(){const r=await NB.bioUnlock({title:tx('Unlock Groundwork Habits')});if(r&&r.ok&&await openWithPin(r.pin)){unlocked('');return}
  if(r&&r.why==='changed'){P.bio=false;applyPrefs();toast('Fingerprints changed on this phone. Unlock with your PIN, then turn fingerprint on again');render()}}
async function tryUnlock(){
  const el=$('#pinIn'),msg=$('#pinMsg');if(!el)return;
  if(Date.now()<lockUntil){msg.textContent='Too many tries. Wait '+Math.ceil((lockUntil-Date.now())/1e3)+' seconds.';return}
  const pin=el.value;if(await openWithPin(pin)){unlocked(pin);return}
  lockTries++;el.value='';if(lockTries>=5){lockUntil=Date.now()+30000;lockTries=0}
  msg.textContent=lockUntil>Date.now()?'Too many tries. Wait 30 seconds.':'Wrong PIN. Try again.';el.focus();
}
// lock: after a minute hidden, or 5 minutes without input (the widget is never hidden); locking one window locks every window
let lastInput=Date.now();
function lockNow(share){if(!P.lock||locked)return;locked=true;modal=null;menuOpen=false;render();if(share)try{localStorage.setItem('groundwork-locked',String(Date.now()))}catch(e){}}
['pointerdown','keydown','wheel','touchstart'].forEach(t=>document.addEventListener(t,()=>{lastInput=Date.now()},{passive:true,capture:true}));
setInterval(()=>{if(P.lock&&!locked&&Date.now()-lastInput>(P.lockIdle||5)*60000)lockNow(true)},15000);
document.addEventListener('visibilitychange',()=>{if(!P.lock)return;if(document.hidden)hiddenAt=Date.now();else if(hiddenAt&&Date.now()-hiddenAt>60000)lockNow(true)});
const isField=e=>e&&(e.tagName==='INPUT'&&!/^(range|checkbox|radio|color|button)$/.test(e.type)||e.tagName==='TEXTAREA'||e.isContentEditable);
function keepVisible(){
  const a=document.activeElement;if(!isField(a))return;const box=a.closest('.tadd,.mod')||a;if(box.classList.contains('mod'))return;
  const h=window.visualViewport?visualViewport.height:innerHeight,r=box.getBoundingClientRect();
  if(r.bottom>h-16||r.top<80)box.scrollIntoView({block:r.height>h*.6?'start':'center',behavior:'smooth'});
}
if(TOUCH){
  document.addEventListener('focusin',e=>{if(isField(e.target)){document.body.classList.add('kb');setTimeout(keepVisible,350)}});
  document.addEventListener('focusout',()=>setTimeout(()=>{if(!isField(document.activeElement))document.body.classList.remove('kb')},120));
  (window.visualViewport||window).addEventListener('resize',()=>setTimeout(keepVisible,60));
}
function toast(msg){const t=$('#toast');t.textContent=tx(msg);t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},2600)}

