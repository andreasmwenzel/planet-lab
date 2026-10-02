// Two-body Keplerian propagation for a bound, planar orbit.
export const MU_SUN = 1.32712440018e20; // m^3 s^-2
export const AU = 149_597_870_700; // m
export const DAY = 86_400;

export function solveKepler(meanAnomaly, eccentricity, tolerance = 1e-13) {
  if (!(eccentricity >= 0 && eccentricity < 1)) throw new RangeError('Eccentricity must be in [0, 1)');
  const M = ((meanAnomaly % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let E = eccentricity < 0.8 ? M : Math.PI;
  for (let i = 0; i < 64; i++) {
    const f = E - eccentricity * Math.sin(E) - M;
    const step = f / (1 - eccentricity * Math.cos(E));
    E -= step;
    if (Math.abs(step) < tolerance) return E;
  }
  throw new Error('Kepler equation did not converge');
}

export function orbitalPeriod(a, mu = MU_SUN) {
  if (!(a > 0 && mu > 0)) throw new RangeError('Semimajor axis and gravitational parameter must be positive');
  return 2 * Math.PI * Math.sqrt(a ** 3 / mu);
}

export function stateAtTime({ a, e, mu = MU_SUN, t, meanAnomalyAtEpoch = 0 }) {
  if (!(a > 0 && mu > 0 && e >= 0 && e < 1 && Number.isFinite(t))) throw new RangeError('Expected a>0, mu>0, 0≤e<1 and finite t');
  const n = Math.sqrt(mu / a ** 3);
  const E = solveKepler(meanAnomalyAtEpoch + n * t, e);
  const c = Math.cos(E), s = Math.sin(E), q = Math.sqrt(1 - e * e);
  const x = a * (c - e), y = a * q * s;
  const d = 1 - e * c;
  const vx = -a * n * s / d, vy = a * n * q * c / d;
  return { x, y, vx, vy, E, r: a * d, speed: Math.hypot(vx, vy), meanAnomaly: E - e * s };
}

export function invariants(state, mu = MU_SUN) {
  const { x, y, vx, vy } = state;
  const r = Math.hypot(x, y);
  return { energy: (vx * vx + vy * vy) / 2 - mu / r, angularMomentum: x * vy - y * vx };
}
