import assert from 'node:assert/strict';
import {
  MU, EARTH_RADIUS, ENTRY_ALTITUDE, TAU, norm, dot, cross, wrapAngle,
  stumpff, propagate, elements, makeInitial, applyBurn, firstSphereCrossing,
  longitudeAt, inWindow, buildMission, stateAt, deorbitBurn, solveDeparture,
} from './physics.js';

const results = [];
let largestPositionError = 0, largestEnergyError = 0, largestHError = 0;
function close(actual, expected, tolerance, name) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${name}: ${actual} vs ${expected}, tolerance ${tolerance}`);
}
function vectorError(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function check(name, fn) {
  const begin = performance.now();
  const details = fn();
  results.push({ name, status: 'passed', milliseconds: Number((performance.now() - begin).toFixed(3)), ...details });
  console.log(`PASS ${name}${details ? ` ${JSON.stringify(details)}` : ''}`);
}

check('Circular quarter-turn agrees with analytic coordinates', () => {
  const radius = EARTH_RADIUS + 400, speed = Math.sqrt(MU / radius);
  const period = TAU * Math.sqrt(radius ** 3 / MU);
  const value = propagate({ r: [radius, 0], v: [0, speed] }, period / 4);
  const rError = vectorError(value.r, [0, radius]), vError = vectorError(value.v, [-speed, 0]);
  close(rError, 0, 1e-7, 'position km'); close(vError, 0, 1e-10, 'velocity km/s');
  return { positionErrorKm: rError, velocityErrorKmS: vError, tolerances: { positionKm: 1e-7, velocityKmS: 1e-10 } };
});

check('Thirty orbit ellipse closes and conserves invariants', () => {
  const state = makeInitial(280, 1100, -65), initial = elements(state);
  let final;
  for (let i = 1; i <= 120; i++) {
    final = propagate(state, initial.period * i / 4);
    const el = elements(final);
    largestEnergyError = Math.max(largestEnergyError, Math.abs((el.energy - initial.energy) / initial.energy));
    largestHError = Math.max(largestHError, Math.abs((el.h - initial.h) / initial.h));
  }
  const error = vectorError(final.r, state.r);
  close(error, 0, 1e-5, '30-orbit closure km');
  close(largestEnergyError, 0, 1e-10, 'relative energy'); close(largestHError, 0, 1e-10, 'relative angular momentum');
  return { closureErrorKm: error, maxRelativeEnergyError: largestEnergyError, maxRelativeAngularMomentumError: largestHError, tolerances: { closureKm: 1e-5, invariantsRelative: 1e-10 } };
});

check('Ellipse apo/perigee and half-period match vis-viva', () => {
  const state = makeInitial(300, 1600, 0), el = elements(state);
  const value = propagate(state, el.period / 2);
  close(norm(value.r), EARTH_RADIUS + 300, 1e-7, 'perigee radius');
  close(norm(value.v), Math.sqrt(MU * (2 / (EARTH_RADIUS + 300) - 1 / el.a)), 1e-10, 'perigee speed');
  close(dot(value.r, value.v), 0, 1e-7, 'radial velocity at apsis');
  return { measuredPerigeeKm: norm(value.r) - EARTH_RADIUS, positionToleranceKm: 1e-7, speedToleranceKmS: 1e-10 };
});

function rk4(state, duration, step = 0.25) {
  let y = [...state.r, ...state.v];
  const derivative = a => { const r = Math.hypot(a[0], a[1]); return [a[2], a[3], -MU * a[0] / r ** 3, -MU * a[1] / r ** 3]; };
  const add = (a, b, h) => a.map((x, i) => x + b[i] * h);
  const count = Math.ceil(Math.abs(duration) / step), h = duration / count;
  for (let i = 0; i < count; i++) {
    const k1 = derivative(y), k2 = derivative(add(y, k1, h / 2)), k3 = derivative(add(y, k2, h / 2)), k4 = derivative(add(y, k3, h));
    y = y.map((x, j) => x + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
  }
  return { r: y.slice(0, 2), v: y.slice(2) };
}

check('Universal propagation matches independent RK4 across conic regimes', () => {
  const radius = EARTH_RADIUS + 600, escape = Math.sqrt(2 * MU / radius);
  const cases = [
    { name: 'elliptic', state: { r: [radius, 0], v: [0.5, escape * 0.78] } },
    { name: 'near-parabolic-below', state: { r: [radius, 0], v: [0, escape * (1 - 1e-9)] } },
    { name: 'parabolic', state: { r: [radius, 0], v: [0, escape] } },
    { name: 'near-parabolic-above', state: { r: [radius, 0], v: [0, escape * (1 + 1e-9)] } },
    { name: 'hyperbolic', state: { r: [radius, 0], v: [1.5, escape * 1.2] } },
  ];
  const details = cases.map(({ name, state }) => {
    const value = propagate(state, 1800), reference = rk4(state, 1800);
    const positionError = vectorError(value.r, reference.r), velocityError = vectorError(value.v, reference.v);
    largestPositionError = Math.max(largestPositionError, positionError);
    close(positionError, 0, 2e-5, `${name} RK4 position km`); close(velocityError, 0, 2e-8, `${name} RK4 velocity km/s`);
    return { name, positionErrorKm: positionError, velocityErrorKmS: velocityError };
  });
  return { cases: details, independentReference: 'RK4 acceleration integration, 0.25 s steps', tolerances: { positionKm: 2e-5, velocityKmS: 2e-8 } };
});

check('Forward/backward propagation is reversible', () => {
  const starts = [makeInitial(400, 400, 25), makeInitial(180, 2400, -170), applyBurn(makeInitial(), 4200, 300)];
  let maxR = 0, maxV = 0;
  for (const state of starts) for (const time of [1, 300, 2000, 10000]) {
    const back = propagate(propagate(state, time), -time);
    maxR = Math.max(maxR, vectorError(back.r, state.r)); maxV = Math.max(maxV, vectorError(back.v, state.v));
  }
  close(maxR, 0, 2e-5, 'reversible position'); close(maxV, 0, 2e-8, 'reversible velocity');
  return { maxPositionErrorKm: maxR, maxVelocityErrorKmS: maxV, tolerances: { positionKm: 2e-5, velocityKmS: 2e-8 } };
});

check('Radial/transverse impulses are correct in both momentum directions', () => {
  for (const direction of [1, -1]) {
    const state = { r: [7000 / Math.sqrt(2), 7000 / Math.sqrt(2)], v: [-7 / Math.sqrt(2) * direction, 7 / Math.sqrt(2) * direction] };
    const burned = applyBurn(state, 120, -45);
    close(vectorError(burned.r, state.r), 0, 1e-12, 'impulse preserves position');
    close(vectorError(burned.v, state.v), Math.hypot(0.120, -0.045), 1e-12, 'impulse magnitude km/s');
    close(dot(burned.v.map((x, i) => x - state.v[i]), state.r) / norm(state.r), -0.045, 1e-12, 'radial component');
    assert.equal(Math.sign(cross(burned.r, burned.v)), direction);
  }
  return { toleranceKmS: 1e-12, directionsTested: ['prograde', 'retrograde'] };
});

check('80 km template yields exact apsides and analytic 120 km crossing', () => {
  const state = makeInitial(400, 400, 0), recipe = deorbitBurn(state);
  const after = applyBurn(state, recipe.transverse, recipe.radial), el = elements(after);
  close(el.periapsis - EARTH_RADIUS, 80, 1e-7, 'template perigee'); close(el.apoapsis - EARTH_RADIUS, 400, 1e-7, 'template apogee');
  const hit = firstSphereCrossing(after, EARTH_RADIUS + ENTRY_ALTITUDE, 10000);
  assert.notEqual(hit, null);
  const R = EARTH_RADIUS + ENTRY_ALTITUDE;
  const E = TAU - Math.acos((1 - R / el.a) / el.e);
  const expected = (E - el.e * Math.sin(E) - Math.PI) / Math.sqrt(MU / el.a ** 3);
  close(hit, expected, 1e-7, 'independent anomaly crossing time');
  const at = propagate(after, hit);
  close(norm(at.r), R, 1e-7, 'crossing radius'); assert.ok(dot(at.r, at.v) < 0, 'descending crossing');
  assert.equal(firstSphereCrossing(after, R, hit - 1), null);
  return { deltaVMS: Math.hypot(recipe.transverse, recipe.radial), hitTimeS: hit, anomalyTimeErrorS: Math.abs(hit - expected), crossingAltitudeKm: norm(at.r) - EARTH_RADIUS, tolerance: { timeS: 1e-7, radiusKm: 1e-7 } };
});

check('Hyperbolic and parabolic inbound crossing is finite and descending', () => {
  let maxError = 0;
  for (const factor of [1, 1.15]) {
    const state = { r: [9000, 0], v: [-Math.sqrt(2 * MU / 9000 * factor ** 2 - 1), 1] };
    const hit = firstSphereCrossing(state, EARTH_RADIUS + ENTRY_ALTITUDE, 3000);
    assert.notEqual(hit, null, `factor ${factor} crossing exists`);
    const at = propagate(state, hit), error = Math.abs(norm(at.r) - EARTH_RADIUS - ENTRY_ALTITUDE);
    maxError = Math.max(maxError, error); close(error, 0, 2e-5, 'non-elliptic crossing radius'); assert.ok(dot(at.r, at.v) < 0);
    const outbound = { r: [...state.r], v: state.v.map(x => -x) };
    assert.equal(firstSphereCrossing(outbound, EARTH_RADIUS + ENTRY_ALTITUDE, 3000), null);
  }
  return { maxCrossingRadiusErrorKm: maxError, toleranceKm: 2e-5 };
});

check('Rotating-Earth longitude and wrapped sectors behave at the date line', () => {
  close(longitudeAt({ r: [7000, 0], v: [0, 0] }, 86164.0905 / 4), -90, 1e-10, 'Earth rotation');
  assert.ok(inWindow(-179, 179, 3)); assert.ok(inWindow(179, -179, 3)); assert.ok(!inWindow(170, -179, 3));
  close(wrapAngle(5 * Math.PI), -Math.PI, 1e-12, 'angle wrap');
  return { toleranceDegrees: 1e-10, dateLineChecks: 3 };
});

check('Mission ledger executes chronologically and stops at handoff', () => {
  const initial = makeInitial();
  const burns = [{ id: 'later', time: 7000, transverse: 500, radial: 0 }, { id: 'first', time: 600, transverse: -90, radial: 0 }];
  const plan = buildMission(initial, burns, 10800);
  assert.ok(plan.entry); assert.equal(plan.events[0].id, 'first'); assert.equal(plan.events[1].skipped, true);
  close(plan.totalDV, 590, 1e-10, 'planned impulse'); close(plan.executedDV, 90, 1e-10, 'executed impulse');
  close(norm(plan.final.r) - EARTH_RADIUS, 120, 1e-7, 'mission endpoint');
  close(vectorError(stateAt(plan, 99999).r, plan.final.r), 0, 1e-7, 'post-handoff clamped time');
  const atBurn = stateAt(plan, 600);
  close(vectorError(atBurn.v, plan.events[0].after.v), 0, 1e-10, 'post-impulse state at event time');
  assert.equal(buildMission(initial, [], 10800).entry, null);
  const simultaneous = buildMission(initial, [{ id: 'a', time: 0, transverse: 20, radial: 0 }, { id: 'b', time: 0, transverse: -20, radial: 0 }], 3600);
  close(vectorError(stateAt(simultaneous, 0).v, initial.v), 0, 1e-12, 'simultaneous burns stable ordering');
  return { handoffTimeS: plan.endTime, plannedDVMS: plan.totalDV, executedDVMS: plan.executedDV, radiusToleranceKm: 1e-7 };
});

check('One-burn solver acquires each preset corridor within budget', () => {
  const cases = [
    { perigee: 400, apogee: 400, phase: 25, duration: 10800, center: -150, budget: 150 },
    { perigee: 280, apogee: 1100, phase: -65, duration: 14400, center: -70, budget: 450 },
    { perigee: 800, apogee: 800, phase: 120, duration: 18000, center: 110, budget: 230 },
  ];
  const values = cases.map(c => {
    const initial = makeInitial(c.perigee, c.apogee, c.phase);
    const solution = solveDeparture(initial, c.duration, c.center, c.budget);
    assert.ok(solution, 'solver found feasible departure');
    const plan = buildMission(initial, [{ id: 'solved', time: solution.time, transverse: solution.transverse, radial: solution.radial }], c.duration);
    assert.ok(plan.entry); assert.ok(plan.totalDV <= c.budget + 1e-6);
    const error = Math.abs(wrapAngle((plan.entry.longitude - c.center) * Math.PI / 180)) * 180 / Math.PI;
    close(error, 0, 1e-4, 'solver corridor-center error degrees');
    return { targetDegrees: c.center, actualDegrees: plan.entry.longitude, errorDegrees: error, deltaVMS: plan.totalDV, burnTimeS: solution.time };
  });
  assert.equal(solveDeparture(makeInitial(), 10800, -150, 1), null, 'unfeasible budget fails explicitly');
  return { cases: values, longitudeToleranceDegrees: 1e-4, budgetToleranceMS: 1e-6 };
});

check('Stumpff zero and invalid-input guards', () => {
  close(stumpff(0).c, 0.5, 1e-15, 'C(0)'); close(stumpff(0).s, 1 / 6, 1e-15, 'S(0)');
  assert.throws(() => propagate({ r: [0, 0], v: [1, 0] }, 1), /singular/);
  assert.throws(() => propagate(makeInitial(), NaN), /finite/);
  assert.throws(() => deorbitBurn(makeInitial(), 800), /below/);
  return { stumpffTolerance: 1e-15, rejectedCases: 3 };
});

check('Exactly radial descent uses the bounded event fallback', () => {
  const state = { r: [EARTH_RADIUS + 1000, 0], v: [-1, 0] };
  const hit = firstSphereCrossing(state, EARTH_RADIUS + ENTRY_ALTITUDE, 2000);
  assert.notEqual(hit, null);
  const at = propagate(state, hit);
  const error = Math.abs(norm(at.r) - EARTH_RADIUS - ENTRY_ALTITUDE);
  close(error, 0, 1e-7, 'radial fallback crossing altitude');
  assert.ok(dot(at.r, at.v) < 0);
  return { hitTimeS: hit, radiusErrorKm: error, toleranceKm: 1e-7, bracketStepS: 5 };
});

check('Two hundred deterministic mission states remain finite and stop above Earth', () => {
  let count = 0, lowestEndpoint = Infinity;
  for (let i = 0; i < 200; i++) {
    const initial = makeInitial(180 + i * 7 % 1000, 1200 + i * 13 % 1500, i * 37 % 360 - 180);
    const burns = [{ id: 'stress', time: i * 83 % 6000, transverse: (i * 379 % 10000) - 5000, radial: (i * 137 % 10000) - 5000 }];
    const plan = buildMission(initial, burns, 21600, 60);
    assert.ok(plan.samples.every(p => [...p.r, ...p.v].every(Number.isFinite)), `state ${i} samples finite`);
    const altitude = norm(plan.final.r) - EARTH_RADIUS;
    lowestEndpoint = Math.min(lowestEndpoint, altitude);
    assert.ok(altitude >= ENTRY_ALTITUDE - 2e-5, `state ${i} did not propagate into Earth`);
    if (plan.entry) close(altitude, ENTRY_ALTITUDE, 2e-5, `state ${i} interface radius`);
    count++;
  }
  return { cases: count, componentRangeMS: [-5000, 5000], horizonS: 21600, lowestEndpointAltitudeKm: lowestEndpoint, crossingToleranceKm: 2e-5 };
});

console.log(JSON.stringify({ status: 'passed', passed: results.length, maxIndependentPositionErrorKm: largestPositionError, tests: results }, null, 2));
