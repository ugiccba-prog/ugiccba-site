(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MuniAudit=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=value=>{if(typeof value!=='string')return value;try{return JSON.parse(value);}catch(_){return value;}};
  const text=value=>value===undefined?'Sin registro':value===null?'Vacío':typeof value==='object'?JSON.stringify(value,null,2):String(value);
  const fields={estado:'Asistencia / semáforo',fecha:'Fecha',jugador:'Participante',categoria:'Grupo / categoría',equipo:'Equipo / subgrupo',notas:'Evaluación',clima:'Clima de clase',puntosCiudad:'Puntos Ciudad'};
  const identity=r=>r&&typeof r==='object'&&(r.jugadorId||r.jugador||r.id)?JSON.stringify([r.jugadorId||r.jugador||r.id,r.categoria||'',r.equipo||'General',r.fecha||'']):null;
  function changes(before,after){
    before=read(before);after=read(after);const result=[];
    function walk(a,b,field,person){
      if(JSON.stringify(a)===JSON.stringify(b))return;
      if(Array.isArray(a)||Array.isArray(b)){
        const aa=Array.isArray(a)?a:[],bb=Array.isArray(b)?b:[];
        if([...aa,...bb].every(r=>identity(r))){
          const left=new Map(aa.map(r=>[identity(r),r])),right=new Map(bb.map(r=>[identity(r),r]));
          for(const key of new Set([...left.keys(),...right.keys()])){const x=left.get(key),y=right.get(key),r=y||x;walk(x,y,field,[r.jugador,r.categoria,r.equipo,r.fecha].filter(Boolean).join(' · '));}return;
        }
      }
      if((a&&typeof a==='object'&&!Array.isArray(a))||(b&&typeof b==='object'&&!Array.isArray(b))){
        for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))walk(a?.[key],b?.[key],field?field+' · '+(fields[key]||key):(fields[key]||key),person);return;
      }
      result.push({person,field:field||'Registro',before:text(a),after:text(b)});
    }
    walk(before,after,'','');return result;
  }
  function render(before,after){const rows=changes(before,after);return '<h3 id="audit-title">Antes y después</h3><p class="hint">El registro original se conserva. Se muestran únicamente los valores que cambiaron.</p>'+(rows.length?'<div class="audit-table-wrap" tabindex="0" role="region" aria-label="Cambios registrados"><table class="audit-diff"><caption>'+rows.length+' cambio(s)</caption><thead><tr><th scope="col">Persona / campo</th><th scope="col">Antes</th><th scope="col">Después</th></tr></thead><tbody>'+rows.map(r=>'<tr><th scope="row">'+esc(r.person)+(r.person?'<small>'+esc(r.field)+'</small>':esc(r.field))+'</th><td>'+esc(r.before)+'</td><td>'+esc(r.after)+'</td></tr>').join('')+'</tbody></table></div>':'<p>No hay diferencias entre los valores guardados.</p>')+'<details class="audit-technical"><summary>Ver detalle técnico completo</summary><h4>Antes</h4><pre>'+esc(text(read(before)))+'</pre><h4>Después</h4><pre>'+esc(text(read(after)))+'</pre></details><button type="button" class="btn-sec" id="cerrar-audit">Cerrar</button>';}
  return {changes,render};
});
