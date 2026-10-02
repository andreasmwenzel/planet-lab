import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
const ids = new Set([...source.matchAll(/id="([a-z][a-z0-9-]*)"/g)].map(m => m[1]).concat(['app']));
const refs = [...source.matchAll(/\$\('([a-z][a-z0-9-]*)'\)/g)].map(m => m[1]);
const missing = [...new Set(refs.filter(id => !ids.has(id)))];
if (missing.length) throw new Error('Missing static DOM IDs: ' + missing.join(','));
const result = { testedAtUTC: new Date().toISOString(), command: 'node audit-source.mjs', passed: true, staticElementCount: ids.size, uniqueLiteralReferences: new Set(refs).size, missingReferences: missing, limitations: 'Static source audit only; this is not a browser or interaction test.' };
writeFileSync(new URL('./source-audit.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
