// Install in the bound INSTITUTIONAL maintenance project, alongside SheetsInstitucional.
// No credentials are stored in this file. Repeated clicks preserve registered views.
function onOpen(){
  SpreadsheetApp.getUi().createMenu('Muni360')
    .addItem('Crear todas las plantillas','crearTodasLasPlantillasUGI')
    .addItem('Abrir índice de planillas','abrirIndicePlanillasUGI')
    .addItem('Actualizar planillas','actualizarPlanillasUGI')
    .addSeparator()
    .addItem('Limpiar activadores del ensayo anterior','limpiarActivadoresAnterioresUGI')
    .addToUi();
}

function contextoPlantillasUGI(automatico){
  var props=PropertiesService.getScriptProperties(),id=props.getProperty('UGI_DATA_SHEET_ID');
  var ss=automatico&&id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
  if(!ss||ss.getId()!==props.getProperty('UGI_DATA_SHEET_ID'))throw Error('Abrí la planilla de control institucional.');
  var owner=DriveApp.getFileById(ss.getId()).getOwner();
  if(!owner||owner.getEmail().toLowerCase()!==Session.getEffectiveUser().getEmail().toLowerCase())throw Error('Solo la cuenta propietaria administra las plantillas.');
  if(props.getProperty('UGI_SUPABASE_READONLY')!=='true'||!props.getProperty('UGI_SUPABASE_MAINTENANCE_KEY'))throw Error('Este proyecto no es el mantenimiento institucional activo.');
  return {ss:ss,props:props};
}

function rpcPlantillasUGI(name,args,context){
  var response=UrlFetchApp.fetch('https://kaalffshnrkxviqaymhv.supabase.co/rest/v1/rpc/'+name,{
    method:'post',contentType:'application/json',muteHttpExceptions:true,
    headers:{apikey:'sb_publishable_TbXCJ2YSkmPcNDjio7kgAg_Kzzz1lSs'},
    payload:JSON.stringify(Object.assign({},args,{p_secret:context.props.getProperty('UGI_SUPABASE_MAINTENANCE_KEY')}))
  });
  if(response.getResponseCode()!==200)throw Error('No se confirmó la preparación de plantillas. Reintentá desde Muni360.');
  return JSON.parse(response.getContentText());
}

function crearTodasLasPlantillasUGI(){
  var context=contextoPlantillasUGI(),lock=LockService.getUserLock();
  if(!lock.tryLock(1000))throw Error('Hay otra preparación en curso. Volvé a intentarlo en un momento.');
  try{
    var result=rpcPlantillasUGI('mc_prepare_sheet_templates',{},context),deadline=Date.now()+90000;
    // Each sync batch persists and verifies its destinations. A later click resumes.
    while(result.pending&&Date.now()<deadline){
      var sync=sincronizarMuni360SupabaseOriginalUGI({soloPlantillas:true});
      result=rpcPlantillasUGI('mc_prepare_sheet_templates',{},context);
      if(sync.busy||!sync.verified)break;
    }
    var recovered=recuperarPlanillasVigentesUGI(result.targets);
    escribirIndicePlanillasUGI(context,result.targets);
    var mensaje=result.pending?'Quedan '+result.pending+' plantillas. Volvé a pulsar el botón para continuar.':result.targets.length+' plantillas disponibles. Abrilas desde el índice.';
    context.ss.toast(mensaje,'Muni360',10);
    return {ok:result.pending===0,total:result.targets.length,pendientes:result.pending,recuperadas:recovered};
  }finally{lock.releaseLock();}
}

function abrirIndicePlanillasUGI(){
  var context=contextoPlantillasUGI(),targets=rpcPlantillasUGI('mc_worker_targets',{},context);
  escribirIndicePlanillasUGI(context,targets);
  return {ok:true,total:targets.length};
}

// Refresh queued views without sending mail, touching rosters or creating triggers.
function actualizarPlanillasUGI(){
 var context=contextoPlantillasUGI(true),lock=LockService.getUserLock();if(!lock.tryLock(1000))return {busy:true};
 try{
 var deadline=Date.now()+180000,verified=0;
 for(var pass=0;pass<10&&Date.now()<deadline;pass++){
  var result=sincronizarMuni360SupabaseOriginalUGI({soloPlantillas:true});
  verified+=Number(result&&result.verified||0);
  if(!result||result.busy||!result.verified)break;
  // Keep the manual refresh below the shared Sheets read quota.
  Utilities.sleep(20000);
 }
 var targets=rpcPlantillasUGI('mc_worker_targets',{},context);
 escribirIndicePlanillasUGI(context,targets);
 console.log('PLANILLAS_HORIZONTALES_UGI '+JSON.stringify({verificadas:verified,plantillas:targets.length}));
 return {ok:true,verificadas:verified,plantillas:targets.length};
 }finally{lock.releaseLock();}
}

function recuperarPlanillasVigentesUGI(targets){
  var owner=Session.getEffectiveUser().getEmail().toLowerCase(),recovered=0;
  targets.filter(function(t){return !!t.sheet_id;}).forEach(function(t){
    var file=DriveApp.getFileById(t.sheet_id);
    if(file.isTrashed()){
      if(!file.getOwner()||file.getOwner().getEmail().toLowerCase()!==owner)throw Error('La planilla de '+t.activity+' debe recuperarla su propietario.');
      file.setTrashed(false);
      if(file.isTrashed())throw Error('No se confirmó la recuperación de '+t.activity+'.');
      recovered++;
    }
  });
  return recovered;
}

function escribirIndicePlanillasUGI(context,targets){
  var title='PlantillasMuni360',sheet=context.ss.getSheetByName(title),marker='MUNI360_INDICE_PLANTILLAS_V1';
  if(sheet&&sheet.getRange('A1').getValue()!==marker)throw Error('Ya hay una pestaña PlantillasMuni360 con otro contenido. No se reemplazó.');
  if(!sheet)sheet=context.ss.insertSheet(title);
  var rows=targets.map(function(t){return [t.activity,t.sheet_id?'Disponible':'Pendiente',t.sheet_id?'https://docs.google.com/spreadsheets/d/'+t.sheet_id+'/edit':''];});
  var size=Math.max(40,rows.length+10);
  if(sheet.getMaxRows()<size)sheet.insertRowsAfter(sheet.getMaxRows(),size-sheet.getMaxRows());
  sheet.getRange('A1:C1').merge().setValue(marker).setFontSize(8).setFontColor('#64748b');
  sheet.getRange('A2:C2').merge().setValue('Muni360 · Planillas por actividad').setFontSize(20).setFontWeight('bold').setFontColor('#174d40');
  sheet.getRange('A6:C6').merge().setValue('Asistencia: una pestaña por grupo y tira/subgrupo, con las fechas en columnas.').setWrap(true);
  sheet.getRange('A7:C7').merge().setValue('Cargá la asistencia en Muni360. Las planillas se actualizan automáticamente; CargaPadron permite preparar nombres.').setWrap(true);
  sheet.getRange('A9:C'+size).clearContent();
  sheet.getRange('A9:C9').setValues([['Actividad','Estado','Abrir planilla']]).setBackground('#176552').setFontColor('#ffffff').setFontWeight('bold');
  if(rows.length){
    sheet.getRange(10,1,rows.length,3).setValues(rows).setVerticalAlignment('middle');
    sheet.getRange(10,3,rows.length,1).setRichTextValues(targets.map(function(t){
      var text=SpreadsheetApp.newRichTextValue().setText(t.sheet_id?'Abrir planilla':'Pendiente');
      if(t.sheet_id)text.setLinkUrl('https://docs.google.com/spreadsheets/d/'+t.sheet_id+'/edit');
      return [text.build()];
    }));
    sheet.setRowHeights(10,rows.length,28);
  }
  sheet.setColumnWidth(1,310).setColumnWidth(2,130).setColumnWidth(3,170).setFrozenRows(9);
  sheet.setRowHeight(2,38).setRowHeight(3,32).setRowHeight(4,32).setRowHeight(6,32).setRowHeight(7,40);
  sheet.setHiddenGridlines(true);
  if(!sheet.getImages().some(function(image){return image.getAltTextTitle()==='MUNI360_CREAR_PLANTILLAS';})){
    var image=sheet.insertImage(Utilities.newBlob(Utilities.base64Decode(BOTON_PLANTILLAS_PNG_UGI),'image/png','crear-plantillas.png'),1,3);
    image.setAltTextTitle('MUNI360_CREAR_PLANTILLAS').setAltTextDescription('Crear todas las plantillas').assignScript('crearTodasLasPlantillasUGI');
  }
  context.ss.setActiveSheet(sheet);
}

function limpiarActivadoresAnterioresUGI(){
  contextoPlantillasUGI();
  var removed=retirarActivadoresEnsayoMigradoUGI();
  SpreadsheetApp.getActiveSpreadsheet().toast(removed.length+' activadores antiguos retirados. El mantenimiento institucional continúa.','Muni360',10);
  return {ok:true,retirados:removed};
}

function retirarActivadoresEnsayoMigradoUGI(){
  var old=['realizarBackupSemanal','sincronizarPendientesUGI','verificarAsistenciaSemanal','proyectarSupabasePiloto','sincronizarMuni360Supabase'],removed=[];
  ScriptApp.getProjectTriggers().forEach(function(trigger){if(old.indexOf(trigger.getHandlerFunction())>=0){removed.push(trigger.getHandlerFunction());ScriptApp.deleteTrigger(trigger);}});
  return removed;
}

// Called once by the already authorized institutional maintenance trigger.
// No mail is sent, no historical data is cleared, and no new trigger is created.
function instalarControlPlantillasUGI(){
  var context=contextoPlantillasUGI(true);
  if(context.props.getProperty('UGI_PLANTILLAS_UI_V1')==='true')return;
  var result=rpcPlantillasUGI('mc_prepare_sheet_templates',{},context);
  var recovered=recuperarPlanillasVigentesUGI(result.targets);
  escribirIndicePlanillasUGI(context,result.targets);
  var removed=retirarActivadoresEnsayoMigradoUGI();
  context.props.setProperty('UGI_PLANTILLAS_UI_V1','true');
  console.log('CONTROL_PLANTILLAS_INSTALADO '+JSON.stringify({total:result.targets.length,pendientes:result.pending,recuperadas:recovered,activadoresRetirados:removed}));
}

function organizarPlanillasEnCarpetaUGI(){
  if(typeof DriveApp.getFolderById!=='function')return {ok:false};
  var context=contextoPlantillasUGI(true);
  if(context.props.getProperty('UGI_DRIVE_ORDEN_V1')==='true')return {ok:true,yaOrdenado:true};
  var targets=rpcPlantillasUGI('mc_worker_targets',{},context),folder01=DriveApp.getFolderById('1nVmfokmq_DN4T-3o6xLX3r_saGO-W3Ai'),movidas=0;
  targets.filter(function(t){return !!t.sheet_id;}).forEach(function(t){
    try{var file=DriveApp.getFileById(t.sheet_id);if(file.isTrashed())file.setTrashed(false);file.moveTo(folder01);movidas++;}catch(e){console.log('AVISO_MOVER_PLANILLA '+t.activity+' '+String(e.message||e));}
  });
  var folder99=DriveApp.getFolderById('1VSTrDxDsUYsb-EJjFr7gP7past4YTpUI');
  [
    ['1zsqh7INbohd9CxJTGWR71_7ULmUHekcx','[ELIMINAR] _BACKUP_SEMANAL_UGI (59 backups viejos 13-11)'],
    ['1OFydxaZ6H2Me8ccHOEtjng8MFTIRUQQy','[ELIMINAR] Muni360 - Respaldos de Ensayo'],
    ['1FC_b0k0eFIOv0vnpTVfB55pwhkq27hSB','[ELIMINAR] Club 360 (Prototipo viejo 08-11)'],
    ['1-Lpk7x-4tEBdmmzLX3xI2TMjdCI7Rqo6','[ELIMINAR] Planillas Viejas MUNI 360 (06-11 Pre-Supabase)'],
    ['1b0h_AcIn6FesSgM0wvlpmr4QZnQzZz6D','[ELIMINAR] Scrips viejos'],
    ['1PWWOiWpCB4tRXmzNbzWD86RS1cWDV6jk','[ELIMINAR] Contraseñas MUNI 360 (Viejo Pre-Google-Auth)'],
    ['18CwojmM81o1soJdNXvSedaZiBunCJxIQ','[ELIMINAR] Pruebas y Scripts Piloto Retirados']
  ].forEach(function(item){
    try{var f=DriveApp.getFolderById(item[0]);f.setName(item[1]);f.moveTo(folder99);}catch(e){console.log('AVISO_ARCHIVAR_CARPETA '+item[0]+' '+String(e.message||e));}
  });
  try{DriveApp.getFileById('16szj2cvEW2AeTFc72n5Acp_OXZmHeAoDHxCxSBcBi9OjilbgDQb4U30P').setName('[ELIMINAR - RETIRADO] muni360 (Script viejo v1-v2)');}catch(_){}
  try{DriveApp.getFolderById('1t89NTKaN33A-BeHv8rFMeTmv8dpbYpyg').setName('02 · Respaldos Privados Supabase (No borrar)');}catch(_){}
  [
    ['1sssZz9tELeOExf_PXJWJtCdJi3omIKVD','Muni360-Supabase-2026-11-15.json.gz'],
    ['1Rtxzkkksid_FXfJ37K6g9oOGEwzvjCDL','Muni360-Supabase-2026-11-14.json.gz'],
    ['1quZErfYzgKp_G46HNlwm7lwgjF-dFJkt','Muni360-Supabase-2026-11-13.json.gz'],
    ['1gYNY-7Fv1hkevEAHy0_qX1GPqWEFFNec','Muni360-Supabase-2026-11-12.json.gz'],
    ['13aAV0dTqkWXQbKE9ZRpDSiyPHt_3DUAJ','Muni360-Supabase-2026-11-11-corte.json.gz']
  ].forEach(function(b){try{DriveApp.getFileById(b[0]).setName(b[1]);}catch(_){}});
  if(movidas===targets.length)context.props.setProperty('UGI_DRIVE_ORDEN_V1','true');
  console.log('DRIVE_ORDENADO_UGI '+JSON.stringify({movidas:movidas,total:targets.length}));
  return {ok:movidas===targets.length,movidas:movidas,total:targets.length};
}

// A PNG avoids a new external image dependency and needs no additional OAuth scopes.
var BOTON_PLANTILLAS_PNG_UGI='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';
