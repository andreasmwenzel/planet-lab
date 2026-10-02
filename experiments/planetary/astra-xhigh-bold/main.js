import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

// All distances, sizes and angular speeds below are intentionally designed for play.
const worlds = [
  { id: 'mercury', name: 'Mercury', nickname: 'THE LITTLE SPEEDSTER', color: '#c2b4d1', base: '#a191aa', light: '#e2d2dc', type: 'Rocky planet', year: '88 days', diameter: '4,879 km', description: 'Small, crater-covered and always in a hurry. Mercury races around the Sun faster than any other planet.', radius: .34, orbit: 4.3, pace: .42, phase: .75, tilt: .02 },
  { id: 'venus', name: 'Venus', nickname: 'BEAUTIFUL. BRUTAL.', color: '#ffd4a0', base: '#d99060', light: '#ffe1af', type: 'Rocky planet', year: '225 days', diameter: '12,104 km', description: 'A bright world wrapped in thick clouds. Beneath that soft-looking blanket is the hottest planetary surface in our solar system.', radius: .56, orbit: 6.4, pace: .31, phase: 3.8, tilt: .05 },
  { id: 'earth', name: 'Earth', nickname: 'THE BLUE MARBLE', color: '#7be8d5', base: '#3886b9', light: '#a3edc2', type: 'Rocky planet', year: '365 days', diameter: '12,742 km', description: 'An ocean-covered rock with a very lively surface. So far, the only world we know that has anyone looking back.', radius: .61, orbit: 8.6, pace: .24, phase: 5.7, tilt: .41 },
  { id: 'mars', name: 'Mars', nickname: 'A RUSTY DAYDREAM', color: '#ff9279', base: '#b64b3f', light: '#fc9d72', type: 'Rocky planet', year: '687 days', diameter: '6,779 km', description: 'A dusty red desert with giant volcanoes and two tiny moons. Its rusty color comes from iron minerals in the ground.', radius: .43, orbit: 10.8, pace: .19, phase: 2.2, tilt: .44 },
  { id: 'jupiter', name: 'Jupiter', nickname: 'THE BIG, STRIPY ONE', color: '#f2c5a3', base: '#ad755c', light: '#f1cfac', type: 'Gas giant', year: '11.9 Earth years', diameter: '139,820 km', description: 'Big enough to fit over 1,300 Earths inside. A gas giant wearing cloud stripes and a storm that has lasted for centuries.', radius: 1.28, orbit: 14.2, pace: .125, phase: 4.35, tilt: .055 },
  { id: 'saturn', name: 'Saturn', nickname: 'DRESSED FOR THE OCCASION', color: '#e9d4a4', base: '#bda279', light: '#f6deb0', type: 'Gas giant', year: '29.4 Earth years', diameter: '116,460 km', description: 'An airy giant with an extravagant accessory. Those famous rings are countless pieces of ice and rock, all in orbit together.', radius: 1.04, orbit: 18, pace: .09, phase: 1.05, tilt: .47 },
  { id: 'uranus', name: 'Uranus', nickname: 'THE SIDEWAYS THINKER', color: '#99e4e3', base: '#55aeb9', light: '#b8eeed', type: 'Ice giant', year: '84 Earth years', diameter: '50,724 km', description: 'Pale blue, very cold and magnificently off-kilter. Uranus is tipped so far over that it rolls around the Sun on its side.', radius: .79, orbit: 21.7, pace: .068, phase: 3.4, tilt: 1.71 },
  { id: 'neptune', name: 'Neptune', nickname: 'WAY OUT THERE', color: '#a2acff', base: '#4157b1', light: '#7d9de9', type: 'Ice giant', year: '165 Earth years', diameter: '49,244 km', description: 'Cold, blue and wildly windy. Sunlight takes more than four hours to reach this far-flung edge of the planetary family.', radius: .77, orbit: 25.4, pace: .052, phase: 5.65, tilt: .49 }
];

const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let selected = 2;
let paused = reducedMotion;
let speed = 1;
let simTime = 0;
let available = false;
let follow = false;
let transition = null;
let renderer, scene, camera, controls, sun, sunGlow, orbitGroup, selectionRing;
let bodies = [];
const canvas = $('universe');
const wrap = $('scene-wrap');
const labelElements = [];
const planetButtons = [];
const selectionColor = new THREE.Color('#d9ff61');
const cameraTarget = new THREE.Vector3();
const tempVector = new THREE.Vector3();
const tempProject = new THREE.Vector3();
const clock = new THREE.Clock();
let size = { width: 1, height: 1 };
let lastPointer = null;
let dragging = false;

worlds.forEach((world, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'planet-option';
  button.dataset.id = world.id;
  button.style.setProperty('--planet-color', world.color);
  button.setAttribute('aria-pressed', String(index === selected));
  button.innerHTML = `<span class="planet-swatch" aria-hidden="true"></span><span class="planet-option-text"><b>${world.name}</b><small>${String(index + 1).padStart(2, '0')} / 08</small></span>`;
  button.addEventListener('click', () => selectPlanet(index));
  $('planet-selector').append(button);
  planetButtons.push(button);
  const label = document.createElement('span');
  label.className = `scene-label${index === selected ? ' selected' : ''}`;
  label.textContent = world.name.toUpperCase();
  $('planet-labels').append(label);
  labelElements.push(label);
});

function announce(text) { $('status').textContent = text; }
function selectPlanet(index, speak = true) {
  selected = index;
  const world = worlds[index];
  document.documentElement.style.setProperty('--accent', world.color);
  $('planet-name').textContent = world.name;
  $('planet-number').textContent = `${String(index + 1).padStart(2, '0')} / 08`;
  $('planet-nickname').textContent = world.nickname;
  $('planet-description').textContent = world.description;
  $('planet-year').textContent = world.year;
  $('planet-diameter').textContent = world.diameter;
  $('planet-type').textContent = world.type;
  $('card-planet').style.background = `radial-gradient(circle at 27% 24%, ${world.light} 0%, ${world.color} 40%, #20203b 100%)`;
  $('visit-planet').setAttribute('aria-label', `Take a closer look at ${world.name}`);
  planetButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  labelElements.forEach((label, i) => label.classList.toggle('selected', i === index));
  if (follow && available) visitPlanet();
  if (speak) announce(`${world.name} selected. ${world.nickname}. ${world.description} A year: ${world.year}. Diameter: ${world.diameter}.`);
}

function updatePlayback() {
  $('pause-label').textContent = paused ? 'PLAY' : 'PAUSE';
  $('pause-icon').textContent = paused ? '▶' : 'Ⅱ';
  $('pause').setAttribute('aria-label', paused ? 'Resume simulation' : 'Pause simulation');
  $('live-state').textContent = !available ? 'EXPLORER MODE' : paused ? 'COSMOS ON PAUSE' : 'COSMOS IN MOTION';
  document.querySelector('.live-badge').classList.toggle('paused', paused || !available);
}
function setSpeed(value) {
  speed = value;
  const valueText = `${Number(value.toFixed(1))}×`;
  $('speed').value = String(value);
  $('speed-value').value = valueText;
  $('speed-value').textContent = valueText;
  $('speed').setAttribute('aria-valuetext', `${value} times speed`);
}
$('pause').addEventListener('click', () => { paused = !paused; updatePlayback(); announce(paused ? 'Simulation paused.' : 'Simulation resumed.'); });
$('speed').addEventListener('input', (event) => setSpeed(Number(event.target.value)));
$('paths').addEventListener('click', () => {
  const show = $('paths').getAttribute('aria-pressed') !== 'true';
  $('paths').setAttribute('aria-pressed', String(show));
  if (orbitGroup) orbitGroup.visible = show;
  announce(show ? 'Orbit paths shown.' : 'Orbit paths hidden.');
});
$('overview').addEventListener('click', () => overview());
$('visit-planet').addEventListener('click', visitPlanet);
$('zoom-in').addEventListener('click', () => zoom(.8));
$('zoom-out').addEventListener('click', () => zoom(1.25));
$('reset').addEventListener('click', () => {
  simTime = 0;
  follow = false;
  setSpeed(1);
  paused = reducedMotion;
  selectPlanet(2, false);
  if (available) {
    $('paths').setAttribute('aria-pressed', 'true');
    orbitGroup.visible = true;
    placeBodies();
    overview();
  }
  updatePlayback();
  announce(`Back to the beginning. Earth selected, speed 1 times.${paused ? ' Motion remains paused for your reduced-motion preference.' : ''}`);
});

function makeTexture(world) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 512;
  textureCanvas.height = 256;
  const ctx = textureCanvas.getContext('2d');
  if (!ctx) return null;
  const data = ctx.createImageData(512, 256);
  const base = new THREE.Color(world.base);
  const light = new THREE.Color(world.light);
  const color = new THREE.Color();
  for (let y = 0; y < 256; y++) {
    const lat = y / 256 * Math.PI;
    for (let x = 0; x < 512; x++) {
      const lon = x / 512 * Math.PI * 2;
      const n = Math.sin(lon * 5 + Math.sin(lat * 6) * 2) * .22 + Math.sin(lon * 11 - lat * 9) * .12 + Math.cos(lat * 21 + Math.sin(lon * 7)) * .08;
      let mix = .4 + n;
      if (world.type !== 'Rocky planet' || world.id === 'venus') {
        mix = .5 + Math.sin(lat * (world.id === 'jupiter' ? 42 : 23) + Math.sin(lon * 4 + lat * 3) * .6) * .19 + Math.sin(lat * 93) * .075;
        if (world.id === 'jupiter') {
          const dx = Math.sin((lon - 4.1) / 2) * 2;
          const dy = lat - 1.95;
          if (dx * dx / .08 + dy * dy / .012 < 1) mix = .04;
        }
      }
      if (world.id === 'earth') {
        const land = Math.sin(lon * 3 + Math.sin(lat * 5) * 2.4) + Math.cos(lat * 7 + Math.sin(lon * 2) * 1.6) + Math.sin(lon * 13 + lat * 13) * .18;
        mix = land > .55 ? .72 + n * .2 : .08 + n * .15;
        if (y < 13 || y > 241) mix = .97;
        const cloud = Math.sin(lon * 7 + lat * 17 + Math.sin(lon * 4) * 2) + Math.cos(lon * 3 - lat * 24);
        if (cloud > 1.55) mix = .94;
      }
      color.copy(base).lerp(light, Math.max(0, Math.min(1, mix)));
      const grain = (Math.sin(x * 81.79 + y * 63.33) * 437.11) % 1 * .026;
      const at = (y * 512 + x) * 4;
      data.data[at] = Math.max(0, Math.min(255, (color.r + grain) * 255));
      data.data[at + 1] = Math.max(0, Math.min(255, (color.g + grain) * 255));
      data.data[at + 2] = Math.max(0, Math.min(255, (color.b + grain) * 255));
      data.data[at + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,219,142,1)');
  gradient.addColorStop(.2, 'rgba(255,159,75,.7)');
  gradient.addColorStop(.5, 'rgba(255,109,63,.15)');
  gradient.addColorStop(1, 'rgba(255,82,43,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function circleLine(radius, color, opacity = .2) {
  const points = [];
  for (let i = 0; i <= 160; i++) { const angle = i / 160 * Math.PI * 2; points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)); }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}

function buildScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, .1, 700);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .065;
  controls.enablePan = false;
  controls.minDistance = 3.5;
  controls.maxDistance = 145;
  controls.maxPolarAngle = Math.PI * .88;
  controls.minPolarAngle = .12;
  controls.rotateSpeed = .6;
  controls.zoomSpeed = .8;
  controls.addEventListener('start', () => { transition = null; dragging = true; });
  controls.addEventListener('end', () => { dragging = false; });
  scene.add(new THREE.AmbientLight('#a5a6e2', 1.9));
  const light = new THREE.PointLight('#ffe3b0', 150, 0, 1.1);
  scene.add(light);
  const rimLight = new THREE.DirectionalLight('#c6c4ff', 1.7);
  rimLight.position.set(-20, 30, 15);
  scene.add(rimLight);

  const starPositions = [], starColors = [];
  let seed = 973;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 1100; i++) {
    const theta = random() * Math.PI * 2;
    const cosPhi = random() * 2 - 1;
    const r = 120 + random() * 100;
    const s = Math.sqrt(1 - cosPhi * cosPhi);
    starPositions.push(r * s * Math.cos(theta), r * cosPhi, r * s * Math.sin(theta));
    const tint = random();
    const c = new THREE.Color(tint > .88 ? '#d9ff8a' : tint > .65 ? '#b4a3e2' : '#cfcbd9');
    starColors.push(c.r, c.g, c.b);
  }
  const starsGeometry = new THREE.BufferGeometry();
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  scene.add(new THREE.Points(starsGeometry, new THREE.PointsMaterial({ size: .18, vertexColors: true, transparent: true, opacity: .52, sizeAttenuation: true, depthWrite: false })));

  sun = new THREE.Mesh(new THREE.SphereGeometry(1.65, 48, 32), new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 vPos; varying vec3 vNormal; void main(){vPos=position;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vPos; varying vec3 vNormal; uniform float time; void main(){float p=sin(vPos.x*11.+sin(vPos.y*9.+time*.4)*2.)*sin(vPos.z*13.-time*.2);float q=sin(vPos.y*24.+vPos.x*7.+time*.3)*.12;vec3 color=mix(vec3(1.,.40,.11),vec3(1.,.89,.45),.58+p*.23+q);gl_FragColor=vec4(color,1.);}`
  }));
  scene.add(sun);
  sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: '#ffb469', transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false }));
  sunGlow.scale.setScalar(10);
  scene.add(sunGlow);
  const sunRing = circleLine(2.05, '#ffca8a', .4);
  sunRing.rotation.x = .35;
  scene.add(sunRing);

  orbitGroup = new THREE.Group();
  scene.add(orbitGroup);
  const sphere = new THREE.SphereGeometry(1, 44, 28);
  worlds.forEach((world, index) => {
    const pivot = new THREE.Group();
    const surface = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ map: makeTexture(world), roughness: .93, metalness: 0 }));
    surface.scale.setScalar(world.radius);
    surface.rotation.z = world.tilt;
    surface.userData.planetIndex = index;
    pivot.add(surface);
    if (world.id === 'saturn' || world.id === 'uranus') {
      const rings = new THREE.Group();
      const isSaturn = world.id === 'saturn';
      for (let ringIndex = 0; ringIndex < (isSaturn ? 4 : 1); ringIndex++) {
        const inner = world.radius * (isSaturn ? 1.42 + ringIndex * .21 : 1.65);
        const outer = inner + world.radius * (isSaturn ? .16 : .045);
        const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), new THREE.MeshBasicMaterial({ color: isSaturn ? ['#d0b587', '#f1d9b0', '#958076', '#d2b699'][ringIndex] : '#9de5e0', side: THREE.DoubleSide, transparent: true, opacity: isSaturn ? .75 : .38, depthWrite: false }));
        ring.rotation.x = Math.PI / 2;
        rings.add(ring);
      }
      rings.rotation.z = world.tilt;
      pivot.add(rings);
    }
    scene.add(pivot);
    bodies.push({ pivot, surface, world });
    orbitGroup.add(circleLine(world.orbit, world.color, index === selected ? .29 : .14));
  });
  selectionRing = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.41, 80), new THREE.MeshBasicMaterial({ color: selectionColor, side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false }));
  scene.add(selectionRing);
  placeBodies();
  available = true;
  resize();
  overview(true);
  updatePlayback();
  animate();
}

function placeBodies() {
  bodies.forEach(({ pivot, surface, world }, index) => {
    const angle = world.phase + simTime * world.pace;
    pivot.position.set(Math.cos(angle) * world.orbit, Math.sin(angle * 2 + index) * .18, Math.sin(angle) * world.orbit);
    surface.rotation.y = simTime * (world.id === 'venus' || world.id === 'uranus' ? -.12 : .3) + index;
  });
}
function overview(immediate = false) {
  if (!available) return;
  follow = false;
  const isPhone = size.width < 760;
  const distance = isPhone ? 90 : Math.max(66, 58 / Math.max(.9, size.width / size.height));
  const direction = new THREE.Vector3(24, 37, 44).normalize().multiplyScalar(distance);
  // On phones the target sits above the system, leaving breathing room for the headline.
  const target = new THREE.Vector3(isPhone ? 0 : -2, isPhone ? 10 : 0, 0);
  transition = { position: direction.add(target), target };
  if (immediate || reducedMotion) { camera.position.copy(transition.position); controls.target.copy(target); transition = null; controls.update(); }
  announce('Wide view. Drag or use arrow keys to orbit the whole system.');
}
function visitPlanet() {
  if (!available) return;
  follow = true;
  const body = bodies[selected];
  const distance = Math.max(6, body.world.radius * (size.width < 760 ? 10 : 9));
  const offset = new THREE.Vector3(1, .7, 1.45).normalize().multiplyScalar(distance);
  transition = { position: body.pivot.position.clone().add(offset), target: body.pivot.position.clone(), followIndex: selected, offset };
  if (reducedMotion) { camera.position.copy(transition.position); controls.target.copy(transition.target); transition = null; controls.update(); }
  announce(`Close-up of ${body.world.name}. The camera follows this planet. Choose Wide view to return.`);
}
function zoom(factor) {
  if (!available) return;
  transition = null;
  const offset = camera.position.clone().sub(controls.target);
  const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).add(offset.setLength(distance));
  controls.update();
}
function resize() {
  if (!renderer) return;
  const box = wrap.getBoundingClientRect();
  size = { width: Math.max(1, box.width), height: Math.max(1, box.height) };
  renderer.setSize(size.width, size.height, false);
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
}
function drawLabels() {
  bodies.forEach(({ pivot, world }, index) => {
    tempProject.copy(pivot.position);
    tempProject.y += world.radius + .18;
    tempProject.project(camera);
    const x = (tempProject.x * .5 + .5) * size.width;
    const y = (-tempProject.y * .5 + .5) * size.height;
    const label = labelElements[index];
    const visible = tempProject.z > -1 && tempProject.z < 1 && x > 15 && x < size.width - 20 && y > 12 && y < size.height - 35;
    label.style.display = visible ? 'block' : 'none';
    label.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
  });
}
function animate() {
  if (!available) return;
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);
  if (!paused) simTime += dt * speed;
  placeBodies();
  sun.material.uniforms.time.value = simTime;
  sun.rotation.y = simTime * .02;
  sunGlow.material.opacity = .7 + Math.sin(simTime * .8) * .055;
  if (transition) {
    if (transition.followIndex !== undefined) {
      transition.target.copy(bodies[transition.followIndex].pivot.position);
      transition.position.copy(transition.target).add(transition.offset);
    }
    const blend = reducedMotion ? 1 : 1 - Math.exp(-dt * 5);
    camera.position.lerp(transition.position, blend);
    controls.target.lerp(transition.target, blend);
    if (camera.position.distanceTo(transition.position) < .04 && controls.target.distanceTo(transition.target) < .04) transition = null;
  } else if (follow) {
    cameraTarget.copy(bodies[selected].pivot.position);
    tempVector.subVectors(cameraTarget, controls.target);
    camera.position.add(tempVector);
    controls.target.copy(cameraTarget);
  }
  controls.update();
  const selectedBody = bodies[selected];
  selectionRing.position.copy(selectedBody.pivot.position);
  selectionRing.quaternion.copy(camera.quaternion);
  selectionRing.scale.setScalar(selectedBody.world.radius + .12);
  selectionRing.material.opacity = paused || reducedMotion ? .8 : .65 + Math.sin(simTime * 2) * .2;
  orbitGroup.children.forEach((line, i) => { line.material.opacity = i === selected ? .32 : .13; });
  renderer.render(scene, camera);
  drawLabels();
}

function fallback(message = '') {
  available = false;
  if (controls) controls.dispose();
  canvas.hidden = true;
  $('planet-labels').hidden = true;
  $('webgl-fallback').hidden = false;
  ['pause', 'speed', 'zoom-in', 'zoom-out', 'overview', 'paths', 'visit-planet'].forEach((id) => { $(id).disabled = true; });
  $('scene-help').textContent = 'Explore the planets with the selection buttons below';
  updatePlayback();
  if (message) announce(message);
}
canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); fallback('The 3D view lost its graphics context. Planet facts remain available. Reload this page to try 3D again.'); });
canvas.addEventListener('keydown', (event) => {
  if (!available) return;
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  transition = null;
  if (event.key === '+' || event.key === '=') return zoom(.86);
  if (event.key === '-' || event.key === '_') return zoom(1.16);
  const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if (event.key === 'ArrowLeft') spherical.theta -= .1;
  if (event.key === 'ArrowRight') spherical.theta += .1;
  if (event.key === 'ArrowUp') spherical.phi -= .1;
  if (event.key === 'ArrowDown') spherical.phi += .1;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
  controls.update();
});
canvas.addEventListener('pointerdown', (event) => { lastPointer = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId }; });
canvas.addEventListener('pointerup', (event) => {
  if (!available || !lastPointer || event.pointerId !== lastPointer.id) return;
  const distance = Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
  const elapsed = performance.now() - lastPointer.time;
  lastPointer = null;
  if (distance > 7 || elapsed > 650) return;
  const bounds = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(bodies.map((body) => body.surface), false)[0];
  if (hit) selectPlanet(hit.object.userData.planetIndex);
});
canvas.addEventListener('pointercancel', () => { lastPointer = null; dragging = false; });
window.addEventListener('resize', () => { if (available) { resize(); if (!follow && !dragging) overview(true); } });
document.addEventListener('visibilitychange', () => { clock.getDelta(); });
selectPlanet(2, false);
try { buildScene(); } catch (error) { console.warn('Odd Orbits: 3D unavailable.', error); fallback('3D is unavailable in this browser. You can still explore all eight planets.'); }
if (available && reducedMotion) announce('Motion is paused to match your reduced-motion preference. Press Play when you are ready.');
