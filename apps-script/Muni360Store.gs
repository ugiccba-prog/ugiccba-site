// Atomic storage in ONE private Google spreadsheet. Sheets advanced service v4 is required.
// Only this adapter accesses the Google Sheets API; no Firestore or paid server.
function configUGI(){
  var p=PropertiesService.getScriptProperties(),map;
  try{map=JSON.parse(p.getProperty('UGI_SHEET_MAP')||'{}');}catch(_){throw new AccessError('CONFIGURACION','Mapa de actividades inválido.');}
  var c={id:p.getProperty('UGI_DATA_SHEET_ID'),owner:p.getProperty('UGI_OWNER_UID'),key:p.getProperty('UGI_FIREBASE_API_KEY'),project:p.getProperty('UGI_FIREBASE_PROJECT_ID'),secret:p.getProperty('UGI_ID_SECRET'),map:map};
  if(!c.id||!c.owner||!c.key||!c.project||!c.secret||!Object.keys(map).length)throw new AccessError('CONFIGURACION','Falta completar la configuración de Dirección.');
  if(Object.keys(map).some(function(a){return typeof map[a]!=='string'||!map[a]||map[a]===c.id;})||new Set(Object.values(map)).size!==Object.keys(map).length)throw new AccessError('CONFIGURACION','Cada actividad necesita una planilla diferente de la privada.');
  return c;
}
function prefixUGI(name){return 'A_'+sha(name).slice(0,10)+'_';}
function quoteUGI(name){return "'"+name.replace(/'/g,"''")+"'";}
// Policy is local to each Apps Script execution, never stored in shared properties.
var SHEETS_READ_POLICY_UGI={retries:2,delayMs:0};
function sheetsReadUGI(read){
  for(var attempt=0;;attempt++){
    if(SHEETS_READ_POLICY_UGI.delayMs)Utilities.sleep(SHEETS_READ_POLICY_UGI.delayMs);
    try{return read();}catch(e){
      var quota=Number(e.code||e.details&&e.details.code)===429||/quota exceeded[\s\S]*read requests|429[\s\S]*too many requests/i.test(String(e.message||e));
      if(!quota)throw e;
      if(attempt>=SHEETS_READ_POLICY_UGI.retries)throw new AccessError('RED','Sheets alcanzo el limite temporal de lecturas. Espera un minuto y reintenta.');
      Utilities.sleep(Math.min(32000,Math.pow(2,attempt)*1000)+Math.floor(Math.random()*1000));
    }
  }
}
function metadataUGI(id){return (sheetsReadUGI(function(){return Sheets.Spreadsheets.get(id,{fields:'sheets.properties'});}).sheets||[]).map(function(s){return s.properties;});}
function readTablesUGI(id,names,meta){
  meta=meta||metadataUGI(id);var wanted=names.filter(function(n){return meta.some(function(s){return s.title===n;});}),out={};
  if(!wanted.length)return out;
  var result=sheetsReadUGI(function(){return Sheets.Spreadsheets.Values.batchGet(id,{ranges:wanted.map(quoteUGI),valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'FORMATTED_STRING'});});
  wanted.forEach(function(n,i){out[n]=(result.valueRanges[i]||{}).values||[];});return out;
}
function writeTablesUGI(id,tables,meta,appends,baseline,projectionOnly){
  meta=meta||metadataUGI(id);var requests=[],used=meta.map(function(s){return s.sheetId;});
  Object.keys(tables).forEach(function(title){
    var rows=tables[title],cols=Math.max.apply(null,[1].concat(rows.map(function(r){return r.length;}))),nr=Math.max(2,rows.length);
    var tab=meta.find(function(s){return s.title===title;});
    if(!tab){var sid;do{sid=Math.floor(Math.random()*2000000000)+1;}while(used.indexOf(sid)>=0);used.push(sid);tab={sheetId:sid,title:title,gridProperties:{rowCount:nr,columnCount:cols}};requests.push({addSheet:{properties:tab}});}
    else{if(nr>tab.gridProperties.rowCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'ROWS',length:nr-tab.gridProperties.rowCount}});if(cols>tab.gridProperties.columnCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'COLUMNS',length:cols-tab.gridProperties.columnCount}});}
    var old=baseline&&baseline[title];
    if(old){
      var length=Math.max(rows.length,old.length),i=0;
      function comparable(row){return JSON.stringify(Array.from({length:cols},function(_,j){return row&&row[j]!=null?row[j]:'';}));}
      while(i<length){if(comparable(rows[i])===comparable(old[i])){i++;continue;}var first=i;while(i<length&&comparable(rows[i])!==comparable(old[i]))i++;
        requests.push({updateCells:{range:{sheetId:tab.sheetId,startRowIndex:first,endRowIndex:i,startColumnIndex:0,endColumnIndex:cols},rows:Array.from({length:Math.max(0,Math.min(i,rows.length)-first)},function(_,k){return {values:Array.from({length:cols},function(_,j){var v=(rows[first+k]||[])[j];if(typeof v==='string'&&v.length>40000)throw new AccessError('CAPACIDAD','Un dato supera el tamaño permitido.');return {userEnteredValue:typeof v==='number'&&isFinite(v)?{numberValue:v}:{stringValue:String(v==null?'':v)}};})};}),fields:'userEnteredValue'}});
      }
    }else requests.push({updateCells:{range:{sheetId:tab.sheetId,startRowIndex:0,endRowIndex:Math.max(nr,tab.gridProperties.rowCount),startColumnIndex:0,endColumnIndex:Math.max(cols,tab.gridProperties.columnCount)},rows:rows.map(function(row){return {values:row.map(function(v){if(typeof v==='string'&&v.length>40000)throw new AccessError('CAPACIDAD','Un dato supera el tamaño permitido.');return {userEnteredValue:typeof v==='number'&&isFinite(v)?{numberValue:v}:{stringValue:String(v==null?'':v)}};})};}),fields:'userEnteredValue'}});
    requests.push({updateSheetProperties:{properties:{sheetId:tab.sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}});
  });
  Object.keys(appends||{}).forEach(function(title){
    var item=appends[title],tab=meta.find(function(s){return s.title===title;}),cols=Math.max.apply(null,[1].concat(item.rows.map(function(r){return r.length;}))),end=item.start+item.rows.length;
    if(!tab){var sid;do{sid=Math.floor(Math.random()*2000000000)+1;}while(used.indexOf(sid)>=0);used.push(sid);tab={sheetId:sid,title:title,gridProperties:{rowCount:Math.max(end,2),columnCount:cols}};requests.push({addSheet:{properties:tab}});}
    else{if(end>tab.gridProperties.rowCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'ROWS',length:end-tab.gridProperties.rowCount}});if(cols>tab.gridProperties.columnCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'COLUMNS',length:cols-tab.gridProperties.columnCount}});}
    requests.push({updateCells:{range:{sheetId:tab.sheetId,startRowIndex:item.start,endRowIndex:end,startColumnIndex:0,endColumnIndex:cols},rows:item.rows.map(function(row){return {values:row.map(function(v){if(typeof v==='string'&&v.length>40000)throw new AccessError('CAPACIDAD','Un dato supera el tamaño permitido.');return {userEnteredValue:typeof v==='number'&&isFinite(v)?{numberValue:v}:{stringValue:String(v==null?'':v)}};})};}),fields:'userEnteredValue'}});
  });
  // One batch: state + revision + idempotency receipt + audit succeed or fail together.
  var body={requests:requests};
  if(projectionOnly){
    var parts=[];requests.forEach(function(r){if(r.updateCells&&r.updateCells.rows.length>500){var u=r.updateCells;for(var i=0;i<u.rows.length;i+=500){var range=Object.assign({},u.range,{startRowIndex:u.range.startRowIndex+i,endRowIndex:Math.min(u.range.startRowIndex+i+500,u.range.endRowIndex)});parts.push({updateCells:{range:range,rows:u.rows.slice(i,i+500),fields:u.fields}});}}else parts.push(r);});
    var pack=[],size=0;parts.forEach(function(r){var n=JSON.stringify(r).length;if(pack.length&&size+n>600000){Sheets.Spreadsheets.batchUpdate({requests:pack},id);pack=[];size=0;}pack.push(r);size+=n;});if(pack.length)Sheets.Spreadsheets.batchUpdate({requests:pack},id);return;
  }
  if(JSON.stringify(body).length>1800000)throw new AccessError('CAPACIDAD','Esta actividad necesita dividir o archivar su historial antes de continuar. No se guardó el cambio.');
  Sheets.Spreadsheets.batchUpdate(body,id);
}
function rowsUGI(t,name){return (t[name]||[]).slice(1);}
function chunksUGI(id,value){var raw=JSON.stringify(value),out=[];for(var i=0;i<raw.length;i+=30000)out.push([id,i/30000,raw.slice(i,i+30000)]);return out;}
function unchunksUGI(rows){var result={};rows.forEach(function(r){var id=String(r[0]);if(!result[id])result[id]=[];result[id].push(r);});Object.keys(result).forEach(function(id){result[id]=JSON.parse(result[id].sort(function(a,b){return a[1]-b[1];}).map(function(r){return r[2];}).join(''));if(result[id]&&result[id].encoding==='gzip-base64')result[id]=JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(result[id].data),'application/gzip','temporada.json.gz')).getDataAsString());});return result;}
var STATE_TABLES_UGI=['Padron','Asistencia','Evaluaciones','Fichas','Sesiones','Gestos','Config','Meta','Control','Operaciones','Auditoria','Archivos'];
function loadActivityUGI(c,name){
  var pre=prefixUGI(name),names=STATE_TABLES_UGI.map(function(n){return pre+n;}),tables=readTablesUGI(c.id,names),s=empty();
  s.padron=rowsUGI(tables,pre+'Padron').map(function(r){return {categoria:r[0],equipo:r[1],jugador:r[2],dni:String(r[3]||''),id:r[4]};});
  s.asistencia=rowsUGI(tables,pre+'Asistencia').map(function(r){return {fecha:r[0],categoria:r[1],equipo:r[2],jugador:r[3],jugadorId:r[4],estado:r[5],clima:r[6],puntosCiudad:r[7]||''};});
  s.evaluaciones=rowsUGI(tables,pre+'Evaluaciones').map(function(r){return {fecha:r[0],categoria:r[1],equipo:r[2],jugador:r[3],jugadorId:r[4],notas:JSON.parse(r[5])};});
  s.fichas=unchunksUGI(rowsUGI(tables,pre+'Fichas'));
  s.sesiones=rowsUGI(tables,pre+'Sesiones').map(function(r){return {id:r[0],fecha:r[1],uid:r[2],profe:r[3],categoria:name,foco:r[4],checklist:r[5]||'',nota:r[6]||''};});
  s.gestos=rowsUGI(tables,pre+'Gestos').map(function(r){return r[0];});s.email=(rowsUGI(tables,pre+'Config')[0]||[])[0]||'';
  var metaRow=rowsUGI(tables,pre+'Meta')[0],meta=metaRow?JSON.parse(metaRow[0]):{version:0,temporada:1,projectedVersion:0};
  var versions={};rowsUGI(tables,pre+'Control').forEach(function(r){versions[r[0]]=Number(r[1]);});
  var counts={};Object.keys(tables).forEach(function(n){counts[n]=tables[n].length;});
  return {tables:tables,counts:counts,state:s,meta:meta,versions:versions,receipts:rowsUGI(tables,pre+'Operaciones'),audit:unchunksUGI(rowsUGI(tables,pre+'Auditoria')),archives:unchunksUGI(rowsUGI(tables,pre+'Archivos'))};
}
function activityTablesUGI(name,activity){
  var p=prefixUGI(name),s=activity.state,t={};
  t[p+'Padron']=[['Categoría','Equipo','Jugador','DNI privado','ID'],...s.padron.map(function(r){return [r.categoria,r.equipo,r.jugador,r.dni||'',r.id];})];
  t[p+'Asistencia']=[['Fecha','Categoría','Equipo','Jugador','ID','Estado','Clima','Puntos Ciudad'],...s.asistencia.map(function(r){return [r.fecha,r.categoria,r.equipo,r.jugador,r.jugadorId||'',r.estado,r.clima||'',r.puntosCiudad||''];})];
  t[p+'Evaluaciones']=[['Fecha','Categoría','Equipo','Jugador','ID','Notas JSON'],...s.evaluaciones.map(function(r){return [r.fecha,r.categoria,r.equipo,r.jugador,r.jugadorId||'',JSON.stringify(r.notas)];})];
  t[p+'Fichas']=[['ID','Parte','Apoyos y legajo JSON'],...Object.keys(s.fichas).flatMap(function(id){return chunksUGI(id,s.fichas[id]);})];
  t[p+'Sesiones']=[['ID','Fecha UTC','UID','Autor','Foco','Checklist','Nota'],...s.sesiones.map(function(r){return [r.id,r.fecha,r.uid,r.profe,r.foco,r.checklist,r.nota];})];
  t[p+'Gestos']=[['Variable'],...s.gestos.map(function(g){return [g];})];t[p+'Config']=[['Email coordinación'],[s.email]];
  t[p+'Meta']=[['Control JSON'],[JSON.stringify(activity.meta)]];t[p+'Control']=[['Recurso','Revisión'],...Object.entries(activity.versions)];
  t[p+'Operaciones']=[['ID','UID','Huella','Resultado JSON'],...activity.receipts];
  t[p+'Auditoria']=[['ID','Parte','Cambio JSON'],...Object.keys(activity.audit).flatMap(function(id){return chunksUGI(id,activity.audit[id]);})];
  t[p+'Archivos']=[['ID','Parte','Temporada JSON'],...Object.keys(activity.archives).flatMap(function(id){return archiveChunksUGI(id,activity.archives[id]);})];
  return t;
}
function loadUsersUGI(c){var t=readTablesUGI(c.id,['UsuariosUGI','PermisosUGI']);return {users:rowsUGI(t,'UsuariosUGI').map(function(r){return JSON.parse(r[0]);}),history:unchunksUGI(rowsUGI(t,'PermisosUGI'))};}
function userTablesUGI(data){return {UsuariosUGI:[['Usuario JSON (interno)','Nombre','Email','Rol','Estado','Actividades','Vencimiento'],...data.users.map(function(u){return [JSON.stringify(u),u.nombre,u.email,u.rol,u.status,u.areas.join(' · '),u.expiresAt||''];})],PermisosUGI:[['ID cambio','Parte','Antes y después JSON'],...Object.keys(data.history).flatMap(function(id){return chunksUGI(id,data.history[id]);})]};}

// Write only changed state tables. Receipts, audits and season archives append
// within the SAME atomic request, avoiding quadratic rewriting of history.
function commitOperationUGI(c,name,a,d){
  var all=activityTablesUGI(name,a),pre=prefixUGI(name),types={ASISTENCIA:['Asistencia'],EVALUACION:['Evaluaciones'],ALTA_PADRON:['Padron'],BAJA_PADRON:['Padron'],DUA:['Fichas'],LEGAJO:['Fichas','Padron'],RECONOCIMIENTO:['Fichas'],SESION_UGI:['Sesiones'],GESTOS:['Gestos'],CONFIG:['Config'],RESET_DATOS:['Padron','Asistencia','Evaluaciones','Sesiones']},replace={};
  (types[d.tipo]||[]).concat(['Meta','Control']).forEach(function(n){replace[pre+n]=all[pre+n];});
  var append={};
  function add(n,rows){var title=pre+n,start=a.counts[title]||0;append[title]={start:start,rows:start?rows:[all[title][0],...rows]};}
  add('Operaciones',[a.receipts[a.receipts.length-1]]);
  add('Auditoria',chunksUGI(d.requestId,a.audit[d.requestId]));
  if(d.tipo==='RESET_DATOS'){var id='temporada_'+d.requestId;add('Archivos',archiveChunksUGI(id,a.archives[id]));}
  if(a.identities){replace.IdentidadesUGI=a.identities.table;Object.assign(a.tables,a.identities.baseline);}
  writeTablesUGI(c.id,replace,null,append,a.tables);
}
function registerIdentitiesUGI(c,before,after){
  var tables=readTablesUGI(c.id,['IdentidadesUGI']),rows=copy(rowsUGI(tables,'IdentidadesUGI'));
  after.padron.forEach(function(p){
    var previous=before.padron.find(function(x){return same(x.categoria,p.categoria)&&same(x.equipo,p.equipo)&&same(x.jugador,p.jugador);});
    if(previous&&previous.dni&&previous.dni!==p.dni){var old=rows.find(function(r){return r[0]===sha(c.secret+':'+previous.dni);});if(old)old[2]='reservado';}
    if(!p.dni)return;
    var key=sha(c.secret+':'+p.dni),known=rows.find(function(r){return r[0]===key;});
    if(known){
      if(known[2]==='reservado'&&(!previous||previous.dni!==p.dni))throw new AccessError('CONFLICTO','Este DNI tiene una rectificación pendiente de revisión por Dirección.');
      if(previous&&previous.id!==known[1])throw new AccessError('CONFLICTO','El DNI ya corresponde a otra identidad. Dirección debe revisar la vinculación.');
      p.id=known[1];
    }else rows.push([key,p.id,'activo']);
  });
  // No two differently named people may claim the same identity in one group.
  var seen={};after.padron.forEach(function(p){var key=JSON.stringify([p.categoria.toLowerCase(),p.equipo.toLowerCase(),p.id]);if(seen[key]&&seen[key]!==p.jugador)throw new AccessError('CONFLICTO','Hay un DNI repetido con nombres diferentes en el grupo.');seen[key]=p.jugador;});
  return {table:[['Huella privada DNI','ID estable','Estado'],...rows],baseline:tables};
}

function archiveChunksUGI(id,value){var zipped=Utilities.gzip(Utilities.newBlob(JSON.stringify(value),'application/json')).getBytes();return chunksUGI(id,{encoding:'gzip-base64',data:Utilities.base64Encode(zipped)});}
