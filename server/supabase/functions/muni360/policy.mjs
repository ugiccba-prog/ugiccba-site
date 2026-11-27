'use strict';
const ROLES = ['Profe', 'Coordinaci\u00f3n', 'Direcci\u00f3n UGI', 'Consulta', 'Reemplazante'];
const CAPS = ['verDni', 'verLegajo', 'administrarPadron', 'editarDua', 'exportar', 'archivar', 'publicarComunidad'];
class AccessError extends Error {
  constructor(code, message, status=403) { super(message); this.code=code; this.status=status; }
}
function defaults(role) {
  const manage=['Coordinaci\u00f3n','Direcci\u00f3n UGI'].includes(role);
  return Object.fromEntries(CAPS.map(k=>[k, manage]));
}
function actorFrom(record, areas, now=Date.now(), owner=null) {
  if (!record || record.status!=='activo' || !ROLES.includes(record.rol)) throw new AccessError('PENDIENTE', 'Tu acceso está pendiente o suspendido.');
  if (record.expiresAt && (!Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt)<=now)) throw new AccessError('VENCIDO', 'Tu autorización venció. Dirección puede renovarla.');
  return {id:record.uid,nombre:record.nombre,rol:record.rol,areas:record.uid===owner?areas:(record.areas||[]).filter(a=>areas.includes(a)),capabilities:{...defaults(record.rol),...record.capabilities,...(record.uid===owner||record.rol==='Dirección UGI'?Object.fromEntries(CAPS.map(k=>[k,true])):{})},version:record.version,teams:record.teams||{},playerLinks:record.playerLinks||{}};
}
const equipoRestringido = (actor, activity) => actor.rol === 'Profe' && !['Colonia','COYFD'].includes(activity);
const equipoAsignado = (actor, activity, row) => (actor.teams?.[activity] || []).some(
  group => group.categoria === row.categoria && group.equipo === row.equipo
);
const evaluacionesHabilitadas = (actor, activity) => Object.hasOwn(actor.playerLinks || {}, activity);
function authorize(actor, d) {
  if (!actor.areas.includes(d.deporte)) throw new AccessError('PERMISOS','No tenés acceso a esa actividad.');
  if (equipoRestringido(actor,d.deporte)) {
    if (['LECTURA','SESION_UGI'].includes(d.tipo)) return;
    if (!['ASISTENCIA','EVALUACION','RECONOCIMIENTO'].includes(d.tipo) || !equipoAsignado(actor,d.deporte,d)) {
      throw new AccessError('PERMISOS','Tu cuenta sólo puede trabajar con sus equipos asignados.');
    }
    if (d.tipo==='EVALUACION' && !evaluacionesHabilitadas(actor,d.deporte)) {
      throw new AccessError('PERMISOS','Dirección UGI debe revisar tu ficha de deportista para habilitar Evaluaciones.');
    }
  }
  if (['LECTURA','AUDITORIA'].includes(d.tipo)) return;
  if (actor.rol==='Consulta') throw new AccessError('PERMISOS','Tu acceso es de consulta.');
  if (['ASISTENCIA','EVALUACION','SESION_UGI','RECONOCIMIENTO'].includes(d.tipo)) return;
  if (d.tipo==='GESTOS' && !['Coordinación','Dirección UGI'].includes(actor.rol)) throw new AccessError('PERMISOS','Solo coordinación o dirección puede administrar gestos.');
  const needed={ALTA_PADRON:'administrarPadron',ALTA_PADRON_LOTE:'administrarPadron',BAJA_PADRON:'administrarPadron',GESTOS:'administrarPadron',CONFIG:'administrarPadron',DUA:'editarDua',LEGAJO:'verLegajo',RESET_DATOS:'archivar',EXPORTAR:'exportar'}[d.tipo];
  if (!needed || !actor.capabilities[needed]) throw new AccessError('PERMISOS','No tenés permiso para esa operación.');
}
function validateAccess(input, areas) {
  if (!input || !ROLES.includes(input.rol) || !['activo','suspendido','pendiente'].includes(input.status)) throw new AccessError('VALIDACION','Rol o estado inválido.',400);
  if (!Array.isArray(input.areas) || input.areas.some(a=>!areas.includes(a))) throw new AccessError('VALIDACION','Actividad inválida.',400);
  if (input.status==='activo' && input.rol!=='Direcci\u00f3n UGI' && !input.areas.length) throw new AccessError('VALIDACION','Elegí al menos una actividad.',400);
  if(input.rol==='Direcci\u00f3n UGI')throw new AccessError('VALIDACION','Dirección UGI está reservada para la cuenta propietaria.',400);
  const expiresAt=input.expiresAt||null;
  if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt)<=Date.now())) throw new AccessError('VALIDACION','El vencimiento debe ser una fecha futura.',400);
  if (input.rol==='Reemplazante' && !expiresAt) throw new AccessError('VALIDACION','Un reemplazo debe tener vencimiento.',400);
  const capabilities=defaults(input.rol);
  for (const [k,v] of Object.entries(input.capabilities||{})) { if(!CAPS.includes(k)||typeof v!=='boolean')throw new AccessError('VALIDACION','Permiso inválido.',400); capabilities[k]=v; }
  if (!Number.isInteger(input.revision)) throw new AccessError('VALIDACION','Falta la versión del usuario.',400);
  return {rol:input.rol,status:input.status,areas:[...new Set(input.areas)],expiresAt,capabilities};
}
export {ROLES,CAPS,AccessError,defaults,actorFrom,authorize,validateAccess,equipoRestringido,equipoAsignado,evaluacionesHabilitadas};
