const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('server/supabase/tools/PlantillasMuni360.gs','utf8');
function setup(){
  const props={UGI_DATA_SHEET_ID:'control',UGI_SUPABASE_READONLY:'true',UGI_SUPABASE_MAINTENANCE_KEY:'PRIVATE_TEST_KEY'};
  let owner='owner@example.invalid',activeId='control',created=0,released=0;
  const targets=[{activity:'Tenis',sheet_id:'EXISTING_SHEET_123456789'}],deleted=[],images=[],writes=[];
  const sheet={getRange(a){const range={getValue:()=>a==='A1'?'MUNI360_INDICE_PLANTILLAS_V1':'',setValue:v=>(writes.push([a,v]),range),setValues:v=>(writes.push([a,v]),range),setRichTextValues:v=>(writes.push([a,v]),range)};for(const k of ['merge','setFontSize','setFontColor','setFontWeight','setWrap','clearContent','setBackground','setVerticalAlignment'])range[k]=()=>range;return range;},getMaxRows:()=>1000,getImages:()=>images,insertImage(){const image={getAltTextTitle:()=>image.title,setAltTextTitle:v=>(image.title=v,image),setAltTextDescription:()=>image,assignScript:v=>(image.script=v,image)};images.push(image);return image;}};
  for(const k of ['setRowHeights','setColumnWidth','setFrozenRows','setRowHeight','setHiddenGridlines'])sheet[k]=()=>sheet;
  const ss={getId:()=>activeId,getSheetByName:()=>sheet,setActiveSheet(){},toast(){}};
  const context={console,Date,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},SpreadsheetApp:{getActiveSpreadsheet:()=>ss,newRichTextValue(){const rich={setText:()=>rich,setLinkUrl:()=>rich,build:()=>({link:true})};return rich;}},DriveApp:{getFileById:()=>({getOwner:()=>({getEmail:()=>owner}),isTrashed:()=>false})},Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@example.invalid'})},LockService:{getUserLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},Utilities:{base64Decode:s=>Buffer.from(s,'base64'),newBlob:()=>({})},UrlFetchApp:{fetch(url,opt){assert.equal(JSON.parse(opt.payload).p_secret,'PRIVATE_TEST_KEY');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(url.endsWith('mc_prepare_sheet_templates')?{targets,pending:targets.filter(t=>!t.sheet_id).length}:targets)};}},sincronizarMuni360SupabaseOriginalUGI(options){assert.equal(options.soloPlantillas,true);targets.filter(t=>!t.sheet_id).forEach(t=>{created++;t.sheet_id='NEW_SHEET_123456789_'+created;});return {verified:created};},ScriptApp:{getProjectTriggers:()=>['realizarBackupSemanal','sincronizarPendientesUGI','tareasSupabaseUGI','unrelated'].map(name=>({getHandlerFunction:()=>name})),deleteTrigger:t=>deleted.push(t.getHandlerFunction())}};
  vm.createContext(context);vm.runInContext(source,context);
  return {context,props,targets,writes,images,deleted,get created(){return created;},get released(){return released;},setOwner:v=>owner=v,setActive:v=>activeId=v};
}
test('creates only missing views; repeated clicks keep existing destinations and one button',()=>{
  const e=setup();e.targets.push({activity:'Golf',sheet_id:null});
  assert.equal(e.context.crearTodasLasPlantillasUGI().ok,true);assert.equal(e.created,1);
  assert.equal(e.context.crearTodasLasPlantillasUGI().ok,true);assert.equal(e.created,1);
  assert.equal(e.targets[0].sheet_id,'EXISTING_SHEET_123456789');assert.equal(e.images.length,1);
  assert.equal(e.images[0].script,'crearTodasLasPlantillasUGI');assert.equal(e.released,2);
  assert.ok(e.writes.every(([range])=>!String(range).includes('CargaPadron')));
});
test('rejects another workbook, another owner and a non-migrated project before writes',()=>{
  for(const mode of ['book','owner','migration']){const e=setup();if(mode==='book')e.setActive('other');if(mode==='owner')e.setOwner('other@example.invalid');if(mode==='migration')e.props.UGI_SUPABASE_READONLY='false';assert.throws(()=>e.context.crearTodasLasPlantillasUGI());assert.equal(e.writes.length,0);assert.equal(e.created,0);}
});
test('cleanup removes only retired handlers and preserves institutional and unrelated jobs',()=>{
  const e=setup();e.context.limpiarActivadoresAnterioresUGI();assert.deepEqual(e.deleted,['realizarBackupSemanal','sincronizarPendientesUGI']);
});
test('scheduled setup installs the control once with the existing authorized project',()=>{
  const e=setup(),ss=e.context.SpreadsheetApp.getActiveSpreadsheet();
  e.context.SpreadsheetApp.openById=id=>(assert.equal(id,'control'),ss);
  e.context.PropertiesService.getScriptProperties=()=>({getProperty:k=>e.props[k],setProperty:(k,v)=>e.props[k]=v});
  e.context.instalarControlPlantillasUGI();e.context.instalarControlPlantillasUGI();
  assert.equal(e.images.length,1);assert.equal(e.props.UGI_PLANTILLAS_UI_V1,'true');assert.equal(e.deleted.length,2);
});
test('restores trashed registered views once without changing their IDs',()=>{
  const e=setup();let trashed=true,restored=0;
  e.context.DriveApp.getFileById=()=>({getOwner:()=>({getEmail:()=> 'owner@example.invalid'}),isTrashed:()=>trashed,setTrashed:v=>{assert.equal(v,false);restored++;trashed=false;}});
  assert.equal(e.context.crearTodasLasPlantillasUGI().recuperadas,1);
  assert.equal(e.context.crearTodasLasPlantillasUGI().recuperadas,0);
  assert.equal(restored,1);assert.equal(e.targets[0].sheet_id,'EXISTING_SHEET_123456789');assert.equal(e.created,0);
});

 test('actualiza trabajos existentes en lotes sin crear activadores ni enviar mensajes',()=>{
  const e=setup();e.context.Utilities.sleep=()=>{};e.context.SpreadsheetApp.openById=()=>e.context.SpreadsheetApp.getActiveSpreadsheet();let runs=0;e.context.sincronizarMuni360SupabaseOriginalUGI=options=>{assert.equal(options.soloPlantillas,true);runs++;return {verified:[3,2,0][runs-1]};};
  const r=e.context.actualizarPlanillasUGI();assert.equal(r.verificadas,5);assert.equal(r.plantillas,1);assert.equal(runs,3);assert.equal(e.deleted.length,0);
  assert.ok(e.writes.some(([range])=>range==='A6:C6'));
 });
