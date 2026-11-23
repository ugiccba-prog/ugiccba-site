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
 p.Asistencia=[['Fecha','Deporte','Categoría','Equipo','Jugador','Estado','Clima','Puntos Ciudad','Asistencia (lectura)','Semáforo (lectura)'].concat(name==='Colonia'?['Almuerzo (lectura)']:[])].concat(asistSorted.map(function(r){
  var est=String(r.estado||''),code=est.charAt(0),mSem=est.match(/Sem:([VAR])/),conComedor=(code==='P'||code==='T')&&/(?:^|\|)\s*(?:🍴\s*)?(?:Comida|Comedor)\s*(?:\||$)/i.test(est);
  var row=[r.fecha,name,r.categoria,r.equipo,r.jugador,r.estado,r.clima||'',r.puntosCiudad??'',codeLabel[code]||'Sin registrar',mSem?(semLabel[mSem[1]]||'Sin observar'):'Sin observar'];
  if(name==='Colonia')row.push((code==='P'||code==='T')?(conComedor?'🍴 Comedor':'🍱 Vianda'):'-');
  return row;
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
 var matrices=tablasAsistenciaHorizontalUGI(s,name),grupos=Object.keys(matrices);
 p.AsistenciaPorGrupo=[['Asistencia por grupo','Formato'],['Organización','Una pestaña por grupo y tira/subgrupo'],['Lectura','Nombres en filas; fechas en columnas'],['Marcas','P = Presente · T = Tarde · A = Ausente · vacío = Sin registrar'+(name==='Colonia'?' · 🍴 = Comedor · P/T sin 🍴 = Vianda':'')],['Grupos disponibles',grupos.length]].concat(grupos.length?grupos.map(function(t){return [t,'Asistencia día por día'];}):[['Sin grupos cargados','Al cargar el padrón en Muni360 se crean las pestañas de cada grupo.']]);
 Object.assign(p,matrices);
 return p;
}
function estilosYOrdenSheetsUGI(sheet,meta,tables){
 var order=['Resumen','Cuestionarios','Padron','Asistencia','Evaluaciones','ApoyosDUA','CargaPadron','Gestos','Cambios','HistorialAsistencia','HistorialEvaluaciones','HistorialPadron','EstadoSync','ControlMuni360'];
 var widths={Resumen:[210,160,95,90,90,90,105,180,120,130],Cuestionarios:[210,85,120,100,90,260,115,240,300],Padron:[140,120,100,200,105,180,105,115,130,115,95],Asistencia:[100,140,115,100,190,170,85,105,130,125],Evaluaciones:[100,140,115,100,190,320,90],ApoyosDUA:[160,115,100,180,220,220,220],CargaPadron:[150,130,220],AsistenciaPorGrupo:[300,520],EstadoSync:[180,380]};
 var horizontal=Object.keys(tables).filter(function(t){return t.indexOf('Asist · ')===0;});
 order=['Resumen','AsistenciaPorGrupo'].concat(horizontal,order.filter(function(t){return t!=='Resumen';}));
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
   if(title.indexOf('Asist · ')===0){
    reqs.push({updateSheetProperties:{properties:{sheetId:tab.sheetId,gridProperties:{frozenRowCount:1,frozenColumnCount:1}},fields:'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'}});
    reqs.push({updateDimensionProperties:{range:{sheetId:tab.sheetId,dimension:'COLUMNS',startIndex:0,endIndex:1},properties:{pixelSize:240},fields:'pixelSize'}});
    if(cols>1)reqs.push({updateDimensionProperties:{range:{sheetId:tab.sheetId,dimension:'COLUMNS',startIndex:1,endIndex:cols},properties:{pixelSize:100},fields:'pixelSize'}});
    reqs.push({repeatCell:{range:{sheetId:tab.sheetId,startRowIndex:tables[title].length-(tables[title].length>=3&&tables[title][tables[title].length-1][0]==='Total vianda'&&tables[title][tables[title].length-2][0]==='Total comedor'?3:1),endRowIndex:tables[title].length,startColumnIndex:0,endColumnIndex:cols},cell:{userEnteredFormat:{backgroundColor:{red:0.878,green:0.949,blue:0.996},textFormat:{bold:true}}},fields:'userEnteredFormat(backgroundColor,textFormat)'}});
   }
   if(w){w.slice(0,cols).forEach(function(px,idx){reqs.push({updateDimensionProperties:{range:{sheetId:tab.sheetId,dimension:'COLUMNS',startIndex:idx,endIndex:idx+1},properties:{pixelSize:px},fields:'pixelSize'}});});}
  }
 });
 return reqs;
}
function sincronizarMuni360Supabase(){
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return {busy:true};
 try{
  var props=PropertiesService.getScriptProperties(),key=props.getProperty('SUPABASE_PILOT_PUBLISHABLE_KEY'),secret=props.getProperty('SUPABASE_PILOT_WORKER_KEY'),url=props.getProperty('SUPABASE_PILOT_URL'),expiry=props.getProperty('PILOT_WORKER_EXPIRES');
  if(!key||!secret||url!=='https://kaalffshnrkxviqaymhv.supabase.co')throw Error('Falta la configuración privada del puente.');
  if(!expiry||Date.now()>=Date.parse(expiry)){ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='sincronizarMuni360Supabase';}).forEach(function(t){ScriptApp.deleteTrigger(t);});return {expired:true};}
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
   meta.filter(function(t){return t.title.indexOf('Asist · ')===0&&!tables[t.title];}).forEach(function(t){tables[t.title]=[['Jugador'],['Sin registros de esta temporada']];});
   var missing=Object.keys(tables).filter(function(title){return !meta.some(function(t){return t.title===title;});});
   if(missing.length){
    Sheets.Spreadsheets.batchUpdate({requests:missing.map(function(title){
     var cols=Math.max(10,Math.max.apply(null,tables[title].map(function(r){return r.length;})));
     return {addSheet:{properties:{title:title,gridProperties:{rowCount:Math.max(100,tables[title].length+20),columnCount:cols}}}};
    })},sheet);
    meta=Sheets.Spreadsheets.get(sheet,{fields:'sheets.properties'}).sheets.map(function(x){return x.properties;});
   }
   var requests=[];
   Object.keys(tables).forEach(function(title){var tab=meta.find(function(t){return t.title===title;}),rows=tables[title],cols=Math.max.apply(null,rows.map(function(r){return r.length;}));if(tab&&title.indexOf('Asist · ')===0)cols=Math.max(cols,tab.gridProperties.columnCount||0);if(!tab)throw Error('Se modificó la estructura del destino.');
    if(rows.length>tab.gridProperties.rowCount)requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'ROWS',length:rows.length-tab.gridProperties.rowCount}});
    if(cols>(tab.gridProperties.columnCount||0))requests.push({appendDimension:{sheetId:tab.sheetId,dimension:'COLUMNS',length:cols-(tab.gridProperties.columnCount||0)}});
    requests.push({updateCells:{range:{sheetId:tab.sheetId,startRowIndex:0,endRowIndex:Math.max(rows.length,tab.gridProperties.rowCount),startColumnIndex:0,endColumnIndex:cols},rows:rows.map(function(row){return {values:Array.from({length:cols},function(_,j){var v=row[j];return {userEnteredValue:typeof v==='number'&&isFinite(v)?{numberValue:v}:{stringValue:String(v??'')}};})};}),fields:'userEnteredValue'}});
    requests.push({updateSheetProperties:{properties:{sheetId:tab.sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}});
   });
   estilosYOrdenSheetsUGI(sheet,meta,tables).forEach(function(r){requests.push(r);});
   // Bound each payload; large histories need a later incremental view adapter.
   if(JSON.stringify(requests).length>1800000)throw Error('La vista requiere dividir su historial. El original sigue en Supabase.');
   Sheets.Spreadsheets.batchUpdate({requests:requests},sheet);
   var titles=Object.keys(tables),actual=Sheets.Spreadsheets.Values.batchGet(sheet,{ranges:titles.map(function(t){return "'"+t+"'";}),valueRenderOption:'UNFORMATTED_VALUE'}).valueRanges;
   titles.forEach(function(t,i){var expected=tables[t],cols=Math.max.apply(null,expected.map(function(r){return r.length;}));function canonical(rows){return JSON.stringify(rows.map(function(r){return Array.from({length:cols},function(_,j){return String(r[j]??'');});}));}if(canonical(expected)!==canonical(actual[i].values||[]))throw Error('Sheets no confirmó '+t+'; no se marca como sincronizado.');});
   var staging=(Sheets.Spreadsheets.Values.get(sheet,"'CargaPadron'!A2:C501",{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]).filter(function(r){return r[0]&&r[1]&&r[2];}).map(function(r){return {categoria:String(r[0]),equipo:String(r[1]),jugador:String(r[2])};});
   var ack=rpc('mc_worker_ack',{p_activity:job.activity,p_version:job.version,p_sheet:sheet,p_staging:staging});if(ack.verified!==true||ack.version!==job.version)throw Error('Confirmación incompleta.');verified++;
  });
  console.log('MUNI360_SUPABASE_SYNC '+JSON.stringify({verified:verified}));return {verified:verified};
 }finally{lock.releaseLock();}
}
function activarMuni360Supabase(){
 var result=sincronizarMuni360Supabase();if(result.expired)throw Error('La credencial temporal venció.');
 if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='sincronizarMuni360Supabase';}))ScriptApp.newTrigger('sincronizarMuni360Supabase').timeBased().everyMinutes(5).create();
 console.log('MUNI360_SUPABASE_PUENTE_ACTIVO '+JSON.stringify(result));
}

// Read-only projection of the current season. Included in both bridge variants.
function tablasAsistenciaHorizontalUGI(state,activity){
 var groups=new Map(),out={},activityDates=new Set(),food=activity==='Colonia';
 var norm=function(v){return String(v||'').trim().toLocaleLowerCase('es');};
 function ensure(r){
  var cat=String(r.categoria||'Sin categoría').trim(),eq=String(r.equipo||'General').trim()||'General',key=JSON.stringify([cat,eq]);
  if(!groups.has(key))groups.set(key,{cat:cat,eq:eq,people:new Map(),aliases:new Map(),dates:new Set(),rows:[]});
  return groups.get(key);
 }
 (state.padron||[]).forEach(function(p){
  var g=ensure(p),name=String(p.jugador||'').trim();if(!name)return;
  var id=p.id?'id:'+p.id:'nombre:'+norm(name);
  if(!g.people.has(id))g.people.set(id,{name:name,marks:new Map()});
  if(!g.aliases.has(norm(name)))g.aliases.set(norm(name),new Set());g.aliases.get(norm(name)).add(id);
 });
 (state.asistencia||[]).forEach(function(r){
  var date=r.fecha;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)return;
  var g=ensure(r),name=String(r.jugador||'').trim();if(!name)return;
  var aliases=g.aliases.get(norm(name)),id=r.jugadorId?'id:'+r.jugadorId:aliases&&aliases.size===1?Array.from(aliases)[0]:'nombre:'+norm(name);
  if(!g.people.has(id))g.people.set(id,{name:name,marks:new Map()});
  g.dates.add(date);activityDates.add(date);
  var match=String(r.estado||'').match(/^([PAT])(?:\s*\||\s*$)/);if(!match)return;
  var marks=g.people.get(id).marks;if(!marks.has(date))marks.set(date,new Set());var withFood=food&&['P','T'].indexOf(match[1])>=0&&/(?:^|\|)\s*(?:🍴\s*)?(?:Comida|Comedor)\s*(?:\||$)/i.test(String(r.estado||''));marks.get(date).add(match[1]+(withFood?' 🍴':''));
 });
 Array.from(groups.values()).sort(function(a,b){return a.cat.localeCompare(b.cat,'es',{numeric:true})||a.eq.localeCompare(b.eq,'es',{numeric:true});}).forEach(function(g){
  var label='Asist · '+g.cat+(g.eq==='General'?'':' · '+g.eq),clean=label.replace(/[\[\]:*?\/\\]/g,'-');
  // Append a stable suffix if sanitizing/truncating can otherwise merge tab names.
  if(clean!==label||clean.length>95){var hash=2166136261;for(var i=0;i<label.length;i++)hash=Math.imul(hash^label.charCodeAt(i),16777619);clean=clean.slice(0,85)+' · '+(hash>>>0).toString(16);}
  var title=clean,suffix=2;while(Object.prototype.hasOwnProperty.call(out,title))title=clean.slice(0,90)+' · '+suffix++;
  var dates=Array.from(activityDates).sort(),people=Array.from(g.people.values()).sort(function(a,b){return a.name.localeCompare(b.name,'es',{numeric:true});});
  var rows=[['Jugador'].concat(dates.map(function(d){return d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4);}))];
  people.forEach(function(p){rows.push([p.name].concat(dates.map(function(d){var marks=p.marks.get(d);return !marks||!marks.size?'':marks.size>1?'Revisar':Array.from(marks)[0];})));});
  var totals=dates.map(function(d){
   var t={valid:0,present:0,meals:0,without:0,conflict:false};
   people.forEach(function(p){var marks=p.marks.get(d);if(!marks||!marks.size)return;if(marks.size>1){t.conflict=true;return;}t.valid++;var mark=Array.from(marks)[0];if(mark.charAt(0)==='P'||mark.charAt(0)==='T'){t.present++;if(mark.indexOf('🍴')>=0)t.meals++;else t.without++;}});
   return t;
  });
  function totalRow(label,key){return [label].concat(totals.map(function(t){return t.conflict?'Revisar':t.valid?t[key]:'Sin registros';}));}
  rows.push(totalRow('Total presentes','present'));
  if(food){rows.push(totalRow('Total comedor','meals'));rows.push(totalRow('Total vianda','without'));}
  out[title]=rows;
 });
 return out;
}
