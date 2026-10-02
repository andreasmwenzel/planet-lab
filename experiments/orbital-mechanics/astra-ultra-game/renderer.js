import {EARTH,TAU,elements,radius,sampleOrbit,localFrame,apsisState,clamp,distance} from './physics.js';
const COLORS={current:'#83d7e2',plan:'#f6b65c',target:'#b5a9dd'};
const fmt=n=>Math.round(n).toLocaleString('en-US');
export class OrbitalMap {
  constructor(canvas,onDrag) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onDrag=onDrag;this.zoom=1;this.grid=true;this.extent=10000;this.dpr=1;this.w=0;this.h=0;this.dragging=false;this.handle=null;this.flareUntil=0;this.confetti=[];
    let s=51;const rand=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
    this.stars=Array.from({length:145},()=>({x:rand(),y:rand(),r:rand()*.8+.25,a:rand()*.37+.13}));
    this.resizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>this.resize()):null;
    this.resizeObserver?.observe(canvas);window.addEventListener('resize',()=>this.resize());this.resize();
    canvas.addEventListener('wheel',ev=>{ev.preventDefault();this.zoom=clamp(this.zoom*Math.exp(-ev.deltaY*.001),.35,5);},{passive:false});
    canvas.addEventListener('pointerdown',ev=>{if(!this.handle||!this.editable)return;const p=this.point(ev);if(Math.hypot(p.x-this.handle.x,p.y-this.handle.y)>26)return;this.dragging=true;canvas.setPointerCapture(ev.pointerId);this.move(ev);});
    canvas.addEventListener('pointermove',ev=>{if(this.dragging)this.move(ev);else if(this.handle){const p=this.point(ev);canvas.style.cursor=this.editable&&Math.hypot(p.x-this.handle.x,p.y-this.handle.y)<26?'grab':'default';}});
    const end=()=>{this.dragging=false;canvas.style.cursor='default';};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  }
  point(ev){const r=this.canvas.getBoundingClientRect();return {x:ev.clientX-r.left,y:ev.clientY-r.top};}
  move(ev){const p=this.point(ev),dx=(p.x-this.nodePixel.x)/this.impulseScale,dy=-(p.y-this.nodePixel.y)/this.impulseScale;const f=this.nodeFrame;this.onDrag(clamp(dx*f.tx+dy*f.ty,-12000,12000),clamp(dx*f.rx+dy*f.ry,-12000,12000));}
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;this.dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);}
  fit(f,m,plan=null){const e=elements(f.ship),p=plan?elements(plan.after):null;this.extent=Math.max(EARTH+700,e.bound?e.apo:Math.max(18000,e.r*1.12),EARTH+(m.targetApo||400),p?(p.bound?Math.min(p.apo,70000):Math.max(20000,p.r*1.1)):0)*1.14;this.extent=Math.min(this.extent,150000);this.zoom=1;}
  toScreen(p){return {x:this.cx+p.x*this.scale,y:this.cy-p.y*this.scale};}
  path(points,color,width=1,dash=[]){const c=this.ctx;c.beginPath();let open=false;for(const p of points){if(!p){open=false;continue;}const q=this.toScreen(p);if(!open){c.moveTo(q.x,q.y);open=true;}else c.lineTo(q.x,q.y);}c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);}
  circle(r,color,width=1,dash=[]){const c=this.ctx;c.beginPath();c.arc(this.cx,this.cy,Math.abs(r*this.scale),0,TAU);c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);}
  label(text,x,y,color='#8da6b8',align='left',size=9){const c=this.ctx;c.font=`${size}px ui-monospace,Consolas,monospace`;c.textAlign=align;const w=c.measureText(text).width;x=clamp(x,align==='right'?w+8:8,align==='right'?this.w-8:this.w-w-8);y=clamp(y,16,this.h-87);c.fillStyle='#0a1520db';c.fillRect(align==='right'?x-w-4:x-4,y-size-3,w+8,size+7);c.fillStyle=color;c.fillText(text,x,y);}
  dot(p,color,r=3){const q=this.toScreen(p),c=this.ctx;c.beginPath();c.arc(q.x,q.y,r,0,TAU);c.fillStyle=color;c.fill();return q;}
  earth(){const c=this.ctx,r=EARTH*this.scale;if(r<1)return;
    const glow=c.createRadialGradient(this.cx,this.cy,r*.94,this.cx,this.cy,r*1.11);glow.addColorStop(0,'#518dc900');glow.addColorStop(.38,'#6ec7f527');glow.addColorStop(1,'#287dc600');c.fillStyle=glow;c.beginPath();c.arc(this.cx,this.cy,r*1.11,0,TAU);c.fill();
    c.save();c.beginPath();c.arc(this.cx,this.cy,r,0,TAU);c.clip();
    const ocean=c.createRadialGradient(this.cx-r*.48,this.cy-r*.48,r*.04,this.cx+r*.12,this.cy+r*.2,r*1.28);ocean.addColorStop(0,'#2f6682');ocean.addColorStop(.36,'#24516c');ocean.addColorStop(.69,'#16374e');ocean.addColorStop(1,'#091723');c.fillStyle=ocean;c.fillRect(this.cx-r,this.cy-r,r*2,r*2);
    const continents=[[-.99,-.38,-.8,-.62,-.57,-.78,-.29,-.82,-.13,-.65,-.21,-.51,-.1,-.33,-.29,-.23,-.26,-.06,-.4,.03,-.47,-.12,-.6,-.15,-.69,-.37,-.9,-.3],[-.41,.01,-.22,.09,-.1,.28,-.2,.5,-.2,.66,-.35,.89,-.43,.67,-.44,.45,-.57,.17],[-.02,-.52,.15,-.69,.25,-.63,.47,-.72,.72,-.54,.97,-.46,1,-.22,.73,-.12,.57,-.02,.48,-.19,.34,-.07,.31,.08,.19,.22,.03,.11,-.08,-.12,.04,-.29,-.13,-.35],[.03,.17,.22,.12,.39,.21,.4,.39,.27,.6,.12,.75,-.02,.54,-.11,.31],[.66,.43,.8,.38,.97,.54,.96,.73,.76,.78,.6,.62],[-.49,-.92,-.28,-1,-.13,-.88,-.26,-.77]];
    for(const poly of continents){c.beginPath();poly.forEach((v,i)=>{if(i%2)return;const x=this.cx+v*r,y=this.cy+poly[i+1]*r;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.closePath();c.fillStyle='#68a3a228';c.fill();c.strokeStyle='#91c8bd20';c.lineWidth=.7;c.stroke();}
    c.strokeStyle='#b1ddef0e';c.lineWidth=.7;for(let i=-2;i<=2;i++){c.beginPath();c.ellipse(this.cx,this.cy+i*r*.31,r*Math.sqrt(Math.max(0,1-(i*.31)**2)),r*.07,0,0,TAU);c.stroke();}for(let i=-2;i<=2;i++){c.beginPath();c.ellipse(this.cx+i*r*.17,this.cy,r*(.15+Math.abs(i)*.2),r,0,0,TAU);c.stroke();}
    const shadow=c.createLinearGradient(this.cx-r*.8,this.cy-r*.5,this.cx+r*.85,this.cy+r*.2);shadow.addColorStop(0,'#04101a00');shadow.addColorStop(.48,'#04101a19');shadow.addColorStop(.73,'#040c1790');shadow.addColorStop(1,'#030912e8');c.fillStyle=shadow;c.fillRect(this.cx-r,this.cy-r,r*2,r*2);
    c.restore();this.circle(EARTH,'#78b8d647',1);this.circle(EARTH+100,'#bd6e5929',1,[2,5]);
    if(r>40){c.fillStyle='#98b9cd65';c.font='9px ui-monospace,Consolas,monospace';c.textAlign='center';c.fillText('E A R T H',this.cx-r*.07,this.cy+r*.13);c.font='7px ui-monospace,Consolas,monospace';c.fillStyle='#8eafc34f';c.fillText('6,371 KM',this.cx-r*.07,this.cy+r*.13+14);}
  }
  ship(s,now,ghost=false){const c=this.ctx,p=this.toScreen(s),angle=Math.atan2(-s.vy,s.vx);c.save();c.translate(p.x,p.y);c.rotate(angle);if(!ghost&&now<this.flareUntil){c.beginPath();c.moveTo(-7,-3);c.lineTo(-17-Math.sin(now*.07)*5,0);c.lineTo(-7,3);c.fillStyle='#ffb54a';c.fill();c.beginPath();c.moveTo(-7,-1.4);c.lineTo(-14,0);c.lineTo(-7,1.4);c.fillStyle='#ffeed1';c.fill();}c.beginPath();c.moveTo(9,0);c.lineTo(-6,-5);c.lineTo(-3,0);c.lineTo(-6,5);c.closePath();c.fillStyle=ghost?'#f6b65c44':'#f4ebd6';c.strokeStyle=ghost?COLORS.plan:'#fff4dc';c.lineWidth=1;c.fill();c.stroke();c.restore();return p;}
  draw(f,m,plan,now,paused){if(!this.ctx||!this.w||!this.h)return;const c=this.ctx,w=this.w,h=this.h;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);this.cx=w*.5;this.cy=(h-77)*.54+15;this.scale=Math.min(w*.43,(h-125)*.46)/this.extent*this.zoom;
    c.fillStyle='#09131d';c.fillRect(0,0,w,h);const fog=c.createRadialGradient(w*.44,h*.47,0,w*.44,h*.47,w*.6);fog.addColorStop(0,'#21354c44');fog.addColorStop(1,'#0a142000');c.fillStyle=fog;c.fillRect(0,0,w,h);
    for(const s of this.stars){c.globalAlpha=s.a;c.fillStyle='#b8d0e0';c.beginPath();c.arc(s.x*w,s.y*(h-80),s.r,0,TAU);c.fill();}c.globalAlpha=1;
    if(this.grid){const step=this.extent<16000?2000:this.extent<40000?5000:10000;for(let r=step;r*this.scale<Math.max(w,h);r+=step){if(r<EARTH)continue;this.circle(r,'#28425548',.65,[1,5]);}for(let a=0;a<TAU;a+=Math.PI/6){const r=Math.max(w,h)*1.5;c.beginPath();c.moveTo(this.cx,this.cy);c.lineTo(this.cx+Math.cos(a)*r,this.cy+Math.sin(a)*r);c.strokeStyle='#28425524';c.lineWidth=.65;c.stroke();}c.beginPath();c.moveTo(this.cx-5,this.cy);c.lineTo(this.cx+5,this.cy);c.moveTo(this.cx,this.cy-5);c.lineTo(this.cx,this.cy+5);c.strokeStyle='#416073';c.stroke();}
    if(m.kind!=='sandbox'){
      if(m.kind==='orbit'&&m.targetApo!==m.targetPeri){const startEl=elements(m.start()),omega=elements(m.start()).e>.001?startEl.omega:Math.atan2(m.start().y,m.start().x);this.path(sampleOrbit(apsisState(EARTH+m.targetPeri,EARTH+m.targetApo,omega)),COLORS.target+'7c',1.5,[2,7]);}
      else this.circle(EARTH+m.targetApo,COLORS.target+'80',1.4,[2,7]);
    }
    this.path(sampleOrbit(f.ship),COLORS.current+'b9',1.2);
    if(plan&&plan.cost>.05)this.path(sampleOrbit(plan.after),COLORS.plan+'b9',1.4,[6,6]);
    this.earth();const e=elements(f.ship);
    if(e.e>.003){const peri={x:e.peri*Math.cos(e.omega),y:e.peri*Math.sin(e.omega)},p=this.dot(peri,COLORS.current,2.5);this.label('Pe '+fmt(e.peri-EARTH)+' km',p.x+10,p.y+15,COLORS.current+'c9',p.x>w*.7?'right':'left',8);if(e.bound){const ap={x:-e.apo*Math.cos(e.omega),y:-e.apo*Math.sin(e.omega)},a=this.dot(ap,COLORS.current,2.5);this.label('Ap '+fmt(e.apo-EARTH)+' km',a.x+10,a.y-9,COLORS.current+'c9',a.x>w*.7?'right':'left',8);}}
    if(m.kind!=='sandbox'){const r=(EARTH+m.targetApo)*this.scale;if(r<w*.8&&r<h*.7){this.label(m.kind==='escape'?'RELEASE ALTITUDE':'DESTINATION  '+fmt(m.targetApo)+' km',this.cx+r*.92+8,this.cy-r*.38,COLORS.target+'b0',this.cx+r*.92>w*.72?'right':'left',8);}}
    if(f.target){const p=this.toScreen(f.target);c.save();c.translate(p.x,p.y);c.strokeStyle=COLORS.target;c.fillStyle='#172338';c.lineWidth=1.3;c.fillRect(-4,-4,8,8);c.strokeRect(-4,-4,8,8);c.fillStyle='#7e73aa';c.fillRect(-14,-6,7,12);c.fillRect(7,-6,7,12);c.beginPath();c.moveTo(-14,0);c.lineTo(14,0);c.stroke();c.restore();this.label('RELAY NINE',p.x+19,p.y-12,COLORS.target,'left',8);if(distance(f.ship,f.target)<1500){const sh=this.toScreen(f.ship);c.beginPath();c.moveTo(sh.x,sh.y);c.lineTo(p.x,p.y);c.setLineDash([2,3]);c.strokeStyle='#b5a9dd88';c.stroke();c.setLineDash([]);}}
    if(plan&&plan.closest&&plan.closest.distance<2000&&plan.cost>.05){const p=this.dot(plan.closest.ship,COLORS.plan,2),q=this.dot(plan.closest.target,COLORS.target,2);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.strokeStyle='#eec57577';c.lineWidth=1;c.setLineDash([2,4]);c.stroke();c.setLineDash([]);this.label('ENCOUNTER',p.x+8,p.y-14,'#d5b980','left',7);}
    const sh=this.ship(f.ship,now);this.label(f.status==='complete'?'DELIVERED':'COURIER',sh.x+13,sh.y+21,f.status==='complete'?'#a4dab4':'#f1dfc5','left',8);
    this.handle=null;this.editable=f.status==='active';
    if(plan&&this.editable){const node=plan.node,q=this.toScreen(node),fr=localFrame(node);this.nodeFrame=fr;this.nodePixel=q;const limit=Number.isFinite(m.budget)?Math.max(300,Math.min(m.budget,4000)):2000;this.impulseScale=100/limit;
      if(plan.delay>1){this.ship(node,now,true);c.beginPath();c.arc(q.x,q.y,10,0,TAU);c.strokeStyle='#f6b65c66';c.lineWidth=1;c.stroke();}
      let dx=(plan.t*fr.tx+plan.r*fr.rx)*this.impulseScale,dy=-(plan.t*fr.ty+plan.r*fr.ry)*this.impulseScale;
      if(plan.cost<.05){dx=fr.tx*48;dy=-fr.ty*48;}let len=Math.hypot(dx,dy);if(len>180){dx*=180/len;dy*=180/len;}
      const end={x:q.x+dx,y:q.y+dy};c.beginPath();c.moveTo(q.x,q.y);c.lineTo(end.x,end.y);c.strokeStyle=plan.cost>.05?'#f6b65ca6':'#f6b65c48';c.lineWidth=1.2;c.setLineDash(plan.cost>.05?[]:[3,4]);c.stroke();c.setLineDash([]);c.beginPath();c.arc(end.x,end.y,5,0,TAU);c.fillStyle='#19222b';c.fill();c.strokeStyle=COLORS.plan;c.lineWidth=1.3;c.stroke();c.beginPath();c.moveTo(end.x-2,end.y);c.lineTo(end.x+2,end.y);c.moveTo(end.x,end.y-2);c.lineTo(end.x,end.y+2);c.stroke();this.handle=end;
      if(paused&&f.burns===0)this.label('DRAG ΔV',end.x+9,end.y-8,'#c2a478','left',7);
    }
    if(this.confetti.length){this.confetti=this.confetti.filter(p=>now-p.start<2200);for(const p of this.confetti){const t=(now-p.start)/1000;c.globalAlpha=Math.max(0,1-t/2.2);c.fillStyle=p.color;c.fillRect(w*.5+p.vx*t,h*.35+p.vy*t+70*t*t,3,3);}c.globalAlpha=1;}
    const scaleElement=document.getElementById('mapScale'),scaleKm=this.extent<18000?2000:5000;if(scaleElement){scaleElement.textContent=fmt(scaleKm)+' km';scaleElement.style.width=Math.max(40,scaleKm*this.scale)+'px';}
  }
  flare(){this.flareUntil=performance.now()+1500;}
  celebrate(){const now=performance.now();this.confetti=Array.from({length:65},(_,i)=>({start:now,vx:Math.cos(i*2.399)*80*(1+i%4),vy:-80-Math.sin(i*1.6)*130,color:i%2?'#f6b65c':'#a4dab4'}));}
}
