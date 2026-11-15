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
      auth:(ch,s)=>'https://accounts.google.com/o/oauth2/v2/auth?'+form(WEB?{client_id:CLOUD_IDS.googleWeb,response_type:'token',scope:GSCOPE,redirect_uri:here(),state:s,include_granted_scopes:'true'}
        :{client_id:CLOUD_IDS.google,response_type:'code',scope:GSCOPE,code_challenge:ch,code_challenge_method:'S256',access_type:'offline',prompt:'consent',redirect_uri:PROV.google.redirect(),state:s})}};
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
  async function call(url,o){o=o||{};for(let i=0;i<2;i++){const t=await token(i>0);const r=await fetch(url,Object.assign({},o,{headers:Object.assign({Authorization:'Bearer '+t},o.headers||{})}));
      if(r.status===401&&i===0){st.tok='';continue}if(r.status===401){api.off=true;throw new Error('reconnect')}return r}}
  const DBX={read:async()=>{const r=await call('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{'Dropbox-API-Arg':JSON.stringify({path:'/groundwork.json'})}});
      if(r.status===409)return {};if(!r.ok)throw new Error('read');return {text:await r.text()}},
    write:async t=>{const r=await call('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{'Dropbox-API-Arg':JSON.stringify({path:'/groundwork.json',mode:'overwrite',mute:true}),'Content-Type':'application/octet-stream'},body:new Blob([t])});if(!r.ok)throw new Error('write')},
    who:async()=>{const r=await call('https://api.dropboxapi.com/2/users/get_current_account',{method:'POST'});return r.ok?((await r.json()).email||''):''}};
  const GD='https://www.googleapis.com/drive/v3/files',GU='https://www.googleapis.com/upload/drive/v3/files';
  const GDR={fid:async()=>{if(st.fid)return st.fid;const r=await call(GD+'?'+form({spaces:'appDataFolder',fields:'files(id)',q:"name='groundwork.json' and trashed=false"}));
      if(!r.ok)throw new Error('read');const f=((await r.json()).files||[])[0];if(f){st.fid=f.id;keep()}return f?f.id:''},
    read:async()=>{const id=await GDR.fid();if(!id)return {};const r=await call(GD+'/'+id+'?alt=media');if(r.status===404){st.fid='';keep();return {}}if(!r.ok)throw new Error('read');return {text:await r.text()}},
    write:async t=>{const id=await GDR.fid();
      if(id){const r=await call(GU+'/'+id+'?uploadType=media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:new Blob([t])});if(r.ok)return;if(r.status!==404)throw new Error('write');st.fid=''}
      const b='gw'+rnd(),body=new Blob(['--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:'groundwork.json',parents:['appDataFolder']})+'\r\n--'+b+'\r\nContent-Type: application/json\r\n\r\n',t,'\r\n--'+b+'--']);
      const r=await call(GU+'?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+b},body});if(!r.ok)throw new Error('write');st.fid=(await r.json()).id;keep()},
    who:async()=>{const r=await call('https://www.googleapis.com/oauth2/v3/userinfo');return r.ok?((await r.json()).email||''):''}};
  const ops=()=>st&&st.p==='google'?GDR:DBX;
  async function finish(p,j){st={p,tok:j.access_token,exp:Date.now()+(j.expires_in||3600)*1e3,rt:j.refresh_token||'',who:''};keep();api.off=false;
    try{st.who=await ops().who();keep()}catch(e){}
    // one place for data: the cloud replaces a data folder
    if(FOLD&&P.andDir){FOLD.clearFolder();P.andDir=''}if(DFS&&dataDir){DFS.reset();dataDir='';fileText=null}applyPrefs();
    let ex=null;try{ex=(await ops().read()).text}catch(e){}
    if(ex){modal={kind:'afold',text:ex,cloud:PROV[p].name};render()}else{andText=null;andWrite();render();toast('Groundwork Habits now syncs with '+PROV[p].name)}}
  const api={off:false,
    can,PROV,
    on:()=>!!st,
    name:()=>st?PROV[st.p].name:'',
    who:()=>st&&st.who||'',
    readFolder:()=>ops().read(),
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
      try{sessionStorage.removeItem(OK)}catch(e){}history.replaceState(null,'',here());setTimeout(()=>{location.hash='settings/data'}); // the route was read before this ran: go there once the app is up
      if(s!==pend.s){toast('Sign-in was cancelled');return}
      try{if(h.get('access_token'))await finish(pend.p,{access_token:h.get('access_token'),expires_in:+h.get('expires_in')||3600});
        else if(q.get('code'))await finish(pend.p,await tokenCall(pend.p,{grant_type:'authorization_code',code:q.get('code'),code_verifier:pend.ver,redirect_uri:here()}));
        else toast('Sign-in was cancelled')}catch(e){toast('Could not sign in')}}};
  return api})();
if(CLOUD&&!DFS&&!NB)CLOUD.resume(); // runs before the first render, so the sign-in answer never shows as a route
