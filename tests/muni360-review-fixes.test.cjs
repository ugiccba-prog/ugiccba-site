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

test('Muni360Sync: reviewAndRetry y discardFirst operan sobre el primer pendiente bloqueado sin descartar otros',async()=>{
  const {Client}=require('../assets/scripts/muni360-sync.js');
  const store=new Map();
  let online=false;
  const sent=[];
  const client=new Client({
    url:'https://example.invalid',
    transport:'supabase',
    storage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
    session:{usuario:'profe',versionUsuario:'v1',expiresAt:Date.now()+600000},
    getToken:async()=>'tok',
    lock:fn=>fn(),
    fetch:async(_,opt)=>{
      const body=JSON.parse(opt.body);
      sent.push(body);
      if(body.tipo==='LECTURA')return {ok:true,json:async()=>({ok:true,apiVersion:2,backendVersion:'supabase-1.0.0',temporada:1,versiones:{}})};
      if(body.tipo==='RESULTADO')return {ok:true,json:async()=>({ok:true,apiVersion:2,backendVersion:'supabase-1.0.0',committed:false})};
      if(!online&&body.deporte==='Tenis')throw Error('network');
      return {ok:true,json:async()=>({ok:true,apiVersion:2,backendVersion:'supabase-1.0.0',requestId:body.requestId,revision:1})};
    }
  });
  client.snapshots.Tenis={versiones:{},temporada:1,padron:[]};
  client.snapshots.Colonia={versiones:{},temporada:1,padron:[]};
  await client.enqueue({tipo:'EVALUACION',deporte:'Tenis',categoria:'Sub 12',equipo:'A',fecha:'2026-11-24',jugador:'Ana',notas:{Tiro:7}});
  assert.equal(client.queue.length,1);
  // Simular un pendiente bloqueado en Colonia después del pendiente offline de Tenis
  client.queue.push({payload:{tipo:'EVALUACION',deporte:'Colonia',categoria:'6 años',equipo:'General',fecha:'2026-11-24',jugador:'Luis',notas:{Tiro:8},requestId:'req-blocked-colonia-1234',revision:0,temporada:1},usuarioVersion:'v1',error:'Conflicto en Colonia',code:'CONFLICTO'});
  client.persist();
  // reviewAndRetry debe consultar RESULTADO/LECTURA de Colonia (queue[1]) y conservar Tenis (queue[0])
  await client.reviewAndRetry();
  assert.equal(client.queue.length,2);
  assert.equal(client.queue[0].payload.deporte,'Tenis');
  assert.equal(client.queue[1].payload.deporte,'Colonia');
  assert.equal(client.queue[1].error,undefined);
  assert.ok(sent.some(b=>b.deporte==='Colonia'&&b.tipo==='LECTURA'));
  assert.ok(!sent.some(b=>b.deporte==='Tenis'&&b.tipo==='LECTURA'));
  // Ahora sí con red activa, flush confirma Tenis y Colonia sin perder ninguno
  online=true;
  await client.flush();
  assert.equal(client.queue.length,0);
  // Agregar Tenis offline y Colonia bloqueado; discardFirst debe descartar solo Colonia
  online=false;
  await client.enqueue({tipo:'EVALUACION',deporte:'Tenis',categoria:'Sub 12',equipo:'A',fecha:'2026-11-24',jugador:'Ana',notas:{Tiro:7}});
  client.queue.push({payload:{tipo:'EVALUACION',deporte:'Colonia',categoria:'6 años',equipo:'General',fecha:'2026-11-24',jugador:'Luis',notas:{Tiro:9},requestId:'req-blocked-colonia-5678',revision:1,temporada:1},usuarioVersion:'v1',error:'Otro conflicto',code:'CONFLICTO'});
  client.persist();
  await client.discardFirst();
  assert.equal(client.queue.length,1);
  assert.equal(client.queue[0].payload.deporte,'Tenis');
});
