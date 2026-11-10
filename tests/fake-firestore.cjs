// Simulador de contratos para pruebas locales. No sustituye las pruebas con el emulador de Firebase.
const clone=v=>structuredClone(v);
function fakeFirestore(){
  const values=new Map();let serial=Promise.resolve(),ids=0;
  const snapshot=ref=>({ref,id:ref.id,exists:values.has(ref.path),data:()=>clone(values.get(ref.path))});
  class Ref{
    constructor(path){this.path=path;this.id=path.split('/').at(-1);}
    collection(name){return new Query(this.path+'/'+name);}
    get(){return Promise.resolve(snapshot(this));}
    async set(value,options){values.set(this.path,options?.merge?{...(values.get(this.path)||{}),...clone(value)}:clone(value));}
  }
  class Query{
    constructor(path,filters=[],sort=null,count=Infinity,cursor=null){Object.assign(this,{path,filters,sort,count,cursor});}
    doc(id='generated-'+(++ids)){return new Ref(this.path+'/'+id);}
    where(k,op,v){return new Query(this.path,[...this.filters,[k,op,v]],this.sort,this.count,this.cursor);}
    orderBy(k,d='asc'){return new Query(this.path,this.filters,[k,d],this.count,this.cursor);}
    limit(n){return new Query(this.path,this.filters,this.sort,n,this.cursor);}
    startAfter(c){return new Query(this.path,this.filters,this.sort,this.count,c);}
    async get(){let docs=[...values.keys()].filter(p=>p.startsWith(this.path+'/')&&!p.slice(this.path.length+1).includes('/')).map(p=>snapshot(new Ref(p)));for(const [k,op,v]of this.filters)docs=docs.filter(d=>{const a=d.data()[k];return op==='=='?a===v:op==='>'?a>v:op==='<='?a<=v:false;});if(this.sort){const [k,dir]=this.sort;docs.sort((a,b)=>{const x=k==='__name__'?a.id:a.data()[k],y=k==='__name__'?b.id:b.data()[k];return (x<y?-1:x>y?1:0)*(dir==='desc'?-1:1);});}if(this.cursor)docs=docs.filter(d=>d.id>this.cursor);docs=docs.slice(0,this.count);return {docs,size:docs.length};}
  }
  const writer=()=>{const staged=[];const w={get:ref=>ref.get(),set:(ref,value,options)=>staged.push(()=>values.set(ref.path,options?.merge?{...(values.get(ref.path)||{}),...clone(value)}:clone(value))),update:(ref,value)=>staged.push(()=>{if(!values.has(ref.path))throw Error('not found');values.set(ref.path,{...values.get(ref.path),...clone(value)});}),create:(ref,value)=>staged.push(()=>{if(values.has(ref.path))throw Error('already exists');values.set(ref.path,clone(value));}),delete:ref=>staged.push(()=>values.delete(ref.path)),commit:async()=>{for(const apply of staged)apply();}};return w;};
  const db={collection:name=>new Query(name),batch:writer,runTransaction(fn){const result=serial.then(async()=>{const tx=writer();const value=await fn(tx);await tx.commit();return value;});serial=result.catch(()=>{});return result;},values};return db;
}
module.exports={fakeFirestore};
