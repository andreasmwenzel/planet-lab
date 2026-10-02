import { BODY_DATA, makeOrbit, propagateAtTime, visVivaSpeed } from "./mechanics.js";

const $ = (id) => document.getElementById(id);
const canvas = $("orbitCanvas");
const ctx = canvas.getContext("2d");
const elements = {
  body: $("bodySelect"), bodyGlyph: $("bodyGlyph"), bodyMu: $("bodyMu"), bodyRadius: $("bodyRadius"),
  peri: $("periInput"), apo: $("apoInput"), periValue: $("periValue"), apoValue: $("apoValue"),
  apoMin: $("apoMin"), speed: $("speedInput"), speedValue: $("speedValue"),
  play: $("playButton"), playIcon: $("playIcon"), playLabel: $("playLabel"),
  clock: $("clockDisplay"), stageTitle: $("stageTitle"), scale: $("scaleDisplay"),
  apoPlot: $("apoPlot"), periPlot: $("periPlot"), bodyLegend: $("bodyLegend"),
  speedReadout: $("speedReadout"), altitude: $("altitudeReadout"), radius: $("radiusReadout"),
  semiMajor: $("semiMajorReadout"), eccentricity: $("eccReadout"), p: $("pReadout"),
  period: $("periodReadout"), anomaly: $("anomalyReadout"), radial: $("radialReadout"),
  energy: $("energyReadout")
};
const presets = {
  circular: { peri: 400, apo: 400, label: "Near circular" },
  transfer: { peri: 250, apo: 35786, label: "Transfer profile" },
  wide: { peri: 300, apo: 100000, label: "Wide ellipse" }
};
const state = { bodyKey: "earth", peri: 400, apo: 400, elapsedSec: 0, speed: 120, playing: true, preset: "circular", lastFrame: 0 };
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fmtKm = (n) => fmt.format(n) + " km";
const fmtPeriod = (seconds) => {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return hours + "h " + String(minutes).padStart(2, "0") + "m";
  return minutes + "m " + String(secs).padStart(2, "0") + "s";
};
const fmtClock = (seconds) => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
};
const orbitNow = () => makeOrbit(state.bodyKey, state.peri, state.apo);
const shortAngle = (radians) => (radians * 180 / Math.PI).toFixed(1) + "°";

function currentPreset() {
  for (const [key, item] of Object.entries(presets)) {
    if (Math.abs(item.peri - state.peri) < 1 && Math.abs(item.apo - state.apo) < 1) return key;
  }
  return null;
}

function syncControls() {
  elements.peri.value = String(state.peri);
  elements.apo.value = String(state.apo);
  elements.apo.min = String(state.peri);
  elements.apoMin.textContent = fmt.format(state.peri);
  elements.periValue.textContent = fmtKm(state.peri);
  elements.apoValue.textContent = fmtKm(state.apo);
  elements.speed.value = String(state.speed);
  elements.speedValue.textContent = state.speed + "×";
  state.preset = currentPreset();
  document.querySelectorAll(".preset").forEach((button) => {
    const selected = button.dataset.preset === state.preset;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function updateReadouts(orbit, point) {
  const body = orbit.body;
  const speedFromVisViva = visVivaSpeed(body.muKm3s2, point.radiusKm, orbit.aKm);
  elements.bodyGlyph.textContent = body.symbol;
  elements.bodyMu.textContent = "μ " + fmt.format(body.muKm3s2) + " km³/s²";
  elements.bodyRadius.textContent = "R " + fmt.format(body.radiusKm) + " km";
  elements.stageTitle.textContent = body.name + " · " + (state.preset ? presets[state.preset].label : "Custom orbit");
  elements.bodyLegend.textContent = body.name.toUpperCase();
  elements.apoPlot.textContent = fmtKm(state.apo);
  elements.periPlot.textContent = fmtKm(state.peri);
  elements.speedReadout.textContent = speedFromVisViva.toFixed(2);
  elements.altitude.textContent = fmtKm(point.altitudeKm);
  elements.radius.textContent = fmtKm(point.radiusKm);
  elements.semiMajor.textContent = fmtKm(orbit.aKm);
  elements.eccentricity.textContent = orbit.e.toFixed(4);
  elements.p.textContent = fmtKm(orbit.pKm);
  elements.period.textContent = fmtPeriod(orbit.periodSec);
  elements.anomaly.textContent = shortAngle(point.trueAnomalyRad);
  elements.radial.textContent = point.radialVelocityKmSec.toFixed(2) + " km/s";
  const energy = orbit.specificEnergyKm2s2;
  elements.energy.textContent = (energy < 0 ? "−" : "") + Math.abs(energy).toFixed(2) + " km²/s²";
  elements.clock.textContent = fmtClock(state.elapsedSec);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function drawArrow(x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 8 * Math.cos(angle - Math.PI / 6), y2 - 8 * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - 8 * Math.cos(angle + Math.PI / 6), y2 - 8 * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function draw() {
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);
  const orbit = orbitNow();
  const point = propagateAtTime(orbit, state.elapsedSec);
  updateReadouts(orbit, point);
  const centerX = width * 0.5;
  const centerY = height * 0.53;
  const scale = (Math.min(width, height) * 0.405) / orbit.raKm;
  const screenRadius = (km) => km * scale;
  elements.scale.textContent = (1 / scale).toFixed(0) + " km / px";
  const maxRadiusPx = Math.min(width, height) * 0.405;

  ctx.save();
  ctx.strokeStyle = "rgba(126, 159, 188, 0.095)";
  ctx.lineWidth = 1;
  for (const fraction of [0.25, 0.5, 0.75, 1]) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadiusPx * fraction, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([3, 7]);
  ctx.strokeStyle = "rgba(126, 159, 188, 0.13)";
  ctx.beginPath(); ctx.moveTo(24, centerY); ctx.lineTo(width - 24, centerY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(centerX, 24); ctx.lineTo(centerX, height - 24); ctx.stroke();
  ctx.restore();

  const pathSteps = 360;
  ctx.beginPath();
  for (let index = 0; index <= pathSteps; index += 1) {
    const anomaly = index / pathSteps * Math.PI * 2;
    const radius = orbit.pKm / (1 + orbit.e * Math.cos(anomaly));
    const x = centerX + radius * Math.cos(anomaly) * scale;
    const y = centerY - radius * Math.sin(anomaly) * scale;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = "rgba(62, 215, 194, 0.88)";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(44, 206, 189, 0.23)";
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(31, 182, 166, 0.032)";
  ctx.fill();

  const apoX = centerX - screenRadius(orbit.raKm);
  const periX = centerX + screenRadius(orbit.rpKm);
  ctx.strokeStyle = "rgba(190, 207, 224, 0.22)";
  ctx.setLineDash([2, 5]);
  ctx.beginPath(); ctx.moveTo(apoX, centerY); ctx.lineTo(periX, centerY); ctx.stroke(); ctx.setLineDash([]);
  for (const [x, color] of [[apoX, "#d4a5ff"], [periX, "#71e3ce"]]) {
    ctx.beginPath(); ctx.arc(x, centerY, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }

  const bodyRadius = Math.max(7, screenRadius(orbit.body.radiusKm));
  const glow = ctx.createRadialGradient(centerX, centerY, bodyRadius * 0.7, centerX, centerY, bodyRadius * 2.8);
  glow.addColorStop(0, orbit.body.color + "4b");
  glow.addColorStop(1, orbit.body.color + "00");
  ctx.beginPath(); ctx.arc(centerX, centerY, bodyRadius * 2.8, 0, Math.PI * 2);
  ctx.fillStyle = glow; ctx.fill();
  const bodyGradient = ctx.createRadialGradient(centerX - bodyRadius * 0.35, centerY - bodyRadius * 0.4, 0, centerX, centerY, bodyRadius);
  bodyGradient.addColorStop(0, "#e9f7f5");
  bodyGradient.addColorStop(0.34, orbit.body.color);
  bodyGradient.addColorStop(1, "#23384a");
  ctx.beginPath(); ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
  ctx.fillStyle = bodyGradient; ctx.fill();
  ctx.strokeStyle = "rgba(221, 241, 246, 0.42)"; ctx.lineWidth = 1; ctx.stroke();

  const craftX = centerX + point.xKm * scale;
  const craftY = centerY - point.yKm * scale;
  ctx.strokeStyle = "rgba(208, 222, 237, 0.3)";
  ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(craftX, craftY); ctx.stroke(); ctx.setLineDash([]);
  const velLength = Math.max(35, Math.min(68, Math.min(width, height) * 0.115));
  const velocityMagnitude = Math.hypot(point.vxKmSec, point.vyKmSec) || 1;
  drawArrow(craftX, craftY, craftX + point.vxKmSec / velocityMagnitude * velLength, craftY - point.vyKmSec / velocityMagnitude * velLength, "#f2c78b");
  ctx.save();
  ctx.shadowBlur = 12; ctx.shadowColor = "rgba(255, 255, 255, 0.65)";
  ctx.translate(craftX, craftY); ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = "#fff9eb";
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();
  ctx.beginPath(); ctx.arc(craftX, craftY, 9, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(242, 199, 139, 0.45)"; ctx.lineWidth = 1; ctx.stroke();
}

function setPlaying(playing) {
  state.playing = playing;
  elements.play.setAttribute("aria-label", playing ? "Pause simulation" : "Play simulation");
  elements.playIcon.textContent = playing ? "Ⅱ" : "▶";
  elements.playLabel.textContent = playing ? "Pause" : "Play";
}

function animate(timestamp) {
  const delta = state.lastFrame ? Math.min((timestamp - state.lastFrame) / 1000, 0.1) : 0;
  state.lastFrame = timestamp;
  if (state.playing && delta > 0) state.elapsedSec += delta * state.speed;
  draw();
  requestAnimationFrame(animate);
}

elements.peri.addEventListener("input", () => {
  state.peri = Number(elements.peri.value);
  if (state.apo < state.peri) state.apo = Math.min(200000, state.peri);
  syncControls(); draw();
});
elements.apo.addEventListener("input", () => {
  state.apo = Math.max(state.peri, Number(elements.apo.value));
  syncControls(); draw();
});
elements.body.addEventListener("change", () => { state.bodyKey = elements.body.value; draw(); });
elements.speed.addEventListener("input", () => { state.speed = Number(elements.speed.value); syncControls(); });
elements.play.addEventListener("click", () => setPlaying(!state.playing));
$("resetButton").addEventListener("click", () => { state.elapsedSec = 0; draw(); });
$("backButton").addEventListener("click", () => { state.elapsedSec = Math.max(0, state.elapsedSec - 60); draw(); });
$("forwardButton").addEventListener("click", () => { state.elapsedSec += 60; draw(); });
document.querySelectorAll(".preset").forEach((button) => button.addEventListener("click", () => {
  const chosen = presets[button.dataset.preset];
  if (!chosen) return;
  state.peri = chosen.peri; state.apo = chosen.apo; state.elapsedSec = 0;
  syncControls(); draw();
}));
window.addEventListener("resize", resizeCanvas);
if ("ResizeObserver" in window) new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
syncControls();
resizeCanvas();
requestAnimationFrame(animate);
