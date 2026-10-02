import assert from 'node:assert/strict';
import {MU,R,norm,elements,propagate,burn,apsisState,hohmann,advanceToSurface} from './physics.mjs';
const results=[];
function check(name,actual,tolerance){assert.ok(Number.isFinite(actual)&&actual<=tolerance,`${name}: ${actual} > ${tolerance}`);results.push({name,actual,tolerance,passed:true})}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const circular=apsisState(400,400),ec=elements(circular);
check('circular eccentricity',ec.e,1e-12);
check('circular quarter-period position (km)',distance(propagate(circular,ec.period/4).r,[0,R+400]),1e-6);
check('circular full-period closure (km)',distance(propagate(circular,ec.period).r,circular.r),1e-6);
check('circular 100-period closure (km)',distance(propagate(circular,ec.period*100).r,circular.r),1e-5);
const transfer=apsisState(400,35786),et=elements(transfer),atApo=propagate(transfer,et.period/2);
check('elliptic apogee radius error (km)',Math.abs(norm(atApo.r)-(R+35786)),1e-5);
check('elliptic apogee position (km)',distance(atApo.r,[-(R+35786),0]),1e-5);
for(const [name,s,duration] of [['elliptical',transfer,et.period*1.7],['hyperbolic',{r:[R+400,0],v:[0,11.3]},120000],['parabolic',{r:[R+400,0],v:[0,Math.sqrt(2*MU/(R+400))]},100000],['radial component',burn(circular,100,400),6000]]){
 const e0=elements(s),p=propagate(s,duration),e1=elements(p),back=propagate(p,-duration);
 check(`${name} energy absolute error (km²/s²)`,Math.abs(e1.energy-e0.energy),1e-8);
 check(`${name} angular momentum relative error`,Math.abs(e1.h-e0.h)/Math.abs(e0.h),1e-8);
 check(`${name} time reversal position (km)`,distance(back.r,s.r),.001);
 check(`${name} time reversal velocity (km/s)`,distance(back.v,s.v),1e-6);
}
let stepped=circular;for(let i=0;i<2000;i++)stepped=propagate(stepped,10);
check('2000 steps vs direct position (km)',distance(stepped.r,propagate(circular,20000).r),.002);
const changed=burn(circular,100,200);check('along-track burn m/s conversion',Math.abs(changed.v[1]-circular.v[1]-.1),1e-12);check('radial burn m/s conversion',Math.abs(changed.v[0]-.2),1e-12);
const h=hohmann(R+400,R+2000),after1=burn(circular,h.dv1,0),arrival=propagate(after1,h.time),after2=burn(arrival,h.dv2,0);
check('Hohmann arrival radius (km)',Math.abs(norm(arrival.r)-(R+2000)),1e-5);
check('Hohmann final circular eccentricity',elements(after2).e,1e-9);
check('Hohmann final circular speed (km/s)',Math.abs(norm(after2.v)-Math.sqrt(MU/(R+2000))),1e-9);
const downward=hohmann(R+2000,R+400),high=apsisState(2000,2000),downArrival=propagate(burn(high,downward.dv1,0),downward.time);
check('descending Hohmann final eccentricity',elements(burn(downArrival,downward.dv2,0)).e,1e-9);
const impactOrbit=apsisState(-100,400), approach=propagate(impactOrbit,-1000),contact=advanceToSurface(approach,2000);
assert.equal(contact.contact,true);check('surface contact radius (km)',Math.abs(norm(contact.state.r)-R),1e-7);
const grazing=apsisState(-.00001,400),beforeGraze=propagate(grazing,-5),graze=advanceToSurface(beforeGraze,10);
assert.equal(graze.contact,true);check('grazing surface event radius (km)',Math.abs(norm(graze.state.r)-R),1e-7);
assert.equal(advanceToSurface(circular,600).contact,false);
console.log(JSON.stringify({passed:true,count:results.length,results},null,2));
