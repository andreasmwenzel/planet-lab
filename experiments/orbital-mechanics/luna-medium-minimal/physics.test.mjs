import test from 'node:test';
import assert from 'node:assert/strict';
import {MU_EARTH,R_EARTH,solveKepler,orbitalState} from './main.js';

const close=(actual,expected,tol,label)=>assert.ok(Math.abs(actual-expected)<=tol,`${label}: expected ${expected}, got ${actual}, tolerance ${tol}`);
test('Kepler solution satisfies equation across eccentricities and wrapped phases',()=>{
  for(const e of [0,.12,.48,.75,.95]) for(const M of [-24,-Math.PI,-2,-.01,0,.01,2,Math.PI,19]) {
    const E=solveKepler(M,e),wrapped=((M+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
    close(E-e*Math.sin(E),wrapped,2e-12,`Kepler residual e=${e}, M=${M}`);
  }
});
test('circular orbit has constant radius, circular speed, and expected period',()=>{
  const a=R_EARTH+520, expectedV=Math.sqrt(MU_EARTH/a),expectedT=2*Math.PI*Math.sqrt(a**3/MU_EARTH);
  for(const M of [0,.4,1.7,3.9,6.1]) {const s=orbitalState(a,0,M);close(s.r,a,1e-8,'circular radius');close(s.v,expectedV,1e-12,'circular speed');close(s.energy,-MU_EARTH/(2*a),1e-11,'circular energy')}
  close(orbitalState(a,0,0).period,expectedT,1e-8,'circular period');
});
test('elliptic apsides match vis-viva and conserve energy/angular momentum',()=>{
  const a=R_EARTH+10500,e=.48,mu=MU_EARTH;
  const p=orbitalState(a,e,0),q=orbitalState(a,e,Math.PI),semilatus=a*(1-e*e);
  close(p.r,a*(1-e),1e-9,'periapsis');close(q.r,a*(1+e),1e-9,'apoapsis');
  close(p.v,Math.sqrt(mu*(2/p.r-1/a)),1e-12,'periapsis vis-viva');close(q.v,Math.sqrt(mu*(2/q.r-1/a)),1e-12,'apoapsis vis-viva');
  for(const M of [0,.3,1.4,Math.PI,4.8]) {const s=orbitalState(a,e,M);close(s.energy,-mu/(2*a),1e-11,'specific energy');close(s.angularMomentum,Math.sqrt(mu*semilatus),1e-8,'specific angular momentum')}
});
test('periodic state returns to initial position and velocity after one period',()=>{
  const a=R_EARTH+1300,e=.23,M=.92,n=Math.sqrt(MU_EARTH/a**3),s0=orbitalState(a,e,M),s1=orbitalState(a,e,M+n*s0.period);
  close(s1.x,s0.x,2e-8,'periodic x');close(s1.y,s0.y,2e-8,'periodic y');close(s1.vx,s0.vx,2e-11,'periodic vx');close(s1.vy,s0.vy,2e-11,'periodic vy');
});
test('invalid hyperbolic inputs are rejected',()=>{assert.throws(()=>solveKepler(0,1),RangeError);assert.throws(()=>orbitalState(-1,.1,0),RangeError);assert.throws(()=>orbitalState(1,.9,0,0),RangeError)});
