// Verificación visual de Muni360 en modo demo (datos ficticios, sin red externa).
//
//   node scripts/check-muni360-visual.cjs capture <carpeta>          capturas PNG
//   node scripts/check-muni360-visual.cjs capture <carpeta> --styles estilo computado (JSON)
//   node scripts/check-muni360-visual.cjs compare <antes> <despues>  compara PNG y/o JSON
//
// Uso típico para un refactor de HTML/CSS/JS de los portales:
//   1. `npm run build:muni360-public` y `capture` en una carpeta "antes" (fuera del repo).
//   2. Hacer el cambio, volver a compilar y `capture` en "despues".
//   3. `compare antes despues`: debe terminar con "0 diferencias".
// Fecha, zona horaria y azar están fijados, así que dos corridas iguales dan los mismos bytes.
// El modo --styles recorre todos los elementos (también ocultos y modales) y tarda bastante:
// para acelerarlo, correr un proceso por portal con MUNI360_VISUAL_PORTALS=muni360/colonia/ etc.
// Variables: MUNI360_PLAYWRIGHT_MODULE (ruta a playwright), MUNI360_BROWSER_PATH (Chromium).
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..');
const [mode, dirA, dirB] = process.argv.slice(2);
const styles = process.argv.includes('--styles');
const PORTALS = (process.env.MUNI360_VISUAL_PORTALS || 'muni360/,muni360/deportes/,muni360/colonia/,muni360/coyfd/').split(',');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };

async function capture(out) {
  const { chromium } = require(process.env.MUNI360_PLAYWRIGHT_MODULE || 'playwright');
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((q, r) => {
    try {
      let n = decodeURIComponent(new URL(q.url, 'http://x').pathname).slice(1);
      if (n === '' || n.endsWith('/')) n += 'index.html';
      const f = path.join(root, n);
      if (!f.startsWith(root + path.sep)) throw Error('fuera del repo');
      r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
      r.end(fs.readFileSync(f));
    } catch { r.writeHead(404); r.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port, errors = [];
  const browser = await chromium.launch(process.env.MUNI360_BROWSER_PATH ? { executablePath: process.env.MUNI360_BROWSER_PATH } : {});
  let files = 0;
  for (const portal of PORTALS) for (const width of [390, 1440]) for (const profile of ['direccion', 'profe']) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, timezoneId: 'America/Argentina/Buenos_Aires', locale: 'es-AR' });
    await ctx.addInitScript(() => {
      const fixed = new Date('2026-11-25T15:00:00-03:00').getTime(), D = Date;
      class FD extends D { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } }
      window.Date = FD;
      Math.random = (() => { let s = 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(portal + ' ' + e.message));
    page.on('dialog', d => d.accept('360,demo'));
    await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    await page.goto(`http://127.0.0.1:${port}/${portal}?demo=1`);
    await page.locator('#demo-password').fill('360,demo');
    await page.locator('#demo-form button[type=submit]').click();
    await page.locator('#app-screen').waitFor({ state: 'visible' });
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}#toast{display:none!important}' });
    if (profile === 'profe') await page.evaluate(() => { sesion.rol = 'Profe'; sesion.esAdminTotal = false; sesion.canManageUsers = false; sesion.capabilities = {}; actualizarCabeceraYPestanas(); renderAsistencia(); });
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#nav-tabs [data-tab]')].filter(b => getComputedStyle(b).display !== 'none' && !b.classList.contains('hidden')).map(b => b.dataset.tab));
    const tag = portal.replace(/\W+/g, '_') + width + '_' + profile;
    for (const t of [...new Set(tabs)]) {
      try { await page.evaluate(t => cambiarTab(t), t); } catch (e) { errors.push(tag + ' ' + t + ' ' + e.message); continue; }
      await page.waitForTimeout(250);
      if (styles) {
        const st = await page.evaluate(() => {
          const out = {}, pathOf = el => { const p = []; for (let e = el; e && e !== document.body; e = e.parentElement) { let i = 0, s = e; while ((s = s.previousElementSibling)) i++; p.unshift(e.tagName + (e.id ? '#' + e.id : '') + ':' + i); } return p.join('>'); };
          for (const el of document.querySelectorAll('body *')) {
            out[pathOf(el)] = [null, '::before', '::after'].map(pe => { const cs = getComputedStyle(el, pe), d = {}; for (let k = 0; k < cs.length; k++) d[cs[k]] = cs.getPropertyValue(cs[k]); return d; });
          }
          return out;
        });
        fs.writeFileSync(path.join(out, tag + '__' + t + '.json'), JSON.stringify(st));
      } else await page.screenshot({ path: path.join(out, tag + '__' + t + '.png'), fullPage: true });
      files++;
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(out, 'errores.txt'), errors.join('\n'));
  console.log(`${files} estados capturados en ${out}; errores de JavaScript: ${errors.length}`);
  if (errors.length) { console.log(errors.slice(0, 10).join('\n')); process.exitCode = 1; }
}

// Diferencia por canal tolerada en las capturas: el suavizado de fuentes varía apenas
// entre corridas (medido: 36 píxeles con delta <= 14). Un cambio real de diseño la supera.
const TOLERANCIA = 16;
async function pixelDiff(page, fileA, fileB) {
  const a = 'data:image/png;base64,' + fs.readFileSync(fileA).toString('base64');
  const b = 'data:image/png;base64,' + fs.readFileSync(fileB).toString('base64');
  return page.evaluate(async ([a, b, tol]) => {
    const load = src => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return 'tamaño ' + ia.width + 'x' + ia.height + ' → ' + ib.width + 'x' + ib.height;
    const data = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
    const da = data(ia), db = data(ib);
    let n = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > tol) n++;
    return n ? n + ' píxeles distintos' : '';
  }, [a, b, TOLERANCIA]);
}

function styleDiff(x, y) {
  // Variaciones equivalentes que no cambian el render (p. ej. #ffffff y #fff en variables CSS).
  const norm = v => String(v).replace(/#ffffff\b/gi, '#fff');
  let bad = 0, example = '';
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (!x[k] || !y[k]) { bad++; if (!example) example = 'elemento ' + k.slice(-80); continue; }
    for (let i = 0; i < x[k].length; i++) {
      for (const p of new Set([...Object.keys(x[k][i]), ...Object.keys(y[k][i])])) {
        if (norm(x[k][i][p]) !== norm(y[k][i][p])) { bad++; if (!example) example = k.slice(-60) + ' ' + p + ': ' + x[k][i][p] + ' → ' + y[k][i][p]; }
      }
    }
  }
  return bad ? bad + ' propiedades; ej. ' + example : '';
}

async function compare(a, b) {
  const list = d => fs.readdirSync(d).filter(f => /\.(png|json)$/.test(f)).sort();
  const la = list(a), lb = new Set(list(b));
  let diffs = 0, browser = null, page = null;
  for (const f of la) {
    if (!lb.has(f)) { console.log('FALTA', f); diffs++; continue; }
    lb.delete(f);
    let result;
    if (f.endsWith('.png')) {
      if (fs.readFileSync(path.join(a, f)).equals(fs.readFileSync(path.join(b, f)))) continue;
      if (!page) {
        const { chromium } = require(process.env.MUNI360_PLAYWRIGHT_MODULE || 'playwright');
        browser = await chromium.launch(process.env.MUNI360_BROWSER_PATH ? { executablePath: process.env.MUNI360_BROWSER_PATH } : {});
        page = await browser.newPage();
      }
      result = await pixelDiff(page, path.join(a, f), path.join(b, f));
    } else {
      result = styleDiff(JSON.parse(fs.readFileSync(path.join(a, f))), JSON.parse(fs.readFileSync(path.join(b, f))));
    }
    if (result) { console.log('DISTINTO', f, '-', result); diffs++; }
  }
  if (browser) await browser.close();
  for (const f of lb) { console.log('SOBRA', f); diffs++; }
  console.log(la.length + ' estados comparados; ' + diffs + ' diferencias');
  if (diffs) process.exitCode = 1;
}

if (mode === 'capture' && dirA) capture(path.resolve(dirA)).catch(e => { console.error(e); process.exit(1); });
else if (mode === 'compare' && dirA && dirB) compare(path.resolve(dirA), path.resolve(dirB)).catch(e => { console.error(e); process.exit(1); });
else { console.log('Uso: capture <carpeta> [--styles] | compare <antes> <despues>'); process.exitCode = 2; }
