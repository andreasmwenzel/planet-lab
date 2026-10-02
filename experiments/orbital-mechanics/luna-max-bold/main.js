export const EARTH_MU_KM3_S2 = 398600.4418;
export const EARTH_RADIUS_KM = 6371;
export const SAFE_MISS_KM = 5;
export const CRITICAL_MISS_KM = 1;
export const DEFAULT_STEP_SECONDS = 20;
const TAU = 2 * Math.PI;

const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const vSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const vScale = (a, k) => [a[0] * k, a[1] * k];
const vDot = (a, b) => a[0] * b[0] + a[1] * b[1];
const vMag = (a) => Math.hypot(a[0], a[1]);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const cloneState = (s) => ({ positionKm: [...s.positionKm], velocityKmS: [...s.velocityKmS] });

export function centralAcceleration(positionKm, mu = EARTH_MU_KM3_S2) {
  const radius = vMag(positionKm);
  if (!Number.isFinite(radius) || radius === 0) throw new RangeError("Position must have a finite, non-zero radius");
  const scale = -mu / (radius * radius * radius);
  return [positionKm[0] * scale, positionKm[1] * scale];
}

export function rk4Step(state, dtSeconds, mu = EARTH_MU_KM3_S2) {
  if (!Number.isFinite(dtSeconds)) throw new TypeError("Step duration must be finite");
  const x0 = state.positionKm;
  const v0 = state.velocityKmS;
  const a0 = centralAcceleration(x0, mu);
  const x2 = vAdd(x0, vScale(v0, dtSeconds / 2));
  const v2 = vAdd(v0, vScale(a0, dtSeconds / 2));
  const a2 = centralAcceleration(x2, mu);
  const x3 = vAdd(x0, vScale(v2, dtSeconds / 2));
  const v3 = vAdd(v0, vScale(a2, dtSeconds / 2));
  const a3 = centralAcceleration(x3, mu);
  const x4 = vAdd(x0, vScale(v3, dtSeconds));
  const v4 = vAdd(v0, vScale(a3, dtSeconds));
  const a4 = centralAcceleration(x4, mu);
  const sixth = dtSeconds / 6;
  return {
    positionKm: vAdd(x0, vScale(vAdd(vAdd(v0, vScale(v2, 2)), vAdd(vScale(v3, 2), v4)), sixth)),
    velocityKmS: vAdd(v0, vScale(vAdd(vAdd(a0, vScale(a2, 2)), vAdd(vScale(a3, 2), a4)), sixth)),
  };
}

export function propagateTrajectory(initialState, durationSeconds, stepSeconds = DEFAULT_STEP_SECONDS, mu = EARTH_MU_KM3_S2) {
  if (!Number.isFinite(durationSeconds) || !Number.isFinite(stepSeconds) || stepSeconds <= 0) {
    throw new TypeError("Duration must be finite and the integration step must be positive");
  }
  const path = [{ timeSeconds: 0, ...cloneState(initialState) }];
  const direction = Math.sign(durationSeconds) || 1;
  let elapsed = 0;
  let state = cloneState(initialState);
  while (Math.abs(durationSeconds - elapsed) > 1e-9) {
    const dt = direction * Math.min(stepSeconds, Math.abs(durationSeconds - elapsed));
    state = rk4Step(state, dt, mu);
    elapsed += dt;
    if (Math.abs(durationSeconds - elapsed) < 1e-9) elapsed = durationSeconds;
    path.push({ timeSeconds: elapsed, ...state });
  }
  return path;
}

export function circularState(radiusKm, phaseRadians = 0, mu = EARTH_MU_KM3_S2) {
  if (!(radiusKm > 0) || !Number.isFinite(radiusKm) || !Number.isFinite(phaseRadians)) {
    throw new TypeError("A positive radius and finite phase are required");
  }
  const speed = Math.sqrt(mu / radiusKm);
  const c = Math.cos(phaseRadians);
  const s = Math.sin(phaseRadians);
  return {
    positionKm: [radiusKm * c, radiusKm * s],
    velocityKmS: [-speed * s, speed * c],
  };
}

export function applyLocalBurn(state, { radialMps = 0, tangentialMps = 0 } = {}) {
  if (![radialMps, tangentialMps].every(Number.isFinite)) throw new TypeError("Burn components must be finite");
  const radius = vMag(state.positionKm);
  if (radius === 0) throw new RangeError("Cannot define a local frame at zero radius");
  const radial = vScale(state.positionKm, 1 / radius);
  const tangent = [-radial[1], radial[0]];
  const deltaV = vAdd(vScale(radial, radialMps / 1000), vScale(tangent, tangentialMps / 1000));
  return { positionKm: [...state.positionKm], velocityKmS: vAdd(state.velocityKmS, deltaV), deltaVkmS: deltaV };
}

export function specificEnergy(state, mu = EARTH_MU_KM3_S2) {
  return vDot(state.velocityKmS, state.velocityKmS) / 2 - mu / vMag(state.positionKm);
}

export function specificAngularMomentum(state) {
  return state.positionKm[0] * state.velocityKmS[1] - state.positionKm[1] * state.velocityKmS[0];
}

function interpolateState(a, b, fraction) {
  return {
    positionKm: vAdd(a.positionKm, vScale(vSub(b.positionKm, a.positionKm), fraction)),
    velocityKmS: vAdd(a.velocityKmS, vScale(vSub(b.velocityKmS, a.velocityKmS), fraction)),
  };
}

function closestOnSegment(r0, r1) {
  const delta = vSub(r1, r0);
  const denom = vDot(delta, delta);
  return denom < 1e-24 ? 0 : clamp(-vDot(r0, delta) / denom, 0, 1);
}

export function closestApproach(pathA, pathB) {
  if (!Array.isArray(pathA) || !Array.isArray(pathB) || pathA.length !== pathB.length || pathA.length < 1) {
    throw new TypeError("Two equally sized non-empty state paths are required");
  }
  let best = null;
  const consider = (i, fraction) => {
    const a = interpolateState(pathA[i], pathA[Math.min(i + 1, pathA.length - 1)], fraction);
    const b = interpolateState(pathB[i], pathB[Math.min(i + 1, pathB.length - 1)], fraction);
    const relativePositionKm = vSub(a.positionKm, b.positionKm);
    const distanceKm = vMag(relativePositionKm);
    const t0 = pathA[i].timeSeconds;
    const t1 = pathA[Math.min(i + 1, pathA.length - 1)].timeSeconds;
    const timeSeconds = t0 + (t1 - t0) * fraction;
    if (!best || distanceKm < best.distanceKm) {
      best = { distanceKm, timeSeconds, positionAKm: a.positionKm, positionBKm: b.positionKm, relativePositionKm, relativeVelocityKmS: vSub(a.velocityKmS, b.velocityKmS) };
    }
  };
  if (pathA.length === 1) consider(0, 0);
  else for (let i = 0; i < pathA.length - 1; i++) {
    const r0 = vSub(pathA[i].positionKm, pathB[i].positionKm);
    const r1 = vSub(pathA[i + 1].positionKm, pathB[i + 1].positionKm);
    consider(i, closestOnSegment(r0, r1));
  }
  return best;
}

function makeIncident({ id, name, pair, descriptor, leadSeconds, radiusKm, offsetRadialKm, offsetTangentialKm, relativeRadialMps, relativeTangentialMps, stamp }) {
  const protectedAtEpoch = circularState(radiusKm);
  const protectedAtEncounter = propagateTrajectory(protectedAtEpoch, leadSeconds, 10).at(-1);
  const radial = vScale(protectedAtEncounter.positionKm, 1 / radiusKm);
  const tangent = [-radial[1], radial[0]];
  const debrisAtEncounter = {
    positionKm: vAdd(protectedAtEncounter.positionKm,
      vAdd(vScale(radial, offsetRadialKm), vScale(tangent, offsetTangentialKm))),
    velocityKmS: vAdd(protectedAtEncounter.velocityKmS,
      vAdd(vScale(radial, relativeRadialMps / 1000), vScale(tangent, relativeTangentialMps / 1000))),
  };
  const debrisAtEpoch = propagateTrajectory(debrisAtEncounter, -leadSeconds, 10).at(-1);
  return {
    id, name, pair, descriptor, leadSeconds, radiusKm, stamp,
    protectedAtEpoch: cloneState(protectedAtEpoch), debrisAtEpoch: cloneState(debrisAtEpoch),
  };
}

export function createIncidents() {
  return [
    makeIncident({
      id: "EV-17", name: "Night relay", pair: "KITE-04  /  FRAG 8821", descriptor: "Equatorial relay · untracked panel shard",
      leadSeconds: 2.4 * 3600, radiusKm: 7000, offsetRadialKm: 0.32, offsetTangentialKm: -0.17,
      relativeRadialMps: 6, relativeTangentialMps: 11.3, stamp: "LEO / 624 KM",
    }),
    makeIncident({
      id: "EV-31", name: "Polar crossing", pair: "NORTH-2  /  FRAG 1406", descriptor: "Sun-sync imager · paint-flake cluster",
      leadSeconds: 3.8 * 3600, radiusKm: 6950, offsetRadialKm: -0.71, offsetTangentialKm: 0.28,
      relativeRadialMps: -8.5, relativeTangentialMps: -6, stamp: "LEO / 579 KM",
    }),
    makeIncident({
      id: "EV-42", name: "Old bus drift", pair: "MICA-11  /  FRAG 3029", descriptor: "Retired weather bus · battery panel",
      leadSeconds: 1.55 * 3600, radiusKm: 7150, offsetRadialKm: 1.4, offsetTangentialKm: -0.4,
      relativeRadialMps: 7, relativeTangentialMps: 8, stamp: "LEO / 779 KM",
    }),
  ];
}

export function simulateIncident(incident, burn = {}, horizonHours = 5.5, options = {}) {
  if (!(horizonHours > 0) || !Number.isFinite(horizonHours)) throw new TypeError("Forecast horizon must be positive");
  const stepSeconds = options.stepSeconds ?? DEFAULT_STEP_SECONDS;
  if (!(stepSeconds > 0)) throw new TypeError("Step must be positive");
  const horizonSeconds = horizonHours * 3600;
  let protectedState = applyLocalBurn(incident.protectedAtEpoch, burn);
  let debrisState = cloneState(incident.debrisAtEpoch);
  const collect = options.collect !== false;
  const protectedPath = collect ? [{ timeSeconds: 0, ...cloneState(protectedState) }] : null;
  const debrisPath = collect ? [{ timeSeconds: 0, ...cloneState(debrisState) }] : null;
  let best = null;
  let elapsed = 0;
  let previousProtected = protectedState;
  let previousDebris = debrisState;
  while (elapsed < horizonSeconds - 1e-9) {
    const dt = Math.min(stepSeconds, horizonSeconds - elapsed);
    protectedState = rk4Step(protectedState, dt);
    debrisState = rk4Step(debrisState, dt);
    const nextTime = elapsed + dt;
    const fraction = closestOnSegment(vSub(previousProtected.positionKm, previousDebris.positionKm), vSub(protectedState.positionKm, debrisState.positionKm));
    const aAtClosest = interpolateState(previousProtected, protectedState, fraction);
    const bAtClosest = interpolateState(previousDebris, debrisState, fraction);
    const relativePositionKm = vSub(aAtClosest.positionKm, bAtClosest.positionKm);
    const distanceKm = vMag(relativePositionKm);
    if (!best || distanceKm < best.distanceKm) {
      best = {
        distanceKm,
        timeSeconds: elapsed + dt * fraction,
        positionAKm: aAtClosest.positionKm,
        positionBKm: bAtClosest.positionKm,
        relativePositionKm,
        relativeVelocityKmS: vSub(aAtClosest.velocityKmS, bAtClosest.velocityKmS),
      };
    }
    if (collect) {
      protectedPath.push({ timeSeconds: nextTime, ...cloneState(protectedState) });
      debrisPath.push({ timeSeconds: nextTime, ...cloneState(debrisState) });
    }
    previousProtected = protectedState;
    previousDebris = debrisState;
    elapsed = nextTime;
  }
  return { closest: best, protectedPath, debrisPath, horizonSeconds, stepSeconds, burn: { radialMps: burn.radialMps ?? 0, tangentialMps: burn.tangentialMps ?? 0 } };
}

export function searchSafeBurn(incident, horizonHours = 5.5, options = {}) {
  const limitMps = options.limitMps ?? 2;
  const incrementMps = options.incrementMps ?? 0.2;
  const thresholdKm = options.thresholdKm ?? SAFE_MISS_KM;
  const samplesPerAxis = Math.round(limitMps / incrementMps);
  const baseline = simulateIncident(incident, {}, horizonHours, { collect: false }).closest;
  if (baseline.distanceKm >= thresholdKm) return { burn: { radialMps: 0, tangentialMps: 0 }, closest: baseline, safe: true, checked: 1 };
  let bestSafe = null;
  let bestUnsafe = null;
  let checked = 0;
  for (let ri = -samplesPerAxis; ri <= samplesPerAxis; ri++) {
    for (let ti = -samplesPerAxis; ti <= samplesPerAxis; ti++) {
      const radialMps = ri * incrementMps;
      const tangentialMps = ti * incrementMps;
      const miss = simulateIncident(incident, { radialMps, tangentialMps }, horizonHours, { collect: false }).closest;
      const magnitudeMps = Math.hypot(radialMps, tangentialMps);
      const candidate = { burn: { radialMps, tangentialMps }, closest: miss, magnitudeMps, safe: miss.distanceKm >= thresholdKm };
      checked++;
      if (candidate.safe && (!bestSafe || candidate.magnitudeMps < bestSafe.magnitudeMps ||
        (candidate.magnitudeMps === bestSafe.magnitudeMps && miss.distanceKm > bestSafe.closest.distanceKm))) bestSafe = candidate;
      if (!candidate.safe && (!bestUnsafe || miss.distanceKm > bestUnsafe.closest.distanceKm ||
        (miss.distanceKm === bestUnsafe.closest.distanceKm && magnitudeMps < bestUnsafe.magnitudeMps))) bestUnsafe = candidate;
    }
  }
  const best = bestSafe || bestUnsafe;
  return { ...best, checked, grid: { limitMps, incrementMps, pointsPerAxis: samplesPerAxis * 2 + 1 } };
}

const INCIDENTS = createIncidents();

function formatDistance(km) {
  if (km < 0.1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(2)} km`;
  return `${Math.round(km)} km`;
}

function formatMissionTime(seconds) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

function orbitStateAt(path, timeSeconds) {
  if (timeSeconds <= 0) return path[0];
  if (timeSeconds >= path[path.length - 1].timeSeconds) return path.at(-1);
  const index = Math.min(path.length - 2, Math.floor(timeSeconds / (path[1].timeSeconds - path[0].timeSeconds)));
  const a = path[index];
  const b = path[index + 1];
  return { ...interpolateState(a, b, clamp((timeSeconds - a.timeSeconds) / (b.timeSeconds - a.timeSeconds), 0, 1)), timeSeconds };
}

function localRelativeComponents(relative, primaryAt) {
  const radius = vMag(primaryAt.positionKm);
  const radial = vScale(primaryAt.positionKm, 1 / radius);
  const tangent = [-radial[1], radial[0]];
  return { radialKm: vDot(relative, radial), tangentialKm: vDot(relative, tangent) };
}

function drawMap(canvas, result, baseline, incident, currentTime) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (rect.width < 1 || rect.height < 1) return;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height;
  const cx = w * 0.5, cy = h * 0.52;
  const scale = (Math.min(w, h) * 0.47) / 7600;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#10171d";
  ctx.fillRect(0, 0, w, h);

  // Calibration rings are geocentric and share one linear kilometre scale.
  for (const altitude of [0, 250, 500, 1000]) {
    const radius = (EARTH_RADIUS_KM + altitude) * scale;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU);
    ctx.strokeStyle = altitude === 0 ? "rgba(125,156,172,.35)" : "rgba(125,156,172,.16)";
    ctx.lineWidth = altitude === 0 ? 1 : .7; ctx.setLineDash(altitude ? [2, 7] : []); ctx.stroke();
    if (altitude) {
      ctx.setLineDash([]); ctx.fillStyle = "rgba(160,182,192,.50)"; ctx.font = "9px ui-monospace, monospace";
      ctx.fillText(`+${altitude} km`, cx + 4, cy - radius + 12);
    }
  }
  ctx.setLineDash([]);
  for (let i = 0; i < 48; i++) {
    const x = ((i * 127.1) % 997) / 997 * w;
    const y = ((i * 311.7) % 991) / 991 * h;
    ctx.fillStyle = `rgba(190,214,221,${0.08 + (i % 4) * 0.025})`;
    ctx.fillRect(x, y, i % 9 === 0 ? 1.8 : 1, i % 9 === 0 ? 1.8 : 1);
  }
  const toPoint = (state) => ({ x: cx + state.positionKm[0] * scale, y: cy - state.positionKm[1] * scale });
  const drawPath = (path, color, width, dash = []) => {
    ctx.beginPath();
    path.forEach((state, i) => { const p = toPoint(state); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  };
  if (baseline && (Math.abs(result.burn.radialMps) + Math.abs(result.burn.tangentialMps) > 1e-5)) {
    drawPath(baseline.protectedPath, "rgba(196,204,204,.35)", 1, [3, 6]);
  }
  drawPath(result.debrisPath, "rgba(255,126,98,.75)", 1.15, [3, 5]);
  drawPath(result.protectedPath, "rgba(107,222,199,.82)", 1.55);

  // Stylized Earth is kept at the same radial scale as the orbit shells.
  const er = EARTH_RADIUS_KM * scale;
  const earth = ctx.createRadialGradient(cx - er * .30, cy - er * .34, er * .08, cx, cy, er);
  earth.addColorStop(0, "#356378"); earth.addColorStop(.68, "#183645"); earth.addColorStop(1, "#0b1922");
  ctx.beginPath(); ctx.arc(cx, cy, er, 0, TAU); ctx.fillStyle = earth; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, er * .985, 0, TAU); ctx.clip();
  ctx.strokeStyle = "rgba(85,183,171,.22)"; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const x = cx - er + (i + 1) * er / 3.5;
    ctx.beginPath(); ctx.ellipse(cx + (i - 2.5) * er * .18, cy, er * (.40 + (i % 2) * .05), er * (.88 - (i % 3) * .04), .15, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(cx, cy, er * .95, er * .33, -.22, 0, TAU); ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, er, 0, TAU); ctx.strokeStyle = "rgba(112,203,190,.45)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "rgba(180,214,213,.6)"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.fillText("EARTH · 6,371 km", cx, cy + 4); ctx.textAlign = "left";

  const pa = orbitStateAt(result.protectedPath, currentTime);
  const pb = orbitStateAt(result.debrisPath, currentTime);
  const a = toPoint(pa), b = toPoint(pb);
  const drawTarget = (p, color, label, right) => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4.7, 0, TAU); ctx.fillStyle = color; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, 8.7, 0, TAU); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = color; ctx.font = "bold 9px ui-monospace, monospace"; ctx.textAlign = right ? "right" : "left";
    ctx.fillText(label, p.x + (right ? -11 : 11), p.y - 10);
  };
  const pairLabels = incident.pair.split("/").map((part) => part.trim());
  drawTarget(a, "#76e3c4", pairLabels[0] || "PRIMARY", a.x > cx);
  drawTarget(b, "#ff8867", pairLabels[1] || "DEBRIS", b.x > cx);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = "rgba(248,186,133,.65)"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);

  const encounterA = toPoint({ positionKm: result.closest.positionAKm });
  const encounterB = toPoint({ positionKm: result.closest.positionBKm });
  for (const p of [encounterA, encounterB]) {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4.2, 0, TAU); ctx.strokeStyle = "#ffc17a"; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(encounterA.x, encounterA.y); ctx.lineTo(encounterB.x, encounterB.y);
  ctx.strokeStyle = "rgba(255,193,122,.8)"; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);

  drawMissInset(ctx, w - 207, 16, result, baseline);
  ctx.fillStyle = "rgba(218,230,231,.68)"; ctx.font = "9px ui-monospace, monospace"; ctx.fillText("GEOCENTRIC · KM", 14, h - 16);
}

function drawMissInset(ctx, x, y, result, baseline) {
  const w = 190, h = 114;
  ctx.fillStyle = "rgba(8,15,20,.92)"; ctx.strokeStyle = "rgba(142,168,174,.25)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#9aadb3"; ctx.font = "8px ui-monospace, monospace"; ctx.fillText("LOCAL MISS · ±6 KM CLIP", x + 10, y + 14);
  const ox = x + w / 2, oy = y + 69, s = 7.1;
  ctx.beginPath(); ctx.arc(ox, oy, SAFE_MISS_KM * s, 0, TAU); ctx.strokeStyle = "rgba(255,188,119,.3)"; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(ox - 42, oy); ctx.lineTo(ox + 42, oy); ctx.moveTo(ox, oy - 42); ctx.lineTo(ox, oy + 42); ctx.strokeStyle = "rgba(142,168,174,.18)"; ctx.stroke();
  const components = localRelativeComponents(result.closest.relativePositionKm, { positionKm: result.closest.positionAKm });
  const drawMiss = (miss, color, marker) => {
    const c = localRelativeComponents(miss.relativePositionKm, { positionKm: miss.positionAKm });
    const px = ox + clamp(c.tangentialKm, -6, 6) * s;
    const py = oy - clamp(c.radialKm, -6, 6) * s;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(px, py); ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, 3.6, 0, TAU); ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = color; ctx.font = "8px ui-monospace, monospace"; ctx.fillText(marker, px + 5, py - 3);
  };
  if (baseline) drawMiss(baseline.closest, "rgba(206,215,218,.64)", "0");
  drawMiss(result.closest, "#76e3c4", "Δv");
  ctx.fillStyle = "#71868d"; ctx.font = "8px ui-monospace, monospace"; ctx.fillText("TANGENTIAL →", x + 111, y + h - 8);
  ctx.save(); ctx.translate(x + 11, y + 71); ctx.rotate(-Math.PI / 2); ctx.fillText("RADIAL", 0, 0); ctx.restore();
  void components;
}

function initConsole() {
  const canvas = document.querySelector("#orbit-map");
  if (!canvas) return;
  const el = (id) => document.getElementById(id);
  const state = { incidentIndex: 0, horizonHours: 5.5, radialMps: 0, tangentialMps: 0, currentTime: 0, playing: false, result: null, baseline: null, sweepBusy: false };
  const incident = () => INCIDENTS[state.incidentIndex];

  const update = () => {
    state.result = simulateIncident(incident(), { radialMps: state.radialMps, tangentialMps: state.tangentialMps }, state.horizonHours);
    state.baseline = Math.abs(state.radialMps) + Math.abs(state.tangentialMps) > 1e-5
      ? simulateIncident(incident(), {}, state.horizonHours) : state.result;
    state.currentTime = clamp(state.currentTime, 0, state.result.horizonSeconds);
    el("miss-value").textContent = formatDistance(state.result.closest.distanceKm);
    el("miss-time").textContent = `AT ${formatMissionTime(state.result.closest.timeSeconds)}`;
    el("base-value").textContent = formatDistance(state.baseline.closest.distanceKm);
    const change = state.result.closest.distanceKm - state.baseline.closest.distanceKm;
    el("change-value").textContent = `${change >= 0 ? "+" : "−"}${formatDistance(Math.abs(change))}`;
    el("burn-summary").textContent = `${state.radialMps >= 0 ? "+" : "−"}${Math.abs(state.radialMps).toFixed(2)} R  /  ${state.tangentialMps >= 0 ? "+" : "−"}${Math.abs(state.tangentialMps).toFixed(2)} T m/s`;
    const magnitude = Math.hypot(state.radialMps, state.tangentialMps);
    el("dv-total").textContent = `${magnitude.toFixed(2)} m/s`;
    const status = state.result.closest.distanceKm < CRITICAL_MISS_KM ? ["CRITICAL", "risk-critical"] : state.result.closest.distanceKm < SAFE_MISS_KM ? ["WATCH", "risk-watch"] : ["CLEAR", "risk-clear"];
    el("risk-pill").textContent = status[0]; el("risk-pill").className = `risk-pill ${status[1]}`;
    el("miss-context").textContent = status[0] === "CLEAR" ? "Projected pass is outside the 5 km response ring." : status[0] === "CRITICAL" ? "Inside 1 km. A close pass needs immediate review." : "Inside the 5 km response ring. Plot and compare a correction.";
    el("horizon-value").textContent = `${state.horizonHours.toFixed(2).replace(/0$/, "")} h`;
    el("time-scrub").max = String(Math.round(state.result.horizonSeconds / 60));
    el("time-scrub").value = String(Math.round(state.currentTime / 60));
    el("clock-readout").textContent = `T + ${formatMissionTime(state.currentTime)}`;
    const evtPct = clamp(state.result.closest.timeSeconds / state.result.horizonSeconds * 100, 0, 100);
    el("event-marker").style.left = `${evtPct}%`;
    el("event-marker").setAttribute("aria-label", `Closest pass at ${formatMissionTime(state.result.closest.timeSeconds)}`);
    el("horizon-range").value = String(state.horizonHours);
    el("radial-range").value = String(state.radialMps);
    el("tangent-range").value = String(state.tangentialMps);
    el("radial-value").textContent = `${state.radialMps >= 0 ? "+" : "−"}${Math.abs(state.radialMps).toFixed(2)} m/s`;
    el("tangent-value").textContent = `${state.tangentialMps >= 0 ? "+" : "−"}${Math.abs(state.tangentialMps).toFixed(2)} m/s`;
    el("incident-title").textContent = incident().name;
    el("incident-pair").textContent = incident().pair;
    el("incident-detail").textContent = incident().descriptor;
    el("incident-stamp").textContent = incident().stamp;
    el("incident-lead").textContent = `${formatMissionTime(incident().leadSeconds)} baseline lead`;
    el("map-kite").textContent = incident().pair.split("/")[0].trim();
    el("map-frag").textContent = incident().pair.split("/")[1].trim();
    el("forecast-caption").textContent = `A ${state.horizonHours.toFixed(2).replace(/0$/, "")} h two-body forecast · epoch impulse`;
    document.querySelectorAll(".event-row").forEach((row) => row.setAttribute("aria-pressed", String(Number(row.dataset.index) === state.incidentIndex)));
    el("sweep-btn").disabled = state.sweepBusy;
    el("sweep-btn").textContent = state.sweepBusy ? "SWEEPING BURN GRID…" : "FIND LOW-FUEL CLEARANCE";
    drawMap(canvas, state.result, state.baseline, incident(), state.currentTime);
  };

  document.querySelectorAll(".event-row").forEach((row) => row.addEventListener("click", () => {
    state.incidentIndex = Number(row.dataset.index); state.radialMps = 0; state.tangentialMps = 0; state.currentTime = 0; state.playing = false; update();
  }));
  el("radial-range").addEventListener("input", (event) => { state.radialMps = Number(event.target.value); update(); });
  el("tangent-range").addEventListener("input", (event) => { state.tangentialMps = Number(event.target.value); update(); });
  el("horizon-range").addEventListener("input", (event) => { state.horizonHours = Number(event.target.value); update(); });
  el("time-scrub").addEventListener("input", (event) => { state.currentTime = Number(event.target.value) * 60; update(); });
  el("reset-burn").addEventListener("click", () => { state.radialMps = 0; state.tangentialMps = 0; update(); });
  el("sweep-btn").addEventListener("click", () => {
    state.sweepBusy = true; update();
    window.setTimeout(() => {
      const proposal = searchSafeBurn(incident(), state.horizonHours);
      state.radialMps = proposal.burn.radialMps;
      state.tangentialMps = proposal.burn.tangentialMps;
      state.sweepBusy = false;
      el("sweep-result").textContent = proposal.safe
        ? `Lowest grid burn found: ${Math.hypot(state.radialMps, state.tangentialMps).toFixed(2)} m/s · ${proposal.checked.toLocaleString()} vectors checked · ${formatDistance(proposal.closest.distanceKm)} miss`
        : `No grid vector cleared 5 km. Best found: ${formatDistance(proposal.closest.distanceKm)} miss · ${proposal.checked.toLocaleString()} vectors checked`;
      update();
    }, 30);
  });
  el("play-toggle").addEventListener("click", () => {
    state.playing = !state.playing;
    el("play-toggle").textContent = state.playing ? "Ⅱ  HOLD" : "▶  RUN TRACK";
    if (state.playing) { state.lastFrame = 0; requestAnimationFrame(animate); }
  });
  el("step-back").addEventListener("click", () => { state.playing = false; state.currentTime = Math.max(0, state.currentTime - 300); update(); });
  el("step-forward").addEventListener("click", () => { state.playing = false; state.currentTime = Math.min(state.result.horizonSeconds, state.currentTime + 300); update(); });
  function animate(timestamp) {
    if (!state.playing) return;
    if (state.lastFrame) state.currentTime += (timestamp - state.lastFrame) * 0.09;
    state.lastFrame = timestamp;
    if (state.currentTime >= state.result.horizonSeconds) { state.currentTime = state.result.horizonSeconds; state.playing = false; el("play-toggle").textContent = "▶  RUN TRACK"; }
    el("time-scrub").value = String(Math.round(state.currentTime / 60));
    el("clock-readout").textContent = `T + ${formatMissionTime(state.currentTime)}`;
    drawMap(canvas, state.result, state.baseline, incident(), state.currentTime);
    if (state.playing) requestAnimationFrame(animate);
  }
  window.addEventListener("resize", () => drawMap(canvas, state.result, state.baseline, incident(), state.currentTime));
  update();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initConsole, { once: true });
  else initConsole();
}
