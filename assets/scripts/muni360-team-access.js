(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
  const key = team => JSON.stringify([team.categoria,team.equipo]);
  const title = team => team.categoria + ' · ' + team.equipo;

  function mount(container, activity, call) {
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
        '<label class="btn-sec"><input type="checkbox" name="team" value="'+i+'"'+(assigned.has(key(team))?' checked':'')+'> '+esc(title(team))+'</label>');
      const available = new Set(catalog.teams.map(key));
      const missing = teacher.teams.filter(team => !available.has(key(team))).map(title);
      const linkStatus = teacher.reviewed ? '' : '<p class="hint">Dirección debe verificar la ficha antes de habilitar Evaluaciones.</p>';
      content.insertAdjacentHTML('beforeend',
        '<form data-team-access-form="save"><div class="field"><h4>Equipos</h4>'+
        (groups.join('')||'<p class="hint">Todavía no hay equipos en el padrón.</p>')+'</div>'+
        (missing.length?'<p class="hint">Equipos sin plantel actual que se quitarán al guardar: '+esc(missing.join(', '))+'.</p>':'')+
        linkStatus+'<button class="btn" type="submit">Guardar equipos</button></form>');
      if (!catalog.canLinkPlayer) return;
      const selected = teacher.reviewed ? teacher.playerId === null ? 'no-player' : 'id:'+teacher.playerId : '';
      const roster = catalog.players.map(player=>{
        const value = 'id:'+player.id;
        return '<option value="'+esc(value)+'"'+(selected===value?' selected':'')+'>'+esc(player.nombre+' · '+title(player))+'</option>';
      });
      if (selected.startsWith('id:') && !catalog.players.some(row=>'id:'+row.id===selected)) {
        roster.unshift('<option value="'+esc(selected)+'" selected disabled>Ficha vinculada fuera del padrón actual</option>');
      }
      content.insertAdjacentHTML('beforeend','<form data-team-access-form="player" class="field" style="margin-top:1rem">'+
        '<label for="team-access-player">Ficha de este profe como jugador</label>'+
        '<select id="team-access-player" name="player" required><option value="">Elegí una opción</option>'+
        '<option value="no-player"'+(selected==='no-player'?' selected':'')+'>No juega en esta actividad</option>'+roster.join('')+
        '</select><p class="hint">Elegí su ficha para excluir sus evaluaciones del acceso y los promedios.</p>'+
        '<button class="btn-sec" type="submit">Guardar verificación</button></form>');
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
        status.textContent=action==='save'?'Equipos guardados.':'Verificación guardada.';
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
  root.MuniTeamAccess={mount};
})(window);
