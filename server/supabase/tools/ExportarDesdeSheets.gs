// Add to the ORIGINAL private Apps Script project; does not change deployment.
// Requires UGI_SUPABASE_IMPORT_KEY in Script Properties, never in source.
// Sends data only to the explicitly pinned Supabase migration project.
function exportarMuni360ASupabase(){
  var p=PropertiesService.getScriptProperties(),key=p.getProperty('UGI_SUPABASE_IMPORT_KEY');
  if(!/^mci_[0-9a-f]{64}$/.test(key||''))throw Error('Falta UGI_SUPABASE_IMPORT_KEY en Propiedades del script.');
  var c=configUGI();if(c.project!=='muni360-ugi-ensayo')throw Error('El origen no coincide con el ensayo autorizado.');
  var lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('Otra carga está en curso. No comenzó la exportación.');
  var cache=SHEETS_METADATA_CACHE_UGI;SHEETS_METADATA_CACHE_UGI={};
  try{
    var manifest={origen:'Muni360 Sheets',fecha:new Date().toISOString(),units:[]};
    function send(unit,value){
      var raw=JSON.stringify(value),checksum=sha(raw),chunks=[];
      for(var i=0;i<raw.length;){var end=Math.min(i+50000,raw.length);if(end<raw.length&&raw.charCodeAt(end-1)>=0xD800&&raw.charCodeAt(end-1)<=0xDBFF)end--;chunks.push(raw.slice(i,end));i=end;}
      chunks.forEach(function(body,n){
        var response=UrlFetchApp.fetch('https://kaalffshnrkxviqaymhv.supabase.co/rest/v1/rpc/mc_import_part',{method:'post',contentType:'application/json',headers:{apikey:'sb_publishable_TbXCJ2YSkmPcNDjio7kgAg_Kzzz1lSs'},payload:JSON.stringify({p_secret:key,p_unit:unit,p_part:n,p_total:chunks.length,p_checksum:checksum,p_body:body}),muteHttpExceptions:true});
        if(response.getResponseCode()!==200)throw Error('No se confirmó la parte '+(n+1)+' de '+unit+'. El sistema original conserva sus datos.');
        var ack=JSON.parse(response.getContentText());if(ack.ok!==true)throw Error('Respuesta de importación inválida.');
      });
      manifest.units.push({unit:unit,checksum:checksum,parts:chunks.length});
    }
    var users=loadUsersUGI(c),identities=rowsUGI(readTablesUGI(c.id,['IdentidadesUGI']),'IdentidadesUGI');
    send('global',{config:{owner:c.owner,project:c.project,idSecret:c.secret,areas:Object.keys(c.map)},users:users,identities:identities});
    Object.keys(c.map).forEach(function(name){var a=loadActivityUGI(c,name);if(a.meta.stateHash&&a.meta.stateHash!==sha(a.state))throw Error('El origen requiere revisión antes de migrar: '+name);send(name,{name:name,state:a.state,meta:a.meta,versions:a.versions,receipts:a.receipts,audit:a.audit,archives:a.archives});});
    p.setProperty('UGI_SUPABASE_EXPORT_MANIFEST',JSON.stringify(manifest));
    console.log('EXPORTACION_SUPABASE_COMPLETA '+JSON.stringify(manifest));return {ok:true,unidades:manifest.units.length};
  }finally{SHEETS_METADATA_CACHE_UGI=cache;lock.releaseLock();}
}
