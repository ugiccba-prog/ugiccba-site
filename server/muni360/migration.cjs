'use strict';
const {createHmac,randomUUID}=require('node:crypto');
const {empty}=require('./domain.cjs');
function parseLegacy(tables,idSecret){
  const s=empty(),rows=name=>(tables[name]||[]).slice(1),date=v=>{const x=String(v||'').slice(0,10),m=x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:x;};
  s.padron=rows('Padron').filter(r=>r[3]).map(r=>({id:String(r[5]||'')||(r[4]?createHmac('sha256',idSecret).update(String(r[4])).digest('hex'):randomUUID()),categoria:String(r[1]),equipo:String(r[2]||'General'),jugador:String(r[3]),dni:String(r[4]||'')}));
  s.asistencia=rows('Asistencia').filter(r=>r[4]).map(r=>({fecha:date(r[0]),categoria:String(r[2]),equipo:String(r[3]||'General'),jugador:String(r[4]),estado:String(r[5]),clima:'',puntosCiudad:''}));
  s.evaluaciones=rows('Evaluaciones').filter(r=>r[4]).map(r=>{const notas={};String(r[5]||'').split(' | ').forEach(part=>{const at=part.lastIndexOf(':');if(at>0){const n=Number(part.slice(at+1));if(Number.isFinite(n))notas[part.slice(0,at).trim()]=n;}});return {fecha:date(r[0]),categoria:String(r[2]),equipo:String(r[3]||'General'),jugador:String(r[4]),notas};});
  s.gestos=rows('Gestos').map(r=>String(r[0])).filter(Boolean);s.email=String(tables.Config?.[0]?.[1]||'');return s;
}
module.exports={parseLegacy};
