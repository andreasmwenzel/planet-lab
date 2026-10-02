// Planar, two-body Kepler propagation. Units: km, seconds, km/s.
export const MU = 398600.4418;
export const EARTH = 6371;
export const AIR = 120;
const TAU = Math.PI * 2;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const norm = a => Math.hypot(...a);
const wrap = a => ((a % TAU) + TAU) % TAU;

export function fromApsides(perigee, apogee, anomaly = 90) {
  if (![perigee, apogee, anomaly].every(Number.isFinite) || perigee < 0 || apogee < perigee) throw new Error('Apogee must be at least perigee, and both must be nonnegative.');
  const rp = EARTH + perigee, ra = EARTH + apogee;
  const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
  const p = a * (1 - e * e), nu = anomaly * Math.PI / 180;
  const r = p / (1 + e * Math.cos(nu)), k = Math.sqrt(MU / p);
  return { r: [r * Math.cos(nu), r * Math.sin(nu)], v: [-k * Math.sin(nu), k * (e + Math.cos(nu))] };
}

export function elements(state) {
  const r = norm(state.r), v2 = dot(state.v, state.v), rv = dot(state.r, state.v);
  const h = cross(state.r, state.v), energy = v2 / 2 - MU / r;
  const ev = state.r.map((x, i) => ((v2 - MU / r) * x - rv * state.v[i]) / MU);
  const e = norm(ev), p = h * h / MU;
  const a = Math.abs(energy) < 1e-12 ? Infinity : -MU / (2 * energy);
  const bound = energy < -1e-10;
  return { r, speed: Math.sqrt(v2), radial: rv / r, h, energy, e, ev, p, a, bound,
    perigee: p / (1 + e) - EARTH,
    apogee: bound ? p / (1 - e) - EARTH : Infinity,
    period: bound ? TAU * Math.sqrt(a ** 3 / MU) : Infinity };
}

function stumpff(z) {
  if (Math.abs(z) < 1e-5) {
    return [0.5 - z / 24 + z * z / 720 - z ** 3 / 40320 + z ** 4 / 3628800,
      1 / 6 - z / 120 + z * z / 5040 - z ** 3 / 362880 + z ** 4 / 39916800];
  }
  if (z > 0) { const x = Math.sqrt(z); return [(1 - Math.cos(x)) / z, (x - Math.sin(x)) / (x ** 3)]; }
  const x = Math.sqrt(-z);
  return [(Math.cosh(x) - 1) / (-z), (Math.sinh(x) - x) / (x ** 3)];
}

export function propagate(state, elapsed) {
  if (!Number.isFinite(elapsed)) throw new Error('Propagation time must be finite.');
  const r0 = norm(state.r), v2 = dot(state.v, state.v), sqrtMu = Math.sqrt(MU);
  const alpha = 2 / r0 - v2 / MU;
  let dt = elapsed;
  if (alpha > 1e-12) {
    const period = TAU / Math.sqrt(MU * alpha ** 3);
    dt %= period;
  }
  if (Math.abs(dt) < 1e-12) return { r: [...state.r], v: [...state.v] };
  const A = dot(state.r, state.v) / sqrtMu, B = 1 - alpha * r0;
  const fn = chi => {
    const z = alpha * chi * chi, [C, S] = stumpff(z);
    return { value: A * chi * chi * C + B * chi ** 3 * S + r0 * chi - sqrtMu * dt,
      derivative: A * chi * (1 - z * S) + B * chi * chi * C + r0, C, S };
  };
  let lo = 0, hi = Math.max(1, sqrtMu * Math.abs(dt) / r0);
  if (dt < 0) { lo = -hi; hi = 0; }
  let count = 0;
  if (dt > 0) { while (fn(hi).value < 0 && count++ < 100) hi *= 2; }
  else { while (fn(lo).value > 0 && count++ < 100) lo *= 2; }
  let chi = (lo + hi) / 2;
  for (let i = 0; i < 100; i++) {
    const out = fn(chi);
    if (out.value > 0) hi = chi; else lo = chi;
    if (Math.abs(out.value) < 1e-9 || hi - lo < 1e-12 * Math.max(1, Math.abs(chi))) break;
    const next = chi - out.value / out.derivative;
    chi = Number.isFinite(next) && next > lo && next < hi ? next : (lo + hi) / 2;
  }
  const { C, S } = fn(chi);
  const f = 1 - chi * chi / r0 * C, g = dt - chi ** 3 / sqrtMu * S;
  const r = state.r.map((x, i) => f * x + g * state.v[i]);
  const rr = norm(r);
  const fdot = sqrtMu / (rr * r0) * (alpha * chi ** 3 * S - chi);
  const gdot = 1 - chi * chi / rr * C;
  const v = state.r.map((x, i) => fdot * x + gdot * state.v[i]);
  if (![...r, ...v].every(Number.isFinite)) throw new Error('Propagation outside numerical range.');
  return { r, v };
}

export function impulse(state, tangentialMS, radialMS) {
  const r = norm(state.r), sign = Math.sign(cross(state.r, state.v)) || 1;
  const u = state.r.map(x => x / r), tangent = [-u[1] * sign, u[0] * sign];
  return { r: [...state.r], v: state.v.map((v, i) => v + (tangentialMS * tangent[i] + radialMS * u[i]) / 1000) };
}

function anomaly(state, el) {
  if (el.e < 1e-10) return Math.atan2(state.r[1], state.r[0]);
  return Math.atan2(cross(el.ev, state.r) * Math.sign(el.h), dot(el.ev, state.r));
}
function ellipticMean(nu, e) {
  const E = Math.atan2(Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(nu), e + Math.cos(nu));
  return wrap(E - e * Math.sin(E));
}

export function timeToApoapsis(state) {
  const el = elements(state);
  if (!el.bound || el.e < 1e-9) return 0;
  return wrap(Math.PI - ellipticMean(anomaly(state, el), el.e)) / TAU * el.period;
}

// Refine conic event time against the same propagator used by the replay. This
// removes cancellation near e=1 without substituting a different trajectory.
function refineEntry(state, guess, radius) {
  let t = guess;
  for (let i = 0; i < 10; i++) {
    const el = elements(propagate(state, t)), error = el.r - radius;
    if (Math.abs(error) < 1e-9 || Math.abs(el.radial) < 1e-12) break;
    const next = t - error / el.radial;
    if (!Number.isFinite(next) || next < 0) break;
    t = next;
  }
  return t;
}

// First future INBOUND crossing. Atmosphere is a terminal boundary, not a drag model.
export function timeToEntry(state, altitude = AIR) {
  const radius = EARTH + altitude, el = elements(state);
  if (el.r < radius - 1e-7 || (el.r <= radius + 1e-7 && el.radial < 0)) return 0;
  if (el.perigee >= altitude - 1e-8 || el.e < 1e-10) return null;
  const cos = (el.p / radius - 1) / el.e;
  if (cos < -1 || cos > 1) return null;
  const targetNu = -Math.acos(Math.min(1, Math.max(-1, cos)));
  const nu = anomaly(state, el);
  if (el.bound && Math.abs(el.e - 1) > 1e-7) {
    const m0 = ellipticMean(nu, el.e), m1 = ellipticMean(targetNu, el.e);
    return refineEntry(state, wrap(m1 - m0) / TAU * el.period, radius);
  }
  const timeAt = theta => {
    if (Math.abs(el.e - 1) < 1e-7) {
      const D = Math.tan(theta / 2);
      return 0.5 * Math.sqrt(el.p ** 3 / MU) * (D + D ** 3 / 3);
    }
    const H = Math.asinh(Math.sqrt(el.e * el.e - 1) * Math.sin(theta) / (1 + el.e * Math.cos(theta)));
    return (el.e * Math.sinh(H) - H) / Math.sqrt(MU / ((-el.a) ** 3));
  };
  const dt = timeAt(targetNu) - timeAt(nu);
  return dt >= -1e-7 ? refineEntry(state, Math.max(0, dt), radius) : null;
}

export function repairAt(state, targetAltitude) {
  const el = elements(state), targetRadius = EARTH + targetAltitude;
  if (el.r < targetRadius) throw new Error('The burn point is below the target orbit. Move the burn later or lower the target.');
  const neededTangent = Math.sqrt(2 * MU * targetRadius / (el.r * (el.r + targetRadius)));
  return { tangential: (neededTangent - Math.abs(el.h) / el.r) * 1000, radial: -el.radial * 1000 };
}

export function makePlan(initial, burnTime, tangential, radial, targetAltitude = 180) {
  const original = elements(initial), deadline = timeToEntry(initial);
  const window = deadline ?? Math.min(original.period, 8 * 3600);
  const safeTime = Math.min(Math.max(0, burnTime), Math.max(0, window - 0.1));
  const atBurn = propagate(initial, safeTime), after = impulse(atBurn, tangential, radial);
  const orbit = elements(after), afterEntry = timeToEntry(after);
  const entryTime = afterEntry === null ? null : safeTime + afterEntry;
  const postSpan = orbit.bound ? Math.min(orbit.period, 8 * 3600) : 2 * 3600;
  const duration = Math.min(entryTime ?? Infinity, safeTime + postSpan);
  const endsAtEntry = entryTime !== null && entryTime <= duration + 1e-7;
  const outcome = !orbit.bound ? 'escape' : orbit.perigee >= targetAltitude - 1e-6 ? 'clear' : entryTime !== null ? 'entry' : 'low';
  return { initial, atBurn, after, orbit, original, burnTime: safeTime, window, deadline,
    entryTime, endsAtEntry, duration: Math.max(0.001, duration), outcome, cost: Math.hypot(tangential, radial),
    stateAt: time => time < safeTime ? propagate(initial, Math.max(0, time)) : propagate(after, Math.min(Math.max(time - safeTime, 0), duration - safeTime)) };
}
