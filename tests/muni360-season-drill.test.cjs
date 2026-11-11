const test=require('node:test'),assert=require('node:assert/strict');
const {environment}=require('./helpers/apps-script-env.cjs');
function setup(){
 const e=environment();e.seed();
 assert.equal(e.write(e.teacher,{tipo:'ASISTENCIA',categoria:'Sub 12',equipo:'A',fecha:'2026-11-11',datos:{'Persona de prueba':'P | Sem:V'}}).ok,true);
 assert.equal(e.write(e.teacher,{tipo:'EVALUACION',categoria:'Sub 12',equipo:'A',fecha:'2026-11-11',jugador:'Persona de prueba',notas:{Tiro:6.5}}).ok,true);
 e.props.set('UGI_BACKUP_FOLDER_ID','backups');e.props.set('UGI_SYNC_ON_SAVE','true');
 let next=0;const files=new Map(),folders=new Map();
 const privacy={getSharingAccess:()=> 'private',getViewers:()=>[],getEditors:()=>[]};
 function file(id,name='Muni360 - Ensayo de temporada - prueba'){
  if(!files.has(id))files.set(id,{...privacy,getId:()=>id,getName:()=>name,makeCopy(label){
   const copied='season-copy-'+(++next);e.books.set(copied,e.clone(e.books.get(id)||[]));return file(copied,label);
  }});return files.get(id);
 }
 function folder(id){if(!folders.has(id))folders.set(id,{...privacy,getId:()=>id,createFolder:()=>folder('folder-'+(++next))});return folders.get(id);}
 e.ctx.SpreadsheetApp={getActiveSpreadsheet:()=>file('private')};
 e.ctx.Session={getEffectiveUser:()=>({getEmail:()=> 'owner@example.invalid'})};
 e.ctx.DriveApp={Access:{PRIVATE:'private'},getFileById:id=>file(id),getFolderById:id=>folder(id)};
 return {e,files,file};
}
test('cierre aislado: ambos modos, historial, idempotencia y rechazo de ciclo anterior conservan originales y configuracion',()=>{
 const {e}=setup();
 const originalIds=['private','tenis-public','golf-public'],before=originalIds.map(id=>JSON.stringify(e.books.get(id)||[]));
 const config=e.props.get('UGI_SHEET_MAP'),dataId=e.props.get('UGI_DATA_SHEET_ID');
 const r=e.ctx.ensayarCierreTemporadaUGI();
 for(const key of ['ok','padronConservado','fichasConservadas','historialConsultable','reintentoSinDuplicado','temporadaAnteriorRechazada','inicioSinPadron','sheetsVerificado','originalesIntactos'])assert.equal(r[key],true,key);
 assert.equal(r.registrosPrevios.padron,1);assert.equal(r.registrosPrevios.asistencia,1);assert.equal(r.registrosPrevios.sesiones,1);
 assert.deepEqual(originalIds.map(id=>JSON.stringify(e.books.get(id)||[])),before);
 assert.equal(e.props.get('UGI_SHEET_MAP'),config);assert.equal(e.props.get('UGI_DATA_SHEET_ID'),dataId);
 assert.ok(e.props.has('UGI_CIERRE_VERIFICADO'));
});
test('cierre aislado: una falla de escritura no modifica originales ni declara exito',()=>{
 const {e}=setup(),before=JSON.stringify(e.books.get('private'));e.faults.write=true;
 assert.throws(()=>e.ctx.ensayarCierreTemporadaUGI(),/Sheets unavailable/);
 assert.equal(JSON.stringify(e.books.get('private')),before);assert.equal(e.props.has('UGI_CIERRE_VERIFICADO'),false);
});
test('cierre aislado: rechaza una planilla ajena antes de crear copias',()=>{
 const {e,files,file}=setup();e.ctx.SpreadsheetApp.getActiveSpreadsheet=()=>file('otra');
 assert.throws(()=>e.ctx.ensayarCierreTemporadaUGI(),/planilla nueva de ensayo/);
 assert.equal([...files.keys()].filter(id=>id.startsWith('season-copy')).length,0);
});
