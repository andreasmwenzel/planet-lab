export const BODY_DATA = Object.freeze({
  earth: Object.freeze({ name: "Earth", symbol: "⊕", radiusKm: 6378.137, muKm3s2: 398600.4418, color: "#62c8bd" }),
  moon: Object.freeze({ name: "Moon", symbol: "◐", radiusKm: 1737.4, muKm3s2: 4902.800066, color: "#b7c7db" }),
  mars: Object.freeze({ name: "Mars", symbol: "♂", radiusKm: 3389.5, muKm3s2: 42828.375214, color: "#f18b70" })
});

const TWO_PI = 2 * Math.PI;
const finitePositive = (value, name) => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(name + " must be a positive finite number");
};

export function makeOrbit(bodyKey, periapsisAltitudeKm, apoapsisAltitudeKm) {
  const body = BODY_DATA[bodyKey];
  if (!body) throw new RangeError("Unknown central body: " + bodyKey);
  if (!Number.isFinite(periapsisAltitudeKm) || periapsisAltitudeKm < 0) throw new RangeError("Periapsis altitude must be finite and non-negative");
  if (!Number.isFinite(apoapsisAltitudeKm) || apoapsisAltitudeKm < periapsisAltitudeKm) {
    throw new RangeError("Apoapsis altitude must be finite and no lower than periapsis altitude");
  }
  const rpKm = body.radiusKm + periapsisAltitudeKm;
  const raKm = body.radiusKm + apoapsisAltitudeKm;
  const aKm = (rpKm + raKm) / 2;
  const e = (raKm - rpKm) / (raKm + rpKm);
  const pKm = aKm * (1 - e * e);
  const meanMotionRadSec = Math.sqrt(body.muKm3s2 / (aKm ** 3));
  const periodSec = TWO_PI / meanMotionRadSec;
  return Object.freeze({
    bodyKey, body, periapsisAltitudeKm, apoapsisAltitudeKm,
    rpKm, raKm, aKm, e, pKm, meanMotionRadSec, periodSec,
    specificEnergyKm2s2: -body.muKm3s2 / (2 * aKm),
    specificAngularMomentumKm2s: Math.sqrt(body.muKm3s2 * pKm)
  });
}

export function normalizeAngle(angleRad) {
  return ((angleRad % TWO_PI) + TWO_PI) % TWO_PI;
}

export function solveKepler(meanAnomalyRad, eccentricity) {
  if (!Number.isFinite(meanAnomalyRad)) throw new RangeError("Mean anomaly must be finite");
  if (!Number.isFinite(eccentricity) || eccentricity < 0 || eccentricity >= 1) {
    throw new RangeError("Elliptic eccentricity must be in [0, 1)");
  }
  const M = normalizeAngle(meanAnomalyRad);
  if (eccentricity === 0 || M === 0) return M;
  let E = eccentricity < 0.8 ? M : Math.PI;
  for (let i = 0; i < 32; i += 1) {
    const f = E - eccentricity * Math.sin(E) - M;
    const fp = 1 - eccentricity * Math.cos(E);
    const step = f / fp;
    E -= step;
    if (Math.abs(step) < 1e-13) return normalizeAngle(E);
  }
  return normalizeAngle(E);
}

export function propagateAtTime(orbit, elapsedSec) {
  if (!orbit || !Number.isFinite(orbit.aKm) || !Number.isFinite(orbit.meanMotionRadSec)) {
    throw new TypeError("A valid orbit from makeOrbit is required");
  }
  if (!Number.isFinite(elapsedSec)) throw new RangeError("Elapsed time must be finite");
  const meanAnomalyRad = normalizeAngle(orbit.meanMotionRadSec * elapsedSec);
  const eccentricAnomalyRad = solveKepler(meanAnomalyRad, orbit.e);
  const { aKm, e, body } = orbit;
  const cosE = Math.cos(eccentricAnomalyRad);
  const sinE = Math.sin(eccentricAnomalyRad);
  const radiusKm = aKm * (1 - e * cosE);
  const sqrtOneMinusESquared = Math.sqrt(1 - e * e);
  const xKm = aKm * (cosE - e);
  const yKm = aKm * sqrtOneMinusESquared * sinE;
  const velocityFactor = Math.sqrt(body.muKm3s2 * aKm) / radiusKm;
  const vxKmSec = -velocityFactor * sinE;
  const vyKmSec = velocityFactor * sqrtOneMinusESquared * cosE;
  const trueAnomalyRad = normalizeAngle(Math.atan2(
    sqrtOneMinusESquared * sinE,
    cosE - e
  ));
  const speedKmSec = Math.hypot(vxKmSec, vyKmSec);
  const radialVelocityKmSec = (xKm * vxKmSec + yKm * vyKmSec) / radiusKm;
  return Object.freeze({
    elapsedSec, meanAnomalyRad, eccentricAnomalyRad, trueAnomalyRad,
    radiusKm, altitudeKm: radiusKm - body.radiusKm,
    xKm, yKm, vxKmSec, vyKmSec, speedKmSec, radialVelocityKmSec
  });
}

export function visVivaSpeed(muKm3s2, radiusKm, semiMajorAxisKm) {
  finitePositive(muKm3s2, "Gravitational parameter");
  finitePositive(radiusKm, "Orbital radius");
  finitePositive(semiMajorAxisKm, "Semi-major axis");
  const speedSquared = muKm3s2 * (2 / radiusKm - 1 / semiMajorAxisKm);
  if (speedSquared < 0) throw new RangeError("The requested state is outside the bound orbit");
  return Math.sqrt(speedSquared);
}
