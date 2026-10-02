import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export async function inlineLocalStylesheets(html, directory) {
  const root = await realpath(directory);
  let cssBytes = 0;
  const links = [...html.matchAll(/<link\b[^>]*>/gi)];
  for (const match of links) {
    const tag = match[0];
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href || !/^(?:\.\/)?[a-zA-Z0-9_./-]+\.css$/.test(href) || href.startsWith('/') || href.split('/').includes('..')) throw new Error(`Unsupported stylesheet: ${href || tag}`);
    const path = await realpath(resolve(root, href));
    if (!path.startsWith(`${root}${sep}`)) throw new Error(`Stylesheet escapes run directory: ${href}`);
    const css = await readFile(path, 'utf8');
    if (/@import\b/i.test(css) || [...css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)].some(match => !match[2].startsWith('data:'))) throw new Error(`Stylesheet must contain only inline assets: ${href}`);
    cssBytes += Buffer.byteLength(css);
    const media = tag.match(/\bmedia\s*=\s*(["'])(.*?)\1/i)?.[2];
    const mediaAttribute = media ? ` media="${media.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"` : '';
    html = html.replace(tag, () => `<style${mediaAttribute}>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
  }
  return { html, cssBytes };
}
