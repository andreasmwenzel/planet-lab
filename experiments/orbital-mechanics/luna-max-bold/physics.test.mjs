import test from "node:test";
import assert from "node:assert/strict";
import {
  EARTH_MU_KM3_S2,
  SAFE_MISS_KM,
  applyLocalBurn,
  centralAcceleration,
  circularState,
  createIncidents,
  propagateTrajectory,
  searchSafeBurn,
  simulateIncident,
  specificAngularMomentum,
  specificEnergy,
} from "./main.js";

const closeTo = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, received ${actual}`);
};

test("central acceleration uses Earth point-mass mu and inverse-square gravity", () => {
  const r = 7000;
  const actual = centralAcceleration([r, 0]);
  closeTo(actual[0], -EARTH_MU_KM3_S2 / (r * r), 1e-12, "radial acceleration km/s²");
  closeTo(actual[1], 0, 1e-15, "cross-track acceleration km/s²");
});

test("circular orbit conserves specific energy and angular momentum over two revolutions", () => {
  const radius = 7000;
  const initial = circularState(radius);
  const period = 2 * Math.PI * Math.sqrt(radius ** 3 / EARTH_MU_KM3_S2);
  const end = propagateTrajectory(initial, 2 * period, 10).at(-1);
  const energyRelativeError = Math.abs((specificEnergy(end) - specificEnergy(initial)) / specificEnergy(initial));
  const angularMomentumRelativeError = Math.abs((specificAngularMomentum(end) - specificAngularMomentum(initial)) / specificAngularMomentum(initial));
  const closureKm = Math.hypot(end.positionKm[0] - initial.positionKm[0], end.positionKm[1] - initial.positionKm[1]);
  assert.ok(energyRelativeError < 1e-9, `relative specific-energy drift ${energyRelativeError} must be < 1e-9`);
  assert.ok(angularMomentumRelativeError < 1e-9, `relative angular-momentum drift ${angularMomentumRelativeError} must be < 1e-9`);
  assert.ok(closureKm < 0.01, `two-orbit position closure ${closureKm} km must be < 0.01 km`);
});

test("a 3-4 m/s local impulse is resolved in radial and prograde axes", () => {
  const initial = circularState(7000, 0.73);
  const after = applyLocalBurn(initial, { radialMps: 3, tangentialMps: 4 });
  const dv = [after.velocityKmS[0] - initial.velocityKmS[0], after.velocityKmS[1] - initial.velocityKmS[1]];
  closeTo(Math.hypot(...dv), 0.005, 1e-12, "burn magnitude km/s");
  const radial = [Math.cos(0.73), Math.sin(0.73)];
  const tangent = [-radial[1], radial[0]];
  closeTo(dv[0] * radial[0] + dv[1] * radial[1], 0.003, 1e-12, "radial component km/s");
  closeTo(dv[0] * tangent[0] + dv[1] * tangent[1], 0.004, 1e-12, "prograde component km/s");
});

test("all three synthetic incidents produce the seeded close pass in the two-body model", () => {
  const incidents = createIncidents();
  const expectedLeadSeconds = [8640, 13680, 5580];
  const results = incidents.map((incident) => simulateIncident(incident, {}, 5.5, { collect: false }).closest);
  const ceilingsKm = [0.5, 1, 2];
  results.forEach((result, index) => {
    assert.ok(result.distanceKm < ceilingsKm[index], `${incidents[index].id}: miss ${result.distanceKm} km exceeds ${ceilingsKm[index]} km`);
    assert.ok(Math.abs(result.timeSeconds - expectedLeadSeconds[index]) < 120,
      `${incidents[index].id}: closest pass at ${result.timeSeconds}s differs by ≥120s from seeded epoch`);
  });
});

test("bounded burn sweep returns a verified 5 km clearance for EV-17", () => {
  const proposal = searchSafeBurn(createIncidents()[0], 5.5);
  assert.equal(proposal.checked, 441, "21 × 21 impulse grid evaluated");
  assert.equal(proposal.safe, true);
  assert.ok(proposal.closest.distanceKm >= SAFE_MISS_KM,
    `proposal predicts ${proposal.closest.distanceKm} km; threshold is ${SAFE_MISS_KM} km`);
  closeTo(Math.hypot(proposal.burn.radialMps, proposal.burn.tangentialMps), Math.sqrt(0.08), 1e-12, "selected grid Δv magnitude m/s");
  closeTo(proposal.closest.distanceKm, 5.175097388445873, 1e-8, "selected vector miss distance km");
});
