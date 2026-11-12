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
function sincronizarMuni360SupabaseOriginalUGI(){
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {busy:true};
 try{
  var props=PropertiesService.getScriptProperties(),key='sb_publishable_TbXCJ2YSkmPcNDjio7kgAg_Kzzz1lSs',secret=props.getProperty('UGI_SUPABASE_MAINTENANCE_KEY')||props.getProperty('UGI_SUPABASE_IMPORT_KEY'),url='https://kaalffshnrkxviqaymhv.supabase.co';
  if(!secret)throw Error('Falta la credencial privada institucional.');
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
   // Read current values once; write only changed rows in bounded batches.
   var baseline=Sheets.Spreadsheets.Values.batchGet(sheet,{ranges:Object.keys(tables).map(function(t){return "'"+t+"'";}),valueRenderOption:'UNFORMATTED_VALUE'}).valueRanges;
   var pieces=[];
   requests.forEach(function(request){
    if(!request.updateCells){pieces.push(request);return;}
    var u=request.updateCells,title=meta.find(function(t){return t.sheetId===u.range.sheetId;}).title,idx=Object.keys(tables).indexOf(title),oldRows=baseline[idx]?.values||[],want=u.rows,cols=u.range.endColumnIndex;
    function plain(row){return Array.from({length:cols},function(_,i){var v=row?.values?.[i]?.userEnteredValue;return String(v?(v.stringValue??v.numberValue??''):'');});}
    function oldPlain(row){return Array.from({length:cols},function(_,i){return String(row?.[i]??'');});}
    function changed(i){return JSON.stringify(plain(want[i]))!==JSON.stringify(oldPlain(oldRows[i]));}
    function piece(start,end,rows){pieces.push({updateCells:{range:{sheetId:u.range.sheetId,startRowIndex:start,endRowIndex:end,startColumnIndex:0,endColumnIndex:cols},rows:rows,fields:'userEnteredValue'}});}
    var length=Math.max(want.length,oldRows.length),i=0;
    while(i<length){if(!changed(i)){i++;continue;}var first=i;while(i<length&&changed(i))i++;var stop=i,at=first;
     while(at<Math.min(stop,want.length)){var chunk=[],size=0,start=at;while(at<Math.min(stop,want.length)){var n=JSON.stringify(want[at]).length+4;if(size+n>140000&&chunk.length)break;if(n>140000)throw Error('Una fila supera el límite de la vista.');chunk.push(want[at++]);size+=n;}piece(start,at,chunk);}
     if(stop>want.length)piece(Math.max(first,want.length),stop,[]);
    }
   });
   var pack=[],size=0;
   function flush(){if(pack.length){Sheets.Spreadsheets.batchUpdate({requests:pack},sheet);pack=[];size=0;}}
   pieces.forEach(function(r){var n=JSON.stringify(r).length;if(size+n>145000)flush();pack.push(r);size+=n;});flush();
   var titles=Object.keys(tables),actual=Sheets.Spreadsheets.Values.batchGet(sheet,{ranges:titles.map(function(t){return "'"+t+"'";}),valueRenderOption:'UNFORMATTED_VALUE'}).valueRanges;
   titles.forEach(function(t,i){var expected=tables[t],cols=Math.max.apply(null,expected.map(function(r){return r.length;}));function canonical(rows){return JSON.stringify(rows.map(function(r){return Array.from({length:cols},function(_,j){return String(r[j]??'');});}));}if(canonical(expected)!==canonical(actual[i].values||[]))throw Error('Sheets no confirmó '+t+'; no se marca como sincronizado.');});
   var staging=(Sheets.Spreadsheets.Values.get(sheet,"'CargaPadron'!A2:C501",{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]).filter(function(r){return r[0]&&r[1]&&r[2];}).map(function(r){return {categoria:String(r[0]),equipo:String(r[1]),jugador:String(r[2])};});
   var ack=rpc('mc_worker_ack',{p_activity:job.activity,p_version:job.version,p_sheet:sheet,p_staging:staging});if(ack.verified!==true||ack.version!==job.version)throw Error('Confirmación incompleta.');verified++;
  });
  // CargaPadron is the only editable tab; refresh even with no new app writes.
  rpc('mc_worker_targets',{}).forEach(function(t){
   var rows=(Sheets.Spreadsheets.Values.get(t.sheet_id,"'CargaPadron'!A2:C502",{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]).filter(function(r){return r[0]&&r[1]&&r[2];}).map(function(r){return {categoria:String(r[0]),equipo:String(r[1]),jugador:String(r[2])};});
   if(rows.length>500)throw Error('CargaPadron admite hasta 500 filas por revisión.');
   var hash=sha(JSON.stringify(rows)),prop='MC_CARGA_HASH_'+Utilities.base64EncodeWebSafe(t.activity);
   if(props.getProperty(prop)!==hash){var stagingAck=rpc('mc_worker_staging',{p_activity:t.activity,p_sheet:t.sheet_id,p_rows:rows});if(stagingAck.ok!==true)throw Error('No se confirmó CargaPadron.');props.setProperty(prop,hash);}
  });
  console.log('MUNI360_SUPABASE_SYNC '+JSON.stringify({verified:verified}));return {verified:verified};
 }finally{lock.releaseLock();}
}