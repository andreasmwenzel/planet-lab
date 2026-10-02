import * as THREE from 'three';
import './style.css';

const startedAt = '2026-10-02T06:41:04Z';
const worlds = [
  { id: 'mercury', name: 'Mercury', short: 'Mercury', color: '#b9ad9e', hex: 0xb9ad9e, radius: 3.1, size: .34, orbitTime: 7.8, spin: .9, vibe: 'The speed-runner', lane: 'No. 01 · Hot seat', quip: 'Small world, giant main-character energy.', description: 'First in line and always in a hurry. The little heat-seeker makes a lap before you can blink.' },
  { id: 'venus', name: 'Venus', short: 'Venus', color: '#ffab61', hex: 0xffab61, radius: 4.85, size: .55, orbitTime: 12.2, spin: -.22, vibe: 'The soft-launcher', lane: 'No. 02 · Peach haze', quip: 'Looks dreamy. Keeps its own weather.', description: 'A golden cloud with a mysterious streak. Venus is a glow-up in permanent slow motion.' },
  { id: 'earth', name: 'Earth', short: 'Earth', color: '#51baf7', hex: 0x51baf7, radius: 6.7, size: .6, orbitTime: 17.4, spin: .72, vibe: 'The homebody', lane: 'No. 03 · Blue hour', quip: 'A good place to begin again.', description: 'Blue marble, big feelings. Our bright little home keeps the whole story grounded.' },
  { id: 'mars', name: 'Mars', short: 'Mars', color: '#ff6d61', hex: 0xff6d61, radius: 8.7, size: .46, orbitTime: 24.5, spin: .64, vibe: 'The future founder', lane: 'No. 04 · Red room', quip: 'A little dusty, wildly ambitious.', description: 'The rust-colored daydreamer. Mars has big plans and a collection of excellent sunsets.' },
  { id: 'jupiter', name: 'Jupiter', short: 'Jupiter', color: '#e9b886', hex: 0xe9b886, radius: 11.35, size: 1.38, orbitTime: 39.8, spin: 1.12, vibe: 'The big sibling', lane: 'No. 05 · Giant steps', quip: 'Makes the room feel smaller.', description: 'All gas, all grandeur. Jupiter is the big sibling who somehow makes room for everyone.' },
  { id: 'saturn', name: 'Saturn', short: 'Saturn', color: '#f2d277', hex: 0xf2d277, radius: 14.5, size: 1.08, orbitTime: 57.5, spin: .92, vibe: 'The accessory icon', lane: 'No. 06 · Ring road', quip: 'The fit is doing most of the talking.', description: 'A low-key giant with a high-key ring collection. Saturn never travels without the full look.' },
  { id: 'uranus', name: 'Uranus', short: 'Uranus', color: '#8de3dc', hex: 0x8de3dc, radius: 17.7, size: .78, orbitTime: 76.7, spin: -.55, vibe: 'The lovable oddball', lane: 'No. 07 · Sideways', quip: 'Has never once followed the group chat.', description: 'The cool mint-colored weirdo who rolls around sideways and minds their own business.' },
  { id: 'neptune', name: 'Neptune', short: 'Neptune', color: '#718dff', hex: 0x718dff, radius: 21.15, size: .75, orbitTime: 101, spin: .68, vibe: 'The daydreamer', lane: 'No. 08 · Deep end', quip: 'Always a few thoughts away.', description: 'A far-out blue daydream at the edge of our little neighborhood. Wave when you pass by.' },
];

const host = document.querySelector('#canvas-host');
const tagLayer = document.querySelector('#tag-layer');
const chooser = document.querySelector('#world-chooser');
const fallback = document.querySelector('#fallback');
const pauseButton = document.querySelector('#pause-button');
const pauseLabel = document.querySelector('#pause-label');
const speedSlider = document.querySelector('#speed-slider');
const speedReadout = document.querySelector('#speed-readout');
const nameNode = document.querySelector('#planet-name');
const descriptionNode = document.querySelector('#planet-description');
const swatchNode = document.querySelector('#planet-swatch');
const vibeNode = document.querySelector('#planet-vibe');
const laneNode = document.querySelector('#planet-lane');
const quipNode = document.querySelector('#planet-quip');
const countNode = document.querySelector('.world-count');
const announcement = document.querySelector('#announcement');

let selectedId = 'earth';
let paused = false;
let speed = 1;
let simTime = 0;
let renderer;
let scene;
let camera;
let raycaster;
let pointerNdc;
let lastFrame = 0;
let target = new THREE.Vector3(0, 0, 0);
let cameraSpherical = { theta: 0.3, phi: 1.12, radius: 39.5 };
let worldObjects = [];
let resizeObserver;
let activePointers = new Map();
let pinchDistance = 0;
let dragStart = null;

const menuButtons = new Map();
const tagButtons = new Map();

for (const world of worlds) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'world-choice';
  button.dataset.world = world.id;
  button.setAttribute('aria-pressed', 'false');
  button.style.setProperty('--accent', world.color);
  button.innerHTML = `<span class="choice-dot" aria-hidden="true"></span>${world.short}`;
  button.addEventListener('click', () => selectWorld(world.id));
  chooser.append(button);
  menuButtons.set(world.id, button);

  const tag = document.createElement('button');
  tag.type = 'button';
  tag.className = 'world-tag';
  tag.textContent = world.name;
  tag.setAttribute('aria-label', `Select ${world.name}`);
  tag.setAttribute('aria-pressed', 'false');
  tag.style.setProperty('--accent', world.color);
  tag.addEventListener('click', () => selectWorld(world.id));
  tagLayer.append(tag);
  tagButtons.set(world.id, tag);
}

function selectWorld(id) {
  const world = worlds.find((item) => item.id === id);
  if (!world) return;
  selectedId = id;
  const index = worlds.indexOf(world) + 1;
  nameNode.textContent = world.name;
  descriptionNode.textContent = world.description;
  swatchNode.style.setProperty('--swatch', world.color);
  vibeNode.textContent = world.vibe;
  laneNode.textContent = world.lane;
  quipNode.textContent = world.quip;
  countNode.innerHTML = `${String(index).padStart(2, '0')} <b>/</b> 08`;
  for (const entry of worlds) {
    const active = entry.id === id;
    menuButtons.get(entry.id).setAttribute('aria-pressed', String(active));
    tagButtons.get(entry.id).setAttribute('aria-pressed', String(active));
  }
  announcement.textContent = `${world.name} selected. ${world.vibe}. ${world.description}`;
  const activeMenuButton = menuButtons.get(id);
  if (activeMenuButton) {
    const menuRect = chooser.getBoundingClientRect();
    const buttonRect = activeMenuButton.getBoundingClientRect();
    if (buttonRect.left < menuRect.left || buttonRect.right > menuRect.right) {
      activeMenuButton.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }
}

selectWorld(selectedId);

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 63);
  gradient.addColorStop(0, 'rgba(255,228,151,1)');
  gradient.addColorStop(.13, 'rgba(255,172,76,.62)');
  gradient.addColorStop(.42, 'rgba(255,91,89,.2)');
  gradient.addColorStop(1, 'rgba(255,81,127,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function addStars() {
  const count = 1150;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = 65 + Math.random() * 90;
    const scale = Math.sqrt(1 - u * u);
    positions[i * 3] = r * scale * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * scale * Math.sin(theta);
    sizes[i] = .025 + Math.random() * .07;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xc9d3ff, size: .075, sizeAttenuation: true, transparent: true, opacity: .78, depthWrite: false });
  scene.add(new THREE.Points(geometry, material));

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0x7f64ff, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(-14, 7, -47);
  glow.scale.set(34, 28, 1);
  scene.add(glow);
  const glowTwo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0x38a1be, transparent: true, opacity: .14, depthWrite: false, blending: THREE.AdditiveBlending }));
  glowTwo.position.set(33, -8, -32);
  glowTwo.scale.set(30, 25, 1);
  scene.add(glowTwo);
}

function addSun() {
  const group = new THREE.Group();
  scene.add(group);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1.75, 40, 32),
    new THREE.MeshStandardMaterial({ color: 0xffc66f, emissive: 0xff8a3d, emissiveIntensity: 1.3, roughness: .55 })
  );
  group.add(core);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), transparent: true, opacity: .72, depthWrite: false, blending: THREE.AdditiveBlending }));
  corona.scale.set(8.8, 8.8, 1);
  group.add(corona);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(2.35, .025, 8, 96), new THREE.MeshBasicMaterial({ color: 0xffd477, transparent: true, opacity: .55 }));
  halo.rotation.x = Math.PI / 2;
  group.add(halo);
  const light = new THREE.PointLight(0xffbf6b, 140, 70, 1.65);
  group.add(light);
  const tinyLight = new THREE.PointLight(0xffe1aa, 30, 20, 2);
  tinyLight.position.set(1.7, 1.2, 1.1);
  group.add(tinyLight);
  return group;
}

function createOrbit(radius, color, opacity) {
  const points = [];
  const segments = 192;
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: .22, gapSize: .21, depthWrite: false });
  const line = new THREE.LineLoop(geometry, material);
  line.computeLineDistances();
  scene.add(line);
}

function createPlanet(world, index) {
  createOrbit(world.radius, 0x9996df, index < 4 ? .36 : .27);
  const pivot = new THREE.Group();
  scene.add(pivot);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(world.size, 36, 28),
    new THREE.MeshStandardMaterial({ color: world.hex, roughness: .86, metalness: .02, emissive: world.hex, emissiveIntensity: .045 })
  );
  planet.position.x = world.radius;
  planet.rotation.z = index === 6 ? Math.PI / 2 : 0;
  pivot.add(planet);

  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(world.size * 1.045, 28, 20),
    new THREE.MeshBasicMaterial({ color: world.hex, transparent: true, opacity: .07, side: THREE.BackSide, depthWrite: false })
  );
  highlight.position.copy(planet.position);
  pivot.add(highlight);

  if (world.id === 'saturn') {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(world.size * 1.35, world.size * 2.25, 96),
      new THREE.MeshStandardMaterial({ color: 0xf6d799, roughness: .93, side: THREE.DoubleSide, transparent: true, opacity: .88 })
    );
    ring.rotation.x = Math.PI / 2.17;
    ring.position.copy(planet.position);
    pivot.add(ring);
    const gapRing = new THREE.Mesh(new THREE.RingGeometry(world.size * 1.73, world.size * 1.82, 96), new THREE.MeshBasicMaterial({ color: 0x6f5a51, transparent: true, opacity: .56, side: THREE.DoubleSide }));
    gapRing.rotation.copy(ring.rotation);
    gapRing.position.copy(planet.position);
    pivot.add(gapRing);
  }
  if (world.id === 'earth') {
    const moonPivot = new THREE.Group();
    moonPivot.position.copy(planet.position);
    pivot.add(moonPivot);
    const moonPath = new THREE.Mesh(new THREE.TorusGeometry(1.02, .006, 4, 64), new THREE.MeshBasicMaterial({ color: 0xa0bce8, transparent: true, opacity: .2 }));
    moonPath.rotation.x = Math.PI / 2;
    moonPivot.add(moonPath);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 12), new THREE.MeshStandardMaterial({ color: 0xc5d0e6, roughness: 1 }));
    moon.position.x = 1.02;
    moonPivot.add(moon);
    worldObjects.push({ world: { ...world, isMoon: true }, pivot: moonPivot, mesh: moon, moon: true });
  }
  worldObjects.push({ world, pivot, mesh: planet });
}

function showFallback(reason) {
  fallback.hidden = false;
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
    renderer = undefined;
  }
  host.setAttribute('data-renderer-state', 'unavailable');
  document.querySelector('#live-label').textContent = '3D view unavailable';
  if (reason) console.info('Planet scene fallback:', reason);
}

function setCameraPosition() {
  if (!camera) return;
  const sinPhi = Math.sin(cameraSpherical.phi);
  camera.position.set(
    target.x + cameraSpherical.radius * sinPhi * Math.sin(cameraSpherical.theta),
    target.y + cameraSpherical.radius * Math.cos(cameraSpherical.phi),
    target.z + cameraSpherical.radius * sinPhi * Math.cos(cameraSpherical.theta),
  );
  camera.lookAt(target);
}

function clampZoom(next) {
  cameraSpherical.radius = THREE.MathUtils.clamp(next, 27, 62);
  setCameraPosition();
}

function initScene() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute('aria-label', 'Animated, stylized planetary system. Drag to orbit; use the planet buttons to choose a world.');
    renderer.domElement.setAttribute('role', 'img');
    host.append(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090b26);
    camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, .1, 300);
    setCameraPosition();
    scene.add(new THREE.AmbientLight(0x777ba8, 1.0));
    scene.add(new THREE.HemisphereLight(0xc9dbff, 0x1c1536, 1.1));
    addStars();
    addSun();
    worlds.forEach(createPlanet);
    raycaster = new THREE.Raycaster();
    pointerNdc = new THREE.Vector2();
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(host);
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      showFallback('The graphics context was lost');
    });
    host.setAttribute('data-renderer-state', 'ready');
    requestAnimationFrame(renderFrame);
  } catch (error) {
    showFallback(error?.message || 'WebGL could not be initialized');
  }
}

function onResize() {
  if (!renderer || !camera) return;
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

function updateLabels() {
  if (!camera || !renderer) return;
  const size = new THREE.Vector3();
  renderer.getSize(size);
  for (const { world, mesh, moon } of worldObjects) {
    if (moon) continue;
    const position = mesh.getWorldPosition(new THREE.Vector3());
    position.y += world.size + .44;
    position.project(camera);
    const tag = tagButtons.get(world.id);
    const visible = position.z > -1 && position.z < 1 && Math.abs(position.x) < 1.12 && Math.abs(position.y) < 1.12;
    tag.style.display = visible ? 'block' : 'none';
    if (visible) {
      tag.style.left = `${(position.x * .5 + .5) * size.x}px`;
      tag.style.top = `${(-position.y * .5 + .5) * size.y}px`;
    }
  }
}

function renderFrame(timestamp) {
  if (!renderer) return;
  const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .06) : 0;
  lastFrame = timestamp;
  if (!paused) simTime += dt * speed;
  const solar = Math.sin(simTime * .95) * .06;
  for (const entry of worldObjects) {
    const { world, pivot, mesh, moon } = entry;
    if (moon) {
      pivot.rotation.y = simTime * 1.9;
      continue;
    }
    const angle = (world.orbitTime ? simTime * (Math.PI * 2 / world.orbitTime) : 0) + worlds.indexOf(world) * .5;
    pivot.rotation.y = angle;
    if (!paused) mesh.rotation.y += dt * world.spin * speed;
    if (world.id === 'earth') {
      const moonEntry = worldObjects.find((item) => item.moon);
      if (moonEntry) moonEntry.pivot.rotation.y = simTime * 1.9;
    }
  }
  const sun = scene.children.find((child) => child.isGroup && child.children.some((item) => item.type === 'PointLight'));
  if (sun) sun.scale.setScalar(1 + solar);
  renderer.render(scene, camera);
  updateLabels();
  requestAnimationFrame(renderFrame);
}

function pickPlanet(clientX, clientY) {
  if (!renderer || !raycaster || !camera) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const meshes = worldObjects.filter((entry) => !entry.moon).map((entry) => entry.mesh);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  if (hit) {
    const entry = worldObjects.find((item) => item.mesh === hit.object);
    if (entry) selectWorld(entry.world.id);
  }
}

function getPointerDistance(points) {
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function attachControls() {
  const canvas = host;
  canvas.addEventListener('pointerdown', (event) => {
    if (!renderer || event.target !== renderer.domElement) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 1) dragStart = { x: event.clientX, y: event.clientY, moved: false };
    if (activePointers.size === 2) pinchDistance = getPointerDistance([...activePointers.values()]);
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!activePointers.has(event.pointerId) || !camera) return;
    const prev = activePointers.get(event.pointerId);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 1 && dragStart) {
      const dx = event.clientX - prev.x;
      const dy = event.clientY - prev.y;
      if (Math.abs(event.clientX - dragStart.x) + Math.abs(event.clientY - dragStart.y) > 6) dragStart.moved = true;
      cameraSpherical.theta -= dx * .005;
      cameraSpherical.phi = THREE.MathUtils.clamp(cameraSpherical.phi - dy * .004, .3, Math.PI - .3);
      setCameraPosition();
    } else if (activePointers.size === 2) {
      const distance = getPointerDistance([...activePointers.values()]);
      if (pinchDistance) clampZoom(cameraSpherical.radius - (distance - pinchDistance) * .035);
      pinchDistance = distance;
    }
  });
  const endPointer = (event) => {
    if (!activePointers.has(event.pointerId)) return;
    if (activePointers.size === 1 && dragStart && !dragStart.moved) pickPlanet(event.clientX, event.clientY);
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinchDistance = 0;
    if (activePointers.size === 0) dragStart = null;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (event) => {
    if (!renderer) return;
    event.preventDefault();
    clampZoom(cameraSpherical.radius + Math.sign(event.deltaY) * 1.5);
  }, { passive: false });

  pauseButton.addEventListener('click', () => {
    paused = !paused;
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.setAttribute('aria-label', paused ? 'Resume the planetary motion' : 'Pause the planetary motion');
    pauseLabel.textContent = paused ? 'Resume' : 'Pause';
    pauseButton.querySelector('.pause-icon').textContent = paused ? '▶' : 'Ⅱ';
    document.querySelector('#live-label').textContent = paused ? 'Cosmic time, paused' : 'A tiny universe, live';
    announcement.textContent = paused ? 'Planetary motion paused.' : 'Planetary motion resumed.';
  });
  speedSlider.addEventListener('input', () => {
    speed = Number(speedSlider.value);
    speedReadout.textContent = `${speed.toFixed(1)}×`;
    announcement.textContent = `Simulation speed ${speed.toFixed(1)} times.`;
  });
  document.querySelector('#zoom-in').addEventListener('click', () => clampZoom(cameraSpherical.radius - 3));
  document.querySelector('#zoom-out').addEventListener('click', () => clampZoom(cameraSpherical.radius + 3));
  document.querySelector('#reset-button').addEventListener('click', () => {
    paused = false;
    simTime = 0;
    speed = 1;
    speedSlider.value = '1';
    speedReadout.textContent = '1.0×';
    pauseButton.setAttribute('aria-pressed', 'false');
    pauseButton.setAttribute('aria-label', 'Pause the planetary motion');
    pauseLabel.textContent = 'Pause';
    pauseButton.querySelector('.pause-icon').textContent = 'Ⅱ';
    document.querySelector('#live-label').textContent = 'A tiny universe, live';
    cameraSpherical = { theta: .3, phi: 1.12, radius: 39.5 };
    setCameraPosition();
    selectWorld('earth');
    announcement.textContent = 'Scene reset. Earth selected, normal speed restored, and camera returned to its starting view.';
  });
}

attachControls();
initScene();
