const test=require('node:test'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const {environment}=require('./helpers/apps-script-env.cjs'),{Client}=require('../assets/scripts/muni360-sync.js');
const USERS=20,PLAYERS=20;
function setup(shared=false){
 const e=environment(),tokens=[],clients=[];e.ctx.Utilities.sleep=()=>{};
 for(let group=0;group<(shared?1:USERS);group++){
  assert.equal(e.write(e.owner,{tipo:'ALTA_PADRON',categoria:'Ensayo',equipo:'G'+group,jugadores:Array.from({length:PLAYERS},(_,i)=>({jugador:'Persona '+group+' '+i}))}).ok,true);
 }
 for(let i=0;i<USERS;i++){const token=e.identity('profe-carga-'+i);e.post(token,'/api/me');e.grant(token);tokens.push(token);}
 let reads=0,writes=0,maxBatchBytes=0;
 const sheets=e.ctx.Sheets.Spreadsheets,get=sheets.get,values=sheets.Values.batchGet,update=sheets.batchUpdate;
 sheets.get=(...a)=>{reads++;return get(...a);};sheets.Values.batchGet=(...a)=>{reads++;return values(...a);};
 sheets.batchUpdate=(body,id)=>{writes++;maxBatchBytes=Math.max(maxBatchBytes,Buffer.byteLength(JSON.stringify(body),'utf8'));return update(body,id);};
 function connect(token,store=new Map(),network={online:true,lose:false}){
  const profile=e.post(token,'/api/me').profile;
  const client=new Client({transport:'apps-script',url:'https://script.google.com/macros/s/TEST/exec',session:{usuario:profile.uid,versionUsuario:profile.version,rol:profile.rol,expiresAt:Date.now()+3600000},getToken:async()=>token,lock:fn=>fn(),
   storage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},fetch:async(_,options)=>{
    if(!network.online)throw Error('offline');
    const d=JSON.parse(options.body),result=e.ctx.doPost({postData:{contents:options.body}});
    if(network.lose&&d.tipo==='ASISTENCIA'){network.lose=false;throw Error('Response lost after commit');}
    return {ok:true,json:async()=>result};
   }});
  return {client,store,network};
 }
 for(const token of tokens)clients.push(connect(token));
 e.props.set('UGI_SYNC_ON_SAVE','true');
 function attendance(i,status='P'){const group=shared?0:i;return {tipo:'ASISTENCIA',deporte:'Tenis',categoria:'Ensayo',equipo:'G'+group,fecha:'2026-11-11',datos:Object.fromEntries(Array.from({length:PLAYERS},(_,p)=>['Persona '+group+' '+p,status+' | Sem:V']))};}
 return {e,clients,tokens,connect,attendance,stats:()=>({reads,writes,maxBatchBytes}),reset:()=>{reads=0;writes=0;maxBatchBytes=0;}};
}
function summary(t,scenario,start,f,extra={}){
 const result={scenario,usuariosSimulados:USERS,msLocales:Math.round(performance.now()-start),...f.stats(),...extra};
 t.diagnostic(JSON.stringify(result));
}
test('carga: 20 profes y 400 personas guardan grupos distintos sin perdida y con autoria individual',async t=>{
 const start=performance.now(),f=setup();await Promise.all(f.clients.map(a=>a.client.read('Tenis')));f.reset();
 const results=await Promise.all(f.clients.map((a,i)=>a.client.enqueue(f.attendance(i))));
 assert.ok(results.every(Boolean));assert.ok(f.clients.every(a=>a.client.queue.length===0));
 const count=f.stats();assert.ok(count.reads<=USERS*8,'presupuesto de lecturas por guardado con sincronizacion');
 const saved=f.e.ctx.loadActivityUGI(f.e.ctx.configUGI(),'Tenis');
 assert.equal(saved.state.asistencia.length,USERS*PLAYERS);
 const audits=Object.values(saved.audit).filter(a=>a.tipo==='ASISTENCIA');
 assert.equal(audits.length,USERS);assert.equal(new Set(audits.map(a=>a.uid)).size,USERS);
 f.e.ctx.syncActivityUGI(f.e.ctx.configUGI(),'Tenis');
 assert.equal(f.e.read().sheetsStatus,'synced');
 summary(t,'grupos-distintos',start,f,{guardados:results.length,lecturasPorGuardado:count.reads/USERS,escriturasPorGuardado:count.writes/USERS});
});
test('carga: 20 profes sobre el mismo grupo confirman uno y conservan 19 conflictos sin sobrescritura',async t=>{
 const start=performance.now(),f=setup(true);await Promise.all(f.clients.map(a=>a.client.read('Tenis')));f.reset();
 const results=await Promise.all(f.clients.map((a,i)=>a.client.enqueue(f.attendance(i,i?'A':'P'))));
 assert.equal(results.filter(Boolean).length,1);
 assert.equal(f.clients.filter(a=>a.client.queue[0]?.code==='CONFLICTO').length,USERS-1);
 await Promise.all(f.clients.map(a=>a.client.retry()));
 const saved=f.e.ctx.loadActivityUGI(f.e.ctx.configUGI(),'Tenis');
 assert.equal(saved.state.asistencia.length,PLAYERS);assert.ok(saved.state.asistencia.every(p=>p.estado==='P | Sem:V'));
 assert.equal(Object.values(saved.audit).filter(a=>a.tipo==='ASISTENCIA').length,1);
 summary(t,'mismo-grupo',start,f,{guardados:1,conflictosConservados:USERS-1});
});
test('carga: 20 colas sobreviven recarga offline y perdida de confirmacion sin duplicar recibos ni cambios',async t=>{
 const start=performance.now(),f=setup();await Promise.all(f.clients.map(a=>a.client.read('Tenis')));f.reset();
 f.clients.forEach(a=>{a.network.online=false;});
 await Promise.all(f.clients.map((a,i)=>a.client.enqueue(f.attendance(i))));
 const ids=f.clients.map(a=>a.client.queue[0].payload.requestId);
 assert.equal(f.e.read().asistencia.length,0);
 const reloaded=f.clients.map((a,i)=>f.connect(f.tokens[i],a.store,{online:true,lose:true}));
 await Promise.all(reloaded.map(a=>a.client.retry()));
 assert.ok(reloaded.every(a=>a.client.queue.length===1));assert.equal(f.e.read().asistencia.length,USERS*PLAYERS);
 await Promise.all(reloaded.map(a=>a.client.retry()));
 assert.ok(reloaded.every(a=>a.client.queue.length===0));
 const saved=f.e.ctx.loadActivityUGI(f.e.ctx.configUGI(),'Tenis');
 for(const id of ids){assert.equal(saved.receipts.filter(r=>r[0]===id).length,1);assert.ok(saved.audit[id]);}
 assert.equal(Object.values(saved.audit).filter(a=>a.tipo==='ASISTENCIA').length,USERS);
 summary(t,'offline-respuesta-perdida',start,f,{recibosUnicos:ids.length,pendientesFinales:0});
});
test('carga: cuota de 60 lecturas mantiene pendientes y permite recuperarlos por tandas sin perdida',async t=>{
 const start=performance.now(),f=setup();await Promise.all(f.clients.map(a=>a.client.read('Tenis')));f.reset();
 let now=0,window=[],rejected=0;f.e.ctx.Utilities.sleep=ms=>{now+=ms;};
 const sheets=f.e.ctx.Sheets.Spreadsheets;
 const limited=fn=>(...args)=>{window=window.filter(time=>time>now-60000);if(window.length>=60){rejected++;throw Object.assign(Error('Too many requests'),{code:429});}window.push(now);return fn(...args);};
 sheets.get=limited(sheets.get);sheets.Values.batchGet=limited(sheets.Values.batchGet);
 await Promise.all(f.clients.map((a,i)=>a.client.enqueue(f.attendance(i))));
 const initialPending=f.clients.reduce((n,a)=>n+a.client.queue.length,0);
 assert.ok(initialPending>0);assert.ok(rejected>0);
 for(let round=0;round<USERS&&f.clients.some(a=>a.client.queue.length);round++){now+=65000;await Promise.all(f.clients.map(a=>a.client.retry()));}
 assert.ok(f.clients.every(a=>!a.client.queue.length));now+=65000;
 const saved=f.e.ctx.loadActivityUGI(f.e.ctx.configUGI(),'Tenis');assert.equal(saved.state.asistencia.length,USERS*PLAYERS);
 assert.equal(Object.values(saved.audit).filter(a=>a.tipo==='ASISTENCIA').length,USERS);
 f.e.ctx.syncActivityUGI(f.e.ctx.configUGI(),'Tenis');
 assert.equal(f.e.read().sheetsStatus,'synced');
 assert.equal(f.e.books.get('tenis-public').find(tab=>tab.properties.title==='Asistencia').values.length,USERS*PLAYERS+1);
 summary(t,'cuota-simulada',start,f,{pendientesIniciales:initialPending,rechazosCuota:rejected,pendientesFinales:0,minutosVirtuales:Math.round(now/60000)});
});
