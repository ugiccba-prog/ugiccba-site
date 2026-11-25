(function(){
 'use strict';
 let identity='',generation=0,refreshCurrent=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.MuniPresence={mount(session){
  const allowed=session&&!session.modoDemo&&(session.canManageUsers||['Dirección UGI','Coordinación'].includes(session.rol));
  const areas=allowed?(session.areas||[]).filter(a=>['Colonia','COYFD'].includes(a)):[];
  const key=areas.length?JSON.stringify([session.usuario,session.rol,areas]):'';
  if(identity===key)return;identity=key;generation++;refreshCurrent=null;
  document.getElementById('daily-presence-panel')?.remove();if(!key)return;
  const local=generation,box=document.createElement('details');box.open=false;box.id='daily-presence-panel';box.className='card muni-management';
  box.innerHTML='<summary><strong>Chicos presentes por día</strong></summary><div class="mp-content"><div class="mm-filters"><label>Fecha<input type="date" id="mp-date"></label><button type="button" id="mp-today">Hoy</button><button type="button" id="mp-refresh">Actualizar</button></div><p id="mp-status" role="status" aria-live="polite"></p><div id="mp-results"></div></div>';
  document.getElementById('app-screen').prepend(box);
  const find=id=>box.querySelector('#'+id),date=find('mp-date'),results=find('mp-results'),status=find('mp-status');
  date.value=Muni360Time.dateIso();let request=0;
  find('mp-today').onclick=()=>{date.value=Muni360Time.dateIso();refresh();};
  date.onchange=refresh;find('mp-refresh').onclick=refresh;refreshCurrent=refresh;
  const row=(label,x,total=false)=>'<tr'+(total?' class="mp-total"':'')+'><th scope="row">'+esc(label)+'</th><td>'+ (x.sinRegistros?'Sin registros':x.presentes)+'</td></tr>';
  async function refresh(){
   const seq=++request,selected=date.value;results.replaceChildren();
   if(!selected||Muni360Time.dateIso(selected)!==selected){status.textContent='Elegí una fecha válida.';return;}
   status.textContent='Consultando asistencia guardada…';
   try{
    const response=await MuniGoogle.call('/api/dashboard',{daily:true,date:selected,activities:areas});
    if(local!==generation||seq!==request||!box.isConnected)return;
    if(response.date!==selected||response.activities?.length!==areas.length||response.activities.some(x=>!Array.isArray(x.grupos)))throw Error('El indicador requiere actualizar el servidor.');
    results.innerHTML=response.activities.map(x=>'<article><h3>'+esc(x.activity)+'</h3>'+(x.sinRegistros?'<p class="mp-warning">Sin registros para esta fecha.</p>':x.incompleta?'<p class="mp-warning">Carga incompleta.</p>':'')+'<table><thead><tr><th>Grupo</th><th>Presentes</th></tr></thead><tbody>'+row('Total '+x.activity,x,true)+x.grupos.map(g=>row(g.categoria+(g.equipo&&g.equipo!=='General'?' · '+g.equipo:''),g)).join('')+'</tbody></table></article>').join('');
    status.textContent=Muni360Time.format(selected)+' · Actualizado '+new Date(response.generatedAt).toLocaleTimeString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hour:'2-digit',minute:'2-digit'});
   }catch(e){if(local===generation&&seq===request){results.replaceChildren();status.textContent='No se pudo obtener un conteo confirmado. '+(e.message||'Volvé a actualizar.');}}
  }
  refresh();
 }};
 window.addEventListener('muni360-attendance-saved',()=>refreshCurrent?.());
})();
