import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root=fileURLToPath(new URL('.',import.meta.url));
const html=fs.readFileSync(new URL('index.html',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('main.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('style.css',import.meta.url),'utf8');
assert.equal((html.match(/<script type="module" src="\.\/main\.js"><\/script>/g)||[]).length,1,'Exact required module script');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'Unique HTML IDs');
for(const match of main.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(match[1]),`UI element ${match[1]} exists`);
for(const content of [html,main,css]){
  assert.doesNotMatch(content,/https?:\/\//,'No external resources');
  assert.doesNotMatch(content,/\b(?:localStorage|sessionStorage|fetch|XMLHttpRequest)\b/,'No storage or runtime networking');
}
const result=await build({root,configFile:false,logLevel:'warn',build:{write:false,emptyOutDir:false,minify:'esbuild',assetsInlineLimit:Infinity,rollupOptions:{input:fileURLToPath(new URL('index.html',import.meta.url))}}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(x=>x.output);
assert.ok(outputs.some(x=>x.fileName.endsWith('.html')),'Vite emitted HTML');
assert.ok(outputs.some(x=>x.type==='chunk'&&x.isEntry),'Vite emitted entry');
console.log(JSON.stringify({passed:true,build:'isolated Vite build, write:false, configFile:false',root,htmlIds:ids.length,files:outputs.map(x=>({fileName:x.fileName,type:x.type,bytes:Buffer.byteLength(x.type==='chunk'?x.code:x.source)}))},null,2));
