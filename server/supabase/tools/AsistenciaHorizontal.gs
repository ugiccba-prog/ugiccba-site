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
