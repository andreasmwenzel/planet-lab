import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLANETS, TAU, DEFAULT_SPEED, orbitPosition, advanceTime, seededRandom, cometPosition } from './simulation.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let paused = prefersReducedMotion.matches;
let speed = DEFAULT_SPEED;
let elapsed = 0;
let selected = PLANETS[2];
let labelsVisible = true;
let toastTimer;
let ready = false;

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3100);
}

for (const planet of PLANETS) {
  const button = document.createElement('button');
  button.className = 'planet-choice';
  button.type = 'button';
  button.title = planet.name;
  button.setAttribute('aria-label', `Explore ${planet.name}`);
  button.dataset.planet = planet.id;
  const swatch = document.createElement('span');
  swatch.className = 'planet-swatch';
  swatch.style.setProperty('--planet', planet.color);
  swatch.setAttribute('aria-hidden', 'true');
  button.append(swatch);
  button.addEventListener('click', () => selectPlanet(planet));
  $('planet-list').append(button);
}

function selectPlanet(planet) {
  selected = planet;
  $('planet-name').textContent = planet.name;
  $('planet-kind').textContent = planet.kind;
  $('planet-description').textContent = planet.description;
  $('planet-mood').textContent = planet.mood;
  $('planet-period').textContent = `${planet.period} seconds at 1×`;
  for (const button of $('planet-list').children) button.setAttribute('aria-pressed', String(button.dataset.planet === planet.id));
  if (ready) {
    for (const body of bodies) {
      const active = body.planet.id === planet.id;
      body.label.classList.toggle('selected', active);
      body.path.material.opacity = active ? .55 : .18;
      body.path.material.color.set(active ? '#8ebc9d' : '#789591');
    }
    if (following) following = bodies.find(body => body.planet.id === selected.id);
  }
}

function updatePlayback() {
  $('pause').setAttribute('aria-label', paused ? 'Play orbits' : 'Pause orbits');
  $('pause').setAttribute('aria-pressed', String(paused));
  $('pause-icon').textContent = paused ? '▶' : 'Ⅱ';
  $('motion-state').textContent = paused ? 'TIME STANDS STILL' : 'LIVE ORBIT';
}
selectPlanet(selected);
updatePlayback();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (error) {
  console.warn('WebGL is unavailable:', error.message);
  $('fallback').hidden = false;
  for (const id of ['pause', 'reset', 'speed', 'comet', 'focus', 'labels-toggle']) $(id).disabled = true;
}

const bodies = [];
let following = null;
if (renderer) initialize();

function initialize() {
  renderer.setClearColor('#0c1b24');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  viewport.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0c1b24', .009);
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 180);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.enablePan = false;
  controls.minDistance = 3.5;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI * .82;
  controls.minPolarAngle = .1;
  controls.addEventListener('start', () => { following = null; cameraTween = null; });
  let cameraTween = null;
  const center = new THREE.Vector3();
  const defaultPosition = new THREE.Vector3(17, 20, 27);
  const world = new THREE.Vector3();
  const projection = new THREE.Vector3();
  let sceneWidth = 1;
  let sceneHeight = 1;

  function resetCamera() {
    following = null;
    cameraTween = null;
    camera.position.copy(defaultPosition);
    controls.target.copy(center);
    controls.update();
  }
  function resize() {
    const rect = viewport.getBoundingClientRect();
    sceneWidth = Math.max(1, rect.width);
    sceneHeight = Math.max(1, rect.height);
    renderer.setSize(sceneWidth, sceneHeight, false);
    camera.aspect = sceneWidth / sceneHeight;
    camera.updateProjectionMatrix();
    defaultPosition.set(17, 20, 27).multiplyScalar(camera.aspect < 1.15 ? 1.25 : 1);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  resize();
  resetCamera();

  scene.add(new THREE.HemisphereLight('#b9d6dc', '#2a3f45', 2.4));
  const sunlight = new THREE.PointLight('#ffdfb0', 75, 60, 1.2);
  sunlight.position.set(0, 1, 0);
  scene.add(sunlight);
  const fill = new THREE.DirectionalLight('#d0e5ef', 2.2);
  fill.position.set(7, 14, 12);
  scene.add(fill);

  // All textures are generated locally; no image assets, services or CDNs.
  function planetTexture(planet, seed) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const random = seededRandom(seed);
    ctx.fillStyle = planet.color;
    ctx.fillRect(0, 0, 512, 256);
    if (planet.id === 'halo' || planet.id === 'taffy') {
      for (let i = 0; i < 33; i++) {
        ctx.fillStyle = i % 3 === 0 ? planet.accent : '#fff3db';
        ctx.globalAlpha = .1 + random() * .16;
        ctx.fillRect(0, random() * 256, 512, 1 + random() * 14);
      }
    } else {
      for (let i = 0; i < 65; i++) {
        ctx.fillStyle = i % 4 === 0 ? '#eaf0ce' : planet.accent;
        ctx.globalAlpha = .15 + random() * .4;
        const x = random() * 512, y = random() * 256, radius = 4 + random() * 25;
        // Duplicate the seam so the surface wraps without a hard edge.
        for (const offset of [-512, 0, 512]) {
          ctx.beginPath();
          for (let j = 0; j <= 16; j++) {
            const angle = j / 16 * TAU;
            const r = radius * (.7 + random() * .6);
            const px = x + offset + Math.cos(angle) * r * 1.7;
            const py = y + Math.sin(angle) * r;
            j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = .06;
    for (let i = 0; i < 14000; i++) {
      ctx.fillStyle = random() > .5 ? '#ffffff' : '#000000';
      ctx.fillRect(random() * 512, random() * 256, 1, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function glowTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,207,129,.8)');
    gradient.addColorStop(.25, 'rgba(255,175,76,.25)');
    gradient.addColorStop(1, 'rgba(255,143,54,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }
  const glowMap = glowTexture();
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 32), new THREE.MeshBasicMaterial({color:'#ffce80'}));
  scene.add(sun);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap, blending:THREE.AdditiveBlending, transparent:true, depthWrite:false, opacity:.7}));
  sunGlow.scale.set(9, 9, 1); scene.add(sunGlow);
  // Sun freckles add a little hand-made character to an otherwise perfect sphere.
  const freckleRandom = seededRandom(2);
  const freckles = new THREE.Group();
  for(let i = 0; i < 35; i++) {
    const theta = freckleRandom()*TAU, phi = Math.acos(2*freckleRandom()-1);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.02+freckleRandom()*.05, 6, 5), new THREE.MeshBasicMaterial({color:'#e8a456',transparent:true,opacity:.3}));
    dot.position.setFromSphericalCoords(1.497, phi, theta); freckles.add(dot);
  }
  sun.add(freckles);

  const random = seededRandom(42);
  const starPositions = new Float32Array(720 * 3);
  const starColors = new Float32Array(720 * 3);
  for(let i=0;i<720;i++) {
    const theta = random()*TAU, phi = Math.acos(2*random()-1), radius = 45+random()*35;
    world.setFromSphericalCoords(radius,phi,theta).toArray(starPositions,i*3);
    const color = new THREE.Color(i%5===0?'#dec49b':'#aac8c5').multiplyScalar(.35+random()*.6);
    color.toArray(starColors,i*3);
  }
  const starsGeometry = new THREE.BufferGeometry();
  starsGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
  starsGeometry.setAttribute('color',new THREE.BufferAttribute(starColors,3));
  scene.add(new THREE.Points(starsGeometry,new THREE.PointsMaterial({size:.075,vertexColors:true,transparent:true,opacity:.9,sizeAttenuation:true})));

  PLANETS.forEach((planet, index) => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(planet.radius,48,32), new THREE.MeshStandardMaterial({map:planetTexture(planet,index+18),roughness:.92,metalness:0}));
    mesh.rotation.z = .15;
    mesh.userData.planet = planet;
    group.add(mesh);
    if (planet.rings) {
      const rings = new THREE.Group();
      for(const [inner,outer,opacity] of [[1.35,1.62,.8],[1.69,1.94,.6],[2,2.18,.35]]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(inner,outer,100),new THREE.MeshStandardMaterial({color:'#d5b48c',side:THREE.DoubleSide,transparent:true,opacity,roughness:1}));
        ring.rotation.x = -Math.PI/2;
        ring.userData.planet = planet;
        rings.add(ring);
      }
      rings.rotation.z = .32; group.add(rings);
    }
    const points = [];
    for(let i=0;i<160;i++) {
      const angle=i/160*TAU;
      points.push(new THREE.Vector3(Math.cos(angle)*planet.orbit,Math.sin(angle)*planet.orbit*planet.tilt,Math.sin(angle)*planet.orbit));
    }
    const path = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#789591',transparent:true,opacity:.18}));
    scene.add(path,group);
    const label = document.createElement('span'); label.className='planet-label'; label.textContent=planet.name.toUpperCase(); $('labels').append(label);
    bodies.push({planet,group,mesh,path,label});
  });

  const comets = [];
  const cometGeometry = new THREE.SphereGeometry(.09,10,8);
  const cometMaterial = new THREE.MeshBasicMaterial({color:'#d1ffe4'});
  function launchComet() {
    if (comets.length >= 4) { toast('A busy sky! Let one comet pass first.'); return; }
    if (paused) { paused = false; updatePlayback(); }
    const head = new THREE.Mesh(cometGeometry,cometMaterial);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32*3),3));
    const trail = new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:'#a9eacc',transparent:true,opacity:.65}));
    scene.add(head,trail);
    comets.push({head,trail,age:0,lane:(random()-.5)*4});
    toast(['One tiny comet. One very big adventure.','Make a wish. No pressure.','Special delivery from the outer cosmos.'][Math.floor(random()*3)]);
  }
  function clearComets() {
    for(const comet of comets) { scene.remove(comet.head,comet.trail); comet.trail.geometry.dispose(); comet.trail.material.dispose(); }
    comets.length=0;
  }
  function reset() {
    elapsed=0; speed=DEFAULT_SPEED; paused=prefersReducedMotion.matches;
    $('speed').value=String(speed); $('speed-value').textContent='1×';
    labelsVisible=true; $('labels').hidden=false; $('labels-toggle').setAttribute('aria-pressed','true');
    clearComets(); resetCamera(); selectPlanet(PLANETS[2]); updatePlayback(); toast('Back to the beginning. A fresh little universe.');
  }
  $('pause').addEventListener('click',()=>{paused=!paused;updatePlayback();});
  $('reset').addEventListener('click',reset);
  $('comet').addEventListener('click',launchComet);
  $('speed').addEventListener('input',event=>{speed=Number(event.target.value);$('speed-value').textContent=`${speed}×`;});
  $('labels-toggle').addEventListener('click',()=>{labelsVisible=!labelsVisible;$('labels').hidden=!labelsVisible;$('labels-toggle').setAttribute('aria-pressed',String(labelsVisible));});
  $('focus').addEventListener('click',()=>{
    following=bodies.find(body=>body.planet.id===selected.id);
    cameraTween={progress:0,start:camera.position.clone(),startTarget:controls.target.clone()};
    toast(`Hello, ${selected.name}. Drag to explore; R returns home.`);
  });
  document.addEventListener('keydown',event=>{
    if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,select,textarea,button,a,[contenteditable]'))return;
    const key=event.key.toLowerCase();
    if(key==='p'){paused=!paused;updatePlayback();event.preventDefault();}
    if(key==='r'){reset();event.preventDefault();}
    if(key==='c'){launchComet();event.preventDefault();}
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown=null;
  function hitTest(event) {
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(bodies.map(body=>body.group),true).find(hit=>hit.object.userData.planet)?.object.userData.planet;
  }
  renderer.domElement.addEventListener('pointerdown',event=>{pointerDown={x:event.clientX,y:event.clientY};});
  renderer.domElement.addEventListener('pointerup',event=>{
    if(pointerDown&&Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y)<7) {
      const planet=hitTest(event); if(planet)selectPlanet(planet);
    }
    pointerDown=null;
  });
  renderer.domElement.addEventListener('pointercancel',()=>{pointerDown=null;});
  renderer.domElement.addEventListener('pointermove',event=>{renderer.domElement.style.cursor=hitTest(event)?'pointer':pointerDown?'grabbing':'grab';});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();paused=true;updatePlayback();toast('The graphics context paused. Reload to restore your universe.');});

  ready=true;
  selectPlanet(selected);
  let previous=performance.now();
  function frame(now) {
    const delta=Math.min((now-previous)/1000,.1);previous=now;
    if(document.hidden)return;
    elapsed=advanceTime(elapsed,delta,speed,paused);
    sun.rotation.y=elapsed*.035;
    for(const body of bodies) {
      const position=orbitPosition(body.planet,elapsed);
      body.group.position.set(position.x,position.y,position.z);
      body.mesh.rotation.y=elapsed*.17;
    }
    if(following) {
      const target=following.group.position;
      const distance=following.planet.rings?8:5;
      const desired=target.clone().add(new THREE.Vector3(distance*.75,distance*.5,distance));
      if(cameraTween) {
        cameraTween.progress=Math.min(1,cameraTween.progress+delta*1.3);
        const smooth=1-Math.pow(1-cameraTween.progress,3);
        camera.position.lerpVectors(cameraTween.start,desired,smooth);
        controls.target.lerpVectors(cameraTween.startTarget,target,smooth);
        if(cameraTween.progress>=1)cameraTween=null;
      } else {
        camera.position.add(target.clone().sub(controls.target));
        controls.target.copy(target);
      }
    }
    controls.update();
    for(const body of bodies) {
      projection.copy(body.group.position); projection.y+=body.planet.radius+.38; projection.project(camera);
      const x=(projection.x*.5+.5)*sceneWidth, y=(-projection.y*.5+.5)*sceneHeight;
      body.label.style.left=`${x}px`;body.label.style.top=`${y}px`;
      body.label.style.display=projection.z>1||projection.z< -1||x<22||x>sceneWidth-22||y<45||y>sceneHeight-45?'none':'';
    }
    for(let i=comets.length-1;i>=0;i--) {
      const comet=comets[i];
      if(!paused)comet.age+=delta*speed;
      const progress=comet.age/5;
      if(progress>1){scene.remove(comet.head,comet.trail);comet.trail.geometry.dispose();comet.trail.material.dispose();comets.splice(i,1);continue;}
      const pos=cometPosition(progress,comet.lane);comet.head.position.set(pos.x,pos.y,pos.z);
      const positions=comet.trail.geometry.attributes.position;
      for(let j=0;j<32;j++){const p=cometPosition(progress-j*.0035,comet.lane);positions.setXYZ(j,p.x,p.y,p.z);}
      positions.needsUpdate=true;
      comet.trail.geometry.computeBoundingSphere();
      comet.trail.material.opacity=Math.min(1,progress*10,(1-progress)*10)*.7;
    }
    renderer.render(scene,camera);
  }
  renderer.setAnimationLoop(frame);
  if(import.meta.hot)import.meta.hot.dispose(()=>{renderer.setAnimationLoop(null);resizeObserver.disconnect();controls.dispose();renderer.dispose();});
}
