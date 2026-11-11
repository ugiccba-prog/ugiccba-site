(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MuniPilot=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  class PilotError extends Error{constructor(message,code){super(message);this.code=code;}}
  class Client{
    constructor({url,key,uid,getToken,storage,fetch:fetcher=(...args)=>globalThis.fetch(...args),id=()=>crypto.randomUUID(),clock=()=>performance.now(),lock}){
      if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw new PilotError('Falta la URL HTTPS del proyecto de piloto.','CONFIGURACION');
      if(!key||/^sb_secret_/.test(key))throw new PilotError('Usá una clave pública, nunca service_role.','CONFIGURACION');
      if(key.split('.').length===3){try{const part=key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const decoded=typeof atob==='function'?atob(part):Buffer.from(part,'base64').toString();if(JSON.parse(decoded).role!=='anon')throw Error();}catch{throw new PilotError('La clave de configuración no es pública.','CONFIGURACION');}}
      this.url=url;this.key=key;this.uid=uid;this.getToken=getToken;this.storage=storage;this.fetch=fetcher;this.id=id;this.clock=clock;
      this.storageKey='muni360_supabase_pilot_pending:'+uid;this.metrics=[];this.running=null;
      this.lock=lock||(globalThis.navigator?.locks?fn=>navigator.locks.request(this.storageKey,fn):fn=>{if(typeof window!=='undefined')throw new PilotError('Este navegador no permite bloquear pendientes entre pestañas. Usá Chrome actualizado.','ALMACENAMIENTO');return fn();});
    }
    pending(){const value=this.storage.getItem(this.storageKey);if(!value)return null;try{const p=JSON.parse(value);if(p.uid!==this.uid||!p.args?.p_request)throw Error();return p;}catch{throw new PilotError('El pendiente local necesita revisión; no se borró.','ALMACENAMIENTO');}}
    persist(value){try{if(value)this.storage.setItem(this.storageKey,JSON.stringify(value));else this.storage.removeItem(this.storageKey);}catch{throw new PilotError('No se pudo conservar el pendiente en este dispositivo. No cierres la pantalla.','ALMACENAMIENTO');}}
    async rpc(name,args={}){
      const token=await this.getToken(this.uid),start=this.clock();
      if(!token)throw new PilotError('Volvé a ingresar con Google.','SESION');
      let response,data;
      try{response=await this.fetch(this.url+'/rest/v1/rpc/'+name,{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{apikey:this.key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(20000)});data=await response.json();}
      catch{this.metrics.push({operation:name,ms:this.clock()-start,ok:false,kind:'network'});throw new PilotError('Sin confirmación. El pendiente queda en este dispositivo.','RED');}
      this.metrics.push({operation:name,ms:this.clock()-start,ok:response.ok,responseBytes:new TextEncoder().encode(JSON.stringify(data)).length});
      if(!response.ok){const code=data?.code==='40001'?'CONFLICTO':data?.code==='42501'?'PERMISOS':response.status===401?'SESION':response.status===429||response.status>=500?'RED':'VALIDACION';throw new PilotError(data?.message||'No se pudo confirmar la operación.',code);}
      return data;
    }
    async read(group,day){return this.rpc('mp_read_group',{p_group:group,p_day:day});}
    async save(snapshot,rows,{climate=snapshot.climate,points=snapshot.points}={}){
      const entry={uid:this.uid,args:{p_request:this.id(),p_group:snapshot.group_id,p_day:snapshot.day,p_season:snapshot.season,p_roster_revision:snapshot.roster_revision,p_revision:snapshot.revision,p_rows:rows.map(({id,state,semaphore,food})=>({id,state,semaphore,food})),p_climate:climate,p_points:points}};
      await this.lock(async()=>{if(this.pending()||this.running)throw new PilotError('Revisá la carga pendiente antes de guardar otra.','PENDIENTE');this.persist(entry);});return this.retry();
    }
    async retry(){
      if(this.running)return this.running;
      this.running=this.lock(async()=>{const entry=this.pending();if(!entry)return null;const result=await this.rpc('mp_save_attendance',entry.args);
        if(result?.ok!==true||result.request_id!==entry.args.p_request||result.group_id!==entry.args.p_group||result.season!==entry.args.p_season||result.revision!==entry.args.p_revision+1)throw new PilotError('Confirmación inesperada; se conservó el pendiente.','VERSION');
        const current=this.pending();if(current?.args.p_request===entry.args.p_request)this.persist(null);return result;
      }).finally(()=>{this.running=null;});return this.running;
    }
    async discard(requestId){return this.lock(async()=>{const p=this.pending();if(!p||p.args.p_request!==requestId)throw new PilotError('El pendiente cambió. Revisalo de nuevo.','CONFLICTO');this.persist(null);});}
  }
  return {Client,PilotError};
});
