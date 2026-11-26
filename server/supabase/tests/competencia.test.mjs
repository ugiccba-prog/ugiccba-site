import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {handleCompetencia} from '../functions/muni360/competencia.mjs';
const require=createRequire(import.meta.url);
const {PGlite}=require(process.env.MUNI_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();await db.waitReady;
await db.exec('create role anon;create role authenticated;create role service_role;create schema mc_private;create table mc_private.settings(id boolean,owner_uid text,mode text);create table mc_private.users(uid text,record jsonb);');
await db.exec(fs.readFileSync(new URL('../sql/018_competencia.sql',import.meta.url),'utf8'));
await db.exec(`insert into mc_private.settings values(true,'owner','ready');insert into mc_private.users values('owner','{"status":"activo"}');`);
const rpc=async(name,{p_action,p})=>(await db.query('select public.mc_competencia($1,$2) as value',[p_action,JSON.stringify(p)])).rows[0].value;
const service=async()=>({state:{padron:[{id:'p1',jugador:'Ana <img>',categoria:'Primera',equipo:'A',dni:'PRIVATE'}]}});
const body={sportKey:'hockey_patines',competition:{id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',revision:0,activity_id:'Hockey sobre Patines Damas',team:'A',category:'Primera',date_ar:'2026-11-25T22:00:00Z',mode:'live',status:'final',opponent_or_event:'Prueba',score_muni:999},roster:[{player_id:'p1',player_name:'Forged'}],events:[{side:'muni',action_code:'gol_jugada',points_delta:999,player_id:'p1',period:'1T'}]};
const call=(path,b=body,uid='owner')=>handleCompetencia({actor:{id:uid},owner:'owner',path:'/api/competencia/'+path,body:b,rpc,service});
await test('owner gate rejects other users before data access',async()=>{await assert.rejects(()=>call('list',{},'profe'),e=>e.code==='PERMISOS');});
await test('roster response excludes DNI and private fields',async()=>{const r=await call('roster',{activity:body.competition.activity_id});assert.deepEqual(Object.keys(r.roster[0]),['player_id','player_name','category','team']);});
await test('transaction recalculates scores, uses real names, and retries without duplication',async()=>{
 const first=await call('save');const retry=await call('save');assert.equal(first.id,retry.id);assert.equal(retry.revision,1);
 const d=await call('detail',{id:first.id});assert.equal(d.competition.score_muni,1);assert.equal(d.roster.length,1);assert.equal(d.events.length,1);assert.equal(d.roster[0].player_name,'Ana <img>');
 const edited=structuredClone(body);edited.events=[];await assert.rejects(()=>call('save',edited),e=>e.code==='PT409');
});
await test('invalid player or invented action is rejected before saving',async()=>{
 const b=structuredClone(body);b.events[0].action_code='invented';await assert.rejects(()=>call('save',b),e=>e.code==='VALIDACION');b.events=[];b.roster[0].player_id='fake';await assert.rejects(()=>call('save',b),e=>e.code==='VALIDACION');
});
await test('database error rolls back header and children together',async()=>{
 const d=await call('detail',{id:body.competition.id});const c={...d.competition,id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',revision:0};
 await assert.rejects(()=>rpc('mc_competencia',{p_action:'save',p:{uid:'owner',competition:c,roster:[{player_id:'p1',player_name:'Ana'}],events:[{side:'invalid'}]}}));
 const rows=await db.query('select count(*)::int as n from mc_private.mc_competitions where id=$1',[c.id]);assert.equal(rows.rows[0].n,0);
});
await test('direct authenticated RPC and private table reads are denied',async()=>{
 await db.exec('set role authenticated');try{await assert.rejects(()=>db.query("select public.mc_competencia('list','{\"uid\":\"owner\"}')"));await assert.rejects(()=>db.query('select * from mc_private.mc_competitions'));}finally{await db.exec('reset role');}
});
await db.close();
