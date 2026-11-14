import {AccessError} from './policy.mjs';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const TIPOS=new Set(['Partido','Cambio','Suspension','Aviso']);

function validDate(value){
 const s=String(value||'').trim();
 if(!s)return null;
 if(!DATE_RE.test(s))throw new AccessError('VALIDACION','La fecha del evento debe tener formato AAAA-MM-DD.',400);
 const [y,m,d]=s.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));
 if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==m||dt.getUTCDate()!==d){
  throw new AccessError('VALIDACION','Fecha del evento inválida.',400);
 }
 return s;
}

function normalizeRpcError(err){
 if(err instanceof AccessError)return err;
 if(err?.code==='PERMISOS'||err?.code==='42501')return new AccessError('PERMISOS',err.message||'Sin permisos.',403);
 if(err?.code==='CONFLICTO'||err?.code==='PT409')return new AccessError('CONFLICTO',err.message||'Conflicto al guardar.',409);
 if(err?.code==='VALIDACION'||err?.code==='22023'||err?.code==='22007')return new AccessError('VALIDACION',err.message||'Datos inválidos.',400);
 return err;
}

async function runRpc(rpc,action,p){
 try{
  return await rpc('mc_comunidad',{p_action:action,p});
 }catch(err){
  throw normalizeRpcError(err);
 }
}

export async function handleComunidad({rpc,verify,notify},input){
 const path=input.path,d=input.body&&typeof input.body==='object'?input.body:{};
 if(path==='/api/comunidad/feed'){
  const res=await runRpc(rpc,'feed',{});
  return {ok:true,avisos:res?.avisos||[]};
 }

 const identity=await verify(input.token);

 if(path==='/api/comunidad/session'){
  const res=await runRpc(rpc,'session',identity);
  return {ok:true,...res};
 }

 if(path==='/api/comunidad/subscribe'){
  const actividad=String(d.actividad||'').trim();
  const categoria=String(d.categoria||'').trim();
  const equipo=String(d.equipo||'').trim();
  if(!actividad)throw new AccessError('VALIDACION','Elegí una actividad.',400);
  if(equipo&&!categoria)throw new AccessError('VALIDACION','Indicá una categoría cuando elegís un equipo.',400);
  const res=await runRpc(rpc,'subscribe',{...identity,actividad,categoria,equipo,canal_push:d.canal_push!==false});
  return {ok:true,...res};
 }

 if(path==='/api/comunidad/unsubscribe'){
  const id=String(d.id||'').trim();
  if(!UUID_RE.test(id))throw new AccessError('VALIDACION','Identificador de suscripción inválido.',400);
  const res=await runRpc(rpc,'unsubscribe',{...identity,id});
  return {ok:true,...res};
 }

 if(path==='/api/comunidad/device'){
  const token=String(d.token||'').trim();
  const plataforma=String(d.plataforma||'web').trim().slice(0,40)||'web';
  if(token.length<16||token.length>4096)throw new AccessError('VALIDACION','Token de dispositivo inválido.',400);
  const res=await runRpc(rpc,'register_device',{...identity,token,plataforma});
  return {ok:true,...res};
 }

 if(path==='/api/comunidad/publish'){
  const actividad=String(d.actividad||'').trim();
  const categoria=String(d.categoria||'').trim();
  const equipo=String(d.equipo||'').trim();
  const tipo=String(d.tipo||'Aviso').trim();
  const titulo=String(d.titulo||'').trim();
  const detalle=String(d.detalle||'').trim();
  const fecha_evento=validDate(d.fecha_evento);
  const hora_evento=String(d.hora_evento||'').trim().slice(0,40);
  const lugar=String(d.lugar||'').trim().slice(0,120);
  const urgente=Boolean(d.urgente);
  const enviar_notificacion=Boolean(d.enviar_notificacion);

  if(!actividad)throw new AccessError('VALIDACION','Elegí la actividad del aviso.',400);
  if(!TIPOS.has(tipo))throw new AccessError('VALIDACION','Tipo de aviso inválido.',400);
  if(equipo&&!categoria)throw new AccessError('VALIDACION','Indicá la categoría antes de filtrar por equipo.',400);
  if(titulo.length<3||titulo.length>160)throw new AccessError('VALIDACION','El título debe tener entre 3 y 160 caracteres.',400);
  if(detalle.length<3||detalle.length>2000)throw new AccessError('VALIDACION','El detalle debe tener entre 3 y 2000 caracteres.',400);

  const res=await runRpc(rpc,'publish',{
   ...identity,
   actividad,
   categoria,
   equipo,
   tipo,
   titulo,
   detalle,
   fecha_evento,
   hora_evento,
   lugar,
   urgente,
   enviar_notificacion
  });

  const aviso=res.aviso;
  const rawTargets=Array.isArray(res.destinatarios)?res.destinatarios:[];
  const seen=new Set();
  const targets=rawTargets.filter(t=>t?.token&&!seen.has(t.token)&&seen.add(t.token));
  const summary={requested:Boolean(aviso.enviar_notificacion),recipients:targets.length,sent:0,failed:0};

  if(aviso.enviar_notificacion&&targets.length>0){
   let enviados=[];
   let errores=[];
   try{
    if(typeof notify==='function'){
     const outcome=await notify({aviso,targets});
     enviados=Array.isArray(outcome?.sent)?outcome.sent:targets.map(t=>t.token);
     errores=Array.isArray(outcome?.failed)?outcome.failed:[];
    }else{
     errores=[{error:'FCM_NO_CONFIGURADO',count:targets.length}];
    }
   }catch(err){
    errores=[{error:err?.message||'ERROR_ENVIO_NOTIFICACION',count:targets.length}];
   }
   summary.sent=enviados.length;
   summary.failed=errores.length;
   try{
    await runRpc(rpc,'record_notifications',{...identity,id:aviso.id,enviados,errores});
   }catch(_){
    // No revertir ni bloquear la publicación confirmada si falla el registro del log de envío.
   }
  }

  return {ok:true,aviso,notifications:summary};
 }

 if(path==='/api/comunidad/deactivate'){
  const id=String(d.id||'').trim();
  if(!UUID_RE.test(id))throw new AccessError('VALIDACION','Identificador de aviso inválido.',400);
  const res=await runRpc(rpc,'deactivate',{...identity,id});
  return {ok:true,...res};
 }

 throw new AccessError('RUTA','Ruta inexistente.',404);
}
