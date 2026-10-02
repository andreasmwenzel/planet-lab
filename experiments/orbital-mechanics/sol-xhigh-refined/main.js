import './styles.css';
import { MU, EARTH_RADIUS, TAU, norm, initialOrbit, propagate, elements, localFrame, applyBurn, timeToImpact, sampleTrajectory } from './physics.js';

const $ = id => document.getElementById(id);
const canvas = $('orbit-canvas'), ctx = canvas.getContext('2d');
const presets = { leo: [400, 400], transfer: [300, 35786], high: [20200, 20200] };
const DRAFT_LIMITS = { p: [-3500, 3500], r: [-2500, 2500] };
let base = initialOrbit(400, 400), simTime = 0, running = false, warp = 100;
let draft = { p: 350, r: 0 }, history = [], initialAltitudes = [400, 400];
let baseElements, basePath, baseImpact, current, candidate, candidateElements, candidatePath, candidateImpact;
let width = 900, height = 509, dpr = 1, zoom = 1, pan = { x: 0, y: 0 }, manualView = false;
let camera = { x: 0, y: 0, scale: 1 }, viewCenter = { x: 0, y: 0 };
let handle = null, spacecraftPx = null, pointer = null, lastFrame = 0, lastPreview = 0;
let notificationTimer;
const number = (value, digits = 0) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
const signed = (v, digits = 0) => `${v > 0 ? '+' : ''}${number(v, digits)}`;
function duration(seconds, full = false) {
  if (!Number.isFinite(seconds)) return 'Unbound';
  const s = Math.max(0, Math.round(seconds));
  if (full) return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(v => String(v).padStart(2, '0')).join(':');
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
function notify(text) {
  clearTimeout(notificationTimer); $('notification').textContent = text; $('notification').classList.add('visible');
  notificationTimer = setTimeout(() => $('notification').classList.remove('visible'), 4300);
}
function setRunning(value) {
  running = value && !hasImpacted();
  $('play').textContent = running ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-label', running ? 'Pause simulation' : 'Play simulation');
  $('play').setAttribute('aria-pressed', String(running));
}
function hasImpacted() { return baseImpact !== null && simTime >= baseImpact - 1e-7; }
function coastLimit() { return Math.min(baseImpact ?? Infinity, baseElements.bound ? baseElements.period : 21600); }
function rebuildBase() {
  baseElements = elements(base); baseImpact = timeToImpact(base); basePath = sampleTrajectory(base);
}
function syncDraftInputs() {
  $('prograde').value = draft.p; $('prograde-number').value = draft.p;
  $('radial').value = draft.r; $('radial-number').value = draft.r;
}
function updateDraft(key, value) {
  if (!Number.isFinite(value)) return;
  setRunning(false);
  draft[key] = Math.max(DRAFT_LIMITS[key][0], Math.min(DRAFT_LIMITS[key][1], Math.round(value / 10) * 10));
  syncDraftInputs(); refresh(true);
}
function setRecipe(p, r) { setRunning(false); draft = { p, r }; syncDraftInputs(); refresh(true); }
function loadOrbit(peri, apo, preset = null) {
  base = initialOrbit(peri, apo); initialAltitudes = [peri, apo]; simTime = 0; history = []; setRunning(false);
  draft = { p: 350, r: 0 }; syncDraftInputs(); zoom = 1; pan = { x: 0, y: 0 }; manualView = false;
  $('peri-input').value = peri; $('apo-input').value = apo; $('orbit-error').textContent = '';
  document.querySelectorAll('[data-preset]').forEach(button => { const active = button.dataset.preset === preset; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  rebuildBase(); updateLog(); refresh(true);
}
function executeBurn() {
  if (hasImpacted() || Math.hypot(draft.p, draft.r) < 0.5 || history.length >= 12) return;
  try {
    setRunning(false);
    const before = propagate(base, simTime), after = applyBurn(before, draft.p / 1000, draft.r / 1000);
    // Verify the complete post-burn arc before changing any simulation state.
    sampleTrajectory(after);
    history.push({ base: { r: [...base.r], v: [...base.v] }, time: simTime, draft: { ...draft }, altitude: norm(before.r) - EARTH_RADIUS, amount: Math.hypot(draft.p, draft.r) });
    base = after; simTime = 0; draft = { p: 0, r: 0 }; syncDraftInputs();
    rebuildBase(); updateLog(); refresh(true);
    notify(`Burn ${String(history.length).padStart(2, '0')} executed · ${number(history.at(-1).amount)} m/s. Coast or plan the next maneuver.`);
  } catch (error) { notify(`This burn could not be evaluated: ${error.message}`); }
}
function undoBurn() {
  const record = history.pop(); if (!record) return;
  setRunning(false); base = record.base; simTime = record.time; draft = record.draft; syncDraftInputs();
  rebuildBase(); updateLog(); refresh(true); notify('Burn undone. Its original position and draft are restored.');
}
function updateLog() {
  $('undo').disabled = history.length === 0;
  $('log-count').textContent = `${history.length} ${history.length === 1 ? 'burn' : 'burns'}`;
  $('mission-dv').textContent = `${number(history.reduce((total, item) => total + item.amount, 0))} m/s`;
  const container = $('log-items'); container.replaceChildren();
  if (!history.length) { const p = document.createElement('p'); p.className = 'empty-log'; p.textContent = 'Your executed burns will appear here.'; container.append(p); }
  else [...history].reverse().forEach((item, reversedIndex) => {
    const row = document.createElement('div'); row.className = 'log-row';
    const index = document.createElement('span'); index.textContent = String(history.length - reversedIndex).padStart(2, '0');
    const details = document.createElement('div'); const title = document.createElement('strong'); title.textContent = `At ${number(item.altitude)} km altitude`;
    const sub = document.createElement('p'); sub.textContent = `T + ${duration(item.time, true)} · P ${signed(item.draft.p)} / R ${signed(item.draft.r)} m/s`;
    details.append(title, sub); const value = document.createElement('strong'); value.textContent = `${number(item.amount)} m/s`; row.append(index, details, value); container.append(row);
  });
}
function refresh(force = false, refit = true) {
  try {
    current = propagate(base, simTime); candidate = applyBurn(current, draft.p / 1000, draft.r / 1000);
    candidateElements = elements(candidate); candidateImpact = timeToImpact(candidate); candidatePath = sampleTrajectory(candidate);
    if (!manualView && refit && (force || !running)) fitCamera();
    updateTelemetry(); updateComparison();
  } catch (error) { setRunning(false); notify(`Calculation paused: ${error.message}`); }
}
function updateTelemetry() {
  const o = elements(current);
  $('altitude').innerHTML = `${number(Math.max(0, o.radius - EARTH_RADIUS))} <small>km</small>`;
  $('speed').innerHTML = `${number(o.speed, 3)} <small>km/s</small>`;
  $('elapsed').textContent = duration(simTime, true);
  const limit = coastLimit();
  const phase = baseElements.bound && baseImpact === null ? (simTime % limit) / limit : Math.min(1, simTime / limit);
  $('position').value = Number.isFinite(phase) ? Math.round(phase * 1000) : 0;
  $('position-label').textContent = baseImpact !== null ? `${number(phase * 100)}% to intercept` : baseElements.bound ? `${number(phase * 100)}% of orbit` : `${duration(simTime)} / 6h`;
  $('position').setAttribute('aria-valuetext', `${duration(phase * limit)} into ${baseImpact !== null ? 'the coast to impact' : baseElements.bound ? 'the current orbit' : 'the six hour escape window'}`);
  $('impact-overlay').hidden = !hasImpacted();
  $('play').disabled = hasImpacted() || (!baseElements.bound && simTime >= limit);
}
function metric(id, value, suffix, digits = 0) { $(id).innerHTML = Number.isFinite(value) ? `${number(value, digits)}${suffix ? ` <small>${suffix}</small>` : ''}` : '<span style="font-size:20px;letter-spacing:-.4px">Unbound</span>'; }
function updateComparison() {
  const before = baseElements, after = candidateElements;
  const periB = before.periapsis - EARTH_RADIUS, periA = after.periapsis - EARTH_RADIUS;
  const apoB = before.apoapsis - EARTH_RADIUS, apoA = after.apoapsis - EARTH_RADIUS;
  const amount = Math.hypot(draft.p, draft.r), zero = amount < 0.5;
  metric('peri-after', periA, 'km'); metric('apo-after', apoA, 'km');
  $('period-after').textContent = duration(after.period); metric('ecc-after', after.e, '', 3);
  $('peri-before').textContent = `${number(periB)} km`; $('apo-before').textContent = Number.isFinite(apoB) ? `${number(apoB)} km` : 'Unbound';
  $('period-before').textContent = duration(before.period); $('ecc-before').textContent = number(before.e, 3);
  const deltaKm = (a, b) => !Number.isFinite(a) ? 'Open escape trajectory' : !Number.isFinite(b) ? 'Captured into orbit' : Math.abs(a - b) < 0.5 ? 'Unchanged' : `${signed(a - b)} km`;
  $('peri-change').textContent = periA < 0 ? 'Conic crosses Earth' : deltaKm(periA, periB);
  $('peri-change').classList.toggle('danger', periA < 0);
  $('apo-change').textContent = deltaKm(apoA, apoB);
  const periodDelta = after.period - before.period;
  $('period-change').textContent = !after.bound ? 'No orbital period' : !before.bound ? 'Closed orbit' : Math.abs(periodDelta) < 1 ? 'Unchanged' : `${periodDelta > 0 ? '+' : '−'}${duration(Math.abs(periodDelta))}`;
  $('ecc-change').textContent = zero ? 'Unchanged' : after.e < 0.001 ? 'Nearly circular' : after.e >= 1 ? 'Escape conic' : before.e < 0.001 ? 'Circular → elliptical' : `${signed(after.e - before.e, 3)} eccentricity`;
  $('burn-magnitude').innerHTML = `${number(amount)} <small>m/s</small>`;
  $('preview-badge').textContent = zero ? 'COAST' : 'DRAFT';
  $('execute').disabled = zero || hasImpacted() || history.length >= 12;
  const collision = candidateImpact !== null;
  $('assessment').classList.toggle('warning', collision || !after.bound);
  let title, copy;
  if (hasImpacted()) { title = 'Surface intercept'; copy = 'Return to the burn point or undo your last maneuver.'; }
  else if (collision) { title = 'Earth intercept'; copy = `The future trajectory meets the surface in ${duration(candidateImpact)}. Coast stops there.`; }
  else if (!after.bound) { title = after.parabolic ? 'Parabolic escape' : 'Hyperbolic escape'; copy = `No return to Earth in this two-body model. Preview shows the next six hours.`; }
  else if (zero) { title = 'Coasting'; copy = 'Choose a new burn location and add Δv to plan your next maneuver.'; }
  else if (periA < 120) { title = 'Very low periapsis'; copy = 'Below 120 km. Atmospheric effects are significant and are not modeled.'; $('assessment').classList.add('warning'); }
  else { title = 'Bound orbit'; const change = Math.abs(apoA - apoB) > Math.abs(periA - periB) ? apoA - apoB : periA - periB; const which = Math.abs(apoA - apoB) > Math.abs(periA - periB) ? 'apoapsis' : 'periapsis'; copy = Math.abs(change) < 0.5 ? 'This impulse rotates the orbit with little change in its altitudes.' : `The maneuver ${change > 0 ? 'raises' : 'lowers'} your ${which} by ${number(Math.abs(change))} km.`; }
  if (history.length >= 12) { title = 'Maneuver log full'; copy = 'This session holds 12 burns. Undo or reset to try another design.'; }
  $('assessment-title').textContent = title; $('assessment-copy').textContent = copy;
  $('orbit-description').textContent = collision ? 'Surface interception ends the future arc.' : !after.bound ? 'Escape arc · next 6 hours' : zero ? 'Current orbit · add Δv to explore a maneuver' : 'Dashed orbit is a preview. Execute to apply the impulse.';
  $('scene-tip').textContent = zero ? 'Drag to pan · scroll to zoom · fit to recenter' : 'Drag the green handle to adjust Δv';
}
function fitCamera() {
  const points = [...basePath.points, ...candidatePath.points];
  let minX = -EARTH_RADIUS * 1.18, maxX = EARTH_RADIUS * 1.18, minY = minX, maxY = maxX;
  for (const p of points) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const left = width < 520 ? 98 : 122, right = 32, top = 115, bottom = 60;
  viewCenter = { x: (left + width - right) / 2, y: (top + height - bottom) / 2 };
  camera = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale: Math.max(1e-8, Math.min((width - left - right) / (maxX - minX), (height - top - bottom) / (maxY - minY)) * 0.85) };
}
function project(r) { return { x: viewCenter.x + pan.x + (r[0] - camera.x) * camera.scale * zoom, y: viewCenter.y + pan.y - (r[1] - camera.y) * camera.scale * zoom }; }
function resize() {
  const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height); dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  if (!manualView && basePath && candidatePath) fitCamera();
  else { viewCenter = { x: width / 2 + 25, y: height / 2 + 25 }; }
  draw();
}
function linePath(points, color, lineWidth = 1, dash = []) {
  if (!points.length) return;
  ctx.beginPath(); points.forEach((p, i) => { const s = project(p); if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y); });
  ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
}
function arrow(a, b, color, size = 5, lineWidth = 1.5) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lineWidth;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - size * Math.cos(angle - 0.4), b.y - size * Math.sin(angle - 0.4)); ctx.lineTo(b.x - size * Math.cos(angle + 0.4), b.y - size * Math.sin(angle + 0.4)); ctx.closePath(); ctx.fill();
}
function drawEarth(origin, radiusPx) {
  const glow = ctx.createRadialGradient(origin.x, origin.y, radiusPx * 0.8, origin.x, origin.y, radiusPx * 1.32);
  glow.addColorStop(0, '#386c6b12'); glow.addColorStop(0.78, '#386c6b14'); glow.addColorStop(1, '#386c6b00');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusPx * 1.32, 0, TAU); ctx.fill();
  const earth = ctx.createRadialGradient(origin.x - radiusPx * 0.35, origin.y - radiusPx * 0.4, radiusPx * 0.05, origin.x, origin.y, radiusPx);
  earth.addColorStop(0, '#385d62'); earth.addColorStop(.5, '#28484f'); earth.addColorStop(1, '#192f38');
  ctx.fillStyle = earth; ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusPx, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(origin.x, origin.y, radiusPx * .97, 0, TAU); ctx.clip(); ctx.translate(origin.x, origin.y); ctx.scale(radiusPx, radiusPx);
  ctx.fillStyle = '#657c602a'; ctx.beginPath(); ctx.moveTo(-.8,-.42); ctx.bezierCurveTo(-.25,-.8,.3,-.55,.15,-.18); ctx.bezierCurveTo(-.2,.2,.4,.3,.04,.63); ctx.bezierCurveTo(-.12,.94,-.36,.5,-.4,.31); ctx.bezierCurveTo(-.66,.11,-.43,-.23,-.8,-.42); ctx.fill();
  ctx.fillStyle = '#536f6528'; ctx.beginPath(); ctx.moveTo(.6,-.64); ctx.bezierCurveTo(.91,-.47,.87,.22,.47,.35); ctx.bezierCurveTo(.18,.19,.5,-.25,.35,-.31); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#bdd7cc13'; ctx.lineWidth = .012; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-.06,.12,(i + 1) * .28,.93,-.45,0,TAU); ctx.stroke(); }
  ctx.strokeStyle = '#d4e4da1c'; ctx.lineWidth = .022; ctx.beginPath(); ctx.moveTo(-1,-.15); ctx.bezierCurveTo(-.3,-.44,.1,.06,.8,-.13); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-.8,.39); ctx.bezierCurveTo(-.2,.14,.4,.55,.96,.12); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = '#5f929850'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(origin.x,origin.y,radiusPx,0,TAU); ctx.stroke();
  if (radiusPx > 14) { ctx.font = '7px ui-sans-serif, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#93b9af78'; ctx.fillText('EARTH',origin.x,origin.y+radiusPx*.1); }
}
function apsisMarkers(o, color, showLabels) {
  if (!o.bound || o.e < .004 || o.periapsis < EARTH_RADIUS) return;
  const unit = o.ev.map(v => v / o.e);
  [{ r: unit.map(v => v * o.periapsis), label: 'Pe' }, { r: unit.map(v => -v * o.apoapsis), label: 'Ap' }].forEach(item => {
    const p = project(item.r); if (p.x < 5 || p.x > width - 5 || p.y < 70 || p.y > height - 20) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,TAU); ctx.stroke();
    if (showLabels) { ctx.font = '8px ui-sans-serif, sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(item.label,p.x+8,p.y+3); }
  });
}
function draw() {
  if (!ctx || !current || width < 2 || height < 2) return;
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
  const bg = ctx.createRadialGradient(width*.57,height*.43,10,width*.55,height*.4,width*.7); bg.addColorStop(0,'#173032'); bg.addColorStop(1,'#102225'); ctx.fillStyle = bg; ctx.fillRect(0,0,width,height);
  // Fixed deterministic specks are visual reference marks, not celestial data.
  for (let i = 0; i < 78; i++) { const x = (Math.sin(i * 127.1 + 31.7) * 43758.5453 % 1 + 1) % 1 * width, y = (Math.sin(i * 269.5 + 12.3) * 15237.182 % 1 + 1) % 1 * height; ctx.fillStyle = i % 7 ? '#93b7aa22' : '#a2c2ae45'; ctx.fillRect(x,y,i % 7 ? 1 : 1.5,i % 7 ? 1 : 1.5); }
  const origin = project([0,0]), worldScale = camera.scale * zoom, radiusPx = EARTH_RADIUS * worldScale;
  // Range rings provide a spatial reference without overpowering the trajectories.
  ctx.lineWidth = .65; ctx.strokeStyle = '#6e9b8020'; ctx.setLineDash([2,7]);
  for (const multiple of [2,4,8,16,32,64]) { const r = radiusPx * multiple; if (r < Math.max(width,height)*1.8 && r > 20) { ctx.beginPath(); ctx.arc(origin.x,origin.y,r,0,TAU); ctx.stroke(); } }
  ctx.setLineDash([]); ctx.strokeStyle = '#71968013'; ctx.beginPath(); ctx.moveTo(0,origin.y); ctx.lineTo(width,origin.y); ctx.moveTo(origin.x,0); ctx.lineTo(origin.x,height); ctx.stroke();
  linePath(basePath.points,'#81b7ca8f',1.25);
  if (Math.hypot(draft.p,draft.r) > .5) linePath(candidatePath.points,'#c5e8a6',1.5,[5,5]);
  drawEarth(origin,radiusPx);
  apsisMarkers(baseElements,'#7ca2ad66',false); if (Math.hypot(draft.p,draft.r) > .5) apsisMarkers(candidateElements,'#b3d694b8',true);
  const ship = project(current.r); spacecraftPx = ship;
  if (candidatePath.collision && Math.hypot(draft.p,draft.r) > .5) {
    const end = project(candidatePath.points.at(-1)); ctx.strokeStyle = '#e3ad7b'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(end.x-4,end.y-4); ctx.lineTo(end.x+4,end.y+4); ctx.moveTo(end.x-4,end.y+4); ctx.lineTo(end.x+4,end.y-4); ctx.stroke();
  }
  const vnorm = norm(current.v); if (vnorm > 1e-6) arrow(ship,{x:ship.x+current.v[0]/vnorm*29,y:ship.y-current.v[1]/vnorm*29},'#80b1c05a',4,1);
  const magnitude = Math.hypot(draft.p,draft.r); handle = null;
  if (magnitude > .5 && !hasImpacted()) {
    const frame = localFrame(current), factor = .055 * Math.min(1, (width < 520 ? 98 : 138) / (magnitude * .055));
    const end = { x: ship.x + (frame.prograde[0]*draft.p+frame.radial[0]*draft.r)*factor, y: ship.y-(frame.prograde[1]*draft.p+frame.radial[1]*draft.r)*factor };
    arrow(ship,end,'#c7e9a7',6,1.6); ctx.fillStyle='#16312a'; ctx.strokeStyle='#cee8af'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(end.x,end.y,5,0,TAU); ctx.fill(); ctx.stroke();
    handle = { ...end, factor, frame };
    if (end.x > 10 && end.x < width - 85 && end.y > 115 && end.y < height - 50) { ctx.textAlign='left'; ctx.font='9px ui-monospace, monospace'; ctx.fillStyle='#bcdda0'; ctx.fillText(`Δv ${number(magnitude)} m/s`,end.x+10,end.y-9); }
  }
  ctx.fillStyle='#e4eee0'; ctx.strokeStyle='#173b30'; ctx.lineWidth=1.2; ctx.save(); ctx.translate(ship.x,ship.y); ctx.rotate(Math.atan2(-current.v[1],current.v[0])); ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-3,-4); ctx.lineTo(-1,0); ctx.lineTo(-3,4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.arc(ship.x,ship.y,9,0,TAU); ctx.strokeStyle='#dce9d733'; ctx.lineWidth=.7; ctx.stroke();
  if (ship.x > 10 && ship.x < width - 90 && ship.y > 112 && ship.y < height - 30) { ctx.textAlign='left'; ctx.font='7px ui-sans-serif, sans-serif'; ctx.fillStyle='#b8cbb497'; ctx.fillText(magnitude > .5 ? 'BURN POINT' : 'SPACECRAFT',ship.x+14,ship.y+17); }
  const desiredKm=70/worldScale, power=10**Math.floor(Math.log10(desiredKm)), niceKm=[1,2,5,10].map(n=>n*power).find(n=>n>=desiredKm)??10*power;
  $('scale-label').textContent=`${number(niceKm)} km`; $('scale-label').style.width=`${niceKm*worldScale}px`; $('scale-label').style.minWidth='0';
}

for (const [key, name] of [['p','prograde'],['r','radial']]) {
  $(name).addEventListener('input', e => updateDraft(key,Number(e.target.value)));
  $(`${name}-number`).addEventListener('input', e => { if (e.target.value !== '') updateDraft(key,Number(e.target.value)); });
  $(`${name}-number`).addEventListener('blur', syncDraftInputs);
}
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => { loadOrbit(...presets[button.dataset.preset],button.dataset.preset); notify(`${button.querySelector('strong').textContent} starting orbit loaded.`); }));
document.querySelectorAll('[data-recipe]').forEach(button => button.addEventListener('click', () => { const recipe = {raise:[400,0],lower:[-120,0],radial:[0,300]}[button.dataset.recipe]; setRecipe(...recipe); }));
$('orbit-form').addEventListener('submit', event => {
  event.preventDefault(); const peri=Number($('peri-input').value), apo=Number($('apo-input').value);
  if (!Number.isFinite(peri)||!Number.isFinite(apo)||peri<120||apo>100000||peri>100000||apo<peri) { $('orbit-error').textContent='Use 120–100,000 km, with apoapsis at least periapsis.'; return; }
  loadOrbit(peri,apo); notify('Custom starting orbit loaded. Previous maneuvers cleared.');
});
$('execute').addEventListener('click',executeBurn); $('undo').addEventListener('click',undoBurn);
$('clear-burn').addEventListener('click',()=>setRecipe(0,0));
$('reset').addEventListener('click',()=>{ const match=Object.entries(presets).find(([,alt])=>alt[0]===initialAltitudes[0]&&alt[1]===initialAltitudes[1]); loadOrbit(...initialAltitudes,match?.[0]); notify('Returned to the starting orbit.'); });
$('play').addEventListener('click',()=>{ if (!baseElements.bound&&simTime>=coastLimit()) simTime=0; setRunning(!running); });
$('warp').addEventListener('change',event=>{warp=Number(event.target.value);});
$('position').addEventListener('input',event=>{setRunning(false);simTime=coastLimit()*Number(event.target.value)/1000; refresh(true);});
$('rewind-impact').addEventListener('click',()=>{simTime=0;setRunning(false);refresh(true);});
$('fit').addEventListener('click',()=>{manualView=false;zoom=1;pan={x:0,y:0};fitCamera();draw();});
function changeZoom(multiplier) { manualView=true; zoom=Math.min(12,Math.max(.25,zoom*multiplier)); draw(); }
$('zoom-in').addEventListener('click',()=>changeZoom(1.3)); $('zoom-out').addEventListener('click',()=>changeZoom(1/1.3));
canvas.addEventListener('wheel',event=>{event.preventDefault();changeZoom(Math.exp(-Math.max(-100,Math.min(100,event.deltaY))*.003));},{passive:false});
canvas.addEventListener('pointerdown',event=>{
  if (!ctx) return; const rect=canvas.getBoundingClientRect(), x=event.clientX-rect.left,y=event.clientY-rect.top;
  const onHandle=handle&&Math.hypot(x-handle.x,y-handle.y)<21;
  pointer={id:event.pointerId,type:onHandle?'burn':'pan',x,y,pan:{...pan},handle:onHandle?{...handle,ship:{...spacecraftPx}}:null};
  if(onHandle)setRunning(false); canvas.setPointerCapture(event.pointerId); canvas.style.cursor=onHandle?'crosshair':'grabbing';
});
canvas.addEventListener('pointermove',event=>{
  const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  if(!pointer){canvas.style.cursor=handle&&Math.hypot(x-handle.x,y-handle.y)<21?'crosshair':'grab';return;}
  if(event.pointerId!==pointer.id)return;
  if(pointer.type==='pan'){manualView=true;pan={x:pointer.pan.x+x-pointer.x,y:pointer.pan.y+y-pointer.y};draw();}
  else {
    const h=pointer.handle, dx=(x-h.ship.x)/h.factor,dy=-(y-h.ship.y)/h.factor;
    draft.p=Math.max(-3500,Math.min(3500,Math.round((dx*h.frame.prograde[0]+dy*h.frame.prograde[1])/10)*10));
    draft.r=Math.max(-2500,Math.min(2500,Math.round((dx*h.frame.radial[0]+dy*h.frame.radial[1])/10)*10));
    syncDraftInputs();refresh(true,false);
  }
});
function releasePointer(event){if(pointer?.id===event.pointerId){pointer=null;canvas.style.cursor='grab';}}
canvas.addEventListener('pointerup',releasePointer);canvas.addEventListener('pointercancel',releasePointer);canvas.addEventListener('lostpointercapture',releasePointer);
const dialog=$('model-dialog');
function openModel(){setRunning(false);dialog.showModal();}
$('model').addEventListener('click',openModel);$('view-model').addEventListener('click',openModel);
$('close-model').addEventListener('click',()=>dialog.close());$('got-it').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();$('fit').click();});
window.addEventListener('keydown',event=>{
  if(event.code==='Space'&&!dialog.open&&!['INPUT','SELECT','BUTTON','TEXTAREA','SUMMARY'].includes(document.activeElement.tagName)){event.preventDefault();$('play').click();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setRunning(false);});
if(!ctx)$('canvas-fallback').hidden=false;
rebuildBase();updateLog();refresh(true);resize();
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
function frame(timestamp){
  const dt=lastFrame?Math.min(.15,(timestamp-lastFrame)/1000):0;lastFrame=timestamp;
  if(running){
    const next=simTime+dt*warp,limit=coastLimit();
    if(baseImpact!==null&&next>=limit){simTime=limit;setRunning(false);refresh(true,false);notify('Surface intercept reached. The simulation has stopped at Earth.');}
    else if(!baseElements.bound&&next>=limit){simTime=limit;setRunning(false);refresh(true,false);notify('Six-hour escape window reached. Scrub back or plan another burn.');}
    else{simTime=next;current=propagate(base,simTime);if(timestamp-lastPreview>150){refresh(false,false);lastPreview=timestamp;}else updateTelemetry();}
  }
  draw();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
