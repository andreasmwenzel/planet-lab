import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parseRoute, resultHref, resultRun } from '../src/lab.js';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
test('standalone links round-trip every published experiment result and baseline', async () => {
 const root = new URL('../experiments/', import.meta.url);
 let count = 0;
 for (const experiment of await readdir(root, { withFileTypes: true })) {
  if (!experiment.isDirectory()) continue;
  for (const run of await readdir(new URL(`${experiment.name}/`, root), { withFileTypes: true })) {
   if (!run.isDirectory()) continue;
   const metadata = await readFile(new URL(`${experiment.name}/${run.name}/metadata.json`, root), 'utf8').then(JSON.parse).catch(() => null);
   if (metadata?.status !== 'available' && !(experiment.name === 'planetary' && run.name === 'baseline')) continue;
   assert.deepEqual(parseRoute(resultHref(experiment.name, run.name)), { page: 'result', id: experiment.name, variant: run.name });
   count++;
  }
 }
 assert.ok(count >= 25);
});
test('standalone result selection is exact and excludes pending output', () => {
 const available = { id: 'published', status: 'available' };
 const experiment = { runs: [available, { id: 'pending', status: 'pending' }] };
 assert.equal(resultRun(experiment, 'published'), available);
 for (const id of ['missing', 'pending', '', undefined]) assert.equal(resultRun(experiment, id), undefined);
 assert.equal(resultRun(undefined, 'published'), undefined);
});
test('standalone routes reject encoded traversal, external URLs, and extra segments', () => {
 for (const hash of ['#/results/planetary/../baseline', '#/results/planetary/%2e%2e', '#/results/planetary/baseline/extra', '#/results//baseline', '#/results/https://evil/run']) {
  assert.deepEqual(parseRoute(hash), { page: 'not-found' });
 }
});
test('both post views share a new-tab link that updates with selection', () => {
 assert.match(main, /id="open-result" target="_blank" rel="noopener noreferrer" hidden/);
 assert.match(main, /resultLink.hidden = !selected/);
 assert.match(main, /resultLink.href = resultHref\(exp.id, selected.id\)/);
 assert.match(main, /resultLink.removeAttribute\('href'\)/);
 assert.doesNotMatch(main, /href="\$\{[^}]*\.runtime\}/);
});
test('standalone uses the same isolated viewer, restart, and exact-build return link', () => {
 assert.match(main, /route.page === 'result' && resultRun\(exp, route.variant\)/);
 assert.match(main, /viewer\(run\)/);
 assert.match(main, /experimentHref\(run.experimentId, run.id\)/);
 assert.match(main, /id="restart-runtime"/);
 assert.equal((main.match(/document\.createElement\('iframe'\)/g) || []).length, 1);
 assert.match(main, /setAttribute\('sandbox', 'allow-scripts'\)/);
 assert.match(main, /setAttribute\('referrerpolicy', 'no-referrer'\)/);
});
