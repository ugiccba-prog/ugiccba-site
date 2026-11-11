
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function portal(file){
 const html=fs.readFileSync(file,'utf8'),code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).join('\n');
 const storage={getItem:()=>null,setItem(){},removeItem(){}},els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{value:'',innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){}}]));
 const c={document:{getElementById:id=>els.get(id),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},sessionStorage:storage,localStorage:storage,navigator:{onLine:false},setInterval(){},setTimeout(){},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console};
 vm.createContext(c);vm.runInContext(fs.readFileSync("assets/scripts/muni360-time.js","utf8"),c);vm.runInContext(code,c);
 const calls=[],renders=[];
 c.read=()=>new Promise((resolve,reject)=>calls.push({resolve,reject}));c.capture=rows=>renders.push(rows.map(p=>p.jugador));
 vm.runInContext("areaActiva='Tenis';storageScope='teacher';sesion={usuario:'teacher'};datosDeporte={padron:[{jugador:'Uno'},{jugador:'Dos'}],evaluaciones:[],asistencia:[],fichas:{}};syncClient={queue:[],snapshots:{Tenis:datosDeporte},read};renderFiltrosDeporte=()=>{};renderVistaActiva=()=>capture(datosDeporte.padron);renderHistorialUgiLocal=()=>{};ofrecerBorradorAsistencia=()=>{};toast=()=>{};",c);
 const payload=n=>({padron:Array.from({length:n},(_,i)=>({jugador:i<2?['Uno','Dos'][i]:'Tres'})),asistencia:[],evaluaciones:[{jugador:'Uno',notas:{Pase:6.5,Tiro:6.5}}],fichas:{},archivos:[],sheetsStatus:'synced'});
 return {calls,renders,run:s=>vm.runInContext(s,c),payload};
}
for(const file of ['muni360/index.html','muni360cyc/index.html']){
 test(file+': refrescar sin caché conserva los jugadores confirmados mientras espera la red',async()=>{
  const p=portal(file),done=p.run('cargarAreaActiva()');
  assert.equal(p.run('datosDeporte.padron.length'),2);assert.ok(p.renders.every(rows=>rows.length===2));
  p.calls[0].resolve(p.payload(2));await done;assert.equal(p.run('datosDeporte.evaluaciones[0].notas.Pase'),6.5);
 });
 test(file+': una falla de lectura conserva padrón y no lo convierte en lista vacía',async()=>{
  const p=portal(file),done=p.run('cargarAreaActiva()');p.calls[0].reject(Error('offline'));await done;
  assert.equal(p.run('datosDeporte.padron.length'),2);assert.ok(p.renders.every(rows=>rows.length===2));
 });
 test(file+': una respuesta anterior no pisa una actualización posterior de la misma actividad',async()=>{
  const p=portal(file),first=p.run('cargarAreaActiva()'),second=p.run('cargarAreaActiva()');
  p.calls[1].resolve(p.payload(3));await second;p.calls[0].resolve(p.payload(2));await first;
  assert.equal(p.run('datosDeporte.padron.length'),3);
 });
 test(file+': una respuesta de la cuenta anterior no aparece después de cambiar de sesión',async()=>{
  const p=portal(file),done=p.run('cargarAreaActiva()');
  p.run("sesion={usuario:'other'};storageScope='other';datosDeporte={padron:[],asistencia:[],evaluaciones:[]};");
  p.calls[0].resolve(p.payload(2));await done;assert.equal(p.run('datosDeporte.padron.length'),0);
 });
}

for(const file of ['muni360/index.html','muni360cyc/index.html']){
 test(file+': cambiar a una actividad sin datos no muestra el padrón de la actividad anterior',async()=>{
  const p=portal(file);p.run("areaActiva='Golf';");const done=p.run('cargarAreaActiva()');
  assert.equal(p.run('datosDeporte.padron.length'),0);p.calls[0].resolve(p.payload(0));await done;
 });
}
const {Client}=require('../assets/scripts/muni360-sync.js');
test('cliente: respuestas de lectura fuera de orden no reemplazan el último snapshot confirmado',async()=>{
 const pending=[],client=new Client({url:'test',session:{usuario:'u',expiresAt:Date.now()+60000},storage:{getItem:()=>null},getToken:async()=> 'test',lock:f=>f(),fetch:()=>new Promise(resolve=>pending.push(resolve))});
 const first=client.read('Tenis'),second=client.read('Tenis');await new Promise(setImmediate);
 const reply=version=>({ok:true,json:async()=>({apiVersion:2,ok:true,version})});
 pending[1](reply(2));await second;pending[0](reply(1));await first;
 assert.equal(client.snapshots.Tenis.version,2);
});
test('cliente: una lectura que termina después de cerrar sesión no repuebla los datos privados',async()=>{
 let resolve;const client=new Client({url:'test',session:{usuario:'u',expiresAt:Date.now()+60000},storage:{getItem:()=>null},getToken:async()=> 'test',lock:f=>f(),fetch:()=>new Promise(r=>resolve=r)});
 const reading=client.read('Tenis');await new Promise(setImmediate);client.stop();
 resolve({ok:true,json:async()=>({apiVersion:2,ok:true,version:1})});await reading;
 assert.deepEqual(client.snapshots,{});
});

for(const file of ['muni360/index.html','muni360cyc/index.html']){
 test(file+': un pendiente de otra actividad no impide consultar ni cargar el padrón actual',async()=>{
  const p=portal(file);p.run("syncClient.queue=[{payload:{deporte:'Golf'},error:'Sin acceso',code:'PERMISOS'}];syncClient.status=()=>{};");
  const done=p.run('cargarAreaActiva()');assert.equal(p.calls.length,1);
  p.calls[0].resolve(p.payload(2));await done;assert.equal(p.run('datosDeporte.padron.length'),2);assert.equal(p.run('syncClient.queue.length'),1);
 });
}
