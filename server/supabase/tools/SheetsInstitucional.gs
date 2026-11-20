// Add to the separate authorized Supabase bridge project. Never embed a key.
function fechaHoraSupabaseUGI(value){return Utilities.formatDate(new Date(value),'America/Argentina/Buenos_Aires','dd/MM/yyyy HH:mm:ss');}
function tablasSupabaseUGI(job){
 var s=job.state||{},name=job.activity,hs=job.archives||[],surveys=Array.isArray(job.surveys)?job.surveys:[],p={};
 var padron=Array.isArray(s.padron)?s.padron:[],asistencia=Array.isArray(s.asistencia)?s.asistencia:[],evaluaciones=Array.isArray(s.evaluaciones)?s.evaluaciones:[],gestos=Array.isArray(s.gestos)?s.gestos:[],fichas=s.fichas||{},audit=Array.isArray(job.audit)?job.audit:[];
 var round2=function(n){return Math.round(n*100)/100;};
 var round1=function(n){return Math.round(n*10)/10;};
 var pctTxt=function(pres,reg){return reg?(round1(pres*100/reg)+'%'):'Sin datos';};
 var semTxt=function(v,a,r){var obs=v+a+r;return obs?(round2((v*3+a*2+r)/obs)+' / 3 (🟢'+v+' 🟡'+a+' 🔴'+r+')'):'Sin datos';};
 var playerStats={},groupStats={};
 function ensureGroup(cat,eq){
  var c=String(cat||'Sin categoría').trim()||'Sin categoría',e=String(eq||'General').trim()||'General',k=c+'||'+e;
  if(!groupStats[k])groupStats[k]={cat:c,eq:e,dep:0,reg:0,pres:0,aus:0,v:0,a:0,r:0,evalSum:0,evalCnt:0};
  return groupStats[k];
 }
 function ensurePlayer(id,cat,eq,jug){
  var k=String(id||'')||([cat,eq,jug].join('|'));
  if(!playerStats[k])playerStats[k]={reg:0,pres:0,v:0,a:0,r:0,evalSum:0,evalCnt:0};
  return playerStats[k];
 }
 var totalReg=0,totalPres=0,totalAus=0,totalV=0,totalA=0,totalR=0,totalEvalSum=0,totalEvalCnt=0;
 padron.forEach(function(r){ensureGroup(r.categoria,r.equipo).dep++;});
 asistencia.forEach(function(r){
  var est=String(r.estado||''),code=est.charAt(0),g=ensureGroup(r.categoria,r.equipo),ps=ensurePlayer(r.jugadorId,r.categoria,r.equipo,r.jugador);
  if(code==='P'||code==='T'||code==='A'){
   g.reg++;ps.reg++;totalReg++;
   if(code==='A'){g.aus++;totalAus++;}else{g.pres++;ps.pres++;totalPres++;}
  }
  if(est.indexOf('Sem:V')>=0){g.v++;ps.v++;totalV++;}
  else if(est.indexOf('Sem:A')>=0){g.a++;ps.a++;totalA++;}
  else if(est.indexOf('Sem:R')>=0){g.r++;ps.r++;totalR++;}
 });
 evaluaciones.forEach(function(r){
  var g=ensureGroup(r.categoria,r.equipo),ps=ensurePlayer(r.jugadorId,r.categoria,r.equipo,r.jugador);
  Object.values(r.notas||{}).forEach(function(n){
   if(typeof n==='number'&&isFinite(n)){g.evalSum+=n;g.evalCnt++;ps.evalSum+=n;ps.evalCnt++;totalEvalSum+=n;totalEvalCnt++;}
  });
 });
 var totalSurveyResp=surveys.reduce(function(acc,sv){return acc+Number(sv.responseCount||(Array.isArray(sv.responses)?sv.responses.length:0));},0);
 var pad10=function(arr){return Array.from({length:10},function(_,i){return arr[i]===undefined?'':arr[i];});};
 var resumenRows=[
  ['Indicador / Categoría','Valor / Equipo','Deportistas','Registros','Presentes','Ausentes','% Asistencia','Semáforo (🟢/🟡/🔴)','Prom. Evaluación','Cuestionarios'],
  pad10(['Actividad',name]),
  pad10(['Resumen general de la actividad','Todos los grupos',padron.length,totalReg,totalPres,totalAus,pctTxt(totalPres,totalReg),semTxt(totalV,totalA,totalR),totalEvalCnt?round2(totalEvalSum/totalEvalCnt):'Sin datos',surveys.length+' ('+totalSurveyResp+' resp.)']),
  pad10(['Evaluaciones registradas',evaluaciones.length+' planilla(s)']),
  pad10(['Cuestionarios anónimos',surveys.length+' activo(s)/cerrado(s) · '+totalSurveyResp+' respuesta(s)']),
  pad10(['Desglose por categoría y equipo']),
  ['Categoría','Equipo / Tira','Deportistas','Registros','Presentes','Ausentes','% Asistencia','Semáforo (🟢/🟡/🔴)','Prom. Evaluación','Cuestionarios']
 ];
 Object.keys(groupStats).sort(function(k1,k2){
  var g1=groupStats[k1],g2=groupStats[k2];
  return g1.cat.localeCompare(g2.cat,'es',{numeric:true})||g1.eq.localeCompare(g2.eq,'es',{numeric:true});
 }).forEach(function(k){
  var g=groupStats[k];
  var matched=surveys.filter(function(sv){
   var sc=String(sv.categoria||'').trim().toLowerCase(),se=String(sv.equipo||'').trim().toLowerCase();
   return (!sc||sc===g.cat.toLowerCase())&&(!se||se===g.eq.toLowerCase());
  });
  var mResp=matched.reduce(function(acc,sv){return acc+Number(sv.responseCount||(Array.isArray(sv.responses)?sv.responses.length:0));},0);
  resumenRows.push([g.cat,g.eq,g.dep,g.reg,g.pres,g.aus,pctTxt(g.pres,g.reg),semTxt(g.v,g.a,g.r),g.evalCnt?round2(g.evalSum/g.evalCnt):'Sin datos',matched.length?(matched.length+' ('+mResp+' resp.)'):'-']);
 });
 p.Resumen=resumenRows;

 var svStatusMap={active:'Activo',closed:'Cerrado',draft:'Borrador'};
 var svTypeMap={scale:'Escala 1–5',single:'Opción única',multi:'Opción múltiple',text:'Texto breve'};
 var cuestRows=[['Cuestionario','Estado','Categoría','Equipo','Respuestas','Pregunta','Tipo','Promedio / Resultado','Comentarios anónimos']];
 surveys.forEach(function(sv){
  var resps=Array.isArray(sv.responses)?sv.responses:[],respCount=Number(sv.responseCount!=null?sv.responseCount:resps.length);
  var qs=Array.isArray(sv.questions)?sv.questions:[];
  var cat=sv.categoria||'Toda la actividad',eq=sv.equipo||'Todos',st=svStatusMap[sv.status]||sv.status||'';
  if(!qs.length){cuestRows.push([sv.title||'',st,cat,eq,respCount,'Sin preguntas','','','']);return;}
  qs.forEach(function(q){
   var resultado='Sin respuestas aún',comentarios='';
   if(q.type==='scale'){
    var sum=0,cnt=0,dist={1:0,2:0,3:0,4:0,5:0};
    resps.forEach(function(r){var n=Number(r&&r[q.id]);if(n>=1&&n<=5&&Math.floor(n)===n){dist[n]++;sum+=n;cnt++;}});
    if(cnt)resultado=round2(sum/cnt)+' / 5 ★ ('+[1,2,3,4,5].map(function(k){return k+'★:'+dist[k];}).join(' · ')+')';
   }else if(q.type==='single'||q.type==='multi'){
    var counts={};(q.options||[]).forEach(function(o){counts[o]=0;});
    resps.forEach(function(r){
     var val=r&&r[q.id],picked=q.type==='multi'?(Array.isArray(val)?val:[]):(typeof val==='string'&&val?[val]:[]);
     picked.forEach(function(x){if(Object.prototype.hasOwnProperty.call(counts,x))counts[x]++;});
    });
    var pairs=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];}).map(function(o){return o+': '+counts[o];});
    if(resps.length)resultado=pairs.join(' · ');
   }else{
    var texts=[];resps.forEach(function(r){var t=typeof (r&&r[q.id])==='string'?r[q.id].trim():'';if(t)texts.push(t);});
    resultado=texts.length?texts.length+' comentario(s)':'Sin comentarios';
    comentarios=texts.slice(0,5).join(' | ');
   }
   cuestRows.push([sv.title||'',st,cat,eq,respCount,q.label||'',svTypeMap[q.type]||q.type||'',resultado,comentarios]);
  });
 });
 if(cuestRows.length===1){
  cuestRows.push(['Todavía no hay cuestionarios para esta actividad','-','Toda la actividad','Todos',0,'Creá uno desde Muni360 → Cuestionarios','-','Los resultados y textos anónimos aparecerán acá','']);
 }
 p.Cuestionarios=cuestRows;

 p.Padron=[['Deporte','Categoría','Equipo','Jugador','DNI (privado)','ID deportista','% Asistencia','Presentes / Reg.','Semáforo','Prom. Evaluación','Apoyo DUA']].concat(padron.map(function(r){
  var ps=playerStats[r.id]||ensurePlayer(r.id,r.categoria,r.equipo,r.jugador),hasDua=Boolean(fichas[r.id]&&fichas[r.id].dua&&(fichas[r.id].dua.comunicacion||fichas[r.id].dua.desborda||fichas[r.id].dua.regula));
  return [name,r.categoria,r.equipo,r.jugador,'',r.id,pctTxt(ps.pres,ps.reg),ps.pres+' / '+ps.reg,(ps.v+ps.a+ps.r)?('🟢'+ps.v+' 🟡'+ps.a+' 🔴'+ps.r):'Sin obs.',ps.evalCnt?round2(ps.evalSum/ps.evalCnt):'Sin datos',hasDua?'Sí':'No'];
 }));

 var asistSorted=asistencia.slice().sort(function(a,b){return String(b.fecha||'').localeCompare(String(a.fecha||''));});
 var codeLabel={P:'Presente',T:'Tarde',A:'Ausente'};
 var semLabel={V:'🟢 Verde',A:'🟡 Amarillo',R:'🔴 Rojo'};
 p.Asistencia=[['Fecha','Deporte','Categoría','Equipo','Jugador','Estado','Clima','Puntos Ciudad','Asistencia (lectura)','Semáforo (lectura)']].concat(asistSorted.map(function(r){
  var est=String(r.estado||''),code=est.charAt(0),mSem=est.match(/Sem:([VAR])/);
  return [r.fecha,name,r.categoria,r.equipo,r.jugador,r.estado,r.clima||'',r.puntosCiudad??'',codeLabel[code]||'Sin registrar',mSem?(semLabel[mSem[1]]||'Sin observar'):'Sin observar'];
 }));

 var evalSorted=evaluaciones.slice().sort(function(a,b){return String(b.fecha||'').localeCompare(String(a.fecha||''));});
 p.Evaluaciones=[['Fecha','Deporte','Categoría','Equipo','Jugador','Notas','Promedio']].concat(evalSorted.map(function(r){
  var vals=Object.values(r.notas||{}).filter(function(n){return typeof n==='number'&&isFinite(n);});
  var avg=vals.length?round2(vals.reduce(function(a,b){return a+b;},0)/vals.length):'';
  return [r.fecha,name,r.categoria,r.equipo,r.jugador,Object.entries(r.notas||{}).map(function(x){return x[0]+': '+x[1];}).join(' | '),avg];
 }));

 p.ApoyosDUA=[['ID','Categoría','Equipo','Jugador','Comunicación','Evitar','Apoyos']].concat(padron.filter(function(r){return fichas[r.id]?.dua;}).map(function(r){var f=fichas[r.id].dua;return [r.id,r.categoria||'',r.equipo||'',r.jugador,f.comunicacion||'',f.desborda||'',f.regula||''];}));
 p.Gestos=[['Variable']].concat(gestos.map(function(g){return [g];}));
 p.Cambios=[['Fecha y hora (Argentina)','Autor','Tipo','Categoría','Equipo','Jugador','ID']].concat(audit.slice().reverse().map(function(e){return [fechaHoraSupabaseUGI(e.fecha),e.autor,e.tipo,e.categoria,e.equipo,e.jugador,e.id];}));
 p.HistorialAsistencia=[['Temporada','Fecha','Categoría','Equipo','Jugador','Estado']].concat(hs.flatMap(function(h){return h.state.asistencia.map(function(r){return [h.id,r.fecha,r.categoria,r.equipo,r.jugador,r.estado];});}));
 p.HistorialEvaluaciones=[['Temporada','Fecha','Categoría','Equipo','Jugador','Notas JSON']].concat(hs.flatMap(function(h){return h.state.evaluaciones.map(function(r){return [h.id,r.fecha,r.categoria,r.equipo,r.jugador,JSON.stringify(r.notas)];});}));
 p.HistorialPadron=[['Temporada','Categoría','Equipo','Jugador','ID']].concat(hs.flatMap(function(h){return h.state.padron.map(function(r){return [h.id,r.categoria,r.equipo,r.jugador,r.id];});}));
 p.EstadoSync=[['Campo','Valor'],['Actividad',name],['Versión',job.version],['Cuestionarios activos',surveys.filter(function(sv){return sv.status==='active';}).length],['Respuestas anónimas',totalSurveyResp],['Actualizado (Argentina)',fechaHoraSupabaseUGI(new Date())],['Uso','Las primeras pestañas resumen el deporte y cuestionarios. Para cargar altas desde Sheets usá CargaPadron.']];
 return p;
}
function estilosYOrdenSheetsUGI(sheet,meta,tables){
 var order=['Resumen','Cuestionarios','Padron','Asistencia','Evaluaciones','ApoyosDUA','CargaPadron','Gestos','Cambios','HistorialAsistencia','HistorialEvaluaciones','HistorialPadron','EstadoSync','ControlMuni360'];
 var widths={Resumen:[210,160,95,90,90,90,105,180,120,130],Cuestionarios:[210,85,120,100,90,260,115,240,300],Padron:[140,120,100,200,105,180,105,115,130,115,95],Asistencia:[100,140,115,100,190,170,85,105,130,125],Evaluaciones:[100,140,115,100,190,320,90],ApoyosDUA:[160,115,100,180,220,220,220],CargaPadron:[150,130,220],EstadoSync:[180,380]};
 var reqs=[],pos=0;
 order.forEach(function(title){
  var tab=meta.find(function(t){return t.title===title;});if(!tab)return;
  var props={sheetId:tab.sheetId,index:pos++};
  var fields='index';
  if(title==='ControlMuni360'){props.hidden=true;fields+=',hidden';}
  reqs.push({updateSheetProperties:{properties:props,fields:fields}});
  var cols=tables[title]?Math.max.apply(null,tables[title].map(function(r){return r.length;})):(title==='CargaPadron'?3:0);
  if(cols>0){
   reqs.push({repeatCell:{range:{sheetId:tab.sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:cols},cell:{userEnteredFormat:{backgroundColor:{red:0.043,green:0.145,blue:0.271},textFormat:{foregroundColor:{red:1,green:1,blue:1},bold:true}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}});
   if(title==='Resumen'){
    reqs.push({repeatCell:{range:{sheetId:tab.sheetId,startRowIndex:6,endRowIndex:7,startColumnIndex:0,endColumnIndex:cols},cell:{userEnteredFormat:{backgroundColor:{red:0.878,green:0.949,blue:0.996},textFormat:{foregroundColor:{red:0.043,green:0.145,blue:0.271},bold:true}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}});
   }
   var w=widths[title];
   if(w){w.slice(0,cols).forEach(function(px,idx){reqs.push({updateDimensionProperties:{range:{sheetId:tab.sheetId,dimension:'COLUMNS',startIndex:idx,endIndex:idx+1},properties:{pixelSize:px},fields:'pixelSize'}});});}
  }
 });
 return reqs;
}
function sincronizarMuni360SupabaseOriginalUGI(opciones){
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {busy:true};
 try{
  var props=PropertiesService.getScriptProperties(),key='sb_publishable_TbXCJ2YSkmPcNDjio7kgAg_Kzzz1lSs',secret=props.getProperty('UGI_SUPABASE_MAINTENANCE_KEY')||props.getProperty('UGI_SUPABASE_IMPORT_KEY'),url='https://kaalffshnrkxviqaymhv.supabase.co';
  if(!secret)throw Error('Falta la credencial privada institucional.');
  function rpc(name,args){var r=UrlFetchApp.fetch(url+'/rest/v1/rpc/'+name,{method:'post',contentType:'application/json',headers:{apikey:key},payload:JSON.stringify(Object.assign({},args,{p_secret:secret})),muteHttpExceptions:true});if(r.getResponseCode()!==200)throw Error('El puente no confirmó '+name);return JSON.parse(r.getContentText());}
  var jobs=rpc('mc_worker_jobs',{p_limit:5}),verified=0;
  jobs.forEach(function(job){
   var prop='MC_DESTINO_'+Utilities.base64EncodeWebSafe(job.activity),sheet=job.sheet_id||props.getProperty(prop),tables=tablasSupabaseUGI(job),marker='MUNI360_SUPABASE_MIGRATION_V1';
   if(!sheet){
    var names=Object.keys(tables).concat(['CargaPadron','ControlMuni360']);
    var book=Sheets.Spreadsheets.create({properties:{title:'Muni360 - Supabase - '+job.activity},sheets:names.map(function(title,i){return {properties:{title:title,sheetId:i,gridProperties:{rowCount:1000,columnCount:14}}};})});sheet=book.spreadsheetId;props.setProperty(prop,sheet);
    Sheets.Spreadsheets.Values.update({values:[[marker],[job.activity]]},sheet,"'ControlMuni360'!A1:A2",{valueInputOption:'RAW'});
    Sheets.Spreadsheets.Values.update({values:[['Categoría','Equipo','Jugador']]},sheet,"'CargaPadron'!A1:C1",{valueInputOption:'RAW'});
   }
   var check=Sheets.Spreadsheets.Values.get(sheet,"'ControlMuni360'!A1:A2").values||[];if(check[0]?.[0]!==marker||check[1]?.[0]!==job.activity)throw Error('Destino rechazado: no es una vista nueva de la migración.');
   var meta=Sheets.Spreadsheets.get(sheet,{fields:'sheets.properties'}).sheets.map(function(x){return x.properties;});
   var missing=Object.keys(tables).filter(function(title){return !meta.some(function(t){return t.title===title;});});
   if(missing.length){
    Sheets.Spreadsheets.batchUpdate({requests:missing.map(function(title){
     var cols=Math.max(10,Math.max.apply(null,tables[title].map(function(r){return r.length;})));
     return {addSheet:{properties:{title:title,gridProperties:{rowCount:Math.max(100,tables[title].length+20),columnCount:cols}}}};
    })},sheet);
    meta=Sheets.Spreadsheets.get(sheet,{fields:'sheets.properties'}).sheets.map(function(x){return x.properties;});
   }
   var requests=[];
   Object.keys(tables).forEach(function(title){var tab=meta.find(function(t){return t.title===title;}),rows=tables[title],cols=Math.max.apply(null,rows.map(function(r){return r.length;}));if(!tab)throw Error('Se modificó la estructura del destino.');
    if(rows.length>tab.gridProperties.rowCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'ROWS',length:rows.length-tab.gridProperties.rowCount}});
    if(cols>(tab.gridProperties.columnCount||0))requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'COLUMNS',length:cols-(tab.gridProperties.columnCount||0)}});
    requests.push({updateCells:{range:{sheetId:tab.sheetId,startRowIndex:0,endRowIndex:Math.max(rows.length,tab.gridProperties.rowCount),startColumnIndex:0,endColumnIndex:cols},rows:rows.map(function(row){return {values:Array.from({length:cols},function(_,j){var v=row[j];return {userEnteredValue:typeof v==='number'&&isFinite(v)?{numberValue:v}:{stringValue:String(v??'')}};})};}),fields:'userEnteredValue'}});
    requests.push({updateSheetProperties:{properties:{sheetId:tab.sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}});
   });
   // Read current values once; write only changed rows in bounded batches.
   var baseline=Sheets.Spreadsheets.Values.batchGet(sheet,{ranges:Object.keys(tables).map(function(t){return "'"+t+"'";}),valueRenderOption:'UNFORMATTED_VALUE'}).valueRanges;
   var pieces=[];
   requests.forEach(function(request){
    if(!request.updateCells){pieces.push(request);return;}
    var u=request.updateCells,title=meta.find(function(t){return t.sheetId===u.range.sheetId;}).title,idx=Object.keys(tables).indexOf(title),oldRows=baseline[idx]?.values||[],want=u.rows,cols=u.range.endColumnIndex;
    function plain(row){return Array.from({length:cols},function(_,i){var v=row?.values?.[i]?.userEnteredValue;return String(v?(v.stringValue??v.numberValue??''):'');});}
    function oldPlain(row){return Array.from({length:cols},function(_,i){return String(row?.[i]??'');});}
    function changed(i){return JSON.stringify(plain(want[i]))!==JSON.stringify(oldPlain(oldRows[i]));}
    function piece(start,end,rows){pieces.push({updateCells:{range:{sheetId:u.range.sheetId,startRowIndex:start,endRowIndex:end,startColumnIndex:0,endColumnIndex:cols},rows:rows,fields:'userEnteredValue'}});}
    var length=Math.max(want.length,oldRows.length),i=0;
    while(i<length){if(!changed(i)){i++;continue;}var first=i;while(i<length&&changed(i))i++;var stop=i,at=first;
     while(at<Math.min(stop,want.length)){var chunk=[],size=0,start=at;while(at<Math.min(stop,want.length)){var n=JSON.stringify(want[at]).length+4;if(size+n>140000&&chunk.length)break;if(n>140000)throw Error('Una fila supera el límite de la vista.');chunk.push(want[at++]);size+=n;}piece(start,at,chunk);}
     if(stop>want.length)piece(Math.max(first,want.length),stop,[]);
    }
   });
   estilosYOrdenSheetsUGI(sheet,meta,tables).forEach(function(r){pieces.push(r);});
   var pack=[],size=0;
   function flush(){if(pack.length){Sheets.Spreadsheets.batchUpdate({requests:pack},sheet);pack=[];size=0;}}
   pieces.forEach(function(r){var n=JSON.stringify(r).length;if(size+n>145000)flush();pack.push(r);size+=n;});flush();
   var titles=Object.keys(tables),actual=Sheets.Spreadsheets.Values.batchGet(sheet,{ranges:titles.map(function(t){return "'"+t+"'";}),valueRenderOption:'UNFORMATTED_VALUE'}).valueRanges;
   titles.forEach(function(t,i){var expected=tables[t],cols=Math.max.apply(null,expected.map(function(r){return r.length;}));function canonical(rows){return JSON.stringify(rows.map(function(r){return Array.from({length:cols},function(_,j){return String(r[j]??'');});}));}if(canonical(expected)!==canonical(actual[i].values||[]))throw Error('Sheets no confirmó '+t+'; no se marca como sincronizado.');});
   var staging=(Sheets.Spreadsheets.Values.get(sheet,"'CargaPadron'!A2:C501",{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]).filter(function(r){return r[0]&&r[1]&&r[2];}).map(function(r){return {categoria:String(r[0]),equipo:String(r[1]),jugador:String(r[2])};});
   var ack=rpc('mc_worker_ack',{p_activity:job.activity,p_version:job.version,p_sheet:sheet,p_staging:staging});if(ack.verified!==true||ack.version!==job.version)throw Error('Confirmación incompleta.');verified++;
  });
  // CargaPadron is the only editable tab; refresh even with no new app writes.
  if(!(opciones&&opciones.soloPlantillas))rpc('mc_worker_targets',{}).forEach(function(t){
   var rows=(Sheets.Spreadsheets.Values.get(t.sheet_id,"'CargaPadron'!A2:C502",{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]).filter(function(r){return r[0]&&r[1]&&r[2];}).map(function(r){return {categoria:String(r[0]),equipo:String(r[1]),jugador:String(r[2])};});
   if(rows.length>500)throw Error('CargaPadron admite hasta 500 filas por revisión.');
   var hash=sha(JSON.stringify(rows)),prop='MC_CARGA_HASH_'+Utilities.base64EncodeWebSafe(t.activity);
   if(props.getProperty(prop)!==hash){var stagingAck=rpc('mc_worker_staging',{p_activity:t.activity,p_sheet:t.sheet_id,p_rows:rows});if(stagingAck.ok!==true)throw Error('No se confirmó CargaPadron.');props.setProperty(prop,hash);}
  });
  console.log('MUNI360_SUPABASE_SYNC '+JSON.stringify({verified:verified}));return {verified:verified};
 }finally{lock.releaseLock();}
}