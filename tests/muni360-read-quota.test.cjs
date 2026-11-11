const test=require('node:test'),assert=require('node:assert/strict');
const {environment}=require('./helpers/apps-script-env.cjs');
test('Sheets: reintenta metadata y valores tras 429 sin ejecutar escrituras',()=>{
 const e=environment(),waits=[];e.ctx.Utilities.sleep=ms=>waits.push(ms);
 const get=e.ctx.Sheets.Spreadsheets.get,batch=e.ctx.Sheets.Spreadsheets.Values.batchGet;
 let metadataCalls=0,valueCalls=0;
 e.ctx.Sheets.Spreadsheets.get=(...args)=>{if(++metadataCalls===1)throw Error("Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user'");return get(...args);};
 e.ctx.Sheets.Spreadsheets.Values.batchGet=(...args)=>{if(++valueCalls===1)throw Object.assign(Error('Too many requests'),{code:429});return batch(...args);};
 const before=e.requests.length;
 const result=e.ctx.readTablesUGI('private',['UsuariosUGI']);
 assert.ok(result.UsuariosUGI.length>1);assert.equal(metadataCalls,2);assert.equal(valueCalls,2);
 assert.equal(waits.length,2);assert.ok(waits.every(ms=>ms>=1000&&ms<2000));assert.equal(e.requests.length,before);
});
test('Sheets: cuota persistente produce RED tras intentos acotados; otros errores no se reintentan',()=>{
 const e=environment(),waits=[];e.ctx.Utilities.sleep=ms=>waits.push(ms);
 let calls=0;
 e.ctx.Sheets.Spreadsheets.get=()=>{calls++;throw Object.assign(Error('Read quota'),{details:{code:429}});};
 assert.throws(()=>e.ctx.metadataUGI('private'),error=>error.code==='RED');assert.equal(calls,3);assert.equal(waits.length,2);
 const denied=Error('Permission denied');calls=0;waits.length=0;
 e.ctx.Sheets.Spreadsheets.get=()=>{calls++;throw denied;};
 assert.throws(()=>e.ctx.metadataUGI('private'),error=>error===denied);assert.equal(calls,1);assert.equal(waits.length,0);
});


test('Sheets: metadatos se reutilizan solo dentro de una solicitud y se invalidan tras escritura o respuesta perdida',()=>{
 const e=environment(),get=e.ctx.Sheets.Spreadsheets.get;let reads=0;
 e.ctx.Sheets.Spreadsheets.get=(...args)=>{reads++;return get(...args);};
 e.ctx.SHEETS_METADATA_CACHE_UGI={};
 e.ctx.metadataUGI('private');e.ctx.metadataUGI('private');assert.equal(reads,1);
 e.ctx.writeTablesUGI('private',{TablaPrueba:[['Dato'],['Primero']]});
 assert.ok(e.ctx.metadataUGI('private').some(tab=>tab.title==='TablaPrueba'));assert.equal(reads,2);
 e.faults.ack='private';
 assert.throws(()=>e.ctx.writeTablesUGI('private',{TablaPosterior:[['Dato'],['Segundo']]}),/Response lost/);
 assert.ok(e.ctx.metadataUGI('private').some(tab=>tab.title==='TablaPosterior'));assert.equal(reads,3);
 e.ctx.SHEETS_METADATA_CACHE_UGI=null;reads=0;
 assert.equal(e.read().ok,true);const firstRequest=reads;
 assert.equal(e.ctx.SHEETS_METADATA_CACHE_UGI,null);
 assert.equal(e.read().ok,true);assert.equal(reads,firstRequest*2);
 assert.equal(e.ctx.SHEETS_METADATA_CACHE_UGI,null);
});
