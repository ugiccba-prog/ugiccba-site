import {handleCompetencia} from './competencia.mjs';
import {dashboard} from './dashboard.mjs';
import {handleInteligencia} from './inteligencia.mjs';
import {handlePublicSurveys,handleSurveys} from './surveys.mjs';
import {handleComunidad} from './comunidad.mjs';
import {AccessError,actorFrom,authorize,validateAccess,ROLES,CAPS,equipoRestringido,evaluacionesHabilitadas} from './policy.mjs';
import {sha,copy,resource,empty,applyOperation,visible,auditSlice,puedeVerObservacion} from './domain.mjs';
const groupTypes=['ALTA_PADRON','BAJA_PADRON','ASISTENCIA','EVALUACION','DUA','LEGAJO','RECONOCIMIENTO'];
const norm=x=>String(x||'').trim().toLowerCase();
const equal=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
export function documents(state){
 const map=new Map();
 const add=(kind,rows,keys)=>{for(const row of rows){const key=keys.map(k=>row[k]||''),id=JSON.stringify([kind,key]);if(!map.has(id))map.set(id,{kind,key,data:{kind,rows:[]}});map.get(id).data.rows.push(row);}};
 add('padron',state.padron,['categoria','equipo']);add('asistencia',state.asistencia,['fecha','categoria','equipo']);add('evaluaciones',state.evaluaciones,['fecha','categoria','equipo','jugador']);add('sesiones',state.sesiones,['id']);map.set('config',{kind:'config',key:[],data:{kind:'config',gestos:state.gestos,email:state.email}});return map;
}
function deltas(before,after){const b=documents(before),a=documents(after);return [...new Set([...b.keys(),...a.keys()])].filter(k=>!equal(b.get(k)?.data,a.get(k)?.data)).map(k=>({kind:(a.get(k)||b.get(k)).kind,key:(a.get(k)||b.get(k)).key,before:b.get(k)?.data||null,after:a.get(k)?.data||null}));}
export function prepare(loaded,d,actor,now=()=>new Date().toISOString()){
 const {state:before,meta,versions}=loaded,key=resource(d),groupKey=resource({tipo:'PADRON',categoria:d.categoria,equipo:d.equipo});
 if(!/^[a-zA-Z0-9_-]{16,100}$/.test(d.requestId||''))throw new AccessError('VALIDACION','Identificador de operación inválido.',400);
 if(d.accessVersion!==actor.version)throw new AccessError('CONFLICTO','Cambió tu autorización. Volvé a ingresar y revisá la carga.',409);
 if(!Number.isInteger(d.revision)||d.revision!==(versions[key]||0)||d.temporada!==meta.temporada)throw new AccessError('CONFLICTO','Otra persona modificó este registro o cambió la temporada. Actualizá y revisá la carga.',409);
 if(groupTypes.includes(d.tipo)&&d.rosterRevision!==(versions[groupKey]||0))throw new AccessError('CONFLICTO','El padrón del grupo cambió. Actualizá antes de guardar.',409);
 if(groupTypes.includes(d.tipo)&&d.tipo!=='ALTA_PADRON'){
  const roster=before.padron.filter(p=>norm(p.categoria)===norm(d.categoria)&&norm(p.equipo)===norm(d.equipo)).map(p=>[p.id,p.jugador]);
  if(!equal(roster,d.roster))throw new AccessError('CONFLICTO','El plantel cambió. Actualizá antes de guardar.',409);
 }
 const after=applyOperation(before,d,actor,{idSecret:loaded.idSecret,now});
 if(['ALTA_PADRON','ALTA_PADRON_LOTE','LEGAJO'].includes(d.tipo)){
  for(const p of after.padron){if(!p.dni)continue;const known=(loaded.identities||[]).find(r=>r[0]===sha(loaded.idSecret+':'+p.dni));if(known){const previous=before.padron.find(x=>x.id===p.id&&norm(x.categoria)===norm(p.categoria)&&norm(x.equipo)===norm(p.equipo));if(known[2]==='reservado'&&previous?.dni!==p.dni||previous&&previous.id!==known[1])throw new AccessError('CONFLICTO','El DNI requiere revisión de Dirección.',409);p.id=known[1];}}
  const seen=new Map();for(const p of after.padron){const k=JSON.stringify([norm(p.categoria),norm(p.equipo),p.id]);if(seen.has(k)&&seen.get(k)!==p.jugador)throw new AccessError('CONFLICTO','Hay un DNI repetido con nombres diferentes en el grupo.',409);seen.set(k,p.jugador);}
 }
 const stamp=now(),clean=copy(d);delete clean.accessVersion;
 return {uid:actor.id,actorVersion:actor.version,activity:d.deporte,operation:d,hash:sha(clean),resource:key,rosterKey:groupKey,checkRoster:groupTypes.includes(d.tipo),rosterChanged:!equal(before.padron,after.padron),baseVersion:meta.version,changes:deltas(before,after),fichas:Object.entries(after.fichas).filter(([id,f])=>!equal(f,before.fichas[id])).map(([id,f])=>({id,before:before.fichas[id]||null,after:f})),archive:d.tipo==='RESET_DATOS'?{id:'temporada_'+d.requestId,fecha:stamp,modo:d.modo,autor:actor.id,state:before,temporada:meta.temporada}:null,audit:{id:d.requestId,fecha:stamp,uid:actor.id,autor:actor.nombre,rol:actor.rol,tipo:d.tipo,deporte:d.deporte,categoria:d.categoria||'',equipo:d.equipo||'',jugador:d.jugador||'',antes:auditSlice(before,d),despues:auditSlice(after,d)}};
}
function versionesEquipos(versions,actor,activity,state){
 const eligible=new Set(state.padron.filter(p=>!p.excluirEvaluacion).map(p=>JSON.stringify([norm(p.categoria),norm(p.equipo),norm(p.jugador)])));
 const groups=new Set((actor.teams[activity]||[]).map(p=>JSON.stringify([norm(p.categoria),norm(p.equipo)])));
 return Object.fromEntries(Object.entries(versions).filter(([key])=>{
  try{
   const [type,category,team,,name]=JSON.parse(key);
   if(!['PADRON','ASISTENCIA','EVALUACION'].includes(type)||!groups.has(JSON.stringify([category,team])))return false;
   if(type!=='EVALUACION')return true;
   return evaluacionesHabilitadas(actor,activity)&&eligible.has(JSON.stringify([category,team,name]));
  }catch(_){return false;}
 }));
}
export function createHandler({rpc,verify,now=()=>Date.now(),notify,aiGenerate}){
 const service=(action,p)=>rpc('mc_service',{p_action:action,p});
 return async function handle(input){
  if(typeof input.path==='string'&&input.path.startsWith('/api/comunidad/'))return handleComunidad({rpc,verify,notify},input);
  if(input.path==='/api/surveys/public'||input.path==='/api/surveys/submit')return handlePublicSurveys({path:input.path,body:input.body||{},rpc,now:now()});
  const identity=await verify(input.token),targetUid=input.body.uid,d={...input.body};
  for(const k of ['token','idToken','actor','uid','rol','areas','capabilities','path'])delete d[k];
  const context=await service('touch',{...identity,allowCreate:input.path==='/api/me'}),{user,owner,areas}=context;
  let actor,accessStatus=user?.status;
  try{actor=actorFrom(user,areas,now(),owner);}catch(e){
   if(input.path!=='/api/me'||!(e instanceof AccessError))throw e;
   if(e.code==='VENCIDO')accessStatus='vencido';
   else if(e.code!=='PENDIENTE'||user?.status==='activo')throw e;
  }
  if(input.path==='/api/me')return {ok:true,profile:{uid:identity.uid,nombre:user.nombre,email:user.email,status:actor?'activo':accessStatus,expiresAt:user.expiresAt||null,rol:user.rol,areas:actor?.areas||[],capabilities:actor?.capabilities||{},version:user.version,canManageUsers:identity.uid===owner},catalog:{areas,roles:ROLES,capabilities:CAPS}};
  if(input.path.startsWith('/api/team-access/')){
   const action={'/api/team-access/list':'list','/api/team-access/save':'save','/api/team-access/player':'player'}[input.path];
   if(!action)throw new AccessError('RUTA','Ruta inexistente.',404);
   if(actor.id!==owner && actor.rol!=='Coordinación')throw new AccessError('PERMISOS','Sólo Dirección y Coordinación pueden asignar equipos.');
   if(!actor.areas.includes(d.deporte)||['Colonia','COYFD'].includes(d.deporte))throw new AccessError('PERMISOS','Actividad fuera de tu alcance.');
   if(action==='player'&&actor.id!==owner)throw new AccessError('PERMISOS','Sólo Dirección puede vincular al deportista.');
   const result=await rpc('mc_team_access',{p_action:action,p:{
    actorUid:actor.id,activity:d.deporte,targetUid,revision:d.revision,teams:d.teams,playerId:d.playerId
   }});
   return {ok:true,...result};
  }
  if(input.path.startsWith('/api/users/')){
   if(identity.uid!==owner)throw new AccessError('PERMISOS','Sólo el propietario administra permisos.');
   if(input.path==='/api/users/history')return {ok:true,...await service('permissionHistory',{uid:actor.id})};
   if(input.path==='/api/users/list'){const offset=d.cursor==null?0:Number(d.cursor);if(!Number.isSafeInteger(offset)||offset<0)throw new AccessError('VALIDACION','Página inválida.',400);const r=await service('users',{uid:actor.id,offset,archived:d.archived===true});return {ok:true,users:r.users,nextCursor:r.total>offset+200?String(offset+200):null};}
   if(input.path==='/api/users/add'){
    const email=typeof d.email==='string'?d.email.trim().toLowerCase():'';
    if(email.length>254||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email))throw new AccessError('VALIDACION','Ingresá un correo válido.',400);
    const access=validateAccess({...input.body,revision:0,status:'activo'},areas);
    return {ok:true,...await service('addUser',{uid:actor.id,email,access})};
   }
   if(input.path==='/api/users/archive'){
    if(typeof targetUid!=='string'||!Number.isInteger(d.revision)||typeof d.archived!=='boolean')throw new AccessError('VALIDACION','Acceso inválido.',400);
    return {ok:true,...await service('archiveUser',{uid:actor.id,target:targetUid,revision:d.revision,archived:d.archived})};
   }
   if(input.path==='/api/users/update'){if(typeof targetUid!=='string')throw new AccessError('VALIDACION','Usuario inválido.',400);return {ok:true,...await service('updateUser',{uid:actor.id,target:targetUid,revision:d.revision,access:validateAccess(input.body,areas)})};}
   throw new AccessError('RUTA','Ruta inexistente.',404);
  }
  if(input.path.startsWith('/api/competencia/'))return handleCompetencia({actor,owner,path:input.path,body:d,rpc,service});
  if(input.path==='/api/dashboard')return dashboard(actor,owner,d,service,now());
  if(input.path.startsWith('/api/inteligencia/'))return handleInteligencia({actor,owner,path:input.path,body:d,rpc,now:now(),aiGenerate});
  if(input.path.startsWith('/api/surveys/'))return handleSurveys({actor,owner,path:input.path,body:d,rpc,now:now()});
  if(input.path==='/api/sheets/sync'&&actor.id!==owner)throw new AccessError('PERMISOS','Sólo el propietario administra la sincronización.');
  if(input.path==='/api/sheets/automation'){if(actor.id!==owner)throw new AccessError('PERMISOS','Sólo Dirección configura el puente.');return {ok:true,enabled:true,automatico:true,intervaloMinutos:5,mensaje:'El puente de Sheets se configura desde el proyecto de mantenimiento.'};}
  if(input.path!=='/api/operations'&&!input.path.startsWith('/api/sheets/'))throw new AccessError('RUTA','Ruta inexistente.',404);
  if(d.tipo==='LOGOUT')return {ok:true};
  authorize(actor,d.tipo==='RESULTADO'||input.path==='/api/sheets/sync'?{...d,tipo:'LECTURA'}:input.path==='/api/sheets/staging'?{...d,tipo:'ALTA_PADRON'}:d);
  if(input.path==='/api/sheets/sync'){const l=await service('load',{uid:actor.id,activity:d.deporte});if(l.meta.projectedVersion<l.meta.version)throw new AccessError('SINCRONIZACION','La copia se procesa en segundo plano. Actualizá en unos minutos.',409);return {ok:true,verified:true,actividad:d.deporte,version:l.meta.version};}
  if(input.path==='/api/sheets/staging')return {ok:true,rows:await rpc('mc_staging',{p_uid:actor.id,p_activity:d.deporte})};
  if(d.tipo==='EXPORTAR')return {ok:true};
  if(d.tipo==='RESULTADO'){const r=await service('receipt',{uid:actor.id,activity:d.deporte,request:d.requestId});return {ok:true,committed:!!r&&r.actor===actor.id,result:r?.actor===actor.id?r.result:null};}
  if(d.tipo==='AUDITORIA'){
   const offset=d.cursor==null?0:Number(d.cursor);if(!Number.isSafeInteger(offset)||offset<0)throw new AccessError('VALIDACION','Página inválida.',400);
   const r=await service('audit',{uid:actor.id,activity:d.deporte,offset,...(d.auditId?{auditId:d.auditId}:{})});
   if(d.auditId){if(!r||!actor.capabilities.verLegajo&&r.uid!==actor.id||r.tipo==='LEGAJO'&&!actor.capabilities.verLegajo)throw new AccessError('PERMISOS','Detalle privado.');const out=copy(r);const redact=v=>{if(v&&typeof v==='object')for(const k of Object.keys(v)){if(k==='dni'&&!actor.capabilities.verDni)v[k]='';else if(k==='observacion'&&!puedeVerObservacion(actor))delete v[k];else redact(v[k]);}};redact(out);return {ok:true,...out};}
   return {ok:true,events:r.filter(e=>actor.capabilities.verLegajo||e.uid===actor.id).slice(0,50).map(({antes,despues,...e})=>e),nextCursor:r.length>50?String(offset+50):null};
  }
  const scoped=!['LECTURA','RESET_DATOS','ALTA_PADRON_LOTE'].includes(d.tipo),recordKey=d.tipo==='ASISTENCIA'?[d.fecha,d.categoria,d.equipo]:d.tipo==='EVALUACION'?[d.fecha,d.categoria,d.equipo,d.jugador]:d.tipo==='SESION_UGI'?[d.requestId]:null;
  if(d.tipo!=='LECTURA'){
   const clean=copy(d);delete clean.accessVersion;
   const receipt=await service('receipt',{uid:actor.id,activity:d.deporte,request:d.requestId});
   if(receipt){if(receipt.actor!==actor.id||receipt.hash!==sha(clean))throw new AccessError('CONFLICTO','Ese identificador ya se usó para otra carga.',409);return receipt.result;}
  }
  for(let attempt=0;attempt<4;attempt++){
   const loadArgs={uid:actor.id,activity:d.deporte,...(d.temporada&&d.tipo==='LECTURA'?{archive:d.temporada}:{}),...(scoped?{scope:'operation',category:d.categoria||'',team:d.equipo||'',recordKey}:{}),dnis:[...(d.jugadores||[]).map(j=>j.dni).filter(Boolean),...(d.grupos||[]).flatMap(g=>(g.jugadores||[]).map(j=>j.dni).filter(Boolean)),...(d.ficha?.dni?[d.ficha.dni]:[])]};
   const loaded=await service('load',loadArgs),current=actorFrom(loaded.actor,areas,now(),owner);authorize(current,d);
   if(d.tipo==='LECTURA'){
    const scopedCoach=equipoRestringido(current,d.deporte);
    const out=visible(loaded.state,current,d.deporte);out.asistencia=out.asistencia.map(r=>({...r,estado:r.estado+(r.puntosCiudad?' | Pts:'+r.puntosCiudad:'')+(r.clima&&r.clima!=='N'?' | Clima:'+r.clima:'')}));
    let backup=null;if(current.id===owner){try{backup=await rpc('mc_backup_status',{p_uid:current.id});}catch(_){/* Optional status must not block access to confirmed records. */}}
    return {ok:true,...out,versiones:scopedCoach?versionesEquipos(loaded.versions,current,d.deporte,out):loaded.versions,temporada:loaded.meta.temporada,version:loaded.meta.version,archivos:scopedCoach?[]:loaded.archives,...(scopedCoach?{scopeEquipos:true,evaluacionesHabilitadas:evaluacionesHabilitadas(current,d.deporte),accessVersion:current.version}:{}),sheetsStatus:loaded.meta.projectedVersion>=loaded.meta.version?'synced':'pending',backup};
   }
   const payload=prepare(loaded,d,current),result=await rpc('mc_commit',{p:payload});if(!result.retry)return result;
  }
  throw new AccessError('RED','Hay otra carga en curso. Se reintentará con el mismo identificador.',503);
 };
}
