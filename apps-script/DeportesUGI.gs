// Muni 360 v3 maintenance. No production IDs or secrets in source control.
var TZ_UGI='America/Argentina/Buenos_Aires';
function fechaHoraArgentinaUGI(value){return Utilities.formatDate(new Date(value),TZ_UGI,'dd/MM/yyyy HH:mm:ss');}
function projectionUGI(name,a){
  var s=a.state,p={};
  p.Padron=[['Deporte','Categoría','Equipo','Jugador','DNI (privado)','ID deportista'],...s.padron.map(function(r){return [name,r.categoria,r.equipo,r.jugador,'',r.id];})];
  p.Asistencia=[['Fecha','Deporte','Categoría','Equipo','Jugador','Estado','Clima','Puntos Ciudad'],...s.asistencia.map(function(r){return [r.fecha,name,r.categoria,r.equipo,r.jugador,r.estado,r.clima||'',r.puntosCiudad||''];})];
  p.Evaluaciones=[['Fecha','Deporte','Categoría','Equipo','Jugador','Notas'],...s.evaluaciones.map(function(r){return [r.fecha,name,r.categoria,r.equipo,r.jugador,Object.entries(r.notas).map(function(x){return x[0]+': '+x[1];}).join(' | ')];})];
  p.Gestos=[['Variable'],...s.gestos.map(function(g){return [g];})];
  p.ApoyosDUA=[['ID','Jugador','Comunicación','Evitar','Apoyos'],...s.padron.filter(function(r){return s.fichas[r.id]?.dua;}).map(function(r){var f=s.fichas[r.id].dua;return [r.id,r.jugador,f.comunicacion,f.desborda,f.regula];})];
  p.Cambios=[['Fecha y hora (Argentina)','Autor','Tipo','Categoría','Equipo','Jugador','ID'],...Object.values(a.audit).filter(function(e){return ['ASISTENCIA','EVALUACION','RECONOCIMIENTO'].includes(e.tipo);}).map(function(e){return [fechaHoraArgentinaUGI(e.fecha),e.autor,e.tipo,e.categoria,e.equipo,e.jugador,e.id];})];
  p.EstadoSync=[['Campo','Valor'],['Actividad',name],['Versión',a.meta.version],['Actualizado (Argentina)',fechaHoraArgentinaUGI(new Date())],['Uso','Vista de consulta. Cargar en la app o preparar nombres en CargaPadron.']];
  var hs=Object.values(a.archives);
  p.HistorialAsistencia=[['Temporada','Fecha','Categoría','Equipo','Jugador','Estado'],...hs.flatMap(function(h){return h.state.asistencia.map(function(r){return [h.id,r.fecha,r.categoria,r.equipo,r.jugador,r.estado];});})];
  p.HistorialEvaluaciones=[['Temporada','Fecha','Categoría','Equipo','Jugador','Notas JSON'],...hs.flatMap(function(h){return h.state.evaluaciones.map(function(r){return [h.id,r.fecha,r.categoria,r.equipo,r.jugador,JSON.stringify(r.notas)];});})];
  p.HistorialPadron=[['Temporada','Categoría','Equipo','Jugador','ID'],...hs.flatMap(function(h){return h.state.padron.map(function(r){return [h.id,r.categoria,r.equipo,r.jugador,r.id];});})];
  return p;
}
function syncActivityUGI(c,name,committedActivity){
  var a=committedActivity||loadActivityUGI(c,name),tables=projectionUGI(name,a),meta=metadataUGI(c.map[name]);
  if(!meta.some(function(s){return s.title==='CargaPadron';}))tables.CargaPadron=[['Categoría','Equipo','Jugador']];
  var previous=readTablesUGI(c.map[name],Object.keys(tables),meta);
  // Views may need several batches. Their version marker is written last;
  // canonical state, receipts and audits NEVER use this non-atomic projection mode.
  var status=tables.EstadoSync;delete tables.EstadoSync;tables.EstadoSync=status;
  writeTablesUGI(c.map[name],tables,meta,null,previous,true);
  // Confirm actual destination values before marking this version as projected.
  var actual=readTablesUGI(c.map[name],Object.keys(tables));
  Object.keys(tables).forEach(function(title){
    var expected=tables[title],cols=Math.max.apply(null,expected.map(function(r){return r.length;}));
    function normalized(rows){return rows.map(function(row){return Array.from({length:cols},function(_,i){return String(row[i]==null?'':row[i]);});});}
    if(JSON.stringify(normalized(expected))!==JSON.stringify(normalized(actual[title]||[])))throw new AccessError('SINCRONIZACION','Sheets no confirmó la tabla '+title+'. El original sigue guardado.');
  });
  a.meta.projectedVersion=a.meta.version;var update={};update[prefixUGI(name)+'Meta']=[['Control JSON'],[JSON.stringify(a.meta)]];writeTablesUGI(c.id,update);
  return {ok:true,verified:true,actividad:name,version:a.meta.version,spreadsheetUrl:'https://docs.google.com/spreadsheets/d/'+c.map[name]+'/edit'};
}
function sincronizarPendientesUGI(){
  var c=configUGI(),props=PropertiesService.getScriptProperties(),areas=Object.keys(c.map),start=Number(props.getProperty('UGI_SYNC_CURSOR')||0)%areas.length,deadline=Date.now()+90000,done=0;
  var errors=[];
  // Scan only the small metadata tables, rather than every activity's history.
  var metas=readTablesUGI(c.id,areas.map(function(name){return prefixUGI(name)+'Meta';}));
  for(var i=0;i<areas.length&&Date.now()<deadline&&done<3;i++){
    var idx=(start+i)%areas.length,name=areas[idx],row=rowsUGI(metas,prefixUGI(name)+'Meta')[0];
    props.setProperty('UGI_SYNC_CURSOR',String((idx+1)%areas.length));
    if(!row)continue;var state=JSON.parse(row[0]);if(state.version===state.projectedVersion)continue;
    var lock=LockService.getScriptLock();if(!lock.tryLock(1000))break;
    try{syncActivityUGI(c,name);done++;}catch(_){errors.push(name);}finally{lock.releaseLock();}
  }
  props.setProperty('UGI_ULTIMO_SYNC',JSON.stringify({fecha:new Date().toISOString(),ok:!errors.length,actividades:done,errores:errors}));
  return {ok:!errors.length,actividades:done,errores:errors};
}
function realizarBackupSemanal(){
  // Canonical spreadsheet contains data, users, receipts, audits and season snapshots.
  var c=configUGI(),p=PropertiesService.getScriptProperties(),folderId=p.getProperty('UGI_BACKUP_FOLDER_ID');
  if(!folderId)throw new AccessError('CONFIGURACION','Falta configurar la carpeta privada de respaldos.');
  var date=Utilities.formatDate(new Date(),TZ_UGI,'yyyy-MM-dd'),lock=LockService.getScriptLock();if(!lock.tryLock(5000))return {ok:false,pendiente:true};
  try{
    var old=JSON.parse(p.getProperty('UGI_ULTIMO_BACKUP')||'null');if(old&&old.ok&&old.dia===date){var previous=DriveApp.getFileById(old.id);if(!previous.isTrashed())return old;}
    var source=DriveApp.getFileById(c.id),folder=DriveApp.getFolderById(folderId);privateResourceUGI(source);privateResourceUGI(folder);
    var file=source.makeCopy('Muni360_BACKUP_'+date,folder);privateResourceUGI(file);
    // Backup folder must be private. Copies inherit folder permissions: verify before enabling.
    var status={fecha:new Date().toISOString(),dia:date,id:file.getId(),ok:true,copias:1,errores:[]};p.setProperty('UGI_ULTIMO_BACKUP',JSON.stringify(status));return status;
  }catch(_){p.setProperty('UGI_ULTIMO_BACKUP',JSON.stringify({fecha:new Date().toISOString(),ok:false,errores:['Respaldo no confirmado']}));throw new Error('Respaldo no confirmado. Revisar permisos y espacio en Drive.');}finally{lock.releaseLock();}
}
function instalarActivadoresUGI(){
  prepararEntornoUGI();var handlers=['sincronizarPendientesUGI','realizarBackupSemanal','verificarAsistenciaSemanal'];
  ScriptApp.getProjectTriggers().forEach(function(t){if(handlers.includes(t.getHandlerFunction()))ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger('sincronizarPendientesUGI').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('realizarBackupSemanal').timeBased().everyDays(1).atHour(2).inTimezone(TZ_UGI).create();
}
function diagnosticoUGI(){
  var c=configUGI(),p=PropertiesService.getScriptProperties(),meta=metadataUGI(c.id),users=loadUsersUGI(c),issues=[];
  if(!users.users.some(function(u){return u.uid===c.owner&&u.status==='activo';}))issues.push('El propietario todavía no ingresó.');
  var dirty=[];Object.keys(c.map).forEach(function(name){var a=loadActivityUGI(c,name);if(a.meta.projectedVersion!==a.meta.version)dirty.push(name);if(a.meta.stateHash&&a.meta.stateHash!==sha(a.state))issues.push('Tablas internas alteradas: '+name);});
  var folder=p.getProperty('UGI_BACKUP_FOLDER_ID');if(!folder)issues.push('Falta carpeta de respaldos.');
  return {ok:!issues.length,backendVersion:MUNI_BACKEND_VERSION,actividades:Object.keys(c.map).length,pestanas:meta.length,pendientes:dirty,problemas:issues,backup:JSON.parse(p.getProperty('UGI_ULTIMO_BACKUP')||'null'),sync:JSON.parse(p.getProperty('UGI_ULTIMO_SYNC')||'null'),activadores:ScriptApp.getProjectTriggers().map(function(t){return t.getHandlerFunction();})};
}
function privateResourceUGI(resource){
  var owner=Session.getEffectiveUser().getEmail();
  if(!owner||resource.getSharingAccess()!==DriveApp.Access.PRIVATE||resource.getViewers().length||resource.getEditors().some(function(u){return u.getEmail()!==owner;}))throw new AccessError('PRIVACIDAD','La planilla original y la carpeta de respaldo deben ser privadas de la cuenta que ejecuta el script.');
}
function prepararEntornoUGI(){
  var p=PropertiesService.getScriptProperties();if(!p.getProperty('UGI_ID_SECRET'))p.setProperty('UGI_ID_SECRET',randomUUID()+randomUUID());
  var c=configUGI(),folder=p.getProperty('UGI_BACKUP_FOLDER_ID');if(!folder)throw new AccessError('CONFIGURACION','Falta UGI_BACKUP_FOLDER_ID.');
  privateResourceUGI(DriveApp.getFileById(c.id));privateResourceUGI(DriveApp.getFolderById(folder));
  var table={IndiceUGI:[['Actividad','Prefijo interno','Planilla de consulta'],...Object.keys(c.map).map(function(name){return [name,prefixUGI(name),c.map[name]];})]};writeTablesUGI(c.id,table);
  return {ok:true,actividades:Object.keys(c.map).length,mensaje:'Entorno verificado. Ingresar con la cuenta propietaria y probar antes de habilitar activadores.'};
}

function sincronizarActividadDesdeEditorUGI(){
  var c=configUGI(),name=PropertiesService.getScriptProperties().getProperty('UGI_ACTIVIDAD_PRUEBA');
  if(!Object.prototype.hasOwnProperty.call(c.map,name))throw new AccessError('CONFIGURACION','Definí UGI_ACTIVIDAD_PRUEBA con el nombre exacto de la actividad.');
  var lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw new AccessError('RED','Hay otra carga en curso.');
  try{syncActivityUGI(c,name);return {ok:true,actividad:name};}finally{lock.releaseLock();}
}

// Run once from the editor of a newly created, privately owned trial spreadsheet.
function crearRecursosDeEnsayoUGI(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss||!/^Muni360 - Ensayo de temporada - /.test(ss.getName()))throw new AccessError('CONFIGURACION','Esta funcion solo se usa en la planilla nueva de ensayo.');
  privateResourceUGI(DriveApp.getFileById(ss.getId()));
  Sheets.Spreadsheets.get(ss.getId(),{fields:'spreadsheetId'});
  var lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw new AccessError('RED','Hay otra preparacion en curso.');
  try{
    var p=PropertiesService.getScriptProperties(),current=p.getProperty('UGI_DATA_SHEET_ID');
    if(current&&current!==ss.getId())throw new AccessError('CONFIGURACION','Ya hay otro original configurado. No se reemplaza.');
    ss.setSpreadsheetTimeZone(TZ_UGI);p.setProperty('UGI_DATA_SHEET_ID',ss.getId());
    if(!p.getProperty('UGI_ID_SECRET'))p.setProperty('UGI_ID_SECRET',randomUUID()+randomUUID());
    var folderId=p.getProperty('UGI_BACKUP_FOLDER_ID');
    if(!folderId){var folder=DriveApp.createFolder('Muni360 - Respaldos - Ensayo');folderId=folder.getId();p.setProperty('UGI_BACKUP_FOLDER_ID',folderId);}
    privateResourceUGI(DriveApp.getFolderById(folderId));
    var map=JSON.parse(p.getProperty('UGI_SHEET_MAP')||'{}');
    ['Hockey sobre Patines Caballeros','Colonia'].forEach(function(name){
      if(!map[name]){var view=SpreadsheetApp.create('Muni360 - Ensayo - '+name);view.setSpreadsheetTimeZone(TZ_UGI);map[name]=view.getId();p.setProperty('UGI_SHEET_MAP',JSON.stringify(map));}
    });
    var result={ok:true,actividades:Object.keys(map).length,siguiente:'Configurar Google Authentication Spark antes de habilitar usuarios.'};
    console.log('RECURSOS_ENSAYO_LISTOS '+JSON.stringify(result));return result;
  }finally{lock.releaseLock();}
}

function activarSincronizacionAutomaticaUGI(){
  var handler='sincronizarPendientesUGI',triggers=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()===handler;});
  if(!triggers.length)ScriptApp.newTrigger(handler).timeBased().everyMinutes(15).create();
  PropertiesService.getScriptProperties().setProperty('UGI_SYNC_ON_SAVE','true');
  return {ok:true,enabled:true,retryMinutes:15};
}
function automaticSyncUGI(c,name,result,committedActivity){
  if(c.deferProjection===true)return result;
  if(PropertiesService.getScriptProperties().getProperty('UGI_SYNC_ON_SAVE')!=='true')return result;
  try{syncActivityUGI(c,name,committedActivity);result.sheetsStatus='synced';}
  catch(_){result.sheetsStatus='pending';}
  return result;
}

function ensayarRespaldoYRecuperacionUGI(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),c=configUGI(),p=PropertiesService.getScriptProperties();
  if(!ss||ss.getId()!==c.id||!/^Muni360 - Ensayo de temporada - /.test(ss.getName()))throw new Error('Ejecutar solo desde la planilla nueva de ensayo.');
  var source=DriveApp.getFileById(c.id),parent=DriveApp.getFolderById(p.getProperty('UGI_BACKUP_FOLDER_ID'));
  privateResourceUGI(source);privateResourceUGI(parent);
  var lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw new Error('Hay otra carga en curso. Reintentar luego.');
  var result,folder;
  try{
    folder=parent.createFolder('Verificacion recuperacion '+new Date().toISOString().replace(/[:.]/g,'-'));privateResourceUGI(folder);
    var checkpoint=source.makeCopy('Checkpoint privado de ensayo',folder);privateResourceUGI(checkpoint);
    var restored=checkpoint.makeCopy('Recuperacion de prueba',folder);privateResourceUGI(restored);
    function fingerprint(id){
      var names=metadataUGI(id).map(function(t){return t.title;}).sort(),tables=readTablesUGI(id,names);
      return {hash:sha(tables),pestanas:names.length,filas:names.reduce(function(n,k){return n+(tables[k]||[]).length;},0)};
    }
    var expected=fingerprint(checkpoint.getId()),first=fingerprint(restored.getId());
    if(first.hash!==expected.hash)throw new Error('La recuperacion no coincide con el checkpoint. No se activa el respaldo diario.');
    // A later change goes only to a disposable restored COPY.
    var marker='Prueba_'+randomUUID().slice(0,8),table={};table[marker]=[['Ensayo'],['Cambio posterior al checkpoint']];
    writeTablesUGI(restored.getId(),table);
    if(fingerprint(restored.getId()).hash===expected.hash)throw new Error('No se detecto el cambio posterior simulado.');
    if(fingerprint(checkpoint.getId()).hash!==expected.hash)throw new Error('El checkpoint fue alterado.');
    var recoveredAgain=checkpoint.makeCopy('Recuperacion al punto del checkpoint',folder);privateResourceUGI(recoveredAgain);
    var finalCheck=fingerprint(recoveredAgain.getId());
    if(finalCheck.hash!==expected.hash)throw new Error('La segunda recuperacion no coincide.');
    result={ok:true,fecha:new Date().toISOString(),pestanas:expected.pestanas,filas:expected.filas,recuperacionExacta:true,cambioPosteriorExcluido:true,carpeta:'https://drive.google.com/drive/folders/'+folder.getId(),checkpoint:checkpoint.getId(),restauracion:recoveredAgain.getId()};
    p.setProperty('UGI_RECUPERACION_VERIFICADA',JSON.stringify(result));
  }finally{lock.releaseLock();}
  // Use the regular backup path too, including its daily duplicate protection.
  var firstBackup=realizarBackupSemanal(),secondBackup=realizarBackupSemanal();
  if(!firstBackup.ok||!secondBackup.ok||firstBackup.id!==secondBackup.id)throw new Error('El respaldo diario no confirmo su proteccion contra duplicados.');
  var handler='realizarBackupSemanal',existing=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()===handler;});
  if(!existing.length)ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(2).inTimezone(TZ_UGI).create();
  result.respaldoDiarioProgramado=true;result.respaldoSinDuplicado=true;
  console.log('RESPALDO_Y_RECUPERACION_VERIFICADOS '+JSON.stringify({ok:result.ok,pestanas:result.pestanas,filas:result.filas,recuperacionExacta:result.recuperacionExacta,cambioPosteriorExcluido:result.cambioPosteriorExcluido,respaldoSinDuplicado:true,respaldoDiarioProgramado:true,carpeta:result.carpeta}));
  return result;
}


// Editor-only drill: all mutations use private copies, never the active data or views.
function ensayarCierreTemporadaUGI(){
  var c=configUGI(),p=PropertiesService.getScriptProperties(),ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss||ss.getId()!==c.id||!/^Muni360 - Ensayo de temporada - /.test(ss.getName()))throw new Error('Ejecutar solo desde la planilla nueva de ensayo.');
  var source=DriveApp.getFileById(c.id),parent=DriveApp.getFolderById(p.getProperty('UGI_BACKUP_FOLDER_ID'));
  privateResourceUGI(source);privateResourceUGI(parent);
  var lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw new Error('Hay otra carga en curso. Reintentar luego.');
  function fingerprint(id){var meta=metadataUGI(id),names=meta.map(function(t){return t.title;}).sort();return sha(readTablesUGI(id,names,meta));}
  function check(condition,message){if(!condition)throw new Error('Cierre no verificado: '+message);}
  var previousReadPolicy=SHEETS_READ_POLICY_UGI;
  SHEETS_READ_POLICY_UGI={retries:6,delayMs:1100};
  try{
    var originalIds=[c.id].concat(Object.values(c.map)),before=originalIds.map(fingerprint);
    var folder=parent.createFolder('Verificacion cierre '+new Date().toISOString().replace(/[:.]/g,'-'));privateResourceUGI(folder);
    var data=source.makeCopy('Copia privada - cierre de temporada',folder);privateResourceUGI(data);
    var trial=Object.assign({},c,{id:data.getId(),map:{},deferProjection:true});
    Object.keys(c.map).forEach(function(name){
      var view=DriveApp.getFileById(c.map[name]);privateResourceUGI(view);
      var copied=view.makeCopy('Copia privada - '+name,folder);privateResourceUGI(copied);
      trial.map[name]=copied.getId();
    });
    check([trial.id].concat(Object.values(trial.map)).every(function(id){return !originalIds.includes(id);}), 'destinos sin aislamiento');
    var name=Object.keys(trial.map)[0],owner=loadUsersUGI(trial).users.find(function(u){return u.uid===trial.owner;});
    var actor=actorFrom(owner,Object.keys(trial.map));
    function payload(tipo,extra){
      var a=loadActivityUGI(trial,name),d=Object.assign({tipo:tipo,deporte:name,requestId:randomUUID(),accessVersion:actor.version,temporada:a.meta.temporada},extra);
      d.revision=a.versions[resource(d)]||0;return d;
    }
    // A marker session proves that the closed cycle preserves pedagogical records too.
    executeUGI(trial,payload('SESION_UGI',{foco:'Verificacion aislada de cierre',nota:'Solo en la copia privada.'}),actor);
    var old=loadActivityUGI(trial,name),expected=sha(old.state),close=payload('RESET_DATOS',{modo:'TEMPORADA'});
    executeUGI(trial,close,actor);
    var first=loadActivityUGI(trial,name),archiveId='temporada_'+close.requestId;
    check(sha(first.archives[archiveId].state)===expected,'historial incompleto');
    check(sha(first.state.padron)===sha(old.state.padron)&&sha(first.state.fichas)===sha(old.state.fichas),'padron o fichas alterados');
    check(!first.state.asistencia.length&&!first.state.evaluaciones.length&&!first.state.sesiones.length,'registros activos no vaciados');
    check(first.meta.temporada===old.meta.temporada+1,'numero de temporada');
    executeUGI(trial,close,actor);
    check(sha(loadActivityUGI(trial,name))===sha(first),'reintento duplicado');
    var stale=Object.assign({},close,{requestId:randomUUID()}),rejected=false;
    try{executeUGI(trial,stale,actor);}catch(e){if(e.code!=='CONFLICTO')throw e;rejected=true;}
    check(rejected&&sha(loadActivityUGI(trial,name))===sha(first),'carga de temporada anterior');
    var historical=executeUGI(trial,{tipo:'LECTURA',deporte:name,temporada:archiveId},actor);
    check(historical.padron.length===old.state.padron.length&&historical.asistencia.length===old.state.asistencia.length&&historical.evaluaciones.length===old.state.evaluaciones.length&&historical.sesiones.length===old.state.sesiones.length,'consulta del historial');
    executeUGI(trial,payload('RESET_DATOS',{modo:'TODO'}),actor);
    var finalState=loadActivityUGI(trial,name);
    check(!finalState.state.padron.length&&sha(finalState.state.fichas)===sha(old.state.fichas),'inicio sin padron o fichas perdidas');
    check(sha(finalState.archives[archiveId].state)===expected,'historial anterior alterado');
    check(syncActivityUGI(trial,name).verified===true,'vistas de la copia');
    check(originalIds.every(function(id,i){return fingerprint(id)===before[i];}),'originales modificados');
    var result={ok:true,fecha:new Date().toISOString(),padronConservado:true,fichasConservadas:true,historialConsultable:true,reintentoSinDuplicado:true,temporadaAnteriorRechazada:true,inicioSinPadron:true,sheetsVerificado:true,originalesIntactos:true,registrosPrevios:{padron:old.state.padron.length,asistencia:old.state.asistencia.length,evaluaciones:old.state.evaluaciones.length,sesiones:old.state.sesiones.length},carpeta:'https://drive.google.com/drive/folders/'+folder.getId()};
    p.setProperty('UGI_CIERRE_VERIFICADO',JSON.stringify(result));
    console.log('CIERRE_TEMPORADA_VERIFICADO '+JSON.stringify(result));return result;
  }finally{SHEETS_READ_POLICY_UGI=previousReadPolicy;lock.releaseLock();}
}
