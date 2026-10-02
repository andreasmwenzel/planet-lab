import assert from 'node:assert/strict';
import { MU, EARTH, AIR, fromApsides, elements, propagate, impulse, timeToApoapsis, timeToEntry, repairAt, makePlan } from './physics.js';
const results=[];
const norm=a=>Math.hypot(...a);
const dist=(a,b)=>norm(a.map((x,i)=>x-b[i]));
function check(name,measured,tolerance,unit=''){assert.ok(Number.isFinite(measured)&&measured<=tolerance,`${name}: ${measured} > ${tolerance}`);results.push({name,measured,tolerance,unit,pass:true});}
function exact(name,value,expected){assert.equal(value,expected,name);results.push({name,measured:value,expected,pass:true});}
const circular=fromApsides(400,400,0),r=EARTH+400,T=2*Math.PI*Math.sqrt(r**3/MU);
const quarter=propagate(circular,T/4),full=propagate(circular,T);
check('Circular quarter-period position vs analytic coordinates',dist(quarter.r,[0,r]),1e-6,'km');
check('Circular full-period closure',dist(full.r,circular.r),1e-6,'km');
check('Circular quarter-period speed',Math.abs(norm(quarter.v)-Math.sqrt(MU/r)),1e-9,'km/s');
const ellipse=fromApsides(230,20000,37),e0=elements(ellipse);
let maxEnergy=0,maxH=0,maxRadius=0;
for(let i=0;i<=500;i++){
  const s=propagate(ellipse,e0.period*i/91),e=elements(s);
  maxEnergy=Math.max(maxEnergy,Math.abs((e.energy-e0.energy)/e0.energy));
  maxH=Math.max(maxH,Math.abs((e.h-e0.h)/e0.h));
  maxRadius=Math.max(maxRadius,Math.max(e0.perigee+EARTH-e.r,e.r-e0.apogee-EARTH,0));
}
check('Elliptic specific-energy conservation over 5.49 periods',maxEnergy,1e-9,'relative');
check('Elliptic angular-momentum conservation over 5.49 periods',maxH,1e-9,'relative');
check('Elliptic radii remain within analytic apsides',maxRadius,1e-6,'km');
const advanced=propagate(ellipse,7123),reversed=propagate(advanced,-7123);
check('Elliptic time reversibility (position)',dist(reversed.r,ellipse.r),1e-5,'km');
check('Elliptic time reversibility (velocity)',dist(reversed.v,ellipse.v),1e-8,'km/s');
const hyper={r:[EARTH+500,0],v:[0,12.3]},h0=elements(hyper);let maxHyperE=0,maxHyperH=0;
for(const t of [1,20,600,3600,7200,20000,-600,-7200]){const e=elements(propagate(hyper,t));maxHyperE=Math.max(maxHyperE,Math.abs((e.energy-h0.energy)/h0.energy));maxHyperH=Math.max(maxHyperH,Math.abs((e.h-h0.h)/h0.h));}
check('Hyperbolic specific-energy conservation',maxHyperE,1e-9,'relative');
check('Hyperbolic angular-momentum conservation',maxHyperH,1e-9,'relative');
const hypBack=propagate(propagate(hyper,7200),-7200);
check('Hyperbolic round-trip position',dist(hypBack.r,hyper.r),1e-5,'km');
const parabolic={r:[7000,0],v:[0,Math.sqrt(2*MU/7000)]};
const para=propagate(parabolic,7200),paraBack=propagate(para,-7200);
check('Parabolic zero-energy conservation',Math.abs(elements(para).energy),1e-9,'km²/s²');
check('Parabolic round-trip position',dist(paraBack.r,parabolic.r),1e-5,'km');
// Hohmann transfer from 400 km to 2000 km. Expected values independent of propagator.
const r1=EARTH+400,r2=EARTH+2000,transferA=(r1+r2)/2;
const dv1=(Math.sqrt(MU*(2/r1-1/transferA))-Math.sqrt(MU/r1))*1000;
const dv2=(Math.sqrt(MU/r2)-Math.sqrt(MU*(2/r2-1/transferA)))*1000;
const transfer=impulse(circular,dv1,0),transferTime=Math.PI*Math.sqrt(transferA**3/MU);
const atApo=propagate(transfer,transferTime),final=impulse(atApo,dv2,0),ef=elements(final);
check('Hohmann transfer apogee altitude',Math.abs(elements(atApo).r-r2),1e-6,'km');
check('Hohmann circularization eccentricity',ef.e,1e-10);
check('Hohmann final circular radius',Math.abs(ef.perigee-2000),1e-5,'km');
let maxRepair=0,maxEntry=0,maxApoRadial=0;
const missions=[{p:60,a:1200,n:90,target:180},{p:35,a:2800,n:115,target:220},{p:90,a:700,n:55,target:160}];
for(const m of missions){
  const s=fromApsides(m.p,m.a,m.n),entry=timeToEntry(s),apoTime=timeToApoapsis(s),apo=propagate(s,apoTime);
  assert.ok(entry>apoTime,'Apogee available before deadline');
  maxEntry=Math.max(maxEntry,Math.abs(elements(propagate(s,entry)).r-(EARTH+AIR)));
  exact(`Mission ${m.p}/${m.a} crosses air inbound`,elements(propagate(s,entry)).radial<0,true);
  maxApoRadial=Math.max(maxApoRadial,Math.abs(elements(apo).radial));
  const repair=repairAt(apo,m.target),p=makePlan(s,apoTime,repair.tangential,repair.radial,m.target);
  maxRepair=Math.max(maxRepair,Math.abs(p.orbit.perigee-m.target));
  exact(`Mission ${m.p}/${m.a} repair outcome`,p.outcome,'clear');
  exact(`Mission ${m.p}/${m.a} repaired orbit has no air entry`,p.entryTime,null);
  check(`Mission ${m.p}/${m.a} repaired apogee preserved`,Math.abs(p.orbit.apogee-m.a),1e-6,'km');
  const noBurn=makePlan(s,apoTime,0,0,m.target);
  check(`Mission ${m.p}/${m.a} no-burn entry unchanged`,Math.abs(noBurn.entryTime-entry),1e-6,'s');
  check(`Mission ${m.p}/${m.a} terminal state at air line`,Math.abs(elements(noBurn.stateAt(noBurn.duration)).r-EARTH-AIR),1e-6,'km');
}
check('All mission apoapsis radial speeds',maxApoRadial,1e-9,'km/s');
check('All mission first-entry radius residuals',maxEntry,1e-6,'km');
check('All assisted repair target-perigee residuals',maxRepair,1e-6,'km');
// Arbitrary-point repair must cancel radial motion and make that point apogee.
const off=fromApsides(60,2200,130),offRepair=repairAt(off,300),offState=impulse(off,offRepair.tangential,offRepair.radial),offEl=elements(offState);
check('Off-apsis repair reaches requested perigee',Math.abs(offEl.perigee-300),1e-6,'km');
check('Off-apsis repair cancels radial velocity',Math.abs(offEl.radial),1e-9,'km/s');
check('Off-apsis repair makes local radius the apogee',Math.abs(offEl.apogee+EARTH-norm(off.r)),1e-6,'km');
// Direct velocity-jump check, including sign convention and Euclidean cost.
const input=fromApsides(100,1200,63),changed=impulse(input,123,-87);
check('Impulse position continuity',dist(changed.r,input.r),0,'km');
check('Impulse magnitude matches 2D component norm',Math.abs(dist(changed.v,input.v)*1000-Math.hypot(123,87)),1e-9,'m/s');
const inpEl=elements(input),changedEl=elements(changed);
check('Radial impulse sign and magnitude',Math.abs(changedEl.radial-inpEl.radial+.087),1e-10,'km/s');
// Hyperbolic inbound/outbound entry detection and near-parabolic entry.
// Construct known hyperbola with 50 km periapsis, then evaluate inbound branch.
const hr=EARTH+50,hypPeri={r:[hr,0],v:[0,12.4]},hypInbound=propagate(hypPeri,-500),he=timeToEntry(hypInbound);
assert.ok(he!==null&&he>0);check('Hyperbolic inbound entry radius',Math.abs(norm(propagate(hypInbound,he).r)-EARTH-AIR),1e-6,'km');
exact('Hyperbolic outward branch has no future entry',timeToEntry(propagate(hypPeri,500)),null);
const paraPeri={r:[hr,0],v:[0,Math.sqrt(2*MU/hr)]},paraIn=propagate(paraPeri,-500),pe=timeToEntry(paraIn);
assert.ok(pe!==null&&pe>0);check('Parabolic inbound entry radius',Math.abs(norm(propagate(paraIn,pe).r)-EARTH-AIR),1e-5,'km');
for(const q of [-1e-7,-1e-8,-1e-9,0,1e-9,1e-8,1e-7]) {
  const near={r:[hr,0],v:[0,Math.sqrt(2*MU/hr)*(1+q)]};
  const inbound=propagate(near,-500),crossing=timeToEntry(inbound);
  assert.ok(crossing!==null&&crossing>0);
  check(`Near-parabolic entry radius, velocity offset ${q}`,Math.abs(norm(propagate(inbound,crossing).r)-EARTH-AIR),1e-6,'km');
}
exact('Safe circular orbit never crosses air',timeToEntry(circular),null);
exact('Start below air is terminal',timeToEntry(fromApsides(50,100,90)),0);
// Fixed-seed stress test covers actual UI ranges, incl. escaping and inward plans.
let seed=73199;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let maxStressE=0,maxStressH=0,stressCount=0;
for(let i=0;i<200;i++){
  const m=missions[i%missions.length],s=fromApsides(m.p,m.a,m.n),window=timeToEntry(s),t=rand()*(window-1),dvT=(rand()*2-1)*1500,dvR=(rand()*2-1)*1500;
  const p=makePlan(s,t,dvT,dvR,m.target),e=elements(p.after);
  for(const fraction of [.1,.5,.99]){const st=propagate(p.after,(p.duration-p.burnTime)*fraction),out=elements(st);maxStressE=Math.max(maxStressE,Math.abs(out.energy-e.energy)/Math.max(1,Math.abs(e.energy)));maxStressH=Math.max(maxStressH,Math.abs((out.h-e.h)/e.h));assert.ok(out.r>=EARTH+AIR-1e-5,'No post-burn sample before stop lies inside atmosphere');stressCount++;}
  if(p.endsAtEntry)check(`Stress entry boundary ${i}`,Math.abs(norm(p.stateAt(p.duration).r)-EARTH-AIR),2e-5,'km');
}
const highEllipse=fromApsides(40,20000,100);
const highPlan=makePlan(highEllipse,0,1000,1500,180);
check('Replay respects the bound/open post-burn time cap',highPlan.duration-highPlan.burnTime,highPlan.orbit.bound?28800:7200,'s');
const late=makePlan(fromApsides(60,1200,90),0,0,0,180);
check('Requested burn beyond deadline is clamped before air',makePlan(late.initial,1e9,0,0).burnTime,late.window-0.099,'s');
check('600 stress-propagation energy residuals',maxStressE,1e-8,'relative (floor 1 km²/s²)');
check('600 stress-propagation momentum residuals',maxStressH,1e-8,'relative');
exact('Stress propagated samples',stressCount,600);
console.log(JSON.stringify({passed:true,assertions:results.length,results},null,2));
