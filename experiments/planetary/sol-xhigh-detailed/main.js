import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const worlds = [
  { name: 'Mercury', kind: 'TERRESTRIAL PLANET', color: '#a69b8c', radius: .53, orbit: 6, rate: 1.53, angle: 2.7, inclination: .06, tilt: .03, year: '88 days', diameter: '4,880 km', distance: '0.39 AU', description: 'Small, rocky, and covered in craters. Mercury races around the Sun faster than any other planet.', texture: 'craters' },
  { name: 'Venus', kind: 'TERRESTRIAL PLANET', color: '#d5b984', radius: .88, orbit: 9, rate: 1.13, angle: 5.2, inclination: .04, tilt: .07, year: '225 days', diameter: '12,100 km', distance: '0.72 AU', description: 'A rocky world wrapped in thick clouds. Its dense atmosphere traps heat beneath a golden veil.', texture: 'clouds' },
  { name: 'Earth', kind: 'TERRESTRIAL PLANET', color: '#629cc3', radius: .95, orbit: 12, rate: .91, angle: .75, inclination: 0, tilt: .41, year: '365 days', diameter: '12,740 km', distance: '1.00 AU', description: 'An ocean-covered world with a thin atmosphere. The only home for life we know.', texture: 'earth' },
  { name: 'Mars', kind: 'TERRESTRIAL PLANET', color: '#c17856', radius: .68, orbit: 15.7, rate: .72, angle: 3.55, inclination: .03, tilt: .44, year: '687 days', diameter: '6,780 km', distance: '1.52 AU', description: 'A rust-red desert with enormous volcanoes and traces of ancient rivers. A small world with a big story.', texture: 'mars' },
  { name: 'Jupiter', kind: 'GAS GIANT', color: '#c8b699', radius: 2.35, orbit: 21, rate: .42, angle: 5.8, inclination: .02, tilt: .06, year: '11.9 years', diameter: '139,820 km', distance: '5.20 AU', description: 'The giant of the family. Bands of cloud and powerful storms swirl through its deep atmosphere.', texture: 'jupiter' },
  { name: 'Saturn', kind: 'GAS GIANT', color: '#d6c298', radius: 1.94, orbit: 27, rate: .31, angle: 2.15, inclination: .035, tilt: .47, year: '29.4 years', diameter: '116,460 km', distance: '9.58 AU', description: 'A pale gas giant surrounded by brilliant rings. Countless icy pieces make its signature silhouette.', texture: 'saturn' },
  { name: 'Uranus', kind: 'ICE GIANT', color: '#8abcc2', radius: 1.37, orbit: 33, rate: .22, angle: 4.2, inclination: .015, tilt: 1.71, year: '84 years', diameter: '50,720 km', distance: '19.2 AU', description: 'A quiet-looking, blue-green world tipped onto its side. Methane gives its atmosphere a soft cyan color.', texture: 'uranus' },
  { name: 'Neptune', kind: 'ICE GIANT', color: '#617fc1', radius: 1.32, orbit: 39, rate: .18, angle: .2, inclination: .03, tilt: .49, year: '165 years', diameter: '49,240 km', distance: '30.1 AU', description: 'A distant blue world with fierce winds. Neptune takes nearly 165 Earth years to make one trip around the Sun.', texture: 'neptune' },
];

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { selected: 2, paused: reducedMotion, speed: 1, time: 0, follow: false, orbits: true, labels: true };
let renderer, scene, camera, controls;
let webGLReady = false;
let cameraTransition = null;
let lastAspect = 0;
const planetObjects = [];
const pickTargets = [];
const planetLabels = [];
const planetButtons = [];
const textureCanvases = [];
const scratchPosition = new THREE.Vector3();
const targetPosition = new THREE.Vector3();
const deltaPosition = new THREE.Vector3();
const direction = new THREE.Vector3(.21, .57, .8).normalize();
const spherical = new THREE.Spherical();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let sun, sunGlow, selectionRing, moon;

function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makePlanetTexture(world, index) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const rand = randomGenerator(7301 + index * 37);
  const width = canvas.width, height = canvas.height;
  ctx.fillStyle = world.color;
  ctx.fillRect(0, 0, width, height);

  if (world.texture === 'earth') {
    ctx.fillStyle = '#326f98';
    ctx.fillRect(0, 0, width, height);
    const continents = [
      [100, 108, 73, 58], [162, 220, 36, 77], [377, 119, 53, 40],
      [387, 195, 40, 65], [510, 117, 111, 58], [607, 259, 48, 29], [704, 106, 26, 49],
    ];
    for (const [x, y, rx, ry] of continents) {
      ctx.beginPath();
      for (let k = 0; k <= 52; k++) {
        const angle = k / 52 * Math.PI * 2;
        const irregularity = .7 + rand() * .49;
        const xx = x + Math.cos(angle) * rx * irregularity;
        const yy = y + Math.sin(angle) * ry * irregularity;
        if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.closePath();
      ctx.fillStyle = index === 2 ? '#7b9270' : '#7d8870';
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let k = 0; k < 110; k++) {
        ctx.globalAlpha = .14;
        ctx.fillStyle = k % 3 ? '#a4a176' : '#325c46';
        ctx.beginPath();
        ctx.ellipse(x + (rand()-.5)*rx*2, y + (rand()-.5)*ry*2, 5+rand()*20, 3+rand()*9, rand()*6, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = '#e2e9e5';
    ctx.fillRect(0, 0, width, 13);
    ctx.fillRect(0, height-15, width, 15);
    for (let k = 0; k < 110; k++) {
      ctx.globalAlpha = .2 + rand() * .33;
      ctx.fillStyle = '#d7e3de';
      ctx.beginPath();
      ctx.ellipse(rand()*width, 32+rand()*(height-64), 9+rand()*43, 2+rand()*6, -.18, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (['jupiter', 'saturn', 'uranus', 'neptune', 'clouds'].includes(world.texture)) {
    const palettes = {
      jupiter: ['#d3c2a6','#977658','#ede1c6','#b89574','#ad937b','#dad0b9'],
      saturn: ['#ded0ac','#b8a27d','#d1bd95','#eadbb7','#c2ad89'],
      uranus: ['#9acdd0','#8abac0','#afd2ce','#7db5bd'],
      neptune: ['#4e70af','#6a8bc6','#3f619f','#7695ca'],
      clouds: ['#d5b983','#e6ce9c','#b99c68','#d9c196'],
    };
    const palette = palettes[world.texture];
    let y = 0;
    while (y < height) {
      const h = 3 + rand()*17;
      ctx.fillStyle = palette[Math.floor(rand()*palette.length)];
      ctx.beginPath();
      ctx.moveTo(0,y);
      for (let x = 0; x <= width; x+=12) ctx.lineTo(x, y + Math.sin(x*.021 + y)*2.5 + Math.sin(x*.057)*1.2);
      for (let x = width; x >= 0; x-=12) ctx.lineTo(x, y+h + Math.sin(x*.021 + y)*2.5);
      ctx.closePath();
      ctx.fill();
      y+=h-1;
    }
    if (world.texture === 'jupiter') {
      const storm = ctx.createRadialGradient(514,246,2,514,246,43);
      storm.addColorStop(0,'#a86e50'); storm.addColorStop(.65,'#b98563'); storm.addColorStop(1,'#c5a384');
      ctx.fillStyle = storm;
      ctx.beginPath();ctx.ellipse(514,246,42,18,-.04,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle = '#d6b59388';ctx.lineWidth=3;ctx.stroke();
    }
  } else {
    for (let k=0;k<120;k++) {
      const x=rand()*width,y=rand()*height,r=3+rand()*29;
      ctx.globalAlpha=.1+rand()*.18;
      ctx.fillStyle=world.texture==='mars'?'#744635':'#5c5853';
      ctx.beginPath();ctx.ellipse(x,y,r,r*.65,rand()*6,0,Math.PI*2);ctx.fill();
      if(world.texture==='craters') {
        ctx.strokeStyle='#d1c6ad';ctx.lineWidth=1.5;ctx.stroke();
        ctx.fillStyle='#ccc1a3';ctx.globalAlpha=.08;ctx.beginPath();ctx.ellipse(x-r*.2,y-r*.2,r*.7,r*.45,0,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.globalAlpha=1;
    if(world.texture==='mars') {
      ctx.fillStyle='#d2c7b4';ctx.fillRect(0,0,width,9);ctx.fillRect(0,height-10,width,10);
    }
  }
  // Fine, seeded surface variation keeps every texture local and repeatable.
  const pixels = ctx.getImageData(0,0,width,height);
  for(let i=0;i<pixels.data.length;i+=4) {
    const grain=(rand()-.5)*(world.texture==='craters'?21:10);
    pixels.data[i]+=grain;pixels.data[i+1]+=grain;pixels.data[i+2]+=grain;
  }
  ctx.putImageData(pixels,0,0);
  textureCanvases.push(canvas);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.RepeatWrapping;
  return texture;
}

const textures = worlds.map(makePlanetTexture);
worlds.forEach((world,index) => {
  const button=document.createElement('button');
  button.className='planet-button';button.type='button';
  button.setAttribute('aria-pressed',String(index===state.selected));
  button.innerHTML=`<span class="planet-swatch ${world.name.toLowerCase()}" style="--world-color:${world.color}" aria-hidden="true"></span><span>${world.name}</span>`;
  button.addEventListener('click',()=>selectPlanet(index));
  $('planet-buttons').append(button);planetButtons.push(button);
  const label=document.createElement('button');
  label.className='planet-label';label.type='button';label.textContent=world.name;
  label.setAttribute('aria-label',`Select ${world.name}`);
  label.setAttribute('aria-pressed',String(index===state.selected));
  label.addEventListener('click',()=>selectPlanet(index));
  $('planet-labels').append(label);planetLabels.push(label);
});

function announce(message) { $('announcement').textContent=message; }
function updateInfo() {
  const world=worlds[state.selected];
  $('planet-number').textContent=`${String(state.selected+1).padStart(2,'0')} / 08`;
  $('planet-title').textContent=world.name;
  $('planet-kind').textContent=world.kind;
  $('planet-description').textContent=world.description;
  $('planet-year').textContent=world.year;
  $('planet-diameter').textContent=world.diameter;
  $('planet-distance').textContent=world.distance;
  $('portrait-world').style.backgroundImage=`url("${textureCanvases[state.selected].toDataURL()}")`;
  $('planet-portrait').classList.toggle('saturn',world.name==='Saturn');
  $('focus-text').textContent=state.follow?'Back to system':`Follow ${world.name}`;
  $('focus-planet').setAttribute('aria-label',state.follow?'Stop following and show the whole system':`Move the camera closer and follow ${world.name}`);
  planetButtons.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===state.selected)));
  planetLabels.forEach((label,index)=>{
    label.classList.toggle('selected',index===state.selected);
    label.setAttribute('aria-pressed',String(index===state.selected));
  });
  planetObjects.forEach((object,index)=>{
    object.orbitLine.material.color.set(index===state.selected?'#b8e6cc':'#7992a6');
    object.orbitLine.material.opacity=index===state.selected?.52:.16;
  });
}
function selectPlanet(index) {
  if(state.selected===index) return;
  state.selected=index;
  updateInfo();
  if(state.follow&&webGLReady) startFocusTransition();
  announce(`${worlds[index].name} selected. ${worlds[index].kind.toLowerCase()}. Reference facts updated.`);
}
function updatePlayback() {
  $('play-text').textContent=state.paused?'Resume':'Pause';
  $('play-toggle').setAttribute('aria-label',state.paused?'Resume simulation':'Pause simulation');
  $('play-toggle').setAttribute('aria-pressed',String(state.paused));
  $('pause-icon').toggleAttribute('hidden',state.paused);
  $('play-icon').toggleAttribute('hidden',!state.paused);
  $('motion-status').textContent=state.paused?'Paused':'In motion';
  document.querySelector('.scene-status').classList.toggle('paused',state.paused);
}
function togglePlayback() {
  if(!webGLReady)return;
  state.paused=!state.paused;updatePlayback();
  announce(state.paused?'Simulation paused. Camera controls remain available.':'Simulation resumed.');
}
$('play-toggle').addEventListener('click',togglePlayback);
$('speed').addEventListener('input',(event)=>{
  state.speed=Number(event.target.value);
  $('speed-value').textContent=`${state.speed.toFixed(1)}×`;
  $('speed').setAttribute('aria-valuetext',`${state.speed.toFixed(1)} times normal speed`);
});
$('show-orbits').addEventListener('change',(event)=>{
  state.orbits=event.target.checked;
  planetObjects.forEach(object=>object.orbitLine.visible=state.orbits);
});
$('show-labels').addEventListener('change',(event)=>{
  state.labels=event.target.checked;
  $('planet-labels').hidden=!state.labels;
});
$('overview').addEventListener('click',()=>showOverview(true));
$('focus-planet').addEventListener('click',()=>{
  if(!webGLReady)return;
  if(state.follow) showOverview(true);
  else {state.follow=true;startFocusTransition();updateInfo();announce(`Following ${worlds[state.selected].name}.`);}
});
$('zoom-in').addEventListener('click',()=>zoomCamera(.8));
$('zoom-out').addEventListener('click',()=>zoomCamera(1.25));
$('reset').addEventListener('click',()=>{
  if(!webGLReady)return;
  Object.assign(state,{selected:2,paused:reducedMotion,speed:1,time:0,follow:false,orbits:true,labels:true});
  $('speed').value='1';$('speed-value').textContent='1.0×';$('speed').setAttribute('aria-valuetext','1 times normal speed');
  $('show-orbits').checked=true;$('show-labels').checked=true;$('planet-labels').hidden=false;
  planetObjects.forEach(object=>object.orbitLine.visible=true);
  updatePlanetPositions();updatePlayback();updateInfo();showOverview(true);
  announce(`System reset. Earth selected, orbit speed 1 times, ${state.paused?'paused for reduced motion':'simulation running'}.`);
});

function makeGlowTexture() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');
  const g=ctx.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(255,235,182,1)');g.addColorStop(.18,'rgba(255,207,113,.75)');g.addColorStop(.35,'rgba(239,160,68,.25)');g.addColorStop(.65,'rgba(202,108,34,.055)');g.addColorStop(1,'rgba(190,99,28,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,256,256);
  return new THREE.CanvasTexture(canvas);
}
function makeSunTexture() {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#efbd63';ctx.fillRect(0,0,512,256);
  const rand=randomGenerator(2397);
  for(let i=0;i<7000;i++) {
    ctx.fillStyle=i%4?'#ffe1a0':'#d19039';ctx.globalAlpha=.14+rand()*.2;
    ctx.beginPath();ctx.ellipse(rand()*512,rand()*256,1+rand()*7,1+rand()*3,rand()*6,0,Math.PI*2);ctx.fill();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function atmosphere(radius,color,opacity=.38) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius,48,32),new THREE.ShaderMaterial({
    uniforms:{tint:{value:new THREE.Color(color)},strength:{value:opacity}},
    vertexShader:`varying vec3 worldNormal; varying vec3 toCamera;
      void main(){vec4 worldPosition=modelMatrix*vec4(position,1.0);worldNormal=normalize(mat3(modelMatrix)*normal);toCamera=cameraPosition-worldPosition.xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform vec3 tint;uniform float strength;varying vec3 worldNormal;varying vec3 toCamera;
      void main(){float edge=pow(1.0-abs(dot(normalize(worldNormal),normalize(toCamera))),2.8);gl_FragColor=vec4(tint,edge*strength);}`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  }));
}
function createStars() {
  const rand=randomGenerator(12410),positions=[],colors=[];
  for(let i=0;i<2000;i++) {
    const azimuth=rand()*Math.PI*2,vertical=rand()*2-1,radius=105+rand()*100;
    const ring=Math.sqrt(1-vertical*vertical);
    positions.push(Math.cos(azimuth)*ring*radius,vertical*radius,Math.sin(azimuth)*ring*radius);
    const color=new THREE.Color(i%7===0?'#e4c5a0':i%3===0?'#a9c4da':'#c1d2dd');
    color.multiplyScalar(.35+rand()*.7);colors.push(color.r,color.g,color.b);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d');
  const g=ctx.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#ffffff');g.addColorStop(.14,'#ffffff');g.addColorStop(.38,'#ffffff55');g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.fillRect(0,0,32,32);
  const stars=new THREE.Points(geometry,new THREE.PointsMaterial({size:.42,map:new THREE.CanvasTexture(canvas),vertexColors:true,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));
  scene.add(stars);
}
function createSaturnRings(radius) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=8;
  const ctx=canvas.getContext('2d'),rand=randomGenerator(872);
  for(let x=0;x<256;x++) {
    const fraction=x/255;
    const alpha=fraction>.53&&fraction<.58?.13:.35+rand()*.55;
    ctx.fillStyle=`rgba(205,188,151,${alpha})`;ctx.fillRect(x,0,1,8);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const geometry=new THREE.RingGeometry(radius*1.4,radius*2.28,128,1);
  const positions=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<positions.count;i++) {
    const distance=Math.hypot(positions.getX(i),positions.getY(i));
    uv.setXY(i,(distance-radius*1.4)/(radius*.88),.5);
  }
  const ring=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,color:'#ddcead',side:THREE.DoubleSide,transparent:true,opacity:.86,roughness:.9,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;return ring;
}
function createWorlds() {
  worlds.forEach((world,index)=>{
    const orbitalPlane=new THREE.Group();orbitalPlane.rotation.z=world.inclination;scene.add(orbitalPlane);
    const orbitPoints=[];
    for(let i=0;i<=256;i++) {const angle=i/256*Math.PI*2;orbitPoints.push(new THREE.Vector3(Math.cos(angle)*world.orbit,0,Math.sin(angle)*world.orbit));}
    const orbitLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints),new THREE.LineBasicMaterial({color:'#7992a6',transparent:true,opacity:.16,depthWrite:false}));
    orbitalPlane.add(orbitLine);
    const root=new THREE.Group();orbitalPlane.add(root);
    const tiltedBody=new THREE.Group();tiltedBody.rotation.z=world.tilt;root.add(tiltedBody);
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(world.radius,64,40),new THREE.MeshStandardMaterial({map:textures[index],roughness:world.name==='Earth'?.65:.92,metalness:0}));
    mesh.userData.planetIndex=index;tiltedBody.add(mesh);pickTargets.push(mesh);
    if(world.name==='Saturn') {const rings=createSaturnRings(world.radius);rings.userData.planetIndex=index;tiltedBody.add(rings);pickTargets.push(rings);}
    if(['Earth','Venus','Uranus','Neptune'].includes(world.name)) {
      const halo=atmosphere(world.radius*1.065,world.name==='Venus'?'#ead49a':world.color,world.name==='Earth'?.6:.35);root.add(halo);
    }
    if(world.name==='Earth') {
      moon=new THREE.Mesh(new THREE.SphereGeometry(.18,20,16),new THREE.MeshStandardMaterial({color:'#aeafb0',roughness:1}));root.add(moon);
    }
    planetObjects.push({root,mesh,orbitLine,orbitalPlane});
  });
  const ringGeometry=new THREE.RingGeometry(1.25,1.265,96);
  selectionRing=new THREE.Mesh(ringGeometry,new THREE.MeshBasicMaterial({color:'#c0eed5',transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false}));
  scene.add(selectionRing);
  updatePlanetPositions();
}
function updatePlanetPositions() {
  planetObjects.forEach((object,index)=>{
    const world=worlds[index],angle=world.angle+state.time*world.rate*.105;
    object.root.position.set(Math.cos(angle)*world.orbit,0,Math.sin(angle)*world.orbit);
    object.mesh.rotation.y=state.time*(index===1?-.1:.23);
  });
  if(moon)moon.position.set(Math.cos(state.time*.8)*1.65,.14,Math.sin(state.time*.8)*1.65);
  if(sun)sun.rotation.y=state.time*.018;
  if(sunGlow){const scale=17+Math.sin(state.time*.25)*.28;sunGlow.scale.set(scale,scale,1);}
}
function overviewDistance() {
  return Math.max(83,46/(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));
}
function beginCameraTransition(follow) {
  cameraTransition={elapsed:0,duration:reducedMotion?0:.85,fromPosition:camera.position.clone(),fromTarget:controls.target.clone(),follow};
  if(follow) cameraTransition.offset=camera.position.clone().sub(controls.target).normalize().multiplyScalar(Math.max(worlds[state.selected].radius*6.2,7));
  else cameraTransition.offset=direction.clone().multiplyScalar(overviewDistance());
}
function showOverview(animated=false) {
  if(!webGLReady)return;
  state.follow=false;
  controls.minDistance=7;controls.maxDistance=210;
  if(animated)beginCameraTransition(false);
  else {cameraTransition=null;controls.target.set(0,0,0);camera.position.copy(direction).multiplyScalar(overviewDistance());controls.update();}
  updateInfo();
}
function startFocusTransition() {
  controls.minDistance=Math.max(worlds[state.selected].radius*2.5,2.5);
  controls.maxDistance=210;
  beginCameraTransition(true);
}
function updateCamera(dt) {
  if(state.follow)planetObjects[state.selected].root.getWorldPosition(targetPosition);
  else targetPosition.set(0,0,0);
  if(cameraTransition) {
    cameraTransition.elapsed+=dt;
    const t=cameraTransition.duration===0?1:Math.min(1,cameraTransition.elapsed/cameraTransition.duration);
    const ease=t*t*(3-2*t);
    const destination=targetPosition.clone().add(cameraTransition.offset);
    camera.position.lerpVectors(cameraTransition.fromPosition,destination,ease);
    controls.target.lerpVectors(cameraTransition.fromTarget,targetPosition,ease);
    if(t===1)cameraTransition=null;
  } else if(state.follow) {
    deltaPosition.copy(targetPosition).sub(controls.target);
    camera.position.add(deltaPosition);controls.target.copy(targetPosition);
  }
  controls.update();
}
function zoomCamera(factor) {
  if(!webGLReady)return;
  cameraTransition=null;
  const offset=camera.position.clone().sub(controls.target);
  const distance=THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance);
  camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(distance));controls.update();
}
function resize() {
  if(!webGLReady)return;
  const width=Math.max(viewport.clientWidth,1),height=Math.max(viewport.clientHeight,1);
  const oldDistance=lastAspect?overviewDistance():0;
  camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
  if(lastAspect&&!state.follow&&!cameraTransition) {
    const ratio=overviewDistance()/oldDistance;
    const offset=camera.position.clone().sub(controls.target).multiplyScalar(ratio);
    camera.position.copy(controls.target).add(offset);
  }
  lastAspect=camera.aspect;
}
function updateLabels() {
  if(!state.labels)return;
  const width=viewport.clientWidth,height=viewport.clientHeight;
  const lensScale=height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
  const occupied=[];
  const order=[state.selected,...worlds.map((_,i)=>i).filter(i=>i!==state.selected)];
  for(const index of order) {
    const object=planetObjects[index],label=planetLabels[index];
    object.root.getWorldPosition(scratchPosition);
    const distance=camera.position.distanceTo(scratchPosition);
    const pixelRadius=worlds[index].radius*lensScale/distance;
    const projected=scratchPosition.clone().project(camera);
    const x=(projected.x*.5+.5)*width;
    const y=(-projected.y*.5+.5)*height+Math.max(9,pixelRadius)+8;
    const labelWidth=worlds[index].name.length*6+(index===state.selected?23:14);
    const rect={x:x-labelWidth/2,y,w:labelWidth,h:20};
    const intersects=occupied.some(other=>rect.x<other.x+other.w+4&&rect.x+rect.w+4>other.x&&rect.y<other.y+other.h+3&&rect.y+rect.h+3>other.y);
    const visible=projected.z>-1&&projected.z<1&&x>labelWidth/2+4&&x<width-labelWidth/2-4&&y>112&&y<height-64&&!intersects;
    label.hidden=!visible;
    if(visible){label.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translateX(-50%)`;occupied.push(rect);}
  }
}
function failScene(error) {
  webGLReady=false;
  $('fallback').hidden=false;$('planet-labels').hidden=true;
  $('motion-status').textContent='3D unavailable';document.querySelector('.scene-status').classList.add('paused');
  ['play-toggle','speed','reset','focus-planet','zoom-in','zoom-out','overview','show-orbits','show-labels'].forEach(id=>$(id).disabled=true);
  viewport.removeAttribute('tabindex');
  viewport.setAttribute('aria-label','3D scene unavailable. Planet information remains accessible below.');
  if(renderer)renderer.domElement.style.display='none';
  console.warn('Orrery: WebGL scene unavailable.',error instanceof Error?error.message:error);
}

updateInfo();updatePlayback();
try {
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
  renderer.domElement.setAttribute('aria-hidden','true');
  viewport.prepend(renderer.domElement);
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#09131f',.0015);
  camera=new THREE.PerspectiveCamera(48,1,.1,550);
  camera.position.copy(direction).multiplyScalar(88);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=false;
  controls.rotateSpeed=.6;controls.zoomSpeed=.8;controls.minPolarAngle=.1;controls.maxPolarAngle=Math.PI*.48;
  controls.minDistance=7;controls.maxDistance=210;
  controls.addEventListener('start',()=>{cameraTransition=null;});
  scene.add(new THREE.AmbientLight('#bdcce0',.45));
  scene.add(new THREE.HemisphereLight('#b6cbe8','#293647',.5));
  const sunlight=new THREE.PointLight('#ffe8be',3.4,0,0);scene.add(sunlight);
  sun=new THREE.Mesh(new THREE.SphereGeometry(3.15,64,40),new THREE.MeshBasicMaterial({map:makeSunTexture(),color:'#fff2c8'}));scene.add(sun);
  sunGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:makeGlowTexture(),color:'#ffe1a8',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.85}));
  sunGlow.scale.set(17,17,1);scene.add(sunGlow);
  createStars();createWorlds();webGLReady=true;resize();showOverview(false);updateInfo();
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);
  renderer.domElement.addEventListener('webglcontextlost',(event)=>{event.preventDefault();failScene('The WebGL context was lost.');});
  let pressed=null;
  renderer.domElement.addEventListener('pointerdown',(event)=>{pressed={x:event.clientX,y:event.clientY,id:event.pointerId};});
  renderer.domElement.addEventListener('pointercancel',()=>{pressed=null;});
  renderer.domElement.addEventListener('pointerup',(event)=>{
    if(!pressed||event.pointerId!==pressed.id||Math.hypot(event.clientX-pressed.x,event.clientY-pressed.y)>6){pressed=null;return;}
    pressed=null;
    const bounds=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const intersections=raycaster.intersectObjects(pickTargets,false);
    if(intersections.length)selectPlanet(intersections[0].object.userData.planetIndex);
  });
  viewport.setAttribute('aria-label','Interactive 3D solar system. Drag to orbit; scroll or pinch to zoom. Keyboard: arrow keys orbit, plus and minus zoom, Space pauses or resumes, Home shows the whole system.');
  viewport.addEventListener('keydown',(event)=>{
    if(event.target!==viewport||!webGLReady)return;
    if(event.key===' '){event.preventDefault();togglePlayback();return;}
    if(event.key==='Home'){event.preventDefault();showOverview(true);return;}
    if(event.key==='+'||event.key==='='){event.preventDefault();zoomCamera(.8);return;}
    if(event.key==='-'){event.preventDefault();zoomCamera(1.25);return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();cameraTransition=null;
    spherical.setFromVector3(camera.position.clone().sub(controls.target));
    if(event.key==='ArrowLeft')spherical.theta-=.12;
    if(event.key==='ArrowRight')spherical.theta+=.12;
    if(event.key==='ArrowUp')spherical.phi-=.1;
    if(event.key==='ArrowDown')spherical.phi+=.1;
    spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();
  });
  let previous=performance.now();
  function animate(now) {
    if(!webGLReady)return;
    requestAnimationFrame(animate);
    const dt=Math.min((now-previous)/1000,.05);previous=now;
    if(!state.paused)state.time+=dt*state.speed;
    updatePlanetPositions();updateCamera(dt);
    planetObjects[state.selected].root.getWorldPosition(selectionRing.position);
    const selectedRadius=worlds[state.selected].radius;
    selectionRing.scale.setScalar(selectedRadius);
    selectionRing.quaternion.copy(camera.quaternion);
    selectionRing.visible=true;
    renderer.render(scene,camera);updateLabels();
  }
  requestAnimationFrame(animate);
} catch(error) {failScene(error);}
