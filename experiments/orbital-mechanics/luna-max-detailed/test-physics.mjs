import test from "node:test";
import assert from "node:assert/strict";
import {
  EARTH,
  applyImpulse,
  circularSpeed,
  createCircularOrbit,
  escapeSpeed,
  hohmannTransferDeltaV,
  impulseForPeriapsis,
  orbitalElements,
  propagate,
  sampleConic,
  specificAngularMomentum,
  specificEnergy,
} from "./physics.js";

const relativeError = (actual, expected) => Math.abs(actual - expected) / Math.abs(expected);

test("circular state returns circular osculating elements at the requested altitude", () => {
  const initial = createCircularOrbit(420);
  const elements = orbitalElements(initial);
  assert.ok(Math.abs(elements.radius - (EARTH.radius + 420_000)) < 1e-8);
  assert.ok(Math.abs(elements.speed - circularSpeed(elements.radius)) < 1e-10);
  assert.ok(elements.eccentricity < 1e-12, `eccentricity ${elements.eccentricity}`);
  assert.ok(relativeError(elements.periapsis, elements.radius) < 1e-12);
  assert.ok(relativeError(elements.apoapsis, elements.radius) < 1e-12);
  assert.ok(elements.bound);
  assert.ok(elements.period > 5_000 && elements.period < 6_000);
});

test("5-second velocity-Verlet integration conserves energy/angular momentum and closes one orbit", () => {
  const initial = createCircularOrbit(420);
  const initialElements = orbitalElements(initial);
  const final = propagate(initial, initialElements.period, 5);
  const energyDrift = relativeError(specificEnergy(final), specificEnergy(initial));
  const angularMomentumDrift = relativeError(specificAngularMomentum(final), specificAngularMomentum(initial));
  const closureError = Math.hypot(final.x - initial.x, final.y - initial.y) / initialElements.radius;
  assert.ok(energyDrift < 1e-8, `relative energy drift ${energyDrift}`);
  assert.ok(angularMomentumDrift < 1e-10, `relative angular-momentum drift ${angularMomentumDrift}`);
  assert.ok(closureError < 1e-4, `one-period position closure error ${closureError}`);
});

test("Hohmann departure burn produces an ellipse from LEO to GEO radius", () => {
  const lowOrbitRadius = EARTH.radius + 420_000;
  const geoRadius = EARTH.radius + 35_786_000;
  const burn = hohmannTransferDeltaV(lowOrbitRadius, geoRadius);
  const transfer = applyImpulse(createCircularOrbit(420), burn.departure, 0);
  const elements = orbitalElements(transfer);
  assert.ok(relativeError(burn.departure, 2_394) < 0.01, `departure ${burn.departure} m/s`);
  assert.ok(relativeError(elements.periapsis, lowOrbitRadius) < 1e-10);
  assert.ok(relativeError(elements.apoapsis, geoRadius) < 1e-9);
  assert.ok(elements.bound);
  assert.ok(burn.arrival > 1_400 && burn.arrival < 1_600);
});

test("Hohmann transfer reaches GEO radius after half an osculating period", () => {
  const lowOrbitRadius = EARTH.radius + 420_000;
  const geoRadius = EARTH.radius + 35_786_000;
  const burn = hohmannTransferDeltaV(lowOrbitRadius, geoRadius);
  const transfer = applyImpulse(createCircularOrbit(420), burn.departure, 0);
  const elements = orbitalElements(transfer);
  const arrival = propagate(transfer, elements.period / 2, 5);
  assert.ok(relativeError(Math.hypot(arrival.x, arrival.y), geoRadius) < 5e-5);
});

test("local escape threshold is parabolic and a 10 m/s margin is unbound", () => {
  const radius = EARTH.radius + 420_000;
  const initial = createCircularOrbit(420);
  const exactImpulse = escapeSpeed(radius) - circularSpeed(radius);
  const threshold = applyImpulse(initial, exactImpulse, 0);
  const margin = applyImpulse(initial, exactImpulse + 10, 0);
  assert.ok(Math.abs(specificEnergy(threshold)) < 1e-6, `threshold energy ${specificEnergy(threshold)} J/kg`);
  assert.equal(orbitalElements(threshold).bound, false);
  assert.ok(specificEnergy(margin) > 0);
  assert.equal(orbitalElements(margin).bound, false);
  assert.equal(orbitalElements(margin).apoapsis, null);
});

test("retrograde reentry impulse places the osculating perigee at the requested radius", () => {
  const altitudeKm = 420;
  const currentRadius = EARTH.radius + altitudeKm * 1000;
  const targetPeriapsis = EARTH.radius - 50_000;
  const deltaV = impulseForPeriapsis(currentRadius, targetPeriapsis);
  assert.ok(deltaV < 0 && deltaV > -300, `retrograde delta-v ${deltaV} m/s`);
  const state = applyImpulse(createCircularOrbit(altitudeKm), deltaV, 0);
  const elements = orbitalElements(state);
  assert.ok(relativeError(elements.periapsis, targetPeriapsis) < 1e-10);
  assert.ok(elements.apoapsis > currentRadius * 0.999);
  assert.ok(elements.bound);
});

test("aim angle and signed impulse use the local radial/transverse frame", () => {
  const circular = createCircularOrbit(420);
  const outward = applyImpulse(circular, 100, 90);
  const inward = applyImpulse(circular, 100, -90);
  const retrograde = applyImpulse(circular, -100, 0);
  assert.ok(outward.vx > 99.999 && Math.abs(outward.vy - circular.vy) < 1e-10);
  assert.ok(inward.vx < -99.999 && Math.abs(inward.vy - circular.vy) < 1e-10);
  assert.ok(retrograde.vy < circular.vy);
});

test("conic sampler returns a finite closed loop or a finite clipped escape branch", () => {
  const circle = createCircularOrbit(420);
  const circlePath = sampleConic(circle, 20_000_000, 480);
  assert.equal(circlePath.length, 481);
  assert.ok(circlePath.every((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)));
  const escape = applyImpulse(circle, escapeSpeed(EARTH.radius + 420_000) - circularSpeed(EARTH.radius + 420_000) + 100, 0);
  const openPath = sampleConic(escape, 30_000_000, 480);
  assert.ok(openPath.length > 100);
  assert.ok(openPath.some((point) => point && point.x > 0));
  assert.ok(openPath.every((point) => point === null || (Number.isFinite(point.x) && Number.isFinite(point.y))));
});

test("near-escape bound conic preserves separate in-view segments", () => {
  const radius = EARTH.radius + 420_000;
  const circular = createCircularOrbit(420);
  const nearParabolic = applyImpulse(circular, escapeSpeed(radius) - circularSpeed(radius) - 10, 0);
  const path = sampleConic(nearParabolic, 30_000_000, 640);
  assert.ok(orbitalElements(nearParabolic).bound);
  assert.ok(path.some((point) => point === null), "clipped high-apogee arc should have pen-up markers");
  assert.ok(path.some((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)));
});
