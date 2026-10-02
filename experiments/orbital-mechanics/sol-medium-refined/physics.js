// Units: km, seconds, km/s. Earth-centered, two-body point-mass dynamics.
export const MU = 398600.4418;
export const EARTH_RADIUS = 6378.137;
export const TAU = 2 * Math.PI;
export const circularSpeed = r => Math.sqrt(MU / r);
export const period = a => TAU * Math.sqrt(a ** 3 / MU);
export function solveKepler(M, e) {
  if (!(e >= 0 && e < 1) || !Number.isFinite(M)) throw new RangeError('Elliptic orbit required');
  const m = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI;
  let E = e < 0.8 ? m : (m >= 0 ? Math.PI : -Math.PI);
  for (let i = 0; i < 40; i++) {
    const step = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-13) return E;
  }
  throw new Error('Kepler solver did not converge');
}
export function ellipseState(a, e, M, rotation = 0) {
  const E = solveKepler(M, e), c = Math.cos(E), s = Math.sin(E);
  const k = Math.sqrt(1 - e * e), n = Math.sqrt(MU / a ** 3);
  const rate = n / (1 - e * c);
  const x = a * (c - e), y = a * k * s;
  const vx = -a * s * rate, vy = a * k * c * rate;
  const cr = Math.cos(rotation), sr = Math.sin(rotation);
  return {x: x * cr - y * sr, y: x * sr + y * cr,
    vx: vx * cr - vy * sr, vy: vx * sr + vy * cr};
}
export function makeMission(initialAltitude, targetAltitude) {
  if (![initialAltitude, targetAltitude].every(v => Number.isFinite(v) && v >= 160 && v <= 50000)) {
    throw new RangeError('Altitude must be between 160 and 50,000 km');
  }
  const r1 = EARTH_RADIUS + initialAltitude, r2 = EARTH_RADIUS + targetAltitude;
  const a = (r1 + r2) / 2, e = Math.abs(r2 - r1) / (r1 + r2);
  const raising = r2 >= r1;
  const v1 = circularSpeed(r1), v2 = circularSpeed(r2);
  const vt1 = Math.sqrt(MU * (2 / r1 - 1 / a));
  const vt2 = Math.sqrt(MU * (2 / r2 - 1 / a));
  const dv1 = vt1 - v1, dv2 = v2 - vt2;
  return {initialAltitude, targetAltitude, r1, r2, a, e, raising, v1, v2, vt1, vt2,
    dv1, dv2, deltaV: Math.abs(dv1) + Math.abs(dv2),
    transferTime: period(a) / 2, finalPeriod: period(r2), rotation: raising ? 0 : Math.PI,
    initialM: raising ? 0 : Math.PI};
}
export function missionState(mission, t) {
  if (!Number.isFinite(t)) throw new RangeError('Finite mission time required');
  if (t < 0) return {...ellipseState(mission.r1, 0, Math.sqrt(MU / mission.r1 ** 3) * t), phase: 'parking'};
  if (t < mission.transferTime) {
    return {...ellipseState(mission.a, mission.e, mission.initialM + Math.sqrt(MU / mission.a ** 3) * t, mission.rotation), phase: 'transfer'};
  }
  return {...ellipseState(mission.r2, 0, Math.PI + Math.sqrt(MU / mission.r2 ** 3) * (t - mission.transferTime)), phase: 'complete'};
}
export function invariants(state) {
  const r = Math.hypot(state.x, state.y), speed = Math.hypot(state.vx, state.vy);
  return {r, speed, energy: speed ** 2 / 2 - MU / r, h: state.x * state.vy - state.y * state.vx};
}
