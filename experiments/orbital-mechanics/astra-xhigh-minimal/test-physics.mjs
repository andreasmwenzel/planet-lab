import assert from 'node:assert/strict';
import { BODIES, TAU, norm, dot, cross, orbitFromApsides, elements, propagate, applyBurn, timeToApsis, timeToImpact, hohmann, sampleConic } from './physics.js';
const results=[];
function test(name,fn){const measurements=fn();results.push({name,status:'pass',...measurements});console.log(`PASS ${name}: ${JSON.stringify(measurements)}`);}
function near(actual,expected,tolerance,name){assert.ok(Math.abs(actual-expected)<=tolerance,`${name}: ${actual} vs ${expected}, tolerance ${tolerance}`);}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const body=BODIES.earth,mu=body.mu,r=body.radius+400;
const circ=orbitFromApsides(r,r,mu),period=TAU*Math.sqrt(r**3/mu);

test('Circular analytic quarter-orbit and period closure',()=>{
  const quarter=propagate(circ,period/4,mu),full=propagate(circ,period,mu);
  const positionErrorKm=distance(quarter.r,[0,r]),closureErrorKm=distance(full.r,circ.r);
  near(positionErrorKm,0,2e-5,'quarter position');near(closureErrorKm,0,2e-5,'period closure');
  near(distance(quarter.v,[-Math.sqrt(mu/r),0]),0,2e-8,'quarter velocity');
  return{positionErrorKm,closureErrorKm,toleranceKm:2e-5};
});
test('Elliptical apoapsis and vis-viva',()=>{
  const rp=body.radius+300,ra=body.radius+35786,st=orbitFromApsides(rp,ra,mu),el=elements(st,mu),ap=propagate(st,el.period/2,mu);
  const positionErrorKm=distance(ap.r,[-ra,0]),speedErrorKmS=Math.abs(norm(ap.v)-Math.sqrt(mu*(2/ra-1/el.a)));
  near(positionErrorKm,0,2e-4,'apoapsis position');near(speedErrorKmS,0,2e-8,'apoapsis speed');
  near(timeToApsis(st,mu,'apo'),el.period/2,1e-6,'time to apo');
  const after=propagate(st,100,mu);near(timeToApsis(after,mu,'peri'),el.period-100,2e-4,'time to next peri');
  return{positionErrorKm,speedErrorKmS,toleranceKm:2e-4,toleranceKmS:2e-8};
});
test('Energy and angular momentum across 1,500 varied conic states',()=>{
  let maxEnergyRelative=0,maxAngularMomentumRelative=0;
  const states=[circ,orbitFromApsides(6471,206371,mu),orbitFromApsides(6500,1e6,mu),{r:[7000,0],v:[0,12]},{r:[7000,0],v:[0,-12]}];
  for(const st of states){const base=elements(st,mu);for(let i=0;i<300;i++){const time=(i-150)*199.731,el=elements(propagate(st,time,mu),mu);maxEnergyRelative=Math.max(maxEnergyRelative,Math.abs((el.energy-base.energy)/base.energy));maxAngularMomentumRelative=Math.max(maxAngularMomentumRelative,Math.abs((el.h-base.h)/base.h));}}
  near(maxEnergyRelative,0,3e-7,'relative specific energy');near(maxAngularMomentumRelative,0,3e-8,'relative angular momentum');
  return{states:1500,maxEnergyRelative,maxAngularMomentumRelative,energyTolerance:3e-7,angularMomentumTolerance:3e-8};
});
test('Propagation reversal for elliptic, parabolic, hyperbolic, and retrograde states',()=>{
  let maxPositionErrorKm=0,maxVelocityErrorKmS=0;
  const states=[circ,orbitFromApsides(6500,80000,mu),{r:[7000,0],v:[0,Math.sqrt(2*mu/7000)]},{r:[7000,0],v:[0,12]},{r:[7000,0],v:[0,-12]}];
  for(const st of states)for(const t of[1,1000,10000,-10000,100000]){const back=propagate(propagate(st,t,mu),-t,mu);maxPositionErrorKm=Math.max(maxPositionErrorKm,distance(st.r,back.r));maxVelocityErrorKmS=Math.max(maxVelocityErrorKmS,distance(st.v,back.v));}
  near(maxPositionErrorKm,0,.03,'round-trip position');near(maxVelocityErrorKmS,0,2e-5,'round-trip velocity');
  return{cases:25,maxPositionErrorKm,maxVelocityErrorKmS,toleranceKm:.03,toleranceKmS:2e-5};
});
test('Hohmann transfer energy, arrival radius and circularization across all bodies',()=>{
  let maxRadiusErrorKm=0,maxEccentricity=0,maxEnergyError=0;
  for(const b of Object.values(BODIES))for(const [h1,h2] of[[400,10000],[15000,100],[300,301]]){
    const r1=b.radius+h1,r2=b.radius+h2,st=orbitFromApsides(r1,r1,b.mu),plan=hohmann(r1,r2,b.mu),dep=applyBurn(st,plan.burn1),arrival=propagate(dep,plan.duration,b.mu),final=applyBurn(arrival,plan.burn2),el=elements(final,b.mu);
    maxRadiusErrorKm=Math.max(maxRadiusErrorKm,Math.abs(norm(arrival.r)-r2));maxEccentricity=Math.max(maxEccentricity,el.e);maxEnergyError=Math.max(maxEnergyError,Math.abs(el.energy+b.mu/(2*r2)));
    assert.ok(plan.total>=0&&plan.duration>0);
  }
  near(maxRadiusErrorKm,0,1e-4,'arrival radius');near(maxEccentricity,0,1e-8,'circularization e');near(maxEnergyError,0,1e-7,'final energy');
  return{cases:9,maxRadiusErrorKm,maxEccentricity,maxEnergyError,radiusToleranceKm:1e-4,eccentricityTolerance:1e-8,energyTolerance:1e-7};
});
test('LEO-to-GEO reference Hohmann budget',()=>{
  const plan=hohmann(6678,42164,mu);
  near(plan.burn1,2.42577,.00003,'first burn');near(plan.burn2,1.46684,.00003,'second burn');near(plan.duration,18990,10,'coast seconds');
  return{burn1KmS:plan.burn1,burn2KmS:plan.burn2,totalKmS:plan.total,coastSeconds:plan.duration,burnToleranceKmS:.00003,coastToleranceSeconds:10};
});
test('Impulses use radial and local prograde transverse axes, including retrograde',()=>{
  let err=0;
  for(const st of[{r:[7000,0],v:[1,7]},{r:[0,7000],v:[7,1]},{r:[-7000,1000],v:[1,7]}]){
    const next=applyBurn(st,.1,-.2),dv=next.v.map((v,i)=>v-st.v[i]),er=st.r.map(v=>v/norm(st.r)),sign=Math.sign(cross(st.r,st.v)),et=[-er[1]*sign,er[0]*sign];
    err=Math.max(err,Math.abs(dot(dv,er)+.2),Math.abs(dot(dv,et)-.1));near(distance(st.r,next.r),0,0,'burn position unchanged');
  }
  near(err,0,1e-12,'burn components');return{maxComponentErrorKmS:err,toleranceKmS:1e-12};
});
test('First surface contact, including inbound/outbound escape and parabolic paths',()=>{
  const rp=6000,ra=14000,ellipse=orbitFromApsides(rp,ra,mu),elp=elements(ellipse,mu),atApo=propagate(ellipse,elp.period/2,mu);
  const candidates=[atApo];
  // Build surface-intersecting e > 1 and e = 1 conics at periapsis, then move inbound.
  for(const e of[1,1.5]){const peri={r:[6000,0],v:[0,Math.sqrt(mu*(1+e)/6000)]};candidates.push(propagate(peri,-800,mu));const outbound=propagate(peri,800,mu);assert.equal(timeToImpact(outbound,body),Infinity,'outbound escape never hits surface');}
  let maxSurfaceErrorKm=0;
  for(const state of candidates){const time=timeToImpact(state,body);assert.ok(time>0&&Number.isFinite(time),'finite future contact');const contact=propagate(state,time,mu);maxSurfaceErrorKm=Math.max(maxSurfaceErrorKm,Math.abs(norm(contact.r)-body.radius));assert.ok(dot(contact.r,contact.v)<0,'first surface crossing is inbound');}
  near(maxSurfaceErrorKm,0,.002,'contact radius');assert.equal(timeToImpact(circ,body),Infinity);
  return{cases:3,maxSurfaceErrorKm,toleranceKm:.002};
});
test('Conic samples satisfy focus equation and sampled state invariants',()=>{
  let maxEquationErrorKm=0,maxEnergyError=0;
  for(const state of[circ,orbitFromApsides(6671,50000,mu),{r:[7000,0],v:[0,12]}]){const el=elements(state,mu);for(const p of sampleConic(state,mu,200,200000)){const radius=norm(p),dotE=dot(el.ev,p)/radius;maxEquationErrorKm=Math.max(maxEquationErrorKm,Math.abs(radius-el.p/(1+dotE)));}}
  near(maxEquationErrorKm,0,1e-6,'conic equation');return{maxEquationErrorKm,toleranceKm:1e-6};
});
test('Repeated small-step propagation over ten circular periods',()=>{
  let state=circ;const count=10000,step=period*10/count;
  for(let i=0;i<count;i++)state=propagate(state,step,mu);
  const positionErrorKm=distance(state.r,circ.r),relativeEnergyError=Math.abs((elements(state,mu).energy-elements(circ,mu).energy)/elements(circ,mu).energy);
  near(positionErrorKm,0,.05,'10-orbit accumulated position');near(relativeEnergyError,0,1e-7,'10-orbit energy');
  return{steps:count,positionErrorKm,relativeEnergyError,positionToleranceKm:.05,energyTolerance:1e-7};
});
console.log(`\n${results.length} numerical tests passed.`);
if(process.argv.includes('--json')){
  const {writeFile}=await import('node:fs/promises');
  await writeFile(new URL('./numerical-results.json',import.meta.url),JSON.stringify({testedAt:new Date().toISOString(),status:'pass',tests:results},null,2)+'\n');
}
