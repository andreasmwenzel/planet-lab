import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd=fileURLToPath(new URL('.',import.meta.url));
for(const args of [['--check','main.js'],['--check','physics.mjs'],['--check','test-physics.mjs'],['--check','test-interface.mjs'],['--check','test-build.mjs'],['test-physics.mjs'],['test-interface.mjs'],['test-build.mjs']]){
  console.log(`\n$ node ${args.join(' ')}`);
  const result=spawnSync(process.execPath,args,{cwd,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
console.log('\nALL CHECKS PASSED. Browser appearance, native interaction behavior, and performance were not checked.');
