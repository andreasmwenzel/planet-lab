/** Lightweight DOM/Canvas API smoke harness. Not a browser, layout, or screenshot test. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const noCanvas=process.argv.includes('--no-canvas'),elements=new Map(),speedButtons=[],docEvents=new Map();
let raf=null,drawCalls=0,viewport={width:1024,height:750};
const ctx=new Proxy({measureText:text=>({width:String(text).length*5.5}),createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})}, {
 get(target,key){if(key in target)return target[key];return (...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`Canvas ${String(key)} received ${a}`);drawCalls++;};},set(target,key,value){target[key]=value;return true;}
});
class Classes{constructor(){this.s=new Set();}add(n){this.s.add(n);}remove(n){this.s.delete(n);}toggle(n,on){if(on===undefined)on=!this.s.has(n);on?this.s.add(n):this.s.delete(n);return on;}contains(n){return this.s.has(n);}}
class Element{
 constructor(tag='DIV',id=''){this.tagName=tag.toUpperCase();this.id=id;this.style={};this.dataset={};this.classList=new Classes();this.listeners=new Map();this.disabled=false;this.hidden=false;this.value='';this._html='';this.children=[];this.textContent='';this.attributes={};}
 set innerHTML(v){this._html=v;this.children=parse(v);}
 get innerHTML(){return this._html;}
 set className(v){this.classList=new Classes();v.split(/\s+/).forEach(s=>this.classList.add(s));}
 setAttribute(k,v){this.attributes[k]=String(v);}
 addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list);}
 dispatch(name,extra={}){for(const fn of this.listeners.get(name)||[])fn({target:this,preventDefault(){},...extra});}
 click(){if(!this.disabled)this.dispatch('click');}
 focus(){document.activeElement=this;}
 closest(sel){return sel==='[data-action]'&&this.dataset.action?this:null;}
 querySelectorAll(){return this.children.filter(e=>['BUTTON','INPUT','SELECT'].includes(e.tagName)&&!e.disabled);}
 getBoundingClientRect(){return {left:0,top:0,...viewport};}
 getContext(){return noCanvas?null:ctx;}
 setPointerCapture(){}
}
function parse(html){const result=[];for(const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)){const tag=match[1],attrs=match[2],id=attrs.match(/\bid="([^"]+)"/)?.[1],el=new Element(tag,id);for(const a of attrs.matchAll(/([\w-]+)="([^"]*)"/g)){const [,k,v]=a;if(k.startsWith('data-'))el.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;else if(k==='class')el.className=v;else if(['value','min','max','type'].includes(k))el[k]=v;else el.attributes[k]=v;}el.disabled=/\bdisabled(?:\s|$)/.test(attrs);el.hidden=/\bhidden(?:\s|$)/.test(attrs);if(id)elements.set(id,el);if(el.dataset.speed)speedButtons.push(el);result.push(el);}return result;}
const source=await readFile(new URL('./index.html',import.meta.url),'utf8');parse(source);
globalThis.document={getElementById:id=>elements.get(id)||null,querySelectorAll:sel=>sel==='[data-speed]'?speedButtons:[],body:new Element('body'),activeElement:new Element('body'),hidden:false,addEventListener:(n,fn)=>docEvents.set(n,fn)};
globalThis.window={devicePixelRatio:1,innerWidth:1200,addEventListener(){},scrollTo(){}};
globalThis.requestAnimationFrame=fn=>{raf=fn;};
const $=id=>elements.get(id),results=[];
const test=(name,fn)=>{try{fn();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:e.stack});}};
const action=(name,extra={})=>{const target=new Element('button');target.dataset={action:name,...extra};$('modal').dispatch('click',{target});};
const input=(id,value)=>{$(id).value=String(value);$(id).dispatch('input');};
await import('./main.js');
test('Boot creates a paused orientation dialog and valid flight readouts',()=>{assert.ok($('modal').innerHTML.includes('A small ship'));assert.equal($('missionName').textContent,'A little higher');assert.ok($('altitude').innerHTML.includes('400'));assert.equal($('executeButton').disabled,true);assert.equal($('canvasFallback').hidden,!noCanvas);});
test('Dialog close restores the flight without starting time',()=>{action('close');assert.equal($('modalBackdrop').hidden,true);assert.equal($('playIcon').textContent,'▶');});
test('Direct numeric control previews and executes a budgeted maneuver',()=>{input('tangentNumber',211.0859793705453);assert.equal($('executeButton').disabled,false);assert.ok($('previewApo').innerHTML.includes('1,200'));$('executeButton').click();assert.equal($('deliverButton').disabled,false);assert.equal($('undoButton').disabled,false);assert.ok($('fuelUsed').textContent.includes('211.1'));});
test('Rewind restores fuel, orbit, mission readiness, and control state',()=>{$('undoButton').click();assert.ok($('fuelUsed').textContent.startsWith('0.0'));assert.equal($('deliverButton').disabled,true);assert.equal($('undoButton').disabled,true);assert.equal($('executeButton').disabled,true);});
test('Keyboard burn and rewind work while a button has focus',()=>{input('tangentNumber',211.0859793705453);$('executeButton').focus();docEvents.get('keydown')({key:'b',code:'KeyB',preventDefault(){}});assert.equal($('deliverButton').disabled,false);docEvents.get('keydown')({key:'r',code:'KeyR',preventDefault(){}});assert.equal($('deliverButton').disabled,true);assert.ok($('fuelUsed').textContent.startsWith('0.0'));});
test('Over-budget preview blocks the execute control',()=>{input('tangentNumber',900);assert.equal($('executeButton').disabled,true);assert.ok($('planWarning').textContent.includes('Not enough'));$('clearPlan').click();assert.equal($('planWarning').hidden,true);});
test('Every campaign route completes through UI event handlers and earns three seals',()=>{for(let i=0;i<6;i++){action('mission',{index:String(i)});for(let j=0;j<8&&$('deliverButton').disabled;j++){$('advisorButton').click();if(!$('executeButton').disabled)$('executeButton').click();}assert.equal($('deliverButton').disabled,false,'route '+i);$('deliverButton').click();assert.ok($('modal').innerHTML.includes('DISPATCH CONFIRMED'),'route '+i);action('close');}assert.equal($('sealCount').textContent,'18');});
test('Manifest, generated routes, and fresh-flight reset are wired',()=>{$('contractsButton').click();assert.ok($('modal').innerHTML.includes('6 OF 6'));action('random');assert.match($('missionName').textContent,/Route 0107/);assert.equal($('missionTime').textContent,'00:00:00');assert.equal($('executeButton').disabled,true);assert.equal($('sealCount').textContent,'18');});
test('Route-code selection reproduces the same dispatch and advances the next suggestion',()=>{action('dispatch-dialog');$('dispatchSeed').value='812';action('dispatch-start');assert.equal($('missionName').textContent,'Route 0812');const target=$('missionBrief').textContent;action('dispatch-dialog');assert.equal($('dispatchSeed').value,'813');$('dispatchSeed').value='812';action('dispatch-start');assert.equal($('missionBrief').textContent,target);});
test('Pause and time-warp controls advance only the chosen simulation time',()=>{speedButtons.find(b=>b.dataset.speed==='60').click();$('playButton').click();raf(1000);raf(2000);assert.equal($('missionTime').textContent,'00:00:06');$('playButton').click();raf(3000);assert.equal($('missionTime').textContent,'00:00:06');});
test('Future maneuver departure, clearing, and apsis controls are wired',()=>{action('mission',{index:'1'});$('advisorButton').click();$('executeButton').click();$('nodeApo').click();assert.ok(Number($('delayNumber').value)>40);assert.ok($('executeButton').innerHTML.includes('Coast &'));$('clearPlan').click();assert.equal(Number($('delayNumber').value),0);assert.equal(Number($('tangentNumber').value),0);});
test('Atmospheric recall, failure dialog, and rewind work through UI',()=>{action('sandbox-dialog');$('sandboxAltitude').value='400';action('sandbox-start');input('tangentNumber',-500);$('executeButton').click();$('coastPeri').click();assert.ok($('modal').innerHTML.includes('FLIGHT RECALLED'));action('rewind');assert.equal($('modalBackdrop').hidden,true);assert.ok($('fuelRemaining').innerHTML.includes('∞'));assert.equal($('playButton').disabled,false);});
test('Manual section switches, escape-to-close, and flight recorder work',()=>{$('helpButton').click();action('manual-tab',{tab:'model'});assert.ok($('modal').innerHTML.includes('universal-variable'));docEvents.get('keydown')({key:'Escape',preventDefault(){}});assert.equal($('modalBackdrop').hidden,true);$('recorderButton').click();assert.ok($('modal').innerHTML.includes('FLIGHT RECORDER'));action('close');});
test('Render loop tolerates desktop and narrow canvas sizes with finite drawing coordinates',()=>{raf(4000);viewport={width:375,height:545};window.innerWidth=375;action('mission',{index:'3'});raf(5000);$('advisorButton').click();raf(6000);assert.ok(noCanvas||drawCalls>1000);});
test('Hiding the tab pauses the simulation',()=>{$('playButton').click();document.hidden=true;docEvents.get('visibilitychange')();assert.equal($('playIcon').textContent,'▶');});
const report={suite:noCanvas?'DOM smoke with unavailable Canvas2D':'DOM and Canvas API smoke (not a real browser)',passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,canvasDrawCalls:drawCalls,tests:results,limitations:['Mock DOM and Canvas API only. No browser, CSS layout, pointer gesture, screen reader, audio, or pixel-level visual validation.']};
await writeFile(new URL(noCanvas?'./fallback-test-results.json':'./ui-smoke-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
