import {AccessError} from './policy.mjs';

const Q_TYPES=new Set(['scale','single','multi','text']);
const STATUS_SET=new Set(['draft','active','closed']);

function validateQuestions(questions){
 if(!Array.isArray(questions)||questions.length<1||questions.length>20){
  throw new AccessError('VALIDACION','La encuesta debe tener entre 1 y 20 preguntas.',400);
 }
 return questions.map((q,idx)=>{
  if(!q||typeof q!=='object')throw new AccessError('VALIDACION','Pregunta inválida.',400);
  const type=String(q.type||'');
  if(!Q_TYPES.has(type))throw new AccessError('VALIDACION','Tipo de pregunta inválido.',400);
  const label=String(q.label||'').trim().slice(0,200);
  if(!label)throw new AccessError('VALIDACION','Todas las preguntas deben tener texto.',400);
  const id=String(q.id||('q'+(idx+1))).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32)||('q'+(idx+1));
  const out={id,type,label,required:Boolean(q.required)};
  if(type==='single'||type==='multi'){
   const opts=Array.isArray(q.options)?q.options.map(o=>String(o||'').trim().slice(0,100)).filter(Boolean):[];
   if(opts.length<2||opts.length>12)throw new AccessError('VALIDACION','Las preguntas de opciones deben tener entre 2 y 12 opciones.',400);
   out.options=opts;
  }
  return out;
 });
}

function summarizeSurvey(survey){
 const questions=Array.isArray(survey.questions)?survey.questions:[];
 const responses=Array.isArray(survey.responses)?survey.responses:[];
 const summary=questions.map(q=>{
  if(q.type==='scale'){
   const dist={1:0,2:0,3:0,4:0,5:0};
   let sum=0,count=0;
   for(const r of responses){
    const n=Number(r?.[q.id]);
    if(Number.isInteger(n)&&n>=1&&n<=5){dist[n]++;sum+=n;count++;}
   }
   return {id:q.id,type:q.type,label:q.label,count,avg:count?Math.round((sum/count)*100)/100:null,distribution:dist};
  }
  if(q.type==='single'||q.type==='multi'){
   const counts={};
   for(const opt of q.options||[])counts[opt]=0;
   let count=0;
   for(const r of responses){
    const val=r?.[q.id];
    const picked=q.type==='multi'?(Array.isArray(val)?val:[]): (typeof val==='string'&&val?[val]:[]);
    let any=false;
    for(const p of picked){if(p in counts){counts[p]++;any=true;}}
    if(any)count++;
   }
   return {id:q.id,type:q.type,label:q.label,count,counts};
  }
  const texts=[];
  for(const r of responses){
   const t=typeof r?.[q.id]==='string'?r[q.id].trim():'';
   if(t)texts.push(t);
  }
  return {id:q.id,type:q.type,label:q.label,count:texts.length,texts:texts.slice(0,100)};
 });
 const {responses:_,...rest}=survey;
 return {...rest,summary};
}

export async function handlePublicSurveys({path,body,rpc,now}){
 const nowIso=new Date(now).toISOString();
 if(path==='/api/surveys/public'){
  const code=typeof body.code==='string'?body.code.trim():'';
  if(!/^[a-zA-Z0-9_-]{6,32}$/.test(code))throw new AccessError('VALIDACION','Código de encuesta inválido.',400);
  return rpc('mc_surveys',{p_action:'public_get',p:{code,now:nowIso}});
 }
 if(path==='/api/surveys/submit'){
  const code=typeof body.code==='string'?body.code.trim():'';
  if(!/^[a-zA-Z0-9_-]{6,32}$/.test(code))throw new AccessError('VALIDACION','Código de encuesta inválido.',400);
  const raw=body.answers;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new AccessError('VALIDACION','Respuestas inválidas.',400);
  const entries=Object.entries(raw);
  if(entries.length>20)throw new AccessError('VALIDACION','Demasiadas respuestas.',400);
  const answers={};
  for(const [k,v] of entries){
   const key=String(k).slice(0,32);
   if(typeof v==='number')answers[key]=v;
   else if(typeof v==='string')answers[key]=v.trim().slice(0,500);
   else if(Array.isArray(v))answers[key]=v.slice(0,12).map(x=>String(x).trim().slice(0,100));
  }
  return rpc('mc_surveys',{p_action:'public_submit',p:{code,answers,now:nowIso}});
 }
 throw new AccessError('RUTA','Ruta de encuesta inexistente.',404);
}

export async function handleSurveys({actor,owner,path,body,rpc,now}){
 if(actor.id!==owner&&!['Coordinación','Dirección UGI'].includes(actor.rol)){
  throw new AccessError('PERMISOS','Este módulo requiere autorización de Coordinación o Dirección.');
 }
 const nowIso=new Date(now).toISOString();

 if(path==='/api/surveys/list'){
  const activity=typeof body.activity==='string'?body.activity:'';
  if(activity&&!actor.areas.includes(activity))throw new AccessError('PERMISOS','Actividad no autorizada.');
  const res=await rpc('mc_surveys',{p_action:'list',p:{uid:actor.id,activity,now:nowIso}});
  return {ok:true,surveys:(res.surveys||[]).map(summarizeSurvey)};
 }

 if(path==='/api/surveys/create'){
  const activity=typeof body.activity==='string'?body.activity:'';
  if(!activity||!actor.areas.includes(activity))throw new AccessError('PERMISOS','No tenés acceso a esa actividad.');
  const title=String(body.title||'').trim();
  if(!title)throw new AccessError('VALIDACION','Ingresá un título para la encuesta.',400);
  const questions=validateQuestions(body.questions);
  const status=body.status==='draft'?'draft':'active';
  return rpc('mc_surveys',{p_action:'create',p:{
   uid:actor.id,
   activity,
   categoria:String(body.categoria||'').trim().slice(0,80),
   equipo:String(body.equipo||'').trim().slice(0,80),
   title:title.slice(0,120),
   description:String(body.description||'').trim().slice(0,400),
   questions,
   status,
   now:nowIso
  }});
 }

 if(path==='/api/surveys/status'){
  const surveyId=typeof body.surveyId==='string'?body.surveyId.trim():'';
  const status=typeof body.status==='string'?body.status:'';
  if(!surveyId)throw new AccessError('VALIDACION','Falta el identificador de encuesta.',400);
  if(!STATUS_SET.has(status))throw new AccessError('VALIDACION','Estado inválido.',400);
  return rpc('mc_surveys',{p_action:'set_status',p:{uid:actor.id,surveyId,status,now:nowIso}});
 }

 throw new AccessError('RUTA','Ruta de encuestas inexistente.',404);
}
