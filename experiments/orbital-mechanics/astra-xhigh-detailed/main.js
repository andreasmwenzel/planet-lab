import './style.css';
import { MU, EARTH_RADIUS as R, TAU, norm, elements, makeOrbit, propagate, burn, hohmann, advance, orbitPath, cloneState } from './physics.mjs';

const $ = id => document.getElementById(id);
const fmt = (value, digits = 0) => Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = value => `${value >= 0 ? '+' : '−'}${fmt(Math.abs(value), 1)}`;
const altitude = r => Number.isFinite(r) ? `${fmt(r - R)} km` : 'Open trajectory';
const duration = seconds => seconds < 3600 ? `${fmt(seconds / 60, 1)} min` : `${fmt(seconds / 3600, 2)} h`;
const clock = seconds => {
  const t = Math.max(0, Math.floor(seconds));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
};
const toggled = (id, hidden) => $(id).classList.toggle('hidden', hidden);
let initial = makeOrbit(400), state = cloneState(initial), simTime = 0, playing = false, warp = 100;
let mode = 'transfer', plan = { ...hohmann(state, 1200), stage: 'departure' };
let flightNumber = 1, initialName = '400 km parking orbit', title = initialName;
let impacted = false, totalDv = 0, history = [], logs = [];
let labels = true, vectors = false, lastFrame = 0, lastUI = 0, toastTimer;
let confirmAction = null, viewNotification = '', errorMessage = '';
const MAX_TIME = 30 * 86400;
const camera = { scale: 1, panX: 0, panY: 0, initialized: false, automatic: true };
const canvas = $('orbit-canvas'), viewport = $('viewport');
const ctx = canvas.getContext('2d');
let width = 0, height = 0, dpr = 1, pointer = null;
const stars = Array.from({ length: 100 }, (_, i) => ({ x: frac(Math.sin(i * 127.1 + 2) * 43758.5453), y: frac(Math.sin(i * 311.7 + 5) * 17531.13), size: i % 4 === 0 ? 1 : .55 }));
function frac(x) { return x - Math.floor(x); }

function notify(message) {
  $('toast').textContent = message; toggled('toast', false);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toggled('toast', true), 4200);
}
function log(message, value = '') {
  logs.unshift({ time: simTime, message, value });
  if (logs.length > 80) logs.pop();
  renderLog();
}
function renderLog() {
  $('log-list').replaceChildren(...logs.map(entry => {
    const li = document.createElement('li');
    for (const [cls, value] of [['log-time', clock(entry.time)], ['log-name', entry.message], ['log-value', entry.value]]) {
      const span = document.createElement('span'); span.className = cls; span.textContent = value; li.append(span);
    }
    return li;
  }));
  $('log-count').textContent = String(logs.length).padStart(2, '0');
  $('undo').disabled = history.length === 0;
}
function pause() { playing = false; renderTransport(); }
function renderTransport() {
  $('play-symbol').textContent = playing ? 'Ⅱ' : '▶';
  $('play-label').textContent = playing ? 'Pause' : 'Play';
  $('play').setAttribute('aria-label', playing ? 'Pause simulation' : 'Play simulation');
  const waitingAtArrival = plan?.stage === 'arrival';
  $('play').disabled = impacted || simTime >= MAX_TIME || waitingAtArrival;
  $('step').disabled = impacted || simTime >= MAX_TIME || waitingAtArrival;
  $('play').title = waitingAtArrival ? 'Execute the arrival burn or cancel the plan before continuing.' : 'Play / pause (Space)';
  $('step').title = waitingAtArrival ? 'Execute the arrival burn or cancel the plan before continuing.' : 'Advance 60 simulated seconds';
  $('live-badge').innerHTML = `<span></span> ${impacted ? 'SURFACE ENCOUNTER' : playing ? 'PROPAGATING' : 'PAUSED'}`;
  $('live-badge').classList.toggle('running', playing);
  for (const button of document.querySelectorAll('[data-warp]')) {
    const selected = Number(button.dataset.warp) === warp;
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
  }
}
function snapshot() {
  history.push({ state: cloneState(state), simTime, plan: plan ? structuredClone(plan) : null, totalDv, logs: structuredClone(logs), title, mode, target: $('target-altitude').value, transverse: $('transverse').value, radial: $('radial').value });
  if (history.length > 20) history.shift();
}
function previewState() {
  if (impacted) return null;
  try {
    if (mode === 'manual') return burn(state, readBurn().transverse, readBurn().radial);
    if (plan?.stage === 'departure') return burn(state, plan.departure);
    if (plan?.stage === 'arrival') return burn(state, plan.arrival);
  } catch { return null; }
  return null;
}
function readBurn() {
  const tv = $('transverse').value, rv = $('radial').value;
  if (tv.trim() === '' || rv.trim() === '') throw new Error('Enter both burn components.');
  const transverse = Number(tv), radial = Number(rv);
  if (!Number.isFinite(transverse) || !Number.isFinite(radial)) throw new Error('Enter a valid number for each component.');
  if (Math.hypot(transverse, radial) < 0.001) throw new Error('Enter a nonzero burn to preview a change.');
  return { transverse, radial };
}
function setMode(next) {
  mode = next;
  const transfer = mode === 'transfer';
  $('transfer-tab').classList.toggle('selected', transfer); $('manual-tab').classList.toggle('selected', !transfer);
  $('transfer-tab').setAttribute('aria-selected', String(transfer)); $('manual-tab').setAttribute('aria-selected', String(!transfer));
  $('transfer-tab').tabIndex = transfer ? 0 : -1; $('manual-tab').tabIndex = transfer ? -1 : 0;
  toggled('transfer-panel', !transfer); toggled('manual-panel', transfer);
  renderUI();
}
function requestConfirmation(heading, copy, label, action) {
  pause(); confirmAction = action;
  $('confirm-title').textContent = heading; $('confirm-copy').textContent = copy; $('confirm-yes').textContent = label;
  $('confirm-dialog').showModal();
}
function configurePlan() {
  pause();
  try {
    if (impacted) throw new Error('Load or reset a flight after a surface encounter.');
    const input = $('target-altitude').value;
    if (!input.trim()) throw new Error('Enter a target altitude.');
    plan = { ...hohmann(state, Number(input)), stage: 'departure' };
    errorMessage = ''; viewNotification = ''; camera.automatic = true; fitView();
    notify(`Plan ready: ${fmt(plan.totalDeltaV, 1)} m/s across two burns.`);
  } catch (error) { errorMessage = error.message; }
  renderUI();
}
function executeMission() {
  if (!plan || impacted) return;
  pause();
  if (plan.stage === 'departure') {
    if (Number($('target-altitude').value) !== plan.targetAltitude) { notify('Select Plan to calculate your edited target first.'); return; }
    snapshot();
    state = burn(state, plan.departure);
    totalDv += Math.abs(plan.departure);
    plan.stage = 'coast'; plan.departureTime = simTime; plan.arrivalTime = simTime + plan.duration;
    title = `${fmt(plan.r1 - R)} → ${fmt(plan.targetAltitude)} km transfer`;
    log('Departure burn executed', `${signed(plan.departure)} m/s`);
    notify('Departure complete. Play the coast, or jump directly to arrival.');
  } else if (plan.stage === 'coast') {
    tick(Math.max(0, plan.arrivalTime - simTime));
    notify(impacted ? 'Flight stopped at the surface.' : 'At arrival. Execute the second burn to circularize.');
  } else if (plan.stage === 'arrival') {
    snapshot();
    state = burn(state, plan.arrival);
    totalDv += Math.abs(plan.arrival); plan.stage = 'complete';
    const el = elements(state);
    title = `${fmt(el.radius - R)} km circular orbit`;
    log('Arrival burn executed · transfer complete', `${signed(plan.arrival)} m/s`);
    viewNotification = `Target reached · ${fmt(plan.targetAltitude)} km circular orbit`;
    notify(`Transfer complete. ${fmt(plan.totalDeltaV, 1)} m/s total Δv.`);
  } else if (plan.stage === 'complete') {
    plan = null; errorMessage = ''; viewNotification = '';
    $('target-altitude').disabled = false; $('target-altitude').focus(); $('target-altitude').select();
  }
  renderUI();
}
function executeFreeBurn() {
  pause();
  let components, next;
  try { components = readBurn(); next = burn(state, components.transverse, components.radial); }
  catch (error) { notify(error.message); return; }
  if (impacted) return;
  const perform = () => {
    snapshot();
    state = next;
    const magnitude = Math.hypot(components.transverse, components.radial);
    totalDv += magnitude; plan = null; errorMessage = ''; viewNotification = '';
    title = 'Free-flight maneuver';
    log('Free burn executed', `${fmt(magnitude, 1)} m/s Δv`);
    $('transverse').value = '0'; $('radial').value = '0';
    camera.automatic = true; fitView(); renderUI();
    notify(`Burn complete. ${fmt(totalDv, 1)} m/s used this flight. Undo rewinds to before this burn.`);
  };
  if (plan && ['coast', 'arrival'].includes(plan.stage)) requestConfirmation('Replace the guided plan?', 'This free burn cancels the remaining guided transfer. Completed burns stay in your flight. Undo last burn can rewind this change.', 'Execute free burn', perform);
  else perform();
}
function tick(seconds) {
  if (impacted || seconds < 0) return;
  let dt = Math.min(seconds, MAX_TIME - simTime);
  if (plan?.stage === 'coast') dt = Math.min(dt, Math.max(0, plan.arrivalTime - simTime));
  try {
    const result = advance(state, dt);
    state = result.state; simTime += result.elapsed;
    if (result.impacted) {
      impacted = true; pause();
      viewNotification = 'Surface encounter. Flight stopped. Undo the last burn or reset to recover.';
      log('Surface encounter · propagation stopped', 'Altitude 0 km');
    } else if (plan?.stage === 'coast' && simTime >= plan.arrivalTime - 1e-6) {
      plan.stage = 'arrival'; pause();
      viewNotification = 'Arrival point reached. Ready for the circularization burn.';
      log('Transfer arrival reached', 'Awaiting burn');
    } else if (simTime >= MAX_TIME - 1e-6) {
      pause(); viewNotification = '30-day flight limit reached. Reset or load an orbit to begin again.';
    }
  } catch (error) {
    pause(); viewNotification = error.message; log('Propagation paused', 'Numerical safeguard');
  }
}
function loadFlight(next, name) {
  pause(); initial = cloneState(next); state = cloneState(next); initialName = name; title = name;
  simTime = 0; impacted = false; totalDv = 0; history = []; logs = []; plan = null;
  errorMessage = ''; viewNotification = ''; flightNumber++;
  $('transverse').value = 100; $('radial').value = 0;
  const el = elements(state);
  if (el.e < 1e-8) {
    const target = Math.abs(el.radius - R - 1200) > 1 ? 1200 : 2000;
    $('target-altitude').value = target;
    plan = { ...hohmann(state, target), stage: 'departure' }; setMode('transfer');
  } else setMode('manual');
  log('Orbit loaded · ready to fly', name);
  camera.automatic = true; fitView(); renderUI();
}
function pendingOrbit() {
  const preset = $('preset').value;
  if (preset === 'parking') return { state: makeOrbit(400), name: '400 km parking orbit' };
  if (preset === 'transfer') return { state: makeOrbit(250, 35786), name: 'Geotransfer orbit' };
  if (preset === 'elliptic') return { state: makeOrbit(600, 39700), name: 'High elliptical orbit' };
  if (preset === 'escape') {
    const next = makeOrbit(600); next.v = next.v.map(v => v * Math.sqrt(2) * 1.08);
    return { state: next, name: 'Earth escape trajectory' };
  }
  const p = $('custom-perigee').value, a = $('custom-apogee').value;
  if (!p.trim() || !a.trim()) throw new Error('Enter both perigee and apogee altitudes.');
  return { state: makeOrbit(Number(p), Number(a)), name: Number(p) === Number(a) ? `${fmt(p)} km parking orbit` : `${fmt(p)} × ${fmt(a)} km orbit` };
}
function loadRequested() {
  let next;
  try { next = pendingOrbit(); } catch (error) { notify(error.message); $('setup-note').textContent = error.message; return; }
  const apply = () => { loadFlight(next.state, next.name); $('setup-note').textContent = 'Orbit loaded. Loading again starts a new flight.'; notify(`${next.name} loaded.`); };
  if (simTime > 0 || history.length > 0) requestConfirmation('Start a new flight?', 'Loading an orbit clears this flight’s time, burn history, and maneuver plan. The current flight cannot be recovered after loading.', 'Load orbit', apply);
  else apply();
}
function renderUI() {
  const el = elements(state);
  $('flight-title').textContent = title; $('flight-number').textContent = `FLIGHT ${String(flightNumber).padStart(3, '0')}`;
  $('sim-time').textContent = clock(simTime); $('view-altitude').textContent = fmt(Math.max(0, el.radius - R));
  $('stat-perigee').innerHTML = `${fmt(el.periapsis - R)} <small>km</small>`;
  $('stat-apogee').innerHTML = Number.isFinite(el.apoapsis) ? `${fmt(el.apoapsis - R)} <small>km</small>` : '—';
  $('stat-speed').innerHTML = `${fmt(el.speed, 3)} <small>km/s</small>`;
  $('stat-period').innerHTML = Number.isFinite(el.period) ? `${fmt(el.period / (el.period > 36000 ? 3600 : 60), 1)} <small>${el.period > 36000 ? 'h' : 'min'}</small>` : '—';
  $('stat-ecc').textContent = fmt(el.e, 4);
  $('orbit-class').textContent = impacted ? 'SURFACE ENCOUNTER' : el.e < 1e-4 ? 'CIRCULAR' : el.bound ? 'ELLIPTICAL' : Math.abs(el.e - 1) < 1e-7 ? 'PARABOLIC' : 'HYPERBOLIC';
  let warning = '';
  if (el.periapsis < R) warning = impacted ? 'Surface encounter. The flight is stopped at Earth’s surface. Undo a burn or reset to recover.' : 'Surface-intersecting trajectory. Propagation will stop at the next inbound surface encounter.';
  else if (el.periapsis - R < 120) warning = 'Perigee is below 120 km. Atmospheric effects would matter here; this model does not include drag.';
  else if (!el.bound) warning = 'Escape trajectory: no closed orbit, apogee, or orbital period. Fit view shows a bounded portion of the path.';
  toggled('orbit-warning', !warning); $('orbit-warning').textContent = warning;
  toggled('view-message', !viewNotification); $('view-message').textContent = viewNotification;
  const pState = previewState();
  toggled('preview-legend', !pState); toggled('target-legend', !plan);
  renderTransport(); renderPlan(); renderManual();
}
function renderPlan() {
  toggled('plan-error', !errorMessage); $('plan-error').textContent = errorMessage;
  toggled('plan-content', !plan); toggled('empty-plan', !!plan);
  const inProgress = plan && ['coast', 'arrival'].includes(plan.stage);
  $('target-altitude').disabled = Boolean(inProgress) || impacted;
  $('plan-transfer').disabled = Boolean(inProgress) || impacted;
  toggled('cancel-plan', !inProgress || impacted);
  const dirty = plan?.stage === 'departure' && Number($('target-altitude').value) !== plan.targetAltitude;
  $('target-hint').textContent = inProgress ? 'Target locked during the transfer. Cancel the plan to change it.' : dirty ? 'Target changed. Select Plan to update the preview.' : '120–100,000 km above Earth’s surface';
  if (!plan) return;
  $('plan-dv').innerHTML = `${fmt(plan.totalDeltaV, 1)}<small> m/s</small>`;
  $('plan-time').innerHTML = plan.duration < 3600 ? `${fmt(plan.duration / 60, 1)}<small> min</small>` : `${fmt(plan.duration / 3600, 2)}<small> h</small>`;
  $('departure-dv').textContent = `${signed(plan.departure)} m/s`;
  $('arrival-dv').textContent = `${signed(plan.arrival)} m/s`;
  $('coast-time').textContent = plan.stage === 'coast' ? duration(Math.max(0, plan.arrivalTime - simTime)) : duration(plan.duration);
  $('departure-detail').textContent = plan.r2 > plan.r1 ? 'Add speed to raise your apogee.' : 'Reduce speed to lower your perigee.';
  $('coast-detail').textContent = plan.stage === 'coast' ? 'Remaining until automatic pause.' : 'Let gravity do the work.';
  $('arrival-detail').textContent = 'Round out your new orbit.';
  const stageIndex = ['departure', 'coast', 'arrival', 'complete'].indexOf(plan.stage);
  ['departure', 'coast', 'arrival'].forEach((step, i) => {
    const li = $(`${step}-step`); li.classList.toggle('active', i === stageIndex); li.classList.toggle('done', i < stageIndex);
    li.querySelector('.step-circle').textContent = i < stageIndex ? '✓' : String(i + 1);
  });
  let text, button;
  if (plan.stage === 'departure') {
    text = 'The dashed path is your orbit after this burn. Nothing changes until you execute.';
    button = 'Execute departure';
  } else if (plan.stage === 'coast') {
    text = 'Departure complete. Press Play to watch the coast, or jump ahead. Time pauses automatically at arrival.';
    button = 'Coast to arrival';
  } else if (plan.stage === 'arrival') {
    text = 'You’ve reached the opposite side. The arrival burn makes your velocity match the target circular orbit.';
    button = 'Execute arrival';
  } else {
    const err = Math.abs(elements(state).radius - R - plan.targetAltitude);
    text = `Transfer complete. Target radius error: ${fmt(err, 3)} km. Total burn budget: ${fmt(plan.totalDeltaV, 1)} m/s.`;
    button = 'Plan another transfer';
  }
  $('mission-note').querySelector('p').textContent = text;
  $('mission-action').innerHTML = `${button} <span aria-hidden="true">${plan.stage === 'complete' ? '↗' : '→'}</span>`;
  $('mission-action').disabled = impacted || dirty;
}
function renderManual() {
  toggled('manual-plan-warning', !plan || !['coast', 'arrival'].includes(plan.stage));
  try {
    const components = readBurn(), next = burn(state, components.transverse, components.radial), el = elements(next);
    $('manual-dv').textContent = `${fmt(Math.hypot(components.transverse, components.radial), 1)} m/s`;
    $('preview-perigee').textContent = altitude(el.periapsis);
    $('preview-apogee').textContent = Number.isFinite(el.apoapsis) ? altitude(el.apoapsis) : 'No apogee';
    let message = 'Preview only. Your spacecraft has not changed.';
    let danger = false;
    if (el.periapsis < R) { message = 'Warning: this orbit intersects Earth. The flight will stop at the surface.'; danger = true; }
    else if (el.periapsis - R < 120) { message = 'Perigee below 120 km. Drag is not modeled.'; danger = true; }
    else if (!el.bound) message = 'This burn produces an open escape trajectory.';
    $('preview-warning').textContent = message; $('preview-warning').classList.toggle('danger', danger);
    $('apply-manual').disabled = impacted;
  } catch (error) {
    $('manual-dv').textContent = '—'; $('preview-perigee').textContent = '—'; $('preview-apogee').textContent = '—';
    $('preview-warning').textContent = error.message; $('preview-warning').classList.remove('danger');
    $('apply-manual').disabled = true;
  }
}

// Canvas is an inertial, top-down projection of the actual Cartesian positions.
function fitView() {
  const base = elements(state), limit = Math.max(150000, base.radius * 1.4);
  const points = [[R, 0], [-R, 0], [0, R], [0, -R], state.r];
  const currentLimit = base.bound ? limit : Math.max(R * 5, base.radius * 1.4);
  points.push(...orbitPath(state, currentLimit, 240).filter(Boolean));
  const preview = previewState();
  if (preview) points.push(...orbitPath(preview, elements(preview).bound ? limit : currentLimit, 240).filter(Boolean));
  if (plan) points.push([plan.r2, 0], [-plan.r2, 0], [0, plan.r2], [0, -plan.r2]);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  camera.scale = Math.min(width * .76 / (maxX - minX), height * .67 / (maxY - minY));
  camera.panX = -(maxX + minX) / 2 * camera.scale;
  camera.panY = (maxY + minY) / 2 * camera.scale;
  camera.initialized = true;
}
function resize() {
  const rect = viewport.getBoundingClientRect(); width = rect.width; height = rect.height;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  if (camera.automatic || !camera.initialized) fitView();
}
function screen(point) { return [width * .53 + camera.panX + point[0] * camera.scale, height * .53 + camera.panY - point[1] * camera.scale]; }
function linePath(points, color, thickness = 1, dash = []) {
  ctx.beginPath(); let open = false;
  for (const p of points) {
    if (!p) { open = false; continue; }
    const q = screen(p);
    if (!open) { ctx.moveTo(...q); open = true; } else ctx.lineTo(...q);
  }
  ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
}
function labelAt(point, text, color, offset = [14, -17], dot = true) {
  const q = screen(point), x = q[0] + offset[0], y = q[1] + offset[1];
  if (x < 15 || x > width - 95 || y < 45 || y > height - 65) return;
  if (dot) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = color; ctx.globalAlpha = .45; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(...q); ctx.lineTo(x - 4, y + 5); ctx.lineTo(x + 8, y + 5); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.font = '9px Arial'; ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function earth() {
  const center = screen([0, 0]), radius = R * camera.scale;
  ctx.save(); ctx.translate(...center);
  const halo = ctx.createRadialGradient(0, 0, radius * .96, 0, 0, radius * 1.17);
  halo.addColorStop(0, '#80995c22'); halo.addColorStop(.5, '#7393670c'); halo.addColorStop(1, '#73936700');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, radius * 1.17, 0, TAU); ctx.fill();
  const water = ctx.createRadialGradient(-radius * .38, -radius * .45, radius * .01, radius * .25, radius * .24, radius * 1.35);
  water.addColorStop(0, '#345c48'); water.addColorStop(.55, '#234736'); water.addColorStop(1, '#10291f');
  ctx.fillStyle = water; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, radius - .5, 0, TAU); ctx.clip(); ctx.scale(radius, radius);
  const continents = [
    [[-.99,-.28],[-.82,-.55],[-.62,-.66],[-.48,-.63],[-.41,-.75],[-.23,-.69],[-.14,-.56],[-.2,-.44],[-.34,-.39],[-.37,-.2],[-.5,-.17],[-.46,-.05],[-.31,.03],[-.34,.16],[-.43,.13],[-.49,.01],[-.58,-.05],[-.65,-.18],[-.8,-.13]],
    [[-.32,.1],[-.14,.15],[-.02,.3],[-.04,.44],[-.17,.57],[-.21,.79],[-.34,.9],[-.39,.69],[-.44,.49],[-.48,.29],[-.42,.17]],
    [[.03,-.93],[.21,-.84],[.25,-.72],[.05,-.61],[-.06,-.77]],
    [[.17,-.45],[.24,-.57],[.38,-.61],[.44,-.76],[.68,-.78],[.8,-.59],[.97,-.48],[1,-.13],[.85,-.06],[.7,-.16],[.61,-.12],[.5,-.3],[.36,-.29],[.31,-.16],[.44,-.07],[.53,.12],[.43,.39],[.3,.49],[.24,.3],[.15,.17],[.12,-.01],[.04,-.11],[.09,-.25],[.24,-.28]],
    [[.64,.38],[.78,.3],[.94,.44],[.89,.59],[.73,.62],[.63,.51]],
    [[.88,.75],[.93,.69],[.96,.75],[.9,.84]],
    [[-.55,.93],[-.18,.86],[.11,.93],[.52,.9],[.68,1.1],[-.7,1.1]]
  ];
  ctx.fillStyle = '#62805c'; ctx.globalAlpha = .37;
  for (const points of continents) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.lineWidth = .004; ctx.strokeStyle = '#94b0801a';
  for (const latitude of [-.65, -.33, 0, .33, .65]) { ctx.beginPath(); ctx.ellipse(0, latitude, Math.sqrt(1 - latitude * latitude), .10 * (1 - Math.abs(latitude)), -.23, 0, TAU); ctx.stroke(); }
  for (const longitude of [.25,.58,.84]) { ctx.beginPath(); ctx.ellipse(0,0,longitude,1,-.23,0,TAU); ctx.stroke(); }
  ctx.restore();
  const shadow = ctx.createLinearGradient(-radius,-radius,radius,radius);
  shadow.addColorStop(0,'#c4d59009'); shadow.addColorStop(.6,'#10251e00'); shadow.addColorStop(1,'#081a17aa');
  ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(0,0,radius,0,TAU); ctx.fill();
  ctx.strokeStyle = '#86a17865'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0,0,radius,0,TAU); ctx.stroke();
  if (labels && radius > 50) { ctx.textAlign = 'center'; ctx.font = '9px Arial'; ctx.fillStyle = '#9fb18caa'; ctx.fillText('E A R T H', 0, radius * .08); ctx.font = '7px Arial'; ctx.fillStyle = '#82967888'; ctx.fillText('R  6,371 km', 0, radius * .08 + 14); ctx.textAlign = 'left'; }
  ctx.restore();
}
function arrow(from, vector, color, length, label) {
  const len = norm(vector); if (len < 1e-9) return;
  const q = screen(from), dx = vector[0] / len * length, dy = -vector[1] / len * length;
  const x = q[0] + dx, y = q[1] + dy, angle = Math.atan2(dy, dx);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...q); ctx.lineTo(x, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-6*Math.cos(angle-.45),y-6*Math.sin(angle-.45));ctx.lineTo(x-6*Math.cos(angle+.45),y-6*Math.sin(angle+.45));ctx.closePath();ctx.fill();
  ctx.font='9px Arial';ctx.fillText(label,x+5,y-5);
}
function draw() {
  if (!ctx || !width) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  const bg = ctx.createRadialGradient(width*.55,height*.48,0,width*.5,height*.5,width*.8);
  bg.addColorStop(0,'#1b3129'); bg.addColorStop(1,'#10231f'); ctx.fillStyle = bg; ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#b1c1a4';
  stars.forEach(star=>{ctx.globalAlpha=star.size===1?.12:.07;ctx.fillRect(star.x*width,star.y*height,star.size,star.size)});ctx.globalAlpha=1;
  const center=screen([0,0]);
  ctx.strokeStyle='#9bb99208';ctx.lineWidth=.5;ctx.setLineDash([2,5]);
  ctx.beginPath();ctx.moveTo(center[0],0);ctx.lineTo(center[0],height);ctx.moveTo(0,center[1]);ctx.lineTo(width,center[1]);ctx.stroke();ctx.setLineDash([]);
  let gridStep=R;while(gridStep*camera.scale<48)gridStep*=2;
  for(let i=1;i<=6;i++){const rad=gridStep*i*camera.scale;if(rad>Math.max(width,height)*1.5)break;ctx.beginPath();ctx.arc(...center,rad,0,TAU);ctx.strokeStyle='#a1ba8b09';ctx.stroke()}
  if(plan){ctx.beginPath();ctx.arc(...center,plan.r2*camera.scale,0,TAU);ctx.strokeStyle='#91b47365';ctx.lineWidth=1;ctx.setLineDash([1.5,5]);ctx.stroke();ctx.setLineDash([])}
  const maxRadius=Math.max(180000,norm(state.r)*2,Math.max(width,height)/Math.max(camera.scale,.000001)*3);
  linePath(orbitPath(state,maxRadius),'#d7e2bdc9',1.3);
  const preview=previewState();
  if(preview)linePath(orbitPath(preview,maxRadius),'#ffad86ba',1.35,[5,5]);
  earth();
  const el=elements(state);
  // A short time-sampled trail communicates direction without distorting the conic.
  if(!impacted){
    const trailTime=Math.min(Number.isFinite(el.period)?el.period*.085:900,1200),trail=[];
    for(let i=0;i<=26;i++){
      try{const past=propagate(state,-trailTime*(1-i/26));trail.push(norm(past.r)>=R?past.r:null)}catch{trail.push(null)}
    }
    for(let i=1;i<trail.length;i++)if(trail[i-1]&&trail[i])linePath([trail[i-1],trail[i]],`rgba(224,241,177,${i/100})`,2.2);
  }
  if(labels&&el.e>0.001&&el.bound){
    const unit=[Math.cos(el.argument),Math.sin(el.argument)];
    if(el.periapsis>=R)labelAt(unit.map(v=>v*el.periapsis),`Pe ${fmt(el.periapsis-R)} km`,'#8fa686',[10,20]);
    labelAt(unit.map(v=>-v*el.apoapsis),`Ap ${fmt(el.apoapsis-R)} km`,'#a6b595',[10,-15]);
  }
  if(labels&&preview){
    const ep=elements(preview);
    if(ep.bound&&ep.e>0.001&&ep.apoapsis-R>el.apoapsis-R+50){const u=[Math.cos(ep.argument),Math.sin(ep.argument)];labelAt(u.map(v=>-v*ep.apoapsis),`Ap ${fmt(ep.apoapsis-R)} km`,'#dc9c78',[12,-19])}
  }
  const ship=screen(state.r);
  if(vectors&&!impacted){arrow(state.r,state.v,'#cde4ac',55,'v');if(preview){const dv=preview.v.map((v,i)=>v-state.v[i]);arrow(state.r,dv,'#ffad86',Math.min(85,25+norm(dv)*60),'Δv')}}
  if(ship[0]>-15&&ship[0]<width+15&&ship[1]>-15&&ship[1]<height+15){
    const glow=ctx.createRadialGradient(...ship,1,...ship,18);glow.addColorStop(0,'#d6f28b44');glow.addColorStop(1,'#d6f28b00');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(...ship,18,0,TAU);ctx.fill();
    ctx.strokeStyle=impacted?'#eda07b':'#d5efa4';ctx.lineWidth=1;ctx.beginPath();ctx.arc(...ship,6.5,0,TAU);ctx.stroke();ctx.fillStyle=impacted?'#eda07b':'#e6f4c5';ctx.beginPath();ctx.arc(...ship,3,0,TAU);ctx.fill();
    if(labels)labelAt(state.r,impacted?'SURFACE ENCOUNTER':'SPACECRAFT','#c8dca6',ship[0]>width*.7?[-105,-25]:[17,-25],false);
  }else if(labels){ctx.font='10px Arial';ctx.fillStyle='#b2c496';ctx.fillText('Spacecraft is off-screen · select Fit',Math.max(20,width*.5-85),height-78)}
  // Scale bar and inertial axes, both tied to the current camera scale.
  const scaleGoal=65/Math.max(camera.scale,.000001),magnitude=10**Math.floor(Math.log10(scaleGoal));
  const scaleKm=[1,2,5,10].map(n=>n*magnitude).reduce((a,b)=>Math.abs(b-scaleGoal)<Math.abs(a-scaleGoal)?b:a);
  const px=scaleKm*camera.scale,y=height-79;
  ctx.strokeStyle='#6b877155';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(24,y-3);ctx.lineTo(24,y+3);ctx.moveTo(24,y);ctx.lineTo(24+px,y);ctx.moveTo(24+px,y-3);ctx.lineTo(24+px,y+3);ctx.stroke();ctx.font='7px Arial';ctx.fillStyle='#75917d';ctx.fillText(`${fmt(scaleKm)} km`,24,y-8);
}
function frame(timestamp) {
  if(lastFrame&&playing){tick(Math.min((timestamp-lastFrame)/1000,.15)*warp)}
  lastFrame=timestamp;
  if(timestamp-lastUI>120){renderUI();lastUI=timestamp}
  draw(); requestAnimationFrame(frame);
}

$('play').addEventListener('click',()=>{if(impacted)return;playing=!playing;if(playing)viewNotification='';renderUI()});
$('step').addEventListener('click',()=>{pause();viewNotification='';tick(60);renderUI()});
for(const button of document.querySelectorAll('[data-warp]'))button.addEventListener('click',()=>{warp=Number(button.dataset.warp);renderTransport()});
$('transfer-tab').addEventListener('click',()=>setMode('transfer'));$('manual-tab').addEventListener('click',()=>setMode('manual'));
for(const id of ['transfer-tab','manual-tab'])$(id).addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setMode(mode==='transfer'?'manual':'transfer');$(mode==='transfer'?'transfer-tab':'manual-tab').focus()}});
$('target-altitude').addEventListener('input',()=>{errorMessage='';renderPlan()});
$('target-altitude').addEventListener('keydown',e=>{if(e.key==='Enter')configurePlan()});
$('plan-transfer').addEventListener('click',configurePlan);$('mission-action').addEventListener('click',executeMission);
$('cancel-plan').addEventListener('click',()=>requestConfirmation('Cancel the remaining plan?','Your spacecraft keeps its current orbit. Completed burns stay in the flight log. You can circularize with a free burn or undo the last burn.','Cancel plan',()=>{plan=null;errorMessage='';viewNotification='';log('Remaining transfer plan canceled');renderUI();notify('Plan canceled. The current orbit is unchanged.')}));
for(const id of ['transverse','radial'])$(id).addEventListener('input',()=>{renderManual();if(camera.automatic)fitView()});
for(const button of document.querySelectorAll('[data-burn]'))button.addEventListener('click',()=>{const [t,r]=button.dataset.burn.split(',');$('transverse').value=t;$('radial').value=r;renderUI();if(camera.automatic)fitView()});
$('circularize').addEventListener('click',()=>{pause();const el=elements(state);$('transverse').value=((Math.sqrt(MU/el.radius)-Math.abs(el.tangentialSpeed))*1000).toFixed(3);$('radial').value=(-el.radialSpeed*1000).toFixed(3);renderUI();if(camera.automatic)fitView();notify('Circularization preview loaded. Execute burn to apply it.')});
$('apply-manual').addEventListener('click',executeFreeBurn);
$('preset').addEventListener('change',()=>{toggled('custom-fields',$('preset').value!=='custom');$('setup-note').textContent='Select Load to start a new flight with this orbit.'});
$('load-orbit').addEventListener('click',loadRequested);
$('undo').addEventListener('click',()=>{
  const snap=history.pop();if(!snap)return;pause();state=cloneState(snap.state);simTime=snap.simTime;plan=snap.plan;totalDv=snap.totalDv;logs=snap.logs;title=snap.title;impacted=false;viewNotification='';errorMessage='';$('target-altitude').value=snap.target;$('transverse').value=snap.transverse;$('radial').value=snap.radial;setMode(snap.mode);log('Last burn undone · flight rewound');camera.automatic=true;fitView();renderUI();notify('Rewound to just before the last burn.');
});
$('reset').addEventListener('click',()=>requestConfirmation('Reset this flight?','This clears the flight time, burns, and maneuver plan. You’ll return to the last loaded starting orbit.','Reset flight',()=>{const previousNumber=flightNumber;loadFlight(initial,initialName);flightNumber=previousNumber;renderUI();notify('Flight reset to its starting orbit.')}));
$('confirm-cancel').addEventListener('click',()=>{$('confirm-dialog').close();confirmAction=null});
$('confirm-yes').addEventListener('click',()=>{const action=confirmAction;confirmAction=null;$('confirm-dialog').close();action?.()});
$('confirm-dialog').addEventListener('cancel',()=>{confirmAction=null});
for(const id of ['model-open','model-open-bottom'])$(id).addEventListener('click',()=>{pause();$('model-dialog').showModal()});
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>$(button.dataset.close).close());
$('toggle-labels').addEventListener('click',()=>{labels=!labels;$('toggle-labels').classList.toggle('active',labels);$('toggle-labels').setAttribute('aria-pressed',String(labels))});
$('toggle-vectors').addEventListener('click',()=>{vectors=!vectors;$('toggle-vectors').classList.toggle('active',vectors);$('toggle-vectors').setAttribute('aria-pressed',String(vectors))});
function zoom(multiplier){camera.scale=Math.max(.00008,Math.min(.09,camera.scale*multiplier));camera.automatic=false}
$('zoom-in').addEventListener('click',()=>zoom(1.25));$('zoom-out').addEventListener('click',()=>zoom(.8));
$('fit-view').addEventListener('click',()=>{camera.automatic=true;fitView()});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.003))},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';camera.automatic=false});
canvas.addEventListener('pointermove',e=>{if(pointer){camera.panX+=e.clientX-pointer.x;camera.panY+=e.clientY-pointer.y;pointer={x:e.clientX,y:e.clientY}}});
const endPan=()=>{pointer=null;canvas.style.cursor='grab'};canvas.addEventListener('pointerup',endPan);canvas.addEventListener('pointercancel',endPan);canvas.style.cursor='grab';
document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,button')||document.querySelector('dialog[open]'))return;if(e.code==='Space'){e.preventDefault();$('play').click()}if(e.key.toLowerCase()==='f'){e.preventDefault();camera.automatic=true;fitView()}});
document.addEventListener('visibilitychange',()=>{lastFrame=0;if(document.hidden&&playing){pause();notify('Simulation paused while the tab is hidden.')}});
new ResizeObserver(resize).observe(viewport);
log('Parking orbit loaded · ready to fly','400 km circular');renderUI();resize();
if(!ctx){viewNotification='Canvas graphics are unavailable. The numerical controls and telemetry still work.';renderUI()}
requestAnimationFrame(frame);
