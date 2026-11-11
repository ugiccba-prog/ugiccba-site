// Local demo only: isolated browser, fictitious records, no authenticated Google traffic.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MUNI360_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(__dirname,'..');
const output=process.env.MUNI360_UI_OUTPUT||path.join(os.tmpdir(),'muni360-ui-check');fs.mkdirSync(output,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 try{
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');if(name.endsWith('/'))name+='index.html';
  const file=path.resolve(root,name),first=name.split('/')[0];
  if(!file.startsWith(root+path.sep)||!['muni360','muni360cyc','admin','assets','escudo-ccba.png'].includes(first)){res.writeHead(403);return res.end();}
  const bytes=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.MUNI360_BROWSER_PATH?{executablePath:process.env.MUNI360_BROWSER_PATH}:{})});
 const results=[];
 try{
  for(const portal of ['muni360','muni360cyc'])for(const width of [360,390,1440])for(const profile of ['direccion','profe']){
   const height=width===1440?1000:844,context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1}),page=await context.newPage(),errors=[],businessRequests=[];
   page.on('dialog',dialog=>dialog.accept());page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>{
    const host=new URL(route.request().url()).hostname;
    if(/script\.google|identitytoolkit|accounts\.google/.test(host))businessRequests.push(host);
    return host==='127.0.0.1'?route.continue():route.abort();
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/'+portal+'/?demo=1',{waitUntil:'load'});
   await page.locator('#app-screen').waitFor({state:'visible'});
   await page.waitForFunction(()=>{const el=document.getElementById('toast');return !el||getComputedStyle(el).opacity==='0'||getComputedStyle(el).display==='none';},{},{timeout:6000});
   if(profile==='profe')await page.evaluate(()=>{sesion.rol='Profe';sesion.esAdminTotal=false;sesion.canManageUsers=false;sesion.capabilities={};actualizarCabeceraYPestanas();renderAsistencia();});
   const rows=page.locator('#lista-asist .asist-row');assert.ok(await rows.count()>0);
   assert.equal(await page.locator('#nav-tabs .tab').first().getAttribute('data-tab'),'asistencia');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page overflow');
   assert.equal(await page.locator('#modo-cancha').count(),0,'removed mode button');
   const firstRowTop=(await rows.first().boundingBox()).y;
   if(profile==='profe'&&width<640){
    assert.equal(await page.locator('.toolbar-cancha').isVisible(),false,'empty professor toolbar must collapse');
    assert.ok(firstRowTop<470,'players should appear above 470px by default');
   }
   assert.equal(await page.locator('#kpis-asist-dia').isVisible(),false,'summary starts collapsed');
   await page.locator('.ayuda-asistencia summary').click();
   const help=await page.locator('#sub-lista-asist').boundingBox();
   assert.ok(help.x>=0&&help.x+help.width<=width,'legend fits viewport');
   await page.locator('.ayuda-asistencia summary').click();
   assert.equal(await page.locator('#btn-guardar-asist').evaluate(el=>getComputedStyle(el).position),'static');
   const tiny=await page.locator('#lista-asist .sem-btn,#lista-asist .pat button').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44;}).length);
   assert.equal(tiny,0,'attendance targets must be at least 44px');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'cancha overflow');
   const first=rows.first(),player=await first.getAttribute('data-jugador');
   await page.locator('#buscar-alumno-asist').fill(player);assert.equal(await rows.count(),1);
   await rows.first().locator('[data-e="A"]').click();assert.equal(await rows.first().locator('[data-e="A"]').getAttribute('aria-pressed'),'true');
   await rows.first().locator('[data-e="P"]').click();
   await rows.first().locator('[data-sem="V"]').click();assert.equal(await rows.first().locator('[data-sem="V"]').getAttribute('aria-pressed'),'true');
   await page.locator('#buscar-alumno-asist').fill('');
   await rows.last().locator('[data-e="P"]').scrollIntoViewIfNeeded();
   const target=await rows.last().locator('[data-e="P"]').boundingBox(),save=await page.locator('#btn-guardar-asist').boundingBox();
   assert.ok(target.y+target.height<=save.y||target.y>=save.y+save.height,'fixed save overlaps last controls');
   await page.locator('.resumen-jornada summary').click();assert.equal(await page.locator('#kpis-asist-dia').isVisible(),true);
   await page.locator('.resumen-jornada summary').click();
   await page.locator('#btn-toggle-filtros').click();assert.equal(await page.locator('#card-filtros').isVisible(),true);
   await page.locator('#btn-listo-filtros').click();
   const evalTab=page.locator('[data-tab="evaluacion"]');
   if(await evalTab.isVisible()){
    await evalTab.click();assert.equal(await page.locator('#btn-guardar-asist').isVisible(),false);
    await page.locator('#lista-eval button').first().click();assert.equal(await page.locator('#panel-gestos').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'evaluation overflow');
   }
   await page.locator('[data-tab="asistencia"]').click();await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(output,portal+'-'+profile+'-'+width+'.png'),fullPage:false});
   await rows.first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,portal+'-'+profile+'-controls-'+width+'.png'),fullPage:false});
   assert.deepEqual(errors,[]);assert.deepEqual(businessRequests,[]);
   results.push({portal,profile,width,firstRowTop:Math.round(firstRowTop),rows:await rows.count(),overflow:false,touchTargets:true,attendance:true,filters:true,evaluation:true,errors:0});
   await context.close();
  }
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
