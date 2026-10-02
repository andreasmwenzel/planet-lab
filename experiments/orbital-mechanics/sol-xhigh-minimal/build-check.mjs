import { build } from 'vite';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const result=await build({root,configFile:false,publicDir:false,logLevel:'silent',build:{write:false,emptyOutDir:false}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(bundle=>bundle.output);
console.log(JSON.stringify({status:'passed',write:false,root,outputs:outputs.map(o=>({fileName:o.fileName,type:o.type,bytes:Buffer.byteLength(o.type==='asset'?o.source:o.code)}))},null,2));
