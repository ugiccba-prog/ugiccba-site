'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {empty,applyOperation,records,fromRecords}=require('../server/supabase/functions/muni360/domain.mjs');
const actor={id:'coord',nombre:'Coordinación',rol:'Coordinación',capabilities:{administrarPadron:true}};
const historic={fecha:'2026-05-01',categoria:'Sub 16',equipo:'A',jugador:'Ejemplo',jugadorId:'id1',notas:{'Actitud y compromiso (Carácter)':8,'Respeto y convivencia (Conexión)':7}};
test('desactivar un gesto no elimina ni modifica evaluaciones históricas',()=>{
 const state=empty();
 state.padron=[{id:'id1',categoria:'Sub 16',equipo:'A',jugador:'Ejemplo'}];
 state.gestos=['Recepción','Saque'];
 state.evaluaciones=[historic];
 const next=applyOperation(state,{tipo:'GESTOS',deporte:'Vóley',gestos:['Saque']},actor);
 assert.deepEqual(next.gestos,['Saque']);
 assert.deepEqual(next.evaluaciones,[historic]);
 assert.deepEqual(state.gestos,['Recepción','Saque']);
 assert.deepEqual(state.evaluaciones,[historic]);
});
test('restaurar gestos por defecto conserva notas antiguas y la ausencia de cuarta C',()=>{
 const state=empty();
 state.padron=[{id:'id1',categoria:'Sub 16',equipo:'A',jugador:'Ejemplo'}];
 state.gestos=['Saque','Nuevo gesto'];
 state.evaluaciones=[historic];
 const restored=applyOperation(state,{tipo:'GESTOS',deporte:'Vóley',gestos:['Recepción','Saque']},actor);
 assert.deepEqual(restored.gestos,['Recepción','Saque']);
 assert.equal(restored.evaluaciones[0].notas['Actitud y compromiso (Carácter)'],8);
 assert.equal(Object.hasOwn(restored.evaluaciones[0].notas,'Competencia'),false);
 const saved=fromRecords([...records(restored).values()]);
 assert.deepEqual(saved.evaluaciones,restored.evaluaciones);
});
