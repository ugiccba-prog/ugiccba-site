(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MuniImport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  function normalizeTeam(value){
    const clean=String(value??'').trim().replace(/\s+/g,' ');
    const short=clean.replace(/^tira\s+/i,'').trim();
    if(/^[a-z]$/i.test(short))return short.toUpperCase();
    if(/^general$/i.test(clean))return 'General';
    return clean;
  }
  function parse(rows){
    if(!Array.isArray(rows)||rows.length<2)throw Error('El archivo necesita encabezados y al menos un deportista.');
    const headers=rows[0].map(normalize),find=names=>headers.findIndex(h=>names.includes(h));
    const full=find(['jugador','deportista','apellido y nombre','nombre completo']),last=find(['apellido','apellidos']),first=find(['nombre','nombres']),dni=find(['dni','documento']),category=find(['categoria','categoria / grupo','grupo']),team=find(['tira','equipo','equipo / tira']);
    const hasRouting=category>=0||team>=0;
    if(full<0&&first<0)throw Error('Usá las columnas Apellido, Nombre y DNI; o Jugador y DNI. El DNI es opcional.');
    const people=[],seen=new Set();
    rows.slice(1).forEach((r,i)=>{
      if(!r.some(v=>String(v??'').trim()))return;
      const name=(full>=0?String(r[full]??''):last>=0?[r[last],r[first]].map(v=>String(v??'').trim()).filter(Boolean).join(', '):String(r[first]??'')).trim();
      const doc=dni>=0?String(r[dni]??'').trim():'';
      if(!name||name.length>160)throw Error('Revisá el nombre de la fila '+(i+2)+'.');
      if(doc&&!/^\d{7,8}$/.test(doc))throw Error('DNI inválido en la fila '+(i+2)+'. Usá 7 u 8 dígitos sin puntos.');
      const categoria=category>=0?String(r[category]??'').trim():'';
      const equipo=team>=0?normalizeTeam(r[team]):'';
      const duplicateKey=hasRouting?[normalize(name),normalize(categoria),normalize(equipo||'General')].join('|'):normalize(name);
      if(seen.has(duplicateKey))throw Error('Hay un nombre duplicado en la fila '+(i+2)+'. Revisá antes de cargar.');
      seen.add(duplicateKey);people.push({jugador:name,...(dni>=0?{dni:doc}:{}),...(category>=0?{categoria}:{}),...(team>=0?{equipo}:{})});
    });
    if(!people.length||people.length>500)throw Error('Cargá entre 1 y 500 deportistas por archivo.');
    return people;
  }
  return {parse,normalizeTeam};
});
