// Numerical suites can write reports beside their source. Run disposable copies
// so npm test never changes the frozen experiment evidence.
import {mkdtemp, cp, readFile, readdir, writeFile, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const temp=await mkdtemp(join(tmpdir(),'planet-lab-numerical-'));
try {
 await writeFile(join(temp,'package.json'),'{"type":"module"}');
 await symlink(join(root,'node_modules'),join(temp,'node_modules'),'dir');
 await cp(join(root,'experiments/orbital-mechanics'),join(temp,'experiments/orbital-mechanics'),{recursive:true});
 const discovered=spawnSync(process.execPath,['--test'],{cwd:temp,encoding:'utf8',timeout:120000});
 if(discovered.status!==0)throw new Error(`Discovered experiment tests: ${discovered.stdout}\n${discovered.stderr}`);
 console.log(discovered.stdout);
 let count=0;
 for(const id of await readdir(join(temp,'experiments/orbital-mechanics'))){
  const run=JSON.parse(await readFile(join(temp,'experiments/orbital-mechanics',id,'metadata.json'),'utf8'));
  if(run.kind!=='controlled')continue;
  const command=run.build.independentVerification.command;
  const match=command.match(/^node (experiments\/orbital-mechanics\/[a-z0-9-]+\/[a-zA-Z0-9_.-]+)$/);
  if(!match)throw new Error(`Unrecognized numerical command: ${command}`);
  const result=spawnSync(process.execPath,[match[1]],{cwd:temp,encoding:'utf8',timeout:120000});
  if(result.status!==0)throw new Error(`${id}: ${result.stdout}\n${result.stderr}\n${result.error||''}`);
  console.log(`PASS numerical suite: ${id}`); count++;
 }
 if(count!==24)throw new Error(`Expected 24 numerical suites, found ${count}`);
 for(const file of ['physics-tests.mjs','ui-smoke-tests.mjs']) {
  const result=spawnSync(process.execPath,[`experiments/orbital-mechanics/astra-ultra-game/${file}`],{cwd:temp,encoding:'utf8',timeout:120000});
  if(result.status!==0)throw new Error(`${file}: ${result.stdout}\n${result.stderr}`);
  console.log(`PASS preserved Ultra suite: ${file}`);
 }
} finally {await rm(temp,{recursive:true,force:true});}
