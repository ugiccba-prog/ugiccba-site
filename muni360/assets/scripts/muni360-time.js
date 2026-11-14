(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.Muni360Time=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const zone='America/Argentina/Buenos_Aires';
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const dayOnly=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
  function parts(value){
    const date=value instanceof Date?value:new Date(value);
    if(value===null||value===undefined||value===''||!Number.isFinite(date.getTime()))return null;
    return Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  }
  function dateIso(value=new Date(),daysBack=0){
    let result;
    if(dayOnly(value)){
      const check=new Date(value+'T12:00:00Z');
      if(!Number.isFinite(check.getTime())||check.toISOString().slice(0,10)!==value)return '';
      result=value;
    }else{const p=parts(value);if(!p)return '';result=p.year+'-'+p.month+'-'+p.day;}
    const days=Math.trunc(Math.abs(Number(daysBack)||0));
    if(!days)return result;
    const date=new Date(result+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-days);
    return date.toISOString().slice(0,10);
  }
  function format(value){
    if(dayOnly(value)){const iso=dateIso(value);return iso?iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4):'—';}
    const p=parts(value);return p?p.day+'/'+p.month+'/'+p.year+' '+p.hour+':'+p.minute+':'+p.second+' (ARG)':'—';
  }
  function toInput(value){const p=parts(value);return p?p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute:'';}
  function fromInput(value){
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Fecha y hora de Argentina invalidas.');
    const [year,month,day,hour,minute]=value.match(/\d+/g).map(Number);
    const wall=Date.UTC(year,month-1,day,hour,minute);let candidate=wall;
    for(let i=0;i<3;i++){
      const p=parts(candidate);
      candidate+=wall-Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));
    }
    const date=new Date(candidate);
    if(toInput(date)!==value)throw Error('Fecha y hora de Argentina invalidas.');
    return date.toISOString();
  }
  function displayJson(value){return JSON.stringify(value,(key,v)=>['fecha','expiresAt'].includes(key)&&typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)?format(v):v,2);}
  return {zone,dateIso,format,toInput,fromInput,displayJson};
});
