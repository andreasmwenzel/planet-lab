import { EARTH_MU, stateAtTime, stateAtTrueAnomaly, elementsFromState, applyBurn, orbitalPeriod } from './physics.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const startOrbit = { mu: EARTH_MU, a: 12500, e: 0.35, periapsisAngle: 0, meanAnomalyAtEpoch: Math.PI };
const targetRp = 10000;
const canvas = $('orbit');
const ctx = canvas.getContext('2d');
let burn = { radial: 0, tangential: 0.28, phase: 180 };
let showVectors = true;
const fmt = (n, d = 0) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—';
const atBurn = () => stateAtTrueAnomaly(startOrbit, burn.phase * Math.PI / 180);
function current() { const pre = atBurn(); return { pre, after: applyBurn(pre, burn.radial, burn.tangential), initial: elementsFromState(pre) }; }

function sync() {
  $('radialRead').textContent = `${burn.radial >= 0 ? '+' : ''}${burn.radial.toFixed(3)} km/s`;
  $('tangentRead').textContent = `${burn.tangential >= 0 ? '+' : ''}${burn.tangential.toFixed(3)} km/s`;
  $('phaseRead').textContent = `${Math.round(burn.phase)}°`;
  $('radial').value = burn.radial; $('tangent').value = burn.tangential; $('phase').value = burn.phase;
  const { initial, after } = current(), el = after.elements;
  $('peri').textContent = `${fmt(el.periapsis)} km`;
  $('apo').textContent = `${fmt(el.apoapsis)} km`;
  $('delta').textContent = `${(after.deltaV * 1000).toFixed(0)} m/s`;
  $('speedHere').textContent = `${fmt(Math.hypot(after.state.vx, after.state.vy), 3)} km/s`;
  $('energy').textContent = `${el.energy < 0 ? 'BOUND' : 'ESCAPE'} · ${fmt(Math.abs(el.energy), 2)} km²/s² ${el.energy < 0 ? 'orbital energy' : 'specific energy'}`;
  $('resultTag').className = el.bound && el.periapsis >= targetRp ? 'status good' : el.bound ? 'status warn' : 'status danger';
  $('resultTag').textContent = !el.bound ? 'ESCAPE TRAJECTORY' : el.periapsis >= targetRp ? 'CLEARANCE ACHIEVED' : 'STILL INSIDE DEBRIS BAND';
  $('progress').style.width = `${Math.min(100, el.periapsis / targetRp * 100)}%`;
  $('progressLabel').textContent = `${fmt(el.periapsis)} / ${fmt(targetRp)} km minimum`; 
  $('preRead').textContent = `${fmt(initial.periapsis)} km periapsis · ${fmt(initial.apoapsis)} km apoapsis`;
  $('burnLabel').textContent = `${Math.round(burn.phase)}° true anomaly · ${fmt(atBurn().r)} km radius`;
  $('period').textContent = `${fmt(orbitalPeriod(startOrbit.a) / 3600, 2)} h`;
  draw();
}
function draw() {
  const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = rect.width, H = rect.height, cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  const extent = 20500, scale = Math.min(W, H) * 0.46 / extent;
  const pt = (x,y) => [cx + x * scale, cy - y * scale];
  // subtle range rings
  ctx.strokeStyle = 'rgba(160,186,214,.12)'; ctx.lineWidth = 1;
  for (const r of [6371, 10000, 15000, 20000]) { ctx.beginPath(); ctx.arc(cx, cy, r*scale, 0, Math.PI*2); ctx.stroke(); }
  // Earth
  const re = 6371 * scale; const glow = ctx.createRadialGradient(cx,cy,re*.75,cx,cy,re*1.3);
  glow.addColorStop(0,'rgba(90,190,248,.42)'); glow.addColorStop(1,'rgba(90,190,248,0)');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx,cy,re*1.3,0,Math.PI*2); ctx.fill();
  const earth = ctx.createRadialGradient(cx-re*.3,cy-re*.35,0,cx,cy,re);
  earth.addColorStop(0,'#5c9db7'); earth.addColorStop(.55,'#245b78'); earth.addColorStop(1,'#122c46');
  ctx.fillStyle=earth; ctx.beginPath(); ctx.arc(cx,cy,re,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(167,220,202,.36)'; ctx.beginPath(); ctx.ellipse(cx-re*.2,cy-re*.2,re*.3,re*.16,-.45,0,Math.PI*2); ctx.fill();
  const { pre, after } = current();
  drawOrbit(startOrbit, '#668094', 1.7, [7,6]);
  if (after.elements.bound) {
    const postOrbit = { a: after.elements.a, e: after.elements.e, periapsisAngle: after.elements.periapsisAngle, meanAnomalyAtEpoch: 0 };
    drawOrbit(postOrbit, after.elements.periapsis >= targetRp ? '#8ce4c0' : '#f1bd72', 2.6, []);
  } else drawEscape(pre, after.state);
  // target clearance ring and labels
  ctx.strokeStyle='rgba(140,228,192,.34)'; ctx.setLineDash([3,6]); ctx.beginPath(); ctx.arc(cx,cy,targetRp*scale,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  if (showVectors) {
    const [sx,sy]=pt(pre.x,pre.y); dot(sx,sy,'#fff0ca',5);
    const [ex,ey]=pt(after.state.x,after.state.y); dot(ex,ey,'#8ce4c0',4);
    arrow(sx,sy, pre.vx, -pre.vy,'#92b8d4',Math.min(18,Math.hypot(pre.vx,pre.vy)*4));
    arrow(sx,sy, burn.radial * pre.x/Math.hypot(pre.x,pre.y) - burn.tangential*pre.y/Math.hypot(pre.x,pre.y), -(burn.radial*pre.y/Math.hypot(pre.x,pre.y)+burn.tangential*pre.x/Math.hypot(pre.x,pre.y)), '#ffc878', Math.min(26, after.deltaV*90));
  }
  function drawOrbit(o,color,width,dash) {
    ctx.strokeStyle=color; ctx.lineWidth=width; ctx.setLineDash(dash); ctx.beginPath();
    const period=orbitalPeriod(o.a);
    for(let i=0;i<=500;i++) { const s=stateAtTime(o,period*i/500), [x,y]=pt(s.x,s.y); if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  function drawEscape(origin,s) { // bounded visual ray only; dynamics remain in reported osculating elements
    const [x,y]=pt(s.x,s.y), fac=1.9; ctx.strokeStyle='#ff8f81';ctx.lineWidth=2.4;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x*fac + cx*(1-fac),y*fac + cy*(1-fac));ctx.stroke();ctx.setLineDash([]);
  }
  function dot(x,y,color,r){ctx.fillStyle=color;ctx.shadowBlur=12;ctx.shadowColor=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  function arrow(x,y,vx,vy,color,len){const n=Math.hypot(vx,vy)||1,dx=vx/n*len,dy=vy/n*len;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();const a=Math.atan2(dy,dx);ctx.beginPath();ctx.moveTo(x+dx,y+dy);ctx.lineTo(x+dx-6*Math.cos(a-.5),y+dy-6*Math.sin(a-.5));ctx.lineTo(x+dx-6*Math.cos(a+.5),y+dy-6*Math.sin(a+.5));ctx.fill();}
}

$('radial').addEventListener('input',e=>{burn.radial=Number(e.target.value);sync();});
$('tangent').addEventListener('input',e=>{burn.tangential=Number(e.target.value);sync();});
$('phase').addEventListener('input',e=>{burn.phase=Number(e.target.value);sync();});
$('reset').addEventListener('click',()=>{burn={radial:0,tangential:0.28,phase:180};sync();});
$('vectors').addEventListener('click',e=>{showVectors=!showVectors;e.currentTarget.setAttribute('aria-pressed',showVectors);e.currentTarget.textContent=showVectors?'Vectors on':'Vectors off';draw();});
window.addEventListener('resize',draw);
sync();
