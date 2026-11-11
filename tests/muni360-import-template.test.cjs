
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const XLSX=require('../assets/vendor/xlsx-0.20.3.full.min.js'),MuniImport=require('../assets/scripts/muni360-import.js');
function portal(file){
 const html=fs.readFileSync(file,'utf8'),code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).join('\n'),handlers=new Map(),downloads=[],messages=[];
 const els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{value:'',innerHTML:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},addEventListener(name,fn){handlers.set(m[1]+':'+name,fn);},setAttribute(){}}]));
 const storage={getItem:()=>null,setItem(){},removeItem(){}},xlsx={...XLSX,writeFile:(wb,name)=>downloads.push({wb,name})};
 const c={document:{getElementById:id=>els.get(id),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},XLSX:xlsx},XLSX:xlsx,MuniImport,sessionStorage:storage,localStorage:storage,navigator:{onLine:false},setInterval(){},setTimeout(){},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console,capture:message=>messages.push(message)};
 vm.createContext(c);vm.runInContext(code,c);vm.runInContext("sesion={rol:'Dirección UGI',capabilities:{administrarPadron:true,verDni:true}};areaActiva='Tenis';toast=capture;",c);
 return {els,handlers,downloads,messages,run:s=>vm.runInContext(s,c)};
}
for(const file of ['muni360/index.html','muni360cyc/index.html']){
 test(file+': plantilla se puede completar e importar con acentos sin guardar antes de confirmar',async()=>{
  const p=portal(file);p.els.get('descargar-plantilla-padron').onclick();assert.equal(p.downloads.length,1);
  const {wb,name}=p.downloads[0];assert.equal(name,'Muni360_plantilla_padron.xlsx');assert.deepEqual(XLSX.utils.sheet_to_json(wb.Sheets.Padron,{header:1}),[['Apellido','Nombre','DNI']]);
  XLSX.utils.sheet_add_aoa(wb.Sheets.Padron,[['Ensayo','Lucía',''],['Ensayo','Tomás','']],{origin:'A2'});
  const buffer=XLSX.write(wb,{type:'array',bookType:'xlsx'}),target={files:[{size:buffer.byteLength,arrayBuffer:async()=>buffer}],value:'file'};
  p.els.get('padron-cat').value='Importación';p.els.get('padron-eq').value='Ensayo';
  await p.handlers.get('input-excel-file:change')({target});
  assert.equal(p.els.get('padron-lista').value,'Ensayo, Lucía\nEnsayo, Tomás');assert.equal(p.run('datosDeporte.padron.length'),0);assert.equal(target.value,'');
 });
 test(file+': una cuenta sin permiso no descarga la plantilla y un archivo duplicado no carga datos',async()=>{
  const p=portal(file);p.run("sesion={rol:'Profe',capabilities:{}};");p.els.get('descargar-plantilla-padron').onclick();assert.equal(p.downloads.length,0);
  p.run("sesion={rol:'Dirección UGI',capabilities:{administrarPadron:true,verDni:true}};");
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Jugador'],['Prueba'],[' Prueba ']]),'Padron');
  const buffer=XLSX.write(wb,{type:'array',bookType:'xlsx'});
  await p.handlers.get('input-excel-file:change')({target:{files:[{size:buffer.byteLength,arrayBuffer:async()=>buffer}],value:'file'}});
  assert.ok(p.messages.some(m=>m.includes('duplicado')));assert.equal(p.run('datosDeporte.padron.length'),0);assert.equal(p.els.get('padron-lista').value,'');
 });
}
