// Headless state-machine check. This is not a browser or rendering test.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as physics from './physics.js';
const nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{value:({target:'2000',tangent:'100',radial:'0',rate:'120'})[id]||'',disabled:false,textContent:'',innerHTML:'',classList:{toggle(){}},append(){},replaceChildren(){},getContext(){return null;},showModal(){},close(){}});return nodes.get(id);}
const context=vm.createContext({...physics,document:{querySelector:()=>node('app'),getElementById:node,querySelectorAll:()=>[],createElement:()=>node(`new-${Math.random()}`)},structuredClone,ResizeObserver:class{observe(){}},requestAnimationFrame(){},console});
let source=fs.readFileSync(new URL('./main.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');vm.runInContext(source,context);
const outcomes=[];
function check(name,fn){fn();outcomes.push({name,passed:true});}
check('Initial circular state offers transfer',()=>assert.equal(node('transfer').disabled,false));
node('transfer').onclick();
check('Departure locks target and enables arrival',()=>{assert.equal(node('target').disabled,true);assert.equal(node('arrival').disabled,false);assert.equal(node('transfer').disabled,true);});
const departurePlan=node('plan').innerHTML;
node('arrival').onclick();
check('Arrival pauses and prevents leaving apsis before second burn',()=>{assert.equal(node('play').disabled,true);assert.equal(node('coast').disabled,true);assert.equal(node('arrival').textContent,'Apply circularization burn');});
check('Guided cost preview remains fixed during transfer',()=>assert.equal(node('plan').innerHTML,departurePlan));
node('arrival').onclick();
check('Completion restores free flight at target altitude',()=>{assert.equal(node('target').disabled,false);assert.equal(node('play').disabled,false);assert.match(node('alt').textContent,/2,000/);assert.equal(node('ecc').textContent,'0.0000');assert.match(node('notice').textContent,/Transfer complete/);});
node('undo').onclick();
check('Undo circularization restores arrival state',()=>{assert.equal(node('target').disabled,true);assert.equal(node('play').disabled,true);assert.equal(node('arrival').textContent,'Apply circularization burn');});
node('burn').onclick();
check('Custom impulse cancels guided transfer',()=>{assert.equal(node('arrival').disabled,true);assert.equal(node('target').disabled,false);});
node('reset').onclick();
check('Reset clears maneuver budget and history',()=>{assert.equal(node('dv').textContent,'0 m/s');assert.equal(node('undo').disabled,true);assert.equal(node('ecc').textContent,'0.0000');});
node('tangent').value='20000';node('burn').onclick();
check('Out-of-range impulse is rejected without spending delta-v',()=>{assert.equal(node('dv').textContent,'0 m/s');assert.match(node('notice').textContent,/between/);});
console.log(JSON.stringify({passed:outcomes.length,scope:'Headless Node VM state logic, no browser/rendering coverage',outcomes},null,2));
