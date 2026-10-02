export const EARTH = Object.freeze({
  mu: 3.986004418e14, // m^3 s^-2, WGS-84 conventional Earth GM
  radius: 6_371_000, // m, mean spherical radius used as the impact boundary
});

const finite = (value, label) => {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
};

function validateState(state) {
  if (!state || typeof state !== "object") throw new TypeError("state is required");
  for (const key of ["x", "y", "vx", "vy"]) finite(state[key], `state.${key}`);
}

export function circularSpeed(radius, mu = EARTH.mu) {
  finite(radius, "radius");
  finite(mu, "mu");
  if (radius <= 0 || mu <= 0) throw new RangeError("radius and mu must be positive");
  return Math.sqrt(mu / radius);
}

export function escapeSpeed(radius, mu = EARTH.mu) {
  return Math.sqrt(2) * circularSpeed(radius, mu);
}

export function createCircularOrbit(altitudeKm = 420, mu = EARTH.mu) {
  finite(altitudeKm, "altitudeKm");
  if (altitudeKm <= -EARTH.radius / 1000) throw new RangeError("orbit must begin above Earth's center");
  const radius = EARTH.radius + altitudeKm * 1000;
  return { x: radius, y: 0, vx: 0, vy: circularSpeed(radius, mu), t: 0 };
}

/**
 * Apply an instantaneous in-plane impulse. The aim angle is measured from
 * prograde toward the local radial-out direction. Positive deltaV burns along
 * that aim vector; negative deltaV reverses it (retrograde at 0 degrees).
 */
export function applyImpulse(state, deltaV, aimDeg = 0) {
  validateState(state);
  finite(deltaV, "deltaV");
  finite(aimDeg, "aimDeg");
  const r = Math.hypot(state.x, state.y);
  const speed = Math.hypot(state.vx, state.vy);
  if (r === 0 || speed === 0) throw new RangeError("impulse requires nonzero position and velocity");
  const radialX = state.x / r;
  const radialY = state.y / r;
  const progradeX = -radialY;
  const progradeY = radialX;
  const angle = (aimDeg * Math.PI) / 180;
  const burnX = Math.cos(angle) * progradeX + Math.sin(angle) * radialX;
  const burnY = Math.cos(angle) * progradeY + Math.sin(angle) * radialY;
  return {
    ...state,
    vx: state.vx + deltaV * burnX,
    vy: state.vy + deltaV * burnY,
  };
}

export function acceleration(position, mu = EARTH.mu) {
  const x = finite(position.x, "position.x");
  const y = finite(position.y, "position.y");
  finite(mu, "mu");
  const r2 = x * x + y * y;
  if (r2 === 0 || mu <= 0) throw new RangeError("position and mu must be nonzero and positive");
  const scale = -mu / (r2 * Math.sqrt(r2));
  return { x: scale * x, y: scale * y };
}

/** One kick-drift-kick velocity-Verlet step for the planar two-body problem. */
export function velocityVerletStep(state, dt, mu = EARTH.mu) {
  validateState(state);
  finite(dt, "dt");
  if (dt <= 0) throw new RangeError("dt must be positive");
  const a0 = acceleration(state, mu);
  const halfVx = state.vx + 0.5 * a0.x * dt;
  const halfVy = state.vy + 0.5 * a0.y * dt;
  const x = state.x + halfVx * dt;
  const y = state.y + halfVy * dt;
  const a1 = acceleration({ x, y }, mu);
  return {
    x,
    y,
    vx: halfVx + 0.5 * a1.x * dt,
    vy: halfVy + 0.5 * a1.y * dt,
    t: (Number.isFinite(state.t) ? state.t : 0) + dt,
  };
}

/** Propagate by a positive duration using fixed steps plus one exact remainder. */
export function propagate(state, duration, dt = 5, mu = EARTH.mu) {
  validateState(state);
  finite(duration, "duration");
  finite(dt, "dt");
  if (duration < 0 || dt <= 0) throw new RangeError("duration must be nonnegative and dt positive");
  let current = { ...state };
  let remaining = duration;
  while (remaining > Math.max(1e-12, duration * 1e-14)) {
    const h = Math.min(dt, remaining);
    current = velocityVerletStep(current, h, mu);
    remaining -= h;
  }
  return current;
}

export function specificEnergy(state, mu = EARTH.mu) {
  validateState(state);
  const r = Math.hypot(state.x, state.y);
  if (r === 0) throw new RangeError("specific energy is undefined at the origin");
  return (state.vx * state.vx + state.vy * state.vy) / 2 - mu / r;
}

export function specificAngularMomentum(state) {
  validateState(state);
  return state.x * state.vy - state.y * state.vx;
}

/** Return osculating two-body elements in SI units (planar state, inertial frame). */
export function orbitalElements(state, mu = EARTH.mu) {
  validateState(state);
  finite(mu, "mu");
  const r = Math.hypot(state.x, state.y);
  if (r === 0 || mu <= 0) throw new RangeError("orbital elements require nonzero radius and positive mu");
  const v2 = state.vx * state.vx + state.vy * state.vy;
  const energy = v2 / 2 - mu / r;
  const h = specificAngularMomentum(state);
  const rv = state.x * state.vx + state.y * state.vy;
  const ex = ((v2 - mu / r) * state.x - rv * state.vx) / mu;
  const ey = ((v2 - mu / r) * state.y - rv * state.vy) / mu;
  const eccentricity = Math.hypot(ex, ey);
  const semiMajorAxis = Math.abs(energy) > 1e-12 ? -mu / (2 * energy) : null;
  const p = (h * h) / mu;
  const periapsis = p / (1 + eccentricity);
  const bound = energy < 0 && eccentricity < 1;
  const apoapsis = bound ? p / (1 - eccentricity) : null;
  const period = bound && semiMajorAxis > 0
    ? 2 * Math.PI * Math.sqrt((semiMajorAxis ** 3) / mu)
    : null;
  return {
    radius: r,
    speed: Math.sqrt(v2),
    specificEnergy: energy,
    angularMomentum: h,
    eccentricity,
    eccentricityVector: { x: ex, y: ey },
    semiMajorAxis,
    semiLatusRectum: p,
    periapsis,
    apoapsis,
    period,
    bound,
  };
}

/** Hohmann transfer impulses from one circular radius to another, in m/s. */
export function hohmannTransferDeltaV(r1, r2, mu = EARTH.mu) {
  finite(r1, "r1");
  finite(r2, "r2");
  finite(mu, "mu");
  if (r1 <= 0 || r2 <= 0 || mu <= 0) throw new RangeError("radii and mu must be positive");
  const transferA = (r1 + r2) / 2;
  const v1 = circularSpeed(r1, mu);
  const v2 = circularSpeed(r2, mu);
  const atPeriapsis = Math.sqrt(mu * (2 / r1 - 1 / transferA));
  const atApoapsis = Math.sqrt(mu * (2 / r2 - 1 / transferA));
  return { departure: atPeriapsis - v1, arrival: v2 - atApoapsis };
}

/** Retrograde impulse at the current apoapsis to place the other apsis at rp. */
export function impulseForPeriapsis(currentRadius, targetPeriapsis, mu = EARTH.mu) {
  finite(currentRadius, "currentRadius");
  finite(targetPeriapsis, "targetPeriapsis");
  finite(mu, "mu");
  if (currentRadius <= 0 || targetPeriapsis <= 0 || targetPeriapsis >= currentRadius || mu <= 0) {
    throw new RangeError("target periapsis must be positive and below the current apoapsis");
  }
  const targetSpeed = Math.sqrt((2 * mu * targetPeriapsis) / (currentRadius * (currentRadius + targetPeriapsis)));
  return targetSpeed - circularSpeed(currentRadius, mu);
}

/** Sample the exact osculating conic for drawing, clipped to maxRadius. */
export function sampleConic(state, maxRadius, count = 480, mu = EARTH.mu) {
  const el = orbitalElements(state, mu);
  finite(maxRadius, "maxRadius");
  if (maxRadius <= 0 || count < 8) throw new RangeError("maxRadius and sample count must be positive");
  const e = el.eccentricity;
  const p = el.semiLatusRectum;
  const omega = e > 1e-10 ? Math.atan2(el.eccentricityVector.y, el.eccentricityVector.x) : 0;
  let start = 0;
  let end = 2 * Math.PI;
  if (!el.bound) {
    if (e <= 1) return [];
    const cosineLimit = (p / maxRadius - 1) / e;
    const limit = Math.acos(Math.max(-1, Math.min(1, cosineLimit)));
    start = -limit;
    end = limit;
  }
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const nu = start + ((end - start) * i) / count;
    const denominator = 1 + e * Math.cos(nu);
    if (denominator <= 0) {
      points.push(null);
      continue;
    }
    const radius = p / denominator;
    if (!Number.isFinite(radius) || radius > maxRadius * 1.001) {
      points.push(null);
      continue;
    }
    const theta = omega + nu;
    points.push({ x: radius * Math.cos(theta), y: radius * Math.sin(theta) });
  }
  return points;
}
