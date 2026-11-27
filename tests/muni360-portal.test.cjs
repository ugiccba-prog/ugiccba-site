const {readPortal}=require('./helpers/portal-source.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const portal=require('../assets/scripts/muni360-portal.js');
const data={padron:[{jugador:'Ana',categoria:'Sub 16',equipo:'A'},{jugador:'Belén',categoria:'Sub 16',equipo:'A'},{jugador:'Ana',categoria:'Sub 19',equipo:'B'}],asistencia:[
 {jugador:'Ana',categoria:'Sub 16',equipo:'A',fecha:'2026-11-17',estado:'T | Sem:A'},
 {jugador:'Ana',categoria:'Sub 16',equipo:'A',fecha:'2026-11-16',estado:'A | Sem:R'},
 {jugador:'Ana',categoria:'Sub 16',equipo:'A',fecha:'2026-11-15',estado:'N | Sem:N'},
 {jugador:'Ana',categoria:'Sub 19',equipo:'B',fecha:'2026-11-17',estado:'P | Sem:V'},
 {jugador:'Ana',categoria:'Sub 16',equipo:'A',fecha:'2026-11-18',estado:'P | Sem:V'},
 {jugador:'Ana',categoria:'Sub 16',equipo:'A',fecha:'2026-10-01',estado:'P | Sem:V'}
],evaluaciones:[
 {jugador:'Ana',categoria:'Sub 16',equipo:'A',fecha:'2026-11-17',notas:{Técnica:8,Inválida:0,Texto:'9'}},
 {jugador:'Ana',categoria:'Sub 16',equipo:'A',fecha:'2026-11-16',notas:{Técnica:6}},
 {jugador:'Ana',categoria:'Sub 19',equipo:'B',fecha:'2026-11-17',notas:{Técnica:10}}
]};
const context={player:'Ana',cat:'Sub 16',eq:'A',end:'2026-11-17',days:30};
test('comparación aísla grupo, fecha y período; T cuenta como presente y N queda fuera',()=>{
 const m=portal.playerSummary(data,context);assert.equal(m.total,2);assert.equal(m.attendance,50);assert.equal(m.late,1);assert.equal(m.absent,1);assert.equal(m.unmarked,1);assert.deepEqual(m.semaforo,{V:0,A:1,R:1});assert.deepEqual(m.dimensions.Técnica,{average:7,count:2});assert.equal(m.evaluations,2);assert.equal(m.dimensions.Inválida,undefined);
 assert.equal(portal.playerSummary(data,{...context,days:0}).total,3);
});
test('faltantes no se convierten en ceros, jugadores ajenos y fechas inválidas se rechazan',()=>{
 const m=portal.playerSummary(data,{...context,player:'Belén'});assert.equal(m.attendance,null);assert.deepEqual(m.dimensions,{});
 assert.equal(portal.playerSummary(data,{...context,player:'Fuera'}),null);assert.equal(portal.playerSummary(data,{...context,end:'2026-02-30'}),null);
 assert.throws(()=>portal.playerSummary(data,{...context,days:7}));
 assert.match(portal.comparison(data,{...context,players:['Ana','Belén']}),/Sin datos/);
 assert.match(portal.comparison(data,{...context,players:['Ana','Ana']}),/dos jugadores diferentes/);
});
test('textos externos quedan escapados y resumen excluye N y fechas futuras',()=>{
 const m=portal.summarize(data,'2026-11-17');assert.equal(m.total,3);assert.equal(m.present,2);
 assert.ok(!portal.views(data,'2026-11-17','<img onerror=x>',{rol:'Profe'}).inicio.includes('<img onerror=x>'));
});
function form(){
 const html=readPortal('apps/muni360/source/deportes/index.html');
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{value:'',innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){}}]));
 const values=new Map(),timers=[];const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const c={document:{getElementById:id=>elements.get(id),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},dispatchEvent(){}},Event:class Event{},localStorage:storage,sessionStorage:storage,navigator:{onLine:false},setInterval(){},setTimeout(fn){timers.push(fn);},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console};
 vm.createContext(c);vm.runInContext(fs.readFileSync('assets/scripts/muni360-time.js','utf8'),c);vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n'),c);
 const run=s=>vm.runInContext(s,c);run("storageScope='teacher';areaActiva='Hockey';sesion={rol:'Profe'};syncClient={queue:[]};plantelActualNombres=()=>['Ana','Belén'];toast=()=>{};writes=[];enviarOperacion=async p=>{writes.push(p);return true;};");
 for(const[id,value]of Object.entries({'sel-categoria':'Sub 16','sel-equipo':'A','input-fecha':'2026-11-17'}))elements.get(id).value=value;
 return {run,values,timers,elements};
}
test('lista parcial queda como borrador sin envío automático, pero permite guardar manualmente',async()=>{
 const f=form();f.run("asistTempDep={Ana:'T',Belén:'A'};semTempDep={Ana:'V'};renderVistaActiva=()=>{};cfgActual=()=>({});markDraft();");
 assert.equal(f.timers.length,0);assert.ok(f.values.has('muni360_asistencia_borrador:teacher:Hockey'));assert.equal(f.elements.get('btn-guardar-asist').disabled,false);
 f.run("semTempDep.Belén='R';markDraft();");assert.equal(f.elements.get('btn-guardar-asist').disabled,false);assert.equal(f.timers.length,1);
 await f.run('guardarAsistenciaActual()');assert.equal(f.run('writes.length'),1);
});
test('evaluación recupera borrador sólo para la misma cuenta, grupo, fecha y jugador',()=>{
 const f=form();f.run("jugadorActivo='Ana';notasTemp={Tiro:8.5};guardarBorradorEvaluacion();notasTemp={};recuperarBorradorEvaluacion();");
 assert.equal(f.run('notasTemp.Tiro'),8.5);assert.equal(f.run('writes.length'),0);
 f.run("storageScope='otra';notasTemp={};recuperarBorradorEvaluacion();");assert.equal(f.run('notasTemp.Tiro'),undefined);
 f.run("storageScope='teacher';jugadorActivo='Belén';recuperarBorradorEvaluacion();");assert.equal(f.run('notasTemp.Tiro'),undefined);
});
test('guardado conserva clima y puntos; un segundo envío idéntico no duplica la carga',async()=>{
 const f=form();f.run("asistTempDep={Ana:'P',Belén:'T'};semTempDep={Ana:'V',Belén:'A'};renderVistaActiva=()=>{};cfgActual=()=>({});");
 f.elements.get('sel-clima-clase').value='Fuego';f.elements.get('sel-puntos-ciudad').value='0';
 await f.run('guardarAsistenciaActual()');await f.run('guardarAsistenciaActual()');assert.equal(f.run('writes.length'),1);
 assert.equal(f.run('datosDeporte.asistencia[0].clima'),'Fuego');assert.equal(f.run('datosDeporte.asistencia[0].puntosCiudad'),'0');
});

 test('aviso de guardado desaparece sin ocultar pendientes ni nuevos cambios',async()=>{
  const f=form();f.run("asistTempDep={Ana:'P',Belén:'T'};semTempDep={Ana:'V',Belén:'A'};renderVistaActiva=()=>{};cfgActual=()=>({});");
  await f.run('guardarAsistenciaActual()');assert.equal(f.elements.get('draft-status').textContent,'Asistencia guardada.');
  f.timers.at(-1)();assert.equal(f.elements.get('draft-status').textContent,'');
  f.elements.get('draft-status').textContent='Asistencia pendiente de confirmación';f.timers.at(-1)();assert.equal(f.elements.get('draft-status').textContent,'Asistencia pendiente de confirmación');
 });
