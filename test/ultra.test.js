import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { availableRuns, selectRun, resultRun, resultHref, parseRoute, plannedRunCount } from '../src/lab.js';
import { chartsHtml } from '../src/charts.js';
const directory = new URL('../experiments/orbital-mechanics/astra-ultra-game/', import.meta.url);
const run = JSON.parse(await readFile(new URL('metadata.json',directory),'utf8'));
test('Ultra is an optional extension, playable before the standard batch', () => {
 assert.equal(run.kind,'extension');
 assert.equal(run.provenance.modelId,'gpt-6-astra');
 assert.equal(run.provenance.effort,'ultra');
 assert.equal(run.provenance.tokenUsage,null);
 assert.equal(run.provenance.cost,null);
 const runs = availableRuns({runs:[run]});
 assert.equal(runs.filter(r=>r.kind==='controlled').length,0);
 assert.equal(selectRun(runs).id,run.id);
 assert.equal(resultRun({runs},run.id),run);
 assert.deepEqual(parseRoute(resultHref(run.experimentId,run.id)),{page:'result',id:run.experimentId,variant:run.id});
 assert.equal(plannedRunCount({models:[{efforts:['medium','max']},{efforts:['medium','xhigh']},{efforts:['medium','xhigh']}],approaches:['minimal','detailed','bold','refined']}),24);
 assert.doesNotMatch(chartsHtml({},runs,run,{},{}),/data-chart-run=/);
});
test('frozen runtime and retained validation sources match recorded hashes', async () => {
 for(const [file,hash] of Object.entries(run.provenance.sourceHashes)) assert.equal(createHash('sha256').update(await readFile(new URL(file,directory))).digest('hex'),hash,file);
});
test('extension has a distinct picker section and opens simulator from charts',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/aria-label="Additional builds"/);
 assert.match(main,/run.kind === 'extension' \? 'simulator' : route.view/);
});
