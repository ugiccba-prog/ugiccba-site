(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MuniImport=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  function parse(rows){
    if(!Array.isArray(rows)||rows.length<2)throw Error('El archivo necesita encabezados y al menos un deportista.');
    const headers=rows[0].map(normalize),find=names=>headers.findIndex(h=>names.includes(h));
    const full=find(['jugador','deportista','apellido y nombre','nombre completo']),last=find(['apellido','apellidos']),first=find(['nombre','nombres']),dni=find(['dni','documento']);
    if(full<0&&first<0)throw Error('Usá las columnas Apellido, Nombre y DNI; o Jugador y DNI. El DNI es opcional.');
    const people=[],seen=new Set();
    rows.slice(1).forEach((r,i)=>{
      if(!r.some(v=>String(v??'').trim()))return;
      const name=(full>=0?String(r[full]??''):last>=0?[r[last],r[first]].map(v=>String(v??'').trim()).filter(Boolean).join(', '):String(r[first]??'')).trim();
      const doc=dni>=0?String(r[dni]??'').trim():'';
      if(!name||name.length>160)throw Error('Revisá el nombre de la fila '+(i+2)+'.');
      if(doc&&!/^\d{7,8}$/.test(doc))throw Error('DNI inválido en la fila '+(i+2)+'. Usá 7 u 8 dígitos sin puntos.');
      if(seen.has(normalize(name)))throw Error('Hay un nombre duplicado en la fila '+(i+2)+'. Revisá antes de cargar.');
      seen.add(normalize(name));people.push({jugador:name,...(dni>=0?{dni:doc}:{})});
    });
    if(!people.length||people.length>500)throw Error('Cargá entre 1 y 500 deportistas por archivo.');
    return people;
  }
  return {parse};
});
