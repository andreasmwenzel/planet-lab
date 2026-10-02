import test from "node:test";
import assert from "node:assert/strict";
import {
  EARTH,
  MOON,
  circularSpeed,
  createLunarTransfer,
  moonAngleAtTransferTime,
  solveKepler,
  stateAtTransferTime,
  visVivaSpeed,
} from "./physics.js";

const closeTo = (actual, expected, tolerance, label) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, received ${actual}`,
  );
};
const wrap = (angle) => ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

test("200 km / 100 km reference mission matches locked numeric baselines", () => {
  const mission = createLunarTransfer({ parkingAltitudeKm: 200, captureAltitudeKm: 100 });
  closeTo(mission.departureDeltaVKmS, 3.13134501371772, 1e-11, "Earth departure Δv (km/s)");
  closeTo(mission.captureDeltaVKmS, 0.82170994681712, 1e-11, "lunar capture Δv (km/s)");
  closeTo(mission.totalDeltaVKmS, 3.95305496053484, 1e-11, "total ideal Δv (km/s)");
  closeTo(mission.transferDurationSeconds, 430095.303923992, 1e-6, "Hohmann coast (s)");
  closeTo(mission.lunarVInfinityKmS, 0.831507477438, 1e-12, "lunar arrival v-infinity (km/s)");
  assert.ok(mission.eccentricity > 0.96 && mission.eccentricity < 0.97);
});

test("Kepler solver satisfies the elliptic equation at low and high eccentricity", () => {
  const samples = [
    { e: 0, M: 2.7 },
    { e: 0.75, M: 0.02 },
    { e: 0.9663503588692992, M: 0.01 },
    { e: 0.9663503588692992, M: 1.3 },
    { e: 0.9663503588692992, M: 3.1 },
    { e: 0.9663503588692992, M: 5.9 },
    { e: 0.999, M: -0.8 },
  ];
  for (const { e, M } of samples) {
    const E = solveKepler(M, e);
    const normalizedM = wrap(M);
    const residual = E - e * Math.sin(E) - normalizedM;
    closeTo(residual, 0, 3e-13, `Kepler residual for e=${e}, M=${M}`);
    assert.ok(E >= 0 && E <= 2 * Math.PI, `eccentric anomaly should be wrapped: ${E}`);
  }
});

test("transfer state conserves specific energy and angular momentum along the coast", () => {
  const mission = createLunarTransfer();
  const fractions = [0, 0.03, 0.17, 0.5, 0.83, 0.97, 1];
  for (const fraction of fractions) {
    const state = stateAtTransferTime(fraction * mission.transferDurationSeconds, mission);
    const radius = Math.hypot(state.xKm, state.yKm);
    const speedSquared = state.vxKmS ** 2 + state.vyKmS ** 2;
    const energy = speedSquared / 2 - EARTH.mu / radius;
    const angularMomentum = state.xKm * state.vyKmS - state.yKm * state.vxKmS;
    closeTo(energy, mission.transferSpecificEnergyKm2S2, 2e-11, `specific energy at t/T=${fraction}`);
    closeTo(angularMomentum, mission.angularMomentumKm2S, 2e-8, `specific angular momentum at t/T=${fraction}`);
  }
});

test("transfer coast starts at the parking radius and reaches lunar distance at apogee", () => {
  const mission = createLunarTransfer();
  const departure = stateAtTransferTime(0, mission);
  const arrival = stateAtTransferTime(mission.transferDurationSeconds, mission);
  closeTo(Math.hypot(departure.xKm, departure.yKm), mission.departureRadiusKm, 2e-8, "departure radius (km)");
  closeTo(Math.hypot(arrival.xKm, arrival.yKm), MOON.orbitalRadiusKm, 2e-8, "arrival radius (km)");
  closeTo(departure.yKm, 0, 1e-10, "departure cross-track position (km)");
  closeTo(arrival.yKm, 0, 1e-8, "arrival cross-track position (km)");
  assert.ok(departure.vyKmS > 0 && arrival.vyKmS < 0, "the coast follows the intended upper transfer arc");
});

test("Moon phase is aligned with transfer apogee at the computed arrival time", () => {
  const mission = createLunarTransfer();
  const initialAngle = moonAngleAtTransferTime(0, mission);
  const arrivalAngle = moonAngleAtTransferTime(mission.transferDurationSeconds, mission);
  assert.ok(initialAngle > 0 && initialAngle < Math.PI);
  closeTo(Math.cos(arrivalAngle), -1, 1e-14, "arrival Moon x phase");
  closeTo(Math.sin(arrivalAngle), 0, 1e-14, "arrival Moon y phase");
});

test("patched-conic capture Δv closes the hyperbolic and circular speed difference", () => {
  const mission = createLunarTransfer();
  const hyperbolicEnergySpeed = Math.sqrt(
    mission.lunarVInfinityKmS ** 2 + (2 * MOON.mu) / mission.captureRadiusKm,
  );
  closeTo(mission.lunarHyperbolicPeriapsisSpeedKmS, hyperbolicEnergySpeed, 1e-13, "hyperbolic perilune speed (km/s)");
  closeTo(
    mission.captureDeltaVKmS,
    hyperbolicEnergySpeed - circularSpeed(MOON.mu, mission.captureRadiusKm),
    1e-13,
    "lunar orbit insertion Δv (km/s)",
  );
});

test("vis-viva reduces to circular speed and transfer endpoints use the same function", () => {
  const radiusKm = EARTH.radiusKm + 400;
  closeTo(visVivaSpeed(EARTH.mu, radiusKm, radiusKm), circularSpeed(EARTH.mu, radiusKm), 1e-14, "circular vis-viva speed (km/s)");
  const mission = createLunarTransfer({ parkingAltitudeKm: 400, captureAltitudeKm: 150 });
  closeTo(visVivaSpeed(EARTH.mu, mission.departureRadiusKm, mission.transferSemiMajorAxisKm), mission.transferDepartureSpeedKmS, 1e-14, "transfer departure speed (km/s)");
});

test("supported altitude extremes stay finite; invalid physics inputs reject", () => {
  const low = createLunarTransfer({ parkingAltitudeKm: 160, captureAltitudeKm: 50 });
  const high = createLunarTransfer({ parkingAltitudeKm: 1200, captureAltitudeKm: 500 });
  for (const mission of [low, high]) {
    for (const value of [mission.departureDeltaVKmS, mission.captureDeltaVKmS, mission.totalDeltaVKmS, mission.transferDurationSeconds]) {
      assert.ok(Number.isFinite(value) && value > 0, `expected positive finite output, got ${value}`);
    }
  }
  assert.throws(() => createLunarTransfer({ parkingAltitudeKm: 0 }), /finite positive/);
  assert.throws(() => createLunarTransfer({ captureAltitudeKm: 10001 }), /at most 10,000/);
  assert.throws(() => solveKepler(1, 1), /\[0, 1\)/);
  assert.throws(() => visVivaSpeed(EARTH.mu, 100, 10), /outside the orbit/);
});
