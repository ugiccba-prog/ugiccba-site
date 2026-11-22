import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {db,rpc} from './browser-fixture.mjs';
import {sha} from '../functions/muni360/domain.mjs';
import {buildDemoSql} from '../../../scripts/build-muni360-demo-sql.mjs';
const secret='mci_'+'f'.repeat(64);
await db.exec(fs.readFileSync(new URL('../sql/005_maintenance.sql',import.meta.url),'utf8'));
await db.query('insert into mc_private.maintenance(id,source_hash)values(true,$1)',[sha(secret)]);
test('optimized worker keeps contract, redaction and credentials, without changing records',async()=>{
 const original=await rpc('mc_worker_jobs',{p_secret:secret,p_limit:1},'anon');
 await db.exec(fs.readFileSync(new URL('../tools/optimize-worker-jobs.sql',import.meta.url),'utf8'));
 assert.deepEqual(await rpc('mc_worker_jobs',{p_secret:secret,p_limit:1},'anon'),original);
 assert.deepEqual(await rpc('mc_worker_jobs',{p_secret:secret,p_limit:0},'anon'),[]);
 await assert.rejects(()=>rpc('mc_worker_jobs',{p_secret:'wrong',p_limit:1},'anon'));
 const catalog=JSON.parse(fs.readFileSync(new URL('../../../demo/catalogo.json',import.meta.url),'utf8'));
 for(const s of catalog.sports)for(const d of s.divisions)await db.query('insert into mc_private.activities(name,enabled) values($1,true) on conflict do nothing',[d.activity]);
 await db.exec(buildDemoSql(catalog));
 // Put the largest demo activity first, exercising an entire 16-week season.
 await db.query("update mc_private.outbox set updated_at=now()-interval '1 day' where activity='Rugby Caballeros'");
 const before=(await db.query('select count(*)::int as n from mc_private.records')).rows[0].n;
 const start=performance.now();
 const jobs=await rpc('mc_worker_jobs',{p_secret:secret,p_limit:5},'anon');
 console.log('Full-season worker milliseconds:',Math.round(performance.now()-start));
 assert.equal(jobs.length,1);
 assert.equal(jobs[0].activity,'Rugby Caballeros');
 assert.equal(jobs[0].state.padron.length,256);
 assert.equal(jobs[0].state.asistencia.length,8192);
 assert.equal(jobs[0].state.evaluaciones.length,1024);
 assert.ok(jobs[0].state.padron.every(p=>!Object.hasOwn(p,'dni')));
 assert.equal((await db.query('select count(*)::int as n from mc_private.records')).rows[0].n,before);
 assert.equal((await db.query('select count(*)::int as n from mc_private.outbox')).rows[0].n,23);
 // Follow-up for the operational backlog: prioritize populated activities and
 // allow a bounded three destinations per background cycle, without acknowledging
 // any queued version or exposing sensitive private fields.
 await db.exec(fs.readFileSync(new URL('../tools/worker-jobs-priority.sql',import.meta.url),'utf8'));
 const prioritized=await rpc('mc_worker_jobs',{p_secret:secret,p_limit:5},'anon');
 assert.equal(prioritized.length,3);
 assert.equal(prioritized[0].activity,'Rugby Caballeros');
 assert.equal(prioritized[0].state.padron.length,256);
 assert.ok(prioritized.every(job=>job.state.padron.every(p=>!Object.hasOwn(p,'dni'))));
 assert.deepEqual(await rpc('mc_worker_jobs',{p_secret:secret,p_limit:0},'anon'),[]);
 await assert.rejects(()=>rpc('mc_worker_jobs',{p_secret:'wrong',p_limit:5},'anon'));
 assert.equal((await db.query('select count(*)::int as n from mc_private.outbox')).rows[0].n,23);
 assert.equal((await db.query('select count(*)::int as n from mc_private.records')).rows[0].n,before);
});
test.after(()=>db.close());
