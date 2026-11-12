// Add to the separate authorized Supabase bridge project. Never embed a key.
function fechaHoraSupabaseUGI(value){return Utilities.formatDate(new Date(value),'America/Argentina/Buenos_Aires','dd/MM/yyyy HH:mm:ss');}
function tablasSupabaseUGI(job){
 var s=job.state,name=job.activity,hs=job.archives||[],p={};
 p.Padron=[['Deporte','Categoría','Equipo','Jugador','DNI (privado)','ID deportista']].concat(s.padron.map(function(r){return [name,r.categoria,r.equipo,r.jugador,'',r.id];}));
 p.Asistencia=[['Fecha','Deporte','Categoría','Equipo','Jugador','Estado','Clima','Puntos Ciudad']].concat(s.asistencia.map(function(r){return [r.fecha,name,r.categoria,r.equipo,r.jugador,r.estado,r.clima||'',r.puntosCiudad??''];}));
 p.Evaluaciones=[['Fecha','Deporte','Categoría','Equipo','Jugador','Notas']].concat(s.evaluaciones.map(function(r){return [r.fecha,name,r.categoria,r.equipo,r.jugador,Object.entries(r.notas).map(function(x){return x[0]+': '+x[1];}).join(' | ')];}));
 p.Gestos=[['Variable']].concat(s.gestos.map(function(g){return [g];}));
 p.ApoyosDUA=[['ID','Jugador','Comunicación','Evitar','Apoyos']].concat(s.padron.filter(function(r){return s.fichas[r.id]?.dua;}).map(function(r){var f=s.fichas[r.id].dua;return [r.id,r.jugador,f.comunicacion,f.desborda,f.regula];}));
 p.Cambios=[['Fecha y hora (Argentina)','Autor','Tipo','Categoría','Equipo','Jugador','ID']].concat(job.audit.map(function(e){return [fechaHoraSupabaseUGI(e.fecha),e.autor,e.tipo,e.categoria,e.equipo,e.jugador,e.id];}));
 p.HistorialAsistencia=[['Temporada','Fecha','Categoría','Equipo','Jugador','Estado']].concat(hs.flatMap(function(h){return h.state.asistencia.map(function(r){return [h.id,r.fecha,r.categoria,r.equipo,r.jugador,r.estado];});}));
 p.HistorialEvaluaciones=[['Temporada','Fecha','Categoría','Equipo','Jugador','Notas JSON']].concat(hs.flatMap(function(h){return h.state.evaluaciones.map(function(r){return [h.id,r.fecha,r.categoria,r.equipo,r.jugador,JSON.stringify(r.notas)];});}));
 p.HistorialPadron=[['Temporada','Categoría','Equipo','Jugador','ID']].concat(hs.flatMap(function(h){return h.state.padron.map(function(r){return [h.id,r.categoria,r.equipo,r.jugador,r.id];});}));
 p.EstadoSync=[['Campo','Valor'],['Actividad',name],['Versión',job.version],['Actualizado (Argentina)',fechaHoraSupabaseUGI(new Date())],['Uso','Vista de consulta. Cargar en la app o preparar nombres en CargaPadron.']];return p;
}
function sincronizarMuni360Supabase(){
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {busy:true};
 try{
  var props=PropertiesService.getScriptProperties(),key=props.getProperty('SUPABASE_PILOT_PUBLISHABLE_KEY'),secret=props.getProperty('SUPABASE_PILOT_WORKER_KEY'),url=props.getProperty('SUPABASE_PILOT_URL'),expiry=props.getProperty('PILOT_WORKER_EXPIRES');
  if(!key||!secret||url!=='https://kaalffshnrkxviqaymhv.supabase.co')throw Error('Falta la configuración privada del puente.');
  if(!expiry||Date.now()>=Date.parse(expiry)){ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='sincronizarMuni360Supabase';}).forEach(function(t){ScriptApp.deleteTrigger(t);});return {expired:true};}
  function rpc(name,args){var r=UrlFetchApp.fetch(url+'/rest/v1/rpc/'+name,{method:'post',contentType:'application/json',headers:{apikey:key},payload:JSON.stringify(Object.assign({},args,{p_secret:secret})),muteHttpExceptions:true});if(r.getResponseCode()!==200)throw Error('El puente no confirmó '+name);return JSON.parse(r.getContentText());}
  var jobs=rpc('mc_worker_jobs',{p_limit:5}),verified=0;
  jobs.forEach(function(job){
   var prop='MC_DESTINO_'+Utilities.base64EncodeWebSafe(job.activity),sheet=job.sheet_id||props.getProperty(prop),tables=tablasSupabaseUGI(job),marker='MUNI360_SUPABASE_MIGRATION_V1';
   if(!sheet){
    var names=['ControlMuni360','CargaPadron'].concat(Object.keys(tables));
    var book=Sheets.Spreadsheets.create({properties:{title:'Muni360 - Supabase - '+job.activity},sheets:names.map(function(title,i){return {properties:{title:title,sheetId:i,gridProperties:{rowCount:1000,columnCount:14}}};})});sheet=book.spreadsheetId;props.setProperty(prop,sheet);
    Sheets.Spreadsheets.Values.update({values:[[marker],[job.activity]]},sheet,"'ControlMuni360'!A1:A2",{valueInputOption:'RAW'});
    Sheets.Spreadsheets.Values.update({values:[['Categoría','Equipo','Jugador']]},sheet,"'CargaPadron'!A1:C1",{valueInputOption:'RAW'});
   }
   var check=Sheets.Spreadsheets.Values.get(sheet,"'ControlMuni360'!A1:A2").values||[];if(check[0]?.[0]!==marker||check[1]?.[0]!==job.activity)throw Error('Destino rechazado: no es una vista nueva de la migración.');
   var meta=Sheets.Spreadsheets.get(sheet,{fields:'sheets.properties'}).sheets.map(function(x){return x.properties;}),requests=[];
   Object.keys(tables).forEach(function(title){var tab=meta.find(function(t){return t.title===title;}),rows=tables[title],cols=Math.max.apply(null,rows.map(function(r){return r.length;}));if(!tab)throw Error('Se modificó la estructura del destino.');
    if(rows.length>tab.gridProperties.rowCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'ROWS',length:rows.length-tab.gridProperties.rowCount}});
    requests.push({updateCells:{range:{sheetId:tab.sheetId,startRowIndex:0,endRowIndex:Math.max(rows.length,tab.gridProperties.rowCount),startColumnIndex:0,endColumnIndex:cols},rows:rows.map(function(row){return {values:row.map(function(v){return {userEnteredValue:typeof v==='number'&&isFinite(v)?{numberValue:v}:{stringValue:String(v??'')}};})};}),fields:'userEnteredValue'}});
    requests.push({updateSheetProperties:{properties:{sheetId:tab.sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}});
   });
   // Bound each payload; large histories need a later incremental view adapter.
   if(JSON.stringify(requests).length>1800000)throw Error('La vista requiere dividir su historial. El original sigue en Supabase.');
   Sheets.Spreadsheets.batchUpdate({requests:requests},sheet);
   var titles=Object.keys(tables),actual=Sheets.Spreadsheets.Values.batchGet(sheet,{ranges:titles.map(function(t){return "'"+t+"'";}),valueRenderOption:'UNFORMATTED_VALUE'}).valueRanges;
   titles.forEach(function(t,i){var expected=tables[t],cols=Math.max.apply(null,expected.map(function(r){return r.length;}));function canonical(rows){return JSON.stringify(rows.map(function(r){return Array.from({length:cols},function(_,j){return String(r[j]??'');});}));}if(canonical(expected)!==canonical(actual[i].values||[]))throw Error('Sheets no confirmó '+t+'; no se marca como sincronizado.');});
   var staging=(Sheets.Spreadsheets.Values.get(sheet,"'CargaPadron'!A2:C501",{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]).filter(function(r){return r[0]&&r[1]&&r[2];}).map(function(r){return {categoria:String(r[0]),equipo:String(r[1]),jugador:String(r[2])};});
   var ack=rpc('mc_worker_ack',{p_activity:job.activity,p_version:job.version,p_sheet:sheet,p_staging:staging});if(ack.verified!==true||ack.version!==job.version)throw Error('Confirmación incompleta.');verified++;
  });
  console.log('MUNI360_SUPABASE_SYNC '+JSON.stringify({verified:verified}));return {verified:verified};
 }finally{lock.releaseLock();}
}
function activarMuni360Supabase(){
 var result=sincronizarMuni360Supabase();if(result.expired)throw Error('La credencial temporal venció.');
 if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='sincronizarMuni360Supabase';}))ScriptApp.newTrigger('sincronizarMuni360Supabase').timeBased().everyMinutes(5).create();
 console.log('MUNI360_SUPABASE_PUENTE_ACTIVO '+JSON.stringify(result));
}
