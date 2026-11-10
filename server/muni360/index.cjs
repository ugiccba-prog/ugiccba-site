'use strict';
const http=require('node:http');
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldPath}=require('firebase-admin/firestore');
const {createStore}=require('./firestore-store.cjs');
const {createService}=require('./service.cjs');
const {createRuntime}=require('./runtime.cjs');
const areas=require('./activities.json');
if(!process.env.FIREBASE_PROJECT_ID || !process.env.BOOTSTRAP_ADMIN_UID)throw Error('Falta configurar Firebase y el propietario.');
initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID});
const allowed=(process.env.ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean);
if(!allowed.length||allowed.includes('*'))throw Error('Configurar orígenes concretos, sin comodines.');
const runtime=createRuntime(getFirestore());
const handle=createService({auth:getAuth(),store:createStore(getFirestore(),FieldPath),operations:runtime.data.execute,staging:runtime.projector.staging,areas,ownerUid:process.env.BOOTSTRAP_ADMIN_UID});
http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.url==='/health'&&req.method==='GET'){res.writeHead(200);res.end('ok');return;}
  const origin=req.headers.origin;
  if(!origin||!allowed.includes(origin)){res.writeHead(403);res.end();return;}
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  let bytes=0;const chunks=[];
  try {
    for await(const chunk of req){bytes+=chunk.length;if(bytes>140000){const e=Error('Solicitud demasiado grande.');e.status=413;e.code='VALIDACION';throw e;}chunks.push(chunk);}
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
    if(!body||typeof body!=='object'||Array.isArray(body))throw Object.assign(Error('Solicitud inválida.'),{status:400,code:'VALIDACION'});
    const result=await handle({authorization:req.headers.authorization,path:req.url,body});
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
  } catch(e) {
    if(e instanceof SyntaxError){e.status=400;e.code='VALIDACION';e.message='JSON inválido.';}
    res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,apiVersion:2,codigo:e.code||'SERVIDOR',error:e.code?e.message:'No se pudo completar la operación. Reintentá.'}));
  }
}).listen(Number(process.env.PORT||8080));
