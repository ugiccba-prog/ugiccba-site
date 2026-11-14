// End-to-end Chrome test for Comunidad Muni against PGlite + core.mjs/comunidad.mjs.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.MUNI360_PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '../../..');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png'
};

let fixture, port, failNextFeed = false, pushedNotifications = [];

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/backend') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const d = JSON.parse(raw || '{}');
      if (d.path === '/api/comunidad/feed' && failNextFeed) {
        failNextFeed = false;
        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, codigo: 'RED', error: 'Error simulado de red en avisos.' }));
      }
      const { createHandler } = await import('../functions/muni360/core.mjs');
      const token = d.idToken || '';
      const handler = createHandler({
        rpc: fixture.rpc,
        notify: async ({ aviso, targets }) => {
          pushedNotifications.push({ avisoId: aviso.id, tokens: targets.map(t => t.token) });
          return { sent: targets.map(t => t.token), failed: [] };
        },
        verify: async t => {
          if (!t) throw Object.assign(Error('Ingresá con Google.'), { code: 'SESION', status: 401 });
          return { uid: t, email: `${t}@example.invalid`, nombre: `Usuario ${t}` };
        }
      });
      const result = await handler({ token, path: d.path, body: d });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ apiVersion: 2, backendVersion: 'supabase-1.0.0', ...result }));
    }

    if (url.pathname === '/assets/scripts/muni360-config.js') {
      res.writeHead(200, { 'Content-Type': mime['.js'] });
      return res.end('window.MUNI_CONFIG=' + JSON.stringify({ backend: 'supabase', apiBaseUrl: `http://127.0.0.1:${port}/api/backend` }) + ';');
    }

    if (url.pathname === '/assets/scripts/muni360-google.js') {
      res.writeHead(200, { 'Content-Type': mime['.js'] });
      return res.end(`(function(){
        const KEY = 'qa_comunidad_uid';
        const cbs = new Set();
        const getUser = () => {
          const u = sessionStorage.getItem(KEY);
          return u ? { uid: u, email: u + '@example.invalid' } : null;
        };
        async function call(path, body = {}) {
          const u = getUser();
          const token = u ? u.uid : '';
          const r = await fetch('/api/backend', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify({ ...body, path, idToken: token })
          });
          const d = await r.json();
          if (!r.ok || !d.ok) throw Object.assign(Error(d.error || 'Error'), { code: d.codigo });
          return d;
        }
        window.MuniGoogle = {
          configured: () => true,
          observe: fn => { cbs.add(fn); queueMicrotask(() => fn(getUser())); return () => cbs.delete(fn); },
          login: async () => {
            const nextUid = window.__qaNextLoginUid || 'familia1';
            sessionStorage.setItem(KEY, nextUid);
            const u = getUser();
            cbs.forEach(fn => fn(u));
            return u;
          },
          logout: async () => {
            sessionStorage.removeItem(KEY);
            cbs.forEach(fn => fn(null));
          },
          call
        };
      })();`);
    }

    let name = decodeURIComponent(url.pathname).replace(/^\//, '');
    if (name.endsWith('/')) name += 'index.html';
    const file = path.resolve(root, name);
    const first = name.split('/')[0];
    if (!file.startsWith(root + path.sep) || !['comunidad', 'assets', 'escudo-ccba.png'].includes(first)) {
      res.writeHead(403);
      return res.end();
    }
    const bytes = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(bytes);
  } catch (err) {
    res.writeHead(err.status || 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, codigo: err.code || 'SERVIDOR', error: err.message }));
  }
});

(async () => {
  fixture = await import('./browser-fixture.mjs');
  await fixture.db.exec(fs.readFileSync(path.join(__dirname, '../sql/010_comunidad.sql'), 'utf8'));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port;

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.MUNI360_BROWSER_PATH ? { executablePath: process.env.MUNI360_BROWSER_PATH } : {})
  });

  try {
    // 1. Mobile 390x844: estado error + reintento, horarios estáticos, login usuario común, alertas y notificaciones
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: {
          permission: 'default',
          requestPermission: async () => {
            window.Notification.permission = 'granted';
            return 'granted';
          }
        }
      });
    });

    const page = await context.newPage();
    const errors = [];
    await page.route('**/*', r => {
      const u = new URL(r.request().url());
      if (u.hostname === '127.0.0.1') return r.continue();
      return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    failNextFeed = true;
    await page.goto(`http://127.0.0.1:${port}/comunidad/`);
    await page.locator('#btn-reintentar-avisos').waitFor({ state: 'visible' });
    assert.equal(errors.filter(m => m.includes('503')).length, 1);
    errors.length = 0;
    await page.click('#btn-reintentar-avisos');
    await page.locator('#vista-avisos .panel-card').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#vista-avisos').textContent()).includes('No hay avisos publicados'));
    assert.equal(await page.locator('#btn-abrir-publicar').isVisible(), false);

    // Horarios estáticos desde catalogo.js
    await page.click('#tab-horarios');
    await page.locator('#vista-horarios .card-novedad').first().waitFor({ state: 'visible' });
    const horariosText = await page.locator('#vista-horarios').textContent();
    assert.ok(horariosText.includes('Básquet Caballeros') && horariosText.includes('Hockey sobre Patines Caballeros'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

    // Mis alertas: verifica que no abra el panel autenticado sin sesión
    await page.click('#tab-alertas');
    await page.locator('#panel-sin-login').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#panel-con-login').isVisible(), false);

    // Login usuario común (familia1)
    await page.evaluate(() => { window.__qaNextLoginUid = 'familia1'; });
    await page.click('#google-login');
    await page.locator('#panel-con-login').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#user-email-lbl').textContent()).includes('familia1@example.invalid'));
    assert.equal(await page.locator('#btn-abrir-publicar').isVisible(), false);

    // Consentimiento explícito de notificaciones -> registra dispositivo
    await page.click('#btn-activar-notificaciones');
    await page.locator('#estado-alertas').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#notif-estado-lbl').textContent()).includes('registrado'));

    // Crear, verificar borrado y volver a crear alerta en Supabase (no en localStorage)
    await page.selectOption('#sub-actividad', 'Básquet Caballeros');
    await page.fill('#sub-categoria', 'U13');
    await page.fill('#sub-equipo', 'Tira A');
    await page.click('#btn-guardar-sub');
    await page.locator('#lista-suscripciones .sub-item').first().waitFor({ state: 'visible' });
    await page.click('#lista-suscripciones button[data-del-sub]');
    await page.waitForFunction(() => document.querySelectorAll('#lista-suscripciones .sub-item').length === 0);
    await page.selectOption('#sub-actividad', 'Básquet Caballeros');
    await page.fill('#sub-categoria', 'U13');
    await page.fill('#sub-equipo', 'Tira A');
    await page.click('#btn-guardar-sub');
    await page.locator('#lista-suscripciones .sub-item').first().waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => localStorage.getItem('ugi_comunidad_subs')), null);

    // 2. Desktop 1440x900: coordinador (owner) publica Partido con notificación y luego lo quita
    await page.click('#btn-logout-comunidad');
    await page.locator('#panel-sin-login').waitFor({ state: 'visible' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { window.__qaNextLoginUid = 'owner'; });
    await page.click('#google-login');
    await page.locator('#btn-abrir-publicar').waitFor({ state: 'visible' });

    await page.click('#btn-abrir-publicar');
    await page.locator('#modal-publicar[open]').waitFor({ state: 'visible' });
    await page.selectOption('#pub-tipo', 'Partido');
    await page.selectOption('#pub-actividad', 'Básquet Caballeros');
    await page.fill('#pub-categoria', 'U13');
    await page.fill('#pub-equipo', 'Tira A');
    await page.fill('#pub-titulo', 'Citación Fecha 9 vs. Gimnasia');
    await page.fill('#pub-detalle', 'Llegar 40 minutos antes.');
    await page.fill('#pub-fecha', '2026-11-22');
    await page.fill('#pub-hora', '11:00 hs');
    await page.fill('#pub-lugar', 'Microestadio CCBA');
    await page.check('#pub-notificar');
    await page.click('#btn-submit-publicar');

    await page.locator('#vista-avisos .card-novedad').first().waitFor({ state: 'visible' });
    const cardText = await page.locator('#vista-avisos .card-novedad').first().textContent();
    assert.ok(cardText.includes('Citación Fecha 9 vs. Gimnasia') && cardText.includes('Partido') && cardText.includes('22/11/2026'));
    assert.equal(pushedNotifications.length, 1);
    assert.equal(pushedNotifications[0].tokens.length, 1);

    // Filtros de avisos por tipo y equipo tras recargar
    await page.reload();
    await page.locator('#vista-avisos .card-novedad').first().waitFor({ state: 'visible' });
    await page.selectOption('#filtro-tipo', 'Cambio');
    assert.ok((await page.locator('#vista-avisos').textContent()).includes('No hay avisos publicados'));
    await page.selectOption('#filtro-tipo', 'Partido');
    await page.fill('#filtro-equipo', 'Tira A');
    assert.equal(await page.locator('#vista-avisos .card-novedad').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

    // Quitar aviso en dos toques
    await page.click('#vista-avisos button[data-archivar-id]');
    await page.click('#vista-avisos button[data-archivar-id][data-confirm-pending="true"]');
    await page.locator('#vista-avisos .panel-card').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#vista-avisos').textContent()).includes('No hay avisos publicados'));

    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, mobileOverflowFree: true, notificationsDispatched: pushedNotifications.length, errors }));
  } finally {
    await browser.close();
    server.close();
    await fixture.db.close();
  }
})();
