import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluationFor, implementationScore, parseRoute, experimentHref } from '../src/lab.js';
import { chartsHtml, chartValue, apiRates } from '../src/charts.js';
import { comparisonHtml, reviewFindingsHtml, sourceReference } from '../src/report.js';
import { inlineLocalStylesheets } from '../scripts/runtime-assets.mjs';
const reviews = { planetary: JSON.parse(await readFile(new URL('../reports/planetary-evaluations.json', import.meta.url), 'utf8')) };
const run = JSON.parse(await readFile(new URL('../experiments/planetary/luna-medium-minimal/metadata.json', import.meta.url), 'utf8'));
const exp = { id: 'planetary', runs: [run] };

test('review overlays never mutate generation evidence or leak across experiments', () => {
 const before = JSON.stringify(run);
 assert.equal(implementationScore(evaluationFor(run, reviews).implementation).earned, 7);
 assert.equal(evaluationFor(run, reviews).functional.scope, 'JavaScript syntax and isolated Vite bundle checks only');
 assert.equal(evaluationFor({...run,experimentId:'orbital-mechanics'}, reviews).implementation, undefined);
 assert.equal(JSON.stringify(run), before);
});
test('all 24 review totals come from five real scored criteria', () => {
 assert.equal(Object.keys(reviews.planetary).length,24);
 for(const review of Object.values(reviews.planetary)) {
  assert.deepEqual(implementationScore(review.implementation),{earned:review.total,possible:20});
  assert.equal(review.editorial,null);
  assert.equal(review.measurements.cost,null);
 }
 assert.equal(implementationScore({scores:[{value:Infinity}]}),null);
 assert.equal(implementationScore({scores:[]}),null);
});
test('both post routes round-trip selection, filters, chart view, and metric', () => {
 for(const id of ['planetary','orbital-mechanics']) {
  const filters={model:'Sol 6.1',effort:'xhigh',promptApproach:'bold'};
  const route=parseRoute(experimentHref(id,'sol-xhigh-bold',filters,'charts','api'));
  assert.deepEqual(route,{page:'experiment',id,variant:'sol-xhigh-bold',filters,view:'charts',metric:'api'});
  assert.equal(parseRoute(experimentHref(id,'sol-xhigh-bold',filters,'simulator')).view,undefined);
 }
 assert.equal(parseRoute('#/experiments/planetary?view=charts&metric=bad').metric,'time');
 assert.deepEqual(parseRoute('#/method'),{page:'about'});
 assert.deepEqual(parseRoute('#/about'),{page:'about'});
});
test('comparison table uses real reviews with linked build records and honest measures', () => {
 const html=comparisonHtml(exp,reviews.planetary,'/records.json');
 assert.match(html, /provisional|Provisional/);
 assert.match(html, /variant=luna-medium-minimal/);
 assert.match(html, /not model latency/);
 assert.match(html, /Tokens and cost are unavailable/);
 assert.match(html, /<strong>7<\/strong>/);
 assert.equal(comparisonHtml({id:'orbital-mechanics',runs:[{...run,experimentId:'orbital-mechanics'}]},undefined), '');
});
test('evidence stays readable inline and source URLs are restricted to run files', () => {
 const html=reviewFindingsHtml(reviews.planetary[run.id]);
 assert.match(html, /Definite fallback bug/);
 assert.match(html, /github.com\/andreasmwenzel\/planet-lab\/blob\/main\/experiments\/planetary/);
 assert.match(html, /#L41/);
 assert.doesNotMatch(sourceReference({file:'../../private',line:1}),/<a /);
 assert.match(sourceReference({file:'<script>',line:1}),/&lt;script&gt;/);
});
test('charts separate run timing, code scores, missing values, and API reference', () => {
 assert.equal(chartValue(run,'time',reviews),292);
 assert.equal(chartValue(run,'implementation',reviews),7);
 assert.equal(chartValue({...run,experimentId:'orbital-mechanics'},'implementation',reviews),null);
 assert.equal(chartValue({...run,provenance:{durationSeconds:null}},'time',reviews),null);
 const time=chartsHtml(exp,[run],run,{metric:'time'},reviews);
 assert.match(time,/292 s/);
 assert.match(time,/Actual run cost: unavailable/);
 assert.match(time,/data-chart-run="luna-medium-minimal"/);
 assert.doesNotMatch(time,/<iframe/);
 const prices=chartsHtml(exp,[run],run,{metric:'api'},reviews);
 assert.match(prices,/USD per million tokens/);
 assert.match(prices,/do not establish what these runs cost/);
 assert.deepEqual(apiRates.map(rate=>rate.output),[.5,10,50]);
 const pending=chartsHtml({id:'orbital-mechanics'},[{...run,experimentId:'orbital-mechanics'}],null,{metric:'implementation'},reviews);
 assert.match(pending,/Implementation reviews are pending/);
 assert.doesNotMatch(pending,/class="run-bar/);
});
test('local linked stylesheets are inlined with byte accounting and safe end tags', async()=>{
 const root=await mkdtemp(join(tmpdir(),'planet-css-'));
 try {
  const css='body{color:red}/* </style> */';
  await writeFile(join(root,'style.css'),css);
  const result=await inlineLocalStylesheets('<head><link rel="stylesheet" href="./style.css"></head>',root);
  assert.equal(result.cssBytes,Buffer.byteLength(css));
  assert.match(result.html,/<style>body/);
  assert.doesNotMatch(result.html,/<link/);
  assert.match(result.html,/<\\\/style>/);
  for(const path of ['../outside.css','https://example.com/style.css','/tmp/style.css']) await assert.rejects(inlineLocalStylesheets(`<link rel="stylesheet" href="${path}">`,root));
  await symlink('/etc/passwd',join(root,'outside.css'));
  await assert.rejects(inlineLocalStylesheets('<link rel="stylesheet" href="outside.css">',root),/escapes/);
  await writeFile(join(root,'style.css'),'body{background:url("data:image/png;base64,abc")}');
  await assert.doesNotReject(inlineLocalStylesheets('<link rel="stylesheet" href="style.css">',root));
  await writeFile(join(root,'style.css'),'@import "elsewhere.css";');
  await assert.rejects(inlineLocalStylesheets('<link rel="stylesheet" href="style.css">',root),/inline assets/);
 } finally {await rm(root,{recursive:true,force:true});}
});
