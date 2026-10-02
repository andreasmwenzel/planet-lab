import {build} from 'vite';
const result=await build({configFile:false,root:process.cwd(),logLevel:'warn',build:{write:false,outDir:'unused-build-output',emptyOutDir:false,rollupOptions:{input:'index.html'}}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(r=>r.output||[]);
console.log(JSON.stringify({passed:true,write:false,outputs:outputs.map(o=>({file:o.fileName,bytes:Buffer.byteLength(o.code??o.source)}))},null,2));
