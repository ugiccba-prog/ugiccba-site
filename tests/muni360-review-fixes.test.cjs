const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const audit=require('../assets/scripts/muni360-audit.js'),ui=require('../assets/scripts/muni360-ui.js');
test('auditoría empareja personas sin depender del orden y muestra sólo campos cambiados',()=>{
 const a={jugadorId:'a',jugador:'Ana',categoria:'3',equipo:'General',fecha:'2026-11-22',estado:'P',notas:{Tiro:6}},b={...a,jugadorId:'b',jugador:'Belén'};
 const rows=audit.changes([a,b],[b,{...a,notas:{Tiro:8}}]);assert.equal(rows.length,1);assert.match(rows[0].person,/Ana/);assert.equal(rows[0].before,'6');assert.equal(rows[0].after,'8');assert.match(rows[0].field,/Tiro/);
 assert.ok(audit.changes([], [a]).length>0);assert.ok(audit.changes([a], []).length>0);
 const html=audit.render(null,{detalle:'<img onerror=x>'});assert.ok(!html.includes('<img onerror=x>'));assert.match(html,/&lt;img/);assert.match(html,/Ver detalle técnico completo/);
});
test('carga parcial mantiene el porcentaje observado pero identifica cobertura y jornada',()=>{
 const data={padron:Array.from({length:26},(_,i)=>({jugador:'Persona '+i,categoria:'5y6',equipo:'B'})),asistencia:Array.from({length:9},(_,i)=>({jugador:'Persona '+i,categoria:'5y6',equipo:'B',fecha:'2026-11-22',estado:i===8?'A':'P'})),evaluaciones:[]};
 const views=ui.views(data,'2026-11-23','Colonia',{rol:'Dirección UGI'},{cat:'5y6',eq:'B'});
 assert.match(views.inicio,/89%/);assert.match(views.inicio,/Carga incompleta: 9 de 26/);assert.match(views.equipos,/Grupos y participantes/);
 assert.equal(ui.summarize(data,'2026-11-23').pending,17);
});
test('una ausencia sola no genera tendencia; la señal necesita tres jornadas',()=>{
 assert.equal(ui.attendanceSignal(0,0).low,false);assert.equal(ui.attendanceSignal(0,1).low,false);assert.equal(ui.attendanceSignal(1,2).low,false);assert.equal(ui.attendanceSignal(2,3).low,true);assert.equal(ui.attendanceSignal(3,3).low,false);assert.equal(ui.attendanceSignal(7,10).low,false);
});
test('Comunidad retira el banner de carga al resolver vacío, error y reintento',async()=>{
 const source=fs.readFileSync('comunidad/comunidad.js','utf8');
 const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',className:'',querySelector(){return null;}});return elements.get(id);};
 const c=vm.createContext({$,esc:s=>String(s),vistaActual:'avisos',feedState:{loading:false,error:'',avisos:[]},bannerAvisosMensaje:null,authState:{},TIPO_ETIQUETAS:{},fetchPublicFeed:async()=>[]});
 for(const [start,end]of [['function mostrarEstado','function cambiarVista'],['function filtrosActuales','function renderAvisos'],['function renderAvisos','function renderHorarios'],['async function cargarAvisos','async function sincronizarSesion']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),c);
 await vm.runInContext('cargarAvisos()',c);assert.equal($('estado-avisos').className,'estado-banner hidden');assert.match($('vista-avisos').innerHTML,/No hay avisos/);
 c.fetchPublicFeed=async()=>{throw Error('Sin conexión');};await vm.runInContext('cargarAvisos()',c);assert.match($('estado-avisos').innerHTML,/Sin conexión/);assert.match($('estado-avisos').innerHTML,/Reintentar/);
 c.fetchPublicFeed=async()=>[];await vm.runInContext('cargarAvisos()',c);assert.equal($('estado-avisos').innerHTML,'');
});
