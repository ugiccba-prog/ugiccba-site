/**
 * ============================================================================
 * UGI · Unidad de Gestión Integral — Backend Maestro de MUNI 360
 * URL de producción: https://www.ugiccba.com.ar/muni360
 * URL activa del Script: https://script.google.com/macros/s/AKfycbz0VhNzdHKgFfrbHvuCJtLqrLRz9BWKxYxKjQ5CdCNQDiMd38edOmTDnGyTm8OBDeZ6/exec
 * Maneja las 25 disciplinas oficiales (Colonia, COYFD y los 23 deportes/ramas).
 * Asistencia + Evaluaciones + Padrón (con DNI en Columna E) + Backup + Temporada.
 * ============================================================================
 * INSTALACIÓN RECOMENDADA:
 *  1. script.google.com > instalar este archivo y Muni360Core.gs en el mismo proyecto.
 *  2. Configurar cuentas individuales: docs/muni360-operacion.md; luego publicar nueva versión.
 *  3. Ejecutar UNA vez la función crearActivadorViernes() (menú ▶ Ejecutar)
 *     para que la auditoría de asistencia al mail y el backup semanal en Drive
 *     corran solos todos los viernes a las 9 AM.
 *
 * PESTAÑAS en cada Sheet:
 *   Evaluaciones | Asistencia | Padron (Col E = DNI) | Gestos | Config (B1 = mail)
 * ============================================================================
 */

// 1. PLANILLAS OFICIALES UGI (Estricto: 25 disciplinas únicas, 1 Sheet independiente por actividad/rama)
var SHEET_IDS = {
  'Básquet Caballeros':                 '1atZz7i-cxBzLfKZeoKLgVo_n0W2S3xtd4K4T6nUHZUo',
  'Básquet Damas':                      '1YNoY2uEymXVN0yA4vt13MNk1jeRjj5704ENGi_RpD1g',
  'COYFD':                              '1NVb5u-a0KceaMH17_JibsMvMt5gBfOLy2G7hAdmkjnk',
  'Cestoball':                          '1sXraAlu-ffUONjIlDxCrYqVcT3nKh_cKdDsWZqPzDDs',
  'Colonia':                            '1i_c6Gmk8P2DftBRMo1PmqJ4SITAVs4hWn42-KXGkuyA',
  'Fútbol Caballeros':                  '1hhkJdJNfCGoH2Of1D9krWmyftPg6KyyjXZbNHP-_ZNQ',
  'Fútbol Damas':                       '12merM9tSeYivBDAskXvghB253DTdTEbLHyVS45hbEa0',
  'Gimnasia Artística':                 '1IvqhYgaE3gZLQJZulkrcUayZ6lB6jczKXNEAiqKuEcY',
  'Gimnasia Rítmica':                   '1aGBE83lkn7TCjWlCINnRe0fzY2JGN9503d-05NL8rWE',
  'Golf':                               '1AptU0IPt589WqMoQp7KH8-iLIlLX70YmQezqTL9AspU',
  'Handball':                           '1sX1qXGmhclyWNQ9emya5HvPdS0p6F5JOormRMLV9nqM',
  'Hockey sobre Césped Caballeros':     '1dtjk_YnaUJYtm91TnDV4siKlRQor2ogf0_wrSmn27GI',
  'Hockey sobre Césped Damas':          '1E5DTN9IPlZ0vN4XYFNfgzwru9snsQ2WnUCTbvqdx4Jc',
  'Hockey sobre Patines Caballeros':    '1cd90Dt44mS8avP5G83cRJLgU3fNt_EQrSHNTgV9Xd-w',
  'Hockey sobre Patines Damas':         '1oW0zu6OfgQj2A2Qsk8mb4f2v4O3qg4zRfjTiho-FMYY',
  'Judo':                               '1Mp-HI_aPV-RMrycPREMbc9SlbcJvt-DDbb1C-poL4V4',
  'Karate':                             '1bTl33vW7OkGMyyI1DAugog_P0AnfiDgLpGX-nm8xsX0',
  'Natación Artística':                 '1MlLH8Tt8377db07WuusSvtMH9PxtArWmMvNE9nm5HCA',
  'Patín Artístico':                    '1z3reK28Tz4f_2Xfp39BOkW2A_vD5fjfmi0F0kEx9DNI',
  'Pelota Paleta':                      '14pa7-NPaSvyn5YpxxsfPOSUKaymJxSXQv_V-dlrPcno',
  'Rugby Caballeros':                   '1QvGvPADaFIuo1befSR-MYtAiEHmwDRR_AaFQm3Qa5Mc',
  'Rugby Damas':                        '1hqTHOhJPfhW2i-9QvFIqvB-L8KFKNWM1q0WOQIAgYYc',
  'Tenis':                              '10-O7S6yDlOIofDs1Eb0nNd4bwqjWNPRjWqBB9URfrP0',
  'Vóley Caballeros':                   '1RuAkEXIHGErXaq36y4zT-6YT-fupYGElej8z4uAJDf8',
  'Vóley Damas':                        '1A4I4Eg_OcLXowIJImP8nwMSHyyN9OHwTLQZrJYbxHgE'
};

var TZ = 'America/Argentina/Buenos_Aires';

// El DNI va siempre en la última columna (Columna E) de Padron para no mezclarse con ningún dato numérico
var CABECERAS = {
  'Evaluaciones': ['Fecha', 'Deporte', 'Categoría', 'Equipo', 'Jugador', 'Detalle Notas', 'Promedio'],
  'Asistencia':   ['Fecha', 'Deporte', 'Categoría', 'Equipo', 'Jugador', 'Estado'],
  'Padron':       ['Deporte', 'Categoría', 'Equipo', 'Jugador', 'DNI', 'ID deportista']
};

// --- UTILIDADES ---------------------------------------------------------------
function abrirSheet(deporte) {
  var id = SHEET_IDS[deporte];
  if (!id) {
    try {
      id = PropertiesService.getScriptProperties().getProperty('SHEET_' + deporte) ||
           PropertiesService.getScriptProperties().getProperty(deporte);
    } catch (_) {}
  }
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('No hay planilla configurada para: ' + deporte);
}

function hoja(ss, nombre) {
  var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  var cab = CABECERAS[nombre];
  if (cab && sh.getLastRow() === 0) {
    sh.appendRow(cab);
    sh.getRange(1, 1, 1, cab.length).setFontWeight('bold').setBackground('#082b49').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  } else if (nombre === 'Padron' && sh.getLastColumn() < 5) {
    sh.getRange(1, 5).setValue('DNI').setFontWeight('bold').setBackground('#082b49').setFontColor('#ffffff');
  }
  return sh;
}

function filas(sh) {
  if (!sh || sh.getLastRow() <= 1) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 5)).getValues();
}

function fechaTxt(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

// Borra (de abajo hacia arriba) las filas de datos que cumplan la condición
function borrarFilas(sh, condicion) {
  var datos = filas(sh);
  for (var i = datos.length - 1; i >= 0; i--) {
    if (condicion(datos[i])) sh.deleteRow(i + 2);
  }
}

function mismo(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// API v2 y autenticación: ver Muni360Core.gs (mismo proyecto de Apps Script).

// --- 3. AUDITORÍA AUTOMÁTICA DE ASISTENCIA Y BACKUP (VIERNES 9 AM) -------------
function verificarAsistenciaSemanal() {
  // Ejecuta la copia de seguridad semanal de todas las planillas del club
  try {
    realizarBackupSemanal();
  } catch (errBackup) {
    console.error('Error al realizar backup semanal: ' + errBackup);
  }

  var deportes = Object.keys(SHEET_IDS);
  if (deportes.length === 0) {
    auditarPlanilla(SpreadsheetApp.getActiveSpreadsheet(), '');
    return;
  }
  var vistos = {};
  deportes.forEach(function (dep) {
    var id = SHEET_IDS[dep];
    if (!id || vistos[id]) return;
    vistos[id] = true;
    try { auditarPlanilla(SpreadsheetApp.openById(id), dep); } catch (e) { console.error(dep, e); }
  });
}

function auditarPlanilla(ss, deporte) {
  var shConfig = ss.getSheetByName('Config');
  if (!shConfig) return;
  var email = String(shConfig.getRange('B1').getValue() || '');
  if (email.indexOf('@') === -1) return;

  // Grupos registrados en el padrón (Categoría · Equipo)
  var grupos = {};
  filas(ss.getSheetByName('Padron')).forEach(function (r) {
    if (r[3]) grupos[r[1] + ' · ' + r[2]] = true;
  });
  if (Object.keys(grupos).length === 0) return; // deporte sin padrón todavía

  // Grupos que cargaron asistencia en los últimos 7 días
  var unaSemanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  var cargados = {};
  filas(ss.getSheetByName('Asistencia')).forEach(function (r) {
    var f = r[0] instanceof Date ? r[0] : new Date(r[0]);
    if (f >= unaSemanaAtras) cargados[r[2] + ' · ' + r[3]] = true;
  });

  var sinCargar = Object.keys(grupos).filter(function (g) { return !cargados[g]; });
  if (sinCargar.length === 0) return;

  var titulo = deporte ? ' (' + deporte + ')' : '';
  var mensaje = 'Hola Coordinador,\n\nEl sistema detectó que estos grupos' + titulo +
    ' NO registraron asistencia en los últimos 7 días:\n\n' +
    sinCargar.map(function (g) { return '• ' + g; }).join('\n') +
    '\n\nPor favor pasales el aviso a los profes.\n\nClub Ciudad de Buenos Aires - Unidad de Gestión Integral';

  MailApp.sendEmail(email, '⚠️ UGI' + titulo + ': grupos sin asistencia esta semana', mensaje);
}

// Ejecutar UNA sola vez: crea el activador de los viernes a las 9 AM
function crearActivadorViernes() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'verificarAsistenciaSemanal') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('verificarAsistenciaSemanal')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(9)
    .inTimezone(TZ)
    .create();
}

// --- 4. COPIA DE SEGURIDAD AUTOMÁTICA SEMANAL EN GOOGLE DRIVE ------------------
/**
 * Crea o utiliza la carpeta "_BACKUP_SEMANAL_UGI" en Google Drive y guarda
 * una copia fechada de cada una de las planillas oficiales.
 * Corre automáticamente todos los viernes junto con la auditoría de las 9 AM.
 */
function realizarBackupSemanal() {
  var nombreCarpeta = '_BACKUP_SEMANAL_UGI';
  var iter = DriveApp.getFoldersByName(nombreCarpeta);
  var carpetaBackup = iter.hasNext() ? iter.next() : DriveApp.createFolder(nombreCarpeta);
  var fechaHoy = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

  var idsCopiados = {}, erroresBackup = [], copiasBackup = 0;

  // 1. Copia todas las planillas definidas en SHEET_IDS
  Object.keys(SHEET_IDS).forEach(function (dep) {
    var id = SHEET_IDS[dep];
    if (!id || idsCopiados[id]) return;
    idsCopiados[id] = true;
    try {
      var archivo = DriveApp.getFileById(id);
      archivo.makeCopy('BACKUP_' + fechaHoy + '_' + archivo.getName(), carpetaBackup); copiasBackup++;
    } catch (e) {
      erroresBackup.push(dep); console.error('Error backup ' + dep + ': ' + e);
    }
  });

  // 2. Copia también planillas dinámicas guardadas en PropertiesService
  try {
    var props = PropertiesService.getScriptProperties().getProperties();
    Object.keys(props).forEach(function (k) {
      var id = props[k];
      if (!(k.indexOf('SHEET_') === 0 || k === 'UGI_LEGAJOS_SHEET_ID') || !id || idsCopiados[id]) return;
      idsCopiados[id] = true;
      try {
        var archivo = DriveApp.getFileById(id);
        archivo.makeCopy('BACKUP_' + fechaHoy + '_' + archivo.getName(), carpetaBackup); copiasBackup++;
      } catch (_) { erroresBackup.push(k); }
    });
  } catch (_) { erroresBackup.push('Propiedades'); }

  PropertiesService.getScriptProperties().setProperty('UGI_ULTIMO_BACKUP', JSON.stringify({fecha:new Date().toISOString(),ok:erroresBackup.length===0,copias:copiasBackup,errores:erroresBackup}));
  if (erroresBackup.length) throw new Error('Backup incompleto: ' + erroresBackup.join(', '));
  Logger.log('========================================================');
  Logger.log('BACKUP SEMANAL FINALIZADO: revisar errores por planilla en el registro de ejecución.');
  Logger.log('Carpeta: ' + nombreCarpeta + ' (' + carpetaBackup.getUrl() + ')');
  Logger.log('Fecha: ' + fechaHoy);
  Logger.log('========================================================');
}

// --- 5. CREADOR MASIVO DE TODAS LAS PLANILLAS OFICIALES ------------------------
function crearTodasLasPlanillasOficiales() {
  var NOMBRE_CARPETA = '📁 UGI · Planillas Oficiales MUNI 360 (Club Ciudad)';
  var carpetas = DriveApp.getFoldersByName(NOMBRE_CARPETA);
  var folder = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(NOMBRE_CARPETA);

  var ACTIVIDADES = [
    {
      clave: 'Colonia',
      titulo: 'UGI · Colonia de Verano - Planilla Oficial',
      gestos: ['Participación y entusiasmo', 'Respeto de consignas', 'Trabajo en equipo', 'Coordinación motriz', 'Adaptación al agua', 'Autonomía personal', 'Resolución de conflictos']
    },
    {
      clave: 'COYFD',
      titulo: 'UGI · COYFD (Iniciación Deportiva) - Planilla Oficial',
      gestos: ['Coordinación óculo-manual', 'Coordinación óculo-pédica', 'Equilibrio y desplazamientos', 'Giro y salto', 'Cooperación en juego', 'Comprensión de reglas', 'Tolerancia al contacto']
    },
    {
      clave: 'Básquet Caballeros',
      titulo: 'UGI · Básquet Caballeros - Planilla Oficial',
      gestos: ['Dribbling con ambas manos', 'Mecánica de tiro', 'Bandeja / finalización', 'Pase', 'Postura defensiva', 'Rebote', 'Juego sin pelota', 'Toma de decisión']
    },
    {
      clave: 'Básquet Damas',
      titulo: 'UGI · Básquet Damas - Planilla Oficial',
      gestos: ['Dribbling con ambas manos', 'Mecánica de tiro', 'Bandeja / finalización', 'Pase', 'Postura defensiva', 'Rebote', 'Juego sin pelota', 'Toma de decisión']
    },
    {
      clave: 'Cestoball',
      titulo: 'UGI · Cestoball - Planilla Oficial',
      gestos: ['Pase y recepción en movimiento', 'Tiro al aro y precisión', 'Desmarque y ocupación de espacios', 'Defensa e intercepción', 'Rebote y recupero', 'Transición rápida', 'Toma de decisión']
    },
    {
      clave: 'Fútbol Caballeros',
      titulo: 'UGI · Fútbol Caballeros - Planilla Oficial',
      gestos: ['Control orientado', 'Pase corto', 'Pase largo / cambio de frente', 'Conducción', 'Remate', 'Juego aéreo', 'Marca y recuperación', 'Perfil y lectura de juego']
    },
    {
      clave: 'Fútbol Damas',
      titulo: 'UGI · Fútbol Damas - Planilla Oficial',
      gestos: ['Control orientado', 'Pase corto', 'Pase largo / cambio de frente', 'Conducción', 'Remate', 'Juego aéreo', 'Marca y recuperación', 'Perfil y lectura de juego']
    },
    {
      clave: 'Gimnasia Artística',
      titulo: 'UGI · Gimnasia Artística - Planilla Oficial',
      gestos: ['Flexibilidad y movilidad', 'Fuerza postural y core', 'Acrobacia de suelo (roles/vertical/medialuna)', 'Salto y recepción segura', 'Trabajo en aparatos (viga/paralelas)', 'Alineación corporal', 'Memoria coreográfica']
    },
    {
      clave: 'Gimnasia Rítmica',
      titulo: 'UGI · Gimnasia Rítmica - Planilla Oficial',
      gestos: ['Manejo técnico de aparato (cuerda/aro/pelota/cinta)', 'Flexibilidad y amplitud articular', 'Equilibrios y giros', 'Saltos rítmicos', 'Musicalidad y ritmo', 'Expresión corporal', 'Coordinación espacio-temporal']
    },
    {
      clave: 'Golf',
      titulo: 'UGI · Golf - Planilla Oficial',
      gestos: ['Grip, stance y alineación', 'Full swing (maderas e hierros)', 'Juego corto (approach / chipping)', 'Putting (lectura y control de distancia)', 'Salida de bunker', 'Estrategia de cancha', 'Etiqueta, reglas y ritmo de juego']
    },
    {
      clave: 'Hockey sobre Césped Caballeros',
      titulo: 'UGI · Hockey sobre Césped Caballeros - Planilla Oficial',
      gestos: ['Conducción (derecha y revés)', 'Pase (push / slap)', 'Recepción', 'Barrida / hit', 'Tackle y marca', 'Ubicación en cancha', 'Toma de decisión']
    },
    {
      clave: 'Hockey sobre Césped Damas',
      titulo: 'UGI · Hockey sobre Césped Damas - Planilla Oficial',
      gestos: ['Conducción (derecha y revés)', 'Pase (push / slap)', 'Recepción', 'Barrida / hit', 'Tackle y marca', 'Ubicación en cancha', 'Toma de decisión']
    },
    {
      clave: 'Hockey sobre Patines Caballeros',
      titulo: 'UGI · Hockey sobre Patines Caballeros - Planilla Oficial',
      gestos: ['Patinaje y equilibrio', 'Frenado y cambios de dirección', 'Conducción de bocha', 'Pase y recepción', 'Tiro al arco', 'Posición defensiva', 'Lectura de juego']
    },
    {
      clave: 'Hockey sobre Patines Damas',
      titulo: 'UGI · Hockey sobre Patines Damas - Planilla Oficial',
      gestos: ['Patinaje y equilibrio', 'Frenado y cambios de dirección', 'Conducción de bocha', 'Pase y recepción', 'Tiro al arco', 'Posición defensiva', 'Lectura de juego']
    },
    {
      clave: 'Judo',
      titulo: 'UGI · Judo - Planilla Oficial',
      gestos: ['Ukemi (caídas seguras)', 'Kumi-kata (agarres y desplazamientos)', 'Nage-waza (proyecciones de pie)', 'Ne-waza (inmovilizaciones y control en suelo)', 'Equilibrio y desequilibrio (Kuzushi)', 'Transición pie-suelo', 'Autocontrol y etiqueta (Rei)']
    },
    {
      clave: 'Karate',
      titulo: 'UGI · Karate - Planilla Oficial',
      gestos: ['Kihon (posiciones y técnicas básicas)', 'Kata (forma, ritmo y foco)', 'Kumite (distancia, timing y marcación)', 'Velocidad y coordinación', 'Control del impacto (Zanshin)', 'Equilibrio y desplazamientos', 'Disciplina y etiqueta (Dojo Kun)']
    },
    {
      clave: 'Natación Artística',
      titulo: 'UGI · Natación Artística - Planilla Oficial',
      gestos: ['Flotación y sculling (propulsión de manos)', 'Figuras y posiciones básicas', 'Control respiratorio y apnea', 'Flexibilidad en el agua', 'Sincronización grupal', 'Musicalidad y cuenta rítmica', 'Resistencia específica']
    },
    {
      clave: 'Patín Artístico',
      titulo: 'UGI · Patín Artístico - Planilla Oficial',
      gestos: ['Postura y equilibrio', 'Patinaje adelante y atrás', 'Filos y curvas', 'Saltos y aterrizaje', 'Trompos y giros', 'Trabajo de pies y figuras', 'Expresión y musicalidad']
    },
    {
      clave: 'Pelota Paleta',
      titulo: 'UGI · Pelota Paleta - Planilla Oficial',
      gestos: ['Golpe de derecha y revés', 'Lectura de rebote en frontón y pared', 'Desplazamiento y ubicación en cancha', 'Saque y devolución', 'Definición y colocación', 'Coordinación con el compañero', 'Uso de ambas manos']
    },
    {
      clave: 'Handball',
      titulo: 'UGI · Handball - Planilla Oficial',
      gestos: ['Pase y recepción en movimiento', 'Ciclo de pasos', 'Lanzamiento (apoyo y suspensión)', 'Bote y fintas', 'Defensa individual y basculación', 'Repliegue defensivo', 'Toma de decisión']
    },
    {
      clave: 'Rugby Caballeros',
      titulo: 'UGI · Rugby Caballeros - Planilla Oficial',
      gestos: ['Pase', 'Recepción', 'Tackle (técnica segura)', 'Ruck / contacto', 'Apoyo y línea de ventaja', 'Evasión', 'Patada']
    },
    {
      clave: 'Rugby Damas',
      titulo: 'UGI · Rugby Damas - Planilla Oficial',
      gestos: ['Pase', 'Recepción', 'Tackle (técnica segura)', 'Ruck / contacto', 'Apoyo y línea de ventaja', 'Evasión', 'Patada']
    },
    {
      clave: 'Tenis',
      titulo: 'UGI · Tenis - Planilla Oficial',
      gestos: ['Drive', 'Revés', 'Saque', 'Volea y smash', 'Desplazamiento y apoyos', 'Devolución', 'Consistencia y táctica']
    },
    {
      clave: 'Vóley Caballeros',
      titulo: 'UGI · Vóley Caballeros - Planilla Oficial',
      gestos: ['Saque', 'Recepción (antebrazos)', 'Armado (dedos)', 'Ataque / remate', 'Bloqueo', 'Defensa y desplazamiento', 'Comunicación en cancha']
    },
    {
      clave: 'Vóley Damas',
      titulo: 'UGI · Vóley Damas - Planilla Oficial',
      gestos: ['Saque', 'Recepción (antebrazos)', 'Armado (dedos)', 'Ataque / remate', 'Bloqueo', 'Defensa y desplazamiento', 'Comunicación en cancha']
    }
  ];

  var nuevoMapeo = {};
  var propsParaGuardar = {};

  ACTIVIDADES.forEach(function (act) {
    var ss = SpreadsheetApp.create(act.titulo);
    var file = DriveApp.getFileById(ss.getId());
    folder.addFile(file);
    try { DriveApp.getRootFolder().removeFile(file); } catch (_) {}

    // Formatear pestañas institucionales (incluyendo Columna E = DNI en Padron)
    hoja(ss, 'Padron');
    hoja(ss, 'Asistencia');
    hoja(ss, 'Evaluaciones');
    hoja(ss, 'Gestos');
    hoja(ss, 'Config');

    // Cargar gestos específicos del deporte
    var shG = ss.getSheetByName('Gestos');
    var filasG = [['Gesto / Variable']].concat(act.gestos.map(function (g) { return [g]; }));
    shG.getRange(1, 1, filasG.length, 1).setValues(filasG);
    shG.getRange(1, 1).setFontWeight('bold').setBackground('#082b49').setFontColor('#ffffff');

    // Eliminar 'Hoja 1'
    var hDef = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
    if (hDef && ss.getSheets().length > 1) {
      try { ss.deleteSheet(hDef); } catch (_) {}
    }

    var id = ss.getId();
    nuevoMapeo[act.clave] = id;
    propsParaGuardar[act.clave] = id;
    propsParaGuardar['SHEET_' + act.clave] = id;
  });

  PropertiesService.getScriptProperties().setProperties(propsParaGuardar);

  var lineasCodigo = ['var SHEET_IDS = {'];
  var clavesOrdenadas = Object.keys(nuevoMapeo).sort();
  clavesOrdenadas.forEach(function (k, i) {
    var fin = (i === clavesOrdenadas.length - 1) ? '' : ',';
    var padding = ' '.repeat(Math.max(1, 35 - k.length));
    lineasCodigo.push("  '" + k + "':" + padding + "'" + nuevoMapeo[k] + "'" + fin);
  });
  lineasCodigo.push('};');

  var codigoCompleto = lineasCodigo.join('\n');

  Logger.log('========================================================================');
  Logger.log('✅ TODAS LAS PLANILLAS FUERON CREADAS CON ÉXITO EN TU GOOGLE DRIVE');
  Logger.log('📁 Carpeta: ' + folder.getName() + ' (' + folder.getUrl() + ')');
  Logger.log('\n' + codigoCompleto);
  Logger.log('========================================================================');

  return { folderUrl: folder.getUrl(), ids: nuevoMapeo, codigo: codigoCompleto };
}
