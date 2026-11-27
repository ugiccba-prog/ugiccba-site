// Lee un portal de Muni360 con la lógica compartida en línea, para que las pruebas
// que extraen y ejecutan los <script> del HTML vean el mismo código que el navegador.
const fs = require('node:fs'), path = require('node:path'), ROOT = path.resolve(__dirname, '../..');
const SHARED = /<script src="((?:\.\.?\/)assets\/scripts\/muni360-portal-comun\.js)(?:\?v=[^"]*)?"><\/script>/;
function readPortal(file) {
  const html = fs.readFileSync(file, 'utf8'), match = html.match(SHARED);
  if (!match) return html;
  // En las fuentes (apps/muni360/source) '../assets' se resuelve recién al compilar.
  const near = path.resolve(path.dirname(file), match[1]);
  const shared = fs.readFileSync(fs.existsSync(near) ? near : path.join(ROOT, 'assets/scripts/muni360-portal-comun.js'), 'utf8');
  return html.replace(SHARED, () => '<script>\n' + shared + '\n</script>');
}
module.exports = { readPortal };
