import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const main = await readFile(new URL('./main.js', import.meta.url), 'utf8');
const css = await readFile(new URL('./style.css', import.meta.url), 'utf8');
const ids = new Set([...main.matchAll(/\bid="([\w-]+)"/g)].map(match => match[1]));
ids.add('app');
const queriedIds = new Set([...main.matchAll(/\$\('#([\w-]+)'\)/g)].map(match => match[1]));
for (const id of queriedIds) assert.ok(ids.has(id), `Static DOM target #${id} exists in the generated interface`);
assert.equal((html.match(/<script type="module" src="\.\/main\.js"><\/script>/g) || []).length, 1);
assert.ok(!/(?:https?:\/\/|@import|url\()/i.test(css), 'CSS uses no external or imported assets');
assert.ok(!/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB)\b/.test(main), 'No network calls or persistent origin storage');
assert.ok(!/\b(?:parent|top)\s*\./.test(main), 'No frame access');
assert.ok(css.includes('@media(max-width:650px)'), 'Small-screen layout is defined');
assert.ok(css.includes(':focus-visible'), 'Keyboard focus styling is defined');
console.log(JSON.stringify({ status: 'passed', staticDOMTargetsChecked: queriedIds.size, templateIds: ids.size, checks: ['Exact runtime script', 'Static DOM target presence', 'No remote or imported CSS assets', 'No runtime network calls', 'No persistent origin storage', 'No cross-frame access', 'Responsive rule presence', 'Focus-style presence'], limitation: 'Static source checks only. This does not verify actual DOM execution, browser rendering, interaction behavior, accessibility or performance.' }, null, 2));
