const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../tools/SheetsCompleto.gs'),'utf8');
function setup(){let writes=0,acks=0,corrupt=false,badMarker=false,lostAck=false;const saved={},job={activity:'Actividad ficticia',version:1,sheet_id:'TEST_NEW_SHEET_ID_123456789',state:{padron:[{id:'p1',categoria:'Mini',equipo:'A',jugador:'=Ficticio'}],asistencia:[],evaluaciones:[],gestos:[],fichas:{}},archives:[],audit:[]};const c={console,PropertiesService:{getScriptProperties:()=>({getProperty:k=>({SUPABASE_PILOT_URL:'https://kaalffshnrkxviqaymhv.supabase.co',SUPABASE_PILOT_PUBLISHABLE_KEY:'public',SUPABASE_PILOT_WORKER_KEY:'private',PILOT_WORKER_EXPIRES:'2099-01-01T00:00:00Z'})[k]})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},Utilities:{formatDate:()=> '11/11/2026 20:00:00',base64EncodeWebSafe:s=>Buffer.from(s).toString('base64url')},UrlFetchApp:{fetch(url,opt){assert.ok(JSON.parse(opt.payload).p_secret);const ack=url.endsWith('mc_worker_ack');if(ack){acks++;if(lostAck)throw Error('lost ack');}return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(ack?{verified:true,version:1}:[job])};}},Sheets:{Spreadsheets:{get:()=>({sheets:Object.keys(c.tablasSupabaseUGI(job)).map(title=>({properties:{title,sheetId:title,gridProperties:{rowCount:1000}}}))}),batchUpdate(body){writes++;for(const req of body.requests.filter(r=>r.updateCells)){const u=req.updateCells;const target=saved[u.range.sheetId]||[];target.splice(u.range.startRowIndex,u.range.endRowIndex-u.range.startRowIndex,...u.rows.map(r=>r.values.map(v=>{assert.ok(!('formulaValue' in v.userEnteredValue));return v.userEnteredValue.stringValue??v.userEnteredValue.numberValue;})));saved[u.range.sheetId]=target;}},Values:{get(sheet,range){return {values:range.includes('ControlMuni360')?[[badMarker?'PRODUCTION':'MUNI360_SUPABASE_MIGRATION_V1'],[job.activity]]:[]};},batchGet(sheet,{ranges}){return {valueRanges:ranges.map((r,i)=>({values:corrupt&&i===0?[['corrupted']]:saved[r.replaceAll("'",'')]}))};}}}}};vm.createContext(c);vm.runInContext(source,c);return {c,job,get writes(){return writes;},get acks(){return acks;},saved,setCorrupt:()=>corrupt=true,setBad:()=>badMarker=true,setLost:v=>lostAck=v};}
test('full views use literal names, preserve zero points and ack only after readback',()=>{const e=setup();assert.equal(e.c.sincronizarMuni360Supabase().verified,1);assert.equal(e.saved.Padron[1][3],'=Ficticio');assert.equal(e.saved.Padron[1][4],'');assert.equal(e.acks,1);});
test('wrong destination or altered readback cannot acknowledge',()=>{const e=setup();e.setBad();assert.throws(()=>e.c.sincronizarMuni360Supabase(),/Destino/);assert.equal(e.writes,0);const f=setup();f.setCorrupt();assert.throws(()=>f.c.sincronizarMuni360Supabase(),/confirmó/);assert.equal(f.acks,0);});
test('lost ack repeats snapshot replacement without appending duplicate rows',()=>{const e=setup();e.setLost(true);assert.throws(()=>e.c.sincronizarMuni360Supabase(),/lost ack/);e.setLost(false);assert.equal(e.c.sincronizarMuni360Supabase().verified,1);assert.equal(e.saved.Padron.length,2);});
const exportSource=fs.readFileSync(require('node:path').join(__dirname,'../tools/ExportarDesdeSheets.gs'),'utf8');
test('export is pinned, preserves Unicode across chunks and sends no credentials to logs',()=>{let chunks=[],logs=[];const secret='mci_'+'c'.repeat(64),state={padron:[],asistencia:[],evaluaciones:[],fichas:{note:'x'.repeat(49980)+'🏑'.repeat(100)},gestos:[],email:'',sesiones:[]},properties={UGI_SUPABASE_IMPORT_KEY:secret};const c={console:{log:s=>logs.push(s)},PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k],setProperty:(k,v)=>properties[k]=v})},configUGI:()=>({project:'muni360-ugi-ensayo',owner:'owner',secret:'INTERNAL_ID_SECRET',id:'PRIVATE_SHEET',map:{Test:'VIEW'}}),LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},SHEETS_METADATA_CACHE_UGI:null,sha:v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex'),loadUsersUGI:()=>({users:[],history:{}}),readTablesUGI:()=>({}),rowsUGI:()=>[],loadActivityUGI:()=>({state,meta:{},versions:{},receipts:[],audit:{},archives:{}}),UrlFetchApp:{fetch(url,opt){assert.equal(url,'https://kaalffshnrkxviqaymhv.supabase.co/rest/v1/rpc/mc_import_part');const p=JSON.parse(opt.payload);assert.equal(p.p_secret,secret);chunks.push(p);return {getResponseCode:()=>200,getContentText:()=>'{"ok":true}'};}}};vm.createContext(c);vm.runInContext(exportSource,c);assert.equal(c.exportarMuni360ASupabase().unidades,2);for(const unit of ['global','Test']){const parts=chunks.filter(p=>p.p_unit===unit).sort((a,b)=>a.p_part-b.p_part),raw=parts.map(p=>p.p_body).join('');assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),parts[0].p_checksum);JSON.parse(raw);}assert.ok(logs.every(s=>!s.includes(secret)&&!s.includes('INTERNAL_ID_SECRET')));});

function institutional(){const e=setup(),props={UGI_SUPABASE_MAINTENANCE_KEY:'mci_fake'};e.c.PropertiesService.getScriptProperties=()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v});e.c.sha=s=>crypto.createHash('sha256').update(s).digest('hex');const old=e.c.UrlFetchApp.fetch;e.c.UrlFetchApp.fetch=(url,opt)=>url.endsWith('mc_worker_targets')?{getResponseCode:()=>200,getContentText:()=>"[]"}:old(url,opt);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../tools/SheetsInstitucional.gs'),'utf8'),e.c);return e;}
test('institutional copy handles a large season in bounded batches without duplicating rows',()=>{const e=institutional();e.job.state.asistencia=Array.from({length:5000},(_,i)=>({fecha:'2026-11-01',categoria:'Mini',equipo:'A',jugador:'Ficticio '+i,estado:'P | Sem:N',clima:'N',puntosCiudad:0}));assert.equal(e.c.sincronizarMuni360SupabaseOriginalUGI().verified,1);assert.equal(e.saved.Asistencia.length,5001);assert.ok(e.writes>1);assert.equal(e.saved.Asistencia[1][7],0);assert.equal(e.c.sincronizarMuni360SupabaseOriginalUGI().verified,1);assert.equal(e.saved.Asistencia.length,5001);});
test('CargaPadron refresh runs even when no attendance or evaluation changed',()=>{const e=institutional();let staging=0;e.c.UrlFetchApp.fetch=(url,opt)=>{const target=url.split('/').at(-1);if(target==='mc_worker_staging')staging++;return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(target==='mc_worker_jobs'?[]:target==='mc_worker_targets'?[{activity:'Test',sheet_id:'TEST_NEW_SHEET_ID_123456789'}]:{ok:true})};};assert.equal(e.c.sincronizarMuni360SupabaseOriginalUGI().verified,0);assert.equal(staging,1);e.c.sincronizarMuni360SupabaseOriginalUGI();assert.equal(staging,1);});
test('reorganized Sheets put Resumen and Cuestionarios first, summarize surveys and add missing tabs on existing books',()=>{
 const e=institutional();
 e.job.state.padron=[{id:'p1',categoria:'U13',equipo:'A',jugador:'Ana Prueba'}];
 e.job.state.asistencia=[
  {fecha:'2026-11-10',categoria:'U13',equipo:'A',jugador:'Ana Prueba',jugadorId:'p1',estado:'A | Sem:R',clima:'',puntosCiudad:''},
  {fecha:'2026-11-18',categoria:'U13',equipo:'A',jugador:'Ana Prueba',jugadorId:'p1',estado:'P | Sem:V',clima:'Vapor',puntosCiudad:5}
 ];
 e.job.state.evaluaciones=[{fecha:'2026-11-18',categoria:'U13',equipo:'A',jugador:'Ana Prueba',jugadorId:'p1',notas:{Pase:8,Actitud:9}}];
 e.job.surveys=[{
  id:'s1',title:'Clima U13',status:'active',categoria:'U13',equipo:'A',responseCount:2,
  questions:[
   {id:'q1',type:'scale',label:'Ambiente'},
   {id:'q2',type:'single',label:'Horario',options:['Bien','Tarde']},
   {id:'q3',type:'text',label:'Comentario'}
  ],
  responses:[{q1:4,q2:'Bien',q3:'Muy buen grupo'},{q1:2,q2:'Tarde',q3:'Horarios justos'}]
 }];
 const tables=e.c.tablasSupabaseUGI(e.job);
 assert.deepEqual(Object.keys(tables).slice(0,5),['Resumen','Cuestionarios','Padron','Asistencia','Evaluaciones']);
 assert.ok(tables.Resumen.some(r=>r[0]==='U13'&&r[1]==='A'&&r[6]==='50%'));
 assert.ok(tables.Cuestionarios.some(r=>r[0]==='Clima U13'&&String(r[7]).includes('3 / 5 ★')));
 assert.ok(tables.Cuestionarios.some(r=>r[0]==='Clima U13'&&String(r[8]).includes('Muy buen grupo')));
 assert.equal(tables.Padron[1][6],'50%');
 assert.equal(tables.Asistencia[1][0],'2026-11-18');
 assert.equal(tables.Asistencia[1][8],'Presente');
 assert.equal(tables.Asistencia[1][9],'🟢 Verde');
 assert.equal(tables.Evaluaciones[1][6],8.5);
 // Simulate an older spreadsheet missing Resumen & Cuestionarios tabs
 const legacyTitles=Object.keys(tables).filter(t=>t!=='Resumen'&&t!=='Cuestionarios');
 const sheetList=legacyTitles.map(title=>({properties:{title,sheetId:title,gridProperties:{rowCount:1000,columnCount:14}}}));
 const oldBatchUpdate=e.c.Sheets.Spreadsheets.batchUpdate;
 e.c.Sheets.Spreadsheets.get=()=>({sheets:sheetList});
 e.c.Sheets.Spreadsheets.batchUpdate=body=>{
  for(const req of body.requests.filter(r=>r.addSheet)){
   const p=req.addSheet.properties;
   sheetList.push({properties:{title:p.title,sheetId:p.title,gridProperties:p.gridProperties}});
  }
  return oldBatchUpdate(body);
 };
 assert.equal(e.c.sincronizarMuni360SupabaseOriginalUGI().verified,1);
 assert.ok(sheetList.some(s=>s.properties.title==='Resumen'));
 assert.ok(sheetList.some(s=>s.properties.title==='Cuestionarios'));
 assert.equal(e.saved.Cuestionarios.length,4);
});
