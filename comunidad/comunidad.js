import {
  ACTIVIDADES,
  ACTIVIDADES_AVISOS,
  TIPOS_AVISO,
  CATEGORIAS_SUGERIDAS,
  HORARIOS_ENTRENAMIENTO,
  PUSH_CONFIG
} from "./catalogo.js";

const $ = id => document.getElementById(id);

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const TIPO_ETIQUETAS = Object.fromEntries([
  ...TIPOS_AVISO.map(t => [t.valor, t.etiqueta]),
  ["Comunicado", "Aviso"]
]);

function etiquetarTipo(tipo) {
  return TIPO_ETIQUETAS[tipo] || tipo || "Aviso";
}

function formatearFecha(iso) {
  const s = String(iso || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function apiUrl() {
  return window.MUNI_CONFIG?.apiBaseUrl || "";
}

async function fetchPublicFeed() {
  const url = apiUrl();
  if (!url) throw Error("Falta configurar el servicio de avisos.");
  const res = await fetch(url, {
    method: "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ path: "/api/comunidad/feed" }),
    signal: AbortSignal.timeout(20000)
  });
  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw Error("No se pudo interpretar la respuesta del servidor.");
  }
  if (!res.ok || !data.ok) {
    throw Error(data.error || "No se pudieron cargar los avisos.");
  }
  return Array.isArray(data.avisos) ? data.avisos : [];
}

let vistaActual = "avisos";
let feedState = { loading: true, error: "", avisos: [] };
let authState = { checking: true, user: null, session: null, authError: "" };
let bannerAvisosMensaje = null;
let bannerAlertasMensaje = null;

// Poblar catálogos estáticos en selectores y datalist
$("filtro-actividad").innerHTML = `<option value="">Todas las actividades</option>` +
  ACTIVIDADES_AVISOS.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join("");

$("filtro-tipo").innerHTML = `<option value="">Todos los tipos</option>` +
  TIPOS_AVISO.map(t => `<option value="${esc(t.valor)}">${esc(t.etiqueta)}</option>`).join("");

$("sub-actividad").innerHTML = ACTIVIDADES_AVISOS
  .map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join("");

$("pub-tipo").innerHTML = TIPOS_AVISO
  .map(t => `<option value="${esc(t.valor)}">${esc(t.etiqueta)}</option>`).join("");

$("lista-categorias-sugeridas").innerHTML = CATEGORIAS_SUGERIDAS
  .map(c => `<option value="${esc(c)}"></option>`).join("");

function mostrarEstado(el, info) {
  if (!info || !info.text) {
    el.className = "estado-banner hidden";
    el.innerHTML = "";
    return;
  }
  const kind = info.type === "error" ? "estado-error" : info.type === "ok" ? "estado-ok" : "estado-info";
  el.className = `estado-banner ${kind}`;
  el.innerHTML = `<span>${esc(info.text)}</span>` +
    (info.retry ? `<button type="button" class="btn-sec" id="btn-reintentar-avisos">Reintentar</button>` : "");
  const btn = el.querySelector("#btn-reintentar-avisos");
  if (btn) btn.addEventListener("click", cargarAvisos);
}

function cambiarVista(vista) {
  vistaActual = vista;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    const selected = btn.dataset.vista === vista;
    btn.setAttribute("aria-selected", String(selected));
  });
  $("vista-avisos").classList.toggle("hidden", vista !== "avisos");
  $("vista-horarios").classList.toggle("hidden", vista !== "horarios");
  $("vista-alertas").classList.toggle("hidden", vista !== "alertas");
  $("barra-filtros").classList.toggle("hidden", vista === "alertas");
  $("campo-filtro-tipo").classList.toggle("hidden", vista !== "avisos");
  $("estado-avisos").classList.toggle("hidden", vista !== "avisos" || !bannerAvisosMensaje?.text);
}

function filtrosActuales() {
  return {
    actividad: $("filtro-actividad").value,
    categoria: $("filtro-categoria").value.trim().toLowerCase(),
    equipo: $("filtro-equipo").value.trim().toLowerCase(),
    tipo: $("filtro-tipo").value
  };
}

function renderAvisos() {
  if (feedState.loading) {
    bannerAvisosMensaje = { type: "info", text: "Cargando avisos..." };
    if (vistaActual === "avisos") mostrarEstado($("estado-avisos"), bannerAvisosMensaje);
    $("vista-avisos").innerHTML = "";
    return;
  }

  if (feedState.error) {
    bannerAvisosMensaje = { type: "error", text: feedState.error, retry: true };
    if (vistaActual === "avisos") mostrarEstado($("estado-avisos"), bannerAvisosMensaje);
    $("vista-avisos").innerHTML = "";
    return;
  }

  if (vistaActual === "avisos") mostrarEstado($("estado-avisos"), bannerAvisosMensaje);

  const f = filtrosActuales();
  const filtrados = feedState.avisos.filter(n => {
    if (f.actividad && n.actividad !== f.actividad && n.actividad !== "General") return false;
    if (f.categoria && (!n.categoria || !String(n.categoria).toLowerCase().includes(f.categoria))) return false;
    if (f.equipo && (!n.equipo || !String(n.equipo).toLowerCase().includes(f.equipo))) return false;
    if (f.tipo && n.tipo !== f.tipo) return false;
    return true;
  });

  const cont = $("vista-avisos");
  if (!filtrados.length) {
    cont.innerHTML = `<div class="panel-card" style="text-align:center; color:var(--muted);">No hay avisos publicados con ese filtro.</div>`;
    return;
  }

  const profile = authState.session?.profile;
  const publishAreas = new Set(profile?.publishAreas || []);

  cont.innerHTML = filtrados.map(n => {
    const canDeactivate = Boolean(profile?.canPublish && publishAreas.has(n.actividad));
    const fechaTxt = formatearFecha(n.fecha_evento);
    return `
      <article class="card-novedad tipo-${esc(n.tipo)} ${n.urgente ? "urgente" : ""}">
        <div class="meta-top">
          <div class="badges-grupo">
            <span class="badge">${esc(n.actividad)}</span>
            ${n.categoria ? `<span class="badge">${esc(n.categoria)}${n.equipo ? " · " + esc(n.equipo) : ""}</span>` : ""}
            <span class="badge">${esc(etiquetarTipo(n.tipo))}</span>
          </div>
          ${n.urgente ? `<span class="badge urg">⚡ Urgente</span>` : ""}
        </div>
        <h2>${esc(n.titulo)}</h2>
        <p>${esc(n.detalle)}</p>
        <div class="datos-evento">
          <div class="datos-evento-meta">
            ${fechaTxt ? `<span>📅 ${esc(fechaTxt)}</span>` : ""}
            ${n.hora_evento ? `<span>⏰ ${esc(n.hora_evento)}</span>` : ""}
            ${n.lugar ? `<span>📍 ${esc(n.lugar)}</span>` : ""}
          </div>
          ${canDeactivate ? `<button type="button" class="btn-danger-sec" data-archivar-id="${esc(n.id)}">Quitar aviso</button>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

function renderHorarios() {
  const f = filtrosActuales();
  const filtrados = HORARIOS_ENTRENAMIENTO.filter(h => {
    if (f.actividad && f.actividad !== "General" && h.actividad !== f.actividad) return false;
    if (f.categoria && !String(h.categoria || "").toLowerCase().includes(f.categoria)) return false;
    if (f.equipo && !String(h.equipo || "").toLowerCase().includes(f.equipo)) return false;
    return true;
  });

  const cont = $("vista-horarios");
  if (!filtrados.length) {
    cont.innerHTML = `<div class="panel-card" style="text-align:center; color:var(--muted);">No hay horarios de entrenamiento cargados para ese filtro.</div>`;
    return;
  }

  cont.innerHTML = filtrados.map(h => `
    <article class="card-novedad">
      <div class="meta-top">
        <div class="badges-grupo">
          <span class="badge">${esc(h.actividad)}</span>
          <span class="badge">${esc(h.categoria)}${h.equipo ? " · " + esc(h.equipo) : ""}</span>
        </div>
      </div>
      <h2>${esc(h.dias)}</h2>
      <div class="datos-evento">
        <div class="datos-evento-meta">
          <span>⏰ ${esc(h.horario)}</span>
          <span>📍 ${esc(h.lugar)}</span>
        </div>
      </div>
    </article>
  `).join("");
}

function renderNotifEstado() {
  const lbl = $("notif-estado-lbl");
  const btn = $("btn-activar-notificaciones");
  const count = authState.session?.dispositivosCount || 0;
  if (!("Notification" in window)) {
    lbl.textContent = "Este navegador no admite notificaciones web.";
    btn.disabled = true;
    return;
  }
  btn.disabled = false;
  const perm = Notification.permission;
  const pushReady = Boolean(PUSH_CONFIG.messagingSenderId && PUSH_CONFIG.vapidKey);
  if (!pushReady) {
    lbl.textContent = "Las notificaciones todavía no están configuradas.";
    btn.disabled = true;
    return;
  }
  if (perm === "granted") {
    lbl.textContent = count > 0
      ? `Notificaciones activadas (${count} dispositivo registrado en tu cuenta).`
      : "Permiso concedido en este navegador. Tocá el botón para registrar este dispositivo en tu cuenta.";
  } else if (perm === "denied") {
    lbl.textContent = "Las notificaciones están bloqueadas en la configuración de este navegador.";
  } else {
    lbl.textContent = "Todavía no activaste las notificaciones en este navegador.";
  }
}

function renderAlertas() {
  const subs = authState.session?.suscripciones || [];
  const profile = authState.session?.profile || null;
  const canPublish = Boolean(profile?.canPublish);

  $("btn-abrir-publicar").classList.toggle("hidden", !canPublish);
  $("btn-atajo-publicar").classList.toggle("hidden", !canPublish);
  $("lbl-btn-alertas").textContent = subs.length ? `Mis alertas (${subs.length})` : "Mis alertas";
  $("btn-abrir-alertas").classList.toggle("activo", Boolean(profile && subs.length > 0));

  $("panel-cargando-sesion").classList.toggle("hidden", !authState.checking);
  $("panel-sin-login").classList.toggle("hidden", authState.checking || Boolean(profile));
  $("panel-con-login").classList.toggle("hidden", authState.checking || !profile);

  mostrarEstado($("estado-alertas"), bannerAlertasMensaje || (authState.authError ? { type: "error", text: authState.authError } : null));

  if (!profile) return;

  $("user-email-lbl").textContent = profile.email || profile.nombre || "";
  $("user-role-lbl").textContent = canPublish
    ? `Rol habilitado para publicar avisos (${profile.rol})`
    : "Cuenta personal para alertas";

  renderNotifEstado();

  const cont = $("lista-suscripciones");
  if (!subs.length) {
    cont.innerHTML = `<p style="font-size:0.88rem; color:var(--muted); margin:0.4rem 0 0;">Todavía no seguís ningún deporte, categoría o equipo.</p>`;
    return;
  }

  cont.innerHTML = subs.map(s => `
    <div class="sub-item">
      <div>
        <strong>${esc(s.actividad)}</strong>
        <div style="font-size:0.82rem; color:var(--muted);">
          ${s.categoria ? esc(s.categoria) : (s.actividad === "General" ? "Avisos generales del club" : "Todo el deporte")}
          ${s.equipo ? " · Equipo " + esc(s.equipo) : ""}
        </div>
      </div>
      <button type="button" class="btn-danger-sec" data-del-sub="${esc(s.id)}">Quitar</button>
    </div>
  `).join("");
}

async function cargarAvisos() {
  feedState.loading = true;
  feedState.error = "";
  renderAvisos();
  try {
    const avisos = await fetchPublicFeed();
    feedState = { loading: false, error: "", avisos };
    if (bannerAvisosMensaje?.type === "error") bannerAvisosMensaje = null;
  } catch (err) {
    feedState = { loading: false, error: err?.message || "No se pudieron cargar los avisos.", avisos: [] };
  }
  renderAvisos();
}

async function sincronizarSesion(firebaseUser, sdkError) {
  if (sdkError) {
    authState = { checking: false, user: null, session: null, authError: sdkError.message || "No se pudo inicializar el acceso con Google." };
    renderAlertas();
    renderAvisos();
    return;
  }
  if (!firebaseUser) {
    authState = { checking: false, user: null, session: null, authError: "" };
    renderAlertas();
    renderAvisos();
    return;
  }

  authState = { ...authState, checking: true, user: firebaseUser, authError: "" };
  renderAlertas();

  try {
    const session = await window.MuniGoogle.call("/api/comunidad/session", {});
    authState = { checking: false, user: firebaseUser, session, authError: "" };
    const areas = session.profile?.publishAreas || [];
    $("pub-actividad").innerHTML = (areas.length ? areas : ACTIVIDADES_AVISOS)
      .map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join("");
  } catch (err) {
    authState = { checking: false, user: firebaseUser, session: null, authError: err?.message || "No se pudo verificar tu sesión." };
  }
  renderAlertas();
  renderAvisos();
}

// Validación accesible de equipo sin categoría
function validarEquipoYCategoria(catInput, eqInput, errEl) {
  const cat = catInput.value.trim();
  const eq = eqInput.value.trim();
  if (eq && !cat) {
    const msg = "Indicá primero la categoría cuando completás un equipo.";
    eqInput.setCustomValidity(msg);
    eqInput.setAttribute("aria-invalid", "true");
    errEl.textContent = msg;
    return false;
  }
  eqInput.setCustomValidity("");
  eqInput.removeAttribute("aria-invalid");
  errEl.textContent = "";
  return true;
}

function limpiarErrorCampo(input, errEl) {
  input.setCustomValidity("");
  input.removeAttribute("aria-invalid");
  if (errEl) errEl.textContent = "";
}

function validarCampoRequerido(input, errEl, label) {
  const val = input.value.trim();
  if (val.length < 3) {
    const msg = `${label} debe tener al menos 3 caracteres.`;
    input.setCustomValidity(msg);
    input.setAttribute("aria-invalid", "true");
    errEl.textContent = msg;
    return false;
  }
  limpiarErrorCampo(input, errEl);
  return true;
}

function actualizarCamposPublicacion() {
  const esGeneral = $("pub-actividad").value === "General";
  $("pub-categoria").disabled = esGeneral;
  $("pub-equipo").disabled = esGeneral;
  if (esGeneral) {
    $("pub-categoria").value = "";
    $("pub-equipo").value = "";
    limpiarErrorCampo($("pub-equipo"), $("pub-eq-error"));
  }
}

// Navegación por pestañas y filtros
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    cambiarVista(btn.dataset.vista);
    if (btn.dataset.vista === "avisos") mostrarEstado($("estado-avisos"), bannerAvisosMensaje);
  });
});

$("btn-abrir-alertas").addEventListener("click", () => {
  cambiarVista("alertas");
  $("vista-alertas").scrollIntoView({ behavior: "smooth", block: "start" });
});

["filtro-actividad", "filtro-categoria", "filtro-equipo", "filtro-tipo"].forEach(id => {
  $(id).addEventListener("input", () => {
    renderAvisos();
    renderHorarios();
  });
});

// Login y Logout Google reales
$("google-login").addEventListener("click", async () => {
  bannerAlertasMensaje = null;
  mostrarEstado($("estado-alertas"), null);
  try {
    await window.MuniGoogle.login();
  } catch (err) {
    if (err?.code === "auth/popup-closed-by-user") return;
    bannerAlertasMensaje = { type: "error", text: err?.message || "No se pudo completar el ingreso con Google." };
    mostrarEstado($("estado-alertas"), bannerAlertasMensaje);
  }
});

$("btn-logout-comunidad").addEventListener("click", async () => {
  bannerAlertasMensaje = null;
  try {
    await window.MuniGoogle.logout();
  } catch (err) {
    bannerAlertasMensaje = { type: "error", text: err?.message || "No se pudo cerrar sesión." };
    mostrarEstado($("estado-alertas"), bannerAlertasMensaje);
  }
});

// Consentimiento explícito de notificaciones web
async function obtenerTokenDispositivo() {
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");
      if (PUSH_CONFIG.messagingSenderId && PUSH_CONFIG.vapidKey && window.MUNI_CONFIG?.firebase) {
        const [appMod, msgMod] = await Promise.all([
          import("https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging.js")
        ]);
        const fbConfig = { ...window.MUNI_CONFIG.firebase, messagingSenderId: PUSH_CONFIG.messagingSenderId };
        const fbApp = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(fbConfig, "comunidad-msg");
        const messaging = msgMod.getMessaging(fbApp);
        const fcmToken = await msgMod.getToken(messaging, {
          vapidKey: PUSH_CONFIG.vapidKey,
          serviceWorkerRegistration: reg
        });
        if (fcmToken) return { token: fcmToken, plataforma: "web-fcm" };
      }
    } catch (_) {
      // Continúa con canal web del navegador si FCM remoto aún no está disponible.
    }
  }
  throw Error("Las notificaciones web todavía no están configuradas.");
}

$("btn-activar-notificaciones").addEventListener("click", async () => {
  if (!("Notification" in window)) return;
  bannerAlertasMensaje = null;
  const btn = $("btn-activar-notificaciones");
  btn.disabled = true;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      bannerAlertasMensaje = { type: "info", text: "No se habilitó el permiso de notificaciones en este navegador." };
      renderAlertas();
      return;
    }
    const device = await obtenerTokenDispositivo();
    const res = await window.MuniGoogle.call("/api/comunidad/device", device);
    if (authState.session) authState.session.dispositivosCount = res.dispositivosCount || 1;
    bannerAlertasMensaje = {
      type: "ok",
      text: device.plataforma === "web-fcm"
        ? "Notificaciones activadas y dispositivo registrado correctamente."
        : "Permiso concedido y dispositivo registrado en tu cuenta."
    };
  } catch (err) {
    bannerAlertasMensaje = { type: "error", text: err?.message || "No se pudo registrar este dispositivo." };
  } finally {
    btn.disabled = false;
    renderAlertas();
  }
});

// Alta y baja segura de alertas en Supabase
$("sub-equipo").addEventListener("blur", () => validarEquipoYCategoria($("sub-categoria"), $("sub-equipo"), $("sub-eq-error")));
$("sub-categoria").addEventListener("blur", () => validarEquipoYCategoria($("sub-categoria"), $("sub-equipo"), $("sub-eq-error")));
$("sub-equipo").addEventListener("input", () => limpiarErrorCampo($("sub-equipo"), $("sub-eq-error")));
$("sub-categoria").addEventListener("input", () => limpiarErrorCampo($("sub-equipo"), $("sub-eq-error")));

$("form-suscripcion").addEventListener("submit", async e => {
  e.preventDefault();
  bannerAlertasMensaje = null;
  if (!validarEquipoYCategoria($("sub-categoria"), $("sub-equipo"), $("sub-eq-error"))) {
    $("sub-categoria").focus();
    return;
  }
  const btn = $("btn-guardar-sub");
  btn.disabled = true;
  try {
    const res = await window.MuniGoogle.call("/api/comunidad/subscribe", {
      actividad: $("sub-actividad").value,
      categoria: $("sub-categoria").value.trim(),
      equipo: $("sub-equipo").value.trim(),
      canal_push: true
    });
    if (authState.session) authState.session.suscripciones = res.suscripciones || [];
    $("sub-categoria").value = "";
    $("sub-equipo").value = "";
    bannerAlertasMensaje = { type: "ok", text: "Alerta guardada en tu cuenta." };
  } catch (err) {
    bannerAlertasMensaje = { type: "error", text: err?.message || "No se pudo guardar la alerta." };
  } finally {
    btn.disabled = false;
    renderAlertas();
  }
});

$("lista-suscripciones").addEventListener("click", async e => {
  const btn = e.target.closest("button[data-del-sub]");
  if (!btn) return;
  btn.disabled = true;
  bannerAlertasMensaje = null;
  try {
    const res = await window.MuniGoogle.call("/api/comunidad/unsubscribe", { id: btn.dataset.delSub });
    if (authState.session) authState.session.suscripciones = res.suscripciones || [];
    bannerAlertasMensaje = { type: "ok", text: "Alerta quitada de tu cuenta." };
  } catch (err) {
    btn.disabled = false;
    bannerAlertasMensaje = { type: "error", text: err?.message || "No se pudo quitar la alerta." };
  }
  renderAlertas();
});

// Confirmación en dos toques para archivar avisos publicados (solo coordinación)
$("vista-avisos").addEventListener("click", async e => {
  const btn = e.target.closest("button[data-archivar-id]");
  if (!btn) return;
  if (btn.dataset.confirmPending !== "true") {
    btn.dataset.confirmPending = "true";
    btn.textContent = "Confirmar baja";
    setTimeout(() => {
      if (btn.isConnected && btn.dataset.confirmPending === "true") {
        btn.dataset.confirmPending = "";
        btn.textContent = "Quitar aviso";
      }
    }, 4500);
    return;
  }
  btn.disabled = true;
  try {
    await window.MuniGoogle.call("/api/comunidad/deactivate", { id: btn.dataset.archivarId });
    bannerAvisosMensaje = { type: "ok", text: "Aviso archivado." };
    await cargarAvisos();
  } catch (err) {
    btn.disabled = false;
    btn.dataset.confirmPending = "";
    btn.textContent = "Quitar aviso";
    bannerAvisosMensaje = { type: "error", text: err?.message || "No se pudo archivar el aviso." };
    mostrarEstado($("estado-avisos"), bannerAvisosMensaje);
  }
});

// Modal Publicar Aviso (coordinadores autorizados)
const modalPublicar = $("modal-publicar");

function abrirModalPublicar() {
  if (!authState.session?.profile?.canPublish) return;
  mostrarEstado($("estado-publicar"), null);
  actualizarCamposPublicacion();
  modalPublicar.showModal();
}

$("btn-abrir-publicar").addEventListener("click", abrirModalPublicar);
$("btn-atajo-publicar").addEventListener("click", abrirModalPublicar);
$("btn-cerrar-modal-publicar").addEventListener("click", () => modalPublicar.close("cancel"));
$("btn-cancelar-publicar").addEventListener("click", () => modalPublicar.close("cancel"));
modalPublicar.addEventListener("close", () => { modalPublicar.returnValue = ""; });

$("pub-actividad").addEventListener("change", actualizarCamposPublicacion);
$("pub-titulo").addEventListener("blur", () => validarCampoRequerido($("pub-titulo"), $("pub-titulo-error"), "El título"));
$("pub-titulo").addEventListener("input", () => limpiarErrorCampo($("pub-titulo"), $("pub-titulo-error")));
$("pub-detalle").addEventListener("blur", () => validarCampoRequerido($("pub-detalle"), $("pub-detalle-error"), "El detalle"));
$("pub-detalle").addEventListener("input", () => limpiarErrorCampo($("pub-detalle"), $("pub-detalle-error")));
$("pub-equipo").addEventListener("blur", () => validarEquipoYCategoria($("pub-categoria"), $("pub-equipo"), $("pub-eq-error")));
$("pub-categoria").addEventListener("blur", () => validarEquipoYCategoria($("pub-categoria"), $("pub-equipo"), $("pub-eq-error")));
$("pub-equipo").addEventListener("input", () => limpiarErrorCampo($("pub-equipo"), $("pub-eq-error")));
$("pub-categoria").addEventListener("input", () => limpiarErrorCampo($("pub-equipo"), $("pub-eq-error")));

$("form-publicar").addEventListener("submit", async e => {
  e.preventDefault();
  mostrarEstado($("estado-publicar"), null);

  const okEq = validarEquipoYCategoria($("pub-categoria"), $("pub-equipo"), $("pub-eq-error"));
  const okTitulo = validarCampoRequerido($("pub-titulo"), $("pub-titulo-error"), "El título");
  const okDetalle = validarCampoRequerido($("pub-detalle"), $("pub-detalle-error"), "El detalle");

  if (!okEq || !okTitulo || !okDetalle) {
    const firstInvalid = $("form-publicar").querySelector('[aria-invalid="true"]');
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  const btn = $("btn-submit-publicar");
  btn.disabled = true;
  try {
    const res = await window.MuniGoogle.call("/api/comunidad/publish", {
      tipo: $("pub-tipo").value,
      actividad: $("pub-actividad").value,
      categoria: $("pub-categoria").value.trim(),
      equipo: $("pub-equipo").value.trim(),
      titulo: $("pub-titulo").value.trim(),
      detalle: $("pub-detalle").value.trim(),
      fecha_evento: $("pub-fecha").value || null,
      hora_evento: $("pub-hora").value.trim(),
      lugar: $("pub-lugar").value.trim(),
      urgente: $("pub-urgente").checked,
      enviar_notificacion: $("pub-notificar").checked
    });

    $("form-publicar").reset();
    actualizarCamposPublicacion();
    modalPublicar.close("published");
    cambiarVista("avisos");

    const nInfo = res.notifications;
    let txt = "Aviso publicado.";
    if (nInfo?.requested) {
      if (nInfo.sent > 0) txt = `Aviso publicado (${nInfo.sent} notificación${nInfo.sent === 1 ? "" : "es"} enviada${nInfo.sent === 1 ? "" : "s"}).`;
      else if (nInfo.recipients === 0) txt = "Aviso publicado (sin dispositivos suscriptos para este filtro).";
      else txt = "Aviso publicado (el envío push quedó registrado con pendientes de entrega).";
    }
    bannerAvisosMensaje = { type: "ok", text: txt };
    await cargarAvisos();
  } catch (err) {
    mostrarEstado($("estado-publicar"), { type: "error", text: err?.message || "No se pudo publicar el aviso." });
  } finally {
    btn.disabled = false;
  }
});

// Inicialización
cambiarVista("avisos");
renderHorarios();
cargarAvisos();

if (window.MuniGoogle && typeof window.MuniGoogle.observe === "function") {
  window.MuniGoogle.observe(sincronizarSesion);
} else {
  authState = { checking: false, user: null, session: null, authError: "Acceso con Google no disponible en este momento." };
  renderAlertas();
}
