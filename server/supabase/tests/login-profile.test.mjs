import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../functions/muni360/core.mjs';

const areas=['Colonia'];
const owner={uid:'owner',email:'owner@example.invalid',nombre:'Dirección',rol:'Dirección UGI',status:'activo',expiresAt:null,areas,capabilities:{},version:'v1'};
function handler(user, rpcOverride){
 return createHandler({now:()=>Date.parse('2026-11-14T19:00:00Z'),verify:async()=>({uid:user.uid,email:user.email}),rpc:rpcOverride||(async()=>({user,owner:'owner',areas}))});
}
const me={path:'/api/me',body:{},token:'verified-by-test'};

test('owner without expiration and teacher both retain active access',async()=>{
 for(const user of [owner,{...owner,uid:'teacher',rol:'Profe'}]){
  const result=await handler(user)(me);
  assert.equal(result.profile.status,'activo');
  assert.equal(result.profile.canManageUsers,user.uid==='owner');
  assert.deepEqual(result.profile.areas,areas);
 }
});
test('only expired authorization is reported as expired',async()=>{
 const result=await handler({...owner,expiresAt:'2026-11-13T00:00:00Z'})(me);
 assert.equal(result.profile.status,'vencido');
 for(const status of ['pendiente','suspendido']){
  assert.equal((await handler({...owner,status})(me)).profile.status,status);
 }
});
test('invalid role is rejected instead of misreported as expiration',async()=>{
 await assert.rejects(()=>handler({...owner,rol:'invalid'})(me),e=>e.code==='PENDIENTE');
});
test('unexpected profile errors propagate instead of misreporting expiration',async()=>{
 const user={...owner,uid:'teacher',rol:'Profe',areas:{invalid:true}};
 await assert.rejects(()=>handler(user)(me),TypeError);
});
test('Comunidad session routes separately and leaves the Muni owner unchanged',async()=>{
 const before=structuredClone(owner),calls=[];
 const run=handler(owner,async(name,args)=>{
  calls.push([name,args]);
  if(name==='mc_comunidad')return {profile:{uid:owner.uid,rol:owner.rol,canPublish:true}};
  return {user:owner,owner:owner.uid,areas};
 });
 assert.equal((await run({path:'/api/comunidad/session',body:{},token:'test'})).profile.canPublish,true);
 assert.equal((await run(me)).profile.status,'activo');
 assert.deepEqual(calls.map(([name])=>name),['mc_comunidad','mc_service']);
 assert.deepEqual(owner,before);
});
