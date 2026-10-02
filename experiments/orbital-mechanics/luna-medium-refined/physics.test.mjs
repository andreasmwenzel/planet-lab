import test from 'node:test';
import assert from 'node:assert/strict';
import { AU, DAY, MU_SUN, invariants, orbitalPeriod, solveKepler, stateAtTime } from './physics.js';

const close = (actual, expected, relative, message) => assert.ok(Math.abs(actual - expected) <= relative * Math.max(1, Math.abs(expected)), `${message}: ${actual} vs ${expected}`);

test('Kepler solver satisfies equation for wrapped and high-eccentricity anomalies', () => {
  for (const e of [0, .25, .85, .95, .999]) for (let i = -30; i <= 30; i++) {
    const M = i * Math.PI / 11, E = solveKepler(M, e), wrapped = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    assert.ok(Math.abs(E - e * Math.sin(E) - wrapped) < 2e-12, `residual e=${e}, M=${M}`);
  }
});

test('circular orbit has constant radius and circular speed over one period', () => {
  const a = AU, T = orbitalPeriod(a), expectedSpeed = Math.sqrt(MU_SUN / a);
  for (let i = 0; i <= 100; i++) {
    const s = stateAtTime({ a, e: 0, t: T * i / 100 });
    close(s.r, a, 2e-14, 'radius'); close(s.speed, expectedSpeed, 2e-14, 'speed');
  }
});

test('elliptic invariants remain constant and vis-viva holds throughout an orbit', () => {
  const a = 2.4 * AU, e = .72, T = orbitalPeriod(a), expectedEnergy = -MU_SUN / (2 * a), h0 = Math.sqrt(MU_SUN * a * (1 - e * e));
  for (let i = 0; i <= 400; i++) {
    const s = stateAtTime({ a, e, t: T * i / 400 }), inv = invariants(s);
    close(inv.energy, expectedEnergy, 4e-13, 'specific orbital energy');
    close(inv.angularMomentum, h0, 4e-13, 'specific angular momentum');
    close(s.speed ** 2, MU_SUN * (2 / s.r - 1 / a), 6e-13, 'vis-viva');
  }
});

test('one period returns to initial state and Kepler period follows a^(3/2)', () => {
  const a = 1.7 * AU, e = .49, T = orbitalPeriod(a), start = stateAtTime({ a, e, t: 0 }), end = stateAtTime({ a, e, t: T });
  close(end.x, start.x, 2e-13, 'periodic x'); close(end.y, start.y, 2e-13, 'periodic y');
  close(end.vx, start.vx, 2e-13, 'periodic vx'); close(end.vy, start.vy, 2e-13, 'periodic vy');
  close(orbitalPeriod(4 * a) / T, 8, 2e-15, 'Kepler third law ratio');
});

test('invalid domains fail explicitly', () => {
  assert.throws(() => solveKepler(1, 1), RangeError);
  assert.throws(() => stateAtTime({ a: 0, e: .2, t: 0 }), RangeError);
  assert.throws(() => orbitalPeriod(-1), RangeError);
});
