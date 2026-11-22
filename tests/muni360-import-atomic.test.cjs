const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
test('batch import validates every group and never mutates original state when second group fails',async()=>{
 const domain=await import(pathToFileURL(path.resolve('server/supabase/functions/muni360/domain.mjs')).href);
 const original=domain.empty(),actor={capabilities:{verDni:true}};
 const a={categoria:'Mini',equipo:'A',jugadores:[{jugador:'Persona Uno',dni:'58999666'}]};
 const b={categoria:'Mini',equipo:'B',jugadores:[{jugador:'Persona Dos',dni:'58999667'}]};
 const good=domain.applyOperation(original,{tipo:'ALTA_PADRON_LOTE',grupos:[a,b]},actor,{idSecret:'test-identity-secret'});
 assert.equal(original.padron.length,0);assert.deepEqual(good.padron.map(p=>p.equipo),['A','B']);
 assert.throws(()=>domain.applyOperation(original,{tipo:'ALTA_PADRON_LOTE',grupos:[a,{...b,jugadores:[{jugador:'Persona Dos',dni:'mal'}]}]},actor,{idSecret:'test'}),/DNI inválido/);
 assert.throws(()=>domain.applyOperation(original,{tipo:'ALTA_PADRON_LOTE',grupos:[a,{...b,equipo:'a'}]},actor,{idSecret:'test'}),/mismo destino/);
 assert.throws(()=>domain.applyOperation(original,{tipo:'ALTA_PADRON_LOTE',grupos:[a,{...b,jugadores:[{jugador:'Persona Dos',dni:'58999666'}]}]},actor,{idSecret:'test'}),/DNI figura en dos grupos/);
 assert.equal(original.padron.length,0);
});
