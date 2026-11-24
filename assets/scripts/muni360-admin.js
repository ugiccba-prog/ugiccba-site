(function(){
  'use strict';
  const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const demo=new URLSearchParams(location.search).get('demo')==='1';
  const labels={verDni:'Ver y modificar DNI',verLegajo:'Consultar y registrar bitácora privada',administrarPadron:'Administrar padrón y variables',editarDua:'Editar apoyos DUA',exportar:'Exportar reportes',archivar:'Archivar temporadas',publicarComunidad:'Publicar avisos en Comunidad'};
  let users=[],catalog={},editing=null,cursor=null,history=[],listRequest=0;
  const defaultCaps=role=>Object.fromEntries(Object.keys(labels).map(k=>[k,['Coordinación','Dirección UGI'].includes(role)]));
  const canPublishComunidad=u=>accessState(u)==='activo'&&(u.rol==='Dirección UGI'||(u.capabilities?.publicarComunidad??u.rol==='Coordinación'));
  const noticeLabels={pending:'Correo en cola',sending:'Enviando correo',sent:'Correo enviado',review:'Correo pendiente de revisión'};
  function accessBadges(user){
    const badges=[user.awaitingLogin?'Pendiente de primer ingreso':'',noticeLabels[user.noticeStatus]].filter(Boolean);
    return badges.map(label=>' <span class="badge">'+esc(label)+'</span>').join('');
  }
  const archivedView=()=>$('filter').value==='archivado';
  const accessState=user=>user.archivedAt?'archivado':user.status==='activo'&&Date.parse(user.expiresAt)<=Date.now()?'vencido':user.status;
  const canArchive=user=>user.rol!=='Dirección UGI'&&['pendiente','suspendido','vencido'].includes(accessState(user));
  function accessActions(user){
    const uid=esc(user.uid);
    if(user.archivedAt)return `<button type="button" data-archive="${uid}">Restaurar</button>`;
    if(user.rol==='Dirección UGI')return '';
    const archive=canArchive(user)?`<button type="button" data-archive="${uid}">Archivar acceso</button>`:'';
    return `<div class="row"><button type="button" data-edit="${uid}">Revisar acceso</button>${archive}</div>`;
  }
  function render(){
    const q=$('search').value.trim().toLowerCase(),status=$('filter').value;
    const filtered=users.filter(u=>{
      const state=accessState(u);
      return (!q||(u.nombre+' '+u.email).toLowerCase().includes(q))&&(status?status===state:state!=='archivado');
    });
    $('users').innerHTML=filtered.length?filtered.map(u=>`<article class="person"><div><strong>${esc(u.nombre)}</strong><span class="muted">${esc(u.email)}</span><p class="muted">${esc(u.rol)} · ${u.areas.length} actividad(es) · Todos sus equipos</p><span class="badge">${esc(accessState(u))}</span>${accessBadges(u)}${canPublishComunidad(u)?' <span class="badge">Publica en Comunidad</span>':''}</div>${accessActions(u)}</article>`).join(''):'<p>No hay usuarios para este filtro.</p>';
    $('more').classList.toggle('hidden',!cursor);
  }
  function capsRender(values){$('caps').innerHTML=Object.entries(labels).map(([key,label])=>`<label class="check"><input type="checkbox" data-cap="${key}" ${values[key]?'checked':''}>${label}</label>`).join('');}
  function openEditor(user=null){
    editing=user;
    const isNew=!user,role=user?.rol||'Profe';
    $('editor-name').textContent=user?.nombre||'Agregar acceso';
    $('editor-email').textContent=user?.email||'';
    $('editor-email').classList.toggle('hidden',isNew||user.nombre===user.email);
    $('new-email-field').classList.toggle('hidden',!isNew);
    $('new-email').value='';
    $('new-email').required=isNew;
    $('new-email').disabled=!isNew;
    $('state-field').classList.toggle('hidden',isNew);
    $('save').textContent=isNew?'Habilitar acceso y enviar correo':'Guardar permisos';
    $('role').innerHTML=catalog.roles.filter(r=>r!=='Dirección UGI').map(r=>`<option>${esc(r)}</option>`).join('');
    $('role').value=role;
    $('state').value=user?.status||'activo';
    $('expires').value=user?.expiresAt?Muni360Time.toInput(user.expiresAt):'';
    capsRender({...defaultCaps(role),...user?.capabilities});
    $('areas').innerHTML=catalog.areas.map(a=>`<label class="check"><input type="checkbox" data-area="${esc(a)}" ${user?.areas.includes(a)?'checked':''}>${esc(a)}</label>`).join('');
    $('form-error').classList.add('hidden');
    $('editor').showModal();
    if(isNew)$('new-email').focus();
  }
  function renderHistory(){$('history').innerHTML=history.length?history.map(e=>`<details><summary>${esc(Muni360Time.format(e.fecha))} · ${esc(e.autor)} · ${esc(e.target)}${e.motivo?' · '+esc(e.motivo):''}</summary><pre>${esc(Muni360Time.displayJson({antes:e.antes,despues:e.despues}))}</pre></details>`).join(''):'<p class="muted">Aún no hay cambios de permisos registrados.</p>';}
  async function load(append=false){
    const request=++listRequest;
    try{
      const result=await MuniGoogle.call('/api/users/list',{cursor:append?cursor:null,archived:archivedView()});
      if(request!==listRequest)return;
      users=append?[...new Map(users.concat(result.users).map(u=>[u.uid,u])).values()]:result.users;
      cursor=result.nextCursor;render();
      const report=await MuniGoogle.call('/api/users/history');
      if(request!==listRequest)return;
      history=report.events;renderHistory();
      $('status').textContent='Administración habilitada. Cada modificación queda registrada.';
    }catch(error){if(request===listRequest)$('status').textContent=error.message;}
  }
  async function changeArchive(user,button){
    const archived=!user.archivedAt;
    const message=archived
      ? '¿Archivar el acceso de '+user.email+'? Se moverá a Archivados y quedará suspendido.'
      : '¿Restaurar el acceso de '+user.email+'? Volverá al listado como suspendido.';
    if(!window.confirm(message))return;
    button.disabled=true;
    try{
      if(demo){
        const before={...user};
        if(archived)user.archivedAt=new Date().toISOString();
        else delete user.archivedAt;
        user.status='suspendido';user.revision+=1;
        if(user.noticeStatus==='pending')delete user.noticeStatus;
        history.unshift({fecha:new Date().toISOString(),autor:'Dirección · Demostración',target:user.email,antes:before,despues:{...user},motivo:archived?'Acceso archivado':'Acceso restaurado como suspendido'});
        renderHistory();render();
      }else{
        await MuniGoogle.call('/api/users/archive',{uid:user.uid,revision:user.revision,archived});
        users=users.filter(entry=>entry.uid!==user.uid);render();
        await load();
      }
      $('status').textContent=archived?'Acceso archivado. Lo podés recuperar desde Archivados.':'Acceso restaurado como suspendido.';
    }catch(error){$('status').textContent=error.message;}
    finally{button.disabled=false;}
  }
  $('users').addEventListener('click',e=>{
    const button=e.target.closest('[data-edit], [data-archive]');
    if(!button)return;
    const user=users.find(u=>u.uid===(button.dataset.edit??button.dataset.archive));
    if(!user)return;
    if(button.dataset.edit)openEditor(user);
    else changeArchive(user,button);
  });
  $('add-user').onclick=()=>openEditor();
  $('search').oninput=render;
  let showingArchive=false;
  $('filter').onchange=()=>{
    const showing=archivedView();
    if(!demo&&showing!==showingArchive){
      users=[];cursor=null;render();load();
    }else render();
    showingArchive=showing;
  };
  $('cancel').onclick=()=>$('editor').close();
  $('role').onchange=()=>capsRender(defaultCaps($('role').value));
  $('reload').onclick=()=>demo?render():load();$('more').onclick=()=>load(true);$('google').onclick=()=>MuniGoogle.login().catch(e=>$('status').textContent=e.message);
  $('editor').addEventListener('cancel',e=>{if($('save').disabled)e.preventDefault();});
  $('access-form').onsubmit=async e=>{
    e.preventDefault();const expires=$('expires').value;let expiresAt;
    try{expiresAt=expires?Muni360Time.fromInput(expires):null;}catch(error){$('form-error').textContent=error.message;$('form-error').classList.remove('hidden');return;}
    const value={...(editing?{uid:editing.uid,revision:editing.revision}:{email:$('new-email').value.trim().toLowerCase()}),rol:$('role').value,status:$('state').value,expiresAt,areas:[...document.querySelectorAll('[data-area]:checked')].map(x=>x.dataset.area),capabilities:Object.fromEntries([...document.querySelectorAll('[data-cap]')].map(x=>[x.dataset.cap,x.checked]))};
    $('save').disabled=true;$('cancel').disabled=true;
    try{
      if(value.rol==='Reemplazante'&&!expiresAt)throw Error('Definí el vencimiento del reemplazo.');if(value.status==='activo'&&value.rol!=='Dirección UGI'&&!value.areas.length)throw Error('Elegí al menos una actividad.');
      if(!editing){
        if(demo){
          const existing=users.find(u=>u.email===value.email);
          if(existing&&existing.status!=='pendiente')throw Error('El correo ya está en Usuarios y permisos. Usá Revisar acceso.');
          const before=existing?{...existing}:null;
          const user=existing||{uid:'demo-invite-'+value.email,nombre:value.email,awaitingLogin:true,revision:0};
          Object.assign(user,value,{noticeStatus:'pending'});
          if(!existing)users.unshift(user);
          history.unshift({fecha:new Date().toISOString(),autor:'Dirección · Demostración',target:value.email,antes:before,despues:{...user}});
          renderHistory();render();
          $('status').textContent='Acceso habilitado en la demostración. Correo simulado.';
        }else{
          const result=await MuniGoogle.call('/api/users/add',value);
          $('search').value=value.email;
          $('filter').value='';showingArchive=false;
          await load();
          if(!users.some(u=>u.uid===result.user.uid||u.email.toLowerCase()===value.email)){
            users.unshift({...result.user,noticeStatus:'pending'});render();
          }
          $('status').textContent='Acceso habilitado. El aviso por correo quedó en cola.';
        }
      }
      else if(demo){const before={rol:editing.rol,status:editing.status,areas:editing.areas,capabilities:editing.capabilities};Object.assign(editing,value,{revision:editing.revision+1});history.unshift({fecha:new Date().toISOString(),autor:'Dirección · Demostración',target:editing.email,antes:before,despues:value});renderHistory();render();$('status').textContent='Cambio de demostración. No se guardó en Google.';}
      else{const result=await MuniGoogle.call('/api/users/update',value);await load();if(result.authorizationUpdated)$('status').textContent='Permisos guardados. La autorización nueva rige en cada solicitud.';else if(!result.revoked)$('status').textContent='Permisos guardados; no se pudo completar la revocación adicional de tokens. El servidor ya aplica los permisos nuevos.';}
      $('editor').close();
    }catch(err){$('form-error').textContent=err.message;$('form-error').classList.remove('hidden');}finally{$('save').disabled=false;$('cancel').disabled=false;}
  };
  if(demo){$('back-portal').href='../muni360/?demo=1';catalog={roles:['Profe','Coordinación','Dirección UGI','Consulta','Reemplazante'],areas:['Hockey sobre Patines Caballeros','Hockey sobre Patines Damas','Colonia','COYFD','Básquet Caballeros']};users=[{uid:'demo-pending',nombre:'Profe de ejemplo',email:'profe@example.invalid',rol:'Profe',status:'pendiente',areas:[],revision:0},{uid:'demo-active',nombre:'Coordinación de ejemplo',email:'coordinacion@example.invalid',rol:'Coordinación',status:'activo',areas:catalog.areas.slice(0,2),revision:0}];$('login').classList.add('hidden');$('panel').classList.remove('hidden');$('status').textContent='DEMOSTRACIÓN · Usuarios ficticios · Ningún cambio se envía a Google.';render();renderHistory();}
  else MuniGoogle.observe(async(user,error)=>{listRequest++;$('panel').classList.add('hidden');$('login').classList.remove('hidden');users=[];$('users').textContent='';$('history').textContent='';if(error){$('status').textContent=error.message;return;}if(!user){$('status').textContent='Ingresá con Google para verificar permisos.';return;}try{const me=await MuniGoogle.call('/api/me');if(!me.profile.canManageUsers||me.profile.status!=='activo')throw Error('Esta cuenta no puede administrar permisos.');catalog=me.catalog;if(Array.isArray(catalog.capabilities)&&!catalog.capabilities.includes('publicarComunidad'))catalog.capabilities=[...catalog.capabilities,'publicarComunidad'];$('login').classList.add('hidden');$('panel').classList.remove('hidden');await load();}catch(e){$('status').textContent=e.message;}});
})();
