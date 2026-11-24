/* ==========================================================================
   UGI CCBA — Módulo compartido de envío de resultados
   Archivo: apps/training/ugi-envio.js
   --------------------------------------------------------------------------
   Un solo lugar para la URL del Apps Script. Lo usan index.html, mobile.html
   y stroop.html. Si cambia la URL, la cambiás acá y nada más.
 
   Incluye cola offline: si no hay internet (o el Sheet falla), el resultado
   queda guardado en el celular y se reintenta solo la próxima vez que el
   jugador abra cualquier juego. Antes, ese resultado se perdía para siempre.
   ========================================================================== */
 
window.UGI = (function () {
  'use strict';
 
  /* ⬇️ URL del Apps Script, la que termina en /exec.
     El codigo del script esta en apps-script/Codigo.gs, con los pasos para
     implementarlo. Mientras esto este vacio, los resultados quedan guardados
     en el dispositivo y se mandan solos cuando la URL este puesta. */
  const DATABASE_URL = 'https://script.google.com/macros/s/AKfycbzzz9bgYenOAydgE78qgL6ChB7L7cpQq8_REOPXZrpGcN3t74XKPnCXy5tTUKQWiXky/exec';
 
  const COLA_KEY = 'ugi_cola_envios_v1';
  const PERFIL_KEY = 'ugi_perfil_v1';
 
  /* ---------- localStorage a prueba de balas ---------- */
  function leerLocal(clave, porDefecto) {
    try {
      const v = localStorage.getItem(clave);
      return v ? JSON.parse(v) : porDefecto;
    } catch (e) { return porDefecto; }
  }
 
  function escribirLocal(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; }
    catch (e) { return false; }
  }
 
  /* ---------- Perfil del jugador (para no retipear el nombre) ---------- */
  function getPerfil() {
    const perfil = leerLocal(PERFIL_KEY, null);
    return perfil && typeof perfil === 'object' ? { nombre: String(perfil.nombre || ''), deporte: String(perfil.deporte || '') } : { nombre: '', deporte: '' };
  }
  function setPerfil(nombre, deporte) {
    escribirLocal(PERFIL_KEY, { nombre: nombre, deporte: deporte });
  }
 
  /* ---------- Normalización de nombres ----------
     Sin esto, el mismo pibe entra como "juan", "Juan M", "JUAN" y en el Sheet
     aparecen tres jugadores distintos. Con esto, siempre "Juan M".            */
  function normalizarNombre(txt) {
    return String(txt || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/(^|[\s'-])([a-záéíóúñü])/g, (m, sep, letra) => sep + letra.toUpperCase());
  }
 
  /* Guardar antes de iniciar la red. El servidor confirma cada id_sesion
     y evita insertar de nuevo la misma sesión durante los reintentos. */
  /* urlOverride: un juego puede mandar a su propia planilla pasando su URL.
     Si no se pasa nada, va a DATABASE_URL. La cola offline recuerda a que
     destino iba cada resultado, asi un reintento no lo manda a la planilla
     equivocada. */
  function enviarResultado(payload, urlOverride) {
    const datos = Object.assign({
      enviado_en: new Date().toISOString(),
      dispositivo: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'movil' : 'escritorio',
      id_sesion: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)
    }, payload);
    datos._url = urlOverride || datos._url || DATABASE_URL;
    const guardado = encolar(datos);
    return transmitir(datos).then((r) => {
      if (r.ok) quitarPendiente(datos.id_sesion);
      return Object.assign(r, { guardado: r.ok || guardado });
    });
  }

  function transmitir(datos) {
    const destino = datos._url || DATABASE_URL;
    if (!/^https?:\/\//.test(destino)) return Promise.resolve({ ok: false, motivo: 'sin_url' });
    const cuerpo = Object.assign({}, datos);
    delete cuerpo._url;
    const controlador = new AbortController();
    const reloj = setTimeout(() => controlador.abort(), 12000);
    return fetch(destino, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo), redirect: 'follow', signal: controlador.signal
    }).then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then((r) => {
      if (!r || r.ok !== true) throw new Error('Respuesta inesperada');
      return { ok: true };
    }).catch(() => existeEnPlanilla(destino, datos.id_sesion).then((existe) => ({ ok: existe })))
      .finally(() => clearTimeout(reloj));
  }

  /* ---------- ¿Llegó de verdad? ----------
     Consulta por JSONP (una etiqueta <script>), que no depende de CORS. */
  function existeEnPlanilla(destino, id) {
    return new Promise((resolver) => {
      if (!id || !destino) return resolver(false);
      const cb = '__ugiExiste' + Math.random().toString(36).slice(2, 9);
      const script = document.createElement('script');
      const reloj = setTimeout(() => { limpiar(); resolver(false); }, 7000);

      function limpiar() {
        clearTimeout(reloj);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = (r) => { limpiar(); resolver(!!(r && r.existe)); };
      script.onerror = () => { limpiar(); resolver(false); };
      script.src = destino + '?accion=existe&id=' + encodeURIComponent(id) + '&callback=' + cb;
      document.head.appendChild(script);
    });
  }

  /* ---------- Cola offline ---------- */
  function leerCola() {
    const valor = leerLocal(COLA_KEY, []);
    return Array.isArray(valor) ? valor : [];
  }
  function encolar(datos) {
    const cola = leerCola();
    if (cola.some((item) => item.id_sesion && item.id_sesion === datos.id_sesion)) return true;
    // Nunca descartar resultados anteriores para hacer lugar a uno nuevo.
    cola.push(datos);
    return escribirLocal(COLA_KEY, cola);
  }
  function quitarPendiente(id) {
    escribirLocal(COLA_KEY, leerCola().filter((item) => item.id_sesion !== id));
  }
  function pendientes() { return leerCola().length; }
  let reintento = null;
  function reintentarCola() {
    if (reintento) return reintento;
    if (!navigator.onLine) return Promise.resolve(0);
    const cola = leerCola();
    let enviados = 0;
    reintento = cola.reduce((p, item) => p.then(async () => {
      // Asignar una identidad durable a resultados de versiones anteriores.
      if (!item.id_sesion) {
        const original = JSON.stringify(item);
        item.id_sesion = Date.now().toString(36) + Math.random().toString(36).slice(2);
        const actual = leerCola();
        const indice = actual.findIndex((v) => JSON.stringify(v) === original);
        if (indice >= 0) actual[indice] = item;
        else return;
        if (!escribirLocal(COLA_KEY, actual)) return;
      }
      const existe = await existeEnPlanilla(item._url || DATABASE_URL, item.id_sesion);
      const r = existe ? { ok: true } : await transmitir(item);
      if (r.ok) { quitarPendiente(item.id_sesion); enviados++; }
    }), Promise.resolve()).then(() => enviados).finally(() => { reintento = null; });
    return reintento;
  }

  /* ---------- Utilidades de medición ---------- */
  function mediana(arr) {
    if (!arr || !arr.length) return null;
    const a = arr.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
 
  function estadoEnvio(r) {
    if (r.ok) return '✓ Resultado guardado en la planilla';
    if (!r.guardado) return 'No se pudo guardar el resultado. Mantené esta pantalla abierta y comprobá la conexión y el almacenamiento del navegador.';
    return 'Resultado pendiente de confirmación, guardado en este dispositivo. Se reintentará al reconectar o abrir otro juego (' + pendientes() + ' pendientes).';
  }

  // Al arrancar cualquier juego, intenta mandar lo que quedó pendiente.
  window.addEventListener('load', () => { reintentarCola(); });
  window.addEventListener('online', () => { reintentarCola(); });
 
  return {
    DATABASE_URL,
    estadoEnvio,
    enviarResultado,
    reintentarCola,
    pendientes,
    getPerfil,
    setPerfil,
    normalizarNombre,
    mediana
  };
})();
 