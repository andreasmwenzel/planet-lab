import assert from 'node:assert/strict';
import {MU,R,length,elements,propagate,burn,circular,transfer,timeToApoapsis} from './physics.mjs';
const results=[];
function near(name,a,b,tol){const error=Math.abs(a-b);assert.ok(error<=tol,`${name}: ${a} versus ${b}, error ${error} > ${tol}`);results.push({name,error,tolerance:tol});}
const s=circular(),o=elements(s),quarter=propagate(s,o.period/4);
near('Circular quarter-period x, km',quarter.r[0],0,1e-7);near('Circular quarter-period y, km',quarter.r[1],R+400,1e-7);
const full=propagate(s,o.period);near('One-period closure, km',length(full.r.map((x,i)=>x-s.r[i])),0,1e-7);
const tr=transfer(R+400,R+2000),injection=burn(s,tr.first,0),atApo=propagate(injection,tr.time),finished=burn(atApo,tr.second,0),fo=elements(finished);
near('Hohmann apoapsis altitude, km',length(atApo.r)-R,2000,1e-7);near('Hohmann circular eccentricity',fo.e,0,1e-10);near('Hohmann time-to-apoapsis, s',timeToApoapsis(injection),tr.time,1e-7);
for(const [name,initial,time]of [['elliptic',burn(s,.4,.25),18000],['hyperbolic',burn(s,4,1),12000],['near-parabolic',{r:[R+400,0],v:[0,Math.sqrt(2*MU/(R+400))]},20000]]){const p=propagate(initial,time),a=elements(initial),b=elements(p);near(name+' specific-energy drift, km²/s²',b.energy,a.energy,1e-9);near(name+' angular-momentum drift, km²/s',b.h,a.h,1e-6);const back=propagate(p,-time);near(name+' time-reversal position, km',length(back.r.map((x,i)=>x-initial.r[i])),0,1e-5);}
let many=burn(s,.3,.1);const initial=elements(many);for(let i=0;i<1000;i++)many=propagate(many,15);near('1000-step energy drift, km²/s²',elements(many).energy,initial.energy,1e-9);
const hit=elements(burn(s,-1,0));assert.ok(hit.rp<R);results.push({name:'Retrograde surface-intersection detection',passed:true});
for(const target of [500,2000,36000]){let s=circular();s=burn(s,Math.round(transfer(R+400,R+target).first*1000)/1000,0);s=propagate(s,timeToApoapsis(s));const o=elements(s);s=burn(s,Math.round((Math.sqrt(MU/o.r)-Math.abs(o.h)/o.r)*1000)/1000,0);const f=elements(s);near(`Rounded controls reach ${target} km target, maximum apsis error`,Math.max(Math.abs(f.rp-R-target),Math.abs(f.ra-R-target)),0,15);}
console.log(JSON.stringify({passed:results.length,results,hohmann:{firstMps:tr.first*1000,secondMps:tr.second*1000,transferSeconds:tr.time}},null,2));
