// Two-body, planar orbit utilities. Distances in km, time in s, velocity km/s.
export const EARTH_MU = 398600.4418;
const TAU = 2 * Math.PI;

export function solveKepler(meanAnomaly, eccentricity, tolerance = 1e-12) {
  if (!(eccentricity >= 0 && eccentricity < 1)) throw new RangeError('Elliptic eccentricity must be in [0, 1).');
  const M = ((meanAnomaly % TAU) + TAU) % TAU;
  let E = eccentricity < 0.8 ? M : Math.PI;
  for (let i = 0; i < 80; i++) {
    const f = E - eccentricity * Math.sin(E) - M;
    const step = f / (1 - eccentricity * Math.cos(E));
    E -= step;
    if (Math.abs(step) < tolerance) return E;
  }
  throw new Error('Kepler solver did not converge.');
}

export function stateAtTime({ mu = EARTH_MU, a, e, periapsisAngle = 0, meanAnomalyAtEpoch = 0 }, time) {
  if (!(mu > 0 && a > 0 && e >= 0 && e < 1)) throw new RangeError('Expected a bound elliptic orbit and positive mu/a.');
  const n = Math.sqrt(mu / (a ** 3));
  const E = solveKepler(meanAnomalyAtEpoch + n * time, e);
  const p = a * (1 - e * e);
  const c = Math.cos(E), s = Math.sin(E), q = Math.sqrt(1 - e * e);
  const x = a * (c - e), y = a * q * s;
  const rate = n / (1 - e * c);
  const vx = -a * s * rate, vy = a * q * c * rate;
  const w = periapsisAngle, cw = Math.cos(w), sw = Math.sin(w);
  return { x: x * cw - y * sw, y: x * sw + y * cw, vx: vx * cw - vy * sw, vy: vx * sw + vy * cw, r: Math.hypot(x, y), trueAnomaly: Math.atan2(q * s, c - e), p };
}

export function stateAtTrueAnomaly(orbit, trueAnomaly) {
  const { e, mu = EARTH_MU } = orbit;
  if (!(e >= 0 && e < 1)) throw new RangeError('Elliptic eccentricity must be in [0, 1).');
  const E = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(trueAnomaly), e + Math.cos(trueAnomaly));
  const M = E - e * Math.sin(E);
  return stateAtTime({ ...orbit, meanAnomalyAtEpoch: M, mu }, 0);
}

export function elementsFromState({ x, y, vx, vy }, mu = EARTH_MU) {
  const r = Math.hypot(x, y), v2 = vx * vx + vy * vy;
  if (!(r > 0 && mu > 0)) throw new RangeError('Position and mu must be positive.');
  const energy = v2 / 2 - mu / r;
  const hx = x * vy - y * vx;
  const a = Math.abs(energy) < 1e-14 ? Infinity : -mu / (2 * energy);
  const ex = vy * hx / mu - x / r;
  const ey = -vx * hx / mu - y / r;
  const e = Math.hypot(ex, ey);
  const p = hx * hx / mu;
  const bound = energy < 0 && e < 1;
  return { a, e, p, energy, angularMomentum: hx, periapsis: p / (1 + e), apoapsis: bound ? p / (1 - e) : Infinity, periapsisAngle: Math.atan2(ey, ex), bound };
}

export function applyBurn(state, radialDeltaV, tangentialDeltaV, mu = EARTH_MU) {
  const r = Math.hypot(state.x, state.y);
  const vr = (state.x * state.vx + state.y * state.vy) / r;
  const vt = (state.x * state.vy - state.y * state.vx) / r;
  const angle = Math.atan2(state.y, state.x), ca = Math.cos(angle), sa = Math.sin(angle);
  const newVr = vr + radialDeltaV, newVt = vt + tangentialDeltaV;
  const post = { x: state.x, y: state.y, vx: newVr * ca - newVt * sa, vy: newVr * sa + newVt * ca };
  return { state: post, elements: elementsFromState(post, mu), deltaV: Math.hypot(radialDeltaV, tangentialDeltaV) };
}

export function circularSpeed(radius, mu = EARTH_MU) { return Math.sqrt(mu / radius); }
export function orbitalPeriod(a, mu = EARTH_MU) { return TAU * Math.sqrt(a ** 3 / mu); }
