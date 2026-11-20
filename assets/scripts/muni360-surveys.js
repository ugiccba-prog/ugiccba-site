(function(){
 'use strict';
 let identity='',generation=0,activePrefill=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const STATUS_LABELS={draft:'Borrador',active:'Activa',closed:'Cerrada'};
 const TYPE_LABELS={scale:'Escala 1–5',single:'Opción única',multi:'Opción múltiple',text:'Texto breve'};
 const TEMPLATES={
  clima:{
   title:'Clima y bienestar del grupo',
   description:'Encuesta 100% anónima para conocer cómo te sentís entrenando en el club.',
   questions:[
    {id:'q1',type:'scale',label:'¿Cómo te sentís con el grupo y tus compañeros/as?',required:true},
    {id:'q2',type:'scale',label:'¿Qué tan cómodo/a te sentís con el cuerpo técnico?',required:true},
    {id:'q3',type:'scale',label:'¿Te resultan cómodos los días y horarios de entrenamiento?',required:true},
    {id:'q4',type:'text',label:'¿Qué mejorarías o qué te gustaría sumar este mes?',required:false}
   ]
  },
  ausencias:{
   title:'Motivos de inasistencia',
   description:'Contanos de forma anónima si algo te dificulta venir a entrenar.',
   questions:[
    {id:'q1',type:'multi',label:'Si faltaste en las últimas semanas, ¿por qué fue?',options:['Horarios de estudio/trabajo','Transporte o distancia','Cansancio o lesión','Clima','Motivos personales','No falté'],required:true},
    {id:'q2',type:'scale',label:'¿Cuántas ganas tenés de seguir viniendo este año?',required:true},
    {id:'q3',type:'text',label:'¿Hay algo en lo que el club o el profe pueda ayudarte?',required:false}
   ]
  },
  cierre:{
   title:'Balance de etapa',
   description:'Tu opinión anónima nos ayuda a planificar la próxima temporada.',
   questions:[
    {id:'q1',type:'scale',label:'En general, ¿cómo evaluás tu experiencia en esta etapa?',required:true},
    {id:'q2',type:'single',label:'¿Pensás continuar en la actividad el próximo período?',options:['Sí, seguro','Todavía no lo sé','Probablemente no'],required:true},
    {id:'q3',type:'text',label:'¿Qué fue lo mejor y qué cambiarías?',required:false}
   ]
  }
 };

 function surveyUrl(code){
  const base=location.origin&&location.origin!=='null'?location.origin+'/muni360/encuesta/':'https://ugiccba.com.ar/muni360/encuesta/';
  return base+'?c='+encodeURIComponent(code);
 }

 window.MuniSurveys={mount(session){
  const allowed=session&&session.modoDemo!==true&&(session.canManageUsers||['Coordinación','Dirección UGI'].includes(session.rol));
  const key=allowed?JSON.stringify([session.usuario,session.rol,session.areas,session.canManageUsers]):'';
  if(identity===key)return;
  identity=key;
  generation++;
  document.getElementById('surveys-panel')?.remove();
  activePrefill=null;
  if(!allowed)return;

  const areas=Array.isArray(session.areas)?session.areas:[];
  const box=document.createElement('details');
  box.id='surveys-panel';
  box.className='card muni-surveys';
  box.innerHTML=
   '<summary><strong>Cuestionarios anónimos (Jugadores/as)</strong><span>Armá encuestas livianas por actividad o grupo y mirá respuestas desde la primera carga</span></summary>'+
   '<div class="ms-content">'+
    '<div class="ms-builder">'+
     '<h4>Nuevo cuestionario anónimo</h4>'+
     '<div class="ms-templates"><span>Plantillas rápidas:</span>'+
      '<button type="button" data-tpl="clima">Clima del grupo</button>'+
      '<button type="button" data-tpl="ausencias">Motivos de inasistencia</button>'+
      '<button type="button" data-tpl="cierre">Balance de etapa</button>'+
     '</div>'+
     '<div class="ms-form-grid">'+
      '<label>Actividad<select id="ms-activity">'+areas.map(a=>'<option value="'+esc(a)+'">'+esc(a)+'</option>').join('')+'</select></label>'+
      '<label>Categoría (opcional)<input id="ms-categoria" type="text" maxlength="80" placeholder="Ej: U13 (vacío = toda)"></label>'+
      '<label>Equipo / Tira (opcional)<input id="ms-equipo" type="text" maxlength="80" placeholder="Ej: A (vacío = todos)"></label>'+
     '</div>'+
     '<label>Título<input id="ms-title" type="text" maxlength="120" placeholder="Ej: Encuesta de clima · U13"></label>'+
     '<label>Descripción breve (opcional)<input id="ms-desc" type="text" maxlength="400" placeholder="Texto de bienvenida para jugadores/as"></label>'+
     '<div id="ms-questions" class="ms-questions"></div>'+
     '<div class="ms-builder-actions">'+
      '<button type="button" id="ms-add-q">+ Agregar pregunta</button>'+
      '<button type="button" id="ms-create" class="ms-primary">Crear y activar enlace</button>'+
     '</div>'+
    '</div>'+
    '<p id="ms-status" role="status">Abrí el panel para ver o crear cuestionarios.</p>'+
    '<div id="ms-list" class="ms-list"></div>'+
   '</div>';

  const appScreen=document.getElementById('app-screen');
  const anchor=document.getElementById('inteligencia-panel')||document.getElementById('management-panel');
  if(anchor&&anchor.parentNode===appScreen)anchor.after(box);
  else appScreen.prepend(box);

  const local=generation,find=id=>box.querySelector('#'+id);
  let draftQuestions=[{id:'q1',type:'scale',label:'¿Cómo te sentís con los entrenamientos?',options:[],required:true}];
  let loaded=false;

  function renderDraftQuestions(){
   const container=find('ms-questions');
   container.innerHTML=draftQuestions.map((q,i)=>
    '<div class="ms-q-row" data-idx="'+i+'">'+
     '<div class="ms-q-head"><strong>Pregunta '+(i+1)+'</strong>'+
      (draftQuestions.length>1?'<button type="button" class="ms-q-del" data-idx="'+i+'">Quitar</button>':'')+
     '</div>'+
     '<div class="ms-q-fields">'+
      '<input type="text" class="ms-q-label" data-idx="'+i+'" maxlength="200" value="'+esc(q.label)+'" placeholder="Escribí la pregunta">'+
      '<select class="ms-q-type" data-idx="'+i+'">'+
       Object.entries(TYPE_LABELS).map(([k,v])=>'<option value="'+k+'"'+(q.type===k?' selected':'')+'>'+esc(v)+'</option>').join('')+
      '</select>'+
      '<label class="ms-q-req"><input type="checkbox" class="ms-q-req-cb" data-idx="'+i+'"'+(q.required?' checked':'')+'> Obligatoria</label>'+
     '</div>'+
     ((q.type==='single'||q.type==='multi')
      ?'<input type="text" class="ms-q-opts" data-idx="'+i+'" value="'+esc((q.options||[]).join(', '))+'" placeholder="Opciones separadas por coma (ej: Horario, Transporte, Lesión)">'
      :'')+
    '</div>'
   ).join('');

   container.querySelectorAll('.ms-q-label').forEach(el=>el.oninput=()=>{draftQuestions[Number(el.dataset.idx)].label=el.value;});
   container.querySelectorAll('.ms-q-type').forEach(el=>el.onchange=()=>{
    const q=draftQuestions[Number(el.dataset.idx)];
    q.type=el.value;
    if((q.type==='single'||q.type==='multi')&&(!q.options||q.options.length<2))q.options=['Opción 1','Opción 2'];
    renderDraftQuestions();
   });
   container.querySelectorAll('.ms-q-req-cb').forEach(el=>el.onchange=()=>{draftQuestions[Number(el.dataset.idx)].required=el.checked;});
   container.querySelectorAll('.ms-q-opts').forEach(el=>el.oninput=()=>{
    draftQuestions[Number(el.dataset.idx)].options=el.value.split(',').map(x=>x.trim()).filter(Boolean);
   });
   container.querySelectorAll('.ms-q-del').forEach(el=>el.onclick=()=>{
    draftQuestions.splice(Number(el.dataset.idx),1);
    renderDraftQuestions();
   });
  }

  renderDraftQuestions();

  function applyTemplate(tplKey){
   const tpl=TEMPLATES[tplKey];
   if(!tpl)return;
   find('ms-title').value=tpl.title;
   find('ms-desc').value=tpl.description;
   draftQuestions=tpl.questions.map(q=>({...q,options:q.options?[...q.options]:[]}));
   renderDraftQuestions();
  }

  box.querySelectorAll('[data-tpl]').forEach(btn=>{
   btn.onclick=()=>applyTemplate(btn.dataset.tpl);
  });

  activePrefill=({activity,categoria='',equipo='',template='ausencias'}={})=>{
   box.open=true;
   if(!loaded){loaded=true;loadList();}
   const actSel=find('ms-activity');
   if(activity&&[...actSel.options].some(o=>o.value===activity))actSel.value=activity;
   find('ms-categoria').value=categoria||'';
   find('ms-equipo').value=equipo||'';
   applyTemplate(TEMPLATES[template]?template:'ausencias');
   box.scrollIntoView({behavior:'smooth',block:'start'});
  };

  find('ms-add-q').onclick=()=>{
   if(draftQuestions.length>=20)return;
   draftQuestions.push({id:'q'+(draftQuestions.length+1),type:'scale',label:'',options:[],required:false});
   renderDraftQuestions();
  };

  box.addEventListener('toggle',()=>{if(box.open&&!loaded){loaded=true;loadList();}});

  find('ms-create').onclick=async()=>{
   const btn=find('ms-create');
   btn.disabled=true;
   find('ms-status').textContent='Guardando encuesta…';
   try{
    const questions=draftQuestions.map((q,i)=>({...q,id:'q'+(i+1)}));
    await MuniGoogle.call('/api/surveys/create',{
     activity:find('ms-activity').value,
     categoria:find('ms-categoria').value,
     equipo:find('ms-equipo').value,
     title:find('ms-title').value,
     description:find('ms-desc').value,
     questions,
     status:'active'
    });
    if(local!==generation||!box.isConnected)return;
    find('ms-title').value='';
    find('ms-desc').value='';
    find('ms-status').textContent='Encuesta creada y activada.';
    await loadList();
   }catch(e){
    if(local===generation)find('ms-status').textContent=e.message||'No se pudo crear la encuesta.';
   }finally{
    if(box.isConnected)btn.disabled=false;
   }
  };

  function renderSummary(s){
   if(!s.responseCount)return '<p class="ms-no-resp">Todavía no hay respuestas.</p>';
   return '<div class="ms-results">'+s.summary.map(q=>{
    if(q.type==='scale'){
     const dist=Object.entries(q.distribution||{}).map(([k,v])=>k+'★:'+v).join(' · ');
     return '<div class="ms-res-item"><strong>'+esc(q.label)+'</strong><span>Promedio: <b>'+(q.avg==null?'—':q.avg+' / 5')+'</b> ('+q.count+' resp.) · '+esc(dist)+'</span></div>';
    }
    if(q.type==='single'||q.type==='multi'){
     const opts=Object.entries(q.counts||{}).map(([k,v])=>esc(k)+': <b>'+v+'</b>').join(' · ');
     return '<div class="ms-res-item"><strong>'+esc(q.label)+'</strong><span>'+opts+'</span></div>';
    }
    const texts=(q.texts||[]).map(t=>'<li>'+esc(t)+'</li>').join('');
    return '<div class="ms-res-item"><strong>'+esc(q.label)+' ('+q.count+' textos)</strong>'+(texts?'<ul>'+texts+'</ul>':'<span>Sin respuestas de texto.</span>')+'</div>';
   }).join('')+'</div>';
  }

  async function loadList(){
   find('ms-status').textContent='Cargando cuestionarios…';
   try{
    const r=await MuniGoogle.call('/api/surveys/list',{});
    if(local!==generation||!box.isConnected)return;
    const surveys=r.surveys||[];
    find('ms-status').textContent='Total de cuestionarios: '+surveys.length;
    const list=find('ms-list');
    if(!surveys.length){list.innerHTML='<p class="ms-no-resp">Todavía no creaste cuestionarios.</p>';return;}
    list.innerHTML=surveys.map(s=>{
     const url=surveyUrl(s.public_code);
     const nextStatus=s.status==='active'?'closed':'active';
     const nextLabel=s.status==='active'?'Cerrar':'Activar';
     return '<article class="ms-card" data-id="'+esc(s.id)+'">'+
      '<header>'+
       '<div><span class="ms-badge ms-badge-'+esc(s.status)+'">'+esc(STATUS_LABELS[s.status]||s.status)+'</span> <strong>'+esc(s.title)+'</strong></div>'+
       '<span class="ms-resp-count">'+s.responseCount+' respuesta(s)</span>'+
      '</header>'+
      '<p class="ms-meta">'+esc(s.activity)+(s.categoria?' · '+esc(s.categoria):'')+(s.equipo?' · '+esc(s.equipo):'')+'</p>'+
      '<div class="ms-link-row">'+
       '<input type="text" readonly value="'+esc(url)+'" aria-label="Enlace público">'+
       '<button type="button" class="ms-copy" data-url="'+esc(url)+'">Copiar enlace</button>'+
       '<button type="button" class="ms-toggle" data-id="'+esc(s.id)+'" data-next="'+nextStatus+'">'+nextLabel+'</button>'+
      '</div>'+
      '<details><summary>Ver resultados ('+s.responseCount+')</summary>'+renderSummary(s)+'</details>'+
     '</article>';
    }).join('');

    list.querySelectorAll('.ms-copy').forEach(btn=>btn.onclick=async()=>{
     try{await navigator.clipboard.writeText(btn.dataset.url);btn.textContent='¡Copiado!';setTimeout(()=>btn.textContent='Copiar enlace',1500);}
     catch(_){btn.previousElementSibling?.select();}
    });
    list.querySelectorAll('.ms-toggle').forEach(btn=>btn.onclick=async()=>{
     btn.disabled=true;
     try{await MuniGoogle.call('/api/surveys/status',{surveyId:btn.dataset.id,status:btn.dataset.next});await loadList();}
     catch(e){find('ms-status').textContent=e.message||'No se pudo cambiar el estado.';btn.disabled=false;}
    });
   }catch(e){
    if(local===generation){loaded=false;find('ms-status').textContent=e.message||'No se pudieron cargar los cuestionarios.';}
   }
  }
 },
 prefill(opts){
  if(typeof activePrefill==='function')activePrefill(opts);
 }};

 const style=document.createElement('style');
 style.textContent=
  '.muni-surveys{border-top:4px solid #0d9488;margin-bottom:18px}'+
  '.muni-surveys>summary{cursor:pointer;display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center}'+
  '.muni-surveys>summary strong{font-size:1.15rem;color:#0b2545}'+
  '.muni-surveys>summary span{color:#526477;font-size:.85rem}'+
  '.ms-content{padding-top:16px}'+
  '.ms-builder{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:14px}'+
  '.ms-builder h4{margin:0 0 10px;color:#0b2545}'+
  '.ms-templates{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;font-size:.82rem;color:#475569}'+
  '.ms-templates button,.ms-builder-actions button,.ms-link-row button{border:1px solid #cbd5e1;border-radius:8px;padding:7px 11px;background:#fff;color:#0f172a;font:600 .78rem Inter,Arial,sans-serif;cursor:pointer}'+
  '.ms-builder-actions .ms-primary{background:#0f766e;color:#fff;border-color:#0f766e}'+
  '.ms-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:8px}'+
  '.ms-questions{display:grid;gap:8px;margin:10px 0}'+
  '.ms-q-row{background:#fff;border:1px solid #dce5ee;border-radius:10px;padding:10px}'+
  '.ms-q-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:.82rem}'+
  '.ms-q-fields{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'+
  '.ms-q-label{flex:1 1 240px}'+
  '.ms-q-type{flex:0 0 160px}'+
  '.ms-q-req{display:flex;align-items:center;gap:5px;font-size:.8rem;margin:0}'+
  '.ms-q-req input{width:auto;margin:0}'+
  '.ms-q-opts{margin-top:6px;width:100%}'+
  '.ms-builder-actions{display:flex;gap:8px;flex-wrap:wrap}'+
  '.ms-list{display:grid;gap:12px;margin-top:12px}'+
  '.ms-card{border:1px solid #dce5ee;border-radius:12px;padding:14px;background:#fff}'+
  '.ms-card header{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}'+
  '.ms-badge{font-size:.72rem;font-weight:700;padding:3px 8px;border-radius:999px;background:#e2e8f0;color:#334155}'+
  '.ms-badge-active{background:#dcfce7;color:#166534}'+
  '.ms-badge-closed{background:#fee2e2;color:#991b1b}'+
  '.ms-meta,.ms-no-resp,.ms-resp-count{font-size:.82rem;color:#526477;margin:6px 0}'+
  '.ms-link-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}'+
  '.ms-link-row input{flex:1 1 220px;font-size:.8rem;background:#f8fafc}'+
  '.ms-results{display:grid;gap:8px;padding-top:8px}'+
  '.ms-res-item{background:#f8fafc;border-radius:8px;padding:9px;font-size:.84rem}'+
  '.ms-res-item strong{display:block;color:#0b2545;margin-bottom:4px}'+
  '.ms-res-item ul{margin:4px 0 0 18px;padding:0}';
 document.head.append(style);
})();
