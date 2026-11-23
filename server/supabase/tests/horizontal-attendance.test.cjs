const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const helper=fs.readFileSync('server/supabase/tools/AsistenciaHorizontal.gs','utf8').replace(/\r\n/g,'\n');
function matrix(state,activity){const c={};vm.createContext(c);vm.runInContext(helper,c);return JSON.parse(JSON.stringify(c.tablasAsistenciaHorizontalUGI(state,activity)));}
const person=(id,name,cat='5y6',eq='A')=>({id,jugador:name,categoria:cat,equipo:eq});
const mark=(id,name,date,estado,cat='5y6',eq='A')=>({jugadorId:id,jugador:name,fecha:date,estado,categoria:cat,equipo:eq});
test('one tab per category and team, dates horizontal, all roster names and daily totals',()=>{
 const state={padron:[person('1','Ana'),person('2','Bruno'),person('3','Carla','5y6','B')],asistencia:[mark('1','Ana','2026-11-23','T | Sem:R'),mark('1','Ana','2026-11-22','P'),mark('2','Bruno','2026-11-22','A')]};
 const before=JSON.stringify(state),out=matrix(state);
 assert.deepEqual(out['Asist · 5y6 · A'],[['Jugador','22/11/2026','23/11/2026'],['Ana','P','T'],['Bruno','A',''],['Total presentes',1,1]]);
 assert.deepEqual(out['Asist · 5y6 · B'],[['Jugador','22/11/2026','23/11/2026'],['Carla','',''],['Total presentes','Sin registros','Sin registros']]);assert.equal(JSON.stringify(state),before);
});
test('duplicates do not add rows or inflate counts; legacy names resolve to roster identities',()=>{
 const state={padron:[person('1','Ana'),person('1','Ana')],asistencia:[mark('1','Ana','2026-11-22','P'),mark('1','Ana','2026-11-22','P'),mark(null,' ANA ','2026-11-22','P')]};
 assert.deepEqual(matrix(state)['Asist · 5y6 · A'],[['Jugador','22/11/2026'],['Ana','P'],['Total presentes',1]]);
});
test('conflicting marks require review, unmarked is blank and all absent is confirmed zero',()=>{
 const out=matrix({padron:[person('1','Ana'),person('2','Bruno')],asistencia:[mark('1','Ana','2026-11-22','P'),mark('1','Ana','2026-11-22','A'),mark('2','Bruno','2026-11-22','N | Sem:V'),mark('1','Ana','2026-11-23','A'),mark('1','Ana','2026-11-24','N')]})['Asist · 5y6 · A'];
 assert.deepEqual(out[1],['Ana','Revisar','A','']);assert.deepEqual(out[2],['Bruno','','','']);assert.deepEqual(out.at(-1),['Total presentes','Revisar',0,'Sin registros']);
});
test('historical participants remain; invalid dates and non-attendance states never become marks',()=>{
 const out=matrix({asistencia:[mark('1','Ex integrante','2026-11-22','P | Comida:SI'),mark('2','Inválido','2026-02-30','P'),mark('1','Ex integrante','2026-11-23','Permiso')]});
 assert.deepEqual(out['Asist · 5y6 · A'],[['Jugador','22/11/2026','23/11/2026'],['Ex integrante','P',''],['Total presentes',1,'Sin registros']]);
});
test('sheet names are valid, bounded and distinct after sanitizing; text remains literal',()=>{
 const out=matrix({padron:[person('1','=Ana','A/B'),person('2','Otra','A:B'),person('3','Larga','x'.repeat(180))]});
 assert.equal(Object.keys(out).length,3);for(const title of Object.keys(out)){assert.ok(title.length<=100);assert.doesNotMatch(title,/[\[\]:*?\/\\]/);}assert.ok(Object.values(out).some(rows=>rows[1][0]==='=Ana'));
});
test('institutional and full bridge embed exactly the tested projection helper',()=>{
 for(const file of ['SheetsInstitucional.gs','SheetsCompleto.gs']){
  const source=fs.readFileSync('server/supabase/tools/'+file,'utf8').replace(/\r\n/g,'\n');assert.ok(source.endsWith(helper));assert.match(source,/var matrices=tablasAsistenciaHorizontalUGI\(s,name\)/);assert.match(source,/frozenColumnCount:1/);assert.match(source,/Sin registros de esta temporada/);
 }
});

 test('Colonia actual y futura: P/T con comedor, vianda y tres totales diarios sin duplicar',()=>{
  const state={padron:[person('1','Ana'),person('2','Bruno'),person('3','Carla'),person('4','Diego')],asistencia:[mark('1','Ana','2026-11-22','P | 🍴 Comida | Sem:V'),mark('1','Ana','2026-11-22','P | 🍴 Comida | Sem:V'),mark('2','Bruno','2026-11-22','T | Sem:A'),mark('3','Carla','2026-11-22','A | 🍴 Comida | Sem:R'),mark('4','Diego','2026-11-22','N | 🍴 Comida | Sem:V')]};
  const rows=matrix(state,'Colonia')['Asist · 5y6 · A'];assert.equal(rows[1][1],'P 🍴');assert.equal(rows[2][1],'T');assert.equal(rows[3][1],'A');assert.equal(rows[4][1],'');assert.deepEqual(rows.slice(-3),[['Total presentes',2],['Total comedor',1],['Total vianda',1]]);
  assert.equal(matrix(state,'COYFD')['Asist · 5y6 · A'].at(-1)[0],'Total presentes');
 });
 test('comida contradictoria pide revisión; sin carga no convierte comida en cero',()=>{
  let rows=matrix({padron:[person('1','Ana')],asistencia:[mark('1','Ana','2026-11-22','P | 🍴 Comida | Sem:V'),mark('1','Ana','2026-11-22','P | Sem:V')]},'Colonia')['Asist · 5y6 · A'];assert.equal(rows[1][1],'Revisar');assert.ok(rows.slice(-3).every(r=>r[1]==='Revisar'));
  rows=matrix({padron:[person('1','Ana')],asistencia:[mark('1','Ana','2026-11-22','N | Sem:N')]},'Colonia')['Asist · 5y6 · A'];assert.ok(rows.slice(-3).every(r=>r[1]==='Sin registros'));
 });
