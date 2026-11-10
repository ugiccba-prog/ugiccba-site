'use strict';
const {AccessError,actorFrom,authorize,validateAccess,ROLES,CAPS}=require('./policy.cjs');
function createService({auth,store,operations,staging,areas,ownerUid,now=()=>Date.now()}) {
  if (!ownerUid || !areas.length) throw Error('Falta configurar el propietario y las actividades.');
  return async function handle({authorization,path,body={}}) {
    if (!/^Bearer [^\s]+$/.test(authorization||'')) throw new AccessError('SESION','Ingresá con Google.',401);
    let identity;
    try { identity=await auth.verifyIdToken(authorization.slice(7),true); } catch(_) {throw new AccessError('SESION','Sesión de Google inválida o revocada.',401);}
    if (!identity.uid || typeof identity.email!=='string' || identity.email_verified!==true || identity.firebase?.sign_in_provider!=='google.com') throw new AccessError('SESION','Usá una cuenta de Google verificada.',401);
    let record=await store.ensureUser(identity,ownerUid,areas);
    if(path==='/api/me') {
      let actor=null;try {actor=actorFrom(record,areas,now());}catch(_){}
      return {ok:true,apiVersion:2,profile:{uid:identity.uid,nombre:record.nombre,email:record.email,status:actor?'activo':record.status==='activo'?'vencido':record.status,expiresAt:record.expiresAt||null,rol:record.rol,areas:actor?.areas||[],capabilities:actor?.capabilities||{},version:record.version,canManageUsers:identity.uid===ownerUid},catalog:{areas,roles:ROLES,capabilities:CAPS}};
    }
    if(path==='/api/users/list' || path==='/api/users/update' || path==='/api/users/history') {
      // La propiedad se fija fuera del panel. Nadie puede autoasignarse el control de permisos.
      const actor=actorFrom(record,areas,now());
      if(identity.uid!==ownerUid)throw new AccessError('PERMISOS','Sólo el propietario administra los accesos.');
      if(path==='/api/users/list')return {ok:true,apiVersion:2,...await store.listUsers(body.cursor||null)};
      if(path==='/api/users/history')return {ok:true,apiVersion:2,events:await store.permissionHistory()};
      if (typeof body.uid!=='string'||!body.uid||body.uid.length>128||body.uid.includes('/'))throw new AccessError('VALIDACION','Usuario inválido.',400);
      if(body.uid===ownerUid)throw new AccessError('PERMISOS','El propietario se administra desde la configuración del servicio.');
      const access=validateAccess(body,areas);
      const result=await store.updateAccess(actor,body.uid,access,body.revision,ownerUid);
      // La autorización ya cambió en Firestore; se comprueba en cada nueva operación.
      // Revocar tokens es defensa adicional y se informa si no pudo completarse.
      let revoked=true;try {await auth.revokeRefreshTokens(body.uid);}catch(_){revoked=false;}
      return {ok:true,apiVersion:2,user:result,revoked};
    }
    const actor=actorFrom(record,areas,now());
    if(path==='/api/sheets/staging'){authorize(actor,{deporte:body.deporte,tipo:'ALTA_PADRON'});return {ok:true,apiVersion:2,rows:await staging(body.deporte,actor)};}
    if(path!=='/api/operations')throw new AccessError('RUTA','Ruta inexistente.',404);
    if(body.tipo==='LOGOUT')return {ok:true,apiVersion:2};
    const d={...body};for(const key of ['actor','token','signature','timestamp','nonce','uid','rol','areas','capabilities'])delete d[key];
    authorize(actor,d);
    return operations(actor,d);
  };
}
module.exports={createService};
