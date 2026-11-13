import test from 'node:test';import assert from 'node:assert/strict';
import {createHandler} from '../functions/muni360/core.mjs';
import {summarize} from '../functions/muni360/dashboard.mjs';
import {empty} from '../functions/muni360/domain.mjs';
const areas=['A','B'],users={owner:{uid:'owner',rol:'Dirección UGI',areas:['A']},coord:{uid:'coord',rol:'Coordinación',areas:['A']},delegated:{uid:'delegated',rol:'Dirección UGI',areas:['A']},teacher:{uid:'teacher',rol:'Profe',areas:['A']}};
let reads=[];
const handler=uid=>createHandler({now:()=>Date.parse('2026-11-13T15:00:00Z'),verify:async()=>({uid}),rpc:async(name,{p_action,p})=>{
 if(name!=='mc_service')throw Error('Unexpected RPC');
 const user={...users[uid],status:'activo',version:'v1',capabilities:{}};
 if(p_action==='touch')return {user,owner:'owner',areas};
 if(p_action==='load'){reads.push(p.activity);return {actor:user,state:empty()};}
 throw Error('Unexpected action');
}});
const call=(uid,path,body={})=>handler(uid)({token:'FICTITIOUS',path,body});
test('only owner receives global areas; role label alone never expands scope',async()=>{assert.deepEqual((await call('owner','/api/me')).profile.areas,areas);assert.deepEqual((await call('delegated','/api/me')).profile.areas,['A']);assert.equal((await call('coord','/api/me')).profile.canManageUsers,false);});
test('coordinator dashboard never reads an unauthorized activity',async()=>{reads=[];await assert.rejects(()=>call('coord','/api/dashboard',{activities:['B']}),/autorizadas/);assert.deepEqual(reads,[]);const r=await call('coord','/api/dashboard');assert.equal(r.scope,'authorized');assert.deepEqual(reads,['A']);assert.ok(!JSON.stringify(r).includes('padron'));});
test('teacher cannot open management panel or system synchronization',async()=>{await assert.rejects(()=>call('teacher','/api/dashboard'));await assert.rejects(()=>call('coord','/api/sheets/sync',{deporte:'A'}));await assert.rejects(()=>call('coord','/api/sheets/automation'));});
test('owner aggregate includes requested activities, validates period and returns no personal records',async()=>{reads=[];const r=await call('owner','/api/dashboard',{activities:['B'],days:90});assert.deepEqual(reads,['B']);assert.equal(r.scope,'club');await assert.rejects(()=>call('owner','/api/dashboard',{days:-1}));});
test('weighted attendance and ratings exclude unregistered and future dates',()=>{const s=empty();s.padron=[{id:'1',categoria:'Mini',equipo:'A'}];s.asistencia=[{fecha:'2026-11-13',estado:'P | Sem:R'},{fecha:'2026-11-12',estado:'T | Sem:V'},{fecha:'2026-11-11',estado:'A | Sem:N'},{fecha:'2026-11-10',estado:'N | Sem:N'},{fecha:'2099-01-01',estado:'P | Sem:R'}];s.evaluaciones=[{fecha:'2026-11-13',notas:{a:6.5,b:9.5}}];const r=summarize('A',s,30,Date.parse('2026-11-13T15:00:00Z'));assert.equal(r.asistencia,66.7);assert.equal(r.promedio,8);assert.equal(r.alertas,1);assert.equal(r.sinRegistrar,1);assert.equal(r.registros,3);});
