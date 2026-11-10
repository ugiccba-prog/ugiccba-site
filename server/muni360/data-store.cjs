'use strict';
const {AccessError,authorize,actorFrom}=require('./policy.cjs');
const {sha,copy,resource,empty,applyOperation,visible,auditSlice,records,fromRecords}=require('./domain.cjs');
function createDataStore(db,{areas,idSecret,projectActivity}){
  if(!idSecret||idSecret.length<32)throw Error('Falta ID_SECRET privado.');
  const activity=name=>db.collection('muni360_activities').doc(sha(name));
  async function load(tx,ref,seasonOverride){
    const metaDoc=await tx.get(ref);if(!metaDoc.exists)throw new AccessError('CONFIGURACION','Primero hay que importar y verificar la planilla de esta actividad.',409);const meta=metaDoc.data();
    if(meta.migrationStatus==='inProgress')throw new AccessError('MIGRACION','La importación inicial está en curso.',409);
    const season=seasonOverride||meta.activeSeason;
    const rows=await tx.get(ref.collection('seasons').doc(season).collection('rows'));
    const fichas=await tx.get(ref.collection('fichas'));
    return {meta,season,state:fromRecords(rows.docs,fichas.docs),rows};
  }
  async function checked(tx,actor){const u=await tx.get(db.collection('muni360_users').doc(actor.id));if(!u.exists||u.data().version!==actor.version)throw new AccessError('PERMISOS','Tus permisos cambiaron. Volvé a ingresar.');return actorFrom(u.data(),areas);}
  async function read(actor,d){
    const ref=activity(d.deporte);
    return db.runTransaction(async tx=>{
      const current=await checked(tx,actor);authorize(current,d);
      const seasons=await tx.get(ref.collection('seasons'));
      if(d.temporada&&!seasons.docs.some(s=>s.id===d.temporada&&s.data().closedAt))throw new AccessError('VALIDACION','Temporada inexistente.',400);
      const {meta,state}=await load(tx,ref,d.temporada);
      const versions=await tx.get(ref.collection('versions').where('season','==',meta.activeSeason));
      const versiones=Object.fromEntries(versions.docs.map(v=>[v.data().key,v.data().revision]));
      const s=visible(state,current);if(d.temporada)s.fichas={};
      return {ok:true,apiVersion:2,...s,versiones,temporada:meta.epoch,archivos:seasons.docs.filter(s=>s.data().closedAt).map(s=>({id:s.id,fecha:s.data().closedAt,modo:s.data().modo||'TEMPORADA'})),sheetsStatus:meta.sheetProjectedVersion>=meta.version?'synced':'pending',dataVersion:meta.version};
    });
  }
  async function audit(actor,d){
    const all=await activity(d.deporte).collection('audit').orderBy('fecha','desc').limit(100).get();
    const allowed=all.docs.filter(s=>actor.capabilities.verLegajo||s.data().uid===actor.id);
    if(d.auditId){
      const one=await activity(d.deporte).collection('audit').doc(String(d.auditId)).get();
      if(!one.exists)throw new AccessError('PERMISOS','Cambio no disponible.');const e=one.data();
      if(!actor.capabilities.verLegajo&&(e.uid!==actor.id||!['ASISTENCIA','EVALUACION','SESION_UGI','RECONOCIMIENTO'].includes(e.tipo)))throw new AccessError('PERMISOS','El detalle es privado.');
      if(['ALTA_PADRON','BAJA_PADRON'].includes(e.tipo)&&!actor.capabilities.verDni)throw new AccessError('PERMISOS','El detalle contiene DNI.');
      const before=copy(e.antes),after=copy(e.despues);if(e.tipo==='LEGAJO'&&!actor.capabilities.verDni){delete before.dni;delete after.dni;}return {ok:true,apiVersion:2,antes:before,despues:after};
    }
    return {ok:true,apiVersion:2,events:allowed.map(s=>{const {antes,despues,...e}=s.data();return {id:s.id,...e};})};
  }
  async function execute(actor,d){
    authorize(actor,d);
    if(['LECTURA','EXPORTAR'].includes(d.tipo))return read(actor,d);
    if(d.tipo==='AUDITORIA')return audit(actor,d);
    if(!/^[a-zA-Z0-9_-]{16,100}$/.test(d.requestId||''))throw new AccessError('VALIDACION','Falta el identificador de operación.',400);
    const ref=activity(d.deporte),receipt=ref.collection('receipts').doc(d.requestId),requestHash=sha(d);
    const result=await db.runTransaction(async tx=>{
      const current=await checked(tx,actor);authorize(current,d);
      const previous=await tx.get(receipt);
      if(previous.exists){const r=previous.data();if(r.uid!==current.id||r.requestHash!==requestHash)throw new AccessError('CONFLICTO','El identificador corresponde a otra carga.',409);return r.result;}
      const loaded=await load(tx,ref),{state,meta,season}=loaded;
      const key=resource(d),versionRef=ref.collection('versions').doc(sha([season,key])),versionDoc=await tx.get(versionRef),revision=versionDoc.exists?versionDoc.data().revision:0;
      if(d.temporada!==meta.epoch||d.revision!==revision)throw new AccessError('CONFLICTO','El registro o la temporada cambió. Actualizá y revisá.',409);
      const next=applyOperation(state,d,current,{idSecret}),now=new Date().toISOString();
      let targetSeason=season,epoch=meta.epoch;
      if(d.tipo==='RESET_DATOS'){
        targetSeason='s_'+d.requestId;epoch++;
        tx.set(ref.collection('seasons').doc(season),{closedAt:now,closedBy:current.id,modo:d.modo},{merge:true});
        tx.set(ref.collection('seasons').doc(targetSeason),{startedAt:now});
      }
      const beforeRecords=d.tipo==='RESET_DATOS'?new Map():records(state),afterRecords=records(next);
      if(afterRecords.size>400&&d.tipo==='RESET_DATOS')throw new AccessError('VALIDACION','El archivo requiere dividir la migración de grupos.',400);
      const rows=ref.collection('seasons').doc(targetSeason).collection('rows');
      for(const [id,r]of afterRecords)if(JSON.stringify(beforeRecords.get(id))!==JSON.stringify(r))tx.set(rows.doc(id),r);
      for(const id of beforeRecords.keys())if(!afterRecords.has(id))tx.delete(rows.doc(id));
      for(const [id,ficha]of Object.entries(next.fichas))if(JSON.stringify(state.fichas[id])!==JSON.stringify(ficha))tx.set(ref.collection('fichas').doc(id),ficha);
      tx.set(versionRef,{season,key,revision:revision+1});
      const version=meta.version+1,event={fecha:now,uid:current.id,autor:current.nombre,rol:current.rol,tipo:d.tipo,deporte:d.deporte,categoria:d.categoria||'',equipo:d.equipo||'',jugador:d.jugador||'',estado:'CONFIRMADO',version,antes:auditSlice(state,d),despues:auditSlice(next,d)};
      tx.set(ref.collection('audit').doc(d.requestId),event);
      tx.set(ref,{...meta,name:d.deporte,activeSeason:targetSeason,epoch,version});
      const value={ok:true,apiVersion:2,requestId:d.requestId,revision:revision+1,sheetsStatus:'pending'};
      tx.create(receipt,{uid:current.id,requestHash,result:value});
      tx.create(db.collection('muni360_outbox').doc(d.requestId),{activity:d.deporte,version,status:'pending',createdAt:now});
      return value;
    });
    if(projectActivity){try{await projectActivity(d.deporte);return {...result,sheetsStatus:'synced'};}catch(_){/* La copia a Sheets queda pendiente en la cola durable. */}}
    return result;
  }
  async function mirrorSnapshot(name){const ref=activity(name);return db.runTransaction(async tx=>{const data=await load(tx,ref);const history=await tx.get(ref.collection('audit').orderBy('version'));const seasons=await tx.get(ref.collection('seasons'));const histories=[];for(const season of seasons.docs){if(season.data().closedAt){const old=await load(tx,ref,season.id);histories.push({id:season.id,state:old.state});}}return {...data,histories,audit:history.docs.map(s=>({id:s.id,...s.data()}))};});}
  return {execute,read,mirrorSnapshot,activity};
}
module.exports={createDataStore};
