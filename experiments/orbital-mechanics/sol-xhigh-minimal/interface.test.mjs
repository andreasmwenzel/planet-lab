// Source-level orchestration audit using lightweight DOM stubs. This is not a
// browser rendering, usability, or performance check. Only CSS/physics import
// locations are adapted; the product's actual main.js event handlers run.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EARTH_RADIUS,norm,elements,hohmann} from './physics.mjs';
class Element {
  constructor(id=''){this.id=id;this.value='';this.listeners={};this.children=[];this.style={};this.dataset={};this.hidden=false;this.disabled=false;this.attributes={};this.queries={};const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,v)=>v?classes.add(x):classes.delete(x),contains:x=>classes.has(x)};}
  addEventListener(type,handler){(this.listeners[type]??=[]).push(handler);}
  dispatch(type){if(this.disabled&&(type==='click'||type==='input'))return;for(const f of this.listeners[type]??[])f({target:this,preventDefault(){},clientX:0,clientY:0});}
  setAttribute(key,value){this.attributes[key]=value;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  querySelector(selector){return this.queries[selector]??=new Element(selector);}
  getBoundingClientRect(){return {left:0,top:0,right:700,bottom:440,width:700,height:440};}
  getContext(){return null;}
  setPointerCapture(){}
  showModal(){this.open=true;}
  close(){this.open=false;}
  focus(){document.activeElement=this;}
  select(){this.selected=true;}
  get scrollHeight(){return this.children.length*50;}
}
const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
const nodes=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
const special={'.brand':new Element('brand'),'.tabs':new Element('tabs')};
const targets=[2000,35786,100000].map(n=>{const e=new Element();e.dataset.target=String(n);return e;});
const ticks=Array.from({length:5},()=>new Element());
globalThis.document={activeElement:null,body:new Element('body'),getElementById:id=>nodes[id]??null,createElement:tag=>new Element(tag),querySelector:selector=>special[selector]??null,querySelectorAll:selector=>selector==='[data-target]'?targets:selector==='.timeline-ticks span'?ticks:[]};
globalThis.window={devicePixelRatio:1};globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;}observe(){this.callback();}};
globalThis.requestAnimationFrame=()=>0;globalThis.setTimeout=()=>0;
for(const[id,value]of Object.entries({preset:'ellipse',perigee:'400',apogee:'20000',tangential:'250',radial:'0',tangentialRange:'250',radialRange:'0',burnAt:'now',transferFrom:'400',transferTo:'35786',timeWarp:'100',timeline:'0'}))nodes[id].value=value;
let source=await readFile(new URL('./main.js',import.meta.url),'utf8');
source=source.replace("import './style.css';",'').replace("from './physics.mjs'",`from '${new URL('./physics.mjs',import.meta.url).href}'`);
source+='\nglobalThis.__flightAudit={get sim(){return sim;},advanceTo,updateReadouts,currentState,get undoCount(){return undoStack.length;}};';
await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const app=globalThis.__flightAudit;let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const click=id=>nodes[id].dispatch('click');
check(app.sim.title==='Elliptical playground','default mission loads');
check(nodes.altitudeMetric.innerHTML.includes('400'),'initial altitude readout');
check(nodes.mapWrap.children.length===1,'canvas-unavailable fallback stays independently visible');
nodes.perigee.value='500';nodes.apogee.value='400';click('loadOrbit');
check(nodes.orbitError.textContent.length>0,'invalid apsidal input reports validation');
check(app.sim.title==='Elliptical playground','invalid input preserves mission');
nodes.preset.value='leo';nodes.preset.dispatch('change');
check(elements(app.sim.anchor).e<1e-12,'LEO preset is circular');
check(nodes.burnAt.querySelector('option[value="apoapsis"]').disabled,'circular orbit has no selectable apogee');
nodes.tangential.value='-500';nodes.radial.value='0';click('applyBurn');
check(app.undoCount===1&&app.sim.totalDv===500,'burn records delta-v and undo state');
app.advanceTo(1000000);app.updateReadouts();
check(app.sim.crashed&&!app.sim.running,'large time jump stops at first surface event');
check(Math.abs(norm(app.currentState().r)-EARTH_RADIUS)<1e-5,'high-warp stop is within 1 cm of the physical surface event');
check(Math.abs(norm(app.sim.anchor.r)-EARTH_RADIUS)>1,'impact uses propagated state, not mutated initial radius');
check(nodes.playButton.disabled&&nodes.applyBurn.disabled,'impact blocks dependent controls');
click('undoBurn');
check(!app.sim.crashed&&app.sim.totalDv===0,'undo restores pre-burn ledger and safe mission');
check(!nodes.playButton.disabled,'undo re-enables playback');
click('transferTab');check(nodes.orbitControls.hidden&&!nodes.transferControls.hidden,'planner tab changes actual panel');
nodes.transferTo.value='400';nodes.transferTo.dispatch('input');
check(nodes.flyTransfer.disabled&&nodes.transferError.textContent.length>0,'same-radius transfer rejected');
nodes.transferTo.value='35786';nodes.transferTo.dispatch('input');
click('flyTransfer');
const planned=hohmann(400,35786);
check(app.sim.pending!==null&&app.sim.running,'transfer starts autopilot');
check(app.sim.warp===1000&&nodes.timeWarp.value==='1000','transfer sets both numerical and displayed warp');
check(Math.abs(app.sim.totalDv-Math.abs(planned.dv1))<1e-9,'departure budget actual burn');
app.advanceTo(planned.coast+100000);app.updateReadouts();
check(!app.sim.pending&&!app.sim.running,'arrival completes and pauses even on overshoot');
check(elements(app.sim.anchor).e<1e-9,'actual UI arrival orbit circularized');
check(Math.abs(app.sim.elapsed-planned.coast)<1e-9,'arrival stops at the exact coast time');
check(Math.abs(app.sim.totalDv-planned.totalDv)<1e-9,'flight budget includes both burns');
click('resetFlight');
check(app.sim.pending!==null&&app.sim.elapsed===0&&!app.sim.running,'reset restores transfer departure and scheduled arrival');
nodes.timeWarp.value='10';nodes.timeWarp.dispatch('change');
check(app.sim.warp===10,'time warp selector updates simulation');
nodes.tangential.value='100';click('applyBurn');
check(!app.sim.pending,'manual burn cancels automatic circularization');
click('undoBurn');
check(app.sim.pending!==null&&app.sim.warp===10&&nodes.timeWarp.value==='10','undo restores autopilot and synchronizes warp');
click('resetFlight');
check(app.sim.warp===1000&&nodes.timeWarp.value==='1000','reset synchronizes displayed saved warp');
click('exportFlight');
const exported=document.body.children[0];check(exported.open,'export opens local dialog');
const exportData=JSON.parse(exported.querySelector('textarea').value);
check(exportData.constants.earthRadiusKm===EARTH_RADIUS&&exportData.pendingArrival!==null,'export contains actual flight data and constants');
exported.querySelector('.primary-button').dispatch('click');
check(exported.querySelector('textarea').selected,'origin-independent manual-copy export selects JSON');
click('modelButton');check(nodes.modelDialog.open,'model assumptions dialog opens');click('closeModel');check(!nodes.modelDialog.open,'model dialog closes');
console.log(`PASS source-level interface audit: ${checks} assertions across default load, validation, presets, burn/undo, high-warp impact, planner/autopilot, reset, export, and model notes.`);
console.log('No browser, localhost, visual, native DOM, or performance checks were performed.');
