import assert from 'node:assert/strict';
import {MU,EARTH,norm,circular,elements,propagate,burn,hohmann,advanceSafe} from './physics.js';
const outcomes=[];
function check(name,actual,expected,tolerance,unit){const error=Math.abs(actual-expected);assert.ok(error<=tolerance,`${name}: error ${error} > ${tolerance}`);outcomes.push({name,actual,expected,error,tolerance,unit});}
function distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
const initial=circular(400),el=elements(initial),quarter=propagate(initial,el.period/4),full=propagate(initial,el.period);
check('Circular quarter-period position',distance(quarter.r,[0,EARTH+400]),0,1e-6,'km');
check('Circular quarter-period velocity',distance(quarter.v,[-Math.sqrt(MU/(EARTH+400)),0]),0,1e-9,'km/s');
check('Circular full-period closure',distance(full.r,initial.r),0,1e-6,'km');
check('Circular eccentricity',el.e,0,1e-12,'dimensionless');
for(const targetAlt of [2000,35786,160]){const p=hohmann(EARTH+400,EARTH+targetAlt),depart=burn(initial,p.dv1,0),arrive=propagate(depart,p.time),circularized=burn(arrive,p.dv2,0),ce=elements(circularized);check(`Hohmann ${targetAlt} km arrival radius`,norm(arrive.r),EARTH+targetAlt,1e-6,'km');check(`Hohmann ${targetAlt} km opposite-apsis position`,distance(arrive.r,[-(EARTH+targetAlt),0]),0,1e-6,'km');check(`Hohmann ${targetAlt} km circularized eccentricity`,ce.e,0,1e-10,'dimensionless');}
const eccentric=burn(initial,1.8,.4);const ee=elements(eccentric);let evolving=eccentric;
for(let i=0;i<1000;i++)evolving=propagate(evolving,ee.period/100);
check('Ten eccentric orbits energy conservation',elements(evolving).energy,ee.energy,1e-8,'km²/s²');
check('Ten eccentric orbits angular momentum conservation',elements(evolving).h,ee.h,1e-6,'km²/s');
check('Ten eccentric orbits closure',distance(evolving.r,eccentric.r),0,1e-3,'km');
const escape=burn(initial,5,1),esc=elements(escape),far=propagate(escape,21600);
assert.ok(esc.e>1&&elements(far).r>esc.r);outcomes.push({name:'Hyperbolic classification and outward escape',passed:true});
check('Hyperbolic six-hour energy conservation',elements(far).energy,esc.energy,1e-9,'km²/s²');
check('Hyperbolic six-hour momentum conservation',elements(far).h,esc.h,1e-6,'km²/s');
check('Hyperbolic time reversal',distance(propagate(far,-21600).r,escape.r),0,1e-5,'km');
const parabolic={r:[EARTH+400,0],v:[0,Math.sqrt(2*MU/(EARTH+400))]},ps=propagate(parabolic,7200);
check('Parabolic propagation energy conservation',elements(ps).energy,0,1e-10,'km²/s²');
check('Parabolic time reversal',distance(propagate(ps,-7200).r,parabolic.r),0,1e-5,'km');
const collision=advanceSafe(burn(initial,-1,0),3000);assert.ok(collision.impact&&collision.elapsed>0&&collision.elapsed<3000);check('Surface contact radius',norm(collision.state.r),EARTH,1e-7,'km');
const safe=advanceSafe(initial,3600);assert.ok(!safe.impact);check('Safe coast agreement with exact propagation',distance(safe.state.r,propagate(initial,3600).r),0,1e-5,'km');
check('Impulse component magnitude',norm(burn(initial,.2,-.3).v.map((x,i)=>x-initial.v[i])),Math.hypot(.2,.3),1e-12,'km/s');
console.log(JSON.stringify({passed:outcomes.length,outcomes},null,2));
