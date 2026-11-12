'use strict';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {AccessError} from './policy.mjs';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const sha=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(canonical(v))).digest('hex');
const copy=v=>JSON.parse(JSON.stringify(v));
const same=(a,b)=>String(a||'').trim().toLocaleLowerCase('es')===String(b||'').trim().toLocaleLowerCase('es');
const resource=d=>['DUA','LEGAJO','RECONOCIMIENTO'].includes(d.tipo)?JSON.stringify([d.tipo==='DUA'?'DUA':'LEGAJO',d.subjectId]):JSON.stringify([d.tipo,String(d.categoria||'').trim().toLowerCase(),String(d.equipo||'').trim().toLowerCase(),d.fecha||'',String(d.jugador||'').trim().toLowerCase()]);
const empty=()=>({padron:[],asistencia:[],evaluaciones:[],fichas:{},gestos:[],email:'',sesiones:[]});
function invalid(message){throw new AccessError('VALIDACION',message,400);}
function text(v,max=160){if(typeof v!=='string'||!v.trim()||v.length>max||['__proto__','constructor','prototype'].includes(v.trim().toLowerCase()))invalid('Texto obligatorio o demasiado extenso.');return v.trim();}
function member(state,d){const matches=state.padron.filter(p=>same(p.categoria,d.categoria)&&same(p.equipo,d.equipo)&&same(p.jugador,d.jugador));if(matches.length!==1)invalid('Deportista inexistente o duplicado en el grupo.');return matches[0];}
function validateDate(date){if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)invalid('Fecha inválida.');}
function applyOperation(before,d,actor,{idSecret,now=()=>new Date().toISOString()}={}){
  const s=copy(before);d=copy(d);for(const k of ['categoria','equipo','jugador'])if(typeof d[k]==='string')d[k]=d[k].trim();
  if(['ASISTENCIA','EVALUACION','ALTA_PADRON','BAJA_PADRON','DUA','LEGAJO','RECONOCIMIENTO'].includes(d.tipo)){text(d.categoria);text(d.equipo);}
  if(['ASISTENCIA','EVALUACION','RECONOCIMIENTO'].includes(d.tipo))validateDate(d.fecha);
  let p;
  if(['EVALUACION','BAJA_PADRON','DUA','LEGAJO','RECONOCIMIENTO'].includes(d.tipo))p=member(s,d);
  if(['DUA','LEGAJO','RECONOCIMIENTO'].includes(d.tipo)&&p.id!==d.subjectId)invalid('La identidad no coincide con el padrón.');
  const inGroup=r=>same(r.categoria,d.categoria)&&same(r.equipo,d.equipo);
  if(d.tipo==='ASISTENCIA'){
    if(!d.datos||Array.isArray(d.datos)||!Object.keys(d.datos).length||Object.keys(d.datos).length>500)invalid('Lista inválida.');
    const roster=s.padron.filter(inGroup);
    if(roster.length!==Object.keys(d.datos).length)throw new AccessError('CONFLICTO','El plantel cambió. Revisá la lista.',409);
    const rows=Object.entries(d.datos).map(([jugador,estado])=>{
      const person=member(s,{...d,jugador});
      if(typeof estado!=='string'||!/^[PATN](?: \| 🍴 Comida)? \| Sem:[VARN]$/.test(estado))invalid('Asistencia o semáforo inválido.');
      if(estado.includes('Comida')&&(d.deporte!=='Colonia'||estado.startsWith('A')))invalid('La comida se registra solo en Colonia y para participantes presentes.');
      if(d.clima&&!['N','Vapor','Fuego','Agua'].includes(d.clima))invalid('Clima inválido.');
      if(d.puntosCiudad&&!/^\+?\d{1,3}$/.test(String(d.puntosCiudad)))invalid('Puntos inválidos.');
      return {fecha:d.fecha,categoria:d.categoria,equipo:d.equipo,jugador,jugadorId:person.id,estado,clima:d.clima||'N',puntosCiudad:d.puntosCiudad||''};
    });
    s.asistencia=s.asistencia.filter(r=>!(inGroup(r)&&r.fecha===d.fecha)).concat(rows);
  }else if(d.tipo==='EVALUACION'){
    if(!d.notas||Array.isArray(d.notas)||!Object.keys(d.notas).length||Object.keys(d.notas).length>60)invalid('Faltan notas.');
    for(const [k,v]of Object.entries(d.notas)){text(k);if(k.includes(' | ')||['__proto__','constructor','prototype'].includes(k)||typeof v!=='number'||!Number.isFinite(v)||v<1||v>10)invalid('Nota o variable inválida.');}
    s.evaluaciones=s.evaluaciones.filter(r=>!(inGroup(r)&&r.fecha===d.fecha&&same(r.jugador,d.jugador)));
    s.evaluaciones.push({fecha:d.fecha,categoria:d.categoria,equipo:d.equipo,jugador:d.jugador,jugadorId:p.id,notas:d.notas});
  }else if(d.tipo==='ALTA_PADRON'){
    if(!Array.isArray(d.jugadores)||!d.jugadores.length||d.jugadores.length>500)invalid('Listado inválido.');
    const seen=new Set();
    for(const j of d.jugadores){
      text(j.jugador);if(Object.hasOwn(j,'dni')&&(typeof j.dni!=='string'||j.dni&&!/^\d{7,8}$/.test(j.dni)))invalid('DNI inválido.');
      const k=j.jugador.trim().toLowerCase();if(seen.has(k))invalid('Hay nombres duplicados en la carga.');seen.add(k);
      const existing=s.padron.find(r=>inGroup(r)&&same(r.jugador,j.jugador));
      if(existing){if(Object.hasOwn(j,'dni')){if(!actor.capabilities.verDni&&j.dni!==existing.dni)throw new AccessError('PERMISOS','No tenés permiso para modificar DNI.');existing.dni=j.dni||'';}}
      else{if(j.dni&&!actor.capabilities.verDni)throw new AccessError('PERMISOS','No tenés permiso para cargar DNI.');const id=j.dni?createHmac('sha256',idSecret).update(j.dni).digest('hex'):randomUUID();s.padron.push({id,categoria:d.categoria,equipo:d.equipo,jugador:j.jugador.trim(),dni:j.dni||''});}
    }
  }else if(d.tipo==='BAJA_PADRON')s.padron=s.padron.filter(r=>!(inGroup(r)&&r.id===p.id));
  else if(d.tipo==='DUA'){
    const f={};for(const k of ['comunicacion','desborda','regula']){f[k]=String(d.ficha?.[k]||'');if(f[k].length>3000)invalid('Apoyo demasiado extenso.');}
    s.fichas[p.id]={...(s.fichas[p.id]||{}),dua:f};
  }else if(d.tipo==='LEGAJO'){
    const f=d.ficha;if(!f||!Array.isArray(f.bitacora)||f.bitacora.length>200||!Array.isArray(f.actividadesSimultaneas))invalid('Ficha inválida.');
    if(Object.hasOwn(f,'dni')){if(!actor.capabilities.verDni)throw new AccessError('PERMISOS','No tenés permiso para modificar DNI.');if(typeof f.dni!=='string'||f.dni&&!/^\d{7,8}$/.test(f.dni))invalid('DNI inválido.');p.dni=f.dni||'';}
    const old=(s.fichas[p.id]||{}).legajo||{},events=new Map((old.bitacora||[]).map(e=>[e.id,e]));
    const submittedIds=new Set();for(const e of f.bitacora){text(e.id);if(submittedIds.has(e.id))invalid('Hay eventos duplicados en la bitácora.');submittedIds.add(e.id);validateDate(e.fecha);text(e.tipo);text(e.detalle,4000);const previous=events.get(e.id);if(previous&&(previous.detalle!==e.detalle||previous.fecha!==e.fecha||previous.tipo!==e.tipo))invalid('Agregá una rectificación: los eventos previos se conservan.');if(!previous)events.set(e.id,{id:e.id,fecha:e.fecha,tipo:e.tipo,detalle:e.detalle,autor:actor.nombre+' ('+d.deporte+')',uid:actor.id});}
    if(events.size>200)invalid('El legajo admite hasta 200 eventos; requiere archivo de Dirección.');
    const legajo={estadoPlan:String(f.estadoPlan||'').slice(0,200),paseInterno:String(f.paseInterno||'').slice(0,4000),actividadesSimultaneas:f.actividadesSimultaneas.filter(a=>typeof a==='string').slice(0,30),bitacora:[...events.values()]};
    s.fichas[p.id]={...(s.fichas[p.id]||{}),legajo};
  }else if(d.tipo==='RECONOCIMIENTO'){
    text(d.motivo,300);if(d.nota!==undefined&&typeof d.nota!=='string'||String(d.nota||'').length>2000)invalid('Mensaje demasiado extenso.');
    const entry=s.fichas[p.id]||{},legajo=entry.legajo||{bitacora:[],actividadesSimultaneas:[]};
    if(legajo.bitacora.length>=200)invalid('El legajo requiere archivo de Dirección.');
    legajo.bitacora.push({id:'verde_'+d.requestId,fecha:d.fecha,tipo:'🟢 Tarjeta Verde Digital',detalle:d.motivo+(d.nota?' — '+d.nota:''),autor:actor.nombre+' ('+d.deporte+')',uid:actor.id});
    s.fichas[p.id]={...entry,legajo};
  }else if(d.tipo==='GESTOS'){
    if(!Array.isArray(d.gestos)||d.gestos.length>60)invalid('Variables inválidas.');d.gestos.forEach(g=>text(g));s.gestos=[...new Set(d.gestos)];
  }else if(d.tipo==='CONFIG'){
    if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))invalid('Email inválido.');s.email=d.email||'';
  }else if(d.tipo==='SESION_UGI'){
    text(d.foco,300);if(d.nota!==undefined&&typeof d.nota!=='string'||String(d.nota||'').length>4000)invalid('Nota demasiado extensa.');s.sesiones.push({id:d.requestId,fecha:now(),uid:actor.id,profe:actor.nombre,categoria:d.deporte,foco:d.foco,checklist:String(d.checklist||'').slice(0,500),nota:d.nota||''});
  }else if(d.tipo==='RESET_DATOS'){
    if(!['TEMPORADA','TODO'].includes(d.modo))invalid('Archivo inválido.');s.asistencia=[];s.evaluaciones=[];s.sesiones=[];if(d.modo==='TODO')s.padron=[];
  }else invalid('Operación desconocida.');
  return s;
}
function visible(state,actor){const s=copy(state),ids=new Set(s.padron.map(p=>p.id));if(!actor.capabilities.verDni)s.padron.forEach(p=>p.dni='');for(const id of Object.keys(s.fichas)){if(!ids.has(id))delete s.fichas[id];else if(!actor.capabilities.verLegajo)s.fichas[id].legajo={};}if(!actor.capabilities.verLegajo)s.sesiones=s.sesiones.filter(r=>r.uid===actor.id);if(!actor.capabilities.administrarPadron)s.email='';return s;}
function auditSlice(state,d){
  const group=r=>same(r.categoria,d.categoria)&&same(r.equipo,d.equipo);
  if(d.tipo==='ASISTENCIA')return state.asistencia.filter(r=>group(r)&&r.fecha===d.fecha);
  if(d.tipo==='EVALUACION')return state.evaluaciones.filter(r=>group(r)&&r.fecha===d.fecha&&same(r.jugador,d.jugador));
  if(['ALTA_PADRON','BAJA_PADRON'].includes(d.tipo))return state.padron.filter(group);
  if(d.tipo==='DUA')return state.fichas[d.subjectId]?.dua||{};
  if(d.tipo==='LEGAJO')return {legajo:state.fichas[d.subjectId]?.legajo||{},dni:state.padron.find(p=>p.id===d.subjectId)?.dni||''};
  if(d.tipo==='RECONOCIMIENTO')return (state.fichas[d.subjectId]?.legajo?.bitacora||[]).filter(e=>e.id==='verde_'+d.requestId);
  if(d.tipo==='SESION_UGI')return state.sesiones.filter(r=>r.id===d.requestId);
  if(d.tipo==='RESET_DATOS')return {padron:state.padron.length,asistencia:state.asistencia.length,evaluaciones:state.evaluaciones.length};
  return d.tipo==='GESTOS'?state.gestos:{email:state.email};
}
function records(state){
  const result=new Map(),grouped=(kind,rows,keys)=>{for(const row of rows){const id=kind+'_'+sha(keys.map(k=>row[k]||''));if(!result.has(id))result.set(id,{kind,rows:[]});result.get(id).rows.push(row);}};
  grouped('padron',state.padron,['categoria','equipo']);grouped('asistencia',state.asistencia,['fecha','categoria','equipo']);grouped('evaluaciones',state.evaluaciones,['fecha','categoria','equipo','jugador']);grouped('sesiones',state.sesiones,['id']);result.set('config',{kind:'config',gestos:state.gestos,email:state.email});return result;
}
function fromRecords(docs,fichas=[]){const s=empty();for(const doc of docs){const r=typeof doc.data==='function'?doc.data():doc;if(r.kind==='config'){s.gestos=r.gestos||[];s.email=r.email||'';}else if(s[r.kind])s[r.kind].push(...r.rows);}for(const doc of fichas){s.fichas[doc.id]=typeof doc.data==='function'?doc.data():doc.value;}return s;}
export {sha,copy,resource,empty,applyOperation,visible,auditSlice,records,fromRecords};
