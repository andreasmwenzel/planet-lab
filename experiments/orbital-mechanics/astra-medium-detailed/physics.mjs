// Units throughout: km, seconds, km/s. Inertial planar Earth-centered coordinates.
export const MU=398600.4418, R=6371;
export const norm=v=>Math.hypot(...v);
export function elements(s){
 const r=norm(s.r), v2=s.v[0]**2+s.v[1]**2, rv=s.r[0]*s.v[0]+s.r[1]*s.v[1];
 const h=s.r[0]*s.v[1]-s.r[1]*s.v[0], energy=v2/2-MU/r;
 const ev=s.r.map((x,i)=>((v2-MU/r)*x-rv*s.v[i])/MU), e=norm(ev), p=h*h/MU;
 const a=Math.abs(energy)<1e-12?Infinity:-MU/(2*energy);
 return {r,speed:Math.sqrt(v2),h,energy,e,ev,p,a,rp:p/(1+e),ra:energy<0?a*(1+e):Infinity,period:energy<0?2*Math.PI*Math.sqrt(a**3/MU):Infinity};
}
export function initial(perigee=300,apogee=300){const r=R+perigee,a=(2*R+perigee+apogee)/2;return {r:[r,0],v:[0,Math.sqrt(MU*(2/r-1/a))],t:0,impact:false};}
function derivative(z){const r=Math.hypot(z[0],z[1]), f=-MU/r**3;return [z[2],z[3],f*z[0],f*z[1]];}
export function step(s,dt){const z=[...s.r,...s.v],k1=derivative(z),k2=derivative(z.map((a,i)=>a+dt*k1[i]/2)),k3=derivative(z.map((a,i)=>a+dt*k2[i]/2)),k4=derivative(z.map((a,i)=>a+dt*k3[i]));const q=z.map((a,i)=>a+dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);return {r:q.slice(0,2),v:q.slice(2),t:s.t+dt,impact:Math.hypot(q[0],q[1])<=R};}
export function advance(s,seconds,maxStep=10){let q={...s,r:[...s.r],v:[...s.v]},left=seconds;let guard=0;while(left>1e-9&&!q.impact){const dt=Math.min(left,maxStep,Math.sqrt(norm(q.r)**3/MU)/100);q=step(q,dt);left-=dt;if(++guard>200000)throw new Error('Propagation interval too large');}return q;}
export function burn(s,prograde,radial){const r=norm(s.r),u=s.r.map(x=>x/r),sign=elements(s).h>=0?1:-1,t=[-u[1]*sign,u[0]*sign];return {...s,r:[...s.r],v:s.v.map((x,i)=>x+prograde*t[i]+radial*u[i])};}
export function circularBurn(s){const r=norm(s.r),u=s.r.map(x=>x/r),sign=elements(s).h>=0?1:-1,t=[-u[1]*sign,u[0]*sign];return {prograde:Math.sqrt(MU/r)-(s.v[0]*t[0]+s.v[1]*t[1]),radial:-(s.v[0]*u[0]+s.v[1]*u[1])};}
export function timeToApsis(s,apo=true){const o=elements(s);if(!Number.isFinite(o.period)||o.e<1e-6||o.h===0)return null;const cosE=Math.max(-1,Math.min(1,(1-o.r/o.a)/o.e));const sinE=(s.r[0]*s.v[0]+s.r[1]*s.v[1])/(o.e*Math.sqrt(MU*o.a));const E=Math.atan2(sinE,cosE),M=E-o.e*Math.sin(E),target=apo?Math.PI:0;let d=((target-M)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);if(d<1e-5)d=2*Math.PI;return d*Math.sqrt(o.a**3/MU);}
export function orbitPoints(s,count=480,maxRadius=150000){const o=elements(s),theta=o.e>1e-7?Math.atan2(o.ev[1],o.ev[0]):0;const limit=o.e<1?Math.PI:Math.acos(-1/o.e)-0.006;let out=[];for(let i=0;i<=count;i++){const f=-limit+2*limit*i/count,r=o.p/(1+o.e*Math.cos(f));out.push(r>0&&r<maxRadius?[r*Math.cos(f+theta),r*Math.sin(f+theta)]:null);}return out;}
