import {createHandler} from './core.mjs';
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
const base=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const fcmSecret=Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')||'';
const allowed=(origin:string)=>!origin||/^https:\/\/muni360-ugi-ensayo(?:--[a-z0-9-]+)?\.web\.app$/.test(origin)||['https://ugiccba.com.ar','https://www.ugiccba.com.ar','https://ugiccba-prog.github.io'].includes(origin);

function b64url(bytes:Uint8Array|string){
 const bin=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;
 let s='';for(const b of bin)s+=String.fromCharCode(b);
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function getFcmAccessToken(sa:{client_email:string;private_key:string}){
 const pem=sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g,'');
 const keyBytes=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',keyBytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const now=Math.floor(Date.now()/1000);
 const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
 const payload=b64url(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
 const sig=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(header+'.'+payload)));
 const assertion=header+'.'+payload+'.'+b64url(sig);
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000)});
 const data=await r.json();
 if(!r.ok||!data.access_token)throw Error('FCM_AUTH_FAILED');
 return data.access_token as string;
}

async function sendComunidadPush({aviso,targets}:{aviso:any;targets:Array<{token:string;uid:string;plataforma:string}>}){
 if(!fcmSecret){
  return {sent:[],failed:targets.map(t=>({uid:t.uid,error:'FCM_NO_CONFIGURADO'}))};
 }
 const sa=JSON.parse(fcmSecret);
 const accessToken=await getFcmAccessToken(sa);
 const sent:string[]=[];
 const failed:Array<{uid:string;error:string}>=[];
 for(const t of targets){
  if(t.plataforma!=='web-fcm'){
   failed.push({uid:t.uid,error:'CANAL_LOCAL_SIN_PUSH_REMOTO'});
   continue;
  }
  try{
   const res=await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,{
    method:'POST',
    headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
    body:JSON.stringify({
     message:{
      token:t.token,
      notification:{
       title:`${aviso.actividad}: ${aviso.titulo}`.slice(0,120),
       body:String(aviso.detalle||'').slice(0,220)
      },
      data:{
       avisoId:String(aviso.id||''),
       actividad:String(aviso.actividad||''),
       tipo:String(aviso.tipo||'')
      },
      webpush:{
       fcm_options:{link:'https://ugiccba.com.ar/comunidad/'}
      }
     }
    }),
    signal:AbortSignal.timeout(10000)
   });
   if(res.ok){sent.push(t.token);}
   else{failed.push({uid:t.uid,error:`FCM_HTTP_${res.status}`});}
  }catch(err:any){
   failed.push({uid:t.uid,error:err?.message||'FCM_FETCH_ERROR'});
  }
 }
 return {sent,failed};
}

async function call(name:string,args:unknown,key=serviceKey,token=key){
 const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(20000)});
 const data=await r.json();if(!r.ok){const e:any=Error(data.message||'No se confirmó la operación.');e.status=r.status;e.code=data.code==='PT409'?'CONFLICTO':data.code==='42501'?'PERMISOS':(data.code==='22023'||data.code==='22007')?'VALIDACION':'SERVIDOR';throw e;}return data;
}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',headers={'Content-Type':'application/json;charset=UTF-8','Cache-Control':'no-store','Vary':'Origin',...(allowed(origin)&&origin?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 if(!allowed(origin))return new Response(JSON.stringify({ok:false,codigo:'PERMISOS',error:'Origen no habilitado.'}),{status:403,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return new Response(JSON.stringify({ok:false,codigo:'RUTA',error:'Usá POST autenticado.'}),{status:405,headers});
 try{
  if(Number(req.headers.get('content-length')||0)>1000000)throw Object.assign(Error('Carga demasiado grande.'),{status:413,code:'VALIDACION'});
  const raw=await req.text();if(new TextEncoder().encode(raw).length>1000000)throw Object.assign(Error('Carga demasiado grande.'),{status:413,code:'VALIDACION'});
  const body=JSON.parse(raw),path=body.path||'/api/operations',token=body.idToken||req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(path!=='/api/comunidad/feed'&&(typeof token!=='string'||!token||token.length>16000))throw Object.assign(Error('Ingresá con Google.'),{status:401,code:'SESION'});
  // Firebase tokens are verified cryptographically by configured PostgREST
  // third-party auth. Never decode an unverified JWT to establish identity.
  const handle=createHandler({rpc:(n:string,a:unknown)=>call(n,a),verify:async()=>{try{return await call('mc_identity',{},publicKey,token);}catch(_){throw Object.assign(Error('Sesión Google inválida. Volvé a ingresar.'),{status:401,code:'SESION'});}},notify:sendComunidadPush});
  const result=await handle({token,path,body});return new Response(JSON.stringify({apiVersion:2,backendVersion:'supabase-1.0.0',...result}),{status:200,headers});
 }catch(e:any){const code=e.code||'SERVIDOR',status=e.status&&e.status>=400&&e.status<=599?e.status:500;console.error(JSON.stringify({event:'MUNI_REQUEST_FAILED',code}));return new Response(JSON.stringify({ok:false,apiVersion:2,backendVersion:'supabase-1.0.0',codigo:code,error:e.code?e.message:'No se confirmó la operación. Reintentá con el mismo identificador.'}),{status,headers});}
});
