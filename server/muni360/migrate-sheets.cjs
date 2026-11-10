'use strict';
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {createRuntime}=require('./runtime.cjs');
const {parseLegacy}=require('./migration.cjs');
const {records}=require('./domain.cjs');
const areas=require('./activities.json');
async function main(){
  initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID});const db=getFirestore(),runtime=createRuntime(db),apply=process.argv.includes('--apply');
  if(apply&&(!process.env.BACKUP_FOLDER_ID||!process.env.BOOTSTRAP_ADMIN_UID))throw Error('Falta configurar respaldo y propietario.');
  for(const name of areas){
    const target=runtime.data.activity(name),existing=await target.get();if(existing.exists&&existing.data().migrationStatus!=='inProgress'){console.log(JSON.stringify({activity:name,status:'omitida: ya tiene datos'}));continue;}
    let source=runtime.sheetMap[name];
    if(apply){
      if(existing.exists&&existing.data().sourceBackupId)source=existing.data().sourceBackupId;
      else{const copy=await runtime.client.request({url:`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(source)}/copy?supportsAllDrives=true`,method:'POST',data:{name:'PRE_MUNI360_'+new Date().toISOString().slice(0,10)+'_'+name,parents:[process.env.BACKUP_FOLDER_ID]},retry:false});source=copy.data.id;await target.set({name,activeSeason:'inicial',epoch:0,version:0,migrationStatus:'inProgress',sourceBackupId:source});}
    }
    const legacy=await runtime.sheets.readTables(source,['Padron','Asistencia','Evaluaciones','Gestos','Config']),state=parseLegacy(legacy,process.env.ID_SECRET);
    console.log(JSON.stringify({activity:name,padron:state.padron.length,asistencias:state.asistencia.length,evaluaciones:state.evaluaciones.length,mode:apply?'aplicar':'simulación'}));
    if(!apply)continue;
    const entries=[...records(state)];for(let i=0;i<entries.length;i+=300){const batch=db.batch();entries.slice(i,i+300).forEach(([id,row])=>batch.set(target.collection('seasons').doc('inicial').collection('rows').doc(id),row));await batch.commit();}
    const now=new Date().toISOString();const batch=db.batch();batch.set(target,{name,activeSeason:'inicial',epoch:0,version:1,migrationStatus:'complete',sourceBackupId:source});batch.set(target.collection('seasons').doc('inicial'),{startedAt:now,source:'Sheets'});batch.set(db.collection('muni360_outbox').doc('migration_'+target.id),{activity:name,version:1,status:'pending',createdAt:now});await batch.commit();
  }
}
main().catch(()=>{console.error('Migración detenida. Revisar permisos y respaldos; no se modificaron las planillas originales.');process.exitCode=1;});
