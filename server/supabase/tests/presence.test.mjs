import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyPresence,presenceDate} from '../functions/muni360/presence.mjs';
import {dashboard} from '../functions/muni360/dashboard.mjs';
const date='2026-11-22';
const p=(id,categoria='Mini',equipo='A')=>({id,jugador:'Chico '+id,categoria,equipo});
const a=(id,estado,categoria='Mini',equipo='A')=>({jugadorId:id,jugador:'Chico '+id,estado,categoria,equipo,fecha:date});
test('P and T are present; absence, unmarked and semaphore-only do not count; input is unchanged',()=>{
 const s={padron:['1','2','3','4','5'].map(id=>p(id)),asistencia:[a('1','P | Sem:R'),a('2','T | Sem:V'),a('3','A | Sem:V'),a('4','N | Sem:V')]},before=JSON.stringify(s);
 const r=dailyPresence('Colonia',s,date);assert.equal(r.presentes,2);assert.equal(r.tardes,1);assert.equal(r.ausentes,1);assert.equal(r.sinRegistrar,2);assert.equal(r.incompleta,true);assert.equal(JSON.stringify(s),before);
});
test('duplicate records and cross-group membership count a person once per activity',()=>{
 const r=dailyPresence('COYFD',{padron:[p('1'),p('1','Mini','B')],asistencia:[a('1','P'),a('1','P'),a('1','T','Mini','B')]},date);
 assert.equal(r.presentes,1);assert.deepEqual(r.grupos.map(g=>g.presentes),[1,1]);assert.equal(r.conflictos,0);
});
test('legacy names resolve to roster IDs; different people with same name retain IDs',()=>{
 const r=dailyPresence('Colonia',{padron:[p('1'),p('2')],asistencia:[{...a('1','P'),jugadorId:undefined},a('1','P'),{...a('2','T'),jugador:'Chico 1'}]},date);
 assert.equal(r.presentes,2);
});
test('contradictory duplicates are flagged rather than choosing arbitrary record order',()=>{
 for(const asistencia of [[a('1','P'),a('1','A')],[a('1','A'),a('1','P')]]){const r=dailyPresence('Colonia',{padron:[p('1')],asistencia},date);assert.equal(r.presentes,0);assert.equal(r.conflictos,1);assert.equal(r.grupos[0].conflictos,1);}
});
test('all absent is confirmed zero; missing date and empty groups say no records',()=>{
 const s={padron:[p('1'),p('2','Otro')],asistencia:[a('1','A')]};
 const r=dailyPresence('Colonia',s,date);assert.equal(r.presentes,0);assert.equal(r.sinRegistros,false);assert.equal(r.grupos[1].sinRegistros,true);
 assert.equal(dailyPresence('Colonia',s,'2026-11-21').sinRegistros,true);assert.equal(dailyPresence('COYFD',{},date).sinRegistros,true);
});
test('historical attendance remains counted after roster removal; invalid status is unregistered',()=>{
 const r=dailyPresence('Colonia',{asistencia:[a('1','P | Comida:SI'),a('2','Permiso'),a('3','Sem:V')]},date);assert.equal(r.presentes,1);assert.equal(r.sinRegistrar,2);
});
test('Buenos Aires date around UTC midnight and leap date validation',()=>{
 assert.equal(presenceDate(undefined,Date.parse('2026-11-23T02:59:59Z')),date);assert.equal(presenceDate(undefined,Date.parse('2026-11-23T03:00:00Z')),'2026-11-23');
 for(const d of ['2026-02-29','2026-13-01','22/11/2026',null,123])assert.throws(()=>presenceDate(d,Date.now()));assert.equal(presenceDate('2028-02-29',0),'2028-02-29');
});
test('daily endpoint enforces roles, area scope and fresh permissions; returns only aggregates',async()=>{
 const actor={id:'c',rol:'Coordinación',areas:['Colonia'],status:'activo'};let calls=0;
 const service=async(action,args)=>{calls++;assert.equal(action,'load');assert.equal(args.scope,'dashboard');return {actor,state:{padron:[p('1')],asistencia:[a('1','P')]}};};const now=Date.parse(date+'T15:00:00Z');
 const r=await dashboard(actor,'owner',{daily:true,date},service,now);assert.equal(r.activities[0].presentes,1);assert.ok(!JSON.stringify(r).includes('Chico'));assert.ok(!JSON.stringify(r).includes('jugadorId'));
 calls=0;await assert.rejects(()=>dashboard(actor,'owner',{daily:true,date,activities:['COYFD']},service,now));assert.equal(calls,0);
 await assert.rejects(()=>dashboard({...actor,rol:'Profe'},'owner',{daily:true,date},service,now));
 await assert.rejects(()=>dashboard(actor,'owner',{daily:true,date:'2026-02-30'},service,now));
 await assert.rejects(()=>dashboard(actor,'owner',{daily:true,date},async()=>({actor:{...actor,status:'suspendido'},state:{}}),now));
});
