const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'scratch/estadisticas-preview');
function copy(src,dest){const target=path.join(out,dest);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,src),target);}
copy('apps/muni360/estadisticas-preview/entrada.html','index.html');
for(const name of ['index.html','estadisticas.mjs'])copy('apps/muni360/estadisticas-preview/'+name,'estadisticas/'+name);
for(const name of ['index.html','competencia-config.mjs'])copy('apps/muni360/source/competencia/'+name,'competencia/'+name);
for(const name of ['muni360-config.js','muni360-google.js'])copy('assets/scripts/'+name,'assets/scripts/'+name);
console.log('Preview preparado: '+out);
