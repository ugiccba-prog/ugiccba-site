
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function portal(file){
 const html=fs.readFileSync(file,'utf8'),code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).join('\n');
 const values=new Map(),timers=[],events=new Map(),els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{value:'',innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){}}]));
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const c={document:{getElementById:id=>els.get(id)||null,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener:(name,fn)=>events.set(name,fn)},localStorage:storage,sessionStorage:storage,navigator:{onLine:false},setInterval(){},setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console,Muni360Sync:require('../assets/scripts/muni360-sync.js')};
 vm.createContext(c);vm.runInContext(fs.readFileSync("assets/scripts/muni360-time.js","utf8"),c);vm.runInContext(code,c);
 vm.runInContext("storageScope='teacher';areaActiva='Tenis';syncClient={queue:[]};datosDeporte={padron:[],asistencia:[],fichas:{}};asistTempDep={Prueba:'P'};semTempDep={Prueba:'V'};comidaTempDep={};cfgActual=()=>({});plantelActualNombres=()=>['Prueba'];renderVistaActiva=()=>{};toast=()=>{};writes=[];enviarOperacion=async p=>{writes.push(p);return true;};",c);
 for(const [id,value] of Object.entries({'sel-categoria':'Mini','sel-equipo':'A','input-fecha':'2026-11-10','sel-clima-clase':'N','sel-puntos-ciudad':''}))els.get(id).value=value;
 return {c,values,timers,els,events,run:s=>vm.runInContext(s,c)};
}
for(const file of ['muni360/index.html','muni360cyc/index.html']){
 test(file+': autoguardado conserva borrador antes de la red y envía asistencia y semáforo',async()=>{
  const p=portal(file);p.run('markDraft()');
  const saved=JSON.parse(p.values.get('muni360_asistencia_borrador:teacher:Tenis'));
  assert.equal(saved.asistencia.Prueba,'P');assert.equal(saved.semaforo.Prueba,'V');assert.equal(p.run('writes.length'),0);
  p.timers.at(-1)();await new Promise(setImmediate);
  assert.equal(p.run('writes.length'),1);assert.equal(p.run('writes[0].datos.Prueba'),'P | Sem:V');
  assert.equal(p.values.has('muni360_asistencia_borrador:teacher:Tenis'),false);
 });
 test(file+': cambio de cuenta o actividad cancela envío; fallo conserva borrador',async()=>{
  for(const change of ["storageScope='other'","areaActiva='Golf'"]){
   const p=portal(file);p.run('markDraft();'+change);p.timers.at(-1)();await new Promise(setImmediate);
   assert.equal(p.run('writes.length'),0);assert.ok(p.values.has('muni360_asistencia_borrador:teacher:Tenis'));
  }
  const p=portal(file);p.run('markDraft();enviarOperacion=async()=>false;');p.timers.at(-1)();await new Promise(setImmediate);
  assert.ok(p.values.has('muni360_asistencia_borrador:teacher:Tenis'));assert.notEqual(p.run('draftContext'),null);
 });
}

for(const file of ['muni360/index.html','muni360cyc/index.html']){
 test(file+': recuperar conexión retoma el borrador más reciente después de enviar pendientes',async()=>{
  const p=portal(file);p.run("markDraft();asistTempDep.Prueba='A';syncClient={queue:[{}],retry:async()=>{syncClient.queue=[];}};");
  await p.events.get('online')();p.timers.at(-1)();await new Promise(setImmediate);
  assert.equal(p.run('writes.length'),1);assert.equal(p.run('writes[0].datos.Prueba'),'A | Sem:V');
  assert.equal(p.values.has('muni360_asistencia_borrador:teacher:Tenis'),false);
 });
}
