(function(){
 'use strict';
 let identity='',generation=0;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const STATUS_LABELS={abierta:'Abierta',en_revision:'En revisión',intervenida:'Intervenida',escalada:'Escalada +48 h',resuelta:'Resuelta'};
 const RULE_LABELS={CAIDA_ASISTENCIA:'Caída de asistencia',AUSENCIAS_CONSECUTIVAS:'Ausencias consecutivas',SEMAFORO_ALERTA:'Semáforo en alerta'};
 const fmtDate=iso=>{
  if(!iso)return '';
  try{return new Date(iso).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
  catch(_){return String(iso);}
 };
 const slaText=c=>{
  if(c.status==='resuelta')return 'Resuelta '+fmtDate(c.resolved_at||c.updated_at);
  if(c.status==='escalada')return 'Escalada a Dirección '+fmtDate(c.escalated_at||c.due_at);
  const ms=Date.parse(c.due_at)-Date.now();
  if(!Number.isFinite(ms))return '';
  if(ms<=0)return 'Plazo de 48 h vencido (pendiente de escalar)';
  const h=Math.ceil(ms/3600000);
  return 'Escala a Dirección en '+h+' h';
 };

 window.MuniInteligencia={mount(session){
  const allowed=session&&session.modoDemo!==true&&(session.canManageUsers||['Coordinación','Dirección UGI'].includes(session.rol));
  const key=allowed?JSON.stringify([session.usuario,session.rol,session.areas,session.canManageUsers]):'';
  if(identity===key)return;
  identity=key;
  generation++;
  document.getElementById('inteligencia-panel')?.remove();
  if(!allowed)return;

  const box=document.createElement('details');
  box.id='inteligencia-panel';
  box.className='card muni-inteligencia';
  const areas=Array.isArray(session.areas)?session.areas:[];
  box.innerHTML=
   '<summary><strong>Módulo de Inteligencia</strong><span>Alertas automáticas, intervenciones y escalamiento a 48 h</span></summary>'+
   '<div class="mi-content">'+
    '<div class="mi-controls">'+
     '<label>Estado<select id="mi-status">'+
      '<option value="activas">Activas (abiertas, revisión, interv., escaladas)</option>'+
      '<option value="escalada">Sólo escaladas (+48 h)</option>'+
      '<option value="abierta">Abiertas</option>'+
      '<option value="en_revision">En revisión</option>'+
      '<option value="intervenida">Intervenidas</option>'+
      '<option value="resuelta">Resueltas</option>'+
      '<option value="">Todas</option>'+
     '</select></label>'+
     '<label>Actividad<select id="mi-activity"><option value="">Todas las autorizadas ('+areas.length+')</option>'+
      areas.map(a=>'<option value="'+esc(a)+'">'+esc(a)+'</option>').join('')+
     '</select></label>'+
     '<button type="button" id="mi-refresh">Actualizar lista</button>'+
     '<button type="button" id="mi-scan">Analizar actividades</button>'+
    '</div>'+
    '<div class="mi-kpis" id="mi-kpis"></div>'+
    '<p id="mi-status-text" role="status">Abrí el panel o presioná «Analizar actividades» para detectar alertas.</p>'+
    '<div id="mi-cases" class="mi-cases"></div>'+
   '</div>';

  const appScreen=document.getElementById('app-screen');
  const dash=document.getElementById('management-panel');
  if(dash&&dash.parentNode===appScreen)dash.after(box);
  else appScreen.prepend(box);

  const local=generation,find=id=>box.querySelector('#'+id);
  let loaded=false;
  box.addEventListener('toggle',()=>{if(box.open&&!loaded){loaded=true;loadList();}});
  find('mi-status').onchange=loadList;
  find('mi-activity').onchange=loadList;
  find('mi-refresh').onclick=loadList;
  find('mi-scan').onclick=runScan;

  function renderCounts(counts){
   const c=counts||{};
   const items=[
    ['Abiertas',c.abierta||0,'open'],
    ['Escaladas +48 h',c.escalada||0,'escalada'],
    ['En revisión',c.en_revision||0,'review'],
    ['Intervenidas',c.intervenida||0,'interv'],
    ['Resueltas',c.resuelta||0,'done']
   ];
   find('mi-kpis').innerHTML=items.map(([label,n,cls])=>'<article class="mi-kpi-'+cls+'"><span>'+esc(label)+'</span><strong>'+n+'</strong></article>').join('');
  }

  function matchSurveys(c,surveys){
   const cat=(c.categoria||'').trim().toLowerCase();
   const eq=(c.equipo||'').trim().toLowerCase();
   return (surveys||[]).filter(s=>{
    if(s.activity!==c.activity)return false;
    const sc=(s.categoria||'').trim().toLowerCase();
    const se=(s.equipo||'').trim().toLowerCase();
    return (!sc||sc===cat)&&(!se||se===eq);
   });
  }

  function renderSurveyBox(c,surveys){
   const matched=matchSurveys(c,surveys);
   if(!matched.length)return '';
   return '<div class="mi-survey-link"><strong>Encuestas anónimas vinculadas:</strong><ul>'+
    matched.map(s=>{
     const scales=(s.summary||[]).filter(q=>q.type==='scale'&&q.avg!=null).map(q=>esc(q.label)+': <b>'+q.avg+'/5</b>');
     return '<li><strong>'+esc(s.title)+'</strong> · '+s.responseCount+' resp.'+(scales.length?' · '+scales.join(' · '):'')+'</li>';
    }).join('')+
   '</div>';
  }

  function renderCases(cases,surveys){
   const container=find('mi-cases');
   if(!cases||!cases.length){
    container.innerHTML='<p class="mi-empty">No hay alertas para el filtro seleccionado.</p>';
    return;
   }
   const caseMap=new Map(cases.map(c=>[c.id,c]));
   container.innerHTML=cases.map(c=>{
    const players=Array.isArray(c.metrics?.jugadores)?c.metrics.jugadores:[];
    const playersHtml=players.length?'<div class="mi-players"><strong>Integrantes detectados:</strong> '+players.map(p=>'<span class="mi-chip">'+esc(p.nombre)+' ('+esc(p.racha)+' aus.)</span>').join(' ')+'</div>':'';
    const surveyHtml=renderSurveyBox(c,surveys);
    const notes=Array.isArray(c.notes)?c.notes:[];
    const notesHtml=notes.length?'<details class="mi-notes"><summary>Historial de intervenciones ('+notes.length+')</summary><ul>'+notes.slice().reverse().map(n=>'<li><strong>'+esc(fmtDate(n.at))+'</strong> · '+esc(n.autor||n.uid)+' ('+esc(n.rol||'')+') → <em>'+esc(STATUS_LABELS[n.action]||n.action)+'</em>'+(n.note?': '+esc(n.note):'')+'</li>').join('')+'</ul></details>':'';
    const surveyBtn='<button type="button" class="mi-btn-survey" data-survey-case="'+esc(c.id)+'">Crear encuesta para el grupo</button>';
    const actions=c.status==='resuelta'
     ?'<button type="button" data-action="abierta">Reabrir</button>'+surveyBtn
     :'<button type="button" data-action="en_revision">En revisión</button><button type="button" data-action="intervenida">Intervenida</button><button type="button" data-action="resuelta" class="mi-btn-resolve">Resolver</button>'+surveyBtn;
    return '<article class="mi-case mi-sev-'+esc(c.severity)+' mi-st-'+esc(c.status)+'" data-case-id="'+esc(c.id)+'">'+
     '<header>'+
      '<div class="mi-badges">'+
       '<span class="mi-badge mi-badge-'+esc(c.status)+'">'+esc(STATUS_LABELS[c.status]||c.status)+'</span>'+
       '<span class="mi-badge mi-badge-sev-'+esc(c.severity)+'">Prioridad '+esc(c.severity)+'</span>'+
       '<span class="mi-rule">'+esc(RULE_LABELS[c.rule_code]||c.rule_code)+'</span>'+
      '</div>'+
      '<small class="mi-sla">'+esc(slaText(c))+'</small>'+
     '</header>'+
     '<h4>'+esc(c.title)+'</h4>'+
     '<p class="mi-meta"><strong>'+esc(c.activity)+'</strong>'+(c.categoria?' · '+esc(c.categoria):'')+(c.equipo?' · '+esc(c.equipo):'')+'</p>'+
     '<p class="mi-summary">'+esc(c.summary)+'</p>'+
     playersHtml+
     surveyHtml+
     '<div class="mi-actions">'+
      '<input type="text" class="mi-note-input" maxlength="500" placeholder="Nota de intervención (opcional)">'+
      '<div class="mi-btn-row">'+actions+'</div>'+
     '</div>'+
     notesHtml+
    '</article>';
   }).join('');

   container.querySelectorAll('.mi-btn-survey').forEach(btn=>{
    btn.onclick=()=>{
     const c=caseMap.get(btn.dataset.surveyCase);
     if(!c)return;
     window.MuniSurveys?.prefill({
      activity:c.activity,
      categoria:c.categoria||'',
      equipo:c.equipo||'',
      template:c.rule_code==='SEMAFORO_ALERTA'?'clima':'ausencias'
     });
    };
   });

   container.querySelectorAll('.mi-case button[data-action]').forEach(btn=>{
    btn.onclick=async()=>{
     const card=btn.closest('.mi-case');
     const caseId=card.dataset.caseId;
     const status=btn.dataset.action;
     const note=card.querySelector('.mi-note-input')?.value||'';
     card.querySelectorAll('button').forEach(b=>b.disabled=true);
     try{
      await MuniGoogle.call('/api/inteligencia/update',{caseId,status,note});
      if(local!==generation||!box.isConnected)return;
      await loadList();
     }catch(e){
      if(local===generation)find('mi-status-text').textContent=e.message||'No se pudo actualizar el caso.';
      card.querySelectorAll('button').forEach(b=>b.disabled=false);
     }
    };
   });
  }

  async function loadList(){
   const status=find('mi-status').value;
   const selectedAct=find('mi-activity').value;
   const activities=selectedAct?[selectedAct]:null;
   find('mi-refresh').disabled=true;
   find('mi-status-text').textContent='Consultando alertas e intervenciones…';
   try{
    const [r,surveysRes]=await Promise.all([
     MuniGoogle.call('/api/inteligencia/list',{status,activities}),
     MuniGoogle.call('/api/surveys/list',selectedAct?{activity:selectedAct}:{}).catch(()=>({surveys:[]}))
    ]);
    if(local!==generation||!box.isConnected)return;
    renderCounts(r.counts);
    renderCases(r.cases,surveysRes.surveys||[]);
    find('mi-status-text').textContent='Actualizado '+fmtDate(r.generatedAt||new Date().toISOString())+' (Argentina).';
   }catch(e){
    if(local===generation){loaded=false;find('mi-status-text').textContent=e.message||'No se pudo consultar Inteligencia.';}
   }finally{
    if(box.isConnected)find('mi-refresh').disabled=false;
   }
  }

  async function runScan(){
   const selectedAct=find('mi-activity').value;
   const targets=selectedAct?[selectedAct]:areas;
   if(!targets.length){find('mi-status-text').textContent='No hay actividades autorizadas para analizar.';return;}
   find('mi-scan').disabled=true;
   find('mi-refresh').disabled=true;
   try{
    for(let i=0;i<targets.length;i++){
     find('mi-status-text').textContent='Analizando ('+(i+1)+'/'+targets.length+'): '+targets[i]+'…';
     await MuniGoogle.call('/api/inteligencia/scan',{activity:targets[i]});
     if(local!==generation||!box.isConnected)return;
    }
    await loadList();
   }catch(e){
    if(local===generation)find('mi-status-text').textContent=e.message||'No se pudo completar el análisis.';
   }finally{
    if(box.isConnected){find('mi-scan').disabled=false;find('mi-refresh').disabled=false;}
   }
  }
 }};

 const style=document.createElement('style');
 style.textContent=
  '.muni-inteligencia{border-top:4px solid #7c3aed;margin-bottom:18px}'+
  '.muni-inteligencia>summary{cursor:pointer;display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center}'+
  '.muni-inteligencia>summary strong{font-size:1.15rem;color:#0b2545}'+
  '.muni-inteligencia>summary span{color:#526477;font-size:.85rem}'+
  '.mi-content{padding-top:18px}'+
  '.mi-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:14px}'+
  '.mi-controls label{min-width:190px}'+
  '.mi-controls button{border:1px solid #c9dce8;border-radius:10px;padding:10px 13px;background:#edf6fa;color:#173954;font:600 .8rem Inter,Arial,sans-serif;cursor:pointer}'+
  '.mi-controls #mi-scan{background:#4c1d95;color:#fff;border-color:#4c1d95}'+
  '.mi-controls button:disabled{opacity:.6;cursor:wait}'+
  '.mi-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px}'+
  '.mi-kpis article{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:12px}'+
  '.mi-kpis article.mi-kpi-escalada{background:#fef2f2;border-color:#fecaca}'+
  '.mi-kpis article.mi-kpi-done{background:#ecfdf5;border-color:#a7f3d0}'+
  '.mi-kpis span{display:block;font-size:.78rem;color:#526477}'+
  '.mi-kpis strong{font-size:1.3rem;color:#0b2545}'+
  '.mi-cases{display:grid;gap:12px;margin-top:12px}'+
  '.mi-case{border:1px solid #dce5ee;border-left:4px solid #7c3aed;border-radius:12px;padding:14px;background:#fff}'+
  '.mi-case.mi-st-escalada{border-left-color:#b42318;background:#fffafa}'+
  '.mi-case.mi-st-resuelta{border-left-color:#16733a;opacity:.85}'+
  '.mi-case header{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}'+
  '.mi-badges{display:flex;gap:6px;align-items:center;flex-wrap:wrap}'+
  '.mi-badge{font-size:.72rem;font-weight:700;padding:3px 8px;border-radius:999px;background:#eef2ff;color:#3730a3}'+
  '.mi-badge-escalada,.mi-badge-sev-alta{background:#fee2e2;color:#991b1b}'+
  '.mi-badge-intervenida{background:#fef3c7;color:#92400e}'+
  '.mi-badge-resuelta{background:#dcfce7;color:#166534}'+
  '.mi-rule,.mi-sla{font-size:.78rem;color:#526477}'+
  '.mi-case h4{margin:4px 0;color:#0b2545;font-size:1rem}'+
  '.mi-meta,.mi-summary,.mi-players{margin:4px 0;font-size:.86rem;color:#334155}'+
  '.mi-chip{display:inline-block;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:999px;padding:2px 8px;font-size:.78rem;margin:2px 4px 2px 0}'+
  '.mi-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}'+
  '.mi-note-input{flex:1 1 220px;min-width:180px}'+
  '.mi-btn-row{display:flex;gap:6px;flex-wrap:wrap}'+
  '.mi-btn-row button{border:1px solid #cbd5e1;border-radius:8px;padding:7px 11px;background:#f8fafc;color:#0f172a;font:600 .78rem Inter,Arial,sans-serif;cursor:pointer}'+
  '.mi-btn-row .mi-btn-resolve{background:#166534;color:#fff;border-color:#166534}'+
  '.mi-btn-row .mi-btn-survey{background:#f0fdfa;color:#0f766e;border-color:#99f6e4}'+
  '.mi-survey-link{margin:8px 0;padding:8px 10px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;font-size:.82rem;color:#134e4a}'+
  '.mi-survey-link ul{margin:4px 0 0 18px;padding:0}'+
  '.mi-notes{margin-top:10px;font-size:.8rem;color:#475569}'+
  '.mi-notes ul{margin:6px 0 0 18px;padding:0}'+
  '.mi-empty{color:#526477;font-size:.88rem}';
 document.head.append(style);
})();
