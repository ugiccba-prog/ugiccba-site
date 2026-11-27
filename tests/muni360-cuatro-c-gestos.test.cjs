'use strict';
const {readPortal}=require('./helpers/portal-source.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=readPortal(path.join(root,'apps/muni360/source/deportes/index.html'));
const policy=()=>import('../server/supabase/functions/muni360/policy.mjs');
test('las cuatro C están presentes, sin reemplazar ni alterar las evaluaciones anteriores',()=>{
 const m=src.match(/const GESTOS_COMUNES_UGI\s*=\s*\[([^\]]+)\]/);
 assert.ok(m);
 for(const c of ['Competencia','Confianza','Conexión','Carácter'])assert.ok(m[1].includes('"'+c+'"'),c);
 assert.ok(src.includes('GESTOS_FORMATIVOS_HISTORICOS'));
 for(const c of ['Actitud y compromiso','Respeto y convivencia','Tolerancia al error'])assert.ok(src.includes(c));
 assert.equal((src.match(/Muni360Sync\.splitAverage\([^\n]+GESTOS_FORMATIVOS_ESTADISTICA/g)||[]).length,3);
});
test('gestos técnicos: restauración y bloqueo de eliminación de 4C',()=>{
 assert.match(src,/id="btn-restaurar-gestos"/);
 assert.match(src,/GESTOS_COMUNES_UGI\.includes\(gQuitar\)/);
 assert.match(src,/tipo:'GESTOS',deporte:areaActiva,gestos:base/);
});
test('el servidor limita la edición de gestos a coordinación o dirección, no a profesores',async()=>{
 const {authorize}=await policy();
 const make=(rol,cap)=>({rol,areas:['Vóley'],capabilities:{administrarPadron:cap}});
 assert.throws(()=>authorize(make('Profe',false),{tipo:'GESTOS',deporte:'Vóley'}));
 assert.throws(()=>authorize(make('Profe',true),{tipo:'GESTOS',deporte:'Vóley'}));
 assert.doesNotThrow(()=>authorize(make('Coordinación',true),{tipo:'GESTOS',deporte:'Vóley'}));
 assert.throws(()=>authorize(make('Coordinación',true),{tipo:'GESTOS',deporte:'Hockey'}));
});

test('una 4C sin nota se presenta como No evaluada y no se transforma en cero',()=>{
 assert.match(src,/esUgi && !tiene \? '<small class="hint"[^']*No evaluada/);
 assert.match(src,/const tiene = val !== undefined && val !== null && val !== ''/);
});
