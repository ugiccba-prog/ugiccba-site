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

    /* Escribimos siguiendo los encabezados que YA tiene la hoja, no un orden fijo.
       Si la hoja venia de otro script con otras columnas, escribir por posicion
       metia cada dato en la columna equivocada: la fila entraba, pero despues el
       ranking no la encontraba porque buscaba por nombre de columna. */
    var cabecera = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    var fila = cabecera.map(function (col) {
      var clave = String(col).trim();
      if (clave === 'fecha') return new Date();
      return datos[clave] !== undefined && datos[clave] !== null ? datos[clave] : '';
    });
    hoja.appendRow(fila);

    return json({ ok: true, id_sesion: datos.id_sesion || '' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ---------------------------- TOP 10 ---------------------------- */
function doGet(e) {
  var params = (e && e.parameter) || {};
  try {
    var accion = params.accion || 'top';

    /* El sitio pregunta "¿esto llego?" cuando no pudo leer la respuesta del envio.
       Sin esto, un resultado bien guardado se reintentaba y quedaba duplicado. */
    if (accion === 'existe') {
      return json({ ok: true, existe: existeSesion(params.id || '') }, params.callback);
    }

    /* Diagnostico: que columnas tiene la hoja y como entraron las ultimas filas.
       Los nombres salen acortados, igual que en el ranking. */
    if (accion === 'diagnostico') {
      return json(diagnostico(), params.callback);
    }

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

function existeSesion(id) {
  if (!id) return false;
  var hoja = obtenerHoja();
  if (hoja.getLastRow() < 2) return false;
  var valores = hoja.getDataRange().getValues();
  var cabecera = valores.shift();
  var col = cabecera.indexOf('id_sesion');
  if (col === -1) return false;
  for (var i = valores.length - 1; i >= 0; i--) {
    if (String(valores[i][col]) === String(id)) return true;
  }
  return false;
}

function diagnostico() {
  var hoja = obtenerHoja();
  var cabecera = hoja.getRange(1, 1, 1, Math.max(1, hoja.getLastColumn())).getValues()[0];
  var faltan = COLUMNAS.filter(function (c) { return cabecera.indexOf(c) === -1; });
  var filas = [];
  if (hoja.getLastRow() > 1) {
    var desde = Math.max(2, hoja.getLastRow() - 2);
    var datos = hoja.getRange(desde, 1, hoja.getLastRow() - desde + 1, cabecera.length).getValues();
    datos.forEach(function (f) {
      var o = {};
      cabecera.forEach(function (c, i) {
        var v = f[i];
        if (c === 'jugador' || c === 'nombre') v = acortarNombre(v);
        if (v instanceof Date) v = v.toISOString();
        o[c || ('col' + i)] = v;
      });
      filas.push(o);
    });
  }
  return {
    ok: true,
    hoja: HOJA,
    filas_totales: Math.max(0, hoja.getLastRow() - 1),
    columnas: cabecera,
    columnas_que_faltan: faltan,
    ultimas_filas: filas,
    precision_minima_stroop: PRECISION_MINIMA
  };
}

/* ==========================================================================
   REPARACIÓN DE UNA SOLA VEZ
   --------------------------------------------------------------------------
   Una versión anterior de este script escribía las filas en un orden fijo de
   columnas. Si la hoja ya tenía los encabezados en otro orden, cada dato entró
   en la columna equivocada: el resultado quedaba guardado pero el ranking no lo
   encontraba (leía "precision" donde en realidad estaba "omisiones").

   Cómo usarla: en el editor de Apps Script, elegí "repararFilasCorridas" en el
   selector de funciones de arriba y tocá Ejecutar. Avisa cuántas arregló.
   Es segura de correr dos veces: las filas ya derechas no las toca.
   ========================================================================== */

var ORDEN_VIEJO = [
  'fecha', 'jugador', 'deporte', 'juego', 'version', 'dispositivo', 'id_sesion',
  'aciertos', 'errores', 'omisiones', 'ignorados', 'total', 'precision',
  'puntos', 'reaccion', 'rt_congruente_ms', 'rt_incongruente_ms', 'efecto_stroop_ms'
];

function repararFilasCorridas() {
  var hoja = obtenerHoja();
  if (hoja.getLastRow() < 2) return 'No hay filas para revisar.';

  var ancho = hoja.getLastColumn();
  var cabecera = hoja.getRange(1, 1, 1, ancho).getValues()[0].map(function (c) { return String(c).trim(); });
  var colAciertos = cabecera.indexOf('aciertos');
  var colErrores = cabecera.indexOf('errores');
  if (colAciertos === -1) return 'La hoja no tiene columna "aciertos"; revisá los encabezados.';

  var filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, ancho).getValues();
  var arregladas = 0;

  filas.forEach(function (fila, i) {
    /* Firma de una fila corrida: en "aciertos" hay un texto que no es número
       (cayó ahí el dispositivo: "movil" o "escritorio"). Una fila sana tiene
       un número. Con esto no tocamos las filas que están bien. */
    var v = fila[colAciertos];
    var corrida = (typeof v === 'string' && v !== '' && isNaN(Number(v)));
    if (colErrores !== -1) {
      var e = fila[colErrores];
      corrida = corrida && (typeof e === 'string' && e !== '' && isNaN(Number(e)));
    }
    if (!corrida) return;

    // Lo que hay en la posición N es, en realidad, el campo N del orden viejo
    var valores = {};
    ORDEN_VIEJO.forEach(function (campo, pos) {
      if (pos < ancho) valores[campo] = fila[pos];
    });

    var nueva = cabecera.map(function (col) {
      return valores[col] !== undefined ? valores[col] : '';
    });
    hoja.getRange(2 + i, 1, 1, ancho).setValues([nueva]);
    arregladas++;
  });

  var msg = arregladas
    ? 'Listo: ' + arregladas + ' fila(s) reacomodada(s) a su columna correcta.'
    : 'No encontré filas corridas: está todo derecho.';
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'UGI', 8); } catch (e) {}
  return msg;
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
  } else {
    /* La hoja ya existia (posiblemente de un script anterior): le agregamos al
       final las columnas que le falten, sin tocar las que ya tenia ni sus datos. */
    var cabecera = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    var faltan = COLUMNAS.filter(function (c) { return cabecera.indexOf(c) === -1; });
    if (faltan.length) {
      hoja.getRange(1, cabecera.length + 1, 1, faltan.length).setValues([faltan]);
      hoja.setFrozenRows(1);
    }
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
