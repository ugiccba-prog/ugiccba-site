import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../tools/MantenimientoOriginal.gs', import.meta.url), 'utf8');

test('mensajeAlertaSemanalUGI arma el correo y valida destinatario y grupos', () => {
  const ctx = {};
  vm.runInNewContext(source, ctx);

  const mail = ctx.mensajeAlertaSemanalUGI({
    id: 'alert-1',
    activity: 'Hockey sobre Patines Caballeros',
    nombre: 'Juan Coordinador',
    email: 'coord@example.com',
    missingGroups: ['Sub 14 · Azul', 'Sub 16 · Blanco']
  });

  assert.equal(mail.to, 'coord@example.com');
  assert.match(mail.subject, /Hockey sobre Patines Caballeros/);
  assert.match(mail.body, /Hola Juan Coordinador/);
  assert.match(mail.body, /• Sub 14 · Azul/);
  assert.match(mail.body, /• Sub 16 · Blanco/);
  assert.throws(() => ctx.mensajeAlertaSemanalUGI({ email: 'a@example.com\nb@example.com', activity: 'Tenis', missingGroups: ['A · B'] }));
  assert.throws(() => ctx.mensajeAlertaSemanalUGI({ email: 'coord@example.com', activity: 'Tenis', missingGroups: [] }));
});

test('tareasSupabaseUGI reserva, envia y confirma weeklyAlerts sin reenviar fallos', () => {
  const props = new Map([
    ['UGI_SUPABASE_MAINTENANCE_KEY', 'mci_' + 'b'.repeat(64)],
    ['UGI_SUPABASE_BACKUP_DAY', '2026-11-20']
  ]);
  const sentEmails = [];
  const rpcCalls = [];

  const ctx = {
    console: { log() {}, error() {} },
    sha: value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'),
    LockService: { getUserLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => props.get(k) || null,
        setProperty: (k, v) => props.set(k, String(v)),
        deleteProperty: k => props.delete(k)
      })
    },
    MailApp: {
      getRemainingDailyQuota: () => 50,
      sendEmail: msg => {
        if (msg.to === 'fail@example.com') throw new Error('SMTP error');
        sentEmails.push(msg);
      }
    },
    Utilities: {
      formatDate: () => '2026-11-20'
    },
    UrlFetchApp: {
      fetch(url, opts) {
        const body = JSON.parse(opts.payload);
        rpcCalls.push({ url, body });
        const pResult = body.p_result || null;
        if (pResult && pResult.weeklyClaim) {
          return {
            getResponseCode: () => 200,
            getContentText: () => JSON.stringify({
              weeklyAlerts: [
                { id: 'w-ok', activity: 'Colonia', nombre: 'Ana', email: 'ana@example.com', missingGroups: ['Grupo 1 · Mañana'] },
                { id: 'w-fail', activity: 'Colonia', nombre: 'Beto', email: 'fail@example.com', missingGroups: ['Grupo 1 · Mañana'] }
              ]
            })
          };
        }
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ freeze: true, backupRequested: false, notices: [], approvals: [], weeklyAlerts: [] })
        };
      }
    },
    sincronizarMuni360SupabaseOriginalUGI: () => {}
  };

  vm.runInNewContext(source, ctx);
  ctx.tareasSupabaseUGI();

  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'ana@example.com');

  const ackCall = rpcCalls.find(c => c.body.p_result && c.body.p_result.weeklySent);
  assert.ok(ackCall);
  assert.deepEqual(ackCall.body.p_result.weeklySent, ['w-ok']);
  assert.deepEqual(ackCall.body.p_result.weeklyReview, ['w-fail']);
});
