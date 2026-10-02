import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { MU, EARTH_RADIUS as R, norm, dot, cross, makeOrbit, elements, propagate, burn, hohmann, timeToImpact, advance, orbitPath, stumpff } from './physics.mjs';
const results=[];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function check(name, measured, tolerance, unit='') {
  const passed=Number.isFinite(measured)&&measured<=tolerance;
  results.push({name,measured,tolerance,unit,passed});
  assert.ok(passed,`${name}: ${measured} ${unit} exceeds ${tolerance}`);
}
function invariantErrors(initial, final) {
  const a=elements(initial),b=elements(final);
  return {energy:Math.abs((b.energy-a.energy)/a.energy),momentum:Math.abs((b.h-a.h)/a.h)};
}
function truth(name, value) {results.push({name,passed:Boolean(value)});assert.ok(value,name)}

const circular=makeOrbit(400,400,0),cel=elements(circular);
check('400 km circular speed versus direct gravitational balance',Math.abs(cel.speed-Math.sqrt(MU/(R+400))),1e-12,'km/s');
check('400 km circular eccentricity',cel.e,2e-15);
let positionError=0,velocityError=0;
for(const f of [0.01,.1,.25,.5,.9,1,5.25,100.25]){
  const t=cel.period*f,s=propagate(circular,t),angle=2*Math.PI*f;
  positionError=Math.max(positionError,distance(s.r,[(R+400)*Math.cos(angle),(R+400)*Math.sin(angle)]));
  velocityError=Math.max(velocityError,distance(s.v,[-cel.speed*Math.sin(angle),cel.speed*Math.cos(angle)]));
}
check('Circular analytic positions through 100.25 periods',positionError,5e-5,'km');
check('Circular analytic velocities through 100.25 periods',velocityError,5e-8,'km/s');
const circularRepeated=(()=>{let s=circular;for(let i=0;i<10000;i++)s=propagate(s,cel.period/200);return s})();
const cerr=invariantErrors(circular,circularRepeated);
check('50 circular periods / 10,000 steps: relative energy drift',cerr.energy,2e-7);
check('50 circular periods / 10,000 steps: relative angular momentum drift',cerr.momentum,2e-7);
check('50 circular periods / 10,000 steps: closure error',distance(circular.r,circularRepeated.r),.03,'km');

for(const [name,p,a] of [['Geotransfer',250,35786],['High ellipse',120,100000]]){
  const initial=makeOrbit(p,a,0),el=elements(initial),half=propagate(initial,el.period/2);
  check(`${name}: half-period apoapsis radius`,Math.abs(norm(half.r)-(R+a)),.0002,'km');
  check(`${name}: half-period opposite side`,Math.abs(half.r[1]),.0002,'km');
  const inv=invariantErrors(initial,half);
  check(`${name}: relative energy conservation`,inv.energy,2e-9);
  check(`${name}: relative angular momentum conservation`,inv.momentum,2e-9);
  let repeated=initial;for(let i=0;i<1500;i++)repeated=propagate(repeated,el.period/150);
  check(`${name}: 10 repeated periods closure`,distance(repeated.r,initial.r),.1,'km');
  check(`${name}: forward / backward reversibility`,distance(propagate(propagate(initial,6543.21),-6543.21).r,initial.r),.0002,'km');
}

for(const [name,start,target] of [['Raise 400→1200',400,1200],['Lower 1200→400',1200,400],['High transfer 400→100000',400,100000]]){
  const origin=makeOrbit(start,start,.71),plan=hohmann(origin,target),departure=burn(origin,plan.departure),arrival=propagate(departure,plan.duration),final=burn(arrival,plan.arrival);
  const ef=elements(final);
  check(`${name}: arrival target radius`,Math.abs(norm(arrival.r)-(R+target)),.001,'km');
  check(`${name}: final circular eccentricity`,ef.e,2e-8);
  check(`${name}: final circular speed`,Math.abs(ef.speed-Math.sqrt(MU/(R+target))),2e-8,'km/s');
  check(`${name}: total Δv equals component magnitudes`,Math.abs(plan.totalDeltaV-Math.abs(plan.departure)-Math.abs(plan.arrival)),1e-9,'m/s');
}
const plan400=hohmann(circular,1200);
check('400→1200 departure Δv independent energy equation',Math.abs(plan400.departure-(Math.sqrt(2*MU*(R+1200)/((R+400)*(2*R+1600)))-Math.sqrt(MU/(R+400)))*1000),1e-9,'m/s');
truth('Lowering transfer burns are both negative',hohmann(makeOrbit(1200),400).departure<0&&hohmann(makeOrbit(1200),400).arrival<0);

const altered=burn(circular,100,-50);
check('Burn preserves position',distance(altered.r,circular.r),0,'km');
check('Transverse impulse actual Cartesian velocity',Math.abs(altered.v[1]-circular.v[1]-.1),1e-14,'km/s');
check('Radial impulse actual Cartesian velocity',Math.abs(altered.v[0]+.05),1e-14,'km/s');
const reverse={r:[...circular.r],v:circular.v.map(v=>-v)};
check('Retrograde positive transverse burn adds orbital speed',Math.abs(norm(burn(reverse,100).v)-norm(reverse.v)-.1),1e-14,'km/s');
check('Retrograde quarter-period direction',distance(propagate(reverse,cel.period/4).r,[0,-(R+400)]),.0001,'km');

const escape={r:[R+600,0],v:[0,Math.sqrt(2*MU/(R+600))*1.08]};
const open=propagate(escape,86400),oerr=invariantErrors(escape,open);
truth('Hyperbola remains open and travels outward',!elements(open).bound&&norm(open.r)>norm(escape.r));
check('Hyperbola at 1 day: relative energy conservation',oerr.energy,2e-9);
check('Hyperbola at 1 day: relative angular momentum conservation',oerr.momentum,2e-9);
check('Hyperbola: forward/backward position reversibility',distance(propagate(open,-86400).r,escape.r),.005,'km');
const parabolic={r:[R+600,0],v:[0,Math.sqrt(2*MU/(R+600))]},par=propagate(parabolic,10000);
check('Parabola: absolute specific energy',Math.abs(elements(par).energy),1e-8,'km²/s²');
check('Parabola: angular momentum conservation',Math.abs(cross(par.r,par.v)/cross(parabolic.r,parabolic.v)-1),1e-9);
check('Parabola: backward reversibility',distance(propagate(par,-10000).r,parabolic.r),.001,'km');

const deorbit=burn(circular,-250),hit=timeToImpact(deorbit),impact=advance(deorbit,cel.period*3);
truth('Deorbit predicts a finite future inbound surface crossing',Number.isFinite(hit)&&hit>0&&hit<cel.period);
truth('Advancing across multiple periods cannot skip impact',impact.impacted);
check('Impact propagation stops at predicted time',Math.abs(impact.elapsed-hit),1e-10,'s');
check('Impact propagation stops at spherical surface',Math.abs(norm(impact.state.r)-R),.001,'km');
truth('Impact velocity is inbound',dot(impact.state.r,impact.state.v)<0);
truth('Circular safe orbit has no impact',timeToImpact(circular)===Infinity);
truth('Outbound hyperbola with below-surface past periapsis has no future impact',timeToImpact({r:[R+400,0],v:[12,5]})===Infinity);
for(const [name,e] of [['Hyperbolic',1.4],['Parabolic',1]]){
  const rp=R-100,peri={r:[rp,0],v:[0,Math.sqrt(MU*(1+e)/rp)]},incoming=propagate(peri,-1200);
  truth(`${name} impact initial state starts above surface`,norm(incoming.r)>R);
  const result=advance(incoming,2400);
  truth(`${name} inbound surface encounter detected`,result.impacted);
  check(`${name} impact radius`,Math.abs(norm(result.state.r)-R),.003,'km');
}

for (const eccentricity of [1-1e-6, 1-1e-9, 1-1e-12, 1+1e-12, 1+1e-9, 1+1e-6]) {
  const rp=R-100, peri={r:[rp,0],v:[0,Math.sqrt(MU*(1+eccentricity)/rp)]};
  const incoming=propagate(peri,-1200),result=advance(incoming,2400);
  truth(`Near-parabolic e=${eccentricity}: impact detected`,result.impacted);
  check(`Near-parabolic e=${eccentricity}: surface residual`,Math.abs(norm(result.state.r)-R),.00001,'km');
}
let random=38177, randomEnergy=0, randomMomentum=0, randomImpact=0, randomCount=0;
const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296};
for(let i=0;i<200;i++){
  const altitude=120+rand()*99880, origin=makeOrbit(altitude,altitude,rand()*Math.PI*2);
  let candidate;try{candidate=burn(origin,(rand()-.5)*24000,(rand()-.5)*24000)}catch{continue}
  const result=advance(candidate,rand()*86400),a=elements(candidate),b=elements(result.state);
  randomEnergy=Math.max(randomEnergy,Math.abs(b.energy-a.energy)/Math.max(1,Math.abs(a.energy)));
  randomMomentum=Math.max(randomMomentum,Math.abs(b.h/a.h-1));
  if(result.impacted)randomImpact=Math.max(randomImpact,Math.abs(norm(result.state.r)-R));
  randomCount++;
}
truth('Deterministic arbitrary-burn coverage includes at least 190 valid states',randomCount>=190);
check('200 arbitrary-burn cases: scaled specific-energy residual',randomEnergy,1e-7);
check('200 arbitrary-burn cases: relative angular-momentum residual',randomMomentum,1e-7);
check('200 arbitrary-burn cases: maximum surface-stop residual',randomImpact,.00001,'km');

// Independent fourth-order Cartesian integration, not the production propagator.
// This oracle is used only to validate f/g motion for an arbitrary eccentric state.
function rk4(s,dt){
 const z=[...s.r,...s.v];
 const d=x=>{const r=Math.hypot(x[0],x[1]),k=-MU/(r*r*r);return[x[2],x[3],x[0]*k,x[1]*k]};
 const add=(a,b,k)=>a.map((v,i)=>v+k*b[i]);
 const a=d(z),b=d(add(z,a,dt/2)),c=d(add(z,b,dt/2)),e=d(add(z,c,dt));
 const n=z.map((v,i)=>v+dt/6*(a[i]+2*b[i]+2*c[i]+e[i]));return{r:n.slice(0,2),v:n.slice(2)};
}
const testState=burn(makeOrbit(600,12000,.2),230,-80);let oracle=testState;
for(let i=0;i<12000;i++)oracle=rk4(oracle,.5);
const actual=propagate(testState,6000);
check('Arbitrary eccentric motion vs independent RK4 (12,000 × 0.5 s)',distance(actual.r,oracle.r),.0002,'km');
check('Arbitrary eccentric velocity vs independent RK4',distance(actual.v,oracle.v),2e-8,'km/s');

for(const fn of [()=>makeOrbit(-1),()=>makeOrbit(500,400),()=>makeOrbit(100001),()=>burn(circular,13000),()=>burn(circular,-norm(circular.v)*1000),()=>hohmann(makeOrbit(400,800),1200),()=>hohmann(circular,400),()=>propagate(circular,NaN),()=>advance(circular,-1)])assert.throws(fn);
truth('Input validation rejects invalid or unsupported requests',true);
const paths=orbitPath(escape,150000);
truth('Open conic path samples are finite and bounded',paths.filter(Boolean).every(p=>p.every(Number.isFinite)&&norm(p)<150000));
check('Stumpff C at zero',Math.abs(stumpff(0)[0]-.5),0);
check('Stumpff S at zero',Math.abs(stumpff(0)[1]-1/6),0);
check('Stumpff series / trig continuity',Math.abs(stumpff(.05-1e-10)[0]-stumpff(.05+1e-10)[0]),1e-10);
const report={executedAt:new Date().toISOString(),command:'node numerical-tests.mjs',implementation:'./physics.mjs',passed:results.every(r=>r.passed),checks:results.length,results,referenceTransfer:{departureMs:plan400.departure,arrivalMs:plan400.arrival,totalMs:plan400.totalDeltaV,coastSeconds:plan400.duration}};
await writeFile(new URL('./test-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
