'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
test('manifest del sitio publicado corresponde a los 26 archivos generados',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'muni360/manifest.json'),'utf8'));
 assert.equal(manifest.format,'MUNI360_PUBLIC_BUNDLE_V1');
 assert.equal(Object.keys(manifest.files).length,25);
 for(const [file,hash] of Object.entries(manifest.files)){
  const bytes=fs.readFileSync(path.join(root,'muni360',file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,file);
 }
});
test('Colonia y Deportes enlazan a la versiÃ³n actual del panel de coordinaciÃ³n',()=>{
 const dashboard=fs.readFileSync(path.join(root,'muni360/assets/scripts/muni360-dashboard.js'));
 const hash=crypto.createHash('sha256').update(dashboard).digest('hex').slice(0,12);
 for(const area of ['colonia','deportes']){
  const html=fs.readFileSync(path.join(root,'muni360',area,'index.html'),'utf8');
  assert.ok(html.includes('muni360-dashboard.js?v='+hash),area+' usa panel anterior');
 }
});

