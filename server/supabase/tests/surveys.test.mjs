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
for(const name of ['001_core.sql','002_import.sql','003_projection.sql','004_import_checksums.sql','007_permission_contract.sql','015_surveys.sql']){
 await db.exec(fs.readFileSync(new URL('../sql/'+name,import.meta.url),'utf8'));
}

const areas=['Básquet Damas','Vóley Caballeros'],idSecret='b'.repeat(64);
await db.query("insert into mc_private.settings values(true,'muni360-ugi-ensayo','owner',$1,$2,'ready',$3,now()+interval '1 day')",[idSecret,JSON.stringify(areas),sha('s'.repeat(64))]);
const users=[
 {uid:'owner',email:'owner@example.invalid',nombre:'Dirección',rol:'Dirección UGI',status:'activo',areas,capabilities:{},version:'v1',revision:0,expiresAt:null},
 {uid:'coord',email:'coord@example.invalid',nombre:'Coord Básquet',rol:'Coordinación',status:'activo',areas:['Básquet Damas'],capabilities:{},version:'v1',revision:0,expiresAt:null},
 {uid:'profe',email:'profe@example.invalid',nombre:'Profe',rol:'Profe',status:'activo',areas:['Básquet Damas'],capabilities:{},version:'v1',revision:0,expiresAt:null}
];
for(const u of users){
 await db.query('insert into mc_private.users(uid,record) values($1,$2::jsonb)',[u.uid,JSON.stringify(u)]);
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

const handle=uid=>createHandler({
 rpc:(name,args)=>rpc(name,args),
 verify:async()=>({uid}),
 now:()=>Date.parse('2026-11-19T21:00:00Z')
});
const call=(uid,path,body={})=>handle(uid)({token:uid?'FICTITIOUS':'',path,body});

await test('anon/authenticated cannot access mc_surveys RPC directly',async()=>{
 await assert.rejects(()=>rpc('mc_surveys',{p_action:'public_get',p:{code:'123456'}},'anon'));
 await assert.rejects(()=>rpc('mc_surveys',{p_action:'list',p:{uid:'owner'}},'authenticated'));
});

await test('Profe cannot create or list surveys; Coordinación only accesses authorized activities',async()=>{
 await assert.rejects(()=>call('profe','/api/surveys/list'),e=>e.code==='PERMISOS');
 await assert.rejects(()=>call('coord','/api/surveys/create',{
  activity:'Vóley Caballeros',
  title:'Cuestionario',
  questions:[{id:'q1',type:'scale',label:'¿Cómo estás?',required:true}]
 }),e=>e.code==='PERMISOS');
 await assert.rejects(()=>call(null,'/api/surveys/public',{code:'bad'}),e=>e.code==='VALIDACION'&&/cuestionario/i.test(e.message));
});

await test('create, public anonymous submit, immediate first-response summary, and close flow',async()=>{
 const created=await call('coord','/api/surveys/create',{
  activity:'Básquet Damas',
  categoria:'U13',
  equipo:'A',
  title:'Clima del grupo',
  description:'Anónima',
  questions:[
   {id:'q1',type:'scale',label:'¿Cómo te sentís?',required:true},
   {id:'q2',type:'single',label:'Horario',options:['Bien','Tarde'],required:true},
   {id:'q3',type:'text',label:'Comentario',required:false}
  ]
 });
 assert.equal(created.ok,true);
 const code=created.survey.public_code;
 assert.ok(code);

 // Public read without auth token
 const pub=await call(null,'/api/surveys/public',{code});
 assert.equal(pub.closed,false);
 assert.equal(pub.survey.title,'Clima del grupo');
 assert.equal('created_by' in pub.survey,false);

 // Public anonymous submit without auth token
 const sub=await call(null,'/api/surveys/submit',{code,answers:{q1:5,q2:'Bien',q3:'Muy bueno el grupo'}});
 assert.equal(sub.ok,true);

 // Visible immediately from 1st response
 const list=await call('coord','/api/surveys/list');
 assert.equal(list.surveys.length,1);
 assert.equal(list.surveys[0].responseCount,1);
 assert.equal(list.surveys[0].summary[0].avg,5);
 assert.equal(list.surveys[0].summary[1].counts.Bien,1);
 assert.deepEqual(list.surveys[0].summary[2].texts,['Muy bueno el grupo']);

 // Close survey -> blocks new submissions
 const closed=await call('coord','/api/surveys/status',{surveyId:created.survey.id,status:'closed'});
 assert.equal(closed.survey.status,'closed');
 const pubClosed=await call(null,'/api/surveys/public',{code});
 assert.equal(pubClosed.closed,true);
 await assert.rejects(()=>call(null,'/api/surveys/submit',{code,answers:{q1:4}}),e=>e.code==='CONFLICTO');
});

await db.close();
