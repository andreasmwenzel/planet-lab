import './style.css';
import { MU, EARTH_RADIUS, TAU, norm, apsidalState, elements, propagate, applyImpulse, timeToApsis, timeToImpact, hohmann, trajectory } from './physics.mjs';

const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const number = (v, digits = 0) => Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (v, digits = 0) => `${v >= 0 ? '+' : '−'}${number(Math.abs(v), digits)}`;
const clock = seconds => {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(x => String(x).padStart(2, '0')).join(':');
};
const duration = seconds => {
  if (!Number.isFinite(seconds)) return 'Unbound';
  if (seconds < 60) return `${number(seconds)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m`;
};
const unit = (v, u, d = 0) => `${number(v, d)}<small>${u}</small>`;
const presets = { ellipse: [400, 20000, 'Elliptical playground'], leo: [400, 400, 'Low Earth orbit'], geo: [35786, 35786, 'GEO-class circular orbit'], high: [600, 39700, 'High elliptical orbit'] };
let sim, resetState, undoStack = [], previousOrbit = null, tab = 'orbit', plan = null;
let path = [], pathAnchor = null, pathRadius = 0, frameState = null, frameElements = null;
const camera = { zoom: 1, panX: 0, panY: 0, earthFocus: false };
let toastTimer;

function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4400);
}
function resetCamera() { camera.zoom = 1; camera.panX = 0; camera.panY = 0; camera.earthFocus = false; }
function snapshot() { return { sim: clone(sim), previousOrbit: previousOrbit ? clone(previousOrbit) : null }; }
function startMission(state, title, logDetail) {
  sim = { anchor: state, anchorTime: 0, elapsed: 0, initial: clone(state), title, running: false, warp: +$('timeWarp').value, crashed: false, pending: null, totalDv: 0, logs: [{ time: 0, title: 'Orbit loaded', detail: logDetail, kind: 'initial', state: clone(state) }] };
  previousOrbit = null; undoStack = []; resetCamera();
  resetState = snapshot(); updateLog(); updateReadouts();
}
function readOrbitFields() {
  const peri = +$('perigee').value, apo = +$('apogee').value;
  if (!$('perigee').value || !$('apogee').value || !Number.isFinite(peri) || !Number.isFinite(apo) || peri < 0 || apo < peri || peri > 200000 || apo > 500000) throw new Error('Use 0–200,000 km for perigee; apogee must be higher and ≤500,000 km.');
  return { peri, apo };
}
function loadOrbit() {
  try {
    const { peri, apo } = readOrbitFields();
    const preset = presets[$('preset').value];
    const title = preset && preset[0] === peri && preset[1] === apo ? preset[2] : 'Custom Earth orbit';
    startMission(apsidalState(peri, apo), title, `${number(peri)} × ${number(apo)} km altitude`);
    $('orbitError').textContent = ''; toast('Orbit loaded. You’re at perigee and ready to fly.');
  } catch (error) { $('orbitError').textContent = error.message; }
}
function currentState() { return propagate(sim.anchor, sim.elapsed - sim.anchorTime); }
function addLog(title, detail, kind, state, dv = 0) {
  sim.logs.push({ time: sim.elapsed, title, detail, kind, state: clone(state), deltaVms: dv });
  updateLog();
}
function advanceTo(target) {
  if (sim.crashed || !Number.isFinite(target)) return;
  target = Math.max(sim.anchorTime, target);
  if (target >= sim.elapsed) {
    const impactAt = sim.anchorTime + timeToImpact(sim.anchor);
    if (impactAt <= target && (!sim.pending || impactAt <= sim.pending.atTime)) {
      sim.elapsed = impactAt; sim.running = false; sim.crashed = true; sim.pending = null;
      addLog('Surface impact', 'Flight stopped at Earth’s spherical surface.', 'arrival', currentState());
      toast('Surface impact. Undo the last burn or restart the mission.'); return;
    }
    if (sim.pending && target >= sim.pending.atTime) {
      const arrival = sim.pending;
      sim.elapsed = arrival.atTime;
      const before = currentState(); undoStack.push(snapshot());
      previousOrbit = clone(sim.anchor);
      sim.anchor = applyImpulse(before, arrival.dv, 0); sim.anchorTime = sim.elapsed;
      sim.totalDv += Math.abs(arrival.dv); sim.pending = null; sim.running = false;
      addLog('Arrival · circularized', `${signed(arrival.dv, 1)} m/s tangential · ${number(arrival.altitude)} km destination`, 'arrival', sim.anchor, Math.abs(arrival.dv));
      toast('Arrival burn complete. Your destination orbit is circular.'); return;
    }
  }
  sim.elapsed = target;
}
function burnValues() {
  const tangential = +$('tangential').value, radial = +$('radial').value;
  if (!$('tangential').value || !$('radial').value || ![tangential, radial].every(Number.isFinite) || Math.abs(tangential) > 20000 || Math.abs(radial) > 20000) throw new Error('Enter finite burn values between −20,000 and +20,000 m/s.');
  return { tangential, radial };
}
function applyBurn() {
  try {
    if (sim.crashed) return;
    const { tangential, radial } = burnValues();
    if (Math.hypot(tangential, radial) < 1e-8) { toast('Enter a nonzero Δv to make a maneuver.'); return; }
    const before = snapshot(), at = $('burnAt').value;
    const wait = at === 'now' ? 0 : timeToApsis(currentState(), at);
    if (!Number.isFinite(wait)) { toast('This trajectory has no distinct next apsis there. Choose the current position.'); return; }
    if (sim.pending) { sim.pending = null; toast('Manual maneuver selected. Automatic arrival burn canceled.'); }
    sim.running = false; advanceTo(sim.elapsed + wait);
    if (sim.crashed) { undoStack.push(before); updateReadouts(); return; }
    undoStack.push(before); previousOrbit = clone(sim.anchor);
    sim.anchor = applyImpulse(currentState(), tangential, radial); sim.anchorTime = sim.elapsed;
    const e = elements(sim.anchor); sim.totalDv += Math.hypot(tangential, radial);
    const description = `${signed(tangential)} tangential / ${signed(radial)} radial m/s`;
    addLog(`Maneuver ${sim.logs.filter(x => x.kind === 'burn').length + 1}`, description, 'burn', sim.anchor, Math.hypot(tangential, radial));
    toast(e.bound ? `Burn applied. New apogee: ${number(e.ra - EARTH_RADIUS)} km.` : 'Burn applied. The spacecraft is on an escape trajectory.');
    resetCamera(); updateReadouts();
  } catch (error) { toast(error.message); }
}
function readPlan() {
  try {
    const from = +$('transferFrom').value, to = +$('transferTo').value;
    if (!$('transferFrom').value || !$('transferTo').value || ![from, to].every(Number.isFinite) || from < 100 || to < 100 || from > 500000 || to > 500000) throw new Error('Use altitudes between 100 and 500,000 km.');
    if (Math.abs(from - to) < 1) throw new Error('Choose a destination at least 1 km from departure.');
    plan = { ...hohmann(from, to), from, to };
    plan.state = applyImpulse(apsidalState(from, from), plan.dv1, 0);
    plan.path = trajectory(plan.state);
    $('planDv1').textContent = `${signed(plan.dv1, 1)} m/s`;
    $('planDv2').textContent = `${signed(plan.dv2, 1)} m/s`;
    $('planCoast').textContent = duration(plan.coast);
    $('planTotal').textContent = `${number(plan.totalDv, 1)} m/s`;
    $('transferError').textContent = ''; $('flyTransfer').disabled = false;
    document.querySelectorAll('[data-target]').forEach(b => b.classList.toggle('selected', +b.dataset.target === to));
  } catch (error) {
    plan = null; $('transferError').textContent = error.message; $('flyTransfer').disabled = true;
    ['planDv1', 'planDv2', 'planCoast', 'planTotal'].forEach(id => { $(id).textContent = '—'; });
  }
}
function flyTransfer() {
  readPlan(); if (!plan) return;
  const p = plan;
  startMission(apsidalState(p.from, p.from), 'Hohmann transfer', `${number(p.from)} km circular departure`);
  sim.anchor = clone(p.state); sim.initial = clone(p.state); sim.totalDv = Math.abs(p.dv1);
  sim.pending = { atTime: p.coast, dv: p.dv2, altitude: p.to };
  addLog('Departure · transfer injection', `${signed(p.dv1, 1)} m/s tangential · coast ${duration(p.coast)}`, 'burn', sim.anchor, Math.abs(p.dv1));
  sim.warp = 1000; $('timeWarp').value = '1000';
  resetState = snapshot(); sim.running = true;
  toast(`Transfer started. Arrival burn in ${duration(p.coast)}.`); updateReadouts();
}
function setTab(next) {
  tab = next;
  $('orbitControls').hidden = next !== 'orbit'; $('transferControls').hidden = next !== 'transfer';
  ['orbit', 'transfer'].forEach(t => { $(`${t}Tab`).classList.toggle('active', next === t); $(`${t}Tab`).setAttribute('aria-selected', String(next === t)); });
  $('targetLegend').hidden = next !== 'transfer' || !plan; resetCamera();
}
function updateLog() {
  $('flightLog').replaceChildren();
  for (const event of sim.logs.slice(-20)) {
    const entry = document.createElement('div'); entry.className = `log-entry ${event.kind}`;
    const dot = document.createElement('i'); dot.className = 'log-dot';
    const content = document.createElement('div'), time = document.createElement('time'), heading = document.createElement('h3'), detail = document.createElement('p');
    time.textContent = `T+ ${clock(event.time)}`; heading.textContent = event.title; detail.textContent = event.detail;
    content.append(time, heading, detail); entry.append(dot, content); $('flightLog').append(entry);
  }
  $('flightLog').scrollTop = $('flightLog').scrollHeight;
  $('undoBurn').disabled = undoStack.length === 0;
}
function updateReadouts() {
  const state = currentState(), e = elements(state);
  frameState = state; frameElements = e;
  $('flightTitle').textContent = sim.title;
  $('altitudeMetric').innerHTML = unit(Math.max(0, e.r - EARTH_RADIUS), 'km');
  $('velocityMetric').innerHTML = unit(e.speed, 'km/s', 2);
  $('periodMetric').innerHTML = Number.isFinite(e.period) ? `${duration(e.period)}` : 'Unbound';
  $('eccentricityMetric').textContent = number(e.e, 4);
  $('perigeeMetric').innerHTML = unit(e.rp - EARTH_RADIUS, 'km');
  $('apogeeMetric').innerHTML = e.bound ? unit(e.ra - EARTH_RADIUS, 'km') : '∞ <small>escape</small>';
  $('semiMajorMetric').textContent = Number.isFinite(e.a) ? `${number(e.a)} km` : '∞ · parabolic';
  $('energyMetric').textContent = `${signed(e.energy, 3)} km²/s²`;
  $('radialMetric').textContent = `${signed(e.radialSpeed, 3)} km/s`;
  $('missionClock').textContent = clock(sim.elapsed);
  $('coastClock').textContent = clock(sim.elapsed - sim.anchorTime);
  $('timelineLabel').textContent = sim.anchorTime > 0 || sim.logs.length > 1 ? 'COAST SINCE LAST MANEUVER' : 'COAST SINCE ORBIT LOAD';
  const coastWindow = e.bound ? e.period : 86400;
  if (document.activeElement !== $('timeline')) $('timeline').value = String(Math.min(1000, (sim.elapsed - sim.anchorTime) / coastWindow * 1000));
  $('timeline').disabled = sim.crashed;
  const ticks = document.querySelectorAll('.timeline-ticks span');
  ['0', e.bound ? '¼ orbit' : '6h', e.bound ? '½ orbit' : '12h', e.bound ? '¾ orbit' : '18h', e.bound ? '1 orbit' : '24h'].forEach((text, i) => { ticks[i].textContent = text; });
  $('playText').textContent = sim.running ? 'Pause' : 'Play'; $('playIcon').textContent = sim.running ? 'Ⅱ' : '▶';
  $('playButton').setAttribute('aria-label', sim.running ? 'Pause simulation' : 'Play simulation');
  $('playButton').disabled = sim.crashed; $('stepForward').disabled = sim.crashed; $('applyBurn').disabled = sim.crashed;
  $('burnAt').querySelector('option[value="apoapsis"]').disabled = !e.bound || e.e < 1e-8;
  $('burnAt').querySelector('option[value="periapsis"]').disabled = !e.bound || e.e < 1e-8;
  if ($('burnAt').value !== 'now' && (!e.bound || e.e < 1e-8)) $('burnAt').value = 'now';
  $('orbitType').textContent = sim.crashed ? 'SURFACE IMPACT' : e.rp < EARTH_RADIUS ? 'IMPACT TRAJECTORY' : !e.bound ? 'ESCAPE TRAJECTORY' : e.e < 0.0001 ? 'CIRCULAR ORBIT' : 'BOUND ORBIT';
  $('orbitType').classList.toggle('warning', sim.crashed || e.rp < EARTH_RADIUS || !e.bound);
  $('previousLegend').hidden = !previousOrbit;
  $('targetLegend').hidden = tab !== 'transfer' || !plan;
  $('totalDv').innerHTML = `${number(sim.totalDv, 1)} <small>m/s</small>`;
  const impact = timeToImpact(state), warning = sim.crashed || Number.isFinite(impact);
  $('warningBanner').hidden = !warning;
  $('warningBanner').textContent = sim.crashed ? 'Surface impact detected. Flight paused. Restart or undo the last burn to continue.' : `Surface-intersecting orbit · impact in ${duration(impact)}. Atmosphere is not modeled.`;
  $('autopilotBanner').hidden = !sim.pending || warning;
  if (sim.pending) $('arrivalCountdown').textContent = `T− ${clock(Math.max(0, sim.pending.atTime - sim.elapsed))}`;
  try { const b = burnValues(); $('burnMagnitude').textContent = `${number(Math.hypot(b.tangential, b.radial))} m/s`; } catch { $('burnMagnitude').textContent = 'Invalid Δv'; }
}

// A local, origin-independent export. The viewer may prohibit downloads or
// clipboard APIs, so data is presented in a selectable textarea instead.
const exportDialog = document.createElement('dialog');
exportDialog.innerHTML = '<div class="dialog-heading"><div><p class="eyebrow">SESSION EXPORT</p><h2>Your flight, in numbers.</h2></div><button class="icon-button" aria-label="Close flight export">×</button></div><p>Select the JSON below, copy it, and save it as a .json file. It includes state vectors, burns, and the model constants.</p><textarea class="export-data" aria-label="Exported flight JSON" readonly spellcheck="false"></textarea><div class="export-actions"><span>Units: kilometers, seconds, meters/second for burns.</span><button class="primary-button">Select data</button></div>';
document.body.append(exportDialog);
exportDialog.querySelector('.icon-button').addEventListener('click', () => exportDialog.close());
exportDialog.querySelector('.primary-button').addEventListener('click', () => { const t = exportDialog.querySelector('textarea'); t.focus(); t.select(); });
$('exportFlight').addEventListener('click', () => {
  const data = { product: 'Apogee · Orbital flight desk', model: 'Planar, unperturbed Earth two-body mechanics; instantaneous local-tangential and radial burns', constants: { muKm3s2: MU, earthRadiusKm: EARTH_RADIUS }, elapsedSeconds: sim.elapsed, initialStateKmKms: sim.initial, currentStateKmKms: currentState(), totalDeltaVms: sim.totalDv, surfaceImpact: sim.crashed, pendingArrival: sim.pending, events: sim.logs };
  exportDialog.querySelector('textarea').value = JSON.stringify(data, null, 2); exportDialog.showModal();
});
$('modelButton').addEventListener('click', () => $('modelDialog').showModal());
$('closeModel').addEventListener('click', () => $('modelDialog').close());
[$('modelDialog'), exportDialog].forEach(dialog => dialog.addEventListener('click', event => { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); }));
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); setTab('orbit'); resetCamera(); });
$('orbitTab').addEventListener('click', () => setTab('orbit'));
$('transferTab').addEventListener('click', () => setTab('transfer'));
document.querySelector('.tabs').addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setTab(tab === 'orbit' ? 'transfer' : 'orbit'); $(`${tab}Tab`).focus(); } });
$('preset').addEventListener('change', () => { const p = presets[$('preset').value]; if (p) { $('perigee').value = p[0]; $('apogee').value = p[1]; loadOrbit(); } });
['perigee', 'apogee'].forEach(id => $(id).addEventListener('input', () => { $('preset').value = 'custom'; }));
$('loadOrbit').addEventListener('click', loadOrbit);
['tangential', 'radial'].forEach(id => {
  $(`${id}Range`).addEventListener('input', () => { $(id).value = $(`${id}Range`).value; updateReadouts(); });
  $(id).addEventListener('input', () => { $(`${id}Range`).value = $(id).value; updateReadouts(); });
});
$('applyBurn').addEventListener('click', applyBurn);
$('undoBurn').addEventListener('click', () => { const old = undoStack.pop(); if (!old) return; sim = old.sim; sim.running = false; $('timeWarp').value = String(sim.warp); previousOrbit = old.previousOrbit; resetCamera(); updateLog(); updateReadouts(); toast('Last maneuver undone.'); });
$('resetFlight').addEventListener('click', () => { const old = clone(resetState); sim = old.sim; previousOrbit = old.previousOrbit; sim.running = false; $('timeWarp').value = String(sim.warp); undoStack = []; resetCamera(); updateLog(); updateReadouts(); toast('Mission restarted.'); });
$('playButton').addEventListener('click', () => { sim.running = !sim.running; updateReadouts(); });
$('stepForward').addEventListener('click', () => { sim.running = false; advanceTo(sim.elapsed + 60); updateReadouts(); });
$('timeWarp').addEventListener('change', () => { sim.warp = +$('timeWarp').value; });
$('timeline').addEventListener('input', () => { sim.running = false; const e = elements(sim.anchor); advanceTo(sim.anchorTime + +$('timeline').value / 1000 * (e.bound ? e.period : 86400)); updateReadouts(); });
['transferFrom', 'transferTo'].forEach(id => $(id).addEventListener('input', readPlan));
document.querySelectorAll('[data-target]').forEach(button => button.addEventListener('click', () => { $('transferTo').value = button.dataset.target; readPlan(); resetCamera(); }));
$('flyTransfer').addEventListener('click', flyTransfer);
$('jumpArrival').addEventListener('click', () => { if (sim.pending) { advanceTo(sim.pending.atTime); updateReadouts(); } });
$('zoomIn').addEventListener('click', () => { camera.zoom = Math.min(20, camera.zoom * 1.3); });
$('zoomOut').addEventListener('click', () => { camera.zoom = Math.max(0.2, camera.zoom / 1.3); });
$('fitOrbit').addEventListener('click', resetCamera);
$('focusEarth').addEventListener('click', () => { resetCamera(); camera.earthFocus = true; });

const canvas = $('orbitCanvas'), ctx = canvas.getContext('2d');
let width = 600, height = 460, scale = 1, fitCenter = [0, 0], drag = null, hover = null;
const resize = () => {
  const rect = $('mapWrap').getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};
new ResizeObserver(resize).observe($('mapWrap'));
const project = p => [(p[0] - fitCenter[0]) * scale + width / 2 + camera.panX, -(p[1] - fitCenter[1]) * scale + height / 2 + camera.panY];
canvas.addEventListener('wheel', event => { event.preventDefault(); camera.zoom = Math.max(0.2, Math.min(20, camera.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12))); }, { passive: false });
canvas.addEventListener('pointerdown', event => { drag = { x: event.clientX, y: event.clientY, panX: camera.panX, panY: camera.panY }; canvas.setPointerCapture(event.pointerId); canvas.classList.add('dragging'); $('mapTooltip').hidden = true; });
canvas.addEventListener('pointermove', event => {
  const rect = canvas.getBoundingClientRect(); hover = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  if (drag) { camera.panX = drag.panX + event.clientX - drag.x; camera.panY = drag.panY + event.clientY - drag.y; }
});
canvas.addEventListener('pointerup', () => { drag = null; canvas.classList.remove('dragging'); });
canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('dragging'); });
canvas.addEventListener('pointerleave', () => { hover = null; $('mapTooltip').hidden = true; });

function linePath(points, color, dash = [], lineWidth = 1) {
  if (!ctx || !points.length) return;
  ctx.beginPath(); points.forEach((point, i) => { const [x, y] = project(point); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
}
function drawEarth(x, y, radius) {
  ctx.save();
  const rr = Math.max(radius, 2);
  const glow = ctx.createRadialGradient(x, y, rr * 0.95, x, y, rr * 1.25);
  glow.addColorStop(0, '#459a9e28'); glow.addColorStop(1, '#459a9e00'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, rr * 1.25, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.clip();
  const sea = ctx.createRadialGradient(x - rr * .4, y - rr * .4, rr * .1, x + rr * .3, y + rr * .15, rr * 1.25);
  sea.addColorStop(0, '#356771'); sea.addColorStop(.6, '#1e4657'); sea.addColorStop(1, '#071a2a'); ctx.fillStyle = sea; ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  ctx.translate(x, y); ctx.scale(rr, rr);
  ctx.fillStyle = '#688b7d';
  // Stylized, hand-drawn continents. Visual orientation has no physical meaning.
  ctx.beginPath(); ctx.moveTo(-.95,-.35); ctx.bezierCurveTo(-.8,-.7,-.44,-.86,-.19,-.6); ctx.lineTo(-.24,-.42);ctx.lineTo(-.04,-.31);ctx.lineTo(-.18,-.13);ctx.lineTo(-.35,-.17);ctx.lineTo(-.44,.02);ctx.lineTo(-.6,-.07);ctx.lineTo(-.62,-.25);ctx.lineTo(-.87,-.22);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-.39,.03);ctx.bezierCurveTo(-.08,.01,.04,.27,-.1,.48);ctx.lineTo(-.25,.78);ctx.lineTo(-.39,.62);ctx.lineTo(-.47,.23);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(.17,-.64);ctx.lineTo(.33,-.79);ctx.lineTo(.62,-.63);ctx.lineTo(.9,-.38);ctx.lineTo(.98,-.14);ctx.lineTo(.78,-.04);ctx.lineTo(.63,-.22);ctx.lineTo(.53,-.1);ctx.lineTo(.33,-.22);ctx.lineTo(.3,-.38);ctx.lineTo(.11,-.35);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(.2,-.23);ctx.bezierCurveTo(.45,-.29,.63,.08,.47,.25);ctx.lineTo(.35,.5);ctx.lineTo(.15,.21);ctx.lineTo(.1,-.04);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(.6,.47);ctx.lineTo(.82,.39);ctx.lineTo(.94,.58);ctx.lineTo(.81,.72);ctx.lineTo(.58,.64);ctx.closePath();ctx.fill();
  ctx.fillStyle='#afc3bf66';ctx.beginPath();ctx.ellipse(-.1,-.94,.35,.12,0,0,TAU);ctx.fill();
  const shade=ctx.createLinearGradient(-1,-.7,1,.5);shade.addColorStop(0,'#86c4c40d');shade.addColorStop(.45,'#08182600');shade.addColorStop(1,'#010b16c9');ctx.fillStyle=shade;ctx.fillRect(-1,-1,2,2);
  ctx.strokeStyle='#b0d7d218';ctx.lineWidth=.006;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.ellipse(0,0,.25+Math.abs(i)*.2,1,0,0,TAU);ctx.stroke();}ctx.restore();
  ctx.beginPath();ctx.arc(x,y,rr,0,TAU);ctx.strokeStyle='#7fb9b875';ctx.lineWidth=.7;ctx.stroke();
}
function drawMarker(position, title, altitude, hollow = false) {
  const [x, y] = project(position);
  if (x < 14 || x > width - 14 || y < 38 || y > height - 42) return;
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle='#7de4dc';ctx.strokeStyle='#7de4dc';ctx.lineWidth=1;if(hollow)ctx.strokeRect(-2.4,-2.4,4.8,4.8);else ctx.fillRect(-2.4,-2.4,4.8,4.8);ctx.restore();
  const right = x < width - 140; ctx.textAlign = right ? 'left' : 'right';
  ctx.font='8px "Segoe UI", sans-serif';ctx.fillStyle='#81aaa9';ctx.fillText(title,x+(right?10:-10),y-9);
  ctx.font='10px Consolas, monospace';ctx.fillStyle='#bcdad7';ctx.fillText(`${number(altitude)} km`,x+(right?10:-10),y+5);ctx.textAlign='left';
}
function drawMap() {
  if (!ctx) return;
  const state = currentState(), e = elements(state);
  if (pathAnchor !== sim.anchor || (!e.bound && e.r > pathRadius / 1.4)) {
    pathRadius = Math.max(EARTH_RADIUS * 10, e.r * 2);
    path = trajectory(sim.anchor, 480, pathRadius); pathAnchor = sim.anchor;
  }
  const comparison = previousOrbit ? trajectory(previousOrbit, 240, pathRadius) : [];
  const points = [...path, ...comparison, [-EARTH_RADIUS, -EARTH_RADIUS], [EARTH_RADIUS, EARTH_RADIUS], state.r];
  if (tab === 'transfer' && plan) points.push([-plan.r2,-plan.r2],[plan.r2,plan.r2],[-plan.r1,-plan.r1],[plan.r1,plan.r1],...plan.path);
  const xs = points.map(p=>p[0]), ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  fitCenter=[(minX+maxX)/2,(minY+maxY)/2];scale=Math.min(Math.max(30,width-105)/(maxX-minX),Math.max(30,height-115)/(maxY-minY))*camera.zoom;
  if(camera.earthFocus){fitCenter=[0,0];scale=Math.min(Math.max(30,width-105),Math.max(30,height-115))/Math.max(EARTH_RADIUS*3,e.r*2.3)*camera.zoom;}
  ctx.clearRect(0,0,width,height);
  const [ox,oy]=project([0,0]);
  let grid=10**Math.floor(Math.log10(110/scale));if(grid*scale<60)grid*=2;if(grid*scale<60)grid*=2.5;
  ctx.strokeStyle='#29404a40';ctx.lineWidth=.5;ctx.beginPath();
  for(let x=((ox%(grid*scale))+grid*scale)%(grid*scale);x<width;x+=grid*scale){ctx.moveTo(x,0);ctx.lineTo(x,height);}
  for(let y=((oy%(grid*scale))+grid*scale)%(grid*scale);y<height;y+=grid*scale){ctx.moveTo(0,y);ctx.lineTo(width,y);}ctx.stroke();
  ctx.strokeStyle='#3a576452';ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(ox,0);ctx.lineTo(ox,height);ctx.moveTo(0,oy);ctx.lineTo(width,oy);ctx.stroke();ctx.setLineDash([]);
  if(tab==='transfer'&&plan){ctx.strokeStyle='#9a725350';ctx.lineWidth=.8;ctx.setLineDash([3,5]);for(const r of [plan.r1,plan.r2]){ctx.beginPath();ctx.arc(ox,oy,r*scale,0,TAU);ctx.stroke();}ctx.setLineDash([]);linePath(plan.path,'#f7b182aa',[5,5],1);}
  if(comparison.length)linePath(comparison,'#66848b88',[3,5],.9);
  linePath(path,e.rp<EARTH_RADIUS?'#f0b185bb':'#7de4dcaa',[],1.2);
  // Subtle orbit tick marks make the geometry readable without a starfield.
  ctx.fillStyle='#7de4dc55';for(let i=0;i<path.length;i+=30){const [x,y]=project(path[i]);ctx.beginPath();ctx.arc(x,y,1.2,0,TAU);ctx.fill();}
  drawEarth(ox,oy,EARTH_RADIUS*scale);
  if(EARTH_RADIUS*scale>9&&ox>0&&ox<width&&oy>0&&oy<height){ctx.fillStyle='#849fac';ctx.font='8px "Segoe UI", sans-serif';ctx.textAlign='center';ctx.fillText('EARTH',ox,oy+EARTH_RADIUS*scale+16);ctx.textAlign='left';}
  if(e.e>1e-5&&e.p>1e-7){drawMarker([e.rp*Math.cos(e.omega),e.rp*Math.sin(e.omega)],'PERIGEE',e.rp-EARTH_RADIUS);if(e.bound)drawMarker([-e.ra*Math.cos(e.omega),-e.ra*Math.sin(e.omega)],'APOGEE',e.ra-EARTH_RADIUS,true);}
  const [sx,sy]=project(state.r),angle=Math.atan2(-state.v[1],state.v[0]);
  ctx.save();ctx.translate(sx,sy);ctx.rotate(angle);ctx.fillStyle=sim.crashed?'#ffb092':'#e0fffa';ctx.shadowColor='#7de4dc';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,-4);ctx.lineTo(-2,0);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();ctx.restore();
  if(sx>0&&sx<width&&sy>0&&sy<height){ctx.strokeStyle='#c9eee750';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(sx+8,sy+7);ctx.lineTo(sx+17,sy+16);ctx.lineTo(sx+57,sy+16);ctx.stroke();ctx.font='7px "Segoe UI", sans-serif';ctx.fillStyle='#bbd6d0';const flip=sx>width-105;ctx.textAlign=flip?'right':'left';ctx.fillText('SPACECRAFT',sx+(flip?-10:19),sy+29);ctx.textAlign='left';}
  // Physical scale bar in kilometers.
  const bar=grid*scale;ctx.strokeStyle='#49616e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(width-24-bar,height-19);ctx.lineTo(width-24,height-19);ctx.moveTo(width-24-bar,height-22);ctx.lineTo(width-24-bar,height-16);ctx.moveTo(width-24,height-22);ctx.lineTo(width-24,height-16);ctx.stroke();ctx.fillStyle='#627d89';ctx.textAlign='right';ctx.font='8px Consolas, monospace';ctx.fillText(`${number(grid)} km`,width-24,height-27);ctx.textAlign='left';
  if(hover&&!drag){let best=null,distance=14;for(const p of path){const [x,y]=project(p),d=Math.hypot(x-hover.x,y-hover.y);if(d<distance){distance=d;best=p;}}if(best){$('mapTooltip').textContent=`Orbit altitude ${number(norm(best)-EARTH_RADIUS)} km`;$('mapTooltip').style.left=`${Math.max(8,Math.min(width-185,hover.x+12))}px`;$('mapTooltip').style.top=`${Math.max(8,hover.y-35)}px`;$('mapTooltip').hidden=false;}else $('mapTooltip').hidden=true;}
}

readPlan();
startMission(apsidalState(400,20000),'Elliptical playground','400 × 20,000 km altitude');
resize();
if(!ctx){canvas.style.display='none';const fallback=document.createElement('div');fallback.className='warning-banner';fallback.style.top='45%';fallback.style.bottom='auto';fallback.textContent='Canvas graphics are unavailable. The numerical simulator, maneuvers, and transfer planner still work.';$('mapWrap').append(fallback);}
let lastTime=performance.now(),lastUI=0;
function frame(now){
  const dt=Math.min(.25,(now-lastTime)/1000);lastTime=now;
  try{if(sim.running)advanceTo(sim.elapsed+dt*sim.warp);if(now-lastUI>80){updateReadouts();lastUI=now;}drawMap();}
  catch(error){sim.running=false;toast(`Simulation paused: ${error.message}`);}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
