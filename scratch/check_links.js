const fs = require('fs');
const path = require('path');

function checkFile(relPath) {
  const content = fs.readFileSync(relPath, 'utf8');
  const dir = path.dirname(relPath);
  const regex = /(?:href|src)="([^"#][^"]*)"/gi;
  let match;
  let broken = 0;
  while ((match = regex.exec(content)) !== null) {
    const link = match[1];
    if (link.startsWith('mailto:') || link.startsWith('http://') || link.startsWith('https://') || link.startsWith('data:')) continue;
    const cleanLink = link.split('?')[0].split('#')[0];
    if (!cleanLink) continue;
    const targetPath = path.resolve(dir, cleanLink);
    if (!fs.existsSync(targetPath)) {
      console.log('BROKEN in', relPath, ':', link, '=>', targetPath);
      broken++;
    }
  }
  console.log(relPath, 'Total broken links:', broken);
}

checkFile('pages/familias.html');
checkFile('pages/jugadores.html');
checkFile('index.html');

