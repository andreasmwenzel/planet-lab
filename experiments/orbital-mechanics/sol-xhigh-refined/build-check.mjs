import { build } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const result = await build({
  root, configFile: false, publicDir: false, logLevel: 'warn',
  build: { write: false, emptyOutDir: false, outDir: join(root, '__not_written__'),
    rollupOptions: { input: join(root, 'index.html'), output: { inlineDynamicImports: true } } }
});
const results = Array.isArray(result) ? result : [result];
for (const entry of results) for (const file of entry.output) {
  const bytes = Buffer.byteLength(file.type === 'chunk' ? file.code : file.source);
  console.log(`${file.fileName}: ${bytes} bytes (write:false)`);
}
console.log('PASS isolated Vite build; no output files written.');
