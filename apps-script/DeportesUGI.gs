// Muni 360 v3 maintenance. No production IDs or secrets in source control.
var TZ_UGI='America/Argentina/Buenos_Aires';
function projectionUGI(name,a){
  var s=a.state,p={};
  p.Padron=[['Deporte','Categoría','Equipo','Jugador','DNI (privado)','ID deportista'],...s.padron.map(function(r){return [name,r.categoria,r.equipo,r.jugador,'',r.id];})];
  p.Asistencia=[['Fecha','Deporte','Categoría','Equipo','Jugador','Estado','Clima','Puntos Ciudad'],...s.asistencia.map(function(r){return [r.fecha,name,r.categoria,r.equipo,r.jugador,r.estado,r.clima||'',r.puntosCiudad||''];})];
  p.Evaluaciones=[['Fecha','Deporte','Categoría','Equipo','Jugador','Notas'],...s.evaluaciones.map(function(r){return [r.fecha,name,r.categoria,r.equipo,r.jugador,Object.entries(r.notas).map(function(x){return x[0]+': '+x[1];}).join(' | ')];})];
  p.Gestos=[['Variable'],...s.gestos.map(function(g){return [g];})];
  p.ApoyosDUA=[['ID','Jugador','Comunicación','Evitar','Apoyos'],...s.padron.filter(function(r){return s.fichas[r.id]?.dua;}).map(function(r){var f=s.fichas[r.id].dua;return [r.id,r.jugador,f.comunicacion,f.desborda,f.regula];})];
  p.Cambios=[['Fecha UTC','Autor','Tipo','Categoría','Equipo','Jugador','ID'],...Object.values(a.audit).filter(function(e){return ['ASISTENCIA','EVALUACION','RECONOCIMIENTO'].includes(e.tipo);}).map(function(e){return [e.fecha,e.autor,e.tipo,e.categoria,e.equipo,e.jugador,e.id];})];
  p.EstadoSync=[['Campo','Valor'],['Actividad',name],['Versión',a.meta.version],['Actualizado UTC',new Date().toISOString()],['Uso','Vista de consulta. Cargar en la app o preparar nombres en CargaPadron.']];
  var hs=Object.values(a.archives);
  p.HistorialAsistencia=[['Temporada','Fecha','Categoría','Equipo','Jugador','Estado'],...hs.flatMap(function(h){return h.state.asistencia.map(function(r){return [h.id,r.fecha,r.categoria,r.equipo,r.jugador,r.estado];});})];
  p.HistorialEvaluaciones=[['Temporada','Fecha','Categoría','Equipo','Jugador','Notas JSON'],...hs.flatMap(function(h){return h.state.evaluaciones.map(function(r){return [h.id,r.fecha,r.categoria,r.equipo,r.jugador,JSON.stringify(r.notas)];});})];
  p.HistorialPadron=[['Temporada','Categoría','Equipo','Jugador','ID'],...hs.flatMap(function(h){return h.state.padron.map(function(r){return [h.id,r.categoria,r.equipo,r.jugador,r.id];});})];
  return p;
}
function syncActivityUGI(c,name){
  var a=loadActivityUGI(c,name),tables=projectionUGI(name,a),meta=metadataUGI(c.map[name]);
  if(!meta.some(function(s){return s.title==='CargaPadron';}))tables.CargaPadron=[['Categoría','Equipo','Jugador']];
  var previous=readTablesUGI(c.map[name],Object.keys(tables),meta);
  // Views may need several batches. Their version marker is written last;
  // canonical state, receipts and audits NEVER use this non-atomic projection mode.
  var status=tables.EstadoSync;delete tables.EstadoSync;tables.EstadoSync=status;
  writeTablesUGI(c.map[name],tables,meta,null,previous,true);
  a.meta.projectedVersion=a.meta.version;var update={};update[prefixUGI(name)+'Meta']=[['Control JSON'],[JSON.stringify(a.meta)]];writeTablesUGI(c.id,update);
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
