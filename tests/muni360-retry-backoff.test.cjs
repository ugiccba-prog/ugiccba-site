const test=require('node:test'),assert=require('node:assert/strict');
const {Client}=require('../assets/scripts/muni360-sync.js');
const payload={tipo:'EVALUACION',deporte:'Tenis',categoria:'Ensayo',equipo:'A',fecha:'2026-11-11',jugador:'Persona',notas:{Pase:6.5}};
function fixture(random=()=>0){
 let clock=0,calls=0,online=false;const ids=[],values=new Map();
 const client=new Client({url:'https://example.invalid',transport:'http',session:{usuario:'profe-prueba',versionUsuario:'1',expiresAt:Date.now()+3600000},storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},lock:fn=>fn(),now:()=>clock,random,fetch:async(_,options)=>{
  calls++;const d=JSON.parse(options.body);ids.push(d.requestId);if(!online)throw Error('network');
  return {ok:true,json:async()=>({ok:true,apiVersion:2,requestId:d.requestId,revision:1})};
 }});
 client.snapshots.Tenis={versiones:{},temporada:1};
 return {client,ids,values,calls:()=>calls,clock:n=>{clock=n;},online:()=>{online=true;}};
}
test('reintentos: el temporizador respeta espera creciente y el intento manual conserva identificador y confirma',async()=>{
 const f=fixture();assert.equal(await f.client.enqueue(payload),false);const id=f.client.queue[0].payload.requestId;
 assert.equal(f.client.nextRetryAt,30000);await f.client.retry({automatic:true});assert.equal(f.calls(),1);
 f.clock(30000);await f.client.retry({automatic:true});assert.equal(f.calls(),2);assert.equal(f.client.nextRetryAt,90000);
 f.clock(60000);await f.client.retry({automatic:true});assert.equal(f.calls(),2);assert.equal(f.client.queue.length,1);
 assert.ok([...f.values.values()].some(text=>text.includes(id)));
 f.online();await f.client.retry();assert.equal(f.calls(),3);assert.equal(f.client.queue.length,0);
 assert.ok(f.ids.every(saved=>saved===id));assert.equal(f.client.retryFailures,0);assert.equal(f.client.nextRetryAt,0);
});
test('reintentos: los dispositivos se distribuyen en el tiempo y la espera maxima queda limitada a cinco minutos',async()=>{
 const a=fixture(()=>0),b=fixture(()=>0.9);await Promise.all([a.client.enqueue(payload),b.client.enqueue(payload)]);
 assert.equal(a.client.nextRetryAt,30000);assert.equal(b.client.nextRetryAt,34500);
 let now=0;for(let i=0;i<9;i++){now=b.client.nextRetryAt;b.clock(now);await b.client.retry({automatic:true});assert.ok(b.client.nextRetryAt-now<=300000);}
 assert.equal(b.client.nextRetryAt-now,300000);assert.equal(b.client.queue.length,1);
});
test('reintentos: no hay consultas sin pendientes y los conflictos no se reenvian solos',async()=>{
 const f=fixture();await f.client.retry({automatic:true});assert.equal(f.calls(),0);
 f.client.fetch=async()=>({ok:true,json:async()=>({ok:false,apiVersion:2,codigo:'CONFLICTO',error:'Otra persona modifico el registro'})});
 await f.client.enqueue(payload);assert.equal(f.client.queue[0].code,'CONFLICTO');
 let retries=0;f.client.fetch=async()=>{retries++;throw Error('No debe reenviar');};
 await f.client.retry({automatic:true});await f.client.retry();assert.equal(retries,0);assert.equal(f.client.queue.length,1);
});
