/** Instala apenas a vista e a leitura no checkout local informado. Não publica. */
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const target=process.argv[2];
if(!target||!path.isAbsolute(target))throw Error('Uso: node adaptadores/instalar-visual.mjs /caminho/absoluto/mvp_adv');
const pkg=JSON.parse(await readFile(path.join(target,'painel/package.json'),'utf8'));
if(!pkg.dependencies?.next)throw Error('O caminho não parece ser o mvp_adv: painel/package.json ausente ou incompatível.');
const files=[
 [path.join(here,'../prototipo/index.html'),'painel/public/escritorio-visual/index.html'],
 [path.join(here,'gabinete-estado.route.ts'),'painel/src/app/api/escritorio/estado/route.ts'],
 [path.join(here,'escritorio.page.tsx'),'painel/src/app/(app)/escritorio/page.tsx'],
];
// Pré-validação evita instalação pela metade em conflitos comuns. Arquivos iguais são idempotentes.
const tasks=[];
for(const [source,relative] of files){
 const dest=path.join(target,relative),content=await readFile(source,'utf8');
 try{await access(dest,constants.F_OK);if(await readFile(dest,'utf8')!==content)throw Error(`Não sobrescrevi o arquivo existente: ${relative}`);}
 catch(e){if(e.code!=='ENOENT')throw e;tasks.push({dest,relative,content});}
}
for(const t of tasks){await mkdir(path.dirname(t.dest),{recursive:true});await writeFile(t.dest,t.content,{encoding:'utf8',flag:'wx'});console.log('Criado: '+t.relative);}
console.log('Vista preparada em /escritorio. Adicione o atalho à sidebar e execute os checks do repositório.');
