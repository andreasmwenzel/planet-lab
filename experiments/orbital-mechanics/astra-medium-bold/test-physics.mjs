import assert from 'node:assert/strict';
import {MU,EARTH,circular,propagate,hohmann,targetAt,elements,impulse,stateAt} from './physics.mjs';
const results=[];
function test(name,value,tolerance){assert.ok(value<=tolerance,`${name}: ${value} exceeds ${tolerance}`);results.push({name,value,tolerance,passed:true});}
const r=EARTH+400,s=circular(r),period=2*Math.PI*Math.sqrt(r**3/MU),flight=propagate(s,[],period*10,10),e0=elements(s);
let energyDrift=0,hDrift=0;for(const p of flight.samples){const el=elements(p.state);energyDrift=Math.max(energyDrift,Math.abs((el.energy-e0.energy)/e0.energy));hDrift=Math.max(hDrift,Math.abs((el.h-e0.h)/e0.h));}
test('Circular orbit: relative energy drift over 10 periods',energyDrift,1e-8);
test('Circular orbit: relative angular momentum drift over 10 periods',hDrift,1e-8);
const end=flight.samples.at(-1).state;test('Circular orbit: 10-period closure in km',Math.hypot(end[0]-s[0],end[1]-s[1]),.01);
for(const [from,to] of [[400,1200],[1800,500],[400,5000]]){const r1=EARTH+from,r2=EARTH+to,h=hohmann(r1,r2),run=propagate(circular(r1),[{time:0,prograde:h.dv1,radial:0},{time:h.time,prograde:h.dv2,radial:0}],h.time,10),p=run.samples.at(-1).state,q=targetAt(r2,h.phase,h.time);test(`Hohmann ${from}→${to}: rendezvous separation km`,Math.hypot(p[0]-q[0],p[1]-q[1]),.001);test(`Hohmann ${from}→${to}: relative speed m/s`,1000*Math.hypot(p[2]-q[2],p[3]-q[3]),.001);test(`Hohmann ${from}→${to}: final eccentricity`,elements(p).e,1e-6);assert.equal(run.executed.length,2);test(`Hohmann ${from}→${to}: second burn timing seconds`,Math.abs(run.executed[1].time-h.time),1e-10);}
const z=impulse([0,7000,-7,0],100,200);test('Tangential/radial impulse vector error km/s',Math.hypot(z[2]+7.1,z[3]-.2),1e-12);
const crash=propagate(circular(EARTH+400),[{time:0,prograde:-1500,radial:0}],10000);assert.ok(crash.impact);assert.ok(crash.samples.at(-1).t<10000);results.push({name:'Earth-contact termination',passed:true,time:crash.samples.at(-1).t});
const event=propagate(s,[{time:12.345,prograde:100,radial:0}],30);test('Non-grid event placement seconds',Math.abs(event.executed[0].time-12.345),1e-12);test('stateAt preserves post-burn state',Math.hypot(...stateAt(event.samples,12.345).map((v,i)=>v-event.executed[0].state[i])),1e-12);
console.log(JSON.stringify({passed:results.length,results},null,2));
