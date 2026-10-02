import { build } from 'vite';
import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceRoot = join(root, 'experiments');
let count = 0;
for (const experiment of await readdir(sourceRoot, { withFileTypes: true })) {
  if (!experiment.isDirectory()) continue;
  for (const variant of await readdir(join(sourceRoot, experiment.name), { withFileTypes: true })) {
    if (!variant.isDirectory()) continue;
    const directory = join(sourceRoot, experiment.name, variant.name);
    if (variant.name !== 'baseline' && !(await stat(join(directory, 'metadata.json')).catch(() => null))?.isFile()) continue;
    const template = join(directory, 'index.html');
    if (!(await stat(template).catch(() => null))?.isFile()) continue;
    let html = await readFile(template, 'utf8');
    const entry = join(directory, 'main.js');
    if ((await stat(entry).catch(() => null))?.isFile()) {
      const marker = '<script type="module" src="./main.js"></script>';
      if (!html.includes(marker)) throw new Error(`${template} must contain ${marker}`);
      const result = await build({
        configFile: false,
        root: directory,
        publicDir: false,
        logLevel: 'warn',
        build: {
          write: false,
          minify: true,
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          lib: { entry, name: 'PlanetLabExperiment', formats: ['iife'], fileName: 'runtime' },
          rollupOptions: { output: { inlineDynamicImports: true } },
        },
      });
      const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
      const javascript = outputs.filter(output => output.type === 'chunk').map(output => output.code).join('\n');
      const css = outputs.filter(output => output.type === 'asset' && output.fileName.endsWith('.css')).map(output => output.source).join('\n');
      const unsupported = outputs.filter(output => output.type === 'asset' && !output.fileName.endsWith('.css'));
      if (unsupported.length) throw new Error(`Runtime has non-inline assets: ${unsupported.map(asset => asset.fileName).join(', ')}`);
      // Escape HTML end tags so source strings cannot terminate their container.
      html = html.replace(marker, () => `<script>${javascript.replace(/<\/script/gi, '<\\/script')}</script>`);
      html = html.replace('</head>', () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head>`);
    }
    // No remote resource hints, fetches, frames, forms, popups, or parent access.
    // Inline code only; the viewer additionally gives the document an opaque origin.
    const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
    html = html.replace(/<head([^>]*)>/i, match => `${match}<meta http-equiv="Content-Security-Policy" content="${csp}">`);
    const destination = join(root, 'public', 'experiments', experiment.name, variant.name);
    await mkdir(destination, { recursive: true });
    await writeFile(join(destination, 'index.html'), html);
    console.log(`Built ${experiment.name}/${variant.name} (${Math.round(Buffer.byteLength(html) / 1024)} kB)`);
    count++;
  }
}
console.log(`${count} isolated runtime${count === 1 ? '' : 's'} ready.`);
