import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const script=fileURLToPath(new URL('../adaptadores/instalar-visual.mjs',import.meta.url));
test('instalador integra só três arquivos, é idempotente e protege arquivo existente',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'arao-installer-'));
 try{
  await mkdir(path.join(dir,'painel'),{recursive:true});await writeFile(path.join(dir,'painel/package.json'),JSON.stringify({dependencies:{next:'16.2.10'}}));
  let r=spawnSync(process.execPath,[script,dir],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const dest=path.join(dir,'painel/src/app/api/escritorio/estado/route.ts');assert.match(await readFile(dest,'utf8'),/getUsuarioAtual/);
  r=spawnSync(process.execPath,[script,dir],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  await writeFile(dest,'// arquivo alterado pelo projeto');r=spawnSync(process.execPath,[script,dir],{encoding:'utf8'});assert.notEqual(r.status,0);assert.equal(await readFile(dest,'utf8'),'// arquivo alterado pelo projeto');
 }finally{await rm(dir,{recursive:true,force:true});}
});
