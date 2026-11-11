const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function portal(file){
 const html=fs.readFileSync(file,'utf8'),code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).join('\n'),els=new Map();
 for(const match of html.matchAll(/id="([^"]+)"/g)){
  const classes=new Set();els.set(match[1],{value:'',textContent:'',innerHTML:'',disabled:false,style:{},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),toggle(k,on){if(on===undefined)on=!classes.has(k);if(on)classes.add(k);else classes.delete(k);}},addEventListener(){},setAttribute(){}});
 }
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const c={document:{getElementById:id=>els.get(id),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},sessionStorage:storage,localStorage:storage,navigator:{onLine:false},setInterval(){},setTimeout(){},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console};
 vm.createContext(c);vm.runInContext(fs.readFileSync('assets/scripts/muni360-time.js','utf8'),c);vm.runInContext(code,c);
 return {els,run:s=>vm.runInContext(s,c)};
}
for(const file of ['muni360/index.html','muni360cyc/index.html'])test(file+': perfiles operativos no abren Cambios ni consultan auditoria; al bajar rol se limpia y vuelve a asistencia',async()=>{
 const p=portal(file);
 p.run("storageScope='demo';almacen.setItem('muni360_modo_demo','1');sesion={rol:'Profe',profeNombre:'Ejemplo',areas:[],capabilities:{},esAdminTotal:false};let auditCalls=0;syncClient={queue:[],request:async()=>{auditCalls++;throw Error('No debe consultar');}};");
 for(const role of ['Profe','Reemplazante','Consulta']){
  p.run("sesion.rol="+JSON.stringify(role)+";actualizarCabeceraYPestanas();cambiarTab('auditoria');");
  await p.run('renderAuditoria()');
  assert.equal(p.els.get('tab-btn-auditoria').classList.contains('hidden'),true,role);
  assert.equal(p.els.get('nav-tabs').classList.contains('nav-operativa'),true,role);
  assert.equal(p.run('tabActual'),'asistencia');assert.equal(p.run('auditCalls'),0);
 }
 for(const role of ['Dirección UGI','Coordinación']){
  p.run("sesion.rol="+JSON.stringify(role)+";actualizarCabeceraYPestanas();");
  assert.equal(p.els.get('tab-btn-auditoria').classList.contains('hidden'),false,role);
 }
 p.run("tabActual='auditoria';sesion.rol='Profe';");p.els.get('audit-list').textContent='Datos anteriores';
 p.run('actualizarCabeceraYPestanas()');assert.equal(p.run('tabActual'),'asistencia');assert.equal(p.els.get('audit-list').textContent,'');
 assert.equal(p.run("permiso('administrarPadron')"),false,'profe de demostracion no hereda permisos de direccion');
});
