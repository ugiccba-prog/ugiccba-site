// Read-only daily counts. Never infer absence from a missing mark.
const norm=v=>String(v||'').trim().toLocaleLowerCase('es-AR');
const group=r=>JSON.stringify([norm(r.categoria),norm(r.equipo||'General')]);
export function presenceDate(value,now){
 const date=value===undefined?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(now)):value;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw Error('Fecha inválida.');
 return date;
}
export function dailyPresence(activity,state,date){
 const roster=state.padron||[],groups=new Map(),aliases=new Map();
 const ensure=r=>{const k=group(r);if(!groups.has(k))groups.set(k,{categoria:r.categoria||'Sin categoría',equipo:r.equipo||'General',people:new Map()});return groups.get(k);};
 const alias=r=>JSON.stringify([group(r),norm(r.jugador)]);
 for(const p of roster){const k=alias(p);if(!aliases.has(k))aliases.set(k,new Set());if(p.id)aliases.get(k).add(String(p.id));}
 const person=r=>{if(r.jugadorId||r.id)return 'id:'+String(r.jugadorId||r.id);const ids=aliases.get(alias(r));return ids?.size===1?'id:'+[...ids][0]:'name:'+alias(r);};
 for(const p of roster)ensure(p).people.set(person(p),new Set());
 for(const r of state.asistencia||[]){
  if(r.fecha!==date)continue;
  const g=ensure(r),id=person(r);if(!g.people.has(id))g.people.set(id,new Set());
  const match=String(r.estado||'').match(/^([PAT])(?:\s*\||\s*$)/);
  if(match)g.people.get(id).add(match[1]);
 }
 const count=people=>{
  const out={presentes:0,tardes:0,ausentes:0,sinRegistrar:0,conflictos:0,registrados:0};
  for(const marks of people.values()){
   if(!marks.size){out.sinRegistrar++;continue;}
   if(marks.size>1){out.conflictos++;continue;}
   const code=[...marks][0];out.registrados++;if(code==='A')out.ausentes++;else{out.presentes++;if(code==='T')out.tardes++;}
  }
  return {...out,sinRegistros:out.registrados===0,incompleta:out.sinRegistrar>0||out.conflictos>0};
 };
 const total=new Map();
 const detail=[...groups.values()].map(g=>{
  for(const [id,marks] of g.people){
   if(!total.has(id))total.set(id,new Set());
   // A confirmed presence in any group counts once for the activity.
   if(marks.size===1)for(const code of marks)total.get(id).add(code);
   else if(marks.size>1)total.get(id).add('conflict');
  }
  return {categoria:g.categoria,equipo:g.equipo,...count(g.people)};
 }).sort((a,b)=>a.categoria.localeCompare(b.categoria,'es',{numeric:true})||a.equipo.localeCompare(b.equipo,'es'));
 for(const [id,marks] of total){if(marks.has('P'))total.set(id,new Set(['P']));else if(marks.has('T'))total.set(id,new Set(['T']));else if(marks.has('conflict'))total.set(id,new Set(['P','A']));}
 return {activity,date,...count(total),grupos:detail};
}
