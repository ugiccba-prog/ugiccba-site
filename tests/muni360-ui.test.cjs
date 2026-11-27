const test=require('node:test'),assert=require('node:assert/strict');
const ui=require('../assets/scripts/muni360-ui.js');
const data={padron:[{id:'1',jugador:'Ana',categoria:'Sub 16',equipo:'A'},{id:'2',jugador:'Belén',categoria:'Sub 16',equipo:'A'},{id:'3',jugador:'Otra',categoria:'Sub 19',equipo:'B'}],asistencia:[{jugador:'Ana',categoria:'Sub 16',equipo:'A',fecha:'2026-11-17',estado:'T | Sem:A'},{jugador:'Belén',categoria:'Sub 16',equipo:'A',fecha:'2026-09-01',estado:'A | Sem:R'}],evaluaciones:[{jugador:'Ana',categoria:'Sub 16',equipo:'A',fecha:'2026-11-17',notas:{Tiro:8,Equipo:7,Conducta:9}},{jugador:'Belén',categoria:'Sub 16',equipo:'A',fecha:'2026-11-17',notas:{Tiro:6,Equipo:9,Conducta:8}},{jugador:'Ana',categoria:'Sub 19',equipo:'B',fecha:'2026-11-17',notas:{Tiro:2}}],fichas:{'1':{dua:{comunicacion:'Visible'},legajo:{nota:'PRIVADO'}}}};
test('períodos y grupo modifican datos; seguimiento usa sólo apoyos visibles',()=>{
 assert.equal(ui.summarize(data,'2026-11-17',30).total,1);assert.equal(ui.summarize(data,'2026-11-17',90).total,2);
 const v=ui.views(data,'2026-11-17','Hockey',{rol:'Profe'},{cat:'Sub 16',eq:'A',days:30});
 assert.ok(v.inicio.includes('Hola, Profe'));assert.ok(!v.seguimiento.includes('PRIVADO'));assert.ok(v.seguimiento.includes('Ver seguimiento'));assert.ok(!v.seguimiento.includes('Otra'));
});
test('comparación muestra dimensiones reales, radar opcional y evolución filtrada',()=>{
 const opts={cat:'Sub 16',eq:'A',end:'2026-11-17',days:30,players:['Ana','Belén']};
 const v=ui.comparison(data,opts);assert.match(v,/Radar y evolución comparada/);assert.match(v,/Equipo · promedio por jugador/);assert.match(v,/data-compare-swap/);
 assert.ok(!ui.comparison(data,{...opts,showAvg:false}).includes('Equipo · promedio por jugador'));
 assert.deepEqual(ui.evaluationTrend(data,{...opts,player:'Ana'}),[{date:'2026-11-17',value:8}]);
 assert.ok(!ui.comparison(data,{...opts,players:['Ana','Ana']}).includes('Radar y evolución comparada'));
});
test('avisos y horarios se filtran sin crear contenido y escapan texto externo',()=>{
 const items=[{actividad:'Hockey',categoria:'Sub 16',equipo:'A',titulo:'<img onerror=x>',detalle:'Mensaje'},{actividad:'Hockey',categoria:'Sub 19',equipo:'B'},{actividad:'General',titulo:'General'},{actividad:'Otro deporte'}];
 const c={activity:'Hockey',cat:'Sub 16',eq:'A'};assert.equal(ui.filterFeed(items,c).length,2);
 const v=ui.feed({items,loaded:true},c);assert.ok(!v.includes('<img onerror=x>'));assert.ok(v.includes('&lt;img onerror=x&gt;'));
 assert.match(ui.agenda([],'Hockey'),/Todavía no hay horarios publicados/);assert.ok(!ui.feed({items}, {...c,demo:true}).includes('Mensaje'));
});
