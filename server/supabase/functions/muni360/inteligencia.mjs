import {AccessError} from './policy.mjs';

const LIST_STATUS=new Set(['','activas','abierta','en_revision','intervenida','escalada','resuelta']);
const UPDATE_STATUS=new Set(['abierta','en_revision','intervenida','resuelta']);

export async function handleInteligencia({actor,owner,path,body,rpc,now}){
 if(actor.id!==owner&&!['Coordinación','Dirección UGI'].includes(actor.rol)){
  throw new AccessError('PERMISOS','El módulo de Inteligencia requiere autorización de Coordinación o Dirección.');
 }
 const nowIso=new Date(now).toISOString();

 if(path==='/api/inteligencia/list'){
  const status=body.status==null?'activas':String(body.status);
  if(!LIST_STATUS.has(status))throw new AccessError('VALIDACION','Estado de filtro inválido.',400);
  let activities=null;
  if(body.activities!=null){
   if(!Array.isArray(body.activities)||body.activities.length>100||body.activities.some(a=>typeof a!=='string'||!actor.areas.includes(a))){
    throw new AccessError('PERMISOS','Sólo podés consultar actividades autorizadas.');
   }
   activities=[...new Set(body.activities)];
  }
  return rpc('mc_inteligencia',{p_action:'list',p:{uid:actor.id,status,activities,now:nowIso}});
 }

 if(path==='/api/inteligencia/scan'){
  const activity=typeof body.activity==='string'?body.activity:'';
  if(!activity||!actor.areas.includes(activity)){
   throw new AccessError('PERMISOS','Sólo podés analizar actividades autorizadas.');
  }
  return rpc('mc_inteligencia',{p_action:'scan',p:{uid:actor.id,activity,now:nowIso}});
 }

 if(path==='/api/inteligencia/update'){
  const caseId=typeof body.caseId==='string'?body.caseId.trim():'';
  const status=typeof body.status==='string'?body.status:'';
  const note=typeof body.note==='string'?body.note.slice(0,500):'';
  if(!caseId)throw new AccessError('VALIDACION','Falta el identificador del caso.',400);
  if(!UPDATE_STATUS.has(status))throw new AccessError('VALIDACION','Estado inválido.',400);
  return rpc('mc_inteligencia',{p_action:'update',p:{uid:actor.id,caseId,status,note,now:nowIso}});
 }

 throw new AccessError('RUTA','Ruta de Inteligencia inexistente.',404);
}
