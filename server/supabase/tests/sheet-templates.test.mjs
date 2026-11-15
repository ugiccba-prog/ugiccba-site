import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {db,rpc,areas} from './browser-fixture.mjs';
import {sha} from '../functions/muni360/domain.mjs';
const secret='mci_'+'a'.repeat(64);
await db.exec(fs.readFileSync(new URL('../sql/005_maintenance.sql',import.meta.url),'utf8'));
await db.exec(fs.readFileSync(new URL('../sql/011_sheet_templates.sql',import.meta.url),'utf8'));
await db.query('insert into mc_private.maintenance(id,source_hash) values(true,$1)',[sha(secret)]);
const before=await db.query('select name,version,epoch from mc_private.activities order by name');
await test('rejects missing, invalid and projection-only secrets without queuing work',async()=>{
  for(const p_secret of [null,'wrong','worker-test'])await assert.rejects(()=>rpc('mc_prepare_sheet_templates',{p_secret},'anon'));
});
await test('preparation is resumable and preserves registered views, records and versions',async()=>{
  const first=await rpc('mc_prepare_sheet_templates',{p_secret:secret},'anon');
  assert.equal(first.pending,2);assert.equal(first.targets.length,2);
  await rpc('mc_worker_ack',{p_secret:secret,p_activity:areas[0],p_version:0,p_sheet:'EXISTING_VIEW_123456789012345',p_staging:[]},'anon');
  let next=await rpc('mc_prepare_sheet_templates',{p_secret:secret},'anon');assert.equal(next.pending,1);
  assert.equal(next.targets.find(t=>t.activity===areas[0]).sheet_id,'EXISTING_VIEW_123456789012345');
  await rpc('mc_worker_ack',{p_secret:secret,p_activity:areas[1],p_version:0,p_sheet:'SECOND_VIEW_123456789012345',p_staging:[]},'anon');
  next=await rpc('mc_prepare_sheet_templates',{p_secret:secret},'anon');assert.equal(next.pending,0);
  assert.deepEqual((await db.query('select name,version,epoch from mc_private.activities order by name')).rows,before.rows);
  assert.equal((await db.query('select count(*)::int n from mc_private.outbox')).rows[0].n,0);
});
await test('does not silently prepare an inactive catalog',async()=>{
  await db.query('update mc_private.activities set enabled=false where name=$1',[areas[0]]);
  await assert.rejects(()=>rpc('mc_prepare_sheet_templates',{p_secret:secret},'anon'));
});
await db.close();
