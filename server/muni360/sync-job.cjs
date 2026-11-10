'use strict';
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {createRuntime}=require('./runtime.cjs');
initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID});
createRuntime(getFirestore()).projector.drain().then(results=>{console.log(JSON.stringify(results));if(results.some(r=>!r.ok))process.exitCode=1;}).catch(()=>{console.error('No se pudo completar la sincronización. Los trabajos pendientes se conservan.');process.exitCode=1;});
