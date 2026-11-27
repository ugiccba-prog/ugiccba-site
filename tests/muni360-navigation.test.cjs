const {readPortal}=require('./helpers/portal-source.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const MuniImport=require('../assets/scripts/muni360-import.js');
function portal(path,activity){
 const html=readPortal(path),code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).join('\n');
 const listeners=new Map(),entries=[{state:null}],els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{value:'',innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){}}]));
 let index=0,confirms=0,confirmResult=true;
 const emit=(name,e)=>{for(const fn of listeners.get(name)||[])fn(e)};
 const history={
  get state(){return entries[index].state;},
  get length(){return entries.length;},
  replaceState(s){entries[index]={state:s};},
  pushState(s){entries.splice(index+1);entries.push({state:s});index=entries.length-1;},
  back(){if(index>0){index--;emit('popstate',{state:entries[index].state});}},
  forward(){if(index<entries.length-1){index++;emit('popstate',{state:entries[index].state});}}
 };
 const stored=new Map(),storage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
 const c={document:{getElementById:id=>els.get(id),querySelectorAll:()=>[],addEventListener(){}},
 window:{history,addEventListener:(name,cb)=>listeners.set(name,[...(listeners.get(name)||[]),cb]),scrollTo(){},MuniPortal:{hydrate(){}}},MuniImport,
 sessionStorage:storage,localStorage:storage,navigator:{onLine:false},setInterval(){},setTimeout(){},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console,
 confirm:()=>{confirms++;return confirmResult;}};
 vm.createContext(c);
 vm.runInContext(fs.readFileSync('assets/scripts/muni360-time.js','utf8'),c);
 vm.runInContext(code,c);
 const setup="sesion={usuario:'usuario-test',rol:'Dirección UGI',areas:["+JSON.stringify(activity)+"],capabilities:{administrarPadron:true,verDni:true}};"+
   "storageScope='usuario-test';areaActiva="+JSON.stringify(activity)+";"+
   "categoriasDep=()=>['Mini'];equiposDep=()=>['A','B'];"+
   "renderPortal=()=>{};renderVistaActiva=()=>{};actualizarBarraContexto=()=>{};"+
   "abrirGrupoPortal=(cat,eq)=>{$('sel-categoria').value=cat;$('sel-equipo').value=eq;return true;};"+
   "cargarAreaActiva=async()=>{};";
 vm.runInContext(setup,c);
 els.get('sel-categoria').value='Mini';els.get('sel-equipo').value='A';els.get('input-fecha').value='2026-11-22';
 return {history,entries,els,run:s=>vm.runInContext(s,c),get tab(){return vm.runInContext('tabActual',c)},setConfirm:value=>{confirmResult=value},get confirms(){return confirms}};
}
for(const [path,activity] of [['apps/muni360/source/deportes/index.html','Tenis'],['apps/muni360/source/colonia/index.html','Colonia'],['apps/muni360/source/colonia/index.html','COYFD']]){
 test(activity+': Chrome Atrás y Adelante recorren Mis grupos, Padrón e Inteligencia sin login',async()=>{
  const p=portal(path,activity);
  p.run("cambiarTab('inicio','replace');cambiarTab('equipos');cambiarTab('padron');cambiarTab('inteligencia')");
  assert.equal(p.tab,'inteligencia');assert.equal(p.history.length,4);
  assert.deepEqual(p.entries.map(x=>x.state.muni360Nav.tab),['inicio','equipos','padron','inteligencia']);
  p.history.back();await Promise.resolve();assert.equal(p.tab,'padron');
  p.history.back();await Promise.resolve();assert.equal(p.tab,'equipos');
  p.history.forward();await Promise.resolve();assert.equal(p.tab,'padron');
  assert.equal(p.run('sesion.usuario'),'usuario-test');
  assert.equal(p.history.state.muni360Nav.equipo,'A');
 });
 test(activity+': restaura el grupo previo y no permite acceder con otra cuenta',async()=>{
  const p=portal(path,activity);
  p.run("cambiarTab('inicio','replace');cambiarTab('equipos');cambiarTab('padron')");
  p.els.get('sel-equipo').value='B';p.els.get('input-fecha').value='2026-11-19';p.run("registrarRutaMuni('replace')");
  assert.equal(p.history.state.muni360Nav.equipo,'B');assert.equal(p.history.state.muni360Nav.fecha,'2026-11-19');
  p.history.back();await Promise.resolve();
  assert.equal(p.tab,'equipos');assert.equal(p.els.get('sel-equipo').value,'A');assert.equal(p.els.get('input-fecha').value,'2026-11-22');
  p.run("sesion.usuario='otro-usuario'");
  p.history.forward();await Promise.resolve();
  assert.equal(p.tab,'equipos');
 });
 test(activity+': recargar con sesión válida vuelve a la misma pestaña y grupo',async()=>{
  const p=portal(path,activity);
  p.run("cambiarTab('inicio','replace');cambiarTab('equipos');cambiarTab('padron')");
  p.els.get('input-fecha').value='2026-11-18';p.run("registrarRutaMuni('replace')");
  const initialLength=p.history.length;
  const prefix="almacen.setItem('muni360_modo_demo','1');"+
   "actualizarCabeceraYPestanas=()=>{};iniciarEleccionGrupo=()=>{};renderGuiaUgi=()=>{};"+
   "renderPlanificadorDua=()=>{};renderHistorialUgiLocal=()=>{};"+
   "sesion=null;tabActual='asistencia';";
  const session="iniciarSesion({usuario:'usuario-test',nombre:'Prueba',profeNombre:'Prueba',rol:'Dirección UGI',"+
    "areas:["+JSON.stringify(activity)+"],capabilities:{administrarPadron:true,verDni:true},area:"+JSON.stringify(activity)+",esAdminTotal:false});";
  p.run(prefix+session);await Promise.resolve();
  assert.equal(p.tab,'padron');assert.equal(p.history.length,initialLength);
  assert.equal(p.els.get('sel-categoria').value,'Mini');assert.equal(p.els.get('input-fecha').value,'2026-11-18');
 });
 test(activity+': borrador sin guardar bloquea cambio de grupo si se cancela',async()=>{
  const p=portal(path,activity);
  p.run("cambiarTab('inicio','replace');cambiarTab('padron')");
  p.els.get('sel-equipo').value='B';p.run("registrarRutaMuni('replace');draftContext={cat:'Mini',eq:'B',deporte:areaActiva,date:'2026-11-22'};");
  p.setConfirm(false);
  p.history.back();await Promise.resolve();
  assert.equal(p.tab,'padron');
  assert.equal(p.history.state.muni360Nav.tab,'padron');
  assert.equal(p.confirms,1);
 });
}
