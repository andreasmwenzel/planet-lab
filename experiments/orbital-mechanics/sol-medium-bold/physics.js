// Units: kilometres, seconds. Planar Earth-centred inertial coordinates.
export const MU = 398600.4418;
export const EARTH = 6371;
export function circular(altitude, phase = 0) {
  const r = EARTH + altitude, v = Math.sqrt(MU / r), a = phase * Math.PI / 180;
  return [r*Math.cos(a), r*Math.sin(a), -v*Math.sin(a), v*Math.cos(a)];
}
export function derivative(s) {
  const r = Math.hypot(s[0],s[1]), f = -MU / r**3;
  return [s[2],s[3],f*s[0],f*s[1]];
}
export function rk4(s, dt) {
  const k1=derivative(s), k2=derivative(s.map((v,i)=>v+dt*k1[i]/2));
  const k3=derivative(s.map((v,i)=>v+dt*k2[i]/2)), k4=derivative(s.map((v,i)=>v+dt*k3[i]));
  return s.map((v,i)=>v+dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
}
export function advance(s,dt) {
  let out=[...s], n=Math.ceil(Math.abs(dt)/5);
  if(!n) return out;
  for(let i=0;i<n;i++) out=rk4(out,dt/n);
  return out;
}
export function impulse(s, tangential, radial) {
  const r=Math.hypot(s[0],s[1]), ux=s[0]/r, uy=s[1]/r;
  return [s[0],s[1],s[2]+(radial*ux-tangential*uy)/1000,s[3]+(radial*uy+tangential*ux)/1000];
}
export function elements(s) {
  const r=Math.hypot(s[0],s[1]), v2=s[2]**2+s[3]**2;
  const energy=v2/2-MU/r, h=s[0]*s[3]-s[1]*s[2];
  const e=Math.sqrt(Math.max(0,1+2*energy*h*h/MU**2));
  const p=h*h/MU, peri=p/(1+e)-EARTH;
  return {energy,h,e,peri,apo:energy<0?p/(1-e)-EARTH:Infinity,period:energy<0?2*Math.PI*Math.sqrt((-MU/(2*energy))**3/MU):Infinity};
}
export function hohmann(inner,outer,phaseDeg=0) {
  const r1=EARTH+inner,r2=EARTH+outer,a=(r1+r2)/2;
  const transfer=Math.PI*Math.sqrt(a**3/MU), n1=Math.sqrt(MU/r1**3),n2=Math.sqrt(MU/r2**3);
  const desired=Math.PI-n2*transfer;
  let wait=(((phaseDeg*Math.PI/180-desired)%(2*Math.PI)+2*Math.PI)%(2*Math.PI))/(n1-n2);
  if(wait<1e-7) wait=0;
  return {wait,transfer,desiredPhase:desired*180/Math.PI,burns:[{time:wait,tangential:(Math.sqrt(MU*(2/r1-1/a))-Math.sqrt(MU/r1))*1000,radial:0},{time:wait+transfer,tangential:(Math.sqrt(MU/r2)-Math.sqrt(MU*(2/r2-1/a)))*1000,radial:0}]};
}
export function forecast({tugAltitude=400,targetAltitude=800,phase=12,burns=[],duration=14400,sample=10}) {
  let tug=circular(tugAltitude),target=circular(targetAltitude,phase),time=0,index=0,impact=null;
  const queue=burns.filter(b=>Number.isFinite(b.time)&&b.time>=0&&b.time<=duration).map((b,i)=>({...b,order:i})).sort((a,b)=>a.time-b.time||a.order-b.order);
  const rows=[];
  function execute(){while(index<queue.length&&queue[index].time<=time+1e-8){if(impact===null)tug=impulse(tug,queue[index].tangential,queue[index].radial);index++;}}
  function record(){rows.push({time,tug:[...tug],target:[...target],distance:Math.hypot(tug[0]-target[0],tug[1]-target[1]),relative:Math.hypot(tug[2]-target[2],tug[3]-target[3])*1000,impact:impact!==null});}
  execute();record();
  while(time<duration-1e-8){
    const next=Math.min(duration, (Math.floor((time+1e-6)/sample)+1)*sample, queue[index]?.time??Infinity);
    let remaining=next-time;
    while(remaining>1e-8){const dt=Math.min(5,remaining);target=rk4(target,dt);if(impact===null){tug=rk4(tug,dt);if(Math.hypot(tug[0],tug[1])<=EARTH)impact=time+dt;}time+=dt;remaining-=dt;}
    time=next;execute();record();
  }
  const closest=rows.filter(r=>!r.impact).reduce((a,b)=>b.distance<a.distance?b:a,rows[0]);
  return {rows,closest,impact,deltaV:queue.reduce((a,b)=>a+Math.hypot(b.tangential,b.radial),0)};
}
