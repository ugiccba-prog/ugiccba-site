import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';
import {createHandler,prepare} from '../functions/muni360/core.mjs';import {sha,empty,resource} from '../functions/muni360/domain.mjs';
const require=createRequire(import.meta.url),{PGlite}=require(process.env.MUNI_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();await db.waitReady;
await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.jwt() to anon,authenticated,service_role;");
for(const name of ['001_core.sql','002_import.sql','003_projection.sql','004_import_checksums.sql','007_permission_contract.sql','013_fast_load_and_dashboard.sql','019_team_access.sql'])await db.exec(fs.readFileSync(new URL('../sql/'+name,import.meta.url),'utf8'));
await db.exec("create schema mp_private;create function mp_private.mp_worker_auth(p_secret text) returns void language plpgsql as $$begin if p_secret is distinct from 'worker-test' then raise exception using errcode='42501',message='Invalid worker';end if;end$$;revoke all on function mp_private.mp_worker_auth(text) from public;");
const areas=['Actividad de prueba','Colonia'],secret='mci_'+'a'.repeat(64),idSecret='b'.repeat(64),users=[['owner','Dirección UGI'],['teacher','Profe'],['reader','Consulta']].map(([uid,rol])=>({uid,email:uid+'@example.invalid',nombre:uid,rol,status:'activo',areas,capabilities:{},version:'11111111-2222-4333-8444-555555555555',revision:0,expiresAt:null,...(uid==='teacher'?{teams:{[areas[0]]:[{categoria:'Mini',equipo:'A'},{categoria:'Mini',equipo:'B'}]},playerLinks:{[areas[0]]:null}}:{})}));
await db.query("insert into mc_private.settings values(true,'muni360-ugi-ensayo','owner',$1,$2,'preparing',$3,now()+interval '1 day')",[idSecret,JSON.stringify(areas),sha(secret)]);
async function rpc(name,args,role='service_role'){
 await db.exec('begin');try{await db.exec('set local role '+role);const entries=Object.entries(args),params=entries.map((_,i)=>'$'+(i+1)).join(',');const r=await db.query('select public.'+name+'('+params+') as value',entries.map(([k,v])=>v&&typeof v==='object'?JSON.stringify(v):v));await db.exec('commit');return r.rows[0].value;}catch(e){await db.exec('rollback');if(e.code==='PT409'){e.code='CONFLICTO';e.status=409;}else if(e.code==='42501')e.code='PERMISOS';throw e;}
}
async function importUnit(unit,value){const body=JSON.stringify(value),hash=sha(body);await rpc('mc_import_part',{p_secret:secret,p_unit:unit,p_part:0,p_total:1,p_checksum:hash,p_body:body},'anon');await assert.rejects(()=>rpc('mc_import_unit',{p_unit:unit,p_checksum:'0'.repeat(64)}),/huella/);return rpc('mc_import_unit',{p_unit:unit,p_checksum:hash});}
await importUnit('global',{config:{owner:'owner',project:'muni360-ugi-ensayo',idSecret,areas},users:{users,history:{}},identities:[]});
const state=empty();state.padron=[{id:'p1',categoria:'Mini',equipo:'A',jugador:'Juan ficticio',dni:'12345678'},{id:'p2',categoria:'Mini',equipo:'A',jugador:'Pedro ficticio',dni:''},{id:'p3',categoria:'Mini',equipo:'B',jugador:'Otro ficticio',dni:''}];state.gestos=['Tiro'];
await importUnit(areas[0],{name:areas[0],state,meta:{temporada:1,version:0},versions:{},receipts:[],audit:{},archives:{}});await importUnit(areas[1],{name:areas[1],state:empty(),meta:{temporada:1,version:0},versions:{},receipts:[],audit:{},archives:{}});
await db.exec("update mc_private.activities set enabled=true;update mc_private.settings set mode='ready',import_hash=null,import_expires=null;");
const handler=uid=>createHandler({rpc,verify:async()=>({uid,email:uid+'@example.invalid',nombre:uid})});
const call=(uid,body,path='/api/operations')=>handler(uid)({token:'SQL_TEST_NOT_GOOGLE',path,body});
const load=(uid='teacher')=>call(uid,{tipo:'LECTURA',deporte:areas[0]});
function operation(s,type,extra={}){const d={tipo:type,deporte:areas[0],categoria:'Mini',equipo:'A',fecha:'2026-11-20',...extra},key=resource(d),rk=resource({tipo:'PADRON',categoria:d.categoria,equipo:d.equipo});return {...d,requestId:randomUUID(),accessVersion:s.accessVersion||'11111111-2222-4333-8444-555555555555',revision:s.versiones[key]||0,temporada:s.temporada,rosterRevision:s.versiones[rk]||0,roster:s.padron.filter(p=>p.categoria===d.categoria&&p.equipo===d.equipo).map(p=>[p.id,p.jugador])};}
await test('private tables, service RPC and import finalization deny browser roles',async()=>{await assert.rejects(()=>rpc('mc_service',{p_action:'users',p:{uid:'owner'}},'anon'),/permission denied/);await assert.rejects(()=>rpc('mc_import_unit',{p_unit:'global',p_checksum:'x'},'anon'),/permission denied/);await assert.rejects(()=>rpc('mc_import_part',{p_secret:secret,p_unit:'global',p_part:0,p_total:1,p_checksum:'a'.repeat(64),p_body:'{}'},'anon'),/cerrada/);});
await test('import preserves stable IDs, names, gestures, complete roster; Profe never receives DNI',async()=>{const t=await load(),o=await load('owner');assert.equal(t.padron.length,3);assert.equal(o.padron[0].dni,'12345678');assert.ok(t.padron.every(p=>p.dni===''));assert.equal(t.padron[0].id,'p1');assert.deepEqual(t.gestos,['Tiro']);});
let attendance;
await test('attendance includes climate, points, audit, receipt and durable outbox',async()=>{attendance=operation(await load(),'ASISTENCIA',{datos:{'Juan ficticio':'P | Sem:V','Pedro ficticio':'A | Sem:N'},clima:'Vapor',puntosCiudad:7});const r=await call('teacher',attendance);assert.equal(r.revision,1);const s=await load();assert.equal(s.asistencia.length,2);assert.match(s.asistencia[0].estado,/Pts:7.*Clima:Vapor/);assert.equal((await db.query('select count(*) as n from mc_private.receipts')).rows[0].n,1);});
await test('food cannot be recorded outside Colonia',async()=>{await assert.rejects(async()=>call('teacher',operation(await load(),'ASISTENCIA',{datos:{'Juan ficticio':'P | 🍴 Comida | Sem:N','Pedro ficticio':'A | Sem:N'}})),/comida/);});
await test('lost response retry returns same receipt; old revision and changed payload conflict',async()=>{assert.equal((await call('teacher',attendance)).revision,1);await assert.rejects(()=>call('teacher',{...attendance,requestId:randomUUID()}),e=>e.code==='CONFLICTO');await assert.rejects(()=>call('teacher',{...attendance,puntosCiudad:9}),e=>e.code==='CONFLICTO');});
await test('evaluation, DUA, private legajo, recognition and sessions retain existing features',async()=>{for(const [type,extra,uid]of [['EVALUACION',{jugador:'Juan ficticio',notas:{Tiro:6.5}},'teacher'],['DUA',{jugador:'Juan ficticio',subjectId:'p1',ficha:{comunicacion:'Visual',desborda:'Ruido',regula:'Pausa'}},'owner'],['LEGAJO',{jugador:'Juan ficticio',subjectId:'p1',ficha:{estadoPlan:'A',paseInterno:'Privado',actividadesSimultaneas:[],bitacora:[{id:'event-1',fecha:'2026-11-20',tipo:'Nota',detalle:'Privada'}]}},'owner'],['RECONOCIMIENTO',{jugador:'Juan ficticio',subjectId:'p1',motivo:'Compañerismo'},'teacher'],['SESION_UGI',{foco:'Inclusion',nota:'Seguimiento'},'teacher']])await call(uid,operation(await load(uid),type,extra));const t=await load();assert.equal(t.evaluaciones[0].notas.Tiro,6.5);assert.equal(t.fichas.p1.dua.regula,'Pausa');assert.deepEqual(t.fichas.p1.legajo,{});assert.equal((await load('owner')).fichas.p1.legajo.bitacora.length,2);});
await test('padrón import is idempotent, DNI invalid and duplicate names rejected atomically',async()=>{const body=operation(await load('owner'),'ALTA_PADRON',{jugadores:[{jugador:'Nuevo ficticio',dni:'87654321'}]});await call('owner',body);await call('owner',body);assert.equal((await load()).padron.length,4);for(const jugadores of [[{jugador:'Mal DNI',dni:'123'}],[{jugador:'Duplicado'},{jugador:'Duplicado'}]])await assert.rejects(async()=>call('owner',operation(await load('owner'),'ALTA_PADRON',{jugadores})));assert.equal((await load()).padron.length,4);});
await test('Excel múltiple: Colonia A/B se confirma atómicamente, no permite parciales y respeta permisos',async()=>{
 const before=await call('owner',{tipo:'LECTURA',deporte:'Colonia'});
 const grupos=[{categoria:'6y7',equipo:'A',jugadores:[{jugador:'Persona Uno',dni:'58999666'},{jugador:'Persona Dos',dni:'58999667'}]},{categoria:'6y7',equipo:'B',jugadores:[{jugador:'Persona Tres',dni:'58999668'},{jugador:'Persona Cuatro',dni:'58999669'}]}];
 const body=operation(before,'ALTA_PADRON_LOTE',{deporte:'Colonia',categoria:'',equipo:'',fecha:'',grupos});
 const receipt=await call('owner',body);assert.equal(receipt.ok,true);assert.equal((await call('owner',body)).requestId,body.requestId);
 let saved=await call('owner',{tipo:'LECTURA',deporte:'Colonia'});assert.equal(saved.padron.length,4);assert.deepEqual(saved.padron.map(p=>p.equipo),['A','A','B','B']);
 const bad=operation(saved,'ALTA_PADRON_LOTE',{deporte:'Colonia',categoria:'',equipo:'',fecha:'',grupos:[{categoria:'Otro',equipo:'A',jugadores:[{jugador:'Nuevo',dni:'55556666'}]},{categoria:'Otro',equipo:'B',jugadores:[{jugador:'DNI inválido',dni:'abc'}]}]});
 await assert.rejects(()=>call('owner',bad),/DNI/);saved=await call('owner',{tipo:'LECTURA',deporte:'Colonia'});assert.equal(saved.padron.length,4);
 await assert.rejects(()=>call('teacher',operation(saved,'ALTA_PADRON_LOTE',{deporte:'Colonia',categoria:'',equipo:'',fecha:'',grupos})),/permiso/i);
});
await test('Consulta can read but cannot write; Profe cannot grant itself permissions',async()=>{await load('reader');await assert.rejects(async()=>call('reader',operation(await load('reader'),'ASISTENCIA',{datos:{}})),/consulta/);await assert.rejects(()=>call('teacher',{uid:'teacher',rol:'Dirección UGI'},'/api/users/update'),/propietario/);});
await test('owner permissions panel persists suspension and subsequent request is blocked',async()=>{const r=await call('owner',{uid:'reader',rol:'Consulta',status:'suspendido',areas,capabilities:{},revision:0},'/api/users/update');assert.equal(r.user.revision,1);assert.notEqual(r.user.version,'11111111-2222-4333-8444-555555555555');await assert.rejects(()=>load('reader'));});
await test('projection is sanitized; stale acknowledgement keeps new work pending',async()=>{
 const jobs=await rpc('mc_worker_jobs',{p_secret:'worker-test',p_limit:5},'anon');assert.ok(jobs.length>=1);assert.ok(jobs[0].state.padron.every(p=>!('dni' in p)));assert.ok(Object.values(jobs[0].state.fichas).every(f=>!('legajo' in f)));assert.ok(jobs[0].audit.every(e=>!('antes' in e)&&!('despues' in e)));
 const job=jobs.find(j=>j.activity===areas[0]);await call('teacher',operation(await load(),'EVALUACION',{jugador:'Pedro ficticio',notas:{Tiro:8}}));
 await rpc('mc_worker_ack',{p_secret:'worker-test',p_activity:job.activity,p_version:job.version,p_sheet:'FICTITIOUS_SHEET_ID_123456789',p_staging:[]},'anon');
 assert.equal((await load()).sheetsStatus,'pending');await assert.rejects(()=>rpc('mc_worker_jobs',{p_secret:'wrong',p_limit:5},'anon'));
});
await test('failure during audit insert rolls back attendance, receipt and version',async()=>{
 const s=await load(),before=JSON.stringify(s);await db.exec("create function mc_private.fail_audit() returns trigger language plpgsql as $$begin raise exception 'forced audit failure';end$$;create trigger force_failure before insert on mc_private.audit for each row execute function mc_private.fail_audit();");
 await assert.rejects(()=>call('teacher',operation(s,'EVALUACION',{jugador:'Pedro ficticio',notas:{Tiro:9}})),/forced audit/);await db.exec('drop trigger force_failure on mc_private.audit');assert.equal(JSON.stringify(await load()),before);
});
await test('roster change and season closure invalidate pending writes; archived data survives',async()=>{const stale=operation(await load(),'EVALUACION',{jugador:'Pedro ficticio',notas:{Tiro:7}});await call('owner',operation(await load('owner'),'BAJA_PADRON',{jugador:'Nuevo ficticio'}));await assert.rejects(()=>call('teacher',stale),e=>e.code==='CONFLICTO');const old=await load('owner');await call('owner',operation(old,'RESET_DATOS',{modo:'TEMPORADA'}));const current=await load('owner');assert.equal(current.temporada,2);assert.equal(current.padron.length,3);assert.equal(current.asistencia.length,0);const history=await call('owner',{tipo:'LECTURA',deporte:areas[0],temporada:current.archivos[0].id});assert.equal(history.asistencia.length,2);await assert.rejects(()=>call('teacher',{...attendance,requestId:randomUUID()}),e=>e.code==='CONFLICTO');});
await test('missing Firebase issuer/audience/verification cannot pass SQL identity validation',async()=>{for(const claims of [{},{sub:'owner',email:'owner@example.invalid',exp:1999999999},{sub:'owner',email:'owner@example.invalid',exp:1999999999,aud:'wrong',iss:'wrong',email_verified:true,firebase:{sign_in_provider:'google.com'}}]){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);await assert.rejects(()=>rpc('mc_identity',{},'anon'));}});
await test('dashboard scope reads aggregate state without fichas or versions',async()=>{
 const dash=await call('owner',{days:0,activities:[areas[0]]},'/api/dashboard');
 assert.equal(dash.ok,true);assert.equal(dash.activities.length,1);assert.equal(dash.activities[0].inscripciones,3);
 const scoped=await rpc('mc_service',{p_action:'load',p:{uid:'owner',activity:areas[0],scope:'dashboard'}});
 assert.equal(scoped.state.padron.length,3);assert.equal('fichas' in scoped.state,false);assert.equal('versions' in scoped,false);
});
await test('team assignment grants only authorized groups and keeps the coach’s evaluation private',async()=>{
 const sport=areas[0], group={categoria:'Mini',equipo:'A'};
 const target={uid:'teacher',deporte:sport};
 await db.query("insert into mc_private.users(uid,record) values('coord',$1)",[JSON.stringify({
  uid:'coord',nombre:'Coordinación de prueba',rol:'Coordinación',status:'activo',areas:[sport],revision:0,version:'coord-new'
 })]);
 await assert.rejects(()=>rpc('mc_team_access',{p_action:'list',p:{actorUid:'owner',activity:sport}},'authenticated'),/permission denied/);
 const catalog=await call('coord',{deporte:sport},'/api/team-access/list');
 assert.equal(catalog.canLinkPlayer,false);
 assert.deepEqual(catalog.players,[]);
 await assert.rejects(()=>call('coord',{...target,playerId:'p1',revision:0},'/api/team-access/player'),e=>e.code==='PERMISOS');
 await assert.rejects(()=>call('teacher',{...target,teams:[group],revision:0},'/api/team-access/save'),e=>e.code==='PERMISOS');
 await assert.rejects(()=>call('coord',{...target,deporte:'Colonia',teams:[],revision:0},'/api/team-access/save'),e=>e.code==='PERMISOS');
 await call('coord',{...target,teams:[group],revision:0},'/api/team-access/save');
 const beforeLink=await load();
 assert.deepEqual(new Set(beforeLink.padron.map(row=>row.equipo)),new Set(['A']));
 await assert.rejects(()=>call('coord',{...target,teams:[],revision:0},'/api/team-access/save'),e=>e.code==='CONFLICTO');
 await call('owner',{...target,playerId:'p1',revision:1},'/api/team-access/player');
 const coach=await load(), manager=await load('owner'), fecha='2026-11-25';
 assert.equal(coach.padron.find(row=>row.id==='p1').excluirEvaluacion,true);
 assert.ok(coach.evaluaciones.every(row=>row.jugadorId!=='p1' && row.equipo==='A'));
 await assert.rejects(()=>call('teacher',operation(coach,'EVALUACION',{
  fecha,jugador:'Juan ficticio',notas:{Tiro:9},accessVersion:coach.accessVersion
 })),e=>e.code==='PERMISOS');
 await assert.rejects(()=>call('teacher',operation(coach,'ASISTENCIA',{
  fecha,equipo:'B',datos:{'Otro ficticio':'P | Sem:V'},accessVersion:coach.accessVersion
 })),e=>e.code==='PERMISOS');
 await call('owner',operation(manager,'EVALUACION',{fecha,jugador:'Juan ficticio',notas:{Tiro:9},observacion:'Propia privada'}));
 await call('teacher',operation(coach,'EVALUACION',{
  fecha,jugador:'Pedro ficticio',notas:{Tiro:7},observacion:'Observación de práctica',accessVersion:coach.accessVersion
 }));
 const visible=await load();
 assert.deepEqual(visible.evaluaciones.filter(row=>row.fecha===fecha).map(row=>[row.jugador,row.notas.Tiro,row.observacion]),[
  ['Pedro ficticio',7,'Observación de práctica']
 ]);
 assert.ok(!JSON.stringify(visible.versiones).includes('juan ficticio'));
 const projection=await db.query("select mc_private.sanitize($1) as state",[JSON.stringify(visible)]);
 assert.ok(!JSON.stringify(projection.rows).includes('Observación de práctica'));
 await call('coord',{...target,teams:[],revision:2},'/api/team-access/save');
 const revoked=await load();
 assert.deepEqual(revoked.padron,[]);
 assert.deepEqual(revoked.evaluaciones,[]);
 const bulk={deporte:sport,team:group,changes:[{uid:'teacher',revision:3,assigned:true}]};
 await assert.rejects(()=>call('coord',{...bulk,changes:[...bulk.changes,{uid:'zzz',revision:0,assigned:true}]},
  '/api/team-access/save-team'),e=>e.code==='PERMISOS');
 assert.deepEqual((await load()).padron,[]);
 await call('coord',bulk,'/api/team-access/save-team');
 assert.deepEqual((await load()).padron.map(row=>row.equipo),['A','A']);
});
await db.close();
