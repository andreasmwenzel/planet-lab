/** Kepler Dispatch — planar, unperturbed two-body mechanics.
 * Distances km; time s; velocities km/s; UI impulses m/s.
 * Universal-variable propagation with bracketed Newton iteration.
 */
export const MU = 398600.4418;
export const EARTH = 6371;
export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const wrap = a => ((a % TAU) + TAU) % TAU;
export const radius = s => Math.hypot(s.x, s.y);
export const speed = s => Math.hypot(s.vx, s.vy);
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export const relativeSpeed = (a,b) => Math.hypot(a.vx-b.vx,a.vy-b.vy);
export function circularState(r, angle = 0, direction = 1) {
  const v = Math.sqrt(MU/r)*direction;
  return {x:r*Math.cos(angle),y:r*Math.sin(angle),vx:-v*Math.sin(angle),vy:v*Math.cos(angle)};
}
export function apsisState(peri, apo, angle=0, atApo=false) {
  const r = atApo ? apo : peri, a=(peri+apo)/2;
  const theta=angle+(atApo?Math.PI:0), v=Math.sqrt(MU*(2/r-1/a));
  return {x:r*Math.cos(theta),y:r*Math.sin(theta),vx:-v*Math.sin(theta),vy:v*Math.cos(theta)};
}
export function elements(s) {
  const r=radius(s), v2=s.vx*s.vx+s.vy*s.vy, rv=s.x*s.vx+s.y*s.vy;
  const h=s.x*s.vy-s.y*s.vx, energy=v2/2-MU/r;
  const ex=((v2-MU/r)*s.x-rv*s.vx)/MU, ey=((v2-MU/r)*s.y-rv*s.vy)/MU;
  const e=Math.hypot(ex,ey), p=h*h/MU, a=Math.abs(energy)>1e-13?-MU/(2*energy):Infinity;
  const bound=energy < -1e-10;
  return {r,v:Math.sqrt(v2),energy,c3:2*energy,h,e,ex,ey,p,a,peri:p/(1+e),apo:bound?2*a-p/(1+e):Infinity,
    period:bound?TAU*Math.sqrt(a*a*a/MU):Infinity,omega:e>1e-8?Math.atan2(ey,ex):Math.atan2(s.y,s.x),
    radial:rv/r, tangential:Math.abs(h)/r,bound};
}
export function stumpff(z) {
  if (Math.abs(z)<1e-4) {
    // Horner series avoids cancellation near the parabolic limit.
    return {c:0.5-z*(1/24-z*(1/720-z*(1/40320-z/3628800))),
      s:1/6-z*(1/120-z*(1/5040-z*(1/362880-z/39916800)))};
  }
  if(z>0) { const q=Math.sqrt(z); return {c:(1-Math.cos(q))/z,s:(q-Math.sin(q))/(q*q*q)}; }
  const q=Math.sqrt(-z); return {c:(Math.cosh(q)-1)/(-z),s:(Math.sinh(q)-q)/(q*q*q)};
}
export function propagate(input, dt) {
  if(!Number.isFinite(dt)||!Object.values(input).every(Number.isFinite)) throw new Error('Non-finite state or time');
  if(dt===0) return {...input};
  if(dt<0) {const r=propagate({...input,vx:-input.vx,vy:-input.vy},-dt);return {...r,vx:-r.vx,vy:-r.vy};}
  const r0=radius(input), rootMu=Math.sqrt(MU), rv=input.x*input.vx+input.y*input.vy;
  const alpha=2/r0-(input.vx*input.vx+input.vy*input.vy)/MU;
  if(alpha>1e-12) {const T=TAU/Math.sqrt(MU*alpha**3);if(dt>T) dt%=T;}
  if(dt<1e-12) return {...input};
  const evaluate=chi=>{
    const z=alpha*chi*chi,{c,s}=stumpff(z);
    return {f:rv/rootMu*chi*chi*c+(1-alpha*r0)*chi**3*s+r0*chi-rootMu*dt,
      d:rv/rootMu*chi*(1-z*s)+(1-alpha*r0)*chi*chi*c+r0,c,s};
  };
  let lo=0, hi=Math.max(1,rootMu*dt/r0), q=evaluate(hi), expansions=0;
  while(q.f<0 && expansions++<80) {hi*=2;q=evaluate(hi);}
  if(q.f<0) throw new Error('Kepler root not bracketed');
  let chi=(lo+hi)/2, converged=false;
  for(let k=0;k<100;k++) {
    q=evaluate(chi);
    if(Number.isFinite(q.f)&&Math.abs(q.f)<1e-10*Math.max(1,rootMu*dt)){converged=true;break;}
    if(!Number.isFinite(q.f)||q.f>0) hi=chi; else lo=chi;
    const next=chi-q.f/q.d;
    chi=Number.isFinite(next)&&next>lo&&next<hi?next:(lo+hi)/2;
    if(hi-lo<1e-11){converged=true;break;}
  }
  if(!converged) throw new Error('Kepler solver did not converge');
  q=evaluate(chi);
  const f=1-chi*chi/r0*q.c,g=dt-chi**3/rootMu*q.s;
  const x=f*input.x+g*input.vx,y=f*input.y+g*input.vy,r=Math.hypot(x,y);
  const fd=rootMu/(r*r0)*(alpha*chi**3*q.s-chi),gd=1-chi*chi/r*q.c;
  return {x,y,vx:fd*input.x+gd*input.vx,vy:fd*input.y+gd*input.vy};
}
export function localFrame(s) {
  const r=radius(s),rx=s.x/r,ry=s.y/r,d=(s.x*s.vy-s.y*s.vx)>=0?1:-1;
  return {rx,ry,tx:-ry*d,ty:rx*d};
}
export function burn(s, tangentialMps, radialMps=0) {
  if(!Number.isFinite(tangentialMps)||!Number.isFinite(radialMps)) throw new Error('Invalid impulse');
  const {rx,ry,tx,ty}=localFrame(s), t=tangentialMps/1000,r=radialMps/1000;
  return {...s,vx:s.vx+t*tx+r*rx,vy:s.vy+t*ty+r*ry};
}
export function timeToApsis(s, which='apo') {
  const e=elements(s);if(!e.bound) return Infinity;
  if(e.e<1e-7) return which==='apo'?e.period/2:e.period;
  const sinE=(s.x*s.vx+s.y*s.vy)/(e.e*Math.sqrt(MU*e.a));
  const cosE=(1-e.r/e.a)/e.e;
  const E=Math.atan2(sinE,cosE), M=wrap(E-e.e*Math.sin(E));
  let delta=wrap((which==='apo'?Math.PI:0)-M);
  if(delta<1e-7) delta=TAU;
  return delta*Math.sqrt(e.a**3/MU);
}
export function hohmann(r1,r2) {
  const a=(r1+r2)/2,v1=Math.sqrt(MU/r1),v2=Math.sqrt(MU/r2);
  const dv1=Math.sqrt(MU*(2/r1-1/a))-v1,dv2=v2-Math.sqrt(MU*(2/r2-1/a));
  const time=Math.PI*Math.sqrt(a**3/MU);
  return {dv1:dv1*1000,dv2:dv2*1000,total:(Math.abs(dv1)+Math.abs(dv2))*1000,time,
    phase:Math.PI-Math.sqrt(MU/r2**3)*time};
}
export function sampleOrbit(s, count=300, limit=150000) {
  const e=elements(s);
  if(Math.abs(e.h)<1e-6){const theta=Math.atan2(s.y,s.x),far=e.bound?e.apo:limit;return [{x:0,y:0},{x:far*Math.cos(theta),y:far*Math.sin(theta)}];}
  const start=e.bound?-Math.PI:-Math.acos(-1/Math.max(e.e,1.000000001))*.998;
  const points=[];
  for(let i=0;i<=count;i++) {
    const nu=start+(e.bound?TAU:-2*start)*i/count, den=1+e.e*Math.cos(nu),r=e.p/den;
    if(r>0&&r<limit) points.push({x:r*Math.cos(e.omega+nu),y:r*Math.sin(e.omega+nu)});
    else points.push(null);
  }
  return points;
}
export function closestApproach(ship,target,horizon=7200,samples=100) {
  const d2=t=>{const a=propagate(ship,t),b=propagate(target,t);return (a.x-b.x)**2+(a.y-b.y)**2;};
  let best=Infinity,t=0,index=0;
  for(let i=0;i<=samples;i++){const at=horizon*i/samples,v=d2(at);if(v<best){best=v;t=at;index=i;}}
  let lo=Math.max(0,(index-1)*horizon/samples),hi=Math.min(horizon,(index+1)*horizon/samples);
  for(let i=0;i<45;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(d2(a)<d2(b))hi=b;else lo=a;}
  const mid=(lo+hi)/2;if(d2(mid)<best)t=mid;
  const a=propagate(ship,t),b=propagate(target,t);
  return {time:t,distance:distance(a,b),relativeSpeed:relativeSpeed(a,b)*1000,ship:a,target:b};
}
