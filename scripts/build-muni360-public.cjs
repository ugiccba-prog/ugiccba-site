// Reproducible public bundle. Canonical portal/backend sources stay in their folders.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),out=path.join(root,'muni360'),check=process.argv.includes('--check'),files=new Map();
const normalized=(p,b)=>p.endsWith('.png')?b:Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'));const read=p=>normalized(p,fs.readFileSync(path.join(root,p)));const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const config={window:{}};vm.runInNewContext(read('assets/scripts/muni360-config.js').toString(),config);const c=config.window.MUNI_CONFIG;
if(c?.backend!=='supabase'||c.firebase?.projectId!=='muni360-ugi-ensayo'||c.apiBaseUrl!=='https://kaalffshnrkxviqaymhv.supabase.co/functions/v1/muni360')throw Error('Falta la configuración pública verificada de Supabase/Firebase.');
function remap(text){return text.replaceAll('../muni360cyc/','../colonia/').replaceAll('../muni360/','../deportes/');}
for(const dir of ['assets/scripts','assets/styles','assets/vendor'])for(const name of fs.readdirSync(path.join(root,dir))){if((dir.endsWith('scripts')&&/^muni360-[\w-]+\.js$/.test(name))||(dir.endsWith('styles')&&['muni360-cancha.css','muni360-portal.css','muni360-theme.css'].includes(name))||(dir.endsWith('vendor')&&['xlsx-0.20.3.full.min.js','SheetJS-LICENSE.txt'].includes(name))){const key=dir+'/'+name,b=read(key);files.set(key,name==='muni360-admin.js'?Buffer.from(remap(b.toString())):b);}}
// Derive the timetable on every build from its canonical catalogue.
files.set('assets/scripts/muni360-catalogo.js',Buffer.from('(function(){\n'+read('comunidad/catalogo.js').toString().replace(/export const /g,'const ')+'\nwindow.MuniCommunityCatalog={horarios:HORARIOS_ENTRENAMIENTO};\n})();\n'));
files.set('escudo-ccba.png',read('escudo-ccba.png'));
function versionAssets(html){return html.replace(/((?:\.\.\/|\.\/)assets\/[^"'?]+\.(?:js|css))(?=["'])/g,(ref)=>{const b=files.get(ref.replace(/^\.\.?\//,''));if(!b)throw Error('Recurso no incluido: '+ref);return ref+'?v='+hash(b).slice(0,12);});}
function basePortal(html,area){
 const start=html.indexOf('      <!-- TARJETAS RÁPIDAS COLONIA Y COYFD -->'),end=html.indexOf('      <input type="hidden" id="login-profe">',start);
 if(start<0||end<0)throw Error('No se encontró el acceso de Base Formativa.');
 html=html.slice(0,start)+'      <p class="hint">'+(area==='Colonia'?'Grupos, asistencia y comedor.':'Grupos, iniciación y orientación deportiva.')+'</p>\n      <p><a href="../">Volver a los accesos de Muni360</a></p>\n\n'+html.slice(end);
 html=html.replaceAll('Colonia y COYFD',area).replaceAll('Base Formativa · Colonia de Vacaciones y COYFD',area==='Colonia'?'Colonia de Vacaciones':'COYFD · Iniciación y orientación deportiva');
 html=html.replace('Carga grupos de Colonia (con comedor 🍴) y COYFD (6 a 10 años), asistencias, evaluaciones y legajos UGI de muestra. No altera las planillas reales.','Explorá '+area+' con datos de muestra. No altera las planillas reales.');
 html=html.replace('<script src="../assets/scripts/muni360-config.js">','<script>window.MUNI_BASE_AREA='+JSON.stringify(area)+';</script>\n  <script src="../assets/scripts/muni360-config.js">');
 if(!html.includes('window.MUNI_BASE_AREA='))throw Error('Falta la actividad del portal.');
 return html;
}
for(const [src,target]of [['apps/muni360/source/deportes/index.html','deportes/index.html'],['apps/muni360/source/colonia/index.html','colonia/index.html'],['apps/muni360/source/colonia/index.html','coyfd/index.html'],['apps/muni360/source/admin/index.html','admin/index.html'],['apps/muni360/source/encuesta/index.html','encuesta/index.html']]){let html=remap(read(src).toString());if(['colonia/index.html','coyfd/index.html'].includes(target))html=basePortal(html,target.startsWith('coyfd')?'COYFD':'Colonia');html=html.replaceAll('src="escudo-ccba.png"','src="../escudo-ccba.png"');files.set(target,Buffer.from(versionAssets(html)));}
for(const name of ['index.html','competencia-config.mjs'])files.set('competencia/'+name,read('apps/muni360/source/competencia/'+name));
files.set('index.html',Buffer.from(versionAssets(read('apps/muni360/entrada.html').toString())));
for(const name of ['index.html','comunidad.js','catalogo.js','sw.js']){const file=read('comunidad/'+name);files.set('comunidad/'+name,name==='index.html'?Buffer.from(versionAssets(file.toString())):file);}
for(const name of ['favicon.png','logo-header.png'])files.set('assets/images/'+name,read('assets/images/'+name));
files.set('manifest.json',Buffer.from(JSON.stringify({format:'MUNI360_PUBLIC_BUNDLE_V1',base:'/muni360/',files:Object.fromEntries([...files].map(([p,b])=>[p,hash(b)]))},null,2)+'\n'));
function list(dir){return fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):[path.relative(out,path.join(dir,e.name)).split(path.sep).join('/')]):[];}
if(check){for(const[p,b]of files)if(!fs.existsSync(path.join(out,p))||!b.equals(normalized(p,fs.readFileSync(path.join(out,p)))))throw Error('Regenerar con npm run build:muni360-public: '+p);for(const p of list(out))if(!files.has(p))throw Error('Archivo ajeno en el paquete público: '+p);}
else{fs.rmSync(out,{recursive:true,force:true});for(const[p,b]of files){fs.mkdirSync(path.dirname(path.join(out,p)),{recursive:true});fs.writeFileSync(path.join(out,p),b);}}
console.log((check?'Verified':'Built')+' /muni360/: '+files.size+' public files; no server code or private credentials.');
