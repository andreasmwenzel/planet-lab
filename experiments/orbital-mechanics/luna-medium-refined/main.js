import { AU, DAY, MU_SUN, orbitalPeriod, stateAtTime } from './physics.js';

const $ = (id) => document.getElementById(id);
const aInput = $('a'), eInput = $('e'), svg = $('plot');
let a = Number(aInput.value) * AU, e = Number(eInput.value), t = 0, running = true, previous = performance.now();
const cx = 380, cy = 246, extent = 5.1;

function fmt(value, digits = 2) { return Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function update() {
  const period = orbitalPeriod(a), state = stateAtTime({ a, e, t });
  const ra = a / AU, rp = ra * (1 - e), apo = ra * (1 + e);
  // Consistent AU-based plotting that contains every point even at maximum eccentricity.
  const scale = Math.min(330 / (apo + rp), 320 / (2 * a / AU));
  const sx = a / AU * scale, sy = sx * Math.sqrt(1 - e * e), focusX = cx + e * sx;
  const orbit = $('orbit'); orbit.setAttribute('cx', focusX); orbit.setAttribute('cy', cy); orbit.setAttribute('rx', sx); orbit.setAttribute('ry', sy);
  $('major').setAttribute('x1', focusX - sx); $('major').setAttribute('x2', focusX + sx); $('major').setAttribute('y1', cy); $('major').setAttribute('y2', cy);
  $('sun').setAttribute('cx', cx); $('sun').setAttribute('cy', cy);
  const x = cx + state.x / AU * scale, y = cy - state.y / AU * scale;
  $('planet').setAttribute('cx', x); $('planet').setAttribute('cy', y);
  $('radius').setAttribute('x1', cx); $('radius').setAttribute('y1', cy); $('radius').setAttribute('x2', x); $('radius').setAttribute('y2', y);
  $('sunlabel').setAttribute('x', cx - 18); $('sunlabel').setAttribute('y', cy + 26); $('planetlabel').setAttribute('x', x + 11); $('planetlabel').setAttribute('y', y - 10);
  $('scaleText').textContent = `${fmt(80 / scale, 2)} AU`;
  $('aVal').textContent = `${fmt(ra, 2)} AU`; $('eVal').textContent = fmt(e, 3);
  $('distance').textContent = fmt(state.r / AU, 3); $('speed').textContent = fmt(state.speed / 1000, 2);
  $('period').textContent = fmt(period / DAY, 1); $('elapsed').textContent = fmt((((t / DAY) % (period / DAY)) + period / DAY) % (period / DAY), 1);
  const radialMotion = state.x * state.vx + state.y * state.vy;
  $('phaseLabel').textContent = Math.abs(radialMotion) < 1e-8 ? (state.x < 0 ? 'PERIHELION PASSAGE' : 'APHELION PASSAGE') : radialMotion < 0 ? 'INBOUND · CLOSING ON PERIHELION' : 'OUTBOUND · CLIMBING FROM PERIHELION';
}
aInput.addEventListener('input', () => { a = Number(aInput.value) * AU; t = 0; update(); });
eInput.addEventListener('input', () => { e = Number(eInput.value); t = 0; update(); });
$('play').addEventListener('click', () => { running = !running; $('play').textContent = running ? 'Ⅱ  PAUSE' : '▶  PLAY'; previous = performance.now(); });
$('reset').addEventListener('click', () => { aInput.value = '1'; eInput.value = '0.25'; a = AU; e = .25; t = 0; running = true; $('play').textContent = 'Ⅱ  PAUSE'; update(); });
function tick(now) { const dt = Math.min((now - previous) / 1000, .1); previous = now; if (running) t += dt * DAY; update(); requestAnimationFrame(tick); }
update(); requestAnimationFrame(tick);
