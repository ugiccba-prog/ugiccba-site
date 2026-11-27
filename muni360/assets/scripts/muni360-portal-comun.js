// Muni360 · lógica compartida por los portales de Deportes y de Colonia/COYFD.
// Generado al unificar código idéntico entre apps/muni360/source/deportes y colonia.
// Sólo contiene declaraciones (funciones y window.*): se carga antes del script
// propio de cada portal, que define el estado global y las diferencias
// deliberadas (constante PORTAL_MUNI). Editar acá aplica a ambos portales.
function fechaLocal(diasAtras = 0) { return Muni360Time.dateIso(new Date(),diasAtras); }

function normalizarFechaIso(f) {
  const s = String(f || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return Muni360Time.dateIso(s);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s.slice(0, 10);
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2800);
}

function limpiarCachePrivada() {
  Object.keys(sessionStorage).filter(k => k.startsWith('ugi-v2:')).forEach(k => sessionStorage.removeItem(k));
}

function fichaServidor(jugador) {
  const cat = $('sel-categoria').value, eq = $('sel-equipo').value || 'General';
  const p = (datosDeporte.padron || []).find(p => p.jugador === jugador && p.categoria === cat && (p.equipo || 'General') === eq);
  return p ? (datosDeporte.fichas || {})[p.id] || {} : {};
}

function estadoSincronizacion(s) {
  if (!sesion || almacen.getItem('muni360_modo_demo') === '1') return;
  $('estado-txt').textContent = s.count ? `⚠ ${s.count} carga(s) pendiente(s). ${s.message}` : `✓ ${s.message}`;
  $('estado-acciones').innerHTML = s.count ? '<button type="button" class="btn-sec" id="reintentar-sync">Reintentar</button><button type="button" class="btn-sec" id="revisar-sync">Revisar pendiente</button>' : '<button type="button" class="btn-sec" id="actualizar-sync">Actualizar datos confirmados</button>';
  if ($('actualizar-sync')) $('actualizar-sync').onclick=()=>cargarAreaActiva();
  if ($('reintentar-sync')) $('reintentar-sync').onclick = () => syncClient.retry().catch(e=>estadoSincronizacion({count:syncClient.queue.length,message:e.message}));
  if ($('revisar-sync')) $('revisar-sync').onclick = revisarPendiente;
}

async function revisarPendiente() {
  const entry = syncClient?.queue[0]; if (!entry) return;
  const p = entry.payload;
  $('dua-modal-body').innerHTML = `<h3>Carga pendiente</h3><p>${esc(p.tipo)} · ${esc(p.deporte)} · ${esc(p.categoria || '')} · ${esc(p.equipo || '')} · ${esc(p.fecha || '')}</p><p>${esc(entry.error || 'Esperando confirmación')}</p><pre style="white-space:pre-wrap;max-height:240px;overflow:auto">${esc(JSON.stringify({...p, token: undefined}, null, 2))}</pre><p>Revisá los datos actuales antes de reemplazar. Una carga de otra temporada no se reenvía.</p><button type="button" class="btn-sec" id="cerrar-pendiente">Cerrar</button><button type="button" class="btn-sec" id="actualizar-pendiente">Ver datos actuales</button><button type="button" class="btn" id="confirmar-pendiente">Reenviar después de revisar</button><button type="button" class="btn-sec" id="descartar-pendiente">Descartar esta carga</button>`;
  $('dua-modal').classList.remove('hidden');
  $('cerrar-pendiente').onclick = () => $('dua-modal').classList.add('hidden');
  $('actualizar-pendiente').onclick = async () => {
    try { const actual = await syncClient.read(p.deporte); const pre = document.createElement('pre'); pre.style.cssText='white-space:pre-wrap;max-height:240px;overflow:auto'; pre.textContent=JSON.stringify(p.tipo === 'LEGAJO' || p.tipo === 'DUA' ? actual.fichas : p.tipo === 'ASISTENCIA' ? actual.asistencia.filter(r=>r.fecha===p.fecha && r.categoria===p.categoria && r.equipo===p.equipo) : p.tipo === 'EVALUACION' ? actual.evaluaciones.filter(r=>r.fecha===p.fecha && r.categoria===p.categoria && r.equipo===p.equipo && r.jugador===p.jugador) : actual.padron, null, 2); $('dua-modal-body').append(pre); } catch(e) { toast(e.message); }
  };
  $('confirmar-pendiente').onclick = async () => {
    if (!confirm('¿Revisaste los datos actuales y querés reenviar esta carga?')) return;
    try { await syncClient.reviewAndRetry(); $('dua-modal').classList.add('hidden'); if (!syncClient.queue.length) await cargarAreaActiva(); } catch(e) { toast(e.message); }
  };
  $('descartar-pendiente').onclick = async () => {
    if (!confirm('¿Eliminar este pendiente del dispositivo? Si la carga ya llegó a Google, los datos guardados se conservan.')) return;
    await syncClient.discardFirst(); $('dua-modal').classList.add('hidden'); await syncClient.flush(); if (!syncClient.queue.length) await cargarAreaActiva();
  };
}

function esSoloConsulta(){return sesion?.rol==='Consulta';}

function aplicarModoConsulta(){
  const readonly=esSoloConsulta();
  $('modo-consulta-aviso').classList.toggle('hidden',!readonly);
  document.querySelectorAll(selectorEscrituraConsulta).forEach(el=>{
    if(readonly){if(!controlesConsulta.has(el))controlesConsulta.set(el,el.disabled);el.disabled=true;}
    else if(controlesConsulta.has(el)){el.disabled=controlesConsulta.get(el);controlesConsulta.delete(el);}
  });
}

async function enviarOperacion(payload) {
  if(esSoloConsulta()){toast('Tu acceso es de consulta.');return false;}
  if(guardandoOperacion){toast('Hay una carga en curso. Esperá la confirmación.');return false;}
  guardandoOperacion=true;
  const controls=[...document.querySelectorAll('#app-screen button,#app-screen input,#app-screen select,#app-screen textarea')].map(el=>[el,el.disabled]);
  controls.forEach(([el])=>el.disabled=true);
  try{
  if (almacen.getItem('muni360_modo_demo') === '1') {
    if (payload.tipo==='ALTA_PADRON') payload.jugadores.forEach(j=>{const old=datosDeporte.padron.find(p=>p.jugador===j.jugador && p.categoria===payload.categoria && p.equipo===payload.equipo); if(old) {if(Object.prototype.hasOwnProperty.call(j,'dni'))old.dni=j.dni||'';} else datosDeporte.padron.push({id:'demo-'+crypto.randomUUID(),jugador:j.jugador,dni:j.dni||'',categoria:payload.categoria,equipo:payload.equipo});});
    if (payload.tipo==='BAJA_PADRON') datosDeporte.padron=datosDeporte.padron.filter(p=>!(p.jugador===payload.jugador && p.categoria===payload.categoria && p.equipo===payload.equipo));
    if (payload.tipo==='RESET_DATOS') {datosDeporte.asistencia=[];datosDeporte.evaluaciones=[];if(payload.modo==='TODO')datosDeporte.padron=[];}
    if (payload.tipo==='RECONOCIMIENTO') {const m=leerMapaLegajosV2(),k=claveNombreDni(payload.jugador),f=obtenerLegajoUnificado(payload.jugador,obtenerDni(payload.jugador));f.bitacora.unshift({id:'demo-'+Date.now(),fecha:payload.fecha,tipo:'🟢 Tarjeta Verde Digital',detalle:payload.motivo,autor:'Demostración'});m[k]=f;almacen.setItem('muni360_legajos_ugi_v2',JSON.stringify(m));}
    almacen.setItem('muni360_cache_'+areaActiva,JSON.stringify(datosDeporte));
    toast('Cambio de demostración: no se envió a Google'); return true;
  }
  try {
    if (!syncClient) throw new Error('Ingresá con tu cuenta.');
    if (['DUA','LEGAJO','RECONOCIMIENTO'].includes(payload.tipo)) { const p=(datosDeporte.padron||[]).find(p=>p.jugador===payload.jugador && p.categoria===payload.categoria && p.equipo===payload.equipo); if (!p?.id) throw new Error('Actualizá el padrón para obtener la identidad del deportista.'); payload.subjectId=p.id; }
    const ok = await syncClient.enqueue(payload);
    if (!ok) { toast('Carga pendiente: todavía no está confirmada por el servidor.'); return false; }
    toast('✓ Guardado confirmado. El estado de la copia a Sheets aparece arriba.');
    return true;
  } catch(e) { toast(e.message); $('estado-txt').textContent = '⚠ ' + e.message; return false; }
  }finally{guardandoOperacion=false;controls.forEach(([el,disabled])=>el.disabled=disabled);}
}

async function recuperarFichasLocales() {
  if (!esCoordOAdmin() || !syncClient || syncClient.queue.length) return toast('Conectá y enviá los pendientes antes de recuperar fichas.');
  let legacyDua, legacyLeg;
  try { legacyDua = JSON.parse(window.localStorage.getItem('muni360_dua_' + areaActiva) || '{}'); legacyLeg = JSON.parse(window.localStorage.getItem('muni360_legajos_ugi_v2') || '{}'); } catch(_) { return toast('No se pudieron leer las fichas antiguas.'); }
  const candidates = (datosDeporte.padron || []).filter(p => legacyDua[p.jugador] || legacyDua[nombreBaseDua(p.jugador)] || legacyLeg[p.dni] || legacyLeg[claveNombreDni(p.jugador)]);
  if (!candidates.length) return toast('No hay fichas antiguas para este padrón en este dispositivo.');
  if (!confirm(`Hay ${candidates.length} deportistas con fichas locales. Se recuperarán sólo fichas que aún no existan en Google. Revisá que correspondan a personas reales; no recuperes datos de demostración. ¿Continuar?`)) return;
  let count=0;
  for (const p of candidates) {
    const current = (datosDeporte.fichas || {})[p.id] || {};
    const dua = legacyDua[p.jugador] || legacyDua[nombreBaseDua(p.jugador)];
    const legajo = legacyLeg[p.dni] || legacyLeg[claveNombreDni(p.jugador)];
    const base={deporte:areaActiva,categoria:p.categoria,equipo:p.equipo,jugador:p.jugador};
    if (dua && !Object.values(current.dua || {}).some(Boolean)) { if (!await enviarOperacion({...base,tipo:'DUA',ficha:dua})) return; count++; }
    if (legajo && !Object.keys(current.legajo || {}).length) { if (!await enviarOperacion({...base,tipo:'LEGAJO',ficha:{...legajo,bitacora:legajo.bitacora || []}})) return; count++; }
  }
  await cargarAreaActiva(); toast(`${count} ficha(s) recuperadas. Los originales siguen en este dispositivo.`);
}

function esIngresoUnificado(s) {
  return String(s?.email || '').trim().toLowerCase() === EMAIL_INGRESO_UNIFICADO;
}

function permiso(nombre){return !!sesion?.esAdminTotal || sesion?.rol==='Dirección UGI' || !!sesion?.capabilities?.[nombre];}

function cfgActual() {
  return CATALOGO_MUNI360.find(x => x.nombre === areaActiva) || CATALOGO_MUNI360[0];
}

function puedeEditarGestos(){return !!sesion && !esSoloConsulta() && (sesion.esAdminTotal || sesion.rol==='Dirección UGI' || (sesion.rol==='Coordinación' && permiso('administrarPadron')));}

function puedeVerCambios(){return !!sesion && ['Dirección UGI','Coordinación'].includes(sesion.rol);}

function nombreBaseDua(j) {
  return String(j || '').replace(/\s*\(🧩\s*DUA\)\s*/i, '').trim();
}

function claveNombreDni(j) {
  return nombreBaseDua(j).toLowerCase();
}

function leerMapaDua() {
  try {
    const guardado = JSON.parse(almacen.getItem('muni360_dua_' + areaActiva) || '{}');
    return almacen.getItem('muni360_modo_demo') === '1' ? { ...DUA_DEFAULT, ...guardado } : guardado;
  } catch (_) { return {}; }
}

function guardarMapaDua(mapa) {
  almacen.setItem('muni360_dua_' + areaActiva, JSON.stringify(mapa));
}

function obtenerFichaDua(jugador) {
  if (almacen.getItem('muni360_modo_demo') !== '1') { const f=fichaServidor(jugador).dua; return f && Object.values(f).some(Boolean) ? f : null; }
  const mapa=leerMapaDua(); return mapa[jugador] || mapa[nombreBaseDua(jugador)] || null;
}

function leerMapaDni() {
  try {
    const local = JSON.parse(almacen.getItem('muni360_dni_' + areaActiva) || '{}');
    const mapa = { ...local };
    if (almacen.getItem('muni360_modo_demo') === '1') {
      Object.entries(DUA_DNI_DEMO).forEach(([k, v]) => { if (!mapa[k]) mapa[k] = v; });
    }
    (datosDeporte.padron || []).forEach(p => {
      if (p.dni) mapa[claveNombreDni(p.jugador)] = String(p.dni).replace(/\D/g, '');
    });
    return mapa;
  } catch (_) { return {}; }
}

function guardarDniJugador(jugador, dniLimpio) {
  const k = claveNombreDni(jugador);
  const local = JSON.parse(almacen.getItem('muni360_dni_' + areaActiva) || '{}');
  if (dniLimpio) local[k] = dniLimpio;
  else delete local[k];
  almacen.setItem('muni360_dni_' + areaActiva, JSON.stringify(local));

  (datosDeporte.padron || []).forEach(p => {
    if (claveNombreDni(p.jugador) === k) p.dni = dniLimpio;
  });
  almacen.setItem('muni360_cache_' + areaActiva, JSON.stringify(datosDeporte));
}

function obtenerDni(jugador) {
  const mapa = leerMapaDni();
  return mapa[claveNombreDni(jugador)] || '';
}

function extraerNombreYDni(linea) {
  let txt = String(linea || '').trim();
  if (!txt) return null;
  let dni = '';
  const match = txt.match(/^(.*?)(?:[\s,|;:\-\/]+|\()(\d{1,2}\.?\d{3}\.?\d{3}|\d{7,8})\)?$/);
  if (match && match[1].trim()) {
    txt = match[1].trim();
    dni = match[2].replace(/\D/g, '');
  }
  return { jugador: txt, ...(dni?{dni}:{}) };
}

window.verPasaporteDUA = function (jugador) {
  const f = obtenerFichaDua(jugador);
  if (!f) return;
  $('dua-modal-body').innerHTML = `
    <div class="spread" style="margin-bottom:12px;">
      <div>
        <span class="login-pill" style="margin:0;">Pasaporte Funcional DUA</span>
        <h3 style="font-size:1.1rem; color:var(--navy); margin-top:4px;">🧩 ${esc(nombreBaseDua(jugador))}</h3>
      </div>
      <button type="button" class="btn-sec" onclick="$('dua-modal').classList.add('hidden')">✕ Cerrar</button>
    </div>
    <div class="dua-item-box">
      <strong>🗣️ 1. Comunicación y Consignas</strong>
      <div>${esc(f.comunicacion || 'Sin especificar')}</div>
    </div>
    <div class="dua-item-box" style="border-left: 4px solid #f59e0b;">
      <strong>⚡ 2. Qué evitar / Qué lo desborda</strong>
      <div>${esc(f.desborda || 'Sin especificar')}</div>
    </div>
    <div class="dua-item-box" style="border-left: 4px solid #16a34a; background:#f0fdf4;">
      <strong>🟢 3. Qué lo regula en cancha (Acción del Profe)</strong>
      <div>${esc(f.regula || 'Sin especificar')}</div>
    </div>
    <p class="hint" style="margin:6px 0 0; font-size:0.72rem; text-align:center;">
      Apoyos pedagógicos registrados por el equipo autorizado.
    </p>
  `;
  $('dua-modal').classList.remove('hidden');
};

window.editarPasaporteDUA = function (jugador) {
  if (!permiso('editarDua')) return;
  const f = obtenerFichaDua(jugador) || { comunicacion: '', desborda: '', regula: '' };
  $('dua-modal-body').innerHTML = `
    <div class="spread" style="margin-bottom:10px;">
      <h3 style="font-size:1.05rem; color:var(--navy);">🧩 Configurar Apoyos DUA · ${esc(nombreBaseDua(jugador))}</h3>
      <button type="button" class="btn-sec" onclick="$('dua-modal').classList.add('hidden')">✕</button>
    </div>
    <div class="field">
      <label>🗣️ 1. Comunicación y consignas que le sirven</label>
      <input type="text" id="dua-in-com" placeholder="Ej: Consignas cortas, apoyo visual, anticipar cambios..." value="${esc(f.comunicacion)}">
    </div>
    <div class="field">
      <label>⚡ 2. Disparadores sensoriales o qué evitar</label>
      <input type="text" id="dua-in-des" placeholder="Ej: Silbato fuerte, esperas largas en fila, gritos..." value="${esc(f.desborda)}">
    </div>
    <div class="field">
      <label>🟢 3. Herramienta de calma / Qué lo regula en cancha</label>
      <input type="text" id="dua-in-reg" placeholder="Ej: Ser ayudante de materiales, pausa de 2 min en Zona de Calma..." value="${esc(f.regula)}">
    </div>
    <div style="display:flex; gap:8px; margin-top:12px;">
      <button type="button" class="btn ok" id="btn-dua-save">Guardar Pasaporte DUA</button>
      <button type="button" class="quitar" id="btn-dua-del" style="padding:0 14px;">Borrar</button>
    </div>
  `;
  $('dua-modal').classList.remove('hidden');

  async function guardarDua(ficha) {
    if (!esCoordOAdmin()) return;
    if (await enviarOperacion({tipo:'DUA',deporte:areaActiva,categoria:$('sel-categoria').value,equipo:$('sel-equipo').value||'General',jugador,ficha})) {
      if (almacen.getItem('muni360_modo_demo')==='1') {const m=leerMapaDua(); m[jugador]=ficha; guardarMapaDua(m);} else await cargarAreaActiva();
      $('dua-modal').classList.add('hidden'); renderVistaActiva();
    }
  }
  $('btn-dua-save').onclick=()=>guardarDua({comunicacion:$('dua-in-com').value.trim(),desborda:$('dua-in-des').value.trim(),regula:$('dua-in-reg').value.trim()});
  $('btn-dua-del').onclick=()=>{if(confirm('¿Quitar estos apoyos DUA?')) guardarDua({comunicacion:'',desborda:'',regula:''});};
};

function iconoActividadUgi(nombre) {
  const n = String(nombre || '');
  if (n === 'Colonia') return '☀️ Colonia';
  if (n === 'COYFD') return '🏃‍♂️ COYFD';
  if (n === 'Ciudad Integrado') return '🧩 Ciudad Integrado';
  if (n.startsWith('Básquet')) return '🏀 ' + n;
  if (n.startsWith('Fútbol')) return '⚽ ' + n;
  if (n.startsWith('Hockey')) return '🏑 ' + n;
  if (n.startsWith('Rugby')) return '🏉 ' + n;
  if (n.startsWith('Vóley')) return '🏐 ' + n;
  if (n.startsWith('Gimnasia')) return '🤸 ' + n;
  if (n === 'Tenis') return '🎾 Tenis';
  if (n === 'Handball') return '🤾 Handball';
  if (n === 'Cestoball') return '🧺 Cestoball';
  if (n === 'Judo' || n === 'Karate') return '🥋 ' + n;
  if (n.startsWith('Natación')) return '🏊 ' + n;
  if (n.startsWith('Patín')) return '⛸️ ' + n;
  if (n === 'Golf') return '⛳ Golf';
  if (n === 'Pelota Paleta') return '🎾 Pelota Paleta';
  return '🏅 ' + n;
}

function detectarActividadesCruzadas(jugador, dni) {
  const claveNom = claveNombreDni(jugador);
  const dniLimpio = String(dni || '').replace(/\D/g, '');
  const encontradas = new Map();

  CATALOGO_MUNI360.forEach(act => {
    let cache = null;
    if (act.nombre === areaActiva) {
      cache = datosDeporte;
    } else {
      try { cache = JSON.parse(almacen.getItem('muni360_cache_' + act.nombre) || 'null'); } catch (_) {}
    }
    if (!cache || !Array.isArray(cache.padron)) return;
    cache.padron.forEach(p => {
      const pDni = String(p.dni || '').replace(/\D/g, '');
      const coincideDni = Boolean(dniLimpio && pDni && pDni === dniLimpio);
      const coincideNom = claveNombreDni(p.jugador) === claveNom;
      if (coincideDni || coincideNom) {
        encontradas.set(act.nombre, { actividad: act.nombre, categoria: p.categoria || '' });
      }
    });
  });

  if (!encontradas.has(areaActiva)) {
    encontradas.set(areaActiva, { actividad: areaActiva, categoria: $('sel-categoria').value || '' });
  }
  return Array.from(encontradas.values());
}

function leerMapaLegajosV2() {
  try {
    return JSON.parse(almacen.getItem('muni360_legajos_ugi_v2') || '{}');
  } catch (_) { return {}; }
}

function obtenerLegajoUnificado(jugador, dni) {
  const mapa = leerMapaLegajosV2();
  const kNom = claveNombreDni(jugador);
  const kDni = String(dni || obtenerDni(jugador) || '').replace(/\D/g, '');
  const base = almacen.getItem('muni360_modo_demo') === '1' ? ((kDni && mapa[kDni]) || mapa[kNom] || {}) : (fichaServidor(jugador).legajo || {});

  let bitacora = Array.isArray(base.bitacora) ? [...base.bitacora] : [];
  if (!bitacora.length) {
    try {
      const notasViejas = JSON.parse(almacen.getItem('muni360_notas_legajo') || '{}');
      const obsVieja = notasViejas[kDni] || notasViejas[kNom];
      if (obsVieja) {
        bitacora.push({
          id: 'leg_' + Date.now(),
          fecha: fechaLocal(0),
          tipo: '📝 Nota general de Coordinación',
          detalle: obsVieja,
          autor: sesion?.profeNombre || 'Coordinación UGI'
        });
      }
    } catch (_) {}
  }

  return {
    dni: kDni || base.dni || '',
    estadoPlan: base.estadoPlan || '🟢 Seguimiento Estándar',
    actividadesSimultaneas: Array.isArray(base.actividadesSimultaneas) ? [...base.actividadesSimultaneas] : [],
    paseInterno: base.paseInterno || '',
    bitacora
  };
}

async function guardarLegajoUnificado(jugador, dni, ficha) {
  if (almacen.getItem('muni360_modo_demo') !== '1') {
    const ok=await enviarOperacion({tipo:'LEGAJO',deporte:areaActiva,categoria:$('sel-categoria').value,equipo:$('sel-equipo').value||'General',jugador,ficha});
    if (ok) { guardarDniJugador(jugador,dni); const p=datosDeporte.padron.find(p=>p.jugador===jugador && p.categoria===$('sel-categoria').value && p.equipo===($('sel-equipo').value||'General')); datosDeporte.fichas=datosDeporte.fichas||{}; datosDeporte.fichas[p.id]={...(datosDeporte.fichas[p.id]||{}),legajo:ficha}; }
    return ok;
  }
  const mapa = leerMapaLegajosV2();
  const kNom = claveNombreDni(jugador);
  const kDni = String(dni || ficha.dni || '').replace(/\D/g, '');
  const objGuardar = {
    dni: kDni,
    nombre: nombreBaseDua(jugador),
    estadoPlan: ficha.estadoPlan || '🟢 Seguimiento Estándar',
    actividadesSimultaneas: Array.from(new Set(ficha.actividadesSimultaneas || [])),
    paseInterno: String(ficha.paseInterno || '').trim(),
    bitacora: Array.isArray(ficha.bitacora) ? ficha.bitacora : []
  };
  mapa[kNom] = objGuardar;
  if (kDni) mapa[kDni] = objGuardar;
  almacen.setItem('muni360_legajos_ugi_v2', JSON.stringify(mapa));
  return true;
}

function estiloBadgeEventoLegajo(tipo) {
  const t = String(tipo || '');
  if (t.includes('Reunión') || t.includes('Padres')) return 'background:#dbeafe; color:#1e40af;';
  if (t.includes('Queja') || t.includes('reclamo')) return 'background:#fee2e2; color:#991b1b;';
  if (t.includes('conductual') || t.includes('cancha')) return 'background:#fef3c7; color:#92400e;';
  if (t.includes('Cambio de deporte')) return 'background:#e0e7ff; color:#3730a3;';
  if (t.includes('Acuerdo PAI') || t.includes('Seguimiento') || t.includes('Tarjeta Verde')) return 'background:#dcfce7; color:#166534;';
  return 'background:#e2e8f0; color:#334155;';
}

window.abrirLegajoPrivadoUGI = function (jugador) {
  if (!permiso('verLegajo')) return;
  const dniActual = obtenerDni(jugador);
  const cat = $('sel-categoria').value;
  const eq  = $('sel-equipo').value || 'General';

  const regsAsist = (datosDeporte.asistencia || []).filter(a => claveNombreDni(a.jugador) === claveNombreDni(jugador) && /^[PAT]/.test(a.estado));
  const pres = regsAsist.filter(a => String(a.estado).startsWith('P') || String(a.estado).startsWith('T')).length;
  const pctAsist = regsAsist.length ? Math.round((pres / regsAsist.length) * 100) + '%' : 'S/D';
  const amarillas = regsAsist.filter(a => String(a.estado).includes('Sem:A')).length;
  const rojas     = regsAsist.filter(a => String(a.estado).includes('Sem:R')).length;

  const evalsJ = (datosDeporte.evaluaciones || []).filter(e => claveNombreDni(e.jugador) === claveNombreDni(jugador));
  let s = 0, c = 0;
  evalsJ.forEach(e => Object.values(e.notas || {}).forEach(n => { if (Number(n) > 0) { s += Number(n); c++; } }));
  const promsLegajo=Muni360Sync.splitAverage(evalsJ,GESTOS_FORMATIVOS_ESTADISTICA);
  const promGral=promsLegajo.tecnico===null?'S/D':promsLegajo.tecnico.toFixed(1);

  const ficha = obtenerLegajoUnificado(jugador, dniActual);
  let actManuales = new Set(ficha.actividadesSimultaneas);
  let bitacoraTemp = [...ficha.bitacora];

  const ESTADOS_PLAN = [
    "🟢 Seguimiento Estándar",
    "🟡 Plan A Activo (Acompañamiento 90 días)",
    "🟠 Plan B Activo (Participación Condicionada 60 días)",
    "🔴 Evaluación Plan C / Derivación interna",
    "🧩 Ciudad Integrado / Doble pertenencia"
  ];

  const TIPOS_EVENTO = [
    "👨‍👩‍👧 Reunión / Entrevista con Padres (Anexo C)",
    "⚠️ Queja o reclamo familiar",
    "🚦 Situación conductual / Episodio en cancha",
    "🔄 Cambio de deporte / categoría",
    "🤝 Acuerdo PAI / Seguimiento UGI",
    "📝 Nota general de Coordinación"
  ];

  const deportesExtraOpciones = CATALOGO_MUNI360
    .map(d => d.nombre)
    .filter(n => n !== 'Colonia' && n !== 'COYFD' && n !== areaActiva);

  $('dua-modal-body').innerHTML = `
    <div class="spread" style="margin-bottom:10px;">
      <div>
        <span class="login-pill" style="margin:0;">Legajo compartido · Acceso por actividad</span>
        <h3 style="font-size:1.1rem; color:var(--navy); margin-top:4px;">🗂️ ${esc(nombreBaseDua(jugador))}</h3>
      </div>
      <button type="button" class="btn-sec" onclick="$('dua-modal').classList.add('hidden')">✕ Cerrar</button>
    </div>

    <div class="grid2" style="margin-bottom:10px; align-items:end;">
      <div class="field" style="margin:0; background:#f8fafc; padding:8px 10px; border-radius:11px; border:1px solid #cbd5e1;">
        <label for="legajo-input-dni">🪪 DNI (dato privado de coordinación)</label>
        <input type="text" id="legajo-input-dni" ${permiso('verDni')?'':'disabled'} inputmode="numeric" placeholder="Sin puntos (ej: 48123456)" value="${esc(dniActual || ficha.dni)}" style="min-height:38px; font-weight:800;">
      </div>
      <div class="field" style="margin:0; background:#f8fafc; padding:8px 10px; border-radius:11px; border:1px solid #cbd5e1;">
        <label for="legajo-estado-plan">🛡️ Estado Institucional UGI</label>
        <select id="legajo-estado-plan" style="min-height:38px; font-weight:800; font-size:0.82rem;">
          ${ESTADOS_PLAN.map(est => `<option value="${esc(est)}" ${ficha.estadoPlan === est ? 'selected' : ''}>${esc(est)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="legajo-grid">
      <div class="legajo-stat"><b>${pctAsist}</b><span>Asistencia (${regsAsist.length} cl.)</span></div>
      <div class="legajo-stat"><b>${promGral}</b><span>Técnica (formación se informa por separado)</span></div>
      <div class="legajo-stat"><b>🟡 ${amarillas} · 🔴 ${rojas}</b><span>Semáforo Acum.</span></div>
    </div>

    <!-- 1. MAPA DE ACTIVIDADES Y PASES INTERNOS -->
    <div class="legajo-sec">
      <div class="legajo-sec-title">
        <span>🏃‍♂️ Recorrido y Actividades en el Club</span>
        <small style="color:var(--muted); font-weight:700; text-transform:none;">Detección por DNI / Nombre</small>
      </div>
      <div id="legajo-pills-actividades" class="act-pills-wrap"></div>

      <label style="font-size:0.71rem; margin-top:6px;">Marcar otras actividades que practica o practicó en el club:</label>
      <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:8px;" id="legajo-chips-simultaneas">
        <button type="button" class="chip-check" data-act-chip="Colonia">☀️ Colonia</button>
        <button type="button" class="chip-check" data-act-chip="COYFD">🏃‍♂️ COYFD</button>
        <button type="button" class="chip-check" data-act-chip="Ciudad Integrado">🧩 Ciudad Integrado</button>
        <select id="legajo-select-otro-dep" style="width:auto; min-height:30px; padding:3px 8px; font-size:0.74rem; border-radius:999px;">
          <option value="">+ Sumar otro deporte...</option>
          ${deportesExtraOpciones.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}
        </select>
      </div>

      <div class="field" style="margin:0;">
        <label for="legajo-pase-interno" style="font-size:0.71rem;">🔄 Historial de cambio de deporte / pase interno</label>
        <input type="text" id="legajo-pase-interno" placeholder="Ej: Pasó de COYFD a Fútbol en Marzo / Cambió de Rugby a Básquet" value="${esc(ficha.paseInterno)}" style="min-height:36px; font-size:0.82rem;">
      </div>
    </div>

    <!-- 3. BITÁCORA CRONOLÓGICA DE EVENTOS -->
    <div class="legajo-sec" style="background:#fff; border-color:#cbd5e1;">
      <div class="legajo-sec-title">
        <span>📋 Bitácora de Novedades Fechadas (Padres, Acuerdos y Situaciones)</span>
      </div>

      <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px; padding:9px; margin-bottom:8px;">
        <div style="font-size:0.74rem; font-weight:800; color:var(--blue); margin-bottom:6px;">+ Sumar registro al legajo</div>
        <div class="grid2" style="gap:8px; margin-bottom:6px;">
          <div>
            <label for="legajo-ev-fecha" style="font-size:0.68rem;">Fecha</label>
            <input type="date" id="legajo-ev-fecha" value="${fechaLocal(0)}" style="min-height:35px; font-size:0.8rem; padding:4px 8px;">
          </div>
          <div>
            <label for="legajo-ev-tipo" style="font-size:0.68rem;">Tipo de evento</label>
            <select id="legajo-ev-tipo" style="min-height:35px; font-size:0.78rem; padding:4px 8px;">
              ${TIPOS_EVENTO.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
            </select>
          </div>
        </div>
        <textarea id="legajo-ev-detalle" style="min-height:54px; font-size:0.82rem; padding:6px 8px; margin-bottom:6px;" placeholder="Qué pasó, quiénes estuvieron presentes y qué se acordó..."></textarea>
        <button type="button" class="btn-sec" id="btn-agregar-evento-legajo" style="width:100%; justify-content:center; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd; min-height:34px;">
          ➕ Agregar al historial del legajo
        </button>
      </div>

      <div id="legajo-bitacora-lista" class="bitacora-list"></div>
    </div>

    <button type="button" class="btn ok" id="btn-guardar-legajo">Guardar DNI y Legajo Unificado</button>
  `;

  function renderPillsYChips() {
    const dniVal = $('legajo-input-dni').value.replace(/\D/g, '').trim();
    const autoDetectadas = detectarActividadesCruzadas(jugador, dniVal);
    const nombresAuto = new Set(autoDetectadas.map(x => x.actividad));

    const pillsAutoHtml = autoDetectadas.map(x =>
      `<span class="act-pill auto" title="Inscripto en padrón">${esc(iconoActividadUgi(x.actividad))}${x.categoria ? ' · ' + esc(x.categoria) : ''}</span>`
    ).join('');

    const pillsManualHtml = Array.from(actManuales)
      .filter(a => !nombresAuto.has(a))
      .map(a => `<span class="act-pill">${esc(iconoActividadUgi(a))} <button type="button" data-quitar-act="${esc(a)}" style="border:none;background:none;color:#0369a1;font-weight:900;cursor:pointer;padding:0 2px;">×</button></span>`)
      .join('');

    $('legajo-pills-actividades').innerHTML = (pillsAutoHtml + pillsManualHtml) || `<span class="hint">Sin actividades adicionales registradas.</span>`;

    document.querySelectorAll('#legajo-chips-simultaneas .chip-check').forEach(btn => {
      const act = btn.dataset.actChip;
      btn.setAttribute('aria-pressed', String(actManuales.has(act) || nombresAuto.has(act)));
    });
  }

  function renderBitacoraModal() {
    const ordenados = [...bitacoraTemp].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    $('legajo-bitacora-lista').innerHTML = ordenados.length
      ? ordenados.map(ev => `
          <div class="bitacora-item">
            <div class="bitacora-top">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <strong>📅 ${esc(Muni360Time.format(ev.fecha))}</strong>
                <span class="pill" style="${estiloBadgeEventoLegajo(ev.tipo)}">${esc(ev.tipo)}</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <small style="color:var(--muted); font-weight:700;">${esc(ev.autor || 'Coordinación UGI')}</small>
              </div>
            </div>
            <div style="color:#1e293b; line-height:1.35;">${esc(ev.detalle)}</div>
          </div>
        `).join('')
      : `<p class="hint" style="text-align:center; margin:6px 0;">Todavía no hay eventos cargados en la bitácora de este deportista.</p>`;
  }

  async function persistirEstadoActualModal() {
    const dniVal = $('legajo-input-dni').value.replace(/\D/g, '').trim();
    return await guardarLegajoUnificado(jugador, dniVal, {
      ...(permiso('verDni')?{dni:dniVal}:{}),
      estadoPlan: $('legajo-estado-plan').value,
      actividadesSimultaneas: Array.from(actManuales),
      paseInterno: $('legajo-pase-interno').value.trim(),
      bitacora: bitacoraTemp
    });
  }

  renderPillsYChips();
  renderBitacoraModal();
  $('dua-modal').classList.remove('hidden');

  $('legajo-input-dni').addEventListener('input', renderPillsYChips);

  $('legajo-chips-simultaneas').addEventListener('click', e => {
    const chip = e.target.closest('.chip-check');
    if (!chip) return;
    const act = chip.dataset.actChip;
    if (actManuales.has(act)) actManuales.delete(act);
    else actManuales.add(act);
    renderPillsYChips();
  });

  $('legajo-select-otro-dep').addEventListener('change', e => {
    const val = e.target.value;
    if (val) {
      actManuales.add(val);
      e.target.value = '';
      renderPillsYChips();
    }
  });

  $('legajo-pills-actividades').addEventListener('click', e => {
    const btn = e.target.closest('button[data-quitar-act]');
    if (!btn) return;
    actManuales.delete(btn.dataset.quitarAct);
    renderPillsYChips();
  });

  $('btn-agregar-evento-legajo').onclick = async () => {
    const detalle = $('legajo-ev-detalle').value.trim();
    if (!detalle) {
      toast("Escribí el detalle o acuerdo antes de agregarlo");
      $('legajo-ev-detalle').focus();
      return;
    }
    const nuevoEv = {
      id: 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      fecha: $('legajo-ev-fecha').value || fechaLocal(0),
      tipo: $('legajo-ev-tipo').value,
      detalle,
      autor: `${sesion?.profeNombre || 'Coordinación'} (${areaActiva})`
    };
    bitacoraTemp.unshift(nuevoEv);
    $('legajo-ev-detalle').value = '';
    const confirmado = await persistirEstadoActualModal();
    renderBitacoraModal();
    renderVistaActiva();
    if (confirmado) toast('✓ Registro confirmado en el legajo compartido');
  };

  $('btn-guardar-legajo').onclick = async () => {
    const detallePendiente = $('legajo-ev-detalle').value.trim();
    if (detallePendiente) {
      bitacoraTemp.unshift({
        id: 'ev_' + Date.now(),
        fecha: $('legajo-ev-fecha').value || fechaLocal(0),
        tipo: $('legajo-ev-tipo').value,
        detalle: detallePendiente,
        autor: `${sesion?.profeNombre || 'Coordinación'} (${areaActiva})`
      });
    }

    const nuevoDni = $('legajo-input-dni').value.replace(/\D/g, '').trim();
    const confirmado = await persistirEstadoActualModal();

    if (confirmado) { $('dua-modal').classList.add('hidden'); renderVistaActiva(); toast('✓ Legajo confirmado en Google'); }
  };
};

function renderPlanificadorDua() {
  const obj = $('dua-plan-obj').value;
  const des = $('dua-plan-des').value;
  const adapt = DUA_ADAPTACIONES[obj]?.[des] || {
    paso1: "Reducir la espera organizando subgrupos simultáneos de 3 o 4 deportistas.",
    paso2: "Brindar consigna visual clara con conos o marcas en el piso.",
    paso3: "Reforzar el esfuerzo inmediato y la actitud en verde."
  };

  $('dua-plan-resultado').innerHTML = `
    <div style="font-weight:800; color:var(--blue); font-size:0.92rem; margin-bottom:8px;">
      🧩 Adaptación en 3 pasos: ${esc(obj)} frente a "${esc(des)}"
    </div>
    <div style="font-size:0.86rem; margin-bottom:5px;"><strong>Paso 1 (Estructura espacial):</strong> ${esc(adapt.paso1)}</div>
    <div style="font-size:0.86rem; margin-bottom:5px;"><strong>Paso 2 (Regla pedagógica):</strong> ${esc(adapt.paso2)}</div>
    <div style="font-size:0.86rem; margin-bottom:2px;"><strong>Paso 3 (Acción del profe):</strong> ${esc(adapt.paso3)}</div>
  `;
}

function categoriasDep() {
  return [...new Set(datosDeporte.padron.map(p => p.categoria))].sort(orden);
}

function equiposDep(cat) {
  return [...new Set(datosDeporte.padron.filter(p => p.categoria === cat).map(p => p.equipo || 'General'))].sort(orden);
}

window.MuniPortalGroups = function () {
  const seen = new Map();
  const add = (cat, eq) => {
    const c = String(cat || '').trim();
    const e = String(eq || 'General').trim() || 'General';
    if (!c || c === 'Sin categoría') return;
    const k = c + '\0' + e;
    if (!seen.has(k)) seen.set(k, { categoria: c, equipo: e });
  };
  (datosDeporte?.padron || []).forEach(p => add(p.categoria, p.equipo));
  (datosDeporte?.asistencia || []).forEach(a => add(a.categoria, a.equipo));
  return {
    activity: areaActiva,
    groups: [...seen.values()].sort((a, b) => orden(a.categoria, b.categoria) || orden(a.equipo, b.equipo))
  };
};

function formatearFechaCorta(iso) {
  if (!iso) return 'Hoy';
  const partes = String(iso).split('-');
  const ddMm = partes.length === 3 ? `${partes[2]}/${partes[1]}` : iso;
  return iso === fechaLocal(0) ? `Hoy (${ddMm})` : ddMm;
}

function guardarUltimaSeleccionGrupo() {
  const cat = $('sel-categoria').value;
  const eq  = $('sel-equipo').value || 'General';
  if (cat) almacen.setItem('muni360_ult_cat_' + areaActiva, cat);
  if (eq)  almacen.setItem('muni360_ult_eq_' + areaActiva, eq);
}

function actualizarBarraContexto() {
  const cfg = cfgActual();
  const cat = $('sel-categoria').value;
  const eq  = $('sel-equipo').value || 'General';
  const fecha = $('input-fecha').value || fechaLocal(0);

  let txtGrupo = cat ? `📍 ${cat}` : `📍 Seleccionar grupo`;
  if (cat && eq && eq !== 'General') {
    const prefijoEq = /^tira\b/i.test(eq) ? eq : `${PORTAL_MUNI.prefijoSubgrupo} ${eq}`;
    txtGrupo += ` · ${prefijoEq}`;
  }
  const txtFecha = `📅 ${formatearFechaCorta(fecha)}`;
  $('txt-contexto-activo').textContent = (tabActual === 'analisis' || tabActual === 'padron')
    ? txtGrupo
    : `${txtGrupo} · ${txtFecha}`;

  const enBancoUgi = tabActual === 'ugi';
  $('barra-contexto-activo').classList.toggle('hidden', enBancoUgi);

  const sinCategoria = !cat;
  const mostrarCard = !enBancoUgi && (filtrosDesplegados || sinCategoria);
  $('card-filtros').classList.toggle('hidden', !mostrarCard);
  $('btn-toggle-filtros').textContent = mostrarCard ? 'Ocultar' : 'Grupo / fecha';
}

function plantelActualNombres() {
  const cat = $('sel-categoria').value;
  const eq  = $('sel-equipo').value || 'General';
  return datosDeporte.padron
    .filter(p => p.categoria === cat && (p.equipo || 'General') === eq)
    .map(p => p.jugador)
    .sort((a, b) => a.localeCompare(b, 'es'));
}

function renderAsistencia() {
  montarAsignacionesDelEquipo();
  const cfg = cfgActual();
  const searchContext = JSON.stringify([storageScope,areaActiva,$('sel-categoria').value,$('sel-equipo').value]);
  if(window._asistSearchContext!==searchContext){$('buscar-alumno-asist').value='';window._asistSearchContext=searchContext;}
  const q = $('buscar-alumno-asist').value.trim().toLowerCase();
  const fecha = $('input-fecha').value;
  const cat = $('sel-categoria').value;
  const eq  = $('sel-equipo').value || 'General';

  $('titulo-lista-asist').textContent = 'Asistencia y semáforo';
  const lista = plantelActualNombres();
  const currentKey = `${areaActiva}|${cat}|${eq}|${fecha}`;

  if (window._asistKeyActual !== currentKey) {
    window._asistKeyActual = currentKey;
    asistTempDep = {};
    comidaTempDep = {};
    semTempDep = {};
    const clase=datosDeporte.asistencia.find(a=>a.categoria===cat&&(a.equipo||'General')===eq&&a.fecha===fecha);
    $('sel-clima-clase').value=clase?.clima||'N';
    actualizarSugerenciaClima();
    const puntos=String(clase?.puntosCiudad??'');
    const selectPuntos=$('sel-puntos-ciudad');
    selectPuntos.querySelectorAll?.('[data-saved-points]').forEach(n=>n.remove());
    let valorPuntos=puntos;
    if(puntos==='5'||puntos==='10')valorPuntos='+'+puntos;
    if(valorPuntos&&!['+5','+10','0'].includes(valorPuntos)&&/^\+?\d{1,3}$/.test(valorPuntos))selectPuntos.insertAdjacentHTML?.('beforeend',`<option data-saved-points value="${valorPuntos}">Valor guardado (${valorPuntos})</option>`);
    selectPuntos.value=valorPuntos;
    datosDeporte.asistencia
      .filter(a => a.categoria === cat && (a.equipo || 'General') === eq && a.fecha === fecha)
      .forEach(a => {
        const valor = String(a.estado || PORTAL_MUNI.estadoInicial);
        asistTempDep[a.jugador] = valor.charAt(0) || 'N';
        comidaTempDep[a.jugador] = valor.includes('Comida');
        if (valor.includes('Sem:A')) semTempDep[a.jugador] = 'A';
        else if (valor.includes('Sem:R')) semTempDep[a.jugador] = 'R';
        else semTempDep[a.jugador] = valor.includes('Sem:V') ? 'V' : 'N';
      });
  }

  lista.forEach(j => {
    if (!asistTempDep[j]) asistTempDep[j] = 'N';
    if (!semTempDep[j]) semTempDep[j] = 'N';
    if (comidaTempDep[j] === undefined) comidaTempDep[j] = false;
  });

  const filtrados = lista.filter(j => !q || j.toLowerCase().includes(q));
  const pres = lista.filter(j => asistTempDep[j] === 'P' || asistTempDep[j] === 'T').length;
  const alertasSem = lista.filter(j => semTempDep[j] === 'A' || semTempDep[j] === 'R').length;
  const alm = cfg.tieneComida ? lista.filter(j => asistTempDep[j] !== 'A' && comidaTempDep[j]).length : 0;

  const registrados=lista.filter(j=>asistTempDep[j]!=='N').length;
  $('kpi-dia-label').textContent='Presentismo · '+formatearFechaCorta(fecha);
  $('kpi-dia-pct').textContent=registrados?Math.round(100*pres/registrados)+'%':'Sin registrar';
  $('kpi-dia-det').textContent = `${pres} presentes de ${registrados} registros · ${lista.length-registrados} sin registrar${registrados<lista.length ? " · Carga incompleta" : ""}`;
  $('kpi-dia-total').textContent = String(lista.length);

  if (cfg.tieneComida) {
    const viandas = Math.max(0, pres - alm);
    $('kpi-dia-lbl2').textContent = '🍴 Comedor · '+formatearFechaCorta(fecha);
    $('kpi-dia-val2').textContent = String(alm);
    $('kpi-dia-sub2').textContent = `comedor · ${viandas} vianda(s)`;
  } else {
    $('kpi-dia-lbl2').textContent = '🚦 Semáforo UGI';
    $('kpi-dia-val2').textContent = `${lista.filter(j=>semTempDep[j]!=='N').length}/${lista.length}`;
      $('kpi-dia-val2').setAttribute('aria-label', `${lista.filter(j=>semTempDep[j]!=='N').length} de ${lista.length} personas observadas`);
    $('kpi-dia-sub2').textContent = `${alertasSem} alerta(s) · ${lista.filter(j=>semTempDep[j]==='N').length} sin observar`;
  }

  actualizarEstadoLista();
  if (!filtrados.length) {
    $('lista-asist').innerHTML = `<p class="hint" style="text-align:center; padding:18px 0;">${lista.length ? 'No hay coincidencias con la búsqueda.' : 'No hay inscriptos en este grupo.'}</p>`;
    return;
  }

  $('lista-asist').innerHTML = filtrados.map(j => {
    const fichaDua = obtenerFichaDua(j);
    const btnDuaHtml = (fichaDua && (fichaDua.comunicacion || fichaDua.desborda || fichaDua.regula))
      ? `<button type="button" class="btn-dua-badge" data-dua-ver="${esc(j)}">🧩 Ver apoyo DUA</button>`
      : '';
    return `
    <div class="asist-row" data-jugador="${esc(j)}">
      <div class="asist-name"><span class="portal-avatar-sm" aria-hidden="true">${esc(nombreBaseDua(j).trim().charAt(0))}</span><span>${esc(nombreBaseDua(j))}</span> ${btnDuaHtml}</div>
      <div class="asist-controls">
        ${cfg.tieneComida ? `<button type="button" class="comida-btn" data-action="comida" title="${comidaTempDep[j] && asistTempDep[j] !== 'A' ? 'Comedor de la colonia' : 'Vianda (trajeron almuerzo de su casa)'}" aria-pressed="${comidaTempDep[j] && asistTempDep[j] !== 'A'}">${comidaTempDep[j] && asistTempDep[j] !== 'A' ? '🍴 Comedor' : '🍱 Vianda'}</button>` : ''}
        <div class="sem-group" role="group" data-label="Semáforo" aria-label="Semáforo UGI" title="Semáforo Conductual UGI">
          <button type="button" class="sem-btn" data-sem="N" aria-label="Sin observar" aria-pressed="${semTempDep[j] === 'N'}">—</button>
          <button type="button" class="sem-btn" data-sem="V" aria-label="Semáforo verde" title="Semáforo verde" aria-pressed="${semTempDep[j] === 'V'}">🟢</button>
          <button type="button" class="sem-btn" data-sem="A" aria-label="Semáforo amarillo" title="Semáforo amarillo" aria-pressed="${semTempDep[j] === 'A'}">🟡</button>
          <button type="button" class="sem-btn" data-sem="R" aria-label="Semáforo rojo" title="Semáforo rojo" aria-pressed="${semTempDep[j] === 'R'}">🔴</button>
        </div>
        <div class="pat" role="group" data-label="Asistencia" aria-label="Asistencia">
          <button type="button" data-e="N" aria-label="Asistencia sin registrar" aria-pressed="${asistTempDep[j] === 'N'}">—</button>
          <button type="button" data-e="P" aria-label="Presente" title="Presente" aria-pressed="${asistTempDep[j] === 'P'}">P</button>
          <button type="button" data-e="A" aria-label="Ausente" title="Ausente" aria-pressed="${asistTempDep[j] === 'A'}">A</button>
          <button type="button" data-e="T" aria-label="Tarde" title="Tarde" aria-pressed="${asistTempDep[j] === 'T'}">T</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function guardarAsistenciaActual() {
  clearTimeout(autosaveTimer);
  if(esSoloConsulta())return toast('Tu acceso es de consulta.');
  if(guardandoOperacion)return;
  const lista=plantelActualNombres(); if (!lista.length) return;
  const fecha=$('input-fecha').value, cat=$('sel-categoria').value, eq=$('sel-equipo').value||'General', cfg=cfgActual();
  if(!Muni360Time.dateIso(fecha))return toast('Elegí una fecha válida antes de guardar.');
  const registro={}; lista.forEach(j=>{const est=asistTempDep[j]||'N';registro[j]=est+((cfg.tieneComida && ['P','T'].includes(est) && comidaTempDep[j])?' | 🍴 Comida':'')+' | Sem:'+(semTempDep[j]||'N');});
  const payload={tipo:'ASISTENCIA',deporte:areaActiva,fecha,categoria:cat,equipo:eq,datos:registro,clima:$('sel-clima-clase').value,puntosCiudad:$('sel-puntos-ciudad').value};
  const fingerprint=JSON.stringify([storageScope,areaActiva,cat,eq,fecha,registro,payload.clima,payload.puntosCiudad]);
  if(fingerprint===ultimaAsistenciaEnviada){draftContext=null;try{localStorage.removeItem(claveBorradorAsistencia());}catch(_){}return toast('Esta lista ya está guardada o pendiente de confirmación.');}
  const ok=await enviarOperacion(payload);
  if (ok) {
    ultimaAsistenciaEnviada=fingerprint;
    draftContext=null;$('draft-status').textContent='';
    datosDeporte.asistencia=datosDeporte.asistencia.filter(r=>!(r.fecha===fecha && r.categoria===cat && r.equipo===eq));
    Object.entries(registro).forEach(([jugador,estado])=>datosDeporte.asistencia.push({fecha,categoria:cat,equipo:eq,jugador,estado,clima:payload.clima,puntosCiudad:payload.puntosCiudad}));
    almacen.setItem('muni360_cache_'+areaActiva,JSON.stringify(datosDeporte)); renderVistaActiva();
  }
  if(ok || syncClient?.queue.some(entry=>JSON.stringify(entry.payload.datos)===JSON.stringify(registro)&&entry.payload.deporte===payload.deporte&&entry.payload.categoria===cat&&entry.payload.equipo===eq&&entry.payload.fecha===fecha)){
    ultimaAsistenciaEnviada=fingerprint;draftContext=null;localStorage.removeItem(claveBorradorAsistencia());$('draft-status').textContent=ok?'Asistencia guardada.':'Asistencia pendiente de confirmación; se conserva en este dispositivo.';
    clearTimeout(savedNoticeTimer);
    if(ok){window.dispatchEvent(new Event('muni360-attendance-saved'));savedNoticeTimer=setTimeout(()=>{if(!draftContext&&$('draft-status').textContent==='Asistencia guardada.')$('draft-status').textContent='';},4000);}
  }
}

function tieneArqueroActual() {
  return Boolean(cfgActual().arquero);
}

function gestosActuales() {
  const cfg = cfgActual();
  if (tieneArqueroActual() && puestoEval === 'arquero') {
    return [...cfg.arquero, ...GESTOS_COMUNES_UGI];
  }
  const base = Array.isArray(datosDeporte.gestos)&&datosDeporte.gestos.length ? datosDeporte.gestos : cfg.gestos;
  return [...base, ...GESTOS_COMUNES_UGI];
}

function evalDeJugador(jugador, fecha) {
  const cat = $('sel-categoria').value;
  const eq  = $('sel-equipo').value || 'General';
  return datosDeporte.evaluaciones.find(e =>
    e.jugador === jugador &&
    e.fecha === fecha &&
    (!e.categoria || e.categoria === cat) &&
    (!e.equipo || (e.equipo || 'General') === eq)
  );
}

function renderFilasGestos() {
  document.querySelectorAll('#switch-puesto .rol-btn').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.puesto === puestoEval));
  });
  $('eval-agregar-gesto').classList.toggle('hidden',!puedeEditarGestos());
  $('contenedor-gestos').innerHTML = gestosActuales().map((g, gi) => {
    const val = notasTemp[g];
    const tiene = val !== undefined && val !== null && val !== '';
    const esArq = g.startsWith('Arquero:');
    const esUgi = GESTOS_COMUNES_UGI.includes(g);
    const nombreLimpio = esArq ? g.replace(/^Arquero:\s*/, '') : g;
    const badge = esUgi ? '<em>4C UGI</em>' : (esArq ? '<em class="arq">ARQUERO</em>' : '');
    return `
      <div class="gesto">
        <div class="gesto-nombre">${esc(nombreLimpio)}${badge}${!esUgi && !esArq && puedeEditarGestos() ? `<button type="button" class="btn-sec" data-eval-quitar-gesto="${esc(g)}" style="margin-left:8px;padding:4px 9px;min-height:30px;font-size:12px;" aria-label="Quitar gesto ${esc(g)} de futuras evaluaciones">Quitar</button>` : ""}${esUgi && !tiene ? '<small class="hint" style="display:block;font-weight:400">No evaluada</small>' : ''}</div>
        <div class="stepper ${tiene ? 'con-valor' : ''}" id="stepper-${gi}">
          <button type="button" class="step-btn" data-step="-0.5" data-gi="${gi}">−</button>
          <input type="number" class="nota-input" id="nota-input-${gi}" data-gi="${gi}" min="1" max="10" step="0.5" placeholder="-" value="${tiene ? val : ''}">
          <button type="button" class="step-btn" data-step="0.5" data-gi="${gi}">+</button>
        </div>
      </div>`;
  }).join('');
}

function seleccionarGuiaUgi(clave) {
  situacionUgi = clave;
  document.querySelectorAll('#botonera-ugi .btn-situacion').forEach(b => {
    b.classList.toggle('active', b.dataset.guia === clave);
  });
  indiceUgi = Math.floor(Math.random() * GUIAS_UGI[clave].length);
  renderGuiaUgi();
}

function renderGuiaUgi() {
  const lista = GUIAS_UGI[situacionUgi];
  const item = lista[indiceUgi];
  $('panel-respuesta-ugi').innerHTML = `
    <div class="spread" style="margin-bottom:8px;">
      <strong style="color:var(--violeta); font-size:0.96rem;">${esc(situacionUgi)}: ${esc(item.subtitulo)} (${indiceUgi + 1}/${lista.length})</strong>
      <button type="button" class="btn-sec" id="btn-rotar-ugi">🔄 Otra variante (${indiceUgi + 1}/${lista.length})</button>
    </div>
    <div style="font-size:0.88rem; margin-bottom:6px;"><strong>1. Acción inmediata del profe:</strong> ${esc(item.queHacer)}</div>
    <div style="font-size:0.88rem; margin-bottom:6px;"><strong>2. Variante cognitiva o conductual:</strong> ${esc(item.ajuste)}</div>
    <div class="frase-clave">🗣️ Qué decir en cancha: ${esc(item.frase)}</div>
  `;
  $('btn-rotar-ugi').onclick = () => {
    indiceUgi = (indiceUgi + 1) % lista.length;
    renderGuiaUgi();
  };
}

function actualizarSugerenciaClima() {
  const box = $('clima-sugerencia-banco');
  if (!box) return;
  const cfg = SUGERENCIAS_CLIMA[$('sel-clima-clase')?.value];
  if (!cfg) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;"><span style="font-size:0.84rem;font-weight:600;color:#0b2545;">${esc(cfg.texto)}</span><button type="button" class="btn-sec" data-ir-banco="${esc(cfg.guia)}" style="min-height:36px;padding:6px 12px;font-size:0.82rem;">Ir al Banco de herramientas</button></div>`;
  box.classList.remove('hidden');
}

function renderHistorialUgiLocal() {
  const hist = datosDeporte.sesiones || [];
  $('historial-ugi-local').innerHTML = hist.length
    ? hist.slice(0, 8).map(x => `
        <div class="item" style="flex-direction:column; align-items:flex-start; gap:3px;">
          <div><strong>${esc(Muni360Time.format(x.fecha))}</strong> · ${esc(x.categoria)} (${esc(x.profe)})</div>
          <div style="font-size:0.78rem; color:var(--muted);">${esc(x.foco)} — ${esc(x.checklist)} ${x.nota ? '| ' + esc(x.nota) : ''}</div>
        </div>`).join('')
    : `<p class="hint">Todavía no registraste sesiones en este dispositivo.</p>`;
}

function cuestionariosParaGrupo(cat, eq) {
  const catNorm = String(cat || '').trim().toLowerCase();
  const eqNorm = String(eq || '').trim().toLowerCase();
  return (cuestionariosActividad || []).filter(s => {
    if (s.activity && s.activity !== areaActiva) return false;
    const sc = String(s.categoria || '').trim().toLowerCase();
    const se = String(s.equipo || '').trim().toLowerCase();
    return (!sc || !catNorm || sc === catNorm) && (!se || !eqNorm || se === eqNorm);
  });
}

async function cargarCuestionariosAnalisis(forzar = false) {
  const esDemo = sesion?.modoDemo === true || almacen.getItem('muni360_modo_demo') === '1';
  if (!puedeVerCambios() || (esDemo ? !window.MuniDemoRuntime?.call : !window.MuniGoogle?.call)) {
    cuestionariosActividad = [];
    cuestionariosAreaCargada = '';
    $('card-cuestionarios-analisis')?.classList.add('hidden');
    return;
  }
  if (!forzar && cuestionariosAreaCargada === areaActiva) return;
  const targetAct = areaActiva;
  try {
    const res = esDemo
      ? await window.MuniDemoRuntime.call('/api/surveys/list', { activity: targetAct }, sesion)
      : await MuniGoogle.call('/api/surveys/list', { activity: targetAct });
    if (targetAct !== areaActiva || !puedeVerCambios()) return;
    cuestionariosActividad = Array.isArray(res?.surveys) ? res.surveys : [];
    cuestionariosAreaCargada = targetAct;
    renderAnalisis();
  } catch (_) {}
}

function renderCuestionariosAnalisis(cat, eq) {
  const card = $('card-cuestionarios-analisis');
  const box = $('lista-cuestionarios-analisis');
  if (!card || !box) return;
  if (!puedeVerCambios()) {
    card.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  card.classList.remove('hidden');
  const matched = cuestionariosParaGrupo(cat, eq);
  if (!matched.length) {
    box.innerHTML = '<p class="hint" style="margin:0;">Todavía no hay cuestionarios anónimos vinculados a este grupo. Podés crear uno desde ☰ Menú → Cuestionarios.</p>';
    return;
  }
  const stLabels = { active: 'Activo', closed: 'Cerrado', draft: 'Borrador' };
  box.innerHTML = matched.map(s => {
    const qsHtml = (s.summary || []).map(q => {
      if (q.type === 'scale') {
        const pctW = q.avg != null ? Math.min(100, Math.max(0, (q.avg / 5) * 100)) : 0;
        const color = q.avg == null ? 'var(--muted)' : q.avg >= 4 ? 'var(--ok)' : q.avg >= 3.2 ? 'var(--sky)' : 'var(--bad)';
        return `<div class="barra" style="margin:6px 0;"><div class="barra-top"><span>${esc(q.label)}</span><span>${q.avg != null ? esc(q.avg + ' / 5 ★ (' + q.count + ' resp.)') : 'Sin respuestas'}</span></div><div class="barra-bg"><div style="width:${pctW}%;background:${color};"></div></div></div>`;
      }
      if (q.type === 'single' || q.type === 'multi') {
        const top = Object.entries(q.counts || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)}: <b>${v}</b>`).join(' · ');
        return `<p class="hint" style="margin:5px 0;"><strong>${esc(q.label)}:</strong> ${top || 'Sin respuestas'}</p>`;
      }
      const texts = Array.isArray(q.texts) ? q.texts.slice(0, 5) : [];
      return `<div style="margin:6px 0;"><p class="hint" style="margin:0 0 3px;"><strong>${esc(q.label)} (${texts.length} comentarios):</strong></p>${texts.length ? '<ul style="margin:0 0 0 18px;font-size:0.8rem;color:var(--text);">' + texts.map(t => `<li>${esc(t)}</li>`).join('') + '</ul>' : '<p class="hint" style="margin:0;">Sin comentarios de texto.</p>'}</div>`;
    }).join('');
    const scope = [s.categoria || 'Toda la actividad', s.equipo || 'Todos'].join(' · ');
    return `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:10px;background:#f8fafc;">
      <div class="spread" style="margin-bottom:6px;">
        <div><strong>${esc(s.title)}</strong> <span class="pill ${s.status === 'active' ? 'v' : 'a'}">${esc(stLabels[s.status] || s.status)}</span></div>
        <span class="hint" style="margin:0;">${esc(scope)} · <b>${Number(s.responseCount || 0)} resp.</b></span>
      </div>
      ${s.responseCount ? qsHtml : '<p class="hint" style="margin:0;">Aún sin respuestas enviadas.</p>'}
    </div>`;
  }).join('');
}

function renderPadron() {
  if (!esCoordOAdmin()) return;
  const lista = plantelActualNombres();
  $('count-plantel').textContent = String(lista.length);
  $('form-padron').closest('.card').classList.toggle('hidden',!permiso('administrarPadron'));
  $('card-reset-datos').classList.toggle('hidden',!permiso('archivar'));
  $('card-variables-deporte').classList.toggle('hidden',!puedeEditarGestos());
  $('recuperar-fichas-locales').classList.toggle('hidden',!permiso('verLegajo'));
  $('importar-sheets').classList.toggle('hidden',!permiso('administrarPadron'));
  const b=datosDeporte.backup; $('backup-status').textContent=sesion?.canManageUsers?(b?`Último backup: ${Muni360Time.format(b.fecha)} · ${b.ok?'Completo':'Incompleto'} · ${b.copias} copia(s)`:'Backup: todavía no hay una ejecución verificada.'):'';
  $('gestos-dep').textContent = areaActiva;
  document.querySelectorAll('.txt-area-activa').forEach(el => el.textContent = areaActiva);
  $('wrap-reset-general').classList.toggle('hidden', !sesion?.esAdminTotal || !permiso('archivar'));

  $('lista-padron').innerHTML = lista.length
    ? lista.map((j, i) => {
        const dniVal = obtenerDni(j);
        const tieneFichaDua = Boolean(obtenerFichaDua(j));
        const legData = obtenerLegajoUnificado(j, dniVal);
        const planTag = (legData.estadoPlan && !legData.estadoPlan.startsWith('🟢'))
          ? `<span class="pill" style="background:#fef3c7; color:#92400e; font-size:0.66rem; margin-left:4px;">${esc(legData.estadoPlan.split('(')[0].trim())}</span>`
          : '';
        return `
        <div class="item">
          <div>
            <strong>${esc(nombreBaseDua(j))}</strong>
            ${tieneFichaDua ? '<span class="pill v" style="font-size:0.68rem; margin-left:6px;">🧩 DUA</span>' : ''}
            ${dniVal ? `<span class="pill" style="background:#e0f2fe; color:#0369a1; font-size:0.68rem; margin-left:4px;">DNI: ${esc(dniVal)}</span>` : ''}
            ${planTag}
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${permiso('editarDua')?`<button type="button" class="btn-dua-edit" data-dua-edit="${esc(j)}">🧩 DUA</button>`:''}
            <button type="button" class="btn-legajo-dni ${!permiso('verLegajo')?'hidden':''} ${dniVal ? 'con-dni' : ''}" data-legajo-open="${esc(j)}">${dniVal ? '🗂️ Legajo (DNI ✓)' : '🗂️ Legajo'}</button>
            ${permiso('administrarPadron')?`<button type="button" class="quitar" data-i="${i}">Quitar</button>`:''}
          </div>
        </div>`;
      }).join('')
    : `<p class="hint">Grupo sin inscriptos.</p>`;

  $('padron-cat').value = $('sel-categoria').value || '';
  $('padron-eq').value  = $('sel-equipo').value || 'General';
  const gLista = gestosActuales();
  $('lista-gestos-config').innerHTML = gLista.map(g => {
    const esFijo = GESTOS_COMUNES_UGI.includes(g);
    return `
    <div class="item">
      <span>${esc(g)}</span>
      <div style="display:flex; align-items:center; gap:6px;">
        ${GESTOS_COMUNES_UGI.includes(g) ? '<span class="pill a">4C UGI</span>' : ''}
        ${!esFijo ? `<button type="button" class="bitacora-del" data-quitar-gesto="${esc(g)}" title="Quitar variable personalizada">✕</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function actualizarVistaPreviaPadron() {
  const preview=$('padron-import-preview'),manual=$('padron-manual-fields');
  const importing=Boolean(pendingPadronGroups?.length);
  preview.classList.toggle('hidden',!importing);
  manual.classList.toggle('hidden',importing);
  $('padron-cat').required=!importing;
  $('padron-lista').required=!importing;
  $('padron-submit').textContent=importing?'Confirmar importación de '+pendingPadronGroups.reduce((n,g)=>n+g.jugadores.length,0)+' personas':'Cargar listado al grupo';
  if(!importing){preview.innerHTML='';return;}
  const total=pendingPadronGroups.reduce((n,g)=>n+g.jugadores.length,0);
  preview.innerHTML='<h4>Vista previa · '+total+' participantes en '+pendingPadronGroups.length+' grupos</h4>'+
    '<p class="hint">Revisá categoría y equipo de destino. Podés editar cada campo antes de confirmar; todavía no se guardó nada.</p>'+
    '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Origen</th><th>Categoría de destino</th><th>'+PORTAL_MUNI.etiquetaSubgrupo+'</th><th>Cantidad</th></tr></thead><tbody>'+
    pendingPadronGroups.map((g,i)=>'<tr><td>'+esc(g.origen||g.categoria+' · '+g.equipo)+'</td>'+
      '<td><input type="text" required maxlength="160" data-import-cat="'+i+'" aria-label="Categoría destino grupo '+(i+1)+'" value="'+esc(g.categoria)+'"></td>'+
      '<td><input type="text" required maxlength="160" data-import-eq="'+i+'" aria-label="Equipo destino grupo '+(i+1)+'" value="'+esc(g.equipo)+'"></td>'+
      '<td>'+g.jugadores.length+'</td></tr>').join('')+
    '</tbody></table></div><p class="hint">El DNI no se muestra en la vista previa. Los equipos A y B son independientes; una tira vacía figura como General.</p>'+
    '<button type="button" class="btn-sec" id="cancelar-excel-padron">Cancelar Excel y volver a carga manual</button>';
}

async function archivarActividad(deporte, modo) {
  if (syncClient?.queue.length) return toast('Enviá los pendientes antes de archivar.');
  if (!confirm(`¿Archivar ${deporte} e iniciar una nueva temporada? Se conservarán copias consultables de asistencia, evaluaciones, padrón y variables.${modo==='TODO'?' El padrón actual quedará vacío.':' El padrón actual se conserva.'}`)) return;
  const ok=await enviarOperacion({tipo:'RESET_DATOS',deporte,modo});
  if (ok) await cargarAreaActiva();
}

async function archivarClub(modo) {
  if (!sesion?.esAdminTotal || !syncClient || syncClient.queue.length) return toast('Sólo Dirección, con conexión y sin pendientes.');
  if (!confirm('¿Archivar las actividades del club una por una? Si una falla se detendrá el proceso y se informarán los archivos completados.')) return;
  const completados=[];
  for (const deporte of sesion.areas) {
    try { await syncClient.read(deporte); } catch(e) { $('estado-txt').textContent=`Archivo detenido en ${deporte}. Completados: ${completados.join(', ') || 'ninguno'}. ${e.message}`; return; }
    if (!await enviarOperacion({tipo:'RESET_DATOS',deporte,modo})) { $('estado-txt').textContent=`Archivo pendiente en ${deporte}. Completados: ${completados.join(', ') || 'ninguno'}. Revisá la carga pendiente.`; return; }
    completados.push(deporte);
  }
  await cargarAreaActiva(); toast(`${completados.length} actividades archivadas y confirmadas.`);
}

function rutaHistorialMuni(){
  return {version:1,portal:HISTORIA_PORTAL_MUNI,usuario:sesion?.usuario||'',
    tab:tabActual,area:areaActiva,categoria:$('sel-categoria').value||'',
    equipo:$('sel-equipo').value||'',fecha:$('input-fecha').value||''};
}

function rutaAutorizadaMuni(ruta){
  return Boolean(sesion&&ruta?.version===1&&ruta.portal===HISTORIA_PORTAL_MUNI&&
    ruta.usuario===sesion.usuario&&Array.isArray(sesion.areas)&&sesion.areas.includes(ruta.area)&&
    actividadesPortal(sesion).some(d=>d.nombre===ruta.area));
}

function registrarRutaMuni(modo='push'){
  if(!sesion||restaurandoHistorialMuni||!window.history?.replaceState)return;
  const nueva=rutaHistorialMuni(),actual=window.history.state?.muni360Nav;
  if(JSON.stringify(actual)===JSON.stringify(nueva))return;
  const reemplazar=modo==='replace'||!rutaAutorizadaMuni(actual)||!window.history.pushState;
  window.history[reemplazar?'replaceState':'pushState'](
    {...(window.history.state||{}),muni360Nav:nueva},'');
}

async function recuperarRutaMuni(ruta){
  if(!rutaAutorizadaMuni(ruta))return;
  const actual=rutaHistorialMuni();
  const otroGrupo=ruta.area!==areaActiva||
    Boolean(draftContext&&(ruta.categoria!==actual.categoria||ruta.equipo!==actual.equipo||ruta.fecha!==actual.fecha));
  if(draftContext&&otroGrupo){
    if(!confirm('Hay una asistencia sin guardar. ¿Descartar ese borrador y volver a la pantalla anterior?')){
      window.history?.pushState?.({...(window.history.state||{}),muni360Nav:actual},'');
      return;
    }
    borrarBorradorAsistencia();
  }
  restaurandoHistorialMuni=true;
  try{
    if(ruta.area!==areaActiva){
      areaActiva=ruta.area;$('sel-deporte').value=areaActiva;
      await cargarAreaActiva();
    }
    if(ruta.fecha)$('input-fecha').value=ruta.fecha;
    if(ruta.categoria&&ruta.equipo&&categoriasDep().includes(ruta.categoria)&&
       equiposDep(ruta.categoria).includes(ruta.equipo)){
      abrirGrupoPortal(ruta.categoria,ruta.equipo);
    }
    cambiarTab(ruta.tab,'none');
    if(tabActual!==ruta.tab)cambiarTab('inicio','none');
  }finally{
    restaurandoHistorialMuni=false;
  }
  registrarRutaMuni('replace');
}

async function claveDemoValida(texto) {
  try {
    const huella = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto.trim()));
    return Array.from(new Uint8Array(huella), b => b.toString(16).padStart(2, "0")).join("") === DEMO_CLAVE_SHA256;
  } catch (_) { return false; }
}

window.salirModoDemo = function() {
  almacen.removeItem('muni360_modo_demo');
  almacen.removeItem('muni360_cache_Básquet Caballeros');
  almacen.removeItem('muni360_cache_Colonia');
  almacen.removeItem('muni360_cache_COYFD');
  almacen.removeItem('muni360_cache_Hockey sobre Césped Damas');
  almacen.removeItem(PORTAL_MUNI.claveSesion);
  window.MuniDemoRuntime?.clear?.();
  sesion = null;

  ['app-header', 'barra-estado', 'app-screen', 'portal-mobile-nav'].forEach(id => $(id).classList.add('hidden'));
  document.body?.classList.remove('portal-menu-open'); $('portal-menu').setAttribute('aria-expanded', 'false');
  $('login-screen').classList.remove('hidden');
  toast("Modo Demo finalizado");
};

function renderAvisosPortal(){
  if(!window.MuniPortal)return;
  $('tab-avisos').innerHTML=window.MuniPortal.feed(avisosPortal,{activity:areaActiva,cat:$('sel-categoria').value,eq:$('sel-equipo').value||'General',demo:sesion?.modoDemo});
}

async function cargarAvisosPortal(force=false){
  if(sesion?.modoDemo){avisosPortal={items:[],loaded:true,loading:false,error:''};renderAvisosPortal();return;}
  if(avisosPortal.loading||avisosPortal.loaded&&!force){renderAvisosPortal();return;}
  const generation=++avisosGeneration,uid=storageScope;
  avisosPortal.loading=true;avisosPortal.error='';renderAvisosPortal();
  try{
    const response=await fetch(window.MUNI_CONFIG.apiBaseUrl,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({path:'/api/comunidad/feed'}),signal:AbortSignal.timeout(20000)});
    const result=await response.json();
    if(generation!==avisosGeneration||uid!==storageScope)return;
    if(!response.ok||!result.ok||!Array.isArray(result.avisos))throw Error(result.error||'No se pudieron cargar los avisos.');
    avisosPortal={items:result.avisos,loaded:true,loading:false,error:''};
  }catch(e){if(generation!==avisosGeneration||uid!==storageScope)return;avisosPortal.loading=false;avisosPortal.error=e.message||'No se pudo actualizar la comunidad.';}
  renderAvisosPortal();
}

function claveBorradorAsistencia(){return 'muni360_asistencia_borrador:'+storageScope+':'+areaActiva;}

function borrarBorradorAsistencia(){clearTimeout(autosaveTimer);localStorage.removeItem(claveBorradorAsistencia());draftContext=null;$('draft-status').textContent='';}

function ofrecerBorradorAsistencia(){
  if(draftContext||!syncClient||!localStorage.getItem(claveBorradorAsistencia()))return;
  let saved;try{saved=JSON.parse(localStorage.getItem(claveBorradorAsistencia()));}catch(_){saved=null;}
  const canRestore=Boolean(saved?.uid===storageScope&&saved?.deporte===areaActiva&&saved?.cat&&saved?.date&&categoriasDep().includes(saved.cat)&&equiposDep(saved.cat).includes(saved.eq));
  $('draft-status').innerHTML=(canRestore?'Hay una asistencia pendiente guardada en este dispositivo.':'Hay un borrador anterior sin grupo vigente. No se envió a la base.')+
    (canRestore?' <button type="button" class="btn-sec" id="recuperar-asistencia">Revisar borrador</button>':'')+
    ' <button type="button" class="btn-sec" id="descartar-borrador-antiguo">Descartar borrador</button>';
  $('descartar-borrador-antiguo').onclick=()=>{
    if(!confirm('¿Descartar este borrador local? No afecta las asistencias guardadas en el servidor.'))return;
    borrarBorradorAsistencia();toast('Borrador local descartado.');
  };
  if(!canRestore)return;
  $('recuperar-asistencia').onclick=()=>{
    if(!confirm('Se restaurará el borrador local en el formulario. Revisá los datos antes de pulsar Guardar asistencia.'))return;
    $('sel-categoria').value=saved.cat;$('sel-equipo').value=saved.eq;$('input-fecha').value=saved.date;
    asistTempDep=saved.asistencia;semTempDep=saved.semaforo;comidaTempDep=saved.comida;
    $('sel-clima-clase').value=saved.clima;$('sel-puntos-ciudad').value=saved.puntos;
    draftContext={cat:saved.cat,eq:saved.eq,date:saved.date,deporte:saved.deporte};
    renderAsistencia();$('draft-status').textContent='Borrador restaurado para revisar. Todavía no se envió a Google.';
  };
}

async function renderAuditoria(){
  if(!puedeVerCambios())return;
  if(!syncClient){$('audit-list').innerHTML='<p>Demostración: el historial real aparecerá después de configurar Google y guardar cambios.</p>';return;}
  try{const r=await syncClient.request({tipo:'AUDITORIA',deporte:areaActiva});$('audit-list').innerHTML=r.events.length?r.events.map(e=>`<article class="audit-event"><strong>${esc(e.tipo)} · ${esc(e.jugador||e.categoria||e.deporte)}</strong><p class="audit-meta">${esc(Muni360Time.format(e.fecha))} · ${esc(e.autor)} · ${esc(e.categoria)} ${esc(e.equipo)} · ${esc(e.estado)}</p><button type="button" class="btn-sec" data-audit-detail="${esc(e.id)}">Ver antes y después</button></article>`).join(''):'<p>No hay cambios registrados para mostrar.</p>';}catch(e){$('audit-list').textContent=e.message;}
}
