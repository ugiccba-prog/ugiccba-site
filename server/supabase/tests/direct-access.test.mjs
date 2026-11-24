import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createHandler} from '../functions/muni360/core.mjs';
import {sha} from '../functions/muni360/domain.mjs';
import {areas,call,db,rpc} from './browser-fixture.mjs';

const secret='mci_'+'e'.repeat(64);
for(const file of ['005_maintenance.sql','009_access_notifications.sql','012_weekly_coordinator_alerts.sql','016_direct_access.sql']){
 await db.exec(fs.readFileSync(new URL('../sql/'+file,import.meta.url),'utf8'));
}
await db.query('insert into mc_private.maintenance(id,source_hash)values(true,$1)',[sha(secret)]);

const add=(email,extra={},actor='owner')=>call(actor,{email,rol:'Profe',areas:[areas[0]],...extra},'/api/users/add');
const list=async()=>(await call('owner',{},'/api/users/list')).users;
const tasks=p_result=>rpc('mc_source_tasks',{p_secret:secret,p_result},'anon');
const me=(uid,email)=>createHandler({rpc,verify:async()=>({uid,email,nombre:'Cuenta de prueba'})})({path:'/api/me',body:{}});

await test('only the owner can pre-authorize a valid address with an operational role and scope',async()=>{
 await assert.rejects(add('new@example.invalid',{},'teacher'),{code:'PERMISOS'});
 await assert.rejects(add('one@example.invalid,two@example.invalid'),{code:'VALIDACION'});
 await assert.rejects(add('new@example.invalid',{areas:[]}),{code:'VALIDACION'});
 await assert.rejects(add('new@example.invalid',{rol:'Dirección UGI'}),{code:'VALIDACION'});
 await assert.rejects(add('new@example.invalid',{rol:'Reemplazante'}),{code:'VALIDACION'});
 await assert.rejects(rpc('mc_service',{p_action:'addUser',p:{uid:'owner'}},'anon'),{code:'PERMISOS'});
});

await test('the notice is queued once, survives first login, and records send or review status',async()=>{
 const email='new@example.invalid';
 const {user}=await add(' NEW@EXAMPLE.INVALID ',{rol:'Coordinación'});
 assert.equal(user.email,email);
 assert.equal(user.awaitingLogin,true);
 assert.equal((await list()).find(u=>u.uid===user.uid).noticeStatus,'pending');
 await assert.rejects(add(email),{code:'CONFLICTO'});
 assert.equal((await me('other-uid','other@example.invalid')).profile.status,'pendiente');

 const {profile}=await me('new-uid','New@example.invalid');
 assert.equal(profile.uid,'new-uid');
 assert.equal(profile.status,'activo');
 assert.equal(profile.rol,'Coordinación');
 assert.deepEqual(profile.areas,[areas[0]]);
 const users=await list();
 assert.equal(users.some(u=>u.uid===user.uid),false);
 assert.equal(users.find(u=>u.uid==='new-uid').noticeStatus,'pending');
 assert.equal((await me('different-uid',email)).profile.status,'pendiente');

 const result=await tasks({approvalClaim:10});
 assert.equal(result.approvals.length,1);
 const [notice]=result.approvals;
 assert.equal(notice.email,email);
 assert.deepEqual(notice.areas,[areas[0]]);
 assert.equal((await tasks({approvalClaim:10})).approvals.length,0);
 await tasks({approvalReview:[notice.id]});
 assert.equal((await list()).find(u=>u.uid==='new-uid').noticeStatus,'review');
 assert.equal((await me('new-uid',email)).profile.status,'activo');
 const history=(await call('owner',{},'/api/users/history')).events;
 assert.equal(history.filter(e=>e.target===email&&e.motivo==='Alta directa por correo').length,1);
});

await test('a pending account can be enabled in place and a suspended invitation stays suspended',async()=>{
 await me('known-uid','known@example.invalid');
 const {user}=await add('known@example.invalid');
 assert.equal(user.uid,'known-uid');
 assert.equal((await me('known-uid','known@example.invalid')).profile.status,'activo');
 const queued=(await tasks({approvalClaim:10})).approvals;
 assert.deepEqual(queued.map(x=>x.email),['known@example.invalid']);
 await tasks({approvalSent:[queued[0].id]});
 assert.equal((await list()).find(u=>u.uid==='known-uid').noticeStatus,'sent');

 const invited=(await add('suspended@example.invalid')).user;
 await call('owner',{uid:invited.uid,revision:invited.revision,rol:'Profe',status:'suspendido',areas:[areas[0]]},'/api/users/update');
 assert.equal((await me('suspended-uid','suspended@example.invalid')).profile.status,'suspendido');
 assert.equal((await tasks({approvalClaim:10})).approvals.length,0);
 await assert.rejects(add('suspended@example.invalid'),{code:'CONFLICTO'});
});
await db.close();
