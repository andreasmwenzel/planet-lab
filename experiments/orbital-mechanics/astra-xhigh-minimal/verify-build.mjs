import { build } from 'vite';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const result=await build({configFile:false,root,base:'./',publicDir:false,logLevel:'warn',build:{write:false,minify:true,cssCodeSplit:false,emptyOutDir:false}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(r=>r.output);
const summary=outputs.map(item=>({fileName:item.fileName,bytes:Buffer.byteLength(item.type==='chunk'?item.code:item.source)}));
if(!summary.some(item=>item.fileName==='index.html'))throw Error('Build produced no index.html');
console.log(JSON.stringify({status:'pass',write:false,outputs:summary},null,2));
