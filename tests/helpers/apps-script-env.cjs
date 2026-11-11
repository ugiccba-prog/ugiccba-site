const vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const clone=v=>JSON.parse(JSON.stringify(v));
function environment(){
  const props=new Map(Object.entries({UGI_DATA_SHEET_ID:'private',UGI_OWNER_UID:'owner',UGI_FIREBASE_API_KEY:'test-key',UGI_FIREBASE_PROJECT_ID:'test-project',UGI_ID_SECRET:'test-secret',UGI_SHEET_MAP:JSON.stringify({Tenis:'tenis-public',Golf:'golf-public'})}));
  const books=new Map(),tokens=new Map(),requests=[];let next=1;
  const faults={write:false,ack:false,lookup:200,busy:false};
  const book=id=>{if(!books.has(id))books.set(id,[]);return books.get(id);};
  const decodeCell=v=>v?.userEnteredValue?.stringValue??v?.userEnteredValue?.numberValue??'';
  const Sheets={Spreadsheets:{
    get(id){return {sheets:book(id).map(s=>({properties:clone(s.properties)}))};},
    Values:{batchGet(id,{ranges}){return {valueRanges:ranges.map(n=>{const title=n.slice(1,-1).replace(/''/g,"'");const t=book(id).find(s=>s.properties.title===title);if(!t)throw Error('Missing table');const values=clone(t.values);while(values.length&&!values.at(-1).some(x=>x!==''))values.pop();values.forEach(r=>{while(r.length&&r.at(-1)==='')r.pop();});return {values};})};}},
    batchUpdate(body,id){
      requests.push({body:clone(body),id});if(faults.write===id||faults.write===true)throw Error('Sheets unavailable');
      const draft=clone(book(id));
      for(const req of body.requests){
        if(req.addSheet){const properties=clone(req.addSheet.properties);if(draft.some(s=>s.properties.sheetId===properties.sheetId||s.properties.title===properties.title))throw Error('Duplicate sheet');draft.push({properties,values:[]});}
        if(req.appendDimension){const {sheetId,dimension,length}=req.appendDimension;const t=draft.find(s=>s.properties.sheetId===sheetId);t.properties.gridProperties[dimension==='ROWS'?'rowCount':'columnCount']+=length;}
        if(req.updateCells){const {range,rows}=req.updateCells,t=draft.find(s=>s.properties.sheetId===range.sheetId);if(!t||range.endRowIndex>t.properties.gridProperties.rowCount||range.endColumnIndex>t.properties.gridProperties.columnCount)throw Error('Out of bounds');
          for(let r=range.startRowIndex;r<range.endRowIndex;r++){t.values[r]??=[];for(let c=range.startColumnIndex;c<range.endColumnIndex;c++)t.values[r][c]=decodeCell(rows[r-range.startRowIndex]?.values?.[c-range.startColumnIndex]);}
        }
      }
      books.set(id,draft);if(faults.ack===id||faults.ack===true){faults.ack=false;throw Error('Response lost AFTER atomic commit');}return {};
    }
  }};
  const ctx={console:{error(){},log(){}},Sheets,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),getProperties:()=>Object.fromEntries(props)})},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()],base64DecodeWebSafe:s=>[...Buffer.from(s,'base64url')],newBlob:a=>({getDataAsString:()=>Buffer.from(a).toString(),getBytes:()=>[...Buffer.from(a)]}),base64Decode:s=>[...Buffer.from(s,'base64')],base64Encode:a=>Buffer.from(a).toString('base64'),gzip:blob=>({getBytes:()=>[...zlib.gzipSync(Buffer.from(blob.getDataAsString()))]}),ungzip:blob=>({getDataAsString:()=>zlib.gunzipSync(Buffer.from(blob.getBytes())).toString()}),formatDate:(d,tz,pattern)=>{const time=require('../../assets/scripts/muni360-time.js');return pattern==='dd/MM/yyyy HH:mm:ss'?time.format(d).replace(' (ARG)',''):time.dateIso(d);}},
    LockService:{getScriptLock:()=>({tryLock:()=>!faults.busy,releaseLock(){}})},
    UrlFetchApp:{fetch(url,opt){const token=JSON.parse(opt.payload).idToken,entry=tokens.get(token),code=faults.lookup!==200?faults.lookup:entry?200:400;return {getResponseCode:()=>code,getContentText:()=>JSON.stringify(code===200?{users:[entry]}:{error:{message:'INVALID_ID_TOKEN'}})};}},
    ContentService:{MimeType:{JSON:1},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}};
  vm.createContext(ctx);for(const p of ['Muni360Domain.gs','Muni360Store.gs','DeportesUGI.gs','Muni360Core.gs'])vm.runInContext(fs.readFileSync('apps-script/'+p,'utf8'),ctx);
  ctx.resource=vm.runInContext('resource',ctx);
  function identity(uid,options={}){const sec=Math.floor(Date.now()/1000),claims={sub:uid,aud:'test-project',iss:'https://securetoken.google.com/test-project',exp:sec+3600,auth_time:sec,firebase:{sign_in_provider:'google.com'},...options.claims};const token='eyJhbGciOiJSUzI1NiJ9.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+next++;tokens.set(token,{localId:uid,email:uid+'@example.invalid',emailVerified:true,displayName:uid,validSince:'0',...options.account});return token;}
  const post=(token,path,body={})=>ctx.doPost({postData:{contents:JSON.stringify({...body,path,idToken:token})}});
  const owner=identity('owner'),teacher=identity('teacher');post(owner,'/api/me');post(teacher,'/api/me');
  const grant=(token=teacher,overrides={})=>{const uid=tokens.get(token).localId,list=post(owner,'/api/users/list').users,u=list.find(x=>x.uid===uid);return post(owner,'/api/users/update',{uid,revision:u.revision,rol:'Profe',status:'activo',areas:['Tenis'],capabilities:{},...overrides});};
  grant();
  const read=(token=owner,deporte='Tenis',extra={})=>post(token,'/api/operations',{tipo:'LECTURA',deporte,...extra});
  const write=(token,body)=>{const me=post(token,'/api/me').profile,snap=read(token,body.deporte||'Tenis'),base={tipo:body.tipo,deporte:body.deporte||'Tenis',categoria:body.categoria,equipo:body.equipo,fecha:body.fecha,jugador:body.jugador,subjectId:body.subjectId},key=ctx.resource(base);return post(token,'/api/operations',{deporte:base.deporte,requestId:crypto.randomUUID(),revision:snap.versiones[key]||0,temporada:snap.temporada,accessVersion:me.version,rosterRevision:snap.versiones[ctx.resource({tipo:'PADRON',categoria:body.categoria,equipo:body.equipo})]||0,roster:snap.padron.filter(p=>p.categoria===body.categoria&&p.equipo===body.equipo).map(p=>[p.id,p.jugador]),...body});};
  const seed=()=>write(owner,{tipo:'ALTA_PADRON',categoria:'Sub 12',equipo:'A',jugadores:[{jugador:'Persona de prueba',dni:'12345678'}]});
  return {ctx,props,books,tokens,requests,faults,identity,post,owner,teacher,grant,read,write,seed,clone};
}
module.exports={environment};
