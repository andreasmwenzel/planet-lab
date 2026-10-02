import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MU, EARTH_RADIUS, TAU, norm, dot, initialOrbit, propagate, elements, localFrame, applyBurn, timeToImpact, sampleTrajectory, stumpff } from './physics.js';

const testStartedAtUtc = new Date().toISOString();
const results = [];
function test(name, fn) {
  const started = performance.now();
  try { const metrics = fn() || {}; results.push({ name, passed: true, milliseconds: +(performance.now() - started).toFixed(3), ...metrics }); console.log(`PASS ${name} ${JSON.stringify(metrics)}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.stack}`); }
}
const errorNorm = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const close = (actual,expected,tolerance,label) => assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} vs ${expected}; tolerance ${tolerance}`);
const vectorClose = (actual,expected,tolerance,label) => assert.ok(errorNorm(actual,expected)<=tolerance,`${label}: error ${errorNorm(actual,expected)}; tolerance ${tolerance}`);
// Independent RK4 oracle integrates acceleration rather than reimplementing the Kepler solver.
function rk4(state,time,step=2) {
  let y=[...state.r,...state.v]; const steps=Math.ceil(Math.abs(time)/step),h=time/steps;
  const derivative = a => { const r=Math.hypot(a[0],a[1]);return[a[2],a[3],-MU*a[0]/r**3,-MU*a[1]/r**3]; };
  for(let n=0;n<steps;n++){const k1=derivative(y),k2=derivative(y.map((v,i)=>v+h*k1[i]/2)),k3=derivative(y.map((v,i)=>v+h*k2[i]/2)),k4=derivative(y.map((v,i)=>v+h*k3[i]));y=y.map((v,i)=>v+h*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);}
  return{r:y.slice(0,2),v:y.slice(2)};
}

test('Circular state and quarter/full/multiple-period propagation',()=>{
  const state=initialOrbit(400,400),o=elements(state),r=EARTH_RADIUS+400;
  close(o.e,0,1e-14,'circular eccentricity');close(o.periapsis,r,1e-8,'periapsis');
  const quarter=propagate(state,o.period/4);vectorClose(quarter.r,[0,r],1e-7,'quarter-circle position');vectorClose(quarter.v,[-Math.sqrt(MU/r),0],1e-10,'quarter-circle velocity');
  let maximumPositionErrorKm=0;
  for(const cycles of [1,3,100,10000]){const end=propagate(state,o.period*cycles);const e=errorNorm(end.r,state.r);maximumPositionErrorKm=Math.max(maximumPositionErrorKm,e);assert.ok(e<1e-5);}
  const zero=propagate(state,0);assert.notEqual(zero.r,state.r);assert.deepEqual(zero,state);
  return{periodSeconds:o.period,maximumPositionErrorKm,positionToleranceKm:1e-5,quarterPositionToleranceKm:1e-7};
});

test('Elliptic conservation, reversal and semigroup at high eccentricity',()=>{
  const state=initialOrbit(120,100000),o=elements(state);let maxEnergyRelativeError=0,maxAngularMomentumRelativeError=0,maxSemigroupErrorKm=0;
  for(let i=1;i<=120;i++){const t=o.period*3*i/120,s=propagate(state,t),p=elements(s);maxEnergyRelativeError=Math.max(maxEnergyRelativeError,Math.abs((p.energy-o.energy)/o.energy));maxAngularMomentumRelativeError=Math.max(maxAngularMomentumRelativeError,Math.abs((p.h-o.h)/o.h));
    const back=propagate(s,-t);vectorClose(back.r,state.r,1e-4,'time reversal');
    const part=propagate(propagate(state,t*.37),t*.63);maxSemigroupErrorKm=Math.max(maxSemigroupErrorKm,errorNorm(part.r,s.r));}
  assert.ok(maxEnergyRelativeError<2e-9);assert.ok(maxAngularMomentumRelativeError<2e-9);assert.ok(maxSemigroupErrorKm<1e-4);
  return{eccentricity:o.e,samples:120,maxEnergyRelativeError,maxAngularMomentumRelativeError,maxSemigroupErrorKm,conservationRelativeTolerance:2e-9,positionToleranceKm:1e-4};
});

test('400 km to 35,786 km Hohmann transfer and circularization',()=>{
  const r1=EARTH_RADIUS+400,r2=EARTH_RADIUS+35786,state=initialOrbit(400,400),a=(r1+r2)/2;
  const dv1=Math.sqrt(MU/r1)*(Math.sqrt(2*r2/(r1+r2))-1),transfer=applyBurn(state,dv1,0),o=elements(transfer);
  close(o.periapsis,r1,1e-7,'transfer periapsis');close(o.apoapsis,r2,1e-6,'transfer apoapsis');close(o.period,TAU*Math.sqrt(a**3/MU),1e-6,'period');
  const apogee=propagate(transfer,o.period/2);vectorClose(apogee.r,[-r2,0],1e-6,'apogee position');
  const dv2=Math.sqrt(MU/r2)-norm(apogee.v),circular=applyBurn(apogee,dv2,0),final=elements(circular);
  close(final.e,0,1e-11,'circularized eccentricity');close(final.a,r2,1e-6,'final semi-major axis');
  return{firstBurnMetersPerSecond:dv1*1000,secondBurnMetersPerSecond:dv2*1000,halfTransferSeconds:o.period/2,positionToleranceKm:1e-6,circularEccentricityTolerance:1e-11};
});

test('Universal solver compared with independent RK4 for all conic classes',()=>{
  const seed=initialOrbit(400,400),escape=Math.sqrt(2*MU/norm(seed.r));
  const cases=[{label:'elliptic',state:applyBurn(seed,.9,.4)},{label:'parabolic',state:{r:[...seed.r],v:[0,escape]}},{label:'hyperbolic',state:{r:[...seed.r],v:[.7,escape*1.25]}}];
  const errors=[];
  for(const item of cases){const exact=propagate(item.state,3600),reference=rk4(item.state,3600,2);const positionErrorKm=errorNorm(exact.r,reference.r),velocityErrorKmPerSecond=errorNorm(exact.v,reference.v);assert.ok(positionErrorKm<2e-5);assert.ok(velocityErrorKmPerSecond<2e-8);errors.push({class:item.label,positionErrorKm,velocityErrorKmPerSecond});}
  return{durationSeconds:3600,rk4StepSeconds:2,positionToleranceKm:2e-5,velocityToleranceKmPerSecond:2e-8,errors};
});

test('Parabolic propagation independently checked with Barker equation',()=>{
  const r=EARTH_RADIUS+400,state={r:[r,0],v:[0,Math.sqrt(2*MU/r)]},p=2*r,t=21600;
  const factor=.5*Math.sqrt(p**3/MU),D=2*Math.sinh(Math.asinh(1.5*t/factor)/3);
  const expected=[r*(1-D*D),2*r*D],actual=propagate(state,t);
  const positionErrorKm=errorNorm(actual.r,expected);assert.ok(positionErrorKm<1e-5);
  return{durationSeconds:t,positionErrorKm,positionToleranceKm:1e-5};
});

test('Near-parabolic continuity and Stumpff zero limit',()=>{
  const r=EARTH_RADIUS+400,v=Math.sqrt(2*MU/r),middle=propagate({r:[r,0],v:[0,v]},21600);
  const low=propagate({r:[r,0],v:[0,v*(1-1e-10)]},21600),high=propagate({r:[r,0],v:[0,v*(1+1e-10)]},21600);
  const maxNeighbourDistanceKm=Math.max(errorNorm(low.r,middle.r),errorNorm(high.r,middle.r));assert.ok(maxNeighbourDistanceKm<1e-3);
  close(stumpff(0).C,.5,0,'C(0)');close(stumpff(0).S,1/6,0,'S(0)');
  for(const z of [-1e-8,1e-8]){close(stumpff(z).C,.5-z/24,1e-16,'C series');close(stumpff(z).S,1/6-z/120,1e-16,'S series');}
  return{durationSeconds:21600,relativeSpeedPerturbation:1e-10,maxNeighbourDistanceKm,continuityToleranceKm:1e-3,stumpffSeriesTolerance:1e-16};
});

test('Future impact times for elliptic, radial, hyperbolic and parabolic states',()=>{
  const r=EARTH_RADIUS+400,escape=Math.sqrt(2*MU/r);
  const cases=[{label:'retrograde ellipse',state:applyBurn(initialOrbit(400,400),-.5,0)},{label:'radial bound inward',state:{r:[r,0],v:[-1,0]}},{label:'radial bound outward',state:{r:[r,0],v:[1,0]}},{label:'radial hyperbolic inward',state:{r:[r,0],v:[-escape*1.2,0]}},{label:'radial parabolic inward',state:{r:[r,0],v:[-escape,0]}},{label:'oblique hyperbolic inward',state:{r:[r,0],v:[-escape*1.2,1]}},{label:'oblique parabolic inward',state:{r:[r,0],v:[-Math.sqrt(escape**2-1),1]}}];
  const crossings=[];
  for(const item of cases){const t=timeToImpact(item.state);assert.ok(t!==null&&t>0,`${item.label} needs a future crossing`);const end=propagate(item.state,t),surfaceErrorKm=Math.abs(norm(end.r)-EARTH_RADIUS);assert.ok(surfaceErrorKm<2e-5,`${item.label} surface error ${surfaceErrorKm}`);assert.ok(norm(propagate(item.state,t*.999).r)>EARTH_RADIUS);crossings.push({class:item.label,timeSeconds:t,surfaceErrorKm});}
  assert.equal(timeToImpact(initialOrbit(400,400)),null);
  assert.equal(timeToImpact({r:[r,0],v:[escape*1.2,0]}),null);
  assert.equal(timeToImpact({r:[r,0],v:[escape,0]}),null);
  assert.equal(timeToImpact({r:[EARTH_RADIUS,0],v:[0,7]}),0);
  const stopped=sampleTrajectory({r:[EARTH_RADIUS,0],v:[0,7]});assert.equal(stopped.horizon,0);assert.equal(stopped.points.length,1);
  return{crossings,surfaceToleranceKm:2e-5,outboundEscapeAndSafeCircularMissEarth:true};
});

test('Impulse frame orthogonality, retrograde direction and energy accounting',()=>{
  const states=[propagate(initialOrbit(300,35786),7300),{r:[7000,3000],v:[3,-7]}];let maxEnergyIdentityError=0;
  for(const s of states){const f=localFrame(s);close(norm(f.radial),1,1e-14,'radial unit');close(norm(f.prograde),1,1e-14,'transverse unit');close(dot(f.radial,f.prograde),0,1e-14,'orthogonal');
    const p=.55,r=-.22,b=applyBurn(s,p,r),dv=b.v.map((v,i)=>v-s.v[i]);assert.deepEqual(b.r,s.r);close(norm(dv),Math.hypot(p,r),1e-14,'vector magnitude');
    const energyChange=elements(b).energy-elements(s).energy,expected=dot(s.v,dv)+dot(dv,dv)/2;maxEnergyIdentityError=Math.max(maxEnergyIdentityError,Math.abs(energyChange-expected));}
  assert.ok(maxEnergyIdentityError<1e-12);
  return{states:states.length,maxEnergyIdentityError,energyToleranceKmSquaredPerSecondSquared:1e-12};
});

test('Deterministic envelope sweep of actual control ranges and trajectory sampling',()=>{
  let randomSeed=68291;const random=()=>{randomSeed=(Math.imul(1664525,randomSeed)+1013904223)>>>0;return randomSeed/4294967296;};
  const seeds=[[400,400],[300,35786],[20200,20200],[120,100000],[120,120]];let maxEnergyRelativeError=0,maxMomentumRelativeError=0,maxSurfaceErrorKm=0;let collisions=0,escapes=0;
  for(let i=0;i<400;i++){
    const start=initialOrbit(...seeds[i%seeds.length]),initial=elements(start),point=propagate(start,random()*initial.period),burn=applyBurn(point,-3.5+random()*7,-2.5+random()*5),o=elements(burn),impact=timeToImpact(burn),path=sampleTrajectory(burn,100);
    assert.ok(path.points.every(p=>p.every(Number.isFinite)));assert.ok(path.points.every(p=>norm(p)>=EARTH_RADIUS-2e-5));
    if(impact!==null){collisions++;const error=Math.abs(norm(propagate(burn,impact).r)-EARTH_RADIUS);maxSurfaceErrorKm=Math.max(maxSurfaceErrorKm,error);assert.ok(error<2e-5);}
    if(!o.bound)escapes++;
    const t=(impact!==null?Math.min(impact*.9,21600):Math.min(o.period,21600))*random(),end=elements(propagate(burn,t));
    maxEnergyRelativeError=Math.max(maxEnergyRelativeError,Math.abs(end.energy-o.energy)/Math.max(1,Math.abs(o.energy)));maxMomentumRelativeError=Math.max(maxMomentumRelativeError,Math.abs(end.h-o.h)/Math.max(1,Math.abs(o.h)));
    if(path.closed){vectorClose(path.points[0],path.points.at(-1),1e-7,'closed geometry');const unit=o.e>1e-10?o.ev.map(v=>v/o.e):burn.r.map(v=>v/o.radius);for(const p of path.points)close(norm(p)+o.e*dot(unit,p),o.p,2e-5,'display conic');}
  }
  assert.ok(maxEnergyRelativeError<2e-8);assert.ok(maxMomentumRelativeError<2e-8);
  return{samples:400,collisions,escapes,maxEnergyRelativeError,maxMomentumRelativeError,maxSurfaceErrorKm,conservationRelativeTolerance:2e-8,surfaceAndConicToleranceKm:2e-5};
});

test('Invalid inputs and runtime packaging contract',()=>{
  assert.throws(()=>initialOrbit(-1,400),RangeError);assert.throws(()=>initialOrbit(500,400),RangeError);assert.throws(()=>propagate(initialOrbit(400,400),NaN),RangeError);assert.throws(()=>applyBurn(initialOrbit(400,400),Infinity,0),RangeError);
  const html=readFileSync(new URL('./index.html',import.meta.url),'utf8'),main=readFileSync(new URL('./main.js',import.meta.url),'utf8');
  assert.equal((html.match(/<script\b/g)||[]).length,1);assert.ok(html.includes('<script type="module" src="./main.js"></script>'));
  assert.ok(!/\b(fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB)\b/.test(main));assert.ok(!/https?:\/\//.test(html));
  return{invalidStatesRejected:true,exactModuleTag:true,noRuntimeNetworkOrPersistentStorage:true};
});

const output={startedAtUtc:testStartedAtUtc,endedAtUtc:new Date().toISOString(),passed:results.every(x=>x.passed),testCount:results.length,results};
writeFileSync(fileURLToPath(new URL('./self-test-results.json',import.meta.url)),JSON.stringify(output,null,2)+'\n');
console.log(`${results.filter(x=>x.passed).length}/${results.length} tests passed; results saved to self-test-results.json`);
if(!output.passed)process.exitCode=1;
