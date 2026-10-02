import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const worlds = [
  { name:'Mercury', type:'Terrestrial planet', tagline:'Small world. Big extremes.', color:'#b8aaa0', surface:'linear-gradient(135deg,#d0bdb0,#72685f)', radius:.23, orbit:3.4, pace:13, phase:2.4, diameter:'4,879 km', year:'88 Earth days', day:'58.6 Earth days', description:'The smallest planet keeps the Sun close. Its ancient, cratered surface holds a record of billions of years of impacts.', curiosity:'A sunrise-to-sunrise day here lasts about 176 Earth days, longer than two Mercury years.', kind:'rock', base:[140,128,117], tilt:.01 },
  { name:'Venus', type:'Terrestrial planet', tagline:'Beautiful from a distance.', color:'#e9c499', surface:'repeating-linear-gradient(13deg,#d8b17d 0 4px,#edcca1 7px,#b89065 12px)', radius:.41, orbit:5.1, pace:19, phase:4.2, diameter:'12,104 km', year:'225 Earth days', day:'243 Earth days', description:'Wrapped in thick clouds, Venus hides a rocky surface beneath a powerful greenhouse atmosphere. It is our hottest neighboring world.', curiosity:'Venus spins backward compared with most planets. From its surface, the Sun would rise in the west.', kind:'cloud', base:[202,163,109], tilt:3.09 },
  { name:'Earth', type:'Terrestrial planet', tagline:'Our blue home.', color:'#83c4ef', surface:'radial-gradient(ellipse at 35% 35%,#83ac7d 0 15%,transparent 16%),radial-gradient(ellipse at 58% 70%,#659a7c 0 19%,transparent 20%),linear-gradient(90deg,#7db7c3,#2672a7)', radius:.45, orbit:7, pace:27, phase:5.65, diameter:'12,742 km', year:'365.25 days', day:'23.9 hours', description:'An ocean world with a thin veil of air. Earth is the only place we know where liquid water and life flourish on the surface.', curiosity:'Sunlight takes about 8 minutes and 20 seconds to reach Earth. Every sunny moment is a little glimpse into the past.', kind:'earth', base:[33,110,154], tilt:.41 },
  { name:'Mars', type:'Terrestrial planet', tagline:'The next great horizon.', color:'#de9270', surface:'radial-gradient(ellipse at 37% 30%,#a85a3e 0 15%,transparent 16%),linear-gradient(40deg,#bd6949,#e3a079)', radius:.33, orbit:9, pace:36, phase:.75, diameter:'6,779 km', year:'687 Earth days', day:'24.6 hours', description:'Rust-colored dust gives Mars its familiar glow. Dry riverbeds, polar ice, and giant volcanoes tell the story of a changing world.', curiosity:'Olympus Mons is the tallest known volcano in the solar system, reaching roughly 22 kilometers above the surrounding plains.', kind:'rock', base:[170,86,56], tilt:.44 },
  { name:'Jupiter', type:'Gas giant', tagline:'A world of endless weather.', color:'#d3b89d', surface:'repeating-linear-gradient(5deg,#c99c7c 0 4px,#e4d5ba 5px 8px,#9d7362 10px 12px)', radius:.99, orbit:12.5, pace:58, phase:2.65, diameter:'139,820 km', year:'11.9 Earth years', day:'9.9 hours', description:'Jupiter is the giant of our neighborhood. Bands of clouds sweep around a deep atmosphere, with no solid surface to stand on.', curiosity:'The Great Red Spot is a vast storm that has been observed for centuries. Even today, it is wider than Earth.', kind:'gas', base:[181,145,112], tilt:.05 },
  { name:'Saturn', type:'Gas giant', tagline:'The art of having rings.', color:'#dac698', surface:'repeating-linear-gradient(8deg,#d4c095 0 4px,#e8d7b3 5px 8px,#bba783 10px)', radius:.85, orbit:16.5, pace:78, phase:5.0, diameter:'116,460 km', year:'29.4 Earth years', day:'About 10.7 hours', description:'Saturn wears a luminous disk of ice and rock. Its rings look solid from far away, but are made of countless separate pieces.', curiosity:'Saturn has a lower average density than water. The famous rings are extraordinarily thin compared with their enormous width.', kind:'gas', base:[195,176,132], tilt:.47 },
  { name:'Uranus', type:'Ice giant', tagline:'Taking a sideways approach.', color:'#95d6db', surface:'linear-gradient(120deg,#b5e5e5,#6fa9b9)', radius:.63, orbit:20.6, pace:105, phase:3.6, diameter:'50,724 km', year:'84 Earth years', day:'17.2 hours', description:'Pale blue-green and quietly strange, Uranus travels through the outer system with its axis tipped almost onto its side.', curiosity:'Its extreme tilt produces unusual seasons. Near the poles, daylight or darkness can last for decades.', kind:'ice', base:[105,176,187], tilt:1.71 },
  { name:'Neptune', type:'Ice giant', tagline:'Blue at the edge of daylight.', color:'#719fe9', surface:'linear-gradient(120deg,#81b2e9,#365eae)', radius:.61, orbit:24.8, pace:140, phase:.4, diameter:'49,244 km', year:'165 Earth years', day:'16.1 hours', description:'Cold and remote, Neptune is the outermost planet. Its methane-rich atmosphere appears blue, and fierce winds race through its clouds.', curiosity:'Neptune was first located with the help of mathematics. Its gravity was disturbing Uranus’s orbit, pointing observers toward an unseen planet.', kind:'ice', base:[55,101,175], tilt:.49 }
];
const speeds = [.25,.5,1,2,4,8,16];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let selected = 2;
let running = !reducedMotion;
let speed = 1;
let simulationTime = 0;
let renderReady = false;
let renderer, scene, camera, controls, orbitGroup, selectionRing;
let focused = false;
let transition = null;
let previousFollow = new THREE.Vector3();
let animationId = 0;
const meshes = [];
const worldPositions = worlds.map(() => new THREE.Vector3());
const labels = [];
const cards = [];
const announce = (text) => { $('announcement').textContent = text; };

worlds.forEach((world,index) => {
  const button = document.createElement('button');
  button.className = 'planet-card';
  button.type = 'button';
  button.setAttribute('aria-label', `Select ${world.name}`);
  button.innerHTML = `<span class="mini-planet ${world.name.toLowerCase()}" aria-hidden="true" style="--surface:${world.surface}"></span><span class="planet-card-name">${world.name}<span class="planet-card-index">${String(index+1).padStart(2,'0')} / ${index<4?'ROCKY':index<6?'GAS':'ICE'}</span></span>`;
  button.addEventListener('click', () => selectWorld(index));
  $('planet-list').append(button);
  cards.push(button);
  const label = document.createElement('button');
  label.className = 'world-label';
  label.type = 'button';
  label.style.setProperty('--world',world.color);
  label.textContent = world.name;
  label.setAttribute('aria-label', `Select ${world.name} in scene`);
  label.addEventListener('click', () => selectWorld(index));
  $('labels').append(label);
  labels.push(label);
});

function selectWorld(index,quiet=false) {
  selected = (index+worlds.length)%worlds.length;
  const world = worlds[selected];
  $('planet-name').textContent = world.name;
  $('planet-type').textContent = world.type.toUpperCase();
  $('planet-tagline').textContent = world.tagline;
  $('planet-description').textContent = world.description;
  $('planet-curiosity').textContent = world.curiosity;
  $('planet-number').textContent = `${String(selected+1).padStart(2,'0')} / 08`;
  $('fact-diameter').textContent = world.diameter;
  $('fact-year').textContent = world.year;
  $('fact-day').textContent = world.day;
  const portrait = $('planet-portrait');
  portrait.className = `planet-portrait ${world.name.toLowerCase()}`;
  portrait.style.setProperty('--surface',world.surface);
  $('focus-planet').innerHTML = `Meet ${world.name} <span aria-hidden="true">↗</span>`;
  cards.forEach((card,i) => card.setAttribute('aria-pressed',String(i===selected)));
  labels.forEach((label,i) => label.setAttribute('aria-pressed',String(i===selected)));
  if (focused && renderReady) focusWorld();
  if (!quiet) announce(`${world.name} selected. ${world.type}. ${world.tagline}`);
}
function updatePlayback() {
  $('play-pause').setAttribute('aria-label',running?'Pause simulation':'Resume simulation');
  $('play-icon').textContent = running?'Ⅱ':'▶';
  $('play-label').textContent = running?'Pause':'Play';
  $('running-label').textContent = !renderReady?'3D UNAVAILABLE':running?'IN MOTION':'PAUSED';
  $('live-dot').classList.toggle('paused',!running);
}
$('play-pause').addEventListener('click',()=>{running=!running;updatePlayback();announce(running?'Simulation resumed.':'Simulation paused.');});
$('speed').addEventListener('input',(event)=>{speed=speeds[Number(event.target.value)];$('speed-value').value=`${speed}×`;$('speed').setAttribute('aria-valuetext',`${speed} times speed`);});
$('previous-planet').addEventListener('click',()=>selectWorld(selected-1));
$('next-planet').addEventListener('click',()=>selectWorld(selected+1));
$('focus-planet').addEventListener('click',()=>{focusWorld();announce(`Following ${worlds[selected].name}. Drag or use the camera buttons to look around.`);});
$('overview').addEventListener('click',()=>{setOverview();announce('System overview.');});
$('show-orbits').addEventListener('change',(event)=>{if(orbitGroup)orbitGroup.visible=event.target.checked;});
$('show-labels').addEventListener('change',(event)=>{$('labels').hidden=!event.target.checked;});
$('reset').addEventListener('click',()=>{
  simulationTime=0;speed=1;running=!reducedMotion;focused=false;transition=null;
  $('speed').value='2';$('speed-value').value='1×';$('speed').setAttribute('aria-valuetext','1 times speed');
  $('show-orbits').checked=true;$('show-labels').checked=true;$('labels').hidden=!renderReady;
  if(orbitGroup)orbitGroup.visible=true;
  selectWorld(2,true);if(renderReady){updateWorlds(0);setOverview(true);}updatePlayback();
  $('elapsed').textContent='00:00';announce(`Journey reset. Earth selected.${reducedMotion?' Motion remains paused to respect your reduced-motion preference.':''}`);
});
document.addEventListener('keydown',(event)=>{
  if(event.code==='Space' && !event.target.closest('button,input,a,select,textarea') && renderReady){event.preventDefault();running=!running;updatePlayback();announce(running?'Simulation resumed.':'Simulation paused.');}
});
selectWorld(2,true);

function noise(x,y,z,seed=0) {
  return Math.sin(x*3.7+y*1.7+z*2.8+seed)*.45+Math.sin(x*7.9-y*5.3+z*4.1+seed*1.4)*.25+Math.sin(x*14.7+y*11.8-z*9.2+seed*2.1)*.16+Math.sin(x*30.1-y*20.4+z*16.3)*.08;
}
function makeSurface(world,index) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const context=canvas.getContext('2d');const pixels=context.createImageData(canvas.width,canvas.height);
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
    const longitude=x/canvas.width*Math.PI*2;const latitude=(y/canvas.height-.5)*Math.PI;
    const px=Math.cos(latitude)*Math.cos(longitude),py=Math.sin(latitude),pz=Math.cos(latitude)*Math.sin(longitude);
    const n=noise(px,py,pz,index*2.7);let color=world.base;let variation=1+n*.27;
    if(world.kind==='earth'){
      const terrain=noise(px*1.2,py*1.2,pz*1.2,4.8);
      if(Math.abs(py)>.96+n*.03)color=[219,233,234];
      else if(terrain>.15)color=terrain>.4?[150,147,95]:[69,119,89];
      else color=[27,91,142];
      const clouds=noise(px*2.3,py*2.3,pz*2.3,7.2);
      if(clouds>.43)color=color.map(c=>c*.38+235*.62);
      variation=1+n*.12;
    }else if(world.kind==='gas'){
      const band=Math.sin(py*47+n*2.8)*.1+Math.sin(py*19+n)*.13;
      variation=1+band+n*.08;
      if(world.name==='Jupiter'){
        let dx=Math.abs(longitude-1.35);dx=Math.min(dx,Math.PI*2-dx);
        const storm=(dx/.31)**2+((latitude+.24)/.105)**2;
        if(storm<1.1){color=[163,86,56];variation=.88+Math.sin(storm*19)*.08;}
      }
    }else if(world.kind==='cloud')variation=1+n*.08+Math.sin(py*18+n*3)*.08;
    else if(world.kind==='ice')variation=1+n*.035+Math.sin(py*22+n)*.025;
    else{const craters=Math.sin(n*40+px*35+pz*22);variation=.87+n*.26+(craters>.92?-.11:0);if(world.name==='Mars'&&Math.abs(py)>.96)color=[211,205,184];}
    const offset=(y*canvas.width+x)*4;
    pixels.data[offset]=Math.min(255,color[0]*variation);pixels.data[offset+1]=Math.min(255,color[1]*variation);pixels.data[offset+2]=Math.min(255,color[2]*variation);pixels.data[offset+3]=255;
  }
  context.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;
  return texture;
}
function glowTexture() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const context=canvas.getContext('2d');
  const gradient=context.createRadialGradient(128,128,2,128,128,128);gradient.addColorStop(0,'rgba(255,233,180,1)');gradient.addColorStop(.2,'rgba(255,188,87,.65)');gradient.addColorStop(.45,'rgba(242,123,44,.14)');gradient.addColorStop(1,'rgba(230,109,30,0)');context.fillStyle=gradient;context.fillRect(0,0,256,256);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function ringTexture() {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1;const context=canvas.getContext('2d');const data=context.createImageData(512,1);
  for(let i=0;i<512;i++){const f=i/512;const gap=f>.53&&f<.60;const wave=.75+.2*Math.sin(i*.35)+.06*Math.sin(i*2.1);data.data[i*4]=203*wave;data.data[i*4+1]=183*wave;data.data[i*4+2]=145*wave;data.data[i*4+3]=gap?15:(f<.13?100:210);}
  context.putImageData(data,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function createStars() {
  let seed=331;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const positions=[],colors=[];
  for(let i=0;i<1000;i++){
    const theta=random()*Math.PI*2,z=random()*2-1,r=95+random()*60;const s=Math.sqrt(1-z*z);
    positions.push(r*s*Math.cos(theta),r*z,r*s*Math.sin(theta));const brightness=.25+random()*.55;colors.push(brightness*.83,brightness*.89,brightness);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({size:.085,vertexColors:true,transparent:true,opacity:.8,sizeAttenuation:true,depthWrite:false})));
  const belt=[];for(let i=0;i<850;i++){const angle=random()*Math.PI*2,r=10.3+random()*.75;belt.push(Math.cos(angle)*r,(random()-.5)*.16,Math.sin(angle)*r);}
  const beltGeometry=new THREE.BufferGeometry();beltGeometry.setAttribute('position',new THREE.Float32BufferAttribute(belt,3));orbitGroup.add(new THREE.Points(beltGeometry,new THREE.PointsMaterial({color:0x98a4af,size:.028,transparent:true,opacity:.36,depthWrite:false})));
}
function createWorlds() {
  const sunGeometry=new THREE.SphereGeometry(1.25,48,32);
  const sunTexture=makeSurface({kind:'cloud',base:[245,187,87],name:'Sun'},12);
  const sun=new THREE.Mesh(sunGeometry,new THREE.MeshBasicMaterial({map:sunTexture,color:0xffdd99}));scene.add(sun);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.7}));glow.scale.set(9,9,1);scene.add(glow);
  scene.add(new THREE.AmbientLight(0xa7bbd5,1.1));const light=new THREE.PointLight(0xffecd3,55,0,1);scene.add(light);
  scene.add(new THREE.HemisphereLight(0x7596bb,0x11151c,.6));
  worlds.forEach((world,index)=>{
    const orbitPoints=[];for(let i=0;i<160;i++){const theta=i/160*Math.PI*2;orbitPoints.push(new THREE.Vector3(Math.cos(theta)*world.orbit,0,Math.sin(theta)*world.orbit));}
    orbitGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbitPoints),new THREE.LineBasicMaterial({color:0x547086,transparent:true,opacity:index===2?.32:.19})));
    const group=new THREE.Group();scene.add(group);
    const tilt=new THREE.Group();tilt.rotation.z=world.tilt;group.add(tilt);
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(world.radius,48,32),new THREE.MeshStandardMaterial({map:makeSurface(world,index),roughness:.91,metalness:0}));sphere.userData.world=index;tilt.add(sphere);
    if(world.name==='Earth'){
      const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(world.radius*1.055,32,24),new THREE.MeshBasicMaterial({color:0x79c8ff,transparent:true,opacity:.12,side:THREE.BackSide,depthWrite:false}));tilt.add(atmosphere);
      const moon=new THREE.Mesh(new THREE.SphereGeometry(.095,20,16),new THREE.MeshStandardMaterial({color:0xbbbbb3,roughness:1}));group.add(moon);sphere.userData.moon=moon;
    }
    if(world.name==='Saturn'){
      const inner=world.radius*1.32,outer=world.radius*2.2;const geometry=new THREE.RingGeometry(inner,outer,100,1);const position=geometry.attributes.position;const uv=geometry.attributes.uv;
      for(let i=0;i<position.count;i++){const r=Math.hypot(position.getX(i),position.getY(i));uv.setXY(i,(r-inner)/(outer-inner),.5);}uv.needsUpdate=true;
      const ring=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:ringTexture(),transparent:true,opacity:.83,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.userData.world=index;tilt.add(ring);
    }
    meshes.push({group,tilt,sphere});
  });
  selectionRing=new THREE.Mesh(new THREE.RingGeometry(1.32,1.35,80),new THREE.MeshBasicMaterial({color:0x9ad7fa,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}));scene.add(selectionRing);
  createStars();
}
function overviewPosition() {
  const distance=59*Math.max(1,.92/camera.aspect);
  return new THREE.Vector3().setFromSpherical(new THREE.Spherical(distance,.75,.20));
}
function setOverview(immediate=false) {
  if(!renderReady)return;
  focused=false;$('view-label').textContent='System overview';
  const position=overviewPosition();
  if(immediate||reducedMotion){transition=null;camera.position.copy(position);controls.target.set(0,0,0);controls.update();}
  else transition={start:performance.now(),position:camera.position.clone(),target:controls.target.clone(),destination:position,mode:'overview'};
}
function focusWorld() {
  if(!renderReady)return;
  focused=true;$('view-label').textContent=`Following ${worlds[selected].name}`;
  const distance=worlds[selected].radius*(worlds[selected].name==='Saturn'?8:6)+2.2;
  const offset=new THREE.Vector3(.7,.45,1).normalize().multiplyScalar(distance*Math.max(1,.8/camera.aspect));
  previousFollow.copy(worldPositions[selected]);
  if(reducedMotion){transition=null;controls.target.copy(previousFollow);camera.position.copy(previousFollow).add(offset);controls.update();}
  else transition={start:performance.now(),position:camera.position.clone(),target:controls.target.clone(),offset,mode:'focus'};
}
function cameraStep(theta=0,phi=0,zoom=1) {
  if(!renderReady)return;
  transition=null;
  const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
  spherical.theta+=theta;spherical.phi=THREE.MathUtils.clamp(spherical.phi+phi,.08,Math.PI-.08);spherical.radius=THREE.MathUtils.clamp(spherical.radius*zoom,controls.minDistance,controls.maxDistance);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();
}
$('rotate-left').addEventListener('click',()=>cameraStep(-.23));$('rotate-right').addEventListener('click',()=>cameraStep(.23));$('tilt-up').addEventListener('click',()=>cameraStep(0,-.15));$('tilt-down').addEventListener('click',()=>cameraStep(0,.15));$('zoom-in').addEventListener('click',()=>cameraStep(0,0,.78));$('zoom-out').addEventListener('click',()=>cameraStep(0,0,1.28));
function updateWorlds(time) {
  worlds.forEach((world,index)=>{
    const angle=world.phase+time/world.pace*Math.PI*2;
    worldPositions[index].set(Math.cos(angle)*world.orbit,0,Math.sin(angle)*world.orbit);
    const mesh=meshes[index];mesh.group.position.copy(worldPositions[index]);mesh.sphere.rotation.y=time*.15*(index===1||index===6?-1:1);
    if(mesh.sphere.userData.moon)mesh.sphere.userData.moon.position.set(Math.cos(time*.33)*.95,.03,Math.sin(time*.33)*.95);
  });
  selectionRing.position.copy(worldPositions[selected]);selectionRing.scale.setScalar(worlds[selected].radius);selectionRing.quaternion.copy(camera.quaternion);
}
function updateLabels() {
  const width=$('scene').clientWidth,height=$('scene').clientHeight;
  const projected=new THREE.Vector3();const placed=[];
  const order=[selected,...worlds.map((_,i)=>i).filter(i=>i!==selected)];
  for(const index of order){
    const label=labels[index];projected.copy(worldPositions[index]);projected.y+=worlds[index].radius*1.4;projected.project(camera);
    let x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height-13;
    const visible=projected.z<1&&projected.z>-1&&x>18&&x<width-18&&y>10&&y<height-38;
    label.hidden=!visible;if(!visible)continue;
    const labelWidth=label.offsetWidth||70;const labelHeight=26;x=THREE.MathUtils.clamp(x-labelWidth*.5,8,width-labelWidth-8);
    for(let attempt=0;attempt<5&&placed.some(rect=>x<rect.x+rect.w+3&&x+labelWidth+3>rect.x&&y<rect.y+rect.h+3&&y+labelHeight+3>rect.y);attempt++)y+=29;
    if(y>height-38){label.hidden=true;continue;}
    placed.push({x,y,w:labelWidth,h:labelHeight});label.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;
  }
}
function unavailable() {
  renderReady=false;running=false;cancelAnimationFrame(animationId);$('webgl-fallback').hidden=false;$('labels').hidden=true;document.querySelector('.universe').classList.add('unavailable');
  ['play-pause','speed','focus-planet','overview','rotate-left','rotate-right','tilt-up','tilt-down','zoom-in','zoom-out','show-orbits','show-labels'].forEach(id=>$(id).disabled=true);
  updatePlayback();
}
try {
  const container=$('scene');
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.domElement.setAttribute('aria-label','Stylized 3D solar system. Use the named planet and camera controls to explore.');renderer.domElement.setAttribute('role','img');container.append(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(48,1,.05,400);orbitGroup=new THREE.Group();scene.add(orbitGroup);createWorlds();
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=!reducedMotion;controls.dampingFactor=.08;controls.enablePan=false;controls.minDistance=1.6;controls.maxDistance=160;controls.rotateSpeed=.6;controls.zoomSpeed=.8;controls.addEventListener('start',()=>{transition=null;});
  renderReady=true;
  const resize=()=>{const width=container.clientWidth,height=container.clientHeight;if(!width||!height)return;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);if(!focused){camera.position.copy(overviewPosition());controls.target.set(0,0,0);transition=null;controls.update();}};
  new ResizeObserver(resize).observe(container);resize();updateWorlds(0);setOverview(true);
  const raycaster=new THREE.Raycaster();let pointerStart=null;
  renderer.domElement.addEventListener('pointerdown',(event)=>{pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};});
  renderer.domElement.addEventListener('pointercancel',()=>{pointerStart=null;});
  renderer.domElement.addEventListener('pointerup',(event)=>{
    if(!pointerStart||pointerStart.id!==event.pointerId||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>6){pointerStart=null;return;}
    pointerStart=null;const rect=renderer.domElement.getBoundingClientRect();const mouse=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects(meshes.map(mesh=>mesh.group),true);const hit=hits.find(item=>Number.isInteger(item.object.userData.world));if(hit)selectWorld(hit.object.userData.world);
  });
  renderer.domElement.addEventListener('webglcontextlost',(event)=>{event.preventDefault();unavailable();$('webgl-fallback').querySelector('p').textContent='The browser lost its 3D graphics connection. Planet field notes still work. Reload this page to try the interactive scene again.';});
  let previousTime=performance.now(),lastDisplayed=-1;
  function animate(now) {
    animationId=requestAnimationFrame(animate);
    const delta=Math.min((now-previousTime)/1000,.05);previousTime=now;
    if(document.hidden)return;
    if(running)simulationTime+=delta*speed;
    updateWorlds(simulationTime);
    if(transition){
      const t=THREE.MathUtils.clamp((now-transition.start)/1050,0,1),ease=t*t*(3-2*t);
      const target=transition.mode==='focus'?worldPositions[selected]:new THREE.Vector3();const destination=transition.mode==='focus'?target.clone().add(transition.offset):transition.destination;
      controls.target.lerpVectors(transition.target,target,ease);camera.position.lerpVectors(transition.position,destination,ease);if(t===1)transition=null;
    }else if(focused){const movement=worldPositions[selected].clone().sub(previousFollow);camera.position.add(movement);controls.target.add(movement);}
    previousFollow.copy(worldPositions[selected]);controls.update();selectionRing.quaternion.copy(camera.quaternion);updateLabels();renderer.render(scene,camera);
    const elapsed=Math.floor(simulationTime);if(elapsed!==lastDisplayed){lastDisplayed=elapsed;$('elapsed').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;}
  }
  animationId=requestAnimationFrame(animate);
}catch(error){console.warn('Planet Lab: 3D scene unavailable.',error);unavailable();}
updatePlayback();
