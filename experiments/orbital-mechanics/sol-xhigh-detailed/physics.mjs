/** Planar Newtonian Earth-centered mechanics. Distances km; times s; speeds km/s. */
export const MU = 398600.4418;
export const EARTH_RADIUS = 6371;
export const TWO_PI = Math.PI * 2;
export const magnitude = (x, y) => Math.hypot(x, y);

function assertState(s) {
  if (![s.x, s.y, s.vx, s.vy, s.t].every(Number.isFinite) || Math.hypot(s.x, s.y) === 0) {
    throw new RangeError('The state must contain finite position, velocity, and time outside the center.');
  }
}

export function circularState(altitude, angle = 0) {
  if (!Number.isFinite(altitude) || altitude <= 0) throw new RangeError('Altitude must be positive.');
  const r = EARTH_RADIUS + altitude;
  const v = Math.sqrt(MU / r);
  return { x: r * Math.cos(angle), y: r * Math.sin(angle), vx: -v * Math.sin(angle), vy: v * Math.cos(angle), t: 0 };
}

function derivative(s) {
  const r = Math.hypot(s.x, s.y);
  const k = -MU / (r * r * r);
  return { x: s.vx, y: s.vy, vx: k * s.x, vy: k * s.y };
}

/** Fourth-order Runge–Kutta. Exposed for reproducible numerical verification. */
export function rk4Step(s, dt) {
  const a = derivative(s);
  const at = (d, f) => ({ x: s.x + d.x * f, y: s.y + d.y * f, vx: s.vx + d.vx * f, vy: s.vy + d.vy * f });
  const b = derivative(at(a, dt / 2));
  const c = derivative(at(b, dt / 2));
  const d = derivative(at(c, dt));
  return {
    x: s.x + dt * (a.x + 2 * b.x + 2 * c.x + d.x) / 6,
    y: s.y + dt * (a.y + 2 * b.y + 2 * c.y + d.y) / 6,
    vx: s.vx + dt * (a.vx + 2 * b.vx + 2 * c.vx + d.vx) / 6,
    vy: s.vy + dt * (a.vy + 2 * b.vy + 2 * c.vy + d.vy) / 6,
    t: s.t + dt,
  };
}

/** Forward propagation with bounded integration steps and an Earth-surface stop. */
export function advance(s, seconds) {
  assertState(s);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 1e7) throw new RangeError('Propagation duration must be 0–10,000,000 seconds.');
  if (Math.hypot(s.x, s.y) <= EARTH_RADIUS) return { state: { ...s }, impacted: true, steps: 0 };
  let current = { ...s };
  const end = s.t + seconds;
  let steps = 0;
  while (current.t < end - 1e-9) {
    const r = Math.hypot(current.x, current.y);
    // At most 0.0015 local dynamical times or 8 seconds; rate changes never change physics accuracy.
    const speed = Math.hypot(current.vx, current.vy);
    const dt = Math.min(end - current.t, 8, 0.0015 * Math.sqrt(r ** 3 / MU), speed > 0 ? 0.0015 * r / speed : Infinity);
    const next = rk4Step(current, dt);
    steps++;
    let contactBracket = Math.hypot(next.x, next.y) <= EARTH_RADIUS ? dt : null;
    // Resolve a shallow contact even when both step endpoints are above the surface.
    if (contactBracket === null && current.x * current.vx + current.y * current.vy < 0 && next.x * next.vx + next.y * next.vy >= 0) {
      let minimumLo = 0, minimumHi = dt;
      for (let i = 0; i < 36; i++) {
        const mid = (minimumLo + minimumHi) / 2;
        const probe = rk4Step(current, mid);
        if (probe.x * probe.vx + probe.y * probe.vy < 0) minimumLo = mid;
        else minimumHi = mid;
      }
      const minimum = rk4Step(current, minimumHi);
      if (Math.hypot(minimum.x, minimum.y) <= EARTH_RADIUS) contactBracket = minimumHi;
    }
    if (contactBracket !== null) {
      let lo = 0, hi = contactBracket;
      for (let i = 0; i < 42; i++) {
        const mid = (lo + hi) / 2;
        const probe = rk4Step(current, mid);
        if (Math.hypot(probe.x, probe.y) > EARTH_RADIUS) lo = mid;
        else hi = mid;
      }
      return { state: rk4Step(current, hi), impacted: true, steps };
    }
    current = next;
  }
  return { state: current, impacted: false, steps };
}

export function orbitalElements(s) {
  assertState(s);
  const r = Math.hypot(s.x, s.y);
  const speed = Math.hypot(s.vx, s.vy);
  const h = s.x * s.vy - s.y * s.vx;
  const energy = speed * speed / 2 - MU / r;
  const dot = s.x * s.vx + s.y * s.vy;
  const ex = ((speed * speed - MU / r) * s.x - dot * s.vx) / MU;
  const ey = ((speed * speed - MU / r) * s.y - dot * s.vy) / MU;
  const e = Math.hypot(ex, ey);
  const p = h * h / MU;
  const bound = energy < -1e-10;
  const a = Math.abs(energy) < 1e-10 ? Infinity : -MU / (2 * energy);
  return {
    radius: r, altitude: r - EARTH_RADIUS, speed, h, energy, ex, ey, e, a, p, bound,
    periapsis: p / (1 + e),
    apoapsis: bound ? p / Math.max(1e-15, 1 - e) : Infinity,
    period: bound ? TWO_PI * Math.sqrt(a ** 3 / MU) : Infinity,
    radialSpeed: dot / r,
    orientation: e > 1e-8 ? Math.atan2(ey, ex) : Math.atan2(s.y, s.x),
  };
}

export function impulse(s, metersPerSecond, direction = 'prograde') {
  assertState(s);
  if (!Number.isFinite(metersPerSecond) || metersPerSecond < 0 || metersPerSecond > 10000) throw new RangeError('Impulse must be between 0 and 10,000 m/s.');
  const r = Math.hypot(s.x, s.y);
  const speed = Math.hypot(s.vx, s.vy);
  let ux, uy;
  if (direction === 'prograde' || direction === 'retrograde') {
    if (speed === 0) throw new RangeError('Velocity direction is undefined at zero speed.');
    const sign = direction === 'prograde' ? 1 : -1;
    ux = sign * s.vx / speed; uy = sign * s.vy / speed;
  } else if (direction === 'outward' || direction === 'inward') {
    const sign = direction === 'outward' ? 1 : -1;
    ux = sign * s.x / r; uy = sign * s.y / r;
  } else throw new RangeError('Unknown impulse direction.');
  const dv = metersPerSecond / 1000;
  return { ...s, vx: s.vx + ux * dv, vy: s.vy + uy * dv };
}

/** An ideal coplanar circular-to-circular Hohmann transfer, signed tangential Δv. */
export function hohmann(startAltitude, targetAltitude) {
  if (![startAltitude, targetAltitude].every(a => Number.isFinite(a) && a >= 150 && a <= 50000)) throw new RangeError('Use altitudes from 150 to 50,000 km.');
  if (Math.abs(startAltitude - targetAltitude) < 50) throw new RangeError('Separate the orbits by at least 50 km.');
  const r1 = EARTH_RADIUS + startAltitude, r2 = EARTH_RADIUS + targetAltitude;
  const a = (r1 + r2) / 2;
  const departureDV = Math.sqrt(MU * (2 / r1 - 1 / a)) - Math.sqrt(MU / r1);
  const arrivalDV = Math.sqrt(MU / r2) - Math.sqrt(MU * (2 / r2 - 1 / a));
  return {
    r1, r2, a, departureDV, arrivalDV,
    coastSeconds: Math.PI * Math.sqrt(a ** 3 / MU),
    totalDV: Math.abs(departureDV) + Math.abs(arrivalDV),
    eccentricity: Math.abs(r2 - r1) / (r2 + r1),
  };
}

/** Finite osculating conic samples, suitable for rendering bound and escape paths. */
export function sampleOrbit(s, count = 360, radiusLimit = 150000) {
  const el = orbitalElements(s);
  if (Math.abs(el.h) < 1e-8) return [];
  const open = !el.bound;
  const edge = open ? Math.acos(Math.max(-1, Math.min(1, (el.p / radiusLimit - 1) / Math.max(el.e, 1e-15)))) : Math.PI;
  const cos = Math.cos(el.orientation), sin = Math.sin(el.orientation);
  const pts = [];
  for (let i = 0; i <= count; i++) {
    const theta = open ? -edge + 2 * edge * i / count : TWO_PI * i / count;
    const den = 1 + el.e * Math.cos(theta);
    if (den <= 0) continue;
    const r = el.p / den;
    const x = r * Math.cos(theta), y = r * Math.sin(theta);
    pts.push({ x: x * cos - y * sin, y: x * sin + y * cos });
  }
  return pts;
}
