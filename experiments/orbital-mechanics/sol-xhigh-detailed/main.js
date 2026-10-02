import './style.css';
import { MU, EARTH_RADIUS, orbitalElements, sampleOrbit, impulse, hohmann } from './physics.mjs';
import { createFlight, depart, propagateFlight, circularize, manualBurn, targetAssessment } from './session.mjs';

const $ = id => document.getElementById(id);
const number = (n, decimals = 0) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) : 'Unbounded';
const duration = seconds => {
  if (!Number.isFinite(seconds)) return 'Unbound';
  const s = Math.max(0, Math.round(seconds));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};
const clock = seconds => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const signDV = dv => `${dv >= 0 ? '+' : '−'}${number(Math.abs(dv) * 1000, 1)} m/s`;
const presets = [
  { label: 'Training ascent', start: 400, target: 2400, title: 'Raise an orbit', note: '400 → 2,400 km', icon: '↗' },
  { label: 'Station return', start: 2400, target: 400, title: 'Bring it home', note: '2,400 → 400 km', icon: '↙' },
  { label: 'High-orbit transfer', start: 400, target: 35786, title: 'Reach high orbit', note: '400 → 35,786 km', icon: '⌁' },
];

$('app').innerHTML = `
<header class="masthead">
  <a class="brand" href="#main" aria-label="Orbit Workshop, skip to simulator"><span class="brand-mark" aria-hidden="true">◌</span><span>ORBIT<span class="brand-sub">WORKSHOP</span></span></a>
  <div class="header-title">TRANSFER LAB <span class="separator">/</span> EARTH</div>
  <div class="header-actions"><span class="model-chip"><i></i> TWO-BODY MODEL</span><button id="model-open" class="header-button">Model & help <span aria-hidden="true">↗</span></button></div>
</header>
<main id="main">
  <div class="page-heading"><div><div class="eyebrow">MISSION DESIGN / 01</div><h1>Change your orbit.</h1><p>Plan two impulses. Coast between them. Make the destination a circle.</p></div><button id="report-open" class="text-button">Flight report <span aria-hidden="true">↗</span></button></div>
  <div class="workbench">
    <aside class="design panel" aria-labelledby="design-title">
      <div class="panel-header"><span class="section-number">01</span><h2 id="design-title">Set the mission</h2></div>
      <div class="preset-list">${presets.map((p, i) => `<button class="preset ${i === 0 ? 'selected' : ''}" data-preset="${i}" aria-pressed="${i === 0}"><span class="preset-icon" aria-hidden="true">${p.icon}</span><span><strong>${p.title}</strong><small>${p.note}</small></span><span class="preset-check" aria-hidden="true">✓</span></button>`).join('')}</div>
      <form id="mission-form" novalidate>
        <div class="field-pair"><label for="start-alt">Parking altitude<span class="input-wrap"><input id="start-alt" type="number" min="150" max="50000" step="50" value="400" required inputmode="decimal"><span>km</span></span></label><label for="target-alt">Target altitude<span class="input-wrap"><input id="target-alt" type="number" min="150" max="50000" step="50" value="2400" required inputmode="decimal"><span>km</span></span></label></div>
        <p id="mission-error" class="field-error" role="alert"></p>
        <button id="apply-mission" type="submit" class="outline-button full">Apply new mission</button>
        <p id="draft-note" class="microcopy">Changing the mission starts a new flight. You can undo it.</p>
      </form>
      <div class="rule"></div>
      <div class="panel-header subheader"><span class="section-number">02</span><h2>Follow the plan</h2><span class="tiny-tag">HOHMANN</span></div>
      <ol class="burn-plan">
        <li id="plan-one" class="active"><span class="step-dot">1</span><div><h3>Departure impulse</h3><p id="dv-one"></p><small id="dir-one"></small></div><span class="step-check" aria-hidden="true">✓</span></li>
        <li id="plan-coast"><span class="step-dot coast-dot">·</span><div><h3>Coast to the far apsis</h3><p id="coast-time"></p><small>No engine. Gravity does the work.</small></div><span class="step-check" aria-hidden="true">✓</span></li>
        <li id="plan-two"><span class="step-dot">2</span><div><h3>Circularize</h3><p id="dv-two"></p><small id="dir-two"></small></div><span class="step-check" aria-hidden="true">✓</span></li>
      </ol>
      <div class="budget"><span>Planned total Δv</span><strong id="total-dv"></strong><small>Two instantaneous, tangential burns</small></div>
      <button id="reset" class="text-button reset-button">↺ Reset this flight</button>
    </aside>
    <section class="flight-panel" aria-labelledby="view-title">
      <div class="viewport">
        <div class="view-top"><div><h2 id="view-title">Earth-centered view</h2><span id="active-mission">400 → 2,400 km</span></div><span id="phase-chip" class="phase-chip">PARKING ORBIT</span></div>
        <canvas id="space" role="img" aria-label="Earth-centered orbit diagram. Numerical position, orbit, and flight status are available beside and below the diagram."></canvas>
        <div class="view-bottom"><div class="legend"><span><i class="legend-current"></i>Current orbit</span><span><i class="legend-target"></i>Target circle</span><span><i class="legend-trail"></i>Flown path</span></div><span class="inertial-label">2D / INERTIAL FRAME</span></div>
        <div class="view-tools"><button id="zoom-out" aria-label="Zoom out" title="Zoom out">−</button><button id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button><button id="fit-view" title="Fit current orbit">Fit</button><button id="vectors" aria-pressed="true" title="Show schematic velocity and gravity directions">Vectors</button></div>
        <div id="canvas-fallback" class="canvas-fallback" hidden>Your browser could not create a 2D canvas. The mission controls and numerical telemetry still work.</div>
      </div>
      <div class="flight-controls">
        <div class="playback"><button id="play" class="play-button" aria-label="Run simulation"><span id="play-icon" aria-hidden="true">▶</span></button><div class="flight-clock"><span>MISSION ELAPSED</span><strong id="elapsed">00:00:00</strong></div><label class="speed-label" for="speed">Time rate<select id="speed"><option value="1">1×</option><option value="60">60×</option><option value="240" selected>240×</option><option value="1200">1,200×</option><option value="6000">6,000×</option></select></label><button id="undo" class="undo-button" disabled title="Undo the last burn, coast jump, or mission change">↶ <span>Undo</span></button></div>
        <div class="progress-track" aria-hidden="true"><div id="progress-fill"></div><span class="track-point start-point"></span><span class="track-point end-point"></span></div>
        <div class="progress-labels"><span>Departure</span><span id="arrival-countdown">Arrival in ${duration(1)}</span></div>
        <div class="next-action"><div><span id="action-eyebrow" class="eyebrow">READY WHEN YOU ARE</span><h2 id="action-title">Leave the parking orbit</h2><p id="action-description">The first burn stretches your circle into a transfer ellipse.</p></div><button id="primary-action" class="primary-button">Burn 1 <span aria-hidden="true">↗</span></button></div>
        <p id="announcement" class="announcement" role="status" aria-live="polite">Your spacecraft starts in a stable circular orbit. Begin the transfer when you're ready.</p>
      </div>
      <div class="manual-panel panel"><details id="manual-details"><summary><span><span class="section-number">03</span>Try your own impulse</span><small>Optional · leaves the guided plan <span aria-hidden="true">+</span></small></summary><div class="manual-content"><p>Change velocity at your current position. Preview the resulting orbit before committing.</p><div class="manual-fields"><label for="burn-direction">Direction<select id="burn-direction"><option value="prograde">Along velocity</option><option value="retrograde">Against velocity</option><option value="outward">Radially out</option><option value="inward">Radially in</option></select></label><label for="burn-size">Impulse<div class="input-wrap"><input id="burn-size" type="number" min="1" max="2500" step="10" value="200" inputmode="decimal"><span>m/s</span></div></label><button id="manual-fire" class="outline-button">Apply impulse</button></div><p id="burn-preview" class="burn-preview"></p><p id="burn-error" class="field-error" role="alert"></p></div></details></div>
    </section>
    <aside class="telemetry panel" aria-labelledby="telemetry-title">
      <div class="panel-header"><span class="live-dot"></span><h2 id="telemetry-title">Flight telemetry</h2><span id="run-status" class="tiny-tag">PAUSED</span></div>
      <div class="big-metric"><span>Current altitude</span><strong><span id="altitude">400</span><small>km</small></strong></div>
      <div class="big-metric speed-metric"><span>Orbital speed</span><strong><span id="velocity"></span><small>km/s</small></strong></div>
      <div id="orbit-status" class="orbit-status"><span class="status-symbol" aria-hidden="true">◉</span><span id="orbit-status-text">Circular · bound</span></div>
      <dl class="metrics"><div><dt>Periapsis altitude</dt><dd id="periapsis"></dd></div><div><dt>Apoapsis altitude</dt><dd id="apoapsis"></dd></div><div><dt>Orbital period</dt><dd id="period"></dd></div><div><dt>Eccentricity <span title="0 is circular; 0–1 elliptical; 1 parabolic; above 1 hyperbolic">ⓘ</span></dt><dd id="eccentricity"></dd></div><div><dt>Δv used</dt><dd id="used-dv"></dd></div></dl>
      <div id="orbit-warning" class="orbit-warning" hidden></div>
      <details class="conservation"><summary>Under the hood <span aria-hidden="true">+</span></summary><dl class="metrics"><div><dt>Specific energy</dt><dd id="energy"></dd></div><div><dt>Angular momentum</dt><dd id="momentum"></dd></div><div><dt>Radial velocity</dt><dd id="radial"></dd></div></dl><p>Energy and angular momentum stay constant while coasting. An impulse changes them.</p></details>
      <div class="rule"></div><div class="panel-header"><h2>Burn journal</h2><span id="burn-count" class="tiny-tag">0 EVENTS</span></div><div id="burn-log" class="burn-log"><p class="empty-log">A blank page, a circular orbit.<br>Your burns will appear here.</p></div>
      <div class="telemetry-foot"><span aria-hidden="true">↳</span><p>Altitudes are above a spherical Earth. This is a learning model, not a navigation tool.</p></div>
    </aside>
  </div>
  <footer class="app-footer"><span>Built around gravity, not guesswork.</span><span><kbd>Space</kbd> play / pause <span class="footer-sep">·</span> <kbd>B</kbd> next step <span class="footer-sep">·</span> <kbd>U</kbd> undo</span><button id="help-footer" class="text-button">Physics & limitations ↗</button></footer>
</main>
<dialog id="model-dialog"><div class="dialog-header"><div><div class="eyebrow">THE PHYSICS, PLAINLY</div><h2>One Earth. One spacecraft.</h2></div><button class="dialog-close" data-close="model-dialog" aria-label="Close model and help">×</button></div><div class="dialog-body"><p>This lab asks a practical question: how do you move from one circular Earth orbit to another with two short burns?</p><div class="help-workflow"><h3>Fly a complete transfer</h3><ol><li>Choose a mission or enter two altitudes. Apply changes to start a new flight.</li><li>Burn 1 changes tangential speed and makes an ellipse. For an ascent, the opposite end reaches the higher circle.</li><li>Play to coast, or use “Coast to burn 2” to advance straight to arrival. The simulation pauses exactly at the planned burn time.</li><li>Burn 2 matches the destination's circular speed. A successful flight has both apsides within 1 km of the target and eccentricity below 0.0002.</li></ol></div><h3>What's actually simulated</h3><p>Position and velocity evolve under Newtonian gravity: acceleration points toward Earth's center, with magnitude μ / r². μ = 398,600.4418 km³/s². Earth's fixed radius is 6,371 km. The spacecraft is a massless test particle in a fixed two-dimensional plane.</p><p>The numerical integrator is fourth-order Runge–Kutta, with steps no longer than 8 seconds, 0.0015 local dynamical times, or 0.0015 radius-crossing times at the current speed. The time-rate control changes how fast you watch; it doesn't loosen the integration step. Earth contact stops the flight at the surface.</p><h3>How the plan is calculated</h3><p>The transfer's semi-major axis is half the sum of the two circular radii. Vis-viva gives the speed at each end: v² = μ(2/r − 1/a). Each signed Δv is the difference between circular and transfer speeds. Coasting takes half the ellipse's Kepler period. This is the ideal Hohmann transfer between coplanar circular orbits.</p><h3>Read the diagram</h3><p>The teal conic is the orbit implied by your present state, the gold circle is the target, and the pale trail is where you've flown. Geometry is to scale; spacecraft and velocity/gravity arrows are enlarged schematic indicators. Zoom, fit, or hide the arrows. “Unbounded” means there is no finite apoapsis or closed-orbit period.</p><h3>Assumptions & limits</h3><ul><li>No atmosphere, drag, Earth's oblateness, rotating surface, Moon, Sun, radiation pressure, or relativistic effects.</li><li>Instantaneous impulses with unlimited thrust. Δv is a velocity budget, not fuel mass. No rocket equation or finite-duration engines.</li><li>Planar trajectories only. No inclination changes, rendezvous, or live spacecraft data.</li><li>The high-orbit preset uses the familiar 35,786 km altitude, but doesn't model geostationary longitude or Earth rotation.</li><li>An osculating periapsis inside Earth marks an Earth-intersecting conic. For an outbound escape, that periapsis may already be behind you. Impact detection brackets surface crossings and checks the in-step periapsis for grazing contacts. It remains numerical and has finite precision.</li><li>No persistent storage. Your flight stays in this page only. Use the flight report to keep its values.</li></ul><h3>Experiment without losing your flight</h3><p>A manual impulse abandons the scheduled burn sequence, allowing elliptic, escape, and impact trajectories. Along/against velocity follows your motion; radial directions follow the Earth-spacecraft line. Undo restores the complete state before the last burn, coast jump, or mission change. Reset starts the current mission again.</p><p class="help-note">For intuition and experiments. Never use this model to operate a spacecraft.</p></div><div class="dialog-footer"><button class="primary-button" data-close="model-dialog">Back to the lab</button></div></dialog>
<dialog id="report-dialog"><div class="dialog-header"><div><div class="eyebrow">YOUR FLIGHT, IN NUMBERS</div><h2>Flight report</h2></div><button class="dialog-close" data-close="report-dialog" aria-label="Close flight report">×</button></div><div class="dialog-body"><p>This snapshot includes the mission, burns, current state, and model assumptions. Select it and copy it to keep a record.</p><textarea id="report-text" readonly spellcheck="false" aria-label="Flight report text"></textarea></div><div class="dialog-footer"><button id="select-report" class="outline-button">Select report</button><button class="primary-button" data-close="report-dialog">Done</button></div></dialog>`;

let flight = createFlight();
let running = false;
let speed = 240;
let zoom = 1;
let viewRadius = flight.plan.r2 * 1.25;
let vectors = true;
let history = [];
let trail = [{ x: flight.craft.x, y: flight.craft.y }];
let phaseSeen = flight.phase;
let dirty = true;
let renderedAt = 0;
let priorFrame = 0;
let conic = sampleOrbit(flight.craft);
let conicKey = '';
let selectedPreset = 0;
const canvas = $('space');
const ctx = canvas.getContext('2d');
let dimensions = { width: 600, height: 500 };
if (!ctx) $('canvas-fallback').hidden = false;

function announce(message) { $('announcement').textContent = message; }
function checkpoint(label) {
  history.push({ flight: structuredClone(flight), trail: structuredClone(trail), label, selectedPreset });
  if (history.length > 12) history.shift();
}
function refreshConic() {
  const e = orbitalElements(flight.craft);
  const key = `${flight.burns.length}:${e.energy.toFixed(7)}:${e.h.toFixed(3)}:${e.bound ? 'closed' : Math.ceil(e.radius / viewRadius)}`;
  if (key !== conicKey) {
    conic = sampleOrbit(flight.craft, 420, Math.max(viewRadius * 4, e.radius * 3));
    conicKey = key;
  }
}
function fit() {
  const e = orbitalElements(flight.craft);
  viewRadius = Math.max(EARTH_RADIUS * 1.6, flight.plan.r2, e.radius, e.bound ? Math.min(e.apoapsis, 500000) : Math.max(e.radius * 1.8, flight.plan.r2)) * 1.17;
  zoom = 1; conicKey = ''; dirty = true;
}
function updateInputs() {
  $('start-alt').value = flight.mission.startAltitude;
  $('target-alt').value = flight.mission.targetAltitude;
  $('mission-error').textContent = '';
  $('start-alt').removeAttribute('aria-invalid'); $('target-alt').removeAttribute('aria-invalid');
  document.querySelectorAll('[data-preset]').forEach((button, index) => {
    button.classList.toggle('selected', index === selectedPreset);
    button.setAttribute('aria-pressed', String(index === selectedPreset));
  });
}
function newMission(start, target, label, index = -1) {
  const next = createFlight(start, target, label);
  checkpoint('mission change');
  flight = next; selectedPreset = index; running = false;
  trail = [{ x: next.craft.x, y: next.craft.y }];
  phaseSeen = next.phase; conicKey = '';
  fit(); updateInputs();
  announce(`${label}: ${number(start)} to ${number(target)} km. Your new flight is ready. Undo can restore the previous mission.`);
  render();
}
function traceAdvance(seconds) {
  let remaining = seconds;
  while (remaining > 1e-8 && flight.phase !== 'impact' && flight.phase !== 'arrival') {
    const r = Math.hypot(flight.craft.x, flight.craft.y);
    const chunk = Math.min(remaining, 60, 0.04 * Math.sqrt(r ** 3 / MU));
    const beforeTime = flight.craft.t;
    flight = propagateFlight(flight, chunk);
    const last = trail.at(-1);
    if (!last || Math.hypot(last.x - flight.craft.x, last.y - flight.craft.y) > 8) {
      trail.push({ x: flight.craft.x, y: flight.craft.y });
      if (trail.length > 1500) trail.shift();
    }
    const used = flight.craft.t - beforeTime;
    if (used <= 1e-9) break;
    remaining -= used;
  }
}
function undo() {
  if (!history.length) return;
  const last = history.pop();
  flight = last.flight; trail = last.trail; selectedPreset = last.selectedPreset;
  running = false; phaseSeen = flight.phase; conicKey = '';
  updateInputs(); fit();
  announce(`Undid ${last.label}. Restored the full flight state at T+${clock(flight.craft.t)}.`);
  render();
}
function performNext() {
  try {
    if (flight.phase === 'parking') {
      checkpoint('departure burn'); flight = depart(flight); running = true;
      announce(`Departure burn applied: ${signDV(flight.plan.departureDV)}. Coasting toward the target; the flight will pause at burn 2.`);
    } else if (flight.phase === 'transfer') {
      checkpoint('coast jump'); traceAdvance(flight.arrivalAt - flight.craft.t); running = false;
      announce('Arrived at the transfer ellipse’s opposite apsis. Burn 2 is ready.');
    } else if (flight.phase === 'arrival') {
      checkpoint('circularization burn'); flight = circularize(flight); running = false;
      const assessment = targetAssessment(flight);
      announce(assessment.success ? `Target orbit achieved. ${number(flight.totalDV, 1)} m/s used across two burns. Both apsides are within ${number(assessment.apsisError * 1000, 3)} meters of the target.` : 'The resulting orbit did not meet the target tolerance. Undo the burn or reset to recover.');
    } else if (flight.phase === 'achieved' || flight.phase === 'free') {
      running = !running;
      announce(running ? 'Coasting. Gravity is the only force now.' : 'Flight paused.');
    } else if (flight.phase === 'impact') {
      newMission(flight.mission.startAltitude, flight.mission.targetAltitude, flight.mission.label, selectedPreset); return;
    }
    phaseSeen = flight.phase; conicKey = ''; dirty = true; render();
  } catch (error) { running = false; announce(error.message); render(); }
}
function togglePlay() {
  if (flight.phase === 'impact') return;
  if (flight.phase === 'arrival') {
    announce('Paused at burn 2. Circularize or apply a manual impulse before continuing.'); return;
  }
  running = !running; priorFrame = 0; dirty = true; render();
}
function validateDraft() {
  try { return hohmann(Number($('start-alt').value), Number($('target-alt').value)); }
  catch (error) { throw error; }
}
function updatePreview() {
  const amount = Number($('burn-size').value);
  try {
    if (!Number.isFinite(amount) || amount < 1 || amount > 2500) throw new RangeError('Enter an impulse from 1 to 2,500 m/s.');
    const future = orbitalElements(impulse(flight.craft, amount, $('burn-direction').value));
    const text = future.periapsis <= EARTH_RADIUS ? `Earth-intersecting orbit. Predicted periapsis ${number(future.periapsis - EARTH_RADIUS)} km.` : !future.bound ? `Escape trajectory. Periapsis ${number(future.periapsis - EARTH_RADIUS)} km; no finite apoapsis.` : `Preview: ${number(future.periapsis - EARTH_RADIUS)} km periapsis → ${number(future.apoapsis - EARTH_RADIUS)} km apoapsis.`;
    $('burn-preview').textContent = text;
    $('burn-preview').classList.toggle('danger', future.periapsis <= EARTH_RADIUS);
    $('burn-error').textContent = '';
    $('manual-fire').disabled = flight.phase === 'impact';
  } catch (error) { $('burn-preview').textContent = ''; $('burn-error').textContent = error.message; $('manual-fire').disabled = true; }
}

function render() {
  const el = orbitalElements(flight.craft);
  const phase = flight.phase;
  $('altitude').textContent = number(el.altitude, 1);
  $('velocity').textContent = number(el.speed, 3);
  $('periapsis').textContent = `${number(el.periapsis - EARTH_RADIUS, 1)} km`;
  $('apoapsis').textContent = el.bound ? `${number(el.apoapsis - EARTH_RADIUS, 1)} km` : 'Unbounded';
  $('period').textContent = duration(el.period);
  $('eccentricity').textContent = number(el.e, 5);
  $('used-dv').textContent = `${number(flight.totalDV, 1)} m/s`;
  $('energy').textContent = `${number(el.energy, 3)} km²/s²`;
  $('momentum').textContent = `${number(el.h, 1)} km²/s`;
  $('radial').textContent = `${number(el.radialSpeed, 3)} km/s`;
  $('elapsed').textContent = clock(flight.craft.t);
  $('run-status').textContent = running ? 'RUNNING' : 'PAUSED';
  $('play-icon').textContent = running ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-label', running ? 'Pause simulation' : 'Run simulation');
  $('play').disabled = phase === 'impact' || phase === 'arrival';
  $('undo').disabled = !history.length;
  $('undo').title = history.length ? `Undo ${history.at(-1).label}` : 'Nothing to undo yet';
  const statuses = { parking: 'PARKING ORBIT', transfer: 'IN TRANSFER', arrival: 'BURN 2 READY', achieved: 'TARGET ACHIEVED', free: 'FREE FLIGHT', impact: 'EARTH CONTACT' };
  $('phase-chip').textContent = statuses[phase];
  $('phase-chip').className = `phase-chip ${phase}`;
  $('active-mission').textContent = `${number(flight.mission.startAltitude)} → ${number(flight.mission.targetAltitude)} km`;
  $('dv-one').textContent = signDV(flight.plan.departureDV);
  $('dv-two').textContent = signDV(flight.plan.arrivalDV);
  $('dir-one').textContent = flight.plan.departureDV > 0 ? 'Prograde · add tangential speed' : 'Retrograde · remove tangential speed';
  $('dir-two').textContent = flight.plan.arrivalDV > 0 ? 'Prograde · match the target circle' : 'Retrograde · match the target circle';
  $('coast-time').textContent = duration(flight.plan.coastSeconds);
  $('total-dv').textContent = `${number(flight.plan.totalDV * 1000, 1)} m/s`;
  $('plan-coast').querySelector('h3').textContent = flight.plan.r2 > flight.plan.r1 ? 'Coast to apoapsis' : 'Coast to periapsis';
  const guided = ['parking', 'transfer', 'arrival', 'achieved'].includes(phase);
  const stage = { parking: 0, transfer: 1, arrival: 2, achieved: 3 }[phase] ?? -1;
  ['plan-one', 'plan-coast', 'plan-two'].forEach((id, i) => { $(id).classList.toggle('done', guided && stage > i); $(id).classList.toggle('active', guided && stage === i); $(id).classList.toggle('abandoned', !guided); });
  const fraction = stage >= 2 ? 1 : phase === 'transfer' ? Math.min(1, Math.max(0, (flight.craft.t - flight.departedAt) / flight.plan.coastSeconds)) : 0;
  $('progress-fill').style.width = `${fraction * 100}%`;
  $('arrival-countdown').textContent = phase === 'transfer' ? `Burn 2 in ${duration(flight.arrivalAt - flight.craft.t)}` : phase === 'arrival' ? 'Arrival · paused for burn 2' : phase === 'achieved' ? 'Target orbit achieved' : phase === 'free' ? 'Guided sequence canceled' : phase === 'impact' ? 'Flight stopped at surface' : `Coast ${duration(flight.plan.coastSeconds)}`;
  const actions = {
    parking: ['READY WHEN YOU ARE', 'Leave the parking orbit', 'The first impulse turns this circle into a transfer ellipse.', 'Burn 1 ↗'],
    transfer: ['LET GRAVITY DO THE WORK', 'Coasting to the target', 'Arrival pauses automatically. Jump ahead to the second burn if you like.', 'Coast to burn 2 →'],
    arrival: ['AT THE OPPOSITE APSIS', 'Turn the ellipse into a circle', `Apply ${signDV(flight.plan.arrivalDV)} to match the target’s circular speed.`, 'Burn 2 ↗'],
    achieved: ['MISSION COMPLETE', 'A circle, right where you wanted it.', `Both apsides match the target. Your two burns used ${number(flight.totalDV, 1)} m/s.`, running ? 'Pause coasting Ⅱ' : 'Keep coasting ▶'],
    free: ['YOUR OWN FLIGHT PATH', el.bound ? 'Explore the orbit you made' : 'On an escape trajectory', 'Manual impulses cancel the guided sequence. Undo or reset to return to it.', running ? 'Pause coasting Ⅱ' : 'Keep coasting ▶'],
    impact: ['FLIGHT STOPPED', 'Earth contact', 'The spacecraft reached the modeled surface. Undo the last action or start again.', 'Restart mission ↺'],
  };
  const action = actions[phase];
  $('action-eyebrow').textContent = action[0]; $('action-title').textContent = action[1]; $('action-description').textContent = action[2]; $('primary-action').textContent = action[3];
  const orbitText = phase === 'impact' ? 'Surface contact' : !el.bound ? (el.e > 1.00001 ? 'Hyperbolic · escape' : 'Parabolic · escape') : el.e < 0.0002 ? 'Circular · bound' : 'Elliptical · bound';
  $('orbit-status-text').textContent = orbitText;
  $('orbit-status').classList.toggle('danger', phase === 'impact' || el.periapsis <= EARTH_RADIUS);
  $('orbit-warning').hidden = el.periapsis > EARTH_RADIUS && phase !== 'impact';
  $('orbit-warning').textContent = phase === 'impact' ? 'The flight stopped at Earth’s surface. Reset or undo to recover.' : 'This orbit intersects Earth. Surface contact stops the flight; an outbound escape may have its periapsis behind it.';
  const draftChanged = Number($('start-alt').value) !== flight.mission.startAltitude || Number($('target-alt').value) !== flight.mission.targetAltitude;
  $('draft-note').textContent = draftChanged ? 'Unapplied changes. Apply starts a new flight; undo can recover this one.' : 'Changing the mission starts a new flight. You can undo it.';
  $('draft-note').classList.toggle('changed', draftChanged);
  $('apply-mission').disabled = !draftChanged;
  $('burn-count').textContent = `${flight.burns.length} ${flight.burns.length === 1 ? 'EVENT' : 'EVENTS'}`;
  if (flight.burns.length) {
    $('burn-log').replaceChildren(...flight.burns.slice(-8).map(burn => {
      const row = document.createElement('div'); row.className = 'burn-entry';
      const stamp = document.createElement('small'); stamp.textContent = `T+${clock(burn.t)} · ${number(burn.altitude)} km`;
      const line = document.createElement('div');
      const title = document.createElement('span'); title.textContent = burn.description;
      const value = document.createElement('strong'); value.textContent = `${number(burn.dv, 1)} m/s`;
      line.append(title, value); row.append(stamp, line); return row;
    }));
  } else $('burn-log').innerHTML = '<p class="empty-log">A blank page, a circular orbit.<br>Your burns will appear here.</p>';
  updatePreview(); refreshConic(); dirty = true;
}

// Canvas presentation is separate from the mechanics and makes no changes to flight state.
function draw() {
  if (!ctx) return;
  const { width: w, height: h } = dimensions;
  const center = { x: w / 2, y: h / 2 + 6 };
  const scale = Math.min(w, h) * 0.425 / (viewRadius / zoom);
  const point = p => ({ x: center.x + p.x * scale, y: center.y - p.y * scale });
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createRadialGradient(w * 0.45, h * 0.45, 0, w * 0.45, h * 0.45, w);
  bg.addColorStop(0, '#162d37'); bg.addColorStop(1, '#0b1921'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 95; i++) {
    const x = ((i * 172.718 + 32.31) % 997) / 997 * w;
    const y = ((i * 231.313 + 13.23) % 991) / 991 * h;
    ctx.fillStyle = `rgba(212,231,235,${i % 7 === 0 ? 0.32 : 0.1})`; ctx.fillRect(x, y, i % 7 === 0 ? 1.5 : 1, i % 7 === 0 ? 1.5 : 1);
  }
  // A quiet geometric reference grid, rather than decorative orbital rings.
  ctx.strokeStyle = 'rgba(137,180,190,0.075)'; ctx.lineWidth = 1;
  for (let x = center.x % 64; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = center.y % 64; y < h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const circle = (radius, color, dash = []) => { ctx.beginPath(); ctx.arc(center.x, center.y, radius * scale, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 1.1; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]); };
  circle(flight.plan.r1, 'rgba(147,174,183,0.27)', [2, 6]);
  circle(flight.plan.r2, flight.phase === 'achieved' ? '#b5d38d' : '#cfaf64', [6, 6]);
  ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = flight.phase === 'achieved' ? '#c5ddb0' : '#e2c985';
  const targetLabelY = center.y - flight.plan.r2 * scale - 9;
  if (targetLabelY > 67 && targetLabelY < h - 50) { ctx.textAlign = 'center'; ctx.fillText(`TARGET / ${number(flight.mission.targetAltitude)} KM`, center.x, targetLabelY); }
  // Conic preview: mathematical path, not a second integration or a patched trajectory.
  ctx.beginPath(); conic.forEach((p, i) => { const v = point(p); if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); });
  ctx.strokeStyle = '#64b9ba'; ctx.lineWidth = 1.6; ctx.setLineDash(flight.phase === 'parking' || flight.phase === 'achieved' ? [] : [3, 4]); ctx.stroke(); ctx.setLineDash([]);
  if (trail.length > 1) {
    ctx.beginPath(); trail.forEach((p, i) => { const v = point(p); if (!i) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); });
    ctx.strokeStyle = 'rgba(226,242,239,0.66)'; ctx.lineWidth = 2; ctx.stroke();
  }
  const earthR = EARTH_RADIUS * scale;
  ctx.save(); ctx.beginPath(); ctx.arc(center.x, center.y, earthR, 0, Math.PI * 2); ctx.clip();
  const earth = ctx.createRadialGradient(center.x - earthR * 0.35, center.y - earthR * 0.3, earthR * 0.05, center.x + earthR * 0.5, center.y + earthR * 0.2, earthR * 1.45);
  earth.addColorStop(0, '#396577'); earth.addColorStop(0.55, '#254b5c'); earth.addColorStop(1, '#10212d'); ctx.fillStyle = earth; ctx.fillRect(center.x - earthR, center.y - earthR, earthR * 2, earthR * 2);
  // Abstract land silhouettes, deliberately schematic instead of a false live map.
  ctx.translate(center.x, center.y); ctx.scale(earthR, earthR);
  ctx.fillStyle = '#718f81';
  const land = [ [[-.9,-.38],[-.63,-.77],[-.34,-.66],[-.4,-.35],[-.14,-.2],[-.32,.01],[-.56,-.04],[-.75,.16],[-.89,-.05]], [[-.37,.12],[-.08,.15],[.08,.4],[-.07,.63],[-.25,.88],[-.41,.56]], [[.06,-.67],[.41,-.87],[.73,-.57],[.88,-.39],[.53,-.12],[.34,-.22],[.17,-.04],[.02,-.16]], [[.12,-.08],[.39,.04],[.51,.26],[.3,.58],[.12,.35]], [[.55,.47],[.85,.5],[.94,.7],[.75,.8],[.57,.69]] ];
  land.forEach(poly => { ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill(); });
  ctx.strokeStyle = 'rgba(197,227,228,0.13)'; ctx.lineWidth = 0.006;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(0, i * 0.28, Math.sqrt(1 - (i * 0.28) ** 2), 0.1, 0, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, 0, i * 0.22, 1, 0, 0, Math.PI * 2); ctx.stroke(); }
  const shade = ctx.createLinearGradient(-1, 0, 1, 0); shade.addColorStop(0, 'rgba(8,19,26,0)'); shade.addColorStop(0.58, 'rgba(8,19,26,0.12)'); shade.addColorStop(1, 'rgba(8,19,26,0.66)'); ctx.fillStyle = shade; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
  circle(EARTH_RADIUS, 'rgba(123,193,206,0.5)');
  ctx.textAlign = 'center'; ctx.fillStyle = '#cee0e4'; ctx.font = '11px ui-monospace, monospace';
  if (earthR > 36) { ctx.fillText('EARTH', center.x, center.y - 1); ctx.fillStyle = '#9db5be'; ctx.font = '9px ui-monospace, monospace'; ctx.fillText('R 6,371 KM', center.x, center.y + 14); }
  const el = orbitalElements(flight.craft);
  if (el.e > 0.002 && el.bound) {
    const c = Math.cos(el.orientation), s = Math.sin(el.orientation);
    const markers = [{ x: el.periapsis * c, y: el.periapsis * s, text: `Pe ${number(el.periapsis - EARTH_RADIUS)} km` }, { x: -el.apoapsis * c, y: -el.apoapsis * s, text: `Ap ${number(el.apoapsis - EARTH_RADIUS)} km` }];
    markers.forEach(m => {
      const p = point(m);
      if (p.x < 20 || p.x > w - 20 || p.y < 75 || p.y > h - 58 || Math.hypot(m.x, m.y) < EARTH_RADIUS) return;
      ctx.fillStyle = '#66b8b9'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.font = '10px ui-monospace, monospace'; ctx.fillStyle = '#aad1d2'; ctx.textAlign = p.x > center.x ? 'right' : 'left'; ctx.fillText(m.text, p.x + (p.x > center.x ? -9 : 9), p.y - 10);
    });
  }
  const craft = point(flight.craft);
  function arrow(dx, dy, color, label) {
    const length = Math.hypot(dx, dy); if (!length) return;
    const ux = dx / length, uy = dy / length, end = { x: craft.x + ux * 49, y: craft.y + uy * 49 };
    ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(craft.x + ux * 11, craft.y + uy * 11); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - ux * 7 - uy * 3, end.y - uy * 7 + ux * 3); ctx.lineTo(end.x - ux * 7 + uy * 3, end.y - uy * 7 - ux * 3); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.font = 'italic 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, end.x + ux * 9, end.y + uy * 9);
  }
  if (vectors && flight.phase !== 'impact') { arrow(flight.craft.vx, -flight.craft.vy, '#dfc274', 'v'); arrow(-flight.craft.x, flight.craft.y, '#7b9ca7', 'g'); }
  const glow = ctx.createRadialGradient(craft.x, craft.y, 0, craft.x, craft.y, 18); glow.addColorStop(0, 'rgba(223,241,235,0.22)'); glow.addColorStop(1, 'rgba(223,241,235,0)'); ctx.fillStyle = glow; ctx.fillRect(craft.x - 18, craft.y - 18, 36, 36);
  ctx.save(); ctx.translate(craft.x, craft.y); ctx.rotate(-Math.atan2(flight.craft.vy, flight.craft.vx));
  ctx.fillStyle = flight.phase === 'impact' ? '#e1a497' : '#edf1df'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
  // A true length scale, independent of device pixel ratio.
  const want = 76 / scale, exponent = 10 ** Math.floor(Math.log10(want));
  const scaleKm = [1, 2, 5, 10].map(n => n * exponent).reduce((best, n) => Math.abs(n - want) < Math.abs(best - want) ? n : best, exponent);
  const length = scaleKm * scale;
  ctx.strokeStyle = '#849da7'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(22, h - 57); ctx.lineTo(22 + length, h - 57); ctx.moveTo(22, h - 61); ctx.lineTo(22, h - 53); ctx.moveTo(22 + length, h - 61); ctx.lineTo(22 + length, h - 53); ctx.stroke();
  ctx.fillStyle = '#92a9b2'; ctx.textAlign = 'left'; ctx.font = '9px ui-monospace, monospace'; ctx.fillText(`${number(scaleKm)} KM`, 22, h - 68);
  dirty = false;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  dimensions = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(dimensions.width * dpr); canvas.height = Math.round(dimensions.height * dpr);
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dirty = true;
}
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeCanvas).observe(canvas);
else window.addEventListener('resize', resizeCanvas);

function tick(time) {
  const elapsedReal = priorFrame ? Math.min((time - priorFrame) / 1000, 0.12) : 0;
  priorFrame = time;
  if (running && elapsedReal > 0) {
    traceAdvance(elapsedReal * speed);
    if (flight.phase !== phaseSeen) {
      phaseSeen = flight.phase;
      if (flight.phase === 'arrival') { running = false; announce('Burn 2 is ready. The flight paused at the planned arrival time.'); }
      if (flight.phase === 'impact') { running = false; announce('Earth contact. The flight has stopped. Undo the last action or reset to recover.'); }
      render();
    }
    if (time - renderedAt > 130) { render(); renderedAt = time; }
    dirty = true;
  }
  if (dirty) draw();
  requestAnimationFrame(tick);
}

$('mission-form').addEventListener('submit', event => {
  event.preventDefault();
  try { validateDraft(); newMission(Number($('start-alt').value), Number($('target-alt').value), 'Custom transfer'); }
  catch (error) { $('mission-error').textContent = error.message; $('start-alt').setAttribute('aria-invalid', 'true'); $('target-alt').setAttribute('aria-invalid', 'true'); }
});
['start-alt', 'target-alt'].forEach(id => $(id).addEventListener('input', () => { $('mission-error').textContent = ''; $(id).removeAttribute('aria-invalid'); render(); }));
document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => { const i = Number(button.dataset.preset); const p = presets[i]; newMission(p.start, p.target, p.label, i); }));
$('primary-action').addEventListener('click', performNext);
$('play').addEventListener('click', togglePlay);
$('undo').addEventListener('click', undo);
$('reset').addEventListener('click', () => newMission(flight.mission.startAltitude, flight.mission.targetAltitude, flight.mission.label, selectedPreset));
$('speed').addEventListener('change', () => { speed = Number($('speed').value); });
$('manual-fire').addEventListener('click', () => {
  try {
    const dv = Number($('burn-size').value); const direction = $('burn-direction').value;
    const next = manualBurn(flight, dv, direction);
    checkpoint('manual impulse'); flight = next; running = false; phaseSeen = flight.phase; conicKey = '';
    announce(`Applied ${number(dv)} m/s ${$('burn-direction').selectedOptions[0].textContent.toLowerCase()}. Guided burns are canceled. Undo restores the planned flight.`); render();
  } catch (error) { $('burn-error').textContent = error.message; }
});
$('burn-size').addEventListener('input', updatePreview); $('burn-direction').addEventListener('change', updatePreview);
$('zoom-in').addEventListener('click', () => { zoom = Math.min(8, zoom * 1.25); dirty = true; });
$('zoom-out').addEventListener('click', () => { zoom = Math.max(0.15, zoom / 1.25); dirty = true; });
$('fit-view').addEventListener('click', fit);
$('vectors').addEventListener('click', () => { vectors = !vectors; $('vectors').setAttribute('aria-pressed', String(vectors)); dirty = true; });
canvas.addEventListener('wheel', event => { event.preventDefault(); zoom = Math.min(8, Math.max(0.15, zoom * (event.deltaY < 0 ? 1.09 : 1 / 1.09))); dirty = true; }, { passive: false });
function openModel() { running = false; render(); $('model-dialog').showModal(); }
$('model-open').addEventListener('click', openModel); $('help-footer').addEventListener('click', openModel);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
$('report-open').addEventListener('click', () => {
  running = false; render();
  const e = orbitalElements(flight.craft);
  $('report-text').value = `ORBIT WORKSHOP — FLIGHT REPORT\n\nMission: ${flight.mission.label}\nParking: ${number(flight.mission.startAltitude)} km\nTarget: ${number(flight.mission.targetAltitude)} km\nState: ${flight.phase}\nElapsed: ${clock(flight.craft.t)} (${number(flight.craft.t, 3)} s)\n\nPLAN\nDeparture Δv: ${signDV(flight.plan.departureDV)}\nArrival Δv: ${signDV(flight.plan.arrivalDV)}\nCoast: ${number(flight.plan.coastSeconds, 3)} s\nPlanned total: ${number(flight.plan.totalDV * 1000, 3)} m/s\nActual Δv used: ${number(flight.totalDV, 3)} m/s\n\nCURRENT OSCULATING ORBIT\nAltitude: ${number(e.altitude, 6)} km\nSpeed: ${number(e.speed, 9)} km/s\nPeriapsis altitude: ${number(e.periapsis - EARTH_RADIUS, 6)} km\nApoapsis altitude: ${e.bound ? number(e.apoapsis - EARTH_RADIUS, 6) + ' km' : 'unbounded'}\nEccentricity: ${number(e.e, 10)}\nPeriod: ${e.bound ? number(e.period, 3) + ' s' : 'unbounded'}\nSpecific energy: ${number(e.energy, 9)} km²/s²\nAngular momentum: ${number(e.h, 6)} km²/s\nPosition: (${number(flight.craft.x, 9)}, ${number(flight.craft.y, 9)}) km\nVelocity: (${number(flight.craft.vx, 12)}, ${number(flight.craft.vy, 12)}) km/s\n\nBURN JOURNAL\n${flight.burns.length ? flight.burns.map(b => `T+${clock(b.t)} — ${b.description}: ${number(b.dv, 3)} m/s at ${number(b.altitude, 3)} km`).join('\n') : 'No impulses applied.'}\n\nMODEL\nPlanar Earth-centered Newtonian two-body dynamics. μ = ${MU} km³/s²; spherical Earth radius ${EARTH_RADIUS} km. RK4 step ≤8 s, ≤0.0015 local dynamical times, and ≤0.0015 radius-crossing times. Impulses are instantaneous; no atmosphere, other gravitating bodies, oblateness, finite thrust, fuel-mass model, or inclination. Target success: both apsides within 1 km, eccentricity <0.0002. Not for navigation. This snapshot is local to the page.`;
  $('report-dialog').showModal();
});
$('select-report').addEventListener('click', () => { $('report-text').focus(); $('report-text').select(); });
// Opening help also freezes the simulation; dismissal never silently resumes it.
$('model-dialog').addEventListener('toggle', () => { if ($('model-dialog').open) { running = false; render(); } });
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName)) return;
  if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
  if (event.key.toLowerCase() === 'b') { event.preventDefault(); performNext(); }
  if (event.key.toLowerCase() === 'u') { event.preventDefault(); undo(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && running) { running = false; render(); announce('Paused while this page was hidden. Press play to continue.'); } priorFrame = 0; });
render(); resizeCanvas(); requestAnimationFrame(tick);
