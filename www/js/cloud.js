/* Cloud sync (full app only): sign in with Dropbox or Google Drive and groundwork.json is kept in the user's own cloud
   (Dropbox: Apps/Groundwork Habits; Drive: the hidden app folder). It is the same sync as the data folder: andWrite/andRead
   in core.js write a moment after each save and read on focus, newest copy wins. There is no server of ours: the app talks
   to Dropbox and Google directly. Sign-in uses PKCE. Desktop and Android catch the answer on http://127.0.0.1:53682 (native
   oauth(): it opens the browser and waits for the redirect); the web app gets it back on its own page. Google on the web
   gets a one-hour token with no refresh (a web client can't keep a secret), so it asks to reconnect after that.
   Tokens stay on this device in localStorage (KEY-cloud), never in exports or backups. */
const CLOUD_IDS={
  dropbox:'5ch1ru2x3ky53gy',      // Dropbox app key (PKCE, no secret). Redirect URIs: http://127.0.0.1:53682/ and the GitHub Pages address
  google:'',       // Google "Desktop app" OAuth client (desktop and Android, loopback redirect)
  googleSecret:'', // that client's secret: Google says an installed app's secret is not confidential, so it may ship in the app
  googleWeb:'',    // Google "Web application" OAuth client for the web app (redirect: the GitHub Pages address)
};
// the Google values come from js/keys.js, written at build time by tools/keys.js (GitHub refuses them in the repository)
Object.keys(CLOUD_IDS).forEach(k=>{const v=window.GW_KEYS&&window.GW_KEYS[k];if(v)CLOUD_IDS[k]=v});
if(TESTING&&window.GW_CLOUD_IDS)Object.assign(CLOUD_IDS,window.GW_CLOUD_IDS); // smoke tests sign in against a fake Dropbox
const OAUTH_PORT=53682;
// one Google Calendar event as a task for applyCalendar(): all-day events keep their date; timed ones use this device's
// local day and time (an event at 23:30 in New York can be tomorrow here). Cancelled ones and ones without a start are dropped
function gEvent(e){if(!e||e.status==='cancelled'||!e.start)return null;const p=n=>String(n).padStart(2,'0');
  if(e.start.date)return {uid:'g:'+e.id,day:e.start.date,time:'',text:e.summary||''};const d=new Date(e.start.dateTime);if(isNaN(d))return null;
  return {uid:'g:'+e.id,day:d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()),time:p(d.getHours())+':'+p(d.getMinutes()),text:e.summary||''}}
const CLOUD=LITE||DEMO||WIDGET?null:(()=>{
  const SK=KEY+'-cloud',OK=KEY+'-oauth',WEB=!DFS&&!NB;
  const NAT=DFS&&DFS.oauth?u=>DFS.oauth(u):NB&&NB.oauth?u=>NB.oauth({url:u}):null;
  let st=null;try{st=JSON.parse(localStorage.getItem(SK)||'null')}catch(e){}
  const keep=()=>{try{st?localStorage.setItem(SK,JSON.stringify(st)):localStorage.removeItem(SK)}catch(e){}};
  const b64u=b=>btoa(String.fromCharCode.apply(null,new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const rnd=()=>b64u(crypto.getRandomValues(new Uint8Array(32)));
  const sha=async s=>b64u(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const form=o=>Object.keys(o).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(o[k])).join('&');
  const here=()=>location.origin+location.pathname;
  const GSCOPE='https://www.googleapis.com/auth/drive.appdata email';
  const PROV={
    dropbox:{name:'Dropbox',id:()=>CLOUD_IDS.dropbox,secret:()=>'',redirect:()=>WEB?here():'http://127.0.0.1:'+OAUTH_PORT+'/',tokenUrl:'https://api.dropboxapi.com/oauth2/token',
      auth:(ch,s)=>'https://www.dropbox.com/oauth2/authorize?'+form({client_id:CLOUD_IDS.dropbox,response_type:'code',code_challenge:ch,code_challenge_method:'S256',token_access_type:'offline',redirect_uri:PROV.dropbox.redirect(),state:s})},
    google:{name:'Google Drive',id:()=>WEB?CLOUD_IDS.googleWeb:CLOUD_IDS.google,secret:()=>CLOUD_IDS.googleSecret,redirect:()=>WEB?here():'http://127.0.0.1:'+OAUTH_PORT+'/',tokenUrl:'https://oauth2.googleapis.com/token',
      auth:(ch,s,scope)=>'https://accounts.google.com/o/oauth2/v2/auth?'+form(WEB?{client_id:CLOUD_IDS.googleWeb,response_type:'token',scope:scope||GSCOPE,redirect_uri:here(),state:s,include_granted_scopes:'true'}
        :{client_id:CLOUD_IDS.google,response_type:'code',scope:scope||GSCOPE,code_challenge:ch,code_challenge_method:'S256',access_type:'offline',prompt:'consent',redirect_uri:PROV.google.redirect(),state:s})}};
  const can=p=>!!PROV[p].id()&&(WEB||!!NAT)&&!!(window.crypto&&crypto.subtle);
  async function tokenCall(p,o){const pr=PROV[p],sec=pr.secret();
    const r=await fetch(pr.tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form(Object.assign({client_id:pr.id()},sec?{client_secret:sec}:{},o))});
    const j=await r.json().catch(()=>({}));if(!r.ok||!j.access_token)throw new Error('signin');return j}
  // a valid access token: the stored one, or a fresh one from the refresh token; none left means "reconnect"
  async function token(fresh){if(!st)throw new Error('signed out');if(!fresh&&st.tok&&st.exp>Date.now()+60e3)return st.tok;
    if(!st.rt){api.off=true;throw new Error('reconnect')}
    try{const j=await tokenCall(st.p,{grant_type:'refresh_token',refresh_token:st.rt});st.tok=j.access_token;st.exp=Date.now()+(j.expires_in||3600)*1e3;if(j.refresh_token)st.rt=j.refresh_token;keep();api.off=false;return st.tok}
    catch(e){if(navigator.onLine!==false){api.off=true}throw e}}
  // fetch with the token; one retry with a fresh token after a 401
  // the provider's own reason for a refusal ("Google Drive API has not been used in project…"), shown in Settings and the error
  async function why(r){let m='';try{const j=await r.clone().json();m=j.error&&(j.error.message||j.error_summary)||j.error_summary||''}catch(e){}api.why=(r.status+' '+String(m)).trim().slice(0,200)}
  async function call(url,o){o=o||{};for(let i=0;i<2;i++){const t=await token(i>0);let r;try{r=await fetch(url,Object.assign({},o,{headers:Object.assign({Authorization:'Bearer '+t},o.headers||{})}))}catch(e){api.why='No connection';throw e}
      if(!r.ok&&r.status!==401&&r.status!==404&&r.status!==409)await why(r);else if(r.ok)api.why='';
      if(r.status===401&&i===0){st.tok='';continue}if(r.status===401){api.off=true;throw new Error('reconnect')}return r}}
  const DBX={read:async()=>{const r=await call('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{'Dropbox-API-Arg':JSON.stringify({path:'/groundwork.json'})}});
      if(r.status===409)return {};if(!r.ok)throw new Error('read');return {text:await r.text()}},
    write:async t=>{const r=await call('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{'Dropbox-API-Arg':JSON.stringify({path:'/groundwork.json',mode:'overwrite',mute:true}),'Content-Type':'application/octet-stream'},body:new Blob([t])});if(!r.ok)throw new Error('write')},
    who:async()=>{const r=await call('https://api.dropboxapi.com/2/users/get_current_account',{method:'POST'});return r.ok?((await r.json()).email||''):''}};
  const GD='https://www.googleapis.com/drive/v3/files',GU='https://www.googleapis.com/upload/drive/v3/files';
  const gNew=async name=>{const r=await call(GD+'?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,parents:['appDataFolder']})});if(!r.ok)throw new Error('create');return (await r.json()).id};
  const gPut=(id,t)=>call(GU+'/'+id+'?uploadType=media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:new Blob([t])});
  const GDR={fid:async()=>{if(st.fid)return st.fid;const r=await call(GD+'?'+form({spaces:'appDataFolder',fields:'files(id)',q:"name='groundwork.json' and trashed=false"}));
      if(!r.ok)throw new Error('read');const f=((await r.json()).files||[])[0];if(f){st.fid=f.id;keep()}return f?f.id:''},
    read:async()=>{const id=await GDR.fid();if(!id)return {};const r=await call(GD+'/'+id+'?alt=media');if(r.status===404){st.fid='';keep();return {}}if(!r.ok)throw new Error('read');return {text:await r.text()}},
    write:async t=>{const id=await GDR.fid();
      if(id){const r=await gPut(id,t);if(r.ok)return;if(r.status!==404)throw new Error('write');st.fid=''}
      const nid=await gNew('groundwork.json');st.fid=nid;keep();const r=await gPut(nid,t);if(!r.ok)throw new Error('write')},
    who:async()=>{const r=await call('https://www.googleapis.com/oauth2/v3/userinfo');return r.ok?((await r.json()).email||''):''}};
  // backups in the cloud too (the newest `keep`, 1 to 8): Dropbox Apps/Groundwork Habits/backups, Drive's hidden app folder
  DBX.backup=async(name,t,keep)=>{let r=await call('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{'Dropbox-API-Arg':JSON.stringify({path:'/backups/'+name,mode:'overwrite',mute:true}),'Content-Type':'application/octet-stream'},body:new Blob([t])});if(!r.ok)throw new Error('backup');
    r=await call('https://api.dropboxapi.com/2/files/list_folder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'/backups'})});
    const old=r.ok?((await r.json()).entries||[]).map(e=>e.name).filter(n=>/^groundwork-backup-/.test(n)).sort().reverse().slice(keep||8):[];
    for(const n of old)await call('https://api.dropboxapi.com/2/files/delete_v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'/backups/'+n})});
    return 'Dropbox: Apps/Groundwork Habits/backups'};
  GDR.backup=async(name,t,keep)=>{const ls=async()=>{const r=await call(GD+'?'+form({spaces:'appDataFolder',fields:'files(id,name)',pageSize:'100',q:"name contains 'groundwork-backup-' and trashed=false"}));return r.ok?((await r.json()).files||[]).filter(f=>/^groundwork-backup-/.test(f.name)):[]};
    const same=(await ls()).find(f=>f.name===name);let r;
    r=await gPut(same?same.id:await gNew(name),t);
    if(!r.ok)throw new Error('backup');
    for(const f of (await ls()).sort((a,c)=>a.name<c.name?1:-1).slice(keep||8))await call(GD+'/'+f.id,{method:'DELETE'});
    return 'Google Drive (hidden app folder)'};
  // the backups kept there (newest first), one backup's text, and deleting everything the app keeps there
  const isBak=n=>/^groundwork-backup-[\w.-]+\.json$/.test(n);
  DBX.list=async()=>{const r=await call('https://api.dropboxapi.com/2/files/list_folder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'/backups'})});
    if(r.status===409)return [];if(!r.ok)throw new Error('list');return ((await r.json()).entries||[]).filter(e=>isBak(e.name)).map(e=>({n:e.name,size:e.size||0})).sort((a,b)=>a.n<b.n?1:-1)};
  DBX.get=async n=>{if(!isBak(n))throw new Error('name');const r=await call('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{'Dropbox-API-Arg':JSON.stringify({path:'/backups/'+n})}});if(!r.ok)throw new Error('read');return r.text()};
  DBX.wipe=async()=>{for(const path of ['/groundwork.json','/backups']){const r=await call('https://api.dropboxapi.com/2/files/delete_v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path})});if(!r.ok&&r.status!==409)throw new Error('delete')}};
  GDR.list=async()=>{const r=await call(GD+'?'+form({spaces:'appDataFolder',fields:'files(id,name,size)',pageSize:'100',q:"name contains 'groundwork-backup-' and trashed=false"}));if(!r.ok)throw new Error('list');
    return ((await r.json()).files||[]).filter(f=>isBak(f.name)).map(f=>({n:f.name,id:f.id,size:+f.size||0})).sort((a,b)=>a.n<b.n?1:-1)};
  GDR.get=async n=>{const f=(await GDR.list()).find(x=>x.n===n);if(!f)throw new Error('gone');const r=await call(GD+'/'+f.id+'?alt=media');if(!r.ok)throw new Error('read');return r.text()};
  GDR.wipe=async()=>{const r=await call(GD+'?'+form({spaces:'appDataFolder',fields:'files(id)',pageSize:'1000'}));if(!r.ok)throw new Error('list');
    for(const f of (await r.json()).files||[]){const d=await call(GD+'/'+f.id,{method:'DELETE'});if(!d.ok&&d.status!==404)throw new Error('delete')}st.fid='';keep()};
  const ops=()=>st&&st.p==='google'?GDR:DBX;
  async function finish(p,j){st={p,tok:j.access_token,exp:Date.now()+(j.expires_in||3600)*1e3,rt:j.refresh_token||'',who:''};keep();api.off=false;
    try{st.who=await ops().who();keep()}catch(e){}
    // one place for data: the cloud replaces a data folder
    if(FOLD&&P.andDir){FOLD.clearFolder();P.andDir=''}if(DFS&&dataDir){DFS.reset();dataDir='';fileText=null}applyPrefs();
    let ex=null;try{ex=(await ops().read()).text}catch(e){}
    if(ex&&!hasData()){modal=null;await andApply(ex,false);toast('Loaded your data from '+PROV[p].name);return}
    if(ex){modal={kind:'afold',text:ex,cloud:PROV[p].name};render()}else{andText=null;andWrite();render();toast('Groundwork Habits now syncs with '+PROV[p].name)}}
  /* Google Calendar by sign-in (read-only): its own Google sign-in, kept apart from Drive sync in KEY-gcal. Events from the main
     calendar become tasks through applyCalendar(), like a calendar link */
  const CSCOPE='https://www.googleapis.com/auth/calendar.readonly email',GK=KEY+'-gcal';
  let gc=null;try{gc=JSON.parse(localStorage.getItem(GK)||'null')}catch(e){}
  const gkeep=()=>{try{gc?localStorage.setItem(GK,JSON.stringify(gc)):localStorage.removeItem(GK)}catch(e){}};
  // Google's consent page lets people untick the calendar box: then the answer's scope lacks it, so don't connect
  const NOCAL='Google Calendar wasn’t allowed. Sign in again and tick the calendar box';
  async function gcFinish(j){if(j.scope&&!/calendar\.readonly/.test(j.scope)){gc=null;gkeep();if(P.cal==='google'){P.cal='';applyPrefs()}toast(NOCAL);render();return}api.calOff=false;gc={tok:j.access_token,exp:Date.now()+(j.expires_in||3600)*1e3,rt:j.refresh_token||'',who:''};gkeep();
    try{const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+gc.tok}});if(r.ok){gc.who=(await r.json()).email||'';gkeep()}}catch(e){}
    P.cal='google';P.calAt=0;applyPrefs();pullCalendar(true)}
  async function gcToken(){if(!gc)throw new Error('signed out');if(gc.tok&&gc.exp>Date.now()+60e3)return gc.tok;if(!gc.rt){api.calOff=true;throw new Error('Sign in to Google Calendar again')}
    let j;try{j=await tokenCall('google',{grant_type:'refresh_token',refresh_token:gc.rt})}catch(e){if(navigator.onLine!==false)api.calOff=true;throw new Error('Sign in to Google Calendar again')}gc.tok=j.access_token;gc.exp=Date.now()+(j.expires_in||3600)*1e3;gkeep();return gc.tok}
  const api={off:false,why:'',
    calOn:()=>!!gc,calOff:false,calWho:()=>gc&&gc.who||'',
    async calSignIn(){if(!can('google')){toast('Sign-in with Google isn’t set up in this version');return}
      const ver=rnd(),s=rnd(),ch=await sha(ver);
      if(WEB){try{sessionStorage.setItem(OK,JSON.stringify({p:'google',ver,s,cal:1}))}catch(e){}location.href=PROV.google.auth(ch,s,CSCOPE);return}
      toast('Finish signing in in your browser');
      const r=await NAT(PROV.google.auth(ch,s,CSCOPE));if(r&&r.error==='replaced')return;
      if(!r||!r.ok)throw new Error(r&&r.error||'Sign-in was cancelled');
      const q=new URLSearchParams(r.query||'');if(q.get('state')!==s||!q.get('code'))throw new Error('Sign-in was cancelled');
      await gcFinish(await tokenCall('google',{grant_type:'authorization_code',code:q.get('code'),code_verifier:ver,redirect_uri:PROV.google.redirect()}))},
    calSignOut(){gc=null;gkeep();api.calOff=false},
    // events of the main calendar between two day keys, as applyCalendar wants them: {uid, day, time, text}
    async calEvents(lo,hi){const t=await gcToken(),out=[];let page='';
      for(let i=0;i<10;i++){const r=await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?'+form(Object.assign({singleEvents:'true',orderBy:'startTime',maxResults:'2500',
          timeMin:new Date(lo+'T00:00').toISOString(),timeMax:new Date(hi+'T23:59:59').toISOString()},page?{pageToken:page}:{})),{headers:{Authorization:'Bearer '+t}});
        if(r.status===401){api.calOff=true;throw new Error('Sign in to Google Calendar again')}
        if(r.status===403){let m='';try{m=((await r.clone().json()).error||{}).message||''}catch(e){}if(/scope/i.test(m)){api.calOff=true;throw new Error(NOCAL)}}
        if(!r.ok){let m='';try{m=((await r.json()).error||{}).message||''}catch(e){}throw new Error(('Google Calendar: '+r.status+' '+m).trim())}
        const j=await r.json();(j.items||[]).forEach(e=>{const x=gEvent(e);if(x)out.push(x)});
        if(!j.nextPageToken)break;page=j.nextPageToken}
      api.calOff=false;return out},
    can,PROV,
    on:()=>!!st,
    name:()=>st?PROV[st.p].name:'',
    who:()=>st&&st.who||'',
    readFolder:()=>ops().read(),
    backup:(name,t,keep)=>ops().backup(name,t,Math.min(8,Math.max(1,keep||8))),
    backups:()=>ops().list(),
    getBackup:n=>ops().get(n),
    async wipe(){await ops().wipe();api.signOut()},
    writeFolder:o=>ops().write(o.text),
    async signIn(p){if(!can(p)){toast('Sign-in with '+PROV[p].name+' isn’t set up in this version');return}
      const ver=rnd(),s=rnd(),ch=await sha(ver);
      if(WEB){try{sessionStorage.setItem(OK,JSON.stringify({p,ver,s}))}catch(e){}location.href=PROV[p].auth(ch,s);return}
      toast('Finish signing in in your browser');
      const r=await NAT(PROV[p].auth(ch,s));if(r&&r.error==='replaced')return; // a newer Sign in took over
      if(!r||!r.ok)throw new Error(r&&r.error||'Sign-in was cancelled');
      const q=new URLSearchParams(r.query||'');if(q.get('state')!==s||!q.get('code'))throw new Error('Sign-in was cancelled');
      await finish(p,await tokenCall(p,{grant_type:'authorization_code',code:q.get('code'),code_verifier:ver,redirect_uri:PROV[p].redirect()}))},
    reconnect(){if(st)return api.signIn(st.p)},
    signOut(){if(st&&st.p==='dropbox'&&st.tok)fetch('https://api.dropboxapi.com/2/auth/token/revoke',{method:'POST',headers:{Authorization:'Bearer '+st.tok}}).catch(()=>{});
      st=null;keep();api.off=false;andText=null},
    // the web app coming back from the sign-in page: Dropbox answers ?code=…, Google #access_token=…
    async resume(){let pend=null;try{pend=JSON.parse(sessionStorage.getItem(OK)||'null')}catch(e){}if(!pend)return;
      const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.slice(1)),s=q.get('state')||h.get('state');if(!s)return;
      try{sessionStorage.removeItem(OK)}catch(e){}history.replaceState(null,'',here());addEventListener('load',()=>{location.hash=pend.cal?'settings/calendar':'settings/data'}); // the route was read before this ran: go there once every script has loaded (a timer could fire between script loads)
      // the rest uses the whole app (toast, render, save): wait until every script has loaded
      if(document.readyState!=='complete')await new Promise(r=>addEventListener('load',r,{once:true}));
      if(s!==pend.s){toast('Sign-in was cancelled');return}
      if(pend.cal){try{if(h.get('access_token'))await gcFinish({access_token:h.get('access_token'),expires_in:+h.get('expires_in')||3600,scope:h.get('scope')||''});else toast('Sign-in was cancelled')}catch(e){toast('Could not sign in')}return}
      try{if(h.get('access_token'))await finish(pend.p,{access_token:h.get('access_token'),expires_in:+h.get('expires_in')||3600});
        else if(q.get('code'))await finish(pend.p,await tokenCall(pend.p,{grant_type:'authorization_code',code:q.get('code'),code_verifier:pend.ver,redirect_uri:here()}));
        else toast('Sign-in was cancelled')}catch(e){toast('Could not sign in')}}};
  return api})();
if(CLOUD&&!DFS&&!NB)CLOUD.resume(); // runs before the first render, so the sign-in answer never shows as a route
