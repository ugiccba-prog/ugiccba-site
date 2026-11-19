import {createHash} from 'node:crypto';
import {generateDemo} from './muni360-demo.mjs';

const norm=value=>String(value||'').trim().toLowerCase();
const sameGroup=(row,group)=>norm(row.categoria)===norm(group.categoria)&&norm(row.equipo)===norm(group.equipo);

// A preparation contract, not an uploader. Live snapshots must be obtained with
// the owner's ordinary authenticated access before this plan can be approved.
export function prepareDemoPlan(catalog,snapshots) {
 const demo=generateDemo(catalog),operations=[],groups=[];
 for(const activity of demo.activities){
  const snapshot=snapshots?.[activity.name];
  if(!snapshot||!Number.isInteger(snapshot.temporada)||!Number.isInteger(snapshot.version)||!snapshot.versiones)throw Error(`Falta lectura autenticada vigente: ${activity.name}`);
  for(const key of ['padron','asistencia','evaluaciones'])if(!Array.isArray(snapshot[key]))throw Error(`Lectura incompleta: ${activity.name}/${key}`);
  const unique=new Map(activity.state.padron.map(p=>[JSON.stringify([p.categoria,p.equipo]),{categoria:p.categoria,equipo:p.equipo}]));
  for(const group of unique.values()){
   // ASISTENCIA replaces a whole class; never merge a demo into an occupied
   // group, even when its roster happens to contain DEMO-like names.
   if(['padron','asistencia','evaluaciones'].some(key=>snapshot[key].some(row=>sameGroup(row,group))))throw Error(`Grupo ocupado; no cargar demostración: ${activity.name}/${group.categoria}/${group.equipo}`);
   const roster=activity.state.padron.filter(row=>sameGroup(row,group));
   const base={deporte:activity.name,...group};
   groups.push({...base,expectedActivityVersion:snapshot.version,temporada:snapshot.temporada,jugadores:roster.map(p=>p.jugador)});
   operations.push({...base,tipo:'ALTA_PADRON',jugadores:roster.map(p=>({jugador:p.jugador,dni:''}))});
   const classes=new Map();
   for(const row of activity.state.asistencia.filter(row=>sameGroup(row,group))){
    if(!classes.has(row.fecha))classes.set(row.fecha,{});
    classes.get(row.fecha)[row.jugador]=row.estado;
   }
   for(const [fecha,datos] of classes)operations.push({...base,tipo:'ASISTENCIA',fecha,datos});
   for(const row of activity.state.evaluaciones.filter(row=>sameGroup(row,group)))operations.push({...base,tipo:'EVALUACION',fecha:row.fecha,jugador:row.jugador,notas:row.notas});
  }
 }
 const fingerprint=createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
 return {format:'MUNI360_DEMO_PLAN_V1',synthetic:true,status:'requires-live-revalidation',fingerprint,groups,operations,
  cleanup:'Retirar sólo registros del manifiesto tras revisión y copia previa; borrar las vistas Sheets no elimina Supabase.',
  execution:'Usar la API existente: obtener autorización, temporada y revisiones actuales; ID de operación persistente y recibo por cada escritura. Detener ante conflicto. Este plan no contiene credenciales ni autoriza su ejecución.'};
}
