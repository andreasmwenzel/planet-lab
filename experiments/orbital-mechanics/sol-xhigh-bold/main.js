import './style.css';
import {
  EARTH_RADIUS, ENTRY_ALTITUDE, TAU, norm, elements, makeInitial,
  propagate, buildMission, stateAt, deorbitBurn, solveDeparture, longitudeAt, inWindow,
} from './physics.js';

const $ = selector => document.querySelector(selector);
const presets = {
  routine: { name: 'Routine retirement', label: '01 / LEO service vehicle', perigee: 400, apogee: 400, phase: 25, budget: 150, center: -150, width: 18, duration: 180 },
  relic: { name: 'Eccentric relic', label: '02 / Unfinished transfer', perigee: 280, apogee: 1100, phase: -65, budget: 450, center: -70, width: 22, duration: 240 },
  patient: { name: 'The patient orbit', label: '03 / High-altitude asset', perigee: 800, apogee: 800, phase: 120, budget: 230, center: 110, width: 12, duration: 300 },
};
let config = { ...presets.routine };
let burns = [{ id: 'b1', time: 600, transverse: -90, radial: 0 }];
let selected = 'b1', plan, scrub = 0, playing = false, rate = 120, zoom = 1;
let placing = false, counter = 1, priorFrame = null, undoStack = [], redoStack = [];
let orbitPoints = [], chartBounds, paintPending = true, dirtyInputs = new WeakMap();
const startConfig = () => ({ ...presets.routine });
const clock = seconds => {
  const sign = seconds < 0 ? '−' : '';
  const value = Math.abs(Math.round(seconds));
  return `${sign}${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};
const decimal = (v, digits = 1) => Number.isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : 'unbound';
const longitude = value => `${Math.abs(value).toFixed(1)}° ${value < 0 ? 'W' : 'E'}`;

$('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="The Last Orbit, return to beginning"><span class="brand-mark">↘</span><span>THE LAST ORBIT<span class="brand-small">END-OF-LIFE FLIGHT DESK</span></span></a>
    <div class="top-note"><span class="status-light"></span> TWO-BODY REHEARSAL <span class="tag">EQUATORIAL</span></div>
    <button class="text-button" id="open-model">Read the model <span>↗</span></button>
  </header>
  <main class="desk">
    <aside class="mission-panel">
      <div class="eyebrow">DISPOSAL CASE / 001</div>
      <h1>Every orbit<br>has an ending<span>.</span></h1>
      <p class="intro">Decide when. Shape the descent. Hand the spacecraft to the atmosphere inside your chosen window.</p>
      <label class="field-label" for="scenario">REHEARSAL FILE</label>
      <select id="scenario"><option value="routine">01 · Routine retirement</option><option value="relic">02 · Eccentric relic</option><option value="patient">03 · The patient orbit</option></select>
      <div class="section-heading"><span>INITIAL ORBIT</span><span>AT APOGEE</span></div>
      <div class="paired-fields">
        <label>Perigee <span>km</span><input id="perigee" type="number" min="180" max="2000" step="10" value="400"></label>
        <label>Apogee <span>km</span><input id="apogee" type="number" min="180" max="3000" step="10" value="400"></label>
      </div>
      <label class="range-label" for="phase">Epoch longitude <output id="phase-output">25° E</output></label>
      <input id="phase" type="range" min="-180" max="180" value="25" step="1">
      <div class="mission-divider"></div>
      <div class="section-heading"><span>THE HANDOFF WINDOW</span><span>TRAINING SECTOR</span></div>
      <div class="paired-fields">
        <label>Center <span>° E</span><input id="center" type="number" min="-180" max="180" step="1" value="-150"></label>
        <label>Half-width <span>°</span><input id="width" type="number" min="3" max="90" step="1" value="18"></label>
      </div>
      <div class="paired-fields small-gap">
        <label>Δv budget <span>m/s</span><input id="budget" type="number" min="10" max="5000" step="10" value="150"></label>
        <label>Rehearsal <span>min</span><input id="duration" type="number" min="60" max="360" step="30" value="180"></label>
      </div>
      <div class="brief-note"><span>!</span><p>The window is a fictional equatorial sector. This desk predicts crossing at 120 km, not a landing site or a safe real-world disposal.</p></div>
      <button class="secondary-button full" id="open-log">Open flight receipt <span>↗</span></button>
      <div class="desk-id">TLO / REV 1.0<br>NO LIVE DATA · NO DRAG MODEL</div>
    </aside>

    <section class="flight-panel" aria-label="Flight rehearsal">
      <div class="flight-heading"><div><span class="eyebrow">REHEARSAL / PLAN VIEW</span><h2>The final coast</h2></div><div class="view-controls"><button id="zoom-out" aria-label="Zoom out">−</button><button id="fit" title="Reset view">FIT</button><button id="zoom-in" aria-label="Zoom in">+</button></div></div>
      <div class="stage-status"><span id="status-code">CALCULATING</span><span id="status-detail" aria-live="polite"></span></div>
      <div class="orbit-stage"><canvas id="orbit" aria-label="Orbit diagram showing the planned trajectory and spacecraft position"></canvas><div class="scale-note">TRUE DISTANCE SCALE<span>EARTH-CENTERED / INERTIAL</span></div><div class="stage-legend"><span class="legend-before">Unburned orbit</span><span class="legend-plan">Flight plan</span><span class="legend-entry">120 km interface</span></div><button class="pin-button" id="place-burn" aria-pressed="false">+ Pin a burn on the path</button></div>
      <div class="instrument-row">
        <div><span>ALTITUDE</span><strong id="read-altitude">400.0 <small>km</small></strong></div>
        <div><span>SPEED</span><strong id="read-speed">7.673 <small>km/s</small></strong></div>
        <div><span>PERIGEE / APOGEE</span><strong id="read-apsides">400 / 400 <small>km</small></strong></div>
        <div><span>ECCENTRICITY</span><strong id="read-eccentricity">0.0000</strong></div>
      </div>
      <div class="altitude-heading"><span>ALTITUDE OVER MISSION TIME</span><span id="plot-hint">CLICK TO INSPECT</span></div>
      <div class="altitude-stage"><canvas id="altitude" aria-label="Altitude versus mission time graph. Click or drag to move the playhead."></canvas></div>
      <div class="transport">
        <button class="rewind" id="rewind" aria-label="Return to epoch">↤</button><button class="play" id="play" aria-label="Play rehearsal">▶</button>
        <div class="time-readout"><span>MISSION CLOCK</span><strong id="clock">00:00:00</strong></div>
        <input type="range" id="scrub" min="0" max="10800" step="1" value="0" aria-label="Mission time in seconds">
        <select id="rate" aria-label="Playback speed"><option value="30">30×</option><option value="120" selected>120×</option><option value="300">300×</option></select>
      </div>
      <div class="ground-strip"><div class="ground-heading"><span>EARTH-FIXED HANDOFF LONGITUDE</span><strong id="entry-longitude">—</strong></div><div id="ground-track" class="ground-track"><div class="ground-window"></div><div class="ground-entry"></div></div><div class="ground-ticks"><span>180° W</span><span>90° W</span><span>0°</span><span>90° E</span><span>180° E</span></div></div>
    </section>

    <aside class="burn-panel">
      <div class="ledger-heading"><div><span class="eyebrow">IMPULSE LEDGER</span><h2>Write the ending.</h2></div><span class="ledger-number" id="burn-count">01</span></div>
      <p class="ledger-intro">Instantaneous burns, in radial / transverse coordinates. Positive transverse accelerates along the orbit.</p>
      <div class="budget-box"><div><span>PLANNED Δv</span><strong id="total-dv">90.0 <small>m/s</small></strong></div><span id="budget-state">OF 150 m/s</span><div class="budget-track"><i id="budget-fill"></i></div></div>
      <div id="burn-list" class="burn-list"></div>
      <button class="add-button full" id="add-burn">+ Add burn at playhead</button>
      <div class="ledger-actions"><button id="undo" class="text-button" disabled>↶ Undo</button><button id="redo" class="text-button" disabled>Redo ↷</button><button id="clear" class="text-button">Clear all</button></div>
      <div class="assist-block"><span class="eyebrow">FLIGHT-DESK ASSIST</span><h3>A starting point,<br>not a black box.</h3><button class="secondary-button full" id="template">Set 80 km perigee <span>↘</span></button><p>Rewrites the selected burn using vis-viva. Radial velocity is canceled at that instant.</p><button class="primary-button full" id="solve">Solve a one-burn handoff <span>→</span></button><p>Replaces the ledger. Searches departure time for the window center within your Δv budget.</p></div>
      <div class="ledger-footer"><span>SPACE · PLAY / PAUSE</span><span>B · ADD BURN</span></div>
    </aside>
  </main>
  <div class="toast" id="toast" role="status"></div>
  <dialog id="model-dialog" class="paper-dialog"><form method="dialog"><button class="dialog-close" aria-label="Close model">×</button></form><span class="eyebrow">MODEL CARD / TLO-01</span><h2>A precise orbit.<br>A deliberate approximation.</h2><p>Between burns, the spacecraft follows the universal-variable solution of the two-body Kepler problem. Burn impulses change velocity instantly. The timeline recomputes from the original state after every edit.</p><div class="model-equation">r̈ = −μ r / |r|³</div><dl><div><dt>Central body</dt><dd>Spherical Earth · R = 6,371 km · μ = 398,600.4418 km³/s²</dd></div><div><dt>Motion</dt><dd>Planar, equatorial, prograde at epoch. Initial state is at apogee. Zero inclination and point spacecraft.</dd></div><div><dt>Burn basis</dt><dd>Radial is outward. Transverse is tangent in the current angular-momentum direction; it is not the velocity direction on an eccentric orbit.</dd></div><div><dt>Handoff</dt><dd>First conic intersection with a 6,491 km sphere. The forecast stops there. Longitude includes Earth rotation with a sidereal period of 86,164.0905 seconds.</dd></div><div><dt>Omitted physics</dt><dd>Atmospheric drag, oblateness / J₂, lift, heating, mass loss, finite thrust, third bodies, inclination, weather and populated-area constraints.</dd></div><div><dt>Numerics</dt><dd>Bracketed universal Kepler solve, relative time residual 2×10⁻¹³. Conic handoff timing is analytic; an exactly radial degeneracy uses a 5-second bracket and bisection. Drawn paths are sampled at 15 seconds.</dd></div><div><dt>Local session</dt><dd>No network or saved storage. Your plan exists in this tab only. Copy the Plan JSON from the flight receipt to keep it.</dd></div></dl><p class="model-warning">EDUCATIONAL REHEARSAL ONLY. A handoff inside the training sector is not evidence of a safe reentry or real-world mission feasibility.</p></dialog>
  <dialog id="log-dialog" class="paper-dialog log-dialog"><form method="dialog"><button class="dialog-close" aria-label="Close flight receipt">×</button></form><span class="eyebrow">FLIGHT RECEIPT / LOCAL COPY</span><h2>Keep the plan.<br>Keep the caveats.</h2><div class="log-tabs"><button id="log-human" class="active">Flight receipt</button><button id="log-json">Plan JSON</button></div><textarea id="log-text" spellcheck="false" aria-label="Flight receipt or plan JSON"></textarea><div class="log-tools"><button class="secondary-button" id="select-log">Select all to copy</button><button class="primary-button" id="import-plan" hidden>Load this plan →</button></div><p class="log-help">Plan JSON can be pasted back here and loaded. No files, data or plans leave your browser.</p></dialog>
`;

function snapshot() { return JSON.stringify({ config, burns, selected }); }
function restore(value) {
  const data = JSON.parse(value);
  config = data.config; burns = data.burns; selected = data.selected;
  playing = false; syncConfig(); renderBurns(); recompute();
}
function transact(action) {
  const before = snapshot();
  try {
    action();
    if (snapshot() !== before) { undoStack.push(before); if (undoStack.length > 60) undoStack.shift(); redoStack = []; }
    renderBurns(); recompute();
  } catch (error) { restore(before); toast(error.message); }
}
let toastTimer;
function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200);
}
function syncConfig() {
  for (const name of ['perigee', 'apogee', 'phase', 'center', 'width', 'budget', 'duration']) $(`#${name}`).value = config[name];
  $('#phase-output').value = longitude(config.phase);
}
function addBurn(time = scrub) {
  if (burns.length >= 6) { toast('Six impulses maximum. Edit or remove a burn first.'); return; }
  if (plan.entry && time >= plan.endTime - 1) { toast('The forecast stops at atmospheric handoff. Pin the burn earlier.'); return; }
  transact(() => { selected = `b${++counter}`; burns.push({ id: selected, time: Math.min(config.duration * 60 - 1, Math.max(0, time)), transverse: 0, radial: 0 }); });
  const card = $(`[data-id="${selected}"]`); card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function renderBurns() {
  const sorted = [...burns].sort((a, b) => a.time - b.time);
  $('#burn-count').textContent = String(burns.length).padStart(2, '0');
  $('#burn-list').innerHTML = sorted.map((burn, index) => `
    <article class="burn-card ${selected === burn.id ? 'selected' : ''}" data-id="${burn.id}">
      <div class="burn-card-top"><button class="burn-select" data-select="${burn.id}" aria-label="Select burn ${index + 1}"><span class="burn-dot">${String(index + 1).padStart(2, '0')}</span><span>IMPULSE ${String(index + 1).padStart(2, '0')}</span></button><button class="delete-burn" data-delete="${burn.id}" aria-label="Remove burn ${index + 1}">×</button></div>
      <label class="burn-time">MISSION TIME <span>min</span><input data-burn="${burn.id}" data-key="time" type="number" min="0" max="${config.duration}" step="0.1" value="${(burn.time / 60).toFixed(2)}" aria-label="Burn ${index + 1} time in minutes"></label>
      <div class="paired-fields burn-components"><label>Transverse <span>m/s</span><input data-burn="${burn.id}" data-key="transverse" type="number" min="-5000" max="5000" step="1" value="${burn.transverse.toFixed(2)}" aria-label="Burn ${index + 1} transverse delta-v"></label><label>Radial <span>m/s</span><input data-burn="${burn.id}" data-key="radial" type="number" min="-5000" max="5000" step="1" value="${burn.radial.toFixed(2)}" aria-label="Burn ${index + 1} radial delta-v"></label></div>
      <div class="burn-meta"><span id="meta-${burn.id}">${clock(burn.time)}</span><strong>${decimal(Math.hypot(burn.transverse, burn.radial))} m/s</strong></div>
      ${selected === burn.id ? `<div class="nudge-row"><button data-nudge="${burn.id}" data-value="-10">−10 m/s</button><span>TRANSVERSE</span><button data-nudge="${burn.id}" data-value="10">+10 m/s</button></div>` : ''}
    </article>`).join('') || '<div class="empty-ledger"><span>↗</span><strong>A clean coast.</strong><p>Add an impulse, or use the one-burn handoff solver below.</p></div>';
  $('#undo').disabled = !undoStack.length; $('#redo').disabled = !redoStack.length;
}
function recompute() {
  const initial = makeInitial(config.perigee, config.apogee, config.phase);
  plan = buildMission(initial, burns, config.duration * 60);
  scrub = Math.max(0, Math.min(scrub, plan.endTime));
  $('#scrub').max = plan.endTime;
  const over = plan.totalDV > config.budget + 1e-7;
  const inside = plan.entry && inWindow(plan.entry.longitude, config.center, config.width);
  let code, detail;
  if (!plan.entry) { code = 'STILL IN ORBIT'; detail = `No 120 km handoff in ${config.duration} minutes`; }
  else if (over) { code = 'BUDGET EXCEEDED'; detail = `${decimal(plan.totalDV - config.budget)} m/s beyond the available impulse`; }
  else if (inside) { code = 'WINDOW ACQUIRED'; detail = `Handoff at T+${clock(plan.entry.time)} · ${longitude(plan.entry.longitude)}`; }
  else { code = 'OUTSIDE THE WINDOW'; detail = `Handoff at ${longitude(plan.entry.longitude)} · adjust departure time`; }
  $('#status-code').textContent = code;
  $('#status-code').className = inside && !over ? 'success' : over ? 'danger' : '';
  $('#status-detail').textContent = detail;
  $('#total-dv').innerHTML = `${decimal(plan.totalDV)} <small>m/s</small>`;
  $('#budget-state').textContent = `OF ${decimal(config.budget, 0)} m/s`;
  $('#budget-fill').style.width = `${Math.min(100, plan.totalDV / config.budget * 100)}%`;
  $('.budget-box').classList.toggle('over', over);
  for (const event of plan.events) {
    const node = $(`#meta-${event.id}`);
    if (node) { node.textContent = event.skipped ? 'AFTER HANDOFF / NOT EXECUTED' : `${clock(event.time)} · ${decimal(norm(event.before.r) - EARTH_RADIUS, 0)} km`; node.classList.toggle('skipped', event.skipped); }
  }
  $('#entry-longitude').textContent = plan.entry ? longitude(plan.entry.longitude) : 'NO HANDOFF';
  const track = $('#ground-track');
  track.querySelectorAll('.ground-window').forEach(n => n.remove());
  for (const shift of [-360, 0, 360]) {
    const low = Math.max(-180, config.center - config.width + shift), high = Math.min(180, config.center + config.width + shift);
    if (high > low) {
      const node = document.createElement('div'); node.className = 'ground-window';
      node.style.left = `${(low + 180) / 3.6}%`; node.style.width = `${(high - low) / 3.6}%`; track.append(node);
    }
  }
  const marker = $('.ground-entry'); marker.hidden = !plan.entry;
  if (plan.entry) { marker.style.left = `${(plan.entry.longitude + 180) / 3.6}%`; marker.classList.toggle('inside', !!inside); }
  paintPending = true; updateReadouts();
}
function updateReadouts() {
  const el = elements(stateAt(plan, scrub));
  $('#clock').textContent = clock(scrub); $('#scrub').value = scrub;
  $('#read-altitude').innerHTML = `${decimal(el.radius - EARTH_RADIUS)} <small>km</small>`;
  $('#read-speed').innerHTML = `${decimal(el.speed, 3)} <small>km/s</small>`;
  $('#read-apsides').innerHTML = `${decimal(el.periapsis - EARTH_RADIUS, 0)} / ${decimal(el.apoapsis - EARTH_RADIUS, 0)} <small>km</small>`;
  $('#read-eccentricity').textContent = el.e.toFixed(4);
  $('#play').textContent = playing ? 'Ⅱ' : '▶'; $('#play').setAttribute('aria-label', playing ? 'Pause rehearsal' : 'Play rehearsal');
  paintPending = true;
}

for (const name of ['perigee', 'apogee', 'center', 'width', 'budget', 'duration']) {
  $(`#${name}`).addEventListener('change', event => {
    const input = event.target, value = Number(input.value);
    if (!input.value || !Number.isFinite(value) || value < Number(input.min) || value > Number(input.max)) { input.value = config[name]; toast(`Use ${input.min} to ${input.max} for this field.`); return; }
    transact(() => {
      config[name] = value;
      if (name === 'perigee' && config.perigee > config.apogee) config.apogee = config.perigee;
      if (name === 'apogee' && config.apogee < config.perigee) config.perigee = config.apogee;
      if (name === 'duration') burns = burns.map(b => ({ ...b, time: Math.min(b.time, value * 60) }));
    });
    syncConfig();
  });
}
$('#phase').addEventListener('pointerdown', event => dirtyInputs.set(event.target, snapshot()));
$('#phase').addEventListener('input', event => { config.phase = Number(event.target.value); $('#phase-output').value = longitude(config.phase); recompute(); });
$('#phase').addEventListener('change', event => { const base = dirtyInputs.get(event.target); if (base && base !== snapshot()) { undoStack.push(base); redoStack = []; } dirtyInputs.delete(event.target); renderBurns(); });
$('#phase').addEventListener('keydown', event => { if (!dirtyInputs.has(event.target)) dirtyInputs.set(event.target, snapshot()); });
$('#scenario').addEventListener('change', event => { transact(() => { config = { ...presets[event.target.value] }; burns = []; selected = null; scrub = 0; playing = false; }); syncConfig(); toast(`${config.name} loaded. The ledger is clear.`); });
$('#burn-list').addEventListener('click', event => {
  const remove = event.target.closest('[data-delete]'), select = event.target.closest('[data-select]'), nudge = event.target.closest('[data-nudge]');
  if (remove) transact(() => { burns = burns.filter(b => b.id !== remove.dataset.delete); if (selected === remove.dataset.delete) selected = burns[0]?.id || null; });
  else if (select) { selected = select.dataset.select; renderBurns(); const burn = burns.find(b => b.id === selected); scrub = Math.min(burn.time, plan.endTime); playing = false; updateReadouts(); }
  else if (nudge) transact(() => { const burn = burns.find(b => b.id === nudge.dataset.nudge); burn.transverse = Math.max(-5000, Math.min(5000, burn.transverse + Number(nudge.dataset.value))); });
});
$('#burn-list').addEventListener('change', event => {
  const input = event.target;
  if (!input.dataset.burn) return;
  const value = Number(input.value);
  if (!input.value || !Number.isFinite(value) || value < Number(input.min) || value > Number(input.max)) { renderBurns(); toast(`Use ${input.min} to ${input.max} for this field.`); return; }
  transact(() => { const burn = burns.find(b => b.id === input.dataset.burn); burn[input.dataset.key] = input.dataset.key === 'time' ? value * 60 : value; selected = burn.id; });
});
$('#add-burn').addEventListener('click', () => addBurn());
$('#clear').addEventListener('click', () => transact(() => { burns = []; selected = null; }));
$('#undo').addEventListener('click', () => { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); });
$('#redo').addEventListener('click', () => { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); });
$('#template').addEventListener('click', () => {
  try {
    const burn = burns.find(b => b.id === selected);
    const time = burn?.time ?? Math.min(scrub, config.duration * 60 - 900);
    const earlier = burns.filter(b => b.time < time || b.time === time && b.id !== burn?.id);
    const earlierPlan = buildMission(makeInitial(config.perigee, config.apogee, config.phase), earlier, time);
    if (earlierPlan.entry) throw new Error('An earlier impulse already reaches the atmosphere. Move this burn earlier.');
    const recipe = deorbitBurn(stateAt(earlierPlan, time));
    transact(() => {
      if (burn) Object.assign(burn, recipe);
      else { if (burns.length >= 6) throw new Error('Remove a burn first; the ledger holds six.'); selected = `b${++counter}`; burns.push({ id: selected, time, ...recipe }); }
    });
    toast('80 km perigee template applied. Inspect the 120 km handoff.');
  } catch (error) { toast(error.message); }
});
$('#solve').addEventListener('click', () => {
  try {
    const solution = solveDeparture(makeInitial(config.perigee, config.apogee, config.phase), config.duration * 60, config.center, config.budget);
    if (!solution) { toast('No 80 km template fits this budget and horizon. Increase Δv or rehearsal time.'); return; }
    transact(() => { selected = `b${++counter}`; burns = [{ id: selected, time: solution.time, transverse: solution.transverse, radial: solution.radial }]; playing = false; scrub = solution.time; });
    toast(solution.error < config.width * Math.PI / 180 ? 'One-burn plan aligned. Review the impulse and handoff.' : 'Closest budget-feasible departure found. It still misses the window.');
  } catch (error) { toast(error.message); }
});
function togglePlay() { if (!playing && scrub >= plan.endTime - 0.1) scrub = 0; playing = !playing; updateReadouts(); }
$('#play').addEventListener('click', togglePlay);
$('#rewind').addEventListener('click', () => { playing = false; scrub = 0; updateReadouts(); });
$('.brand').addEventListener('click', event => { event.preventDefault(); playing = false; scrub = 0; updateReadouts(); });
$('#scrub').addEventListener('input', event => { playing = false; scrub = Number(event.target.value); updateReadouts(); });
$('#rate').addEventListener('change', event => { rate = Number(event.target.value); });
$('#zoom-in').addEventListener('click', () => { zoom = Math.min(4, zoom * 1.3); paintPending = true; });
$('#zoom-out').addEventListener('click', () => { zoom = Math.max(0.35, zoom / 1.3); paintPending = true; });
$('#fit').addEventListener('click', () => { zoom = 1; paintPending = true; });
$('#place-burn').addEventListener('click', () => { placing = !placing; $('#place-burn').setAttribute('aria-pressed', String(placing)); $('#place-burn').textContent = placing ? 'Click the orange path or altitude plot' : '+ Pin a burn on the path'; $('#plot-hint').textContent = placing ? 'CLICK TO PIN A BURN' : 'CLICK TO INSPECT'; if (placing) toast('Loops can overlap in plan view. Use the altitude plot to pin an exact mission time.'); });
document.addEventListener('keydown', event => {
  if (event.target.matches('input,select,textarea,button') || $('dialog[open]')) return;
  if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
  if (event.key.toLowerCase() === 'b') addBurn();
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); playing = false; scrub = Math.max(0, Math.min(plan.endTime, scrub + (event.key === 'ArrowLeft' ? -30 : 30))); updateReadouts(); }
});

$('#open-model').addEventListener('click', () => $('#model-dialog').showModal());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
let jsonMode = false;
function renderLog() {
  $('#log-human').classList.toggle('active', !jsonMode); $('#log-json').classList.toggle('active', jsonMode);
  $('#import-plan').hidden = !jsonMode; $('#log-text').readOnly = !jsonMode;
  const finalElements = elements(plan.final);
  $('#log-text').value = jsonMode ? JSON.stringify({ format: 'the-last-orbit/1', config, burns }, null, 2) : [
    'THE LAST ORBIT / FLIGHT RECEIPT', 'EDUCATIONAL TWO-BODY REHEARSAL', '',
    `Initial orbit: ${config.perigee} × ${config.apogee} km, at apogee`,
    `Epoch longitude: ${longitude(config.phase)}`, `Horizon: ${config.duration} min`,
    `Training window: ${longitude(config.center)} ± ${config.width}°`, `Budget: ${config.budget} m/s`, '',
    ...plan.events.map((b, i) => `${i + 1}. T+${clock(b.time)} / transverse ${b.transverse.toFixed(3)} m/s / radial ${b.radial.toFixed(3)} m/s${b.skipped ? ' / NOT EXECUTED (after handoff)' : ''}`), '',
    `Planned Δv: ${plan.totalDV.toFixed(3)} m/s; executed: ${plan.executedDV.toFixed(3)} m/s`,
    plan.entry ? `120 km interface: T+${clock(plan.entry.time)}, ${longitude(plan.entry.longitude)}` : 'No atmospheric handoff within the rehearsal horizon.',
    plan.entry ? `Training window: ${inWindow(plan.entry.longitude, config.center, config.width) ? 'ACQUIRED' : 'MISSED'}` : `Final osculating perigee / apogee: ${decimal(finalElements.periapsis - EARTH_RADIUS)} / ${decimal(finalElements.apoapsis - EARTH_RADIUS)} km`,
    `Budget: ${plan.totalDV <= config.budget ? 'WITHIN LIMIT' : 'EXCEEDED'}`, '',
    'MODEL: spherical Earth; equatorial two-body gravity; instantaneous impulses.',
    'R = 6371 km; μ = 398600.4418 km³/s²; sidereal rotation = 86164.0905 s.',
    'No drag, J₂, inclination, finite thrust, heating, lift, breakup or third bodies.',
    '120 km interface is a forecast stop, not a surface impact or landing prediction.',
    'A window match is not a safe real-world reentry determination.',
  ].join('\n');
}
$('#open-log').addEventListener('click', () => { jsonMode = false; renderLog(); $('#log-dialog').showModal(); });
$('#log-human').addEventListener('click', () => { jsonMode = false; renderLog(); });
$('#log-json').addEventListener('click', () => { jsonMode = true; renderLog(); });
$('#select-log').addEventListener('click', () => { $('#log-text').focus(); $('#log-text').select(); toast('Selected. Use Ctrl+C or ⌘C to copy.'); });
$('#import-plan').addEventListener('click', () => {
  try {
    const data = JSON.parse($('#log-text').value);
    if (data.format !== 'the-last-orbit/1' || !data.config || !Array.isArray(data.burns) || data.burns.length > 6) throw new Error('Use a The Last Orbit / 1 plan with at most six burns.');
    const ranges = { perigee: [180, 2000], apogee: [180, 3000], phase: [-180, 180], center: [-180, 180], width: [3, 90], budget: [10, 5000], duration: [60, 360] };
    const next = { ...startConfig(), name: 'Imported rehearsal' };
    for (const [key, [low, high]] of Object.entries(ranges)) {
      if (!Number.isFinite(data.config[key]) || data.config[key] < low || data.config[key] > high) throw new Error(`Invalid ${key}: allowed range ${low} to ${high}.`);
      next[key] = data.config[key];
    }
    if (next.perigee > next.apogee) throw new Error('Perigee cannot exceed apogee.');
    const nextBurns = data.burns.map(b => {
      if (!Number.isFinite(b.time) || b.time < 0 || b.time > next.duration * 60 || !Number.isFinite(b.transverse) || Math.abs(b.transverse) > 5000 || !Number.isFinite(b.radial) || Math.abs(b.radial) > 5000) throw new Error('A burn has an invalid time or component (limit ±5,000 m/s).');
      return { id: `b${++counter}`, time: b.time, transverse: b.transverse, radial: b.radial };
    });
    // Validate numerical feasibility before changing the active plan.
    buildMission(makeInitial(next.perigee, next.apogee, next.phase), nextBurns, next.duration * 60);
    transact(() => { config = next; burns = nextBurns; selected = burns[0]?.id || null; scrub = 0; playing = false; });
    syncConfig(); $('#log-dialog').close(); toast('Plan loaded into this tab.');
  } catch (error) { toast(`Plan not loaded: ${error.message}`); }
});

function canvasContext(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const width = bounds.width, height = bounds.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}
function drawOrbit() {
  const surface = canvasContext($('#orbit')); if (!surface || surface.width < 2) return;
  const { ctx, width: w, height: h } = surface;
  const initialEl = elements(plan.initial);
  const bound = Math.max(EARTH_RADIUS * 1.35, ...plan.samples.map(p => norm(p.r)));
  const scale = Math.min(w - 64, h - 74) / (2 * bound) * zoom;
  const cx = w / 2, cy = h / 2 + 4;
  const map = r => ({ x: cx + r[0] * scale, y: cy - r[1] * scale });
  const earth = EARTH_RADIUS * scale;
  ctx.strokeStyle = '#ffffff08'; ctx.lineWidth = 1;
  for (let x = 16; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 12; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = '#ffffff13'; ctx.setLineDash([2, 7]);
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke(); ctx.setLineDash([]);
  // Planet sphere and graticule are diagrammatic, not a geographic map.
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, earth, 0, TAU); ctx.clip();
  ctx.fillStyle = '#243432'; ctx.fillRect(cx - earth, cy - earth, earth * 2, earth * 2);
  ctx.strokeStyle = '#54726a40'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.ellipse(cx, cy, earth * Math.cos(i * Math.PI / 8), earth * 0.13, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, earth * 0.13, earth * Math.cos(i * Math.PI / 8), 0, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = '#b8c6bb'; ctx.textAlign = 'center'; ctx.font = '600 11px system-ui'; ctx.fillText('EARTH', cx, cy - 10);
  ctx.font = '10px monospace'; ctx.fillStyle = '#88a099'; ctx.fillText('6,371 km', cx, cy + 8);
  ctx.restore();
  ctx.strokeStyle = '#637e7277'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, earth, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#e7c59288'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(cx, cy, (EARTH_RADIUS + ENTRY_ALTITUDE) * scale, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (Number.isFinite(initialEl.period)) {
    ctx.beginPath(); ctx.strokeStyle = '#73857f'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    for (let i = 0; i <= 240; i++) { const p = map(propagate(plan.initial, initialEl.period * i / 240).r); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.beginPath(); ctx.strokeStyle = '#f7854e'; ctx.lineWidth = 2;
  orbitPoints = plan.samples.map(sample => ({ ...map(sample.r), t: sample.t }));
  orbitPoints.forEach((point, i) => { if (!i) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); }); ctx.stroke();
  const active = map(stateAt(plan, scrub).r);
  for (const [index, event] of plan.events.entries()) {
    if (event.skipped) continue;
    const p = map(event.before.r); const a = Math.atan2(event.before.r[1], event.before.r[0]);
    const labelX = p.x + Math.cos(a) * 24, labelY = p.y - Math.sin(a) * 24;
    ctx.strokeStyle = '#f7854e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(labelX, labelY); ctx.stroke();
    ctx.fillStyle = selected === event.id ? '#fff3d5' : '#f7854e'; ctx.beginPath(); ctx.arc(p.x, p.y, selected === event.id ? 5 : 3.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#17211f'; ctx.beginPath(); ctx.arc(labelX, labelY, 10, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f6bf90'; ctx.font = '10px monospace'; ctx.fillText(String(index + 1), labelX, labelY);
  }
  if (plan.entry) {
    const p = map(plan.entry.state.r);
    ctx.strokeStyle = '#edd2a0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - 6); ctx.lineTo(p.x + 6, p.y + 6); ctx.moveTo(p.x + 6, p.y - 6); ctx.lineTo(p.x - 6, p.y + 6); ctx.stroke();
    ctx.textAlign = p.x > cx ? 'left' : 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#edd2a0'; ctx.font = '9px monospace';
    ctx.fillText('120 KM HANDOFF', p.x + (p.x > cx ? 13 : -13), p.y + (Math.abs(p.y - cy) < earth * 0.5 ? 16 : -13));
  }
  ctx.fillStyle = '#f0f3dd'; ctx.beginPath(); ctx.arc(active.x, active.y, 4.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#e3ecd781'; ctx.beginPath(); ctx.arc(active.x, active.y, 9.5, 0, TAU); ctx.stroke();
  const spacecraftLongitude = longitudeAt(stateAt(plan, scrub), scrub);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#839d93'; ctx.font = '10px monospace';
  ctx.fillText(`SUBPOINT ${longitude(spacecraftLongitude)}`, 20, h - 24);
  const scaleKm = 1000; const bar = scaleKm * scale;
  if (bar < w * 0.4) { ctx.strokeStyle = '#839d93'; ctx.beginPath(); ctx.moveTo(w - 20 - bar, h - 24); ctx.lineTo(w - 20, h - 24); ctx.moveTo(w - 20 - bar, h - 28); ctx.lineTo(w - 20 - bar, h - 20); ctx.moveTo(w - 20, h - 28); ctx.lineTo(w - 20, h - 20); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText('1,000 km', w - 20, h - 32); }
}
function drawAltitude() {
  const surface = canvasContext($('#altitude')); if (!surface || surface.width < 2) return;
  const { ctx, width: w, height: h } = surface;
  const left = 47, right = w - 17, top = 12, bottom = h - 27;
  const maxAltitude = Math.max(500, config.apogee * 1.08, ...plan.samples.map(p => norm(p.r) - EARTH_RADIUS)) * 1.05;
  const x = t => left + t / (config.duration * 60) * (right - left);
  const y = altitude => bottom - altitude / maxAltitude * (bottom - top);
  chartBounds = { left, right, top, bottom, width: w, height: h };
  ctx.font = '9px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let i = 0; i <= 3; i++) { const value = maxAltitude * i / 3; ctx.strokeStyle = '#ffffff0c'; ctx.beginPath(); ctx.moveTo(left, y(value)); ctx.lineTo(right, y(value)); ctx.stroke(); ctx.fillStyle = '#81988e'; ctx.fillText(Math.round(value).toLocaleString(), left - 8, y(value)); }
  ctx.fillStyle = '#e7c59210'; ctx.fillRect(left, y(ENTRY_ALTITUDE), right - left, bottom - y(ENTRY_ALTITUDE));
  ctx.strokeStyle = '#e7c59255'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(left, y(ENTRY_ALTITUDE)); ctx.lineTo(right, y(ENTRY_ALTITUDE)); ctx.stroke(); ctx.setLineDash([]);
  ctx.textAlign = 'right'; ctx.fillStyle = '#c1ac89'; ctx.fillText('120 km', right, y(ENTRY_ALTITUDE) - 7);
  const drawPoints = plan.samples.map(p => ({ x: x(p.t), y: y(norm(p.r) - EARTH_RADIUS) }));
  ctx.beginPath(); drawPoints.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.lineTo(x(plan.endTime), bottom); ctx.lineTo(left, bottom); ctx.closePath(); ctx.fillStyle = '#f7854e0d'; ctx.fill();
  ctx.beginPath(); drawPoints.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.strokeStyle = '#f7854e'; ctx.lineWidth = 1.8; ctx.stroke();
  for (const [index, event] of plan.events.entries()) { ctx.strokeStyle = event.skipped ? '#736c6255' : '#f7854e55'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(x(event.time), top); ctx.lineTo(x(event.time), bottom); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = event.skipped ? '#736c62' : '#f7854e'; ctx.textAlign = 'center'; ctx.fillText(`${index + 1}`, x(event.time), top + 2); }
  ctx.strokeStyle = '#edf0d7'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x(scrub), top); ctx.lineTo(x(scrub), bottom); ctx.stroke();
  ctx.fillStyle = '#edf0d7'; ctx.beginPath(); ctx.arc(x(scrub), y(norm(stateAt(plan, scrub).r) - EARTH_RADIUS), 3.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#81988e'; ctx.font = '9px monospace';
  for (let i = 0; i <= 4; i++) { const t = config.duration * 60 * i / 4; ctx.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center'; ctx.fillText(`${Math.round(t / 60)}m`, x(t), h - 10); }
}
$('#orbit').addEventListener('click', event => {
  const rect = event.target.getBoundingClientRect(); const px = event.clientX - rect.left, py = event.clientY - rect.top;
  if (placing) {
    const nearest = orbitPoints.reduce((best, p) => Math.hypot(p.x - px, p.y - py) < best.distance ? { ...p, distance: Math.hypot(p.x - px, p.y - py) } : best, { distance: Infinity });
    if (nearest.distance > 35) { toast('Click closer to the orange path, or pin precisely on the altitude plot.'); return; }
    addBurn(nearest.t); return;
  }
  // Picking the projected location is ambiguous where revolutions overlap;
  // the altitude chart is the precise time-selection surface.
  let closest = null;
  for (const ev of plan.events) {
    if (ev.skipped) continue;
    const candidate = orbitPoints.reduce((best, p) => Math.abs(p.t - ev.time) < Math.abs(best.t - ev.time) ? p : best, orbitPoints[0]);
    const distance = Math.hypot(candidate.x - px, candidate.y - py);
    if (distance < 20 && (!closest || distance < closest.distance)) closest = { ev, distance };
  }
  if (closest) { selected = closest.ev.id; scrub = closest.ev.time; playing = false; renderBurns(); updateReadouts(); }
});
let draggingChart = false;
function chartTime(event) {
  if (!chartBounds) return 0;
  const rect = $('#altitude').getBoundingClientRect();
  return Math.max(0, Math.min(plan.endTime, (event.clientX - rect.left - chartBounds.left) / (chartBounds.right - chartBounds.left) * config.duration * 60));
}
$('#altitude').addEventListener('pointerdown', event => {
  const time = chartTime(event);
  if (placing) { addBurn(time); return; }
  draggingChart = true; event.target.setPointerCapture(event.pointerId); playing = false; scrub = time; updateReadouts();
});
$('#altitude').addEventListener('pointermove', event => { if (draggingChart) { scrub = chartTime(event); updateReadouts(); } });
$('#altitude').addEventListener('pointerup', () => { draggingChart = false; });
$('#altitude').addEventListener('pointercancel', () => { draggingChart = false; });
const resize = new ResizeObserver(() => { paintPending = true; }); resize.observe($('#orbit')); resize.observe($('#altitude'));
function frame(timestamp) {
  const elapsed = priorFrame === null ? 0 : Math.min(0.15, (timestamp - priorFrame) / 1000); priorFrame = timestamp;
  if (playing) { scrub = Math.min(plan.endTime, scrub + elapsed * rate); if (scrub >= plan.endTime) { playing = false; if (plan.entry) toast('Atmospheric handoff reached. This model ends at 120 km.'); } updateReadouts(); }
  if (paintPending) { drawOrbit(); drawAltitude(); paintPending = false; }
  requestAnimationFrame(frame);
}
syncConfig(); renderBurns(); recompute(); requestAnimationFrame(frame);
