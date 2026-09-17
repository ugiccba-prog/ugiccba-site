/* ==========================================================================
   UGI CCBA — Tabla de posiciones del Gimnasio Mental
   --------------------------------------------------------------------------
   Lee el top 10 que devuelve el Apps Script (apps-script/Codigo.gs) y lo pinta.
   La URL sale de ugi-envio.js: es el unico lugar del sitio donde vive.

   Usa JSONP (una etiqueta <script>) y no fetch: Apps Script responde con una
   redireccion a googleusercontent.com que en muchos navegadores se come la
   cabecera de CORS, asi el ranking no depende de eso.

   Los nombres llegan ya acortados desde el script ("Juan M."): el nombre
   completo de un menor no viaja al sitio publico.
   ========================================================================== */

(function () {
  'use strict';

  var TIEMPO_LIMITE = 8000;

  function urlBase() {
    var u = (window.UGI && UGI.DATABASE_URL) || '';
    return u.indexOf('http') === 0 ? u : '';
  }

  function pedirTop(juego) {
    return new Promise(function (resolver, rechazar) {
      var base = urlBase();
      if (!base) return rechazar(new Error('sin_url'));

      var nombreCb = '__ugiTop' + Math.random().toString(36).slice(2, 9);
      var script = document.createElement('script');
      var reloj = setTimeout(function () { limpiar(); rechazar(new Error('timeout')); }, TIEMPO_LIMITE);

      function limpiar() {
        clearTimeout(reloj);
        try { delete window[nombreCb]; } catch (e) { window[nombreCb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[nombreCb] = function (datos) { limpiar(); resolver(datos); };
      script.onerror = function () { limpiar(); rechazar(new Error('sin_respuesta')); };
      script.src = base + '?juego=' + encodeURIComponent(juego) + '&callback=' + nombreCb;
      document.body.appendChild(script);
    });
  }

  function aviso(texto) {
    return '<p class="rank-aviso">' + texto + '</p>';
  }

  function tabla(juego, top) {
    var esReaccion = juego.indexOf('REACCION') === 0;
    var esVision = juego.indexOf('VISION') === 0;
    var encabezado = esVision
      ? '<th>Umbral</th><th class="oculta-chico">Centro</th>'
      : esReaccion
      ? '<th>Puntos</th><th class="oculta-chico">Reacción</th>'
      : '<th>Efecto Stroop</th><th class="oculta-chico">Precisión</th>';

    var filas = top.map(function (f) {
      var celdas = esVision
        ? '<td class="dato">' + f.umbral + ' ms</td><td class="dato oculta-chico">' + (f.centro != null ? f.centro + '%' : '–') + '</td>'
        : esReaccion
        ? '<td class="dato">' + f.puntos + '</td><td class="dato oculta-chico">' + (f.reaccion ? f.reaccion + ' s' : '–') + '</td>'
        : '<td class="dato">' + (f.efecto > 0 ? '+' : '') + f.efecto + ' ms</td><td class="dato oculta-chico">' + f.precision + '%</td>';
      return '<tr class="' + (f.puesto <= 3 ? 'podio' : '') + '">' +
               '<td class="puesto">' + f.puesto + '</td>' +
               '<td>' + escapar(f.jugador) + '<span class="deporte">' + escapar(f.deporte || '') + '</span></td>' +
               celdas +
             '</tr>';
    }).join('');

    var nota = esVision
      ? 'Ordenado por el menor tiempo de exposición necesario. Solo entran los que mantuvieron la mirada en el centro (70% o más de aciertos en la figura central).'
      : esReaccion ? ''
      : 'Ordenado por el menor costo de inhibición, entre quienes respondieron bien al menos el 80%.';

    return '<table class="rank-tabla"><thead><tr><th></th><th>Jugador</th>' + encabezado +
           '</tr></thead><tbody>' + filas + '</tbody></table>' + (nota ? aviso(nota) : '');
  }

  function escapar(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function pintar(juego) {
    var caja = document.getElementById('rank-cuerpo');
    if (!caja) return;
    caja.innerHTML = aviso('Cargando…');

    pedirTop(juego).then(function (datos) {
      if (!datos || datos.ok === false) return caja.innerHTML = aviso('No se pudo leer la tabla.');
      if (!datos.top || !datos.top.length) {
        return caja.innerHTML = aviso('Todavía no hay resultados cargados para este módulo. El primero que lo juegue abre la tabla.');
      }
      caja.innerHTML = tabla(juego, datos.top);
    }).catch(function (err) {
      caja.innerHTML = aviso(err.message === 'sin_url'
        ? 'La tabla todavía no está conectada a la planilla.'
        : 'No se pudo cargar la tabla en este momento. Probá recargar la página.');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var botones = document.querySelectorAll('.rank-tab');
    if (!botones.length) return;

    Array.prototype.forEach.call(botones, function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(botones, function (o) { o.classList.remove('activo'); });
        b.classList.add('activo');
        pintar(b.getAttribute('data-juego'));
      });
    });
    pintar(botones[0].getAttribute('data-juego'));
  });
})();
