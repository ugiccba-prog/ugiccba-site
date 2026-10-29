/**
 * ============================================================================
 * UGI CCBA — Sincronización Automática de Asistencias a Google Sheets por Deporte
 * ============================================================================
 * ¿CÓMO RESUELVE LOS PERMISOS Y LA PRIVACIDAD ENTRE DEPORTES?
 * 1. Crea una carpeta "UGI - Asistencias en Vivo" en tu Google Drive.
 * 2. Adentro crea 1 ARCHIVO DE GOOGLE SHEETS SEPARADO POR CADA DEPORTE
 *    (ej: "Asistencia UGI - Colonia", "Asistencia UGI - Hockey sobre Patines", etc.).
 * 3. Configura cada archivo como "Cualquiera con el enlace: SOLO LECTURA (Lector)".
 *    - Los profes y coordinadores NO necesitan permiso de edición (nadie puede
 *      romper ni borrar celdas por accidente).
 *    - El único que escribe en la planilla es este script (con tu cuenta de UGI)
 *      cada vez que un profe toca "Guardar Asistencia" en la web.
 *    - Cada Coordinador recibe únicamente el link del Google Sheet de SU deporte,
 *      por lo que es imposible que vea las planillas de otros deportes.
 *
 * PASOS PARA ACTIVARLO (1 sola vez, toma 1 minuto):
 * 1. Entrá a https://script.google.com y tocá "Nuevo proyecto".
 * 2. Borrá lo que haya y pegá todo este código.
 * 3. Arriba tocá "Implementar" -> "Nueva implementación".
 * 4. En "Seleccionar tipo" elegí "Aplicación web":
 *    - Ejecutar como: "Yo" (tu cuenta de Google UGI)
 *    - Quién tiene acceso: "Cualquier persona"
 * 5. Tocá "Implementar", autorizá los permisos de Google Drive/Sheets y copiá
 *    la URL que termina en /exec.
 * 6. Pegá esa URL /exec en el Panel Maestro UGI de la app (o en GOOGLE_SCRIPT_URL).
 * ============================================================================
 */

const NOMBRE_CARPETA_DRIVE = 'UGI - Asistencias en Vivo';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);

  try {
    const payload = JSON.parse(e.postData.contents);
    const deporte = payload.deporte;
    if (!deporte) {
      return respuestaJSON({ ok: false, error: 'Falta el nombre del deporte' });
    }

    const ss = obtenerOCrearSheetDeporte(deporte);

    // 1. Actualizar pestaña "Seguimiento Vivo" (Matriz Alumno x Fecha)
    if (Array.isArray(payload.matrizGeneral)) {
      escribirTablaEnHoja(ss, 'Seguimiento Vivo', payload.matrizGeneral);
    }

    // 2. Actualizar pestaña "Resumen Grupos"
    if (Array.isArray(payload.resumenGrupos)) {
      escribirTablaEnHoja(ss, 'Resumen Grupos', payload.resumenGrupos);
    }

    // 3. Actualizar pestaña "Detalle Diario"
    if (Array.isArray(payload.detalleDiario)) {
      escribirTablaEnHoja(ss, 'Detalle Diario', payload.detalleDiario);
    }

    // 4. Actualizar una pestaña por cada Categoría / Grupo del deporte
    if (Array.isArray(payload.hojasPorGrupo)) {
      payload.hojasPorGrupo.forEach(function (g) {
        if (g && g.nombreHoja && Array.isArray(g.filas)) {
          escribirTablaEnHoja(ss, g.nombreHoja, g.filas);
        }
      });
    }

    // Eliminar "Hoja 1" / "Sheet1" vacía por defecto si quedaron nuestras hojas
    limpiarHojaPorDefecto(ss);

    return respuestaJSON({
      ok: true,
      deporte: deporte,
      sheetUrl: ss.getUrl(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return respuestaJSON({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function obtenerOCrearCarpeta() {
  const iter = DriveApp.getFoldersByName(NOMBRE_CARPETA_DRIVE);
  if (iter.hasNext()) {
    return iter.next();
  }
  return DriveApp.createFolder(NOMBRE_CARPETA_DRIVE);
}

function obtenerOCrearSheetDeporte(deporte) {
  const props = PropertiesService.getScriptProperties();
  const propKey = 'SHEET_ID_' + deporte;
  const idGuardado = props.getProperty(propKey);

  if (idGuardado) {
    try {
      return SpreadsheetApp.openById(idGuardado);
    } catch (e) {
      // Si fue borrado de Drive, lo volvemos a crear abajo
    }
  }

  const carpeta = obtenerOCrearCarpeta();
  const nombreArchivo = 'Asistencia UGI - ' + deporte;

  // Buscar si ya existe en la carpeta
  const archivos = carpeta.getFilesByName(nombreArchivo);
  if (archivos.hasNext()) {
    const archivoExistente = archivos.next();
    props.setProperty(propKey, archivoExistente.getId());
    return SpreadsheetApp.openById(archivoExistente.getId());
  }

  // Crear nuevo Google Sheet exclusivo para este Deporte
  const nuevoSS = SpreadsheetApp.create(nombreArchivo);
  const archivo = DriveApp.getFileById(nuevoSS.getId());
  archivo.moveTo(carpeta);

  // Permiso: Cualquiera con el link de este deporte puede VER (Solo Lectura)
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  props.setProperty(propKey, nuevoSS.getId());
  return nuevoSS;
}

function escribirTablaEnHoja(ss, nombreHoja, filasObjetos) {
  let sheet = ss.getSheetByName(nombreHoja);
  if (!sheet) {
    sheet = ss.insertSheet(nombreHoja);
  }
  sheet.clearContents();

  if (!filasObjetos || filasObjetos.length === 0) {
    sheet.getRange(1, 1).setValue('Sin datos registrados aún');
    return;
  }

  const encabezados = Object.keys(filasObjetos[0]);
  const matriz = [encabezados];

  filasObjetos.forEach(function (obj) {
    const fila = encabezados.map(function (col) {
      return obj[col] !== undefined && obj[col] !== null ? obj[col] : '';
    });
    matriz.push(fila);
  });

  sheet.getRange(1, 1, matriz.length, encabezados.length).setValues(matriz);

  // Formato prolijo para el encabezado
  const rangoHeader = sheet.getRange(1, 1, 1, encabezados.length);
  rangoHeader.setFontWeight('bold');
  rangoHeader.setBackground('#1e293b');
  rangoHeader.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function limpiarHojaPorDefecto(ss) {
  const hojas = ss.getSheets();
  if (hojas.length <= 1) return;
  ['Hoja 1', 'Sheet1'].forEach(function (nombre) {
    const h = ss.getSheetByName(nombre);
    if (h && ss.getSheets().length > 1) {
      ss.deleteSheet(h);
    }
  });
}

function respuestaJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
