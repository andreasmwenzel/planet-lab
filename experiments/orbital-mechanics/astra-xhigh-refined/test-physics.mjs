import assert from 'node:assert/strict';
import { MU, EARTH_RADIUS, TAU, MIN_ALTITUDE, MAX_ALTITUDE, planTransfer, solveKepler, transferState, circularState, missionState, diagnostics, missionDuration } from './physics.mjs';

let assertions = 0;
const results = [];
function check(condition, message) { assertions++; assert.ok(condition, message); }
function near(actual, expected, tolerance, label) { check(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}, tolerance ${tolerance}`); }
function test(name, fn) { const detail = fn(); results.push({ name, passed: true, ...detail }); console.log(`PASS ${name}${detail ? ` ${JSON.stringify(detail)}` : ''}`); }
function vectorDistance(a,b) { return Math.hypot(a.x-b.x,a.y-b.y); }

// Reference values computed from the dimensionless radius ratio 2 and μ=398600.4418.
test('Known circular and radius-ratio-two transfer reference', () => {
  const p = planTransfer(7000 - EARTH_RADIUS,14000 - EARTH_RADIUS);
  near(p.v1, 7.546053290107541, 1e-12, '7000 km circular speed');
  near(p.dv1, 1.167378506618159, 2e-12, 'First burn');
  near(p.dv2, 0.9791495542672508, 2e-12, 'Second burn');
  near(p.transferTime, 5353.834394869872, 1e-8, 'Transfer time');
  return { firstBurnKmS: p.dv1, secondBurnKmS: p.dv2, transferSeconds:p.transferTime, speedToleranceKmS:2e-12, timeToleranceSeconds:1e-8 };
});

test('Kepler solver residual across 13 eccentricities and 2001 mean anomalies', () => {
  let maximumResidual=0;
  for (const e of [0,.001,.1,.3,.6,.79,.8,.9,.99,.999,.9999,.99999,.999999]) {
    for(let i=0;i<=2000;i++) {
      const M=-50*TAU+i*100*TAU/2000;
      const wrapped=((M+Math.PI)%TAU+TAU)%TAU-Math.PI;
      const E=solveKepler(M,e);
      const residual=Math.abs(E-e*Math.sin(E)-wrapped);
      maximumResidual=Math.max(maximumResidual,residual);
      check(residual<5e-13, `Kepler residual e=${e} M=${M}`);
    }
  }
  return { maximumResidualRadians:maximumResidual, toleranceRadians:5e-13, cases:26013 };
});

const pairs = [[400,2000],[2000,400],[400,35786],[35786,400],[160,50000],[50000,160],[160,160],[400,400],[50000,50000],[1599.25,1599.26],[50000,49000]];
test('Position continuity, exact apsides, burn vectors, signed burns, and missed insertion', () => {
  let maxEndpointError=0,maxInsertionPositionJump=0;
  for(const [a,b] of pairs){
    const p=planTransfer(a,b),start=transferState(p,0),end=transferState(p,p.transferTime),full=transferState(p,2*p.transferTime);
    const endpointError=Math.max(vectorDistance(start,{x:p.r1,y:0}),vectorDistance(end,{x:-p.r2,y:0}),vectorDistance(full,start));
    maxEndpointError=Math.max(maxEndpointError,endpointError);
    near(endpointError,0,1e-7,'Apsides and period closure');
    near(diagnostics(start).speed,p.vt1,1e-11,'Departure transfer speed');
    near(diagnostics(end).speed,p.vt2,1e-11,'Arrival transfer speed');
    near(diagnostics(start).radialSpeed,0,1e-10,'Initial radial speed');
    near(diagnostics(end).radialSpeed,0,1e-10,'Terminal radial speed');
    const inserted=missionState(p,p.transferTime,true),missed=missionState(p,p.transferTime,false);
    const gap=vectorDistance(inserted,missed);maxInsertionPositionJump=Math.max(gap,maxInsertionPositionJump);
    near(gap,0,1e-7,'Instant burn does not change position');
    near(Math.hypot(inserted.vx-missed.vx,inserted.vy-missed.vy),Math.abs(p.dv2),1e-11,'Arrival delta-v vector');
    near(diagnostics(inserted).speed,p.v2,1e-11,'Circularized speed');
    near(diagnostics(missionState(p,p.transferTime+p.arrivalPeriod*.249,true)).altitude,b,1e-8,'Circular altitude is constant');
    near(vectorDistance(missionState(p,2*p.transferTime,false),start),0,1e-7,'Missed insertion returns to departure');
    const parked=missionState(p,-.001,true);
    near(diagnostics(parked).altitude,a,1e-9,'Parking orbit');
    near(p.totalDv,Math.abs(p.dv1)+Math.abs(p.dv2),1e-14,'Total delta-v is sum of magnitudes');
    if(a!==b){check(Math.sign(p.dv1)===Math.sign(b-a),'Departure burn sign');check(Math.sign(p.dv2)===Math.sign(b-a),'Arrival burn sign');}
    near(missionDuration(p,false),2*p.transferTime,0,'Skipped-insertion horizon');
    near(missionDuration(p,true),p.transferTime+p.arrivalPeriod/4,0,'Inserted horizon');
  }
  return { cases:pairs.length, maxEndpointErrorKm:maxEndpointError, maxInsertionPositionJumpKm:maxInsertionPositionJump, positionToleranceKm:1e-7, speedToleranceKmS:1e-11 };
});

test('Conserved energy and angular momentum through 11 complete transfer ellipses', () => {
  let maxEnergyRelativeError=0,maxMomentumRelativeError=0,maxVisVivaResidual=0;
  for(const [a,b] of pairs){
    const p=planTransfer(a,b),energy=-MU/(2*p.a),h=Math.sqrt(MU*p.a*(1-p.e*p.e));
    for(let i=0;i<=2000;i++){
      const state=transferState(p,i/2000*2*p.transferTime),d=diagnostics(state);
      const de=Math.abs((d.energy-energy)/energy),dh=Math.abs((d.angularMomentum-h)/h);
      const visViva=Math.abs(d.speed*d.speed-MU*(2/d.radius-1/p.a));
      maxEnergyRelativeError=Math.max(maxEnergyRelativeError,de);maxMomentumRelativeError=Math.max(maxMomentumRelativeError,dh);maxVisVivaResidual=Math.max(maxVisVivaResidual,visViva);
      check(de<2e-12,'Energy conservation');check(dh<2e-12,'Angular momentum conservation');check(visViva<2e-10,'Vis-viva residual');
      check(d.altitude>=Math.min(a,b)-1e-7&&d.altitude<=Math.max(a,b)+1e-7,'Altitude bounds');
    }
  }
  return { samples:22011, maxEnergyRelativeError, maxMomentumRelativeError, maxVisVivaResidualKm2S2:maxVisVivaResidual, relativeTolerance:2e-12, visVivaToleranceKm2S2:2e-10 };
});

// An independent Cartesian RK4 integrator tests analytic propagation against F=−μr/|r|³.
function derivative(s){const r=Math.hypot(s[0],s[1]),factor=-MU/r**3;return [s[2],s[3],factor*s[0],factor*s[1]];}
function rk4(s,dt){const k1=derivative(s),k2=derivative(s.map((x,i)=>x+k1[i]*dt/2)),k3=derivative(s.map((x,i)=>x+k2[i]*dt/2)),k4=derivative(s.map((x,i)=>x+k3[i]*dt));return s.map((x,i)=>x+dt/6*(k1[i]+2*k2[i]+2*k3[i]+k4[i]));}
test('Analytic state agrees with independently integrated central gravity', () => {
  let maximumPositionError=0,maximumVelocityError=0;
  for(const [a,b] of pairs.slice(0,6)){
    const p=planTransfer(a,b),initial=transferState(p,0),steps=30000,dt=p.transferTime/steps;
    let s=[initial.x,initial.y,initial.vx,initial.vy];
    for(let i=1;i<=steps;i++){
      s=rk4(s,dt);
      if(i%5000===0){const reference=transferState(p,dt*i);const dp=Math.hypot(s[0]-reference.x,s[1]-reference.y),dv=Math.hypot(s[2]-reference.vx,s[3]-reference.vy);maximumPositionError=Math.max(maximumPositionError,dp);maximumVelocityError=Math.max(maximumVelocityError,dv);check(dp<1e-4,'RK4 position comparison');check(dv<1e-7,'RK4 velocity comparison');}
    }
  }
  return { cases:6, integrationStepsPerCase:30000, maximumPositionErrorKm:maximumPositionError, maximumVelocityErrorKmS:maximumVelocityError, positionToleranceKm:1e-4, velocityToleranceKmS:1e-7 };
});

test('Velocity and acceleration agree with numerical derivatives of actual state', () => {
  let maximumVelocityError=0,maximumAccelerationError=0;
  for(const [a,b] of pairs.slice(0,6)){
    const p=planTransfer(a,b);
    for(let i=1;i<60;i++){
      const t=p.transferTime*i/60,dt=.02,s=transferState(p,t),lo=transferState(p,t-dt),hi=transferState(p,t+dt),r=Math.hypot(s.x,s.y);
      const velocityError=Math.hypot((hi.x-lo.x)/(2*dt)-s.vx,(hi.y-lo.y)/(2*dt)-s.vy);
      const accelerationError=Math.hypot((hi.vx-lo.vx)/(2*dt)+MU*s.x/r**3,(hi.vy-lo.vy)/(2*dt)+MU*s.y/r**3);
      maximumVelocityError=Math.max(maximumVelocityError,velocityError);maximumAccelerationError=Math.max(maximumAccelerationError,accelerationError);
      check(velocityError<1e-7,'Position derivative');check(accelerationError<1e-9,'Velocity derivative');
    }
  }
  return { maximumVelocityErrorKmS:maximumVelocityError, maximumAccelerationErrorKmS2:maximumAccelerationError, velocityToleranceKmS:1e-7, accelerationToleranceKmS2:1e-9 };
});

test('Domain guardrails and zero-cost equal-altitude case', () => {
  for(const [a,b] of [[NaN,400],[400,Infinity],[159,400],[400,50001],[-1,400]]){assert.throws(()=>planTransfer(a,b),RangeError);assertions++;}
  for(const [m,e] of [[NaN,.1],[0,-.1],[0,1],[0,Infinity]]){assert.throws(()=>solveKepler(m,e),RangeError);assertions++;}
  const same=planTransfer(400,400);near(same.totalDv,0,1e-14,'Equal-orbit cost');near(same.e,0,0,'Equal-orbit eccentricity');
  for(const a of [MIN_ALTITUDE,MAX_ALTITUDE])check(Number.isFinite(planTransfer(a,a).transferTime),'Boundary altitude supported');
  return { invalidCases:9, validBoundaryCases:2 };
});
console.log(JSON.stringify({passed:true,assertions,tests:results},null,2));
