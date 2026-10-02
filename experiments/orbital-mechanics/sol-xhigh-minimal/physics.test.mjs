import assert from 'node:assert/strict';
import { MU, EARTH_RADIUS, TAU, norm, apsidalState, elements, propagate, applyImpulse, timeToApsis, timeToImpact, hohmann, trajectory } from './physics.mjs';

let assertions = 0;
const results = [];
function near(actual, expected, tolerance, label) {
  assertions++;
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}; tolerance ${tolerance}`);
}
function vectorError(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function test(name, action) { const result = action(); results.push({ name, ...result }); console.log(`PASS ${name}: ${JSON.stringify(result)}`); }

test('Circular orbit against analytic quarter-period solution and 1000-period return', () => {
  const state = apsidalState(400,400), el = elements(state), quarter = propagate(state, el.period / 4);
  const positionError = vectorError(quarter.r, [0, EARTH_RADIUS + 400]);
  const velocityError = vectorError(quarter.v, [-Math.sqrt(MU / (EARTH_RADIUS + 400)),0]);
  near(positionError,0,1e-6,'quarter position km'); near(velocityError,0,1e-9,'quarter velocity km/s');
  near(vectorError(propagate(state,el.period*1000).r,state.r),0,1e-5,'long-period return km');
  near(el.e,0,1e-12,'circular eccentricity');
  return { positionErrorKm: positionError, velocityErrorKms: velocityError, positionToleranceKm: 1e-6, velocityToleranceKms: 1e-9 };
});

test('Energy and angular momentum conservation over 600 actual propagated samples', () => {
  let maxEnergy = 0, maxAngularMomentumRelative = 0;
  for (const [peri,apo] of [[400,400],[400,20000],[600,39700],[200,500000]]) {
    const state = apsidalState(peri,apo), baseline = elements(state);
    for (let k = 1; k <= 150; k++) {
      const now = elements(propagate(state, baseline.period * k / 37));
      const de = Math.abs(now.energy - baseline.energy), dh = Math.abs((now.h - baseline.h) / baseline.h);
      maxEnergy = Math.max(maxEnergy,de); maxAngularMomentumRelative = Math.max(maxAngularMomentumRelative,dh);
      near(de,0,1e-8,'energy km²/s²'); near(dh,0,1e-10,'relative angular momentum');
    }
  }
  return { samples: 600, maxEnergyErrorKm2s2: maxEnergy, maxAngularMomentumRelativeError: maxAngularMomentumRelative, energyToleranceKm2s2: 1e-8, angularMomentumRelativeTolerance: 1e-10 };
});

test('Tangential/radial impulse magnitude and independent kinetic-energy increment', () => {
  const initial = propagate(apsidalState(400,20000),700), after = applyImpulse(initial,250,-120);
  const dv = after.v.map((v,i)=>v-initial.v[i]);
  near(vectorError(initial.r,after.r),0,1e-12,'instantaneous burn position');
  near(norm(dv),Math.hypot(.250,.120),1e-12,'delta-v km/s');
  const expectedEnergyChange = initial.v[0]*dv[0]+initial.v[1]*dv[1]+norm(dv)**2/2;
  near(elements(after).energy-elements(initial).energy,expectedEnergyChange,1e-12,'energy increment');
  return { deltaVms: norm(dv)*1000, energyIncrementKm2s2: expectedEnergyChange, tolerance: 1e-12 };
});

test('Hohmann transfers upward and downward reach target and circularize', () => {
  let maxArrivalRadiusError = 0, maxCircularEccentricity = 0, maxCircularSpeedError = 0;
  const cases=[];
  for (const [from,to] of [[400,35786],[35786,400],[400,2000],[100000,1000]]) {
    const plan = hohmann(from,to), injected = applyImpulse(apsidalState(from,from),plan.dv1,0);
    const arrival = propagate(injected,plan.coast), circular = applyImpulse(arrival,plan.dv2,0), e=elements(circular);
    const rError=Math.abs(norm(arrival.r)-(EARTH_RADIUS+to)), vError=Math.abs(norm(circular.v)-Math.sqrt(MU/(EARTH_RADIUS+to)));
    near(rError,0,1e-5,'arrival radius km'); near(e.e,0,1e-9,'arrival eccentricity'); near(vError,0,1e-9,'arrival speed km/s');
    near(plan.totalDv,Math.abs(plan.dv1)+Math.abs(plan.dv2),1e-10,'total delta-v ms');
    maxArrivalRadiusError=Math.max(maxArrivalRadiusError,rError);maxCircularEccentricity=Math.max(maxCircularEccentricity,e.e);maxCircularSpeedError=Math.max(maxCircularSpeedError,vError);
    cases.push({fromKm:from,toKm:to,firstBurnMs:plan.dv1,secondBurnMs:plan.dv2,coastSeconds:plan.coast,totalDeltaVms:plan.totalDv});
  }
  return { cases, maxArrivalRadiusErrorKm:maxArrivalRadiusError, maxCircularEccentricity, maxCircularSpeedErrorKms:maxCircularSpeedError, radiusToleranceKm:1e-5, eccentricityTolerance:1e-9, speedToleranceKms:1e-9 };
});

test('Apsis timing reaches the expected extremum from an arbitrary epoch', () => {
  const state = apsidalState(400,20000), start=propagate(state,1234), periWait=timeToApsis(start,'periapsis'), apoWait=timeToApsis(start,'apoapsis');
  near(norm(propagate(start,periWait).r),EARTH_RADIUS+400,1e-5,'perigee radius');
  near(norm(propagate(start,apoWait).r),EARTH_RADIUS+20000,1e-5,'apogee radius');
  near(timeToApsis(state,'periapsis'),0,1e-8,'already at perigee');
  return { periWaitSeconds:periWait,apoWaitSeconds:apoWait,radiusToleranceKm:1e-5 };
});

test('Hyperbolic and near-parabolic propagation, including reverse-time recovery', () => {
  let maxEnergyError=0,maxAngularMomentumRelativeError=0,maxReverseError=0;
  for(const factor of [1.2,1+1e-8,1-1e-8,1]){
    const radius=EARTH_RADIUS+400,state={r:[radius,0],v:[0,Math.sqrt(2*MU/radius)*factor]},baseline=elements(state);
    for(const dt of [60,3600,86400,604800]){
      const later=propagate(state,dt),now=elements(later),back=propagate(later,-dt);
      const de=Math.abs(now.energy-baseline.energy),dh=Math.abs((now.h-baseline.h)/baseline.h),dr=vectorError(back.r,state.r);
      near(de,0,1e-8,'unbound/near-parabolic energy');near(dh,0,1e-9,'unbound momentum');near(dr,0,.001,'reverse-time position km');
      maxEnergyError=Math.max(maxEnergyError,de);maxAngularMomentumRelativeError=Math.max(maxAngularMomentumRelativeError,dh);maxReverseError=Math.max(maxReverseError,dr);
    }
  }
  return { samples:16,maxEnergyErrorKm2s2:maxEnergyError,maxAngularMomentumRelativeError,maxReversePositionErrorKm:maxReverseError,energyToleranceKm2s2:1e-8,momentumRelativeTolerance:1e-9,reversePositionToleranceKm:.001 };
});

test('Retrograde circular motion and local-tangential acceleration', () => {
  const positive=apsidalState(400,400),state={r:positive.r,v:[0,-positive.v[1]]},e=elements(state),q=propagate(state,e.period/4),burn=applyImpulse(state,250,0);
  near(vectorError(q.r,[0,-(EARTH_RADIUS+400)]),0,1e-6,'retrograde quarter position');
  near(burn.v[1],state.v[1]-.25,1e-12,'retrograde tangential burn');
  return {quarterPositionErrorKm:vectorError(q.r,[0,-(EARTH_RADIUS+400)]),positionToleranceKm:1e-6};
});

test('Surface event timing for elliptic, hyperbolic, parabolic and radial infall', () => {
  const deorbit=applyImpulse(apsidalState(400,400),-500,0);
  const rp=EARTH_RADIUS-100;
  const hyper=propagate({r:[rp,0],v:[0,Math.sqrt(2*MU/rp)*1.2]},-300);
  const parabolic=propagate({r:[rp,0],v:[0,Math.sqrt(2*MU/rp)]},-300);
  const radial={r:[7000,0],v:[0,0]};
  const cases=[];
  for(const [name,state]of [['elliptic deorbit',deorbit],['hyperbolic inbound',hyper],['parabolic inbound',parabolic],['radial infall',radial]]){
    const t=timeToImpact(state),at=propagate(state,t),error=Math.abs(norm(at.r)-EARTH_RADIUS);
    assert.ok(Number.isFinite(t)&&t>0,`${name} has a future impact`);assertions++;
    near(error,0,1e-5,`${name} surface radius`);
    assert.ok(norm(propagate(state,t-.01).r)>EARTH_RADIUS,`${name} is above surface before event`);assertions++;
    cases.push({name,impactSeconds:t,radiusErrorKm:error});
  }
  assert.equal(timeToImpact(apsidalState(400,20000)),Infinity);assertions++;
  const outbound=propagate({r:[rp,0],v:[0,Math.sqrt(2*MU/rp)*1.2]},300);
  assert.equal(timeToImpact(outbound),Infinity);assertions++;
  return {cases,radiusToleranceKm:1e-5};
});

test('Projected ellipse matches both apsidal radii; invalid input is rejected', () => {
  const points=trajectory(apsidalState(400,20000),360),radii=points.map(norm);
  near(Math.min(...radii),EARTH_RADIUS+400,1e-8,'projected perigee');near(Math.max(...radii),EARTH_RADIUS+20000,1e-8,'projected apogee');
  assert.throws(()=>apsidalState(500,400));assertions++;assert.throws(()=>propagate(apsidalState(400,400),Infinity));assertions++;assert.throws(()=>hohmann(-1,400));assertions++;
  return {points:points.length,apsisToleranceKm:1e-8};
});

console.log(`\n${results.length} suites passed; ${assertions} assertions. Tests import the product's actual physics.mjs.`);
