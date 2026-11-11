const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {Client, keyFor, splitAverage} = require('../assets/scripts/muni360-sync.js');
const dep = 'Tenis', other = 'Golf';
const clone = x => JSON.parse(JSON.stringify(x));
class Sheet {
  constructor(ss, name, data = []) { this.ss=ss; this.name=name; this.data=clone(data); }
  getName() { return this.name; }
  getLastRow() { let i=this.data.length; while(i && !(this.data[i-1]||[]).some(v=>v!=='' && v!==undefined)) i--; return i; }
  getLastColumn() { return Math.max(0,...this.data.map(r=>r.length)); }
  appendRow(r) { this.data[this.getLastRow()]=clone(r); return this; }
  getRange(row,col,n=1,m=1) {
    if (typeof row==='string') { if(row==='A1:B1') return this.getRange(1,1,1,2); if(row==='B1') return this.getRange(1,2); throw Error(row); }
    const sh=this;
    const range={getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>sh.data[row+i-1]?.[col+j-1]??'')),getValue:()=>sh.data[row-1]?.[col-1]??'',
      setValues(values) { assert.equal(values.length,n); values.forEach((r,i)=>{assert.equal(r.length,m);sh.data[row+i-1] ||= [];r.forEach((v,j)=>sh.data[row+i-1][col+j-1]=v);});return range; },
      setValue(v) { return range.setValues([[v]]); },clearContent() { return range.setValues(Array.from({length:n},()=>Array(m).fill(''))); },
      setFontWeight(){return range;},setBackground(){return range;},setFontColor(){return range;}};
    return range;
  }
  setFrozenRows() { return this; }
  copyTo(ss) { if(ss.failCopy) throw Error('copy failed'); const sh=new Sheet(ss,'copy-'+crypto.randomUUID(),this.data);ss.sheets.set(sh.name,sh);return sh; }
  setName(n) { this.ss.sheets.delete(this.name);this.name=n;this.ss.sheets.set(n,this);return this; }
}
class Spreadsheet {
  constructor(id) {this.id=id;this.sheets=new Map();}
  getId(){return this.id;}
  getSheetByName(n){return this.sheets.get(n)||null;}
  insertSheet(n){const s=new Sheet(this,n);this.sheets.set(n,s);return s;}
  getSpreadsheetTimeZone(){return 'America/Argentina/Buenos_Aires';}
}
function environment() {
  const props=new Map([['UGI_LEGAJOS_SHEET_ID','central'],['UGI_ID_SECRET','test-secret-only']]);
  const cache=new Map(), books=new Map([['central',new Spreadsheet('central')]]);
  const ctx={console,CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k),getProperties:()=>Object.fromEntries(props),setProperties:o=>Object.entries(o).forEach(([k,v])=>props.set(k,v))})},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(a,s)=>Array.from(crypto.createHash('sha256').update(s).digest()),formatDate:d=>d.toISOString().slice(0,10)},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    SpreadsheetApp:{openById:id=>{if(!books.has(id))books.set(id,new Spreadsheet(id));return books.get(id);},create:()=>new Spreadsheet(crypto.randomUUID())}};
  vm.createContext(ctx);
  for(const p of ['DeportesUGI.gs','Muni360Core.gs'])vm.runInContext(fs.readFileSync('archive/apps-script-v2/'+p,'utf8'),ctx);
  const user=(id,rol,areas=[dep])=>{const u={id,nombre:id,rol,areas,salt:'salt',hash:ctx.hashUGI('salt:strong-test-password'),version:'version-1',activo:true};props.set('UGI_USER_'+id,JSON.stringify(u));return u;};
  user('teacher','Profe');user('coord','Coordinación');user('director','Dirección UGI',Object.keys(ctx.SHEET_IDS));
  const post=d=>ctx.doPost({postData:{contents:JSON.stringify(d)}});
  const login=id=>post({tipo:'LOGIN',usuario:id,clave:'strong-test-password',deporte:dep});
  const read=(token,d=dep,extra={})=>ctx.doGet({parameter:{deporte:d,token,...extra}});
  function seed(d=dep) {const ss=ctx.abrirSheet(d);const p=ctx.hoja(ss,'Padron');p.appendRow([d,'Sub 12','A','Persona de prueba','12345678','subject-1']);return ss;}
  const send=(token,d)=>post({token,requestId:crypto.randomUUID(),revision:0,temporada:0,deporte:dep,...d});
  return {ctx,props,cache,books,post,login,read,seed,send};
}
test('rechaza tokens inventados, vencidos, cache vacía y cuenta revocada',()=>{
  const e=environment();for(const token of ['ugi_fabricado','coord_fabricado','profe_fabricado','tok_vencido',''])assert.equal(e.ctx.tokenValido(token),null);
  const s=e.login('teacher');assert.equal(s.ok,true);assert.ok(e.ctx.tokenValido(s.token));
  const raw=JSON.parse(e.cache.get('session:'+s.token));raw.expiresAt=0;e.cache.set('session:'+s.token,JSON.stringify(raw));assert.equal(e.ctx.tokenValido(s.token),null);
  const fresh=e.login('teacher');e.props.set('UGI_USER_teacher',JSON.stringify({...JSON.parse(e.props.get('UGI_USER_teacher')),activo:false}));assert.equal(e.ctx.tokenValido(fresh.token),null);
});
test('contraseñas sensibles a mayúsculas, sin claves universales y límite de intentos',()=>{
  const e=environment();assert.equal(e.post({tipo:'LOGIN',usuario:'teacher',clave:'STRONG-test-password',deporte:dep}).ok,false);
  for(let i=0;i<8;i++)e.post({tipo:'LOGIN',usuario:'unknown',clave:'wrong',deporte:dep});
  assert.equal(e.post({tipo:'LOGIN',usuario:'unknown',clave:'wrong',deporte:dep}).codigo,'LIMITE');
});
test('alcance de lectura y escritura; Profe no administra ni recibe DNI o bitácora',()=>{
  const e=environment();e.seed();const t=e.login('teacher').token;
  assert.equal(e.read(t,other).codigo,'PERMISOS');
  for(const tipo of ['RESET_DATOS','CONFIG','ALTA_PADRON','BAJA_PADRON','GESTOS','DUA','LEGAJO'])assert.equal(e.send(t,{tipo}).codigo,'PERMISOS');
  const c=e.login('coord').token;assert.equal(e.send(c,{tipo:'RESET_DATOS',deporte:other,modo:'TODO'}).codigo,'PERMISOS');
  const r=e.read(t);assert.equal(r.ok,true);assert.equal(r.padron[0].dni,'');
  assert.equal(e.read(c).padron[0].dni,'12345678');
});
test('asistencia neutral, validación antes de escribir, idempotencia y conflictos',()=>{
  const e=environment();e.seed();const token=e.login('teacher').token;
  const d={tipo:'ASISTENCIA',fecha:'2026-11-09',categoria:'Sub 12',equipo:'A',datos:{'Persona de prueba':'N | Sem:N'},clima:'N',puntosCiudad:''};
  const request={token,requestId:crypto.randomUUID(),revision:0,temporada:0,deporte:dep,...d};
  assert.equal(e.post({...request,datos:{'Persona de prueba':'INVALID'}}).codigo,'VALIDACION');
  assert.equal(e.post(request).ok,true);assert.equal(e.post(request).ok,true);assert.equal(e.read(token).asistencia.length,1);
  assert.equal(e.post({...request,requestId:crypto.randomUUID()}).codigo,'CONFLICTO');
  assert.equal(e.send(token,{...d,fecha:'2026-02-30'}).codigo,'VALIDACION');
  assert.equal(e.send(token,{...d,fecha:undefined}).codigo,'VALIDACION');
  assert.equal(e.send(token,{tipo:'EVALUACION',categoria:'Sub 12',equipo:'A',fecha:'2026-11-09',jugador:'Persona de prueba',notas:{Pase:999}}).codigo,'VALIDACION');
});
test('legajos compartidos con autor verificado; DUA visible a Profe sin notas privadas',()=>{
  const e=environment();e.seed();const token=e.login('coord').token;
  const base={categoria:'Sub 12',equipo:'A',jugador:'Persona de prueba',subjectId:'subject-1'};
  const ficha={estadoPlan:'Seguimiento',actividadesSimultaneas:[],paseInterno:'',bitacora:[{id:'evento-prueba',fecha:'2026-11-09',tipo:'Nota',detalle:'Acuerdo privado',autor:'falsificado'}]};
  assert.equal(e.send(token,{...base,tipo:'LEGAJO',ficha}).ok,true);
  assert.equal(e.send(token,{...base,tipo:'DUA',ficha:{comunicacion:'Consigna visual',desborda:'',regula:''}}).ok,true);
  const record=e.read(token).fichas['subject-1'];assert.equal(record.legajo.bitacora[0].autor,'coord (Tenis)');
  const teacher=e.read(e.login('teacher').token);assert.equal(Object.keys(teacher.fichas['subject-1'].legajo).length,0);assert.equal(teacher.fichas['subject-1'].dua.comunicacion,'Consigna visual');
  assert.equal(e.send(token,{...base,tipo:'LEGAJO',revision:1,ficha:{...ficha,bitacora:[]}}).ok,true);assert.equal(e.read(token).fichas['subject-1'].legajo.bitacora.length,1);
  assert.equal(e.send(token,{...base,tipo:'DUA',subjectId:'otro',revision:1,ficha:{}}).codigo,'VALIDACION');
});
test('tarjeta verde permitida para Profe sin acceso ni reemplazo del legajo privado',()=>{
  const e=environment();e.seed();const t=e.login('teacher').token;
  assert.equal(e.send(t,{tipo:'RECONOCIMIENTO',categoria:'Sub 12',equipo:'A',jugador:'Persona de prueba',subjectId:'subject-1',fecha:'2026-11-09',motivo:'Compañerismo',nota:''}).ok,true);
  const c=e.login('coord').token;assert.equal(e.read(c).fichas['subject-1'].legajo.bitacora[0].tipo,'🟢 Tarjeta Verde Digital');
});
test('temporadas conservan copias verificadas y rechazan cargas de la temporada anterior',()=>{
  const e=environment(),ss=e.seed(),token=e.login('coord').token;
  e.ctx.hoja(ss,'Asistencia').appendRow(['2026-11-09',dep,'Sub 12','A','Persona de prueba','P | Sem:V']);
  e.ctx.hoja(ss,'Evaluaciones').appendRow(['2026-11-09',dep,'Sub 12','A','Persona de prueba','Pase: 7',7]);
  const result=e.send(token,{tipo:'RESET_DATOS',modo:'TEMPORADA'});assert.equal(result.ok,true);
  const current=e.read(token);assert.equal(current.padron.length,1);assert.equal(current.asistencia.length,0);assert.equal(current.archivos.length,1);
  const old=e.read(token,dep,{temporada:current.archivos[0].id});assert.equal(old.asistencia.length,1);assert.equal(old.evaluaciones.length,1);
  assert.equal(e.send(token,{tipo:'ASISTENCIA',fecha:'2026-11-09',categoria:'Sub 12',equipo:'A',datos:{'Persona de prueba':'P | Sem:V'}}).codigo,'CONFLICTO');
});
test('un fallo al copiar deja intacta la temporada actual',()=>{
  const e=environment(),ss=e.seed();e.ctx.hoja(ss,'Asistencia').appendRow(['2026-11-09',dep,'Sub 12','A','Persona de prueba','P | Sem:V']);ss.failCopy=true;
  assert.equal(e.send(e.login('coord').token,{tipo:'RESET_DATOS',modo:'TEMPORADA'}).ok,false);assert.equal(ss.getSheetByName('Asistencia').getLastRow(),2);
});
test('promedios técnicos y formativos separados; sin datos queda null',()=>{
  assert.deepEqual(splitAverage([{notas:{Pase:8,Convivencia:2}}],['Convivencia']),{tecnico:8,formativo:2});assert.deepEqual(splitAverage([],[]),{tecnico:null,formativo:null});
});
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
const session={usuario:'teacher',versionUsuario:'1',token:'test',expiresAt:Date.now()+600000};
const response=data=>({ok:true,json:async()=>data});
const payload={tipo:'EVALUACION',deporte:dep,categoria:'Sub 12',equipo:'A',fecha:'2026-11-09',jugador:'Prueba',notas:{Pase:8}};
const makeClient=(options={})=>{const client=new Client({url:'https://example.invalid',storage:storage(),session,onStatus:()=>{},lock:fn=>fn(),...options});client.snapshots[dep]={versiones:{},temporada:0};return client;};
test('cola sobrevive recarga, reintenta misma operación y nunca confirma errores HTTP o JSON',async()=>{
  const store=storage();let first=true, ids=[];
  const fetcher=async(u,o)=>{const d=JSON.parse(o.body);ids.push(d.requestId);if(first){first=false;throw Error('offline');}return response({ok:true,apiVersion:2,revision:1,requestId:d.requestId});};
  const a=makeClient({storage:store,fetch:fetcher});assert.equal(await a.enqueue(payload),false);assert.equal(a.queue.length,1);
  const b=makeClient({storage:store,fetch:fetcher});await b.retry();assert.equal(b.queue.length,0);assert.equal(ids[0],ids[1]);
  for(const fetcher of [async()=>({ok:false}),async()=>response({ok:false,apiVersion:2,codigo:'SESION',error:'Vencida'})]) {const c=makeClient({fetch:fetcher});assert.equal(await c.enqueue(payload),false);assert.equal(c.queue.length,1);}
});
test('conflicto no se reenvía automáticamente y backend viejo no confirma cargas',async()=>{
  let calls=0;const c=makeClient({fetch:async()=>{calls++;return response({ok:false,apiVersion:2,codigo:'CONFLICTO',error:'Revisar'});}});assert.equal(await c.enqueue(payload),false);await c.retry();assert.equal(calls,1);
  const old=makeClient({fetch:async()=>response({ok:true})});assert.equal(await old.enqueue(payload),false);assert.equal(old.queue[0].code,'VERSION');
});
test('colas aisladas por cuenta y cambios de permisos requieren revisión',async()=>{
  const store=storage(),a=makeClient({storage:store,fetch:async()=>{throw Error('offline');}});await a.enqueue(payload);
  const b=makeClient({storage:store,session:{...session,usuario:'another'}});assert.equal(b.queue.length,0);
  const c=makeClient({storage:store,session:{...session,versionUsuario:'2'}});await c.flush();assert.equal(c.queue[0].code,'CONFLICTO');
});
test('no archiva si hay pendientes y no pierde cola si storage está lleno',async()=>{
  const c=makeClient({fetch:async()=>{throw Error('offline');}});await c.enqueue(payload);await assert.rejects(()=>c.enqueue({tipo:'RESET_DATOS',deporte:dep}),/pendientes/);
  const d=makeClient({storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}}});await assert.rejects(()=>d.enqueue(payload),/espacio/);assert.equal(d.queue.length,0);
});
test('dos pestañas no pisan la cola durable',async()=>{
  const store=storage();let tail=Promise.resolve();
  const lock=fn=>{const task=tail.then(fn);tail=task.catch(()=>{});return task;};
  const offline=async()=>{throw Error('offline');};
  const a=makeClient({storage:store,lock,fetch:offline}),b=makeClient({storage:store,lock,fetch:offline});
  await Promise.all([a.enqueue(payload),b.enqueue({...payload,jugador:'Otra persona'})]);
  const saved=JSON.parse(store.getItem(a.storageKey));assert.equal(saved.length,2);assert.equal(new Set(saved.map(x=>x.payload.requestId)).size,2);
});
test('cliente y backend integrados confirman carga y rechazan datos inválidos',async()=>{
  const e=environment();e.seed();const session=e.login('teacher');
  const fetcher=async(url,opt)=>{const body=JSON.parse(opt.body),token=opt.headers.Authorization.slice(7);return response(body.tipo==='LECTURA'?e.read(token,body.deporte):e.post({...body,token}));};
  const c=makeClient({session,fetch:fetcher});await c.read(dep);
  assert.equal(await c.enqueue({...payload,jugador:'Persona de prueba'}),true);assert.equal(e.read(session.token).evaluaciones.length,1);
  assert.equal(await c.enqueue({...payload,jugador:'Persona de prueba',notas:{Pase:-1}}),false);assert.equal(c.queue[0].code,'VALIDACION');
});
test('instalación consume el secreto temporal y no borra cuentas ajenas',()=>{
  const e=environment();
  e.props.set('UGI_AUTH_BOOTSTRAP',JSON.stringify([{usuario:'nuevo',nombre:'Persona nueva',rol:'Profe',deportes:[dep],clave:'strong-test-password'}]));
  e.ctx.instalarAccesosUGI();assert.equal(e.props.has('UGI_AUTH_BOOTSTRAP'),false);assert.ok(e.props.has('UGI_USER_teacher'));
  const user=JSON.parse(e.props.get('UGI_USER_nuevo'));assert.equal(user.clave,undefined);assert.notEqual(user.hash,'strong-test-password');assert.equal(e.login('nuevo').ok,true);
});
test('baja y alta del mismo DNI recuperan identidad estable; otro DNI no hereda su legajo',()=>{
  const e=environment();const token=e.login('coord').token;
  const base={categoria:'Sub 12',equipo:'A'};
  assert.equal(e.send(token,{...base,tipo:'ALTA_PADRON',jugadores:[{jugador:'Primera persona',dni:'12345678'}]}).ok,true);
  const id=e.read(token).padron[0].id;
  assert.equal(e.send(token,{...base,tipo:'BAJA_PADRON',jugador:'Primera persona'}).ok,true);
  assert.equal(e.send(token,{...base,tipo:'ALTA_PADRON',revision:1,jugadores:[{jugador:'Primera persona',dni:'12345678'}]}).ok,true);
  assert.equal(e.read(token).padron[0].id,id);
  assert.equal(e.send(token,{...base,tipo:'ALTA_PADRON',revision:2,jugadores:[{jugador:'Segunda persona',dni:'87654321'}]}).ok,true);
  assert.notEqual(e.read(token).padron[1].id,id);
});
test('sintaxis y arranque de los dos portales, sin autenticación local ni DUA ajeno',()=>{
  for(const path of ['muni360/index.html','muni360cyc/index.html']){
    const html=fs.readFileSync(path,'utf8'),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
    const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
    const els=new Map([...ids].map(id=>[id,{value:'',innerHTML:'',textContent:'',checked:false,disabled:false,classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){}}]));
    const store={getItem:()=>null,setItem(){},removeItem(){}};
    const context={document:{addEventListener(){},getElementById:id=>els.get(id)||null,querySelectorAll:()=>[]},sessionStorage:store,localStorage:store,window:{addEventListener(){}},navigator:{onLine:false},setInterval(){},setTimeout(){},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console,Muni360Sync:require('../assets/scripts/muni360-sync.js')};
    vm.createContext(context);vm.runInContext(fs.readFileSync("assets/scripts/muni360-time.js","utf8"),context);scripts.forEach(s=>vm.runInContext(s,context));
    assert.ok(!html.includes('validando clave localmente'));assert.ok(!html.includes('se enviará al recuperar señal'));assert.ok(!html.includes('mode: \'no-cors\''));
  }
});
test('la carga por texto conserva dos renglones como dos deportistas',async()=>{
  for(const path of ['muni360/index.html','muni360cyc/index.html']){
    const html=fs.readFileSync(path,'utf8'),script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim()).join('\n');
    const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]),handlers=new Map(),values=new Map();
    const els=new Map(ids.map(id=>[id,{value:'',innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){handlers.set(id+':'+type,fn);},setAttribute(){}}]));
    const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
    const ctx={document:{getElementById:id=>els.get(id)||null,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},sessionStorage:storage,localStorage:storage,navigator:{onLine:false},setInterval(){},setTimeout(){},clearTimeout(){},URLSearchParams,location:{search:'',hash:''},console,crypto,Muni360Sync:require('../assets/scripts/muni360-sync.js')};
    vm.createContext(ctx);vm.runInContext(fs.readFileSync("assets/scripts/muni360-time.js","utf8"),ctx);vm.runInContext(script,ctx);
    vm.runInContext("almacen.setItem('muni360_modo_demo','1');areaActiva='Tenis';datosDeporte={padron:[],asistencia:[],evaluaciones:[],fichas:{}};cfgActual=()=>({esBase:false});renderFiltrosDeporte=()=>{};renderVistaActiva=()=>{};cargarAreaActiva=async()=>{};",ctx);
    els.get('padron-cat').value='Sub 12';els.get('padron-eq').value='A';els.get('padron-lista').value='Persona, Uno\nPersona, Dos';
    await handlers.get('form-padron:submit')({preventDefault(){}});assert.equal(vm.runInContext('datosDeporte.padron.length',ctx),2);
    assert.ok(!html.includes(".join('\\\\n')"));
  }
});
