(function(root){
  'use strict';
  let sdk,auth,loading;
  const callbacks=new Set();
  function configured(){const c=root.MUNI_CONFIG;return !!(c&&((c.backend==='apps-script'&&/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(c.apiBaseUrl))||(c.backend==='supabase'&&/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/muni360$/.test(c.apiBaseUrl)))&&c.firebase?.apiKey&&c.firebase?.authDomain&&c.firebase?.projectId&&c.firebase?.appId);}
  async function initialize(){
    if(!configured())throw Error('El acceso con Google está preparado; falta configurar el proyecto antes de publicarlo.');
    if(loading)return loading;
    loading=(async()=>{
      const [app,mod]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js')]);
      sdk=mod;auth=mod.getAuth(app.getApps().length?app.getApp():app.initializeApp(root.MUNI_CONFIG.firebase));
      await mod.setPersistence(auth,mod.browserSessionPersistence);
      mod.onAuthStateChanged(auth,()=>callbacks.forEach(fn=>fn(auth.currentUser)));
    })().catch(e=>{loading=null;throw e;});return loading;
  }
  async function getToken(force=false,expectedUid){await initialize();if(!auth.currentUser || expectedUid && auth.currentUser.uid!==expectedUid){const e=Error('La cuenta de Google cambió. Volvé a ingresar para esta carga.');e.code='SESION';throw e;}return auth.currentUser.getIdToken(force);}
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
  async function login(){await initialize();const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return sdk.signInWithPopup(auth,provider);}
  async function logout(){if(auth)await sdk.signOut(auth);}
  function observe(fn){callbacks.add(fn);initialize().catch(e=>fn(null,e));return ()=>callbacks.delete(fn);}
  root.MuniGoogle={configured,initialize,getToken,call,syncSheets,login,logout,observe};
})(window);
