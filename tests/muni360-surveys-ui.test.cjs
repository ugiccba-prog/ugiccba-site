'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const surveysScript = fs.readFileSync(path.join(root, 'assets/scripts/muni360-surveys.js'), 'utf8');

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
          if (on) this.classes.add(c);
          else this.classes.delete(c);
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

    set className(val) {
      this.classes = new Set(String(val || '').split(/\s+/).filter(Boolean));
    }
    get className() {
      return [...this.classes].join(' ');
    }

    setAttribute(name, val) {
      const k = String(name).toLowerCase();
      const v = String(val ?? '');
      this.attrs[k] = v;
      if (k === 'id') this.id = v;
      else if (k === 'class') this.className = v;
      else if (k === 'value') this._value = v;
      else if (k === 'checked') this.checked = true;
      else if (k === 'hidden') this.hidden = true;
      else if (k === 'disabled') this.disabled = true;
      else if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        this.dataset[camel] = v;
      }
    }

    getAttribute(name) {
      const k = String(name).toLowerCase();
      return k in this.attrs ? this.attrs[k] : null;
    }

    get options() {
      if (this.tagName !== 'select') return [];
      return this.children.filter(c => c.tagName === 'option');
    }

    get value() {
      if (this.tagName === 'select') {
        const opts = this.options;
        if (opts.some(o => o.value === this._value)) return this._value;
        return opts[0] ? opts[0].value : '';
      }
      return this._value;
    }

    set value(v) {
      this._value = String(v ?? '');
    }

    get textContent() {
      if (!this.children.length) return this._text;
      return this._text + this.children.map(c => c.textContent).join('');
    }

    set textContent(v) {
      this.children = [];
      this._text = String(v ?? '');
    }

    append(...nodes) {
      for (const n of nodes) {
        if (n instanceof MiniElement) {
          n.parentNode = this;
          this.children.push(n);
        }
      }
    }

    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter(c => c !== this);
      this.parentNode = null;
    }

    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    }

    dispatch(type) {
      const handler = this['on' + type];
      if (typeof handler === 'function') handler({ target: this });
      for (const fn of this.listeners[type] || []) fn({ target: this });
    }

    click() {
      if (this.disabled) return;
      this.dispatch('click');
    }

    focus() {}
    scrollIntoView() {}

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
      const out = [];
      const walk = node => {
        for (const c of node.children) {
          if (c.matches(selector)) out.push(c);
          walk(c);
        }
      };
      walk(this);
      return out;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
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
          if (top.tagName === 'option' && !('value' in top.attrs)) {
            top._value = top._text;
          }
        }
        continue;
      }
      const isClose = m[1] === '/';
      const tag = m[2].toLowerCase();
      const rawAttrs = m[3] || '';
      if (isClose) {
        for (let i = stack.length - 1; i >= 1; i--) {
          if (stack[i].tagName === tag) {
            stack.length = i;
            break;
          }
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
      if (!VOID.has(tag) && !rawAttrs.trim().endsWith('/')) {
        stack.push(el);
      }
    }
  }

  const doc = {
    head: new MiniElement('head'),
    body: new MiniElement('body'),
    createElement: tag => new MiniElement(tag),
    getElementById: id => doc.body.querySelector('#' + id)
  };
  const tabEnc = new MiniElement('section');
  tabEnc.id = 'tab-encuestas';
  const tabBtnEnc = new MiniElement('button');
  tabBtnEnc.id = 'tab-btn-encuestas';
  doc.body.append(tabBtnEnc, tabEnc);
  return { doc, tabEnc, tabBtnEnc };
}

function setupHarness({ areas = ['Básquet Damas', 'Vóley Caballeros'], portalGroupsFn = null, dashboardGroups = {}, existingSurveys = [] } = {}) {
  const { doc, tabEnc, tabBtnEnc } = createMiniDom();
  const calls = [];
  const createdPayloads = [];

  const ctx = {
    document: doc,
    location: { origin: 'https://ugiccba.com.ar' },
    console,
    setTimeout,
    clearTimeout,
    MuniGoogle: {
      async call(apiPath, body = {}) {
        calls.push({ path: apiPath, body });
        if (apiPath === '/api/surveys/list') {
          return { ok: true, surveys: existingSurveys };
        }
        if (apiPath === '/api/dashboard') {
          const act = body.activities?.[0];
          return {
            ok: true,
            activities: [{ activity: act, gruposDetalle: dashboardGroups[act] || [] }]
          };
        }
        if (apiPath === '/api/surveys/create') {
          createdPayloads.push(body);
          return { ok: true, survey: { id: 'sv-' + createdPayloads.length, public_code: 'abc123456' } };
        }
        return { ok: true };
      }
    }
  };
  ctx.window = ctx;
  if (portalGroupsFn) ctx.window.MuniPortalGroups = portalGroupsFn;

  vm.createContext(ctx);
  vm.runInContext(surveysScript, ctx);
  ctx.window.MuniSurveys.mount({
    usuario: 'coord-1',
    rol: 'Coordinación',
    areas,
    canManageUsers: false
  });

  const $ = id => doc.getElementById(id);
  const flush = () => new Promise(r => setImmediate(r));
  return { ctx, doc, tabEnc, tabBtnEnc, $, calls, createdPayloads, flush };
}

test('desplegables de categoría y equipo cargan dinámicamente según el deporte y filtran en cascada', async () => {
  const h = setupHarness({
    dashboardGroups: {
      'Básquet Damas': [
        { categoria: 'U15', tira: 'B' },
        { categoria: 'U13', tira: 'A' },
        { categoria: 'U13', tira: 'B' },
        { categoria: 'Sin categoría', tira: 'General' }
      ],
      'Vóley Caballeros': [
        { categoria: 'Sub 16', tira: 'Tira A' },
        { categoria: 'Sub 18', tira: 'Tira B' }
      ]
    }
  });

  h.ctx.window.MuniSurveys.open();
  await h.flush();

  const catSelect = h.$('ms-categoria');
  const eqSelect = h.$('ms-equipo');
  assert.equal(catSelect.tagName, 'select');
  assert.equal(eqSelect.tagName, 'select');
  assert.deepEqual(catSelect.options.map(o => o.value), ['', 'U13', 'U15']);
  assert.deepEqual(eqSelect.options.map(o => o.value), ['', 'A', 'B']);

  // Elegir U15 filtra equipos sólo a B
  catSelect.value = 'U15';
  catSelect.dispatch('change');
  assert.deepEqual(eqSelect.options.map(o => o.value), ['', 'B']);

  // Volver a Todas las categorías y crear encuesta general ("Todos")
  catSelect.value = '';
  catSelect.dispatch('change');
  assert.deepEqual(eqSelect.options.map(o => o.value), ['', 'A', 'B']);
  h.$('ms-title').value = 'Clima general Básquet';
  h.$('ms-create').click();
  await h.flush();

  assert.equal(h.createdPayloads.length, 1);
  assert.deepEqual(
    { activity: h.createdPayloads[0].activity, categoria: h.createdPayloads[0].categoria, equipo: h.createdPayloads[0].equipo },
    { activity: 'Básquet Damas', categoria: '', equipo: '' }
  );

  // Cambiar a Vóley Caballeros carga sus categorías/tiras propias
  const actSelect = h.$('ms-activity');
  actSelect.value = 'Vóley Caballeros';
  actSelect.dispatch('change');
  await h.flush();
  assert.deepEqual(catSelect.options.map(o => o.value), ['', 'Sub 16', 'Sub 18']);
  assert.deepEqual(eqSelect.options.map(o => o.value), ['', 'Tira A', 'Tira B']);

  // Volver a Básquet Damas reutiliza caché sin llamar de nuevo a /api/dashboard
  const dashCallsBefore = h.calls.filter(c => c.path === '/api/dashboard').length;
  actSelect.value = 'Básquet Damas';
  actSelect.dispatch('change');
  await h.flush();
  assert.equal(h.calls.filter(c => c.path === '/api/dashboard').length, dashCallsBefore);
  assert.deepEqual(catSelect.options.map(o => o.value), ['', 'U13', 'U15']);
});

test('usa grupos locales de MuniPortalGroups sin consultar /api/dashboard cuando coincide el deporte', async () => {
  const h = setupHarness({
    portalGroupsFn: () => ({
      activity: 'Básquet Damas',
      groups: [
        { categoria: 'Premini', equipo: 'Único' },
        { categoria: 'Mini', equipo: 'A' }
      ]
    })
  });

  h.ctx.window.MuniSurveys.open();
  await h.flush();

  assert.equal(h.calls.filter(c => c.path === '/api/dashboard').length, 0);
  assert.deepEqual(h.$('ms-categoria').options.map(o => o.value), ['', 'Mini', 'Premini']);
  assert.deepEqual(h.$('ms-equipo').options.map(o => o.value), ['', 'A', 'Único']);
});

test('modo Elegir varios equipos permite seleccionar todos, limpiar, filtrar por tira y crear por lote', async () => {
  const h = setupHarness({
    dashboardGroups: {
      'Básquet Damas': [
        { categoria: 'U13', tira: 'A' },
        { categoria: 'U13', tira: 'B' },
        { categoria: 'U15', tira: 'A' },
        { categoria: 'U15', tira: 'B' }
      ]
    }
  });

  h.ctx.window.MuniSurveys.open();
  await h.flush();

  const btnMulti = h.doc.body.querySelector('button[data-scope-mode="multi"]');
  btnMulti.click();
  assert.equal(h.$('ms-multi-wrap').hidden, false);

  // Intentar crear con 0 marcados no envía
  h.$('ms-title').value = 'Clima por tira';
  h.$('ms-create').click();
  await h.flush();
  assert.equal(h.createdPayloads.length, 0);
  assert.match(h.$('ms-status').textContent, /Seleccioná al menos un equipo/);

  // Seleccionar todos -> 4 marcados
  h.$('ms-multi-all').click();
  assert.equal(h.$('ms-multi-count').textContent, '4 de 4 equipo(s) seleccionados');
  assert.equal(h.$('ms-create').textContent, 'Crear 4 cuestionarios y activar enlaces');

  // Limpiar -> 0 marcados
  h.$('ms-multi-none').click();
  assert.equal(h.$('ms-multi-count').textContent, '0 de 4 equipo(s) seleccionados');

  // Botón rápido por tira: seleccionar sólo tira A (2 grupos)
  const btnTiraA = h.$('ms-multi-tiras').querySelector('button[data-tira="A"]');
  assert.ok(btnTiraA);
  btnTiraA.click();
  assert.equal(h.$('ms-multi-count').textContent, '2 de 4 equipo(s) seleccionados');
  assert.equal(h.$('ms-create').textContent, 'Crear 2 cuestionarios y activar enlaces');

  h.$('ms-create').click();
  await h.flush();

  assert.equal(h.createdPayloads.length, 2);
  assert.deepEqual(
    h.createdPayloads.map(p => `${p.categoria}|${p.equipo}`),
    ['U13|A', 'U15|A']
  );
  assert.match(h.$('ms-status').textContent, /2 cuestionarios creados y activados\./);
});

test('prefill desde Inteligencia selecciona actividad, categoría y equipo en los desplegables', async () => {
  const h = setupHarness({
    dashboardGroups: {
      'Vóley Caballeros': [
        { categoria: 'Sub 16', tira: 'A' },
        { categoria: 'Sub 16', tira: 'B' }
      ]
    }
  });

  h.ctx.window.MuniSurveys.prefill({
    activity: 'Vóley Caballeros',
    categoria: 'Sub 16',
    equipo: 'B',
    template: 'clima'
  });

  // Inmediatamente y tras resolver /api/dashboard conserva el grupo preseleccionado
  assert.equal(h.$('ms-activity').value, 'Vóley Caballeros');
  assert.equal(h.$('ms-categoria').value, 'Sub 16');
  assert.equal(h.$('ms-equipo').value, 'B');

  await h.flush();
  assert.equal(h.$('ms-categoria').value, 'Sub 16');
  assert.equal(h.$('ms-equipo').value, 'B');
  assert.equal(h.$('ms-title').value, 'Clima y bienestar del grupo');
});
