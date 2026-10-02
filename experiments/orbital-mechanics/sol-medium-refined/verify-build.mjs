import {build} from 'vite';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const result=await build({root,configFile:false,logLevel:'warn',build:{write:false,emptyOutDir:false,rollupOptions:{input:path.join(root,'index.html')}}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(x=>x.output);
if(!outputs.some(x=>x.fileName.endsWith('.html')))throw new Error('HTML output missing');
if(!outputs.some(x=>x.type==='chunk'))throw new Error('JavaScript output missing');
console.log(JSON.stringify({status:'passed',write:false,outputs:outputs.map(x=>({fileName:x.fileName,bytes:Buffer.byteLength(x.type==='chunk'?x.code:x.source)}))},null,2));
