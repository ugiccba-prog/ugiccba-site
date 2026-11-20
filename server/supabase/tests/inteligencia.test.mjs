import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createHandler} from '../functions/muni360/core.mjs';
import {sha} from '../functions/muni360/domain.mjs';

const require=createRequire(import.meta.url);
const {PGlite}=require(process.env.MUNI_PGLITE_MODULE||'@electric-sql/pglite');

const db=new PGlite();
await db.waitReady;
await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.jwt() to anon,authenticated,service_role;");
for(const name of ['001_core.sql','002_import.sql','003_projection.sql','004_import_checksums.sql','007_permission_contract.sql','013_fast_load_and_dashboard.sql','014_inteligencia.sql']){
 await db.exec(fs.readFileSync(new URL('../sql/'+name,import.meta.url),'utf8'));
}

const areas=['Básquet Damas','Vóley Caballeros'],idSecret='b'.repeat(64);
await db.query("insert into mc_private.settings values(true,'muni360-ugi-ensayo','owner',$1,$2,'ready',$3,now()+interval '1 day')",[idSecret,JSON.stringify(areas),sha('s'.repeat(64))]);
for(const name of areas){
 await db.query('insert into mc_private.activities(name,enabled,version,projected_version,epoch) values($1,true,1,1,1)',[name]);
}
const users=[
 {uid:'owner',email:'owner@example.invalid',nombre:'Dirección',rol:'Dirección UGI',status:'activo',areas,capabilities:{},version:'v1',revision:0,expiresAt:null},
 {uid:'coord',email:'coord@example.invalid',nombre:'Coord Básquet',rol:'Coordinación',status:'activo',areas:['Básquet Damas'],capabilities:{},version:'v1',revision:0,expiresAt:null},
 {uid:'profe',email:'profe@example.invalid',nombre:'Profe',rol:'Profe',status:'activo',areas:['Básquet Damas'],capabilities:{},version:'v1',revision:0,expiresAt:null}
];
for(const u of users){
 await db.query('insert into mc_private.users(uid,record) values($1,$2::jsonb)',[u.uid,JSON.stringify(u)]);
}

// Seed attendance for Básquet Damas relative to 2026-11-19:
// - Baseline (days 15..41 ago): 2026-10-12, 2026-10-15, 2026-10-19, 2026-10-22 -> all P | Sem:V
// - Recent (last 14 days): 2026-11-10, 2026-11-13, 2026-11-17 -> p1/p2 absent (A | Sem:R), p3 absent 3x (A | Sem:A)
const attDates=[
 ['2026-10-12','P | Sem:V','P | Sem:V','P | Sem:V'],
 ['2026-10-15','P | Sem:V','P | Sem:V','P | Sem:V'],
 ['2026-10-19','P | Sem:V','P | Sem:V','P | Sem:V'],
 ['2026-10-22','P | Sem:V','P | Sem:V','P | Sem:V'],
 ['2026-11-10','A | Sem:R','A | Sem:R','A | Sem:A'],
 ['2026-11-13','A | Sem:R','A | Sem:R','A | Sem:A'],
 ['2026-11-17','A | Sem:R','P | Sem:V','A | Sem:A']
];
for(const [fecha,e1,e2,e3] of attDates){
 const rows=[
  {fecha,categoria:'U13',equipo:'A',jugador:'Jugadora 1',jugadorId:'p1',estado:e1},
  {fecha,categoria:'U13',equipo:'A',jugador:'Jugadora 2',jugadorId:'p2',estado:e2},
  {fecha,categoria:'U13',equipo:'A',jugador:'Jugadora 3',jugadorId:'p3',estado:e3}
 ];
 await db.query('insert into mc_private.records(activity,kind,key,data) values($1,$2,$3::jsonb,$4::jsonb)',[
  'Básquet Damas','asistencia',JSON.stringify([fecha,'U13','A']),JSON.stringify({kind:'asistencia',rows})
 ]);
}

async function rpc(name,args,role='service_role'){
 await db.exec('begin');
 try{
  await db.exec('set local role '+role);
  const entries=Object.entries(args);
  const params=entries.map((_,i)=>'$'+(i+1)).join(',');
  const r=await db.query('select public.'+name+'('+params+') as value',entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v));
  await db.exec('commit');
  return r.rows[0].value;
 }catch(e){
  await db.exec('rollback');
  if(e.code==='PT409'){e.code='CONFLICTO';e.status=409;}
  else if(e.code==='42501')e.code='PERMISOS';
  throw e;
 }
}

let currentNow=Date.parse('2026-11-19T15:00:00Z');
const call=(uid,path,body={},opts={})=>createHandler({
 rpc:(name,args)=>rpc(name,args),
 verify:async()=>({uid}),
 now:()=>currentNow,
 ...opts
})({token:'FICTITIOUS',path,body});

await test('anon/authenticated cannot access inteligencia tables or RPC',async()=>{
 await assert.rejects(()=>rpc('mc_inteligencia',{p_action:'list',p:{uid:'owner'}},'anon'));
 await assert.rejects(()=>rpc('mc_inteligencia',{p_action:'list',p:{uid:'owner'}},'authenticated'));
});

await test('Profe cannot access Inteligencia and Coordinación only accesses authorized activities',async()=>{
 await assert.rejects(()=>call('profe','/api/inteligencia/list'),e=>e.code==='PERMISOS');
 await assert.rejects(()=>call('profe','/api/inteligencia/scan',{activity:'Básquet Damas'}),e=>e.code==='PERMISOS');
 await assert.rejects(()=>call('coord','/api/inteligencia/scan',{activity:'Vóley Caballeros'}),e=>e.code==='PERMISOS');
 await assert.rejects(()=>call('coord','/api/inteligencia/list',{activities:['Vóley Caballeros']}),e=>e.code==='PERMISOS');
});

await test('scan detects drop, consecutive absences and semaphore alerts without duplicates',async()=>{
 const scan1=await call('coord','/api/inteligencia/scan',{activity:'Básquet Damas'});
 assert.equal(scan1.ok,true);
 assert.equal(scan1.cases.length,3);
 const rules=new Set(scan1.cases.map(c=>c.rule_code));
 assert.deepEqual(rules,new Set(['CAIDA_ASISTENCIA','AUSENCIAS_CONSECUTIVAS','SEMAFORO_ALERTA']));

 const consec=scan1.cases.find(c=>c.rule_code==='AUSENCIAS_CONSECUTIVAS');
 assert.equal(consec.metrics.count,2);
 assert.deepEqual(consec.metrics.jugadores.map(j=>j.nombre).sort(),['Jugadora 1','Jugadora 3']);

 // Re-scanning does not duplicate open cases
 const scan2=await call('coord','/api/inteligencia/scan',{activity:'Básquet Damas'});
 assert.equal(scan2.cases.length,3);
});

await test('intervention workflow updates status and notes; 48h escalation promotes unattended cases only',async()=>{
 const list1=await call('coord','/api/inteligencia/list',{status:'activas'});
 assert.equal(list1.counts.abierta,3);
 assert.equal(list1.aiConfigured,false);
 assert.deepEqual(list1.ruleCounts,{CAIDA_ASISTENCIA:1,AUSENCIAS_CONSECUTIVAS:1,SEMAFORO_ALERTA:1});

 const dropCase=list1.cases.find(c=>c.rule_code==='CAIDA_ASISTENCIA');
 const semCase=list1.cases.find(c=>c.rule_code==='SEMAFORO_ALERTA');

 // Mark dropCase as intervenida, semCase as resuelta, leave AUSENCIAS_CONSECUTIVAS abierta
 const upd1=await call('coord','/api/inteligencia/update',{caseId:dropCase.id,status:'intervenida',note:'Hablamos con el profe y familias'});
 assert.equal(upd1.case.status,'intervenida');
 assert.equal(upd1.case.notes.length,1);
 assert.equal(upd1.case.notes[0].autor,'Coord Básquet');

 const upd2=await call('owner','/api/inteligencia/update',{caseId:semCase.id,status:'resuelta',note:'Situación regularizada'});
 assert.equal(upd2.case.status,'resuelta');

 // Advance clock +49 hours -> only abierta/en_revision escalate
 currentNow+=49*3600*1000;
 const list2=await call('owner','/api/inteligencia/list',{status:''});
 assert.equal(list2.counts.escalada,1);
 assert.equal(list2.counts.intervenida,1);
 assert.equal(list2.counts.resuelta,1);
 assert.deepEqual(list2.ruleCounts,{CAIDA_ASISTENCIA:1,AUSENCIAS_CONSECUTIVAS:1,SEMAFORO_ALERTA:0});
 const escalated=list2.cases.find(c=>c.rule_code==='AUSENCIAS_CONSECUTIVAS');
 assert.equal(escalated.status,'escalada');
 assert.ok(escalated.escalated_at);
});

await test('AI key storage is owner-only, never leaked to client, and /api/inteligencia/ai uses sanitized context',async()=>{
 await assert.rejects(()=>call('profe','/api/inteligencia/ai'),e=>e.code==='PERMISOS');
 await assert.rejects(()=>call('coord','/api/inteligencia/ai',{activities:['Vóley Caballeros']}),e=>e.code==='PERMISOS');
 await assert.rejects(()=>rpc('mc_inteligencia',{p_action:'set_ai_key',p:{uid:'coord',apiKey:'FAKE_TEST_KEY'}}),e=>e.code==='PERMISOS');

 // Fallback works cleanly when no API key is configured
 const fallbackRes=await call('coord','/api/inteligencia/ai');
 assert.equal(fallbackRes.ok,true);
 assert.equal(fallbackRes.source,'asistente');
 assert.ok(fallbackRes.analysis.includes('Panorama activo'));

 // Configure API key as owner
 const cfg=await rpc('mc_inteligencia',{p_action:'set_ai_key',p:{uid:'owner',apiKey:'FAKE_TEST_KEY',model:'gemini-2.5-flash'}});
 assert.deepEqual(cfg,{ok:true,aiConfigured:true});

 const listWithAi=await call('coord','/api/inteligencia/list',{status:'activas'});
 assert.equal(listWithAi.aiConfigured,true);
 assert.equal('apiKey' in listWithAi,false);

 let captured=null;
 const aiRes=await call('coord','/api/inteligencia/ai',{},{
  aiGenerate:async payload=>{
   captured=payload;
   return '• Priorizar contacto con familias de U13 · A.\n• Activar cuestionario anónimo.';
  }
 });
 assert.equal(aiRes.ok,true);
 assert.equal(aiRes.source,'ia');
 assert.equal(aiRes.model,'gemini-2.5-flash');
 assert.equal('apiKey' in aiRes,false);
 assert.equal(JSON.stringify(aiRes).includes('FAKE_TEST_KEY'),false);
 assert.equal(captured.apiKey,'FAKE_TEST_KEY');
 assert.equal(captured.cases.length,2);
 const consec=captured.cases.find(c=>c.rule_code==='AUSENCIAS_CONSECUTIVAS');
 assert.equal('jugadores' in consec.metrics,false);
 assert.equal(consec.metrics.jugadoresCount,2);
});

await db.close();
