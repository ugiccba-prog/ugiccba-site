import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {applyOperation, empty} from '../server/supabase/functions/muni360/domain.mjs';
import {summarize} from '../server/supabase/functions/muni360/dashboard.mjs';

// Local fixture only: deliberately no network client or database credentials.
export function generateDemo(catalog) {
  const validText=s=>typeof s==='string' && s.length>0 && s===s.trim() && s.length<=150;
  if (!catalog || !Array.isArray(catalog.sports) || catalog.sports.length!==16) throw Error('Se requieren exactamente 16 deportes confirmados.');
  const start=Date.parse(catalog.startDate+'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(catalog.startDate) || !Number.isFinite(start) || new Date(start).toISOString().slice(0,10)!==catalog.startDate) throw Error('Fecha inicial inválida.');
  const names=new Set(), activities=[];
  const actor={id:'demo-local',nombre:'DEMO',capabilities:{verDni:false}};
  for (const sport of catalog.sports) {
    if (!validText(sport.name) || names.has(sport.name) || !['equipo','grupo'].includes(sport.kind) || !Array.isArray(sport.categories) || !sport.categories.length || sport.categories.some(c=>!validText(c)) || new Set(sport.categories.map(c=>c.toLowerCase())).size!==sport.categories.length) throw Error('Deporte, tipo o categorías inválidos/duplicados.');
    names.add(sport.name);
    const divisions=sport.divisions||[{activity:sport.name,categories:sport.categories,teams:['A','B']}];
    for(const division of divisions) {
    if(!validText(division.activity)||!Array.isArray(division.categories)||!division.categories.length||division.categories.some(c=>!validText(c))||!Array.isArray(division.teams)||!division.teams.length||division.teams.some(t=>!validText(t))) throw Error('División inválida.');
    const combined=empty();
    for (const categoria of division.categories) for (const equipo of division.teams) {
      let state=empty();
      const jugadores=Array.from({length:8},(_,i)=>({jugador:`DEMO ${String(i+1).padStart(2,'0')}`}));
      state=applyOperation(state,{tipo:'ALTA_PADRON',categoria,equipo,jugadores},actor);
      // Stable synthetic IDs make regeneration a repeatable reset of the local fixture.
      for(const p of state.padron) p.id='demo-'+createHash('sha256').update(JSON.stringify([sport.name,p.categoria,p.equipo,p.jugador])).digest('hex').slice(0,24);
      for(let week=0;week<16;week++) for(const offset of [0,3]) {
        const fecha=new Date(start+(week*7+offset)*86400000).toISOString().slice(0,10);
        const datos=Object.fromEntries(jugadores.map((p,i)=>{
          const absent=week<4 ? i===7 : week<12 ? i>=4 : equipo==='A' ? i===7 : i>=4;
          return [p.jugador,`${absent?'A':'P'} | Sem:${absent?'R':'V'}`];
        }));
        state=applyOperation(state,{tipo:'ASISTENCIA',categoria,equipo,fecha,datos},actor);
        if(offset===0 && week%4===3) for(const p of jugadores) state=applyOperation(state,{tipo:'EVALUACION',categoria,equipo,fecha,jugador:p.jugador,notas:{Tecnica:6+week/10,Convivencia:7}},actor);
      }
      for(const key of ['padron','asistencia','evaluaciones','sesiones']) combined[key].push(...state[key]);
    }
    const now=start+109*86400000;
    const state=combined;
    activities.push({name:division.activity,sport:sport.name,kind:sport.kind,state,panel:summarize(division.activity,state,0,now)});
    }
  }
  const merged=new Map();
  for(const a of activities) {
    const previous=merged.get(a.name);
    if(!previous) merged.set(a.name,a);
    else for(const key of ['padron','asistencia','evaluaciones','sesiones']) previous.state[key].push(...a.state[key]);
  }
  for(const a of merged.values()) a.panel=summarize(a.name,a.state,0,start+109*86400000);
  return {schemaVersion:1,synthetic:true,target:'local-only',weeks:16,startDate:catalog.startDate,activities:[...merged.values()]};
}

async function main() {
  const [, , input, output]=process.argv;
  if(!input||!output) throw Error('Uso: node scripts/muni360-demo.mjs catalogo.json salida.json');
  const demo=generateDemo(JSON.parse(await readFile(input,'utf8')));
  await writeFile(output,JSON.stringify(demo,null,2)+'\n',{flag:'wx'});
  console.log(`Preparados 16 deportes en ${demo.activities.length} actividades, 16 semanas. Archivo local: ${output}`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
