import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {db,rpc} from './browser-fixture.mjs';import {sha} from '../functions/muni360/domain.mjs';
const secret='mci_'+'d'.repeat(64);
for(const f of ['005_maintenance.sql','009_access_notifications.sql'])await db.exec(fs.readFileSync(new URL('../sql/'+f,import.meta.url),'utf8'));
await db.query('insert into mc_private.maintenance(id,source_hash)values(true,$1)',[sha(secret)]);
const update=async(patch)=>db.query("update mc_private.users set record=record||$1::jsonb where uid='teacher'",[JSON.stringify(patch)]);
const tasks=async(p_result)=>rpc('mc_source_tasks',{p_secret:secret,p_result},'anon');
await test('existing authorized users are not notified retroactively; browser cannot read or claim the private queue',async()=>{
 assert.equal((await db.query('select count(*) as n from mc_private.access_notices')).rows[0].n,0);
 await assert.rejects(()=>db.exec('set role anon;select * from mc_private.access_notices'));await db.exec('reset role');
 await assert.rejects(()=>rpc('mc_source_tasks',{p_secret:'wrong',p_result:{approvalClaim:10}},'anon'));
});
await test('approval queues once; active edits refresh pending scope; reservation prevents automatic duplicates',async()=>{
 await update({status:'pendiente'});await update({status:'activo',version:'approval-v1'});
 await update({version:'approval-v2',rol:'Consulta'});
 assert.equal((await db.query('select count(*) as n from mc_private.access_notices')).rows[0].n,1);
 assert.equal((await tasks({approvalClaim:0})).approvals.length,0);
 const claimed=(await tasks({approvalClaim:10})).approvals;assert.equal(claimed.length,1);assert.equal(claimed[0].rol,'Consulta');
 assert.equal((await tasks({approvalClaim:10})).approvals.length,0);
 await tasks({approvalSent:[claimed[0].id]});await tasks({approvalSent:[claimed[0].id]});
 assert.equal((await db.query("select count(*) as n from mc_private.access_notices where status='sent'")).rows[0].n,1);
});
await test('revocation cancels queued mail; expired and invalid recipients are never sent',async()=>{
 await update({status:'suspendido'});await update({status:'activo',version:'approval-v3'});await update({status:'suspendido'});
 assert.equal((await tasks({approvalClaim:10})).approvals.length,0);
 await update({status:'activo',version:'approval-v4',expiresAt:'2000-01-01T00:00:00Z'});
 assert.equal((await tasks({approvalClaim:10})).approvals.length,0);
 await update({version:'approval-v5',expiresAt:null,email:'bad@example.com,other@example.com'});
 assert.equal((await tasks({approvalClaim:10})).approvals.length,0);
});
await test('ambiguous sends become review work and are never automatically reclaimed',async()=>{
 await update({status:'suspendido'});await update({status:'activo',version:'approval-v6',email:'teacher@example.com'});
 const claimed=(await tasks({approvalClaim:10})).approvals;assert.equal(claimed.length,1);
 await db.query("update mc_private.access_notices set claimed_at=now()-interval '16 minutes' where id=$1",[claimed[0].id]);
 assert.equal((await tasks({approvalClaim:10})).approvals.length,0);
 assert.equal((await db.query('select status from mc_private.access_notices where id=$1',[claimed[0].id])).rows[0].status,'review');
});
await test('approval and queue insertion roll back atomically',async()=>{
 await update({status:'pendiente'});const before=(await db.query('select count(*) as n from mc_private.access_notices')).rows[0].n;
 await db.exec('begin');await update({status:'activo',version:'rolled-back'});await db.exec('rollback');
 assert.equal((await db.query('select count(*) as n from mc_private.access_notices')).rows[0].n,before);
});
await test('mail goes to the account holder with only relevant portal links; no email is sent in this test',()=>{
 const ctx={};vm.runInNewContext(fs.readFileSync(new URL('../tools/MantenimientoOriginal.gs',import.meta.url),'utf8'),ctx);
 const mail=ctx.mensajeAccesoHabilitadoUGI({email:'teacher@example.com',nombre:'Profe ficticio',rol:'Profe',areas:['Colonia']});
 assert.equal(mail.to,'teacher@example.com');assert.match(mail.body,/\/muni360cyc\//);assert.ok(!mail.body.includes('/muni360/'));
 const both=ctx.mensajeAccesoHabilitadoUGI({email:'teacher@example.com',nombre:'Ficticio',rol:'Coordinación',areas:['Colonia','Tenis']});assert.match(both.body,/\/muni360\//);assert.match(both.body,/\/muni360cyc\//);
 assert.throws(()=>ctx.mensajeAccesoHabilitadoUGI({email:'a@example.com\nb@example.com',areas:['Tenis']}));
});
await db.close();
