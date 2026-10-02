import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { MU, EARTH_RADIUS, circularState, orbitalElements, advance, impulse, hohmann, sampleOrbit, rk4Step } from './physics.mjs';
import { createFlight, depart, propagateFlight, circularize, manualBurn, targetAssessment } from './session.mjs';

const tests = [];
function check(name, work) {
  const begin = performance.now();
  try {
    const result = work() ?? {};
    tests.push({ name, passed: true, ...result, durationMs: +(performance.now() - begin).toFixed(3) });
    console.log(`PASS ${name}\n     ${JSON.stringify(result)}`);
  } catch (error) {
    tests.push({ name, passed: false, error: error.stack, durationMs: +(performance.now() - begin).toFixed(3) });
    console.error(`FAIL ${name}\n${error.stack}`);
  }
}
const rel = (a, b) => Math.abs((a - b) / b);
const positionError = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

check('Circular-state golden reference at 7,000 km radius', () => {
  const state = circularState(629, 0);
  const orbit = orbitalElements(state);
  const speedError = Math.abs(orbit.speed - 7.546053290107541);
  const periodError = Math.abs(orbit.period - 5828.516637686015);
  assert.ok(speedError < 1e-12); assert.ok(periodError < 1e-8);
  assert.ok(orbit.e < 1e-14);
  return { speedErrorKmPerS: speedError, speedToleranceKmPerS: 1e-12, periodErrorSeconds: periodError, periodToleranceSeconds: 1e-8, eccentricity: orbit.e };
});

check('Ten circular revolutions: conservation and closure', () => {
  const start = circularState(400, 0.37), initial = orbitalElements(start);
  let current = start, maxRadiusError = 0, maxEnergyError = 0, maxMomentumError = 0;
  for (let i = 0; i < 800; i++) {
    current = advance(current, initial.period * 10 / 800).state;
    const e = orbitalElements(current);
    maxRadiusError = Math.max(maxRadiusError, Math.abs(e.radius - initial.radius));
    maxEnergyError = Math.max(maxEnergyError, rel(e.energy, initial.energy));
    maxMomentumError = Math.max(maxMomentumError, rel(e.h, initial.h));
  }
  const closure = positionError(current, start);
  assert.ok(maxRadiusError < 0.005); assert.ok(maxEnergyError < 1e-7); assert.ok(maxMomentumError < 1e-7); assert.ok(closure < 0.2);
  return { revolutions: 10, maxRadiusErrorKm: maxRadiusError, radiusToleranceKm: 0.005, maxRelativeEnergyError: maxEnergyError, maxRelativeAngularMomentumError: maxMomentumError, conservationTolerance: 1e-7, closureErrorKm: closure, closureToleranceKm: 0.2 };
});

check('Eccentric orbit: apsides and one-period closure', () => {
  // Analytic reference: a=20,000 km, rp=7,000 km, ra=33,000 km.
  const initial = { x: 7000, y: 0, vx: 0, vy: 9.693080956243259, t: 0 };
  const start = orbitalElements(initial);
  const opposite = advance(initial, Math.PI * Math.sqrt(20000 ** 3 / MU)).state;
  const full = advance(initial, 2 * Math.PI * Math.sqrt(20000 ** 3 / MU)).state;
  const apoError = Math.abs(Math.hypot(opposite.x, opposite.y) - 33000);
  const closure = positionError(initial, full);
  const energyError = rel(orbitalElements(full).energy, start.energy);
  assert.ok(apoError < 0.03); assert.ok(closure < 0.1); assert.ok(energyError < 1e-7);
  return { apoapsisErrorKm: apoError, apoapsisToleranceKm: 0.03, closureErrorKm: closure, closureToleranceKm: 0.1, relativeEnergyError: energyError, conservationTolerance: 1e-7 };
});

for (const [name, start, target] of [['Ascent', 400, 2400], ['Descent', 2400, 400], ['High orbit', 400, 35786], ['Wide ascent', 150, 50000]]) {
  check(`${name}: actual guided transfer reaches the target circle`, () => {
    let flight = createFlight(start, target);
    const plan = flight.plan;
    const initial = flight.craft;
    flight = depart(flight);
    const afterBurn = orbitalElements(flight.craft);
    assert.equal(flight.phase, 'transfer');
    assert.throws(() => depart(flight), /parking orbit/);
    const expectedPeri = Math.min(plan.r1, plan.r2), expectedApo = Math.max(plan.r1, plan.r2);
    const periError = Math.abs(afterBurn.periapsis - expectedPeri);
    const apoError = Math.abs(afterBurn.apoapsis - expectedApo);
    assert.ok(periError < 1e-8); assert.ok(apoError < 1e-7);
    flight = propagateFlight(flight, plan.coastSeconds * 1.25);
    assert.equal(flight.phase, 'arrival');
    const arrivalError = Math.abs(Math.hypot(flight.craft.x, flight.craft.y) - plan.r2);
    const oppositeError = Math.hypot(flight.craft.x + initial.x / plan.r1 * plan.r2, flight.craft.y + initial.y / plan.r1 * plan.r2);
    const timeError = Math.abs(flight.craft.t - plan.coastSeconds);
    assert.ok(arrivalError < 0.01); assert.ok(oppositeError < 0.02); assert.ok(timeError < 1e-6);
    flight = circularize(flight);
    const assessment = targetAssessment(flight);
    assert.equal(flight.phase, 'achieved'); assert.ok(assessment.success);
    assert.ok(assessment.apsisError < 0.01); assert.ok(assessment.eccentricity < 2e-6);
    assert.ok(Math.abs(flight.totalDV - plan.totalDV * 1000) < 1e-9);
    assert.equal(flight.burns.length, 2); assert.throws(() => circularize(flight), /arrival point/);
    return { startAltitudeKm: start, targetAltitudeKm: target, signedDepartureDVMetresPerS: plan.departureDV * 1000, signedArrivalDVMetresPerS: plan.arrivalDV * 1000, coastSeconds: plan.coastSeconds, initialPeriapsisErrorKm: periError, initialApoapsisErrorKm: apoError, arrivalRadiusErrorKm: arrivalError, arrivalPositionErrorKm: oppositeError, arrivalPositionToleranceKm: 0.02, eventTimeErrorSeconds: timeError, eventTimeToleranceSeconds: 1e-6, finalMaximumApsisErrorKm: assessment.apsisError, finalApsisToleranceKm: 0.01, finalEccentricity: assessment.eccentricity, eccentricityTolerance: 2e-6, totalDVMetresPerS: flight.totalDV };
  });
}

check('Time-rate independence and delayed departure', () => {
  const parked = propagateFlight(createFlight(400, 2400), 173.7);
  const a = depart(parked), b = structuredClone(a);
  const jumped = propagateFlight(a, a.plan.coastSeconds);
  let watched = b;
  while (watched.phase === 'transfer') watched = propagateFlight(watched, 6.13);
  const difference = positionError(jumped.craft, watched.craft);
  assert.equal(jumped.phase, 'arrival'); assert.equal(watched.phase, 'arrival');
  assert.ok(difference < 1e-5);
  assert.ok(targetAssessment(circularize(watched)).success);
  return { preDepartureCoastSeconds: 173.7, watchedChunkSeconds: 6.13, finalPositionDifferenceKm: difference, toleranceKm: 1e-5, eventTime: watched.craft.t };
});

check('Impulse changes velocity only; radial impulse preserves angular momentum', () => {
  const state = circularState(500, 0.43), old = orbitalElements(state);
  const along = impulse(state, 350, 'prograde');
  const radial = impulse(state, 350, 'outward');
  const hError = Math.abs(orbitalElements(radial).h - old.h);
  assert.deepEqual([along.x, along.y, along.t], [state.x, state.y, state.t]);
  assert.ok(Math.abs(orbitalElements(along).speed - old.speed - 0.35) < 1e-12);
  assert.ok(hError < 1e-9);
  const expectedEnergyIncrease = 0.35 ** 2 / 2;
  const energyError = Math.abs(orbitalElements(radial).energy - old.energy - expectedEnergyIncrease);
  assert.ok(energyError < 1e-12);
  assert.throws(() => impulse(state, -1), RangeError); assert.throws(() => impulse(state, 2, 'unknown'), RangeError);
  return { radialAngularMomentumErrorKmSquaredPerS: hError, angularMomentumTolerance: 1e-9, radialEnergyChangeErrorKmSquaredPerSSquared: energyError, energyTolerance: 1e-12 };
});

check('Hyperbolic escape: positive energy conserved and conic samples finite', () => {
  const r = 7000;
  const initial = { x: r, y: 0, vx: 0, vy: Math.sqrt(2 * MU / r) * 1.1, t: 0 };
  const before = orbitalElements(initial), afterState = advance(initial, 20000).state, after = orbitalElements(afterState);
  const energyError = rel(after.energy, before.energy), hError = rel(after.h, before.h);
  assert.ok(!after.bound && after.e > 1 && after.energy > 0);
  assert.equal(after.apoapsis, Infinity); assert.equal(after.period, Infinity);
  assert.ok(after.radius > before.radius); assert.ok(energyError < 1e-7); assert.ok(hError < 1e-7);
  const points = sampleOrbit(afterState, 420, 400000);
  assert.ok(points.length > 400); assert.ok(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  return { elapsedSeconds: 20000, finalRadiusKm: after.radius, eccentricity: after.e, relativeEnergyError: energyError, relativeAngularMomentumError: hError, conservationTolerance: 1e-7, finiteSampleCount: points.length };
});

check('Radial free fall: analytic contact time and exact surface stop', () => {
  const r0 = EARTH_RADIUS + 300;
  const initial = { x: r0, y: 0, vx: 0, vy: 0, t: 0 };
  const ratio = EARTH_RADIUS / r0;
  const referenceTime = Math.sqrt(r0 ** 3 / (2 * MU)) * (Math.acos(Math.sqrt(ratio)) + Math.sqrt(ratio * (1 - ratio)));
  const result = advance(initial, 1000);
  const radiusError = Math.abs(Math.hypot(result.state.x, result.state.y) - EARTH_RADIUS);
  const timeError = Math.abs(result.state.t - referenceTime);
  assert.ok(result.impacted); assert.ok(radiusError < 1e-8); assert.ok(timeError < 1e-5);
  assert.ok(result.state.t < 1000);
  return { referenceImpactSeconds: referenceTime, simulatedImpactSeconds: result.state.t, timeErrorSeconds: timeError, timeToleranceSeconds: 1e-5, surfaceRadiusErrorKm: radiusError, surfaceToleranceKm: 1e-8 };
});

check('Shallow grazing contact is found between above-surface step endpoints', () => {
  const rp = EARTH_RADIUS - 0.0001, ra = 8000, a = (rp + ra) / 2;
  const initial = { x: ra, y: 0, vx: 0, vy: Math.sqrt(MU * (2 / ra - 1 / a)), t: 0 };
  const result = advance(initial, 2 * Math.PI * Math.sqrt(a ** 3 / MU));
  const radiusError = Math.abs(Math.hypot(result.state.x, result.state.y) - EARTH_RADIUS);
  assert.ok(result.impacted); assert.ok(radiusError < 1e-8);
  return { penetrationDepthKm: 0.0001, impactDetected: true, surfaceRadiusErrorKm: radiusError, surfaceToleranceKm: 1e-8 };
});

check('Session recovery primitives, manual cancellation, and invalid mission protection', () => {
  let flight = depart(createFlight());
  const snapshot = structuredClone(flight);
  flight = manualBurn(flight, 100, 'retrograde');
  assert.equal(flight.phase, 'free'); assert.equal(flight.arrivalAt, null);
  assert.equal(snapshot.phase, 'transfer'); assert.equal(snapshot.burns.length, 1);
  assert.equal(flight.burns.length, 2);
  assert.throws(() => circularize(flight)); assert.throws(() => manualBurn(flight, 0, 'prograde'));
  let collision = manualBurn(createFlight(150, 1200), 2500, 'retrograde');
  collision = propagateFlight(collision, 10000);
  assert.equal(collision.phase, 'impact'); assert.equal(propagateFlight(collision, 100), collision);
  assert.throws(() => manualBurn(collision, 200, 'prograde'), /recover/);
  for (const args of [[100, 2400], [400, 50001], [400, 401], [NaN, 2400], [400, Infinity]]) assert.throws(() => hohmann(...args), RangeError);
  assert.throws(() => advance(circularState(400), -5), RangeError);
  assert.throws(() => advance(circularState(400), Infinity), RangeError);
  const parabolic = { x: 7000, y: 0, vx: 0, vy: Math.sqrt(2 * MU / 7000), t: 0 };
  assert.ok(sampleOrbit(parabolic).every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  return { manualGuidanceCanceled: true, snapshotsIndependent: true, repeatedBurnsProtected: true, impactTerminal: true, invalidInputsRejected: true, parabolicSamplesFinite: true };
});

check('RK4 local time reversal', () => {
  const s = circularState(400, 0.9);
  const restored = rk4Step(rk4Step(s, 1), -1);
  const error = positionError(s, restored);
  assert.ok(error < 1e-9);
  return { positionErrorKm: error, toleranceKm: 1e-9 };
});

const report = { testedAtUTC: new Date().toISOString(), command: 'node test-physics.mjs', total: tests.length, passed: tests.filter(t => t.passed).length, failed: tests.filter(t => !t.passed).length, tests };
writeFileSync(new URL('./test-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`\n${report.passed}/${report.total} passed.`);
process.exitCode = report.failed ? 1 : 0;
