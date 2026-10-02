/** Two-body, planar Earth orbits. Distances km, time s, velocities km/s. */
export const MU = 398600.4418;
export const EARTH_RADIUS = 6378.137;
export const TAU = 2 * Math.PI;
export const MIN_ALTITUDE = 160;
export const MAX_ALTITUDE = 50000;

export function circularSpeed(radius) {
  if (!(radius > 0) || !Number.isFinite(radius)) throw new RangeError('Radius must be finite and positive.');
  return Math.sqrt(MU / radius);
}
export function period(radius) { return TAU * Math.sqrt(radius ** 3 / MU); }

export function planTransfer(departureAltitude, arrivalAltitude) {
  for (const value of [departureAltitude, arrivalAltitude]) {
    if (!Number.isFinite(value) || value < MIN_ALTITUDE || value > MAX_ALTITUDE) {
      throw new RangeError(`Altitude must be between ${MIN_ALTITUDE} and ${MAX_ALTITUDE} km.`);
    }
  }
  const r1 = EARTH_RADIUS + departureAltitude;
  const r2 = EARTH_RADIUS + arrivalAltitude;
  const a = (r1 + r2) / 2;
  const e = Math.abs(r2 - r1) / (r1 + r2);
  const outward = r2 >= r1;
  const n = Math.sqrt(MU / a ** 3);
  const v1 = circularSpeed(r1), v2 = circularSpeed(r2);
  const vt1 = Math.sqrt(MU * (2 / r1 - 1 / a));
  const vt2 = Math.sqrt(MU * (2 / r2 - 1 / a));
  const dv1 = vt1 - v1, dv2 = v2 - vt2;
  return { departureAltitude, arrivalAltitude, r1, r2, a, e, n, outward,
    v1, v2, vt1, vt2, dv1, dv2, totalDv: Math.abs(dv1) + Math.abs(dv2),
    transferTime: Math.PI / n, departurePeriod: period(r1), arrivalPeriod: period(r2),
    initialMeanAnomaly: outward ? 0 : Math.PI, rotation: outward ? 0 : Math.PI };
}

/** Solve elliptic Kepler's equation with Newton iteration and bracket fallback. */
export function solveKepler(meanAnomaly, e) {
  if (!Number.isFinite(meanAnomaly) || !Number.isFinite(e) || e < 0 || e >= 1) {
    throw new RangeError('Finite mean anomaly and 0 ≤ eccentricity < 1 required.');
  }
  const M = ((meanAnomaly + Math.PI) % TAU + TAU) % TAU - Math.PI;
  let E = e < 0.8 ? M : (M < 0 ? -Math.PI : Math.PI);
  for (let i = 0; i < 24; i++) {
    const residual = E - e * Math.sin(E) - M;
    if (Math.abs(residual) < 2e-14) return E;
    E -= residual / (1 - e * Math.cos(E));
  }
  let lo = -Math.PI, hi = Math.PI;
  for (let i = 0; i < 64; i++) {
    E = (lo + hi) / 2;
    if (E - e * Math.sin(E) > M) hi = E; else lo = E;
  }
  return (lo + hi) / 2;
}

export function transferState(plan, time) {
  if (!Number.isFinite(time)) throw new RangeError('Time must be finite.');
  const E = solveKepler(plan.initialMeanAnomaly + plan.n * time, plan.e);
  const c = Math.cos(E), s = Math.sin(E);
  const beta = Math.sqrt(1 - plan.e ** 2);
  const divisor = 1 - plan.e * c;
  const flip = plan.outward ? 1 : -1;
  return {
    x: flip * plan.a * (c - plan.e), y: flip * plan.a * beta * s,
    vx: flip * (-plan.a * plan.n * s / divisor),
    vy: flip * (plan.a * plan.n * beta * c / divisor),
    phase: 'transfer'
  };
}

export function circularState(radius, angle, phase = 'circular') {
  const v = circularSpeed(radius), c = Math.cos(angle), s = Math.sin(angle);
  return { x: radius * c, y: radius * s, vx: -v * s, vy: v * c, phase };
}
export function missionState(plan, time, circularize = true) {
  if (!Number.isFinite(time)) throw new RangeError('Time must be finite.');
  if (time < 0) return circularState(plan.r1, time * TAU / plan.departurePeriod, 'parking');
  if (time < plan.transferTime || !circularize) return transferState(plan, time);
  return circularState(plan.r2, Math.PI + (time - plan.transferTime) * TAU / plan.arrivalPeriod, 'arrival');
}
export function diagnostics(state) {
  const radius = Math.hypot(state.x, state.y);
  const speed = Math.hypot(state.vx, state.vy);
  return { radius, altitude: radius - EARTH_RADIUS, speed,
    energy: speed ** 2 / 2 - MU / radius,
    angularMomentum: state.x * state.vy - state.y * state.vx,
    radialSpeed: (state.x * state.vx + state.y * state.vy) / radius };
}
export function missionDuration(plan, circularize = true) {
  return circularize ? plan.transferTime + plan.arrivalPeriod / 4 : 2 * plan.transferTime;
}
