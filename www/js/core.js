/* Groundwork Habits: Helpers, translations, state, PIN encryption, data folders, preferences, colour picker, routing.
   The js/ files are classic scripts loaded in order (index.html) and share one scope, like one big file. */
'use strict';
/* recent errors, kept on this device only, for "Copy diagnostics" in Settings > About (no user data, just messages and where) */
const ERRS=[];const logErr=(m,w)=>{ERRS.push(new Date().toISOString().slice(0,19)+' '+String(m).slice(0,200)+(w?' @ '+String(w).replace(/^.*\/(?=[^/]+$)/,'').slice(0,80):''));if(ERRS.length>20)ERRS.shift()};
window.addEventListener('error',e=>logErr(e.message,(e.filename||'')+':'+e.lineno));
window.addEventListener('unhandledrejection',e=>logErr('promise: '+((e.reason&&e.reason.message)||e.reason)));

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
   window.GROUNDWORK_I18N={t:{English:translation}, p:[[regex source, replacement]]}. After each render the visible text,
   placeholders and labels are swapped; user content (names, notes, task text) is never touched. */
const LANGS=[['en','English'],['pt','Português'],['es','Español'],['fr','Français'],['de','Deutsch'],['it','Italiano'],['nl','Nederlands'],['pl','Polski'],['ru','Русский'],['zh','中文'],['ja','日本語']];
const I18=window.GROUNDWORK_I18N||{t:{},p:[]},LANG=window.GROUNDWORK_LANG&&I18.lang===window.GROUNDWORK_LANG?window.GROUNDWORK_LANG:'en';
const I18P=(I18.p||[]).map(x=>[new RegExp(x[0]),x[1]]);
if(LANG!=='en'){const loc=LANG==='zh'?'zh-CN':LANG,f=(o,i)=>new Intl.DateTimeFormat(loc,o).format(i),cap=x=>x.charAt(0).toUpperCase()+x.slice(1);
  for(let i=0;i<7;i++)DAYS[i]=cap(f({weekday:'long'},new Date(2023,0,1+i)));
  for(let i=0;i<12;i++){MONTHS[i]=cap(f({month:'long'},new Date(2023,i,15)));MON3[i]=cap(f({month:'short'},new Date(2023,i,15)).replace('.',''))}}
function tx(s){if(LANG==='en'||!s)return s;const k=String(s).trim();if(!k)return s;const v=I18.t[k];if(v!==undefined)return String(s).replace(k,v);
  for(const [re,rep] of I18P)if(re.test(k))return String(s).replace(k,k.replace(re,(...m)=>rep.replace(/\$(\d)/g,(_,n)=>tx(m[+n])||'')));return s}
const NOTR='[contenteditable],textarea,input,select,.nm,.nb,.hnote,.gstep span,.tk span,.g2h h3,.lrow .top span,[data-nt]';
function trDom(root){if(LANG==='en'||!root)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){const p=n.parentElement;if(p&&p.closest(NOTR))continue;const v=tx(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v}
  root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(e=>['placeholder','aria-label','title'].forEach(a=>{const v=e.getAttribute(a);if(v){const t=tx(v);if(t!==v)e.setAttribute(a,t)}}))}
const uid=()=>'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const wkStart=d=>addDays(sod(d),-sod(d).getDay());
const dmy=d=>p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const ICON={
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
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
// the in-browser demo (GitHub Pages /demo/, or ?demo): example data under its own keys, never mixed with real data
const DEMO=/\/demo\/(index\.html)?$/.test(location.pathname)||/[?&]demo(=|&|$)/.test(location.search);
const KEY=DEMO?'groundwork-demo-v2':'groundwork-v2',APPV='1.7.3',RELEASES='https://github.com/English-Muffin/GroundworkHabits/releases/latest'; // APPV: bump with package.json
const COLORS=['#8b5cf6','#3b82f6','#f43f5e','#22c55e','#f59e0b','#ec4899'],CNAMED=[['Violet','#8b5cf6'],['Blue','#3b82f6'],['Red','#f43f5e'],['Green','#22c55e'],['Amber','#f59e0b'],['Pink','#ec4899'],['Teal','#14b8a6'],['Slate','#94a3b8']];
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
/* storage: localStorage (read synchronously at start) plus a copy in IndexedDB, which has far more room. If localStorage is full,
   saves still land in IndexedDB, and at start the newer of the two copies wins (idbCheck in boot.js) */
let idbDb=null,idbLate=null;
const idbOpen=()=>idbDb||(idbDb=new Promise((ok,no)=>{try{const r=indexedDB.open('groundwork',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}catch(e){no(e)}}));
const idbPut=(t,at)=>idbOpen().then(db=>db.transaction('kv','readwrite').objectStore('kv').put({t,at},KEY)).catch(()=>{});
const idbGet=()=>idbOpen().then(db=>new Promise(ok=>{const r=db.transaction('kv').objectStore('kv').get(KEY);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>ok(null)})).catch(()=>null);
function putData(t){const at=Date.now();let ok=true;try{localStorage.setItem(KEY,t);localStorage.setItem(KEY+'-at',String(at))}catch(e){ok=false}idbPut(t,at);
  if(!ok&&!putData.warned){putData.warned=1;toast('Browser storage is full, so your data is saved in the browser database instead')}}
function load(){try{const r=localStorage.getItem(KEY);if(isEnc(r)){encWait=true;return null}return r?JSON.parse(r):null}catch(e){return null}}
// encrypting is async: saves are chained so they land in order (desktop waits for them before closing)
function saveRaw(j,put){if(!encOn()){put(j);return}if(!encKey)return;const key=encKey,salt=P.lock.salt;save.p=(save.p||Promise.resolve()).then(()=>encText(j,key,salt)).then(put).catch(()=>{})}
/* Android data folder (a synced folder gives cloud sync): groundwork.json is written a moment after each save and read when the app comes back */
let andText=null;
function andWrite(){if(!NB||!P.andDir||encWait)return;clearTimeout(andWrite.t);andWrite.t=setTimeout(()=>saveRaw(JSON.stringify(S),t=>{if(t===andText)return;NB.writeFolder({text:t}).then(()=>{andText=t}).catch(()=>toast('Could not save to your data folder'))}),800)}
async function andApply(t,announce){try{const j=isEnc(t)?(encKey?await decText(t,encKey):null):t;if(j===null)return;const d=JSON.parse(j);if(!d||!Array.isArray(d.habits))return;
  S=clean(d);andText=t;saveRaw(JSON.stringify(S),putData);if(!modal&&!drag)render();if(announce)toast('Loaded the save from that folder')}catch(e){}}
async function andRead(){if(!NB||!P.andDir||encWait)return;try{const t=(await NB.readFolder()).text;if(t&&t!==andText)andApply(t)}catch(e){}}
// Android home-screen widget: today's daily habits (names only while there's no PIN)
function pushWidget(){if(!NB||!NB.widget||WIDGET||encWait)return;clearTimeout(pushWidget.t);pushWidget.t=setTimeout(()=>{const k=dk(TODAY);
  NB.widget({data:{locked:!!P.lock,lockedText:tx('Groundwork Habits is locked'),emptyText:tx('Add a daily habit in Groundwork Habits'),title:tx(DAYS[TODAY.getDay()]),
    allDone:tx('All done today'),items:P.lock?[]:byType('daily').filter(h=>L(h)[k]||!isRest(h,TODAY)).slice(0,6).map(h=>({h:h.id,k,name:h.name,done:!!L(h)[k]}))},
    tasks:{locked:!!P.lock,lockedText:tx('Groundwork Habits is locked'),emptyText:tx('No tasks today'),title:tx('Tasks today'),
    items:P.lock?[]:vis(((S.tasks[k]||{}).items)||[]).slice(0,6).map(t=>({h:t.id,k,name:t.text,done:!!t.done}))}}).catch(()=>{})},600)}
/* undo history for every change: the saved state before each change (a burst within 1.5 s, like typing, is one step), up to 30, plus redo */
let hist=[],redos=[],histJ=null,histT=0;
function snap(){const j=JSON.stringify(S);if(histJ!==null&&j!==histJ){if(Date.now()-histT>1500){hist.push(histJ);if(hist.length>30)hist.shift()}histT=Date.now();redos=[]}histJ=j}
function histStep(back){const from=back?hist:redos,to=back?redos:hist;if(!from.length||encWait)return false;to.push(JSON.stringify(S));S=clean(JSON.parse(from.pop()));histJ=JSON.stringify(S);histT=0;save();return true}
function save(){if(encWait)return;snap();andWrite();pushWidget();saveRaw(JSON.stringify(S),putData);clearTimeout(save.r);save.r=setTimeout(()=>syncReminders(),1500);if(dataDir){clearTimeout(save.t);save.t=setTimeout(writeFile,300)}}
/* desktop only: mirror data to <folder>/groundwork.json (a Drive/OneDrive/Dropbox folder gives cloud sync) */
const DFS=window.groundworkFS||null,NB=window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.GroundworkNative||null,calFetch=DFS&&DFS.fetchCal?DFS.fetchCal:NB?(u=>NB.fetchCal({url:u})):null;let dataDir=DFS?DFS.folder():'',fileText=null,fileJson=null;
function writeFile(){clearTimeout(save.t);save.t=0;if(!dataDir||encWait)return;const j=JSON.stringify(S);if(j===fileJson)return;
  saveRaw(j,t=>{if(DFS.write(t)){fileJson=j;fileText=t}else toast('Could not save to your data folder')})}
// the folder file wins over this device; an encrypted file is opened with the key once the PIN is in (async, renders itself)
function readFile(){const t=DFS.read();if(!t||t===fileText)return false;
  if(isEnc(t)){if(!encKey){if(!encOn())encWait=true;return false}
    decText(t,encKey).then(j=>{S=clean(JSON.parse(j));fileText=t;fileJson=j;putData(t);if(!modal&&!drag)render()}).catch(()=>toast('The save in your data folder uses a different PIN'));return false}
  try{S=clean(JSON.parse(t));fileText=t;fileJson=t;putData(t);return true}catch(e){return false}}
window.addEventListener('beforeunload',()=>{if(save.t)writeFile()});
if(DFS&&DFS.onFlush)DFS.onFlush(async()=>{if(save.t)writeFile();await save.p}); // desktop: finish encrypted saves before the window closes
const DATA_V=1; // bump and migrate in load-time block below when the saved shape changes
const TESTING=true; // release builds: false (tools/release_strip.js), which hides demo data and the test hook
const PKEY=DEMO?'groundwork-demo-prefs':'groundwork-prefs',ACCENTS=[['Moss','#9cc96b'],['Teal','#22d3be'],['Blue','#60a5fa'],['Violet','#a78bfa'],['Pink','#f472b6'],['Amber','#fbbf24'],['Green','#4ade80']];
let P={theme:'dark',accent:ACCENTS[0][1],feat:{},remTime:'21:00'};try{Object.assign(P,JSON.parse(localStorage.getItem(PKEY))||{})}catch(e){}
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const rgbHex=a=>'#'+a.map(v=>v.toString(16).padStart(2,'0')).join('');
const hexHsl=x=>{const [r,g,b]=hexRgb(x).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,sa=0;
  if(d){sa=d/(1-Math.abs(2*l-1));h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360}return [Math.round(h),Math.round(sa*100),Math.round(l*100)]};
const hslHex=(h,sa,l)=>{sa/=100;l/=100;const a=sa*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))};return rgbHex([0,8,4].map(n=>Math.round(f(n)*255)))};
// the app's own colour picker: preset swatches, then a custom swatch that opens hue / saturation / lightness sliders and a hex field (no system dialog)
let cpOpen={},cpHsl={};
// hue/saturation/lightness for picker f: the remembered values when they still give this colour, else read from the hex (keeping the old hue/saturation for greys, black and white)
function pickHsl(f,hex){const m=cpHsl[f];if(m&&hslHex(...m)===hex)return m;const v=hexHsl(hex);if(m&&(v[1]===0||v[2]===0||v[2]===100)){v[0]=m[0];if(v[2]===0||v[2]===100)v[1]=m[1]}return cpHsl[f]=v}
function colorPicker(f,hex,presets,lbl){const [h,sa,l]=pickHsl(f,hex),custom=!presets.some(p=>p[1]===hex);
  return '<div class="cpk" data-cpk="'+f+'" style="--h:'+h+';--s:'+sa+'%;--l:'+l+'%;--c:'+hex+'"><div class="cpsw" role="group" aria-label="'+lbl+'">'
   +presets.map(p=>'<button class="csw'+(p[1]===hex?' on':'')+'" style="--c:'+p[1]+'" data-act="cset" data-f="'+f+'" data-sw="'+f+'" data-v="'+p[1]+'" aria-pressed="'+(p[1]===hex)+'" aria-label="'+p[0]+'" title="'+p[0]+'"></button>').join('')
   +'<button class="csw cmore'+(custom?' on':'')+'" data-act="cpopen" data-f="'+f+'" aria-expanded="'+!!cpOpen[f]+'" aria-label="Custom colour" title="Custom colour"></button></div>'
   +(cpOpen[f]?'<div class="cpp"><div class="cpv"><span class="cprev" aria-hidden="true"></span><input class="ain chex" data-cf="'+f+'" data-k="hex" value="'+hex+'" maxlength="7" spellcheck="false" aria-label="Hex code"></div>'
   +[['h','Hue',360,h],['s','Saturation',100,sa],['l','Lightness',100,l]].map(x=>'<label class="cpr"><span>'+x[1]+'</span><input type="range" class="crng cr-'+x[0]+'" min="0" max="'+x[2]+'" value="'+x[3]+'" data-cf="'+f+'" data-k="'+x[0]+'" aria-label="'+x[1]+'"></label>').join('')+'</div>':'')+'</div>'}
const COLOR_SET={accent:h=>{P.accent=h;applyPrefs()},habit:h=>{if(modal)modal.color=h},area:h=>{if(modal)modal.color=h}};
function setColor(f,hex,from){COLOR_SET[f](hex);
  const slid=from&&'hsl'.includes(from.dataset.k||'x');
  if(slid)cpHsl[f]=['h','s','l'].map(k=>+$('[data-cf="'+f+'"][data-k="'+k+'"]').value);
  const hsl=slid?cpHsl[f]:pickHsl(f,hex);
  // moving one slider never moves the others; only typing a hex or picking a swatch updates all three
  document.querySelectorAll('[data-cf="'+f+'"]').forEach(e=>{if(e===from)return;const k=e.dataset.k;if(k==='hex')e.value=hex;else if(!slid)e.value=hsl['hsl'.indexOf(k)]});
  let pre=false;document.querySelectorAll('[data-sw="'+f+'"]').forEach(b=>{const on=b.dataset.v===hex;if(on)pre=true;b.setAttribute('aria-pressed',on);b.classList.toggle('on',on)});
  document.querySelectorAll('[data-cpk="'+f+'"]').forEach(w=>{w.style.setProperty('--h',hsl[0]);w.style.setProperty('--s',hsl[1]+'%');w.style.setProperty('--l',hsl[2]+'%');w.style.setProperty('--c',hex);const m=w.querySelector('.cmore');if(m)m.classList.toggle('on',!pre)})}
function applyPrefs(){const d=document.documentElement;d.style.setProperty('--accent',P.accent);d.classList.toggle('light',P.theme==='light');d.classList.toggle('amoled',P.theme==='amoled');d.classList.toggle('notabnames',P.tabNames===false);
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=P.theme==='light'?'#f7f7f7':P.theme==='amoled'?'#000000':'#080808';try{localStorage.setItem(PKEY,JSON.stringify(P))}catch(e){}}
applyPrefs();
// optional features, switched in Settings > Features (all on except the reminder)
const FEAT=[['freeze','Streak freezes'],['twice','Never miss twice'],['streaks','Streaks on Today'],['review','Weekly review'],['heatmap','Year heatmap'],['notes','Habit notes'],['missed','Mark missed tasks'],['drag','Drag to rearrange'],['focus','Focus timer'],['reminder','Daily reminder'],['remnames','Show names in reminders']];
const FEATD={freeze:'Seven days in a row earn a freeze that saves a streak on a missed day',twice:'After a missed day, Today marks the habit so one miss doesn’t become two',streaks:'Your stopped-habit streaks on the Today screen',review:'A summary of last week on Sundays',heatmap:'The year of squares on Insights',notes:'A short note on any day of a habit',missed:'Past tasks you didn’t do show a red X',ach:'Track things you’ve stopped, like smoking',drag:'Move tasks, habits, goals and cards by dragging',focus:'A timer for focused work on a task',reminder:'One notification a day if habits are still open',remnames:'Notifications say which habit or task; off shows just “Groundwork Habits”'};
const feat=k=>k==='ach'?true:P.feat&&k in P.feat?!!P.feat[k]:k!=='reminder';
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
    o.habits.push({id:i,name:str(h.name),type:['daily','weekly','monthly'].includes(h.type)?h.type:'daily',color:/^#[0-9a-f]{6}$/i.test(h.color)?h.color.toLowerCase():COLORS[0],target:num(h.target,1,99,1),per:num(h.per,1,7,7),track:['check','count','amount'].includes(h.track)?h.track:(num(h.target,1,99,1)>1?'count':'check'),unit:str(h.unit).replace(/[<>"'&`=]/g,'').slice(0,12),goal:Number.isFinite(+h.goal)&&+h.goal>0?Math.min(1e6,+h.goal):0,fz:obj(h.fz)?{off:!!h.fz.off,every:num(h.fz.every,3,30,7),max:num(h.fz.max,1,5,3)}:null,rem:obj(h.rem)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(h.rem.t)&&['ask','alarm'].includes(h.rem.m)?{t:h.rem.t,m:h.rem.m}:null,rest:Array.isArray(h.rest)?[...new Set(h.rest.map(Number).filter(x=>Number.isInteger(x)&&x>=0&&x<7))].sort().slice(0,6):undefined,ch:obj(h.ch)&&/^\d{4}-\d{2}-\d{2}$/.test(h.ch.from)?{from:h.ch.from,days:num(h.ch.days,3,365,30)}:undefined});
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
if(DEMO&&!encWait&&!S.habits.length)S=seed(); // first visit to the demo: example data
if(dataDir&&!readFile())writeFile(); // folder file wins; a new folder gets current data
['habits','log','tasks','goals','journal'].forEach(k=>{if(!S[k])S[k]=(k==='habits'||k==='goals')?[]:{}});
if(!S.v)S.v=1; // pre-versioned saves are v1; add 'if(S.v<2){...;S.v=2}' steps here

let view=(location.hash||'#habits').slice(1);
const AM=/^ask~([A-Za-z0-9_-]{1,40})~(\d{4}-\d{2}(?:-\d{2}|-W\d)?)$/.exec(view),ASK=AM?{h:AM[1],k:AM[2]}:null;if(ASK)view='ask';
const WIDGET=view==='widget'||!!ASK; // the desktop mini window (#widget) and reminder pop-up (#ask~h~k)
const VIEWS=[['today','Today','home'],['habits','Habits','habits'],['tasks','Tasks','tasks'],['goals','Goals','goals'],['insights','Insights','insights'],['achievements','Streaks','trophy']];
const views=()=>VIEWS.filter(v=>v[0]!=='achievements'||feat('ach'));
// settings is a page of its own: #settings (all sections; on phones the section list) and #settings/<section>
let setSec='',setQ='',setBack='today';
const SETSECS=['appearance','language','features','reminders','calendar','data','security','about'];
function routeTo(v){const m=/^settings(?:\/([a-z]+))?$/.exec(v);if(m){view='settings';setSec=SETSECS.includes(m[1])?m[1]:'';return true}if(views().some(x=>x[0]===v)){view=v;return true}return false}
if(!WIDGET&&!routeTo(view))view='habits';
let vy=TODAY.getFullYear(),vm=TODAY.getMonth(),tab='daily',featOpen=false,confirmDemo=false,confirmGoal=null,confirmPinOff=false,menuOpen=false,confirmReset=false,
    taskWeek=wkStart(TODAY),addingTask=null,openMind={},insHabit='all',insRange=7,insMenu=null,lbTab='daily',modal=null,insSeries=[];

