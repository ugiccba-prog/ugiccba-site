const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const {environment}=require('./helpers/apps-script-env.cjs');
const attendance={tipo:'ASISTENCIA',categoria:'Sub 12',equipo:'A',fecha:'2026-11-10',datos:{'Persona de prueba':'N | Sem:N'}};
const evaluation={tipo:'EVALUACION',categoria:'Sub 12',equipo:'A',fecha:'2026-11-10',jugador:'Persona de prueba',notas:{Pase:8}};
test('GAS: Google valida el token, proyecto, proveedor, correo, caducidad y revocación',()=>{
  const e=environment();assert.equal(e.post('inventado','/api/me').codigo,'SESION');
  for(const options of [{claims:{aud:'otro-proyecto'}},{claims:{iss:'https://malicioso.invalid'}},{claims:{exp:0}},{claims:{auth_time:0},account:{validSince:'100'}},{account:{disabled:true}},{account:{emailVerified:false}},{claims:{firebase:{sign_in_provider:'password'}}},{claims:{sub:'otra-cuenta'}}])assert.equal(e.post(e.identity('new',options),'/api/me').codigo,'SESION');
  e.faults.lookup=429;assert.equal(e.post(e.owner,'/api/me').codigo,'RED');
});
test('GAS: altas pendientes no acceden a datos, sólo dueño administra; no hay autoascenso',()=>{
  const e=environment(),newcomer=e.identity('new');assert.equal(e.post(newcomer,'/api/me').profile.status,'pendiente');assert.equal(e.read(newcomer).codigo,'PENDIENTE');
  assert.equal(e.post(e.teacher,'/api/users/list').codigo,'PERMISOS');
  const owner=e.post(e.owner,'/api/users/list').users.find(x=>x.uid==='owner');assert.equal(e.post(e.owner,'/api/users/update',{uid:'owner',revision:owner.revision}).codigo,'PERMISOS');
  assert.equal(e.post(e.teacher,'/api/operations',{tipo:'RESET_DATOS',deporte:'Tenis',rol:'Dirección UGI',uid:'owner'}).codigo,'PERMISOS');
});
test('GAS: profes cubren todos los equipos habilitados sin DNI, sin otra actividad',()=>{
  const e=environment();assert.equal(e.seed().ok,true);assert.equal(e.write(e.owner,{tipo:'ALTA_PADRON',categoria:'Sub 12',equipo:'B',jugadores:[{jugador:'Otra persona',dni:'87654321'}]}).ok,true);
  const r=e.read(e.teacher);assert.equal(r.padron.length,2);assert.ok(r.padron.every(p=>p.dni===''));assert.equal(e.read(e.teacher,'Golf').codigo,'PERMISOS');
  assert.equal(e.write(e.teacher,attendance).ok,true);assert.equal(e.write(e.teacher,{...attendance,equipo:'B',datos:{'Otra persona':'P | Sem:V'}}).ok,true);
});
test('GAS: guardar y releer no altera hashes, conserva evaluaciones, sesiones y semáforos',()=>{
  const e=environment();e.seed();assert.equal(e.write(e.teacher,attendance).ok,true);assert.equal(e.write(e.teacher,evaluation).ok,true);assert.equal(e.write(e.teacher,{tipo:'SESION_UGI',foco:'Pase',nota:''}).ok,true);assert.equal(e.write(e.teacher,{...evaluation,notas:{Pase:9}}).ok,true);
  const r=e.read(e.owner);assert.equal(r.asistencia[0].estado,'N | Sem:N');assert.equal(r.evaluaciones[0].notas.Pase,9);assert.equal(r.sesiones.length,1);
});
test('GAS: operación, versión y auditoría son atómicas; respuesta perdida se reintenta sin duplicar',()=>{
  const e=environment();e.seed();const profile=e.post(e.teacher,'/api/me').profile,snap=e.read(e.teacher),d={...attendance,deporte:'Tenis',requestId:crypto.randomUUID(),revision:0,temporada:snap.temporada,accessVersion:profile.version,rosterRevision:snap.versiones[e.ctx.resource({tipo:'PADRON',categoria:attendance.categoria,equipo:attendance.equipo})]||0,roster:snap.padron.map(p=>[p.id,p.jugador])};
  e.faults.write='private';assert.equal(e.post(e.teacher,'/api/operations',d).ok,false);assert.equal(e.read().asistencia.length,0);e.faults.write=false;
  e.faults.ack='private';assert.equal(e.post(e.teacher,'/api/operations',d).ok,false);assert.equal(e.read().asistencia.length,1);assert.equal(e.post(e.teacher,'/api/operations',d).ok,true);
  const audit=e.post(e.teacher,'/api/operations',{tipo:'AUDITORIA',deporte:'Tenis'});assert.equal(audit.events.length,1);assert.equal(e.post(e.teacher,'/api/operations',{...d,datos:{'Persona de prueba':'P | Sem:V'}}).codigo,'CONFLICTO');
  const batches=e.requests.filter(x=>x.id==='private'&&x.body.requests.some(r=>r.addSheet?.properties.title.endsWith('Asistencia')));assert.ok(batches.length);
});
test('GAS: dos profes sobre la misma lista, plantel cambiado y sesión con permisos viejos bloquean reemplazos',()=>{
  const e=environment();e.seed();const p=e.post(e.teacher,'/api/me').profile,s=e.read(e.teacher),d={...attendance,deporte:'Tenis',requestId:crypto.randomUUID(),revision:0,temporada:s.temporada,accessVersion:p.version,rosterRevision:s.versiones[e.ctx.resource({tipo:'PADRON',categoria:attendance.categoria,equipo:attendance.equipo})]||0,roster:s.padron.map(p=>[p.id,p.jugador])};
  assert.equal(e.post(e.teacher,'/api/operations',d).ok,true);assert.equal(e.post(e.teacher,'/api/operations',{...d,requestId:crypto.randomUUID()}).codigo,'CONFLICTO');
  e.grant();assert.equal(e.post(e.teacher,'/api/operations',{...d,revision:1,requestId:crypto.randomUUID()}).codigo,'CONFLICTO');
  assert.equal(e.write(e.teacher,{...evaluation,roster:[]}).codigo,'CONFLICTO');
});
test('GAS: suspensión, vencimiento y permisos especiales rigen en cada solicitud',()=>{
  const e=environment();e.seed();e.grant(e.teacher,{status:'suspendido'});assert.equal(e.read(e.teacher).codigo,'PENDIENTE');
  e.grant(e.teacher,{rol:'Consulta'});assert.equal(e.write(e.teacher,attendance).codigo,'PERMISOS');
  assert.equal(e.grant(e.teacher,{rol:'Reemplazante'}).codigo,'VALIDACION');
  assert.equal(e.grant(e.teacher,{rol:'Reemplazante',expiresAt:'2000-01-01T00:00:00Z'}).codigo,'VALIDACION');
  e.grant(e.teacher,{rol:'Coordinación',capabilities:{verDni:false,verLegajo:false}});assert.equal(e.read(e.teacher).padron[0].dni,'');
});
test('GAS: auditoría real conserva autor y antes/después; profe no recibe notas de otros',()=>{
  const e=environment();e.seed();const p=e.read().padron[0],base={categoria:p.categoria,equipo:p.equipo,jugador:p.jugador,subjectId:p.id};
  assert.equal(e.write(e.owner,{...base,tipo:'LEGAJO',ficha:{estadoPlan:'',paseInterno:'NOTA PRIVADA',actividadesSimultaneas:[],bitacora:[{id:'uno',fecha:'2026-11-10',tipo:'Nota',detalle:'PRIVADO',autor:'forjado'}]}}).ok,true);
  assert.equal(e.write(e.teacher,{...base,tipo:'RECONOCIMIENTO',fecha:'2026-11-10',motivo:'Compañerismo'}).ok,true);
  const logs=e.post(e.teacher,'/api/operations',{tipo:'AUDITORIA',deporte:'Tenis'}).events;assert.equal(logs.length,1);
  const detail=e.post(e.teacher,'/api/operations',{tipo:'AUDITORIA',deporte:'Tenis',auditId:logs[0].id});assert.ok(!JSON.stringify(detail).includes('PRIVADO'));assert.equal(detail.autor,'teacher');assert.equal(detail.despues.length,1);
  assert.ok(!JSON.stringify(e.read(e.teacher)).includes('PRIVADO'));assert.ok(JSON.stringify(e.read()).includes('owner (Tenis)'));
});
test('GAS: archiva datos, sesiones y fichas sin borrar historia; falla atómica deja la temporada intacta',()=>{
  const e=environment();e.seed();e.write(e.teacher,attendance);e.write(e.teacher,{tipo:'SESION_UGI',foco:'Pase'});
  e.faults.write='private';assert.equal(e.write(e.owner,{tipo:'RESET_DATOS',modo:'TODO'}).ok,false);e.faults.write=false;assert.equal(e.read().asistencia.length,1);
  assert.equal(e.write(e.owner,{tipo:'RESET_DATOS',modo:'TEMPORADA'}).ok,true);const r=e.read();assert.equal(r.asistencia.length,0);assert.equal(r.sesiones.length,0);assert.equal(r.padron.length,1);assert.equal(r.archivos.length,1);assert.equal(e.read(e.owner,'Tenis',{temporada:r.archivos[0].id}).asistencia.length,1);
});
test('GAS: vistas públicas sin DNI, legajo ni notas de sesiones; caída de vista no pierde original',()=>{
  const e=environment();e.seed();e.write(e.teacher,attendance);e.write(e.owner,{tipo:'SESION_UGI',foco:'Privado',nota:'SECRETO'});
  const c=e.ctx.configUGI();e.faults.write='tenis-public';assert.throws(()=>e.ctx.syncActivityUGI(c,'Tenis'));assert.equal(e.read().asistencia.length,1);assert.equal(e.read().sheetsStatus,'pending');
  e.faults.write=false;e.ctx.syncActivityUGI(c,'Tenis');assert.equal(e.read().sheetsStatus,'synced');const values=JSON.stringify(e.books.get('tenis-public'));assert.ok(!values.includes('12345678'));assert.ok(!values.includes('SECRETO'));assert.ok(values.includes('Persona de prueba'));
});
test('GAS: validación rechaza datos inválidos antes de cualquier escritura',()=>{
  const e=environment();e.seed();const count=e.read().version;
  for(const d of [{...attendance,fecha:'2026-02-30'},{...attendance,datos:{}},{...attendance,datos:{'Desconocido':'P | Sem:V'}},{...evaluation,notas:{Pase:11}},{...evaluation,notas:{constructor:5}},{...attendance,datos:{'Persona de prueba':['P | Sem:V']}},{tipo:'ALTA_PADRON',categoria:'Sub 12',equipo:'A',jugadores:[{jugador:'Otra',dni:12345678}]},{tipo:'SESION_UGI',foco:'Pase',nota:{dato:'objeto'}},{tipo:'RESET_DATOS',modo:'INVALIDO'}])assert.equal(e.write(e.owner,d).ok,false);
  assert.equal(e.read().version,count);
});
test('GAS: valores tipo fórmula se guardan como texto y manipulación manual se detecta',()=>{
  const e=environment();assert.equal(e.write(e.owner,{tipo:'ALTA_PADRON',categoria:'Sub 12',equipo:'A',jugadores:[{jugador:'=IMPORTXML("test")'}]}).ok,true);
  const writes=e.requests.flatMap(x=>x.body.requests).filter(r=>r.updateCells).flatMap(r=>r.updateCells.rows).flatMap(r=>r.values);assert.ok(writes.some(c=>c.userEnteredValue.stringValue==='=IMPORTXML("test")'));assert.ok(writes.every(c=>!c.userEnteredValue.formulaValue));
  const tab=e.books.get('private').find(t=>t.properties.title.endsWith('_Padron'));tab.values[1][2]='Cambio manual';assert.equal(e.write(e.owner,{tipo:'GESTOS',gestos:['Pase']}).codigo,'DATOS_EDITADOS');
});
test('GAS: no recibe datos en GET, JSON inválido, rutas inválidas y bloqueo ocupado se informan',()=>{
  const e=environment();assert.equal(e.ctx.doGet({parameter:{deporte:'Tenis',token:e.owner}}).padron,undefined);assert.equal(e.ctx.doPost({postData:{contents:'{'}}).codigo,'VALIDACION');assert.equal(e.post(e.owner,'/api/otro').codigo,'RUTA');e.faults.busy=true;assert.equal(e.read().codigo,'RED');
});
test('cliente GAS: POST simple evita preflight; token no va en URL ni en pendientes; confirma backend exacto',async()=>{
  const e=environment();e.seed();const me=e.post(e.teacher,'/api/me').profile,{Client}=require('../assets/scripts/muni360-sync.js'),store=new Map(),calls=[];
  const client=new Client({transport:'apps-script',url:'https://script.google.com/macros/s/TEST/exec',fetch:async(url,opt)=>{calls.push({url,opt});return {ok:true,json:async()=>e.ctx.doPost({postData:{contents:opt.body}})};},storage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},session:{usuario:me.uid,versionUsuario:me.version,expiresAt:Number.MAX_SAFE_INTEGER},getToken:async()=>e.teacher,lock:fn=>fn()});
  await client.read('Tenis');assert.equal(await client.enqueue({...attendance,deporte:'Tenis'}),true);assert.equal(e.read().asistencia.length,1);assert.equal(calls[0].opt.headers['Content-Type'],'text/plain;charset=UTF-8');assert.equal(calls[0].opt.headers.Authorization,undefined);assert.ok(calls.every(c=>!c.url.includes(e.teacher)));assert.ok(![...store.values()].join('').includes(e.teacher));
});
test('GAS: identidad estable entre actividades, baja/alta y corrección de DNI sin heredar otra ficha',()=>{
  const e=environment();e.seed();const p=e.read().padron[0];
  assert.equal(e.write(e.owner,{tipo:'ALTA_PADRON',deporte:'Golf',categoria:'Inicial',equipo:'General',jugadores:[{jugador:'Persona de prueba',dni:'12345678'}]}).ok,true);assert.equal(e.read(e.owner,'Golf').padron[0].id,p.id);
  assert.equal(e.write(e.owner,{tipo:'BAJA_PADRON',categoria:p.categoria,equipo:p.equipo,jugador:p.jugador}).ok,true);assert.equal(e.seed().ok,true);assert.equal(e.read().padron[0].id,p.id);
  assert.equal(e.write(e.owner,{tipo:'LEGAJO',categoria:p.categoria,equipo:p.equipo,jugador:p.jugador,subjectId:p.id,ficha:{dni:'11112222',bitacora:[],actividadesSimultaneas:[]}}).ok,true);assert.equal(e.read().padron[0].id,p.id);
  assert.equal(e.write(e.owner,{tipo:'ALTA_PADRON',categoria:'Sub 14',equipo:'B',jugadores:[{jugador:'Distinta persona',dni:'12345678'}]}).codigo,'CONFLICTO');
});
test('GAS: consulta de recibo permite revisar una respuesta perdida sin duplicar una sesión',async()=>{
  const e=environment(),{Client}=require('../assets/scripts/muni360-sync.js'),me=e.post(e.teacher,'/api/me').profile,values=new Map();let lose=true;
  const c=new Client({transport:'apps-script',url:'https://script.google.com/macros/s/TEST/exec',storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},session:{usuario:me.uid,versionUsuario:me.version,expiresAt:Date.now()+600000},getToken:async()=>e.teacher,lock:fn=>fn(),fetch:async(_,options)=>{const d=JSON.parse(options.body),result=e.ctx.doPost({postData:{contents:options.body}});if(lose&&d.tipo==='SESION_UGI'){lose=false;throw Error('response lost');}return {ok:true,json:async()=>result};}});
  await c.read('Tenis');assert.equal(await c.enqueue({tipo:'SESION_UGI',deporte:'Tenis',foco:'Pase'}),false);assert.equal(e.read().sesiones.length,1);await c.reviewAndRetry();assert.equal(c.queue.length,0);assert.equal(e.read().sesiones.length,1);
});
test('GAS: datos sin DNI en una alta no borran el DNI ya cargado; claves con espacios/caso comparten conflicto',()=>{
  const e=environment();e.seed();assert.equal(e.write(e.owner,{tipo:'ALTA_PADRON',categoria:'Sub 12',equipo:'A',jugadores:[{jugador:'Persona de prueba'}]}).ok,true);assert.equal(e.read().padron[0].dni,'12345678');
  assert.equal(e.ctx.resource({tipo:'ASISTENCIA',categoria:' Sub 12 ',equipo:'a',fecha:'2026-11-10'}),e.ctx.resource({...attendance}));
});
test('importación: encabezados explícitos, acentos, DNI y duplicados; no adivina columnas de categoría',()=>{
  const {parse}=require('../assets/scripts/muni360-import.js');assert.deepEqual(parse([['Apellido','Nombre','DNI','Categoría'],['Pérez','Juan','12345678','Mini']]),[{jugador:'Pérez, Juan',dni:'12345678'}]);
  assert.deepEqual(parse([['Jugador'],['Persona, Uno'],['Persona, Dos']]),[{jugador:'Persona, Uno'},{jugador:'Persona, Dos'}]);
  for(const rows of [[['Equipo'],['A']],[['Jugador'],['Pepe'],[' Pepe ']],[['Jugador','DNI'],['Pepe','invalido']],[['Jugador'],...Array.from({length:501},(_,i)=>['Persona '+i])]])assert.throws(()=>parse(rows));
});
test('SheetJS local actualizado puede importar y exportar un libro real con acentos, números y fórmulas como texto',()=>{
  const XLSX=require('../assets/vendor/xlsx-0.20.3.full.min.js');assert.equal(XLSX.version,'0.20.3');const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([['Jugador','DNI'],['Pérez, Juan','12345678'],['=1+1','']]);XLSX.utils.book_append_sheet(wb,ws,'Padrón');const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),round=XLSX.read(buffer,{type:'buffer',sheetRows:502,cellHTML:false,cellFormula:false});const rows=XLSX.utils.sheet_to_json(round.Sheets['Padrón'],{header:1,defval:''});assert.equal(rows[1][0],'Pérez, Juan');assert.equal(round.Sheets['Padrón'].A3.t,'s');
});
test('GAS: plantel de 500, historial acumulado y append no reescriben auditorías anteriores',()=>{
  const e=environment(),players=Array.from({length:500},(_,i)=>({jugador:'Persona '+i}));assert.equal(e.write(e.owner,{tipo:'ALTA_PADRON',categoria:'Sub 12',equipo:'A',jugadores:players}).ok,true);
  const datos=Object.fromEntries(players.map(p=>[p.jugador,'P | Sem:V']));
  for(let i=1;i<=12;i++)assert.equal(e.write(e.teacher,{...attendance,fecha:'2026-11-'+String(i).padStart(2,'0'),datos}).ok,true);
  const last=e.requests.filter(r=>r.id==='private').at(-1),tabs=e.books.get('private'),aud= tabs.find(t=>t.properties.title.endsWith('_Auditoria'));
  const auditRequests=last.body.requests.filter(r=>r.updateCells?.range.sheetId===aud.properties.sheetId);assert.equal(auditRequests.length,1);assert.ok(auditRequests[0].updateCells.range.startRowIndex>1);assert.ok(JSON.stringify(last.body).length<1000000);assert.equal(e.read().asistencia.length,6000);assert.equal(e.write(e.owner,{tipo:'RESET_DATOS',modo:'TEMPORADA'}).ok,true);const current=e.read();assert.equal(e.read(e.owner,'Tenis',{temporada:current.archivos[0].id}).asistencia.length,6000);e.ctx.syncActivityUGI(e.ctx.configUGI(),'Tenis');assert.equal(e.read().sheetsStatus,'synced');const view=e.books.get('tenis-public').find(t=>t.properties.title==='HistorialAsistencia');assert.equal(view.values.length,6001);
});
test('GAS: respaldo privado no se duplica en el día y no se confirma si falla la copia',()=>{
  const e=environment();e.props.set('UGI_BACKUP_FOLDER_ID','backups');let copied=0,fail=false;
  const resource={getSharingAccess:()=> 'private',getViewers:()=>[],getEditors:()=>[],getName:()=> 'test',isTrashed:()=>false,getId:()=> 'backup-1',makeCopy(){if(fail)throw Error('Drive full');copied++;return this;}};
  e.ctx.Session={getEffectiveUser:()=>({getEmail:()=> 'owner@example.invalid'})};e.ctx.DriveApp={Access:{PRIVATE:'private'},getFileById:()=>resource,getFolderById:()=>resource};
  assert.equal(e.ctx.realizarBackupSemanal().ok,true);assert.equal(e.ctx.realizarBackupSemanal().ok,true);assert.equal(copied,1);
  e.props.delete('UGI_ULTIMO_BACKUP');fail=true;assert.throws(()=>e.ctx.realizarBackupSemanal());assert.equal(JSON.parse(e.props.get('UGI_ULTIMO_BACKUP')).ok,false);
  fail=false;resource.getViewers=()=>[{}];assert.throws(()=>e.ctx.realizarBackupSemanal());assert.equal(copied,1);
});
test('GAS: alta e edición de legajo concurrentes no pisan la corrección de DNI hecha desde otra pantalla',()=>{
  for(const first of ['ALTA_PADRON','LEGAJO']){
    const e=environment();e.seed();const s=e.read(),p=s.padron[0],me=e.post(e.owner,'/api/me').profile,other=first==='ALTA_PADRON'?'LEGAJO':'ALTA_PADRON';
    const change=(tipo,dni)=>tipo==='ALTA_PADRON'?{tipo,categoria:p.categoria,equipo:p.equipo,jugadores:[{jugador:p.jugador,dni}]}:{tipo,categoria:p.categoria,equipo:p.equipo,jugador:p.jugador,subjectId:p.id,ficha:{dni,bitacora:[],actividadesSimultaneas:[]}};
    const stale=change(other,'33334444'),key=e.ctx.resource(stale),group=e.ctx.resource({tipo:'PADRON',categoria:p.categoria,equipo:p.equipo});
    const old={...stale,deporte:'Tenis',requestId:crypto.randomUUID(),revision:s.versiones[key]||0,temporada:s.temporada,accessVersion:me.version,rosterRevision:s.versiones[group]||0,roster:[[p.id,p.jugador]]};
    assert.equal(e.write(e.owner,change(first,'11112222')).ok,true);assert.equal(e.post(e.owner,'/api/operations',old).codigo,'CONFLICTO');assert.equal(e.read().padron[0].dni,'11112222');
  }
});

test('GAS: botón de sincronización verifica destino, versión y datos; cambios de ambas cuentas llegan a Sheets',()=>{
  const e=environment();e.seed();e.write(e.teacher,attendance);
  const r=e.post(e.owner,'/api/sheets/sync',{deporte:'Tenis'});
  assert.equal(r.ok,true);assert.equal(r.verified,true);assert.equal(r.actividad,'Tenis');assert.equal(r.version,e.read().version);
  assert.equal(e.read().sheetsStatus,'synced');
  assert.ok(JSON.stringify(e.books.get('tenis-public')).includes('teacher'));
  assert.equal(e.post(e.teacher,'/api/sheets/sync',{deporte:'Tenis'}).codigo,'PERMISOS');
});
test('GAS: una vista que no conserva la escritura no se confirma como actualizada',()=>{
  const e=environment();e.seed();e.ctx.syncActivityUGI(e.ctx.configUGI(),'Tenis');e.write(e.teacher,attendance);
  const update=e.ctx.Sheets.Spreadsheets.batchUpdate;
  e.ctx.Sheets.Spreadsheets.batchUpdate=(body,id)=>id==='tenis-public'?{}:update(body,id);
  assert.equal(e.post(e.owner,'/api/sheets/sync',{deporte:'Tenis'}).codigo,'SINCRONIZACION');
  assert.equal(e.read().sheetsStatus,'pending');
});
test('GAS: automatización sólo del propietario, activación idempotente y reintento sin perder guardados',()=>{
  const e=environment(),triggers=[];
  e.ctx.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:handler=>({timeBased(){return this;},everyMinutes(n){assert.equal(n,15);return this;},create(){triggers.push({getHandlerFunction:()=>handler});}})};
  assert.equal(e.post(e.teacher,'/api/sheets/automation').codigo,'PERMISOS');
  assert.equal(e.post(e.owner,'/api/sheets/automation').enabled,true);
  assert.equal(e.post(e.owner,'/api/sheets/automation').enabled,true);assert.equal(triggers.length,1);
  assert.equal(e.seed().sheetsStatus,'synced');
  assert.equal(e.write(e.teacher,attendance).sheetsStatus,'synced');assert.equal(e.read().sheetsStatus,'synced');
  e.faults.write='tenis-public';const r=e.write(e.teacher,{...attendance,datos:{'Persona de prueba':'A | Sem:R'}});
  assert.equal(r.ok,true);assert.equal(r.sheetsStatus,'pending');assert.equal(e.read().asistencia[0].estado,'A | Sem:R');
  e.faults.write=false;assert.equal(e.ctx.sincronizarPendientesUGI().ok,true);assert.equal(e.read().sheetsStatus,'synced');
});


test('GAS: historial comprimido usa MIME gzip explicito requerido por Google y conserva Unicode',()=>{
 const e=environment(),utilities=e.ctx.Utilities,makeBlob=utilities.newBlob,ungzip=utilities.ungzip;
 utilities.newBlob=(data,contentType,name)=>({...makeBlob(data),getContentType:()=>contentType||null,getName:()=>name||null});
 utilities.ungzip=blob=>{
  assert.equal(blob.getContentType(),'application/gzip','Google rechaza descomprimir un blob sin tipo de contenido');
  return ungzip(blob);
 };
 const original={id:'temporada_prueba',state:{jugador:'Lucía Ñandú',notas:{Tiro:6.5},sesiones:['Inclusión']}};
 const rows=e.ctx.archiveChunksUGI(original.id,original);
 assert.deepEqual(JSON.parse(JSON.stringify(e.ctx.unchunksUGI(rows)[original.id])),original);
});
