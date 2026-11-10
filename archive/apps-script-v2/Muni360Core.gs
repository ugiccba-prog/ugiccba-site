// Muni 360 API v2. Pegar junto a DeportesUGI.gs en el MISMO proyecto de Apps Script.
var MUNI_API_VERSION = 2;
var ROLES_UGI = ['Profe', 'Coordinación', 'Dirección UGI'];

function falloUGI(codigo, mensaje) {
  var e = new Error(mensaje); e.codigo = codigo; throw e;
}
function textoUGI(v, max) {
  if (typeof v !== 'string' || !v.trim() || v.length > (max || 160)) falloUGI('VALIDACION', 'Texto obligatorio o demasiado largo.');
  return v.trim();
}
function hashUGI(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function usuariosUGI() {
  var props = PropertiesService.getScriptProperties();
  return JSON.parse(props.getProperty('UGI_AUTH_USERS') || '{}');
}
// Configurar UGI_AUTH_BOOTSTRAP en Propiedades del script y ejecutar desde el editor.
// Nunca poner claves en este archivo, HTML, logs ni en GitHub. Ver docs/muni360-operacion.md.
function instalarAccesosUGI() {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    var lista = JSON.parse(props.getProperty('UGI_AUTH_BOOTSTRAP') || 'null');
    if (!Array.isArray(lista) || !lista.length) throw new Error('Falta UGI_AUTH_BOOTSTRAP.');
    var users = usuariosUGI();
    lista.forEach(function (u) {
      var id = textoUGI(u.usuario, 80).toLowerCase();
      if (!/^[a-z0-9._@-]+$/.test(id) || ROLES_UGI.indexOf(u.rol) < 0) throw new Error('Usuario o rol inválido.');
      var areas = u.rol === 'Dirección UGI' ? Object.keys(SHEET_IDS) : u.deportes;
      if (!Array.isArray(areas) || !areas.length || areas.some(function (a) { return !SHEET_IDS[a]; })) throw new Error('Deportes inválidos.');
      if (typeof u.clave !== 'string' || u.clave.length < 16 || u.clave.length > 200) throw new Error('Usar una clave individual aleatoria de al menos 16 caracteres.');
      var salt = Utilities.getUuid();
      users[id] = { id: id, nombre: textoUGI(u.nombre), rol: u.rol, areas: areas,
        salt: salt, hash: hashUGI(salt + ':' + u.clave), version: Utilities.getUuid(), activo: u.activo !== false };
    });
    // Una propiedad por cuenta: evita el límite de tamaño por valor de Apps Script.
    Object.keys(users).forEach(function (id) { props.setProperty('UGI_USER_' + id, JSON.stringify(users[id])); });
    props.deleteProperty('UGI_AUTH_USERS');
    props.deleteProperty('UGI_AUTH_BOOTSTRAP');
    if (!props.getProperty('UGI_ID_SECRET')) props.setProperty('UGI_ID_SECRET', Utilities.getUuid() + Utilities.getUuid());
    if (!props.getProperty('UGI_LEGAJOS_SHEET_ID')) {
      var ss = SpreadsheetApp.create('UGI · Legajos y apoyos compartidos');
      props.setProperty('UGI_LEGAJOS_SHEET_ID', ss.getId());
    }
  } finally { lock.releaseLock(); }
}
function usuarioUGI(id) {
  var raw = PropertiesService.getScriptProperties().getProperty('UGI_USER_' + id);
  return raw ? JSON.parse(raw) : null;
}
function emitirToken(usuario) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var expiresAt = Date.now() + 6 * 60 * 60 * 1000;
  CacheService.getScriptCache().put('session:' + token, JSON.stringify({ id: usuario.id, version: usuario.version, expiresAt: expiresAt }), 21600);
  return { token: token, expiresAt: expiresAt };
}
function tokenValido(token) {
  if (typeof token !== 'string' || token.length > 150) return null;
  var raw = CacheService.getScriptCache().get('session:' + token);
  if (!raw) return null;
  var s = JSON.parse(raw), u = usuarioUGI(s.id);
  if (!u || !u.activo || u.version !== s.version || Date.now() >= s.expiresAt) return null;
  return u;
}
function autorizarUGI(u, deporte, tipo) {
  if (!u) falloUGI('SESION', 'Sesión no autorizada o vencida. Volvé a ingresar.');
  if (!SHEET_IDS[deporte] || u.areas.indexOf(deporte) < 0) falloUGI('PERMISOS', 'No tenés acceso a esta actividad.');
  var permitidos = u.rol === 'Profe' ? ['LECTURA', 'ASISTENCIA', 'EVALUACION', 'SESION_UGI', 'RECONOCIMIENTO'] :
    ['LECTURA', 'ASISTENCIA', 'EVALUACION', 'SESION_UGI', 'ALTA_PADRON', 'BAJA_PADRON', 'GESTOS', 'CONFIG', 'DUA', 'LEGAJO', 'RECONOCIMIENTO', 'RESET_DATOS'];
  if (permitidos.indexOf(tipo) < 0) falloUGI('PERMISOS', 'Tu rol no permite esta operación.');
}
function loginUGI(data) {
  var id = String(data.usuario || '').trim().toLowerCase();
  var cache = CacheService.getScriptCache(), rateKey = 'login:' + hashUGI(id), globalKey = 'login:global';
  var fallos = Number(cache.get(rateKey) || 0), total = Number(cache.get(globalKey) || 0);
  if (fallos >= 8 || total >= 120) falloUGI('LIMITE', 'Demasiados intentos. Esperá 15 minutos.');
  var u = usuarioUGI(id);
  var candidato = hashUGI((u ? u.salt : 'sin-cuenta') + ':' + String(data.clave || ''));
  if (!u || !u.activo || u.hash !== candidato) {
    cache.put(rateKey, String(fallos + 1), 900); cache.put(globalKey, String(total + 1), 900);
    falloUGI('LOGIN', 'Usuario o contraseña incorrectos.');
  }
  autorizarUGI(u, data.deporte, 'LECTURA');
  cache.remove(rateKey);
  var s = emitirToken(u);
  return { ok: true, apiVersion: 2, token: s.token, expiresAt: s.expiresAt, usuario: u.id, versionUsuario: u.version,
    nombre: u.nombre, rol: u.rol, areas: u.areas, esAdminTotal: u.rol === 'Dirección UGI' };
}
function tablaUGI(ss, nombre, headers) {
  var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  if (!sh.getLastRow()) sh.appendRow(headers);
  return sh;
}
function filasUGI(sh) {
  return sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
}
function escribirUGI(sh, rows, cols) {
  if (rows.length) sh.getRange(2, 1, rows.length, cols).setValues(rows);
  var extra = sh.getLastRow() - 1 - rows.length;
  if (extra > 0) sh.getRange(rows.length + 2, 1, extra, cols).clearContent();
}
function celdaUGI(s) { return typeof s === 'string' && /^[=+@\-]/.test(s) ? "'" + s : s; }
function guardarFilasUGI(sh, rows, cols) {
  escribirUGI(sh, rows.map(function (r) { return r.map(celdaUGI); }), cols);
}
function centralUGI() {
  var id = PropertiesService.getScriptProperties().getProperty('UGI_LEGAJOS_SHEET_ID');
  if (!id) falloUGI('CONFIGURACION', 'Falta inicializar el almacén de legajos.');
  return SpreadsheetApp.openById(id);
}
function padronUGI(ss) {
  var sh = hoja(ss, 'Padron');
  sh.getRange(1, 6).setValue('ID deportista');
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues() : [];
  // Sólo se llama dentro del bloqueo global. ID persistente, independiente del nombre.
  var changed = false;
  rows.forEach(function (r) {
    if (r[3] && !r[5]) { r[5] = identidadUGI(String(r[4] || '')); changed = true; }
  });
  if (changed) guardarFilasUGI(sh, rows, 6);
  return rows;
}
function identidadUGI(dni, preferred) {
  if (!dni) return Utilities.getUuid();
  var secret = PropertiesService.getScriptProperties().getProperty('UGI_ID_SECRET');
  if (!secret) falloUGI('CONFIGURACION', 'Falta inicializar accesos.');
  var key = hashUGI(secret + ':' + dni);
  var sh = tablaUGI(centralUGI(), 'Identidades', ['Huella DNI', 'ID deportista']);
  var row = filasUGI(sh).filter(function (r) { return r[0] === key; })[0];
  if (row) { if (preferred && preferred !== row[1]) falloUGI('CONFLICTO', 'Este DNI ya corresponde a otra identidad. Dirección debe revisar la vinculación.'); return row[1]; }
  var id = preferred || Utilities.getUuid(); sh.appendRow([key, id]); return id;
}
function sujetoUGI(rows, d) {
  var matches = rows.filter(function (r) { return mismo(r[1], d.categoria) && mismo(r[2] || 'General', d.equipo || 'General') && mismo(r[3], d.jugador); });
  if (matches.length !== 1) falloUGI('VALIDACION', 'Deportista inexistente o duplicado en este grupo. Revisá el padrón.');
  return matches[0];
}
function grupoUGI(d) {
  textoUGI(d.categoria); textoUGI(d.equipo);
  if (d.fecha !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) || isNaN(Date.parse(d.fecha)) || new Date(d.fecha).toISOString().slice(0, 10) !== d.fecha) falloUGI('VALIDACION', 'Fecha inválida.');
  }
}
function claveOperacionUGI(d) {
  if (['DUA','LEGAJO','RECONOCIMIENTO'].indexOf(d.tipo)>=0) return JSON.stringify([d.tipo==='DUA'?'DUA':'LEGAJO',d.subjectId]);
  return JSON.stringify([d.tipo, d.categoria || '', d.equipo || '', d.fecha || '', d.jugador || '']);
}
function controlUGI(ss) { return tablaUGI(ss, '_ControlUGI', ['Recurso', 'Versión', 'Última operación']); }
function versionesUGI(ss) {
  var map = {}; filasUGI(controlUGI(ss)).forEach(function (r) { map[r[0]] = Number(r[1]); }); return map;
}
function validarCargaUGI(d, padron) {
  if (['ASISTENCIA', 'EVALUACION', 'ALTA_PADRON', 'BAJA_PADRON', 'LEGAJO', 'DUA', 'RECONOCIMIENTO'].indexOf(d.tipo) >= 0) grupoUGI(d);
  if (['EVALUACION', 'BAJA_PADRON', 'LEGAJO', 'DUA', 'RECONOCIMIENTO'].indexOf(d.tipo) >= 0) sujetoUGI(padron, d);
  if (['ASISTENCIA', 'EVALUACION', 'RECONOCIMIENTO'].indexOf(d.tipo)>=0 && !d.fecha) falloUGI('VALIDACION', 'Falta la fecha.');
  if (d.tipo === 'EVALUACION') {
    var notas = d.notas;
    if (!notas || Array.isArray(notas) || !Object.keys(notas).length || Object.keys(notas).length > 60) falloUGI('VALIDACION', 'Faltan notas.');
    Object.keys(notas).forEach(function (k) { textoUGI(k); if (k.indexOf(' | ')>=0 || ['__proto__','constructor','prototype'].indexOf(k)>=0) falloUGI('VALIDACION', 'Nombre de variable inválido.'); if (typeof notas[k] !== 'number' || !isFinite(notas[k]) || notas[k] < 1 || notas[k] > 10) falloUGI('VALIDACION', 'Las notas deben estar entre 1 y 10.'); });
  }
  if (d.tipo === 'ASISTENCIA') {
    var nombres = Object.keys(d.datos || {});
    if (!nombres.length || nombres.length > 500) falloUGI('VALIDACION', 'Lista vacía o demasiado grande.');
    nombres.forEach(function (j) {
      sujetoUGI(padron, { categoria: d.categoria, equipo: d.equipo, jugador: j });
      if (!/^[PATN](?: \| 🍴 Comida)? \| Sem:[VARNO]$/.test(d.datos[j])) falloUGI('VALIDACION', 'Estado de asistencia o semáforo inválido.');
    });
    var esperados = padron.filter(function (r) { return mismo(r[1], d.categoria) && mismo(r[2] || 'General', d.equipo); });
    if (esperados.length !== nombres.length) falloUGI('CONFLICTO', 'El plantel cambió. Actualizá la lista antes de guardar.');
    if (d.clima && ['Vapor', 'Agua', 'Fuego', 'N'].indexOf(d.clima) < 0) falloUGI('VALIDACION', 'Clima inválido.');
    if (d.puntosCiudad && !/^\+?\d{1,3}$/.test(String(d.puntosCiudad))) falloUGI('VALIDACION', 'Puntos inválidos.');
  }
  if (d.tipo === 'ALTA_PADRON') {
    if (!Array.isArray(d.jugadores) || !d.jugadores.length || d.jugadores.length > 500) falloUGI('VALIDACION', 'Listado de altas inválido.');
    var seen = {};
    d.jugadores.forEach(function (j) {
      textoUGI(j.jugador); if (j.dni && !/^\d{7,8}$/.test(j.dni)) falloUGI('VALIDACION', 'DNI inválido.');
      var k = j.jugador.trim().toLowerCase(); if (seen[k]) falloUGI('VALIDACION', 'Hay nombres duplicados en la carga.'); seen[k] = true;
    });
  }
  if (d.tipo === 'GESTOS' && (!Array.isArray(d.gestos) || d.gestos.length > 60 || d.gestos.some(function (g) { return typeof g !== 'string' || !g.trim() || g.length > 160; }))) falloUGI('VALIDACION', 'Variables inválidas.');
  if (d.tipo === 'CONFIG' && d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) falloUGI('VALIDACION', 'Email inválido.');
}
function actualizarFichaUGI(d, padron, u) {
  var sujeto = sujetoUGI(padron, d), id = sujeto[5];
  var sh = tablaUGI(centralUGI(), 'Fichas', ['ID', 'Deporte', 'DUA', 'Legajo', 'Actualizado', 'Autor']);
  var rows = filasUGI(sh), idx = rows.findIndex(function (r) { return r[0] === id && r[1] === d.deporte; });
  var row = idx >= 0 ? rows[idx] : [id, d.deporte, '{}', '{}', '', ''];
  var f = d.ficha;
  if (!f || typeof f !== 'object' || Array.isArray(f) || JSON.stringify(f).length > 35000) falloUGI('VALIDACION', 'Ficha inválida o demasiado extensa.');
  if (d.tipo === 'LEGAJO' && Object.prototype.hasOwnProperty.call(f,'dni')) { if (f.dni && !/^\d{7,8}$/.test(f.dni)) falloUGI('VALIDACION','DNI inválido.'); if (f.dni) identidadUGI(f.dni,id); }
  if (d.tipo === 'DUA') {
    var dua = {}; ['comunicacion', 'desborda', 'regula'].forEach(function (k) { var v = String(f[k] || ''); if (v.length > 3000) falloUGI('VALIDACION', 'Apoyo demasiado extenso.'); dua[k] = v; });
    row[2] = JSON.stringify(dua);
  } else {
    if (!Array.isArray(f.actividadesSimultaneas) || !Array.isArray(f.bitacora) || f.bitacora.length > 200) falloUGI('VALIDACION', 'Bitácora inválida (máximo 200 entradas).');
    var prev = JSON.parse(row[3] || '{}'), anteriores = {};
    (prev.bitacora || []).forEach(function (ev) { anteriores[ev.id] = ev; });
    f.bitacora = f.bitacora.map(function (ev) {
      if (anteriores[ev.id]) {
        var old = anteriores[ev.id];
        if (old.detalle !== ev.detalle || old.fecha !== ev.fecha || old.tipo !== ev.tipo) falloUGI('VALIDACION', 'Los eventos previos no se pueden alterar; agregá una rectificación.');
        return old;
      }
      return { id: textoUGI(ev.id), fecha: textoUGI(ev.fecha, 10), tipo: textoUGI(ev.tipo), detalle: textoUGI(ev.detalle, 4000), autor: u.nombre + ' (' + d.deporte + ')' };
    });
    // Conserva entradas omitidas: la bitácora es un historial, no un borrador reemplazable.
    (prev.bitacora || []).forEach(function (ev) { if (!f.bitacora.some(function (x) { return x.id === ev.id; })) f.bitacora.push(ev); });
    row[3] = JSON.stringify({ estadoPlan: String(f.estadoPlan || '').slice(0, 200), paseInterno: String(f.paseInterno || '').slice(0, 4000), actividadesSimultaneas: (f.actividadesSimultaneas || []).filter(function (a) { return !!SHEET_IDS[a] || a === 'Ciudad Integrado'; }), bitacora: f.bitacora });
  }
  row[4] = new Date().toISOString(); row[5] = u.id;
  if (idx >= 0) sh.getRange(idx + 2, 1, 1, 6).setValues([row]); else sh.appendRow(row);
  if (d.tipo==='LEGAJO' && Object.prototype.hasOwnProperty.call(f,'dni')) { sujeto[4]=f.dni||''; guardarFilasUGI(hoja(abrirSheet(d.deporte),'Padron'),padron,6); }
}
function fichasUGI(padron, deporte, u) {
  var ids = {}; padron.forEach(function (r) { ids[r[5]] = true; });
  var sh = centralUGI().getSheetByName('Fichas'), result = {};
  filasUGI(sh).filter(function (r) { return ids[r[0]] && r[1] === deporte; }).forEach(function (r) {
    result[r[0]] = { dua: JSON.parse(r[2] || '{}'), legajo: u.rol === 'Profe' ? {} : JSON.parse(r[3] || '{}') };
  }); return result;
}
function archivarUGI(ss, modo, u, opId) {
  var log = tablaUGI(ss, '_TemporadasUGI', ['ID', 'Fecha', 'Modo', 'Hojas', 'Autor', 'Estado', 'Operacion']);
  var existing = filasUGI(log).findIndex(function (r) { return r[6] === opId; });
  var id, map, rowIndex;
  if (existing >= 0) {
    var prev = filasUGI(log)[existing]; id = prev[0]; map = JSON.parse(prev[3]); rowIndex = existing + 2;
    if (prev[5] === 'COMPLETO') return id;
  } else {
    id = new Date().getTime() + '_' + Utilities.getUuid().slice(0, 8); map = {};
    var names = ['Asistencia', 'Evaluaciones', 'Padron', 'Gestos'];
    // Completar y verificar TODAS las copias antes de tocar los datos actuales.
    names.forEach(function (n) {
      var sh = ss.getSheetByName(n); if (!sh) return;
      var copy = sh.copyTo(ss).setName(n + '_' + id);
      if (copy.getLastRow() !== sh.getLastRow()) falloUGI('ARCHIVO', 'No se pudo verificar el archivo. No se reinició la temporada.');
      map[n] = copy.getName();
    });
    log.appendRow([id, new Date().toISOString(), modo, JSON.stringify(map), u.id, 'PREPARADO', opId]); rowIndex = log.getLastRow();
  }
  ['Asistencia', 'Evaluaciones'].concat(modo === 'TODO' ? ['Padron'] : []).forEach(function (n) {
    var sh = ss.getSheetByName(n); if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  });
  log.getRange(rowIndex, 6).setValue('COMPLETO');
  return id;
}
function errorRespuestaUGI(err) {
  return respuesta({ ok: false, apiVersion: 2, codigo: err.codigo || 'SERVIDOR', error: err.codigo ? err.message : 'No se pudo completar la operación. Reintentá o consultá a Dirección UGI.' });
}
function doPost(e) {
  var lock = LockService.getScriptLock(), locked = false;
  try {
    lock.waitLock(20000); locked = true;
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 120000) falloUGI('VALIDACION', 'Solicitud inválida o demasiado grande.');
    var d = JSON.parse(raw);
    if (d.tipo === 'LOGIN') return respuesta(loginUGI(d));
    var u = tokenValido(d.token);
    if (!u) falloUGI('SESION', 'Sesión no autorizada o vencida. Volvé a ingresar.');
    if (d.tipo === 'LOGOUT') { CacheService.getScriptCache().remove('session:' + d.token); return respuesta({ ok: true, apiVersion: 2 }); }
    autorizarUGI(u, d.deporte, d.tipo);
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(d.requestId || '')) falloUGI('VALIDACION', 'Falta el identificador de operación.');
    var ss = abrirSheet(d.deporte), padron = padronUGI(ss);
    if (['DUA','LEGAJO','RECONOCIMIENTO'].indexOf(d.tipo)>=0) { var subject = sujetoUGI(padron,d); if (d.subjectId !== subject[5]) falloUGI('VALIDACION', 'La identidad no coincide con el padrón.'); }
    var incomplete=filasUGI(ss.getSheetByName('_TemporadasUGI')).filter(function(r){return r[5]==='PREPARADO';});
    if (incomplete.length && !(d.tipo==='RESET_DATOS' && incomplete[0][6]===d.requestId)) falloUGI('ARCHIVO', 'Hay un cierre de temporada pendiente. Dirección debe reintentar ese cierre antes de cargar nuevos datos.');
    var key = claveOperacionUGI(d);
    var ledger = tablaUGI(ss, '_OperacionesUGI', ['ID', 'Usuario', 'Resultado']);
    var previous = filasUGI(ledger).filter(function (r) { return r[0] === d.requestId; })[0];
    if (previous) { if (previous[1] !== u.id) falloUGI('PERMISOS', 'Operación de otra cuenta.'); return respuesta(JSON.parse(previous[2])); }
    var control = controlUGI(ss), rowsControl = filasUGI(control), ci = rowsControl.findIndex(function (r) { return r[0] === key; });
    var revision = ci < 0 ? 0 : Number(rowsControl[ci][1]);
    var temporada = Number(PropertiesService.getScriptProperties().getProperty('UGI_EPOCH_' + d.deporte) || 0);
    if (d.temporada !== temporada) falloUGI('CONFLICTO', 'Cambió la temporada. Revisá la carga pendiente.');
    if (!Number.isInteger(d.revision) || d.revision !== revision) falloUGI('CONFLICTO', 'Otra persona modificó este registro. Actualizá y revisá antes de reemplazar.');
    validarCargaUGI(d, padron);
    var sh, rows, tz = ss.getSpreadsheetTimeZone();
    if (d.tipo === 'ASISTENCIA' || d.tipo === 'EVALUACION') {
      sh = hoja(ss, d.tipo === 'ASISTENCIA' ? 'Asistencia' : 'Evaluaciones');
      rows = filasUGI(sh).filter(function (r) { return !(fechaTxt(r[0], tz) === d.fecha && mismo(r[2], d.categoria) && mismo(r[3], d.equipo) && (d.tipo === 'ASISTENCIA' || mismo(r[4], d.jugador))); });
      if (d.tipo === 'ASISTENCIA') {
        Object.keys(d.datos).forEach(function (j) { rows.push([d.fecha, d.deporte, d.categoria, d.equipo, j, d.datos[j] + (d.puntosCiudad ? ' | Pts:' + d.puntosCiudad : '') + (d.clima ? ' | Clima:' + d.clima : '')]); });
      } else {
        var detalle = Object.keys(d.notas).map(function (k) { return k + ': ' + d.notas[k]; }).join(' | ');
        // No se mezcla desempeño técnico y formativo en un promedio general.
        rows.push([d.fecha, d.deporte, d.categoria, d.equipo, d.jugador, detalle, '']);
      }
      guardarFilasUGI(sh, rows, d.tipo === 'ASISTENCIA' ? 6 : 7);
    } else if (d.tipo === 'ALTA_PADRON') {
      d.jugadores.forEach(function (j) {
        var idx = padron.findIndex(function (r) { return mismo(r[1], d.categoria) && mismo(r[2], d.equipo) && mismo(r[3], j.jugador); });
        if (idx < 0) padron.push([d.deporte, d.categoria, d.equipo, j.jugador.trim(), j.dni || '', identidadUGI(j.dni || '')]);
        else if (Object.prototype.hasOwnProperty.call(j, 'dni')) {
          // La identidad es estable; las correcciones de DNI no mezclan legajos automáticamente.
          if (j.dni) identidadUGI(j.dni, padron[idx][5]);
          padron[idx][4] = j.dni || '';
        }
      }); guardarFilasUGI(hoja(ss, 'Padron'), padron, 6);
    } else if (d.tipo === 'BAJA_PADRON') {
      guardarFilasUGI(hoja(ss, 'Padron'), padron.filter(function (r) { return !(mismo(r[1], d.categoria) && mismo(r[2], d.equipo) && mismo(r[3], d.jugador)); }), 6);
    } else if (d.tipo === 'DUA' || d.tipo === 'LEGAJO') actualizarFichaUGI(d, padron, u);
    else if (d.tipo === 'RECONOCIMIENTO') {
      var sujeto = sujetoUGI(padron, d);
      textoUGI(d.motivo, 300); if (String(d.nota || '').length > 2000) falloUGI('VALIDACION', 'Mensaje demasiado extenso.');
      var fichas = fichasUGI(padron, d.deporte, { rol: 'Dirección UGI' });
      var f = (fichas[sujeto[5]] || {}).legajo || {bitacora:[],actividadesSimultaneas:[]};
      f.bitacora.unshift({id:'verde_'+d.requestId,fecha:d.fecha,tipo:'🟢 Tarjeta Verde Digital',detalle:d.motivo+(d.nota?' — '+d.nota:'')});
      actualizarFichaUGI(Object.assign({}, d, {tipo:'LEGAJO',ficha:f}), padron, u);
    }
    else if (d.tipo === 'GESTOS') guardarFilasUGI(tablaUGI(ss, 'Gestos', ['Gesto / Variable']), d.gestos.map(function (g) { return [g]; }), 1);
    else if (d.tipo === 'CONFIG') tablaUGI(ss, 'Config', ['Email coordinador', '']).getRange('A1:B1').setValues([['Email coordinador', d.email || '']]);
    else if (d.tipo === 'SESION_UGI') {
      textoUGI(d.foco, 300); if (String(d.nota || '').length > 4000) falloUGI('VALIDACION', 'Nota demasiado extensa.');
      tablaUGI(ss, 'SesionesUGI', ['Fecha', 'Usuario', 'Nombre', 'Foco', 'Checklist', 'Nota']).appendRow([new Date().toISOString(), u.id, u.nombre, celdaUGI(d.foco), celdaUGI(String(d.checklist || '').slice(0, 500)), celdaUGI(d.nota || '')]);
    } else if (d.tipo === 'RESET_DATOS') {
      if (['TEMPORADA', 'TODO'].indexOf(d.modo) < 0) falloUGI('VALIDACION', 'Modo de archivo inválido.');
      archivarUGI(ss, d.modo, u, d.requestId);
      PropertiesService.getScriptProperties().setProperty('UGI_EPOCH_' + d.deporte, String(temporada + 1));
    }
    var result = { ok: true, apiVersion: 2, revision: revision + 1, requestId: d.requestId };
    if (ci < 0) control.appendRow([key, revision + 1, d.requestId]); else control.getRange(ci + 2, 1, 1, 3).setValues([[key, revision + 1, d.requestId]]);
    ledger.appendRow([d.requestId, u.id, JSON.stringify(result)]);
    return respuesta(result);
  } catch (err) { return errorRespuestaUGI(err); }
  finally { if (locked) lock.releaseLock(); }
}
function doGet(e) {
  var lock = LockService.getScriptLock(), locked = false;
  try {
    var p = e && e.parameter || {};
    if (!p.deporte) return respuesta({ ok: true, apiVersion: 2, mensaje: 'Muni 360 activo' });
    var u = tokenValido(p.token); autorizarUGI(u, p.deporte, 'LECTURA');
    lock.waitLock(20000); locked = true;
    var ss = abrirSheet(p.deporte), tz = ss.getSpreadsheetTimeZone();
    var histories = filasUGI(ss.getSheetByName('_TemporadasUGI')).filter(function (r) { return r[5] === 'COMPLETO'; });
    var archive = p.temporada ? histories.filter(function (r) { return r[0] === p.temporada; })[0] : null;
    if (p.temporada && !archive) falloUGI('VALIDACION', 'Temporada inexistente.');
    var names = archive ? JSON.parse(archive[3]) : {};
    var padron = archive ? filasUGI(ss.getSheetByName(names.Padron)) : padronUGI(ss);
    var registros = function (n) { if (archive && !names[n]) return []; return filasUGI(ss.getSheetByName(archive ? names[n] : n)); };
    var evals = registros('Evaluaciones').filter(function (r) { return r[4]; }).map(function (r) {
      var notas = {}; String(r[5] || '').split(' | ').forEach(function (par) { var i = par.lastIndexOf(':'); if (i > 0) notas[par.slice(0, i).trim()] = Number(par.slice(i + 1)); });
      return { fecha: fechaTxt(r[0], tz), categoria: String(r[2]), equipo: String(r[3] || 'General'), jugador: String(r[4]), notas: notas };
    });
    var shC = ss.getSheetByName('Config');
    return respuesta({ ok: true, apiVersion: 2,
      padron: padron.filter(function (r) { return r[3]; }).map(function (r) { return { id: r[5], categoria: String(r[1]), equipo: String(r[2] || 'General'), jugador: String(r[3]), dni: u.rol === 'Profe' ? '' : String(r[4] || '') }; }),
      asistencia: registros('Asistencia').filter(function (r) { return r[4]; }).map(function (r) { return { fecha: fechaTxt(r[0], tz), categoria: String(r[2]), equipo: String(r[3] || 'General'), jugador: String(r[4]), estado: String(r[5]) }; }),
      evaluaciones: evals, gestos: registros('Gestos').map(function (r) { return String(r[0]); }),
      fichas: archive ? {} : fichasUGI(padron, p.deporte, u), versiones: versionesUGI(ss),
      temporada: Number(PropertiesService.getScriptProperties().getProperty('UGI_EPOCH_' + p.deporte) || 0),
      archivos: histories.map(function (r) { return { id: r[0], fecha: r[1], modo: r[2] }; }),
      sesiones: registros('SesionesUGI').filter(function (r) { return u.rol !== 'Profe' || r[1] === u.id; }).map(function (r) { return { fecha: r[0], profe: r[2], categoria: p.deporte, foco: r[3], checklist: r[4], nota: r[5] }; }),
      backup: u.rol === 'Dirección UGI' ? JSON.parse(PropertiesService.getScriptProperties().getProperty('UGI_ULTIMO_BACKUP') || 'null') : null,
      email: u.rol === 'Profe' ? '' : shC ? String(shC.getRange('B1').getValue() || '') : '' });
  } catch (err) { return errorRespuestaUGI(err); }
  finally { if (locked) lock.releaseLock(); }
}
