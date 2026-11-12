// Runs under the already authorized ORIGINAL institutional maintenance project.
// Credentials live only in Script Properties; no public endpoint is added.
function tareasSupabaseUGI(){
 var maintenanceLock=LockService.getUserLock();if(!maintenanceLock.tryLock(1000))return;
 try{
 var p=PropertiesService.getScriptProperties(),key=p.getProperty('UGI_SUPABASE_MAINTENANCE_KEY')||p.getProperty('UGI_SUPABASE_IMPORT_KEY');if(!key)return;
 function rpc(name,args){var r=UrlFetchApp.fetch('https://kaalffshnrkxviqaymhv.supabase.co/rest/v1/rpc/'+name,{method:'post',contentType:'application/json',headers:{apikey:'sb_publishable_TbXCJ2YSkmPcNDjio7kgAg_Kzzz1lSs'},payload:JSON.stringify(Object.assign({},args,{p_secret:key})),muteHttpExceptions:true});if(r.getResponseCode()!==200)throw Error('Mantenimiento Supabase no confirmado.');return JSON.parse(r.getContentText());}
 var tasks=rpc('mc_source_tasks',{}),result={};
 if(tasks.freeze)p.setProperty('UGI_SUPABASE_READONLY','true');
 if(tasks.exportNonce&&tasks.exportNonce!==tasks.exportAck){
  try{exportarMuni360ASupabase();result.exportNonce=tasks.exportNonce;result.export={ok:true,manifest:JSON.parse(p.getProperty('UGI_SUPABASE_EXPORT_MANIFEST'))};}
  catch(e){result.exportNonce=tasks.exportNonce;result.export={ok:false,error:'No se confirmó la copia del origen. El origen conserva sus datos.'};}
  rpc('mc_source_tasks',{p_result:result});
 }
 if(!tasks.freeze)return;
 var today=Utilities.formatDate(new Date(),'America/Argentina/Buenos_Aires','yyyy-MM-dd');
 if(tasks.backupRequested||p.getProperty('UGI_SUPABASE_BACKUP_DAY')!==today){
  var snapshot=rpc('mc_backup',{});if(snapshot.format!=='MUNI360_SUPABASE_BACKUP_V1'||!Array.isArray(snapshot.units)||snapshot.units.length<2)throw Error('Respaldo incompleto.');
  var folderId=p.getProperty('UGI_SUPABASE_BACKUP_FOLDER'),folder=folderId?DriveApp.getFolderById(folderId):DriveApp.createFolder('Muni360 - Respaldos privados Supabase');
  if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE||folder.getOwner().getEmail().toLowerCase()!==Session.getEffectiveUser().getEmail().toLowerCase())throw Error('La carpeta de respaldos debe ser privada y de la cuenta propietaria.');
  if(!folderId)p.setProperty('UGI_SUPABASE_BACKUP_FOLDER',folder.getId());
  var raw=JSON.stringify(snapshot),digest=sha(raw),file=folder.createFile(Utilities.gzip(Utilities.newBlob(raw,'application/json','Muni360-Supabase-'+today+'.json')));
  if(file.getSharingAccess()!==DriveApp.Access.PRIVATE)throw Error('El archivo de respaldo no quedó privado.');
  var recovered=Utilities.ungzip(file.getBlob()).getDataAsString();if(sha(recovered)!==digest)throw Error('No se verificó el respaldo; no se confirmó.');
  var report={ok:true,fecha:new Date().toISOString(),diaArgentina:today,sha256:digest,units:snapshot.units.length,url:file.getUrl()};
  rpc('mc_source_tasks',{p_result:{backup:report}});p.setProperty('UGI_SUPABASE_BACKUP_DAY',today);console.log('RESPALDO_SUPABASE_VERIFICADO '+JSON.stringify(report));
 }
 var sent=[],review=[],eligible=(tasks.notices||[]).slice(0,Math.min(10,MailApp.getRemainingDailyQuota()));
 if(eligible.length){
  if(!tasks.ownerEmail)throw Error('Falta el email del propietario.');
  rpc('mc_source_tasks',{p_result:{claim:eligible.map(function(n){return n.uid;})}});
  eligible.forEach(function(n){try{MailApp.sendEmail({to:tasks.ownerEmail,subject:'Muni360 · Nueva solicitud de acceso',body:'Una persona solicitó acceso a Muni360.\n\nNombre: '+n.nombre+'\nEmail: '+n.email+'\n\nRevisá Usuarios y permisos en https://muni360-ugi-ensayo.web.app/admin/ . El acceso no se habilita automáticamente.'});sent.push(n.uid);}catch(e){review.push(n.uid);}});
  rpc('mc_source_tasks',{p_result:{sent:sent,review:review}});
 }
 // Claims return only the messages reserved by this invocation. No automatic retry
 // after an ambiguous mail result; a later run leaves those for review.
 var approvalQuota=Math.max(0,Math.min(10,MailApp.getRemainingDailyQuota()));
 if(approvalQuota){
  var approvals=rpc('mc_source_tasks',{p_result:{approvalClaim:approvalQuota}}).approvals||[],approvalSent=[],approvalReview=[];
  approvals.forEach(function(n){try{MailApp.sendEmail(mensajeAccesoHabilitadoUGI(n));approvalSent.push(n.id);}catch(e){approvalReview.push(n.id);}});
  if(approvals.length)rpc('mc_source_tasks',{p_result:{approvalSent:approvalSent,approvalReview:approvalReview}});
 }
 p.setProperty('UGI_SUPABASE_MAINTENANCE_KEY',key);
 sincronizarMuni360SupabaseOriginalUGI();
 if(tasks.mode==='ready')p.deleteProperty('UGI_SUPABASE_IMPORT_KEY');
 // The original project is now the long-lived institutional maintenance worker.
 // The import endpoint is closed independently after verification.
 }finally{maintenanceLock.releaseLock();}
}

// Plain text only: recipient comes from the authenticated Google account record.
function mensajeAccesoHabilitadoUGI(n){
 if(!n||typeof n.email!=='string'||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(n.email)||!Array.isArray(n.areas)||!n.areas.length)throw Error('Aviso de acceso inválido.');
 var base='https://muni360-ugi-ensayo.web.app',links=[],baseAreas=['Colonia','COYFD'];
 if(n.areas.some(function(a){return baseAreas.indexOf(a)<0;}))links.push('Deportes: '+base+'/muni360/');
 if(n.areas.some(function(a){return baseAreas.indexOf(a)>=0;}))links.push('Colonia y COYFD: '+base+'/muni360cyc/');
 var body='Hola '+(n.nombre||'')+',\n\nTu acceso a Muni360 fue habilitado.\n\nFunción: '+n.rol+'\nActividades: '+n.areas.join(', ')+'\n\n'+links.join('\n')+'\n\nIngresá con esta misma cuenta Google: '+n.email+'.';
 if(n.expiresAt)body+='\nAutorización vigente hasta: '+Utilities.formatDate(new Date(n.expiresAt),'America/Argentina/Buenos_Aires','dd/MM/yyyy HH:mm')+' (hora argentina).';
 body+='\n\nUGI · Club Ciudad de Buenos Aires';
 return {to:n.email,subject:'Muni360 · Tu acceso fue habilitado',body:body};
}
