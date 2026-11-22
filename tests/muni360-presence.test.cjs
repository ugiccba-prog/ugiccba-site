const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function ui(){
 const nodes=new Map(),calls=[],events={};
 const element=()=>({isConnected:true,value:'',textContent:'',innerHTML:'',replaceChildren(){this.innerHTML='';},remove(){this.isConnected=false;nodes.delete(this.id);},querySelector(selector){return nodes.get(selector.slice(1));}});
 const app=element();app.prepend=box=>{nodes.set(box.id,box);for(const id of ['mp-date','mp-status','mp-results','mp-today','mp-refresh'])nodes.set(id,element());};
 nodes.set('app-screen',app);
 const c={document:{getElementById:id=>nodes.get(id),createElement:element,head:{append(){}}},window:{addEventListener:(name,fn)=>events[name]=fn},Muni360Time:require('../assets/scripts/muni360-time.js'),MuniGoogle:{call:(path,body)=>new Promise((resolve,reject)=>calls.push({path,body,resolve,reject}))}};
 vm.runInNewContext(fs.readFileSync('assets/scripts/muni360-presence.js','utf8'),c);
 const session={usuario:'coord',rol:'Coordinación',areas:['Colonia']};
 const result=(date,presentes=3)=>({date,generatedAt:'2026-11-22T15:00:00Z',activities:[{activity:'Colonia',presentes,tardes:1,ausentes:0,sinRegistrar:0,conflictos:0,sinRegistros:false,incompleta:false,grupos:[]}]});
 return {nodes,calls,events,session,result,mount:c.window.MuniPresence.mount};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('daily indicator mounts only for authorized Colonia/COYFD management profiles',()=>{
 const f=ui();f.mount({...f.session,rol:'Profe'});assert.equal(f.calls.length,0);
 f.mount({...f.session,areas:['Tenis']});assert.equal(f.calls.length,0);
 f.mount(f.session);assert.equal(f.calls.length,1);assert.equal(f.nodes.get('daily-presence-panel').open,false);assert.match(f.nodes.get('daily-presence-panel').innerHTML,/<summary>/);assert.equal(f.calls[0].path,'/api/dashboard');assert.equal(f.calls[0].body.daily,true);assert.deepEqual(Array.from(f.calls[0].body.activities),['Colonia']);
 f.mount(f.session);assert.equal(f.calls.length,1);f.mount(null);assert.equal(f.nodes.has('daily-presence-panel'),false);
});
test('changing dates clears old counts immediately and ignores late previous responses',async()=>{
 const f=ui();f.mount(f.session);const first=f.calls[0];
 f.nodes.get('mp-date').value='2026-11-21';f.nodes.get('mp-date').onchange();const second=f.calls[1];
 second.resolve(f.result('2026-11-21',5));await tick();assert.match(f.nodes.get('mp-results').innerHTML,/Total Colonia<\/th><td>5<\/td>/);
 first.resolve(f.result(first.body.date,99));await tick();assert.doesNotMatch(f.nodes.get('mp-results').innerHTML,/Total Colonia<\/th><td>99<\/td>/);
 f.nodes.get('mp-date').value='2026-11-20';f.nodes.get('mp-date').onchange();assert.equal(f.nodes.get('mp-results').innerHTML,'');
 f.calls[2].reject(Error('Sin conexión'));await tick();assert.match(f.nodes.get('mp-status').textContent,/No se pudo obtener un conteo confirmado/);assert.equal(f.nodes.get('mp-results').innerHTML,'');
});
test('no records is distinct from confirmed zero and saved attendance refreshes',async()=>{
 const f=ui();f.mount(f.session);const r=f.result(f.calls[0].body.date,0);r.activities[0].sinRegistros=true;r.activities[0].incompleta=true;
 f.calls[0].resolve(r);await tick();assert.match(f.nodes.get('mp-results').innerHTML,/Sin registros/);assert.doesNotMatch(f.nodes.get('mp-results').innerHTML,/Tardes|Ausentes|Sin registrar|En conflicto/);
 f.events['muni360-attendance-saved']();assert.equal(f.calls.length,2);
 f.calls[1].resolve(f.result(f.calls[1].body.date,0));await tick();assert.match(f.nodes.get('mp-results').innerHTML,/Total Colonia<\/th><td>0<\/td>/);assert.doesNotMatch(f.nodes.get('mp-results').innerHTML,/No equivale/);
});
test('logout while request is pending never restores private results',async()=>{
 const f=ui();f.mount(f.session);const pending=f.calls[0],results=f.nodes.get('mp-results');f.mount(null);pending.resolve(f.result(pending.body.date));await tick();assert.equal(results.innerHTML,'');
});
