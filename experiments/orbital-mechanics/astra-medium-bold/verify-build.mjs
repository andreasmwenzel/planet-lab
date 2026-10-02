import {build} from 'vite';
const result=await build({configFile:false,root:new URL('.',import.meta.url).pathname,logLevel:'warn',build:{write:false,emptyOutDir:false,rollupOptions:{input:new URL('./index.html',import.meta.url).pathname}}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(r=>r.output);
console.log(JSON.stringify({passed:true,write:false,files:outputs.map(x=>({name:x.fileName,bytes:typeof x.code==='string'?Buffer.byteLength(x.code):Buffer.byteLength(x.source)}))},null,2));
