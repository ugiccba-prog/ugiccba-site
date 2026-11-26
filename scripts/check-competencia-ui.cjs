const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',/\.css$/.test(file)?'text/css':/\.(mjs|js)$/.test(file)?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.MUNI360_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const width of [360,1440]){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('muni360-google.js'))return route.fulfill({contentType:'text/javascript',body:`window.failSave=true;window.MuniGoogle={observe:fn=>fn({uid:'test-owner'}),login:async()=>{},logout:async()=>{},call:async(path,body)=>{if(path==='/api/me')return {profile:{canManageUsers:true,status:'activo'}};if(path.endsWith('/roster'))return {roster:[{player_id:'p1',player_name:'Ana <img src=x onerror=alert(1)>',category:'Primera',team:'A'}]};if(path.endsWith('/save')){window.lastSave=body;if(window.failSave)throw Error('Sin conexión');return {ok:true,revision:1};}return {items:[]};}};`});
  if(url.hostname!=='127.0.0.1')return route.abort();return route.continue();
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/muni360/competencia/');
 await page.locator('#btnStart').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('btnStart').disabled);
 await page.locator('#selSport').selectOption('hockey_patines');await page.waitForFunction(()=>!document.getElementById('btnStart').disabled);
 await page.locator('#inpOpponent').fill('Rival de prueba');await page.locator('#btnStart').click();
 await page.locator('#muniButtons button').first().click();await page.locator('#playerGrid button').click();assert.equal(await page.locator('#scoreMuni').textContent(),'1');assert.equal(await page.locator('#eventLog img').count(),0);
 await page.reload();await page.locator('#resume').click();assert.equal(await page.locator('#scoreMuni').textContent(),'1');
 await page.locator('#btnSaveFinal').click();await page.waitForFunction(()=>document.getElementById('syncBadge').textContent==='Guardado pendiente');
 const id=await page.evaluate(()=>window.lastSave.competition.id);await page.evaluate(()=>window.failSave=false);await page.locator('#btnSaveFinal').click();
 await page.waitForFunction(()=>document.getElementById('syncBadge').textContent==='Guardado confirmado');assert.equal(await page.evaluate(()=>window.lastSave.competition.id),id);
 assert.ok(await page.locator('#btnSaveFinal').isDisabled());assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await context.close();console.log('Competencia UI passed at '+width+'px: roster, safe text, score, reload, offline retry and confirmed save.');
 }}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
