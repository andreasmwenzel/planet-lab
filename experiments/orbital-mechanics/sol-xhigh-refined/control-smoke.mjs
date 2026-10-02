/** Headless control logic check, not a browser or visual test. No dependencies. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import * as physics from './physics.js';
const startedAtUtc=new Date().toISOString(),checks=[];
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
class Element {
  constructor(id=''){this.id=id;this.value='';this.textContent='';this.innerHTML='';this.disabled=false;this.hidden=false;this.dataset={};this.attributes={};this.events={};this.style={};this.tagName='DIV';this.children=[];this.classes=new Set();this.classList={add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),toggle:(n,v)=>v?this.classes.add(n):this.classes.delete(n)};}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn);}
  dispatch(name,extra={}){for(const fn of this.events[name]??[])fn({target:this,preventDefault(){},...extra});}
  click(){if(!this.disabled)this.dispatch('click');}
  setAttribute(k,v){this.attributes[k]=v;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  getBoundingClientRect(){return{left:0,top:0,width:900,height:509,right:900,bottom:509};}
  setPointerCapture(){}
  showModal(){this.open=true;} close(){this.open=false;}
}
const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Element(match[1])]));
const get=id=>{assert.ok(nodes.has(id),`Missing real HTML element ${id}`);return nodes.get(id);};
const ctx=new Proxy({createRadialGradient(){return{addColorStop(){}};}},{get(target,key){return target[key]??(()=>{});},set(target,key,value){target[key]=value;return true;}});
get('orbit-canvas').getContext=()=>ctx;get('orbit-canvas').tagName='CANVAS';
const presetNodes=['leo','transfer','high'].map(name=>{const e=new Element();e.dataset.preset=name;e.querySelector=()=>({textContent:name});return e;});
const recipeNodes=['raise','lower','radial'].map(name=>{const e=new Element();e.dataset.recipe=name;return e;});
const brand=new Element(),documentEvents={},windowEvents={};let raf;
const context=vm.createContext({console,Intl,Math,Number,Object,Array,String,Date,Error,RangeError,
  document:{getElementById:get,querySelectorAll:selector=>selector==='[data-preset]'?presetNodes:selector==='[data-recipe]'?recipeNodes:[],querySelector:()=>brand,createElement:()=>new Element(),activeElement:new Element(),addEventListener:(n,f)=>{documentEvents[n]=f;},hidden:false},
  window:{devicePixelRatio:1,addEventListener:(n,f)=>{windowEvents[n]=f;}},
  ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){}},
  requestAnimationFrame:fn=>{raf=fn;},setTimeout:()=>1,clearTimeout:()=>{}
});
const physicsModule=new vm.SyntheticModule(Object.keys(physics),function(){for(const[key,value]of Object.entries(physics))this.setExport(key,value);},{context});
const source=readFileSync(new URL('./main.js',import.meta.url),'utf8').replace("import './styles.css';",'');
const main=new vm.SourceTextModule(source,{context,identifier:'main.js'});await main.link(specifier=>{assert.equal(specifier,'./physics.js');return physicsModule;});await main.evaluate();
function check(name,fn){fn();checks.push(name);console.log(`PASS ${name}`);}
check('Actual main.js initializes its real HTML IDs and numerical readouts',()=>{assert.ok(get('altitude').innerHTML.startsWith('400'));assert.ok(get('speed').innerHTML.includes('7.673'));assert.equal(get('execute').disabled,false);assert.equal(get('log-count').textContent,'0 burns');});
check('Execute records exactly one impulse and clears the draft',()=>{get('execute').click();assert.equal(get('log-count').textContent,'1 burn');assert.equal(get('mission-dv').textContent,'350 m/s');assert.equal(get('prograde').value,0);assert.equal(get('execute').disabled,true);assert.equal(get('undo').disabled,false);});
check('Playback advances analytical state and pauses on a draft change',()=>{get('play').click();raf(100);raf(200);assert.equal(get('elapsed').textContent,'00:00:10');get('radial').value='300';get('radial').dispatch('input');assert.equal(get('play').attributes['aria-pressed'],'false');assert.equal(get('radial-number').value,300);});
check('Scrubbing changes the burn point and restores a nonzero preview',()=>{get('position').value='500';get('position').dispatch('input');assert.equal(get('position-label').textContent,'50% of orbit');assert.equal(get('execute').disabled,false);});
check('Undo restores the exact original draft and burn point',()=>{get('undo').click();assert.equal(get('log-count').textContent,'0 burns');assert.equal(get('mission-dv').textContent,'0 m/s');assert.equal(get('prograde').value,350);assert.equal(get('radial').value,0);assert.equal(get('elapsed').textContent,'00:00:00');assert.ok(get('altitude').innerHTML.startsWith('400'));});
check('Zero impulse is disabled; presets and custom validation reset coherently',()=>{get('clear-burn').click();assert.equal(get('execute').disabled,true);presetNodes[1].click();assert.equal(get('apo-before').textContent,'35,786 km');assert.equal(get('peri-before').textContent,'300 km');get('peri-input').value='800';get('apo-input').value='700';get('orbit-form').dispatch('submit');assert.ok(get('orbit-error').textContent.includes('at least'));get('peri-input').value='500';get('apo-input').value='1000';get('orbit-form').dispatch('submit');assert.equal(get('peri-before').textContent,'500 km');assert.equal(get('apo-before').textContent,'1,000 km');});
check('Modal opens and closes; reset returns to the chosen custom orbit',()=>{get('model').click();assert.equal(get('model-dialog').open,true);get('got-it').click();assert.equal(get('model-dialog').open,false);recipeNodes[0].click();get('execute').click();get('reset').click();assert.equal(get('log-count').textContent,'0 burns');assert.equal(get('peri-before').textContent,'500 km');assert.equal(get('apo-before').textContent,'1,000 km');});
check('Collision coasting stops exactly at the modeled Earth surface',()=>{presetNodes[0].click();get('prograde').value='-500';get('prograde').dispatch('input');assert.equal(get('assessment-title').textContent,'Earth intercept');get('execute').click();get('position').value='1000';get('position').dispatch('input');assert.equal(get('impact-overlay').hidden,false);assert.ok(get('altitude').innerHTML.startsWith('0'));assert.equal(get('play').disabled,true);assert.equal(get('execute').disabled,true);get('rewind-impact').click();assert.equal(get('impact-overlay').hidden,true);assert.equal(get('play').disabled,false);});
check('Burn inputs clamp to their documented limits and camera controls run',()=>{get('prograde').value='9999';get('prograde').dispatch('input');assert.equal(get('prograde-number').value,3500);get('radial').value='-9999';get('radial').dispatch('input');assert.equal(get('radial-number').value,-2500);get('zoom-in').click();get('zoom-out').click();get('fit').click();get('orbit-canvas').dispatch('wheel',{deltaY:20});get('orbit-canvas').dispatch('pointerdown',{clientX:10,clientY:400,pointerId:7});get('orbit-canvas').dispatch('pointermove',{clientX:40,clientY:410,pointerId:7});assert.equal(get('orbit-canvas').style.cursor,'grabbing');get('orbit-canvas').dispatch('pointerup',{pointerId:7});assert.equal(get('orbit-canvas').style.cursor,'grab');});
check('Escape trajectories stop at the stated six-hour coast horizon',()=>{presetNodes[0].click();get('prograde').value='3500';get('prograde').dispatch('input');assert.equal(get('assessment-title').textContent,'Hyperbolic escape');get('execute').click();get('warp').value='1000';get('warp').dispatch('change');get('play').click();for(let i=0;i<160;i++)raf(1000+i*150);assert.equal(get('elapsed').textContent,'06:00:00');assert.equal(get('play').attributes['aria-pressed'],'false');assert.equal(get('play').disabled,true);get('position').value='0';get('position').dispatch('input');assert.equal(get('play').disabled,false);});
const report={startedAtUtc,endedAtUtc:new Date().toISOString(),passed:true,checks,scope:'Actual main.js with deterministic DOM/canvas stubs. This does not verify a real browser, rendering, layout, native events, accessibility, or performance.'};
writeFileSync(new URL('./control-smoke-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(`${checks.length}/${checks.length} headless control checks passed.`);
