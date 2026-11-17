'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {dashboard,summarize}=require('../server/supabase/functions/muni360/dashboard.mjs');
const NOW=Date.parse('2026-11-17T12:00:00Z');
const state={padron:[{categoria:'Sub 16',equipo:'A'},{categoria:'Sub 16',equipo:'B'},{categoria:'Sub 18',equipo:'A'}],asistencia:[{fecha:'2026-11-15',categoria:'Sub 16',equipo:'A',estado:'P Sem:V'},{fecha:'2026-11-15',categoria:'Sub 16',equipo:'B',estado:'A Sem:R'},{fecha:'2026-11-15',categoria:'Sub 18',equipo:'A',estado:'T Sem:A'}],evaluaciones:[]};
const actor=(rol,areas=['Vóley'])=>({id:'coord',rol,areas});
const service=async(op,{activity})=>({actor:{status:'activo',rol:'Coordinación',areas:['Vóley']},state});
test('panel resume cada categoría y equipo por separado, sin mezclar porcentajes',()=>{
 const s=summarize('Vóley',state,30,NOW);
 assert.equal(s.gruposDetalle.length,3);
 assert.equal(s.gruposDetalle.find(g=>g.categoria==='Sub 16'&&g.tira==='A').asistencia,100);
 assert.equal(s.gruposDetalle.find(g=>g.categoria==='Sub 16'&&g.tira==='B').asistencia,0);
 assert.equal(s.categoriasDetalle.find(g=>g.categoria==='Sub 16').asistencia,50);
});
test('coordinación consulta solo deportes autorizados y no obtiene datos individuales',async()=>{
 const r=await dashboard(actor('Coordinación'),'owner',{days:30,activities:['Vóley']},service,NOW);
 assert.equal(r.scope,'authorized');
 assert.equal(r.activities.length,1);
 assert.equal(r.activities[0].gruposDetalle.length,3);
 assert.equal(JSON.stringify(r).includes('jugador'),false);
 await assert.rejects(()=>dashboard(actor('Coordinación'),'owner',{days:30,activities:['Hockey']},service,NOW),/autorizadas/);
 await assert.rejects(()=>dashboard(actor('Profe'),'owner',{days:30,activities:['Vóley']},service,NOW),/Coordinación/);
});
test('si cambia el permiso durante la lectura, no entrega estadísticas',async()=>{
 const revoked=async()=>({actor:{status:'suspendido',rol:'Coordinación',areas:[]},state});
 await assert.rejects(()=>dashboard(actor('Coordinación'),'owner',{days:30,activities:['Vóley']},revoked,NOW),/autorización/);
});
