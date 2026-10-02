import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_MU, applyBurn, circularSpeed, elementsFromState, orbitalPeriod,
  solveKepler, stateAtTime, stateAtTrueAnomaly
} from './physics.js';

const close = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${label}: expected ${expected} ± ${tolerance}, received ${actual}`);
const norm = (s) => Math.hypot(s.x, s.y);

test('Kepler solver converges to the defining equation for circular and eccentric cases', () => {
  for (const e of [0, 0.35, 0.8, 0.95, 0.999]) for (const M of [-9, -Math.PI, -0.2, 0, 0.7, Math.PI, 8]) {
    const E = solveKepler(M, e);
    const reducedM = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    close(E - e * Math.sin(E), reducedM, 2e-11, `Kepler residual e=${e}, M=${M}`);
  }
});

test('Circular state uses vis-viva circular speed and circular osculating elements', () => {
  const a = 7200, s = stateAtTime({ mu: EARTH_MU, a, e: 0 }, 0);
  close(norm(s), a, 1e-9, 'circular radius');
  close(Math.hypot(s.vx, s.vy), circularSpeed(a), 1e-12, 'circular speed');
  const el = elementsFromState(s);
  close(el.a, a, 1e-8, 'recovered semimajor axis');
  close(el.e, 0, 1e-12, 'recovered eccentricity');
  close(el.periapsis, a, 1e-8, 'circular periapsis');
  close(el.apoapsis, a, 1e-8, 'circular apoapsis');
});

test('Elliptic propagation conserves specific energy and angular momentum over one period', () => {
  const orbit = { mu: EARTH_MU, a: 12500, e: 0.35, periapsisAngle: 0.42, meanAnomalyAtEpoch: 0.9 };
  const period = orbitalPeriod(orbit.a);
  const initial = stateAtTime(orbit, 0), initEl = elementsFromState(initial);
  for (let i = 0; i <= 80; i++) {
    const s = stateAtTime(orbit, period * i / 80), el = elementsFromState(s);
    close(el.energy, initEl.energy, 5e-12, `specific energy at sample ${i}`);
    close(el.angularMomentum, initEl.angularMomentum, 2e-10, `angular momentum at sample ${i}`);
  }
  const final = stateAtTime(orbit, period);
  close(final.x, initial.x, 2e-8, 'period return x');
  close(final.y, initial.y, 2e-8, 'period return y');
  close(final.vx, initial.vx, 2e-11, 'period return vx');
  close(final.vy, initial.vy, 2e-11, 'period return vy');
});

test('True-anomaly positioning and tangential apoapsis burn raise periapsis', () => {
  const orbit = { mu: EARTH_MU, a: 12500, e: 0.35, periapsisAngle: 0, meanAnomalyAtEpoch: 0 };
  const peri = stateAtTrueAnomaly(orbit, 0), apo = stateAtTrueAnomaly(orbit, Math.PI);
  close(norm(peri), orbit.a * (1 - orbit.e), 1e-8, 'true anomaly 0 radius');
  close(norm(apo), orbit.a * (1 + orbit.e), 1e-8, 'true anomaly pi radius');
  const before = elementsFromState(apo);
  const result = applyBurn(apo, 0, 0.2);
  assert.equal(result.elements.bound, true);
  assert.ok(result.elements.periapsis > before.periapsis, 'prograde apoapsis burn should raise periapsis');
  close(result.deltaV, 0.2, 1e-15, 'burn magnitude');
});

test('Default clinic prescription meets the 10,000 km clearance objective', () => {
  const apo = stateAtTrueAnomaly({ mu: EARTH_MU, a: 12500, e: 0.35 }, Math.PI);
  const prescription = applyBurn(apo, 0, 0.28);
  assert.equal(prescription.elements.bound, true);
  assert.ok(prescription.elements.periapsis >= 10000,
    `default periapsis ${prescription.elements.periapsis} km should clear the 10,000 km objective`);
  close(prescription.deltaV, 0.28, 1e-15, 'default burn magnitude');
});

test('Prograde escape injection produces an unbound conic and infinite apoapsis', () => {
  const s = stateAtTrueAnomaly({ a: 12500, e: 0.35 }, Math.PI);
  const escape = applyBurn(s, 0, 3.1);
  assert.equal(escape.elements.bound, false);
  assert.equal(escape.elements.apoapsis, Infinity);
});
