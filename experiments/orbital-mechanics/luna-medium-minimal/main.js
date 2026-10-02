// Keplerian two-body model. Distances are km, time seconds, angles radians.
export const MU_EARTH = 398600.4418;
export const R_EARTH = 6371;
export function solveKepler(meanAnomaly, eccentricity, tolerance=1e-13) {
  if (!(eccentricity >= 0 && eccentricity < 1)) throw new RangeError('Elliptic eccentricity must be in [0, 1)');
  const M = ((meanAnomaly + Math.PI) % (2*Math.PI) + 2*Math.PI)%(2*Math.PI)-Math.PI;
  let E = eccentricity < .8 ? M : Math.sign(M || 1)*Math.PI;
  for (let i=0;i<80;i++) { const f=E-eccentricity*Math.sin(E)-M, d=1-eccentricity*Math.cos(E), step=f/d; E-=step; if (Math.abs(step)<tolerance) return E; }
  throw new Error('Kepler solver did not converge');
}
export function orbitalState(a,e,meanAnomaly,mu=MU_EARTH) {
  if (!(a>0) || !(e>=0 && e<1) || !(mu>0)) throw new RangeError('Require a>0, 0≤e<1, μ>0');
  const E=solveKepler(meanAnomaly,e), c=Math.cos(E), s=Math.sin(E), n=Math.sqrt(mu/a**3), den=1-e*c;
  const x=a*(c-e), y=a*Math.sqrt(1-e*e)*s;
  const vx=-a*n*s/den, vy=a*n*Math.sqrt(1-e*e)*c/den;
  const r=Math.hypot(x,y), v=Math.hypot(vx,vy), trueAnomaly=Math.atan2(y*Math.sqrt(1-e*e),x+e*a);
  return {x,y,vx,vy,r,v,trueAnomaly,E,meanAnomaly:((meanAnomaly%(2*Math.PI))+2*Math.PI)%(2*Math.PI),period:2*Math.PI/n,energy:v*v/2-mu/r,angularMomentum:x*vy-y*vx};
}

const $=s=>document.querySelector(s);
if (typeof document !== 'undefined' && $('#orbit')) boot();
function boot(){
 const canvas=$('#orbit'),ctx=canvas.getContext('2d'), inputs={alt:$('#alt'),ecc:$('#ecc'),phase:$('#phase')};
 let a=R_EARTH+520,e=.12,M=0,elapsed=0,running=false,last=0,speed=600,focus='leo';
 const presets={leo:{a:R_EARTH+520,e:.12,label:'LEO · survey'},transfer:{a:R_EARTH+10500,e:.48,label:'Transfer · eccentric'},geo:{a:42164,e:.001,label:'GEO · synchronous'}};
 function setPreset(key){focus=key; ({a,e}=presets[key]); M=0; inputs.alt.value=Math.round(a-R_EARTH);inputs.ecc.value=e;$('#mission').textContent=presets[key].label;sync();}
 function sync(){ $('#altVal').textContent=`${Math.round(a-R_EARTH).toLocaleString()} km`;$('#eccVal').textContent=e.toFixed(2);$('#phaseVal').textContent=`${Math.round(M*180/Math.PI)}°`;const s=orbitalState(a,e,M);$('#readR').textContent=`${s.r.toFixed(0)} km`;$('#readV').textContent=`${s.v.toFixed(3)} km/s`;$('#readT').textContent=`${(s.period/3600).toFixed(2)} h`;$('#readF').textContent=`${(s.trueAnomaly*180/Math.PI+360)%360|0}°`;$('#readE').textContent=`${s.energy.toFixed(3)} km²/s²`;draw();}
 inputs.alt.addEventListener('input',()=>{a=R_EARTH+Number(inputs.alt.value);focus='custom';$('#mission').textContent='Custom orbit';sync()});
 inputs.ecc.addEventListener('input',()=>{e=Number(inputs.ecc.value);focus='custom';$('#mission').textContent='Custom orbit';sync()});
 inputs.phase.addEventListener('input',()=>{M=Number(inputs.phase.value)*Math.PI/180;sync()});
 document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>setPreset(b.dataset.preset));
 $('#toggle').onclick=()=>{running=!running;$('#toggle').textContent=running?'Ⅱ Pause':'▶ Run';$('#state').textContent=running?'PROPAGATING':'PAUSED';$('#state').classList.toggle('live',running)};
 $('#reset').onclick=()=>{running=false;elapsed=0;M=0;$('#toggle').textContent='▶ Run';$('#state').textContent='PAUSED';$('#state').classList.remove('live');sync()};
 $('#speed').oninput=ev=>{speed=Number(ev.target.value);$('#speedVal').textContent=`${speed}×`};
 function size(){const d=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);draw()}
 function draw(){if(!ctx)return;const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;ctx.clearRect(0,0,w,h);const cx=w*.5,cy=h*.53,margin=40,scale=Math.min((w-margin*2)/(2*a*(1+e)),(h-margin*2)/(2*a*(1+e)));const px=a*scale,py=px*Math.sqrt(1-e*e),off=px*e;ctx.save();ctx.translate(cx+off,cy);
   // orbital track and faint radial grid
   ctx.strokeStyle='rgba(137,174,196,.14)';ctx.lineWidth=1;for(let k=1;k<=3;k++){ctx.beginPath();ctx.arc(-off,0,k*R_EARTH*scale,0,Math.PI*2);ctx.stroke()}
   ctx.beginPath();ctx.ellipse(-off,0,px,py,0,0,Math.PI*2);ctx.strokeStyle='#47788b';ctx.lineWidth=1.4;ctx.setLineDash([4,7]);ctx.stroke();ctx.setLineDash([]);
   // swept path from periapsis to current anomaly
   const state=orbitalState(a,e,M);ctx.beginPath();ctx.ellipse(-off,0,px,py,0,0,state.E);ctx.strokeStyle='#64e1d2';ctx.lineWidth=2.5;ctx.stroke();
   const earth=R_EARTH*scale;const g=ctx.createRadialGradient(-off-earth*.35,-earth*.4,earth*.12,-off,0,earth);g.addColorStop(0,'#b5e6ee');g.addColorStop(.55,'#3286a2');g.addColorStop(1,'#183d6c');ctx.beginPath();ctx.arc(-off,0,earth,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
   ctx.beginPath();ctx.arc(state.x*scale,state.y*scale,6.5,0,Math.PI*2);ctx.fillStyle='#f7c86b';ctx.shadowColor='#f7c86b';ctx.shadowBlur=20;ctx.fill();ctx.shadowBlur=0;
   // velocity cue
   const vl=30;ctx.beginPath();ctx.moveTo(state.x*scale,state.y*scale);ctx.lineTo(state.x*scale+state.vx/state.v*vl,state.y*scale+state.vy/state.v*vl);ctx.strokeStyle='#f7c86b';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
   $('#canvasHint').textContent=`Earth-centered · ${focus==='custom'?'CUSTOM':focus.toUpperCase()} · t+${(elapsed/3600).toFixed(1)} h`;
 }
 function frame(t){if(last&&running){const dt=Math.min((t-last)/1000,.08)*speed;elapsed+=dt;M=(M+Math.sqrt(MU_EARTH/a**3)*dt)%(Math.PI*2);sync()}last=t;requestAnimationFrame(frame)}
 new ResizeObserver(size).observe(canvas);setPreset('leo');requestAnimationFrame(frame);
}
