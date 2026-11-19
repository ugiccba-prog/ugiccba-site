const test=require('node:test');
const assert=require('node:assert/strict');
const {generateDemo}=require('../scripts/muni360-demo.mjs');
const catalog=()=>({startDate:'2026-07-27',sports:Array.from({length:16},(_,i)=>({name:`Prueba ${i}`,kind:i%2?'grupo':'equipo',categories:['09-10','Primera']}))});
test('demo reproduce 16 semanas y códigos exactos en el contrato real y panel compartido',()=>{
 const c=catalog(),result=generateDemo(c);
 assert.deepEqual(result,generateDemo(c));
 assert.equal(result.activities.length,16);
 for(const a of result.activities){
  assert.equal(a.state.padron.length,32);
  assert.equal(a.state.asistencia.length,1024);
  assert.equal(a.state.evaluaciones.length,128);
  assert.equal(new Set(a.state.asistencia.map(r=>r.fecha)).size,32);
  assert.equal(a.panel.registros,1024);
  assert.equal(a.panel.gruposDetalle.length,4);
  assert.deepEqual([...new Set(a.state.padron.map(p=>p.categoria))],['09-10','Primera']);
  assert.ok(a.state.padron.every(p=>p.dni==='' && p.id.startsWith('demo-')));
  const groups=a.panel.gruposDetalle;
  assert.ok(groups.find(g=>g.tira==='A').asistencia>groups.find(g=>g.tira==='B').asistencia);
 }
});
test('rechaza catálogo incompleto, duplicado y fechas inválidas',()=>{
 for(const mutate of [c=>c.sports.pop(),c=>c.sports[1].name=c.sports[0].name,c=>c.sports[0].categories=['09','09'],c=>c.startDate='2026-02-30']){
  const c=catalog();mutate(c);assert.throws(()=>generateDemo(c));
 }
});
test('catálogo recibido conserva las 39 divisiones de fútbol y las agrega por actividad',()=>{
 const c=require('../demo/catalogo.json');
 const football=c.sports.find(s=>s.name==='Fútbol');
 assert.equal(football.divisions.reduce((n,d)=>n+d.categories.length,0),39);
 const result=generateDemo(c);
 assert.equal(result.activities.length,22);
 const men=result.activities.find(a=>a.name==='Fútbol Caballeros');
 assert.equal(men.state.padron.length,34*8);
 assert.ok(men.state.padron.some(p=>p.categoria==='14/15 NE'&&p.equipo==='FUTBOL TAFF MASC'));
 assert.ok(men.state.padron.some(p=>p.categoria==='C'&&p.equipo==='FUTBOL TIFA'));
 assert.equal(new Set(men.state.padron.map(p=>p.id)).size,men.state.padron.length);
});
