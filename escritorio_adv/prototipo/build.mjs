import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=n=>readFile(path.join(dir,'src',n),'utf8');
const [shell,css,officeData,model,pixel,scene,app]=await Promise.all(['shell.html','style.css','office-data.mjs','model.mjs','pixel-scene.mjs','scene.mjs','app.mjs'].map(read));
// O arquivo final abre por file:// sem fetch, dependências ou servidor.
const strip=s=>s.replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'');
const script=[strip(officeData),strip(model),'const esc = escapeHtml;',strip(pixel),strip(scene),strip(app)].join('\n');
const html=shell.replace('/*__CSS__*/',css).replace('/*__SCRIPT__*/',script);
await writeFile(path.join(dir,'index.html'),html,'utf8');
console.log(`index.html gerado: ${Buffer.byteLength(html)} bytes; autocontido.`);
