import {AccessError} from './policy.mjs';
import {SPORTS_CONFIG} from './competencia-config.mjs';

const invalid=message=>{throw new AccessError('VALIDACION',message,400);};
const text=(v,max=160)=>{if(typeof v!=='string'||!v.trim()||v.length>max)invalid('Revisá los campos obligatorios.');return v.trim();};
export async function handleCompetencia({actor,owner,path,body,rpc,service}){
 if(actor.id!==owner)throw new AccessError('PERMISOS','Acceso exclusivo del propietario.');
 const run=(action,p={})=>rpc('mc_competencia',{p_action:action,p:{...p,uid:actor.id}});
 if(path==='/api/competencia/list')return run('list');
 if(path==='/api/competencia/detail')return run('detail',{id:text(body.id)});
 if(path==='/api/competencia/roster'){
  if(!Object.values(SPORTS_CONFIG).some(c=>c.activities.includes(body.activity)))invalid('Actividad inválida.');
  const loaded=await service('load',{uid:actor.id,activity:body.activity});
  return {ok:true,roster:loaded.state.padron.map(p=>({player_id:p.id,player_name:p.jugador,category:p.categoria,team:p.equipo}))};
 }
 if(path!=='/api/competencia/save')throw new AccessError('RUTA','Ruta inexistente.',404);
 const c=body.competition,cfg=SPORTS_CONFIG[body.sportKey];
 if(!c||!cfg||!cfg.activities.includes(c.activity_id))invalid('Deporte o actividad inválida.');
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(c.id||'')||!Number.isSafeInteger(c.revision)||c.revision<0)invalid('Identificador o revisión inválidos.');
 if(!['live','post'].includes(c.mode)||!['live','final'].includes(c.status)||!Number.isFinite(Date.parse(c.date_ar)))invalid('Fecha o estado inválidos.');
 if(!Array.isArray(body.roster)||!body.roster.length||body.roster.length>500||!Array.isArray(body.events)||body.events.length>5000)invalid('Convocados o eventos inválidos.');
 const loaded=await service('load',{uid:actor.id,activity:c.activity_id});
 const ids=new Set(),roster=body.roster.map(p=>{
  const real=loaded.state.padron.find(r=>r.id===p.player_id&&r.categoria===c.category&&r.equipo===c.team);
  if(!real||ids.has(real.id))invalid('El padrón cambió o hay convocados duplicados. Revisá la lista.');
  ids.add(real.id);return {player_id:real.id,player_name:real.jugador};
 });
 const scores={muni:0,rival:0};
 const events=body.events.map(e=>{
  if(!['muni','rival'].includes(e.side))invalid('Lado inválido.');
  const player=roster.find(r=>r.player_id===e.player_id);
  let act,meta={};
  if(cfg.archetype==='E'){
   if(e.side!=='muni'||e.action_code!=='nota_torneo'||!player)invalid('Registro de torneo inválido.');
   for(const field of cfg.fields)meta[field]=text(e.meta_json?.[field]||'—',200);
   act={code:'nota_torneo',label:'Registro de torneo',delta:0};
  }else{
   act=(e.side==='muni'?cfg.muniActions:cfg.rivalActions).find(a=>a.code===e.action_code);
   if(!act||!cfg.periods.includes(e.period)||e.side==='muni'&&!act.noPlayer&&!act.teamFoul&&!player)invalid('Acción o deportista inválidos.');
  }
  scores[e.side]+=act.delta||0;
  return {side:e.side,action_code:act.code,action_label:act.label,points_delta:act.delta||0,period:cfg.archetype==='E'?'Torneo':e.period,player_id:player?.player_id||null,player_name:player?.player_name||null,meta_json:meta};
 });
 return run('save',{competition:{id:c.id,revision:c.revision,activity_id:c.activity_id,category:text(c.category),date_ar:new Date(c.date_ar).toISOString(),mode:c.mode,archetype:cfg.archetype,opponent_or_event:text(c.opponent_or_event),status:c.status,score_muni:scores.muni,score_rival:scores.rival,fair_play_ugi:c.fair_play_ugi===true,summary_json:{sportKey:body.sportKey,team:text(c.team)}},roster,events});
}
