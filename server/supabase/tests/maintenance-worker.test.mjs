import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';

const source = fs.readFileSync(new URL('../tools/MantenimientoOriginal.gs', import.meta.url), 'utf8');

test('respaldo en Drive nombra explicitamente Muni360-Supabase-YYYY-MM-DD.json.gz y verifica integridad', () => {
  const props = new Map([
    ['UGI_SUPABASE_MAINTENANCE_KEY', 'mci_' + 'a'.repeat(64)],
    ['UGI_SUPABASE_BACKUP_FOLDER', 'folder-backups']
  ]);
  const createdFiles = [];
  const snapshot = {
    format: 'MUNI360_SUPABASE_BACKUP_V1',
    createdAt: '2026-11-15T12:00:00Z',
    units: [{ unit: 'global', data: {} }, { unit: 'Tenis', data: {} }]
  };
  let synced = 0;

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
    Session: { getEffectiveUser: () => ({ getEmail: () => 'ugiccba@gmail.com' }) },
    MailApp: { getRemainingDailyQuota: () => 50, sendEmail() {} },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE' },
      getFolderById: id => ({
        getId: () => id,
        getSharingAccess: () => 'PRIVATE',
        getOwner: () => ({ getEmail: () => 'ugiccba@gmail.com' }),
        createFile: blob => {
          const entry = {
            name: blob.getName(),
            bytes: blob.getBytes(),
            getSharingAccess: () => 'PRIVATE',
            getBlob: () => ({ getBytes: () => entry.bytes }),
            getUrl: () => 'https://drive.google.com/file/d/backup-1/view'
          };
          createdFiles.push(entry);
          return entry;
        }
      })
    },
    Utilities: {
      formatDate: () => '2026-11-15',
      newBlob: (data, mime, name) => ({
        getDataAsString: () => String(data),
        getBytes: () => [...Buffer.from(String(data))],
        getName: () => name || 'blob'
      }),
      gzip: (blob, name) => ({
        getName: () => name || 'archive.gz',
        getBytes: () => [...zlib.gzipSync(Buffer.from(blob.getDataAsString()))]
      }),
      ungzip: blob => ({
        getDataAsString: () => zlib.gunzipSync(Buffer.from(blob.getBytes())).toString()
      })
    },
    UrlFetchApp: {
      fetch(url) {
        if (url.endsWith('/rpc/mc_source_tasks')) {
          return {
            getResponseCode: () => 200,
            getContentText: () => JSON.stringify({ freeze: true, backupRequested: true, notices: [] })
          };
        }
        if (url.endsWith('/rpc/mc_backup')) {
          return { getResponseCode: () => 200, getContentText: () => JSON.stringify(snapshot) };
        }
        throw new Error('Unexpected URL: ' + url);
      }
    },
    sincronizarMuni360SupabaseOriginalUGI: () => { synced++; }
  };

  vm.runInNewContext(source, ctx);
  ctx.tareasSupabaseUGI();

  assert.equal(synced, 1);
  assert.equal(createdFiles.length, 1);
  assert.equal(createdFiles[0].name, 'Muni360-Supabase-2026-11-15.json.gz');
  assert.deepEqual(JSON.parse(zlib.gunzipSync(Buffer.from(createdFiles[0].bytes)).toString()), snapshot);
  assert.equal(props.get('UGI_SUPABASE_BACKUP_DAY'), '2026-11-15');
});
