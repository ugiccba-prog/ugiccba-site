const isTest=c=>c.summary_json?.ficticio===true||/^PRUEBA\b/i.test(c.category)||/^PRUEBA\b/i.test(c.opponent_or_event);
export function argentinaDate(value){
 const parts=new Intl.DateTimeFormat('en',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
 const get=type=>parts.find(p=>p.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export function summarize(items,{activity,category='',kind='test',from='',to=''}={}){
 const matches=items.filter(c=>c.status==='final'&&c.activity_id===activity&&(!category||c.category===category)&&isTest(c)===(kind==='test')&&(!from||argentinaDate(c.date_ar)>=from)&&(!to||argentinaDate(c.date_ar)<=to));
 const players=new Map();let goalsFor=0,goalsAgainst=0,wins=0,draws=0,losses=0,blue=0,red=0,fairPlay=0,incomplete=0;
 for(const c of matches){
  goalsFor+=c.score_muni;goalsAgainst+=c.score_rival;
  if(c.score_muni>c.score_rival)wins++;else if(c.score_muni===c.score_rival)draws++;else losses++;
  if(c.fair_play_ugi)fairPlay++;
  const snapshot=c.summary_json?.snapshot;
  if(!Array.isArray(snapshot?.roster)||!Array.isArray(snapshot?.events)){incomplete++;continue;}
  for(const p of new Map(snapshot.roster.map(p=>[p.player_id,p])).values()){
   if(!players.has(p.player_id))players.set(p.player_id,{id:p.player_id,name:p.player_name,appearances:0,goals:0,penaltyGoals:0,blue:0,red:0});
   players.get(p.player_id).appearances++;
  }
  for(const e of snapshot.events){
   if(e.side!=='muni')continue;
   if(e.action_code==='azul')blue++;if(e.action_code==='roja')red++;
   const p=players.get(e.player_id);if(!p)continue;
   if(['gol_jugada','gol_penal','gol_libre'].includes(e.action_code))p.goals+=e.points_delta;
   if(e.action_code==='gol_penal')p.penaltyGoals+=e.points_delta;
   if(e.action_code==='azul')p.blue++;if(e.action_code==='roja')p.red++;
  }
 }
 return {matches,goalsFor,goalsAgainst,wins,draws,losses,blue,red,fairPlay,incomplete,players:[...players.values()].sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name,'es'))};
}
