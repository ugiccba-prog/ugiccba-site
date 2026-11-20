import {AccessError} from './policy.mjs';
import {summarizeSurvey} from './surveys.mjs';

const LIST_STATUS=new Set(['','activas','abierta','en_revision','intervenida','escalada','resuelta']);
const UPDATE_STATUS=new Set(['abierta','en_revision','intervenida','resuelta']);

function sanitizeActivities(raw,actorAreas){
 if(raw==null)return null;
 if(!Array.isArray(raw)||raw.length>100||raw.some(a=>typeof a!=='string'||!actorAreas.includes(a))){
  throw new AccessError('PERMISOS','Sólo podés consultar actividades autorizadas.');
 }
 return [...new Set(raw)];
}

function sanitizeCase(c){
 const metrics=c?.metrics&&typeof c.metrics==='object'?{...c.metrics}:{};
 if(Array.isArray(metrics.jugadores)){
  metrics.jugadoresCount=metrics.jugadores.length;
  delete metrics.jugadores;
 }
 const notes=Array.isArray(c?.notes)?c.notes.slice(-5).map(n=>({at:n.at,rol:n.rol||'',action:n.action,note:n.note||''})):[];
 return {
  activity:c.activity,
  categoria:c.categoria||'',
  equipo:c.equipo||'',
  rule_code:c.rule_code,
  severity:c.severity,
  status:c.status,
  title:c.title,
  summary:c.summary,
  due_at:c.due_at,
  metrics,
  notes
 };
}

function sanitizeSurveys(surveys){
 return (Array.isArray(surveys)?surveys:[]).map(s=>{
  const sum=summarizeSurvey(s);
  return {
   activity:sum.activity,
   categoria:sum.categoria||'',
   equipo:sum.equipo||'',
   title:sum.title,
   status:sum.status,
   responseCount:sum.responseCount||0,
   summary:(sum.summary||[]).map(q=>{
    if(q.type==='scale')return {label:q.label,avg:q.avg,count:q.count};
    if(q.type==='single'||q.type==='multi')return {label:q.label,counts:q.counts,count:q.count};
    return {label:q.label,count:q.count,texts:(q.texts||[]).slice(0,5)};
   })
  };
 });
}

function buildFallbackAnalysis(cases,surveys,single){
 if(!cases.length){
  return 'No hay alertas activas en las actividades seleccionadas. El monitoreo automático sigue operativo para caída de asistencia, ausencias consecutivas y semáforo.';
 }
 const escalated=cases.filter(c=>c.status==='escalada');
 const high=cases.filter(c=>c.severity==='alta');
 const rules=new Set(cases.map(c=>c.rule_code));
 const lines=[];
 if(single){
  const c=cases[0];
  lines.push(`• Diagnóstico: ${c.title} (${c.activity}${c.categoria?' · '+c.categoria:''}${c.equipo?' · '+c.equipo:''}). ${c.summary}`);
 }else{
  lines.push(`• Panorama activo: ${cases.length} alerta(s) (${escalated.length} escalada(s) +48 h, ${high.length} de prioridad alta).`);
 }
 if(rules.has('CAIDA_ASISTENCIA')){
  lines.push('• Caída de asistencia: verificá con el cuerpo docente cambios de horario, clima, competencia o superposición escolar y registrá la intervención antes de las 48 h.');
 }
 if(rules.has('AUSENCIAS_CONSECUTIVAS')){
  lines.push('• Ausencias consecutivas: coordiná un contacto breve y cercano con las familias de quienes acumulan 3+ faltas y activá un cuestionario anónimo de motivos de inasistencia.');
 }
 if(rules.has('SEMAFORO_ALERTA')){
  lines.push('• Semáforo en alerta: revisá el clima grupal, apoyos DUA y dinámica de clase junto al profe; un cuestionario anónimo de clima ayuda a detectar barreras tempranas.');
 }
 const withResp=surveys.filter(s=>(s.responseCount||0)>0);
 if(withResp.length){
  lines.push(`• Cuestionarios vinculados: ${withResp.length} cuestionario(s) ya cuentan con respuestas anónimas para cruzar con el seguimiento del grupo.`);
 }else{
  lines.push('• Cuestionarios: podés crear un cuestionario anónimo para el grupo y compartir el enlace por WhatsApp para escuchar al plantel sin barreras.');
 }
 return lines.join('\n');
}

function buildAiPrompt(cases,surveys,single){
 const cleanCases=cases.map(sanitizeCase);
 const cleanSurveys=sanitizeSurveys(surveys);
 const scope=single?'Analizá esta alerta puntual de Muni360':'Analizá las alertas activas de Muni360';
 return [
  'Sos asistente de coordinación deportiva y pedagógica de Muni360 (Club Ciudad de Buenos Aires, enfoque UGI y DUA).',
  `${scope} y redactá una recomendación breve, clara y accionable en español rioplatense (3 a 5 viñetas, máximo 180 palabras).`,
  'Incluí: (1) lectura rápida de prioridad/causa probable según métricas, (2) pasos concretos para el profe/coordinación y familias, (3) cuándo conviene usar un cuestionario anónimo.',
  'No inventes datos ni nombres propios; apoyate sólo en este JSON:',
  JSON.stringify({cases:cleanCases.slice(0,15),surveys:cleanSurveys.slice(0,8)})
 ].join('\n\n');
}

async function callGeminiEndpoints({apiKey,model,prompt}){
 const safeModel=encodeURIComponent(model||'gemini-2.5-flash');
 const encodedKey=encodeURIComponent(apiKey);
 const endpoints=[
  `https://aiplatform.googleapis.com/v1/publishers/google/models/${safeModel}:generateContent?key=${encodedKey}`,
  `https://generativelanguage.googleapis.com/v1beta/models/${safeModel}:generateContent?key=${encodedKey}`
 ];
 const payload=JSON.stringify({
  contents:[{role:'user',parts:[{text:prompt}]}],
  generationConfig:{temperature:0.25,maxOutputTokens:800}
 });
 for(const url of endpoints){
  try{
   const res=await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:payload,
    signal:AbortSignal.timeout(12000)
   });
   if(!res.ok)continue;
   const data=await res.json().catch(()=>null);
   const parts=data?.candidates?.[0]?.content?.parts;
   const text=Array.isArray(parts)
    ?parts.filter(p=>!p?.thought&&typeof p?.text==='string').map(p=>p.text).join('').trim()
    :'';
   if(text)return text;
  }catch(_){/* Fall back cleanly to next endpoint or deterministic assistant. */}
 }
 return '';
}

export async function handleInteligencia({actor,owner,path,body,rpc,now,aiGenerate}){
 if(actor.id!==owner&&!['Coordinación','Dirección UGI'].includes(actor.rol)){
  throw new AccessError('PERMISOS','El módulo de Inteligencia requiere autorización de Coordinación o Dirección.');
 }
 const nowIso=new Date(now).toISOString();

 if(path==='/api/inteligencia/list'){
  const status=body.status==null?'activas':String(body.status);
  if(!LIST_STATUS.has(status))throw new AccessError('VALIDACION','Estado de filtro inválido.',400);
  const activities=sanitizeActivities(body.activities,actor.areas);
  return rpc('mc_inteligencia',{p_action:'list',p:{uid:actor.id,status,activities,now:nowIso}});
 }

 if(path==='/api/inteligencia/scan'){
  const activity=typeof body.activity==='string'?body.activity:'';
  if(!activity||!actor.areas.includes(activity)){
   throw new AccessError('PERMISOS','Sólo podés analizar actividades autorizadas.');
  }
  return rpc('mc_inteligencia',{p_action:'scan',p:{uid:actor.id,activity,now:nowIso}});
 }

 if(path==='/api/inteligencia/update'){
  const caseId=typeof body.caseId==='string'?body.caseId.trim():'';
  const status=typeof body.status==='string'?body.status:'';
  const note=typeof body.note==='string'?body.note.slice(0,500):'';
  if(!caseId)throw new AccessError('VALIDACION','Falta el identificador del caso.',400);
  if(!UPDATE_STATUS.has(status))throw new AccessError('VALIDACION','Estado inválido.',400);
  return rpc('mc_inteligencia',{p_action:'update',p:{uid:actor.id,caseId,status,note,now:nowIso}});
 }

 if(path==='/api/inteligencia/ai'){
  const caseId=typeof body.caseId==='string'?body.caseId.trim():'';
  const activities=sanitizeActivities(body.activities,actor.areas);
  const ctx=await rpc('mc_inteligencia',{p_action:'ai_context',p:{uid:actor.id,caseId:caseId||null,activities,now:nowIso}});
  const cases=Array.isArray(ctx?.cases)?ctx.cases:[];
  const surveys=Array.isArray(ctx?.surveys)?ctx.surveys:[];
  const apiKey=typeof ctx?.apiKey==='string'?ctx.apiKey.trim():'';
  const model=typeof ctx?.model==='string'&&ctx.model.trim()?ctx.model.trim():'gemini-2.5-flash';
  const fallback=buildFallbackAnalysis(cases,surveys,Boolean(caseId));
  if(!cases.length)return {ok:true,analysis:fallback,source:'asistente'};
  const prompt=buildAiPrompt(cases,surveys,Boolean(caseId));
  let text='';
  if(typeof aiGenerate==='function'){
   try{text=String(await aiGenerate({prompt,model,apiKey,cases:cases.map(sanitizeCase),surveys:sanitizeSurveys(surveys)})||'').trim();}catch(_){text='';}
  }else if(apiKey){
   text=await callGeminiEndpoints({apiKey,model,prompt});
  }
  if(text)return {ok:true,analysis:text,source:'ia',model};
  return {ok:true,analysis:fallback,source:'asistente'};
 }

 throw new AccessError('RUTA','Ruta de Inteligencia inexistente.',404);
}
