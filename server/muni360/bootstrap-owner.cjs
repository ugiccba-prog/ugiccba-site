'use strict';
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const {randomUUID}=require('node:crypto');
const {defaults}=require('./policy.cjs');
const areas=require('./activities.json');
async function main(){
  if(!process.argv.includes('--apply')||!process.env.BOOTSTRAP_ADMIN_UID)throw Error('Requiere UID confirmado y --apply.');
  initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID});
  const user=await getAuth().getUser(process.env.BOOTSTRAP_ADMIN_UID);
  if(!user.emailVerified||!user.providerData.some(p=>p.providerId==='google.com'))throw Error('El propietario debe haber ingresado con Google.');
  const db=getFirestore(),ref=db.collection('muni360_users').doc(user.uid),old=await ref.get(),now=new Date().toISOString();
  await ref.set({uid:user.uid,nombre:user.displayName||user.email,email:user.email,rol:'Dirección UGI',status:'activo',areas,capabilities:defaults('Dirección UGI'),expiresAt:null,version:randomUUID(),revision:(old.exists?old.data().revision:0)+1,createdAt:old.exists?old.data().createdAt:now,updatedAt:now,updatedBy:'configuración del propietario'});
  await getAuth().revokeRefreshTokens(user.uid);console.log('Propietario configurado. Volver a ingresar con Google.');
}
main().catch(()=>{console.error('No se pudo configurar el propietario. Verificar UID, proveedor Google y credenciales administrativas.');process.exitCode=1;});
