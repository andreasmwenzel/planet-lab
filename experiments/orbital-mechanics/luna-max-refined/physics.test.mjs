import test from "node:test";
import assert from "node:assert/strict";
import { BODY_DATA, makeOrbit, propagateAtTime, solveKepler, visVivaSpeed } from "./mechanics.js";

const closeTo = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, label + ": expected " + expected + " ± " + tolerance + ", got " + actual);
};

test("circular Earth orbit has zero eccentricity and consistent speed, energy, and period", () => {
  const orbit = makeOrbit("earth", 400, 400);
  const state = propagateAtTime(orbit, 0);
  closeTo(orbit.e, 0, 1e-15, "eccentricity");
  closeTo(state.radiusKm, orbit.rpKm, 1e-9, "circular radius");
  closeTo(state.speedKmSec, visVivaSpeed(orbit.body.muKm3s2, state.radiusKm, orbit.aKm), 1e-12, "vis-viva speed");
  closeTo(orbit.periodSec, 2 * Math.PI * Math.sqrt(orbit.aKm ** 3 / orbit.body.muKm3s2), 1e-9, "period");
  closeTo(orbit.specificEnergyKm2s2, -(state.speedKmSec ** 2) / 2, 1e-11, "specific orbital energy");
  assert.ok(orbit.periodSec > 5500 && orbit.periodSec < 5600, "LEO period expected near 5,550 s; got " + orbit.periodSec);
});

test("elliptic Earth transfer reaches both apsides with vis-viva speed", () => {
  const orbit = makeOrbit("earth", 250, 35786);
  const peri = propagateAtTime(orbit, 0);
  const apo = propagateAtTime(orbit, orbit.periodSec / 2);
  closeTo(orbit.e, (orbit.raKm - orbit.rpKm) / (orbit.raKm + orbit.rpKm), 1e-14, "eccentricity");
  closeTo(peri.radiusKm, orbit.rpKm, 1e-8, "periapsis radius");
  closeTo(apo.radiusKm, orbit.raKm, 1e-7, "apoapsis radius");
  closeTo(peri.speedKmSec, visVivaSpeed(orbit.body.muKm3s2, orbit.rpKm, orbit.aKm), 1e-11, "periapsis vis-viva");
  closeTo(apo.speedKmSec, visVivaSpeed(orbit.body.muKm3s2, orbit.raKm, orbit.aKm), 1e-11, "apoapsis vis-viva");
  closeTo(peri.radialVelocityKmSec, 0, 1e-12, "periapsis radial velocity");
  closeTo(apo.radialVelocityKmSec, 0, 1e-12, "apoapsis radial velocity");
});

test("propagating one full orbital period closes the perifocal state", () => {
  const orbit = makeOrbit("mars", 300, 100000);
  const start = propagateAtTime(orbit, 19321);
  const end = propagateAtTime(orbit, 19321 + orbit.periodSec);
  closeTo(end.xKm, start.xKm, 1e-7, "periodic x position");
  closeTo(end.yKm, start.yKm, 1e-7, "periodic y position");
  closeTo(end.vxKmSec, start.vxKmSec, 1e-10, "periodic x velocity");
  closeTo(end.vyKmSec, start.vyKmSec, 1e-10, "periodic y velocity");
});

test("Kepler solver meets its residual tolerance for a high-eccentricity ellipse", () => {
  const e = 0.98;
  const M = 2.4;
  const E = solveKepler(M, e);
  closeTo(E - e * Math.sin(E), M, 1e-12, "Kepler equation residual");
});

test("Kepler solver remains accurate near periapsis at the Moon UI eccentricity limit", () => {
  const orbit = makeOrbit("moon", 100, 200000);
  assert.ok(orbit.e < 0.983, "test orbit should match the highest-e UI range");
  for (const M of [1e-6, 1e-5, 0.01, 0.1, 1, 3, 6.2]) {
    const E = solveKepler(M, orbit.e);
    closeTo(E - orbit.e * Math.sin(E), M, 1e-12, "Kepler residual at M=" + M);
  }
});

test("specific angular momentum and energy are invariant around a transfer orbit", () => {
  const orbit = makeOrbit("earth", 250, 35786);
  for (const time of [0, orbit.periodSec * 0.13, orbit.periodSec * 0.37, orbit.periodSec * 0.72]) {
    const point = propagateAtTime(orbit, time);
    const h = point.xKm * point.vyKmSec - point.yKm * point.vxKmSec;
    const energy = point.speedKmSec ** 2 / 2 - orbit.body.muKm3s2 / point.radiusKm;
    closeTo(h, orbit.specificAngularMomentumKm2s, 2e-8, "specific angular momentum at t=" + time);
    closeTo(energy, orbit.specificEnergyKm2s2, 2e-11, "specific energy at t=" + time);
  }
});

test("body constants and invalid orbit guardrails are explicit", () => {
  assert.ok(BODY_DATA.earth.muKm3s2 > BODY_DATA.mars.muKm3s2);
  assert.ok(BODY_DATA.mars.muKm3s2 > BODY_DATA.moon.muKm3s2);
  assert.throws(() => makeOrbit("pluto", 100, 200), /Unknown central body/);
  assert.throws(() => makeOrbit("earth", 300, 200), /no lower than periapsis/);
  assert.throws(() => solveKepler(1, 1), /in \[0, 1\)/);
});
