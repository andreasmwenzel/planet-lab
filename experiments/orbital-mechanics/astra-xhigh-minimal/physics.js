// Planar, point-mass, two-body mechanics. Distances km; times s; speeds km/s.
export const BODIES = {
  earth: { name: 'Earth', mu: 398600.4418, radius: 6371, atmosphere: 100, color: '#467d9e' },
  moon: { name: 'Moon', mu: 4902.800066, radius: 1737.4, atmosphere: 0, color: '#91959e' },
  mars: { name: 'Mars', mu: 42828.375214, radius: 3389.5, atmosphere: 80, color: '#bb7864' }
};
export const TAU = 2 * Math.PI;
export const norm = v => Math.hypot(v[0], v[1]);
export const dot = (a,b) => a[0]*b[0]+a[1]*b[1];
export const cross = (a,b) => a[0]*b[1]-a[1]*b[0];
export const modulo = (x,y) => ((x%y)+y)%y;
export function orbitFromApsides(periRadius, apoRadius, mu) {
  if (!(periRadius > 0 && apoRadius >= periRadius && mu > 0)) throw Error('Invalid orbital radii.');
  const a=(periRadius+apoRadius)/2;
  return { r:[periRadius,0], v:[0,Math.sqrt(mu*(2/periRadius-1/a))] };
}
export function elements(state, mu) {
  const {r,v}=state, radius=norm(r), speed=norm(v), h=cross(r,v), energy=speed*speed/2-mu/radius;
  const rv=dot(r,v), ev=r.map((x,i)=>((speed*speed-mu/radius)*x-rv*v[i])/mu), e=norm(ev);
  const p=h*h/mu, a=Math.abs(energy)<1e-12 ? Infinity : -mu/(2*energy);
  const bound=energy < -1e-12, peri=p/(1+e), apo=bound ? a*(1+e) : Infinity;
  const period=bound ? TAU*Math.sqrt(a*a*a/mu) : Infinity;
  const angle=e>1e-9 ? Math.atan2(ev[1],ev[0]) : Math.atan2(r[1],r[0]);
  return { radius,speed,h,energy,ev,e,p,a,bound,peri,apo,period,angle,radialSpeed:rv/radius };
}
export function stumpff(z) {
  if (Math.abs(z)<1e-4) return {
    c: 1/2-z/24+z*z/720-z**3/40320+z**4/3628800,
    s: 1/6-z/120+z*z/5040-z**3/362880+z**4/39916800
  };
  if(z>0){const q=Math.sqrt(z); return {c:(1-Math.cos(q))/z,s:(q-Math.sin(q))/(q*q*q)};}
  const q=Math.sqrt(-z); return {c:(Math.cosh(q)-1)/(-z),s:(Math.sinh(q)-q)/(q*q*q)};
}
export function propagate(state, dt, mu) {
  if (!Number.isFinite(dt) || !(mu>0)) throw Error('Invalid propagation input.');
  const r0=norm(state.r), v02=dot(state.v,state.v), alpha=2/r0-v02/mu, sqrtMu=Math.sqrt(mu);
  if (alpha>1e-12) { const period=TAU/Math.sqrt(mu*alpha**3); dt-=Math.round(dt/period)*period; }
  if(Math.abs(dt)<1e-12) return {r:[...state.r],v:[...state.v]};
  const direction=Math.sign(dt), v0=state.v.map(x=>x*direction), time=Math.abs(dt), rv=dot(state.r,v0)/sqrtMu;
  const target=sqrtMu*time;
  const equation=chi=>{
    const z=alpha*chi*chi,{c,s}=stumpff(z);
    return {f:rv*chi*chi*c+(1-alpha*r0)*chi**3*s+r0*chi-target,
      d:rv*chi*(1-z*s)+(1-alpha*r0)*chi*chi*c+r0,c,s,z};
  };
  let low=0,high=Math.max(1,Math.min(sqrtMu*time/r0,1000));
  for(let i=0;i<80 && equation(high).f<0;i++) high*=2;
  let chi=(low+high)/2, q;
  for(let i=0;i<120;i++) {
    q=equation(chi);
    if(Math.abs(q.f)<1e-10*Math.max(1,target)) break;
    if(q.f>0 || !Number.isFinite(q.f)) high=chi; else low=chi;
    const candidate=chi-q.f/q.d;
    chi=(Number.isFinite(candidate)&&candidate>low&&candidate<high)?candidate:(low+high)/2;
    if(high-low<1e-12*Math.max(1,chi)) break;
  }
  q=equation(chi);
  const f=1-chi*chi/r0*q.c, g=time-chi**3/sqrtMu*q.s;
  const r=state.r.map((x,i)=>f*x+g*v0[i]), radius=norm(r);
  const fd=sqrtMu/(radius*r0)*(alpha*chi**3*q.s-chi), gd=1-chi*chi/radius*q.c;
  const v=state.r.map((x,i)=>(fd*x+gd*v0[i])*direction);
  if(![...r,...v].every(Number.isFinite)) throw Error('The propagator could not resolve this trajectory.');
  return {r,v};
}
export function applyBurn(state, tangential, radial=0) {
  const radius=norm(state.r), er=state.r.map(x=>x/radius), direction=Math.sign(cross(state.r,state.v))||1;
  const et=[-er[1]*direction,er[0]*direction];
  return {r:[...state.r],v:state.v.map((x,i)=>x+et[i]*tangential+er[i]*radial)};
}
export function timeSincePeriapsis(state,mu) {
  const el=elements(state,mu);
  if(el.e<1e-9) return 0;
  const nu=Math.atan2(cross(el.ev,state.r)*Math.sign(el.h),dot(el.ev,state.r));
  return timeAtTrueAnomaly(nu,el,mu);
}
export function timeAtTrueAnomaly(nu,el,mu) {
  const e=el.e;
  if(Math.abs(e-1)<1e-8) { const d=Math.tan(nu/2);return .5*Math.sqrt(el.p**3/mu)*(d+d**3/3); }
  if(e<1) { const E=Math.atan2(Math.sqrt(1-e*e)*Math.sin(nu),e+Math.cos(nu));return (E-e*Math.sin(E))*Math.sqrt(el.a**3/mu); }
  const H=Math.asinh(Math.sqrt(e*e-1)*Math.sin(nu)/(1+e*Math.cos(nu)));
  return (e*Math.sinh(H)-H)*Math.sqrt((-el.a)**3/mu);
}
export function timeToApsis(state,mu,kind) {
  const el=elements(state,mu);
  if(!el.bound||el.e<1e-8) return null;
  const target=kind==='apo'?el.period/2:0;
  let time=modulo(target-timeSincePeriapsis(state,mu),el.period);
  if(time<1e-5) time=el.period;
  return time;
}
export function timeToImpact(state,body) {
  const el=elements(state,body.mu);
  if(el.radius<body.radius-1e-6) return 0;
  if(el.peri>=body.radius || el.e<1e-9) return Infinity;
  const nu=-Math.acos(Math.max(-1,Math.min(1,(el.p/body.radius-1)/el.e)));
  let t=timeAtTrueAnomaly(nu,el,body.mu)-timeSincePeriapsis(state,body.mu);
  if(el.bound) t=modulo(t,el.period);
  return t>=0 ? t : Infinity;
}
export function hohmann(r1,r2,mu) {
  if(!(r1>0&&r2>0&&mu>0)) throw Error('Invalid transfer radii.');
  const a=(r1+r2)/2, v1=Math.sqrt(mu/r1), v2=Math.sqrt(mu/r2);
  const burn1=Math.sqrt(mu*(2/r1-1/a))-v1;
  const burn2=v2-Math.sqrt(mu*(2/r2-1/a));
  return {burn1,burn2,total:Math.abs(burn1)+Math.abs(burn2),duration:Math.PI*Math.sqrt(a**3/mu),a};
}
export function sampleConic(state,mu,count=360,maxRadius=Infinity) {
  const el=elements(state,mu), pts=[];
  let limit=Math.PI;
  if(el.e>=1) limit=Math.acos(-1/el.e)-.015;
  if(Number.isFinite(maxRadius)&&el.e>1e-9&&el.apo>maxRadius) limit=Math.min(limit,Math.acos(Math.max(-1,Math.min(1,(el.p/maxRadius-1)/el.e))));
  const c=Math.cos(el.angle),s=Math.sin(el.angle);
  for(let i=0;i<=count;i++) {
    const nu=-limit+2*limit*i/count, r=el.p/(1+el.e*Math.cos(nu));
    const x=r*Math.cos(nu),y=r*Math.sin(nu);
    pts.push([x*c-y*s,x*s+y*c]);
  }
  return pts;
}
