/** Two-body planar Kepler motion. Units: km, km/s, seconds. No UI dependencies. */
export const MU = 398600.4418;
export const EARTH_RADIUS = 6371;
export const TAU = Math.PI * 2;
export const norm = v => Math.hypot(v[0], v[1]);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const cloneState = s => ({ r: [...s.r], v: [...s.v] });
const wrap = a => a >= 0 ? a % TAU : ((a % TAU) + TAU) % TAU;

export function elements(s) {
  const radius = norm(s.r), speed = norm(s.v), rv = dot(s.r, s.v);
  const energy = speed * speed / 2 - MU / radius;
  const h = cross(s.r, s.v);
  const evec = s.r.map((r, i) => ((speed * speed - MU / radius) * r - rv * s.v[i]) / MU);
  const e = norm(evec), p = h * h / MU;
  const a = Math.abs(energy) < 1e-10 ? Infinity : -MU / (2 * energy);
  const bound = energy < -1e-10;
  const periapsis = p / (1 + e);
  const apoapsis = bound ? a * (1 + e) : Infinity;
  return { radius, speed, energy, h, evec, e, p, a, bound, periapsis, apoapsis,
    period: bound ? TAU * Math.sqrt(a ** 3 / MU) : Infinity,
    argument: e > 1e-8 ? Math.atan2(evec[1], evec[0]) : Math.atan2(s.r[1], s.r[0]),
    radialSpeed: rv / radius,
    tangentialSpeed: h / radius };
}

export function makeOrbit(periAltitude = 400, apoAltitude = periAltitude, angle = -0.6) {
  if (![periAltitude, apoAltitude, angle].every(Number.isFinite)) throw new Error('Orbit values must be finite.');
  if (periAltitude < 120 || apoAltitude < periAltitude || apoAltitude > 100000) throw new Error('Use 120–100,000 km, with apogee at or above perigee.');
  const rp = EARTH_RADIUS + periAltitude, ra = EARTH_RADIUS + apoAltitude;
  const speed = Math.sqrt(MU * (2 / rp - 2 / (rp + ra)));
  return { r: [rp * Math.cos(angle), rp * Math.sin(angle)], v: [-speed * Math.sin(angle), speed * Math.cos(angle)] };
}

export function stumpff(z) {
  if (Math.abs(z) < 0.05) {
    let c = 0.5, s = 1 / 6, tc = c, ts = s;
    for (let k = 1; k < 15; k++) {
      tc *= -z / ((2 * k + 1) * (2 * k + 2));
      ts *= -z / ((2 * k + 2) * (2 * k + 3));
      c += tc; s += ts;
    }
    return [c, s];
  }
  if (z > 0) { const u = Math.sqrt(z); return [(1 - Math.cos(u)) / z, (u - Math.sin(u)) / (u ** 3)]; }
  const u = Math.sqrt(-z);
  return [(Math.cosh(u) - 1) / (-z), (Math.sinh(u) - u) / (u ** 3)];
}

/** Universal-variable f/g propagation with a bracketed Newton solve; supports elliptic, parabolic and hyperbolic motion. */
export function propagate(s, seconds) {
  if (!Number.isFinite(seconds)) throw new Error('Propagation time must be finite.');
  if (seconds < 0) {
    const result = propagate({ r: [...s.r], v: s.v.map(v => -v) }, -seconds);
    result.v = result.v.map(v => -v); return result;
  }
  const r0 = norm(s.r), v02 = dot(s.v, s.v), rv0 = dot(s.r, s.v), rootMu = Math.sqrt(MU);
  if (!(r0 > 0) || !Number.isFinite(v02)) throw new Error('Invalid Cartesian state.');
  const alpha = 2 / r0 - v02 / MU;
  let dt = seconds;
  if (alpha > 0) {
    const period = TAU / Math.sqrt(MU * alpha ** 3);
    dt %= period;
  }
  if (dt < 1e-10) return cloneState(s);
  const target = rootMu * dt;
  function evaluate(x) {
    const z = alpha * x * x, [c, ss] = stumpff(z);
    return { f: rv0 / rootMu * x * x * c + (1 - alpha * r0) * x ** 3 * ss + r0 * x - target,
      df: rv0 / rootMu * x * (1 - z * ss) + (1 - alpha * r0) * x * x * c + r0 };
  }
  let lo = 0, hi = Math.max(1, rootMu * dt / r0);
  for (let k = 0; k < 80 && evaluate(hi).f < 0; k++) hi *= 2;
  let x = (lo + hi) / 2, converged = false;
  for (let k = 0; k < 100; k++) {
    const ev = evaluate(x);
    if (Number.isFinite(ev.f) && Math.abs(ev.f) < 2e-11 * Math.max(target, 1)) { converged = true; break; }
    if (ev.f > 0 || !Number.isFinite(ev.f)) hi = x; else lo = x;
    const next = x - ev.f / ev.df;
    x = Number.isFinite(next) && next > lo && next < hi ? next : (lo + hi) / 2;
  }
  if (!converged) throw new Error('Kepler solver did not converge. Reduce the time step or reset the flight.');
  const [c, ss] = stumpff(alpha * x * x);
  const f = 1 - x * x / r0 * c, g = dt - x ** 3 / rootMu * ss;
  const r = s.r.map((q, i) => f * q + g * s.v[i]);
  const radius = norm(r);
  if (radius < 1e-6 || !Number.isFinite(radius)) throw new Error('Trajectory reaches the central singularity.');
  const fdot = rootMu / (radius * r0) * (alpha * x ** 3 * ss - x);
  const gdot = 1 - x * x / radius * c;
  const v = s.r.map((q, i) => fdot * q + gdot * s.v[i]);
  return { r, v };
}

/** Impulse components in a local radial / transverse frame. Positive transverse is in the current orbit's direction. */
export function burn(s, transverseMs, radialMs = 0) {
  if (![transverseMs, radialMs].every(Number.isFinite)) throw new Error('Burn components must be finite.');
  if (Math.abs(transverseMs) > 12000 || Math.abs(radialMs) > 12000) throw new Error('Each burn component must be within ±12,000 m/s.');
  const rr = norm(s.r), radial = s.r.map(v => v / rr), direction = cross(s.r, s.v) >= 0 ? 1 : -1;
  const transverse = [-radial[1] * direction, radial[0] * direction];
  const result = { r: [...s.r], v: s.v.map((v, i) => v + transverseMs / 1000 * transverse[i] + radialMs / 1000 * radial[i]) };
  if (Math.abs(cross(result.r, result.v)) < 0.001 * Math.sqrt(MU * rr)) throw new Error('This burn is almost purely radial. Keep at least 0.1% of circular transverse speed.');
  return result;
}

export function hohmann(s, targetAltitude) {
  const el = elements(s), r1 = el.radius, r2 = EARTH_RADIUS + Number(targetAltitude);
  if (!Number.isFinite(r2) || targetAltitude < 120 || targetAltitude > 100000) throw new Error('Target altitude must be between 120 and 100,000 km.');
  if (!el.bound || el.e > 1e-4) throw new Error('A Hohmann plan needs a circular starting orbit. Load a parking orbit or circularize first.');
  if (Math.abs(r2 - r1) < 1) throw new Error('Choose a target at least 1 km above or below the current orbit.');
  const a = (r1 + r2) / 2;
  const departure = (Math.sqrt(MU * (2 / r1 - 1 / a)) - Math.sqrt(MU / r1)) * 1000;
  const arrival = (Math.sqrt(MU / r2) - Math.sqrt(MU * (2 / r2 - 1 / a))) * 1000;
  return { targetAltitude: Number(targetAltitude), r1, r2, departure, arrival,
    totalDeltaV: Math.abs(departure) + Math.abs(arrival), duration: Math.PI * Math.sqrt(a ** 3 / MU), a };
}

/** Seconds to next inbound crossing of a spherical surface; Infinity if no future impact. */
export function timeToImpact(s, surface = EARTH_RADIUS) {
  const el = elements(s);
  if (el.radius <= surface + 1e-7 && el.radialSpeed <= 0) return 0;
  if (el.periapsis >= surface - 1e-8 || el.e < 1e-10) return Infinity;
  const rv = dot(s.r, s.v);
  if (el.bound) {
    const a = el.a;
    const currentE = Math.atan2(rv / Math.sqrt(MU * a), 1 - el.radius / a);
    const impactE = -Math.acos(Math.max(-1, Math.min(1, (1 - surface / a) / el.e)));
    const currentM = currentE - el.e * Math.sin(currentE), impactM = impactE - el.e * Math.sin(impactE);
    return refineImpact(s, wrap(impactM - currentM) * Math.sqrt(a ** 3 / MU), surface);
  }
  if (Math.abs(el.e - 1) < 1e-7) {
    const scale = 0.5 * Math.sqrt(el.p ** 3 / MU);
    const d0 = rv / Math.sqrt(MU * el.p);
    const dh = -Math.sqrt(Math.max(0, 2 * surface / el.p - 1));
    const dt = scale * ((dh + dh ** 3 / 3) - (d0 + d0 ** 3 / 3));
    return dt > 0 ? refineImpact(s, dt, surface) : Infinity;
  }
  const a = -el.a;
  const h0 = Math.asinh(rv / (el.e * Math.sqrt(MU * a)));
  const hh = -Math.acosh(Math.max(1, (surface / a + 1) / el.e));
  const dt = ((el.e * Math.sinh(hh) - hh) - (el.e * Math.sinh(h0) - h0)) * Math.sqrt(a ** 3 / MU);
  return dt > 0 ? refineImpact(s, dt, surface) : Infinity;
}

// Near-parabolic mean anomalies lose precision through cancellation. Refine any
// predicted crossing against the same universal-variable propagator used in flight.
function refineImpact(s, estimate, surface) {
  let time = estimate;
  for (let i = 0; i < 12; i++) {
    const point = propagate(s, time), radius = norm(point.r), error = radius - surface;
    if (Math.abs(error) <= 1e-6) return time;
    const radialSpeed = dot(point.r, point.v) / radius;
    if (radialSpeed >= -1e-10) break;
    const next = time - error / radialSpeed;
    if (!Number.isFinite(next) || next < 0) break;
    time = next;
  }
  throw new Error('Surface-crossing refinement did not converge. Reset or change the maneuver.');
}

export function advance(s, seconds) {
  if (!(seconds >= 0) || !Number.isFinite(seconds)) throw new Error('Advance needs a finite nonnegative time.');
  const impactTime = timeToImpact(s);
  const elapsed = Math.min(seconds, impactTime);
  const next = propagate(s, elapsed);
  return { state: next, elapsed, impacted: impactTime <= seconds };
}

/** Conic samples for display. These are geometric, not time-uniform positions. */
export function orbitPath(s, limit = 150000, samples = 480) {
  const el = elements(s), points = [];
  const maxAngle = el.e < 1 ? Math.PI : Math.acos(-1 / el.e) - 0.002;
  const c = Math.cos(el.argument), sn = Math.sin(el.argument);
  for (let i = 0; i <= samples; i++) {
    const nu = -maxAngle + 2 * maxAngle * i / samples;
    const radius = el.p / (1 + el.e * Math.cos(nu));
    if (radius > 0 && radius < limit && radius >= EARTH_RADIUS - 1) points.push([radius * (Math.cos(nu) * c - Math.sin(nu) * sn), radius * (Math.cos(nu) * sn + Math.sin(nu) * c)]);
    else points.push(null);
  }
  return points;
}
