const $=id=>document.getElementById(id),config=window.MUNI_PILOT_CONFIG;
let sdk,auth,client,profile,snapshot,dirty=false,busy=false,displayedPendingId=null;
function message(t,error=false){$('message').textContent=t;$('message').className=error?'error':'';}
function metrics(){if(!client)return;const calls=client.metrics.map(m=>({...m,ms:Math.round(m.ms)}));$('metrics').textContent=JSON.stringify(calls,null,2);}
function pending(){const p=client?.pending();$('pending').classList.toggle('hidden',!p);displayedPendingId=p?.args.p_request||null;$('pending-data').textContent=p?JSON.stringify(p.args,null,2):'';}
function lock(on){busy=on;for(const el of document.querySelectorAll('#app button,#app select,#app input'))el.disabled=on;}
async function action(fn){if(busy)return;lock(true);try{await fn();}catch(e){message(e.message,true);}finally{lock(false);if(profile?.role==='Consulta')for(const el of document.querySelectorAll('#roster select,#roster input,#save,#all,#climate,#points'))el.disabled=true;pending();metrics();}}
function render(){const root=$('roster');root.replaceChildren();for(const row of snapshot.rows){const line=document.createElement('div');line.className='row';const name=document.createElement('span');name.textContent=row.name;line.append(name);
  for(const [key,options,label] of [['state',[['N','—'],['P','P'],['A','A'],['T','T']],'Asistencia'],['semaphore',[['N','—'],['V','Verde'],['A','Amarillo'],['R','Rojo']],'Semáforo']]){const s=document.createElement('select');s.setAttribute('aria-label',label+' de '+row.name);for(const [value,title] of options){const o=new Option(title,value);s.append(o);}s.value=row[key];s.onchange=()=>{row[key]=s.value;if(row.state==='A')row.food=false;dirty=true;if(key==='state'&&snapshot.activity==='Colonia')render();};line.append(s);}
  if(snapshot.activity==='Colonia'){const label=document.createElement('label');label.className='food';const box=document.createElement('input');box.type='checkbox';box.checked=row.food;box.disabled=row.state==='A'||profile.role==='Consulta';box.onchange=()=>{row.food=box.checked;dirty=true;};label.append(box,document.createTextNode(' Comida'));line.append(label);}root.append(line);}
  $('climate').value=snapshot.climate;$('points').value=snapshot.points??'';
}
async function load(){if(dirty&&!confirm('Hay cambios sin guardar. ¿Querés reemplazarlos por los datos confirmados?'))return;snapshot=await client.read($('group').value,$('day').value);dirty=false;render();message('Grupo abierto. Revisión '+snapshot.revision+'.');}
async function setup(){
  if(!config?.url||!config.publishableKey||!config.firebase?.projectId){message('El piloto está preparado. Falta configurar el proyecto Supabase y el acceso Google; no se conectó al ensayo actual.');$('login').disabled=true;return;}
  const [app,mod]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js')]);sdk=mod;auth=mod.getAuth(app.initializeApp(config.firebase,'muni360-supabase-pilot'));await mod.setPersistence(auth,mod.browserSessionPersistence);
  mod.onAuthStateChanged(auth,async user=>{if(!user){client=null;profile=null;snapshot=null;dirty=false;$('app').classList.add('hidden');$('logout').classList.add('hidden');$('login').classList.remove('hidden');$('identity').textContent='';return;}
    try{client=new MuniPilot.Client({url:config.url,key:config.publishableKey,uid:user.uid,storage:localStorage,getToken:async expected=>{if(auth.currentUser?.uid!==expected)throw Error('Cambió la cuenta. Volvé a ingresar.');return auth.currentUser.getIdToken();}});profile=await client.rpc('mp_profile');const groups=await client.rpc('mp_groups');$('group').replaceChildren(...groups.map(g=>new Option(g.activity+' · '+g.label,g.id)));$('identity').textContent=profile.name+' · '+profile.role;$('app').classList.remove('hidden');$('logout').classList.remove('hidden');$('login').classList.add('hidden');pending();if(groups.length)await action(load);else message('La cuenta no tiene grupos habilitados en este piloto.');}catch(e){message(e.message,true);}
  });
}
$('day').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
$('login').onclick=()=>sdk&&sdk.signInWithPopup(auth,new sdk.GoogleAuthProvider()).catch(e=>message(e.message,true));
$('logout').onclick=()=>{if(dirty&&!confirm('Hay cambios sin guardar. ¿Salir?'))return;sdk.signOut(auth).catch(e=>message(e.message,true));};
$('load').onclick=()=>action(load);
$('all').onclick=()=>{if(!snapshot)return;for(const r of snapshot.rows)r.state='P';dirty=true;render();};
$('climate').onchange=()=>{snapshot.climate=$('climate').value;dirty=true;};$('points').oninput=()=>{snapshot.points=$('points').value===''?null:Number($('points').value);dirty=true;};
$('save').onclick=()=>action(async()=>{if(!snapshot||!dirty)return message('No hay cambios nuevos para guardar.');const result=await client.save(snapshot,snapshot.rows);snapshot.revision=result.revision;dirty=false;message('Guardado confirmado en la base. Copia a Sheets pendiente de verificación.');});
$('retry').onclick=()=>action(async()=>{const result=await client.retry();if(result){message('La carga quedó confirmada. Copia a Sheets pendiente.');if(snapshot?.group_id===result.group_id){dirty=false;await load();}}});
$('discard').onclick=()=>action(async()=>{const id=displayedPendingId;if(!id||!confirm('¿Descartar esta carga del dispositivo? Si ya llegó al servidor, no se borra de la base.'))return;await client.discard(id);message('Pendiente descartado del dispositivo. Revisá los datos confirmados.');});
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({pilot:'supabase-attendance',measuredAt:new Date().toISOString(),calls:client.metrics},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='muni360-piloto-mediciones.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('benchmark-read').onclick=()=>action(async()=>{if(!snapshot||dirty||client.pending())return message('Primero guardá o revisá los cambios pendientes.');for(let i=0;i<20;i++)await client.read(snapshot.group_id,snapshot.day);message('Veinte aperturas medidas. Descargá los tiempos para compararlos.');});
$('benchmark-write').onclick=()=>action(async()=>{
  if(!snapshot||dirty||client.pending()||profile.role==='Consulta')return message('La prueba requiere acceso de escritura y ninguna carga pendiente.');
  if(!confirm('Solo en este piloto ficticio: se enviarán veinte cargas sobre la misma revisión. Debe confirmarse una y rechazarse las otras por conflicto. ¿Continuar?'))return;
  const s=await client.read(snapshot.group_id,snapshot.day),args={p_group:s.group_id,p_day:s.day,p_season:s.season,p_roster_revision:s.roster_revision,p_revision:s.revision,p_rows:s.rows.map(({id,state,semaphore,food})=>({id,state,semaphore,food})),p_climate:s.climate,p_points:s.points};
  const result=await Promise.allSettled(Array.from({length:20},()=>client.rpc('mp_save_attendance',{...args,p_request:crypto.randomUUID()})));
  const ok=result.filter(x=>x.status==='fulfilled').length,conflicts=result.filter(x=>x.status==='rejected'&&x.reason.code==='CONFLICTO').length;
  snapshot=await client.read(s.group_id,s.day);render();message('Peticiones simultáneas: '+ok+' confirmadas, '+conflicts+' conflictos y '+(20-ok-conflicts)+' sin otro resultado confirmado. Las solicitudes de esta prueba no se reenvían automáticamente.');
});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('online',()=>{if(client?.pending())message('Volvió la conexión. Podés reintentar la carga pendiente conservando su identificador.');});
setup().catch(e=>message(e.message,true));
