(function(root){
  'use strict';
  let sdk,auth,loading,ready=false;
  const callbacks=new Set();
  const rememberKey='muni360_keep_signed_in';
  function remembered(){try{return root.localStorage.getItem(rememberKey)!=='false';}catch(_){return true;}}
  function setupRememberChoice(){
    const doc=root.document,button=doc?.querySelector('#google-login, #google');
    if(!button||doc.getElementById('keep-signed-in'))return;
    const label=doc.createElement('label'),input=doc.createElement('input'),text=doc.createElement('span');
    input.type='checkbox';input.id='keep-signed-in';input.checked=remembered();
    input.onchange=()=>{
      const keep=Boolean(input.checked);
      try{root.localStorage.setItem(rememberKey,String(keep));}catch(_){}
      if(auth&&sdk)sdk.setPersistence(auth,keep?sdk.browserLocalPersistence:sdk.browserSessionPersistence).catch(()=>{});
    };
    input.style.cssText='width:18px;height:18px;min-width:18px;margin:0;accent-color:#173451';
    text.textContent='Mantener sesión iniciada en este dispositivo';
    label.style.cssText='display:flex;align-items:center;gap:9px;min-height:44px;margin:8px 0;font-size:.84rem;font-weight:500;line-height:1.4;text-transform:none;letter-spacing:normal;cursor:pointer';
    label.append(input,text);button.before(label);
  }
  function configured(){const c=root.MUNI_CONFIG;return !!(c&&((c.backend==='apps-script'&&/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(c.apiBaseUrl))||(c.backend==='supabase'&&/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/muni360$/.test(c.apiBaseUrl)))&&c.firebase?.apiKey&&c.firebase?.authDomain&&c.firebase?.projectId&&c.firebase?.appId);}
  async function initialize(){
    if(!configured())throw Error('El acceso con Google está preparado; falta configurar el proyecto antes de publicarlo.');
    if(loading)return loading;
    loading=(async()=>{
      const [app,mod]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js')]);
      sdk=mod;
      const appName=root.MUNI_AUTH_APP_NAME||'[DEFAULT]';
      const firebaseApp=app.getApps().some(existing=>existing.name===appName)
        ? app.getApp(appName)
        : app.initializeApp(root.MUNI_CONFIG.firebase, appName);
      if(typeof mod.initializeAuth==='function'){
        try{
          const persistence=remembered()
            ?(mod.indexedDBLocalPersistence?[mod.browserLocalPersistence,mod.indexedDBLocalPersistence]:mod.browserLocalPersistence)
            :mod.browserSessionPersistence;
          auth=mod.initializeAuth(firebaseApp,{persistence,popupRedirectResolver:mod.browserPopupRedirectResolver});
        }catch(_){auth=mod.getAuth(firebaseApp);}
      }else{
        auth=mod.getAuth(firebaseApp);
      }
      if(typeof auth.authStateReady==='function')await auth.authStateReady();
      await mod.setPersistence(auth,remembered()?mod.browserLocalPersistence:mod.browserSessionPersistence);
      if(typeof auth.authStateReady==='function')await auth.authStateReady();
      mod.onAuthStateChanged(auth,()=>{ready=true;callbacks.forEach(fn=>fn(auth.currentUser));});
    })().catch(e=>{loading=null;throw e;});return loading;
  }
  async function getToken(force=false,expectedUid){await initialize();if(typeof auth?.authStateReady==='function')await auth.authStateReady();if(!auth.currentUser || expectedUid && auth.currentUser.uid!==expectedUid){const e=Error('La cuenta de Google cambió. Volvé a ingresar para esta carga.');e.code='SESION';throw e;}return auth.currentUser.getIdToken(force);}
  async function call(path,body={}){
    const token=await getToken();
    const response=await fetch(root.MUNI_CONFIG.apiBaseUrl,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...body,path,idToken:token}),signal:AbortSignal.timeout(25000)});
    let data;try{data=await response.json();}catch(_){throw Error('No se pudo leer la respuesta del servicio.');}
    const expected=root.MUNI_CONFIG.backend==='supabase'?'supabase-1.0.0':'apps-script-3.0.0';
    if(data.backendVersion!==expected)throw Error('La versión del servicio todavía no coincide con esta app.');
    if(!response.ok||!data.ok){const e=Error(data.error||'No se pudo completar la operación.');e.code=data.codigo;throw e;}return data;
  }
  async function syncSheets(deporte){
    const result=await call('/api/sheets/sync',{deporte});
    if(result.verified!==true||result.actividad!==deporte||!Number.isInteger(result.version)||result.version<0)throw Error('Sheets no confirmó la actividad y versión solicitadas. Volvé a intentar.');
    return result;
  }
  async function login(){await initialize();const choice=root.document?.getElementById('keep-signed-in'),remember=choice?choice.checked:remembered();await sdk.setPersistence(auth,remember?sdk.browserLocalPersistence:sdk.browserSessionPersistence);try{root.localStorage.setItem(rememberKey,String(remember));}catch(_){}const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return sdk.signInWithPopup(auth,provider);}
  async function logout(){if(auth)await sdk.signOut(auth);}
  function observe(fn){setupRememberChoice();callbacks.add(fn);if(ready&&auth)Promise.resolve().then(()=>{if(callbacks.has(fn))fn(auth.currentUser);});else initialize().catch(e=>fn(null,e));return ()=>callbacks.delete(fn);}
  root.MuniGoogle={configured,initialize,getToken,call,syncSheets,login,logout,observe};
})(window);
