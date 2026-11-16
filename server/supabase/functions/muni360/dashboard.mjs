import {AccessError} from './policy.mjs';
const round1=n=>Math.round(n*10)/10;
const round2=n=>Math.round(n*100)/100;
const groupName=(value,fallback)=>String(value||fallback);
function semaforo(registros){
 const counts={verde:0,amarillo:0,rojo:0};
 for(const r of registros){const match=String(r.estado||'').match(/Sem:([VAR])/);if(match)counts[{V:'verde',A:'amarillo',R:'rojo'}[match[1]]]++;}
 const observados=counts.verde+counts.amarillo+counts.rojo;
 return {...counts,observados,promedio:observados?round2((counts.verde*3+counts.amarillo*2+counts.rojo)/observados):null,pctVerde:observados?round1(counts.verde/observados*100):null};
}
function metricas(inscripciones,registros){
 const presentes=registros.filter(r=>['P','T'].includes(String(r.estado||'').charAt(0))).length;
 return {inscripciones,registros:registros.length,presentes,asistencia:registros.length?round1(presentes/registros.length*100):null,semaforo:semaforo(registros)};
}
function sortText(a,b){return a.localeCompare(b,'es',{numeric:true});}
export function summarize(activity,state,days,now){
 const data=state||{};
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(now));
 const start=days?new Date(Date.parse(today+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10):'0000-01-01';
 const inPeriod=r=>typeof r.fecha==='string'&&r.fecha>=start&&r.fecha<=today;
 const attendance=(data.asistencia||[]).filter(inPeriod),evaluations=(data.evaluaciones||[]).filter(inPeriod),roster=data.padron||[],sesiones=data.sesiones||[];
 const sums={inscripciones:roster.length,grupos:new Set(roster.map(p=>JSON.stringify([p.categoria,p.equipo]))).size,registros:0,presentes:0,ausentes:0,sinRegistrar:0,observaciones:0,alertas:0,evaluaciones:evaluations.length,notas:0,sumaNotas:0,sesiones:sesiones.filter(inPeriod).length};
 const trend={};
 for(const r of attendance){
  const e=String(r.estado||''),code=e.charAt(0),m=String(r.fecha).slice(0,7);
  trend[m]??={mes:m,registros:0,presentes:0};
  if(['P','T','A'].includes(code)){sums.registros++;trend[m].registros++;if(code!=='A'){sums.presentes++;trend[m].presentes++;}else sums.ausentes++;}else sums.sinRegistrar++;
  if(/Sem:[VAR]/.test(e))sums.observaciones++;
  if(/Sem:[AR]/.test(e))sums.alertas++;
 }
 for(const r of evaluations)for(const n of Object.values(r.notas||{}))if(typeof n==='number'&&Number.isFinite(n)){sums.notas++;sums.sumaNotas+=n;}
 const byGroup=new Map();
 const ensure=(categoria,tira)=>{const key=JSON.stringify([categoria,tira]);if(!byGroup.has(key))byGroup.set(key,{categoria,tira,inscripciones:0,attendance:[]});return byGroup.get(key);};
 for(const p of roster)ensure(groupName(p.categoria,'Sin categoría'),groupName(p.equipo,'General')).inscripciones++;
 for(const r of attendance)ensure(groupName(r.categoria,'Sin categoría'),groupName(r.equipo,'General')).attendance.push(r);
 const gruposDetalle=[...byGroup.values()].map(g=>{const m=metricas(g.inscripciones,g.attendance);return {categoria:g.categoria,tira:g.tira,...m};}).sort((a,b)=>sortText(a.categoria,b.categoria)||sortText(a.tira,b.tira));
 const categorias=new Map();
 for(const g of gruposDetalle){let c=categorias.get(g.categoria);if(!c)categorias.set(g.categoria,c={categoria:g.categoria,inscripciones:0,attendance:[]});c.inscripciones+=g.inscripciones;c.attendance.push(...byGroup.get(JSON.stringify([g.categoria,g.tira])).attendance);}
 const categoriasDetalle=[...categorias.values()].map(c=>{const m=metricas(c.inscripciones,c.attendance);return {categoria:c.categoria,...m};}).sort((a,b)=>sortText(a.categoria,b.categoria));
 return {activity,...sums,asistencia:sums.registros?round1(sums.presentes/sums.registros*100):null,promedio:sums.notas?round2(sums.sumaNotas/sums.notas):null,semaforo:semaforo(attendance),gruposDetalle,categoriasDetalle,tendencia:Object.values(trend).sort((a,b)=>a.mes.localeCompare(b.mes))};
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
