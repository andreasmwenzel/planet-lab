// All distances are km, times s, and velocities km/s. No browser dependencies.
export const MU = 398600.4418;
export const EARTH_RADIUS = 6371;
export const TAU = Math.PI * 2;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const norm = a => Math.hypot(a[0], a[1]);
const modulo = (a, b) => ((a % b) + b) % b;

export function apsidalState(perigeeAltitude, apogeeAltitude) {
  if (!Number.isFinite(perigeeAltitude) || !Number.isFinite(apogeeAltitude) || perigeeAltitude < 0 || apogeeAltitude < perigeeAltitude) {
    throw new Error('Apogee must be at least the perigee; both altitudes must be nonnegative.');
  }
  const rp = EARTH_RADIUS + perigeeAltitude;
  const a = (2 * EARTH_RADIUS + perigeeAltitude + apogeeAltitude) / 2;
  return { r: [rp, 0], v: [0, Math.sqrt(MU * (2 / rp - 1 / a))] };
}

export function elements(state) {
  const r = norm(state.r), speed = norm(state.v);
  const h = state.r[0] * state.v[1] - state.r[1] * state.v[0];
  const energy = speed * speed / 2 - MU / r;
  const rv = dot(state.r, state.v);
  const evec = state.r.map((v, i) => ((speed * speed - MU / r) * v - rv * state.v[i]) / MU);
  const e = norm(evec);
  const alpha = -2 * energy / MU;
  const a = Math.abs(alpha) > 1e-14 ? 1 / alpha : Infinity;
  const p = h * h / MU;
  const rp = p / (1 + e);
  const bound = alpha > 1e-14;
  const period = bound ? TAU * Math.sqrt(a * a * a / MU) : Infinity;
  const ra = bound ? a * (1 + e) : Infinity;
  const omega = e > 1e-10 ? Math.atan2(evec[1], evec[0]) : Math.atan2(state.r[1], state.r[0]);
  return { r, speed, h, energy, evec, e, alpha, a, p, rp, ra, bound, period, omega, radialSpeed: rv / r };
}

function stumpff(z) {
  // Series avoid cancellation near z=0, including near-parabolic states.
  if (Math.abs(z) < 1e-4) {
    let c = 0.5, s = 1 / 6, tc = c, ts = s;
    for (let k = 1; k <= 8; k++) {
      tc *= -z / ((2 * k + 1) * (2 * k + 2));
      ts *= -z / ((2 * k + 2) * (2 * k + 3));
      c += tc; s += ts;
    }
    return [c, s];
  }
  if (z > 0) {
    const q = Math.sqrt(z);
    return [(1 - Math.cos(q)) / z, (q - Math.sin(q)) / (q * q * q)];
  }
  const q = Math.sqrt(-z);
  return [(Math.cosh(q) - 1) / (-z), (Math.sinh(q) - q) / (q * q * q)];
}

export function propagate(state, seconds) {
  if (!Number.isFinite(seconds)) throw new Error('Propagation time must be finite.');
  const r0 = norm(state.r), v02 = dot(state.v, state.v), rv = dot(state.r, state.v);
  if (!(r0 > 0) || !Number.isFinite(v02)) throw new Error('Invalid state vector.');
  const alpha = 2 / r0 - v02 / MU, sqrtMu = Math.sqrt(MU);
  let dt = seconds;
  // An elliptic state repeats exactly each period. Reduce elapsed time to keep
  // universal-variable solves well-conditioned at very high time warp.
  if (alpha > 1e-14) {
    const period = TAU / Math.sqrt(MU * alpha * alpha * alpha);
    dt %= period;
    if (dt > period / 2) dt -= period;
    if (dt < -period / 2) dt += period;
  }
  if (Math.abs(dt) < 1e-12) return { r: [...state.r], v: [...state.v] };
  const A = rv / sqrtMu;
  const equation = x => {
    const z = alpha * x * x, [c, s] = stumpff(z);
    const f = A * x * x * c + (1 - alpha * r0) * x * x * x * s + r0 * x - sqrtMu * dt;
    const d = A * x * (1 - z * s) + (1 - alpha * r0) * x * x * c + r0;
    return { f, d, c, s };
  };
  // F'(chi)=radius is positive. A bracketed Newton method also works for
  // hyperbolic, retrograde, and almost-radial trajectories.
  const sign = Math.sign(dt);
  let edge = sign * Math.max(1, Math.min(sqrtMu * Math.abs(dt) / r0, 1000));
  for (let i = 0; i < 80; i++) {
    const f = equation(edge).f;
    if ((sign > 0 && f >= 0) || (sign < 0 && f <= 0)) break;
    edge *= 2;
    if (i === 79) throw new Error('Could not bracket the propagation solution.');
  }
  let lo = sign > 0 ? 0 : edge, hi = sign > 0 ? edge : 0;
  let x = (lo + hi) / 2, solved = false;
  for (let i = 0; i < 100; i++) {
    const q = equation(x);
    if (Math.abs(q.f) < 1e-8 || hi - lo < 1e-11) { solved = true; break; }
    if (q.f > 0) hi = x; else lo = x;
    const next = x - q.f / q.d;
    x = Number.isFinite(next) && next > lo && next < hi ? next : (lo + hi) / 2;
  }
  if (!solved) throw new Error('Propagation did not converge.');
  const { c, s } = equation(x);
  const f = 1 - x * x * c / r0;
  const g = dt - x * x * x * s / sqrtMu;
  const r = state.r.map((v, i) => f * v + g * state.v[i]);
  const rn = norm(r);
  const fdot = sqrtMu / (rn * r0) * (alpha * x * x * x * s - x);
  const gdot = 1 - x * x * c / rn;
  const v = state.r.map((q, i) => fdot * q + gdot * state.v[i]);
  return { r, v };
}

export function applyImpulse(state, tangentialMs, radialMs) {
  if (![tangentialMs, radialMs].every(Number.isFinite)) throw new Error('Burn values must be finite.');
  const r = norm(state.r), h = state.r[0] * state.v[1] - state.r[1] * state.v[0];
  const direction = h >= 0 ? 1 : -1;
  const radial = state.r.map(x => x / r);
  const tangent = [-radial[1] * direction, radial[0] * direction];
  return { r: [...state.r], v: state.v.map((v, i) => v + tangentialMs / 1000 * tangent[i] + radialMs / 1000 * radial[i]) };
}

function ellipticMeanAnomaly(state, el) {
  if (el.e < 1e-10) return modulo(Math.atan2(state.r[1], state.r[0]) * Math.sign(el.h), TAU);
  const cosE = Math.max(-1, Math.min(1, (1 - el.r / el.a) / el.e));
  const sinE = dot(state.r, state.v) / (el.e * Math.sqrt(MU * el.a));
  const E = modulo(Math.atan2(sinE, cosE), TAU);
  return modulo(E - el.e * Math.sin(E), TAU);
}

export function timeToApsis(state, which) {
  const el = elements(state);
  if (!el.bound || el.e < 1e-8) return which === 'periapsis' ? 0 : Infinity;
  const M = ellipticMeanAnomaly(state, el), target = which === 'apoapsis' ? Math.PI : 0;
  let delta = modulo(target - M, TAU);
  if (delta < 1e-9 || TAU - delta < 1e-9) delta = 0;
  return delta / (TAU / el.period);
}

export function timeToImpact(state, surfaceRadius = EARTH_RADIUS) {
  const el = elements(state);
  if (el.r <= surfaceRadius + 1e-8) return 0;
  if (el.rp >= surfaceRadius || el.e < 1e-12) return Infinity;
  if (el.bound) {
    const cosE = Math.max(-1, Math.min(1, (1 - surfaceRadius / el.a) / el.e));
    const E = TAU - Math.acos(cosE);
    const targetM = E - el.e * Math.sin(E);
    return modulo(targetM - ellipticMeanAnomaly(state, el), TAU) / (TAU / el.period);
  }
  if (el.alpha < -1e-14) {
    const H = Math.asinh(dot(state.r, state.v) / (el.e * Math.sqrt(MU * -el.a)));
    const currentM = el.e * Math.sinh(H) - H;
    const targetH = -Math.acosh(Math.max(1, (surfaceRadius / -el.a + 1) / el.e));
    const targetM = el.e * Math.sinh(targetH) - targetH;
    const delta = targetM - currentM;
    return delta >= 0 ? delta * Math.sqrt((-el.a) ** 3 / MU) : Infinity;
  }
  // Parabolic limit (Barker's equation), including the radial limit.
  if (el.p < 1e-8) return el.radialSpeed < 0 ? Math.SQRT2 / (3 * Math.sqrt(MU)) * (el.r ** 1.5 - surfaceRadius ** 1.5) : Infinity;
  const cosNu = Math.max(-1, Math.min(1, dot(el.evec, state.r) / (el.e * el.r)));
  const nu = Math.acos(cosNu) * Math.sign(el.radialSpeed || 1);
  const targetNu = -Math.acos(Math.max(-1, Math.min(1, (el.p / surfaceRadius - 1) / el.e)));
  const barker = angle => { const D = Math.tan(angle / 2); return D + D ** 3 / 3; };
  const dt = 0.5 * Math.sqrt(el.p ** 3 / MU) * (barker(targetNu) - barker(nu));
  return dt >= 0 ? dt : Infinity;
}

export function hohmann(fromAltitude, toAltitude) {
  if (![fromAltitude, toAltitude].every(Number.isFinite) || fromAltitude < 0 || toAltitude < 0) throw new Error('Transfer altitudes must be nonnegative.');
  const r1 = EARTH_RADIUS + fromAltitude, r2 = EARTH_RADIUS + toAltitude, a = (r1 + r2) / 2;
  const v1 = Math.sqrt(MU / r1), v2 = Math.sqrt(MU / r2);
  const transferV1 = Math.sqrt(MU * (2 / r1 - 1 / a));
  const transferV2 = Math.sqrt(MU * (2 / r2 - 1 / a));
  const dv1 = (transferV1 - v1) * 1000, dv2 = (v2 - transferV2) * 1000;
  return { r1, r2, a, dv1, dv2, totalDv: Math.abs(dv1) + Math.abs(dv2), coast: Math.PI * Math.sqrt(a ** 3 / MU) };
}

export function trajectory(state, samples = 360, maxRadius) {
  const el = elements(state), points = [];
  if (el.bound && el.p > 1e-7) {
    for (let i = 0; i <= samples; i++) {
      const E = TAU * i / samples;
      const x = el.a * (Math.cos(E) - el.e), y = el.a * Math.sqrt(Math.max(0, 1 - el.e * el.e)) * Math.sin(E);
      const c = Math.cos(el.omega), s = Math.sin(el.omega);
      points.push([x * c - y * s, x * s + y * c]);
    }
  } else if (el.p > 1e-7) {
    const limit = maxRadius || Math.max(el.r * 2, EARTH_RADIUS * 10);
    const cosLimit = Math.max(-1, Math.min(1, (el.p / limit - 1) / el.e));
    const angle = Math.acos(cosLimit);
    for (let i = 0; i <= samples; i++) {
      const nu = -angle + 2 * angle * i / samples;
      const r = el.p / (1 + el.e * Math.cos(nu));
      points.push([r * Math.cos(nu + el.omega), r * Math.sin(nu + el.omega)]);
    }
  } else {
    points.push([...state.r], state.r.map(x => x / el.r * EARTH_RADIUS));
  }
  return points;
}
