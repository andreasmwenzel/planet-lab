import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {MU,EARTH,TAU,circularState,apsisState,elements,propagate,distance,speed,burn,hohmann,stumpff,timeToApsis,closestApproach,sampleOrbit,localFrame} from './physics.js';
import {MISSIONS,createFlight,generatedMission,sandboxMission,advisor,execute,coast,objectives,isReady,complete} from './missions.js';
const tests=[],metrics={};
const check=(name,fn)=>{try{fn();tests.push({name,status:'passed'});}catch(e){tests.push({name,status:'failed',error:e.message});}};
const near=(v,w,tol,label='values')=>assert.ok(Math.abs(v-w)<=tol,`${label}: ${v} vs ${w}, error ${Math.abs(v-w)} > ${tol}`);
const stateError=(a,b)=>Math.max(distance(a,b),Math.hypot(a.vx-b.vx,a.vy-b.vy));
check('Circular quarter-orbit agrees with analytic position and velocity',()=>{
  const r=EARTH+400,s=circularState(r),T=TAU*Math.sqrt(r**3/MU),q=propagate(s,T/4);
  const err=distance(q,{x:0,y:r});metrics.circularQuarterPositionErrorKm=err;near(err,0,1e-7);near(q.vx,-Math.sqrt(MU/r),1e-10);near(q.vy,0,1e-10);
});
check('One and one hundred full circular orbits close',()=>{
  const s=circularState(EARTH+400,.91),T=elements(s).period;metrics.circular100PeriodErrorKm=distance(s,propagate(s,100*T));near(distance(s,propagate(s,T)),0,1e-7);near(metrics.circular100PeriodErrorKm,0,1e-6);
});
check('Elliptical apsides and Kepler period match vis-viva',()=>{
  const rp=EARTH+500,ra=EARTH+15000,s=apsisState(rp,ra,.52),e=elements(s),q=propagate(s,e.period/2);
  metrics.ellipticalApoapsisRadiusErrorKm=Math.abs(Math.hypot(q.x,q.y)-ra);near(metrics.ellipticalApoapsisRadiusErrorKm,0,1e-6);near(elements(q).v,Math.sqrt(MU*(2/ra-2/(rp+ra))),1e-9);near(e.peri,rp,1e-7);near(e.apo,ra,1e-7);near(timeToApsis(s),e.period/2,1e-6);
});
check('Energy and angular momentum are conserved across 30,000 seconds',()=>{
  let s=apsisState(EARTH+400,EARTH+18000,1.2),e=elements(s),energy=0,h=0;for(let i=0;i<1500;i++){s=propagate(s,20);const n=elements(s);energy=Math.max(energy,Math.abs((n.energy-e.energy)/e.energy));h=Math.max(h,Math.abs((n.h-e.h)/e.h));}
  metrics.maxRelativeEnergyError=energy;metrics.maxRelativeAngularMomentumError=h;assert.ok(energy<2e-8,energy);assert.ok(h<2e-8,h);
});
check('Backward propagation reverses an elliptic coast',()=>{
  const a=apsisState(EARTH+400,EARTH+10000,.8),b=propagate(propagate(a,3765.25),-3765.25);metrics.timeReversalStateError=stateError(a,b);assert.ok(metrics.timeReversalStateError<2e-5);
});
check('Step partition does not change the flight',()=>{
  const s=apsisState(EARTH+1200,EARTH+13000,2);let repeated=s;for(let i=0;i<350;i++)repeated=propagate(repeated,20);const direct=propagate(s,7000);metrics.partitionPositionErrorKm=distance(repeated,direct);assert.ok(metrics.partitionPositionErrorKm<2e-5);
});
check('Hyperbolic escape preserves positive energy',()=>{
  const s=burn(circularState(EARTH+400),3500),a=elements(s),q=propagate(s,20000),b=elements(q);assert.ok(!a.bound&&b.c3>0&&b.radial>0);metrics.hyperbolicEnergyError=Math.abs(b.energy-a.energy);near(b.energy,a.energy,1e-7);assert.ok(Math.hypot(q.x,q.y)>50000);assert.ok(sampleOrbit(q).filter(Boolean).length>100);
});
check('Near-parabolic propagation is continuous on both sides of escape speed',()=>{
  const r=EARTH+400,v=Math.sqrt(2*MU/r),at=propagate({x:r,y:0,vx:0,vy:v},5000),lo=propagate({x:r,y:0,vx:0,vy:v-1e-8},5000),hi=propagate({x:r,y:0,vx:0,vy:v+1e-8},5000);metrics.parabolicContinuityKm=Math.max(distance(at,lo),distance(at,hi));assert.ok(metrics.parabolicContinuityKm<.001);near(elements(at).energy,0,1e-7);
});
check('Stumpff functions have correct limits and remain continuous near zero',()=>{near(stumpff(0).c,.5,1e-15);near(stumpff(0).s,1/6,1e-15);for(const z of [-1e-8,1e-8]){near(stumpff(z).c,.5,1e-8);near(stumpff(z).s,1/6,1e-8);}});
check('Radial and transverse impulse axes are orthogonal and use m/s',()=>{const s=propagate(apsisState(EARTH+400,EARTH+6000,.1),800),f=localFrame(s),b=burn(s,300,400);near(f.rx*f.tx+f.ry*f.ty,0,1e-15);near(Math.hypot(b.vx-s.vx,b.vy-s.vy),.5,1e-12);});
check('Clockwise orbit burns preserve the prograde convention',()=>{const s=circularState(EARTH+400,.7,-1),b=burn(s,100);near(speed(b)-speed(s),.1,1e-12);assert.ok(elements(b).h<0);});
check('Radial zero-angular-momentum orbits have finite apsides',()=>{const r=EARTH+400,s={x:r,y:0,vx:0,vy:0},e=elements(s);near(e.peri,0,1e-12);near(e.apo,r,1e-7);assert.ok(Number.isFinite(e.period));});
check('Hohmann transfer matches endpoint radii and final circular speed',()=>{
  const r1=EARTH+400,r2=EARTH+1600,h=hohmann(r1,r2),s=burn(circularState(r1),h.dv1),q=propagate(s,h.time),done=burn(q,h.dv2);
  metrics.hohmannDeltaVMps=h.total;metrics.hohmannTransferTimeSeconds=h.time;near(elements(q).r,r2,1e-6);near(elements(done).e,0,1e-8);near(elements(done).peri,r2,1e-5);
});
check('Closest-approach search recovers the phased rendezvous',()=>{
  const r1=EARTH+400,r2=EARTH+1600,h=hohmann(r1,r2),ship=burn(circularState(r1),h.dv1),target=circularState(r2,h.phase),c=closestApproach(ship,target,h.time*1.5,95);
  metrics.closestApproachDistanceKm=c.distance;metrics.closestApproachTimingErrorSeconds=Math.abs(c.time-h.time);assert.ok(c.distance<1e-5);assert.ok(metrics.closestApproachTimingErrorSeconds<.001);near(c.relativeSpeed,h.dv2,.001);
});
check('Atmospheric recall catches ordinary surface approach',()=>{
  const m=sandboxMission(),f=createFlight(m),bad=execute(f,m,0,-500,0);const out=coast(bad.flight,m,7200);assert.equal(out.status,'failed');assert.match(out.reason,/Atmospheric/);
});
check('Apsidal event check catches a grazing boundary between time samples',()=>{
  const m=sandboxMission(),p=apsisState(EARTH+99.999,EARTH+10000,.4),s=propagate(p,-10),end=propagate(s,20);assert.ok(elements(s).r>EARTH+100);assert.ok(elements(end).r>EARTH+100);const f={...createFlight(m),ship:s};assert.equal(coast(f,m,20).status,'failed');
});
check('Budget, NaN, negative delay, and excessive impulse are rejected without mutation',()=>{
  const m=MISSIONS[0],f=createFlight(m),snapshot=JSON.stringify(f);for(const [d,t,r] of [[0,400,0],[0,NaN,0],[-1,100,0],[0,13000,0]]){const out=execute(f,m,d,t,r);assert.ok(out.error);assert.equal(out.flight,f);}assert.equal(JSON.stringify(f),snapshot);
});
check('Expired delivery window closes the flight without spending fuel',()=>{
  const m=MISSIONS[0],f=createFlight(m),out=execute(f,m,m.limit+1,100,0);assert.equal(out.flight.status,'failed');near(out.flight.used,0,0);assert.equal(out.flight.time,m.limit);
});
check('Sandbox time and delta-v remain unlimited',()=>{const m=sandboxMission(),f=createFlight(m),out=execute(f,m,0,8000,2000);assert.equal(out.error,null);assert.ok(out.flight.used>8000);const flown=coast(out.flight,m,86400);assert.equal(flown.status,'active');});
const campaign=[];
for(const m of MISSIONS)check(`Campaign ${m.number}: ${m.name} is solvable by the actual advisor and game engine`,()=>{
  let f=createFlight(m);for(let i=0;i<8&&!isReady(f,m);i++){const a=advisor(f,m);if(a.coast)f=coast(f,m,a.coast);else{assert.ok(Number.isFinite(a.t),a.title);const out=execute(f,m,a.delay||0,a.t,a.r||0);assert.equal(out.error,null);f=out.flight;}assert.equal(f.status,'active');}
  assert.ok(isReady(f,m),JSON.stringify(objectives(f,m)));f=complete(f,m);assert.equal(f.status,'complete');assert.ok(f.seals.every(Boolean));campaign.push({id:m.id,deltaVMps:f.used,burns:f.burns,timeSeconds:f.time,seals:f.seals});
});
check('Sixty-four seeded open-dispatch routes are solvable within budget',()=>{
  let maxRatio=0;for(let seed=1;seed<=64;seed++){const m=generatedMission(seed);let f=createFlight(m);for(let i=0;i<3&&!isReady(f,m);i++){const a=advisor(f,m),out=execute(f,m,a.delay||0,a.t,a.r||0);assert.equal(out.error,null);f=out.flight;}assert.ok(isReady(f,m),'seed '+seed);maxRatio=Math.max(maxRatio,f.used/m.budget);assert.ok(complete(f,m).seals.every(Boolean));}metrics.seededRoutes=64;metrics.maxSeededBudgetFraction=maxRatio;
});
check('Generated route seeds are repeatable and do not mutate global state',()=>{const a=generatedMission(1234),b=generatedMission(1234);near(a.budget,b.budget,0);assert.deepEqual(a.start(),b.start());assert.equal(a.targetApo,b.targetApo);assert.notEqual(a.targetApo,generatedMission(23).targetApo);});
const report={suite:'Actual implementation numerical and game tests',passed:tests.filter(t=>t.status==='passed').length,failed:tests.filter(t=>t.status==='failed').length,tests,metrics,campaign};
await writeFile(new URL('./physics-test-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
