import { build } from 'vite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
assert.equal((html.match(/<script type="module" src="\.\/main\.js"><\/script>/g) || []).length, 1, 'exact scaffold script is present once');
const result = await build({
  root: new URL('.', import.meta.url).pathname,
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  build: {
    write: false,
    minify: true,
    assetsInlineLimit: 0,
    rollupOptions: { input: new URL('./index.html', import.meta.url).pathname },
  },
});
const bundles = Array.isArray(result) ? result : [result];
const output = bundles.flatMap(bundle => bundle.output).map(item => ({ file: item.fileName, type: item.type, bytes: Buffer.byteLength(item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : Buffer.from(item.source)) }));
assert.ok(output.some(item => item.file === 'index.html'));
assert.ok(output.some(item => item.type === 'chunk'));
assert.ok(output.some(item => item.file.endsWith('.css')));
console.log(JSON.stringify({ status: 'passed', write: false, configFile: false, output, totalBytes: output.reduce((a, b) => a + b.bytes, 0) }, null, 2));
