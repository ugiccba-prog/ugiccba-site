import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';
import {createHandler,prepare} from '../functions/muni360/core.mjs';import {sha,empty,resource} from '../functions/muni360/domain.mjs';
const require=createRequire(import.meta.url),{PGlite}=require(process.env.MUNI_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();await db.waitReady;
await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.jwt() to anon,authenticated,service_role;");
for(const name of ['001_core.sql','002_import.sql','003_projection.sql','004_import_checksums.sql','007_permission_contract.sql'])await db.exec(fs.readFileSync(new URL('../sql/'+name,import.meta.url),'utf8'));
await db.exec("create schema mp_private;create function mp_private.mp_worker_auth(p_secret text) returns void language plpgsql as $$begin if p_secret is distinct from 'worker-test' then raise exception using errcode='42501',message='Invalid worker';end if;end$$;revoke all on function mp_private.mp_worker_auth(text) from public;");
const areas=['Básquet Caballeros','Colonia'],secret='mci_'+'a'.repeat(64),idSecret='b'.repeat(64),users=[['owner','Dirección UGI'],['teacher','Profe'],['reader','Consulta']].map(([uid,rol])=>({uid,email:uid+'@example.invalid',nombre:uid,rol,status:'activo',areas,capabilities:{},version:'11111111-2222-4333-8444-555555555555',revision:0,expiresAt:null}));
await db.query("insert into mc_private.settings values(true,'muni360-ugi-ensayo','owner',$1,$2,'preparing',$3,now()+interval '1 day')",[idSecret,JSON.stringify(areas),sha(secret)]);
async function rpc(name,args,role='service_role'){
 await db.exec('begin');try{await db.exec('set local role '+role);const entries=Object.entries(args),params=entries.map((_,i)=>'$'+(i+1)).join(',');const r=await db.query('select public.'+name+'('+params+') as value',entries.map(([k,v])=>v&&typeof v==='object'?JSON.stringify(v):v));await db.exec('commit');return r.rows[0].value;}catch(e){await db.exec('rollback');if(e.code==='PT409'){e.code='CONFLICTO';e.status=409;}else if(e.code==='42501')e.code='PERMISOS';throw e;}
}
async function importUnit(unit,value){const body=JSON.stringify(value),hash=sha(body);await rpc('mc_import_part',{p_secret:secret,p_unit:unit,p_part:0,p_total:1,p_checksum:hash,p_body:body},'anon');return rpc('mc_import_unit',{p_unit:unit,p_checksum:hash});}
await importUnit('global',{config:{owner:'owner',project:'muni360-ugi-ensayo',idSecret,areas},users:{users,history:{}},identities:[]});
const state=empty();state.padron=[{id:'p1',categoria:'Mini',equipo:'A',jugador:'Juan ficticio',dni:'12345678'},{id:'p2',categoria:'Mini',equipo:'A',jugador:'Pedro ficticio',dni:''},{id:'p3',categoria:'Mini',equipo:'B',jugador:'Otro ficticio',dni:''}];state.gestos=['Tiro'];
await importUnit(areas[0],{name:areas[0],state,meta:{temporada:1,version:0},versions:{},receipts:[],audit:{},archives:{}});await importUnit(areas[1],{name:areas[1],state,meta:{temporada:1,version:0},versions:{},receipts:[],audit:{},archives:{}});
await db.exec("update mc_private.activities set enabled=true;update mc_private.settings set mode='ready',import_hash=null,import_expires=null;");
const handler=uid=>createHandler({rpc,verify:async()=>({uid,email:uid+'@example.invalid',nombre:uid})});
const call=(uid,body,path='/api/operations')=>handler(uid)({token:'SQL_TEST_NOT_GOOGLE',path,body});
const load=(uid='teacher')=>call(uid,{tipo:'LECTURA',deporte:areas[0]});
function operation(s,type,extra={}){const d={tipo:type,deporte:areas[0],categoria:'Mini',equipo:'A',fecha:'2026-11-20',...extra},key=resource(d),rk=resource({tipo:'PADRON',categoria:d.categoria,equipo:d.equipo});return {...d,requestId:randomUUID(),accessVersion:'11111111-2222-4333-8444-555555555555',revision:s.versiones[key]||0,temporada:s.temporada,rosterRevision:s.versiones[rk]||0,roster:s.padron.filter(p=>p.categoria===d.categoria&&p.equipo===d.equipo).map(p=>[p.id,p.jugador])};}

export {db,rpc,call,load,operation,areas};
