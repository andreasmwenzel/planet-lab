import './style.css';
import { MU, EARTH_RADIUS, MIN_ALTITUDE, MAX_ALTITUDE, TAU, planTransfer, transferState, missionState, diagnostics, missionDuration } from './physics.mjs';

const $ = id => document.getElementById(id);
const canvas = $('orbit-canvas');
const ctx = canvas.getContext('2d');
if (!ctx) $('canvas-fallback').hidden = false;
const presets = { raise: [400, 2000], geo: [400, 35786], return: [2000, 400] };
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const signed = (n, places = 3) => `${Math.abs(n) < .5 * 10 ** -places ? '' : n < 0 ? '−' : '+'}${Math.abs(n).toFixed(places)}`;
let plan = planTransfer(400, 2000);
let circularize = true, time = 0, playing = false, showVelocity = false;
let duration = missionDuration(plan, circularize);
let width = 0, height = 0, dpr = 1, zoom = 1, pan = { x: 0, y: 0 };
let needsDraw = true, previousFrame = null, lastReadout = -Infinity;
let drag = null;
let highlightedPreset = 'raise';

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds + 1e-7));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function durationLabel(seconds) {
  const rounded = Math.round(seconds);
  if (rounded >= 3600) return `${Math.floor(rounded / 3600)}h ${Math.floor(rounded % 3600 / 60)}m`;
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}
function altitudeToSlider(value) { return Math.log(value / MIN_ALTITUDE) / Math.log(MAX_ALTITUDE / MIN_ALTITUDE) * 1000; }
function sliderToAltitude(value) { return Math.round(MIN_ALTITUDE * (MAX_ALTITUDE / MIN_ALTITUDE) ** (value / 1000)); }
function setPlaying(value) {
  playing = value;
  $('play-text').textContent = playing ? 'Pause' : time >= duration ? 'Replay' : time > 0 ? 'Continue' : 'Rehearse';
  $('play-symbol').textContent = playing ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-label', playing ? 'Pause mission' : time >= duration ? 'Replay mission' : 'Play mission');
  previousFrame = null;
}
function fitView() { zoom = 1; pan = { x: 0, y: 0 }; needsDraw = true; }
function showError(message) {
  $('input-error').textContent = message;
  $('input-error').hidden = !message;
  $('play').disabled = Boolean(message);
  if (message) setPlaying(false);
}
function syncFields() {
  $('departure').value = plan.departureAltitude;
  $('arrival').value = plan.arrivalAltitude;
  for (const id of ['departure', 'arrival']) $(id).setAttribute('aria-invalid', 'false');
  showError('');
}
function applyPlan(departure, arrival, sync = true) {
  plan = planTransfer(departure, arrival);
  time = 0;
  setPlaying(false);
  duration = missionDuration(plan, circularize);
  if (sync) syncFields();
  fitView();
  renderPlan();
  renderTelemetry();
}
function renderPlan() {
  ['departure', 'arrival'].forEach(id => {
    const value = altitudeToSlider(plan[`${id}Altitude`]);
    $(`${id}-range`).value = value;
    $(`${id}-range`).style.setProperty('--progress', `${value / 10}%`);
    $(`${id}-range`).setAttribute('aria-valuetext', `${format.format(plan[`${id}Altitude`])} kilometers above Earth`);
  });
  document.querySelectorAll('.preset').forEach(button => {
    const active = button.dataset.preset === highlightedPreset;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const cost = Math.abs(plan.dv1) + (circularize ? Math.abs(plan.dv2) : 0);
  $('total-dv').textContent = cost.toFixed(3);
  $('transfer-time').textContent = durationLabel(plan.transferTime);
  $('eccentricity').textContent = plan.e.toFixed(3);
  $('cost-description').textContent = circularize ? 'Two instantaneous, tangential burns' : 'Departure burn only · arrival burn skipped';
  $('low-orbit-note').hidden = Math.min(plan.departureAltitude, plan.arrivalAltitude) >= 300;
  $('burn-one-dv').textContent = signed(plan.dv1);
  $('burn-two-dv').textContent = circularize ? signed(plan.dv2) : '0.000';
  const equal = Math.abs(plan.r2 - plan.r1) < 1e-7;
  $('burn-one-action').textContent = equal ? 'No change required' : plan.outward ? 'Accelerate into transfer' : 'Brake into transfer';
  $('burn-two-action').textContent = circularize ? equal ? 'Already on the same orbit' : 'Circularize the orbit' : 'Remain on the ellipse';
  $('burn-one-direction').textContent = equal ? 'COAST' : plan.outward ? 'PROGRADE' : 'RETROGRADE';
  $('burn-two-direction').textContent = circularize ? equal ? 'COAST' : plan.outward ? 'PROGRADE' : 'RETROGRADE' : 'SKIPPED';
  $('burn-one-speeds').textContent = `${plan.v1.toFixed(3)} → ${plan.vt1.toFixed(3)} km/s`;
  $('burn-two-speeds').textContent = circularize ? `${plan.vt2.toFixed(3)} → ${plan.v2.toFixed(3)} km/s` : `${plan.vt2.toFixed(3)} km/s at arrival`;
  $('burn-two').classList.toggle('skipped', !circularize);
  $('arrival-jump-label').textContent = circularize ? 'Arrival burn' : 'Arrival · no burn';
  $('end-label').textContent = circularize ? 'In orbit' : 'Return';
  const arrivalPercent = plan.transferTime / duration * 100;
  $('arrival-tick').style.left = `${arrivalPercent}%`;
  document.querySelector('.timeline-labels').style.setProperty('--arrival', `${arrivalPercent}%`);
  // Labels are deliberately distributed on short layouts; the precise burn tick remains on the track.
  $('jump-arrival').style.left = `${Math.max(35, Math.min(72, arrivalPercent))}%`;
  $('insight').textContent = equal
    ? 'Both altitudes are equal. No velocity change is needed; the spacecraft simply coasts on the same circular orbit.'
    : !circularize
      ? 'One burn changes an orbit, but does not hold the new altitude. Without circularization, the spacecraft returns to its departure point.'
      : plan.outward
        ? 'To go higher, accelerate twice. You slow down while climbing, so another prograde burn is needed to stay in the higher orbit.'
        : 'To go lower, brake twice. You gain speed while falling inward, then brake again to stay in the lower circular orbit.';
  needsDraw = true;
}
function renderTelemetry() {
  const state = missionState(plan, time, circularize);
  const data = diagnostics(state);
  $('live-altitude').textContent = format.format(data.altitude);
  $('live-speed').textContent = data.speed.toFixed(3);
  $('live-radial').textContent = signed(data.radialSpeed, 2);
  $('elapsed').textContent = clock(time);
  $('timeline').value = time / duration * 10000;
  $('timeline').setAttribute('aria-valuetext', `${clock(time)} elapsed; altitude ${format.format(data.altitude)} kilometers; speed ${data.speed.toFixed(3)} kilometers per second`);
  $('timeline-coast').style.width = `${time / duration * 100}%`;
  const atDeparture = time < Math.max(1, plan.transferTime * .002);
  const atArrival = Math.abs(time - plan.transferTime) < Math.max(1, plan.transferTime * .002);
  let stage;
  if (Math.abs(plan.r2 - plan.r1) < 1e-7) stage = 'Same orbit · no burns required';
  else if (atDeparture) stage = `Departure · burn 1 applied`;
  else if (atArrival) stage = circularize ? 'Arrival · burn 2 applied' : 'Arrival point · burn skipped';
  else if (time >= plan.transferTime && circularize) stage = 'Circular orbit established';
  else if (time >= duration) stage = 'Back at departure · still on ellipse';
  else if (time > plan.transferTime) stage = 'Free coast · returning to departure';
  else stage = plan.outward ? 'Coasting outward to apoapsis' : 'Coasting inward to periapsis';
  $('stage-label').textContent = stage;
  $('burn-one').classList.toggle('current', atDeparture);
  $('burn-two').classList.toggle('current', atArrival);
  needsDraw = true;
}
function seek(value) {
  setPlaying(false);
  time = Math.max(0, Math.min(duration, value));
  setPlaying(false);
  renderTelemetry();
}

$('play').addEventListener('click', () => {
  if (!playing && time >= duration) time = 0;
  setPlaying(!playing);
  renderTelemetry();
});
$('rewind').addEventListener('click', () => seek(0));
$('timeline').addEventListener('input', event => seek(Number(event.target.value) / 10000 * duration));
$('jump-departure').addEventListener('click', () => seek(0));
$('jump-arrival').addEventListener('click', () => seek(plan.transferTime));
$('rate').addEventListener('change', () => { previousFrame = null; });
$('reset').addEventListener('click', () => {
  circularize = true;
  $('circularize').checked = true;
  highlightedPreset = 'raise';
  $('rate').value = 'auto';
  showVelocity = false;
  $('vectors').setAttribute('aria-pressed', 'false');
  applyPlan(...presets.raise);
});
$('home-link').addEventListener('click', event => { event.preventDefault(); $('departure').focus(); });
$('swap').addEventListener('click', () => { highlightedPreset = ''; applyPlan(plan.arrivalAltitude, plan.departureAltitude); });
document.querySelectorAll('.preset').forEach(button => button.addEventListener('click', () => {
  highlightedPreset = button.dataset.preset;
  applyPlan(...presets[highlightedPreset]);
}));
for (const id of ['departure', 'arrival']) {
  $(id).addEventListener('input', () => {
    const departure = $('departure').valueAsNumber, arrival = $('arrival').valueAsNumber;
    let valid = true;
    for (const name of ['departure', 'arrival']) {
      const v = $(name).valueAsNumber;
      const okay = Number.isFinite(v) && v >= MIN_ALTITUDE && v <= MAX_ALTITUDE;
      $(name).setAttribute('aria-invalid', String(!okay));
      valid &&= okay;
    }
    if (!valid) return showError('Use an altitude from 160 to 50,000 km. The last valid plan stays in view.');
    showError('');
    highlightedPreset = '';
    applyPlan(departure, arrival, false);
  });
  $(`${id}-range`).addEventListener('input', event => {
    const value = sliderToAltitude(Number(event.target.value));
    highlightedPreset = '';
    applyPlan(id === 'departure' ? value : plan.departureAltitude, id === 'arrival' ? value : plan.arrivalAltitude);
  });
}
$('circularize').addEventListener('change', event => {
  circularize = event.target.checked;
  setPlaying(false);
  duration = missionDuration(plan, circularize);
  time = Math.min(time, duration);
  setPlaying(false);
  renderPlan();
  renderTelemetry();
});
$('vectors').addEventListener('click', () => {
  showVelocity = !showVelocity;
  $('vectors').setAttribute('aria-pressed', String(showVelocity));
  needsDraw = true;
});
$('fit').addEventListener('click', fitView);
$('zoom-in').addEventListener('click', () => { zoom = Math.min(6, zoom * 1.25); needsDraw = true; });
$('zoom-out').addEventListener('click', () => { zoom = Math.max(.4, zoom / 1.25); needsDraw = true; });

function view() {
  const usableRadius = Math.max(55, Math.min((width - 105) / 2, (height - 176) / 2));
  const scale = usableRadius / Math.max(plan.r1, plan.r2) * zoom;
  return { scale, cx: width / 2 + pan.x, cy: (height + 18) / 2 + pan.y };
}
function screen(point, v = view()) { return { x: v.cx + point.x * v.scale, y: v.cy - point.y * v.scale }; }
function resize() {
  const rect = canvas.getBoundingClientRect();
  width = rect.width; height = rect.height; dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  needsDraw = true;
}
if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe($('scene'));
else window.addEventListener('resize', resize);

function circle(radius, style, dashed, v) {
  ctx.beginPath(); ctx.arc(v.cx, v.cy, radius * v.scale, 0, TAU);
  ctx.strokeStyle = style; ctx.lineWidth = 1; ctx.setLineDash(dashed ? [4, 6] : []); ctx.stroke(); ctx.setLineDash([]);
}
function pathStates(start, end, samples, style, lineWidth, v, dashed = false) {
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const p = screen(transferState(plan, start + (end - start) * i / samples), v);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = style; ctx.lineWidth = lineWidth; ctx.setLineDash(dashed ? [4, 6] : []); ctx.stroke(); ctx.setLineDash([]);
}
function pill(text, x, y, color, align = 'left') {
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
  const textWidth = ctx.measureText(text).width;
  const left = Math.max(13, Math.min(width - textWidth - 27, align === 'right' ? x - textWidth - 14 : x));
  ctx.fillStyle = '#122b35eb'; ctx.fillRect(left, y - 10, textWidth + 14, 20);
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, left + 7, y + 3);
}
function drawEarth(v) {
  const r = EARTH_RADIUS * v.scale;
  // All geometry, including Earth, uses the same physical scale.
  ctx.save();
  ctx.beginPath(); ctx.arc(v.cx, v.cy, r, 0, TAU); ctx.clip();
  const fill = ctx.createRadialGradient(v.cx - r * .6, v.cy - r * .4, 0, v.cx, v.cy, r * 1.2);
  fill.addColorStop(0, '#45616b'); fill.addColorStop(.6, '#284852'); fill.addColorStop(1, '#193641');
  ctx.fillStyle = fill; ctx.fillRect(v.cx - r, v.cy - r, 2 * r, 2 * r);
  ctx.strokeStyle = '#88a2a019'; ctx.lineWidth = .7;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath(); ctx.ellipse(v.cx, v.cy + k * r * .30, r * Math.sqrt(1 - (k * .3) ** 2), r * .12, -.13, 0, TAU); ctx.stroke();
  }
  for (const ratio of [.3, .68]) { ctx.beginPath(); ctx.ellipse(v.cx, v.cy, r * ratio, r, -.13, 0, TAU); ctx.stroke(); }
  // Abstract land forms, intentionally a diagram rather than a geographic map.
  const patches = [
    [[-.77,-.45],[-.56,-.66],[-.26,-.65],[-.18,-.4],[-.36,-.19],[-.23,.01],[-.34,.11],[-.54,-.16],[-.68,-.18]],
    [[-.31,.15],[-.06,.18],[.02,.4],[-.12,.67],[-.22,.82],[-.32,.55],[-.4,.26]],
    [[.05,-.46],[.28,-.64],[.72,-.48],[.83,-.2],[.61,-.1],[.43,-.19],[.28,.02],[.1,-.03]],
    [[.14,.06],[.46,.08],[.43,.35],[.24,.57],[.08,.28]],
    [[.58,.43],[.82,.39],[.91,.61],[.66,.66]]
  ];
  ctx.fillStyle = '#83988729';
  for (const patch of patches) { ctx.beginPath(); patch.forEach(([x,y],i) => i ? ctx.lineTo(v.cx+x*r,v.cy+y*r) : ctx.moveTo(v.cx+x*r,v.cy+y*r)); ctx.closePath(); ctx.fill(); }
  const shade = ctx.createLinearGradient(v.cx - r, v.cy, v.cx + r, v.cy + r * .3);
  shade.addColorStop(0, '#122b3200'); shade.addColorStop(.45, '#102c3500'); shade.addColorStop(1, '#061c2abe');
  ctx.fillStyle = shade; ctx.fillRect(v.cx - r, v.cy - r, 2*r, 2*r);
  ctx.restore();
  ctx.beginPath(); ctx.arc(v.cx,v.cy,r,0,TAU); ctx.lineWidth=1; ctx.strokeStyle='#718e953a'; ctx.stroke();
  ctx.beginPath(); ctx.arc(v.cx,v.cy,r+.8,Math.PI*.83,Math.PI*1.83); ctx.strokeStyle='#b1c2b840'; ctx.lineWidth=1; ctx.stroke();
  if (r > 39 && zoom < 2) { ctx.fillStyle='#d1dcd08c'; ctx.font='8px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign='center'; ctx.fillText('E A R T H',v.cx,v.cy+2); }
}
function draw() {
  if (!ctx || width <= 0 || height <= 0) return;
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,width,height);
  const v = view();
  // A fixed, restrained coordinate grid helps preserve scale while panning.
  const grid = 54;
  ctx.fillStyle='#9ab7bc16';
  const offsetX = ((v.cx % grid)+grid)%grid, offsetY = ((v.cy % grid)+grid)%grid;
  for (let x=offsetX; x<width; x+=grid) for(let y=offsetY; y<height; y+=grid) ctx.fillRect(x,y,1,1);
  ctx.strokeStyle='#81a4ad10';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,v.cy);ctx.lineTo(width,v.cy);ctx.moveTo(v.cx,0);ctx.lineTo(v.cx,height);ctx.stroke();
  // Ghost of the complete transfer clarifies why an insertion burn is necessary.
  pathStates(plan.transferTime,2*plan.transferTime,160,circularize?'#b8936930':'#d0a16c70',1,v,true);
  circle(plan.r1, '#89a7ae60', false, v);
  circle(plan.r2, '#8bd4c57e', true, v);
  pathStates(0,plan.transferTime,180,'#e6ad75ba',1.4,v);
  drawEarth(v);
  if (time > 0) {
    if (time <= plan.transferTime || !circularize) {
      pathStates(Math.max(0,time-plan.transferTime*.14),Math.min(time,2*plan.transferTime),40,'#f6c590',2.2,v);
    } else {
      const angle = Math.PI + (time-plan.transferTime)*TAU/plan.arrivalPeriod;
      ctx.beginPath();ctx.arc(v.cx,v.cy,plan.r2*v.scale,-angle,-angle+Math.min(.24,angle-Math.PI));ctx.strokeStyle='#b4ead8';ctx.lineWidth=2.2;ctx.stroke();
    }
  }
  const p1=screen({x:plan.r1,y:0},v), p2=screen({x:-plan.r2,y:0},v);
  const drawNode = (p,color,number) => {
    ctx.fillStyle='#142e37';ctx.beginPath();ctx.arc(p.x,p.y,7,0,TAU);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();
    ctx.font='8px ui-sans-serif, system-ui, sans-serif';ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(number,p.x,p.y+2.8);
  };
  drawNode(p1,'#eab381','1');drawNode(p2,circularize?'#a2dbc9':'#b89a73','2');
  if (zoom < 2.4) {
    ctx.strokeStyle='#688b915a';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(p1.x,p1.y-9);ctx.lineTo(p1.x+13,p1.y-24);ctx.lineTo(p1.x+29,p1.y-24);ctx.stroke();
    pill(`${format.format(plan.departureAltitude)} km`,p1.x+24,p1.y-24,'#b0bdbb');
    ctx.beginPath();ctx.moveTo(p2.x,p2.y+9);ctx.lineTo(p2.x-13,p2.y+26);ctx.lineTo(p2.x-25,p2.y+26);ctx.stroke();
    pill(`${format.format(plan.arrivalAltitude)} km`,p2.x-22,p2.y+26,'#a1c5bb','right');
  }
  const state=missionState(plan,time,circularize), craft=screen(state,v);
  const heading=Math.atan2(-state.vy,state.vx);
  if (showVelocity) {
    const speed=Math.hypot(state.vx,state.vy), length=32+speed*5;
    const ex=craft.x+Math.cos(heading)*length, ey=craft.y+Math.sin(heading)*length;
    ctx.strokeStyle='#b7d6cbba';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(craft.x,craft.y);ctx.lineTo(ex,ey);ctx.moveTo(ex-Math.cos(heading-.5)*7,ey-Math.sin(heading-.5)*7);ctx.lineTo(ex,ey);ctx.lineTo(ex-Math.cos(heading+.5)*7,ey-Math.sin(heading+.5)*7);ctx.stroke();
    pill('v',ex+3,ey-4,'#abcbbb');
  }
  ctx.save();ctx.translate(craft.x,craft.y);ctx.rotate(heading);
  ctx.shadowColor='#e9e8be66';ctx.shadowBlur=13;ctx.fillStyle='#fff4d8';ctx.strokeStyle='#17323e';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-4.5);ctx.lineTo(-2,0);ctx.lineTo(-5,4.5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  // A true-distance scale bar, choosing a readable power-of-ten multiple.
  const raw=60/v.scale, magnitude=10**Math.floor(Math.log10(raw));
  const units=raw/magnitude, nice=(units>=5?5:units>=2?2:1)*magnitude, length=nice*v.scale;
  const bx=width-26-length, by=height-31;
  ctx.strokeStyle='#6f90965f';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(bx,by-3);ctx.lineTo(bx,by);ctx.lineTo(bx+length,by);ctx.lineTo(bx+length,by-3);ctx.stroke();
  $('scale-note').textContent=`${format.format(nice)} km · true scale`;
  needsDraw=false;
}

canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0) return;
  const rect=canvas.getBoundingClientRect();
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false,localX:event.clientX-rect.left,localY:event.clientY-rect.top};
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!drag||drag.id!==event.pointerId) return;
  if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>4) drag.moved=true;
  if(drag.moved){pan.x+=event.clientX-drag.x;pan.y+=event.clientY-drag.y;needsDraw=true;canvas.classList.add('dragging');}
  drag.x=event.clientX;drag.y=event.clientY;
});
function stopDrag(event,cancelled=false){
  if(!drag||drag.id!==event.pointerId)return;
  if(!drag.moved&&!cancelled){
    const v=view();let nearest=Infinity,bestTime=0;
    const end=circularize?plan.transferTime:duration;
    for(let i=0;i<=600;i++){
      const t=end*i/600,p=screen(transferState(plan,t),v),d=Math.hypot(p.x-drag.localX,p.y-drag.localY);
      if(d<nearest){nearest=d;bestTime=t;}
    }
    if(nearest<19)seek(bestTime);
  }
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  drag=null;canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerup',event=>stopDrag(event));
canvas.addEventListener('pointercancel',event=>stopDrag(event,true));
canvas.addEventListener('lostpointercapture',()=>{drag=null;canvas.classList.remove('dragging');});
canvas.addEventListener('wheel',event=>{
  event.preventDefault();
  const old=view(),rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
  const next=Math.max(.4,Math.min(6,zoom*Math.exp(-event.deltaY*.0014))),ratio=next/zoom;
  pan.x+=(x-old.cx)*(1-ratio);pan.y+=(y-old.cy)*(1-ratio);zoom=next;needsDraw=true;
},{passive:false});

const dialog=$('model-dialog');
function openModel(){setPlaying(false);dialog.showModal();}
$('model-open').addEventListener('click',openModel);$('why-open').addEventListener('click',openModel);
$('model-close').addEventListener('click',()=>dialog.close());$('model-done').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
document.addEventListener('keydown',event=>{
  if(dialog.open||/INPUT|SELECT|BUTTON|A|TEXTAREA/.test(event.target.tagName))return;
  if(event.code==='Space'&&!$('play').disabled){event.preventDefault();$('play').click();}
  if(event.code==='ArrowRight'){event.preventDefault();seek(time+duration*.01);}
  if(event.code==='ArrowLeft'){event.preventDefault();seek(time-duration*.01);}
});
function frame(now){
  if(playing&&previousFrame!==null){
    const dt=Math.min(.1,(now-previousFrame)/1000);
    const rate=$('rate').value==='auto'?plan.transferTime/30:Number($('rate').value);
    time=Math.min(duration,time+dt*rate);
    if(time>=duration)setPlaying(false);
    needsDraw=true;
  }
  previousFrame=now;
  if(playing&&now-lastReadout>90){renderTelemetry();lastReadout=now;}
  else if(!playing&&time>=duration&&needsDraw)renderTelemetry();
  if(needsDraw)draw();
  requestAnimationFrame(frame);
}
renderPlan();renderTelemetry();resize();requestAnimationFrame(frame);
