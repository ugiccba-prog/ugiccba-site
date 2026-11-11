// Own local page + actual PostgreSQL/WASM. Firebase and HTTP gateway are fixtures.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.MUNI_PGLITE_MODULE||'@electric-sql/pglite');
const {chromium}=require(process.env.MUNI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),web=path.join(root,'web');let db,browser,server;
(async()=>{
 db=new PGlite();await db.waitReady;await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;");
 for(const f of ['001_pilot.sql','004_private_guardrails.sql','002_fictitious_roster.sql'])await db.exec(fs.readFileSync(path.join(root,'sql',f),'utf8'));
 server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;const file=path.resolve(web,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(web+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.png':'image/png'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const launch={headless:true};if(process.env.MUNI_CHROME_PATH)launch.executablePath=process.env.MUNI_CHROME_PATH;else launch.channel=process.env.MUNI_BROWSER_CHANNEL||'chrome';browser=await chromium.launch(launch);
 let tail=Promise.resolve();const serial=fn=>{const result=tail.then(fn);tail=result.catch(()=>{});return result;};
 async function rpc(name,a,uid){return serial(async()=>{await db.exec('begin');try{const j={sub:uid,aud:'muni360-ugi-ensayo',iss:'https://securetoken.google.com/muni360-ugi-ensayo',email_verified:true,exp:Math.floor(Date.now()/1000)+3600,firebase:{sign_in_provider:'google.com'}};await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(j)]);await db.exec('set local role anon');let result;
 if(name==='mp_profile'||name==='mp_groups')result=await db.query('select public.'+name+'() as value');
 else if(name==='mp_read_group')result=await db.query('select public.mp_read_group($1::uuid,$2::date) as value',[a.p_group,a.p_day]);
 else if(name==='mp_save_attendance')result=await db.query('select public.mp_save_attendance($1::uuid,$2::uuid,$3::date,$4::int,$5::int,$6::int,$7::jsonb,$8::text,$9::int) as value',[a.p_request,a.p_group,a.p_day,a.p_season,a.p_roster_revision,a.p_revision,JSON.stringify(a.p_rows),a.p_climate,a.p_points]);
 else throw Error('Unknown RPC');await db.exec('commit');return {status:200,data:result.rows[0].value};
 }catch(e){await db.exec('rollback');return {status:e.code==='40001'?409:e.code==='42501'?403:400,data:{code:e.code,message:e.message}};}});}
 let cases=0;
 for(const width of [360,1440])for(const role of ['Profe','Consulta']){
  const uid=role==='Consulta'?'pilot-reader':'pilot-teacher',context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];let offline=false;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER_ERROR',m.text());});page.on('requestfailed',r=>console.log('REQUEST_FAILED',r.url(),r.failure()?.errorText));page.on('dialog',d=>d.accept());
  await page.route('**/*',async route=>{const url=new URL(route.request().url());
   if(url.hostname==='127.0.0.1'&&url.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:"window.MUNI_PILOT_CONFIG={url:'https://pilot.supabase.co',publishableKey:'sb_publishable_fixture',firebase:{projectId:'muni360-ugi-ensayo',apiKey:'fixture',authDomain:'fixture',appId:'fixture'}};"});
   if(url.hostname==='127.0.0.1')return route.continue();
   if(url.hostname==='www.gstatic.com'){
    const body=url.pathname.endsWith('firebase-app.js')?'export function initializeApp(){return {};}' : `const user={uid:${JSON.stringify(uid)},getIdToken:async()=> 'fixture-token'};export const browserSessionPersistence={};export function getAuth(){return {currentUser:user};}export async function setPersistence(){}export function onAuthStateChanged(a,fn){queueMicrotask(()=>fn(user));}export class GoogleAuthProvider{}export async function signInWithPopup(){return {user};}export async function signOut(){}`;
    return route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body});
   }
   if(url.hostname==='pilot.supabase.co'){const cors={'access-control-allow-origin':base,'access-control-allow-headers':'apikey,authorization,content-type','access-control-allow-methods':'POST,OPTIONS'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});if(offline)return route.abort('internetdisconnected');const result=await rpc(url.pathname.split('/').pop(),route.request().postDataJSON(),uid);return route.fulfill({status:result.status,contentType:'application/json',headers:cors,body:JSON.stringify(result.data)});}
   return route.abort();
  });
  await page.goto(base);try{await page.locator('#roster .row').nth(19).waitFor({timeout:12000});}catch(e){console.log('UI_DIAGNOSTIC',await page.locator('#message').textContent(),errors);throw e;}assert.equal(await page.locator('#roster .row').count(),20);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(role==='Consulta'){assert.equal(await page.locator('#save').isDisabled(),true);assert.equal(await page.locator('#roster select').first().isDisabled(),true);assert.equal(await page.locator('#load').isEnabled(),true);}
  else{
   await page.locator('#all').click();await page.locator('#climate').selectOption('Vapor');await page.locator('#points').fill('10');await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Guardado confirmado'));
   await page.locator('#load').click();await page.waitForFunction(()=>document.getElementById('message').textContent.startsWith('Grupo abierto'));assert.equal(await page.locator('#climate').inputValue(),'Vapor');assert.equal(await page.locator('#points').inputValue(),'10');
   offline=true;await page.locator('#roster .row select').first().selectOption('T');await page.locator('#save').click();await page.locator('#pending').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('retry').disabled);const before=JSON.parse(await page.locator('#pending-data').textContent()).p_request;
   offline=false;await page.reload();await page.locator('#roster .row').nth(19).waitFor();await page.locator('#pending').waitFor({state:'visible'});assert.equal(JSON.parse(await page.locator('#pending-data').textContent()).p_request,before);await page.locator('#retry').click();await page.locator('#pending').waitFor({state:'hidden'});assert.equal(await page.locator('#roster .row select').first().inputValue(),'T');
  }
  assert.deepEqual(errors,[]);console.log('UI_PASS '+width+' '+role);cases++;await context.close();
 }
 console.log(JSON.stringify({kind:'LOCAL_UI_POSTGRES_WITH_FAKE_GOOGLE',cases,passed:true}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.close();if(db)await db.close();});
