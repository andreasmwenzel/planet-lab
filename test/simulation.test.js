import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, orbitPosition, advanceTime, seededRandom, cometPosition } from '../src/simulation.js';

const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} is not close to ${b}`);
test('planet identifiers are unique and physical display values are positive', () => {
  assert.equal(new Set(PLANETS.map(p=>p.id)).size, PLANETS.length);
  PLANETS.forEach(p=>{assert.ok(p.radius>0);assert.ok(p.period>0);assert.ok(p.orbit>p.radius);});
});
test('each planet completes its orbit after its stated period', () => {
  for(const p of PLANETS){const a=orbitPosition(p,0),b=orbitPosition(p,p.period);close(a.x,b.x);close(a.y,b.y);close(a.z,b.z);}
});
test('orbital distance in the x-z plane stays fixed', () => {
  for(const p of PLANETS)for(const t of [0,10,99,1000]){const pos=orbitPosition(p,t);close(Math.hypot(pos.x,pos.z),p.orbit);}
});
test('pause freezes the simulation, speed scales it, and tab-switch jumps are clamped', () => {
  assert.equal(advanceTime(4,.05,3,true),4);
  close(advanceTime(4,.05,2,false),4.1);
  close(advanceTime(4,60,1,false),4.1);
  close(advanceTime(4,-1,1,false),4);
});
test('invalid frame deltas and out-of-range speeds stay safe',()=>{
  close(advanceTime(4,NaN,1,false),4);
  close(advanceTime(4,.1,100,false),4.3);
  close(advanceTime(4,.1,-2,false),4.025);
  close(advanceTime(4,.1,NaN,false),4.1);
});
test('procedural randomness is deterministic and bounded',()=>{
  const a=seededRandom(42),b=seededRandom(42);
  for(let i=0;i<500;i++){const value=a();assert.equal(value,b());assert.ok(value>=0&&value<1);}
});
test('comet path is bounded and crosses the system',()=>{
  assert.deepEqual(cometPosition(-1),cometPosition(0));assert.deepEqual(cometPosition(2),cometPosition(1));
  assert.equal(cometPosition(0).x,-20);assert.equal(cometPosition(1).x,20);
  assert.ok(cometPosition(.5).y>cometPosition(0).y);
});
