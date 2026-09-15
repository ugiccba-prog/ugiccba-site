/* ==========================================================================
   UGI CCBA — Apps Script del Gimnasio Mental
   --------------------------------------------------------------------------
   Un solo script para todos los juegos:
     · doPost  → guarda cada resultado en la hoja "Resultados"
     · doGet   → devuelve el top 10 para la tabla de posiciones del sitio

   CÓMO INSTALARLO (10 minutos, una sola vez)
   1. Abrí la planilla de Google donde querés los resultados (o creá una nueva).
   2. Extensiones → Apps Script. Borrá lo que haya y pegá TODO este archivo.
   3. Guardá (💾).
   4. Implementar → Nueva implementación → Tipo: Aplicación web.
        · Ejecutar como:    Yo
        · Quién tiene acceso: CUALQUIER PERSONA   ← imprescindible
      Implementar → autorizá con tu cuenta cuando lo pida.
   5. Copiá la URL que termina en /exec y pegala en apps/training/ugi-envio.js,
      en DATABASE_URL. Es el único lugar del sitio donde va esa URL.

   IMPORTANTE: cada vez que edites este script hay que hacer
   Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva.
   Si creás una implementación NUEVA en vez de actualizar la existente, la URL
   cambia y hay que volver a pegarla en ugi-envio.js.
   ========================================================================== */

var HOJA = 'Resultados';

/* Las columnas de la hoja. Si agregás un juego con campos nuevos, sumalos acá
   y al final de la fila: no rompe nada de lo que ya estaba guardado. */
var COLUMNAS = [
  'fecha', 'jugador', 'deporte', 'juego', 'version', 'dispositivo', 'id_sesion',
  'aciertos', 'errores', 'omisiones', 'ignorados', 'total', 'precision',
  'puntos', 'reaccion',
  'rt_congruente_ms', 'rt_incongruente_ms', 'efecto_stroop_ms'
];

/* Para entrar al ranking del Stroop hay que haber respondido bien al menos
   este porcentaje: si no, el más rápido siempre sería el que apretó cualquier
   cosa sin mirar. */
var PRECISION_MINIMA = 80;

/* ---------------------------- GUARDAR ---------------------------- */
function doPost(e) {
  try {
    var datos = JSON.parse(e.postData.contents);
    var hoja = obtenerHoja();

    var fila = COLUMNAS.map(function (col) {
      if (col === 'fecha') return new Date();
      return datos[col] !== undefined && datos[col] !== null ? datos[col] : '';
    });
    hoja.appendRow(fila);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ---------------------------- TOP 10 ---------------------------- */
function doGet(e) {
  var params = (e && e.parameter) || {};
  try {
    var juego = (params.juego || 'STROOP').toUpperCase();
    var salida = { ok: true, juego: juego, top: topDiez(juego) };
    return json(salida, params.callback);
  } catch (err) {
    return json({ ok: false, error: String(err) }, params.callback);
  }
}

function topDiez(juego) {
  var hoja = obtenerHoja();
  if (hoja.getLastRow() < 2) return [];

  var valores = hoja.getDataRange().getValues();
  var cabecera = valores.shift();
  var idx = {};
  cabecera.forEach(function (nombre, i) { idx[nombre] = i; });

  var esReaccion = juego.indexOf('REACCION') === 0;
  var mejores = {};   // una sola fila por jugador: su mejor marca

  valores.forEach(function (fila) {
    var juegoFila = String(fila[idx.juego] || '').toUpperCase();
    if (esReaccion ? juegoFila.indexOf('REACCION') !== 0 : juegoFila !== juego) return;

    var jugador = String(fila[idx.jugador] || '').trim();
    if (!jugador) return;

    var marca;
    if (esReaccion) {
      marca = {
        jugador: jugador,
        deporte: fila[idx.deporte] || '',
        puntos: numero(fila[idx.puntos]),
        reaccion: numero(fila[idx.reaccion]),
        fecha: fila[idx.fecha]
      };
      if (marca.puntos === null) return;
    } else {
      var precision = numero(fila[idx.precision]);
      var efecto = numero(fila[idx.efecto_stroop_ms]);
      if (efecto === null || precision === null || precision < PRECISION_MINIMA) return;
      marca = {
        jugador: jugador,
        deporte: fila[idx.deporte] || '',
        efecto: efecto,
        precision: precision,
        fecha: fila[idx.fecha]
      };
    }

    var clave = jugador.toLowerCase();
    var previo = mejores[clave];
    if (!previo) { mejores[clave] = marca; return; }
    var gana = esReaccion ? (marca.puntos > previo.puntos) : (marca.efecto < previo.efecto);
    if (gana) mejores[clave] = marca;
  });

  var lista = Object.keys(mejores).map(function (k) { return mejores[k]; });
  lista.sort(function (a, b) {
    return esReaccion ? b.puntos - a.puntos : a.efecto - b.efecto;
  });

  /* El nombre completo NUNCA sale de acá: el sitio es público y los que juegan
     son chicos del club. Afuera va "Juan M.". */
  return lista.slice(0, 10).map(function (m, i) {
    var salida = { puesto: i + 1, jugador: acortarNombre(m.jugador), deporte: m.deporte };
    if (esReaccion) { salida.puntos = m.puntos; salida.reaccion = m.reaccion; }
    else { salida.efecto = m.efecto; salida.precision = m.precision; }
    return salida;
  });
}

/* ---------------------------- AUXILIARES ---------------------------- */
function obtenerHoja() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = libro.getSheetByName(HOJA);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA);
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
  }
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function acortarNombre(nombre) {
  var partes = String(nombre).trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return partes[0] + ' ' + partes[1].charAt(0).toUpperCase() + '.';
}

function numero(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

/* JSONP cuando viene ?callback=algo: le evita al sitio los problemas de CORS
   con las redirecciones de Apps Script. Sin callback, JSON normal. */
function json(obj, callback) {
  var texto = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + texto + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
}
