import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chartsHtml,timingConfounded} from '../src/charts.js';
import {orbitalReportHtml,numericalEvidenceHtml} from '../src/orbital-report.js';
import {resultRun,resultHref,parseRoute} from '../src/lab.js';
const root=new URL('../',import.meta.url);
const dirs=await readdir(new URL('experiments/orbital-mechanics/',root));
const runs=(await Promise.all(dirs.map(async id=>JSON.parse(await readFile(new URL(`experiments/orbital-mechanics/${id}/metadata.json`,root),'utf8'))))).filter(run=>run.kind==='controlled');
const exp={id:'orbital-mechanics',runs};
test('all 24 controlled conditions retain distinct code and numerical evidence',async()=>{
 assert.equal(runs.length,24);
 assert.equal(new Set(runs.map(r=>`${r.axes.model}/${r.axes.effort}/${r.axes.promptApproach}`)).size,24);
 assert.equal(new Set(runs.map(r=>r.provenance.sourceHashes['main.js'])).size,24);
 for(const r of runs){
  assert.equal(r.status,'available');assert.equal(r.build.numerical,'passed');
  assert.equal(r.build.independentVerification.exitCode,0);
  assert.equal(r.evaluation.status,'unscored');assert.equal(r.provenance.cost,null);assert.equal(r.provenance.tokenUsage,null);
  assert.equal(resultRun(exp,r.id),r);
  assert.equal(parseRoute(resultHref(exp.id,r.id)).variant,r.id);
  assert.match(numericalEvidenceHtml(r),/Numerical verification: passed/);
 }
});
test('chart and article keep interruption confounds and Ultra separation visible',()=>{
 assert.deepEqual(runs.filter(timingConfounded).map(r=>r.id).sort(),['sol-medium-bold','sol-medium-refined','sol-xhigh-minimal']);
 const chart=chartsHtml(exp,runs,runs[0],{metric:'time'},{});
 assert.equal((chart.match(/data-chart-run=/g)||[]).length,24);
 assert.equal((chart.match(/ · interrupted/g)||[]).length,3);
 assert.match(chart,/downtime and restart gaps/);
 const article=orbitalReportHtml(exp);
 assert.match(article,/24 products/);assert.match(article,/one sample per condition/);
 assert.match(article,/outside this 24-condition matrix/);assert.match(article,/not visual ratings/);
 assert.equal(orbitalReportHtml({id:'planetary'}),'');
});
