import { build } from 'vite';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
const root=fileURLToPath(new URL('.',import.meta.url));
const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
assert.equal((html.match(/<script type="module" src="\.\/main\.js"><\/script>/g)||[]).length,1,'Exact harness module tag');
const result=await build({root,configFile:false,publicDir:false,logLevel:'silent',build:{write:false,emptyOutDir:false,cssCodeSplit:false,assetsInlineLimit:Infinity,minify:true,rollupOptions:{input:fileURLToPath(new URL('./index.html',import.meta.url))}}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(r=>r.output);
assert.ok(outputs.some(x=>x.type==='chunk'&&x.isEntry),'Entry bundle produced');
for(const output of outputs)if(output.type==='chunk'){assert.equal(output.imports.length,0,'No external imports');assert.equal(output.dynamicImports.length,0,'No runtime lazy loads');}
console.log(JSON.stringify({passed:true,configFile:false,write:false,outputs:outputs.map(o=>({fileName:o.fileName,type:o.type,bytes:Buffer.byteLength(o.type==='chunk'?o.code:o.source)}))},null,2));
