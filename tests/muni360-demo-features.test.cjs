'use strict';
const {readPortal}=require('./helpers/portal-source.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const demoRuntimeCode = fs.readFileSync(path.join(root, 'assets/scripts/muni360-demo-runtime.js'), 'utf8');
const dashboardCode = fs.readFileSync(path.join(root, 'assets/scripts/muni360-dashboard.js'), 'utf8');
const inteligenciaCode = fs.readFileSync(path.join(root, 'assets/scripts/muni360-inteligencia.js'), 'utf8');
const surveysCode = fs.readFileSync(path.join(root, 'assets/scripts/muni360-surveys.js'), 'utf8');

function makeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k)
  };
}

function unesc(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function createMiniDom() {
  const VOID = new Set(['input', 'br', 'hr', 'img', 'meta', 'link']);
  class MiniElement {
    constructor(tag) {
      this.tagName = tag.toLowerCase();
      this.id = '';
      this.attrs = {};
      this.dataset = {};
      this.classes = new Set();
      this.children = [];
      this.parentNode = null;
      this._text = '';
      this._value = '';
      this.checked = false;
      this.disabled = false;
      this.hidden = false;
      this.open = false;
      this.listeners = {};
      this.onclick = null;
      this.onchange = null;
      this.oninput = null;
      this.classList = {
        add: (...cs) => cs.forEach(c => this.classes.add(c)),
        remove: (...cs) => cs.forEach(c => this.classes.delete(c)),
        toggle: (c, force) => {
          const on = force === undefined ? !this.classes.has(c) : Boolean(force);
          if (on) this.classes.add(c); else this.classes.delete(c);
          return on;
        },
        contains: c => this.classes.has(c)
      };
    }
    get isConnected() {
      let cur = this;
      while (cur) {
        if (cur === doc.body || cur === doc.head) return true;
        cur = cur.parentNode;
      }
      return false;
    }
    set className(val) { this.classes = new Set(String(val || '').split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classes].join(' '); }
    setAttribute(name, val) {
      const k = String(name).toLowerCase(), v = String(val ?? '');
      this.attrs[k] = v;
      if (k === 'id') this.id = v;
      else if (k === 'class') this.className = v;
      else if (k === 'value') this._value = v;
      else if (k === 'checked') this.checked = true;
      else if (k === 'hidden') this.hidden = true;
      else if (k === 'disabled') this.disabled = true;
      else if (k.startsWith('data-')) {
        this.dataset[k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = v;
      }
    }
    get options() { return this.tagName === 'select' ? this.children.filter(c => c.tagName === 'option') : []; }
    get value() {
      if (this.tagName === 'select') {
        const opts = this.options;
        return opts.some(o => o.value === this._value) ? this._value : (opts[0] ? opts[0].value : '');
      }
      return this._value;
    }
    set value(v) { this._value = String(v ?? ''); }
    get textContent() { return !this.children.length ? this._text : this._text + this.children.map(c => c.textContent).join(''); }
    set textContent(v) { this.children = []; this._text = String(v ?? ''); }
    append(...nodes) { for (const n of nodes) if (n instanceof MiniElement) { n.parentNode = this; this.children.push(n); } }
    prepend(...nodes) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n instanceof MiniElement) { n.parentNode = this; this.children.unshift(n); }
      }
    }
    replaceChildren() { this.children = []; this._text = ''; }
    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter(c => c !== this);
      this.parentNode = null;
    }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatch(type) {
      const h = this['on' + type];
      if (typeof h === 'function') h({ target: this });
      for (const fn of this.listeners[type] || []) fn({ target: this });
    }
    click() { if (!this.disabled) this.dispatch('click'); }
    focus() {}
    scrollIntoView() {}
    closest(sel) {
      let cur = this;
      while (cur) {
        if (cur.matches && cur.matches(sel)) return cur;
        cur = cur.parentNode;
      }
      return null;
    }
    set innerHTML(html) {
      this.children = [];
      this._text = '';
      parseInto(this, String(html || ''));
      if (this.tagName === 'select') {
        const sel = this.options.find(o => 'selected' in o.attrs);
        this._value = sel ? sel.value : (this.options[0] ? this.options[0].value : '');
      }
    }
    matches(selector) {
      const s = selector.trim();
      if (s.startsWith('#')) return this.id === s.slice(1);
      if (s.startsWith('.')) return this.classes.has(s.slice(1));
      if (s === '[data-tpl]') return 'data-tpl' in this.attrs;
      const mAttr = /^([a-z0-9*]+)?\[([a-z0-9-]+)(?:="([^"]*)")?\]$/i.exec(s);
      if (mAttr) {
        if (mAttr[1] && mAttr[1] !== '*' && this.tagName !== mAttr[1].toLowerCase()) return false;
        if (!(mAttr[2] in this.attrs)) return false;
        return mAttr[3] === undefined || this.attrs[mAttr[2]] === mAttr[3];
      }
      return this.tagName === s.toLowerCase();
    }
    querySelectorAll(selector) {
      const parts = selector.split(/\s+/).filter(Boolean);
      const findMatches = (node, sel) => {
        const out = [];
        for (const c of node.children) {
          if (c.matches(sel)) out.push(c);
          out.push(...findMatches(c, sel));
        }
        return out;
      };
      if (parts.length <= 1) return findMatches(this, selector);
      let current = [this];
      for (const p of parts) {
        const next = [];
        for (const n of current) next.push(...findMatches(n, p));
        current = next;
      }
      return current;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  function parseInto(rootEl, html) {
    const stack = [rootEl];
    const tokenRe = /<(\/?)([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
    let m;
    while ((m = tokenRe.exec(html))) {
      const top = stack[stack.length - 1];
      if (m[4] !== undefined) {
        const txt = unesc(m[4]);
        if (top) {
          top._text += txt;
          if (top.tagName === 'option' && !('value' in top.attrs)) top._value = top._text;
        }
        continue;
      }
      const isClose = m[1] === '/', tag = m[2].toLowerCase(), rawAttrs = m[3] || '';
      if (isClose) {
        for (let i = stack.length - 1; i >= 1; i--) {
          if (stack[i].tagName === tag) { stack.length = i; break; }
        }
        continue;
      }
      const el = new MiniElement(tag);
      const attrRe = /([a-zA-Z0-9-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
      let am;
      while ((am = attrRe.exec(rawAttrs))) {
        const val = am[2] !== undefined ? am[2] : (am[3] !== undefined ? am[3] : '');
        el.setAttribute(am[1], unesc(val));
      }
      if (top) top.append(el);
      if (!VOID.has(tag) && !rawAttrs.trim().endsWith('/')) stack.push(el);
    }
  }
  const doc = {
    head: new MiniElement('head'),
    body: new MiniElement('body'),
    createElement: tag => new MiniElement(tag),
    getElementById: id => doc.body.querySelector('#' + id)
  };
  const appScreen = new MiniElement('main'); appScreen.id = 'app-screen';
  const tabInt = new MiniElement('section'); tabInt.id = 'tab-inteligencia';
  const tabEnc = new MiniElement('section'); tabEnc.id = 'tab-encuestas';
  const tabBtnEnc = new MiniElement('button'); tabBtnEnc.id = 'tab-btn-encuestas';
  appScreen.append(tabInt, tabEnc);
  doc.body.append(tabBtnEnc, appScreen);
  return { doc, appScreen, tabInt, tabEnc };
}

test('MuniDemoRuntime soporta dashboard, cuestionarios, respuestas anónimas, scan e IA local', async () => {
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  const ctx = { localStorage, sessionStorage, console, Math, Date, JSON, Intl };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(demoRuntimeCode, ctx);

  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  sessionStorage.setItem('muni360_cache_Básquet Caballeros', JSON.stringify({
    padron: [
      { categoria: 'Sub-12 Demo', equipo: 'A', jugador: 'Acosta, Mateo' },
      { categoria: 'Sub-12 Demo', equipo: 'B', jugador: 'Sosa, Felipe' }
    ],
    asistencia: [
      { fecha: today, categoria: 'Sub-12 Demo', equipo: 'A', jugador: 'Acosta, Mateo', estado: 'P | Sem:V' },
      { fecha: today, categoria: 'Sub-12 Demo', equipo: 'B', jugador: 'Sosa, Felipe', estado: 'A | Sem:R' }
    ],
    evaluaciones: []
  }));

  const runtime = ctx.window.MuniDemoRuntime;
  runtime.reset();

  const session = {
    usuario: 'demo',
    rol: 'Dirección UGI',
    profeNombre: 'Juan Machado',
    esAdminTotal: true,
    modoDemo: true,
    areas: ['Básquet Caballeros', 'Hockey sobre Césped Damas']
  };

  // Dashboard
  const dash = await runtime.call('/api/dashboard', { days: 30, activities: ['Básquet Caballeros'] }, session);
  assert.equal(dash.ok, true);
  assert.equal(dash.activities.length, 1);
  assert.equal(dash.activities[0].inscripciones, 2);
  assert.equal(dash.activities[0].gruposDetalle.length, 2);

  // Crear cuestionario nuevo en demo, simular respuesta baja y detectar con /api/inteligencia/scan
  const created = await runtime.call('/api/surveys/create', {
    activity: 'Básquet Caballeros',
    categoria: 'Sub-12 Demo',
    equipo: 'B',
    title: 'Encuesta test demo',
    questions: [{ id: 'q1', type: 'scale', label: '¿Cómo te sentís?', required: true }]
  }, session);
  assert.equal(created.ok, true);
  assert.ok(created.survey.public_code.startsWith('demo_'));

  // Simular envío anónimo desde /muni360/encuesta/?c=...&demo=1
  const stored = JSON.parse(localStorage.getItem(runtime.SURVEYS_KEY));
  const target = stored.find(s => s.public_code === created.survey.public_code);
  target.responses.push({ q1: 1 });
  localStorage.setItem(runtime.SURVEYS_KEY, JSON.stringify(stored));

  const scan = await runtime.call('/api/inteligencia/scan', { activity: 'Básquet Caballeros' }, session);
  assert.equal(scan.ok, true);
  assert.ok(scan.cases.some(c => c.rule_code === 'CUESTIONARIO_ALERTA' && c.equipo === 'B'));

  // Actualizar estado + nota e invocar IA demo
  const alertCase = scan.cases.find(c => c.rule_code === 'CUESTIONARIO_ALERTA' && c.equipo === 'B');
  const upd = await runtime.call('/api/inteligencia/update', {
    caseId: alertCase.id,
    status: 'intervenida',
    note: 'Hablamos con el grupo'
  }, session);
  assert.equal(upd.case.status, 'intervenida');
  assert.equal(upd.case.notes[0].note, 'Hablamos con el grupo');

  const ai = await runtime.call('/api/inteligencia/ai', { caseId: alertCase.id }, session);
  assert.equal(ai.ok, true);
  assert.equal(ai.source, 'ia');
  assert.match(ai.analysis, /Encuesta test demo/);

  runtime.clear();
  assert.equal(localStorage.getItem(runtime.SURVEYS_KEY), null);
  assert.equal(localStorage.getItem(runtime.CASES_KEY), null);
});

test('Dashboard, Inteligencia y Cuestionarios funcionan en modoDemo sin llamar a MuniGoogle y bloquean rol Profe', async () => {
  const { doc } = createMiniDom();
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  let googleCalls = 0;

  const ctx = {
    document: doc,
    localStorage,
    sessionStorage,
    location: { origin: 'https://ugiccba.com.ar' },
    console,
    setTimeout,
    clearTimeout,
    Math,
    Date,
    JSON,
    Intl,
    MuniGoogle: {
      async call() {
        googleCalls++;
        throw new Error('No debe llamarse en modoDemo');
      }
    },
    MuniPortalGroups: () => ({
      activity: 'Básquet Caballeros',
      groups: [
        { categoria: 'Sub-12 Demo', equipo: 'A' },
        { categoria: 'Sub-12 Demo', equipo: 'B' },
        { categoria: 'Sub-14', equipo: 'A' }
      ]
    })
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(demoRuntimeCode, ctx);
  vm.runInContext(dashboardCode, ctx);
  vm.runInContext(inteligenciaCode, ctx);
  vm.runInContext(surveysCode, ctx);

  ctx.window.MuniDemoRuntime.reset();

  // Rol Profe incluso en modoDemo NO monta módulos de coordinación/dirección
  ctx.window.MuniDashboard.mount({ usuario: 'demo', rol: 'Profe', modoDemo: true, esAdminTotal: false, areas: ['Básquet Caballeros'] });
  ctx.window.MuniInteligencia.mount({ usuario: 'demo', rol: 'Profe', modoDemo: true, esAdminTotal: false, areas: ['Básquet Caballeros'] });
  ctx.window.MuniSurveys.mount({ usuario: 'demo', rol: 'Profe', modoDemo: true, esAdminTotal: false, areas: ['Básquet Caballeros'] });
  assert.equal(doc.getElementById('management-panel'), null);
  assert.equal(doc.getElementById('inteligencia-panel'), null);
  assert.equal(doc.getElementById('surveys-panel'), null);

  // Dirección UGI en modoDemo monta los 3 módulos localmente
  const demoSession = {
    usuario: 'demo',
    rol: 'Dirección UGI',
    profeNombre: 'Juan Machado',
    esAdminTotal: true,
    modoDemo: true,
    areas: ['Básquet Caballeros', 'Hockey sobre Césped Damas']
  };
  ctx.window.MuniDashboard.mount(demoSession);
  ctx.window.MuniInteligencia.mount(demoSession);
  ctx.window.MuniSurveys.mount(demoSession);
  ctx.window.MuniSurveys.open();

  const flush = () => new Promise(r => setImmediate(r));
  await flush();
  await flush();

  assert.ok(doc.getElementById('management-panel'));
  assert.ok(doc.getElementById('inteligencia-panel'));
  assert.ok(doc.getElementById('surveys-panel'));
  assert.match(doc.getElementById('mi-status-text').textContent, /Demostración local/);
  assert.ok(doc.getElementById('mi-cases').querySelectorAll('.mi-case').length >= 3);

  // Enlaces generados en demo incluyen &demo=1
  const firstSurveyUrl = doc.getElementById('ms-list').querySelector('.ms-link-row input').value;
  assert.match(firstSurveyUrl, /demo=1/);

  // Desplegables y selección múltiple funcionan en demo
  assert.deepEqual(doc.getElementById('ms-categoria').options.map(o => o.value), ['', 'Sub-12 Demo', 'Sub-14']);
  const btnMulti = doc.body.querySelector('button[data-scope-mode="multi"]');
  btnMulti.click();
  doc.getElementById('ms-multi-all').click();
  assert.equal(doc.getElementById('ms-multi-count').textContent, '3 de 3 equipo(s) seleccionados');

  // Consultar panel de gestión en demo
  doc.getElementById('mm-update').click();
  await flush();
  assert.match(doc.getElementById('mm-status').textContent, /Demostración/);

  // Resumen IA en demo funciona localmente
  doc.getElementById('mi-ai-btn').click();
  await flush();
  assert.equal(doc.getElementById('mi-ai-box').hidden, false);
  assert.match(doc.getElementById('mi-ai-box').textContent, /Panorama activo \(Demo\)/);

  assert.equal(googleCalls, 0);
});

test('los portales y encuesta.html enlazan el runtime de demo y soportan enlaces ?demo=1', () => {
  const deportes = readPortal(path.join(root, 'apps/muni360/source/deportes/index.html'));
  const colonia = readPortal(path.join(root, 'apps/muni360/source/colonia/index.html'));
  const encuesta = fs.readFileSync(path.join(root, 'apps/muni360/source/encuesta/index.html'), 'utf8');

  for (const html of [deportes, colonia]) {
    assert.match(html, /muni360-demo-runtime\.js/);
    assert.match(html, /window\.MuniDemoRuntime\?\.reset\?\.\(\)/);
    assert.match(html, /window\.MuniDemoRuntime\?\.clear\?\.\(\)/);
  }
  assert.match(encuesta, /muni360_demo_surveys_v1/);
  assert.match(encuesta, /Modo Demo · 100% anónimo/);
});
