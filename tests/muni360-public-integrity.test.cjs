'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const normalized=(file,bytes)=>file.endsWith('.png')?bytes:Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
test('manifest del sitio publicado corresponde a los archivos generados',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'muni360/manifest.json'),'utf8'));
 assert.equal(manifest.format,'MUNI360_PUBLIC_BUNDLE_V1');
 const publicRoot=path.join(root,'muni360');
 const files=fs.readdirSync(publicRoot,{recursive:true,withFileTypes:true})
  .filter(entry=>entry.isFile())
  .map(entry=>path.relative(publicRoot,path.join(entry.parentPath,entry.name)).split(path.sep).join('/'))
  .filter(file=>file!=='manifest.json');
 assert.deepEqual(Object.keys(manifest.files).sort(),files.sort());
 for(const [file,hash] of Object.entries(manifest.files)){
  const bytes=normalized(file,fs.readFileSync(path.join(root,'muni360',file)));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,file);
 }
});
test('Colonia y Deportes enlazan a la versión actual del panel de coordinación',()=>{
 const dashboard=normalized('dashboard.js',fs.readFileSync(path.join(root,'muni360/assets/scripts/muni360-dashboard.js')));
 const hash=crypto.createHash('sha256').update(dashboard).digest('hex').slice(0,12);
 const inteligencia=normalized('inteligencia.js',fs.readFileSync(path.join(root,'muni360/assets/scripts/muni360-inteligencia.js')));
 const intHash=crypto.createHash('sha256').update(inteligencia).digest('hex').slice(0,12);
 for(const area of ['colonia','coyfd','deportes']){
  const html=fs.readFileSync(path.join(root,'muni360',area,'index.html'),'utf8');
  assert.ok(html.includes('muni360-dashboard.js?v='+hash),area+' usa panel anterior');
  assert.ok(html.includes('muni360-inteligencia.js?v='+intHash),area+' usa módulo de Inteligencia anterior');
 }
});
