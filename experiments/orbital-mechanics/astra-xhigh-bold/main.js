import './style.css';
import { MU, EARTH, AIR, fromApsides, elements, propagate, timeToApoapsis, timeToEntry, repairAt, makePlan } from './physics.js';

const ICONS = {
  play: '<path d="m6 3 10 7-10 7Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M6 3v14M14 3v14" stroke-width="4"/>',
  reset: '<path d="M4 6a7 7 0 1 1-1 7M4 2v5h5"/>',
  book: '<path d="M3 3h6l1 2 1-2h6v13h-6l-1 2-1-2H3ZM10 5v11"/>',
  arrow: '<path d="M3 10h14M11 4l6 6-6 6"/>'
};
const icon = name => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${ICONS[name]}</svg>`;
const cases = [
  { name: 'LARK / 03', type: 'RETURN CAPSULE', perigee: 60, apogee: 1200, anomaly: 90, target: 180, title: 'A second\nchance.', brief: 'A capsule has one working thruster and an orbit that clips the air. Give it a future.' },
  { name: 'SPINDLE / 11', type: 'FREIGHT MODULE', perigee: 35, apogee: 2800, anomaly: 115, target: 220, title: 'Heavy\nlifting.', brief: 'A stranded freight module is falling back. A well-timed nudge can save a very long orbit.' },
  { name: 'ECHO / 07', type: 'SURVEY PROBE', perigee: 90, apogee: 700, anomaly: 55, target: 160, title: 'A narrow\nwindow.', brief: 'Low, fast, and almost out of room. Keep the entire orbit above the recovery line.' }
];
const $ = id => document.getElementById(id);
const fmt = (n, digits = 0) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '∞';
const time = seconds => {
  const s = Math.max(0, Math.round(seconds)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
let selectedCase = 0, initial, burnTime = 0, tangential = 0, radial = 0, target = 180, plan;
let elapsed = 0, running = false, speed = 120, zoom = 1, scale = 1;
let baseSamples = [], preSamples = [], postSamples = [], currentSize = { w: 600, h: 500 };
let padScale = 300, toastTimer, needsDraw = true, lastFrame = 0;

$('app').innerHTML = `
<header class="masthead">
 <div class="brand"><div class="brand-symbol" aria-hidden="true"></div><div class="wordmark">LAST LIGHT<span>ORBITAL SALVAGE</span></div></div>
 <div class="mast-statement">Some orbits need a second chance.<br>One spacecraft. One impulse. Your call.</div>
 <div class="mast-tools"><span class="edition">FLIGHT DESK<br>NO. 001 / EARTH</span><button id="guide" class="text-button">${icon('book')} Field guide</button><button id="model" class="text-button">The physics ↗</button></div>
</header>
<main class="workbench">
 <aside class="case-panel" aria-label="Spacecraft dossier">
  <div class="case-opening"><div class="eyebrow"><span class="dot"></span> RECOVERY DOSSIER</div><h2 class="case-title" id="case-title"></h2><p class="intro" id="case-brief"></p></div>
  <div class="case-chooser" role="group" aria-label="Choose a spacecraft">${cases.map((c, i) => `<button class="case-button${i === 0 ? ' selected' : ''}" data-case="${i}" aria-pressed="${i === 0}"><span>${c.name}<span class="case-type">${c.type}</span></span><span class="case-arrow">↗</span></button>`).join('')}</div>
  <div class="case-spec"><div class="eyebrow">AS RECEIVED</div><dl><div class="data-row"><dt>Perigee</dt><dd id="initial-perigee"></dd></div><div class="data-row"><dt>Apogee</dt><dd id="initial-apogee"></dd></div><div class="data-row"><dt>Orbital period</dt><dd id="initial-period"></dd></div></dl><div class="deadline"><div class="eyebrow">WITHOUT INTERVENTION</div><div class="deadline-number" id="deadline"></div><small id="deadline-caption">UNTIL THE 120 KM AIR LINE</small></div></div>
  <details class="custom"><summary>Edit the incoming orbit</summary><div class="custom-grid"><label for="custom-perigee">Perigee · km</label><input id="custom-perigee" type="number" min="0" max="20000" value="60"><label for="custom-apogee">Apogee · km</label><input id="custom-apogee" type="number" min="120" max="20000" value="1200"><label for="custom-anomaly">True anomaly · °</label><input id="custom-anomaly" type="number" min="0" max="359" value="90"></div><button class="small-button" id="apply-orbit">Load custom orbit ↗</button><p class="error" id="orbit-error" role="alert"></p></details>
  <div class="case-bottom"><b>↳</b><span>NOTHING IS LOST<br>UNTIL YOU STOP LOOKING.</span></div>
 </aside>
 <section class="orbit-section" aria-label="Interactive orbit map">
  <header class="orbit-header"><div><span class="eyebrow">EARTH-CENTERED / INERTIAL</span><strong id="map-title">LARK / 03</strong></div><div class="view-controls"><button class="icon-button" id="zoom-out" aria-label="Zoom out">−</button><button class="icon-button" id="zoom-in" aria-label="Zoom in">+</button><button class="icon-button fit" id="fit" title="Fit trajectory in view">FIT</button></div></header>
  <div class="orbit-field" id="orbit-field"><canvas id="orbit" aria-label="Orbit diagram. Gray shows the unmodified trajectory; yellow shows the planned trajectory. Click the gray arc to set the burn time." role="img"></canvas><div class="orbit-label"><div class="legend"><span class="swatch"></span> incoming orbit</div><div class="legend"><span class="swatch plan"></span> your intervention</div><div class="legend"><span class="swatch air"></span> 120 km air line</div></div><div class="north">ONE PLANE. REAL GRAVITY.</div><div class="orbit-note">↗ Click the gray arc to choose your burn point</div></div>
  <div class="orbit-readouts" aria-label="Replay telemetry"><div><span class="label">ALTITUDE / NOW</span><span class="read-value current-alt" id="current-alt">—</span></div><div><span class="label">VELOCITY / NOW</span><span class="read-value" id="current-speed">—</span></div><div><span class="label">FLIGHT PHASE</span><span class="read-value phase" id="phase">COASTING</span></div></div>
 </section>
 <section class="burn-panel" aria-label="Plan a maneuver">
  <div class="burn-top"><div><span class="eyebrow">THE INTERVENTION</span><h1>A little push.<br>A different ending.</h1></div><span class="burn-index">↗</span></div>
  <div class="burn-block time-block"><label class="control-label" for="burn-time"><span><span class="step-number">01</span> Choose the moment</span><strong id="burn-time-value"></strong></label><input id="burn-time" type="range" min="0" max="5000" step="1" value="0"><div class="range-caption"><span>T+ 00:00</span><button class="link-button" id="at-apo">Go to apogee ↗</button></div></div>
  <div class="burn-block vector-block"><div class="control-label"><span><span class="step-number">02</span> Shape the impulse</span><button id="zero" class="link-button">Zero</button></div><div class="vector-wrap"><canvas id="vector-pad" class="vector-pad" aria-label="Drag to set the impulse vector. Right adds tangential speed; up adds outward radial speed. Numeric alternatives follow." role="img"></canvas><div class="vector-side">PAD<br>RANGE<br><strong id="pad-scale">300</strong><br>m/s</div></div><div class="dv-fields"><div class="dv-field"><label for="tangential">TANGENTIAL + / −</label><div class="number-box"><input id="tangential" type="number" min="-1500" max="1500" step="1" value="0"><small>m/s</small></div></div><div class="dv-field"><label for="radial">RADIAL OUT / IN</label><div class="number-box"><input id="radial" type="number" min="-1500" max="1500" step="1" value="0"><small>m/s</small></div></div></div><button id="assist" class="assist-button"><span>Find a minimum-cost repair</span>${icon('arrow')}</button><p id="burn-error" class="error" role="alert"></p></div>
  <div class="burn-footer"><div class="target-row"><label for="target">Recovery line</label><div class="target-box"><input id="target" type="number" min="121" max="5000" step="10" value="180"><span>km</span></div></div><p class="small-note">Lift the whole orbit above this line. Stay bound to Earth.</p><div class="budget-line"><span>IMPULSE COST / Δv</span><strong id="dv-cost">0 <small>m/s</small></strong></div><div style="display:flex;justify-content:space-between;margin-top:15px"><button id="reset" class="link-button">Reset repair</button><button id="record" class="link-button">Flight sheet ↗</button></div></div>
 </section>
 <section class="tape" aria-label="Forecast and replay">
  <div id="outcome" class="outcome entry" aria-live="polite"><span class="eyebrow"><span class="dot"></span> POST-BURN FORECAST</span><div class="outcome-word" id="outcome-word">NOT YET.</div><div class="outcome-detail" id="outcome-detail"></div></div>
  <div class="timeline"><div class="transport"><button id="play" class="play-button" aria-label="Play trajectory">${icon('play')}</button><button id="rewind" class="link-button" aria-label="Rewind to launch">↶</button><span class="time-display" id="elapsed">T+ 00:00</span><label class="speed-control">PLAYBACK <select id="speed" aria-label="Playback speed"><option value="30">30×</option><option value="120" selected>120×</option><option value="300">300×</option><option value="600">600×</option></select></label></div><div class="timeline-track"><div class="time-mark" id="burn-mark"><span>BURN</span></div><div class="time-mark entry-mark" id="entry-mark"><span>AIR</span></div><input id="scrub" aria-label="Replay time" type="range" min="0" max="5000" step="1" value="0"><div class="tape-caption"><span>00:00 / RECEIVED</span><span id="duration">—</span></div></div></div>
  <dl class="result-stats"><div class="data-row"><dt>New perigee<small>LOWEST POINT AFTER THE BURN</small></dt><dd class="result-major" id="new-perigee"></dd></div><div class="data-row"><dt>New apogee</dt><dd id="new-apogee"></dd></div><div class="data-row"><dt>Perigee gained</dt><dd id="gained"></dd></div></dl>
 </section>
</main>
<footer class="page-footer"><div class="footer-steps"><span><b>1</b> Find your moment</span><span><b>2</b> Shape the impulse</span><span><b>3</b> Play the alternate ending</span></div><span><strong>KEPLER, NOT MAGIC.</strong> Ideal impulses · two-body gravity · no drag</span><span>PLANAR FLIGHT DESK / v1.0</span></footer>
<div id="toast" class="toast" role="status" hidden></div>
<dialog id="info-dialog" aria-labelledby="dialog-title"><div class="dialog-head"><div><div class="eyebrow" id="dialog-tag">LAST LIGHT / FIELD NOTES</div><h2 id="dialog-title"></h2></div><button class="close-dialog" id="close-dialog" aria-label="Close dialog">×</button></div><div class="dialog-content" id="dialog-content"></div></dialog>`;

const orbitCanvas = $('orbit'), ctx = orbitCanvas.getContext('2d');
const pad = $('vector-pad'), pctx = pad.getContext('2d');
function notify(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4800);
}
function setPlaying(value) {
  running = value; $('play').innerHTML = icon(running ? 'pause' : 'play');
  $('play').setAttribute('aria-label', running ? 'Pause trajectory' : 'Play trajectory');
  lastFrame = 0;
}
function sample(state, duration, n = 240) {
  return Array.from({ length: n + 1 }, (_, i) => { const t = duration * i / n; return { ...propagate(state, t), t }; });
}
function recalculate(rebuildBase = false) {
  try {
    plan = makePlan(initial, burnTime, tangential, radial, target); burnTime = plan.burnTime;
    if (rebuildBase) baseSamples = sample(initial, plan.window, 400);
    preSamples = sample(initial, burnTime, 100);
    postSamples = sample(plan.after, Math.max(0, plan.duration - burnTime), 320);
    elapsed = Math.min(elapsed, plan.duration);
    $('burn-error').textContent = '';
    updatePlanUI(); needsDraw = true;
  } catch (err) { setPlaying(false); $('burn-error').textContent = err.message; }
}
function updatePlanUI() {
  $('burn-time').max = Math.max(0, plan.window - 0.1); $('burn-time').value = burnTime;
  $('burn-time-value').textContent = `T+ ${time(burnTime)}`;
  $('tangential').value = Number(tangential.toFixed(1)); $('radial').value = Number(radial.toFixed(1)); $('target').value = target;
  $('dv-cost').innerHTML = `${fmt(plan.cost, 1)} <small>m/s</small>`;
  $('new-perigee').innerHTML = `${fmt(plan.orbit.perigee, 1)} <small>km</small>`;
  $('new-apogee').textContent = plan.orbit.bound ? `${fmt(plan.orbit.apogee)} km` : 'OPEN TRAJECTORY';
  const gain = plan.orbit.perigee - plan.original.perigee;
  $('gained').textContent = `${gain >= -0.000001 ? '+' : ''}${fmt(gain, 1)} km`;
  const outcomes = {
    entry: ['NOT YET.', `Reaches the air at T+ ${time(plan.entryTime)}. Raise that low point.`],
    clear: ['SECOND LIFE.', `Perigee clears ${fmt(target)} km. This orbit stays out of the air.`],
    low: ['ALMOST.', `Above the air, below recovery. Find ${fmt(target - plan.orbit.perigee, 1)} km more.`],
    escape: ['TOO FAR.', plan.entryTime !== null ? 'Unbound, but still headed into the air. Redirect the impulse.' : 'An escape trajectory. Recovery requires a closed orbit.']
  };
  $('outcome').className = `outcome ${plan.outcome}`;
  $('outcome-word').textContent = outcomes[plan.outcome][0]; $('outcome-detail').textContent = outcomes[plan.outcome][1];
  $('scrub').max = plan.duration;
  $('duration').textContent = `${time(plan.duration)} / ${plan.endsAtEntry ? 'AIR LINE' : plan.orbit.bound ? plan.orbit.period > 8 * 3600 ? '8H COAST LIMIT' : 'ONE POST-BURN ORBIT' : '2H AFTER BURN'}`;
  $('burn-mark').style.left = `${Math.max(2, Math.min(98, burnTime / plan.duration * 100))}%`;
  $('entry-mark').hidden = plan.deadline === null || plan.deadline > plan.duration;
  if (plan.deadline !== null) $('entry-mark').style.left = `${Math.max(2, Math.min(98, plan.deadline / plan.duration * 100))}%`;
  $('entry-mark').title = 'Air entry time without a burn';
  $('at-apo').disabled = timeToApoapsis(initial) >= plan.window;
  padScale = Math.max(300, Math.ceil(Math.max(Math.abs(radial), Math.abs(tangential)) / 300) * 300);
  $('pad-scale').textContent = padScale;
  drawPad(); updateTelemetry();
}
function updateTelemetry() {
  if (!plan) return;
  const state = plan.stateAt(elapsed), el = elements(state);
  $('current-alt').innerHTML = `${fmt(el.r - EARTH, 1)}<small>km</small>`;
  $('current-speed').innerHTML = `${fmt(el.speed, 3)}<small>km/s</small>`;
  $('elapsed').textContent = `T+ ${time(elapsed)}`; $('scrub').value = elapsed;
  $('phase').textContent = elapsed >= plan.duration - 0.01 ? (plan.endsAtEntry ? 'AIR LINE / STOP' : 'REPLAY COMPLETE') : elapsed < burnTime ? 'PRE-BURN COAST' : plan.cost > 0 ? 'POST-BURN COAST' : 'UNMODIFIED';
}
function loadCase(index) {
  selectedCase = index; const c = cases[index];
  initial = fromApsides(c.perigee, c.apogee, c.anomaly); target = c.target;
  tangential = 0; radial = 0; elapsed = 0; zoom = 1; setPlaying(false);
  burnTime = timeToApoapsis(initial);
  $('case-title').innerHTML = c.title.split('\n').map(x => `<span>${x}</span>`).join('');
  $('case-brief').textContent = c.brief; $('map-title').textContent = c.name;
  document.querySelectorAll('[data-case]').forEach(b => { const active = +b.dataset.case === index; b.classList.toggle('selected', active); b.setAttribute('aria-pressed', active); });
  $('custom-perigee').value = c.perigee; $('custom-apogee').value = c.apogee; $('custom-anomaly').value = c.anomaly;
  $('orbit-error').textContent = ''; updateDossier(); recalculate(true);
}
function updateDossier() {
  const el = elements(initial), entry = timeToEntry(initial);
  $('initial-perigee').textContent = `${fmt(el.perigee)} km`; $('initial-apogee').textContent = `${fmt(el.apogee)} km`; $('initial-period').textContent = `${fmt(el.period / 60, 1)} min`;
  $('deadline').textContent = entry === null ? 'NO ENTRY' : time(entry);
  $('deadline-caption').textContent = entry === null ? 'ORBIT DOES NOT CROSS THE AIR LINE' : 'UNTIL THE 120 KM AIR LINE';
}
function edited() { setPlaying(false); recalculate(); }

// Canvas renders a metrically scaled inertial view, centered on Earth.
function project(r) { return { x: currentSize.w / 2 + r[0] * scale, y: currentSize.h / 2 - r[1] * scale }; }
function line(points, color, width = 1, dash = []) {
  ctx.beginPath(); points.forEach((s, i) => { const p = project(s.r); if (!i) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
}
function drawOrbit() {
  if (!ctx || !plan) return;
  const { w, h } = currentSize, cx = w / 2, cy = h / 2;
  const extent = Math.max(EARTH + target + 600, ...baseSamples.map(s => Math.hypot(...s.r)), ...postSamples.map(s => Math.hypot(...s.r)));
  scale = Math.min(w - 82, h - 106) / (2 * extent) * zoom;
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#171c18'; ctx.fillRect(0, 0, w, h);
  // Survey grid and field ticks.
  ctx.strokeStyle = '#283025'; ctx.lineWidth = 0.7;
  const grid = 45;
  for (let x = cx % grid; x < w; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = cy % grid; y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = '#3a4433'; ctx.setLineDash([2, 5]); ctx.beginPath();ctx.moveTo(cx,0);ctx.lineTo(cx,h);ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.stroke();ctx.setLineDash([]);
  const er = EARTH * scale;
  // Recovery boundary. Orbit and Earth are to scale; no magnified atmosphere.
  ctx.beginPath();ctx.arc(cx,cy,(EARTH+target)*scale,0,Math.PI*2);ctx.strokeStyle='#668549';ctx.lineWidth=.9;ctx.setLineDash([2,4]);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.arc(cx,cy,(EARTH+AIR)*scale,0,Math.PI*2);ctx.strokeStyle='#d3896c';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);
  // The planet is a drafting instrument, deliberately not a globe photograph.
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,er,0,Math.PI*2);ctx.clip();ctx.fillStyle='#293226';ctx.fillRect(cx-er,cy-er,er*2,er*2);
  ctx.strokeStyle='#3d4836';ctx.lineWidth=.6;
  for(let x=cx-er*2;x<cx+er*2;x+=8){ctx.beginPath();ctx.moveTo(x,cy-er);ctx.lineTo(x+er*2,cy+er);ctx.stroke();}
  ctx.fillStyle='#20271e';ctx.beginPath();ctx.ellipse(cx+er*.43,cy,er*.85,er*1.05,-.24,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#4d5a42';ctx.lineWidth=.6;
  for(const f of [-.65,-.3,.3,.65]){const yy=cy+er*f,dx=er*Math.sqrt(1-f*f);ctx.beginPath();ctx.ellipse(cx,yy,dx,er*.1,0,0,Math.PI*2);ctx.stroke();}
  for(const f of [.3,.65]){ctx.beginPath();ctx.ellipse(cx,cy,er*f,er,0,0,Math.PI*2);ctx.stroke();}
  ctx.restore();ctx.beginPath();ctx.arc(cx,cy,er,0,Math.PI*2);ctx.strokeStyle='#72815e';ctx.lineWidth=1.1;ctx.stroke();
  ctx.textAlign='center';ctx.fillStyle='#a2af92';ctx.font='10px "Courier New",monospace';ctx.fillText('E A R T H',cx,cy-4);ctx.fillStyle='#5f6e50';ctx.font='8px "Courier New",monospace';ctx.fillText('6,371 KM',cx,cy+11);
  line(baseSamples,'#869279',1.25,[3,5]);
  line(preSamples,'#b4c0a5',1.3);
  line(postSamples,'#e9ff6b',1.8);
  // Burn point: a square stamp and an impulse vector, expressed in the local frame.
  const burn = project(plan.atBurn.r), elb=elements(plan.atBurn), ux=plan.atBurn.r[0]/elb.r,uy=plan.atBurn.r[1]/elb.r;
  const dx=(-uy*tangential+ux*radial),dy=-(ux*tangential+uy*radial),dlen=Math.hypot(dx,dy);
  if(dlen>0.01){const length=Math.min(74,24+dlen*.09),ex=burn.x+dx/dlen*length,ey=burn.y+dy/dlen*length;
    ctx.beginPath();ctx.moveTo(burn.x,burn.y);ctx.lineTo(ex,ey);ctx.strokeStyle='#e9ff6b';ctx.lineWidth=2;ctx.stroke();
    const a=Math.atan2(dy,dx);ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-8*Math.cos(a-.42),ey-8*Math.sin(a-.42));ctx.lineTo(ex-8*Math.cos(a+.42),ey-8*Math.sin(a+.42));ctx.closePath();ctx.fillStyle='#e9ff6b';ctx.fill();}
  ctx.fillStyle='#e9ff6b';ctx.fillRect(burn.x-4,burn.y-4,8,8);ctx.strokeStyle='#171c18';ctx.lineWidth=1;ctx.strokeRect(burn.x-4,burn.y-4,8,8);
  // Label at burn point, clamped into the plot.
  const labelX=Math.max(62,Math.min(w-64,burn.x)),labelY=Math.max(104,Math.min(h-50,burn.y-16));
  ctx.fillStyle='#e9ff6b';ctx.textAlign='center';ctx.font='9px "Courier New",monospace';ctx.fillText(`BURN / ${time(burnTime)}`,labelX,labelY);
  // Atmospheric endpoint of the no-burn future.
  if(plan.deadline!==null){const end=project(baseSamples.at(-1).r);ctx.strokeStyle='#ec886b';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(end.x-4,end.y-4);ctx.lineTo(end.x+4,end.y+4);ctx.moveTo(end.x+4,end.y-4);ctx.lineTo(end.x-4,end.y+4);ctx.stroke();}
  const state=plan.stateAt(elapsed), pos=project(state.r), heading=Math.atan2(-state.v[1],state.v[0]);
  ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(heading);ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-4);ctx.lineTo(-3,0);ctx.lineTo(-5,4);ctx.closePath();ctx.fillStyle='#f6f7ee';ctx.fill();ctx.strokeStyle='#182017';ctx.lineWidth=1.1;ctx.stroke();ctx.restore();
  ctx.beginPath();ctx.arc(pos.x,pos.y,11,0,Math.PI*2);ctx.strokeStyle='#e6edd84d';ctx.lineWidth=1;ctx.stroke();
  // Scale bar is physical distance, not a decorational fixed label.
  const length=1000*scale;ctx.strokeStyle='#879779';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w-26-length,h-26);ctx.lineTo(w-26,h-26);ctx.moveTo(w-26-length,h-29);ctx.lineTo(w-26-length,h-23);ctx.moveTo(w-26,h-29);ctx.lineTo(w-26,h-23);ctx.stroke();ctx.fillStyle='#879779';ctx.font='8px "Courier New",monospace';ctx.textAlign='right';ctx.fillText('1,000 km',w-26,h-34);
}
function drawPad() {
  if (!pctx) return;
  const size = pad.clientWidth || 180, dpr = Math.min(window.devicePixelRatio || 1, 2);
  if(pad.width!==Math.round(size*dpr)){pad.width=Math.round(size*dpr);pad.height=Math.round(size*dpr);}
  pctx.setTransform(dpr,0,0,dpr,0,0);pctx.clearRect(0,0,size,size);
  const c=size/2,range=c-23;
  pctx.strokeStyle='#bdc7aa';pctx.lineWidth=.7;
  for(const f of [.5,1]){pctx.beginPath();pctx.arc(c,c,range*f,0,Math.PI*2);pctx.stroke();}
  pctx.setLineDash([2,3]);pctx.beginPath();pctx.moveTo(11,c);pctx.lineTo(size-11,c);pctx.moveTo(c,11);pctx.lineTo(c,size-11);pctx.stroke();pctx.setLineDash([]);
  pctx.font='8px "Courier New",monospace';pctx.fillStyle='#697756';pctx.textAlign='center';pctx.fillText('OUT',c,12);pctx.fillText('IN',c,size-6);pctx.textAlign='left';pctx.fillText('−',4,c-6);pctx.textAlign='right';pctx.fillText('+',size-5,c-6);
  const x=c+tangential/padScale*range,y=c-radial/padScale*range;
  pctx.beginPath();pctx.moveTo(c,c);pctx.lineTo(x,y);pctx.strokeStyle='#25311c';pctx.lineWidth=2;pctx.stroke();
  pctx.fillStyle='#25311c';pctx.beginPath();pctx.arc(c,c,2.5,0,Math.PI*2);pctx.fill();
  pctx.beginPath();pctx.arc(x,y,6,0,Math.PI*2);pctx.fillStyle='#26311e';pctx.fill();pctx.beginPath();pctx.arc(x,y,2,0,Math.PI*2);pctx.fillStyle='#e9ff6b';pctx.fill();
  if(Math.hypot(tangential,radial)<.1){pctx.textAlign='center';pctx.fillStyle='#7b8968';pctx.font='8px "Courier New",monospace';pctx.fillText('DRAG A PUSH',c,size-22);}
}
function resize() {
  const r=$('orbit-field').getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  currentSize={w:r.width,h:r.height};orbitCanvas.width=Math.round(r.width*dpr);orbitCanvas.height=Math.round(r.height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);needsDraw=true;drawPad();
}
function showDialog(title, html, tag='LAST LIGHT / FIELD NOTES') {
  $('dialog-title').textContent=title;$('dialog-content').innerHTML=html;$('dialog-tag').textContent=tag;$('info-dialog').showModal();setPlaying(false);
}

// Interaction: every edit replaces the same single-impulse plan, with no hidden state.
document.querySelectorAll('[data-case]').forEach(b=>b.addEventListener('click',()=>{loadCase(+b.dataset.case);notify(`${cases[+b.dataset.case].name} received. The burn is waiting at apogee.`);}));
$('burn-time').addEventListener('input',e=>{burnTime=+e.target.value;edited();});
$('at-apo').addEventListener('click',()=>{burnTime=timeToApoapsis(initial);edited();notify('Burn placed at apogee: the slowest point, where raising perigee is efficient.');});
for(const id of ['tangential','radial']){
  $(id).addEventListener('input',e=>{
    if(e.target.value===''||!Number.isFinite(e.target.valueAsNumber))return;
    const v=e.target.valueAsNumber;
    if(Math.abs(v)>1500){$('burn-error').textContent='Keep each impulse component between −1,500 and +1,500 m/s.';return;}
    if(id==='tangential')tangential=v;else radial=v;edited();
  });
  $(id).addEventListener('change',()=>updatePlanUI());
}
$('target').addEventListener('change',e=>{const v=e.target.valueAsNumber;if(!Number.isFinite(v)||v<121||v>5000){notify('Use a recovery line between 121 and 5,000 km.');e.target.value=target;return;}target=v;edited();});
$('zero').addEventListener('click',()=>{tangential=0;radial=0;edited();});
$('assist').addEventListener('click',()=>{
  if(elements(initial).perigee>=target-1e-6){tangential=0;radial=0;elapsed=0;edited();notify('The incoming orbit already clears your recovery line. The cheapest repair is no burn.');return;}
  const at=timeToApoapsis(initial);
  if(at>=plan.window){notify('Apogee lies beyond the air line. Choose a burn before entry.');return;}
  try{const solution=repairAt(propagate(initial,at),target);if(Math.max(Math.abs(solution.tangential),Math.abs(solution.radial))>1500)throw new Error('This repair needs more than the 1,500 m/s component limit. Lower the target.');burnTime=at;tangential=solution.tangential;radial=solution.radial;elapsed=0;edited();notify('Repair set at apogee. A tangential push lifts the opposite side of the orbit.');}catch(err){notify(err.message);}
});
$('reset').addEventListener('click',()=>{tangential=0;radial=0;burnTime=timeToApoapsis(initial);elapsed=0;zoom=1;edited();notify('Impulse cleared. Incoming orbit kept.');});
$('apply-orbit').addEventListener('click',()=>{
  const p=+$('custom-perigee').value,a=+$('custom-apogee').value,n=+$('custom-anomaly').value;
  try{
    if([$('custom-perigee'),$('custom-apogee'),$('custom-anomaly')].some(x=>x.value==='')||![p,a,n].every(Number.isFinite)||p<0||p>20000||a<120||a>20000||n<0||n>359)throw new Error('Use perigee 0–20,000 km, apogee 120–20,000 km, and anomaly 0–359°.');
    const s=fromApsides(p,a,n);if(elements(s).r<=EARTH+AIR)throw new Error('The starting point is already in the air. Change anomaly or raise the orbit.');
    initial=s;selectedCase=-1;tangential=0;radial=0;elapsed=0;zoom=1;burnTime=Math.min(timeToApoapsis(s),(timeToEntry(s)??elements(s).period)*.9);setPlaying(false);
    document.querySelectorAll('[data-case]').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed',false);});
    $('case-title').innerHTML='<span>Your</span><span>problem.</span>';$('case-brief').textContent='A custom incoming orbit. Same gravity. A new second chance.';$('map-title').textContent='CUSTOM / 00';$('orbit-error').textContent='';updateDossier();recalculate(true);notify('Custom orbit loaded. All altitudes are measured from Earth’s surface.');
  }catch(err){$('orbit-error').textContent=err.message;}
});
let draggingPad=false,dragPadScale=300;
function padPointer(e){const r=pad.getBoundingClientRect(),c=r.width/2,range=c-23;const tx=(e.clientX-r.left-c)/range*dragPadScale,ry=-(e.clientY-r.top-c)/range*dragPadScale;tangential=Math.round(Math.max(-1500,Math.min(1500,tx)));radial=Math.round(Math.max(-1500,Math.min(1500,ry)));edited();}
pad.addEventListener('pointerdown',e=>{draggingPad=true;dragPadScale=padScale;pad.setPointerCapture(e.pointerId);padPointer(e);});
pad.addEventListener('pointermove',e=>{if(draggingPad)padPointer(e);});
pad.addEventListener('pointerup',()=>{draggingPad=false;});pad.addEventListener('pointercancel',()=>{draggingPad=false;});
orbitCanvas.addEventListener('click',e=>{const r=orbitCanvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let best=null,distance=35;for(const s of baseSamples){const p=project(s.r),d=Math.hypot(p.x-x,p.y-y);if(d<distance){best=s;distance=d;}}if(best){burnTime=Math.min(best.t,plan.window-.1);edited();}else notify('Choose a point on the dotted incoming orbit, or use the moment slider.');});
$('zoom-in').addEventListener('click',()=>{zoom=Math.min(3,zoom*1.2);needsDraw=true;});$('zoom-out').addEventListener('click',()=>{zoom=Math.max(.5,zoom/1.2);needsDraw=true;});$('fit').addEventListener('click',()=>{zoom=1;needsDraw=true;});
$('play').addEventListener('click',()=>{if(elapsed>=plan.duration-.01)elapsed=0;setPlaying(!running);needsDraw=true;});
$('rewind').addEventListener('click',()=>{elapsed=0;setPlaying(false);updateTelemetry();needsDraw=true;});
$('scrub').addEventListener('input',e=>{elapsed=+e.target.value;setPlaying(false);updateTelemetry();needsDraw=true;});$('speed').addEventListener('change',e=>{speed=+e.target.value;});
$('guide').addEventListener('click',()=>showDialog('Give an orbit a future.',`<p>You run a one-burn salvage desk. The spacecraft is on its way to a low perigee, the lowest point of its orbit. Your job is to change that ending.</p><ol><li><strong>Choose the moment.</strong> Move the moment slider, or click the dotted incoming orbit. Apogee, the highest point, is a good place to raise the opposite end.</li><li><strong>Shape the impulse.</strong> Drag the vector pad. Right adds tangential velocity; up pushes away from Earth. Or enter exact components in m/s. The yellow orbit is recalculated immediately.</li><li><strong>Run the alternate ending.</strong> Press play or scrub the replay. A safe repair has a perigee at or above the recovery line and remains bound to Earth.</li></ol><h3>NEED A STARTING POINT?</h3><p>“Find a minimum-cost repair” moves the burn to apogee and computes a tangent impulse that raises perigee to your recovery line. It is the lowest-Δv single-impulse repair for these incoming, below-target orbits when apogee is reachable before air entry. Try moving that burn earlier and watch what changes.</p><h3>READING THE TABLE</h3><p>The dotted gray arc is the no-burn future; yellow is the new path. The square marks the burn, the white dart is the spacecraft, and the coral cross marks unmodified atmospheric entry. The dim green ring is your recovery altitude. The replay’s AIR marker always means the <strong>original</strong> entry time.</p><p>Edits pause playback. Nothing is committed permanently. Switch spacecraft or reset the impulse to start again.</p>`));
$('model').addEventListener('click',()=>showDialog('Kepler, not magic.',`<h3>WHAT IS ACTUALLY COMPUTED</h3><p>A point spacecraft follows Newtonian two-body motion around a spherical, nonrotating Earth. Position and velocity are propagated analytically with universal variables and a safeguarded Kepler solver. Both elliptical and open trajectories are supported.</p><div class="equation">r̈ = −μ r / |r|³<br>μ = ${MU} km³/s²<br>Earth radius = ${EARTH} km<br>Δv = tangent × Δvₜ + radial × Δvᵣ</div><p>The burn is an instantaneous velocity change. “Tangential” is perpendicular to the radius in the current orbital direction, not necessarily aligned with velocity. Positive radial points away from Earth. Perigee and apogee come from post-burn energy and angular momentum; Δv cost is the Euclidean length of the impulse.</p><h3>THE AIR LINE IS A STOP SIGN</h3><p>At the first inbound crossing of ${AIR} km altitude, the replay ends. This is a deliberately conservative operational boundary. <strong>No atmospheric drag, heating, breakup, or landing is simulated.</strong> A trajectory below that boundary is not a calculated reentry outcome.</p><h3>WHAT THIS DESK LEAVES OUT</h3><p>No oblateness (J₂), atmosphere, other bodies, solar pressure, propulsion duration, fuel mass, mass loss, pointing constraints, or 3D inclination changes. The recovery line is a chosen geometric criterion, not a real mission safety guarantee. Even an orbit above 120 km can decay rapidly in the real atmosphere.</p><p>Earth and the orbits are drawn to one physical scale. The spacecraft, vector arrow, labels, and markers are magnified. The view is centered on Earth; the grid has no geographic meaning.</p><h3>NUMERICAL & REPLAY LIMITS</h3><p>One ideal impulse with each component limited to ±1,500 m/s. Custom incoming ellipses accept 0–20,000 km apsides and must start above the air line. Replay continues to atmospheric entry, one post-burn orbit (capped at 8 hours), or 2 hours after an escaping burn. Numerical two-body conservation does not imply real-flight accuracy.</p>`,'LAST LIGHT / MODEL CARD'));
$('record').addEventListener('click',()=>{
  const el=elements(initial),c=selectedCase>=0?cases[selectedCase].name:'CUSTOM / 00';
  const sheet=`LAST LIGHT / FLIGHT SHEET\nSPACECRAFT: ${c}\n\nInitial position [km]: ${initial.r.map(n=>n.toFixed(6)).join(', ')}\nInitial velocity [km/s]: ${initial.v.map(n=>n.toFixed(9)).join(', ')}\nInitial apsides [km altitude]: ${el.perigee.toFixed(3)} / ${el.apogee.toFixed(3)}\n\nBurn time [s]: ${burnTime.toFixed(6)}\nTangential Δv [m/s]: ${tangential.toFixed(6)}\nRadial Δv [m/s]: ${radial.toFixed(6)}\nTotal Δv [m/s]: ${plan.cost.toFixed(6)}\nRecovery line [km altitude]: ${target}\n\nPost-burn perigee [km altitude]: ${plan.orbit.perigee.toFixed(6)}\nPost-burn apogee [km altitude]: ${Number.isFinite(plan.orbit.apogee)?plan.orbit.apogee.toFixed(6):'unbound'}\nEccentricity: ${plan.orbit.e.toFixed(9)}\nOutcome: ${plan.outcome}\n\nModel: planar two-body Earth; μ = ${MU} km³/s²; R = ${EARTH} km; instantaneous impulse; replay stops at 120 km. No drag or fuel model.`;
  showDialog('The repair, on paper.',`<p>Select this flight sheet to copy your setup and computed result.</p><div id="flight-recipe" class="recipe"></div>`,'LAST LIGHT / REPAIR RECORD');$('flight-recipe').textContent=sheet;
});
$('close-dialog').addEventListener('click',()=>$('info-dialog').close());$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON','TEXTAREA'].includes(document.activeElement?.tagName)&&!$('info-dialog').open){e.preventDefault();$('play').click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
if(!ctx||!pctx){$('orbit-field').innerHTML='<p style="padding:30px">Canvas graphics are unavailable in this browser. The numeric planner and flight sheet still work.</p>';}
loadCase(0);
const observer=new ResizeObserver(resize);observer.observe($('orbit-field'));observer.observe(pad);resize();
function frame(now){
  if(running&&plan){if(lastFrame){elapsed=Math.min(plan.duration,elapsed+Math.min((now-lastFrame)/1000,.12)*speed);if(elapsed>=plan.duration)setPlaying(false);}lastFrame=now;updateTelemetry();needsDraw=true;}
  if(needsDraw){drawOrbit();needsDraw=false;}requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
