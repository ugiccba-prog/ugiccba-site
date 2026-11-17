(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MuniPortal=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=(p,n)=>n?Math.round(100*p/n)+'%':'Sin datos';
  function summarize(data,date,days=30){
    const roster=Array.isArray(data?.padron)?data.padron:[];
    const validDate=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
    if(![0,30,90,365].includes(Number(days)))throw Error('Período inválido');
    const start=validDate?(Number(days)?new Date(Date.parse(date+'T12:00:00Z')-(Number(days)-1)*86400000).toISOString().slice(0,10):'0000-01-01'):'';
    const rows=(data?.asistencia||[]).filter(r=>validDate&&r.fecha>=start&&r.fecha<=date);
    const evaluations=(data?.evaluaciones||[]).filter(r=>validDate&&r.fecha>=start&&r.fecha<=date);
    const groups=new Map(),trend=new Map();
    function group(r){
      const cat=String(r.categoria||'Sin categoría'),eq=String(r.equipo||'General'),key=JSON.stringify([cat,eq]);
      if(!groups.has(key))groups.set(key,{cat,eq,n:0,present:0,total:0});
      return groups.get(key);
    }
    for(const r of roster)group(r).n++;
    let present=0,total=0,alerts=0,observed=0;
    for(const r of rows){
      const g=group(r),code=String(r.estado||'').charAt(0),sem=String(r.estado||'').match(/(?:^| \| )Sem:([VAR])(?:$| \| )/);
      if(sem){observed++;if(sem[1]!=='V')alerts++;}
      if(!['P','A','T'].includes(code))continue;
      if(!trend.has(r.fecha))trend.set(r.fecha,{date:r.fecha,present:0,total:0});
      const t=trend.get(r.fecha);g.total++;t.total++;total++;
      if(code!=='A'){present++;g.present++;t.present++;}
    }
    return {roster:roster.length,groups:[...groups.values()].sort((a,b)=>a.cat.localeCompare(b.cat,'es',{numeric:true})||a.eq.localeCompare(b.eq,'es')),present,total,alerts,observed,evaluations:evaluations.length,trend:[...trend.values()].sort((a,b)=>a.date.localeCompare(b.date)),validDate};
  }
  const cards=m=>'<div class="portal-stats">'+[['Deportistas',m.roster],['Asistencia',pct(m.present,m.total)],['Equipos',m.groups.filter(g=>g.n).length],['Evaluaciones',m.evaluations]].map(([label,n])=>'<article><span>'+label+'</span><strong>'+n+'</strong></article>').join('')+'</div>';
  const teams=m=>'<div class="portal-table"><table><thead><tr><th>Equipo</th><th>Integrantes</th><th>Asistencia</th><th>Detalle</th></tr></thead><tbody>'+m.groups.filter(g=>g.n).map(g=>'<tr><th scope="row">'+esc(g.cat)+' · '+esc(g.eq)+'</th><td>'+g.n+'</td><td>'+pct(g.present,g.total)+'</td><td><button type="button" class="btn-sec" data-portal-team="1" data-cat="'+esc(g.cat)+'" data-eq="'+esc(g.eq)+'">Ver lista</button></td></tr>').join('')+'</tbody></table>'+(m.roster?'':'<p>No hay deportistas cargados para esta actividad.</p>')+'</div>';
  function chart(m){
    const points=m.trend.slice(-12);
    if(!points.length)return '<p class="hint">Sin asistencias registradas en este período.</p>';
    return '<div class="portal-chart" role="list" aria-label="Asistencia de las últimas 12 jornadas registradas">'+points.map(t=>'<div role="listitem"><span>'+esc(t.date.slice(5).split('-').reverse().join('/'))+'</span><meter min="0" max="100" value="'+100*t.present/t.total+'">'+pct(t.present,t.total)+'</meter><b>'+pct(t.present,t.total)+'</b></div>').join('')+'</div>';
  }
  function views(data,date,activity,session){
    const m=summarize(data,date),demo=session?.modoDemo===true||session?.usuario==='demo';
    const note='<p class="hint">'+(demo?'Demostración · ':'')+'Actividad: '+esc(activity)+' · 30 días hasta '+esc(date||'seleccionar fecha')+'. P y T cuentan como presentes. Sin marcar queda fuera del porcentaje.</p>';
    const heading=title=>'<div class="portal-hero"><h2>'+title+'</h2><p>'+esc(session?.profeNombre||'')+' · '+esc(session?.rol||'')+'</p></div>';
    const actions='<div class="portal-actions"><button type="button" class="btn" data-portal-tab="asistencia">Tomar asistencia y semáforo</button><button type="button" class="btn-sec" data-portal-tab="evaluacion">Ver evaluaciones</button><button type="button" class="btn-sec" data-portal-tab="ugi">Banco metodológico</button></div>';
    return {
      inicio:heading('Tu actividad en Muni360')+note+cards(m)+'<div class="card"><h3>Evolución de asistencia</h3>'+chart(m)+'</div><div class="card"><h3>Equipos de la actividad autorizada</h3>'+teams(m)+'</div>'+actions,
      equipos:heading('Equipos')+note+'<div class="card">'+teams(m)+'</div>',
      seguimiento:heading('Seguimiento')+note+cards(m)+'<div class="card"><h3>Evolución de asistencia</h3>'+chart(m)+'</div><p class="hint">Para consultar evaluaciones y dimensiones formativas, abrí Análisis.</p><button type="button" class="btn-sec" data-portal-tab="analisis">Abrir análisis completo</button>',
      avisos:heading('Avisos del período')+note+'<div class="card"><h3>Observaciones del semáforo</h3><p>'+m.alerts+' registros amarillos o rojos sobre '+m.observed+' observaciones.</p><p class="hint">Son registros del período; una persona puede tener varias observaciones. Revisá el contexto en Análisis y en los apoyos DUA autorizados.</p><button type="button" class="btn-sec" data-portal-tab="analisis">Revisar seguimiento</button></div>'
    };
  }
  function playerSummary(data,{player,cat,eq,end,days=30}){
    if(![0,30,90,365].includes(Number(days)))throw Error('Período inválido');
    const valid=typeof end==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(end)&&Number.isFinite(Date.parse(end+'T12:00:00Z'))&&new Date(end+'T12:00:00Z').toISOString().slice(0,10)===end;
    const registered=(data?.padron||[]).some(r=>r.jugador===player&&r.categoria===cat&&(r.equipo||'General')===eq);
    if(!registered||!valid)return null;
    const start=days?new Date(Date.parse(end+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10):'0000-01-01';
    const within=r=>r.jugador===player&&r.categoria===cat&&(r.equipo||'General')===eq&&/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)&&r.fecha>=start&&r.fecha<=end;
    const result={player,present:0,late:0,absent:0,total:0,unmarked:0,semaforo:{V:0,A:0,R:0},evaluations:0,dimensions:{},attendance:null};
    for(const r of (data.asistencia||[]).filter(within)){
      const code=String(r.estado||'').charAt(0),sem=String(r.estado||'').match(/(?:^| \| )Sem:([VAR])(?:$| \| )/);
      if(['P','A','T'].includes(code)){result.total++;if(code==='P')result.present++;else if(code==='T')result.late++;else result.absent++;}else result.unmarked++;
      if(sem)result.semaforo[sem[1]]++;
    }
    const samples=new Map();
    for(const r of (data.evaluaciones||[]).filter(within)){
      let hasNotes=false;
      for(const [dimension,n] of Object.entries(r.notas||{})){
        if(typeof n!=='number'||!Number.isFinite(n)||n<1||n>10)continue;
        hasNotes=true;if(!samples.has(dimension))samples.set(dimension,[]);samples.get(dimension).push(n);
      }
      if(hasNotes)result.evaluations++;
    }
    for(const [dimension,ns] of samples)result.dimensions[dimension]={average:ns.reduce((a,b)=>a+b,0)/ns.length,count:ns.length};
    result.attendance=result.total?100*(result.present+result.late)/result.total:null;
    return result;
  }
  function comparison(data,{cat,eq,end,days=30,players=[],label=v=>v,showAvg=true,extra=''}){
    const roster=[...new Set((data?.padron||[]).filter(r=>r.categoria===cat&&(r.equipo||'General')===eq).map(r=>r.jugador))].sort((a,b)=>a.localeCompare(b,'es'));
    const selected=players.length?players:[roster[0]||'',roster[1]||''];
    const controls='<div class="portal-compare-filters">'+[0,1].map((i)=>'<label>Jugador '+(i+1)+'<select id="portal-player-'+i+'" data-compare-control><option value="">Elegir jugador</option>'+roster.map(p=>'<option value="'+esc(p)+'" '+(p===selected[i]?'selected':'')+'>'+esc(label(p))+'</option>').join('')+'</select></label>'+(i===0?'<button type="button" class="portal-swap" data-compare-swap aria-label="Intercambiar jugadores">⇄</button>':'')).join('')+'<label>Período<select id="portal-compare-days" data-compare-control>'+[[30,'30 días'],[90,'90 días'],[365,'Un año'],[0,'Todo el historial']].map(([n,t])=>'<option value="'+n+'" '+(Number(days)===n?'selected':'')+'>'+t+'</option>').join('')+'</select></label></div><label class="portal-average-toggle"><input type="checkbox" id="portal-compare-avg" data-compare-control '+(showAvg?'checked':'')+'> Mostrar referencia del equipo en el radar</label>';
    const heading='<div class="portal-hero"><h2>Comparar jugadores</h2><p>'+esc(cat||'Elegir categoría')+' · '+esc(eq)+' · Hasta '+esc(end)+'</p></div>'+controls;
    if(!cat)return heading+'<div class="card"><p>Elegí una categoría y un equipo para comparar a sus deportistas.</p></div>';
    if(roster.length<2)return heading+'<div class="card"><p>Se necesitan al menos dos deportistas en el grupo seleccionado.</p></div>';
    if(!selected[0]||!selected[1]||selected[0]===selected[1])return heading+'<p class="portal-completion" role="status">Elegí dos jugadores diferentes para comparar.</p>';
    const values=selected.map(player=>playerSummary(data,{player,cat,eq,end,days:Number(days)}));
    if(values.some(v=>!v))return heading+'<p role="status">Elegí jugadores del grupo actual y una fecha válida.</p>';
    const colors=['#326be6','#10a37b'],names=selected.map(label),dimensions=[...new Set(values.flatMap(v=>Object.keys(v.dimensions)))].sort((a,b)=>a.localeCompare(b,'es'));
    const metric=(label,get)=>'<tr><th scope="row">'+label+'</th>'+values.map(v=>'<td>'+get(v)+'</td>').join('')+'</tr>';
    const table='<div class="card portal-table"><table><caption>Asistencia y semáforo en el mismo período</caption><thead><tr><th>Indicador</th>'+names.map((n,i)=>'<th scope="col" style="color:'+colors[i]+'">'+esc(n)+'</th>').join('')+'</tr></thead><tbody>'+metric('Asistencia',v=>v.attendance==null?'Sin datos':Math.round(v.attendance)+'%')+metric('Registros de asistencia',v=>v.total)+metric('Presente',v=>v.present)+metric('Tarde',v=>v.late)+metric('Ausente',v=>v.absent)+metric('Sin registrar',v=>v.unmarked)+metric('Semáforo verde',v=>v.semaforo.V)+metric('Semáforo amarillo',v=>v.semaforo.A)+metric('Semáforo rojo',v=>v.semaforo.R)+metric('Evaluaciones con notas',v=>v.evaluations)+'</tbody></table></div>';
    const graph='<div class="card"><h3>Evaluaciones por dimensión</h3><div class="portal-compare-legend">'+names.map((n,i)=>'<span style="--player-color:'+colors[i]+'">'+esc(n)+'</span>').join('')+'</div>'+(!dimensions.length?'<p class="hint">No hay notas registradas para este período.</p>':dimensions.map(d=>'<div class="portal-dimension"><h4>'+esc(d)+'</h4>'+values.map((v,i)=>{const score=v.dimensions[d];return '<div class="portal-compare-bar"><span>'+esc(names[i])+'</span><div class="portal-bar-track" aria-hidden="true"><div style="width:'+(score?score.average*10:0)+'%;background:'+colors[i]+'"></div></div><b>'+(score?score.average.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})+' / 10':'Sin datos')+'</b><small>'+(score?score.count+' nota(s)':'0 notas')+'</small></div>';}).join('')+'</div>').join(''))+'</div>';
    const profiles='<div class="portal-player-cards">'+values.map((v,i)=>'<article style="--player-color:'+colors[i]+'"><div class="portal-player-heading"><span class="portal-avatar" aria-hidden="true">'+esc(names[i].trim().charAt(0))+'</span><div><small>Jugador '+(i+1)+'</small><h3>'+esc(names[i])+'</h3></div></div><div class="portal-player-rate"><strong>'+(v.attendance==null?'Sin datos':Math.round(v.attendance)+'%')+'</strong><span>asistencia · '+v.total+' registros</span></div><p>'+v.evaluations+' evaluaciones · '+v.late+' llegada(s) tarde</p></article>').join('')+'</div>';
    return heading+profiles+'<p class="hint">P y T cuentan como presentes. Las notas muestran el promedio por dimensión y la cantidad de muestras. Los datos faltantes se muestran como “Sin datos”.</p>'+extra+graph+table;
  }
  return {summarize,views,playerSummary,comparison};
});
