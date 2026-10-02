import {build} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const result=await build({configFile:false,root,logLevel:'warn',build:{write:false,emptyOutDir:false}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(x=>x.output);
console.log(JSON.stringify({pass:true,write:false,assets:outputs.map(x=>({name:x.fileName,bytes:x.type==='chunk'?Buffer.byteLength(x.code):Buffer.byteLength(x.source)}))},null,2));
