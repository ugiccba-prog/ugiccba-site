const test=require('node:test');
const assert=require('node:assert/strict');
const {environment}=require('./helpers/apps-script-env.cjs');

test('el inicio de ensayo crea recursos una sola vez y rechaza una planilla ajena, compartida o sin API',()=>{
  for(const mode of ['ok','wrong-name','shared','api-fails']){
    const e=environment();e.props.delete('UGI_SHEET_MAP');e.props.delete('UGI_ID_SECRET');
    let views=0,folders=0;
    const resource={getSharingAccess:()=>mode==='shared'?'public':'private',getViewers:()=>[],getEditors:()=>[]};
    e.ctx.Session={getEffectiveUser:()=>({getEmail:()=> 'owner@example.invalid'})};
    e.ctx.DriveApp={Access:{PRIVATE:'private'},getFileById:()=>resource,getFolderById:()=>resource,createFolder(){folders++;return {getId:()=> 'folder-trial'};}};
    e.ctx.SpreadsheetApp={getActiveSpreadsheet:()=>({getId:()=> 'private',getName:()=>mode==='wrong-name'?'Planilla real':'Muni360 - Ensayo de temporada - Ejemplo',setSpreadsheetTimeZone(){}}),create(){views++;const id='view-'+views;return {getId:()=>id,setSpreadsheetTimeZone(){}};}};
    if(mode==='api-fails')e.ctx.Sheets.Spreadsheets.get=()=>{throw Error('API disabled');};
    if(mode==='ok'){
      assert.equal(e.ctx.crearRecursosDeEnsayoUGI().ok,true);
      const secret=e.props.get('UGI_ID_SECRET');assert.ok(secret);
      assert.equal(e.ctx.crearRecursosDeEnsayoUGI().ok,true);
      assert.equal(views,2);assert.equal(folders,1);assert.equal(e.props.get('UGI_ID_SECRET'),secret);
      e.props.set('UGI_DATA_SHEET_ID','different');assert.throws(()=>e.ctx.crearRecursosDeEnsayoUGI());assert.equal(views,2);
    }else{assert.throws(()=>e.ctx.crearRecursosDeEnsayoUGI());assert.equal(views,0);assert.equal(folders,0);assert.equal(e.props.has('UGI_ID_SECRET'),false);}
  }
});
