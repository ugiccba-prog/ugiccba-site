const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const time=require('../assets/scripts/muni360-time.js'),{environment}=require('./helpers/apps-script-env.cjs');
test('Argentina: cambios nocturnos y fechas de clase usan el dia argentino sin depender del dispositivo',()=>{
 const iso='2026-11-12T01:15:00Z';
 for(const TZ of ['UTC','Asia/Tokyo','Pacific/Honolulu','America/Argentina/Buenos_Aires']){
  const result=JSON.parse(execFileSync(process.execPath,['-e',"const t=require('./assets/scripts/muni360-time.js');console.log(JSON.stringify([t.format('"+iso+"'),t.dateIso('"+iso+"'),t.fromInput('2026-11-11T22:15')]))"],{env:{...process.env,TZ},encoding:'utf8'}));
  assert.deepEqual(result,['11/11/2026 22:15:00 (ARG)','2026-11-11','2026-11-12T01:15:00.000Z']);
 }
 assert.equal(time.dateIso('2026-01-01T02:30:00Z'),'2025-12-31');
 assert.equal(time.dateIso(iso,1),'2026-11-10');
 assert.equal(time.format('2026-11-11'),'11/11/2026');
});
test('Argentina: vencimientos convierten ida y vuelta, rechazan fechas imposibles y no mutan el historial',()=>{
 const original={fecha:'2026-11-12T01:15:00Z',expiresAt:'2026-11-12T02:30:00Z',asistencia:{fecha:'2026-11-11'},nota:'2026-11-12T01:15:00Z'};
 assert.equal(time.toInput(original.expiresAt),'2026-11-11T23:30');
 assert.equal(time.fromInput('2026-11-11T23:30'),'2026-11-12T02:30:00.000Z');
 for(const input of ['2026-02-31T12:00','2026-13-01T12:00','2026-11-11T25:00','invalido'])assert.throws(()=>time.fromInput(input));
 const view=JSON.parse(time.displayJson(original));assert.equal(view.fecha,'11/11/2026 22:15:00 (ARG)');
 assert.equal(view.asistencia.fecha,'2026-11-11');assert.equal(view.nota,original.nota);assert.equal(original.fecha,'2026-11-12T01:15:00Z');
 assert.equal(time.format(null),'—');assert.equal(time.format('invalido'),'—');assert.equal(time.dateIso('2026-02-31'),'');
});
test('Argentina: las vistas de Sheets convierten cambios a horario argentino y preservan el timestamp original',()=>{
 const e=environment();e.seed();const a=e.ctx.loadActivityUGI(e.ctx.configUGI(),'Tenis');
 a.audit.prueba={id:'prueba',tipo:'ASISTENCIA',fecha:'2026-11-12T01:15:00Z',autor:'Profe',categoria:'Ensayo',equipo:'A',jugador:'Persona'};
 const projection=e.ctx.projectionUGI('Tenis',a);
 assert.equal(projection.Cambios[0][0],'Fecha y hora (Argentina)');assert.equal(projection.Cambios[1][0],'11/11/2026 22:15:00');
 assert.equal(a.audit.prueba.fecha,'2026-11-12T01:15:00Z');
});
test('Argentina: el editor de permisos muestra hora argentina y envia el vencimiento UTC correcto',async()=>{
 const els=new Map(),sent=[];let observe;
 const el=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',innerHTML:'',classList:{add(){},remove(){},toggle(){}},addEventListener(name,fn){this[name]=fn;},showModal(){},close(){}});return els.get(id);};
 const user={uid:'profe',nombre:'Profe',email:'profe@example.invalid',rol:'Reemplazante',status:'activo',areas:['Tenis'],capabilities:{},revision:1,expiresAt:'2026-11-12T02:30:00Z'};
 const c={Muni360Time:time,URLSearchParams,location:{search:''},document:{getElementById:el,querySelectorAll:selector=>selector.includes('data-area')?[{dataset:{area:'Tenis'}}]:[]},MuniGoogle:{observe:fn=>{observe=fn;},call:async(path,body)=>{
  if(path==='/api/me')return {profile:{canManageUsers:true,status:'activo'},catalog:{roles:['Reemplazante'],areas:['Tenis']}};
  if(path==='/api/users/list')return {users:[user]};
  if(path==='/api/users/history')return {events:[{fecha:'2026-11-12T01:15:00Z',autor:'Propietario',target:user.email}]};
  sent.push(body);return {authorizationUpdated:true};
 }}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('assets/scripts/muni360-admin.js','utf8'),c);
 await observe({uid:'owner'});el('users').click({target:{closest:()=>({dataset:{edit:'profe'}})}});
 assert.equal(el('expires').value,'2026-11-11T23:30');assert.ok(el('history').innerHTML.includes('11/11/2026 22:15:00 (ARG)'));
 el('role').value='Reemplazante';el('state').value='activo';
 await el('access-form').onsubmit({preventDefault(){}});
 assert.equal(sent[0].expiresAt,'2026-11-12T02:30:00.000Z');
});


test('Argentina: el historial de ambos portales renderiza el horario argentino y escapa el autor',async()=>{
 for(const file of ['muni360/index.html','muni360cyc/index.html']){
  const html=fs.readFileSync(file,'utf8'),start=html.indexOf('async function renderAuditoria(){'),end=html.indexOf("    $('sync-sheets').onclick",start);
  assert.ok(start>0&&end>start);
  const output={innerHTML:''},esc=value=>String(value??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const c={Muni360Time:time,esc,$:()=>output,areaActiva:'Tenis',syncClient:{request:async()=>({events:[{tipo:'ASISTENCIA',fecha:'2026-11-12T01:15:00Z',autor:'<Profe>',categoria:'Ensayo',equipo:'A',estado:'CONFIRMADO',id:'prueba'}]})}};
  vm.createContext(c);vm.runInContext(html.slice(start,end),c);await vm.runInContext('renderAuditoria()',c);
  assert.ok(output.innerHTML.includes('11/11/2026 22:15:00 (ARG)'),file);assert.ok(output.innerHTML.includes('&lt;Profe&gt;'));
  assert.ok(!output.innerHTML.includes('2026-11-12T01:15'));
 }
});
