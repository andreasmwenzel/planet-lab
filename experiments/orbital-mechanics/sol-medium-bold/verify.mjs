import {spawnSync} from 'node:child_process';
import {writeFileSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build,version} from 'vite';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('.',import.meta.url));
for (const file of ['main.js','physics.js','physics.test.mjs','verify.mjs']) {
  const run=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
}
const tests=spawnSync(process.execPath,['physics.test.mjs'],{cwd:root,encoding:'utf8'});
assert.equal(tests.status,0,tests.stderr);
const numerical=JSON.parse(tests.stdout);
writeFileSync(new URL('test-results.json',import.meta.url),JSON.stringify(numerical,null,2)+'\n');
const html=readFileSync(new URL('index.html',import.meta.url),'utf8');
assert.equal((html.match(/<script type="module" src="\.\/main\.js"><\/script>/g)||[]).length,1);
const bundle=await build({root,configFile:false,logLevel:'warn',build:{write:false,emptyOutDir:false,outDir:root+'unused-build-output',assetsInlineLimit:Infinity}});
const outputs=(Array.isArray(bundle)?bundle:[bundle]).flatMap(b=>b.output).map(o=>({file:o.fileName,bytes:Buffer.byteLength(o.type==='chunk'?o.code:o.source)}));
assert.ok(outputs.some(o=>o.file.endsWith('.html')));
assert.ok(outputs.some(o=>o.file.endsWith('.js')));
const summary={command:'node verify.mjs',node:process.version,vite:version,syntax:{files:4,pass:true},numericalChecks:numerical.checks,build:{pass:true,write:false,configFile:false,outputs},browserChecks:'Not performed; localhost browser access is unavailable.'};
writeFileSync(new URL('verification-results.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
