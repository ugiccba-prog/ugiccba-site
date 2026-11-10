(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Muni360Sync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class ApiError extends Error {
    constructor(message, code) { super(message); this.code = code; }
  }
  const normalized = v => String(v||'').trim().toLowerCase();
  const rosterFor = (snapshot,payload) => (snapshot.padron||[]).filter(p=>normalized(p.categoria)===normalized(payload.categoria) && normalized(p.equipo)===normalized(payload.equipo)).map(p=>[p.id,p.jugador]);
  const keyFor = d => ['DUA','LEGAJO','RECONOCIMIENTO'].includes(d.tipo) ? JSON.stringify([d.tipo==='DUA'?'DUA':'LEGAJO',d.subjectId]) : JSON.stringify([d.tipo, normalized(d.categoria), normalized(d.equipo), d.fecha || '', normalized(d.jugador)]);
  const splitAverage = (evaluaciones, comunes) => {
    const groups = { tecnico: [], formativo: [] };
    evaluaciones.forEach(e => Object.entries(e.notas || {}).forEach(([g, n]) => {
      if (typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 10) groups[comunes.includes(g) ? 'formativo' : 'tecnico'].push(n);
    }));
    return Object.fromEntries(Object.entries(groups).map(([g, vals]) => [g, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null]));
  };
  class Client {
    constructor({ url, fetch: fetcher, storage, session, onStatus = () => {}, id = () => crypto.randomUUID(), lock, getToken, transport = 'http' }) {
      this.url = url; this.fetch = fetcher; this.storage = storage; this.session = session; this.onStatus = onStatus; this.id = id; this.getToken = getToken; this.transport = transport;
      this.storageKey = 'muni360_v2_pending_' + session.usuario;
      this.queue = JSON.parse(storage.getItem(this.storageKey) || '[]');
      this.snapshots = {}; this.readVersions = {}; this.running = null; this.stopped = false;
      this.lock = lock || (fn => {
        if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(this.storageKey, fn);
        throw new ApiError('Este navegador no permite guardar pendientes de forma segura entre pestañas. Actualizalo.', 'NAVEGADOR');
      });
    }
    async request(payload, query) {
      if (this.stopped || this.session.expiresAt <= Date.now()) throw new ApiError('La sesión venció. Volvé a ingresar para enviar pendientes.', 'SESION');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
      let response;
      try {
        let token;try{token=this.getToken?await this.getToken():this.session.token;}catch(e){throw new ApiError('No se pudo verificar Google. Reintentá con conexión.',String(e.code||'').includes('network')?'RED':'SESION');}
        const data=query?{...query,tipo:'LECTURA'}:{...payload};delete data.token;
        if(this.transport==='apps-script'){
          response=await this.fetch(this.url,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...data,path:'/api/operations',idToken:token,accessVersion:this.session.versionUsuario})});
        }else response=await this.fetch(this.url,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(data)});
      } finally { clearTimeout(timer); }

      let result;
      try { result = await response.json(); } catch (_) { throw new ApiError('Respuesta inválida del servidor.', 'RED'); }
      if (!response.ok && !result.codigo) throw new ApiError('No se pudo contactar al servidor.','RED');
      if (result.apiVersion !== 2 || this.transport==='apps-script' && result.backendVersion!=='apps-script-3.0.0') throw new ApiError('La actualización de Google todavía no está instalada. Contactá a Dirección UGI.', 'VERSION');
      if (!result.ok) throw new ApiError(result.error || 'El servidor rechazó la carga.', result.codigo || 'SERVIDOR');
      return result;
    }
    async read(deporte, temporada) {
      const sequence=temporada?null:(this.readVersions[deporte]||0)+1;
      if(!temporada)this.readVersions[deporte]=sequence;
      const result = await this.request(null, { deporte, ...(temporada ? { temporada } : {}) });
      if (!temporada && !this.stopped && this.readVersions[deporte]===sequence) this.snapshots[deporte] = result;
      return result;
    }
    persist() { this.storage.setItem(this.storageKey, JSON.stringify(this.queue)); }
    status(message) { this.onStatus({ count: this.queue.length, message, blocked: this.queue.find(x => x.error) || null }); }
    async enqueue(payload) {
      if(this.session.rol==='Consulta')throw new ApiError('Tu acceso es de consulta.','PERMISOS');
      if (this.stopped) throw new ApiError('Volvé a ingresar.', 'SESION');
      const snapshot = this.snapshots[payload.deporte];
      if (!snapshot) throw new ApiError('Primero conectá y actualizá esta actividad.', 'SIN_DATOS');
      if (payload.tipo === 'RESET_DATOS' && this.queue.length) throw new ApiError('Enviá las cargas pendientes antes de archivar.', 'PENDIENTES');
      let entry;
      await this.lock(async () => {
        this.queue = JSON.parse(this.storage.getItem(this.storageKey) || '[]');
        const key = keyFor(payload), preceding = this.queue.filter(x => x.payload.deporte === payload.deporte && keyFor(x.payload) === key).length;
        entry = { payload: { ...payload, requestId: this.id(), revision: (snapshot.versiones[key] || 0) + preceding, temporada: snapshot.temporada, ...(this.transport==='apps-script'?{roster:rosterFor(snapshot,payload),rosterRevision:snapshot.versiones[keyFor({tipo:'PADRON',categoria:payload.categoria,equipo:payload.equipo})]||0}:{}) }, usuarioVersion: this.session.versionUsuario };
        this.queue.push(entry);
        try { this.persist(); } catch (e) { this.queue.pop(); throw new ApiError('No hay espacio para guardar la carga pendiente. No cierres esta pantalla.', 'ALMACENAMIENTO'); }
        this.status('Carga pendiente de confirmación.');
      });
      await this.flush();
      return !this.queue.some(x => x.payload.requestId === entry.payload.requestId);
    }
    async flush() {
      if (this.running) return this.running;
      this.running = this.lock(async () => {
        this.queue = JSON.parse(this.storage.getItem(this.storageKey) || '[]');
        return this.drain();
      }).finally(() => { this.running = null; });
      return this.running;
    }
    async drain() {
      while (!this.stopped && this.queue.length) {
        const entry = this.queue[0];
        if (entry.error) { this.status(entry.error); return; }
        if (entry.usuarioVersion !== this.session.versionUsuario) {
          entry.error = 'Cambió tu acceso. Revisá esta carga antes de reenviarla.'; entry.code = 'CONFLICTO'; this.persist(); this.status(entry.error); return;
        }
        try {
          const result = await this.request(entry.payload);
          if (this.stopped) return;
          if (result.requestId !== entry.payload.requestId) throw new ApiError('No se pudo verificar la confirmación.', 'VERSION');
          const snap = this.snapshots[entry.payload.deporte];
          if (snap) snap.versiones[keyFor(entry.payload)] = result.revision;
          this.queue.shift(); this.persist(); this.status(result.sheetsStatus==='pending'?'Guardado en Sheets privado. Vistas de actividad pendientes de actualización.':'Guardado y confirmado.');
        } catch (e) {
          if (e.code && !['RED', 'SERVIDOR'].includes(e.code)) {
            entry.error = e.message; entry.code = e.code; this.persist(); this.status(e.message); return;
          }
          this.status('Sin confirmar. Se reintentará al recuperar conexión; no borres los datos del navegador.'); return;
        }
      }
    }
    async retry() {
      await this.lock(async () => {
        this.queue = JSON.parse(this.storage.getItem(this.storageKey) || '[]');
        const entry = this.queue[0];
        if (entry && entry.code === 'SESION' && this.session.expiresAt > Date.now()) { delete entry.error; delete entry.code; this.persist(); }
      });
      return this.flush();
    }
    async reviewAndRetry() {
      await this.lock(async () => {
      this.queue = JSON.parse(this.storage.getItem(this.storageKey) || '[]');
      const entry = this.queue[0]; if (!entry) return;
      if(this.transport==='apps-script'){
        const receipt=await this.request({tipo:'RESULTADO',deporte:entry.payload.deporte,requestId:entry.payload.requestId});
        if(receipt.committed){this.queue.shift();this.persist();this.status('La carga ya estaba confirmada en Google.');return;}
      }
      const snapshot = await this.read(entry.payload.deporte);
      if (entry.payload.temporada !== snapshot.temporada) throw new ApiError('La carga pertenece a una temporada anterior. Descartala después de copiar los datos que necesites.', 'CONFLICTO');
      if(this.transport==='apps-script'){entry.payload.roster=rosterFor(snapshot,entry.payload);entry.payload.rosterRevision=snapshot.versiones[keyFor({tipo:'PADRON',categoria:entry.payload.categoria,equipo:entry.payload.equipo})]||0;}
      entry.payload.revision = snapshot.versiones[keyFor(entry.payload)] || 0;
      entry.payload.requestId = this.id(); entry.usuarioVersion = this.session.versionUsuario;
      delete entry.error; delete entry.code;
      // Mantener la secuencia de las siguientes operaciones sobre el mismo recurso.
      let rev = entry.payload.revision;
      this.queue.forEach(x => { if (x.payload.deporte === entry.payload.deporte && keyFor(x.payload) === keyFor(entry.payload)) x.payload.revision = rev++; });
      this.persist();
      });
      return this.flush();
    }
    async discardFirst() {
      await this.lock(async () => {
      this.queue = JSON.parse(this.storage.getItem(this.storageKey) || '[]');
      const discarded = this.queue.shift();
      if (discarded) this.queue.forEach(x => { if (x.payload.deporte === discarded.payload.deporte && keyFor(x.payload) === keyFor(discarded.payload)) x.payload.revision--; });
      this.persist(); this.status('Carga descartada por el usuario.');
      });
    }
    stop() { this.stopped = true; this.snapshots = {}; }
  }
  return { Client, ApiError, keyFor, splitAverage };
});
