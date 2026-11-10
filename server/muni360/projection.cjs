'use strict';
const {randomUUID}=require('node:crypto');
const {sha}=require('./domain.cjs');
function tablesFor(snapshot,name){
  const s=snapshot.state;
  const attendance=rows=>rows.map(r=>[r.fecha,name,r.categoria,r.equipo,r.jugador,r.estado,r.clima||'',r.puntosCiudad||'']);
  const evals=rows=>rows.map(r=>[r.fecha,name,r.categoria,r.equipo,r.jugador,Object.entries(r.notas||{}).map(([k,v])=>k+': '+v).join(' | ')]);
  const publicTables={
    Padron:[['Deporte','Categoría','Equipo','Jugador','DNI (privado)','ID deportista'],...s.padron.map(p=>[name,p.categoria,p.equipo,p.jugador,'',p.id])],
    Asistencia:[['Fecha','Deporte','Categoría','Equipo','Jugador','Estado','Clima','Puntos Ciudad'],...attendance(s.asistencia)],
    Evaluaciones:[['Fecha','Deporte','Categoría','Equipo','Jugador','Notas técnicas y formativas'],...evals(s.evaluaciones)],
    Gestos:[['Variable'],...s.gestos.map(g=>[g])],
    ApoyosDUA:[['ID','Jugador','Comunicación','Evitar','Apoyos'],...s.padron.filter(p=>s.fichas[p.id]?.dua).map(p=>{const f=s.fichas[p.id].dua;return [p.id,p.jugador,f.comunicacion,f.desborda,f.regula];})],
    Cambios:[['Fecha','Autor','Tipo','Categoría','Equipo','Jugador','ID cambio'],...snapshot.audit.filter(e=>['ASISTENCIA','EVALUACION','RECONOCIMIENTO'].includes(e.tipo)).map(e=>[e.fecha,e.autor,e.tipo,e.categoria,e.equipo,e.jugador,e.id])],
    EstadoSync:[['Campo','Valor'],['Actividad',name],['Versión',snapshot.meta.version],['Actualizado UTC',new Date().toISOString()],['Uso','Vista sincronizada. Cargar cambios desde la app o desde la pestaña CargaPadron.']],
    HistorialAsistencia:[['Temporada','Fecha','Deporte','Categoría','Equipo','Jugador','Estado','Clima','Puntos'],...snapshot.histories.flatMap(h=>attendance(h.state.asistencia).map(r=>[h.id,...r]))],
    HistorialEvaluaciones:[['Temporada','Fecha','Deporte','Categoría','Equipo','Jugador','Notas'],...snapshot.histories.flatMap(h=>evals(h.state.evaluaciones).map(r=>[h.id,...r]))]
  };
  publicTables.HistorialPadron=[['Temporada','Categoría','Equipo','Jugador','ID'],...snapshot.histories.flatMap(h=>h.state.padron.map(p=>[h.id,p.categoria,p.equipo,p.jugador,p.id]))];
  const prefix=sha(name).slice(0,10),chunks=[];
  for(const e of snapshot.audit)for(const lado of ['antes','despues']){const value=JSON.stringify(e[lado]);for(let i=0;i<value.length;i+=30000)chunks.push([e.id,lado,i/30000,value.slice(i,i+30000)]);}
  const privateTables={
    [prefix+'_Padron']:[['Deporte','Categoría','Equipo','Jugador','DNI','ID'],...s.padron.map(p=>[name,p.categoria,p.equipo,p.jugador,p.dni||'',p.id])],
    [prefix+'_Legajos']:[['ID','Apoyos y legajo JSON'],...Object.entries(s.fichas).map(([id,f])=>[id,JSON.stringify(f)])],
    [prefix+'_HistorialPadron']:[['Temporada','Categoría','Equipo','Jugador','DNI','ID'],...snapshot.histories.flatMap(h=>h.state.padron.map(p=>[h.id,p.categoria,p.equipo,p.jugador,p.dni||'',p.id]))],
    [prefix+'_HistorialSesiones']:[['Temporada','Fecha','Autor','Foco','Checklist','Nota'],...snapshot.histories.flatMap(h=>h.state.sesiones.map(r=>[h.id,r.fecha,r.profe,r.foco,r.checklist,r.nota]))],
    [prefix+'_Sesiones']:[['Fecha','Autor','Foco','Checklist','Nota'],...s.sesiones.map(r=>[r.fecha,r.profe,r.foco,r.checklist,r.nota])],
    [prefix+'_Auditoria']:[['ID','Fecha','UID','Autor','Rol','Tipo','Categoría','Equipo','Jugador','Versión'],...snapshot.audit.map(e=>[e.id,e.fecha,e.uid,e.autor,e.rol,e.tipo,e.categoria,e.equipo,e.jugador,e.version])],
    [prefix+'_Detalles']:[['ID cambio','Lado','Parte','JSON'],...chunks]
  };
  return {publicTables,privateTables};
}
function createProjector({db,sheets,data,sheetMap,privateSheetId,areas}){
  if(!privateSheetId||areas.some(a=>!sheetMap[a]))throw Error('Configurar las 25 planillas y una planilla privada de Dirección.');
  async function projectActivity(name){
    const ref=data.activity(name),lease=db.collection('muni360_sync_locks').doc(sha(name)),owner=randomUUID();
    await db.runTransaction(async tx=>{const old=await tx.get(lease);if(old.exists&&old.data().expiresAt>Date.now())throw Error('Sincronización en curso.');tx.set(lease,{owner,expiresAt:Date.now()+180000});});
    try{
      const snapshot=await data.mirrorSnapshot(name),{publicTables,privateTables}=tablesFor(snapshot,name);
      const users=await db.collection('muni360_users').get(),permissions=await db.collection('muni360_access_audit').orderBy('fecha').get();
      privateTables.UsuariosUGI=[['UID','Nombre','Email','Rol','Estado','Actividades','Permisos','Vencimiento'],...users.docs.map(d=>{const u=d.data();return [d.id,u.nombre,u.email,u.rol,u.status,JSON.stringify(u.areas),JSON.stringify(u.capabilities),u.expiresAt||''];})];
      privateTables.HistorialPermisos=[['Fecha','UID autor','Autor','Usuario modificado','Antes','Después'],...permissions.docs.map(d=>{const e=d.data();return [e.fecha,e.actor,e.autor,e.target,JSON.stringify(e.antes),JSON.stringify(e.despues)];})];
      privateTables.Indice=[['Actividad','Prefijo privado'],...areas.map(a=>[a,sha(a).slice(0,10)])];
      // Primero el destino privado; nunca poner DNI ni bitácoras en la planilla compartida.
      await sheets.replaceTables(privateSheetId,privateTables);
      const staging=await sheets.readTables(sheetMap[name],['CargaPadron']);if(!Object.hasOwn(staging,'CargaPadron'))publicTables.CargaPadron=[['Categoría','Equipo','Jugador']];
      await sheets.replaceTables(sheetMap[name],publicTables);
      await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.exists)tx.update(ref,{sheetProjectedVersion:snapshot.meta.version,sheetSyncedAt:new Date().toISOString()});});
      return snapshot.meta.version;
    }finally{await db.runTransaction(async tx=>{const current=await tx.get(lease);if(current.exists&&current.data().owner===owner)tx.delete(lease);});}
  }
  async function drain(){
    const jobs=await db.collection('muni360_outbox').where('status','==','pending').limit(100).get(),grouped=new Map();
    jobs.docs.forEach(j=>{const d=j.data();if(!grouped.has(d.activity))grouped.set(d.activity,[]);grouped.get(d.activity).push(j);});
    const results=[];
    for(const [name,entries]of grouped){try{const version=await projectActivity(name);const batch=db.batch();entries.filter(e=>e.data().version<=version).forEach(e=>batch.update(e.ref,{status:'done',projectedAt:new Date().toISOString()}));await batch.commit();results.push({activity:name,ok:true});}catch(_){results.push({activity:name,ok:false});}}
    return results;
  }
  async function staging(name,actor){
    if(!actor.capabilities.administrarPadron)throw Error('No tenés permiso para importar padrón.');
    const tables=await sheets.readTables(sheetMap[name],['CargaPadron']);
    return (tables.CargaPadron||[]).slice(1).filter(r=>r[0]&&r[1]&&r[2]).map(r=>({categoria:String(r[0]),equipo:String(r[1]),jugador:String(r[2])}));
  }
  return {projectActivity,drain,staging};
}
module.exports={tablesFor,createProjector};
