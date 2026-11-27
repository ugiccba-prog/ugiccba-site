(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
  const key = team => JSON.stringify([team.categoria,team.equipo]);
  const title = team => team.categoria + ' · ' + team.equipo;

  const rowStyle = 'display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:#f4efe6;border:1px solid #e4ddd0;margin:6px 0;cursor:pointer;font-size:.88rem;font-weight:600;color:#082b49;text-transform:none;letter-spacing:normal;line-height:1.35';
  const checkStyle = 'width:18px;height:18px;min-width:18px;flex:0 0 18px;margin:0;accent-color:#166ea0;cursor:pointer';
  const fieldsetStyle = 'border:1px solid #e4ddd0;border-radius:16px;padding:10px 14px 12px;margin:10px 0 12px;background:#fffdf9';
  const legendStyle = 'font-size:.84rem;font-weight:700;color:#082b49;padding:0 8px';

  function mount(container, activity, call) {
    const isBase = ['Colonia','COYFD'].includes(activity);
    const groupWord = isBase ? 'grupos' : 'equipos';
    const GroupWord = isBase ? 'Grupos' : 'Equipos';
    const status = container.querySelector('[role="status"]');
    const content = container.querySelector('[data-team-access-fields]');
    let catalog, uid = '', sequence = 0;

    function render() {
      const teacher = catalog.teachers.find(row => row.uid === uid);
      const options = catalog.teachers.map(row =>
        '<option value="'+esc(row.uid)+'"'+(row.uid===uid?' selected':'')+'>'+esc(row.nombre||row.email)+' · '+esc(row.email)+'</option>');
      content.innerHTML = '<label for="team-access-teacher">Profe con acceso a esta actividad</label>'+
        '<select id="team-access-teacher"><option value="">Elegí un profe</option>'+options.join('')+'</select>';
      if (!teacher) {
        if (!options.length) content.insertAdjacentHTML('beforeend','<p class="hint">No hay profes activos para esta actividad.</p>');
        return;
      }
      const assigned = new Set(teacher.teams.map(key));
      const groups = catalog.teams.map((team,i) =>
        '<label style="'+rowStyle+'"><input type="checkbox" name="team" value="'+i+'" style="'+checkStyle+'"'+(assigned.has(key(team))?' checked':'')+'><span>'+esc(title(team))+'</span></label>');
      const available = new Set(catalog.teams.map(key));
      const missing = teacher.teams.filter(team => !available.has(key(team))).map(title);
      content.insertAdjacentHTML('beforeend',
        '<form data-team-access-form="save"><div class="field"><h4>'+GroupWord+'</h4>'+
        (groups.join('')||'<p class="hint">Todavía no hay '+groupWord+' en el padrón.</p>')+'</div>'+
        (missing.length?'<p class="hint">'+GroupWord+' sin plantel actual que se quitarán al guardar: '+esc(missing.join(', '))+'.</p>':'')+
        '<button class="btn" type="submit">Guardar '+groupWord+'</button></form>');
    }

    async function refresh(message='') {
      const current = ++sequence;
      status.textContent = 'Cargando planteles y profes…';
      try {
        const result = await call('/api/team-access/list',{deporte:activity});
        if (current!==sequence || !container.isConnected) return;
        catalog=result;
        render();
        status.textContent=message;
      } catch (error) {
        if (current===sequence && container.isConnected) status.textContent=error.message;
      }
    }

    content.addEventListener('change',event=>{
      if (event.target.id!=='team-access-teacher') return;
      uid=event.target.value;
      status.textContent='';
      render();
    });
    content.addEventListener('submit',async event=>{
      const action=event.target.dataset.teamAccessForm;
      if (!action) return;
      event.preventDefault();
      const teacher=catalog.teachers.find(row=>row.uid===uid);
      if (!teacher) return;
      const data=new FormData(event.target);
      const player=data.get('player');
      if (action==='player' && !player) return;
      const body=action==='save' ? {teams:data.getAll('team').map(index=>catalog.teams[Number(index)])} :
        {playerId:player==='no-player'?null:player.slice(3)};
      const controls=[...content.querySelectorAll('button,select,input')].filter(el=>!el.disabled);
      controls.forEach(el=>el.disabled=true);
      status.textContent='Guardando…';
      try {
        const result=await call('/api/team-access/'+action,{deporte:activity,uid,revision:teacher.revision,...body});
        if (!container.isConnected) return;
        teacher.revision=result.revision;
        if (action==='save') teacher.teams=body.teams;
        else {teacher.reviewed=true;teacher.playerId=body.playerId;}
        render();
        status.textContent=action==='save'?(GroupWord+' guardados.'):'Verificación guardada.';
      } catch(error) {
        if (!container.isConnected) return;
        if(error.code==='CONFLICTO') await refresh(error.message);
        else status.textContent=error.message;
      } finally {
        controls.forEach(el=>el.disabled=false);
      }
    });
    container.querySelector('[data-team-access-refresh]').addEventListener('click',()=>refresh());
    refresh();
  }
  function mountTeam(container, activity, team, call) {
    const isBase = ['Colonia','COYFD'].includes(activity);
    const status=container.querySelector('[role="status"]');
    const form=container.querySelector('form');
    const fields=form.querySelector('fieldset');
    const submit=form.querySelector('button');
    let teachers=[], assigned=new Set();

    async function load(message='') {
      submit.disabled=true;
      status.textContent='Cargando profesores…';
      try {
        const catalog=await call('/api/team-access/list',{deporte:activity});
        if(!container.isConnected)return;
        if(!catalog.teams.some(row=>key(row)===key(team))) {
          status.textContent=isBase?'Este grupo ya no figura en el padrón.':'Este equipo ya no figura en el padrón.';
          return;
        }
        teachers=catalog.teachers;
        assigned=new Set(teachers.filter(row=>row.teams.some(group=>key(group)===key(team))).map(row=>row.uid));
        fields.setAttribute('style',fieldsetStyle);
        fields.innerHTML='<legend style="'+legendStyle+'">Profesores de '+esc(title(team))+'</legend>'+teachers.map(row=>
          '<label style="'+rowStyle+'"><input type="checkbox" name="teacher" value="'+
          esc(row.uid)+'" style="'+checkStyle+'"'+(assigned.has(row.uid)?' checked':'')+'><span>'+esc(row.nombre||row.email)+' · '+esc(row.email)+'</span></label>'
        ).join('');
        status.textContent=message||(!teachers.length?'No hay profesores con acceso aprobado a esta actividad.':'');
        submit.disabled=!teachers.length;
      }catch(error){if(container.isConnected)status.textContent=error.message;}
    }

    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(submit.disabled)return;
      const selected=new Set(new FormData(form).getAll('teacher'));
      const changes=teachers.filter(row=>selected.has(row.uid)!==assigned.has(row.uid)).map(row=>({
        uid:row.uid,revision:row.revision,assigned:selected.has(row.uid)
      }));
      if(!changes.length){status.textContent='La selección ya está guardada.';return;}
      submit.disabled=true;
      fields.disabled=true;
      status.textContent='Guardando profesores…';
      try {
        await call('/api/team-access/save-team',{deporte:activity,team,changes});
        if(container.isConnected)await load('Profesores guardados.');
      } catch(error) {
        if(!container.isConnected)return;
        if(error.code==='CONFLICTO')await load('Las asignaciones cambiaron. Revisá la lista y volvé a guardar.');
        else {status.textContent=error.message;submit.disabled=false;}
      } finally {fields.disabled=false;}
    });
    container.addEventListener('toggle',()=>{
      if(container.open&&!fields.innerHTML)load();
    });
  }

  root.MuniTeamAccess={mount,mountTeam};
})(window);
