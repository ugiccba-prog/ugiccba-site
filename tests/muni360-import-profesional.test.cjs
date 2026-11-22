const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const XLSX=require('../assets/vendor/xlsx-0.20.3.full.min.js'),MuniImport=require('../assets/scripts/muni360-import.js');
function make(file,activity){
 const html=fs.readFileSync(file,'utf8'),code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).join('\n'),handlers=new Map(),sent=[],messages=[];
 const els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{value:'',innerHTML:'',textContent:'',required:true,classList:{add(){},remove(){},toggle(){}},addEventListener(k,fn){handlers.set(m[1]+':'+k,fn)},getAttribute(){return null},setAttribute(){}}]));
 const storage={getItem(){return null},setItem(){},removeItem(){}};
 const c={document:{getElementById:id=>els.get(id),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},XLSX,send:p=>sent.push(p)},XLSX,MuniImport,sessionStorage:storage,localStorage:storage,navigator:{onLine:false},setInterval(){},setTimeout(){},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console,confirm:()=>true,capture:m=>messages.push(m)};
 vm.createContext(c);vm.runInContext(fs.readFileSync('assets/scripts/muni360-time.js','utf8'),c);vm.runInContext(code,c);
 vm.runInContext("sesion={rol:'Dirección UGI',capabilities:{administrarPadron:true,verDni:true}};areaActiva="+JSON.stringify(activity)+";toast=capture;syncClient={queue:[],enqueue:async p=>{window.send(p);return false;}};",c);
 return {els,handlers,sent,messages,run:s=>vm.runInContext(s,c)};
}
const rows=[['Apellido','Nombre','DNI','Categoría','Tira'],['Juan','Uno','58999666','6y7','A'],['Pedro','Dos','58999667','6y7','A'],['Carlos','Tres','58999668','6y7','B'],['Tiago','Cuatro','58999669','6y7','B']];
test('Excel separa tiras A/B y conserva categoría y DNI',()=>{
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Padron');const r=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
 const people=MuniImport.parse(XLSX.utils.sheet_to_json(r.Sheets.Padron,{header:1,defval:''}));
 assert.deepEqual(people.map(p=>p.equipo),['A','A','B','B']);assert.equal(people[0].categoria,'6y7');assert.equal(people[0].dni,'58999666');
});
for(const [file,activity] of [['apps/muni360/source/deportes/index.html','Hockey sobre Patines Caballeros'],['apps/muni360/source/colonia/index.html','Colonia'],['apps/muni360/source/colonia/index.html','COYFD']]){
 test(activity+': vista previa conserva A/B y envía un único lote',async()=>{
  const p=make(file,activity);p.els.get('padron-cat').value='Mini';p.els.get('padron-eq').value='A';
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Padron');const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});
  await p.handlers.get('input-excel-file:change')({target:{files:[{size:buf.byteLength,arrayBuffer:async()=>buf}],value:'x'}});
  assert.equal(p.run('pendingPadronGroups.length'),2);assert.equal(p.els.get('padron-lista').required,false);
  if(activity.startsWith('Hockey sobre Patines'))assert.equal(p.run('pendingPadronGroups[0].categoria'),'Mini');
  assert.match(p.els.get('padron-import-preview').innerHTML,/Vista previa/);
  p.run("pendingPadronGroups.forEach(g=>g.categoria='Mini')");
  await p.handlers.get('form-padron:submit')({preventDefault(){}});
  assert.equal(p.sent.length,1);assert.equal(p.sent[0].tipo,'ALTA_PADRON_LOTE');
  assert.deepEqual(JSON.parse(JSON.stringify(p.sent[0].grupos.map(g=>[g.categoria,g.equipo,g.jugadores.length]))),[['Mini','A',2],['Mini','B',2]]);
 });
}
