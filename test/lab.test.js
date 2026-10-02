import test from 'node:test';
import assert from 'node:assert/strict';
import { availableRuns, filterRuns, axisOptions, parseRoute, experimentHref, safeRuntimePath, escapeHtml, editorialScore } from '../src/lab.js';
const runs = [
 {id:'a',status:'available',axes:{model:'Luna',effort:'medium',promptApproach:'minimal'}},
 {id:'b',status:'available',axes:{model:'Luna',effort:'max',promptApproach:'detailed'}},
 {id:'c',status:'pending',axes:{model:'Astra',effort:'xhigh',promptApproach:'bold'}},
];
test('pending runs are never playable',()=>assert.deepEqual(availableRuns({runs}).map(r=>r.id),['a','b']));
test('filters intersect without inventing an unavailable combination',()=>{
 assert.deepEqual(filterRuns(runs,{model:'Luna',effort:'medium'}).map(r=>r.id),['a']);
 assert.deepEqual(filterRuns(runs,{model:'Luna',effort:'medium',promptApproach:'detailed'}),[]);
});
test('unavailable axis combinations are disabled while selected axis can change',()=>{
 assert.deepEqual(axisOptions(runs,'effort',{model:'Luna'}),[{value:'medium',available:true},{value:'max',available:true},{value:'xhigh',available:false}]);
});
test('deep link preserves selected variant and encoded filters',()=>{
 const link=experimentHref('planetary','sol-xhigh-bold',{model:'Sol 6.1',effort:'xhigh',promptApproach:'bold'});
 assert.deepEqual(parseRoute(link),{page:'experiment',id:'planetary',variant:'sol-xhigh-bold',filters:{model:'Sol 6.1',effort:'xhigh',promptApproach:'bold'}});
 assert.deepEqual(parseRoute('#/method'),{page:'method'});
 assert.deepEqual(parseRoute(''),{page:'home'});
 assert.deepEqual(parseRoute('#/nothing'),{page:'not-found'});
});
test('runtime paths forbid external origins, traversal, and arbitrary files',()=>{
 assert.ok(safeRuntimePath('/experiments/planetary/baseline/index.html'));
 for(const value of ['https://evil.example/run','//example/run','/experiments/../index.html','/experiments/a/b/main.js','javascript:alert(1)'])assert.equal(safeRuntimePath(value),false);
});
test('all manifest text is escaped before HTML presentation',()=>assert.equal(escapeHtml('<script>"&\''),'&lt;script&gt;&quot;&amp;&#39;'));
test('unscored or invalid evaluations do not become editorial ratings',()=>{
 assert.equal(editorialScore({status:'unscored',editorial:null}),null);
 assert.equal(editorialScore({status:'scored',editorial:{scores:[{value:9}]}}),null);
 assert.deepEqual(editorialScore({status:'scored',editorial:{scores:[{value:3},{value:2}]}}),{earned:5,possible:8});
});
