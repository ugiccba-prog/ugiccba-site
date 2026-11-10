
const test=require('node:test'),assert=require('node:assert/strict');
const {environment}=require('./helpers/apps-script-env.cjs'),{Client}=require('../assets/scripts/muni360-sync.js');
const attendance={tipo:'ASISTENCIA',deporte:'Tenis',categoria:'Sub 12',equipo:'A',fecha:'2026-11-10',datos:{'Persona de prueba':'P | Sem:V'}};
function browser(e,token,values=new Map(),network={online:true}){
 const p=e.post(token,'/api/me').profile,session={usuario:p.uid,versionUsuario:p.version,expiresAt:Date.now()+3600000},statuses=[];
 const client=new Client({transport:'apps-script',url:'https://script.google.com/macros/s/TEST/exec',session,getToken:async()=>token,lock:fn=>fn(),
 storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},onStatus:s=>statuses.push(s),
 fetch:async(_,opts)=>{if(!network.online)throw Error('offline');const d=JSON.parse(opts.body),result=e.ctx.doPost({postData:{contents:opts.body}});
 if(network.lose&&d.tipo!=='LECTURA'){network.lose=false;throw Error('response lost');}return {ok:true,json:async()=>result};}});
 return {client,values,network,statuses};
}
test('resiliencia: corte antes del envío y recarga conservan el mismo pendiente, luego confirman una sola operación',async()=>{
 const e=environment();e.seed();const a=browser(e,e.teacher);await a.client.read('Tenis');a.network.online=false;
 assert.equal(await a.client.enqueue(attendance),false);const id=a.client.queue[0].payload.requestId;assert.equal(e.read().asistencia.length,0);
 assert.ok(a.statuses.at(-1).message.includes('Sin confirmar'));
 const b=browser(e,e.teacher,a.values);await b.client.retry();assert.equal(b.client.queue.length,0);assert.equal(e.read().asistencia.length,1);
 const audit=e.ctx.loadActivityUGI(e.ctx.configUGI(),'Tenis').audit;assert.equal(audit[id].uid,'teacher');
 assert.ok(![...a.values.values()].join('').includes(e.teacher));
});
test('resiliencia: respuesta perdida después de guardar, recarga y reintentos no duplican asistencia ni auditoría',async()=>{
 const e=environment();e.seed();const a=browser(e,e.teacher);await a.client.read('Tenis');a.network.lose=true;
 assert.equal(await a.client.enqueue(attendance),false);const id=a.client.queue[0].payload.requestId;
 assert.equal(e.read().asistencia.length,1);
 const b=browser(e,e.teacher,a.values);await b.client.retry();await b.client.retry();
 const saved=e.ctx.loadActivityUGI(e.ctx.configUGI(),'Tenis');
 assert.equal(b.client.queue.length,0);assert.equal(saved.receipts.filter(r=>r[0]===id).length,1);assert.equal(Object.values(saved.audit).filter(r=>r.id===id).length,1);
});
test('resiliencia: dos profes desde la misma versión no se pisan; el segundo revisa antes de reenviar',async()=>{
 const e=environment();e.seed();const second=e.identity('teacher-two');e.post(second,'/api/me');e.grant(second);
 const a=browser(e,e.teacher),b=browser(e,second);await Promise.all([a.client.read('Tenis'),b.client.read('Tenis')]);
 const result=await Promise.all([a.client.enqueue(attendance),b.client.enqueue({...attendance,datos:{'Persona de prueba':'A | Sem:R'}})]);
 assert.deepEqual(result,[true,false]);assert.equal(b.client.queue[0].code,'CONFLICTO');assert.equal(e.read().asistencia[0].estado,'P | Sem:V');
 await b.client.retry();assert.equal(e.read().asistencia[0].estado,'P | Sem:V');
 await b.client.reviewAndRetry();assert.equal(e.read().asistencia[0].estado,'A | Sem:R');
 const events=e.post(e.owner,'/api/operations',{tipo:'AUDITORIA',deporte:'Tenis'}).events;
 assert.equal(events[0].autor,'teacher-two');assert.equal(events[1].autor,'teacher');
});
test('resiliencia: suspensión, cambio a Consulta y retiro de actividad detienen un pendiente que vuelve con conexión',async()=>{
 for(const change of [{status:'suspendido'},{rol:'Consulta'},{areas:['Golf']}]){
  const e=environment();e.seed();const a=browser(e,e.teacher);await a.client.read('Tenis');a.network.online=false;
  await a.client.enqueue(attendance);e.grant(e.teacher,change);a.network.online=true;await a.client.retry();
  assert.equal(a.client.queue.length,1);assert.ok(['PENDIENTE','PERMISOS','CONFLICTO'].includes(a.client.queue[0].code));assert.equal(e.read().asistencia.length,0);
 }
});
test('resiliencia: cambiar de cuenta no muestra ni envía la cola anterior',async()=>{
 const e=environment();e.seed();const a=browser(e,e.teacher);await a.client.read('Tenis');a.network.online=false;await a.client.enqueue(attendance);a.client.stop();
 const b=browser(e,e.owner,a.values);assert.equal(b.client.queue.length,0);await b.client.retry();assert.equal(e.read().asistencia.length,0);
 const c=browser(e,e.teacher,a.values);await c.client.retry();assert.equal(e.read().asistencia.length,1);
});
test('recuperación: copias privadas coinciden, excluyen cambios posteriores y activan un único respaldo diario',()=>{
 const e=environment();e.seed();e.write(e.teacher,attendance);e.props.set('UGI_BACKUP_FOLDER_ID','backups');
 let next=0;const files=new Map(),folders=new Map(),triggers=[];
 const privateFields={getSharingAccess:()=> 'private',getViewers:()=>[],getEditors:()=>[]};
 function file(id,name='Muni360 - Ensayo de temporada - prueba'){
  if(!files.has(id))files.set(id,{...privateFields,getId:()=>id,getName:()=>name,isTrashed:()=>false,makeCopy(label,folder){const copyId='copy-'+(++next);e.books.set(copyId,e.clone(e.books.get(id)||[]));return file(copyId,label);}});
  return files.get(id);
 }
 function folder(id){if(!folders.has(id))folders.set(id,{...privateFields,getId:()=>id,createFolder:()=>folder('folder-'+(++next))});return folders.get(id);}
 e.ctx.SpreadsheetApp={getActiveSpreadsheet:()=>file('private')};e.ctx.Session={getEffectiveUser:()=>({getEmail:()=> 'owner@example.invalid'})};
 e.ctx.DriveApp={Access:{PRIVATE:'private'},getFileById:id=>file(id),getFolderById:id=>folder(id)};
 e.ctx.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:handler=>({timeBased(){return this;},everyDays(n){assert.equal(n,1);return this;},atHour(n){assert.equal(n,2);return this;},inTimezone(tz){assert.equal(tz,'America/Argentina/Buenos_Aires');return this;},create(){triggers.push({getHandlerFunction:()=>handler});}})};
 const before=JSON.stringify(e.books.get('private')),r=e.ctx.ensayarRespaldoYRecuperacionUGI();
 assert.equal(r.ok,true);assert.equal(r.recuperacionExacta,true);assert.equal(r.cambioPosteriorExcluido,true);assert.equal(r.respaldoSinDuplicado,true);
 assert.equal(JSON.stringify(e.books.get('private')),before);assert.equal(triggers.length,1);assert.ok(e.props.has('UGI_RECUPERACION_VERIFICADA'));
 e.ctx.ensayarRespaldoYRecuperacionUGI();assert.equal(triggers.length,1);
});

test('evaluación pendiente: cambio de padrón y revisión conservan ambos puntajes decimales y los jugadores',async()=>{
 const e=environment();e.seed();const a=browser(e,e.teacher);await a.client.read('Tenis');
 e.write(e.owner,{tipo:'ALTA_PADRON',categoria:'Sub 12',equipo:'A',jugadores:[{jugador:'Otra persona'}]});
 const notas={'Frenado y cambios de dirección':6.5,'Tiro al arco':6.5};
 assert.equal(await a.client.enqueue({tipo:'EVALUACION',deporte:'Tenis',categoria:'Sub 12',equipo:'A',fecha:'2026-11-10',jugador:'Persona de prueba',notas}),false);
 assert.equal(a.client.queue[0].code,'CONFLICTO');assert.deepEqual(a.client.queue[0].payload.notas,notas);
 await a.client.reviewAndRetry();assert.equal(a.client.queue.length,0);
 const confirmed=e.read();assert.equal(confirmed.padron.length,2);assert.equal(confirmed.evaluaciones.length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(confirmed.evaluaciones[0].notas)),notas);
});
