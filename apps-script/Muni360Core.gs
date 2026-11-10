// Muni 360 Apps Script v3 — install with Store, Domain and DeportesUGI.
var MUNI_BACKEND_VERSION='apps-script-3.0.0';
function responseUGI(value){return ContentService.createTextOutput(JSON.stringify(Object.assign({apiVersion:2,backendVersion:MUNI_BACKEND_VERSION},value))).setMimeType(ContentService.MimeType.JSON);}
function errorUGI(e){return responseUGI({ok:false,codigo:e.code||'SERVIDOR',error:e.code?e.message:'No se confirmó la operación. Reintentá con el mismo identificador.'});}
function doGet(){return responseUGI({ok:true,mensaje:'Muni 360 activo. Los datos requieren POST autenticado.'});}
function identityUGI(c,token){
  if(typeof token!=='string'||token.length<20||token.length>12000)throw new AccessError('SESION','Ingresá con Google.');
  var response;
  try{response=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(c.key),{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:token}),muteHttpExceptions:true});}catch(_){throw new AccessError('RED','No se pudo verificar Google. Reintentá con conexión.');}
  if(response.getResponseCode()===429||response.getResponseCode()>=500)throw new AccessError('RED','Google no pudo verificar la sesión. Reintentá más tarde.');
  if(response.getResponseCode()!==200)throw new AccessError('SESION','Sesión de Google vencida o inválida. Volvé a ingresar.');
  var account,claims;
  try{account=JSON.parse(response.getContentText()).users[0];claims=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1])).getDataAsString());}catch(_){throw new AccessError('SESION','No se pudo verificar la cuenta.');}
  // accounts:lookup performs Google's token validation. Claims below add project,
  // provider, expiry and revocation checks; decoding alone NEVER authenticates a request.
  if(!account||account.disabled||account.emailVerified!==true||typeof account.email!=='string'||!account.localId||claims.sub!==account.localId||claims.aud!==c.project||claims.iss!=='https://securetoken.google.com/'+c.project||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()||!Number.isFinite(claims.auth_time)||claims.auth_time<Number(account.validSince||0)||claims.firebase?.sign_in_provider!=='google.com')throw new AccessError('SESION','Usá una cuenta de Google verificada del proyecto correcto.');
  return {uid:account.localId,email:account.email,nombre:String(account.displayName||account.email).slice(0,160)};
}
function ensureUserUGI(c,identity,data,allowCreate){
  var u=data.users.find(function(x){return x.uid===identity.uid;});
  if(!u){
    if(!allowCreate)throw new AccessError('PENDIENTE','Solicitá primero el acceso desde la pantalla de ingreso.');
    var owner=identity.uid===c.owner;
    u={uid:identity.uid,email:identity.email,nombre:identity.nombre,rol:owner?'Dirección UGI':'Profe',status:owner?'activo':'pendiente',areas:owner?Object.keys(c.map):[],capabilities:defaults(owner?'Dirección UGI':'Profe'),expiresAt:null,version:randomUUID(),revision:0};
    data.users.push(u);var id=randomUUID();data.history[id]={id:id,fecha:new Date().toISOString(),actor:identity.uid,autor:identity.nombre,target:identity.email,antes:null,despues:copy(u),motivo:owner?'Alta del propietario configurado':'Solicitud de acceso sin permisos'};writeTablesUGI(c.id,userTablesUGI(data));
  }
  return u;
}
function meUGI(c,u){var actor=null;try{actor=actorFrom(u,Object.keys(c.map));}catch(_){}return {ok:true,profile:{uid:u.uid,nombre:u.nombre,email:u.email,status:actor?'activo':u.status==='activo'?'vencido':u.status,expiresAt:u.expiresAt,rol:u.rol,areas:actor?actor.areas:[],capabilities:actor?actor.capabilities:{},version:u.version,canManageUsers:u.uid===c.owner},catalog:{areas:Object.keys(c.map),roles:ROLES,capabilities:CAPS}};}
function redactAuditUGI(e,actor){
  if(e.tipo==='LEGAJO'&&!actor.capabilities.verLegajo)throw new AccessError('PERMISOS','No tenés permiso para ver este detalle privado.');
  var result=copy(e);
  function redact(v){if(!v||typeof v!=='object')return;Object.keys(v).forEach(function(k){if(k==='dni'&&!actor.capabilities.verDni)v[k]='';else redact(v[k]);});}redact(result);return result;
}
function activityReadUGI(c,d,actor,a){
  var s=a.state,archives=Object.values(a.archives),archive;
  if(d.temporada){archive=archives.find(function(h){return h.id===d.temporada;});if(!archive)throw new AccessError('VALIDACION','Temporada inexistente.');s=archive.state;}
  var out=visible(s,actor);
  // Portal displays status, points and climate in one legacy-compatible string.
  out.asistencia=out.asistencia.map(function(r){return Object.assign({},r,{estado:r.estado+(r.puntosCiudad?' | Pts:'+r.puntosCiudad:'')+(r.clima&&r.clima!=='N'?' | Clima:'+r.clima:'')});});
  return Object.assign({ok:true,versiones:a.versions,temporada:a.meta.temporada,version:a.meta.version,sheetsStatus:a.meta.projectedVersion===a.meta.version?'synced':'pending',archivos:archives.map(function(h){return {id:h.id,fecha:h.fecha,modo:h.modo};}),backup:actor.id===c.owner?JSON.parse(PropertiesService.getScriptProperties().getProperty('UGI_ULTIMO_BACKUP')||'null'):null},out);
}
function executeUGI(c,d,actor){
  authorize(actor,d.tipo==='RESULTADO'?Object.assign({},d,{tipo:'LECTURA'}):d);var a=loadActivityUGI(c,d.deporte);
  if(d.tipo==='RESULTADO'){var receipt=a.receipts.find(function(r){return r[0]===d.requestId&&r[1]===actor.id;});return {ok:true,committed:!!receipt,result:receipt?JSON.parse(receipt[3]):null};}
  if(d.tipo==='LECTURA')return activityReadUGI(c,d,actor,a);
  if(d.tipo==='AUDITORIA'){
    var events=Object.values(a.audit).filter(function(e){return actor.capabilities.verLegajo||e.uid===actor.id;}).sort(function(x,y){return y.version-x.version;});
    if(d.auditId){var found=events.find(function(e){return e.id===d.auditId;});if(!found)throw new AccessError('PERMISOS','Cambio inexistente o fuera de tu acceso.');return Object.assign({ok:true},redactAuditUGI(found,actor));}
    var offset=d.cursor?Number(d.cursor):0;if(!Number.isInteger(offset)||offset<0)throw new AccessError('VALIDACION','Página inválida.');
    return {ok:true,events:events.slice(offset,offset+50).map(function(e){return {id:e.id,fecha:e.fecha,autor:e.autor,tipo:e.tipo,categoria:e.categoria,equipo:e.equipo,jugador:e.jugador,deporte:e.deporte,estado:'CONFIRMADO'};}),nextCursor:events.length>offset+50?String(offset+50):null};
  }
  if(d.tipo==='EXPORTAR')return {ok:true};
  if(typeof d.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(d.requestId))throw new AccessError('VALIDACION','Identificador de operación inválido.');
  var clean=copy(d);delete clean.accessVersion;var hash=sha(clean),previous=a.receipts.find(function(r){return r[0]===d.requestId;});
  if(previous){if(previous[1]!==actor.id||previous[2]!==hash)throw new AccessError('CONFLICTO','Ese identificador ya se usó para otra carga.');return Object.assign(JSON.parse(previous[3]),{sheetsStatus:a.meta.projectedVersion===a.meta.version?'synced':'pending'});}
  if(d.accessVersion!==actor.version)throw new AccessError('CONFLICTO','Cambió tu autorización. Volvé a ingresar y revisá la carga.');
  if(a.meta.stateHash&&a.meta.stateHash!==sha(a.state))throw new AccessError('DATOS_EDITADOS','Se modificaron tablas internas fuera de la app. Dirección debe revisar y restaurar antes de cargar.');
  var key=resource(d),revision=a.versions[key]||0;
  if(!Number.isInteger(d.revision)||d.revision!==revision||d.temporada!==a.meta.temporada)throw new AccessError('CONFLICTO','Otra persona modificó este registro o cambió la temporada. Actualizá y revisá la carga.');
  var groupKey=resource({tipo:'PADRON',categoria:d.categoria,equipo:d.equipo});
  if(['ALTA_PADRON','BAJA_PADRON','ASISTENCIA','EVALUACION','DUA','LEGAJO','RECONOCIMIENTO'].includes(d.tipo)&&d.rosterRevision!==(a.versions[groupKey]||0))throw new AccessError('CONFLICTO','El padrón del grupo cambió. Actualizá antes de guardar.');
  if(['ASISTENCIA','EVALUACION','BAJA_PADRON','DUA','LEGAJO','RECONOCIMIENTO'].includes(d.tipo)){
    var roster=a.state.padron.filter(function(p){return same(p.categoria,d.categoria)&&same(p.equipo,d.equipo);}).map(function(p){return [p.id,p.jugador];});
    if(JSON.stringify(d.roster)!==JSON.stringify(roster))throw new AccessError('CONFLICTO','El plantel cambió. Actualizá antes de guardar.');
  }
  var before=a.state,after=applyOperation(before,d,actor,{idSecret:c.secret}),now=new Date().toISOString();
  // Stable identities: names never determine the person. Existing DNI links must
  // be reviewed rather than silently merge two different private records.
  if(['ALTA_PADRON','LEGAJO'].includes(d.tipo)){
    a.identities=registerIdentitiesUGI(c,before,after);
    var ids={};after.padron.forEach(function(p){if(p.dni){if(ids[p.dni]&&ids[p.dni]!==p.id)throw new AccessError('CONFLICTO','El DNI ya tiene otra identidad. Dirección debe revisar la vinculación.');ids[p.dni]=p.id;}});
  }
  if(sha(before.padron)!==sha(after.padron))a.versions[groupKey]=(a.versions[groupKey]||0)+1;
  if(d.tipo==='RESET_DATOS'){var aid='temporada_'+d.requestId;a.archives[aid]={id:aid,fecha:now,modo:d.modo,autor:actor.id,state:copy(before),temporada:a.meta.temporada};a.meta.temporada++;a.versions={};}
  a.meta.version++;a.meta.stateHash=sha(after);a.state=after;a.versions[key]=revision+1;
  a.audit[d.requestId]={id:d.requestId,fecha:now,uid:actor.id,autor:actor.nombre,rol:actor.rol,tipo:d.tipo,deporte:d.deporte,categoria:d.categoria||'',equipo:d.equipo||'',jugador:d.jugador||'',version:a.meta.version,antes:auditSlice(before,d),despues:auditSlice(after,d)};
  var result={ok:true,revision:revision+1,requestId:d.requestId,sheetsStatus:'pending',temporada:a.meta.temporada};
  a.receipts.push([d.requestId,actor.id,hash,JSON.stringify(result)]);
  commitOperationUGI(c,d.deporte,a,d);
  // Shared planillas are projections. Their failure never invalidates a committed change.
  return automaticSyncUGI(c,d.deporte,result);
}
function doPost(e){
  var lock=LockService.getScriptLock(),locked=false;
  try{
    var raw=e&&e.postData&&e.postData.contents;if(typeof raw!=='string'||raw.length>140000)throw new AccessError('VALIDACION','Solicitud vacía o demasiado grande.');
    var d;try{d=JSON.parse(raw);}catch(_){throw new AccessError('VALIDACION','JSON inválido.');}
    if(!d||typeof d!=='object'||Array.isArray(d))throw new AccessError('VALIDACION','Solicitud inválida.');
    var c=configUGI(),identity=identityUGI(c,d.idToken),path=d.path;delete d.idToken;delete d.path;
    if(!['/api/me','/api/users/list','/api/users/update','/api/users/history','/api/sheets/staging','/api/sheets/sync','/api/sheets/automation','/api/operations'].includes(path))throw new AccessError('RUTA','Ruta inexistente.');
    if(!lock.tryLock(5000))throw new AccessError('RED','Hay otra carga en curso. Esperá unos segundos y reintentá.');locked=true;
    var users=loadUsersUGI(c),u=ensureUserUGI(c,identity,users,path==='/api/me');
    if(path==='/api/me')return responseUGI(meUGI(c,u));
    var actor=actorFrom(u,Object.keys(c.map));
    if(path.startsWith('/api/users/')){
      if(identity.uid!==c.owner)throw new AccessError('PERMISOS','Sólo el propietario puede administrar accesos.');
      if(path==='/api/users/history')return responseUGI({ok:true,events:Object.values(users.history).sort(function(a,b){return b.fecha.localeCompare(a.fecha);}).slice(0,100)});
      if(path==='/api/users/list'){var offset=d.cursor?Number(d.cursor):0;if(!Number.isInteger(offset)||offset<0)throw new AccessError('VALIDACION','Página inválida.');return responseUGI({ok:true,users:users.users.slice(offset,offset+50),nextCursor:users.users.length>offset+50?String(offset+50):null});}
      if(d.uid===c.owner)throw new AccessError('PERMISOS','El propietario no se modifica desde el panel.');
      var target=users.users.find(function(x){return x.uid===d.uid;});if(!target)throw new AccessError('VALIDACION','Usuario inexistente.');
      var access=validateAccess(d,Object.keys(c.map));if(d.revision!==target.revision)throw new AccessError('CONFLICTO','El acceso cambió. Actualizá el panel.');
      var old=copy(target);Object.assign(target,access,{version:randomUUID(),revision:target.revision+1});
      var id=randomUUID();users.history[id]={id:id,fecha:new Date().toISOString(),actor:actor.id,autor:actor.nombre,target:target.email,antes:old,despues:copy(target)};writeTablesUGI(c.id,userTablesUGI(users));return responseUGI({ok:true,user:target,authorizationUpdated:true});
    }
    if(path==='/api/sheets/automation'){
      if(identity.uid!==c.owner)throw new AccessError('PERMISOS','Sólo la cuenta propietaria activa la sincronización automática.');
      return responseUGI(activarSincronizacionAutomaticaUGI());
    }
    if(path==='/api/sheets/sync'){
      if(identity.uid!==c.owner)throw new AccessError('PERMISOS','Sólo Dirección propietaria actualiza las vistas manualmente.');
      authorize(actor,{tipo:'LECTURA',deporte:d.deporte});return responseUGI(syncActivityUGI(c,d.deporte));
    }
    if(path==='/api/sheets/staging'){
      authorize(actor,{tipo:'ALTA_PADRON',deporte:d.deporte});var t=readTablesUGI(c.map[d.deporte],['CargaPadron']);var rows=rowsUGI(t,'CargaPadron');if(rows.length>500)throw new AccessError('VALIDACION','Revisá la carga en grupos de hasta 500 filas.');return responseUGI({ok:true,rows:rows.filter(function(r){return r[0]&&r[1]&&r[2];}).map(function(r){return {categoria:String(r[0]),equipo:String(r[1]),jugador:String(r[2])};})});
    }
    for(var k of ['uid','rol','actor','areas','capabilities','token','signature','timestamp','nonce'])delete d[k];
    return responseUGI(executeUGI(c,d,actor));
  }catch(err){console.error(JSON.stringify({evento:'MUNI_REQUEST_FAILED',codigo:err.code||'SERVIDOR',requestId:typeof d==='object'&&d?String(d.requestId||'').slice(0,100):'',backendVersion:MUNI_BACKEND_VERSION}));return errorUGI(err);}finally{if(locked)lock.releaseLock();}
}
