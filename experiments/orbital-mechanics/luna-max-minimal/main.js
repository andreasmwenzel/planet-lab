import "./style.css";
import { EARTH, MOON, createLunarTransfer, moonAngleAtTransferTime, solveKepler, stateAtTransferTime } from "./physics.js";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#orbit-canvas");
const frame = $(".map-frame");
const context = canvas?.getContext("2d", { alpha: true });
const parkingInput = $("#parking-altitude");
const captureInput = $("#capture-altitude");
const timeScrubber = $("#time-scrubber");
const playButton = $("#play-button");
const playGlyph = $(".play-glyph");
const playText = $(".play-text");

const state = {
  mission: createLunarTransfer(),
  progress: 0,
  playing: false,
  lastFrame: 0,
  animationId: 0,
  playbackScale: 1,
};

function formatClock(seconds, includeMinutes = true) {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const dayText = String(days).padStart(2, "0");
  const hourText = String(hours).padStart(2, "0");
  const minuteText = String(minutes).padStart(2, "0");
  return includeMinutes ? `${dayText}d ${hourText}h ${minuteText}m` : `${dayText}d ${hourText}h`;
}

function setRangeFill(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const percentage = ((value - min) / (max - min)) * 100;
  input.style.setProperty("--range-progress", `${percentage}%`);
}

function updatePlaybackButton() {
  playButton.setAttribute("aria-label", state.playing ? "Pause transfer animation" : "Play transfer animation");
  playGlyph.textContent = state.playing ? "Ⅱ" : "▶";
  playText.textContent = state.playing ? "Pause coast" : "Play coast";
}

function stopPlayback() {
  state.playing = false;
  state.lastFrame = 0;
  if (state.animationId) cancelAnimationFrame(state.animationId);
  state.animationId = 0;
  updatePlaybackButton();
}

function updateEvent() {
  const title = $("#next-event-title");
  const subtitle = $("#next-event-subtitle");
  const arcStatus = $("#arc-status");
  if (state.progress < 0.015) {
    title.textContent = "Trans-lunar injection";
    subtitle.textContent = "Departure burn · now";
    arcStatus.textContent = "READY TO DEPART";
  } else if (state.progress >= 0.985) {
    title.textContent = "Lunar orbit insertion";
    subtitle.textContent = "Arrival geometry reached";
    arcStatus.textContent = "ARRIVAL GEOMETRY REACHED";
  } else {
    const remaining = (1 - state.progress) * state.mission.transferDurationSeconds;
    title.textContent = "Lunar orbit insertion";
    subtitle.textContent = `Arrival in ${formatClock(remaining, false)}`;
    arcStatus.textContent = `COASTING · T+${formatClock(state.progress * state.mission.transferDurationSeconds, false)}`;
  }
}

function updateReadouts() {
  const mission = state.mission;
  const elapsedSeconds = state.progress * mission.transferDurationSeconds;
  $("#parking-value").innerHTML = `${Math.round(Number(parkingInput.value)).toLocaleString()} <small>km</small>`;
  $("#capture-value").innerHTML = `${Math.round(Number(captureInput.value)).toLocaleString()} <small>km</small>`;
  $("#total-dv").textContent = mission.totalDeltaVKmS.toFixed(2);
  $("#total-dv-ms").textContent = `${Math.round(mission.totalDeltaVKmS * 1000).toLocaleString()} m/s`;
  $("#departure-dv").textContent = mission.departureDeltaVKmS.toFixed(2);
  $("#capture-dv").textContent = mission.captureDeltaVKmS.toFixed(2);
  $("#duration").textContent = formatClock(mission.transferDurationSeconds, false);
  $("#arrival-time").textContent = `T+${formatClock(mission.transferDurationSeconds, false)}`;
  $("#vinf").textContent = mission.lunarVInfinityKmS.toFixed(2);
  $("#eccentricity").textContent = mission.eccentricity.toFixed(3);
  $("#elapsed-time").textContent = formatClock(elapsedSeconds, true);
  timeScrubber.value = String(Math.round(state.progress * 1000));
  setRangeFill(timeScrubber);
  setRangeFill(parkingInput);
  setRangeFill(captureInput);
  const meter = Math.max(6, Math.min(100, (mission.totalDeltaVKmS / 6.5) * 100));
  $("#dv-meter-fill").style.width = `${meter}%`;
  updateEvent();
}

function drawStarfield(ctx, width, height) {
  for (let i = 0; i < 66; i += 1) {
    const sx = Math.abs(Math.sin(i * 127.1 + 19.7) * 43758.5453) % 1;
    const sy = Math.abs(Math.sin(i * 311.7 + 41.3) * 28911.141) % 1;
    const alpha = 0.12 + (i % 5) * 0.035;
    ctx.fillStyle = `rgba(179, 204, 223, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx * width, sy * height, i % 11 === 0 ? 1.2 : 0.65, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function drawEarth(ctx, x, y, radius) {
  const glow = ctx.createRadialGradient(x, y, radius * 0.35, x, y, radius * 2.8);
  glow.addColorStop(0, "rgba(82, 183, 231, .22)");
  glow.addColorStop(1, "rgba(53, 132, 177, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.8, 0, 2 * Math.PI);
  ctx.fill();

  const globe = ctx.createRadialGradient(x - radius * 0.36, y - radius * 0.44, radius * 0.1, x, y, radius * 1.15);
  globe.addColorStop(0, "#7ed4e4");
  globe.addColorStop(0.44, "#348ab9");
  globe.addColorStop(1, "#16466d");
  ctx.fillStyle = globe;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.94, 0, 2 * Math.PI);
  ctx.clip();
  ctx.fillStyle = "rgba(135, 193, 145, .53)";
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.73, y - radius * 0.12);
  ctx.quadraticCurveTo(x - radius * 0.45, y - radius * 0.65, x - radius * 0.1, y - radius * 0.3);
  ctx.quadraticCurveTo(x + radius * 0.14, y - radius * 0.12, x - radius * 0.02, y + radius * 0.16);
  ctx.quadraticCurveTo(x - radius * 0.2, y + radius * 0.49, x - radius * 0.43, y + radius * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + radius * 0.3, y - radius * 0.35);
  ctx.quadraticCurveTo(x + radius * 0.76, y - radius * 0.18, x + radius * 0.57, y + radius * 0.15);
  ctx.quadraticCurveTo(x + radius * 0.45, y + radius * 0.32, x + radius * 0.24, y + radius * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(173, 232, 244, .56)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, radius, -2.7, 1.9);
  ctx.stroke();
}

function drawMoon(ctx, x, y, radius) {
  const light = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.37, 0.5, x, y, radius * 1.1);
  light.addColorStop(0, "#fff1cf");
  light.addColorStop(0.55, "#d9c39e");
  light.addColorStop(1, "#887e71");
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = "rgba(87, 82, 79, .27)";
  for (const [dx, dy, r] of [[-.32, -.18, .15], [.22, .26, .11], [.36, -.29, .075]]) {
    ctx.beginPath();
    ctx.arc(x + dx * radius, y + dy * radius, r * radius, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(249, 217, 163, .8)";
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.arc(x, y, radius + 1.4, 0, 2 * Math.PI);
  ctx.stroke();
}

function drawCraft(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
  glow.addColorStop(0, "rgba(117, 225, 209, .35)");
  glow.addColorStop(1, "rgba(117, 225, 209, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = "#d5fff6";
  ctx.strokeStyle = "#59d6c2";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.1);
  ctx.lineTo(-3.2, 0);
  ctx.lineTo(-5, 4.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawArrivalMarker(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = "rgba(240, 200, 144, .52)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(240, 200, 144, .87)";
  ctx.font = "700 7px Inter, system-ui, sans-serif";
  ctx.letterSpacing = "1px";
  ctx.textAlign = "center";
  ctx.fillText("ARRIVAL", x, y + 18);
  ctx.restore();
}

function drawMap() {
  if (!canvas || !context || !frame) return;
  const bounds = frame.getBoundingClientRect();
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  const bufferWidth = Math.round(width * pixelRatio);
  const bufferHeight = Math.round(height * pixelRatio);
  if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
  }
  const ctx = context;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawStarfield(ctx, width, height);

  const cx = width * 0.5;
  const cy = height * 0.53;
  const orbitRadiusPx = Math.min(width * 0.43, height * 0.41);
  const scale = orbitRadiusPx / MOON.orbitalRadiusKm;
  const mission = state.mission;
  const aPx = mission.transferSemiMajorAxisKm * scale;
  const bPx = aPx * Math.sqrt(1 - mission.eccentricity ** 2);
  const focusOffsetPx = aPx * mission.eccentricity;
  const earthR = Math.max(9, EARTH.radiusKm * scale);
  const moonR = Math.max(5.2, MOON.radiusKm * scale);

  // The lunar path and transfer ellipse are drawn to the same geometric scale.
  ctx.strokeStyle = "rgba(167, 190, 211, .21)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.arc(cx, cy, orbitRadiusPx, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(110, 163, 183, .12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx + focusOffsetPx, cy, aPx, bPx, 0, 0, 2 * Math.PI);
  ctx.stroke();

  const t = state.progress * mission.transferDurationSeconds;
  const moonAngle = moonAngleAtTransferTime(t, mission);
  const moonNowX = cx + orbitRadiusPx * Math.cos(moonAngle);
  const moonNowY = cy - orbitRadiusPx * Math.sin(moonAngle);
  const arrivalX = cx - orbitRadiusPx;
  const arrivalY = cy;
  ctx.strokeStyle = "rgba(240, 200, 144, .27)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(arrivalX, arrivalY);
  ctx.lineTo(moonNowX, moonNowY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Full predicted coast; the brighter trace marks the elapsed segment.
  const totalPoints = 220;
  ctx.beginPath();
  for (let i = 0; i <= totalPoints; i += 1) {
    const E = Math.PI * (i / totalPoints);
    const x = cx + aPx * (Math.cos(E) - mission.eccentricity);
    const y = cy - bPx * Math.sin(E);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "rgba(117, 225, 209, .52)";
  ctx.lineWidth = 1.3;
  ctx.stroke();

  const current = stateAtTransferTime(t, mission);
  const elapsedSteps = Math.max(1, Math.round(totalPoints * state.progress));
  const trail = ctx.createLinearGradient(cx + mission.departureRadiusKm * scale, cy, cx - orbitRadiusPx, cy - bPx);
  trail.addColorStop(0, "rgba(117, 225, 209, .24)");
  trail.addColorStop(1, "rgba(156, 255, 225, .97)");
  ctx.beginPath();
  for (let i = 0; i <= elapsedSteps; i += 1) {
    const M = Math.PI * state.progress * (i / elapsedSteps);
    const E = solveKepler(M, mission.eccentricity);
    const x = cx + aPx * (Math.cos(E) - mission.eccentricity);
    const y = cy - bPx * Math.sin(E);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = trail;
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(117, 225, 209, .45)";
  ctx.shadowBlur = 7;
  ctx.stroke();
  ctx.shadowBlur = 0;

  drawArrivalMarker(ctx, arrivalX, arrivalY);
  drawEarth(ctx, cx, cy, earthR);
  drawMoon(ctx, moonNowX, moonNowY, moonR);
  const craftX = cx + current.xKm * scale;
  const craftY = cy - current.yKm * scale;
  const craftAngle = Math.atan2(-current.vyKmS, current.vxKmS);
  drawCraft(ctx, craftX, craftY, craftAngle);

  ctx.fillStyle = "rgba(225, 236, 244, .83)";
  ctx.font = "600 8px Inter, system-ui, sans-serif";
  ctx.letterSpacing = "1px";
  ctx.textAlign = "center";
  ctx.fillText("EARTH", cx, cy + earthR + 14);
  const labelX = moonNowX + (Math.cos(moonAngle) >= 0 ? 10 : -10);
  const labelY = moonNowY + (Math.sin(moonAngle) >= 0 ? 17 : -10);
  ctx.textAlign = Math.cos(moonAngle) >= 0 ? "left" : "right";
  ctx.fillStyle = "rgba(239, 213, 172, .83)";
  ctx.fillText("MOON", labelX, labelY);

  // At narrow sizes the exact-size Earth disk is still tiny; the tag reminds
  // viewers that the map exaggerates body disks, while orbit radii stay scaled.
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(135, 154, 171, .58)";
  ctx.font = "500 7px Inter, system-ui, sans-serif";
  ctx.letterSpacing = ".6px";
  ctx.fillText("BODY DISKS ENLARGED", width - 13, 18);
}

function setProgress(value) {
  state.progress = Math.max(0, Math.min(1, value));
  updateReadouts();
  drawMap();
}

function recalculate() {
  stopPlayback();
  state.mission = createLunarTransfer({
    parkingAltitudeKm: Number(parkingInput.value),
    captureAltitudeKm: Number(captureInput.value),
  });
  state.progress = 0;
  updateReadouts();
  drawMap();
}

function togglePlayback() {
  if (state.playing) {
    stopPlayback();
    return;
  }
  if (state.progress >= 1) state.progress = 0;
  state.playing = true;
  state.lastFrame = 0;
  updatePlaybackButton();
  const tick = (timestamp) => {
    if (!state.playing) return;
    if (!state.lastFrame) state.lastFrame = timestamp;
    const elapsedMs = Math.min(100, timestamp - state.lastFrame);
    state.lastFrame = timestamp;
    // A 60-second simulated coast at 1x keeps the five-day transfer scrub-able.
    const missionTimePerSecond = state.mission.transferDurationSeconds / 60;
    state.progress += (elapsedMs / 1000) * missionTimePerSecond * state.playbackScale / state.mission.transferDurationSeconds;
    if (state.progress >= 1) {
      state.progress = 1;
      stopPlayback();
    }
    updateReadouts();
    drawMap();
    if (state.playing) state.animationId = requestAnimationFrame(tick);
  };
  state.animationId = requestAnimationFrame(tick);
}

parkingInput.addEventListener("input", recalculate);
captureInput.addEventListener("input", recalculate);
timeScrubber.addEventListener("input", () => {
  stopPlayback();
  setProgress(Number(timeScrubber.value) / Number(timeScrubber.max));
});
playButton.addEventListener("click", togglePlayback);
$("#reset-button").addEventListener("click", () => {
  stopPlayback();
  setProgress(0);
});

document.querySelectorAll(".preset").forEach((button) => {
  button.addEventListener("click", () => {
    parkingInput.value = button.dataset.parking;
    document.querySelectorAll(".preset").forEach((preset) => {
      const active = preset === button;
      preset.classList.toggle("is-active", active);
      preset.setAttribute("aria-pressed", String(active));
    });
    recalculate();
  });
});

parkingInput.addEventListener("input", () => {
  document.querySelectorAll(".preset").forEach((preset) => {
    const active = Number(preset.dataset.parking) === Number(parkingInput.value);
    preset.classList.toggle("is-active", active);
    preset.setAttribute("aria-pressed", String(active));
  });
});

if (context) {
  if ("ResizeObserver" in window) new ResizeObserver(drawMap).observe(frame);
  else window.addEventListener("resize", drawMap);
} else if (canvas) {
  canvas.setAttribute("aria-label", "Canvas rendering is unavailable. Numerical transfer results are still available in the flight plan panel.");
}

updatePlaybackButton();
recalculate();
