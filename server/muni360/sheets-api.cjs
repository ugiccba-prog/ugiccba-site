'use strict';
// Sólo usa la API oficial. Los valores se escriben como texto/número, nunca como fórmulas.
function createSheetsApi(client){
  const base='https://sheets.googleapis.com/v4/spreadsheets/';
  const call=async(url,method='GET',data)=> (await client.request({url,method,data,timeout:20000,retry:false})).data;
  async function metadata(id){const data=await call(base+encodeURIComponent(id)+'?fields=sheets.properties');return data.sheets.map(s=>s.properties);}
  async function readTables(id,names){
    const meta=await metadata(id),existing=new Set(meta.map(m=>m.title)),wanted=names.filter(n=>existing.has(n));
    if(!wanted.length)return {};
    const query=new URLSearchParams({valueRenderOption:'FORMATTED_VALUE'});wanted.forEach(n=>query.append('ranges',"'"+n.replace(/'/g,"''")+"'"));
    const result=await call(base+encodeURIComponent(id)+'/values:batchGet?'+query);
    return Object.fromEntries(wanted.map((n,i)=>[n,result.valueRanges[i].values||[]]));
  }
  async function replaceTables(id,tables){
    let meta=await metadata(id);const missing=Object.keys(tables).filter(n=>!meta.some(s=>s.title===n));
    if(missing.length){await call(base+encodeURIComponent(id)+':batchUpdate','POST',{requests:missing.map(title=>({addSheet:{properties:{title}}}))});meta=await metadata(id);}
    const requests=[];
    for(const [title,rows]of Object.entries(tables)){
      const tab=meta.find(s=>s.title===title),neededRows=Math.max(rows.length,1),cols=Math.max(...rows.map(r=>r.length),1),grid=tab.gridProperties;
      if(neededRows>grid.rowCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'ROWS',length:neededRows-grid.rowCount}});
      if(cols>grid.columnCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'COLUMNS',length:cols-grid.columnCount}});
      requests.push({updateCells:{range:{sheetId:tab.sheetId,startRowIndex:0,endRowIndex:Math.max(grid.rowCount,neededRows),startColumnIndex:0,endColumnIndex:cols},rows:rows.map(row=>({values:row.map(v=>({userEnteredValue:typeof v==='number'&&Number.isFinite(v)?{numberValue:v}:{stringValue:String(v??'')}}))})),fields:'userEnteredValue'}});
      requests.push({updateSheetProperties:{properties:{sheetId:tab.sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}});
    }
    await call(base+encodeURIComponent(id)+':batchUpdate','POST',{requests});
  }
  return {metadata,readTables,replaceTables};
}
module.exports={createSheetsApi};
