import "./style.css";
import {
  EARTH,
  applyImpulse,
  circularSpeed,
  createCircularOrbit,
  escapeSpeed,
  hohmannTransferDeltaV,
  impulseForPeriapsis,
  orbitalElements,
  sampleConic,
  specificEnergy,
  velocityVerletStep,
} from "./physics.js";

const STEP_SECONDS = 5;
const TRAIL_SECONDS = 60;
const GEO_ALTITUDE_KM = 35_786;
const SURFACE_BUFFER_M = 50_000;

const $ = (selector) => document.querySelector(selector);
const canvas = $("#orbitCanvas");
const context = canvas.getContext("2d", { alpha: false });
const altitudeInput = $("#orbitAltitude");
const deltaVInput = $("#deltaV");
const angleInput = $("#burnAngle");
const scaleInput = $("#timeScale");

const ui = {
  altitudeValue: $("#altitudeValue"),
  deltaVValue: $("#deltaVValue"),
  angleValue: $("#burnAngleValue"),
  apogee: $("#apogeeValue"),
  perigee: $("#perigeeValue"),
  speed: $("#speedValue"),
  eccentricity: $("#eccentricityValue"),
  energy: $("#energyValue"),
  period: $("#periodValue"),
  position: $("#positionValue"),
  altitude: $("#altitudeReadout"),
  clock: $("#clockReadout"),
  mode: $("#modeLabel"),
  outcome: $("#outcomeText"),
  note: $("#trajectoryNote"),
  playButton: $("#playButton"),
  stepButton: $("#stepButton"),
  playIcon: $("#playIcon"),
  playText: $("#playText"),
  customBadge: $("#customBadge"),
  impactBanner: $("#impactBanner"),
};

let state;
let elements;
let conicPoints = [];
let orbitExtent = 0;
let trail = [];
let trailElapsed = 0;
let selectedPreset = "circular";
let playing = false;
let impacted = false;
let accumulator = 0;
let lastFrame = null;
let rafId = 0;

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const signedFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, signDisplay: "always" });

function formatDistance(km, digits = 0) {
  if (!Number.isFinite(km)) return "—";
  const abs = Math.abs(km);
  const value = abs >= 10_000 ? numberFormat.format(Math.round(km)) : km.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
  return `${value} km`;
}

function formatAltitude(km, digits = 0) {
  if (km < 0) return `${formatDistance(Math.abs(km), digits)} below surface`;
  return formatDistance(km, digits);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;
  if (days) return `${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes >= 1) return `${minutes} min`;
  return `${secs} sec`;
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;
  return days
    ? `T+ ${days}d ${String(hours).padStart(2, "0")}h`
    : `T+ ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function activeValues() {
  return {
    altitudeKm: Number(altitudeInput.value),
    deltaV: Number(deltaVInput.value),
    angleDeg: Number(angleInput.value),
  };
}

function refreshRangeLabels() {
  const { altitudeKm, deltaV, angleDeg } = activeValues();
  ui.altitudeValue.value = `${numberFormat.format(altitudeKm)} km`;
  ui.deltaVValue.value = deltaV === 0
    ? "0 m/s"
    : `${signedFormat.format(deltaV)} m/s · ${deltaV < 0 ? "retrograde" : "prograde"}`;
  ui.angleValue.value = angleDeg === 0
    ? "0° · prograde"
    : `${signedFormat.format(angleDeg)}° · ${angleDeg < 0 ? "inward" : "outward"}`;
}

function presetImpulse(preset, altitudeKm) {
  const radius = EARTH.radius + altitudeKm * 1000;
  const baseSpeed = circularSpeed(radius);
  if (preset === "geo") {
    return hohmannTransferDeltaV(radius, EARTH.radius + GEO_ALTITUDE_KM * 1000).departure;
  }
  if (preset === "escape") {
    return escapeSpeed(radius) - baseSpeed + 25;
  }
  if (preset === "reentry") {
    return impulseForPeriapsis(radius, EARTH.radius - SURFACE_BUFFER_M);
  }
  return 0;
}

function setPreset(preset) {
  const altitudeKm = Number(altitudeInput.value);
  const impulse = presetImpulse(preset, altitudeKm);
  altitudeInput.value = String(altitudeKm);
  deltaVInput.value = String(Math.round(impulse / 10) * 10);
  angleInput.value = "0";
  selectedPreset = preset;
  document.querySelectorAll("[data-preset]").forEach((button) => {
    const active = button.dataset.preset === preset;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  ui.customBadge.hidden = true;
  rebuildSimulation();
}

function markCustom() {
  selectedPreset = "custom";
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.classList.remove("selected");
    button.setAttribute("aria-pressed", "false");
  });
  ui.customBadge.hidden = false;
}

function viewRadiusFor(elementsNow, initialRadius) {
  if (elementsNow.bound && elementsNow.apoapsis) {
    return Math.min(Math.max(elementsNow.apoapsis * 1.08, EARTH.radius * 2.1), 100_000_000);
  }
  return Math.max(EARTH.radius * 2.1, Math.min(80_000_000, Math.max(30_000_000, initialRadius * 4.5)));
}

function rebuildSimulation() {
  pause();
  refreshRangeLabels();
  const { altitudeKm, deltaV, angleDeg } = activeValues();
  const circular = createCircularOrbit(altitudeKm);
  state = applyImpulse(circular, deltaV, angleDeg);
  elements = orbitalElements(state);
  impacted = false;
  accumulator = 0;
  trailElapsed = 0;
  trail = [{ x: state.x, y: state.y }];
  orbitExtent = viewRadiusFor(elements, Math.hypot(state.x, state.y));
  conicPoints = sampleConic(state, orbitExtent, 640);
  ui.impactBanner.hidden = true;
  ui.playButton.disabled = false;
  ui.stepButton.disabled = false;
  updateTelemetry();
  drawScene();
}

function pause() {
  playing = false;
  ui.playButton.setAttribute("aria-pressed", "false");
  ui.playIcon.textContent = "▶";
  ui.playText.textContent = "Play mission";
}

function togglePlayback() {
  if (playing) {
    pause();
    return;
  }
  if (impacted) return;
  playing = true;
  lastFrame = null;
  ui.playButton.setAttribute("aria-pressed", "true");
  ui.playIcon.textContent = "Ⅱ";
  ui.playText.textContent = "Pause mission";
}

function stopForImpact() {
  impacted = true;
  pause();
  ui.playButton.disabled = true;
  ui.stepButton.disabled = true;
  ui.impactBanner.hidden = false;
  ui.note.textContent = "The spacecraft crossed the spherical Earth surface. Adjust the burn to keep periapsis clear, or choose another starting point.";
}

function advanceSimulation(seconds) {
  let remaining = seconds;
  while (remaining > 1e-9 && !impacted) {
    const dt = Math.min(STEP_SECONDS, remaining);
    state = velocityVerletStep(state, dt);
    remaining -= dt;
    trailElapsed += dt;
    if (trailElapsed >= TRAIL_SECONDS || remaining <= 1e-9) {
      trail.push({ x: state.x, y: state.y });
      trailElapsed %= TRAIL_SECONDS;
    }
    if (Math.hypot(state.x, state.y) <= EARTH.radius) {
      stopForImpact();
    }
  }
}

function toggleOrStepFiveMinutes() {
  if (playing) pause();
  if (impacted) return;
  advanceSimulation(300);
  updateTelemetry();
  drawScene();
}

function makeOutcomeText(el) {
  if (impacted) return "Earth intercept. The flown trail ends at the spherical impact boundary.";
  if (!el.bound) return "Unbound path: the burn has put the spacecraft above local escape speed.";
  const periAltitude = (el.periapsis - EARTH.radius) / 1000;
  const apoAltitude = (el.apoapsis - EARTH.radius) / 1000;
  if (periAltitude <= 0) return `Surface-crossing ellipse. Perigee is ${formatAltitude(periAltitude, 0)}; impact occurs if flown.`;
  if (Math.abs(el.eccentricity) < 0.001) return "Near-circular orbit: the spacecraft returns to about the same altitude each lap.";
  if (selectedPreset === "geo") return `Transfer ellipse: apogee reaches ${formatAltitude(apoAltitude)}; a second burn would be needed to circularize.`;
  if (el.periapsis <= EARTH.radius + 160_000) return `Low perigee at ${formatAltitude(periAltitude)}. This simple model has no atmosphere, so it cannot predict drag or heating.`;
  return `Bound ellipse from ${formatAltitude(periAltitude)} to ${formatAltitude(apoAltitude)}. The path repeats after ${formatDuration(el.period)}.`;
}

function updateTelemetry() {
  elements = orbitalElements(state);
  const currentAltitudeKm = (elements.radius - EARTH.radius) / 1000;
  const periAltitudeKm = (elements.periapsis - EARTH.radius) / 1000;
  const apoAltitudeKm = elements.apoapsis == null ? null : (elements.apoapsis - EARTH.radius) / 1000;
  ui.altitude.textContent = formatAltitude(currentAltitudeKm);
  ui.clock.textContent = formatClock(state.t ?? 0);
  ui.apogee.textContent = apoAltitudeKm == null ? "Open path" : formatAltitude(apoAltitudeKm);
  ui.perigee.textContent = formatAltitude(periAltitudeKm);
  ui.speed.textContent = `${(elements.speed / 1000).toFixed(2)} km/s`;
  ui.eccentricity.textContent = elements.eccentricity.toFixed(3);
  ui.energy.textContent = `${specificEnergy(state) / 1e6 < 0 ? "−" : "+"}${Math.abs(specificEnergy(state) / 1e6).toFixed(2)} MJ/kg`;
  ui.period.textContent = elements.period == null ? "No closed period" : formatDuration(elements.period);
  const x = state.x / 1000;
  const y = state.y / 1000;
  ui.position.textContent = `x ${x < 0 ? "−" : "+"}${numberFormat.format(Math.abs(x))} km · y ${y < 0 ? "−" : "+"}${numberFormat.format(Math.abs(y))} km`;
  ui.mode.textContent = impacted ? "EARTH INTERCEPT" : (elements.bound ? "ELLIPTIC ORBIT" : "ESCAPE TRAJECTORY");
  ui.outcome.textContent = makeOutcomeText(elements);
  if (!impacted) {
    ui.note.textContent = selectedPreset === "geo"
      ? "This is the first Hohmann-transfer burn. Circularizing at GEO requires a second burn at apogee."
      : "The dashed curve is the predicted conic. Change one control at a time, then play to trace the flown path.";
  }
}

function updateCanvasSize() {
  if (!context) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawScene();
}

function drawScene() {
  if (!context || !state || !elements) return;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (!width || !height) return;
  const ctx = context;
  ctx.clearRect(0, 0, width, height);
  const background = ctx.createLinearGradient(0, 0, width * 0.8, height);
  background.addColorStop(0, "#09141e");
  background.addColorStop(1, "#0b1722");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 108; i += 1) {
    const px = ((i * 137.508 + (i % 7) * 19.3) % 1000) / 1000 * width;
    const py = ((i * 241.117 + (i % 11) * 7.1) % 1000) / 1000 * height;
    const alpha = 0.12 + ((i * 17) % 10) / 100;
    ctx.fillStyle = `rgba(185, 214, 218, ${alpha})`;
    ctx.fillRect(px, py, i % 9 === 0 ? 1.5 : 1, i % 9 === 0 ? 1.5 : 1);
  }

  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const currentRadius = Math.hypot(state.x, state.y);
  const extent = Math.max(orbitExtent, currentRadius * 1.1);
  const scale = Math.min(width, height) * 0.455 / extent;
  const screenPoint = (point) => ({ x: centerX + point.x * scale, y: centerY - point.y * scale });
  const earthPx = EARTH.radius * scale;

  // A few light reference rings keep the scale legible without implying extra bodies.
  ctx.save();
  ctx.strokeStyle = "rgba(126, 168, 178, .13)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 6]);
  for (const multiple of [1, 2, 4]) {
    const radius = EARTH.radius * multiple * scale;
    if (radius < Math.min(width, height) * 0.48) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(126, 168, 178, .09)";
  ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(width, centerY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height); ctx.stroke();
  ctx.restore();

  if (conicPoints.length > 1) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = elements.bound ? "rgba(100, 219, 188, .76)" : "rgba(100, 219, 188, .72)";
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    let penUp = true;
    for (const point of conicPoints) {
      if (!point) { penUp = true; continue; }
      const screen = screenPoint(point);
      if (penUp) { ctx.moveTo(screen.x, screen.y); penUp = false; }
      else ctx.lineTo(screen.x, screen.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  if (trail.length > 1) {
    ctx.save();
    ctx.beginPath();
    trail.forEach((point, index) => {
      const screen = screenPoint(point);
      if (index === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    });
    ctx.strokeStyle = "rgba(245, 189, 119, .93)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(245, 189, 119, .25)";
    ctx.shadowBlur = 7;
    ctx.stroke();
    ctx.restore();
  }

  // Draw Earth over the orbit line so the spherical impact boundary reads clearly.
  ctx.save();
  ctx.shadowColor = "rgba(61, 160, 213, .32)";
  ctx.shadowBlur = Math.max(8, earthPx * 0.22);
  const earthGradient = ctx.createRadialGradient(
    centerX - earthPx * 0.3,
    centerY - earthPx * 0.37,
    Math.max(1, earthPx * 0.05),
    centerX + earthPx * 0.15,
    centerY + earthPx * 0.12,
    earthPx * 1.25,
  );
  earthGradient.addColorStop(0, "#67bed6");
  earthGradient.addColorStop(0.32, "#3389b4");
  earthGradient.addColorStop(0.73, "#1d527b");
  earthGradient.addColorStop(1, "#112d4a");
  ctx.fillStyle = earthGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, earthPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(144, 217, 235, .68)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY, earthPx * 1.035, -Math.PI * 0.32, Math.PI * 1.14);
  ctx.strokeStyle = "rgba(80, 175, 213, .52)";
  ctx.lineWidth = Math.max(1, earthPx * 0.012);
  ctx.stroke();
  ctx.restore();

  const ship = screenPoint(state);
  const heading = Math.atan2(-state.vy, state.vx);
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(heading);
  ctx.shadowColor = "rgba(255, 210, 144, .8)";
  ctx.shadowBlur = 11;
  ctx.fillStyle = "#ffe3aa";
  ctx.strokeStyle = "#fff6df";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -5.1);
  ctx.lineTo(-3.3, 0);
  ctx.lineTo(-6, 5.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const earthLabelX = centerX - earthPx - 5;
  ctx.fillStyle = "rgba(159, 191, 202, .74)";
  ctx.font = "700 8px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("EARTH", earthLabelX, centerY + earthPx + 16);
}

function frame(now) {
  if (playing) {
    if (lastFrame != null) {
      const realSeconds = Math.min((now - lastFrame) / 1000, 0.12);
      accumulator += realSeconds * Number(scaleInput.value);
      let steps = 0;
      while (accumulator >= STEP_SECONDS && steps < 1200 && !impacted) {
        advanceSimulation(STEP_SECONDS);
        accumulator -= STEP_SECONDS;
        steps += 1;
      }
      updateTelemetry();
      drawScene();
    }
    lastFrame = now;
  } else {
    lastFrame = null;
  }
  rafId = requestAnimationFrame(frame);
}

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => setPreset(button.dataset.preset));
});

for (const input of [altitudeInput, deltaVInput, angleInput]) {
  input.addEventListener("input", () => {
    markCustom();
    rebuildSimulation();
  });
}

ui.playButton.addEventListener("click", togglePlayback);
ui.stepButton.addEventListener("click", toggleOrStepFiveMinutes);
$("#resetButton").addEventListener("click", rebuildSimulation);
window.addEventListener("resize", updateCanvasSize);
if ("ResizeObserver" in window) new ResizeObserver(updateCanvasSize).observe(canvas);

setPreset("circular");
updateCanvasSize();
rafId = requestAnimationFrame(frame);

// Keep a reference to the animation handle for debuggers without exposing a global API.
void rafId;
