import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { db, rpc } from './browser-fixture.mjs';
import { createHandler } from '../functions/muni360/core.mjs';

await db.exec(fs.readFileSync(new URL('../sql/010_comunidad.sql', import.meta.url), 'utf8'));

// En tests agregamos 'coord' autorizado solo en Básquet Caballeros (p.ej. para probar aislamiento por actividad).
await db.query(
  "insert into mc_private.users(uid, record) values($1, $2::jsonb) on conflict (uid) do update set record = excluded.record",
  [
    'coord',
    JSON.stringify({
      uid: 'coord',
      email: 'coord@example.invalid',
      nombre: 'Coord Basquet',
      rol: 'Coordinación',
      status: 'activo',
      areas: ['Básquet Caballeros'],
      capabilities: {},
      version: '22222222-3333-4444-8555-666666666666',
      revision: 0,
      expiresAt: null
    })
  ]
);

function makeHandler(uid = null, notify = null) {
  return createHandler({
    rpc,
    notify,
    verify: async token => {
      assert.ok(token, 'Expected auth token for protected endpoint');
      return { uid, email: `${uid}@example.invalid`, nombre: `Nombre ${uid}` };
    }
  });
}

const callPublic = (path, body = {}) => makeHandler(null)({ token: '', path, body });
const callAs = (uid, path, body = {}, notify = null) => makeHandler(uid, notify)({ token: `tok-${uid}`, path, body });

await test('UTF-8 clean across all Comunidad Muni files without mojibake', () => {
  const files = [
    new URL('../../../comunidad/index.html', import.meta.url),
    new URL('../../../comunidad/catalogo.js', import.meta.url),
    new URL('../../../comunidad/comunidad.js', import.meta.url),
    new URL('../../../comunidad/sw.js', import.meta.url),
    new URL('../sql/010_comunidad.sql', import.meta.url),
    new URL('../functions/muni360/comunidad.mjs', import.meta.url)
  ];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(!/[\uFFFD]|Ã[\u0080-\u00BF]?|Â/.test(content), `Mojibake detected in ${file.pathname}`);
  }
  const cat = fs.readFileSync(new URL('../../../comunidad/catalogo.js', import.meta.url), 'utf8');
  assert.match(cat, /export const HORARIOS_ENTRENAMIENTO/);
  assert.match(cat, /Básquet Caballeros/);
});

await test('SQL schema omits horarios_base, enforces RLS, blocks Comunicado and protects private columns', async () => {
  const tables = (await db.query("select tablename, rowsecurity from pg_tables where schemaname='comunidad' order by tablename")).rows;
  assert.deepEqual(
    tables.map(t => [t.tablename, t.rowsecurity]),
    [['dispositivos', true], ['novedades', true], ['suscripciones', true]]
  );

  await assert.rejects(
    () => db.query("insert into comunidad.novedades(autor_uid,autor_nombre,actividad,tipo,titulo,detalle) values('x','x','Colonia','Comunicado','Titulo','Detalle')"),
    /novedades_tipo_check|check constraint/i
  );

  await assert.rejects(async () => {
    await db.exec('begin');
    try {
      await db.exec('set local role anon');
      await db.query('select * from comunidad.suscripciones');
    } finally {
      await db.exec('rollback');
    }
  });

  await assert.rejects(async () => {
    await db.exec('begin');
    try {
      await db.exec('set local role anon');
      await db.query('select * from comunidad.dispositivos');
    } finally {
      await db.exec('rollback');
    }
  });

  await assert.rejects(async () => {
    await db.exec('begin');
    try {
      await db.exec('set local role anon');
      await db.query('select autor_uid, notificacion_estado from comunidad.novedades');
    } finally {
      await db.exec('rollback');
    }
  });

  await assert.rejects(async () => {
    await db.exec('begin');
    try {
      await db.exec('set local role anon');
      await db.query("insert into comunidad.novedades(autor_uid,autor_nombre,actividad,tipo,titulo,detalle) values('x','x','Colonia','Aviso','Hack','Intento anonimo')");
    } finally {
      await db.exec('rollback');
    }
  });
});

await test('regular community user signs in without polluting mc_private.users, manages own alerts only, cannot publish', async () => {
  const staffBefore = Number((await db.query('select count(*) as n from mc_private.users')).rows[0].n);

  const sess1 = await callAs('familia1', '/api/comunidad/session');
  assert.equal(sess1.ok, true);
  assert.equal(sess1.profile.canPublish, false);

  const staffAfter = Number((await db.query('select count(*) as n from mc_private.users')).rows[0].n);
  assert.equal(staffAfter, staffBefore, 'Comunidad login must not create rows in mc_private.users');

  // Suscripciones con 3 niveles: deporte, deporte+categoria, deporte+categoria+equipo
  await callAs('familia1', '/api/comunidad/subscribe', { actividad: 'Básquet Caballeros', categoria: '', equipo: '' });
  const sub2 = await callAs('familia1', '/api/comunidad/subscribe', { actividad: 'Básquet Caballeros', categoria: 'U13', equipo: 'Tira A' });
  assert.equal(sub2.suscripciones.length, 2);

  // Equipo sin categoría rechazado
  await assert.rejects(() => callAs('familia1', '/api/comunidad/subscribe', { actividad: 'Colonia', categoria: '', equipo: 'A' }), /categoría/i);

  // Registro de dispositivo
  const dev1 = await callAs('familia1', '/api/comunidad/device', { token: 'token-familia1-web-123456', plataforma: 'web-fcm' });
  assert.equal(dev1.registered, true);
  assert.equal(dev1.dispositivosCount, 1);

  // Otro usuario no ve ni puede borrar suscripciones de familia1
  const sess2 = await callAs('familia2', '/api/comunidad/session');
  assert.equal(sess2.suscripciones.length, 0);
  await assert.rejects(() => callAs('familia2', '/api/comunidad/unsubscribe', { id: sub2.suscripciones[0].id }), /no se encontró|permisos/i);

  // Usuarios comunes, Profe y Consulta no pueden publicar
  for (const nonCoord of ['familia1', 'teacher', 'reader']) {
    await assert.rejects(
      () => callAs(nonCoord, '/api/comunidad/publish', {
        actividad: 'Básquet Caballeros',
        tipo: 'Aviso',
        titulo: 'Intento sin permiso',
        detalle: 'No debe publicarse'
      }),
      /coordinación|permisos/i
    );
  }
});

await test('coordinator publishes Partido with filtered deduplicated notifications and non-blocking error log', async () => {
  // Prepara destinatarios adicionales
  await callAs('familia2', '/api/comunidad/subscribe', { actividad: 'Básquet Caballeros', categoria: 'U13', equipo: '' });
  await callAs('familia2', '/api/comunidad/device', { token: 'token-familia2-web-123456', plataforma: 'web-fcm' });

  await callAs('familia3', '/api/comunidad/subscribe', { actividad: 'Básquet Caballeros', categoria: 'U13', equipo: 'Tira B' });
  await callAs('familia3', '/api/comunidad/device', { token: 'token-familia3-web-123456', plataforma: 'web-fcm' });

  await callAs('familia4', '/api/comunidad/subscribe', { actividad: 'Colonia', categoria: '', equipo: '' });
  await callAs('familia4', '/api/comunidad/device', { token: 'token-familia4-web-123456', plataforma: 'web-fcm' });

  // Coord de Básquet no puede publicar en Colonia
  await assert.rejects(
    () => callAs('coord', '/api/comunidad/publish', {
      actividad: 'Colonia',
      tipo: 'Aviso',
      titulo: 'Aviso fuera de alcance',
      detalle: 'Debe fallar por permisos de actividad'
    }),
    /permiso/i
  );

  // 1) Publicar Partido con enviar_notificacion: true -> solo familia1 (1 vez) y familia2
  const delivered = [];
  const pubRes = await callAs(
    'coord',
    '/api/comunidad/publish',
    {
      actividad: 'Básquet Caballeros',
      categoria: 'U13',
      equipo: 'Tira A',
      tipo: 'Partido',
      urgente: true,
      titulo: 'Citación Fecha 8 vs. Obras',
      detalle: 'Presentarse 45 minutos antes.',
      fecha_evento: '2026-11-21',
      hora_evento: '10:30 hs',
      lugar: 'Microestadio',
      enviar_notificacion: true
    },
    async ({ aviso, targets }) => {
      delivered.push({ avisoId: aviso.id, tokens: targets.map(t => t.token) });
      return { sent: targets.map(t => t.token), failed: [] };
    }
  );

  assert.equal(pubRes.ok, true);
  assert.equal(pubRes.aviso.tipo, 'Partido');
  assert.equal(pubRes.notifications.requested, true);
  assert.equal(pubRes.notifications.recipients, 2);
  assert.equal(pubRes.notifications.sent, 2);
  assert.deepEqual(delivered[0].tokens.sort(), ['token-familia1-web-123456', 'token-familia2-web-123456']);
  assert.ok(!JSON.stringify(pubRes).includes('token-familia'), 'Publish HTTP response must not expose subscriber device tokens');

  // 2) Publicar con enviar_notificacion: false no dispara envíos
  let calledWhenDisabled = false;
  await callAs(
    'owner',
    '/api/comunidad/publish',
    {
      actividad: 'Colonia',
      tipo: 'Aviso',
      titulo: 'Traer protector solar',
      detalle: 'Actividad normal al aire libre.',
      enviar_notificacion: false
    },
    async () => {
      calledWhenDisabled = true;
    }
  );
  assert.equal(calledWhenDisabled, false);

  // 3) Si falla el envío de notificación, el aviso igual se publica y queda log del error
  const failPub = await callAs(
    'owner',
    '/api/comunidad/publish',
    {
      actividad: 'General',
      tipo: 'Suspension',
      urgente: true,
      titulo: 'Suspensión por tormenta eléctrica',
      detalle: 'Se suspenden actividades al aire libre.',
      enviar_notificacion: true
    },
    async () => {
      throw Error('FCM_SIMULATED_TIMEOUT');
    }
  );
  assert.equal(failPub.ok, true);
  assert.equal(failPub.notifications.sent, 0);
  assert.equal(failPub.notifications.failed, 1);

  const dbRow = (await db.query('select notificacion_estado from comunidad.novedades where id = $1', [failPub.aviso.id])).rows[0];
  assert.equal(dbRow.notificacion_estado.errores[0].error, 'FCM_SIMULATED_TIMEOUT');

  // Feed público devuelve los avisos activos y ocultar al desactivar
  const feedBefore = await callPublic('/api/comunidad/feed');
  assert.ok(feedBefore.avisos.some(a => a.id === failPub.aviso.id));
  await callAs('owner', '/api/comunidad/deactivate', { id: failPub.aviso.id });
  const feedAfter = await callPublic('/api/comunidad/feed');
  assert.ok(!feedAfter.avisos.some(a => a.id === failPub.aviso.id));

  // Propietario puede limpiar su suscripción de prueba
  const subsAfter = await callAs('familia1', '/api/comunidad/session');
  await callAs('familia1', '/api/comunidad/unsubscribe', { id: subsAfter.suscripciones[0].id });
});

await test('owner can grant publicarComunidad to Profe and revoke it from Coordinación via users panel', async () => {
  const { users } = await callAs('owner', '/api/users/list');
  const teacher = users.find(u => u.uid === 'teacher');
  const coord = users.find(u => u.uid === 'coord');

  await callAs('owner', '/api/users/update', {
    uid: 'teacher',
    rol: 'Profe',
    status: 'activo',
    areas: ['Básquet Caballeros'],
    capabilities: { publicarComunidad: true },
    revision: teacher.revision,
    expiresAt: null
  });

  const teacherSess = await callAs('teacher', '/api/comunidad/session');
  assert.equal(teacherSess.profile.canPublish, true);
  assert.ok(teacherSess.profile.publishAreas.includes('Básquet Caballeros'));

  const teacherPub = await callAs('teacher', '/api/comunidad/publish', {
    actividad: 'Básquet Caballeros',
    tipo: 'Aviso',
    titulo: 'Aviso de profe habilitado',
    detalle: 'Confirmado entrenamiento de hoy.'
  });
  assert.equal(teacherPub.ok, true);
  await callAs('teacher', '/api/comunidad/deactivate', { id: teacherPub.aviso.id });

  await callAs('owner', '/api/users/update', {
    uid: 'coord',
    rol: 'Coordinación',
    status: 'activo',
    areas: ['Básquet Caballeros'],
    capabilities: { publicarComunidad: false },
    revision: coord.revision,
    expiresAt: null
  });

  const coordSessRevoked = await callAs('coord', '/api/comunidad/session');
  assert.equal(coordSessRevoked.profile.canPublish, false);
  await assert.rejects(
    () => callAs('coord', '/api/comunidad/publish', {
      actividad: 'Básquet Caballeros',
      tipo: 'Aviso',
      titulo: 'Intento sin permiso',
      detalle: 'Debe fallar al quitar publicarComunidad.'
    }),
    /coordinación|permisos/i
  );

  const { users: usersAfter } = await callAs('owner', '/api/users/list');
  const coordUpdated = usersAfter.find(u => u.uid === 'coord');
  await callAs('owner', '/api/users/update', {
    uid: 'coord',
    rol: 'Coordinación',
    status: 'activo',
    areas: ['Básquet Caballeros'],
    capabilities: { publicarComunidad: true },
    revision: coordUpdated.revision,
    expiresAt: null
  });
  const coordSessRestored = await callAs('coord', '/api/comunidad/session');
  assert.equal(coordSessRestored.profile.canPublish, true);
});

await db.close();
