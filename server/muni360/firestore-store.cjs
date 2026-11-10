'use strict';
const {randomUUID}=require('node:crypto');
const {defaults,AccessError}=require('./policy.cjs');
function createStore(db,FieldPath) {
  const users=db.collection('muni360_users'),audit=db.collection('muni360_access_audit');
  return {
    async ensureUser(identity,ownerUid,areas) {
      const ref=users.doc(identity.uid);
      return db.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(snap.exists)return {...snap.data(),uid:identity.uid};
        const owner=identity.uid===ownerUid,rol=owner?'Dirección UGI':'Profe';
        const value={uid:identity.uid,nombre:String(identity.name||identity.email).slice(0,160),email:identity.email,rol,status:owner?'activo':'pendiente',areas:owner?areas:[],capabilities:defaults(rol),expiresAt:null,version:randomUUID(),revision:0,createdAt:new Date().toISOString()};
        tx.create(ref,value);tx.create(db.collection('muni360_outbox').doc('new-user-'+identity.uid),{activity:areas[0],version:0,status:'pending',createdAt:new Date().toISOString()});return value;
      });
    },
    async listUsers(cursor) {
      let q=users.orderBy(FieldPath.documentId()).limit(101);
      if(cursor){if(typeof cursor!=='string'||cursor.length>128||cursor.includes('/'))throw new AccessError('VALIDACION','Página inválida.',400);q=q.startAfter(cursor);}
      const snap=await q.get(),docs=snap.docs.slice(0,100);
      return {users:docs.map(d=>({...d.data(),uid:d.id})),nextCursor:snap.size>100?docs.at(-1).id:null};
    },
    async updateAccess(actor,uid,access,revision,ownerUid) {
      return db.runTransaction(async tx=>{
        const target=users.doc(uid),admin=await tx.get(users.doc(actor.id)),previous=await tx.get(target);
        if(!admin.exists||admin.id!==ownerUid||admin.data().status!=='activo')throw new AccessError('PERMISOS','El acceso de administración cambió.');
        if(!previous.exists)throw new AccessError('VALIDACION','La persona debe ingresar primero con Google.',400);
        const before=previous.data();
        if(before.revision!==revision)throw new AccessError('CONFLICTO','Otra sesión modificó estos permisos. Actualizá y revisá.',409);
        const next={...before,...access,revision:revision+1,version:randomUUID(),updatedAt:new Date().toISOString(),updatedBy:actor.id};
        tx.set(target,next);
        tx.create(db.collection('muni360_outbox').doc('access-'+uid+'-'+next.version),{activity:actor.areas[0],version:0,status:'pending',createdAt:next.updatedAt});
        tx.create(audit.doc(),{fecha:next.updatedAt,actor:actor.id,autor:actor.nombre,target:uid,antes:{rol:before.rol,status:before.status,areas:before.areas,capabilities:before.capabilities,expiresAt:before.expiresAt},despues:access});
        return next;
      });
    },
    async permissionHistory(){const snap=await audit.orderBy('fecha','desc').limit(100).get();return snap.docs.map(d=>({id:d.id,...d.data()}));}
  };
}
module.exports={createStore};
