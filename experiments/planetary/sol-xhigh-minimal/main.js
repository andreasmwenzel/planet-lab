import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const worlds = [
  { id: 'mercury', name: 'Mercury', kind: 'Rocky planet', subtitle: 'The restless inner world', description: 'Small, cratered, and closest to the Sun. Our quickest little traveler makes a lap before the outer worlds have moved very far.', color: '#a29a88', light: '#d2c6ae', radius: .29, distance: 4.5, period: 18, phase: 2.7, moons: 0, texture: 'craters' },
  { id: 'venus', name: 'Venus', kind: 'Rocky planet', subtitle: 'A world behind a veil', description: 'A warm-colored globe wrapped in thick clouds. Its softly banded surface here represents the cloud tops, rather than the ground hidden beneath.', color: '#d0b583', light: '#eee0b0', radius: .46, distance: 6.7, period: 31, phase: .9, moons: 0, texture: 'clouds' },
  { id: 'earth', name: 'Earth', kind: 'Rocky planet', subtitle: 'Our blue marble', description: 'Blue oceans, green land, and a sweep of white clouds. Visit up close to find our familiar companion tracing its own tiny orbit.', color: '#79a9ce', light: '#c0dfe6', radius: .49, distance: 9.1, period: 48, phase: 4.65, moons: 1, texture: 'earth' },
  { id: 'mars', name: 'Mars', kind: 'Rocky planet', subtitle: 'A rust-red wanderer', description: 'A dusty red world with pale polar caps. Its two tiny companions make a miniature system of their own. Slow time down and take a closer look.', color: '#c38268', light: '#eac1a0', radius: .36, distance: 11.8, period: 68, phase: 1.9, moons: 2, texture: 'craters' },
  { id: 'jupiter', name: 'Jupiter', kind: 'Gas giant', subtitle: 'A giant with a little company', description: 'Broad cloud bands and a swirling red spot mark our largest planet. Four representative moons dance around it in this pocket-sized interpretation.', color: '#c8aa84', light: '#ebd9ad', radius: 1.08, distance: 15.9, period: 112, phase: 3.65, moons: 4, texture: 'bands' },
  { id: 'saturn', name: 'Saturn', kind: 'Gas giant', subtitle: 'The ringed daydream', description: 'A pale golden world inside a wide, tilted halo. Its rings are made from many particles in reality; here, a few translucent bands capture their shape.', color: '#bfae89', light: '#ede1b3', radius: .89, distance: 20, period: 156, phase: .55, moons: 1, texture: 'bands', rings: true },
  { id: 'uranus', name: 'Uranus', kind: 'Ice giant', subtitle: 'A quiet turquoise world', description: 'Soft blue-green clouds and an unusually tilted spin make this world stand apart. Its faint rings are drawn a little brighter here so you can spot them.', color: '#80bbc0', light: '#c6e9df', radius: .66, distance: 24.3, period: 208, phase: 2.35, moons: 2, texture: 'clouds', rings: true },
  { id: 'neptune', name: 'Neptune', kind: 'Ice giant', subtitle: 'Blue at the edge of the map', description: 'Our farthest planet is a deep-blue, windy world. Its long journey is dramatically shortened here, so even the edge of the system can join the dance.', color: '#628dbd', light: '#9ab9e5', radius: .64, distance: 28.7, period: 280, phase: 5.5, moons: 1, texture: 'clouds' },
];

const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let selected = 2;
let playing = !reducedMotion;
let speed = 1;
let elapsed = 0;
let ready = false;
let closeUp = false;
let view = 'angled';
let renderer, scene, camera, controls, star, halo;
let cameraTween = null;
let lastFollowPosition = new THREE.Vector3();
let lastTick = performance.now();
let lastTimeLabel = '';
const bodies = [];
const hitTargets = [];
const labelButtons = [];
const raycaster = new THREE.Raycaster();
const screenVector = new THREE.Vector3();
const targetVector = new THREE.Vector3();
const pointer = new THREE.Vector2();
const frame = $('cosmos');
const sceneMount = $('scene');

function announce(text) { $('announcement').textContent = text; }

worlds.forEach((world, index) => {
  const button = document.createElement('button');
  button.className = 'planet-option';
  button.style.setProperty('--planet-color', world.color);
  button.style.setProperty('--planet-light', world.light);
  button.setAttribute('aria-pressed', String(index === selected));
  button.innerHTML = `<span class="number">${String(index + 1).padStart(2, '0')}</span><span class="world-dot ${world.rings && world.id === 'saturn' ? 'is-saturn' : ''}" aria-hidden="true"></span><span class="option-name">${world.name}</span><span class="option-arrow" aria-hidden="true">↗</span>`;
  button.addEventListener('click', () => selectWorld(index));
  $('planet-list').append(button);

  const label = document.createElement('button');
  label.className = 'world-label';
  label.textContent = world.name;
  label.setAttribute('aria-label', `Select ${world.name}`);
  label.setAttribute('aria-pressed', String(index === selected));
  label.hidden = true;
  label.addEventListener('click', () => selectWorld(index));
  $('labels').append(label);
  labelButtons.push(label);
});

function selectWorld(index, shouldAnnounce = true) {
  selected = index;
  const world = worlds[index];
  $('world-name').textContent = world.name;
  $('world-index').textContent = `${String(index + 1).padStart(2, '0')} / 08`;
  $('world-kind').textContent = world.kind.toUpperCase();
  $('world-subtitle').textContent = world.subtitle;
  $('world-description').textContent = world.description;
  $('fact-lane').textContent = `${String(index + 1).padStart(2, '0')} of 08`;
  $('fact-orbit').textContent = `${world.period} seconds`;
  $('fact-moons').textContent = String(world.moons);
  $('portrait').dataset.world = world.id;
  document.querySelector('.inspector').style.setProperty('--world-color', world.color);
  document.querySelector('.inspector').style.setProperty('--world-light', world.light);
  [...$('planet-list').children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  labelButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  bodies.forEach((body, i) => {
    body.orbit.material.color.set(i === index ? '#a8cca3' : '#617975');
    body.orbit.material.opacity = i === index ? .55 : .19;
  });
  if (closeUp && ready) focusWorld();
  if (shouldAnnounce) announce(`${world.name} selected. ${world.kind}. ${world.period}-second stylized orbit at normal speed.`);
}

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeTexture(world, index) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const rand = seeded(index * 731 + 12);
  ctx.fillStyle = world.color;
  ctx.fillRect(0, 0, 512, 256);
  if (world.texture === 'earth') {
    ctx.fillStyle = '#3f83a6';
    ctx.fillRect(0, 0, 512, 256);
    const continents = [
      [[65, 44], [114, 29], [153, 44], [153, 68], [132, 83], [120, 108], [97, 112], [85, 78], [66, 72]],
      [[130, 113], [152, 109], [170, 143], [151, 180], [139, 200], [128, 166], [118, 138]],
      [[265, 66], [298, 42], [330, 53], [358, 38], [404, 53], [437, 76], [417, 97], [383, 86], [352, 110], [328, 93], [316, 122], [284, 107]],
      [[273, 108], [310, 108], [326, 144], [306, 179], [280, 169], [266, 134]],
      [[395, 173], [431, 165], [448, 180], [424, 198], [393, 193]],
    ];
    for (const points of continents) {
      ctx.beginPath();
      points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
      ctx.fillStyle = '#729f82';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#8ca78a88';
      ctx.stroke();
    }
    ctx.fillStyle = '#e1e9dc';
    ctx.fillRect(0, 0, 512, 11);
    ctx.fillRect(0, 243, 512, 13);
    for (let i = 0; i < 36; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * 512, 20 + rand() * 211, 8 + rand() * 45, 1 + rand() * 4, -.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff40';
      ctx.fill();
    }
  } else if (world.texture === 'bands' || world.texture === 'clouds') {
    const base = new THREE.Color(world.color);
    for (let y = 0; y < 256; y += 2) {
      const stripe = base.clone().multiplyScalar(0.85 + Math.sin(y * (world.texture === 'bands' ? .20 : .068)) * .1 + rand() * .20);
      ctx.fillStyle = `#${stripe.getHexString()}`;
      ctx.fillRect(0, y, 512, 2);
    }
    for (let i = 0; i < 100; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * 512, rand() * 256, 10 + rand() * 55, 1 + rand() * 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = rand() > .5 ? '#fff2d113' : '#15252613';
      ctx.fill();
    }
    if (world.id === 'jupiter') {
      ctx.beginPath();
      ctx.ellipse(343, 162, 27, 12, -.08, 0, Math.PI * 2);
      ctx.fillStyle = '#af795e';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#dec09c99';
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 650; i++) {
      const x = rand() * 512, y = rand() * 256, radius = 1 + rand() * 9;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = rand() > .5 ? '#fff7db17' : '#251b2022';
      ctx.fill();
      if (i % 4 === 0) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#fbe4bc22';
        ctx.stroke();
      }
    }
    if (world.id === 'mars') {
      ctx.fillStyle = '#e5d7be';
      ctx.fillRect(0, 0, 512, 11);
      ctx.fillRect(0, 248, 512, 8);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  return texture;
}

function makeGlow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 9, 64, 64, 64);
  gradient.addColorStop(0, '#ffe0a8bb');
  gradient.addColorStop(.22, '#f5b25e88');
  gradient.addColorStop(.44, '#ec984331');
  gradient.addColorStop(1, '#db803000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sprite.scale.set(12.5, 12.5, 1);
  return sprite;
}

function circleLine(radius, color, opacity, segments = 160) {
  const points = [];
  for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}

function makeRings(world) {
  const group = new THREE.Group();
  const bands = world.id === 'saturn' ? [[1.35, 1.58, .35], [1.63, 1.93, .75], [1.96, 2.08, .35]] : [[1.35, 1.4, .30], [1.61, 1.65, .24]];
  bands.forEach(([inner, outer, opacity]) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(world.radius * inner, world.radius * outer, 128), new THREE.MeshStandardMaterial({ color: world.id === 'saturn' ? '#c6b790' : '#93b5b7', transparent: true, opacity, roughness: 1, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
  });
  group.rotation.z = world.id === 'saturn' ? .40 : 1.2;
  return group;
}

function setupScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x10171c, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '3D solar system. Use arrow keys to orbit, plus and minus to zoom. Select planets using the labeled buttons.');
  sceneMount.append(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(43, 1, .05, 600);
  camera.position.copy(overviewPosition('angled'));
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .075;
  controls.enablePan = false;
  controls.minDistance = 2.4;
  controls.maxDistance = 135;
  controls.minPolarAngle = .015;
  controls.maxPolarAngle = Math.PI * .91;
  controls.rotateSpeed = .65;
  controls.zoomSpeed = .85;
  controls.addEventListener('start', () => { cameraTween = null; });

  scene.add(new THREE.HemisphereLight('#c7e2e4', '#405e64', .65));
  scene.add(new THREE.PointLight('#ffe7bd', 95, 0, 1));

  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = 512; sunCanvas.height = 256;
  const sunCtx = sunCanvas.getContext('2d');
  sunCtx.fillStyle = '#f7ba66'; sunCtx.fillRect(0, 0, 512, 256);
  const sunRandom = seeded(17);
  for (let i = 0; i < 1800; i++) {
    sunCtx.beginPath();
    sunCtx.arc(sunRandom() * 512, sunRandom() * 256, sunRandom() * 3 + .3, 0, Math.PI * 2);
    sunCtx.fillStyle = sunRandom() > .5 ? '#fff3be35' : '#db70231f';
    sunCtx.fill();
  }
  const sunMap = new THREE.CanvasTexture(sunCanvas);
  sunMap.colorSpace = THREE.SRGBColorSpace;
  star = new THREE.Mesh(new THREE.SphereGeometry(2.08, 64, 40), new THREE.MeshBasicMaterial({ map: sunMap, toneMapped: false }));
  scene.add(star, makeGlow());

  const starRandom = seeded(191);
  const positions = new Float32Array(1300 * 3);
  const colors = new Float32Array(1300 * 3);
  for (let i = 0; i < 1300; i++) {
    const theta = starRandom() * Math.PI * 2;
    const cosPhi = starRandom() * 2 - 1;
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
    const radius = 150 + starRandom() * 100;
    positions.set([radius * sinPhi * Math.cos(theta), radius * cosPhi, radius * sinPhi * Math.sin(theta)], i * 3);
    const brightness = .35 + starRandom() * .5;
    colors.set([brightness * .9, brightness, brightness * .96], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: .22, vertexColors: true, transparent: true, opacity: .8, depthWrite: false, sizeAttenuation: true })));

  worlds.forEach((world, index) => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(world.radius, 40, 28), new THREE.MeshStandardMaterial({ map: makeTexture(world, index), roughness: .92 }));
    mesh.rotation.z = world.id === 'uranus' ? 1.3 : .1 + index * .025;
    group.add(mesh);
    const orbit = circleLine(world.distance, '#617975', .19);
    scene.add(orbit, group);
    if (world.rings) group.add(makeRings(world));
    const moonMeshes = [];
    for (let m = 0; m < world.moons; m++) {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(.065 + m * .006, 14, 10), new THREE.MeshStandardMaterial({ color: m % 2 ? '#a6a399' : '#d5cbb5', roughness: 1 }));
      group.add(moon);
      moonMeshes.push(moon);
    }
    // The generous invisible target makes small worlds easier to pick.
    const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(.7, world.radius * 1.2), 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.index = index;
    group.add(hit);
    hitTargets.push(hit);
    bodies.push({ group, mesh, orbit, moons: moonMeshes });
  });

  halo = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 80 }, (_, i) => new THREE.Vector3(Math.cos(i / 80 * Math.PI * 2), Math.sin(i / 80 * Math.PI * 2), 0))), new THREE.LineBasicMaterial({ color: '#c2e4b7', transparent: true, opacity: .7, depthTest: false }));
  halo.renderOrder = 8;
  scene.add(halo);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    showFallback('The graphics connection was interrupted. Planet field notes are still available. Reload the page to try the 3D view again.');
  });
  installPointerSelection();
  installCameraKeyboard();
  new ResizeObserver(resizeScene).observe(frame);
  ready = true;
  resizeScene();
  updateBodies();
  selectWorld(selected, false);
  renderer.render(scene, camera);
}

function overviewPosition(mode = view) {
  const narrow = frame.clientWidth < 480;
  const distance = narrow ? 95 : 85;
  if (mode === 'top') return new THREE.Vector3(0, distance, .1);
  return new THREE.Vector3(.42, .54, .73).normalize().multiplyScalar(distance);
}

function resizeScene() {
  if (!renderer || !camera || !ready) return;
  const width = Math.max(1, frame.clientWidth);
  const height = Math.max(1, frame.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  // Fit the outer orbit on very narrow viewports while keeping manual zoom available.
  if (!closeUp && !cameraTween) {
    const offset = camera.position.clone().sub(controls.target);
    const minFitDistance = 32 / Math.tan(THREE.MathUtils.degToRad(43 / 2)) / Math.min(camera.aspect, 1);
    if (offset.length() < minFitDistance) {
      camera.position.copy(controls.target).add(offset.setLength(Math.min(130, minFitDistance)));
    }
  }
}

function updateBodies() {
  bodies.forEach((body, index) => {
    const world = worlds[index];
    const angle = world.phase + elapsed * Math.PI * 2 / world.period;
    body.group.position.set(Math.cos(angle) * world.distance, 0, Math.sin(angle) * world.distance);
    body.mesh.rotation.y = elapsed * (.24 + index * .025);
    body.moons.forEach((moon, m) => {
      const radius = world.radius * (world.rings ? 2.5 : 1.7) + m * .21 + .15;
      const moonAngle = elapsed * (.7 - m * .1) + m * 2.1;
      moon.position.set(Math.cos(moonAngle) * radius, Math.sin(moonAngle * 1.4) * .06, Math.sin(moonAngle) * radius);
    });
  });
  if (star) star.rotation.y = elapsed * .075;
}

function startCameraTween(position, target, movingTarget = false) {
  if (reducedMotion) {
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
    cameraTween = null;
    lastFollowPosition.copy(target);
    return;
  }
  cameraTween = { start: performance.now(), fromPosition: camera.position.clone(), toPosition: position.clone(), fromTarget: controls.target.clone(), toTarget: target.clone(), movingTarget };
}

function focusWorld() {
  if (!ready) return;
  closeUp = true;
  const world = worlds[selected];
  const target = bodies[selected].group.position.clone();
  const offset = camera.position.clone().sub(controls.target).normalize().multiplyScalar(Math.max(4.8, world.radius * 7));
  if (offset.y < 1) offset.y = 1.5;
  lastFollowPosition.copy(target);
  startCameraTween(target.clone().add(offset), target, true);
  updateVisitButton();
}

function overview(mode = view, animate = true) {
  if (!ready) return;
  closeUp = false;
  view = mode;
  const position = overviewPosition(mode);
  const minFitDistance = 32 / Math.tan(THREE.MathUtils.degToRad(43 / 2)) / Math.min(camera.aspect, 1);
  if (position.length() < minFitDistance) position.setLength(Math.min(130, minFitDistance));
  if (animate) startCameraTween(position, new THREE.Vector3());
  else { cameraTween = null; camera.position.copy(position); controls.target.set(0, 0, 0); controls.update(); }
  $('angled-view').setAttribute('aria-pressed', String(mode === 'angled'));
  $('top-view').setAttribute('aria-pressed', String(mode === 'top'));
  $('angled-view').classList.toggle('active', mode === 'angled');
  $('top-view').classList.toggle('active', mode === 'top');
  updateVisitButton();
}

function updateVisitButton() {
  $('visit-text').textContent = closeUp ? 'Return to overview' : 'Explore up close';
  $('visit-arrow').textContent = closeUp ? '↙' : '↗';
}

function updatePlayButton() {
  $('play-text').textContent = playing ? 'Pause' : 'Resume';
  $('play-icon').textContent = playing ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-label', playing ? 'Pause simulation' : 'Resume simulation');
  $('scene-state').textContent = !ready ? '3D UNAVAILABLE' : playing ? 'IN MOTION' : 'TIME IS STILL';
  document.querySelector('.scene-tag').classList.toggle('is-paused', !playing || !ready);
}

function togglePlaying() {
  if (!ready) return;
  playing = !playing;
  updatePlayButton();
  announce(playing ? 'Simulation resumed.' : 'Simulation paused. You can still move the camera and explore planets.');
}

function showFallback(message) {
  ready = false;
  playing = false;
  if (renderer) renderer.domElement.style.display = 'none';
  $('fallback').hidden = false;
  if (message) $('fallback').querySelector('p:not(.eyebrow)').textContent = message;
  labelButtons.forEach((button) => { button.hidden = true; });
  ['play', 'speed', 'orbits', 'show-labels', 'visit', 'angled-view', 'top-view'].forEach((id) => { $(id).disabled = true; });
  $('visit-text').textContent = '3D view unavailable';
  document.querySelector('.gesture-note').textContent = 'Choose a world to read its field notes';
  updatePlayButton();
  announce('3D view unavailable. Choose a world to read its field notes.');
}

function installPointerSelection() {
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    down = { x: event.clientX, y: event.clientY, time: performance.now() };
  });
  renderer.domElement.addEventListener('pointercancel', () => { down = null; });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!down || !ready) return;
    const wasTap = Math.hypot(event.clientX - down.x, event.clientY - down.y) < 7 && performance.now() - down.time < 500;
    down = null;
    if (!wasTap) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hitTargets, false)[0];
    if (hit) selectWorld(hit.object.userData.index);
  });
}

function installCameraKeyboard() {
  renderer.domElement.addEventListener('keydown', (event) => {
    if (!ready) return;
    const accepted = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Home'];
    if (!accepted.includes(event.key)) return;
    event.preventDefault();
    cameraTween = null;
    if (event.key === 'Home') { overview(); return; }
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= .10;
    if (event.key === 'ArrowRight') spherical.theta += .10;
    if (event.key === 'ArrowUp') spherical.phi -= .08;
    if (event.key === 'ArrowDown') spherical.phi += .08;
    if (event.key === '+' || event.key === '=') spherical.radius *= .88;
    if (event.key === '-' || event.key === '_') spherical.radius *= 1.14;
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
  });
}

function resetAll() {
  elapsed = 0;
  speed = 1;
  playing = ready && !reducedMotion;
  closeUp = false;
  $('speed').value = '1';
  $('speed-value').textContent = '1×';
  $('speed').setAttribute('aria-valuetext', '1 times normal speed');
  $('orbits').checked = true;
  $('show-labels').checked = true;
  bodies.forEach((body) => { body.orbit.visible = true; });
  updateBodies();
  selectWorld(2, false);
  if (ready) overview('angled', false);
  $('elapsed').textContent = '00:00';
  lastTimeLabel = '00:00';
  updateVisitButton();
  updatePlayButton();
  announce('Reset complete. Earth selected, normal speed, initial positions, angled overview.');
}

$('play').addEventListener('click', togglePlaying);
$('visit').addEventListener('click', () => {
  if (!ready) return;
  if (closeUp) { overview(); announce('Returned to the whole system.'); }
  else { focusWorld(); announce(`Following ${worlds[selected].name} up close.`); }
});
$('reset').addEventListener('click', resetAll);
$('speed').addEventListener('input', (event) => {
  speed = Number(event.target.value);
  const text = Number.isInteger(speed) ? speed.toFixed(0) : String(speed);
  $('speed-value').textContent = `${text}×`;
  event.target.setAttribute('aria-valuetext', `${text} times normal speed`);
});
$('orbits').addEventListener('change', (event) => bodies.forEach((body) => { body.orbit.visible = event.target.checked; }));
$('angled-view').addEventListener('click', () => { overview('angled'); announce('Angled system view.'); });
$('top-view').addEventListener('click', () => { overview('top'); announce('Top-down system view.'); });

const helpDialog = $('help-dialog');
$('help').addEventListener('click', () => helpDialog.showModal());
$('close-help').addEventListener('click', () => helpDialog.close());
$('done-help').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('click', (event) => {
  if (event.target !== helpDialog) return;
  const rect = helpDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) helpDialog.close();
});
document.addEventListener('keydown', (event) => {
  if (helpDialog.open || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
  if (event.code === 'Space') { event.preventDefault(); togglePlaying(); }
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); resetAll(); }
  if (event.key === 'Escape' && closeUp) { overview(); announce('Returned to the whole system.'); }
});

function tick(now) {
  requestAnimationFrame(tick);
  const delta = Math.min((now - lastTick) / 1000, .06);
  lastTick = now;
  if (!ready || document.hidden) return;
  if (playing) elapsed += delta * speed;
  updateBodies();

  if (cameraTween) {
    const transition = cameraTween;
    const progress = THREE.MathUtils.clamp((now - transition.start) / 900, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    let toPosition = transition.toPosition;
    let toTarget = transition.toTarget;
    if (transition.movingTarget && closeUp) {
      toTarget = bodies[selected].group.position;
      toPosition = transition.toPosition.clone().add(targetVector.copy(toTarget).sub(transition.toTarget));
    }
    camera.position.lerpVectors(transition.fromPosition, toPosition, eased);
    controls.target.lerpVectors(transition.fromTarget, toTarget, eased);
    lastFollowPosition.copy(toTarget);
    if (progress === 1) cameraTween = null;
  } else if (closeUp) {
    targetVector.copy(bodies[selected].group.position).sub(lastFollowPosition);
    camera.position.add(targetVector);
    controls.target.add(targetVector);
    lastFollowPosition.copy(bodies[selected].group.position);
  }
  controls.update();
  halo.position.copy(bodies[selected].group.position);
  halo.scale.setScalar(worlds[selected].radius * (worlds[selected].rings ? 2.2 : 1.6));
  halo.quaternion.copy(camera.quaternion);
  renderer.render(scene, camera);

  const width = frame.clientWidth, height = frame.clientHeight;
  const cameraDirection = camera.getWorldDirection(targetVector);
  bodies.forEach((body, i) => {
    const label = labelButtons[i];
    screenVector.copy(body.group.position);
    const inFront = screenVector.clone().sub(camera.position).dot(cameraDirection) > 0;
    screenVector.project(camera);
    const x = (screenVector.x * .5 + .5) * width;
    const y = (-screenVector.y * .5 + .5) * height;
    const visible = $('show-labels').checked && inFront && screenVector.z < 1 && x > 20 && x < width - 20 && y > 40 && y < height - 70;
    label.hidden = !visible;
    if (visible) { label.style.left = `${x}px`; label.style.top = `${y + worlds[i].radius * (closeUp ? 13 : 2)}px`; }
  });

  const wholeSeconds = Math.floor(elapsed);
  const timeLabel = `${String(Math.floor(wholeSeconds / 60)).padStart(2, '0')}:${String(wholeSeconds % 60).padStart(2, '0')}`;
  if (timeLabel !== lastTimeLabel) { $('elapsed').textContent = timeLabel; lastTimeLabel = timeLabel; }
}

selectWorld(selected, false);
try { setupScene(); }
catch (error) { console.warn('Orbit Lab: WebGL scene could not start.', error); showFallback(); }
updatePlayButton();
requestAnimationFrame(tick);
