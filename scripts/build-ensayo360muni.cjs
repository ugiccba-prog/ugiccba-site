// Reproducible public bundle. Canonical portal/backend sources stay in their folders.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),out=path.join(root,'ensayo360muni'),check=process.argv.includes('--check'),files=new Map();
const read=p=>fs.readFileSync(path.join(root,p));const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const config={window:{}};vm.runInNewContext(read('assets/scripts/muni360-config.js').toString(),config);const c=config.window.MUNI_CONFIG;
if(c?.backend!=='supabase'||c.firebase?.projectId!=='muni360-ugi-ensayo'||c.apiBaseUrl!=='https://kaalffshnrkxviqaymhv.supabase.co/functions/v1/muni360')throw Error('Falta la configuración pública verificada de Supabase/Firebase.');
function remap(text){return text.replaceAll('../muni360cyc/','../colonia/').replaceAll('../muni360/','../deportes/');}
for(const dir of ['assets/scripts','assets/styles','assets/vendor'])for(const name of fs.readdirSync(path.join(root,dir))){if((dir.endsWith('scripts')&&/^muni360-[\w-]+\.js$/.test(name))||(dir.endsWith('styles')&&name==='muni360-cancha.css')||(dir.endsWith('vendor')&&['xlsx-0.20.3.full.min.js','SheetJS-LICENSE.txt'].includes(name))){const key=dir+'/'+name,b=read(key);files.set(key,name==='muni360-admin.js'?Buffer.from(remap(b.toString())):b);}}
files.set('escudo-ccba.png',read('escudo-ccba.png'));
function versionAssets(html){return html.replace(/((?:\.\.\/|\.\/)assets\/[^"'?]+\.(?:js|css))(?=["'])/g,(ref)=>{const b=files.get(ref.replace(/^\.\.?\//,''));if(!b)throw Error('Recurso no incluido: '+ref);return ref+'?v='+hash(b).slice(0,12);});}
for(const [src,target]of [['muni360/index.html','deportes/index.html'],['muni360cyc/index.html','colonia/index.html'],['admin/index.html','admin/index.html']]){let html=remap(read(src).toString());html=html.replaceAll('src="escudo-ccba.png"','src="../escudo-ccba.png"');files.set(target,Buffer.from(versionAssets(html)));}
files.set('index.html',read('apps/muni360/entrada.html'));
files.set('manifest.json',Buffer.from(JSON.stringify({format:'MUNI360_PUBLIC_BUNDLE_V1',base:'/ensayo360muni/',files:Object.fromEntries([...files].map(([p,b])=>[p,hash(b)]))},null,2)+'\n'));
function list(dir){return fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?list(path.join(dir,e.name)):[path.relative(out,path.join(dir,e.name)).split(path.sep).join('/')]):[];}
if(check){for(const[p,b]of files)if(!fs.existsSync(path.join(out,p))||!b.equals(fs.readFileSync(path.join(out,p))))throw Error('Regenerar con npm run build:ensayo360: '+p);for(const p of list(out))if(!files.has(p))throw Error('Archivo ajeno en el paquete público: '+p);}
else{fs.rmSync(out,{recursive:true,force:true});for(const[p,b]of files){fs.mkdirSync(path.dirname(path.join(out,p)),{recursive:true});fs.writeFileSync(path.join(out,p),b);}}
console.log((check?'Verified':'Built')+' /ensayo360muni/: '+files.size+' public files; no server code or private credentials.');
