import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const files=Object.fromEntries(await Promise.all(['index.html','main.js','physics.mjs','style.css'].map(async name=>[name,await readFile(new URL(name,import.meta.url),'utf8')])));
const results=[];
function check(name,value){results.push({name,passed:Boolean(value)});assert.ok(value,name)}
check('HTML contains exactly the required module script',files['index.html'].match(/<script\b/g)?.length===1&&files['index.html'].includes('<script type="module" src="./main.js"></script>'));
const ids=[...files['index.html'].matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
check('HTML IDs are unique',new Set(ids).size===ids.length);
const literals=[...files['main.js'].matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
check('Every literal controller ID exists in HTML',literals.every(id=>ids.includes(id)));
const runtime=Object.values(files).join('\n');
check('No remote resource URLs',!/https?:\/\//.test(runtime));
check('No persistence, network, or cross-frame APIs',!/(?:localStorage|sessionStorage|indexedDB|document\.cookie|window\.(?:parent|top)|postMessage\(|fetch\(|XMLHttpRequest|WebSocket)/.test(runtime));
check('No CSS remote or secondary import',!/@import/.test(files['style.css']));
check('Canvas fallback is implemented',files['main.js'].includes('if(!ctx)'));
const report={executedAt:new Date().toISOString(),command:'node static-tests.mjs',passed:true,checks:results.length,results};
await writeFile(new URL('./static-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
