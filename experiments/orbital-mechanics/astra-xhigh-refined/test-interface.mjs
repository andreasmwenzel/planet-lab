/** Node-only event-wiring test. This is not a browser, layout, or visual test. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as physics from './physics.mjs';
const html=fs.readFileSync(new URL('index.html',import.meta.url),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
let assertions=0;
const check=(condition,message)=>{assertions++;assert.ok(condition,message);};
class Element{
  constructor(id){this.id=id;this.value='';this.textContent='';this.hidden=false;this.checked=false;this.disabled=false;this.open=false;this.attrs={};this.events={};this.dataset={};this.tagName='DIV';this.classes=new Set();this.style={setProperty:(k,v)=>this.attrs[`style:${k}`]=v};this.classList={toggle:(k,v)=>v?this.classes.add(k):this.classes.delete(k),add:k=>this.classes.add(k),remove:k=>this.classes.delete(k)};}
  get valueAsNumber(){return this.value===''?NaN:Number(this.value);}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,fn){(this.events[k]??=[]).push(fn);}
  fire(k,extra={}){for(const fn of this.events[k]||[])fn({target:this,preventDefault(){},...extra});}
  click(){if(!this.disabled)this.fire('click');}
  getBoundingClientRect(){return {width:920,height:510,left:0,top:0,right:920,bottom:510};}
  focus(){}
  showModal(){this.open=true;}
  close(){this.open=false;}
  setPointerCapture(id){this.pointerId=id;}
  hasPointerCapture(id){return this.pointerId===id;}
  releasePointerCapture(){this.pointerId=null;}
}
function setup(canvasAvailable){
  const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
  const presets=['raise','geo','return'].map(name=>{const el=new Element(`preset-${name}`);el.dataset.preset=name;return el;});
  const labels=new Element('labels');let frame;
  const gradient={addColorStop(){}};
  const context=new Proxy({measureText:text=>({width:text.length*5}),createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(target,key)=>key in target?target[key]:(()=>{})});
  elements['orbit-canvas'].getContext=()=>canvasAvailable?context:null;
  elements.departure.value='400';elements.arrival.value='2000';elements.circularize.checked=true;elements.rate.value='auto';elements['canvas-fallback'].hidden=true;
  const document={hidden:false,events:{},getElementById:id=>elements[id],querySelectorAll:sel=>sel==='.preset'?presets:[],querySelector:sel=>sel==='.timeline-labels'?labels:null,addEventListener(k,fn){(this.events[k]??=[]).push(fn);}};
  const source=fs.readFileSync(new URL('main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  const names=Object.keys(physics);
  new Function(...names,'document','window','requestAnimationFrame','ResizeObserver',source)(...names.map(k=>physics[k]),document,{devicePixelRatio:1,addEventListener(){}},fn=>frame=fn,undefined);
  return {elements,presets,document,tick:ms=>frame(ms)};
}
for(const canvasAvailable of [true,false]){
  const {elements:e,presets,document,tick}=setup(canvasAvailable);
  check(e['canvas-fallback'].hidden===canvasAvailable,'Canvas unsupported fallback');
  check(e['total-dv'].textContent===physics.planTransfer(400,2000).totalDv.toFixed(3),'Initial total matches actual physics');
  tick(0); // Exercises the drawing path against a no-op canvas API, not actual rendering.
  presets[1].click();check(Number(e.arrival.value)===35786,'GEO preset applies');
  const geo=physics.planTransfer(400,35786);
  e['jump-arrival'].click();check(e['live-altitude'].textContent==='35,786','Arrival seek altitude');check(e['live-speed'].textContent===geo.v2.toFixed(3),'Arrival seek circular speed');
  e.circularize.checked=false;e.circularize.fire('change');check(e['live-speed'].textContent===geo.vt2.toFixed(3),'Skipping burn shows transfer speed');check(e['burn-two-direction'].textContent==='SKIPPED','Skipped burn card');
  e.timeline.value='10000';e.timeline.fire('input');check(e['live-altitude'].textContent==='400','Skipped insertion returns to departure');
  e.play.click();tick(0);tick(100);check(e['play-text'].textContent==='Pause','Replay starts');
  document.hidden=true;for(const fn of document.events.visibilitychange)fn();check(e['play-text'].textContent==='Continue','Hidden tab pauses playback');
  e.departure.value='';e.departure.fire('input');check(e.play.disabled,'Invalid input disables playback');check(!e['input-error'].hidden,'Invalid input feedback');
  e.departure.value='160';e.departure.fire('input');check(!e.play.disabled,'Valid input recovers playback');check(!e['low-orbit-note'].hidden,'Low orbit model warning');
  e.swap.click();check(Number(e.departure.value)===35786&&Number(e.arrival.value)===160,'Swap altitudes');
  e['arrival-range'].value='1000';e['arrival-range'].fire('input');check(Number(e.arrival.value)===50000,'Slider maximum is 50000 km');
  e['model-open'].click();check(e['model-dialog'].open,'Guide opens');e['model-close'].click();check(!e['model-dialog'].open,'Guide closes');
  e.vectors.click();e['zoom-in'].click();tick(200);check(e.vectors.attrs['aria-pressed']==='true','Velocity vector toggle');
  e.fit.click();e.reset.click();check(Number(e.departure.value)===400&&Number(e.arrival.value)===2000&&e.circularize.checked,'Reset restores mission');check(e.vectors.attrs['aria-pressed']==='false','Reset restores view preferences');
  e.arrival.value='400';e.arrival.fire('input');check(e['total-dv'].textContent==='0.000','Equal orbit costs zero');check(e['insight'].textContent.includes('No velocity change'),'Equal orbit explanation');
  tick(300);
}
console.log(JSON.stringify({passed:true,assertions,scope:'Node DOM/canvas stubs executing actual main.js event handlers; verifies control state and numerical readout wiring only. Does not verify browser rendering, real events, layout, accessibility tree, or performance.',cases:['normal canvas API path','unsupported canvas fallback','presets','seek to arrival','skip insertion','return orbit','replay','background pause','invalid and valid input','low-altitude warning','swap','slider limit','guide open/close','velocity toggle','zoom/fit','reset','same-altitude mission']},null,2));
