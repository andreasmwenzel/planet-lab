import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const planets = [
  {name:'Mercury',type:'Terrestrial · 01',color:'#b4aaa0',radius:.30,orbit:3.5,period:.241,periodText:'88 days',distance:'0.39 AU',diameter:'4,879 km',description:'A small, cratered world that traces the swiftest path around our star.'},
  {name:'Venus',type:'Terrestrial · 02',color:'#d7bd8a',radius:.49,orbit:4.9,period:.615,periodText:'225 days',distance:'0.72 AU',diameter:'12,104 km',description:'Wrapped in dense clouds, our nearest planetary neighbor keeps its surface hidden.'},
  {name:'Earth',type:'Terrestrial · 03',color:'#719ca7',radius:.53,orbit:6.6,period:1,periodText:'365.25 days',distance:'1.00 AU',diameter:'12,742 km',description:'An ocean world with a thin veil of atmosphere. The only home we have known.'},
  {name:'Mars',type:'Terrestrial · 04',color:'#b7785d',radius:.38,orbit:8.2,period:1.881,periodText:'1.88 years',distance:'1.52 AU',diameter:'6,779 km',description:'Rust-colored deserts, quiet volcanoes, and the traces of an ancient, wetter world.'},
  {name:'Jupiter',type:'Gas giant · 05',color:'#c3aa8c',radius:1.04,orbit:11,period:11.86,periodText:'11.86 years',distance:'5.20 AU',diameter:'139,820 km',description:'The largest planet, a vast atmosphere of pale cloud bands and long-lived storms.'},
  {name:'Saturn',type:'Gas giant · 06',color:'#d2c198',radius:.86,orbit:14.3,period:29.46,periodText:'29.46 years',distance:'9.58 AU',diameter:'116,460 km',description:'A softly banded giant surrounded by an extraordinary collection of icy rings.'},
  {name:'Uranus',type:'Ice giant · 07',color:'#91bcbc',radius:.68,orbit:17.5,period:84.01,periodText:'84.01 years',distance:'19.2 AU',diameter:'50,724 km',description:'A muted blue-green world with an unusual tilt, rolling through its long seasons.'},
  {name:'Neptune',type:'Ice giant · 08',color:'#5c7a9f',radius:.65,orbit:20.5,period:164.8,periodText:'164.8 years',distance:'30.1 AU',diameter:'49,244 km',description:'At the edge of the planetary collection, a deep-blue world takes the longest way around.'},
];
const $ = id => document.getElementById(id);
const host = $('scene');
let selected=2, paused=matchMedia('(prefers-reduced-motion: reduce)').matches, speed=1, years=0;
let renderer, scene, camera, controls, focused=false, overhead=false, available=false;
let lastTime=0, pointerStart=null;
const meshes=[], orbitLines=[];
const selectedLabel=$('selected-label');
const initialAngles=[.5,2.8,4.8,1.4,3.7,.4,2.4,5.6];
const projected=new THREE.Vector3();
const lastTarget=new THREE.Vector3();
const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();

planets.forEach((planet,index)=>{
  const button=document.createElement('button');
  button.className='planet-choice';
  button.style.setProperty('--planet-color',planet.color);
  button.innerHTML=`<small>${String(index+1).padStart(2,'0')}</small><i aria-hidden="true"></i><span>${planet.name}</span>`;
  button.setAttribute('aria-pressed',String(index===selected));
  button.addEventListener('click',()=>selectPlanet(index));
  $('planet-list').append(button);
});
function selectPlanet(index){
  selected=index;
  const p=planets[index];
  $('planet-number').textContent=`${String(index+1).padStart(2,'0')} / 08`;
  $('planet-type').textContent=p.type;
  $('planet-name').textContent=p.name;
  $('planet-description').textContent=p.description;
  $('planet-period').textContent=p.periodText;
  $('planet-distance').textContent=p.distance;
  $('planet-diameter').textContent=p.diameter;
  $('planet-portrait').style.background=p.name==='Earth'?'radial-gradient(ellipse at 35% 30%,#a4b79c 0 15%,transparent 18%),radial-gradient(ellipse at 60% 70%,#718976 0 20%,transparent 24%),#719ca7':p.color;
  [...$('planet-list').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
  selectedLabel.querySelector('b').textContent=p.name;
  orbitLines.forEach((line,i)=>{line.material.opacity=i===index?.26:.10;line.material.color.set(i===index?'#cad7b9':'#829995');});
  if(focused && available) focusPlanet();
}
function updatePlayback(){
  $('play-icon').textContent=paused?'▶':'Ⅱ';
  $('play-text').textContent=paused?'Resume':'Pause';
  $('play-pause').setAttribute('aria-label',paused?'Resume simulation':'Pause simulation');
  $('motion-status').textContent=paused?'AT REST':'IN MOTION';
  $('status-dot').style.opacity=paused?'.35':'1';
}
$('play-pause').addEventListener('click',()=>{paused=!paused;updatePlayback();});
$('speed').addEventListener('input',event=>{speed=Number(event.target.value);$('speed-value').textContent=`${speed.toFixed(1)}×`;});
function setView(top=false){
  if(!available)return;
  overhead=top;focused=false;
  const narrow=host.clientWidth<500;
  camera.position.set(top?0:25,top?(narrow?65:48):(narrow?43:29),top?.01:(narrow?52:34));
  controls.target.set(0,0,0);controls.update();
  $('perspective').setAttribute('aria-pressed',String(!top));
  $('top-view').setAttribute('aria-pressed',String(top));
  $('focus-planet').innerHTML='Observe closer <span aria-hidden="true">↗</span>';
}
function focusPlanet(){
  if(!available)return;
  focused=true;
  const target=meshes[selected].position;
  const distance=planets[selected].radius*7+3;
  camera.position.copy(target).add(new THREE.Vector3(distance*.7,distance*.65,distance));
  controls.target.copy(target);lastTarget.copy(target);controls.update();
  $('focus-planet').innerHTML='Return to collection <span aria-hidden="true">↙</span>';
}
$('focus-planet').addEventListener('click',()=>focused?setView(overhead):focusPlanet());
$('overview').addEventListener('click',()=>setView(false));
$('perspective').addEventListener('click',()=>setView(false));
$('top-view').addEventListener('click',()=>setView(true));
function zoom(factor){if(!available)return;const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(factor);offset.clampLength(controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(offset);controls.update();}
$('zoom-in').addEventListener('click',()=>zoom(.8));
$('zoom-out').addEventListener('click',()=>zoom(1.25));
$('reset').addEventListener('click',()=>{years=0;speed=1;paused=matchMedia('(prefers-reduced-motion: reduce)').matches;$('speed').value='1';$('speed-value').textContent='1.0×';selectPlanet(2);updatePlayback();if(available){updatePositions();setView(false);}else{unavailable();}$('elapsed').textContent='000.00';});
host.addEventListener('keydown',event=>{
  if(!available)return;
  if(event.key==='+'||event.key==='='){event.preventDefault();zoom(.85);return;}
  if(event.key==='-'){event.preventDefault();zoom(1.18);return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();
  const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if(event.key==='ArrowLeft')spherical.theta-=.12;
  if(event.key==='ArrowRight')spherical.theta+=.12;
  if(event.key==='ArrowUp')spherical.phi-=.12;
  if(event.key==='ArrowDown')spherical.phi+=.12;
  spherical.phi=THREE.MathUtils.clamp(spherical.phi,.01,Math.PI/2-.02);
  camera.position.setFromSpherical(spherical).add(controls.target);controls.update();
});

// Procedural paint: deliberately illustrative, with no external imagery.
function planetTexture(p,index){
  const c=document.createElement('canvas');c.width=512;c.height=256;
  const ctx=c.getContext('2d');ctx.fillStyle=p.color;ctx.fillRect(0,0,512,256);
  const image=ctx.getImageData(0,0,512,256);
  // Work directly from the CSS palette to keep generated texture colors predictable.
  const color=p.color.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16));
  for(let y=0;y<256;y++)for(let x=0;x<512;x++){
    const u=x/512*Math.PI*2,v=y/256*Math.PI;
    let shade=.94+.035*Math.sin(x*.77+y*1.19)+.035*Math.sin(x*.13-y*.37);
    let current=color;
    if(index===2){
      const land=Math.sin(u*3+Math.sin(v*5)*1.4)+.55*Math.sin(u*7-v*4)+.3*Math.cos(u*13+v*8);
      if(land>.6&&y>28&&y<232)current=[112,133,108];
      if(y<15||y>240)current=[191,205,198];
      const cloud=Math.sin(u*5+v*10+Math.sin(u*3))+.5*Math.cos(u*11-v*8);
      if(cloud>1.1)current=current.map(n=>n*.55+230*.45);
    }else if(index===4||index===5){shade+=.11*Math.sin(v*32+.8*Math.sin(u*3))+.07*Math.sin(v*65);}
    else if(index===1){shade+=.06*Math.sin(v*18+Math.sin(u*2));}
    else if(index===0||index===3){shade+=.1*Math.sin(u*11+Math.sin(v*17))*.7*Math.cos(v*19);}
    const o=(y*512+x)*4;image.data[o]=current[0]*shade;image.data[o+1]=current[1]*shade;image.data[o+2]=current[2]*shade;image.data[o+3]=255;
  }
  ctx.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function updatePositions(){
  meshes.forEach((mesh,index)=>{const p=planets[index];const angle=initialAngles[index]+years*Math.PI*2/p.period;mesh.position.set(Math.cos(angle)*p.orbit,0,Math.sin(angle)*p.orbit);mesh.rotation.y=years*5/(index+1);});
}
function unavailable(){
  available=false;$('fallback').hidden=false;selectedLabel.style.display='none';
  $('motion-status').textContent='STATIC COLLECTION';$('status-dot').style.opacity='.35';
  ['focus-planet','overview','perspective','top-view','zoom-in','zoom-out','play-pause','speed'].forEach(id=>$(id).disabled=true);
  const canvas=host.querySelector('canvas');if(canvas)canvas.style.display='none';
}
function initialize(){
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  host.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(43,1,.1,400);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=false;controls.minDistance=2.5;controls.maxDistance=100;controls.maxPolarAngle=Math.PI/2-.01;controls.rotateSpeed=.6;controls.zoomSpeed=.7;
  scene.add(new THREE.AmbientLight(0xbfd5d4,1.8));
  const light=new THREE.PointLight(0xffe4b4,90,0,1.2);scene.add(light);
  const sun=new THREE.Mesh(new THREE.SphereGeometry(1.25,48,32),new THREE.MeshBasicMaterial({color:0xe4c889}));scene.add(sun);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;
  const gc=glowCanvas.getContext('2d');const gradient=gc.createRadialGradient(64,64,4,64,64,64);gradient.addColorStop(0,'rgba(244,210,135,.6)');gradient.addColorStop(.3,'rgba(224,186,110,.16)');gradient.addColorStop(1,'rgba(224,186,110,0)');gc.fillStyle=gradient;gc.fillRect(0,0,128,128);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.set(8,8,1);scene.add(glow);
  planets.forEach((p,index)=>{
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(p.radius,40,28),new THREE.MeshStandardMaterial({map:planetTexture(p,index),roughness:1,metalness:0}));
    mesh.userData.planetIndex=index;scene.add(mesh);meshes.push(mesh);
    const points=[];for(let i=0;i<=200;i++){const a=i/200*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*p.orbit,0,Math.sin(a)*p.orbit));}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x829995,transparent:true,opacity:.1}));scene.add(line);orbitLines.push(line);
    if(index===5){
      const ring=new THREE.Mesh(new THREE.RingGeometry(1.16,1.9,100),new THREE.MeshStandardMaterial({color:0xb4a88c,roughness:1,side:THREE.DoubleSide,transparent:true,opacity:.65}));ring.rotation.x=-Math.PI/2+.27;mesh.add(ring);
      const gap=new THREE.Mesh(new THREE.RingGeometry(1.54,1.61,100),new THREE.MeshBasicMaterial({color:0x172020,side:THREE.DoubleSide}));gap.rotation.copy(ring.rotation);gap.position.y=.004;mesh.add(gap);
    }
  });
  let seed=812;function random(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
  const stars=[];for(let i=0;i<440;i++){const theta=random()*Math.PI*2,phi=Math.acos(2*random()-1),r=100+random()*70;stars.push(r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta));}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xb7c5c3,size:.13,transparent:true,opacity:.45,sizeAttenuation:true})));
  available=true;updatePositions();setView(false);selectPlanet(selected);
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(host);resize();
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();unavailable();});
  host.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};});
  host.addEventListener('pointerup',event=>{
    if(!available||!pointerStart||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>6)return;
    pointerStart=null;const rect=host.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(meshes,false);if(hits.length)selectPlanet(hits[0].object.userData.planetIndex);
  });
  host.addEventListener('pointercancel',()=>{pointerStart=null;});
  requestAnimationFrame(frame);
}
function frame(time){
  if(!available)return;
  const delta=lastTime?Math.min((time-lastTime)/1000,.05):0;lastTime=time;
  if(!paused&&!document.hidden)years+=delta*speed/24;
  updatePositions();
  if(focused){const position=meshes[selected].position;camera.position.add(position.clone().sub(lastTarget));controls.target.copy(position);lastTarget.copy(position);}
  controls.update();renderer.render(scene,camera);
  const mesh=meshes[selected];projected.copy(mesh.position);projected.y+=planets[selected].radius+.12;projected.project(camera);
  const x=(projected.x*.5+.5)*host.clientWidth,y=(-projected.y*.5+.5)*host.clientHeight;
  const visible=projected.z<1&&projected.z>-1&&x>10&&x<host.clientWidth-75&&y>55&&y<host.clientHeight-70;
  selectedLabel.style.display=visible?'flex':'none';selectedLabel.style.transform=`translate(${x+8}px,${y}px)`;
  $('elapsed').textContent=years.toFixed(2).padStart(6,'0');requestAnimationFrame(frame);
}
selectPlanet(selected);updatePlayback();
try{initialize();}catch(error){console.warn('The 3D observatory could not start.',error);unavailable();}
