/** Planar, impulsive, Earth-centred two-body mechanics. Units: km, km/s, s. */
export const MU = 398600.4418;
export const EARTH_RADIUS = 6371;
export const TAU = 2 * Math.PI;
export const norm = v => Math.hypot(v[0], v[1]);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const mod = (x, n) => ((x % n) + n) % n;

export function initialOrbit(periapsisAltitude, apoapsisAltitude, mu = MU) {
  if (!Number.isFinite(periapsisAltitude) || !Number.isFinite(apoapsisAltitude) ||
      periapsisAltitude < 0 || apoapsisAltitude < periapsisAltitude) {
    throw new RangeError('Apoapsis must be at least periapsis, and both must be nonnegative.');
  }
  const rp = EARTH_RADIUS + periapsisAltitude;
  const ra = EARTH_RADIUS + apoapsisAltitude;
  const a = (rp + ra) / 2;
  return { r: [rp, 0], v: [0, Math.sqrt(mu * (2 / rp - 1 / a))] };
}

/** Numerically stable Stumpff functions, including the parabolic neighbourhood. */
export function stumpff(z) {
  if (Math.abs(z) < 0.1) {
    let C = 0.5, S = 1 / 6, tc = C, ts = S;
    for (let k = 1; k < 18; k++) {
      tc *= -z / ((2 * k + 1) * (2 * k + 2));
      ts *= -z / ((2 * k + 2) * (2 * k + 3));
      C += tc; S += ts;
      if (Math.abs(tc) + Math.abs(ts) < 1e-18) break;
    }
    return { C, S };
  }
  if (z > 0) {
    const s = Math.sqrt(z);
    return { C: (1 - Math.cos(s)) / z, S: (s - Math.sin(s)) / (s ** 3) };
  }
  const s = Math.sqrt(-z);
  return { C: (Math.cosh(s) - 1) / (-z), S: (Math.sinh(s) - s) / (s ** 3) };
}

/** Universal-variable f/g propagation. A bracket protects Newton near e = 1. */
export function propagate(state, dt, mu = MU) {
  if (!Number.isFinite(dt) || ![...state.r, ...state.v].every(Number.isFinite)) {
    throw new RangeError('The state and propagation time must be finite.');
  }
  if (dt === 0) return { r: [...state.r], v: [...state.v] };
  const r0 = norm(state.r), rv = dot(state.r, state.v), sqrtMu = Math.sqrt(mu);
  if (r0 <= 0) throw new RangeError('Cannot propagate from the central singularity.');
  const alpha = 2 / r0 - dot(state.v, state.v) / mu;
  // Elliptic time reduction avoids large-angle precision loss after many revolutions.
  if (alpha > 1e-12) {
    const period = TAU / Math.sqrt(mu * alpha ** 3);
    if (Math.abs(dt) > period) dt %= period;
    if (dt === 0) return { r: [...state.r], v: [...state.v] };
  }
  const target = sqrtMu * dt;
  const evaluate = chi => {
    const z = alpha * chi * chi, { C, S } = stumpff(z);
    const F = rv / sqrtMu * chi * chi * C + (1 - alpha * r0) * chi ** 3 * S + r0 * chi - target;
    const derivative = rv / sqrtMu * chi * (1 - z * S) + (1 - alpha * r0) * chi * chi * C + r0;
    return { F, derivative, C, S };
  };
  let width = Math.max(1, Math.min(Math.abs(target) / r0, Math.abs(target * alpha) || Infinity));
  let lo = dt > 0 ? 0 : -width, hi = dt > 0 ? width : 0;
  for (let i = 0; i < 70; i++) {
    if (evaluate(lo).F <= 0 && evaluate(hi).F >= 0) break;
    width *= 2;
    lo = dt > 0 ? 0 : -width; hi = dt > 0 ? width : 0;
    if (i === 69) throw new Error('Universal anomaly could not be bracketed.');
  }
  let chi = (lo + hi) / 2;
  let converged = false;
  for (let i = 0; i < 100; i++) {
    const q = evaluate(chi);
    if (Math.abs(q.F) <= 2e-14 * Math.max(1, Math.abs(target))) { converged = true; break; }
    if (q.F > 0) hi = chi; else lo = chi;
    const next = chi - q.F / q.derivative;
    chi = Number.isFinite(next) && next > lo && next < hi ? next : (lo + hi) / 2;
  }
  if (!converged) throw new Error('Universal anomaly did not converge.');
  const { C, S } = evaluate(chi);
  const f = 1 - chi * chi * C / r0;
  const g = dt - chi ** 3 * S / sqrtMu;
  const r = state.r.map((x, i) => f * x + g * state.v[i]);
  const radius = norm(r);
  const fdot = sqrtMu / (radius * r0) * (alpha * chi ** 3 * S - chi);
  const gdot = 1 - chi * chi * C / radius;
  const v = state.v.map((x, i) => fdot * state.r[i] + gdot * x);
  if (![...r, ...v].every(Number.isFinite) || radius === 0) throw new Error('Propagation reached a singularity.');
  return { r, v };
}

export function elements(state, mu = MU) {
  const radius = norm(state.r), speed = norm(state.v), rv = dot(state.r, state.v);
  const h = state.r[0] * state.v[1] - state.r[1] * state.v[0];
  const energy = speed * speed / 2 - mu / radius;
  const ev = state.r.map((x, i) => ((speed * speed - mu / radius) * x - rv * state.v[i]) / mu);
  const e = norm(ev), p = h * h / mu;
  const alpha = -2 * energy / mu;
  const bound = energy < -1e-10;
  const parabolic = Math.abs(energy) <= 1e-10;
  const a = parabolic ? Infinity : -mu / (2 * energy);
  const periapsis = p / (1 + e);
  const apoapsis = bound ? a * (1 + e) : Infinity;
  return { radius, speed, h, energy, ev, e, p, a, alpha, bound, parabolic,
    periapsis, apoapsis, period: bound ? TAU * Math.sqrt(a ** 3 / mu) : Infinity,
    direction: h >= 0 ? 1 : -1 };
}

/** Radial outward and transverse along angular-momentum direction; supports retrograde orbits. */
export function localFrame(state) {
  const radius = norm(state.r), radial = state.r.map(x => x / radius);
  const h = state.r[0] * state.v[1] - state.r[1] * state.v[0];
  const direction = h >= 0 ? 1 : -1;
  return { radial, prograde: [-radial[1] * direction, radial[0] * direction] };
}

export function applyBurn(state, prograde, radial) {
  if (!Number.isFinite(prograde) || !Number.isFinite(radial)) throw new RangeError('Burn must be finite.');
  const frame = localFrame(state);
  return { r: [...state.r], v: state.v.map((x, i) => x + prograde * frame.prograde[i] + radial * frame.radial[i]) };
}

/** Exact future surface crossing from anomaly time; null if the future orbit misses Earth. */
export function timeToImpact(state, radius = EARTH_RADIUS, mu = MU) {
  const o = elements(state, mu);
  if (o.radius <= radius + 1e-8) return 0;
  if (o.periapsis >= radius - 1e-8 || o.e < 1e-12) return null;
  const rv = dot(state.r, state.v);
  // Refine anomaly-derived time against the same propagator used by the simulator.
  // This removes cancellation in very long, near-parabolic elliptic flight times.
  const refine = initial => {
    let t = initial;
    for (let i = 0; i < 4; i++) {
      const s = propagate(state, t, mu), distance = norm(s.r);
      const residual = distance - radius, rate = dot(s.r, s.v) / distance;
      if (Math.abs(residual) < 1e-7 || Math.abs(rate) < 1e-9) break;
      const next = t - residual / rate;
      if (!Number.isFinite(next) || next < 0) break;
      t = next;
    }
    return t;
  };
  if (o.bound) {
    const E = Math.atan2(rv / (o.e * Math.sqrt(mu * o.a)), (1 - o.radius / o.a) / o.e);
    const Et = -Math.acos(Math.max(-1, Math.min(1, (1 - radius / o.a) / o.e)));
    const currentM = E - o.e * Math.sin(E), targetM = Et - o.e * Math.sin(Et);
    return refine(mod(targetM - currentM, TAU) / Math.sqrt(mu / o.a ** 3));
  }
  if (!o.parabolic) {
    const b = -o.a;
    const H = Math.asinh(rv / (o.e * Math.sqrt(mu * b)));
    const argument = (radius / b + 1) / o.e;
    if (argument < 1 - 1e-10) return null;
    const Ht = -Math.acosh(Math.max(1, argument));
    const dt = (o.e * Math.sinh(Ht) - Ht - (o.e * Math.sinh(H) - H)) / Math.sqrt(mu / b ** 3);
    return dt >= -1e-8 ? refine(Math.max(0, dt)) : null;
  }
  if (o.p < 1e-10) {
    return rv < 0 ? refine(2 * (o.radius ** 1.5 - radius ** 1.5) / (3 * Math.sqrt(2 * mu))) : null;
  }
  const D = rv / Math.sqrt(mu * o.p);
  const Dt = -Math.sqrt(Math.max(0, 2 * radius / o.p - 1));
  const factor = 0.5 * Math.sqrt(o.p ** 3 / mu);
  const dt = factor * ((Dt + Dt ** 3 / 3) - (D + D ** 3 / 3));
  return dt >= -1e-8 ? refine(Math.max(0, dt)) : null;
}

/** Full closed ellipse, or a future arc ending at impact / the supplied coast horizon. */
export function sampleTrajectory(state, count = 320, escapeHorizon = 21600) {
  const o = elements(state), impact = timeToImpact(state);
  if (impact === 0) return { points: [[...state.r]], horizon: 0, collision: true, closed: false, elements: o };
  if (o.bound && impact === null) {
    const u = o.e > 1e-10 ? o.ev.map(x => x / o.e) : state.r.map(x => x / o.radius);
    const q = [-u[1], u[0]], b = o.a * Math.sqrt(Math.max(0, 1 - o.e * o.e));
    const points = [];
    for (let i = 0; i <= count; i++) {
      const E = TAU * i / count, x = o.a * (Math.cos(E) - o.e), y = b * Math.sin(E);
      points.push([x * u[0] + y * q[0], x * u[1] + y * q[1]]);
    }
    return { points, horizon: o.period, collision: false, closed: true, elements: o };
  }
  const horizon = Math.min(impact ?? Infinity, o.bound ? o.period : escapeHorizon);
  const points = [];
  if (o.bound && impact !== null) {
    // Uniform eccentric anomaly resolves the short periapsis passage even when
    // the ellipse's period is months long. Time sampling alone would cut corners.
    const u = o.ev.map(x => x / o.e), q = [-u[1] * o.direction, u[0] * o.direction];
    const b = o.a * Math.sqrt(Math.max(0, 1 - o.e * o.e));
    const E0 = Math.atan2(dot(state.r, state.v) / (o.e * Math.sqrt(MU * o.a)), (1 - o.radius / o.a) / o.e);
    let Et = -Math.acos(Math.max(-1, Math.min(1, (1 - EARTH_RADIUS / o.a) / o.e)));
    while (Et < E0 - 1e-10) Et += TAU;
    for (let i = 0; i <= count; i++) {
      const E = E0 + (Et - E0) * i / count, x = o.a * (Math.cos(E) - o.e), y = b * Math.sin(E);
      points.push([x * u[0] + y * q[0], x * u[1] + y * q[1]]);
    }
    points[0] = [...state.r]; points[count] = propagate(state, horizon).r;
  } else {
    for (let i = 0; i <= count; i++) points.push(propagate(state, horizon * (i / count) ** 1.4).r);
  }
  return { points, horizon, collision: impact !== null && impact <= horizon, closed: false, elements: o };
}
