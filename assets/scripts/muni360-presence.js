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
  const local=generation,box=document.createElement('section');box.id='daily-presence-panel';box.className='card muni-management';
  box.innerHTML='<h2>Chicos presentes por día</h2><div class="mm-filters"><label>Fecha (Buenos Aires)<input type="date" id="mp-date"></label><button type="button" id="mp-today">Hoy</button><button type="button" id="mp-refresh">Actualizar presentes</button></div><p>P y T cuentan como presentes; las llegadas tarde están incluidas. Se cuenta una vez a cada persona identificada por actividad. Los totales de grupos pueden incluir a la misma persona en distintos grupos.</p><p id="mp-status" role="status" aria-live="polite"></p><div id="mp-results"></div>';
  document.getElementById('app-screen').prepend(box);
  const find=id=>box.querySelector('#'+id),date=find('mp-date'),results=find('mp-results'),status=find('mp-status');
  date.value=Muni360Time.dateIso();let request=0;
  find('mp-today').onclick=()=>{date.value=Muni360Time.dateIso();refresh();};
  date.onchange=refresh;find('mp-refresh').onclick=refresh;refreshCurrent=refresh;
  const row=(label,x)=>'<tr><th scope="row">'+esc(label)+'</th><td>'+ (x.sinRegistros?'Sin registros':x.presentes)+'</td><td>'+x.tardes+'</td><td>'+x.ausentes+'</td><td>'+x.sinRegistrar+'</td><td>'+x.conflictos+'</td></tr>';
  async function refresh(){
   const seq=++request,selected=date.value;results.replaceChildren();
   if(!selected||Muni360Time.dateIso(selected)!==selected){status.textContent='Elegí una fecha válida.';return;}
   status.textContent='Consultando asistencia guardada…';
   try{
    const response=await MuniGoogle.call('/api/dashboard',{daily:true,date:selected,activities:areas});
    if(local!==generation||seq!==request||!box.isConnected)return;
    if(response.date!==selected||response.activities?.length!==areas.length||response.activities.some(x=>!Array.isArray(x.grupos)))throw Error('El indicador requiere actualizar el servidor.');
    results.innerHTML=response.activities.map(x=>'<article><h3>'+esc(x.activity)+' · '+(x.sinRegistros?'Sin registros de asistencia':x.presentes+' presentes')+'</h3><p>'+(x.sinRegistros?'Falta carga de asistencia para esta fecha. No equivale a cero presentes.':x.incompleta?'Carga incompleta: hay personas sin registrar o marcas en conflicto.':'Asistencia registrada.')+'</p><div class="mm-hierarchy"><table><thead><tr><th>Actividad / grupo y equipo</th><th>Presentes (P + T)</th><th>Tardes</th><th>Ausentes</th><th>Sin registrar</th><th>En conflicto</th></tr></thead><tbody>'+row('Total único de '+x.activity,x)+x.grupos.map(g=>row(g.categoria+' · '+g.equipo,g)).join('')+'</tbody></table></div></article>').join('');
    status.textContent='Fecha: '+Muni360Time.format(selected)+' · Consultado '+Muni360Time.format(response.generatedAt)+'. Datos confirmados; los borradores pendientes no se incluyen. Sin registrar se compara con el padrón actual; los registros históricos se conservan. Las marcas contradictorias del mismo grupo requieren revisión.';
   }catch(e){if(local===generation&&seq===request){results.replaceChildren();status.textContent='No se pudo obtener un conteo confirmado. '+(e.message||'Volvé a actualizar.');}}
  }
  refresh();
 }};
 window.addEventListener('muni360-attendance-saved',()=>refreshCurrent?.());
 const style=document.createElement('style');style.textContent='#daily-presence-panel h2{font-size:1.25rem}#daily-presence-panel p{font-size:.9rem}#daily-presence-panel table{width:100%;border-collapse:collapse;min-width:640px}#daily-presence-panel th,#daily-presence-panel td{text-align:left;padding:10px;border-bottom:1px solid #dce5ee;font-size:.9rem}#daily-presence-panel tbody tr:first-child{background:#eef6fa;font-weight:700}';document.head.append(style);
})();
