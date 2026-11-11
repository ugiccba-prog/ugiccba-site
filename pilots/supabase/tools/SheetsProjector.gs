// OPTIONAL bridge, in a NEW Apps Script project. Never copy into active trial.
// Advanced Sheets v4 service required. Only NEW fictitious-pilot spreadsheet.
function crearPlanillaSupabasePiloto(){
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('PILOT_SHEET_ID'))throw Error('Ya existe un destino. No se reemplaza automáticamente.');
  var book=Sheets.Spreadsheets.create({properties:{title:'Muni360 - Piloto Supabase - DATOS FICTICIOS'},sheets:[{properties:{title:'EventosPiloto',gridProperties:{rowCount:1000,columnCount:14}}}]});
  var rows=[['MUNI360_SUPABASE_PILOT_V1'],['Solicitud','ID participante','Fecha','Actividad','Grupo','Participante ficticio','Asistencia','Semáforo','Comida','Autor','Temporada','Revisión','Clima','Puntos Ciudad']];
  Sheets.Spreadsheets.batchUpdate({requests:[{updateCells:{start:{sheetId:book.sheets[0].properties.sheetId,rowIndex:0,columnIndex:0},rows:rows.map(function(row){return {values:row.map(function(v){return {userEnteredValue:{stringValue:v}};})};}),fields:'userEnteredValue'}}]},book.spreadsheetId);
  props.setProperty('PILOT_SHEET_ID',book.spreadsheetId);console.log('Planilla ficticia del piloto creada.');return book.spreadsheetId;
}
function proyectarSupabasePiloto(){
  var expiry=PropertiesService.getScriptProperties().getProperty('PILOT_WORKER_EXPIRES');
  if(expiry&&Date.now()>=Date.parse(expiry)){
    ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='proyectarSupabasePiloto';}).forEach(function(t){ScriptApp.deleteTrigger(t);});
    return {expired:true,verified:0};
  }
  var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {busy:true};
  try{
    var p=PropertiesService.getScriptProperties(),url=p.getProperty('SUPABASE_PILOT_URL'),key=p.getProperty('SUPABASE_PILOT_PUBLISHABLE_KEY'),worker=p.getProperty('SUPABASE_PILOT_WORKER_KEY'),sheet=p.getProperty('PILOT_SHEET_ID');
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||'')||!key||!worker||!sheet)throw Error('Falta configurar el puente aislado del piloto.');
    function rpc(name,args){var response=UrlFetchApp.fetch(url+'/rest/v1/rpc/'+name,{method:'post',contentType:'application/json',headers:{apikey:key},payload:JSON.stringify(Object.assign({},args,{p_secret:worker})),muteHttpExceptions:true});if(response.getResponseCode()!==200)throw Error('No se confirmó la operación del puente.');return JSON.parse(response.getContentText());}
    function rows(){return Sheets.Spreadsheets.Values.get(sheet,"'EventosPiloto'!A:N",{valueRenderOption:'UNFORMATTED_VALUE'}).values||[];}
    var jobs=rpc('mp_worker_jobs',{p_limit:10});if(!jobs.length)return {verified:0};
    var before=rows();if(before[0]?.[0]!=='MUNI360_SUPABASE_PILOT_V1')throw Error('Destino rechazado: no es la planilla ficticia del piloto.');
    function expected(job){return job.rows.map(function(r){return [job.request_id,r.id,job.day,job.activity,job.group,r.name,r.state,r.semaphore,r.food?'Sí':'No',job.author,String(job.season),String(job.revision),job.climate,job.points==null?'':String(job.points)];});}
    function canonical(row){return JSON.stringify(Array.from({length:14},function(_,i){return String(row[i]??'');}));}
    function matching(all,job){var found=all.slice(2).filter(function(r){return r[0]===job.request_id;}),want=expected(job);return found.length===want.length&&found.map(canonical).sort().join('\n')===want.map(canonical).sort().join('\n');}
    var append=[];
    jobs.forEach(function(job){var existing=before.slice(2).filter(function(r){return r[0]===job.request_id;});if(existing.length){if(!matching(before,job))throw Error('Copia parcial o modificada: revisar antes de reenviar.');}else append=append.concat(expected(job));});
    if(append.length){
      var meta=Sheets.Spreadsheets.get(sheet,{fields:'sheets.properties'}).sheets.find(function(s){return s.properties.title==='EventosPiloto';}).properties;
      var requests=[],end=before.length+append.length;if(end>meta.gridProperties.rowCount)requests.push({appendDimension:{sheetId:meta.sheetId,dimension:'ROWS',length:end-meta.gridProperties.rowCount}});
      requests.push({updateCells:{start:{sheetId:meta.sheetId,rowIndex:before.length,columnIndex:0},rows:append.map(function(row){return {values:row.map(function(v){return {userEnteredValue:{stringValue:String(v)}};})};}),fields:'userEnteredValue'}});
      Sheets.Spreadsheets.batchUpdate({requests:requests},sheet);
    }
    var after=rows();if(!jobs.every(function(job){return matching(after,job);}))throw Error('Sheets no confirmó todos los datos; no se marcó como sincronizado.');
    var n=rpc('mp_worker_ack',{p_requests:jobs.map(function(j){return j.request_id;})});return {verified:n};
  }finally{lock.releaseLock();}
}

// Run ONCE in the NEW project after configuring Script Properties.
// Credentials belong ONLY in Script Properties, never source code.
function activarPuenteSupabasePiloto(){
  var p=PropertiesService.getScriptProperties();
  if(!p.getProperty('SUPABASE_PILOT_WORKER_KEY'))throw Error('Configurar la credencial limitada en Propiedades del script.');
  if(typeof configuracionPublicaPiloto==='function')p.setProperties(configuracionPublicaPiloto(),false);
  if(!p.getProperty('PILOT_SHEET_ID'))crearPlanillaSupabasePiloto();
  var results=[];for(var i=0;i<3;i++){var result=proyectarSupabasePiloto();results.push(result);if(result.expired)throw Error('La credencial del piloto venció.');if(!result.verified)break;}
  var triggers=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='proyectarSupabasePiloto';});
  if(!triggers.length)ScriptApp.newTrigger('proyectarSupabasePiloto').timeBased().everyMinutes(5).create();
  console.log('PUENTE_PILOTO_ACTIVADO '+JSON.stringify({resultados:results,planilla:'https://docs.google.com/spreadsheets/d/'+p.getProperty('PILOT_SHEET_ID')+'/edit',automatico:true,intervaloMinutos:5}));
}
