// Two-body and patched-conic helpers for Luna Mission Designer.
// Distances are km, time is seconds, speed is km/s, and mu is km^3/s^2.
export const EARTH = Object.freeze({
  mu: 398600.4418,
  radiusKm: 6378.137,
});

export const MOON = Object.freeze({
  mu: 4902.800066,
  radiusKm: 1737.4,
  orbitalRadiusKm: 384400,
  orbitalPeriodDays: 27.321661,
});

const TAU = 2 * Math.PI;
const moonMeanMotion = TAU / (MOON.orbitalPeriodDays * 86400);

function finitePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number`);
  }
}

export function visVivaSpeed(mu, radiusKm, semiMajorAxisKm) {
  finitePositive(mu, "mu");
  finitePositive(radiusKm, "radiusKm");
  finitePositive(semiMajorAxisKm, "semiMajorAxisKm");
  const speedSquared = mu * (2 / radiusKm - 1 / semiMajorAxisKm);
  if (speedSquared < 0) throw new RangeError("The requested point is outside the orbit");
  return Math.sqrt(speedSquared);
}

export function circularSpeed(mu, radiusKm) {
  finitePositive(mu, "mu");
  finitePositive(radiusKm, "radiusKm");
  return Math.sqrt(mu / radiusKm);
}

// Bisection is slower than Newton's method but is globally bracketed and stable
// for every elliptic eccentricity, including values close to one.
export function solveKepler(meanAnomalyRad, eccentricity) {
  if (!Number.isFinite(meanAnomalyRad)) throw new RangeError("Mean anomaly must be finite");
  if (!Number.isFinite(eccentricity) || eccentricity < 0 || eccentricity >= 1) {
    throw new RangeError("Eccentricity must be in [0, 1)");
  }
  const M = ((meanAnomalyRad % TAU) + TAU) % TAU;
  if (eccentricity === 0 || M === 0) return M;

  let low = 0;
  let high = TAU;
  for (let i = 0; i < 72; i += 1) {
    const E = (low + high) / 2;
    const residual = E - eccentricity * Math.sin(E) - M;
    if (Math.abs(residual) < 2e-14) return E;
    if (residual > 0) high = E;
    else low = E;
  }
  return (low + high) / 2;
}

export function createLunarTransfer({ parkingAltitudeKm = 200, captureAltitudeKm = 100 } = {}) {
  finitePositive(parkingAltitudeKm, "parkingAltitudeKm");
  finitePositive(captureAltitudeKm, "captureAltitudeKm");
  if (parkingAltitudeKm > 10000) throw new RangeError("Parking orbit altitude must be at most 10,000 km");
  if (captureAltitudeKm > 10000) throw new RangeError("Capture orbit altitude must be at most 10,000 km");

  const departureRadiusKm = EARTH.radiusKm + parkingAltitudeKm;
  const lunarDistanceKm = MOON.orbitalRadiusKm;
  const transferSemiMajorAxisKm = (departureRadiusKm + lunarDistanceKm) / 2;
  const eccentricity = (lunarDistanceKm - departureRadiusKm) / (lunarDistanceKm + departureRadiusKm);
  const departureOrbitSpeedKmS = circularSpeed(EARTH.mu, departureRadiusKm);
  const transferDepartureSpeedKmS = visVivaSpeed(EARTH.mu, departureRadiusKm, transferSemiMajorAxisKm);
  const transferArrivalSpeedKmS = visVivaSpeed(EARTH.mu, lunarDistanceKm, transferSemiMajorAxisKm);
  const moonCircularSpeedKmS = circularSpeed(EARTH.mu, lunarDistanceKm);
  const lunarVInfinityKmS = Math.abs(moonCircularSpeedKmS - transferArrivalSpeedKmS);
  const captureRadiusKm = MOON.radiusKm + captureAltitudeKm;
  const lunarHyperbolicPeriapsisSpeedKmS = Math.sqrt(
    lunarVInfinityKmS ** 2 + 2 * MOON.mu / captureRadiusKm,
  );
  const lunarCircularSpeedKmS = circularSpeed(MOON.mu, captureRadiusKm);
  const departureDeltaVKmS = transferDepartureSpeedKmS - departureOrbitSpeedKmS;
  const captureDeltaVKmS = lunarHyperbolicPeriapsisSpeedKmS - lunarCircularSpeedKmS;
  const transferDurationSeconds = Math.PI * Math.sqrt(transferSemiMajorAxisKm ** 3 / EARTH.mu);

  return Object.freeze({
    parkingAltitudeKm,
    captureAltitudeKm,
    departureRadiusKm,
    lunarDistanceKm,
    captureRadiusKm,
    transferSemiMajorAxisKm,
    eccentricity,
    departureOrbitSpeedKmS,
    transferDepartureSpeedKmS,
    transferArrivalSpeedKmS,
    moonCircularSpeedKmS,
    lunarVInfinityKmS,
    lunarHyperbolicPeriapsisSpeedKmS,
    lunarCircularSpeedKmS,
    departureDeltaVKmS,
    captureDeltaVKmS,
    totalDeltaVKmS: departureDeltaVKmS + captureDeltaVKmS,
    transferDurationSeconds,
    transferDurationDays: transferDurationSeconds / 86400,
    transferSpecificEnergyKm2S2: -EARTH.mu / (2 * transferSemiMajorAxisKm),
    angularMomentumKm2S: Math.sqrt(
      EARTH.mu * transferSemiMajorAxisKm * (1 - eccentricity ** 2),
    ),
  });
}

// Idealized heliocentric-free transfer state; time is clamped to the coast arc.
export function stateAtTransferTime(timeSeconds, mission) {
  if (!mission || !Number.isFinite(mission.transferDurationSeconds) || mission.transferDurationSeconds <= 0) {
    throw new TypeError("A valid transfer mission is required");
  }
  if (!Number.isFinite(timeSeconds)) throw new RangeError("timeSeconds must be finite");
  const t = Math.min(mission.transferDurationSeconds, Math.max(0, timeSeconds));
  const meanMotion = Math.sqrt(EARTH.mu / mission.transferSemiMajorAxisKm ** 3);
  const meanAnomalyRad = meanMotion * t;
  const eccentricAnomalyRad = solveKepler(meanAnomalyRad, mission.eccentricity);
  const e = mission.eccentricity;
  const a = mission.transferSemiMajorAxisKm;
  const root = Math.sqrt(1 - e ** 2);
  const radiusKm = a * (1 - e * Math.cos(eccentricAnomalyRad));
  const eccentricAnomalyRate = meanMotion / (1 - e * Math.cos(eccentricAnomalyRad));
  return Object.freeze({
    timeSeconds: t,
    meanAnomalyRad,
    eccentricAnomalyRad,
    radiusKm,
    xKm: a * (Math.cos(eccentricAnomalyRad) - e),
    yKm: a * root * Math.sin(eccentricAnomalyRad),
    vxKmS: -a * Math.sin(eccentricAnomalyRad) * eccentricAnomalyRate,
    vyKmS: a * root * Math.cos(eccentricAnomalyRad) * eccentricAnomalyRate,
  });
}

// The phase is chosen so the Moon reaches the transfer ellipse's apogee at
// arrival. The Moon's actual eccentric, inclined orbit is intentionally omitted.
export function moonAngleAtTransferTime(timeSeconds, mission) {
  if (!mission || !Number.isFinite(mission.transferDurationSeconds)) {
    throw new TypeError("A valid transfer mission is required");
  }
  const t = Math.min(mission.transferDurationSeconds, Math.max(0, timeSeconds));
  return Math.PI - moonMeanMotion * mission.transferDurationSeconds + moonMeanMotion * t;
}

