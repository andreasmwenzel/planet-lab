import {execFileSync} from 'node:child_process';
import {build} from 'vite';
for(const file of ['main.js','physics.mjs','test-physics.mjs'])execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
execFileSync(process.execPath,['test-physics.mjs'],{stdio:'inherit'});
const result=await build({configFile:false,root:process.cwd(),build:{write:false}});
console.log('ISOLATED_BUILD_OK',result.output.map(x=>({name:x.fileName,bytes:(x.code||x.source).length})));
