/** Node-only DOM doubles: tests controller state transitions, NOT real browser rendering or behavior. */
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
const nodes=new Map(),groups=new Map(),results=[];
class NodeDouble {
  constructor(id='',tag='div',attrs=''){
    this.id=id;this.tagName=tag.toUpperCase();this.value=(attrs.match(/\bvalue="([^"]*)"/)||[])[1]||'';
    this.textContent='';this.innerHTML='';this.disabled=/\bdisabled\b/.test(attrs);this.style={};this.dataset={};this.listeners={};this.children=[];this.open=false;this.subnodes=new Map();
    this.classes=new Set(((attrs.match(/\bclass="([^"]*)"/)||[])[1]||'').split(/\s+/));
    this.classList={toggle:(c,on)=>{if(on===undefined)on=!this.classes.has(c);on?this.classes.add(c):this.classes.delete(c)},contains:c=>this.classes.has(c),remove:c=>this.classes.delete(c)};
  }
  setAttribute(k,v){this[k]=v}
  addEventListener(type,callback){(this.listeners[type]??=[]).push(callback)}
  trigger(type,event={}){for(const callback of this.listeners[type]||[])callback({target:this,preventDefault(){},...event})}
  click(){if(!this.disabled)this.trigger('click')}
  querySelector(selector){if(!this.subnodes.has(selector))this.subnodes.set(selector,new NodeDouble());return this.subnodes.get(selector)}
  replaceChildren(...children){this.children=children}
  append(child){this.children.push(child)}
  showModal(){this.open=true}
  close(){this.open=false}
  focus(){} select(){} setPointerCapture(){}
  closest(){return null}
  getBoundingClientRect(){return{width:850,height:500}}
  getContext(){return null}
}
for(const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi))nodes.set(match[3],new NodeDouble(match[3],match[1],match[2]));
for(const key of ['warp','burn','close']){
 const list=[];const expression=new RegExp(`<button\\b([^>]*data-${key}="([^"]+)"[^>]*)>`,'g');
 for(const match of html.matchAll(expression)){const node=new NodeDouble('','button',match[1]);node.dataset[key]=match[2];list.push(node)}
 groups.set(`[data-${key}]`,list);
}
nodes.get('preset').value='parking';
globalThis.document={getElementById:id=>{assert.ok(nodes.has(id),`Unknown DOM ID ${id}`);return nodes.get(id)},createElement:tag=>new NodeDouble('',tag),querySelectorAll:selector=>groups.get(selector)||[],querySelector:selector=>selector==='dialog[open]'?[...nodes.values()].find(n=>n.open)||null:null,addEventListener(){},hidden:false};
globalThis.window={devicePixelRatio:1};globalThis.ResizeObserver=class{constructor(callback){this.callback=callback}observe(){this.callback()}};
globalThis.requestAnimationFrame=()=>0;
const originalTimeout=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
const temporary=new URL('./.workflow-entry.mjs',import.meta.url);
await writeFile(temporary,(await readFile(new URL('./main.js',import.meta.url),'utf8')).replace("import './style.css';",''));
const get=id=>nodes.get(id),click=id=>get(id).click();
function check(name,value){results.push({name,passed:Boolean(value)});assert.ok(value,name)}
function input(id,value){get(id).value=String(value);get(id).trigger('input')}
try{
 await import(temporary.href);
 check('Actual controller initializes default guided plan',get('mission-action').innerHTML.includes('Execute departure'));
 check('Initial telemetry populated',get('stat-perigee').innerHTML.includes('400'));
 input('target-altitude',1500);
 check('Changed target blocks executing the stale plan',get('mission-action').disabled);
 click('plan-transfer');
 check('Replanning enables the updated maneuver',!get('mission-action').disabled&&get('plan-dv').innerHTML.length>0);
 input('target-altitude',1200);click('plan-transfer');click('mission-action');
 check('Departure advances guided workflow to coast',get('mission-action').innerHTML.includes('Coast to arrival'));
 check('Midflight target editing is locked',get('target-altitude').disabled);
 click('mission-action');
 check('Coast jump advances exact mission clock',get('sim-time').textContent==='00:50:21');
 check('Arrival burn becomes next action',get('mission-action').innerHTML.includes('Execute arrival'));
 check('Transport locked at arrival prevents drifting past burn point',get('play').disabled&&get('step').disabled);
 click('mission-action');
 check('Arrival completes guided workflow',get('mission-action').innerHTML.includes('Plan another transfer'));
 check('Completed target is circular in actual telemetry',get('stat-ecc').textContent==='0.0000'&&get('stat-perigee').innerHTML.includes('1,200'));
 check('Completed flight releases transport lock',!get('play').disabled);
 click('undo');
 check('Undo arrival restores arrival-ready state',get('mission-action').innerHTML.includes('Execute arrival')&&get('play').disabled);
 click('mission-action');click('manual-tab');input('transverse',100);input('radial',0);click('apply-manual');
 check('Free burn replaces the completed plan',get('plan-content').classList.contains('hidden'));
 check('Free burn clears inputs to prevent accidental duplicate burn',get('transverse').value==='0'&&get('apply-manual').disabled);
 click('undo');
 check('Undo restores free-burn values for deliberate retry',get('transverse').value==='100');
 click('reset');check('Reset asks before discarding flight',get('confirm-dialog').open);
 click('confirm-cancel');check('Cancel reset preserves flight time',get('sim-time').textContent==='00:50:21');
 click('reset');click('confirm-yes');check('Confirmed reset restores starting orbit and time',get('sim-time').textContent==='00:00:00'&&get('stat-perigee').innerHTML.includes('400'));
 check('Reset clears undo history',get('undo').disabled);
 get('preset').value='custom';get('preset').trigger('change');get('custom-perigee').value='500';get('custom-apogee').value='400';click('load-orbit');
 check('Invalid custom orbit leaves current flight intact',get('flight-title').textContent==='400 km parking orbit');
 get('custom-perigee').value='600';get('custom-apogee').value='12000';click('load-orbit');
 check('Valid custom ellipse loads',get('stat-perigee').innerHTML.includes('600')&&get('stat-apogee').innerHTML.includes('12,000'));
 check('Elliptical starts select the free-burn workflow',get('manual-tab').classList.contains('selected'));
 input('transverse','');check('Blank free-burn component is blocked',get('apply-manual').disabled);
 click('circularize');click('apply-manual');check('Circularize helper produces a circular orbit',get('stat-ecc').textContent==='0.0000');
 get('preset').value='parking';click('load-orbit');click('confirm-yes');click('manual-tab');input('transverse',-250);input('radial',0);
 check('Deorbit preview warns about surface intersection',get('preview-warning').textContent.includes('intersects Earth'));
 click('apply-manual');for(let i=0;i<100;i++)click('step');
 check('Surface encounter stops transport',get('play').disabled&&get('step').disabled&&get('orbit-class').textContent==='SURFACE ENCOUNTER');
 check('Surface encounter explains recovery',get('view-message').textContent.includes('Undo'));
 click('undo');check('Undo recovers an impacted flight',!get('play').disabled&&get('stat-perigee').innerHTML.includes('400'));
 const report={executedAt:new Date().toISOString(),command:'node workflow-tests.mjs',method:'Actual main.js controller imported with a Node-only DOM double; canvas context unavailable. Not a browser test.',passed:true,checks:results.length,results};
 await writeFile(new URL('./workflow-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{
 await unlink(temporary);globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClear;
}
