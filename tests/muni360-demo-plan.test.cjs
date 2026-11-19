const test=require('node:test');
const assert=require('node:assert/strict');
const {prepareDemoPlan}=require('../scripts/muni360-demo-plan.mjs');
const catalog={startDate:'2026-07-27',sports:Array.from({length:16},(_,i)=>({name:`Prueba ${i}`,kind:'equipo',categories:['09/10 C']}))};
const snapshots=()=>Object.fromEntries(catalog.sports.map(s=>[s.name,{padron:[],asistencia:[],evaluaciones:[],versiones:{},temporada:1,version:0}]));
test('plan exige lectura de todas las actividades y rechaza grupos ocupados',()=>{
 assert.throws(()=>prepareDemoPlan(catalog,{}),/Falta lectura/);
 for(const key of ['padron','asistencia','evaluaciones']){
  const s=snapshots();s['Prueba 0'][key].push({categoria:'09/10 c',equipo:'a'});
  assert.throws(()=>prepareDemoPlan(catalog,s),/Grupo ocupado/);
 }
});
test('plan conserva códigos, agrupa clases completas y registra sólo sus grupos',()=>{
 const plan=prepareDemoPlan(catalog,snapshots());
 assert.equal(plan.groups.length,32);
 assert.equal(plan.operations.length,32*(1+32+32));
 assert.equal(plan.operations[0].categoria,'09/10 C');
 assert.equal(Object.keys(plan.operations.find(o=>o.tipo==='ASISTENCIA').datos).length,8);
 assert.ok(plan.operations.every(o=>!('idToken' in o)&&!('accessVersion' in o)&&!('revision' in o)));
 assert.equal(plan.status,'requires-live-revalidation');
});
