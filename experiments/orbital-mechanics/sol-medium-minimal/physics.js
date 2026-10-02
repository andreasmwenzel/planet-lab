// Units throughout: km, s, km/s. Inertial, planar Earth-centered coordinates.
export const MU = 398600.4418;
export const EARTH = 6371;
export const mag = v => Math.hypot(v[0],v[1]);
export function circular(altitude=400) { const r=EARTH+altitude; return {r:[r,0],v:[0,Math.sqrt(MU/r)],t:0}; }
export function acceleration(r) { const q=mag(r); return r.map(x=>-MU*x/q**3); }
export function step(s,dt) {
  // Fourth-order Runge–Kutta, with an explicit maximum 5-second internal step.
  if(dt===0) return {r:[...s.r],v:[...s.v],t:s.t};
  const n=Math.ceil(Math.abs(dt)/5), h=dt/n; let y=[...s.r,...s.v];
  const deriv=a=>[a[2],a[3],...acceleration(a.slice(0,2))];
  for(let j=0;j<n;j++) { const a=deriv(y),b=deriv(y.map((x,i)=>x+h*a[i]/2)),c=deriv(y.map((x,i)=>x+h*b[i]/2)),d=deriv(y.map((x,i)=>x+h*c[i])); y=y.map((x,i)=>x+h*(a[i]+2*b[i]+2*c[i]+d[i])/6); }
  return {r:y.slice(0,2),v:y.slice(2),t:s.t+dt};
}
export function elements(s) {
  const r=mag(s.r),v=mag(s.v),dot=s.r[0]*s.v[0]+s.r[1]*s.v[1],h=s.r[0]*s.v[1]-s.r[1]*s.v[0];
  const energy=v*v/2-MU/r,ev=s.r.map((x,i)=>((v*v-MU/r)*x-dot*s.v[i])/MU),e=mag(ev),a=Math.abs(energy)<1e-10?Infinity:-MU/(2*energy),p=h*h/MU;
  const rp=p/(1+e),ra=energy<0?p/(1-e):Infinity,period=energy<0?2*Math.PI*Math.sqrt(a**3/MU):Infinity;
  return {r,v,h,energy,e,a,rp,ra,period,escape:Math.sqrt(2*MU/r),radial:dot/r,tangential:h/r};
}
export function burn(s,radial,tangential) { const r=mag(s.r),u=s.r.map(x=>x/r),w=[-u[1],u[0]]; return {r:[...s.r],v:s.v.map((x,i)=>x+radial*u[i]+tangential*w[i]),t:s.t}; }
export function circularize(s) { const e=elements(s);return {radial:-e.radial,tangential:(e.h<0?-1:1)*Math.sqrt(MU/e.r)-e.tangential}; }
export function hohmann(r1,r2) { const a=(r1+r2)/2; return {first:Math.sqrt(MU*(2/r1-1/a))-Math.sqrt(MU/r1),second:Math.sqrt(MU/r2)-Math.sqrt(MU*(2/r2-1/a)),time:Math.PI*Math.sqrt(a**3/MU)}; }
export function trajectory(s,count=420) { const el=elements(s),duration=Math.min(Number.isFinite(el.period)?el.period:21600,28800),points=[s.r];let q=s,impact=false; for(let i=1;i<=count;i++){q=step(q,duration/count);points.push(q.r);if(mag(q.r)<=EARTH){impact=true;break;}}return {points,duration:q.t-s.t,impact}; }

export function nextApsis(s) {
  const e=elements(s); if(e.energy>=0||e.e<1e-6)return null;
  const rv=s.r[0]*s.v[0]+s.r[1]*s.v[1];
  let E=Math.atan2(rv/(e.e*Math.sqrt(MU*e.a)),(1-e.r/e.a)/e.e); if(E<0)E+=2*Math.PI;
  const M=E-e.e*Math.sin(E),outward=Math.abs(e.radial)<1e-8?e.r<e.a:e.radial>0,target=outward?Math.PI:2*Math.PI;
  let delta=target-M; if(delta<1e-8)delta+=2*Math.PI;
  return {time:delta*Math.sqrt(e.a**3/MU),name:outward?'apoapsis':'periapsis'};
}
