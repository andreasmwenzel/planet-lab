import {EARTH,MU,TAU,circularState,apsisState,hohmann,elements,propagate,burn,radius,relativeSpeed,distance,timeToApsis,clamp} from './physics.js';
const A=Math.PI/3,LOW=EARTH+400,HIGH=EARTH+1200;
const lowHigh=hohmann(LOW,HIGH), relay=hohmann(LOW,EARTH+1600);
const highApo=EARTH+10000,highPeri=EARTH+500;
const haul1=Math.sqrt(MU*(2/LOW-2/(LOW+highApo)))-Math.sqrt(MU/LOW);
const haul2=Math.sqrt(MU*(2/highApo-2/(highPeri+highApo)))-Math.sqrt(MU*(2/highApo-2/(LOW+highApo)));
const returnDv=(Math.sqrt(MU*(2/LOW-2/(LOW+EARTH+18000)))-Math.sqrt(MU/LOW))*1000;
const escapeDv=(Math.sqrt(2*MU/LOW+.8)-Math.sqrt(MU/LOW))*1000;
export const MISSIONS=[
  {id:'first',number:'01',name:'A little higher',tag:'FLIGHT SCHOOL',cargo:'A box of firsts',kind:'apogee',start:()=>circularState(LOW,A),targetPeri:400,targetApo:1200,tolPeri:55,tolApo:35,budget:280,parDv:lowHigh.dv1,parTime:600,limit:7200,
    brief:'Give a new courier its wings. Lift the far side of your orbit to the delivery ring.',lesson:'A burn changes the opposite side of an orbit.',tip:'Add tangential speed now. Watch the dashed preview stretch outward; your current position becomes the low point.',dispatch:'“First parcel. No rush. Make one clean burn and we’ll stamp your license.”',goalLabel:'Certify orbit'},
  {id:'circular',number:'02',name:'The high road',tag:'TWO BURNS',cargo:'Greenhouse seeds',kind:'orbit',start:()=>circularState(LOW,A),targetPeri:1200,targetApo:1200,tolPeri:35,tolApo:35,budget:480,parDv:lowHigh.total,parTime:lowHigh.time+600,limit:14400,
    brief:'The greenhouse needs a stable 1,200 km orbit. Reach the ring, then stay there.',lesson:'A second burn at apoapsis lifts the low point.',tip:'First raise apoapsis to 1,200 km. Coast to the high point, then burn forward again to circularize.',dispatch:'“Seeds don’t mind the trip. The gardener does mind an eccentric delivery.”',goalLabel:'Deliver cargo'},
  {id:'long',number:'03',name:'The long arc',tag:'ELLIPTICAL ROUTE',cargo:'A listening buoy',kind:'orbit',start:()=>circularState(LOW,A),targetPeri:500,targetApo:10000,tolPeri:45,tolApo:120,budget:1700,parDv:(haul1+haul2)*1000,parTime:Math.PI*Math.sqrt(((LOW+highApo)/2)**3/MU)+600,limit:25200,
    brief:'Place a listening buoy on a long, quiet arc: 500 km at its closest, 10,000 km at its farthest.',lesson:'Periapsis and apoapsis can be tuned separately.',tip:'Lift the far point to 10,000 km first. At apoapsis, a much smaller forward burn raises periapsis to 500 km.',dispatch:'“The buoy listens best when the world is small. Leave it a long way home.”',goalLabel:'Deploy buoy'},
  {id:'relay',number:'04',name:'Meet me halfway',tag:'RENDEZVOUS',cargo:'Station espresso',kind:'rendezvous',start:()=>circularState(LOW,A),targetStart:()=>circularState(EARTH+1600,A+relay.phase),targetPeri:1600,targetApo:1600,budget:680,parDv:relay.total,parTime:relay.time+600,limit:21600,
    brief:'Deliver to Relay Nine. Be within 50 km and match its velocity to within 60 m/s.',lesson:'Rendezvous means the same place AND velocity.',tip:'Your departure window is open now. Raise apoapsis to 1,600 km. At arrival, match the station’s circular speed.',dispatch:'“We can see you on radar. The coffee is more urgent than the paperwork.”',goalLabel:'Dock & deliver'},
  {id:'home',number:'05',name:'The way home',tag:'RETROGRADE',cargo:'Returned research',kind:'orbit',start:()=>apsisState(LOW,EARTH+18000,A,true),targetPeri:400,targetApo:400,tolPeri:30,tolApo:30,budget:2200,parDv:returnDv,parTime:Math.PI*Math.sqrt(((LOW+EARTH+18000)/2)**3/MU)+600,limit:32400,
    brief:'Bring a research capsule back to a circular 400 km parking orbit. You begin at the top of a long ellipse.',lesson:'A retrograde burn at periapsis lowers apoapsis.',tip:'Coast to periapsis before slowing down. A retrograde burn at the high point would lower your low point into Earth.',dispatch:'“Good data aboard. Please return it to orbit, rather than through the atmosphere.”',goalLabel:'Park capsule'},
  {id:'escape',number:'06',name:'Beyond the blue',tag:'ESCAPE TRAJECTORY',cargo:'A message in a bottle',kind:'escape',start:()=>circularState(LOW,A),targetPeri:400,targetApo:12000,budget:3500,parDv:escapeDv,parTime:7200,limit:21600,
    brief:'Send our final parcel outward. Cross 12,000 km altitude on an escape path with C₃ between 0.5 and 1.5 km²/s².',lesson:'Positive orbital energy means no return.',tip:'One strong tangential burn can make an open trajectory. Tune C₃ in the preview, then coast outward past 12,000 km.',dispatch:'“No address on this one. Just a note for whoever comes next.”',goalLabel:'Release message'}
];
export function generatedMission(seed) {
  let x=(Number(seed)>>>0)||1;const rand=()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};
  const startAlt=350+Math.round(rand()*7)*50,target=1100+Math.round(rand()*34)*100,angle=rand()*TAU;
  const h=hohmann(EARTH+startAlt,EARTH+target);
  return {id:'dispatch-'+seed,number:'∞',name:'Route '+String(seed).padStart(4,'0'),tag:'OPEN DISPATCH',cargo:['Spare solar cells','Lunar postcards','A tiny library','Orbital tomatoes'][Math.floor(rand()*4)],kind:'orbit',start:()=>circularState(EARTH+startAlt,angle),targetPeri:target,targetApo:target,tolPeri:35,tolApo:35,budget:Math.ceil(h.total*1.2/10)*10,parDv:h.total,parTime:h.time+600,limit:21600,
    brief:`A fresh route: move from ${startAlt.toLocaleString()} km to a circular ${target.toLocaleString()} km orbit. Budget is 20% above an ideal two-burn transfer.`,lesson:'Every orbit is a new route.',tip:'Raise the far side, coast, then circularize. Try for all three dispatch seals.',dispatch:'“A fresh manifest. You know what to do.”',goalLabel:'Deliver cargo',seed};
}
export function sandboxMission(altitude=400) {return {id:'sandbox',number:'∞',name:'Free flight',tag:'SANDBOX',cargo:'Your curiosity',kind:'sandbox',start:()=>circularState(EARTH+altitude,A),targetPeri:altitude,targetApo:altitude,budget:Infinity,limit:Infinity,brief:'An open flight computer, an Earth, and as much delta-v as you need. Try an ellipse, a radial burn, or an escape.',lesson:'Experiment. Rewind. Try again.',tip:'No fuel limit or clock. The 100 km atmospheric safety boundary still applies.',dispatch:'“The flight computer is yours.”',goalLabel:'Free flight'};}
export function createFlight(mission) {return {ship:mission.start(),time:0,used:0,burns:0,status:'active',reason:'',target:mission.targetStart?mission.targetStart():null,log:[{type:'launch',time:0,text:mission.cargo+' loaded. Flight computer ready.'}],rewinds:0};}
export function objectives(f,m) {
  const e=elements(f.ship),peri=e.peri-EARTH,apo=e.apo-EARTH;
  const o=[];
  if(m.kind==='apogee') {
    o.push({label:`Apoapsis ${m.targetApo.toLocaleString()} ± ${m.tolApo} km`,value:apo,unit:'km',ok:Math.abs(apo-m.targetApo)<=m.tolApo});
    o.push({label:'Keep periapsis above 350 km',value:peri,unit:'km',ok:peri>=350});
  } else if(m.kind==='orbit') {
    o.push({label:`Periapsis ${m.targetPeri.toLocaleString()} ± ${m.tolPeri} km`,value:peri,unit:'km',ok:Math.abs(peri-m.targetPeri)<=m.tolPeri});
    o.push({label:`Apoapsis ${m.targetApo.toLocaleString()} ± ${m.tolApo} km`,value:apo,unit:'km',ok:Math.abs(apo-m.targetApo)<=m.tolApo});
  } else if(m.kind==='rendezvous') {
    o.push({label:'Within 50 km of Relay Nine',value:distance(f.ship,f.target),unit:'km',ok:distance(f.ship,f.target)<=50});
    o.push({label:'Relative speed below 60 m/s',value:relativeSpeed(f.ship,f.target)*1000,unit:'m/s',ok:relativeSpeed(f.ship,f.target)*1000<=60});
  } else if(m.kind==='escape') {
    o.push({label:'Outward, above 12,000 km',value:radius(f.ship)-EARTH,unit:'km',ok:radius(f.ship)-EARTH>=12000&&e.radial>0});
    o.push({label:'C₃ between 0.5 and 1.5 km²/s²',value:e.c3,unit:'km²/s²',ok:e.c3>=.5&&e.c3<=1.5});
  }
  return o;
}
export const isReady=(f,m)=>m.kind!=='sandbox'&&f.status==='active'&&objectives(f,m).every(o=>o.ok);
export function coast(f,m,dt,{stopAtGoal=true}={}) {
  if(f.status!=='active'||!Number.isFinite(dt)||dt<0) return f;
  let ship={...f.ship},target=f.target?{...f.target}:null,time=f.time,reason='',status='active';
  const end=Math.min(f.time+dt,Number.isFinite(m.limit)?m.limit:1e9);
  while(time<end-1e-8) {
    const step=Math.min(20,end-time),before=elements(ship);
    const next=propagate(ship,step),after=elements(next);
    if(radius(next)<EARTH+100 || (before.radial<0&&after.radial>=0&&before.peri<EARTH+100)) {
      ship=next;time+=step;if(target)target=propagate(target,step);status='failed';reason='Atmospheric entry. The courier crossed the 100 km safety boundary.';break;
    }
    ship=next;time+=step;if(target)target=propagate(target,step);
    if(stopAtGoal && !isReady(f,m) && isReady({...f,ship,target,time},m)) break;
  }
  if(status==='active'&&time>=m.limit-1e-7&&!isReady({...f,ship,target,time},m)){status='failed';reason='The delivery window closed. Rewind a burn or try the route again.';}
  return {...f,ship,target,time,status,reason};
}
export function execute(f,m,delay,tangential,radial) {
  if(f.status!=='active')return {flight:f,error:'This flight is already closed.'};
  if(![delay,tangential,radial].every(Number.isFinite)||delay<0||delay>86400||Math.abs(tangential)>12000||Math.abs(radial)>12000)return {flight:f,error:'Enter finite maneuver values within the control limits.'};
  const cost=Math.hypot(tangential,radial);
  if(cost<.05)return {flight:f,error:'Add a little delta-v before firing.'};
  if(cost>m.budget-f.used+1e-6)return {flight:f,error:'This burn exceeds your remaining delta-v.'};
  const before=coast(f,m,delay,{stopAtGoal:false});
  if(before.status!=='active')return {flight:before,error:null};
  const ship=burn(before.ship,tangential,radial),e=elements(ship);
  const result={...before,ship,used:f.used+cost,burns:f.burns+1,log:[...f.log,{type:'burn',time:before.time,text:`Burn ${f.burns+1}: T ${tangential>=0?'+':''}${tangential.toFixed(1)} · R ${radial>=0?'+':''}${radial.toFixed(1)} m/s`,dv:cost,peri:e.peri-EARTH,apo:e.apo-EARTH}]};
  return {flight:result,error:null};
}
export function complete(f,m) {
  if(!isReady(f,m))return f;
  return {...f,status:'complete',seals:[true,f.used<=m.parDv*1.08+1,f.time<=m.parTime],log:[...f.log,{type:'success',time:f.time,text:m.cargo+' delivered. Dispatch confirmed.'}]};
}
export function advisor(f,m) {
  const e=elements(f.ship), r=e.r, atPeri=Math.abs(r-e.peri)<2&&Math.abs(e.radial)<.01,atApo=e.bound&&Math.abs(r-e.apo)<2&&Math.abs(e.radial)<.01;
  if(m.kind==='sandbox')return {title:'Your own flight plan',text:'Try adding +200 m/s tangentially. Then coast to apoapsis and circularize. Or try a radial impulse and watch the line of apsides turn.',t:200,r:0,delay:0,label:'Try +200 m/s'};
  if(isReady(f,m))return {title:'Delivery conditions met',text:'Your flight satisfies every contract condition. Confirm delivery to receive your dispatch seals.'};
  if(m.kind==='escape') {
    if(e.c3>=.5&&e.c3<=1.5)return {title:'Let gravity do the rest',text:'Your escape energy is in range. Coast outward beyond 12,000 km altitude, then release the message.',coast:Math.min(3600,m.limit-f.time),label:'Coast outward'};
    const v=Math.sqrt(2*MU/r+.8),dv=(Math.sqrt(Math.max(0,v*v-e.radial*e.radial))-e.tangential)*1000;
    return {title:'Open the orbit',text:'Aim for C₃ ≈ 0.8 km²/s². Positive C₃ means a hyperbolic trajectory; more speed is not always a better delivery.',t:dv,r:0,delay:0,label:'Plan escape burn'};
  }
  if(m.kind==='apogee') {
    const aim=EARTH+m.targetApo,a=(r+aim)/2,dv=(Math.sqrt(MU*(2/r-1/a))-e.tangential)*1000;
    return {title:'Raise the far side',text:`A tangential burn of about ${dv.toFixed(1)} m/s here raises the opposite side to ${m.targetApo.toLocaleString()} km. The dashed gold orbit is your prediction.`,t:dv,r:-e.radial*1000,delay:0,label:'Plan this burn'};
  }
  if(m.id==='home') {
    const delay=atPeri?0:timeToApsis(f.ship,'peri');
    const node=Number.isFinite(delay)?propagate(f.ship,delay):f.ship,ne=elements(node);
    return {title:'Brake at the low point',text:'At periapsis, subtract tangential speed until you reach circular speed. This lowers the far side without lowering the point beneath you.',delay,t:(Math.sqrt(MU/ne.r)-ne.tangential)*1000,r:-ne.radial*1000,label:'Plan periapsis brake'};
  }
  const ap=EARTH+m.targetApo,pe=EARTH+m.targetPeri;
  if(Math.abs(e.apo-ap)<Math.max(150,m.tolApo||70)&&e.peri<pe-10) {
    const delay=atApo?0:timeToApsis(f.ship,'apo'),node=Number.isFinite(delay)?propagate(f.ship,delay):f.ship,ne=elements(node);
    const goalV=Math.sqrt(MU*(2/ne.r-2/(ne.r+pe)));
    return {title:m.kind==='rendezvous'?'Match the relay’s speed':'Lift the low point',text:m.kind==='rendezvous'?'At the top of your transfer, burn forward to match the circular station velocity. Check both separation and relative speed before docking.':'Coast to apoapsis and burn forward. Because the high point stays put, this raises only periapsis.',delay,t:(goalV-ne.tangential)*1000,r:-ne.radial*1000,label:'Plan arrival burn'};
  }
  if(e.e<.02||atPeri) {
    const goalV=Math.sqrt(MU*(2/r-2/(r+ap)));
    return {title:m.kind==='rendezvous'?'Catch the departure window':'Start a transfer ellipse',text:m.kind==='rendezvous'?'The station is phased for a departure at launch. Plan the transfer now. If you have coasted far past the window, restart for a clean rendezvous.':`Raise apoapsis to ${m.targetApo.toLocaleString()} km. You will need another burn there to place the low point.`,delay:0,t:(goalV-e.tangential)*1000,r:-e.radial*1000,label:'Plan transfer burn'};
  }
  return {title:'Inspect the shape',text:'An efficient transfer uses burns at apsides. Compare your current periapsis and apoapsis with the contract. You can rewind the last burn to restore its departure window.',delay:timeToApsis(f.ship,'peri'),t:0,r:0,label:'Move node to periapsis'};
}
