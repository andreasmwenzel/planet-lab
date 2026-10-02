// Distances km, velocities km/s, times s. Earth-centered inertial two-body model.
export const MU=398600.4418, EARTH=6371;
export const norm=v=>Math.hypot(...v);
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
export function stumpff(z){
 if(Math.abs(z)<1e-5){let c=.5,s=1/6,tc=c,ts=s;for(let k=1;k<8;k++){tc*=-z/((2*k+1)*(2*k+2));ts*=-z/((2*k+2)*(2*k+3));c+=tc;s+=ts;}return [c,s];}
 if(z>0){const q=Math.sqrt(z);return [(1-Math.cos(q))/z,(q-Math.sin(q))/(q*q*q)];}
 const q=Math.sqrt(-z);return [(Math.cosh(q)-1)/(-z),(Math.sinh(q)-q)/(q*q*q)];
}
export function propagate(state,dt){
 if(dt===0)return {r:[...state.r],v:[...state.v]};
 const r0=norm(state.r),v2=dot(state.v,state.v),rv=dot(state.r,state.v),sm=Math.sqrt(MU),alpha=2/r0-v2/MU;
 const evaluate=x=>{const [c,s]=stumpff(alpha*x*x);return {f:rv/sm*x*x*c+(1-alpha*r0)*x*x*x*s+r0*x-sm*dt,d:rv/sm*x*(1-alpha*x*x*s)+(1-alpha*r0)*x*x*c+r0,c,s};};
 let lo=dt>0?0:-Math.max(1,sm*Math.abs(dt)/r0),hi=dt>0?Math.max(1,sm*dt/r0):0;
 for(let i=0;i<100 && evaluate(lo).f>0;i++)lo*=2;
 for(let i=0;i<100 && evaluate(hi).f<0;i++)hi*=2;
 let x=(lo+hi)/2,ev;
 for(let i=0;i<120;i++){ev=evaluate(x);if(Math.abs(ev.f)<1e-8)break;if(ev.f>0)hi=x;else lo=x;const next=x-ev.f/ev.d;x=Number.isFinite(next)&&next>lo&&next<hi?next:(lo+hi)/2;if(hi-lo<1e-11)break;}
 ev=evaluate(x);const f=1-x*x/r0*ev.c,g=dt-x*x*x/sm*ev.s;
 const r=state.r.map((q,i)=>f*q+g*state.v[i]),rn=norm(r),fd=sm/(rn*r0)*(alpha*x*x*x*ev.s-x),gd=1-x*x/rn*ev.c;
 const v=state.r.map((q,i)=>fd*q+gd*state.v[i]);
 if(![...r,...v].every(Number.isFinite))throw new Error('Propagation exceeded numerical range');
 return {r,v};
}
export function elements(state){
 const r=norm(state.r),v2=dot(state.v,state.v),rv=dot(state.r,state.v),h=state.r[0]*state.v[1]-state.r[1]*state.v[0],energy=v2/2-MU/r;
 const evec=state.r.map((x,i)=>((v2-MU/r)*x-rv*state.v[i])/MU),e=norm(evec),p=h*h/MU,a=Math.abs(energy)<1e-10?Infinity:-MU/(2*energy);
 return {r,speed:Math.sqrt(v2),energy,h,e,evec,a,peri:p/(1+e),apo:e<1?p/(1-e):Infinity,period:energy<0?2*Math.PI*Math.sqrt(a*a*a/MU):Infinity};
}
export function circular(altitude){const r=EARTH+altitude;return {r:[r,0],v:[0,Math.sqrt(MU/r)]};}
export function burn(state,tangential,radial){const r=norm(state.r),u=state.r.map(x=>x/r),sgn=elements(state).h<0?-1:1,t=[-u[1]*sgn,u[0]*sgn];return {r:[...state.r],v:state.v.map((v,i)=>v+tangential*t[i]+radial*u[i])};}
export function hohmann(r1,r2){const a=(r1+r2)/2;return {dv1:Math.sqrt(MU/r1)*(Math.sqrt(2*r2/(r1+r2))-1),dv2:Math.sqrt(MU/r2)*(1-Math.sqrt(2*r1/(r1+r2))),time:Math.PI*Math.sqrt(a*a*a/MU)};}
export function advanceSafe(state,dt){
 // Check physical Earth contact in bounded intervals, then bisect the first crossing.
 let current=state,elapsed=0;if(norm(current.r)<=EARTH)return {state:current,elapsed:0,impact:true};
 while(elapsed<dt){const step=Math.min(20,dt-elapsed),next=propagate(current,step);if(norm(next.r)<=EARTH){let l=0,h=step;for(let i=0;i<40;i++){const m=(l+h)/2;if(norm(propagate(current,m).r)>EARTH)l=m;else h=m;}return {state:propagate(current,h),elapsed:elapsed+h,impact:true};}current=next;elapsed+=step;}
 return {state:current,elapsed,impact:false};
}
