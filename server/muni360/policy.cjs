'use strict';
const ROLES = ['Profe', 'Coordinación', 'Dirección UGI', 'Consulta', 'Reemplazante'];
const CAPS = ['verDni', 'verLegajo', 'administrarPadron', 'editarDua', 'exportar', 'archivar', 'publicarComunidad'];
class AccessError extends Error {
  constructor(code, message, status=403) { super(message); this.code=code; this.status=status; }
}
function defaults(role) {
  const manage=['Coordinación','Dirección UGI'].includes(role);
  return Object.fromEntries(CAPS.map(k=>[k, manage]));
}
function actorFrom(record, areas, now=Date.now()) {
  if (!record || record.status!=='activo' || !ROLES.includes(record.rol)) throw new AccessError('PENDIENTE', 'Tu acceso está pendiente o suspendido.');
  if (record.expiresAt && (!Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt)<=now)) throw new AccessError('VENCIDO', 'Tu autorización venció. Dirección puede renovarla.');
  return {id:record.uid,nombre:record.nombre,rol:record.rol,areas:record.rol==='Dirección UGI'?areas:record.areas.filter(a=>areas.includes(a)),capabilities:{...defaults(record.rol),...record.capabilities},version:record.version};
}
function authorize(actor, d) {
  if (!actor.areas.includes(d.deporte)) throw new AccessError('PERMISOS','No tenés acceso a esa actividad.');
  if (['LECTURA','AUDITORIA'].includes(d.tipo)) return;
  if (actor.rol==='Consulta') throw new AccessError('PERMISOS','Tu acceso es de consulta.');
  if (['ASISTENCIA','EVALUACION','SESION_UGI','RECONOCIMIENTO'].includes(d.tipo)) return;
  const needed={ALTA_PADRON:'administrarPadron',BAJA_PADRON:'administrarPadron',GESTOS:'administrarPadron',CONFIG:'administrarPadron',DUA:'editarDua',LEGAJO:'verLegajo',RESET_DATOS:'archivar',EXPORTAR:'exportar'}[d.tipo];
  if (!needed || !actor.capabilities[needed]) throw new AccessError('PERMISOS','No tenés permiso para esa operación.');
  // No hay filtro por equipo: profes y reemplazantes cubren TODOS los equipos de cada actividad habilitada.
}
function validateAccess(input, areas) {
  if (!input || !ROLES.includes(input.rol) || !['activo','suspendido','pendiente'].includes(input.status)) throw new AccessError('VALIDACION','Rol o estado inválido.',400);
  if (!Array.isArray(input.areas) || input.areas.some(a=>!areas.includes(a))) throw new AccessError('VALIDACION','Actividad inválida.',400);
  if (input.status==='activo' && input.rol!=='Dirección UGI' && !input.areas.length) throw new AccessError('VALIDACION','Elegí al menos una actividad.',400);
  const expiresAt=input.expiresAt||null;
  if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt)<=Date.now())) throw new AccessError('VALIDACION','El vencimiento debe ser una fecha futura.',400);
  if (input.rol==='Reemplazante' && !expiresAt) throw new AccessError('VALIDACION','Un reemplazo debe tener vencimiento.',400);
  const capabilities=defaults(input.rol);
  for (const [k,v] of Object.entries(input.capabilities||{})) { if(!CAPS.includes(k)||typeof v!=='boolean')throw new AccessError('VALIDACION','Permiso inválido.',400); capabilities[k]=v; }
  if (!Number.isInteger(input.revision)) throw new AccessError('VALIDACION','Falta la versión del usuario.',400);
  return {rol:input.rol,status:input.status,areas:[...new Set(input.areas)],expiresAt,capabilities};
}
module.exports={ROLES,CAPS,AccessError,defaults,actorFrom,authorize,validateAccess};
