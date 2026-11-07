(function(){
'use strict';

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const dk=d=>d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const sod=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const dim=(y,m)=>new Date(y,m+1,0).getDate();
let TODAY=sod(new Date());
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONR=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sept','Oct','Nov','Dec'];
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
/* translations: the English text in the code is the key. i18n/<lang>.js (loaded by index.html before this file) sets
   window.DAYBOOK_I18N={t:{English:translation}, p:[[regex source, replacement]]}. After each render the visible text,
   placeholders and labels are swapped; user content (names, notes, task text) is never touched. */
const LANGS=[['en','English'],['pt','Português'],['es','Español'],['fr','Français'],['de','Deutsch'],['it','Italiano'],['nl','Nederlands'],['pl','Polski'],['ru','Русский'],['zh','中文'],['ja','日本語']];
const I18=window.DAYBOOK_I18N||{t:{},p:[]},LANG=window.DAYBOOK_LANG&&I18.lang===window.DAYBOOK_LANG?window.DAYBOOK_LANG:'en';
const I18P=(I18.p||[]).map(x=>[new RegExp(x[0]),x[1]]);
if(LANG!=='en'){const loc=LANG==='zh'?'zh-CN':LANG,f=(o,i)=>new Intl.DateTimeFormat(loc,o).format(i),cap=x=>x.charAt(0).toUpperCase()+x.slice(1);
  for(let i=0;i<7;i++)DAYS[i]=cap(f({weekday:'long'},new Date(2023,0,1+i)));
  for(let i=0;i<12;i++){MONTHS[i]=cap(f({month:'long'},new Date(2023,i,15)));MON3[i]=cap(f({month:'short'},new Date(2023,i,15)).replace('.',''))}}
function tx(s){if(LANG==='en'||!s)return s;const k=String(s).trim();if(!k)return s;const v=I18.t[k];if(v!==undefined)return String(s).replace(k,v);
  for(const [re,rep] of I18P)if(re.test(k))return String(s).replace(k,k.replace(re,(...m)=>rep.replace(/\$(\d)/g,(_,n)=>tx(m[+n])||'')));return s}
const NOTR='[contenteditable],textarea,input,select,.nm,.nb,.hnote,.gstep span,.tk span,.g2h h3,.lrow .top span,[data-nt]';
function trDom(root){if(LANG==='en'||!root)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while(n=w.nextNode()){const p=n.parentElement;if(p&&p.closest(NOTR))continue;const v=tx(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v}
  root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(e=>['placeholder','aria-label','title'].forEach(a=>{const v=e.getAttribute(a);if(v){const t=tx(v);if(t!==v)e.setAttribute(a,t)}}))}
const uid=()=>'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const wkStart=d=>addDays(sod(d),-sod(d).getDay());
const dmy=d=>p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const ICON={
  home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  habits:'<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  tasks:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
  goals:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  insights:'<path d="M6 20v-9M12 20V4M18 20v-6"/>',
  note:'<path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/>',
  grip:'<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3.2"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  repeat:'<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  down:'<path d="M6 9l6 6 6-6"/>',
  pin:'<path d="M12 17v5"/><path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  snow:'<path d="M12 2v20M4.9 7l14.2 10M19.1 7 4.9 17"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
  pencil:'<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  finger:'<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  pal:'<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a6 6 0 0 0 6-6C22 6 17.5 2 12 2z"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  sliders:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  db:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  prev:'<path d="M15 6l-6 6 6 6"/>',next:'<path d="M9 6l6 6-6 6"/>'
};
const ic=(n,c)=>'<svg class="ic'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+ICON[n]+'</svg>';
const XMARK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
const CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const FLAME='<svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.6 5.2 5.6 5.2 10.3a5.2 5.2 0 0 1-10.4 0c0-2.1 1-3.4 2.1-4.3 0 2.1 1 3.1 2.1 3.1C11 8.5 10 5.5 12 2z"/></svg>';
const STAR='<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z"/></svg>';
const medal=c=>'<svg class="medal" viewBox="0 0 24 24" style="stroke:'+c+'"><circle cx="12" cy="15" r="5"/><path d="M8.5 3l3.5 7 3.5-7"/></svg>';

/* ---------- state ---------- */
const $$=q=>[...document.querySelectorAll(q)];
const KEY='daybook-v2',APPV='1.6.0',RELEASES='https://github.com/English-Muffin/Free-Habit-Tracker/releases/latest'; // APPV: bump with package.json
const COLORS=['#8b5cf6','#3b82f6','#f43f5e','#22c55e','#f59e0b','#ec4899'];
const AREAS=['Health','Fitness','Career','Money','Learning','Relationships','Family','Fun','Home','Mindset'];
/* PIN encryption: with a PIN, data is saved as 'enc1:<salt>:<base64 iv+AES-GCM>' with a key made from the PIN (PBKDF2).
   Until the PIN is entered the real data is not in memory (encWait), so nothing may be saved, synced or scheduled. */
const ENC='enc1:';let encKey=null,encWait=false;
const isEnc=t=>typeof t==='string'&&t.startsWith(ENC);
const b64e=u=>{let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)};
const b64d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const encSalt=t=>isEnc(t)?t.slice(ENC.length).split(':')[0]:'';
async function deriveKey(pin,salt){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:310000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function encText(t,key,salt){const iv=crypto.getRandomValues(new Uint8Array(12)),c=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(t))),o=new Uint8Array(12+c.length);o.set(iv);o.set(c,12);return ENC+salt+':'+b64e(o)}
async function decText(t,key){const u=b64d(t.slice(ENC.length).split(':')[1]);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:u.subarray(0,12)},key,u.subarray(12)))}
const encOn=()=>!!(P.lock&&P.lock.enc);
function load(){try{const r=localStorage.getItem(KEY);if(isEnc(r)){encWait=true;return null}return r?JSON.parse(r):null}catch(e){return null}}
// encrypting is async: saves are chained so they land in order (desktop waits for them before closing)
function saveRaw(j,put){if(!encOn()){put(j);return}if(!encKey)return;const key=encKey,salt=P.lock.salt;save.p=(save.p||Promise.resolve()).then(()=>encText(j,key,salt)).then(put).catch(()=>{})}
/* Android data folder (a synced folder gives cloud sync): daybook.json is written a moment after each save and read when the app comes back */
let andText=null;
function andWrite(){if(!NB||!P.andDir||encWait)return;clearTimeout(andWrite.t);andWrite.t=setTimeout(()=>saveRaw(JSON.stringify(S),t=>{if(t===andText)return;NB.writeFolder({text:t}).then(()=>{andText=t}).catch(()=>toast('Could not save to your data folder'))}),800)}
async function andApply(t,announce){try{const j=isEnc(t)?(encKey?await decText(t,encKey):null):t;if(j===null)return;const d=JSON.parse(j);if(!d||!Array.isArray(d.habits))return;
  S=clean(d);andText=t;saveRaw(JSON.stringify(S),x=>{try{localStorage.setItem(KEY,x)}catch(e){}});if(!modal&&!drag)render();if(announce)toast('Loaded the save from that folder')}catch(e){}}
async function andRead(){if(!NB||!P.andDir||encWait)return;try{const t=(await NB.readFolder()).text;if(t&&t!==andText)andApply(t)}catch(e){}}
// Android home-screen widget: today's daily habits (names only while there's no PIN)
function pushWidget(){if(!NB||!NB.widget||WIDGET||encWait)return;clearTimeout(pushWidget.t);pushWidget.t=setTimeout(()=>{const k=dk(TODAY);
  NB.widget({data:{locked:!!P.lock,lockedText:tx('Daybook is locked'),emptyText:tx('Add a daily habit in Daybook'),title:tx(DAYS[TODAY.getDay()]),
    items:P.lock?[]:byType('daily').slice(0,6).map(h=>({h:h.id,k,name:h.name,done:!!L(h)[k]}))}}).catch(()=>{})},600)}
function save(){if(encWait)return;andWrite();pushWidget();saveRaw(JSON.stringify(S),t=>{try{localStorage.setItem(KEY,t)}catch(e){}});clearTimeout(save.r);save.r=setTimeout(()=>syncReminders(),1500);if(dataDir){clearTimeout(save.t);save.t=setTimeout(writeFile,300)}}
/* desktop only: mirror data to <folder>/daybook.json (a Drive/OneDrive/Dropbox folder gives cloud sync) */
const DFS=window.daybookFS||null,NB=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.DaybookNative||null,calFetch=DFS&&DFS.fetchCal?DFS.fetchCal:NB?(u=>NB.fetchCal({url:u})):null;let dataDir=DFS?DFS.folder():'',fileText=null,fileJson=null;
function writeFile(){clearTimeout(save.t);save.t=0;if(!dataDir||encWait)return;const j=JSON.stringify(S);if(j===fileJson)return;
  saveRaw(j,t=>{if(DFS.write(t)){fileJson=j;fileText=t}else toast('Could not save to your data folder')})}
// the folder file wins over this device; an encrypted file is opened with the key once the PIN is in (async, renders itself)
function readFile(){const t=DFS.read();if(!t||t===fileText)return false;
  if(isEnc(t)){if(!encKey){if(!encOn())encWait=true;return false}
    decText(t,encKey).then(j=>{S=clean(JSON.parse(j));fileText=t;fileJson=j;try{localStorage.setItem(KEY,t)}catch(e){}if(!modal&&!drag)render()}).catch(()=>toast('The save in your data folder uses a different PIN'));return false}
  try{S=clean(JSON.parse(t));fileText=t;fileJson=t;try{localStorage.setItem(KEY,t)}catch(e){}return true}catch(e){return false}}
window.addEventListener('beforeunload',()=>{if(save.t)writeFile()});
if(DFS&&DFS.onFlush)DFS.onFlush(async()=>{if(save.t)writeFile();await save.p}); // desktop: finish encrypted saves before the window closes
const DATA_V=1; // bump and migrate in load-time block below when the saved shape changes
const PKEY='daybook-prefs',ACCENTS=[['Teal','#22d3be'],['Blue','#60a5fa'],['Violet','#a78bfa'],['Pink','#f472b6'],['Amber','#fbbf24'],['Green','#4ade80']];
let P={theme:'dark',accent:ACCENTS[0][1],feat:{},remTime:'21:00'};try{Object.assign(P,JSON.parse(localStorage.getItem(PKEY))||{})}catch(e){}
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const rgbHex=a=>'#'+a.map(v=>v.toString(16).padStart(2,'0')).join('');
// colour fields (picker + hex + R,G,B) for id `f`; edits sync siblings without a re-render (that would steal focus)
const colorFields=(f,hex,lbl)=>'<div class="cfx"><input type="color" class="cpick" data-cf="'+f+'" data-k="pick" value="'+hex+'" aria-label="Pick a custom '+lbl+'"><input class="ain" data-cf="'+f+'" data-k="hex" value="'+hex+'" maxlength="7" spellcheck="false" aria-label="'+lbl+' hex code"></div>'
  +'<div class="cfx">'+hexRgb(hex).map((v,i)=>'<label class="ainl">'+'RGB'[i]+'<input class="ain" type="number" min="0" max="255" data-cf="'+f+'" data-k="'+i+'" value="'+v+'" aria-label="'+['Red','Green','Blue'][i]+' (0 to 255)"></label>').join('')+'</div>';
const COLOR_SET={accent:h=>{P.accent=h;applyPrefs()},habit:h=>{if(modal)modal.color=h}};
function setColor(f,hex,from){COLOR_SET[f](hex);
  document.querySelectorAll('[data-cf="'+f+'"]').forEach(e=>{if(e===from)return;const k=e.dataset.k;e.value=k==='pick'||k==='hex'?hex:hexRgb(hex)[+k]});
  document.querySelectorAll('[data-sw="'+f+'"]').forEach(b=>{const on=b.dataset.v===hex;b.setAttribute('aria-pressed',on);b.classList.toggle('on',on)})}
function applyPrefs(){const d=document.documentElement;d.style.setProperty('--accent',P.accent);d.classList.toggle('light',P.theme==='light');d.classList.toggle('amoled',P.theme==='amoled');
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=P.theme==='light'?'#f7f7f7':P.theme==='amoled'?'#000000':'#080808';try{localStorage.setItem(PKEY,JSON.stringify(P))}catch(e){}}
applyPrefs();
// optional features, switched in Settings > Features (all on except the reminder)
const FEAT=[['freeze','Streak freezes'],['streaks','Streaks on Today'],['review','Weekly review'],['heatmap','Year heatmap'],['notes','Habit notes'],['missed','Mark missed tasks'],['ach','Achievements tab'],['drag','Drag to rearrange'],['focus','Focus timer'],['reminder','Daily reminder'],['remnames','Show names in reminders']];
const FEATD={freeze:'Seven days in a row earn a freeze that saves a streak on a missed day',streaks:'Your stopped-habit streaks on the Today screen',review:'A summary of last week on Sundays',heatmap:'The year of squares on Insights',notes:'A short note on any day of a habit',missed:'Past tasks you didn’t do show a red X',ach:'Track things you’ve stopped, like smoking',drag:'Move tasks, habits, goals and cards by dragging',focus:'A timer for focused work on a task',reminder:'One notification a day if habits are still open',remnames:'Notifications say which habit or task; off shows just “Daybook”'};
const feat=k=>P.feat&&k in P.feat?!!P.feat[k]:k!=='reminder';
const empty=()=>({v:DATA_V,habits:[],log:{},tasks:{},goals:[],journal:{},quits:[],count:{},notes:{},amt:{},areas:[]});

// true when there is anything the user would lose (not just habits)
// calendar events: `hidden` ones were deleted here and stay hidden; events never count as to-dos
const vis=a=>a.filter(i=>!i.hidden),todo=a=>a.filter(i=>!i.hidden); // tasks that count towards progress (calendar events included, deleted ones not)
const hasData=()=>S.habits.length||S.goals.length||S.quits.length||Object.values(S.tasks).some(t=>t.items.length||t.mind)||Object.values(S.journal).some(Boolean);
function seed(){
  const H=[
    ['Wake up at 5am','daily',0,.78],['Meditation','daily',1,.5],['Gym','daily',2,.76],['Read 10 pages','daily',1,.8],
    ['Eat healthy','daily',3,.72],['Plan next day','daily',0,.66],['Journaling','daily',1,.72],['Cold shower','daily',2,.7],['No social media','daily',0,.86],
    ['Prepare healthy meals','weekly',3,.7],['Call someone you care about','weekly',0,.75],['Plan the week ahead','weekly',4,.6],
    ['Plan a fun day','monthly',1,.5],['Declutter one space','monthly',0,.7],['Review the monthly budget','monthly',0,.6]
  ];
  const s=empty();let r=11;const rnd=()=>{r=(r*16807)%2147483647;return r/2147483647};
  H.forEach((h,i)=>{s.habits.push({id:'h'+i,name:h[0],type:h[1],color:COLORS[h[2]]});s.log['h'+i]={}});
  const start=new Date(TODAY.getFullYear(),TODAY.getMonth()-2,1);
  for(let d=new Date(start);d<TODAY;d=addDays(d,1)){
    H.forEach((h,i)=>{
      if(h[1]==='daily'&&rnd()<h[3])s.log['h'+i][dk(d)]=1;
    });
  }
  // today: a few done
  [0,2,3,8].forEach(i=>{s.log['h'+i][dk(TODAY)]=1});
  // weekly + monthly across seeded months
  for(let k=-2;k<=0;k++){
    const m=new Date(TODAY.getFullYear(),TODAY.getMonth()+k,1),y=m.getFullYear(),mo=m.getMonth();
    const el=k===0?Math.ceil(TODAY.getDate()/7):Math.ceil(dim(y,mo)/7);
    H.forEach((h,i)=>{
      if(h[1]==='weekly'){for(let w=1;w<=el;w++){if(k===0&&w===el&&rnd()<.5)continue;if(rnd()<h[3])s.log['h'+i][y+'-'+p2(mo+1)+'-W'+w]=1}}
      if(h[1]==='monthly'&&(k<0||i===13)&&rnd()<(k<0?h[3]+.2:1))s.log['h'+i][y+'-'+p2(mo+1)]=1;
    });
  }
  // tasks for current week
  const ws=wkStart(TODAY);
  const T=[
    [['Buy shoes',1],['Complete assignment',1],['Go to pet store',0]],
    [['Explore new place in town',1],['Prepare for project',1]],
    [['Complete project',1],['Work on new business idea',1],['Cook a tasty meal',1],['Play football',0]],
    [['Try new meditation',1],['Wash clothes',0]],
    [['Check about meta ads',1],['Launch meta ads for business',1],['Create new IG account',1]],
    [['Create new YouTube account',0],['Go gym in new place',0],['Try out new exercises',0]],
    [['Invite relative for dinner party',0],['Travel in new city',0],['Meditation 1 hour',0],['Journal about my goal',0]]
  ];
  T.forEach((day,i)=>{
    const date=addDays(ws,i),past=date<TODAY;
    s.tasks[dk(date)]={items:day.map(t=>({id:uid(),text:t[0],done:past?(t[1]===1||(i%2===0&&t[0]!==day[day.length-1][0])):false})),mind:past?{energy:4+Math.round(rnd()*5),focus:4+Math.round(rnd()*5),motivation:4+Math.round(rnd()*5)}:null};
  });
  s.goals=[{id:'g1',title:'Learn Spanish to B1',area:'Learning',pct:100},{id:'g2',title:'Run a half marathon',area:'Fitness',pct:66},{id:'g3',title:'Save three months of expenses',area:'Money',pct:50}];
  return s;
}
const QT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/; // quit time, local 'YYYY-MM-DDTHH:MM'
// rebuild saved/imported data from known fields only: templates interpolate ids, colours and numbers unescaped
function clean(d){
  const o=empty(),obj=x=>x&&typeof x==='object'&&!Array.isArray(x),str=x=>typeof x==='string'?x:'',ID=/^[A-Za-z0-9_-]{1,40}$/,DK=/^\d{4}-\d{2}-\d{2}$/;
  const num=(x,lo,hi,dflt)=>Number.isFinite(+x)&&x!==null&&x!==''?Math.max(lo,Math.min(hi,Math.round(+x))):dflt,id=x=>ID.test(x)?x:uid();
  if(!obj(d))return o;
  o.v=num(d.v,1,999,1);
  (Array.isArray(d.habits)?d.habits:[]).forEach(h=>{if(!obj(h))return;const i=id(h.id);
    o.habits.push({id:i,name:str(h.name),type:['daily','weekly','monthly'].includes(h.type)?h.type:'daily',color:/^#[0-9a-f]{6}$/i.test(h.color)?h.color.toLowerCase():COLORS[0],target:num(h.target,1,99,1),per:num(h.per,1,7,7),track:['check','count','amount'].includes(h.track)?h.track:(num(h.target,1,99,1)>1?'count':'check'),unit:str(h.unit).replace(/[<>"'&`=]/g,'').slice(0,12),goal:Number.isFinite(+h.goal)&&+h.goal>0?Math.min(1e6,+h.goal):0,fz:obj(h.fz)?{off:!!h.fz.off,every:num(h.fz.every,3,30,7),max:num(h.fz.max,1,5,3)}:null,rem:obj(h.rem)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(h.rem.t)&&['ask','alarm'].includes(h.rem.m)?{t:h.rem.t,m:h.rem.m}:null});
    const LK=/^\d{4}-\d{2}(-\d{2}|-W\d)?$/,cn=obj(d.count)&&obj(d.count[h.id])?d.count[h.id]:{},nt=obj(d.notes)&&obj(d.notes[h.id])?d.notes[h.id]:{};
    o.count[i]={};Object.keys(cn).forEach(k=>{if(LK.test(k))o.count[i][k]=num(cn[k],1,99,1)});
    const am=obj(d.amt)&&obj(d.amt[h.id])?d.amt[h.id]:{};o.amt[i]={};Object.keys(am).forEach(k=>{const v=+am[k];if(LK.test(k)&&Number.isFinite(v)&&v>0)o.amt[i][k]=Math.min(1e6,Math.round(v*100)/100)});
    o.notes[i]={};Object.keys(nt).forEach(k=>{if(LK.test(k)&&typeof nt[k]==='string'&&nt[k].trim())o.notes[i][k]=nt[k].slice(0,300)});
    const l=obj(d.log)&&obj(d.log[h.id])?d.log[h.id]:{};o.log[i]={};Object.keys(l).forEach(k=>{if(/^\d{4}-\d{2}(-\d{2}|-W\d)?$/.test(k)&&l[k])o.log[i][k]=1})});
  if(obj(d.tasks))Object.keys(d.tasks).forEach(k=>{const t=d.tasks[k];if(!DK.test(k)||!obj(t))return;const m=obj(t.mind)?t.mind:null;
    o.tasks[k]={items:(Array.isArray(t.items)?t.items:[]).filter(obj).map(x=>Object.assign({id:id(x.id),text:str(x.text),done:!!x.done},typeof x.cal==='string'&&x.cal.length<300?{cal:x.cal,hidden:!!x.hidden,pin:!!x.pin}:{},typeof x.rep==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(x.rep)?{rep:x.rep}:{},!x.cal&&obj(x.rem)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x.rem.t)&&['ask','alarm'].includes(x.rem.m)?{rem:{t:x.rem.t,m:x.rem.m}}:{},typeof x.goal==='string'&&ID.test(x.goal)?{goal:x.goal}:{})),
      mind:m?{energy:num(m.energy,0,10,5),focus:num(m.focus,0,10,5),motivation:num(m.motivation,0,10,5)}:null}});
  // custom life areas: [{name, color}], names unique and not one of the built-in ten
  (Array.isArray(d.areas)?d.areas:[]).forEach(a=>{const n=obj(a)?str(a.name).replace(/[<>"'&`=]/g,'').trim().slice(0,24):'';if(n&&!AREAS.includes(n)&&!o.areas.some(x=>x.name===n))o.areas.push({name:n,color:/^#[0-9a-f]{6}$/i.test(a.color)?a.color.toLowerCase():COLORS[0]})});
  const areaOk=new Set(AREAS.concat(o.areas.map(a=>a.name))),fin=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e12;
  (Array.isArray(d.goals)?d.goals:[]).forEach(g=>{if(!obj(g))return;const kind=['pct','steps','num','range','habit','tasks'].includes(g.kind)?g.kind:null;
    o.goals.push(Object.assign({id:id(g.id),title:str(g.title),area:areaOk.has(g.area)?g.area:AREAS[0],pct:num(g.pct,0,100,0)},DK.test(g.due)?{due:g.due}:{},g.pin?{pin:true}:{},
    Array.isArray(g.steps)?{steps:g.steps.filter(obj).slice(0,50).map(x=>Object.assign({id:id(x.id),text:str(x.text).slice(0,200),done:!!x.done},DK.test(x.due)?{due:x.due}:{}))}:{},
    kind?{kind}:{},typeof g.unit==='string'?{unit:g.unit.replace(/[<>"'&`=]/g,'').slice(0,12)}:{},fin(g.target)?{target:g.target}:{},fin(g.start)?{start:g.start}:{},
    Array.isArray(g.log)?{log:g.log.filter(x=>obj(x)&&DK.test(x.d)&&fin(x.v)).slice(-2000).map(x=>Object.assign({d:x.d,v:x.v},x.a?{a:1}:{}))}:{},g.arch?{arch:true}:{},
    obj(g.recur)&&fin(g.recur.v)&&g.recur.v!==0&&['w','m'].includes(g.recur.every)&&DK.test(g.recur.from)?{recur:Object.assign({v:g.recur.v,every:g.recur.every,from:g.recur.from},DK.test(g.recur.last)?{last:g.recur.last}:{})}:{},
    typeof g.habit==='string'&&ID.test(g.habit)?{habit:g.habit}:{},DK.test(g.since)?{since:g.since}:{}))});
  (Array.isArray(d.quits)?d.quits:[]).forEach(q=>{if(obj(q)&&QT.test(q.since))o.quits.push({id:id(q.id),name:str(q.name),since:q.since,best:num(q.best,0,100000,0)})});
  if(obj(d.journal))Object.keys(d.journal).forEach(k=>{if(/^\d{4}-\d{2}$/.test(k))o.journal[k]=str(d.journal[k])});
  return o;
}
let S=clean(load());
if(dataDir&&!readFile())writeFile(); // folder file wins; a new folder gets current data
['habits','log','tasks','goals','journal'].forEach(k=>{if(!S[k])S[k]=(k==='habits'||k==='goals')?[]:{}});
if(!S.v)S.v=1; // pre-versioned saves are v1; add 'if(S.v<2){...;S.v=2}' steps here

let view=(location.hash||'#habits').slice(1);
const AM=/^ask~([A-Za-z0-9_-]{1,40})~(\d{4}-\d{2}(?:-\d{2}|-W\d)?)$/.exec(view),ASK=AM?{h:AM[1],k:AM[2]}:null;if(ASK)view='ask';
const WIDGET=view==='widget'||!!ASK; // the desktop mini window (#widget) and reminder pop-up (#ask~h~k)
const VIEWS=[['today','Today','home'],['habits','Habits','habits'],['tasks','Tasks','tasks'],['goals','Goals','goals'],['insights','Insights','insights'],['achievements','Achievements','trophy']];
const views=()=>VIEWS.filter(v=>v[0]!=='achievements'||feat('ach'));
// settings is a page of its own: #settings (all sections; on phones the section list) and #settings/<section>
let setSec='',setQ='',setBack='today';
const SETSECS=['appearance','language','features','reminders','calendar','data','security','about'];
function routeTo(v){const m=/^settings(?:\/([a-z]+))?$/.exec(v);if(m){view='settings';setSec=SETSECS.includes(m[1])?m[1]:'';return true}if(views().some(x=>x[0]===v)){view=v;return true}return false}
if(!WIDGET&&!routeTo(view))view='habits';
let vy=TODAY.getFullYear(),vm=TODAY.getMonth(),tab='daily',featOpen=false,confirmDemo=false,confirmGoal=null,confirmPinOff=false,menuOpen=false,confirmReset=false,
    taskWeek=wkStart(TODAY),addingTask=null,openMind={},insHabit='all',insRange=7,insMenu=null,lbTab='daily',modal=null,insSeries=[];

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
  const n=dim(y,m),l=L(h),fz=feat('freeze')&&(h.per||7)===7?freezeOf(h).frozen:new Set(),ok=k=>l[k]||fz.has(k);let checks=0,run=0,best=0;
  for(let d=1;d<=n;d++){const k=dkey(y,m,d);if(l[k]){checks++;run++;best=Math.max(best,run)}else if(!fz.has(k))run=0}
  let last=isCurM(y,m)?TODAY.getDate():(isFutM(y,m)?0:n),d=last;
  if(isCurM(y,m)&&d>0&&!l[dkey(y,m,d)])d--;
  let cur=0;while(d>=1&&ok(dkey(y,m,d))){if(l[dkey(y,m,d)])cur++;d--}
  return {pct:Math.round(checks/n*100),cur,best};
}
function weeklyStats(h,y,m){
  const wn=Math.ceil(dim(y,m)/7),l=L(h);
  const el=isCurM(y,m)?Math.ceil(TODAY.getDate()/7):(isFutM(y,m)?0:wn);
  let done=0,run=0,best=0;
  for(let w=1;w<=wn;w++){if(l[wkey(y,m,w)]){done++;run++;best=Math.max(best,run)}else run=0}
  let w=el,cur=0;if(isCurM(y,m)&&w>0&&!l[wkey(y,m,w)])w--;
  while(w>=1&&l[wkey(y,m,w)]){cur++;w--}
  return {pct:el?Math.min(100,Math.round(done/el*100)):0,cur,best,wn,el};
}
// days-per-week habits: how many days this week (Sunday start) are done
const weekDone=h=>{const l=L(h),s=wkStart(TODAY);let n=0;for(let i=0;i<7;i++){const d=addDays(s,i);if(d<=TODAY&&l[dk(d)])n++}return n};
/* streak freezes (every-day habits): every 7 days done in a row earns a freeze (up to 3); a missed day uses one
   and the streak carries on. Worked out from the history, so nothing extra is stored. */
let fzCache=new Map();
function freezeOf(h){
  if(fzCache.has(h.id))return fzCache.get(h.id);
  const l=L(h),keys=Object.keys(l).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).sort(),res={tokens:0,frozen:new Set(),streak:0,best:0};
  const fs=h.fz||{every:7,max:3};
  if(keys.length&&(h.per||7)===7&&feat('freeze')&&!fs.off){let d=new Date(keys[0]+'T00:00'),run=0,earned=0;const end=dk(TODAY);
    for(let k=dk(d);k<=end;d=addDays(d,1),k=dk(d)){
      if(l[k]){res.streak++;run++;if(run%fs.every===0&&res.tokens<fs.max){res.tokens++;earned++}}
      else if(k===end){}
      else if(res.streak&&res.tokens){res.tokens--;res.frozen.add(k)}
      else{res.streak=0;run=0}
      res.best=Math.max(res.best,res.streak)}}
  fzCache.set(h.id,res);return res}
const freezeTotal=()=>byType('daily').reduce((n,h)=>n+freezeOf(h).tokens,0);
const curStreak=h=>{if(feat('freeze')&&(h.per||7)===7&&!(h.fz&&h.fz.off))return freezeOf(h).streak;const l=L(h);let d=TODAY;if(!l[dk(d)])d=addDays(d,-1);let n=0;while(l[dk(d)]){n++;d=addDays(d,-1)}return n};
const dayPct=date=>{const hs=byType('daily');if(!hs.length)return 0;const k=dk(date);return Math.round(hs.filter(h=>L(h)[k]).length/hs.length*100)};
const habitPct=(h,n)=>{const l=L(h);let c=0;for(let i=0;i<n;i++)if(l[dk(addDays(TODAY,-i))])c++;return Math.round(c/n*100)};
const doneToday=()=>{const hs=byType('daily');return {done:hs.filter(h=>L(h)[dk(TODAY)]).length,total:hs.length}};

/* ---------- small renderers ---------- */
function ring(p,size,sw,inner,cls){
  const r=(size-sw)/2,C=2*Math.PI*r,c=size/2;
  return '<div class="ringw '+(cls||'')+'" style="width:'+size+'px;height:'+size+'px"><svg viewBox="0 0 '+size+' '+size+'" aria-hidden="true"><circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="var(--track)" stroke-width="'+sw+'"/>'
   +(p>0?'<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="none" stroke="var(--teal)" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+(C*(1-p/100))+'" transform="rotate(-90 '+c+' '+c+')"/>':'')
   +'</svg><div class="rin">'+inner+'</div></div>';
}
const statCell=st=>'<span>'+st.pct+'%</span><span class="s f">'+FLAME+st.cur+'</span><span class="s t">'+STAR+st.best+'</span>';
const GRIP=(what,cls)=>feat('drag')?'<button class="grip'+(cls?' '+cls:'')+'" type="button" aria-label="Move '+what+'. Drag, or use the arrow keys">'+ic('grip')+'</button>':'';
const nameCell=h=>'<div class="gname" style="--c:'+h.color+'">'+GRIP('habit')+'<span class="tdot"></span><button class="nm nb" data-act="edithabit" data-h="'+h.id+'" title="'+esc(h.name)+'. Tap to edit">'+esc(h.name)+'</button></div>';
const emptyHabits=()=>'<div class="empty">No habits here yet.<br><button class="btn" data-act="newhabit">+ New Habit</button> <button class="btn ghost" data-act="demo">Load demo data</button></div>';

/* ---------- Habits view ---------- */
function summary(){
  const cur=isCurM(vy,vm),t=doneToday();
  return '<div class="sum"><div><div class="lbl">'+MONTHS[vm].toUpperCase()+' '+vy+'</div><b>'+(cur?t.done+'/'+t.total+' habits done today':'Monthly summary')+'</b></div>'
   +'<div class="nav"><button class="circ-btn" data-act="mprev" aria-label="Previous month">'+ic('prev')+'</button><button class="circ-btn" data-act="mnext" aria-label="Next month">'+ic('next')+'</button></div>'
   +(cur&&t.total?'<div class="bar"><i style="width:'+Math.round(t.done/t.total*100)+'%"></i></div>':'')+'</div>';
}
function vHabits(){
  let out=summary();
  out+='<div class="tabs"><div class="seg" role="tablist">'+['daily','weekly','monthly'].map(t=>'<button role="tab" aria-selected="'+(tab===t)+'" class="'+(tab===t?'on':'')+'" data-act="tab" data-v="'+t+'">'+t+'</button>').join('')+'</div><button class="btn" data-act="newhabit">+ New Habit</button></div>';
  if(tab==='daily')out+=dailyGrid();else if(tab==='weekly')out+=weeklyList();else out+=monthlyList();
  return out;
}
function dailyGrid(){
  const hs=byType('daily');if(!hs.length)return emptyHabits();
  const n=dim(vy,vm),pts=[];
  for(let d=1;d<=n;d++){const date=new Date(vy,vm,d);pts.push(date>TODAY?0:dayPct(date))}
  const yy=v=>12+(100-v)*.76;
  const curve=smooth(pts.map((v,i)=>[+((i+.5)/n*100).toFixed(2),+yy(v).toFixed(2)])); // same curve as the Insights chart
  const area=curve+' L'+((pts.length-.5)/n*100).toFixed(2)+',100 L'+(.5/n*100).toFixed(2)+',100 Z';
  const avg=Math.round(hs.reduce((s,h)=>s+dailyStats(h,vy,vm).pct,0)/hs.length);
  let o='<div class="gcard"><div class="gin" data-drop="habits-daily" style="--n:'+n+'">';
  o+='<div class="grow chartrow"><div class="gname"><span class="tdot"></span><span class="nm lbl" style="color:var(--g4a);font-size:8px">TREND</span></div>'
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
      o+='<div class="cellw"><button class="cell '+(on?'on':fzs&&fzs.has(k)?'fz-day':'')+'" data-act="cell" data-h="'+h.id+'" data-d="'+k+'" '+(fut?'disabled':'')+' aria-pressed="'+on+'" aria-label="'+esc(h.name)+', '+d+' '+MONTHS[vm]+tgt(h,k)+'"'+noteTitle(h,k)+'>'+cellIn(h,k,on)+'</button></div>';
    }
    o+='<div class="gstat">'+statCell(st)+'</div></div>';
  });
  return o+'</div></div>';
}
function weeklyList(){
  const hs=byType('weekly');if(!hs.length)return emptyHabits();
  const wn=Math.ceil(dim(vy,vm)/7),el=isCurM(vy,vm)?Math.ceil(TODAY.getDate()/7):(isFutM(vy,vm)?0:wn);
  let o='<div class="wscroll"><div class="wcard" data-drop="habits-weekly" style="--w:'+wn+'"><div class="wrow h"><div class="gname lbl">HABIT</div>';
  for(let w=1;w<=wn;w++)o+='<div class="c lbl">W'+w+'</div>';
  o+='<div class="gstat lbl">STATS</div></div>';
  hs.forEach(h=>{
    const l=L(h),st=weeklyStats(h,vy,vm);
    o+='<div class="wrow" data-drag="habits-weekly" data-id="'+h.id+'">'+nameCell(h);
    for(let w=1;w<=wn;w++){const on=!!l[wkey(vy,vm,w)];
      o+='<div class="c"><button class="cell '+(on?'on':'')+'" data-act="wcell" data-h="'+h.id+'" data-w="'+w+'" '+(w>el?'disabled':'')+' aria-pressed="'+on+'" aria-label="'+esc(h.name)+', week '+w+tgt(h,wkey(vy,vm,w))+'">'+cellIn(h,wkey(vy,vm,w),on)+'</button></div>'}
    o+='<div class="gstat">'+statCell(st)+'</div></div>';
  });
  return o+'</div></div>';
}
function monthlyList(){
  const hs=byType('monthly');if(!hs.length)return emptyHabits();
  return '<div class="mlist" data-drop="habits-monthly">'+hs.map(h=>{
    const on=!!L(h)[mkey(vy,vm)],fut=isFutM(vy,vm);
    return '<div class="mrow" data-drag="habits-monthly" data-id="'+h.id+'" style="--c:'+h.color+'">'+GRIP('habit')+'<button class="cell '+(on?'on':'')+'" data-act="mcell" data-h="'+h.id+'" '+(fut?'disabled':'')+' aria-pressed="'+on+'" aria-label="'+esc(h.name)+tgt(h,mkey(vy,vm))+'">'+cellIn(h,mkey(vy,vm),on)+'</button><span class="tdot"></span><button class="nm nb" data-act="edithabit" data-h="'+h.id+'" title="'+esc(h.name)+'. Tap to edit">'+esc(h.name)+'</button><span class="st '+(on?'d':'')+'">'+(on?'Done':'Pending')+'</span></div>';
  }).join('')+'</div>';
}

/* ---------- Today ---------- */
function vToday(){
  const t=doneToday(),pct=t.total?Math.round(t.done/t.total*100):0,k=dk(TODAY);
  const wn=Math.ceil(TODAY.getDate()/7),y=TODAY.getFullYear(),m=TODAY.getMonth();
  const day=S.tasks[k]||{items:[],mind:null};
  let o='<section class="card thero">'+ring(pct,190,16,'<div class="tpct">'+pct+'%</div><div class="lbl" style="font-size:10px">Today</div>')
   +'<div><div class="tdate">'+DAYS[TODAY.getDay()]+' '+TODAY.getDate()+' '+MONTHS[m]+'</div><div class="muted" style="margin-top:4px">'+t.done+' / '+t.total+' habits completed</div></div>'
   +(feat('freeze')&&freezeTotal()?'<div class="fzpill">'+ic('snow')+freezeTotal()+(freezeTotal()===1?' streak freeze':' streak freezes')+' saved up</div>':'')+'</section>'
   +'<section class="card ttasks"><div class="ch"><span class="lbl">Tasks today</span><span>'+(feat('focus')?'<button class="link" data-act="focusnew" style="margin-right:14px">Focus</button>':'')+'<button class="link" data-act="goto" data-v="tasks">Open</button></span></div>'
   +'<div class="tlist" data-drop="tasks" data-k="'+k+'">'+vis(day.items).map(it=>taskChip(k,it)).join('')+'</div>'+(vis(day.items).length?'':'<p class="muted" style="margin:0 0 8px;font-size:12px">Nothing planned yet.</p>')
   +taskAdder(k,false)+'</section>';
  if(feat('streaks')&&feat('ach')&&S.quits.length)o+='<section class="card tstreaks"><div class="ch"><span class="lbl">Streaks</span><button class="link" data-act="goto" data-v="achievements">Open</button></div><div class="tsg">'
    +S.quits.map(q=>{const d=qDays(q),nx=MILES.find(x=>x>d);return '<div class="tsi"><div class="lbl" style="font-size:9px">'+esc(q.name)+'</div><b>'+d+(d===1?' day':' days')+'</b><span class="sub" style="margin:0">'+(nx?'Next: '+dur(nx):'Every milestone reached')+'</span></div>'}).join('')+'</div></section>';
  if(feat('review')&&TODAY.getDay()===0)o+=reviewCard();
  const sec=(title,rows)=>rows?'<section class="sec" data-card="'+title.toLowerCase()+'" data-drop="habits-'+title.toLowerCase()+'"><h2>'+title+'</h2>'+rows+'</section>':'';
  o+=sec('Daily',byType('daily').map(h=>{const on=!!L(h)[k],c=curStreak(h),fz=feat('freeze')?freezeOf(h).tokens:0;
    return '<div class="trow'+(on?' on':'')+'" data-drag="habits-daily" data-id="'+h.id+'">'+GRIP('habit')+'<button class="cell '+(on?'on':'')+'" data-act="cell" data-h="'+h.id+'" data-d="'+k+'" aria-pressed="'+on+'" aria-label="'+esc(h.name)+tgt(h,k)+'">'+cellIn(h,k,on)+'</button><span class="tdot" style="--c:'+h.color+'"></span><span class="nm">'+esc(h.name)+(feat('notes')&&(S.notes[h.id]||{})[k]?'<small class="hnote">'+esc(S.notes[h.id][k])+'</small>':'')+'</span>'+(feat('notes')?'<button class="nbtn" data-act="note" data-h="'+h.id+'" data-k="'+k+'" aria-label="'+((S.notes[h.id]||{})[k]?'Edit':'Add')+' note for '+esc(h.name)+'">'+ic('note')+'</button>':'')+(isAmt(h)?'<span class="meta amt'+(on?' met':'')+'">'+(amtOf(h,k)?fmtN(amtOf(h,k))+(h.goal?' / '+fmtN(h.goal):'')+' '+esc(unitOf(h))+' today':'Tap to log '+esc(unitOf(h)||'amount'))+(monthAmt(h,y,m)?' · '+fmtN(monthAmt(h,y,m))+' this month':'')+'</span>':(h.per||7)<7?(n=>'<span class="meta wkp'+(n>=h.per?' met':'')+'">'+Math.min(n,h.per)+'/'+h.per+' this week</span>')(weekDone(h)):(fz?'<span class="fz" title="'+fz+(fz===1?' streak freeze':' streak freezes')+' saved up" aria-label="'+fz+(fz===1?' streak freeze':' streak freezes')+'">'+ic('snow')+fz+'</span>':'')+(c?'<span class="meta" style="color:var(--flame)">'+FLAME+c+'</span>':''))+'</div>'}).join(''));
  o+=sec('Weekly',byType('weekly').map(h=>{const on=!!L(h)[wkey(y,m,wn)];
    return '<div class="trow'+(on?' on':'')+'" data-drag="habits-weekly" data-id="'+h.id+'">'+GRIP('habit')+'<button class="cell '+(on?'on':'')+'" data-act="wcell" data-h="'+h.id+'" data-w="'+wn+'" aria-pressed="'+on+'" aria-label="'+esc(h.name)+tgt(h,wkey(y,m,wn))+'">'+cellIn(h,wkey(y,m,wn),on)+'</button><span class="tdot" style="--c:'+h.color+'"></span><span class="nm">'+esc(h.name)+'</span><span class="meta">This week</span></div>'}).join(''));
  o+=sec('Monthly',byType('monthly').map(h=>{const on=!!L(h)[mkey(y,m)];
    return '<div class="trow'+(on?' on':'')+'" data-drag="habits-monthly" data-id="'+h.id+'">'+GRIP('habit')+'<button class="cell '+(on?'on':'')+'" data-act="mcell" data-h="'+h.id+'" aria-pressed="'+on+'" aria-label="'+esc(h.name)+tgt(h,mkey(y,m))+'">'+cellIn(h,mkey(y,m),on)+'</button><span class="tdot" style="--c:'+h.color+'"></span><span class="nm">'+esc(h.name)+'</span><span class="meta">This month</span></div>'}).join(''));
  if(!S.habits.length)o+='<div class="empty">Add your first habit to start your day.<br><button class="btn" data-act="newhabit">+ New Habit</button> <button class="btn ghost" data-act="demo">Load demo data</button></div>';
  return o;
}

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
  return '<div class="tk '+(it.done?'done':miss?'miss':'')+'" data-drag="tasks" data-id="'+it.id+'">'+GRIP('task')+'<button class="cb '+(it.done?'on':miss?'cbx':'')+'" data-act="tdone" data-k="'+k+'" data-i="'+it.id+'" aria-pressed="'+it.done+'" aria-label="'+esc(it.text)+(miss?', missed. Tap to mark as done':'')+'">'+(it.done?CHECK:miss?XMARK:'')+'</button><span contenteditable="plaintext-only" role="textbox" aria-label="Task text" data-et="'+k+'" data-i="'+it.id+'">'+esc(it.text)+'</span>'+(it.goal&&S.goals.some(g=>g.id===it.goal)?'<span class="tkg" title="Part of: '+esc(S.goals.find(g=>g.id===it.goal).title)+'" aria-label="Part of a goal">'+ic('goals')+'</span>':'')+(it.cal?'':'<button class="tkb'+(it.rem?' on':'')+'" data-act="trem" data-k="'+k+'" data-i="'+it.id+'" aria-label="'+(it.rem?'Reminder at '+it.rem.t+'. Change':'Add a reminder')+'">'+ic('bell')+'</button>')+'<button class="tkx" data-act="tdel" data-k="'+k+'" data-i="'+it.id+'" aria-label="Delete task">&times;</button></div>';
}
// dates a repeating task lands on, from its first day up to the chosen end (capped)
function repeatDates(k,rep,until){
  const d0=new Date(k+'T00:00'),end=until==='y'?new Date(d0.getFullYear(),11,31):until==='3m'?new Date(d0.getFullYear(),d0.getMonth()+3,d0.getDate()):new Date(d0.getFullYear(),d0.getMonth()+1,0);
  const out=[];for(let d=new Date(d0);d<=end&&out.length<400;d=addDays(d,1)){const w=d.getDay();
    if(rep==='d'||(rep==='wd'&&w>0&&w<6)||(rep==='w'&&w===d0.getDay())||(rep==='m'&&d.getDate()===d0.getDate()))out.push(dk(d))}
  return out;
}
let addingText='',repSel={rep:'',until:'m',open:''};
// add the typed task (and its repeats) to day k
function addTask(k){
  const v=(($('#taskInput')||{}).value||addingText).trim();if(!v){const i=$('#taskInput');if(i)i.focus();return false}
  const days=repSel.rep?repeatDates(k,repSel.rep,repSel.until):[k],sid=repSel.rep?uid():'';
  days.forEach(x=>(S.tasks[x]=S.tasks[x]||{items:[],mind:null}).items.push(Object.assign({id:uid(),text:v,done:false},sid?{rep:sid}:{})));
  addingText='';repSel={rep:'',until:'m',open:''};save();focusSel='#taskInput';render();if(days.length>1)toast('Added on '+days.length+' days');return true;
}
function taskAdder(k,copy){
  const items=vis((S.tasks[k]||{items:[]}).items);
  const d=new Date(k+'T00:00'),nth=['first','second','third','fourth','fifth'][Math.floor((d.getDate()-1)/7)];
  const RO=[['','Doesn’t repeat'],['d','Every day'],['wd','Every weekday (Mon to Fri)'],['w','Every week on '+DAYS[d.getDay()]],['m','Every month on day '+d.getDate()]];
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
function vTasks(){
  const days=[];for(let i=0;i<7;i++)days.push(addDays(taskWeek,i));
  const data=days.map(d=>{const t=S.tasks[dk(d)]||{items:[],mind:null};const td=todo(t.items);return {d,k:dk(d),items:vis(t.items),todo:td,mind:t.mind,done:td.filter(i=>i.done).length}});
  const tot=data.reduce((s,x)=>s+x.todo.length,0),done=data.reduce((s,x)=>s+x.done,0),pct=tot?Math.round(done/tot*100):0,mx=Math.max(1,...data.map(x=>x.todo.length));
  const isNow=dk(taskWeek)===dk(wkStart(TODAY));
  const e=addDays(taskWeek,6);
  const range=p2(taskWeek.getDate())+' '+MONR[taskWeek.getMonth()]+' – '+p2(e.getDate())+' '+MONR[e.getMonth()]+' '+e.getFullYear();
  const H=110;
  let o='<div class="ttop"><section class="card wk"><div class="wkhead"><div><div class="lbl" style="font-size:9px">WEEK STARTING</div><span class="wkpill">'+range+'</span></div>'
   +'<div class="wknav"><button data-act="tprev" aria-label="Previous week">'+ic('prev')+'</button><button data-act="tnow">'+(isNow?'This week':'Go to this week')+'</button><button data-act="tnext" aria-label="Next week">'+ic('next')+'</button></div></div>'
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
    return '<section class="day '+(x.k===dk(TODAY)?'now':'')+'"><h3>'+DAYS[x.d.getDay()]+'</h3><div class="dt">'+dmy(x.d)+'</div>'
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
  const mood=md.energy.length?MF.map(f=>'<span style="color:'+f[1]+'">'+f[2]+' '+(md[f[0]].reduce((a,b)=>a+b,0)/md[f[0]].length).toFixed(1)+'</span>').join(' · '):'<span class="muted">Not logged this week</span>';
  return '<section class="card review"><div class="ch"><span class="lbl">Your week in review</span><span class="sub" style="margin:0">'+days[0].getDate()+' '+MON3[days[0].getMonth()]+' – '+TODAY.getDate()+' '+MON3[TODAY.getMonth()]+'</span></div><div class="rvg">'
   +'<div><div class="lbl" style="font-size:9px">Habits</div><b>'+(dh?hp+'%':'–')+'</b>'+(dh?'<span class="sub" style="margin:0;color:'+(diff>=0?'var(--teal)':'var(--red)')+'">'+(diff>=0?'+':'')+diff+'% vs last week</span>':'')+'</div>'
   +'<div><div class="lbl" style="font-size:9px">Tasks</div><b>'+td+' / '+tt+'</b><span class="sub" style="margin:0">done</span></div>'
   +'<div><div class="lbl" style="font-size:9px">Best streak</div><b>'+(best&&best.s?best.s+'d':'–')+'</b><span class="sub" style="margin:0">'+(best&&best.s?esc(best.h.name):'Tick a daily habit to start one')+'</span></div>'
   +'<div><div class="lbl" style="font-size:9px">Mindset</div><span class="sub" style="margin:0">'+mood+'</span></div></div>'
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
  if(!dh.length)return '<div class="empty">Insights show up once you have daily habits.<br><button class="btn" data-act="newhabit">+ New Habit</button> <button class="btn ghost" data-act="demo">Load demo data</button></div>';
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
    else{let c=0;for(let k=0;k<3;k++){const d=new Date(TODAY.getFullYear(),TODAY.getMonth()-k,1);if(L(h)[mkey(d.getFullYear(),d.getMonth())])c++}p=Math.round(c/3*100)}
    return {h,p}}).sort((a,b)=>b.p-a.p).slice(0,5);
  const MC=['#facc15','#cbd5e1','#d08a4a','#555','#555'];
  o+='<section class="card h" data-card="leader"><div class="ch"><span class="lbl">HABIT LEADERBOARD</span><div class="dwm">'+[['daily','D'],['weekly','W'],['monthly','M']].map(t=>'<button data-act="lb" data-v="'+t[0]+'" class="'+(lbTab===t[0]?'on':'')+'" aria-label="'+t[0]+'">'+t[1]+'</button>').join('')+'</div></div>'
   +(lh.length?lh.map((x,i)=>'<div class="lrow"><span>'+medal(MC[i])+'</span><div><div class="top"><span>'+esc(x.h.name)+'</span><b>'+x.p+'%</b></div><div class="tr"><i style="width:'+x.p+'%"></i></div></div></div>').join(''):'<p class="muted" style="font-size:12px">No '+ty+' habits yet.</p>')+'</section>';
  const ts=dh.map(h=>({h,s:curStreak(h)})).sort((a,b)=>b.s-a.s).slice(0,5);
  o+='<section class="card h" data-card="topstreaks"><div class="ch"><span class="lbl">TOP STREAKS</span></div>'+ts.map((x,i)=>'<div class="lrow"><span>'+medal(MC[i])+'</span><div><div class="top"><span>'+esc(x.h.name)+'</span><b>'+x.s+'d</b></div><div class="tr"><i style="width:'+Math.max(3,Math.min(100,x.s/30*100))+'%"></i></div></div></div>').join('')+'</section>';
  // goals + tasks
  const gd=S.goals.filter(g=>gPct(g)>=100).length,ga=S.goals.length?Math.round(S.goals.reduce((s,g)=>s+gPct(g),0)/S.goals.length):0;
  let tt=0,td=0;for(let i=0;i<7;i++){const t=S.tasks[dk(addDays(wkStart(TODAY),i))];if(t){const a=todo(t.items);tt+=a.length;td+=a.filter(x=>x.done).length}}
  const tp=tt?Math.round(td/tt*100):0;
  o+='<section class="card h" data-card="goalsum"><div class="ch"><span class="lbl">GOALS</span><button class="link" data-act="goto" data-v="goals">Open →</button></div><div class="bigv">'+gd+' / '+S.goals.length+' completed</div><div class="goal"><div class="tr"><i style="width:'+ga+'%"></i></div></div><div class="sub">Average progress '+ga+'%</div></section>'
   +'<section class="card h" data-card="taskweek"><div class="ch"><span class="lbl">TASKS THIS WEEK</span><button class="link" data-act="goto" data-v="tasks">Open →</button></div><div class="bigv">'+tp+'%</div><div class="goal"><div class="tr"><i style="width:'+tp+'%"></i></div></div><div class="sub">Of this week’s tasks are done</div></section>';
  const rk=mkey(TODAY.getFullYear(),TODAY.getMonth());
  o+='<section class="card"><h3 style="margin:0 0 12px;font-size:15px;font-weight:600">Monthly Reflection</h3><textarea class="field" id="reflect" placeholder="How was this month? What did you learn?" aria-label="Monthly reflection">'+esc(S.journal[rk]||'')+'</textarea></section>';
  return o;
}
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
  return '<svg class="g2sp" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="100" y1="'+y(g.target)+'" y2="'+y(g.target)+'" class="tg"/><polyline points="'+pts.map((v,i)=>(i/n*100).toFixed(1)+','+y(v).toFixed(1)).join(' ')+'"/></svg>'}
const CUR=/^[€$£¥₹]$/,fmtU=(v,u)=>{const n=(Math.round((+v||0)*100)/100).toLocaleString('en-GB');return u?CUR.test(u)?(v<0?'-':'')+u+n.replace('-',''):n+' '+u:n};
// one line saying where a goal stands, e.g. "€6,500 of €10,000"
function gLine(g){const k=gKind(g),u=g.unit||'';
  if(k==='num')return fmtU(gSum(g),u)+' of '+fmtU(g.target||0,u);
  if(k==='range'){const c=gLast(g);return c===undefined?'Starts at '+fmtU(g.start,u):fmtU(c,u)+' now · goal '+fmtU(g.target,u)+' (from '+fmtU(g.start,u)+')'}
  if(k==='habit'){const h=findH(g.habit);return h?gHabitN(g)+' of '+(g.target||0)+' times · '+esc(h.name):'The linked habit was deleted'}
  if(k==='tasks'){const t=gTasks(g),nx=t.find(x=>!x.it.done);return t.filter(x=>x.it.done).length+' of '+t.length+' tasks done'+(nx?' · next: '+esc(nx.it.text)+' ('+dmy(new Date(nx.k+'T00:00'))+')':'')}
  return ''}
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
   +gSpark(g)+(g.recur&&gKind(g)==='num'?'<div class="g2n" style="color:var(--muted)">Adds '+fmtU(g.recur.v,g.unit)+' every '+(g.recur.every==='w'?'week':'month')+'</div>':'')
   +'<div class="g2b"><div class="tr"><i style="width:'+p+'%"></i></div><b>'+p+'%</b></div>'+(g.arch?'<button class="btn ghost g2add" data-act="garch" data-g="'+g.id+'">Restore</button>':p>=100?'<button class="btn ghost g2add" data-act="garch" data-g="'+g.id+'">Archive</button>':'')+'</section>'}
let goalArea='',goalArchOpen=false;
function vGoals(){
  const live=S.goals.filter(g=>!g.arch),done=S.goals.filter(g=>gPct(g)>=100).length,n=S.goals.length,used=new Set(live.map(g=>g.area)).size;
  let o='<div class="card g2sum">'+ring(n?done/n*100:0,92,9,'<b style="font-size:20px">'+done+'/'+n+'</b>')+'<div><div class="lbl">Goals reached</div><b style="font-size:17px">'+(n?'Working across '+used+(used===1?' life area':' of '+allAreas().length+' life areas'):'Pick a life area to start')+'</b></div><button class="btn" data-act="newgoal">+ New Goal</button></div>';
  o+='<h2 class="g2t">Life areas</h2><div class="g2areas">'+allAreas().map(a=>{const gs=S.goals.filter(g=>g.area===a),r=gs.filter(g=>gPct(g)>=100).length;
    const cu=!AREAS.includes(a);
    return '<div class="g2aw"><button class="g2area'+(goalArea===a?' on':'')+'" data-act="garea" data-v="'+esc(a)+'" aria-pressed="'+(goalArea===a)+'"><span><i style="--c:'+areaCol(a)+'"></i>'+esc(a)+'</span><small>'+gs.length+(gs.length===1?' goal':' goals')+' · '+r+' reached</small></button>'
      +(cu?'<button class="g2aed" data-act="areaedit" data-v="'+esc(a)+'" aria-label="Edit area '+esc(a)+'">'+ic('pencil')+'</button>':'')+'</div>'}).join('')+'<button class="g2area g2new" data-act="areanew"><span>+ New area</span><small>Your own life area</small></button></div>';
  if(!n)return o+'<div class="empty">Set a goal in any of your 10 life areas.<br><button class="btn" data-act="newgoal">+ New Goal</button></div>';
  const show=S.goals.filter(g=>!g.arch&&(!goalArea||g.area===goalArea)),pin=show.filter(g=>g.pin),rest=show.filter(g=>!g.pin),arch=S.goals.filter(g=>g.arch&&(!goalArea||g.area===goalArea));
  if(goalArea&&!show.length)o+='<div class="empty">No goals in '+esc(goalArea)+' yet.<br><button class="btn" data-act="newgoal">+ New Goal</button></div>';
  if(pin.length)o+='<h2 class="g2t">Pinned</h2><div class="g2list" data-drop="goals">'+pin.map(goalCard).join('')+'</div>';
  if(rest.length)o+='<h2 class="g2t">'+(goalArea?esc(goalArea):pin.length?'Other goals':'All goals')+'</h2><div class="g2list" data-drop="goals">'+rest.map(goalCard).join('')+'</div>';
  if(arch.length)o+='<button class="g2t g2fold" data-act="gfold" aria-expanded="'+goalArchOpen+'">Archived ('+arch.length+') '+ic('down')+'</button>'+(goalArchOpen?'<div class="g2list g2arch">'+arch.map(goalCard).join('')+'</div>':'');
  return o}
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
  return 'Daybook '+APPV}
function setSection(k){
  let b='';
  if(k==='appearance')b=sgrp('Theme','<div class="sseg">'+[['dark','Dark'],['amoled','AMOLED'],['light','Light']].map(t=>'<button data-act="ptheme" data-v="'+t[0]+'" aria-pressed="'+((P.theme||'dark')===t[0])+'" class="'+((P.theme||'dark')===t[0]?'on':'')+'">'+t[1]+'</button>').join('')+'</div>')
    +sgrp('Accent colour','<div class="sacc">'+ACCENTS.map(a=>'<button class="sw" data-act="paccent" data-sw="accent" data-v="'+a[1]+'" style="background:'+a[1]+'" aria-label="'+a[0]+' accent" aria-pressed="'+(P.accent===a[1])+'"></button>').join('')+'</div><div class="sacc2">'+colorFields('accent',P.accent,'accent colour')+'</div>')
    +sgrp('Layout',srow('Reset card layout','Puts the Today and Insights cards back in their original order',sbtn('resetlayout','Reset')));
  if(k==='language')b=sgrp('',srow('Language','Daybook follows this device’s language unless you pick one. Your own habits and tasks are never translated.','<select class="field ssel" id="langSel" aria-label="Language"><option value="">Same as this device</option>'+LANGS.map(l=>'<option value="'+l[0]+'"'+(l[0]===P.lang?' selected':'')+'>'+l[1]+'</option>').join('')+'</select>','translate'));
  if(k==='features')b=sgrp('',FEAT.filter(f=>f[0]!=='remnames'&&f[0]!=='reminder').map(f=>srow(f[1],FEATD[f[0]],sw('feat',f[0],feat(f[0]),f[1]))).join(''))
    +(DFS&&DFS.widget&&!WIDGET?sgrp('Desktop',sgo('widget','Open the mini widget','A small always-on-top window with today’s habits and tasks')):'');
  if(k==='reminders')b=sgrp('Daily reminder',srow('Daily reminder',FEATD.reminder,sw('feat','reminder',feat('reminder'),'Daily reminder'))
      +(feat('reminder')?(LN||'Notification' in window?srow('Time',LN?'A notification every day, even when Daybook is closed':'Only while Daybook is open or in the background','<input type="time" class="field stime" id="remTime" value="'+esc(P.remTime||'21:00')+'" aria-label="Reminder time">'):srow('Reminders aren’t supported here yet','')):''))
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
      +(DFS?sgrp('Data folder',srow('Folder',dataDir?esc(dataDir):'App storage (this PC only). Pick a Google Drive, OneDrive or Dropbox folder to sync between computers',sbtn('pickdir',dataDir?'Change':'Choose…'))+(dataDir?sgo('resetdir','Stop using this folder',''):'')):'')
      +(NB&&NB.pickFolder&&!DFS?sgrp('Data folder',srow('Folder',P.andDir?esc(P.andDir):'This phone only. Pick a folder another app keeps in sync to share data between devices',sbtn('apick',P.andDir?'Change':'Choose…'))+(P.andDir?sgo('aclear','Stop using this folder',''):'')):'')
      +sgrp('Export and import',sgo('export','Export backup',P.lock?'Encrypted with your PIN':'A file with all your data')+sgo('csv','Export as spreadsheet (.csv)','For Excel, Numbers or Google Sheets')+sgo('import','Import backup','Replaces the data on this device'))
      +sgrp('Danger zone',sgo('demo',confirmDemo?'Tap again: replace my data with demo':'Load demo data','Example habits, tasks and goals')+sgo('fresh',confirmReset?'Tap again to erase everything':'Start fresh','Erases everything on this device','red'),'danger')}
  if(k==='security')b=sgrp('App lock',!canLock?srow('Not available here',''):P.lock?
      sgo('pinset','Change PIN…','')+(bioOk?srow('Fingerprint unlock','Unlock with your fingerprint instead of typing the PIN',sw(P.bio?'biooff':'bioask',undefined,P.bio,'Fingerprint unlock')):'')
      +srow('Lock after','Without use; Daybook also locks a minute after you leave it','<select class="field ssel" id="lockSel" aria-label="Lock after">'+[1,5,15,30].map(m=>'<option value="'+m+'"'+((P.lockIdle||5)===m?' selected':'')+'>'+m+' min</option>').join('')+'</select>')
      +sgo('pinoff',confirmPinOff?'Tap again to remove the PIN':'Remove PIN','Your data is decrypted and saved readable again','red')
    :sgo('pinset','Set a PIN…','Locks Daybook and encrypts your data on this device and in backups'))
    +sgrp('',srow('How the lock works','Locks when Daybook opens, after a minute in the background or the time above without use. It hides your data on screen and encrypts what’s saved on this device and in backups.',''));
  if(k==='about')b=sgrp('',srow('Daybook '+APPV,'Habits, tasks and goals in one calm place','<a class="btn ghost sbtn" href="'+RELEASES+'" target="_blank" rel="noopener">Check for updates</a>')+sgo('tipsshow','Show tips','The short introduction from the first start'))
    +sgrp('Privacy',srow('Your data stays with you','No account, no ads, no tracking. Everything is saved on your devices, and only goes where you send it: your backups, your data folder, your calendar link.',''))
    +(wideSet()?sgrp('Keyboard shortcuts',[['Ctrl+Z','Undo the latest delete'],['Esc','Close a dialog or leave settings'],['Enter','Add the task or save the dialog'],['Arrow keys','Move the focused card, habit, goal or task']].map(x=>srow(x[1],'','<kbd>'+x[0]+'</kbd>','shortcut')).join('')):'')
    +sgrp('Licences',srow('Daybook','GNU AGPL-3.0 licence','','license open source')+srow('Space Grotesk font','SIL Open Font License',''));
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
      const extra=g.querySelector('.sseg,.sacc');if(extra&&q){const hit=fold(g.textContent+' '+sec.dataset.sec).includes(q);g.querySelectorAll('.sseg,.sacc,.sacc2').forEach(x=>x.hidden=!hit);if(hit)gn++}else{g.querySelectorAll('.sseg,.sacc,.sacc2').forEach(x=>x.hidden=false);if(extra)gn++}
      g.hidden=!gn;n+=gn});sec.hidden=!n;if(n)any=true});
  const none=m.querySelector('.snone');if(none)none.hidden=!q||any}
// desktop: the side list follows the section in view
let setObs=null;
function spySettings(){if(setObs)setObs.disconnect();if(!wideSet()||!window.IntersectionObserver)return;
  setObs=new IntersectionObserver(es=>{const v=es.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(!v)return;
    $$('.snav a').forEach(a=>a.classList.toggle('on',a.dataset.sec===v.target.dataset.sec))},{rootMargin:'-80px 0px -60% 0px'});
  $$('.spane .ssec').forEach(x=>setObs.observe(x))}
/* ---------- modal ---------- */
/* achievements: quit streaks ("stopped smoking"), counted from a date and time */
const qDate=q=>new Date(q.since),qDays=q=>Math.max(0,Math.floor((Date.now()-qDate(q))/864e5));
const MILES=[1,3,7,14,30,60,90,180,365,730,1095,1825,3650];
const nowLocal=()=>{const d=new Date();return dk(d)+'T'+p2(d.getHours())+':'+p2(d.getMinutes())};
const dur=d=>d>=365?(Math.floor(d/365)+(d>=730?' years':' year')):d>=30?(Math.floor(d/30)+(d>=60?' months':' month')):d+(d===1?' day':' days');
/* desktop widget: today's ring, daily habits and tasks in a small always-on-top window */
function vWidget(){
  const t=doneToday(),pct=t.total?Math.round(t.done/t.total*100):0,k=dk(TODAY),day=S.tasks[k]||{items:[]};
  return '<div class="wtop">'+ring(pct,86,9,'<b style="font-size:18px">'+t.done+'/'+t.total+'</b>')+'<div><div class="lbl" style="font-size:9px">'+DAYS[TODAY.getDay()]+' '+TODAY.getDate()+' '+MON3[TODAY.getMonth()]+'</div><b style="font-size:16px">'+(t.total&&t.done===t.total?'All done today':pct+'% of habits')+'</b><br><button class="link" data-act="wmain">Open Daybook</button></div></div>'
   +'<div class="lbl" style="font-size:9px;margin:14px 0 6px">Habits</div>'
   +(byType('daily').map(h=>{const on=!!L(h)[k];return '<div class="trow"><button class="cell '+(on?'on':'')+'" data-act="cell" data-h="'+h.id+'" data-d="'+k+'" aria-pressed="'+on+'" aria-label="'+esc(h.name)+tgt(h,k)+'">'+cellIn(h,k,on)+'</button><span class="nm">'+esc(h.name)+'</span></div>'}).join('')||'<p class="sub">No daily habits yet.</p>')
   +'<div class="lbl" style="font-size:9px;margin:14px 0 6px">Tasks today</div>'+'<div class="tlist" data-drop="tasks" data-k="'+k+'">'+vis(day.items).map(it=>taskChip(k,it)).join('')+'</div>'+(vis(day.items).length?'':'<p class="sub">Nothing planned.</p>')+taskAdder(k,false);
}
function vAch(){
  let o='<div class="sum"><div><div class="lbl">ACHIEVEMENTS</div><b>Things you’ve stopped, and how long it’s been</b></div><button class="btn" data-act="newquit">+ New streak</button></div>';
  if(!S.quits.length)return o+'<div class="empty">Track something you’ve stopped, like smoking or sugar.<br>Pick when you stopped and watch the streak grow.<br><button class="btn" data-act="newquit">+ New streak</button></div>';
  return o+'<div class="gg" data-drop="quits" data-axis="x">'+S.quits.map(q=>{
    const ms=Math.max(0,Date.now()-qDate(q)),d=Math.floor(ms/864e5),h=Math.floor(ms/36e5)%24,m=Math.floor(ms/6e4)%60;
    const next=MILES.find(x=>x>d),got=MILES.filter(x=>x<=d),best=Math.max(q.best||0,d),prev=got.length?got[got.length-1]:0;
    const pct=next?Math.round((d-prev)/(next-prev)*100):100;
    return '<section class="card goal ach" data-drag="quits" data-id="'+q.id+'">'+GRIP('streak','cg')+'<div class="hd"><button class="nb" data-act="editquit" data-q="'+q.id+'" aria-label="Edit '+esc(q.name)+'">'+esc(q.name)+'</button>'+(d>=best&&d>0?'<span class="badge">Best yet</span>':'')+'</div>'
     +'<div class="pc">'+d+'<small> '+(d===1?'day':'days')+'</small></div><div class="sub" style="margin-top:0">'+h+'h '+m+'m · since '+dmy(qDate(q))+' '+q.since.slice(11)+'</div>'
     +'<div class="tr"><i style="width:'+pct+'%"></i></div>'
     +'<div class="sub" style="margin-top:0">'+(next?'Next: '+dur(next)+' in '+(next-d)+(next-d===1?' day':' days'):'Every milestone reached')+(best>d?' · Best: '+best+' days':'')+'</div>'
     +(got.length?'<div class="miles">'+got.map(x=>'<span>'+dur(x)+'</span>').join('')+'</div>':'')
     +'</section>'}).join('')+'</div>';
}
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
    ['Your data stays here','Everything is saved on this device. Export a backup from settings, or choose a synced folder on desktop.']];
  return '<div class="ov" data-act="ovclose"><div class="mod tips" role="dialog" aria-modal="true" aria-label="Welcome to Daybook"><h2>Welcome to Daybook</h2><p class="sub" style="margin:0">A few things worth knowing:</p><ol class="tipl">'
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
     +'<div class="colors" role="group" aria-label="Colour">'+COLORS.map((c,i)=>'<button style="--c:'+c+'" class="'+(modal.color===c?'on':'')+'" data-act="mcolor" data-sw="habit" data-v="'+c+'" aria-pressed="'+(modal.color===c)+'" aria-label="Colour '+(i+1)+'"></button>').join('')+'</div>'+colorFields('habit',modal.color,'habit colour')
     +(modal.type==='daily'?'<label class="sub" style="margin:0" for="mPer">Days per week (7 = every day)</label><input class="field" type="number" inputmode="numeric" min="1" max="7" id="mPer" value="'+(modal.per||7)+'">':'')
     +'<div class="lbl" style="font-size:9px">How to track it</div><div class="seg trk">'+[['check','Done or not'],['count','Count'],['amount','Amount']].map(x=>'<button class="'+(modal.track===x[0]?'on':'')+'" data-act="mtrack" data-v="'+x[0]+'" aria-pressed="'+(modal.track===x[0])+'">'+x[1]+'</button>').join('')+'</div>'
     +(modal.track==='count'?'<label class="sub" style="margin:0" for="mTarget">Times per '+{daily:'day',weekly:'week',monthly:'month'}[modal.type]+', e.g. 8 glasses</label><input class="field" type="number" inputmode="numeric" min="2" max="99" id="mTarget" value="'+Math.max(2,modal.target||8)+'">':'')
     +(modal.track==='amount'?'<div class="amtcfg"><div><label class="sub" style="margin:0" for="mUnit">Unit</label><input class="field" id="mUnit" list="units" maxlength="12" placeholder="km, pages, hours…" value="'+esc(modal.unit||'')+'"><datalist id="units">'+['km','miles','hours','minutes','pages','steps','glasses','reps','€'].map(u=>'<option value="'+u+'">').join('')+'</datalist></div>'
       +'<div><label class="sub" style="margin:0" for="mGoal">Goal per '+{daily:'day',weekly:'week',monthly:'month'}[modal.type]+' (optional)</label><input class="field" id="mGoal" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 5" value="'+(modal.goal||'')+'"></div></div>':'')
     +(modal.id&&modal.type==='daily'&&feat('freeze')&&modal.fz?'<div class="lbl" style="font-size:9px">Streak freezes</div><div class="fzcfg"><label class="chk"><input type="checkbox" id="mFzOn"'+(modal.fz.off?'':' checked')+'> On</label>'
       +'<label class="sub">Earn one every <input class="field mini" type="number" inputmode="numeric" min="3" max="30" id="mFzE" value="'+modal.fz.every+'" aria-label="Days in a row to earn a freeze"> days</label><label class="sub">Keep up to <input class="field mini" type="number" inputmode="numeric" min="1" max="5" id="mFzM" value="'+modal.fz.max+'" aria-label="Most freezes saved up"></label></div>':'')
     +remPicker('habit')
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button>'+(modal.id?'<button class="btn danger" data-act="mdel">'+(modal.confirm?'Tap again to delete':'Delete')+'</button>':'')+'<button class="btn" data-act="msave">'+(modal.id?'Save':'Add habit')+'</button></div></div></div>';
  }
  if(modal.kind==='ask')return '<div class="ov"><div class="mod" role="alertdialog" aria-modal="true" aria-label="Reminder">'+askHtml(modal.h,modal.k)+'</div></div>';
  if(modal.kind==='gval'){const g=S.goals.find(x=>x.id===modal.g);if(!g){modal=null;return ''}const num=gKind(g)==='num';
    return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="'+(num?'Add to goal':'Log value')+'"><h2>'+(num?'Add to goal':'Log the current value')+'</h2><p class="sub" style="margin:0">'+esc(g.title)+' · '+gLine(g)+'</p>'
     +'<div class="gfl"><label class="gdue"><span class="sub">'+(num?'Amount'+(g.unit?' ('+esc(g.unit)+')':'')+', minus to take out':'Value'+(g.unit?' ('+esc(g.unit)+')':''))+'</span><input class="field" id="gvAmt" type="number" inputmode="decimal" step="any" aria-label="Amount"></label>'
     +'<label class="gdue"><span class="sub">Date</span><input class="field" type="date" id="gvDate" value="'+dk(TODAY)+'" aria-label="Date"></label></div>'
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="gvalsave">'+(num?'Add':'Save')+'</button></div></div></div>'}
  if(modal.kind==='area')return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="'+(modal.old?'Edit area':'New area')+'"><h2>'+(modal.old?'Edit area':'New life area')+'</h2>'
     +'<input class="field" id="arName" maxlength="24" placeholder="e.g. Faith, Pets, Side business" value="'+esc(modal.name||'')+'" aria-label="Area name">'
     +'<div class="colors" role="group" aria-label="Colour">'+COLORS.map((c,i)=>'<button style="--c:'+c+'" class="'+(modal.color===c?'on':'')+'" data-act="arcolor" data-v="'+c+'" aria-pressed="'+(modal.color===c)+'" aria-label="Colour '+(i+1)+'"></button>').join('')+'</div>'
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button>'+(modal.old?'<button class="btn danger" data-act="areadel">'+(modal.confirm?'Tap again to delete':'Delete')+'</button>':'')+'<button class="btn" data-act="areasave">'+(modal.old?'Save':'Add area')+'</button></div></div></div>';
  if(modal.kind==='impin')return '<div class="ov" data-act="ovclose"><div class="mod" role="dialog" aria-modal="true" aria-label="Encrypted backup"><h2>Encrypted backup</h2><p class="sub" style="margin:0">Enter the PIN that was set when this backup was made. Restoring replaces the data on this device.</p>'
     +'<input class="field" id="impPin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN" aria-label="PIN">'
     +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button><button class="btn" data-act="impok">Restore</button></div></div></div>';
  if(modal.kind==='afold')return '<div class="ov"><div class="mod" role="dialog" aria-modal="true" aria-label="Data folder"><h2>There’s already a Daybook save here</h2><p class="sub" style="margin:0">Replace it with the data on this phone, or load the save from the folder? Loading overwrites what’s on this phone.</p>'
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
     +'<p class="sub" style="margin:0;font-size:12px;line-height:1.5">In Google Calendar on a computer: Settings, pick your calendar under “Settings for my calendars”, then copy <b>Secret address in iCal format</b> and paste it here. Daybook adds events from the last 30 days and next 90 days to your tasks and refreshes every 15 minutes. Keep this address private.</p>'
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
  if(k==='steps')body='<div class="gsteps">'+st.map((x,i)=>'<div class="gstep'+(x.done?' done':'')+'"><button class="cb '+(x.done?'on':'')+'" data-act="gstep" data-i="'+i+'" aria-pressed="'+x.done+'" aria-label="'+esc(x.text)+'">'+(x.done?CHECK:'')+'</button><span>'+esc(x.text)+(x.due?'<small>'+dmy(new Date(x.due+'T00:00'))+'</small>':'')+'</span><button class="x" data-act="gstepdel" data-i="'+i+'" aria-label="Remove step">&times;</button></div>').join('')
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
   +'<div class="row"><button class="btn ghost" data-act="modalclose">Cancel</button>'+(modal.id?'<button class="btn ghost" data-act="garch" data-g="'+modal.id+'">'+(modal.arch?'Restore':'Archive')+'</button><button class="btn danger" data-act="gdel" data-g="'+modal.id+'">'+(confirmGoal===modal.id?'Tap again to delete':'Delete')+'</button>':'')+'<button class="btn" data-act="gsave">'+(modal.id?'Save':'Add goal')+'</button></div></div></div>';
}

/* ---------- render ---------- */
let focusSel=null;
let lastView=null;
function render(){
  fzCache=new Map();
  const keep=['.gcard','.wscroll','.days','.dd'].map(q=>{const el=$(q);return el?[q,el.scrollLeft,el.scrollTop]:null}).filter(Boolean),sy=window.scrollY;
  const vi=VIEWS.find(v=>v[0]===view)||(view==='settings'?['settings','Settings','gear']:ASK?['ask','Reminder','home']:['widget','Widget','home']);
  $('#nav').innerHTML=views().map(v=>'<a href="#'+v[0]+'" aria-label="'+v[1]+'" title="'+v[1]+'" class="'+(v[0]===view?'on':'')+'"'+(v[0]===view?' aria-current="page"':'')+'>'+ic(v[2])+'<span>'+v[1]+'</span></a>').join('').replace('<a href="#goals"','<button class="navq" data-act="quick" aria-label="Quick add" title="Quick add">'+ic('plus')+'</button><a href="#goals"'); // quick add sits in the middle, between Tasks and Goals
  $('#ttl').textContent=view==='tasks'?'Task Tracker':vi[1];
  $('#gearBtn').innerHTML=ic('gear');$('#gearBtn').classList.toggle('on',view==='settings');$('#gearBtn').setAttribute('aria-current',view==='settings'?'page':'false');$('#searchBtn').innerHTML=ic('search');
  document.title=vi[1]+' | Daybook';
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
  $('#modal').innerHTML=vModal();['#modal','#menu','#nav','#ttl'].forEach(q=>trDom($(q)));document.title=tx(vi[1])+' | Daybook';
  keep.forEach(k=>{const el=$(k[0]);if(el){el.scrollLeft=k[1];el.scrollTop=k[2]}});
  if(lastView===view&&sy>0)window.scrollTo(0,sy);
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
function notify(title,body){try{if('Notification' in window&&Notification.permission==='granted')new Notification(title,{body,tag:'daybook-'+title})}catch(e){}}
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
function lockHtml(){return '<div class="lockbox" role="dialog" aria-modal="true" aria-label="Daybook is locked"><div class="lic">'+ic('lock')+'</div><h2>Daybook is locked</h2>'
  +'<input id="pinIn" class="field" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="Enter your PIN" aria-label="PIN">'
  +'<button class="btn" data-act="unlock">Unlock</button>'+(P.bio&&NB&&NB.bioUnlock?'<button class="btn ghost" data-act="bio">'+ic('finger')+' Use fingerprint</button>':'')+'<p class="sub" id="pinMsg" role="alert" style="margin:0;min-height:16px"></p>'
  +'<button class="link" data-act="pinforgot">'+(lockForgot?'Tap again: remove the PIN and erase the data on this device':'Forgot your PIN?')+'</button></div>'}
// checks the PIN; with encryption it also makes the key and opens the saved data. A PIN from before encryption is upgraded here
async function openWithPin(pin){
  const raw=localStorage.getItem(KEY);
  if(P.lock&&P.lock.hash&&!P.lock.enc){if(await pinHash(pin,P.lock.salt)!==P.lock.hash)return false;
    encKey=await deriveKey(pin,P.lock.salt);P.lock={salt:P.lock.salt,enc:1,check:await encText('daybook',encKey,P.lock.salt)};applyPrefs();save();if(dataDir){fileJson=null;writeFile()}return true}
  const salt=P.lock&&P.lock.salt||encSalt(raw);if(!salt)return false;
  try{const key=await deriveKey(pin,salt);
    if(P.lock&&P.lock.check)await decText(P.lock.check,key);
    if(isEnc(raw)){const j=await decText(raw,key);if(encWait){S=clean(JSON.parse(j));encWait=false}}
    encWait=false;encKey=key;if(!P.lock||!P.lock.enc){P.lock={salt,enc:1,check:await encText('daybook',key,salt)};applyPrefs()}return true}catch(e){return false}}
function unlocked(pin){locked=false;lockTries=0;lockForgot=false;if(dataDir)readFile();andRead();autoBackup();takeAnswers().then(syncReminders);pushWidget();render();
  if(bioOk&&!P.bio&&!P.bioNo&&pin){bioPin=pin;toastAct('Unlock with your fingerprint next time?','Turn on','bioon')}}
// fingerprint / face unlock (Android): the PIN is kept encrypted by a key only the fingerprint can open
let bioOk=false,bioPin='';if(NB&&NB.bioAvailable&&!WIDGET)NB.bioAvailable().then(r=>{bioOk=!!r.ok;if(P.bio&&!r.on){P.bio=false;applyPrefs()}if(locked&&P.bio&&bioOk)bioTry()}).catch(()=>{});
async function bioTry(){const r=await NB.bioUnlock({title:tx('Unlock Daybook')});if(r&&r.ok&&await openWithPin(r.pin)){unlocked('');return}
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
function lockNow(share){if(!P.lock||locked)return;locked=true;modal=null;menuOpen=false;render();if(share)try{localStorage.setItem('daybook-locked',String(Date.now()))}catch(e){}}
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
    case 'demo':
      if(hasData()&&!confirmDemo){confirmDemo=true;persist=false;break}
      S=seed();confirmDemo=false;menuOpen=false;toast('Demo data loaded');if(view==='settings'){save();location.hash=setBack;return}break;
    case 'pickdir':persist=false;menuOpen=false;DFS.choose().then(res=>{if(!res)return;dataDir=res.folder;fileText=null;
      if(res.mode==='load'&&readFile()){render();toast('Loaded the save from that folder')}else{writeFile();render();toast('Daybook now saves to that folder')}});break;
    case 'resetdir':DFS.reset();dataDir='';fileText=null;persist=false;toast('Saving to app storage only');break;
    case 'calexport':menuOpen=false;persist=false;shareFile(tasksToIcs(),'daybook-tasks-'+dk(TODAY)+'.ics','text/calendar','Daybook tasks','Calendar file downloaded. Import it in Google Calendar: Settings, Import & export');break;
    case 'calset':menuOpen=false;persist=false;modal={kind:'cal',url:''};focusSel='#calUrl';break;
    case 'calsave':{const u=($('#calUrl').value||'').trim().replace(/^webcal:/i,'https:');
      if(!/^https:\/\/\S+$/i.test(u)){$('#calUrl').focus();toast('Paste the calendar’s secret iCal address (starts with https://)');return}
      P.cal=u;applyPrefs();modal=null;persist=false;pullCalendar(true);break}
    case 'calsync':menuOpen=false;persist=false;pullCalendar(true);break;
    case 'caloff':{P.cal='';P.calAt=0;applyPrefs();Object.keys(S.tasks).forEach(k=>{S.tasks[k].items=S.tasks[k].items.filter(it=>!it.cal)});toast('Calendar sync stopped');break}
    case 'csv':menuOpen=false;persist=false;shareFile(toCsv(),'daybook-'+dk(TODAY)+'.csv','text/csv','Daybook spreadsheet','Spreadsheet downloaded');break;
    case 'export':menuOpen=false;persist=false;exportData();break;
    case 'import':menuOpen=false;persist=false;$('#impFile').click();break;
    case 'fresh':
      if(confirmReset){S=empty();P.cal='';P.calAt=0;applyPrefs();confirmReset=false;menuOpen=false;toast('Everything erased');if(view==='settings'){save();location.hash=setBack;return}}else{confirmReset=true;persist=false}break;
    case 'goto':location.hash=t.dataset.v;persist=false;return;
    case 'mprev':{const d=new Date(vy,vm-1,1);vy=d.getFullYear();vm=d.getMonth();persist=false;break}
    case 'mnext':{const d=new Date(vy,vm+1,1);vy=d.getFullYear();vm=d.getMonth();persist=false;break}
    case 'tab':tab=t.dataset.v;persist=false;break;
    case 'cell':{const h=findH(t.dataset.h);if(isAmt(h)){openAmt(h,t.dataset.d);persist=false;break}tap(h,t.dataset.d);break}
    case 'wcell':{const h=findH(t.dataset.h),l=L(h),y=view==='today'?TODAY.getFullYear():vy,m=view==='today'?TODAY.getMonth():vm,k=wkey(y,m,t.dataset.w);if(isAmt(h)){openAmt(h,k);persist=false;break}tap(h,k);break}
    case 'mcell':{const h=findH(t.dataset.h),l=L(h),y=view==='today'?TODAY.getFullYear():vy,m=view==='today'?TODAY.getMonth():vm,k=mkey(y,m);if(isAmt(h)){openAmt(h,k);persist=false;break}tap(h,k);break}
    case 'edithabit':{const h=findH(t.dataset.h);if(!h)break;modal={kind:'habit',id:h.id,type:h.type,origType:h.type,color:/^#[0-9a-f]{6}$/.test(h.color)?h.color:COLORS[0],name:h.name,target:h.target||1,per:h.per||7,track:h.track||((h.target||1)>1?'count':'check'),unit:h.unit||'',goal:h.goal||0,rem:h.rem?h.rem.m:'',remT:h.rem?h.rem.t:'09:00',fz:Object.assign({off:false,every:7,max:3},h.fz||{}),confirm:false};focusSel='#mName';persist=false;break}
    case 'mdel':
      if(modal&&modal.id){if(modal.confirm){const i=S.habits.findIndex(h=>h.id===modal.id),h=S.habits[i],bk={log:S.log[h.id],count:S.count[h.id],notes:S.notes[h.id],amt:S.amt[h.id]};
        pushUndo(()=>{putBack(S.habits,i,h);Object.keys(bk).forEach(x=>{if(bk[x])S[x][h.id]=bk[x]})});S.habits=S.habits.filter(h=>h.id!==modal.id);delete S.log[modal.id];delete S.count[modal.id];delete S.notes[modal.id];modal=null;toastUndo('Habit deleted')}else{modal.confirm=true;persist=false}}break;
    case 'newhabit':modal={kind:'habit',type:view==='habits'?tab:'daily',color:COLORS[0],name:'',target:1,per:7,track:'check',unit:'',goal:0,rem:'',remT:'09:00'};focusSel='#mName';persist=false;break;
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
    case 'testnote':persist=false;if(LN){LN.requestPermissions().then(()=>LN.schedule({notifications:[{id:9,title:'Daybook',body:tx('Notifications work'),schedule:{at:new Date(Date.now()+1500)}}]})).then(()=>toast('Test notification sent')).catch(()=>toast('Notifications are blocked. Allow them in Android settings'))}
      else if('Notification' in window)Notification.requestPermission().then(x=>{if(x==='granted'){new Notification('Daybook',{body:tx('Notifications work')});toast('Test notification sent')}else toast('Notifications are blocked. Allow them in your system settings')});else toast('Reminders aren’t supported here yet');break;
    case 'quick':modal={kind:'quick'};focusSel='#qTask';persist=false;break;
    case 'qtask':{const v=($('#qTask').value||'').trim();if(!v){$('#qTask').focus();persist=false;return}const k=dk(TODAY);(S.tasks[k]=S.tasks[k]||{items:[],mind:null}).items.push({id:uid(),text:v.slice(0,100),done:false});
      $('#qTask').value='';focusSel='#qTask';toast('Task added for today');break}
    case 'qhabit':{const h=findH(t.dataset.h);if(h){L(h)[dk(TODAY)]=1;if(S.count[h.id])delete S.count[h.id][dk(TODAY)];toast(h.name+' done')}break}
    case 'qgoal':{const g=S.goals.find(x=>x.id===$('#qGoal').value),v=parseFloat(($('#qAmt').value||'').replace(',','.'));if(!g||!Number.isFinite(v)){$('#qAmt').focus();persist=false;return}
      (g.log=g.log||[]).push({d:dk(TODAY),v});g.pct=gPct(g);toast('Added '+fmtU(v,g.unit)+' to '+g.title);$('#qAmt').value='';break}
    case 'impok':{persist=false;const pin=$('#impPin').value,txt=modal.text;deriveKey(pin,encSalt(txt)).then(k=>decText(txt,k)).then(j=>{modal=null;applyImport(JSON.parse(j))}).catch(()=>{toast('Wrong PIN, or not a Daybook backup');const e=$('#impPin');if(e){e.value='';e.focus()}});return}
    case 'baknow':persist=false;menuOpen=false;autoBackup(true);break;
    case 'bakopen':persist=false;if(DFS&&DFS.openBackups)DFS.openBackups();break;
    case 'apick':persist=false;menuOpen=false;NB.pickFolder().then(async r=>{if(!r||!r.picked)return;P.andDir=r.name;applyPrefs();
      let ex=null;try{ex=(await NB.readFolder()).text}catch(e){}
      if(ex&&ex!==fileText){modal={kind:'afold',text:ex};render()}else{andText=null;andWrite();render();toast('Daybook now saves to '+r.name)}}).catch(e=>toast(e&&e.message||'That folder can’t be used'));break;
    case 'afoldkeep':modal=null;andText=null;andWrite();toast('Daybook now saves to '+P.andDir);break;
    case 'afoldload':if(!modal.confirm){modal.confirm=true;persist=false;break}{const t=modal.text;modal=null;persist=false;andApply(t,true)}break;
    case 'afoldno':modal=null;persist=false;NB.clearFolder();P.andDir='';applyPrefs();break;
    case 'aclear':persist=false;NB.clearFolder();P.andDir='';applyPrefs();toast('Saving on this phone only');break;
    case 'exactok':persist=false;$('#toast').hidden=true;if(NB&&NB.openExactSettings)NB.openExactSettings();break;
    case 'askyes':alarmStop();remYes(t.dataset.h,t.dataset.k);if(ASK){window.close();return}modal=null;break;
    case 'askno':alarmStop();if(ASK){window.close();return}modal=null;persist=false;break;
    case 'mtrack':{const g=x=>{const e=$(x);return e?e.value:null};if(g('#mUnit')!==null)modal.unit=g('#mUnit');if(g('#mGoal')!==null)modal.goal=g('#mGoal');if(g('#mTarget')!==null)modal.target=g('#mTarget');modal.track=t.dataset.v;persist=false;break}
    case 'mrem':modal.rem=t.dataset.v;persist=false;break;
    case 'mcolor':setColor('habit',t.dataset.v);persist=false;break;
    case 'trem':{const it=findT(t.dataset.i,t.dataset.k);if(!it)break;modal={kind:'trem',k:t.dataset.k,i:it.id,rem:it.rem?it.rem.m:'',remT:it.rem?it.rem.t:'09:00'};addingTask=null;persist=false;break}
    case 'tremsave':{const it=findT(modal.i,modal.k);if(!it){modal=null;break}const rt=($('#mRemT')||{}).value||modal.remT;
      it.rem=modal.rem&&/^([01]\d|2[0-3]):[0-5]\d$/.test(rt)?{t:rt,m:modal.rem}:undefined;if(!it.rem)delete it.rem;else{remAsk();remSkip(it.id,modal.k,it.rem)}modal=null;break}
    case 'modalclose':case 'ovclose':if(modal&&modal.kind==='tips')try{localStorage.setItem('daybook-tips','1')}catch(e){}modal=null;persist=false;break;
    case 'msave':{
      const nm=($('#mName').value||'').trim();if(!nm){$('#mName').focus();return}
      const tg=modal.track==='count'&&$('#mTarget')?clamp(Math.round(+$('#mTarget').value)||2,2,99):1,tr=modal.track,un=tr==='amount'?(($('#mUnit')||{}).value||'').replace(/[<>"'&`=]/g,'').trim().slice(0,12):'',gl=tr==='amount'?Math.max(0,+(($('#mGoal')||{}).value)||0):0,per=modal.type==='daily'&&$('#mPer')?clamp(Math.round(+$('#mPer').value)||7,1,7):7,rt=($('#mRemT')||{}).value||modal.remT,rem=modal.rem&&/^([01]\d|2[0-3]):[0-5]\d$/.test(rt)?{t:rt,m:modal.rem}:null;
      if(rem)remAsk();
      if(modal.fz&&$('#mFzE')){modal.fz={off:!$('#mFzOn').checked,every:clamp(Math.round(+$('#mFzE').value)||7,3,30),max:clamp(Math.round(+$('#mFzM').value)||3,1,5)}}
      if(modal.id){const h=findH(modal.id);if(h){h.name=nm;h.color=modal.color;h.target=tg;h.per=per;h.track=tr;h.unit=un;h.goal=gl;if(JSON.stringify(h.rem||null)!==JSON.stringify(rem))remSkipToday(h.id,rem);h.rem=rem;if(modal.fz){const f=modal.fz;h.fz=f.off||f.every!==7||f.max!==3?{off:!!f.off,every:f.every,max:f.max}:null;if(!h.fz)delete h.fz}if(h.type!==modal.type){h.type=modal.type;if(view==='habits')tab=h.type}const c=S.count[h.id]||{};Object.keys(c).forEach(k=>{if(c[k]>=tg||tg<2){if(c[k]>=tg)L(h)[k]=1;delete c[k]}})}modal=null;break}
      const id=uid();S.habits.push({id,name:nm,type:modal.type,color:modal.color,target:tg,per,track:tr,unit:un,goal:gl,rem});remSkipToday(id,rem);S.log[id]={};
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
      deriveKey(a,salt).then(async key=>{encKey=key;P.lock={salt,enc:1,check:await encText('daybook',key,salt)};applyPrefs();save();if(bioOk&&!P.bioNo){bioPin=a;setTimeout(()=>toastAct('Unlock with your fingerprint too?','Turn on','bioon'),1800)}if(dataDir){fileJson=null;writeFile()}modal=null;toast('PIN set. Your data is now encrypted');render()});return}
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
      if(dataDir&&DFS){DFS.reset();dataDir=''}S=empty();P.lock=null;encKey=null;encWait=false;applyPrefs();locked=false;lockForgot=false;save();toast('PIN removed and data on this device erased');break;
    case 'widget':menuOpen=false;persist=false;if(DFS&&DFS.widget)DFS.widget();break;
    case 'wmain':persist=false;if(DFS&&DFS.showMain)DFS.showMain();break;
    case 'featfold':featOpen=!featOpen;persist=false;break;
    case 'tipsok':modal=null;persist=false;try{localStorage.setItem('daybook-tips','1')}catch(e){}break;
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
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!isField(e.target)&&!locked&&undos.length){e.preventDefault();undoLast();save();render();toast(undos.length?'Restored. '+undos.length+' more to undo':'Restored');return}
  if(e.target.id==='aVal'&&e.key==='Enter'){e.preventDefault();const b=$('[data-act=amtsave]');if(b)b.click();return}
  if(e.target.id==='pinIn'&&e.key==='Enter'){e.preventDefault();tryUnlock();return}
  if(e.target.id==='taskInput'){
    if(e.key==='Enter'){
      e.preventDefault();const v=e.target.value.trim(),k=e.target.dataset.k;
      if(v)addTask(k);
    }else if(e.key==='Escape'){addingTask=null;addingText='';repSel={rep:'',until:'m',open:''};render()}
  }
  if(e.target.dataset&&(e.target.dataset.et||e.target.dataset.eg)&&(e.key==='Enter'||e.key==='Escape')){e.preventDefault();e.target.blur();return}
  if(modal&&e.key==='Escape'){if(modal.kind==='tips')try{localStorage.setItem('daybook-tips','1')}catch(_){}modal=null;render()}
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
    if(k==='pick')v=t.value.toLowerCase();
    else if(k==='hex'){v=t.value.trim().toLowerCase().replace(/^#?/,'#');if(/^#[0-9a-f]{3}$/.test(v))v='#'+[...v.slice(1)].map(c=>c+c).join('');if(!/^#[0-9a-f]{6}$/.test(v))v=null}
    else v=rgbHex([0,1,2].map(i=>{const e=$('[data-cf="'+f+'"][data-k="'+i+'"]');return Math.max(0,Math.min(255,Math.round(+e.value)||0))}));
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
    const r=new FileReader();
    r.onload=()=>{try{
      if(isEnc(r.result)){modal={kind:'impin',text:r.result};focusSel='#impPin';render();return}
      applyImport(JSON.parse(r.result));
    }catch(err){toast('That file is not a Daybook backup')}};
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
window.addEventListener('hashchange',()=>{
  const v=(location.hash||'#habits').slice(1),was=view,ws=setSec;
  if(!WIDGET&&routeTo(v)){menuOpen=false;insMenu=null;addingTask=null;modal=null;if(view==='settings'&&was!=='settings'){setBack=was;setQ=''}render();
    if(view==='settings'&&was==='settings'&&setSec&&wideSet()){const e=$('#set-'+setSec);if(e)e.scrollIntoView({block:'start',behavior:'smooth'})}else window.scrollTo(0,0)}
});
async function shareFile(text,name,type,title,done){
  if(NB&&NB.saveFile){try{const r=await NB.saveFile({name,type,text});if(r&&r.saved)toast('Saved '+name)}catch(e){toast('Export failed')}return} // Android: pick where to save
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
async function exportData(){const t=await backupText();shareFile(t,'daybook-backup-'+dk(TODAY)+(isEnc(t)?'-encrypted':'')+'.json','application/json','Daybook backup',isEnc(t)?'Encrypted backup downloaded. Importing it asks for your PIN':'Backup downloaded')}
// weekly automatic backup: desktop to <data folder or app data>/backups, Android to the chosen folder's backups or app storage; newest 8 kept
async function autoBackup(force){
  if(encWait||locked&&!encKey||WIDGET||!hasData())return;const can=DFS&&DFS.backup||NB&&NB.backup;if(!can)return;
  const every=P.bakEvery===undefined?7:P.bakEvery;if(!force&&(!every||Date.now()-(P.bakAt||0)<every*864e5))return;
  try{const t=await backupText(),name='daybook-backup-'+dk(TODAY)+'.json',where=DFS&&DFS.backup?await DFS.backup(name,t):(await NB.backup({name,text:t})).where;
    if(where){P.bakAt=Date.now();P.bakWhere=String(where).slice(0,300);applyPrefs();if(force)toast('Backup saved')}else if(force)toast('Backup failed')}catch(e){if(force)toast('Backup failed')}}
function applyImport(d){if(!d||!Array.isArray(d.habits))throw new Error('bad');S=clean(d);save();if(view==='settings')location.hash=setBack;render();toast('Backup restored')}

/* ---------- Google Calendar (no login) ----------
   In: the desktop app reads a calendar's "secret address in iCal format" and mirrors its events into tasks.
   Out: tasks export as an .ics file the user imports in Google Calendar (same UIDs, so re-importing updates). */
const icsEsc=t=>String(t).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
const icsUnesc=t=>t.replace(/\\n/gi,' ').replace(/\\([,;\\])/g,'$1');
function tasksToIcs(){
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Daybook//Tasks//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:Daybook tasks'],stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  Object.keys(S.tasks).sort().forEach(k=>S.tasks[k].items.forEach(it=>{if(it.cal||!it.text.trim())return; // calendar events stay in the calendar
    const d=k.replace(/-/g,''),n=dk(addDays(new Date(k+'T00:00'),1)).replace(/-/g,'');
    L.push('BEGIN:VEVENT','UID:'+it.id+'@daybook','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+d,'DTEND;VALUE=DATE:'+n,'SUMMARY:'+icsEsc((it.done?'[done] ':'')+it.text),'TRANSP:TRANSPARENT','END:VEVENT')}));
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
  if(e.key==='daybook-locked'){lockNow(false);return}
  if(e.key===PKEY&&e.newValue){try{const was=P.lock&&P.lock.salt;Object.assign(P,JSON.parse(e.newValue));if(P.lock&&P.lock.salt!==was){locked=true;encKey=null}if(!P.lock){P.lock=null;encKey=null}const d=document.documentElement;d.style.setProperty('--accent',P.accent);d.classList.toggle('light',P.theme==='light');d.classList.toggle('amoled',P.theme==='amoled');if(!modal&&!drag)render()}catch(_){}}
});
window.DaybookTest={parseIcs,applyCalendar,tasksToIcs,state:()=>S,remCheck:()=>checkHabitReminders(),remSync:()=>syncReminders(),remTake:()=>takeAnswers()}; // smoke tests only
pullCalendar();let calTick=0;
// daily reminder: a notification at the chosen time if daily habits are still open (only while Daybook is running)
// Android app: a real daily notification scheduled with Capacitor Local Notifications (works when the app is closed)
const LN=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.LocalNotifications;
async function syncNativeReminder(){
  if(!LN)return;
  try{
    await LN.cancel({notifications:[{id:1}]}).catch(()=>{});
    if(!feat('reminder'))return;
    const pr=await LN.requestPermissions();if(pr.display!=='granted'){toast('Notifications are blocked. Allow them in Android settings');return}
    const [hour,minute]=(P.remTime||'21:00').split(':').map(Number);
    await LN.schedule({notifications:[{id:1,title:'Daybook',body:'Time to check in on today’s habits.',schedule:{on:{hour,minute},allowWhileIdle:true}}]});
  }catch(e){toast('Could not set the reminder')}
}
function checkReminder(){
  if(LN)return; // the Android app uses the scheduled notification instead
  if(!feat('reminder')||!('Notification' in window)||Notification.permission!=='granted')return;
  const n=new Date(),[hh,mm]=(P.remTime||'21:00').split(':').map(Number),k=dk(TODAY);
  if(P.remDay===k||n.getHours()*60+n.getMinutes()<hh*60+mm)return;
  P.remDay=k;applyPrefs();const t=doneToday();
  if(t.total&&t.done<t.total)try{new Notification('Daybook',{body:(t.total-t.done)+' of '+t.total+' habits still to do today. You’ve got this.',tag:'daybook-reminder'})}catch(e){}
}
/* per-habit reminders: h.rem={t:'HH:MM', m:'ask'|'alarm'}. Android schedules real notifications with Yes/No buttons;
   desktop opens a small always-on-top pop-up, the web app shows a notification and an in-app question (only while running) */
const pKey=(h,d)=>h.type==='daily'?dk(d):h.type==='weekly'?wkey(d.getFullYear(),d.getMonth(),Math.ceil(d.getDate()/7)):mkey(d.getFullYear(),d.getMonth());
// notifications can hide what they are about (Settings > Features); the lock screen on Android always gets a plain version
const remTitle=(name,what)=>feat('remnames')?name:'Daybook',remBody=(q,what)=>tx(feat('remnames')?q:'A '+what+' reminder is waiting for your answer');
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
  S.habits.forEach(h=>{if(!h.rem)return;const [hh,mm]=h.rem.t.split(':').map(Number),k=pKey(h,TODAY);
    if((P.remFired||{})[h.id]===d||now<hh*60+mm)return;P.remFired=Object.assign({},P.remFired,{[h.id]:d});applyPrefs();if(L(h)[k])return;
    if(DFS&&DFS.ask){DFS.ask(h.id,k);return}
    try{if('Notification' in window&&Notification.permission==='granted'){const x=new Notification(remTitle(h.name),{body:remBody('Have you done it '+perWord(h)+'?','habit'),tag:'daybook-h-'+h.id,requireInteraction:true,silent:h.rem.m!=='alarm'});x.onclick=()=>{window.focus();x.close()}}}catch(e){}
    if(!modal&&!locked){modal={kind:'ask',h:h.id,k};render()}if(h.rem.m==='alarm')alarmStart()});
  goalDue().forEach(([g,key,at,txt])=>{if(dk(at)!==d||n<at||(P.remFired||{})[key]===d)return;P.remFired=Object.assign({},P.remFired,{[key]:d});applyPrefs();
    try{if('Notification' in window&&Notification.permission==='granted')new Notification('Daybook',{body:feat('remnames')?txt:'A goal deadline is coming up',tag:'daybook-'+key})}catch(e){}toast(txt)});
  ((S.tasks[d]||{}).items||[]).forEach(it=>{if(!it.rem||it.done||it.hidden||it.cal)return;const [hh,mm]=it.rem.t.split(':').map(Number);
    if((P.remFired||{})[it.id]===d||now<hh*60+mm)return;P.remFired=Object.assign({},P.remFired,{[it.id]:d});applyPrefs();
    if(DFS&&DFS.ask){DFS.ask(it.id,d);return}
    try{if('Notification' in window&&Notification.permission==='granted'){const x=new Notification(remTitle(it.text),{body:remBody('Have you done it?','task'),tag:'daybook-t-'+it.id,requireInteraction:true,silent:it.rem.m!=='alarm'});x.onclick=()=>{window.focus();x.close()}}}catch(e){}
    if(!modal&&!locked){modal={kind:'ask',h:it.id,k:d};render()}if(it.rem.m==='alarm')alarmStart()})}
if(ASK){const h=findH(ASK.h),t=findT(ASK.h,ASK.k);if(h&&h.rem&&h.rem.m==='alarm'&&!L(h)[ASK.k]||t&&t.rem&&t.rem.m==='alarm'&&!t.done)alarmStart()}
// Android: the DaybookNative plugin posts the notifications; Yes/No are stored natively and applied here when the app runs
async function takeAnswers(){
  if(!NB||encWait)return;try{const r=await NB.takeAnswers();(r.answers||[]).forEach(a=>{if(a.a==='yes')remYes(a.h,a.k)})}catch(e){}
}
async function syncReminders(){
  if(!NB||WIDGET||encWait)return;
  try{
    const hs=S.habits.filter(h=>h.rem),now0=new Date(),end=addDays(now0,14),ts=[];
    Object.keys(S.tasks).forEach(k=>{const d=new Date(k+'T00:00');if(d<sod(now0)||d>end)return;S.tasks[k].items.forEach(it=>{if(it.rem&&!it.done&&!it.hidden&&!it.cal)ts.push([k,it])})});
    if((hs.length||ts.length||S.goals.some(g=>g.due))&&LN){const pr=await LN.checkPermissions();if(pr.display!=='granted'&&(await LN.requestPermissions()).display!=='granted'){toast('Notifications are blocked. Allow them in Android settings');return}}
    // shortcut: schedules the next 14 days and reschedules on every change and app open; a phone left untouched for 2 weeks stops reminding
    const now=new Date(),items=[];
    hs.slice(0,25).forEach((h,i)=>{const [hh,mm]=h.rem.t.split(':').map(Number);
      for(let d=0;d<14;d++){const at=new Date(now.getFullYear(),now.getMonth(),now.getDate()+d,hh,mm),k=pKey(h,at);if(at<=now||L(h)[k])continue;
        items.push({id:1000+i*20+d,at:at.getTime(),title:remTitle(h.name),body:remBody('Have you done it '+perWord(h)+'?','habit'),h:h.id,k,alarm:h.rem.m==='alarm',rep:h.type,yes:tx('Yes, done'),no:tx('No')})}});
    ts.slice(0,200).forEach(([k,it],n)=>{const [hh,mm]=it.rem.t.split(':').map(Number),at=new Date(k+'T00:00');at.setHours(hh,mm);if(at>now)items.push({id:2000+n,at:at.getTime(),title:remTitle(it.text),body:remBody('Have you done it?','task'),h:it.id,k,alarm:it.rem.m==='alarm',yes:tx('Yes, done'),no:tx('No')})});
    goalDue().forEach(([g,key,at,txt],n)=>{if(at>now&&at-now<60*864e5)items.push({id:4000+n,at:at.getTime(),title:'Daybook',body:tx(feat('remnames')?txt:'A goal deadline is coming up'),h:g.id,k:key,info:true})});
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
setInterval(()=>{refreshToday();checkReminder();checkHabitReminders();if(++calTick%15===0)pullCalendar();if(view==='achievements'&&!modal&&!menuOpen)render()},60000); // keep streak clocks ticking
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)&&!window.Capacitor&&!/Electron/.test(navigator.userAgent)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
if(!WIDGET&&!locked){try{if(!localStorage.getItem('daybook-tips'))modal={kind:'tips'}}catch(e){}} // first open: show the tips once
render();
})();
