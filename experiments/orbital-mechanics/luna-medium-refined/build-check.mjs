import { build } from 'vite';
const result = await build({
  configFile: false,
  root: new URL('.', import.meta.url).pathname,
  logLevel: 'warn',
  build: { write: false, rollupOptions: { input: new URL('./index.html', import.meta.url).pathname } }
});
if (!result) throw new Error('Vite build returned no bundle');
const groups = Array.isArray(result) ? result : [result];
const outputs = groups.reduce((n, group) => n + (group.output?.length ?? 0), 0);
if (!outputs) throw new Error('Vite build emitted no output');
console.log(`isolated Vite build (write:false): PASS (${outputs} output files)`);
