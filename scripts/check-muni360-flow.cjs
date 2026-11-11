// Full portal workflow against the real Apps Script engine with in-memory Google adapters.
// No production credentials, browser profiles or remote Google requests.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MUNI360_PLAYWRIGHT_MODULE||'playwright');
const {environment}=require('../tests/helpers/apps-script-env.cjs');
const root=path.resolve(__dirname,'..'),e=environment(),areas=['Básquet Caballeros','Colonia'];
e.props.set('UGI_SHEET_MAP',JSON.stringify({[areas[0]]:'basket-view',Colonia:'colonia-view'}));
e.grant(e.teacher,{areas});e.props.set('UGI_SYNC_ON_SAVE','true');
for(const deporte of areas){
 assert.equal(e.write(e.owner,{tipo:'ALTA_PADRON',deporte,categoria:'Ensayo',equipo:'A',jugadores:[{jugador:'Persona Uno',dni:'12345678'},{jugador:'Persona Dos'}]}).ok,true);
 const p=e.read(e.owner,deporte).padron[0],base={deporte,categoria:p.categoria,equipo:p.equipo,jugador:p.jugador,subjectId:p.id};
 assert.equal(e.write(e.owner,{...base,tipo:'DUA',ficha:{comunicacion:'APOYO_VISIBLE',desborda:'',regula:''}}).ok,true);
 assert.equal(e.write(e.owner,{...base,tipo:'LEGAJO',ficha:{paseInterno:'NOTA_PRIVADA_FLUJO',estadoPlan:'',actividadesSimultaneas:[],bitacora:[]}}).ok,true);
}
const calls=[],mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
let port;
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/backend'){
   let raw='';for await(const part of req)raw+=part;
   const d=JSON.parse(raw);calls.push({tipo:d.tipo,path:d.path,uid:d.idToken===e.owner?'owner':'teacher'});
   const result=e.ctx.doPost({postData:{contents:raw}});res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(result));
  }
  if(url.pathname==='/assets/scripts/muni360-config.js'){
   res.writeHead(200,{'Content-Type':mime['.js']});return res.end('window.MUNI_CONFIG='+JSON.stringify({backend:'apps-script',apiBaseUrl:'http://127.0.0.1:'+port+'/api/backend'})+';');
  }
  if(url.pathname==='/assets/scripts/muni360-google.js'){
   res.writeHead(200,{'Content-Type':mime['.js']});
   return res.end(`(function(){const owner=new URLSearchParams(location.search).get('qa')==='owner',token=owner?${JSON.stringify(e.owner)}:${JSON.stringify(e.teacher)};async function call(path,body={}){const r=await fetch('/api/backend',{method:'POST',body:JSON.stringify({...body,path,idToken:token})});const d=await r.json();if(!d.ok)throw Object.assign(Error(d.error),{code:d.codigo});return d;}window.MuniGoogle={configured:()=>true,getToken:async()=>token,call,syncSheets:deporte=>call('/api/sheets/sync',{deporte}),observe:fn=>queueMicrotask(()=>fn({uid:owner?'owner':'teacher'})),login:async()=>{},logout:async()=>{}};})();`);
  }
  let name=decodeURIComponent(url.pathname).replace(/^\//,'');if(name.endsWith('/'))name+='index.html';
  const file=path.resolve(root,name),first=name.split('/')[0];
  if(!file.startsWith(root+path.sep)||!['muni360','muni360cyc','admin','assets','escudo-ccba.png'].includes(first)){res.writeHead(403);return res.end();}
  const bytes=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
async function until(check){const end=Date.now()+12000;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error('Workflow condition not reached');}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));port=server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.MUNI360_BROWSER_PATH?{executablePath:process.env.MUNI360_BROWSER_PATH}:{})}),report=[];
 try{
  for(const [index,portal]of ['muni360','muni360cyc'].entries()){
   const deporte=areas[index],context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],responses=[];
   await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
   page.on('dialog',d=>d.accept());page.on('pageerror',error=>errors.push(error.message));
   page.on('response',async r=>{if(r.url().endsWith('/api/backend'))responses.push(await r.text());});
   await page.goto('http://127.0.0.1:'+port+'/'+portal+'/?qa=profe');await page.locator('#app-screen').waitFor({state:'visible'});
   await page.locator('#lista-asist .asist-row').first().waitFor();assert.equal(await page.locator('#lista-asist .asist-row').count(),2);
   assert.equal(await page.locator('#tab-btn-auditoria').isVisible(),false);
   assert.equal(await page.locator('#tab-btn-padron').isVisible(),false);
   assert.equal(await page.locator('#lista-asist [data-e="N"][aria-pressed="true"]').count(),2);
   await page.locator('#lista-asist [data-dua-ver]').first().click();
   await page.locator('#dua-modal').waitFor({state:'visible'});assert.ok((await page.locator('#dua-modal-body').textContent()).includes('APOYO_VISIBLE'));
   assert.ok(!(await page.locator('#dua-modal-body').textContent()).includes('NOTA_PRIVADA_FLUJO'));
   await page.locator('#dua-modal').click({position:{x:2,y:2}});
   await page.locator('#lista-asist [data-e="P"]').first().click();
   await until(()=>e.read(e.owner,deporte).asistencia.length===2);
   await until(async()=>await page.evaluate(()=>syncClient.queue.length===0&&!guardandoOperacion));
   assert.equal(e.read(e.owner,deporte).sheetsStatus,'synced');
   await page.reload();await page.locator('#lista-asist [data-e="P"][aria-pressed="true"]').first().waitFor();
   await page.locator('[data-tab="evaluacion"]').click();await page.locator('#lista-eval button').first().click();
   await page.locator('#contenedor-gestos input').first().fill('6.5');await page.locator('#btn-guardar-eval').click();
   await until(()=>e.read(e.owner,deporte).evaluaciones.some(r=>Object.values(r.notas).includes(6.5)));
   await page.locator('[data-tab="asistencia"]').click();await context.setOffline(true);
   await page.locator('#lista-asist [data-e="T"]').first().click();
   await until(async()=>await page.evaluate(()=>syncClient.queue.length>0));
   await context.setOffline(false);
   await until(()=>e.read(e.owner,deporte).asistencia.some(r=>r.estado.startsWith('T')));
   await until(async()=>await page.evaluate(()=>syncClient.queue.length===0));
   const saved=e.ctx.loadActivityUGI(e.ctx.configUGI(),deporte),count=Object.values(saved.audit).filter(r=>r.tipo==='ASISTENCIA').length;
   await page.locator('#btn-guardar-asist').scrollIntoViewIfNeeded();await page.locator('#btn-guardar-asist').dblclick();
   await until(async()=>await page.evaluate(()=>!guardandoOperacion));
   const after=e.ctx.loadActivityUGI(e.ctx.configUGI(),deporte);
   assert.ok(Object.values(after.audit).filter(r=>r.tipo==='ASISTENCIA').length<=count+1,'double click produced duplicate operations');
   for(const response of responses)for(const secret of ['12345678','NOTA_PRIVADA_FLUJO'])assert.ok(!response.includes(secret),'private data delivered to teacher');
   assert.deepEqual(errors,[]);report.push({portal,authenticatedPathWithAdapters:true,dua:true,privateDataRedacted:true,autosave:true,sheetsVerified:true,decimalEvaluation:true,offlineRecovery:true,doubleClick:true});
   await context.close();
  }
  const context=await browser.newContext(),page=await context.newPage();await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:'+port+'/admin/?qa=owner');await page.locator('#panel').waitFor({state:'visible'});
  assert.ok(await page.locator('#users [data-edit]').count()>=2);assert.ok((await page.locator('#history').textContent()).length>0);
  await context.close();console.log(JSON.stringify({ok:true,report,ownerAdmin:true,apiCalls:calls.length,realGoogle:false},null,2));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
