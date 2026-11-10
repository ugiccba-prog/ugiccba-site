
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function portal(file){
 const html=fs.readFileSync(file,'utf8'),code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).join('\n');
 const storage={getItem:()=>null,setItem(){throw Error('Consulta no debe crear borradores');},removeItem(){}};
 const els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{value:'',innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){}}]));
 const controls=[{disabled:false},{disabled:true}],c={document:{getElementById:id=>els.get(id),querySelectorAll:()=>controls,addEventListener(){}},window:{addEventListener(){}},sessionStorage:storage,localStorage:storage,navigator:{onLine:false},setInterval(){},setTimeout(){throw Error('Consulta no debe programar guardados');},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console};
 vm.createContext(c);vm.runInContext(code,c);
 vm.runInContext("sesion={rol:'Consulta'};toast=()=>{};writes=0;syncClient={queue:[],enqueue:async()=>{writes++;return true;}};",c);
 return {controls,els,run:s=>vm.runInContext(s,c)};
}
for(const file of ['muni360/index.html','muni360cyc/index.html']){
 test(file+': Consulta deshabilita edición y al cambiar de rol restaura el estado anterior',()=>{
  const p=portal(file);p.run('aplicarModoConsulta()');assert.ok(p.controls.every(c=>c.disabled));
  p.run("sesion.rol='Profe';aplicarModoConsulta();");assert.equal(p.controls[0].disabled,false);assert.equal(p.controls[1].disabled,true);
 });
 test(file+': Consulta bloquea una escritura antes de encolar o hacer solicitudes',async()=>{
  const p=portal(file);assert.equal(await p.run("enviarOperacion({tipo:'ASISTENCIA'})"),false);assert.equal(p.run('writes'),0);
 });
 test(file+': Consulta no crea borradores ni temporizadores de autoguardado',()=>{
  const p=portal(file);p.run('markDraft()');assert.equal(p.run('draftContext'),null);
 });
}
test('cliente: Consulta no persiste una operación nueva aunque se invoque enqueue directamente',async()=>{
 const {Client}=require('../assets/scripts/muni360-sync.js');let writes=0,requests=0;
 const c=new Client({url:'test',session:{usuario:'reader',rol:'Consulta',expiresAt:Date.now()+60000},storage:{getItem:()=>null,setItem(){writes++;}},fetch:async()=>{requests++;},lock:f=>f()});
 await assert.rejects(()=>c.enqueue({tipo:'EVALUACION'}),e=>e.code==='PERMISOS');
 assert.equal(c.queue.length,0);assert.equal(writes,0);assert.equal(requests,0);
});
