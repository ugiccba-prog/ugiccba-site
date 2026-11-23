const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function portal(area){
 const route=area==='Colonia'?'colonia':'coyfd',html=fs.readFileSync('muni360/'+route+'/index.html','utf8');
 const els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{value:'',innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){}}]));
 const saved=new Map([['muni360cyc_ult_area',area==='Colonia'?'COYFD':'Colonia']]),storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 const c={document:{getElementById:id=>els.get(id),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},history:{state:null,replaceState(){}}},localStorage:storage,sessionStorage:storage,navigator:{onLine:false},setInterval(){},setTimeout(){},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console};
 vm.createContext(c);vm.runInContext(fs.readFileSync('assets/scripts/muni360-time.js','utf8'),c);
 vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n'),c);
 const run=s=>vm.runInContext(s,c);
 run("loads=[];storageScope='test';almacen.setItem('muni360_modo_demo','1');cargarAreaActiva=()=>{loads.push(areaActiva);};actualizarCabeceraYPestanas=()=>{};cambiarTab=id=>{tabActual=id;};renderGuiaUgi=()=>{};renderPlanificadorDua=()=>{};renderHistorialUgiLocal=()=>{};");
 return {html,run,els};
}
for(const area of ['Colonia','COYFD']){
 test(area+': tiene acceso, marca y actividad propios aunque el último uso sea del otro portal',()=>{
  const p=portal(area);assert.equal(p.run('AREA_FIJA'),area);assert.equal(p.run('areaElegidaLogin'),area);assert.deepEqual(Array.from(p.run('deportesSolo.map(x=>x.nombre)')),[area]);
  const login=p.html.slice(p.html.indexOf('<div id="login-screen">'),p.html.indexOf('id="app-header"'));
  assert.doesNotMatch(login,/id="btn-base-colonia"|id="btn-base-coyfd"|Colonia y COYFD/);
  assert.match(p.html,new RegExp('<title>MUNI 360 · '+area+' \\|'));
 });
 test(area+': limita la sesión y los paneles a su actividad, preservando permisos y los datos de entrada',()=>{
  const p=portal(area);p.run("input={usuario:'test',areas:['Colonia','COYFD','Tenis'],area:"+JSON.stringify(area==='Colonia'?'COYFD':'Colonia')+",rol:'Dirección UGI',canManageUsers:true,capabilities:{administrarPadron:true}};iniciarSesion(input);");
  assert.equal(p.run('areaActiva'),area);assert.deepEqual(Array.from(p.run('sesion.areas')),[area]);assert.deepEqual(Array.from(p.run('loads')),[area]);assert.equal(p.run('sesion.canManageUsers'),true);assert.equal(p.run('input.areas.length'),3);
  p.run("marcarSeleccionLogin("+JSON.stringify(area==='Colonia'?'COYFD':'Colonia')+")");assert.equal(p.run('areaElegidaLogin'),area);
 });
 test(area+': no abre con permisos del otro programa ni restaura su historial',()=>{
  const p=portal(area),other=area==='Colonia'?'COYFD':'Colonia';
  p.run("iniciarSesion({usuario:'test',areas:["+JSON.stringify(other)+"],area:"+JSON.stringify(other)+"});");
  assert.equal(p.run('sesion'),null);assert.equal(p.run('loads.length'),0);assert.match(p.els.get('login-error').textContent,/no tiene acceso/);
  p.run("iniciarSesion({usuario:'test',areas:['Colonia','COYFD'],area:"+JSON.stringify(area)+"});");
  assert.equal(p.run("rutaAutorizadaMuni({version:1,portal:"+JSON.stringify(other==='Colonia'?'colonia':'coyfd')+",usuario:'test',area:"+JSON.stringify(other)+"})"),false);
 });
}
test('entrada principal ofrece Colonia y COYFD como destinos distintos',()=>{
 const html=fs.readFileSync('muni360/index.html','utf8');assert.match(html,/href="\.\/colonia\/"/);assert.match(html,/href="\.\/coyfd\/"/);assert.match(html,/<h2>Colonia<\/h2>/);assert.match(html,/<h2>COYFD<\/h2>/);assert.doesNotMatch(html,/Colonia y COYFD/);
});
