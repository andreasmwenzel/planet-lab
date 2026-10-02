// Planar, point-mass, two-body dynamics. km, seconds, km/s.
export const MU = 398600.4418;
export const R = 6371;
export const norm = v => Math.hypot(v[0], v[1]);
export function elements(s) {
  const r = norm(s.r), v2 = s.v[0] ** 2 + s.v[1] ** 2;
  const h = s.r[0] * s.v[1] - s.r[1] * s.v[0];
  const energy = v2 / 2 - MU / r;
  const ev = [s.v[1] * h / MU - s.r[0] / r, -s.v[0] * h / MU - s.r[1] / r];
  const e = norm(ev), p = h * h / MU;
  const a = Math.abs(energy) < 1e-12 ? Infinity : -MU / (2 * energy);
  return {h, energy, e, ev, p, a, rp: p / (1 + e), ra: e < 1 ? p / (1 - e) : Infinity, period: a > 0 && Number.isFinite(a) ? 2 * Math.PI * Math.sqrt(a ** 3 / MU) : Infinity};
}
function stumpff(z) {
  if (Math.abs(z) < 1e-4) {
    let c = 0.5, s = 1 / 6, tc = c, ts = s;
    for (let k = 1; k < 9; k++) { tc *= -z / ((2*k+1)*(2*k+2)); ts *= -z / ((2*k+2)*(2*k+3)); c += tc; s += ts; }
    return [c,s];
  }
  if (z > 0) { const q = Math.sqrt(z); return [(1-Math.cos(q))/z, (q-Math.sin(q))/(q*q*q)]; }
  const q = Math.sqrt(-z); return [(Math.cosh(q)-1)/(-z), (Math.sinh(q)-q)/(q*q*q)];
}
export function propagate(state, seconds) {
  if (!Number.isFinite(seconds)) throw new Error('Time must be finite');
  const r0 = norm(state.r), v0 = norm(state.v), sqrtMu = Math.sqrt(MU);
  const dot = state.r[0]*state.v[0]+state.r[1]*state.v[1];
  const alpha = 2/r0-v0*v0/MU;
  let dt = seconds;
  if (alpha > 1e-12) { const period = 2*Math.PI/Math.sqrt(MU*alpha**3); dt %= period; }
  if (Math.abs(dt) < 1e-12) return {r:[...state.r],v:[...state.v]};
  const calc = x => { const [c,s] = stumpff(alpha*x*x); return dot/sqrtMu*x*x*c + (1-alpha*r0)*x*x*x*s + r0*x-sqrtMu*dt; };
  let lo = dt > 0 ? 0 : -1, hi = dt > 0 ? 1 : 0;
  for (let k=0;k<100 && calc(lo)>0;k++) lo*=2;
  for (let k=0;k<100 && calc(hi)<0;k++) hi*=2;
  let x=0;
  for(let k=0;k<100;k++) { x=(lo+hi)/2; const y=calc(x); if(y>0)hi=x;else lo=x; if(hi-lo<1e-12*Math.max(1,Math.abs(x)))break; }
  const [c,s] = stumpff(alpha*x*x);
  const f=1-x*x/r0*c, g=dt-x*x*x/sqrtMu*s;
  const r=[f*state.r[0]+g*state.v[0], f*state.r[1]+g*state.v[1]], radius=norm(r);
  const fd=sqrtMu/(radius*r0)*(alpha*x*x*x*s-x), gd=1-x*x/radius*c;
  const v=[fd*state.r[0]+gd*state.v[0],fd*state.r[1]+gd*state.v[1]];
  if (![...r,...v].every(Number.isFinite)) throw new Error('Propagation exceeded numerical range');
  return {r,v};
}
export function burn(state, prograde, radial) {
  const r=norm(state.r), tangentSign=Math.sign(state.r[0]*state.v[1]-state.r[1]*state.v[0]) || 1;
  // Along-track is perpendicular to radius, in the direction of angular motion.
  const er=[state.r[0]/r,state.r[1]/r], et=[-er[1]*tangentSign,er[0]*tangentSign];
  return {r:[...state.r],v:[state.v[0]+prograde/1000*et[0]+radial/1000*er[0],state.v[1]+prograde/1000*et[1]+radial/1000*er[1]]};
}
export function apsisState(perigeeAltitude, apogeeAltitude) {
  const rp=R+perigeeAltitude, ra=R+apogeeAltitude;
  return {r:[rp,0],v:[0,Math.sqrt(MU*(2/rp-2/(rp+ra)))]};
}
export function hohmann(r1,r2) {
  const a=(r1+r2)/2;
  const dv1=Math.sqrt(MU*(2/r1-1/a))-Math.sqrt(MU/r1);
  const dv2=Math.sqrt(MU/r2)-Math.sqrt(MU*(2/r2-1/a));
  return {dv1:dv1*1000,dv2:dv2*1000,time:Math.PI*Math.sqrt(a**3/MU)};
}
// Surface event detection also checks a perigee inside each 10-second interval,
// so a shallow grazing pass cannot tunnel through the planet between samples.
export function advanceToSurface(start, duration) {
  let state=start, advanced=0;
  const radial=s=>s.r[0]*s.v[0]+s.r[1]*s.v[1];
  if(norm(state.r)<=R+1e-8 && radial(state)<=0) return {state,advanced,contact:true};
  while(advanced<duration){
    const dt=Math.min(10,duration-advanced), next=propagate(state,dt);
    let upper=dt,hit=norm(next.r)<=R;
    if(!hit&&radial(state)<0&&radial(next)>=0&&elements(state).rp<R){
      let lo=0,hi=dt;
      for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(radial(propagate(state,mid))<0)lo=mid;else hi=mid}
      upper=(lo+hi)/2;hit=norm(propagate(state,upper).r)<=R;
    }
    if(hit){let lo=0,hi=upper;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(norm(propagate(state,mid).r)<=R)hi=mid;else lo=mid}return {state:propagate(state,hi),advanced:advanced+hi,contact:true}}
    state=next;advanced+=dt;
  }
  return {state,advanced,contact:false};
}
