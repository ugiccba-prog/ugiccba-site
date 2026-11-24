const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function entorno(fetch, inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  const contexto = { console, navigator: { userAgent: '', onLine: true },
    AbortController, setTimeout, clearTimeout, fetch,
    localStorage: { getItem: k => datos.get(k), setItem: (k,v) => datos.set(k,v) },
    document: { createElement: () => ({}), head: { appendChild: s => {
      const cb = new URL(s.src).searchParams.get('callback');
      queueMicrotask(() => contexto[cb]({ existe: false }));
    } } }, addEventListener() {} };
  contexto.window = contexto;
  vm.runInNewContext(fs.readFileSync('apps/training/ugi-envio.js', 'utf8'), contexto);
  return { ugi: contexto.UGI, datos };
}
const key = 'ugi_cola_envios_v1';
test('conserva resultados mientras se envían y solo elimina el confirmado', async () => {
  let resolver;
  const { ugi, datos } = entorno(() => new Promise(r => { resolver = r; }));
  const envio = ugi.enviarResultado({ id_sesion: 'uno' });
  assert.equal(ugi.pendientes(), 1);
  datos.set(key, JSON.stringify([...JSON.parse(datos.get(key)), { id_sesion: 'otro' }]));
  resolver({ ok: true, json: async () => ({ ok: true }) });
  assert.equal((await envio).ok, true);
  assert.deepEqual(JSON.parse(datos.get(key)).map(x => x.id_sesion), ['otro']);
});
test('un fallo de red conserva la identidad y el resultado pendiente', async () => {
  const { ugi, datos } = entorno(async () => { throw Error('offline'); });
  const r = await ugi.enviarResultado({ id_sesion: 'estable' });
  assert.equal(r.ok, false); assert.equal(r.guardado, true);
  assert.equal(JSON.parse(datos.get(key))[0].id_sesion, 'estable');
  await Promise.all([ugi.reintentarCola(), ugi.reintentarCola()]);
  assert.equal(ugi.pendientes(), 1);
});
test('no descarta resultados al superar los antiguos 50 pendientes', async () => {
  const cola = Array.from({length:50}, (_,i) => ({id_sesion:String(i)}));
  const { ugi } = entorno(async () => { throw Error('offline'); }, { [key]: JSON.stringify(cola) });
  await ugi.enviarResultado({id_sesion:'nuevo'});
  assert.equal(ugi.pendientes(), 51);
});
test('normaliza resultados antiguos sin identidad antes del reintento', async () => {
  const { ugi, datos } = entorno(async () => { throw Error('offline'); }, { [key]: '[{"jugador":"Prueba"}]' });
  await ugi.reintentarCola();
  assert.ok(JSON.parse(datos.get(key))[0].id_sesion);
});
test('ranking de Visión rechaza controles ausentes y números infinitos', () => {
  const c = { }; vm.runInNewContext(fs.readFileSync('apps-script/Codigo.gs','utf8'), c);
  const encabezados = ['jugador','juego','umbral_ms','centro_ok_pct','total','deporte'];
  c.obtenerHoja = () => ({getLastRow:()=>4,getDataRange:()=>({getValues:()=>[
    encabezados, ['Sin control','VISION',40,'',28,''], ['Sin rondas','VISION',50,100,'',''], ['Válido','VISION',200,90,28,'Hockey']
  ]})});
  assert.equal(c.topDiez('VISION').length,1);
  assert.equal(c.topDiez('VISION')[0].jugador,'Válido');
  assert.equal(c.numero(Infinity),null);
});
test('servidor no vuelve a insertar una sesión ya recibida y libera el bloqueo', () => {
  let liberado = false;
  const c = { LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){liberado=true;}})} };
  vm.runInNewContext(fs.readFileSync('apps-script/Codigo.gs','utf8'),c);
  c.existeSesion=()=>true; c.json=x=>x;
  c.obtenerHoja=()=>{throw Error('No debe insertar');};
  assert.equal(c.doPost({postData:{contents:JSON.stringify({id_sesion:'uno',jugador:'Prueba',juego:'STROOP'})}}).ok,true);
  assert.equal(liberado,true);
});
