'use strict';
const {GoogleAuth}=require('google-auth-library');
const {createDataStore}=require('./data-store.cjs');
const {createSheetsApi}=require('./sheets-api.cjs');
const {createProjector}=require('./projection.cjs');
const areas=require('./activities.json');
function createRuntime(db){
  const sheetMap=JSON.parse(process.env.SHEETS_MAP_JSON||'{}');
  const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive']});
  const client={request:async opts=>(await auth.getClient()).request(opts)};
  const sheets=createSheetsApi(client);let projector;
  const data=createDataStore(db,{areas,idSecret:process.env.ID_SECRET,projectActivity:name=>projector.projectActivity(name)});
  projector=createProjector({db,sheets,data,sheetMap,privateSheetId:process.env.PRIVATE_SHEET_ID,areas});
  return {data,projector,sheets,client,sheetMap};
}
module.exports={createRuntime};
