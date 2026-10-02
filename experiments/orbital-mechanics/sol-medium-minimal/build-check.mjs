import {build} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const result=await build({root,configFile:false,logLevel:'error',build:{write:false,emptyOutDir:false}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(x=>x.output).map(x=>({fileName:x.fileName,type:x.type,bytes:x.type==='chunk'?Buffer.byteLength(x.code):Buffer.byteLength(x.source)}));
console.log(JSON.stringify({status:'PASS',write:false,outputs},null,2));
