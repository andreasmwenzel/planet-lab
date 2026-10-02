import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

// A deliberately composed model: distances, sizes, and animation periods are not to scale.
const PLANETS = [
  { name:'Mercury', kind:'Terrestrial planet', subtitle:'A quiet world close to the fire.', radius:'2,440', period:'88.0', unit:'days', description:'A rocky, cratered world with almost no atmosphere. Its long days bring extraordinary swings between sunlight and darkness.', color:'#b1aaa0', colors:['#b1aaa0','#746e67','#28282a'], distance:4.6, size:.23, cycle:12, phase:2.1, inclination:.035, texture:'rock' },
  { name:'Venus', kind:'Terrestrial planet', subtitle:'A bright world behind a veil.', radius:'6,052', period:'224.7', unit:'days', description:'Thick clouds hide a rocky surface beneath a dense atmosphere. Venus is the hottest planet, even though Mercury is closer to the Sun.', color:'#d2bc87', colors:['#dbca9d','#9b895f','#35342a'], distance:6.9, size:.40, cycle:19, phase:4.0, inclination:.025, texture:'cloud' },
  { name:'Earth', kind:'Terrestrial planet', subtitle:'Our place among the planets.', radius:'6,371', period:'365.3', unit:'days', description:'Liquid oceans, a thin atmosphere, and the only life we know. A small blue world with a great deal going on.', color:'#9cb9b1', colors:['#a7c6b2','#426675','#0c2836'], distance:9.6, size:.44, cycle:28, phase:.70, inclination:0, texture:'earth' },
  { name:'Mars', kind:'Terrestrial planet', subtitle:'A rust-colored neighbor.', radius:'3,390', period:'687.0', unit:'days', description:'Iron minerals lend Mars its warm color. Dry valleys, polar ice, and immense volcanoes preserve traces of a very different past.', color:'#bb8e73', colors:['#c49a7b','#8a5b42','#362725'], distance:12.8, size:.32, cycle:39, phase:5.1, inclination:.018, texture:'rock' },
  { name:'Jupiter', kind:'Gas giant', subtitle:'A vast world of moving clouds.', radius:'69,911', period:'11.9', unit:'years', description:'The largest planet is a world of hydrogen and helium. Cloud bands sweep around it, while enormous storms can endure for centuries.', color:'#c4b197', colors:['#d7c7ac','#9d8571','#3d3832'], distance:18.0, size:1.31, cycle:59, phase:2.8, inclination:.010, texture:'bands' },
  { name:'Saturn', kind:'Gas giant', subtitle:'A world with a delicate signature.', radius:'58,232', period:'29.4', unit:'years', description:'A pale gas giant surrounded by rings made mostly of ice particles. What looks like one smooth disc is an intricate collection of separate orbits.', color:'#c9be9a', colors:['#ddd2b1','#a39877','#3f3c30'], distance:23.6, size:1.09, cycle:80, phase:.13, inclination:.019, texture:'bands', ring:true },
  { name:'Uranus', kind:'Ice giant', subtitle:'A pale blue world tipped sideways.', radius:'25,362', period:'84.0', unit:'years', description:'Methane in its atmosphere helps give Uranus a blue-green hue. Its extreme axial tilt makes its seasons unlike those of any other planet.', color:'#91b9bc', colors:['#c2d9d1','#80a8b1','#2b4651'], distance:30.4, size:.77, cycle:104, phase:1.55, inclination:.007, texture:'ice' },
  { name:'Neptune', kind:'Ice giant', subtitle:'At the far edge of the familiar.', radius:'24,622', period:'164.8', unit:'years', description:'Dark, cold, and swept by powerful winds. Neptune is the most distant of the eight planets, orbiting well beyond the warmth of the inner worlds.', color:'#7598b9', colors:['#91b0c5','#4e789e','#172d4d'], distance:37.6, size:.75, cycle:134, phase:4.5, inclination:.015, texture:'ice' },
];

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { selected:2, playing:!reducedMotion, speed:1, time:0, tracking:false, usable:false };
const planetButtons = [];
const labels = [];
const worlds = [];
let scene, camera, renderer, controls, transition = null, lastFrame = 0;
const HOME = new THREE.Vector3(47, 39, 61);
const pointer = { x:0, y:0, moved:false, id:null };
const raycaster = new THREE.Raycaster();
const projected = new THREE.Vector3();
const projectedEdge = new THREE.Vector3();
const trackingDelta = new THREE.Vector3();
const screenCoordinates = [];

function announce(message) { $('announcement').textContent = message; }

PLANETS.forEach((planet, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'planet-button';
  button.style.setProperty('--planet-color', planet.color);
  button.setAttribute('aria-pressed', index === state.selected ? 'true' : 'false');
  button.setAttribute('aria-label', `Select ${planet.name}`);
  button.innerHTML = `<span class="planet-dot" aria-hidden="true"></span><span>${planet.name}</span><span class="planet-number" aria-hidden="true">${String(index + 1).padStart(2,'0')}</span>`;
  button.addEventListener('click', () => selectPlanet(index));
  $('planet-buttons').append(button);
  planetButtons.push(button);
  const label = document.createElement('span');
  label.className = 'orbit-label';
  label.textContent = planet.name;
  label.style.setProperty('--dot-color', planet.color);
  $('scene-labels').append(label);
  labels.push(label);
});

function selectPlanet(index, speak = true) {
  state.selected = index;
  const planet = PLANETS[index];
  $('planet-name').textContent = planet.name;
  $('planet-kind').textContent = planet.kind.toUpperCase();
  $('planet-subtitle').textContent = planet.subtitle;
  $('planet-radius').innerHTML = `${planet.radius} <span>km</span>`;
  $('planet-period').innerHTML = `${planet.period} <span>${planet.unit}</span>`;
  $('planet-description').textContent = planet.description;
  $('planet-index').textContent = `${String(index + 1).padStart(2,'0')} / 08`;
  $('planet-preview').dataset.world = planet.name;
  ['a','b','c'].forEach((letter, i) => $('planet-preview').style.setProperty(`--planet-${letter}`,planet.colors[i]));
  planetButtons.forEach((button, i) => button.setAttribute('aria-pressed', i === index ? 'true' : 'false'));
  labels.forEach((label, i) => label.classList.toggle('active', i === index));
  worlds.forEach((world, i) => {
    world.orbit.material.color.set(i === index ? '#8bada0' : '#42666a');
    world.orbit.material.opacity = i === index ? .52 : .20;
  });
  if (state.tracking && state.usable) focusPlanet();
  updateViewState();
  if (speak) announce(`${planet.name} selected. ${planet.kind}. Mean radius ${planet.radius} kilometers. One orbit: ${planet.period} ${planet.unit}.`);
}

function updateViewState() {
  $('view-state').textContent = !state.usable ? 'REFERENCE VIEW' : state.tracking ? `${String(state.selected + 1).padStart(2,'0')} / ${PLANETS[state.selected].name.toUpperCase()} VIEW` : '01 / SYSTEM VIEW';
  $('inspect-text').textContent = state.tracking ? 'Return to the system' : `Inspect ${PLANETS[state.selected].name}`;
  $('inspect').setAttribute('aria-label', state.tracking ? 'Return to full system view' : `Inspect ${PLANETS[state.selected].name} up close`);
}

function updatePlayback() {
  $('play-symbol').textContent = state.playing ? 'Ⅱ' : '▷';
  $('play-text').textContent = state.playing ? 'Pause' : 'Resume';
  $('play-toggle').setAttribute('aria-label', state.playing ? 'Pause simulation' : 'Resume simulation');
  $('play-toggle').setAttribute('aria-pressed', String(!state.playing));
}

function togglePlayback() {
  if (!state.usable) return;
  state.playing = !state.playing;
  updatePlayback();
  announce(state.playing ? 'Simulation resumed.' : 'Simulation paused.');
}

function setSpeed(value) {
  state.speed = Number(value);
  $('speed').value = String(state.speed);
  $('speed-output').textContent = `${state.speed.toFixed(2)}×`;
  $('speed').setAttribute('aria-valuetext', `${state.speed.toFixed(2)} times normal simulation rate`);
  $('speed').style.backgroundSize = `${(state.speed-.25)/3.75*100}% 100%`;
}

// Deterministic, locally generated textures; no images or network resources are used.
function seededRandom(seed) {
  return () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
}
function noise(x, y, seed) {
  const f = (a,b) => { let n = Math.imul(a,374761393) + Math.imul(b,668265263) + seed*1274126177; n = Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967295; };
  const a = Math.floor(x), b = Math.floor(y), sx = x-a, sy = y-b;
  const u = sx*sx*(3-2*sx), v = sy*sy*(3-2*sy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(f(a,b),f(a+1,b),u),THREE.MathUtils.lerp(f(a,b+1),f(a+1,b+1),u),v);
}
function surfaceTexture(planet, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const pixels = ctx.createImageData(canvas.width,canvas.height);
  const base = new THREE.Color(planet.color);
  const shade = new THREE.Color();
  const land = new THREE.Color('#7c9381');
  const sea = new THREE.Color('#3c7186');
  const clouds = new THREE.Color('#d6ddc8');
  for (let y = 0; y < 256; y++) {
    const latitude = y/256;
    for (let x = 0; x < 512; x++) {
      const n = noise(x/30,y/27,seed)*.60 + noise(x/8,y/8,seed+9)*.28 + noise(x/2,y/2,seed+17)*.12;
      shade.copy(base);
      if (planet.texture === 'earth') {
        const lon = x/512*Math.PI*2;
        const lat = latitude*Math.PI;
        const terrain = (Math.sin(lon*2.5 + Math.cos(lat*4)*1.5) + Math.sin(lon*4-lat*3)*.6 + Math.cos(lat*5+lon)*.5)/2.1 + (n-.5)*1.4;
        shade.copy(terrain > .17 ? land : sea);
        shade.multiplyScalar(.72+n*.45);
        const cloud = noise(x/18,y/12,19)*.7 + noise(x/45+latitude*6,y/18,25)*.3;
        if (cloud > .67) shade.lerp(clouds,(cloud-.67)*2.3);
        if (latitude < .075 || latitude > .925) shade.lerp(clouds,.75);
      } else if (planet.texture === 'bands') {
        const stripe = Math.sin(y*.23+Math.sin(x*.023)*.4)*.085+Math.sin(y*.067)*.11;
        shade.multiplyScalar(.78+n*.30+stripe);
        if (planet.name === 'Jupiter') {
          const dx=(x-345)/35, dy=(y-157)/11;
          if (dx*dx+dy*dy<1) shade.lerp(new THREE.Color('#9e755d'),.65*(1-dx*dx-dy*dy));
        }
      } else if (planet.texture === 'ice') {
        shade.multiplyScalar(.89+n*.14+Math.sin(y*.14)*.025);
      } else if (planet.texture === 'cloud') {
        shade.multiplyScalar(.83+n*.26+Math.sin(y*.10+Math.sin(x*.03))* .045);
      } else {
        shade.multiplyScalar(.62+n*.64);
        if (latitude<.065 && planet.name === 'Mars') shade.lerp(clouds,.65);
      }
      shade.convertLinearToSRGB();
      const offset = (y*512+x)*4;
      pixels.data[offset] = Math.min(255,shade.r*255);
      pixels.data[offset+1] = Math.min(255,shade.g*255);
      pixels.data[offset+2] = Math.min(255,shade.b*255);
      pixels.data[offset+3] = 255;
    }
  }
  ctx.putImageData(pixels,0,0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeSun() {
  const texture = surfaceTexture({color:'#e8c287',texture:'cloud'},95);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.57,48,32),new THREE.MeshBasicMaterial({ map:texture, color:'#fff1d3' }));
  scene.add(sun);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width=256; glowCanvas.height=256;
  const context=glowCanvas.getContext('2d');
  if (context) {
    const gradient=context.createRadialGradient(128,128,12,128,128,127);
    gradient.addColorStop(0,'rgba(246,217,163,.6)');
    gradient.addColorStop(.26,'rgba(226,185,114,.19)');
    gradient.addColorStop(.56,'rgba(197,139,70,.055)');
    gradient.addColorStop(1,'rgba(182,121,57,0)');
    context.fillStyle=gradient;context.fillRect(0,0,256,256);
    const corona=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.9}));
    corona.scale.set(15,15,1);
    scene.add(corona);
  }
  scene.add(new THREE.PointLight('#ffe3af',1250,0,2));
  return sun;
}

function makeStars() {
  const random=seededRandom(4612);
  const positions=[], colors=[];
  for(let i=0;i<1150;i++) {
    const theta=random()*Math.PI*2;
    const u=random()*2-1;
    const radius=165+random()*90;
    const scale=Math.sqrt(1-u*u);
    positions.push(Math.cos(theta)*scale*radius,u*radius,Math.sin(theta)*scale*radius);
    const brightness=.24+random()*.48;
    colors.push(brightness*.87,brightness*.96,brightness);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({size:.12,vertexColors:true,transparent:true,opacity:.62,depthWrite:false,sizeAttenuation:true})));
}

function makeRing(size) {
  const geometry=new THREE.RingGeometry(size*1.36,size*2.28,128,8);
  const positions=geometry.attributes.position;
  const colors=[];
  const base=new THREE.Color('#bcae91');
  for(let i=0;i<positions.count;i++) {
    const radius=Math.hypot(positions.getX(i),positions.getY(i))/size;
    const band=.63+Math.sin(radius*55)*.17+Math.sin(radius*18)*.12;
    const c=base.clone().multiplyScalar(band);
    colors.push(c.r,c.g,c.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const ring=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,side:THREE.DoubleSide,transparent:true,opacity:.76,depthWrite:false}));
  ring.rotation.set(Math.PI/2+.40,0,-.28);
  return ring;
}

function createWorld(planet,index) {
  const body=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(planet.size,40,24),new THREE.MeshStandardMaterial({map:surfaceTexture(planet,index*17+31),roughness:.88,metalness:0,emissive:planet.color,emissiveIntensity:.035}));
  mesh.userData.planet=index;
  mesh.rotation.z=planet.name === 'Uranus' ? Math.PI/2 : .13;
  body.add(mesh);
  if(planet.ring) body.add(makeRing(planet.size));
  if(planet.name === 'Earth' || planet.texture === 'ice') {
    const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(planet.size*1.045,32,20),new THREE.MeshBasicMaterial({color:planet.name==='Earth' ? '#6799ad' : planet.color,transparent:true,opacity:.065,side:THREE.BackSide,depthWrite:false}));
    body.add(atmosphere);
  }
  scene.add(body);
  const points=[];
  for(let i=0;i<256;i++) {
    const a=i/256*Math.PI*2;
    points.push(new THREE.Vector3(Math.cos(a)*planet.distance,Math.sin(a)*planet.distance*planet.inclination,Math.sin(a)*planet.distance));
  }
  const orbit=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#42666a',transparent:true,opacity:.20,depthWrite:false}));
  scene.add(orbit);
  worlds.push({body,mesh,orbit});
}

function positionWorlds() {
  worlds.forEach((world,i) => {
    const p=PLANETS[i], angle=p.phase+state.time/p.cycle*Math.PI*2;
    world.body.position.set(Math.cos(angle)*p.distance,Math.sin(angle)*p.distance*p.inclination,Math.sin(angle)*p.distance);
    world.mesh.rotation.y=state.time*.17*(i===1 ? -.30 : 1);
  });
}

function resize() {
  if(!state.usable) return;
  const width=viewport.clientWidth, height=viewport.clientHeight;
  if(!width||!height) return;
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  // A narrower window needs a more distant overview to preserve all eight orbits.
  if(!state.tracking) {
    const direction=camera.position.clone().sub(controls.target).normalize();
    const distance=overviewDistance();
    camera.position.copy(controls.target).addScaledVector(direction,distance);
    if(transition) transition=null;
    controls.update();
  }
}

function overviewDistance() {
  const aspect=Math.max(.4,viewport.clientWidth/Math.max(1,viewport.clientHeight));
  return 87*Math.max(1,1.26/aspect);
}

function startTransition(target,distance) {
  const direction=camera.position.clone().sub(controls.target).normalize();
  if(direction.lengthSq()<.5) direction.copy(HOME).normalize();
  transition={fromPosition:camera.position.clone(),fromTarget:controls.target.clone(),direction,distance,progress:0};
  if(reducedMotion) {
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(direction,distance);
    transition=null;
    controls.update();
  }
}

function focusPlanet() {
  if(!state.usable) return;
  state.tracking=true;
  const planet=PLANETS[state.selected];
  startTransition(worlds[state.selected].body.position,Math.max(4.2,planet.size*(planet.ring ? 10 : 8)));
  updateViewState();
}

function showSystem(instant=false) {
  if(!state.usable) return;
  state.tracking=false;
  const target=new THREE.Vector3();
  if(instant) {
    transition=null;
    controls.target.copy(target);
    camera.position.copy(HOME).normalize().multiplyScalar(overviewDistance());
    controls.update();
  } else startTransition(target,overviewDistance());
  updateViewState();
}

function zoom(factor) {
  if(!state.usable) return;
  transition=null;
  const offset=camera.position.clone().sub(controls.target);
  const distance=THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance);
  camera.position.copy(controls.target).add(offset.setLength(distance));
  controls.update();
}

function moveCamera(dt) {
  const target=state.tracking ? worlds[state.selected].body.position : new THREE.Vector3();
  if(transition) {
    transition.progress=Math.min(1,transition.progress+dt/1.1);
    const t=transition.progress;
    const ease=t*t*(3-2*t);
    controls.target.lerpVectors(transition.fromTarget,target,ease);
    const goal=target.clone().addScaledVector(transition.direction,transition.distance);
    camera.position.lerpVectors(transition.fromPosition,goal,ease);
    if(t===1) transition=null;
  } else if(state.tracking) {
    trackingDelta.copy(target).sub(controls.target);
    camera.position.add(trackingDelta);
    controls.target.copy(target);
  }
  controls.update();
}

function updateLabels() {
  const width=viewport.clientWidth,height=viewport.clientHeight;
  const placed=[];
  const cameraDirection=camera.getWorldDirection(new THREE.Vector3());
  screenCoordinates.length=0;
  // Place the selected label first, then avoid overlapping labels with a small vertical nudge.
  const order=[state.selected,...PLANETS.map((_,i)=>i).filter(i=>i!==state.selected)];
  for(const i of order) {
    const world=worlds[i],label=labels[i],planet=PLANETS[i];
    const inFront=world.body.position.clone().sub(camera.position).dot(cameraDirection)>0;
    projected.copy(world.body.position).project(camera);
    const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
    const visible=inFront && projected.z<1 && x>12 && x<width-12 && y>52 && y<height-73 && (!state.tracking || i===state.selected);
    label.hidden=!visible;
    screenCoordinates[i]={x,y,visible};
    if(!visible) continue;
    projectedEdge.copy(world.body.position).addScaledVector(camera.up,planet.size*(planet.ring?2:1)).project(camera);
    const projectedRadius=Math.max(4,Math.abs((projectedEdge.y-projected.y)*height*.5));
    const labelWidth=planet.name.length*6.4+20;
    let labelX=THREE.MathUtils.clamp(x-labelWidth/2,8,width-labelWidth-8);
    let labelY=Math.min(height-65,y+projectedRadius+11);
    for(let attempt=0;attempt<5;attempt++) {
      const overlap=placed.some(r=>labelX<r.x+r.w+5&&labelX+labelWidth>r.x-5&&labelY<r.y+19&&labelY+17>r.y-3);
      if(!overlap) break;
      labelY=labelY+20<height-65?labelY+20:y-projectedRadius-26-attempt*19;
    }
    label.style.transform=`translate(${Math.round(labelX)}px,${Math.round(labelY)}px)`;
    placed.push({x:labelX,y:labelY,w:labelWidth});
    if(i===state.selected) {
      const size=Math.max(25,projectedRadius*2+12);
      $('selection-marker').hidden=false;
      $('selection-marker').style.width=`${size}px`;
      $('selection-marker').style.height=`${size}px`;
      $('selection-marker').style.transform=`translate(${x-size/2}px,${y-size/2}px)`;
    }
  }
  if(!screenCoordinates[state.selected]?.visible) $('selection-marker').hidden=true;
}

function selectAt(event) {
  const rect=renderer.domElement.getBoundingClientRect();
  const x=event.clientX-rect.left,y=event.clientY-rect.top;
  raycaster.setFromCamera(new THREE.Vector2(x/rect.width*2-1,-y/rect.height*2+1),camera);
  const hits=raycaster.intersectObjects(worlds.map(w=>w.mesh),false);
  if(hits.length) { selectPlanet(hits[0].object.userData.planet);return; }
  // A generous screen-space hit target makes small planets selectable on phones.
  let closest=-1,best=25;
  screenCoordinates.forEach((point,i)=> {
    if(!point?.visible) return;
    const distance=Math.hypot(point.x-x,point.y-y);
    if(distance<best) {best=distance;closest=i;}
  });
  if(closest!==-1) selectPlanet(closest);
}

function fallback(message) {
  state.usable=false;
  state.playing=false;
  transition=null;
  updatePlayback();
  if(message) $('fallback-message').textContent=message;
  $('fallback').hidden=false;
  $('scene-labels').hidden=true;
  $('selection-marker').hidden=true;
  ['play-toggle','speed','zoom-in','zoom-out','system-view','inspect'].forEach(id=>$(id).disabled=true);
  if(renderer) renderer.domElement.hidden=true;
  $('view-state').textContent='REFERENCE VIEW';
}

function initializeScene() {
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'default'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.05;
    renderer.setClearColor('#081014',0);
    renderer.domElement.tabIndex=0;
    renderer.domElement.setAttribute('aria-label','Interactive 3D solar system. Arrow keys rotate, plus and minus zoom, Home restores the system view, and Space pauses. Planet selection buttons and reference information follow the view.');
    renderer.domElement.setAttribute('role','img');
    viewport.prepend(renderer.domElement);
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(44,1,.1,450);
    camera.position.copy(HOME);
    controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.dampingFactor=.075;
    controls.enablePan=false;controls.rotateSpeed=.48;controls.zoomSpeed=.72;
    controls.minDistance=3.0;controls.maxDistance=300;
    controls.minPolarAngle=.15;controls.maxPolarAngle=Math.PI/2+.25;
    controls.addEventListener('start',()=>{transition=null;});
    scene.add(new THREE.AmbientLight('#adc4d0',.82));
    const fill=new THREE.DirectionalLight('#b5cad2',1.35);fill.position.set(-40,35,20);scene.add(fill);
    makeStars();
    const sun=makeSun();
    PLANETS.forEach(createWorld);
    positionWorlds();
    state.usable=true;
    resize();showSystem(true);selectPlanet(state.selected,false);
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);
    renderer.domElement.addEventListener('pointerdown',event=>{
      if(pointer.id!==null) {pointer.moved=true;return;}
      pointer.x=event.clientX;pointer.y=event.clientY;pointer.moved=false;pointer.id=event.pointerId;
    });
    renderer.domElement.addEventListener('pointermove',event=>{
      if(pointer.id===event.pointerId && Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>7) pointer.moved=true;
    });
    renderer.domElement.addEventListener('pointerup',event=>{
      if(pointer.id!==event.pointerId) return;
      if(!pointer.moved && event.button===0) selectAt(event);
      pointer.id=null;
    });
    renderer.domElement.addEventListener('pointercancel',()=>{pointer.id=null;pointer.moved=true;});
    renderer.domElement.addEventListener('keydown',event=>{
      if(!state.usable) return;
      if(event.key===' '){event.preventDefault();togglePlayback();return;}
      if(event.key==='+'||event.key==='='){event.preventDefault();zoom(.85);return;}
      if(event.key==='-'||event.key==='_'){event.preventDefault();zoom(1.18);return;}
      if(event.key==='Home'){event.preventDefault();showSystem();return;}
      if(!event.key.startsWith('Arrow')) return;
      event.preventDefault();transition=null;
      const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if(event.key==='ArrowLeft') spherical.theta-=.10;
      if(event.key==='ArrowRight') spherical.theta+=.10;
      if(event.key==='ArrowUp') spherical.phi=THREE.MathUtils.clamp(spherical.phi-.08,controls.minPolarAngle,controls.maxPolarAngle);
      if(event.key==='ArrowDown') spherical.phi=THREE.MathUtils.clamp(spherical.phi+.08,controls.minPolarAngle,controls.maxPolarAngle);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();
    });
    renderer.domElement.addEventListener('webglcontextlost',event=>{
      event.preventDefault();fallback('The WebGL connection was interrupted. Planet reference information remains available. Reload this page to try the 3D view again.');
    });
    function animate(timestamp) {
      if(!state.usable) return;
      requestAnimationFrame(animate);
      const dt=lastFrame ? Math.min((timestamp-lastFrame)/1000,.06) : 0;
      lastFrame=timestamp;
      if(document.hidden) return;
      if(state.playing) {state.time+=dt*state.speed;positionWorlds();sun.rotation.y=state.time*.04;}
      moveCamera(dt);updateLabels();renderer.render(scene,camera);
    }
    requestAnimationFrame(animate);
  } catch(error) {
    console.warn('Aphelion: the 3D view could not be initialized.',error);
    if(renderer) {renderer.dispose();renderer.domElement.remove();}
    fallback();
  }
}

$('play-toggle').addEventListener('click',togglePlayback);
$('speed').addEventListener('input',event=>setSpeed(event.target.value));
$('zoom-in').addEventListener('click',()=>zoom(.82));
$('zoom-out').addEventListener('click',()=>zoom(1.22));
$('system-view').addEventListener('click',()=>{showSystem();announce('Full system view.');});
$('inspect').addEventListener('click',()=>{
  if(state.tracking) {showSystem();announce('Full system view.');}
  else {focusPlanet();announce(`Inspecting ${PLANETS[state.selected].name}. The camera follows its orbit.`);}
});
$('reset').addEventListener('click',()=>{
  state.time=0;state.playing=state.usable&&!reducedMotion;state.tracking=false;
  setSpeed(1);updatePlayback();
  if(state.usable) {positionWorlds();showSystem(true);}
  selectPlanet(2,false);
  if(!state.usable) $('view-state').textContent='REFERENCE VIEW';
  announce('Observatory reset. Earth selected. Original view and rate restored.');
});
const guide=$('field-guide');
$('open-guide').addEventListener('click',()=>guide.showModal());
$('close-guide').addEventListener('click',()=>guide.close());
$('guide-done').addEventListener('click',()=>guide.close());
guide.addEventListener('click',event=>{if(event.target===guide){const r=guide.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) guide.close();}});
document.addEventListener('visibilitychange',()=>{lastFrame=0;});
setSpeed(1);updatePlayback();selectPlanet(2,false);initializeScene();
