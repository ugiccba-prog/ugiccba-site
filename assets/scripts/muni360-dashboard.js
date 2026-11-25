(function(){
 'use strict';
 let identity='',generation=0;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pct=n=>n==null?'Sin datos':n.toLocaleString('es-AR')+' %';
 const countLabel=(count,singular,plural)=>count+' '+(count===1?singular:plural);
 const semColors=[
  ['verde','Verde'],
  ['amarillo','Amarillo'],
  ['rojo','Rojo']
 ];
 const semSummary=s=>{
  if(!s?.observados)return '<span class="mm-empty">Sin datos</span>';
  const score=s.promedio.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const counts=semColors.map(([key,label])=>
   '<span class="mm-count"><span class="mm-dot mm-dot-'+key+'" aria-hidden="true"></span><span class="mm-sr-only">'+label+': </span>'+s[key]+'</span>'
  ).join('');
  return '<span class="mm-sem-score"><strong>'+score+' / 3</strong> <small>'+pct(s.pctVerde)+' verde</small></span><span class="mm-counts">'+counts+'</span>';
 };
 const metric=(label,html)=>'<span class="mm-metric"><span class="mm-label">'+label+'</span>'+html+'</span>';
 const metricValues=x=>metric('Deportistas','<strong>'+x.inscripciones+'</strong>')+
  metric('Asistencia','<strong>'+pct(x.asistencia)+'</strong>')+
  metric('Semáforo',semSummary(x.semaforo));
 const detailRow=(label,x,className)=>'<div class="mm-metric-row '+className+'"><span class="mm-row-name">'+esc(label)+'</span>'+metricValues(x)+'</div>';
 const activityDetail=x=>{
  const categories=x.categoriasDetalle||[],groups=x.gruposDetalle||[];
  const detail=categories.map(c=>detailRow(c.categoria,c,'mm-category')+
   groups.filter(g=>g.categoria===c.categoria).map(g=>detailRow(g.tira,g,'mm-team')).join('')
  ).join('');
  return '<details class="mm-activity"><summary class="mm-metric-row"><span class="mm-row-name"><strong>'+esc(x.activity)+'</strong><small>'+countLabel(categories.length,'categoría','categorías')+' · '+countLabel(groups.length,'equipo','equipos')+'</small></span>'+metricValues(x)+'</summary>'+
   '<div class="mm-nested">'+(detail||'<p class="mm-note">Sin detalle por categoría.</p>')+'</div></details>';
 };
 window.MuniDashboard={mount(session){
  window.MuniPresence?.mount(session);
  const isDemo=session?.modoDemo===true;
  const allowed=session&&(session.canManageUsers||(isDemo&&session.esAdminTotal)||['Coordinación','Dirección UGI'].includes(session.rol));
  const key=allowed?JSON.stringify([session.usuario,session.rol,session.areas,session.canManageUsers,isDemo]):'';
  if(identity===key)return;identity=key;generation++;document.getElementById('management-panel')?.remove();if(!allowed)return;
  const callApi=(path,body)=>{if(isDemo){if(!window.MuniDemoRuntime?.call)return Promise.reject(Error('Falta el módulo de demostración local.'));return window.MuniDemoRuntime.call(path,body,session);}return MuniGoogle.call(path,body);};
  const owner=!!(session.canManageUsers||(isDemo&&session.esAdminTotal)),box=document.createElement('details');box.id='management-panel';box.className='card muni-management';
  const title=owner?'Mi panel · Dirección UGI':'Panel de Coordinación';
  const description=owner?'Estadísticas generales y detalle por actividad':'Estadísticas de tus actividades, categorías y equipos';
  box.innerHTML=`<summary class="mm-panel-heading"><strong>${title}</strong><span>${description}</span></summary>
   <div class="mm-content">
    <div class="mm-filters">
     <label>Período<select id="mm-days"><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option><option value="0">Todo el historial</option></select></label>
     <label>Mostrar<select id="mm-filter"><option value="all">Todas las actividades</option><option value="with">Con deportistas</option><option value="empty">Vacías (0)</option></select></label>
    </div>
    <fieldset><legend>Actividades ${owner?'del club':'autorizadas'}</legend>
     <div class="mm-choices">${session.areas.map(a=>'<label><input type="checkbox" value="'+esc(a)+'" checked> '+esc(a)+'</label>').join('')}</div>
    </fieldset>
    <div class="mm-actions">
     <button type="button" id="mm-all">Seleccionar todas</button>
     <button type="button" id="mm-none">Limpiar selección</button>
     <button type="button" id="mm-update">Consultar</button>
    </div>
    <p id="mm-status" class="mm-note" role="status">Elegí actividades y consultá sus mediciones.</p>
    <div id="mm-results"></div>
    <div class="mm-detail-heading" id="mm-detail-heading" hidden><h3>Detalle por actividad</h3><button type="button" id="mm-expand">Expandir todas</button></div>
    <div class="mm-hierarchy" id="mm-hierarchy"></div>
   </div>`;
  document.getElementById('app-screen').prepend(box);
  const local=generation,find=id=>box.querySelector('#'+id),checks=()=>[...box.querySelectorAll('.mm-choices input')];
  find('mm-all').onclick=()=>checks().forEach(x=>x.checked=true);find('mm-none').onclick=()=>checks().forEach(x=>x.checked=false);
  find('mm-expand').onclick=()=>{const open=find('mm-expand').dataset.open!=='1';box.querySelectorAll('.mm-activity').forEach(x=>x.open=open);find('mm-expand').dataset.open=open?'1':'0';find('mm-expand').textContent=open?'Contraer todas':'Expandir todas';};
  let loaded=false;box.addEventListener('toggle',()=>{if(box.open&&!loaded){loaded=true;refresh();}});find('mm-update').onclick=refresh;
  async function refresh(){
   const activities=checks().filter(x=>x.checked).map(x=>x.value),button=find('mm-update');if(!activities.length){find('mm-status').textContent='Seleccioná al menos una actividad.';return;}
   button.disabled=true;
   find('mm-results').replaceChildren();
   find('mm-hierarchy').replaceChildren();
   find('mm-detail-heading').hidden=true;
   find('mm-expand').dataset.open='0';
   find('mm-expand').textContent='Expandir todas';
   find('mm-status').textContent='Consultando datos confirmados…';
   const BATCH_SIZE=2,days=Number(find('mm-days').value),collected=[];
   let generatedAt=null;
   try{
    for(let i=0;i<activities.length;i+=BATCH_SIZE){
     const chunk=activities.slice(i,i+BATCH_SIZE);
     find('mm-status').textContent='Consultando datos confirmados… ('+Math.min(i+chunk.length,activities.length)+'/'+activities.length+')';
     const r=await callApi('/api/dashboard',{days,activities:chunk});if(local!==generation||!box.isConnected)return;
     if(Array.isArray(r.activities))collected.push(...r.activities);
     generatedAt=r.generatedAt||generatedAt;
    }
    const filter=find('mm-filter').value,rows=collected.filter(x=>filter==='with'?x.inscripciones>0:filter==='empty'?x.inscripciones===0:true);
    const totals=rows.reduce((t,x)=>{for(const k of ['inscripciones','registros','presentes','evaluaciones','notas','sumaNotas'])t[k]+=x[k]||0;for(const k of ['verde','amarillo','rojo'])t.semaforo[k]+=x.semaforo?.[k]||0;return t;},{inscripciones:0,registros:0,presentes:0,evaluaciones:0,notas:0,sumaNotas:0,semaforo:{verde:0,amarillo:0,rojo:0}});
    const obs=totals.semaforo.verde+totals.semaforo.amarillo+totals.semaforo.rojo,sem={...totals.semaforo,observados:obs,promedio:obs?(totals.semaforo.verde*3+totals.semaforo.amarillo*2+totals.semaforo.rojo)/obs:null,pctVerde:obs?Math.round(totals.semaforo.verde/obs*1000)/10:null};
    const withAthletes=rows.filter(x=>x.inscripciones>0).length;
    const attendance=totals.registros?pct(Math.round(totals.presentes/totals.registros*1000)/10):'Sin datos';
    const summary=[
     metric('Deportistas','<strong>'+totals.inscripciones+'</strong><small>'+withAthletes+' de '+countLabel(rows.length,'actividad','actividades')+' con deportistas</small>'),
     metric('Asistencia general','<strong>'+attendance+'</strong>'),
     metric('Semáforo general',semSummary(sem))
    ];
    find('mm-results').innerHTML='<div class="mm-kpis">'+summary.map(html=>'<div>'+html+'</div>').join('')+'</div>'+
     '<p class="mm-note">La asistencia incluye presentes, llegadas tarde y ausentes. El semáforo cuenta las observaciones verdes, amarillas y rojas.</p>';
    find('mm-detail-heading').hidden=!rows.length;
    find('mm-hierarchy').innerHTML=rows.length?rows.map(activityDetail).join(''):'<p class="mm-note">Sin actividades para este filtro.</p>';
    find('mm-status').textContent=(isDemo?'Demostración · ':'')+(owner?'Datos del club':'Datos de actividades autorizadas')+' · Actualizados '+new Date(generatedAt||Date.now()).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})+' (Argentina).';
   }catch(e){if(local===generation){loaded=false;find('mm-status').textContent=e.message||'No se pudo consultar el panel.';}}finally{if(box.isConnected)button.disabled=false;}
  }
 }};
})();
