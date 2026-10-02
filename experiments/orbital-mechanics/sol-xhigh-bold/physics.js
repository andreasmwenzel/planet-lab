// THE LAST ORBIT — planar point-mass Earth mechanics. Units: km, s, km/s.
export const MU = 398600.4418;
export const EARTH_RADIUS = 6371;
export const ENTRY_ALTITUDE = 120;
export const EARTH_ROTATION = 2 * Math.PI / 86164.0905;
export const TAU = 2 * Math.PI;
export const norm = a => Math.hypot(a[0], a[1]);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const wrapAngle = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const mod = x => ((x % TAU) + TAU) % TAU;

export function stumpff(z) {
  if (Math.abs(z) < 1e-4) {
    return {
      c: 1 / 2 - z / 24 + z * z / 720 - z ** 3 / 40320 + z ** 4 / 3628800,
      s: 1 / 6 - z / 120 + z * z / 5040 - z ** 3 / 362880 + z ** 4 / 39916800,
    };
  }
  if (z > 0) {
    const x = Math.sqrt(z);
    return { c: (1 - Math.cos(x)) / z, s: (x - Math.sin(x)) / x ** 3 };
  }
  const x = Math.sqrt(-z);
  return { c: (Math.cosh(x) - 1) / -z, s: (Math.sinh(x) - x) / x ** 3 };
}

// Universal-variable f/g propagation, with a bracketed Newton solve.
// A single function handles elliptic, parabolic and hyperbolic trajectories.
export function propagate(state, dt, mu = MU) {
  if (dt === 0) return { r: [...state.r], v: [...state.v] };
  if (!Number.isFinite(dt) || !state.r.every(Number.isFinite) || !state.v.every(Number.isFinite)) {
    throw new Error('The state and time must be finite.');
  }
  const r0 = norm(state.r);
  if (r0 <= 0) throw new Error('A zero-radius state is singular.');
  const rootMu = Math.sqrt(mu);
  const alpha = 2 / r0 - dot(state.v, state.v) / mu;
  const rv = dot(state.r, state.v) / rootMu;
  function equation(x) {
    const z = alpha * x * x;
    const { c, s } = stumpff(z);
    const f = rv * x * x * c + (1 - alpha * r0) * x ** 3 * s + r0 * x - rootMu * dt;
    const df = rv * x * (1 - z * s) + (1 - alpha * r0) * x * x * c + r0;
    return { f, df, c, s };
  }
  let lo = dt > 0 ? 0 : -Math.max(1, Math.abs(rootMu * dt / r0));
  let hi = dt > 0 ? Math.max(1, Math.abs(rootMu * dt / r0)) : 0;
  for (let i = 0; i < 64 && equation(lo).f > 0; i++) lo *= 2;
  for (let i = 0; i < 64 && equation(hi).f < 0; i++) hi *= 2;
  let x = (lo + hi) / 2;
  let converged = false;
  for (let i = 0; i < 100; i++) {
    const q = equation(x);
    if (Math.abs(q.f) <= rootMu * Math.max(1, Math.abs(dt)) * 2e-13) { converged = true; break; }
    if (q.f > 0 || !Number.isFinite(q.f) && x > 0) hi = x;
    else lo = x;
    const next = x - q.f / q.df;
    x = Number.isFinite(next) && next > lo && next < hi ? next : (lo + hi) / 2;
  }
  if (!converged) throw new Error('Kepler solve did not converge for this state.');
  const { c, s } = equation(x);
  const f = 1 - x * x * c / r0;
  const g = dt - x ** 3 * s / rootMu;
  const r = state.r.map((value, i) => f * value + g * state.v[i]);
  const radius = norm(r);
  const fdot = rootMu * (alpha * x ** 3 * s - x) / (radius * r0);
  const gdot = 1 - x * x * c / radius;
  const v = state.r.map((value, i) => fdot * value + gdot * state.v[i]);
  return { r, v };
}

export function elements(state, mu = MU) {
  const radius = norm(state.r);
  const speed2 = dot(state.v, state.v);
  const energy = speed2 / 2 - mu / radius;
  const h = cross(state.r, state.v);
  const rv = dot(state.r, state.v);
  const eVector = state.r.map((x, i) => ((speed2 - mu / radius) * x - rv * state.v[i]) / mu);
  const e = norm(eVector);
  const p = h * h / mu;
  const a = Math.abs(energy) > 1e-12 ? -mu / (2 * energy) : Infinity;
  const periapsis = p / (1 + e);
  const apoapsis = e < 1 ? p / (1 - e) : Infinity;
  const period = energy < 0 ? TAU * Math.sqrt(a ** 3 / mu) : Infinity;
  const anomaly = e > 1e-12 ? Math.atan2(Math.sign(h || 1) * cross(eVector, state.r), dot(eVector, state.r)) : 0;
  return { radius, speed: Math.sqrt(speed2), energy, h, e, eVector, p, a, periapsis, apoapsis, period, anomaly };
}

export function makeInitial(perigeeAltitude = 400, apogeeAltitude = 400, phaseDegrees = 25) {
  const rp = EARTH_RADIUS + Math.min(perigeeAltitude, apogeeAltitude);
  const ra = EARTH_RADIUS + Math.max(perigeeAltitude, apogeeAltitude);
  const a = (rp + ra) / 2;
  const theta = phaseDegrees * Math.PI / 180;
  const speed = Math.sqrt(MU * (2 / ra - 1 / a));
  // Epoch is apogee; for a circular orbit, it is simply the supplied phase.
  return { r: [ra * Math.cos(theta), ra * Math.sin(theta)], v: [-speed * Math.sin(theta), speed * Math.cos(theta)] };
}

export function applyBurn(state, transverseMS, radialMS) {
  const r = norm(state.r);
  const u = state.r.map(x => x / r);
  const sign = Math.sign(cross(state.r, state.v) || 1);
  const t = [-sign * u[1], sign * u[0]];
  return {
    r: [...state.r],
    v: state.v.map((value, i) => value + transverseMS / 1000 * t[i] + radialMS / 1000 * u[i]),
  };
}

function meanFromTrue(nu, e) {
  const E = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu), e + Math.cos(nu));
  return mod(E - e * Math.sin(E));
}

// Exact descending conic/sphere intersection. This is the 120 km handoff,
// NOT impact prediction. A radial degeneracy uses bounded numerical bracketing.
export function firstSphereCrossing(state, sphereRadius, maxTime) {
  if (norm(state.r) <= sphereRadius + 1e-8) return 0;
  if (maxTime <= 0) return null;
  const el = elements(state);
  if (Math.abs(el.h) < 1e-5) {
    let last = 0;
    for (let t = Math.min(5, maxTime); t <= maxTime; t = Math.min(t + 5, maxTime)) {
      if (norm(propagate(state, t).r) <= sphereRadius) {
        let lo = last, hi = t;
        for (let i = 0; i < 45; i++) {
          const mid = (lo + hi) / 2;
          if (norm(propagate(state, mid).r) > sphereRadius) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
      }
      if (t === maxTime) break;
      last = t;
    }
    return null;
  }
  if (el.periapsis > sphereRadius + 1e-8 || el.e < 1e-12) return null;
  const cosine = (el.p / sphereRadius - 1) / el.e;
  if (cosine < -1 - 1e-10 || cosine > 1 + 1e-10) return null;
  const target = -Math.acos(Math.max(-1, Math.min(1, cosine)));
  let time;
  if (el.e < 1 - 1e-10) {
    const n = Math.sqrt(MU / el.a ** 3);
    time = mod(meanFromTrue(target, el.e) - meanFromTrue(el.anomaly, el.e)) / n;
  } else if (el.e > 1 + 1e-10) {
    const hyperMean = nu => {
      const H = Math.asinh(Math.sin(nu) * Math.sqrt(el.e * el.e - 1) / (1 + el.e * Math.cos(nu)));
      return el.e * Math.sinh(H) - H;
    };
    time = (hyperMean(target) - hyperMean(el.anomaly)) / Math.sqrt(MU / (-el.a) ** 3);
  } else {
    const barker = nu => {
      const D = Math.tan(nu / 2);
      return 0.5 * Math.sqrt(el.p ** 3 / MU) * (D + D ** 3 / 3);
    };
    time = barker(target) - barker(el.anomaly);
  }
  return time >= -1e-7 && time <= maxTime + 1e-7 ? Math.max(0, time) : null;
}

export function longitudeAt(state, time) {
  return wrapAngle(Math.atan2(state.r[1], state.r[0]) - EARTH_ROTATION * time) * 180 / Math.PI;
}

export function inWindow(longitude, center, halfWidth) {
  return Math.abs(wrapAngle((longitude - center) * Math.PI / 180)) <= halfWidth * Math.PI / 180 + 1e-10;
}

export function buildMission(initial, burns, duration = 10800, sampleStep = 15) {
  const sorted = burns.map(b => ({ ...b })).sort((a, b) => a.time - b.time);
  const segments = [], events = [], samples = [];
  let state = initial, cursor = 0, entry = null;
  function coast(end) {
    const hit = firstSphereCrossing(state, EARTH_RADIUS + ENTRY_ALTITUDE, end - cursor);
    const finish = hit === null ? end : cursor + hit;
    const segment = { t0: cursor, t1: finish, state };
    segments.push(segment);
    const count = Math.max(1, Math.ceil((finish - cursor) / sampleStep));
    for (let i = 0; i <= count; i++) {
      const t = cursor + (finish - cursor) * i / count;
      const value = propagate(state, t - cursor);
      samples.push({ t, ...value, segment: segments.length - 1 });
    }
    state = propagate(state, finish - cursor);
    cursor = finish;
    if (hit !== null) entry = { time: finish, state, longitude: longitudeAt(state, finish) };
  }
  for (const burn of sorted) {
    if (entry || burn.time > duration) { events.push({ ...burn, skipped: true }); continue; }
    if (burn.time < cursor || burn.time < 0) throw new Error('Burn times must be nonnegative.');
    coast(burn.time);
    if (entry) { events.push({ ...burn, skipped: true }); continue; }
    const before = state;
    state = applyBurn(state, burn.transverse, burn.radial);
    events.push({ ...burn, before, after: state, skipped: false });
  }
  if (!entry) coast(duration);
  const totalDV = sorted.reduce((total, b) => total + Math.hypot(b.transverse, b.radial), 0);
  const executedDV = events.filter(b => !b.skipped).reduce((total, b) => total + Math.hypot(b.transverse, b.radial), 0);
  return { initial, segments, events, samples, entry, endTime: cursor, duration, totalDV, executedDV, final: state };
}

export function stateAt(plan, t) {
  const time = Math.min(plan.endTime, Math.max(0, t));
  const segment = [...plan.segments].reverse().find(s => time >= s.t0 - 1e-9);
  return segment ? propagate(segment.state, time - segment.t0) : plan.initial;
}

export function deorbitBurn(state, targetPerigeeAltitude = 80) {
  const radius = norm(state.r);
  const target = EARTH_RADIUS + targetPerigeeAltitude;
  if (target >= radius) throw new Error('The target perigee must be below the burn altitude.');
  const u = state.r.map(x => x / radius);
  const sign = Math.sign(cross(state.r, state.v) || 1);
  const tangent = [-sign * u[1], sign * u[0]];
  const desiredSpeed = Math.sqrt(MU * (2 / radius - 2 / (radius + target)));
  return {
    transverse: (desiredSpeed - dot(state.v, tangent)) * 1000,
    radial: -dot(state.v, u) * 1000,
  };
}

// Search the departure epoch for a one-burn 80 km perigee template.
// This is a deterministic local rehearsal, not an operational optimizer.
export function solveDeparture(initial, duration, targetLongitude, budget = Infinity) {
  const step = duration / 720;
  let best = null;
  const evaluate = time => {
    const state = propagate(initial, time);
    const burn = deorbitBurn(state);
    const after = applyBurn(state, burn.transverse, burn.radial);
    const coast = firstSphereCrossing(after, EARTH_RADIUS + ENTRY_ALTITUDE, duration - time);
    if (coast === null) return null;
    const dv = Math.hypot(burn.transverse, burn.radial);
    if (dv > budget + 1e-6) return null;
    const entryTime = time + coast;
    const longitude = longitudeAt(propagate(after, coast), entryTime);
    const error = Math.abs(wrapAngle((longitude - targetLongitude) * Math.PI / 180));
    return { time, ...burn, dv, entryTime, longitude, error };
  };
  for (let i = 0; i <= 720; i++) {
    const candidate = evaluate(i * step);
    if (candidate && (!best || candidate.error < best.error)) best = candidate;
  }
  if (!best) return null;
  let width = step;
  for (let j = 0; j < 6; j++) {
    const low = Math.max(0, best.time - width), high = Math.min(duration, best.time + width);
    for (let i = 0; i <= 20; i++) {
      const candidate = evaluate(low + (high - low) * i / 20);
      if (candidate && candidate.error < best.error) best = candidate;
    }
    width /= 10;
  }
  return best;
}
