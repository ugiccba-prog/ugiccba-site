import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {generateDemo} from './muni360-demo.mjs';
export function buildDemoSql(catalog){
 const demo=generateDemo(catalog);
 const groups=demo.activities.flatMap(a=>a.panel.gruposDetalle.map(g=>({activity:a.name,categoria:g.categoria,equipo:g.tira+' · DEMO',scenario:g.tira==='A'?'A':'B'})));
 const template=fs.readFileSync(new URL('../server/supabase/tools/demo-shared.sql',import.meta.url),'utf8');
 return template.replace('__DEMO_GROUPS__',JSON.stringify(groups));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [,,input,output]=process.argv;
 if(!input||!output)throw Error('Uso: node scripts/build-muni360-demo-sql.mjs catalogo.json salida.sql');
 fs.writeFileSync(output,buildDemoSql(JSON.parse(fs.readFileSync(input,'utf8'))),{flag:'wx'});
}
