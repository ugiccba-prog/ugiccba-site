const test=require('node:test'),assert=require('node:assert/strict');
const {environment}=require('./helpers/apps-script-env.cjs');
function legajo(e){
 const person=e.read().padron[0],base={categoria:person.categoria,equipo:person.equipo,jugador:person.jugador,subjectId:person.id};
 const ficha={estadoPlan:'Seguimiento',paseInterno:'PRIVADO_REVISION',actividadesSimultaneas:[],bitacora:[{id:'evento-original',fecha:'2026-11-11',tipo:'Nota',detalle:'NOTA_RESERVADA',autor:'Autor falso'}]};
 assert.equal(e.write(e.owner,{...base,tipo:'LEGAJO',ficha}).ok,true);return {person,base,ficha};
}
test('revision: una sesion abierta pierde lectura y escritura al suspender, retirar actividad o vencer el acceso',()=>{
 for(const change of [{status:'suspendido'},{areas:['Golf']},{expiresAt:'2000-01-01T00:00:00Z'}]){
  const e=environment();e.seed();const before=e.ctx.loadActivityUGI(e.ctx.configUGI(),'Tenis');
  const users=e.ctx.loadUsersUGI(e.ctx.configUGI());Object.assign(users.users.find(u=>u.uid==='teacher'),change);
  e.ctx.writeTablesUGI('private',e.ctx.userTablesUGI(users));
  const result=e.read(e.teacher);assert.equal(result.ok,false);assert.equal(result.padron,undefined);
  assert.ok(['PENDIENTE','PERMISOS','VENCIDO'].includes(result.codigo));
  const write=e.post(e.teacher,'/api/operations',{tipo:'SESION_UGI',deporte:'Tenis',foco:'No permitido'});
  assert.equal(write.ok,false);assert.equal(JSON.stringify(e.ctx.loadActivityUGI(e.ctx.configUGI(),'Tenis')),JSON.stringify(before));
 }
});
test('revision: campos de rol/capacidades falsificados no elevan privilegios ni modifican al propietario',()=>{
 const e=environment();e.seed();
 for(const tipo of ['RESET_DATOS','LEGAJO','ALTA_PADRON']){
  const r=e.post(e.teacher,'/api/operations',{tipo,deporte:'Tenis',uid:'owner',rol:'Dirección UGI',areas:['Tenis'],capabilities:{archivar:true,verLegajo:true,administrarPadron:true},modo:'TODO'});
  assert.equal(r.codigo,'PERMISOS');
 }
 assert.equal(e.post(e.teacher,'/api/users/list').codigo,'PERMISOS');
 const r=e.post(e.owner,'/api/users/update',{uid:'owner',revision:0,rol:'Consulta',status:'suspendido',areas:[]});
 assert.equal(r.codigo,'PERMISOS');assert.equal(e.post(e.owner,'/api/me').profile.canManageUsers,true);
});
test('revision: legajo es acumulativo, rechaza alteracion y conserva autor del servidor al omitir eventos previos',()=>{
 const e=environment();e.seed();const {person,base,ficha}=legajo(e),before=e.read();
 const changed={...ficha,bitacora:[{...ficha.bitacora[0],detalle:'Reemplazo indebido'}]};
 assert.equal(e.write(e.owner,{...base,tipo:'LEGAJO',ficha:changed}).codigo,'VALIDACION');
 assert.equal(e.read().version,before.version);
 assert.equal(e.write(e.owner,{...base,tipo:'LEGAJO',ficha:{...ficha,bitacora:[]}}).ok,true);
 const events=e.read().fichas[person.id].legajo.bitacora;
 assert.equal(events.length,1);assert.equal(events[0].detalle,'NOTA_RESERVADA');assert.equal(events[0].uid,'owner');
 assert.ok(!events[0].autor.includes('falso'));
});
test('revision: historial archivado y vistas no filtran DNI ni notas privadas al profe',()=>{
 const e=environment();e.seed();legajo(e);
 assert.equal(e.write(e.owner,{tipo:'RESET_DATOS',modo:'TEMPORADA'}).ok,true);
 const archive=e.read().archivos[0].id,visible=e.read(e.teacher,'Tenis',{temporada:archive});
 const text=JSON.stringify(visible);for(const secret of ['12345678','PRIVADO_REVISION','NOTA_RESERVADA'])assert.ok(!text.includes(secret),secret);
 e.ctx.syncActivityUGI(e.ctx.configUGI(),'Tenis');
 const projected=JSON.stringify(e.books.get('tenis-public'));
 for(const secret of ['12345678','PRIVADO_REVISION','NOTA_RESERVADA'])assert.ok(!projected.includes(secret),secret);
});
test('revision: respaldo rechaza carpeta compartida y fallo de espacio sin confirmar copia ni modificar originales',()=>{
 for(const mode of ['shared','full']){
  const e=environment();e.seed();e.props.set('UGI_BACKUP_FOLDER_ID','backups');let copies=0;
  const before=JSON.stringify(e.books.get('private')),privateFields={getSharingAccess:()=> 'private',getViewers:()=>[],getEditors:()=>[]};
  e.ctx.Session={getEffectiveUser:()=>({getEmail:()=> 'owner@example.invalid'})};
  e.ctx.DriveApp={Access:{PRIVATE:'private'},getFileById:()=>({...privateFields,makeCopy(){copies++;throw Error('Drive full');}}),getFolderById:()=>({...privateFields,getSharingAccess:()=>mode==='shared'?'anyone':'private'})};
  assert.throws(()=>e.ctx.realizarBackupSemanal(),/Respaldo no confirmado/);
  assert.equal(JSON.parse(e.props.get('UGI_ULTIMO_BACKUP')).ok,false);
  assert.equal(copies,mode==='shared'?0:1);assert.equal(JSON.stringify(e.books.get('private')),before);
 }
});
