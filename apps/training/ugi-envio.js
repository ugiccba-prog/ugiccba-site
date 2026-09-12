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
 
  // ⬇️ PEGÁ ACÁ LA URL DE TU APPS SCRIPT (la que termina en /exec)
  const DATABASE_URL = 'https://script.google.com/macros/s/AKfycbyfvPeuupcXI5K2HYMBMiuQgr-xzNWH-lqvG25gVNAbpSA6_3gm-sSQ7BpWXkvyGOUw/exec';
 
  const COLA_KEY = 'ugi_cola_envios_v1';
  const PERFIL_KEY = 'ugi_perfil_v1';
  const MAX_COLA = 50;
 
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
  function getPerfil() { return leerLocal(PERFIL_KEY, { nombre: '', deporte: '' }); }
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
 
  /* ---------- El envío ----------
     IMPORTANTE — acá estaba el bug que hacía que no llegara nada:
 
     ❌ mode: 'no-cors' + headers: {'Content-Type': 'application/json'}
        · 'application/json' NO es un header permitido en modo no-cors: el
          navegador lo descarta, o dispara un preflight OPTIONS que Apps Script
          no sabe responder.
        · Y peor: con no-cors la respuesta es "opaca", así que el .then()
          se ejecuta igual aunque el servidor haya devuelto un error 500.
          Por eso en la consola veías "Datos enviados correctamente" mientras
          el Sheet seguía vacío. Estabas volando a ciegas.
 
     ✅ Content-Type 'text/plain' → es un "simple request", no hay preflight,
        Apps Script lo acepta y podés LEER la respuesta y saber de verdad si
        entró o no.                                                            */
  function enviarResultado(payload) {
    const datos = Object.assign({
      enviado_en: new Date().toISOString(),
      dispositivo: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'movil' : 'escritorio',
      id_sesion: Math.random().toString(36).slice(2, 10)
    }, payload);
 
    if (!DATABASE_URL || DATABASE_URL.indexOf('http') !== 0) {
      console.warn('[UGI] Falta configurar DATABASE_URL en ugi-envio.js');
      encolar(datos);
      return Promise.resolve({ ok: false, motivo: 'sin_url' });
    }
 
    return fetch(DATABASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(datos),
      redirect: 'follow'
    })
      .then((r) => r.text())
      .then((txt) => {
        if (txt && txt.indexOf('"ok":true') !== -1) return { ok: true };
        throw new Error('Respuesta inesperada: ' + String(txt).slice(0, 120));
      })
      .catch((err) => {
        console.warn('[UGI] No se pudo enviar, queda en cola:', err.message);
        encolar(datos);
        return { ok: false, motivo: err.message };
      });
  }
 
  /* ---------- Cola offline ---------- */
  function encolar(datos) {
    const cola = leerLocal(COLA_KEY, []);
    cola.push(datos);
    escribirLocal(COLA_KEY, cola.slice(-MAX_COLA));
  }
 
  function pendientes() { return leerLocal(COLA_KEY, []).length; }
 
  function reintentarCola() {
    const cola = leerLocal(COLA_KEY, []);
    if (!cola.length || !navigator.onLine) return Promise.resolve(0);
    escribirLocal(COLA_KEY, []);            // la vacío ya; lo que falle se re-encola solo
    let enviados = 0;
    return cola.reduce(
      (p, item) => p.then(() => enviarResultado(item).then((r) => { if (r.ok) enviados++; })),
      Promise.resolve()
    ).then(() => enviados);
  }
 
  /* ---------- Utilidades de medición ---------- */
  function mediana(arr) {
    if (!arr || !arr.length) return null;
    const a = arr.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
 
  // Al arrancar cualquier juego, intenta mandar lo que quedó pendiente.
  window.addEventListener('load', () => { reintentarCola(); });
  window.addEventListener('online', () => { reintentarCola(); });
 
  return {
    DATABASE_URL,
    enviarResultado,
    reintentarCola,
    pendientes,
    getPerfil,
    setPerfil,
    normalizarNombre,
    mediana
  };
})();
 