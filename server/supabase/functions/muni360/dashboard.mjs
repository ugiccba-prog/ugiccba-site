import {AccessError} from './policy.mjs';
export function summarize(activity,state,days,now){
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(now));
 const start=days?new Date(Date.parse(today+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10):'0000-01-01';
 const inPeriod=r=>typeof r.fecha==='string'&&r.fecha>=start&&r.fecha<=today;
 const attendance=state.asistencia.filter(inPeriod),evaluations=state.evaluaciones.filter(inPeriod);
 const sums={inscripciones:state.padron.length,grupos:new Set(state.padron.map(p=>JSON.stringify([p.categoria,p.equipo]))).size,registros:0,presentes:0,ausentes:0,sinRegistrar:0,observaciones:0,alertas:0,evaluaciones:evaluations.length,notas:0,sumaNotas:0,sesiones:state.sesiones.filter(inPeriod).length};
 const trend={};
 for(const r of attendance){
  const e=String(r.estado||''),code=e.charAt(0),m=String(r.fecha).slice(0,7);
  trend[m]??={mes:m,registros:0,presentes:0};
  if(['P','T','A'].includes(code)){sums.registros++;trend[m].registros++;if(code!=='A'){sums.presentes++;trend[m].presentes++;}else sums.ausentes++;}else sums.sinRegistrar++;
  if(/Sem:[VAR]/.test(e))sums.observaciones++;
  if(/Sem:[AR]/.test(e))sums.alertas++;
 }
 for(const r of evaluations)for(const n of Object.values(r.notas||{}))if(typeof n==='number'&&Number.isFinite(n)){sums.notas++;sums.sumaNotas+=n;}
 return {activity,...sums,asistencia:sums.registros?Math.round(sums.presentes/sums.registros*1000)/10:null,promedio:sums.notas?Math.round(sums.sumaNotas/sums.notas*100)/100:null,tendencia:Object.values(trend).sort((a,b)=>a.mes.localeCompare(b.mes))};
}
export async function dashboard(actor,owner,body,service,now){
 if(actor.id!==owner&&!['Coordinación','Dirección UGI'].includes(actor.rol))throw new AccessError('PERMISOS','Este panel requiere autorización de Coordinación.');
 const days=body.days??30;if(![0,30,90,365].includes(days))throw new AccessError('VALIDACION','Período inválido.',400);
 const names=body.activities??actor.areas;
 if(!Array.isArray(names)||names.length>100||names.some(n=>typeof n!=='string'||!actor.areas.includes(n)))throw new AccessError('PERMISOS','El panel sólo permite actividades autorizadas.');
 const selected=[...new Set(names)],rows=[];
 // Bound concurrent reads; no per-athlete data leaves this endpoint.
 for(let i=0;i<selected.length;i+=3){
  const batch=await Promise.all(selected.slice(i,i+3).map(async activity=>{
   const loaded=await service('load',{uid:actor.id,activity});
   if(loaded.actor.status!=='activo'||loaded.actor.expiresAt&&Date.parse(loaded.actor.expiresAt)<=now||actor.id!==owner&&(!['Coordinación','Dirección UGI'].includes(loaded.actor.rol)||!loaded.actor.areas.includes(activity)))throw new AccessError('PERMISOS','Cambió tu autorización. Actualizá el panel.');
   return summarize(activity,loaded.state,days,now);
  }));rows.push(...batch);
 }
 return {ok:true,scope:actor.id===owner?'club':'authorized',days,generatedAt:new Date(now).toISOString(),activities:rows};
}
