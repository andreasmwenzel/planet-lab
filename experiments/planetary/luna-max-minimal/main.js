import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const planets = [
  {
    id: 'mercury', name: 'Mercury', kind: 'Terrestrial planet', order: 'FIRST FROM THE SUN',
    color: '#b8a99a', palette: ['#5c5049', '#c0b2a1', '#86786d'], radius: 0.37, orbit: 5.4, speed: 0.54, spin: 0.24, tilt: 0.03,
    distance: '0.39 AU', year: '88 days',
    description: 'A small, scarred world that swings through the Sun’s fierce neighborhood.',
    fact: 'Mercury has a surprisingly large iron core for its size.',
  },
  {
    id: 'venus', name: 'Venus', kind: 'Terrestrial planet', order: 'SECOND FROM THE SUN',
    color: '#e7b66f', palette: ['#b56b32', '#e6c17d', '#cb8744'], radius: 0.62, orbit: 8.0, speed: 0.39, spin: -0.08, tilt: 0.07,
    distance: '0.72 AU', year: '225 days',
    description: 'A bright, cloud-wrapped world with a thick atmosphere and a hidden surface.',
    fact: 'Venus spins backward compared with most planets.',
  },
  {
    id: 'earth', name: 'Earth', kind: 'Terrestrial planet', order: 'THIRD FROM THE SUN',
    color: '#6fb9c8', palette: ['#124c7d', '#2d9b83', '#73c6d1'], radius: 0.66, orbit: 10.8, speed: 0.30, spin: 0.58, tilt: 0.41,
    distance: '1.00 AU', year: '365 days',
    description: 'Our pale blue dot: the only known world with liquid water on its surface and life in abundance.',
    fact: 'A single day-night cycle takes about 24 hours.',
  },
  {
    id: 'mars', name: 'Mars', kind: 'Terrestrial planet', order: 'FOURTH FROM THE SUN',
    color: '#dc7854', palette: ['#873b2b', '#d97849', '#bd573d'], radius: 0.49, orbit: 14.0, speed: 0.23, spin: 0.55, tilt: 0.36,
    distance: '1.52 AU', year: '687 days',
    description: 'A rusty desert world with ancient river valleys and the tallest volcano we know of.',
    fact: 'Olympus Mons rises about 22 km above the surrounding plains.',
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'Gas giant', order: 'FIFTH FROM THE SUN',
    color: '#d2a47c', palette: ['#8f624e', '#e1c39a', '#b77e61'], radius: 1.28, orbit: 19.2, speed: 0.13, spin: 0.72, tilt: 0.05,
    distance: '5.20 AU', year: '11.9 years',
    description: 'A giant of swirling clouds, with storms large enough to swallow our whole planet.',
    fact: 'The Great Red Spot is a storm that has raged for centuries.',
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'Gas giant', order: 'SIXTH FROM THE SUN',
    color: '#d9bf8f', palette: ['#a17b53', '#ead5a5', '#c99b68'], radius: 1.10, orbit: 24.7, speed: 0.095, spin: 0.62, tilt: 0.47,
    distance: '9.58 AU', year: '29.4 years',
    description: 'A soft gold giant surrounded by a spectacular system of icy rings.',
    fact: 'Saturn’s rings are wide, bright, and astonishingly thin.',
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'Ice giant', order: 'SEVENTH FROM THE SUN',
    color: '#82c8d0', palette: ['#5c9da9', '#9ad9dc', '#6fb5c0'], radius: 0.86, orbit: 30.1, speed: 0.069, spin: -0.42, tilt: 1.37,
    distance: '19.2 AU', year: '84 years',
    description: 'A pale cyan ice giant that rolls around the Sun on its side.',
    fact: 'Its extreme axial tilt gives Uranus unusually long seasons.',
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'Ice giant', order: 'EIGHTH FROM THE SUN',
    color: '#5576d7', palette: ['#2947a1', '#6486e6', '#4362c7'], radius: 0.84, orbit: 35.8, speed: 0.053, spin: 0.52, tilt: 0.49,
    distance: '30.1 AU', year: '165 years',
    description: 'A deep-blue, windswept world in the cold outer reaches of the planetary system.',
    fact: 'Neptune’s winds can race faster than the speed of sound.',
  },
];

const el = (id) => document.getElementById(id);
const list = el('planet-list');
const stage = el('stage');
const sceneFrame = el('scene-frame');
const fallback = el('webgl-fallback');
const detailElements = {
  order: el('planet-order'), name: el('planet-name'), kind: el('planet-kind'),
  description: el('planet-description'), distance: el('planet-distance'), year: el('planet-year'),
  fact: el('planet-fact'), symbol: el('detail-symbol'),
};

let selectedId = 'earth';
let currentSpeed = 1;
let paused = false;
let simTime = 0;
let renderer;
let scene;
let camera;
let controls;
let planetNodes = new Map();
let orbitLines = new Map();
let focusFollows = false;
let pointerDown = null;
let animationFrame = 0;
let resizeObserver;
let lastFrameTime = 0;

const planetButtons = new Map();

function renderPlanetButtons() {
  list.innerHTML = '';
  for (const [index, planet] of planets.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'planet-choice';
    button.dataset.planet = planet.id;
    button.setAttribute('aria-pressed', String(planet.id === selectedId));
    button.setAttribute('aria-label', `Select ${planet.name}, ${planet.kind.toLowerCase()}`);
    button.innerHTML = `<span class="planet-choice-index">${String(index + 1).padStart(2, '0')}</span><span class="planet-swatch" aria-hidden="true"></span><span class="planet-choice-name">${planet.name}</span><span class="planet-choice-arrow" aria-hidden="true">↗</span>`;
    button.querySelector('.planet-swatch').style.setProperty('--swatch-color', planet.color);
    button.addEventListener('click', () => selectPlanet(planet.id, { focus: Boolean(renderer) }));
    list.append(button);
    planetButtons.set(planet.id, button);
  }
}

function updatePlanetDetails(planet) {
  detailElements.order.textContent = planet.order;
  detailElements.name.textContent = planet.name;
  detailElements.kind.textContent = planet.kind;
  detailElements.description.textContent = planet.description;
  detailElements.distance.textContent = planet.distance;
  detailElements.year.textContent = planet.year;
  detailElements.fact.textContent = planet.fact;
  detailElements.symbol.textContent = planet.id === 'saturn' ? '◉' : '⊙';
}

function selectPlanet(id, { focus = false } = {}) {
  const planet = planets.find((candidate) => candidate.id === id);
  if (!planet) return;
  selectedId = id;
  for (const candidate of planets) {
    const button = planetButtons.get(candidate.id);
    button?.setAttribute('aria-pressed', String(candidate.id === id));
    button?.classList.toggle('is-selected', candidate.id === id);
  }
  const index = planets.indexOf(planet) + 1;
  const panelIndex = document.querySelector('.panel-index');
  if (panelIndex) panelIndex.innerHTML = `${String(index).padStart(2, '0')} <i>/</i> 08`;
  updatePlanetDetails(planet);
  if (focus && controls && camera) focusFollows = true;
}

function makePlanetTexture(planet) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, planet.palette[1]);
  gradient.addColorStop(0.48, planet.palette[0]);
  gradient.addColorStop(1, planet.palette[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (planet.id === 'earth') {
    ctx.fillStyle = '#71b76f';
    ctx.strokeStyle = 'rgba(186, 218, 154, .52)';
    ctx.lineWidth = 3;
    const continents = [
      [[44, 66], [65, 43], [98, 49], [120, 71], [109, 94], [92, 116], [76, 153], [59, 126], [39, 103]],
      [[129, 156], [151, 137], [169, 147], [164, 174], [151, 201], [139, 188]],
      [[237, 54], [274, 43], [296, 59], [325, 57], [350, 80], [342, 101], [317, 109], [297, 128], [280, 115], [266, 91], [244, 85]],
      [[311, 141], [332, 132], [351, 152], [344, 181], [327, 198], [314, 175]],
      [[410, 79], [438, 67], [454, 90], [443, 108], [421, 101]],
    ];
    for (const coords of continents) {
      ctx.beginPath();
      coords.forEach(([x, y], index) => index ? ctx.lineTo(x * 1.27, y) : ctx.moveTo(x * 1.27, y));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(235, 245, 248, .34)';
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * canvas.width;
      const y = 22 + Math.random() * 206;
      ctx.beginPath();
      ctx.ellipse(x, y, 13 + Math.random() * 40, 1 + Math.random() * 3, -0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (planet.id === 'jupiter' || planet.id === 'saturn') {
    const bands = planet.id === 'jupiter' ? 18 : 23;
    for (let i = 0; i < bands; i++) {
      const y = (i / bands) * canvas.height;
      const height = canvas.height / bands;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(99, 52, 37, .35)' : i % 2 ? 'rgba(250, 225, 183, .22)' : 'rgba(245, 187, 131, .18)';
      ctx.beginPath();
      ctx.moveTo(0, y + height * 0.15);
      for (let x = 0; x <= canvas.width; x += 32) {
        const wave = Math.sin((x / canvas.width) * Math.PI * 5 + i) * 3;
        ctx.lineTo(x, y + height * 0.32 + wave);
      }
      ctx.lineTo(canvas.width, y + height);
      ctx.lineTo(0, y + height * 0.82);
      ctx.closePath();
      ctx.fill();
    }
    if (planet.id === 'jupiter') {
      ctx.fillStyle = 'rgba(168, 74, 47, .88)';
      ctx.beginPath();
      ctx.ellipse(336, 165, 36, 12, -0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 105; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = planet.id === 'mercury' ? 2 + Math.random() * 7 : 1 + Math.random() * 4;
      ctx.fillStyle = i % 2 ? 'rgba(20, 18, 20, .18)' : 'rgba(255, 235, 210, .14)';
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      if (planet.id === 'mercury') {
        ctx.strokeStyle = 'rgba(243, 226, 208, .18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    if (['venus', 'uranus', 'neptune'].includes(planet.id)) {
      for (let y = 15; y < canvas.height; y += 29) {
        ctx.fillStyle = 'rgba(242, 236, 220, .08)';
        ctx.fillRect(0, y, canvas.width, 6 + Math.random() * 8);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeStarfield() {
  const starCount = 1750;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const radius = 80 + Math.random() * 170;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const shade = 0.58 + Math.random() * 0.42;
    colors[i * 3] = shade * 0.77;
    colors[i * 3 + 1] = shade * 0.85;
    colors[i * 3 + 2] = shade;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.42, vertexColors: true, transparent: true, opacity: 0.76, sizeAttenuation: true, depthWrite: false }));
  scene.add(stars);
}

function addSun() {
  const sun = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(2.18, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0xffc279 }),
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(2.62, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0xff873a, transparent: true, opacity: 0.13, side: THREE.BackSide, depthWrite: false }),
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(3.35, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0xf26d47, transparent: true, opacity: 0.045, side: THREE.BackSide, depthWrite: false }),
  );
  sun.add(core, glow, halo);
  scene.add(sun);
  scene.add(new THREE.PointLight(0xffd8a8, 220, 170, 1.6));
}

function addOrbit(planet) {
  const points = [];
  const segments = 256;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * planet.orbit, 0, Math.sin(angle) * planet.orbit * 0.94));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x657797, transparent: true, opacity: 0.17, depthWrite: false });
  const line = new THREE.LineLoop(geometry, material);
  line.userData.planetId = planet.id;
  scene.add(line);
  orbitLines.set(planet.id, line);
}

function addPlanet(planet, index) {
  const node = new THREE.Group();
  node.rotation.z = planet.tilt;
  node.position.set(planet.orbit, 0, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: makePlanetTexture(planet),
    roughness: planet.id === 'earth' ? 0.68 : 0.86,
    metalness: planet.id === 'mercury' ? 0.1 : 0.01,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(planet.radius, 48, 32), material);
  body.name = planet.name;
  body.userData.planetId = planet.id;
  body.rotation.x = 0.04 * index;
  node.add(body);

  if (planet.id === 'saturn' || planet.id === 'uranus') {
    const inner = planet.id === 'saturn' ? 1.32 : 1.48;
    const outer = planet.id === 'saturn' ? 2.06 : 1.79;
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: planet.id === 'saturn' ? 0xe4c999 : 0x9ddde1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: planet.id === 'saturn' ? 0.76 : 0.36,
      roughness: 0.78,
      metalness: 0.08,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(planet.radius * inner, planet.radius * outer, 104), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = planet.id === 'saturn' ? 0.11 : 0.5;
    node.add(ring);
    if (planet.id === 'saturn') {
      const gap = new THREE.Mesh(
        new THREE.RingGeometry(planet.radius * 1.63, planet.radius * 1.68, 104),
        new THREE.MeshBasicMaterial({ color: 0x101523, side: THREE.DoubleSide, transparent: true, opacity: 0.72, depthWrite: false }),
      );
      gap.rotation.x = Math.PI / 2;
      gap.rotation.y = 0.11;
      node.add(gap);
    }
  }

  scene.add(node);
  planetNodes.set(planet.id, { node, body, data: planet });
}

function setupScene() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    showWebGLFallback(error);
    return false;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.className = 'scene-canvas';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Animated 3D solar system. Select a planet from the guide to read its field notes.');
  renderer.domElement.tabIndex = 0;
  sceneFrame.append(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080d18);
  scene.fog = new THREE.FogExp2(0x080d18, 0.0019);
  camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.1, 420);
  camera.position.set(0, 41, 58);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = true;
  controls.panSpeed = 0.48;
  controls.rotateSpeed = 0.44;
  controls.zoomSpeed = 0.68;
  controls.minDistance = 12;
  controls.maxDistance = 105;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = 1.46;
  controls.target.set(0, 0, 0);
  controls.addEventListener('start', () => { focusFollows = false; });

  scene.add(new THREE.HemisphereLight(0x8bb7e7, 0x090d18, 1.0));
  scene.add(new THREE.AmbientLight(0x26354f, 0.52));
  makeStarfield();
  addSun();
  planets.forEach((planet, index) => {
    addOrbit(planet);
    addPlanet(planet, index);
  });
  bindScenePointerEvents();
  resizeObserver = new ResizeObserver(resizeScene);
  resizeObserver.observe(stage);
  window.addEventListener('resize', resizeScene, { passive: true });
  return true;
}

function showWebGLFallback(error) {
  stage.classList.add('no-webgl');
  sceneFrame.hidden = true;
  fallback.hidden = false;
  const message = error?.message ? `WebGL initialization failed: ${error.message}` : 'WebGL initialization failed.';
  console.info(message);
  const pause = el('pause-button');
  const slider = el('speed-slider');
  pause.disabled = true;
  slider.disabled = true;
  el('reset-button').disabled = true;
  document.querySelector('.scene-hint')?.setAttribute('hidden', '');
  document.querySelector('.keyboard-note')?.setAttribute('hidden', '');
  document.querySelector('.topbar-status span:nth-child(2)').textContent = 'FIELD GUIDE MODE';
}

function resizeScene() {
  if (!renderer || !camera) return;
  const bounds = sceneFrame.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  camera.aspect = bounds.width / bounds.height;
  camera.updateProjectionMatrix();
  renderer.setSize(bounds.width, bounds.height, false);
}

function bindScenePointerEvents() {
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointerDown = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!pointerDown || pointerDown.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    if (moved > 6) return;
    const rect = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...planetNodes.values()].map(({ body }) => body), false);
    if (hits.length) selectPlanet(hits[0].object.userData.planetId, { focus: true });
  });
  canvas.addEventListener('pointercancel', () => { pointerDown = null; });
}

function setPaused(nextPaused) {
  paused = nextPaused;
  const button = el('pause-button');
  button.setAttribute('aria-label', paused ? 'Resume simulation' : 'Pause simulation');
  el('pause-label').textContent = paused ? 'Resume' : 'Pause';
  el('pause-icon').textContent = paused ? '▶' : 'Ⅱ';
  button.classList.toggle('is-paused', paused);
}

function resetSimulation() {
  simTime = 0;
  currentSpeed = 1;
  el('speed-slider').value = '1';
  el('speed-output').textContent = '1.0×';
  setPaused(false);
  selectPlanet('earth');
  if (camera && controls) {
    focusFollows = false;
    controls.target.set(0, 0, 0);
    camera.position.set(0, 41, 58);
    controls.update();
  }
}

function bindControls() {
  el('pause-button').addEventListener('click', () => setPaused(!paused));
  el('reset-button').addEventListener('click', resetSimulation);
  el('speed-slider').addEventListener('input', (event) => {
    currentSpeed = Number(event.currentTarget.value);
    el('speed-output').textContent = `${currentSpeed.toFixed(1)}×`;
  });
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const isControl = target instanceof HTMLElement && (target.matches('button, input, textarea, select') || target.isContentEditable);
    if (event.code === 'Space' && !isControl) {
      event.preventDefault();
      setPaused(!paused);
    } else if ((event.key === 'r' || event.key === 'R') && !isControl) {
      resetSimulation();
    } else if ((event.key === '[' || event.key === ']') && !isControl) {
      const currentIndex = planets.findIndex((planet) => planet.id === selectedId);
      const direction = event.key === ']' ? 1 : -1;
      const nextIndex = (currentIndex + direction + planets.length) % planets.length;
      selectPlanet(planets[nextIndex].id, { focus: Boolean(renderer) });
      planetButtons.get(planets[nextIndex].id)?.focus({ preventScroll: true });
    }
  });
}

function animate(now = 0) {
  animationFrame = requestAnimationFrame(animate);
  const delta = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.06) : 0;
  lastFrameTime = now;
  if (!paused) simTime += delta * currentSpeed;

  for (const planet of planets) {
    const body = planetNodes.get(planet.id);
    if (!body) continue;
    const angle = simTime * planet.speed + planets.indexOf(planet) * 0.73;
    body.node.position.set(Math.cos(angle) * planet.orbit, Math.sin(angle * 0.44) * 0.11, Math.sin(angle) * planet.orbit * 0.94);
    if (!paused) body.body.rotation.y += delta * planet.spin;
  }

  if (focusFollows && controls) {
    const selected = planetNodes.get(selectedId);
    const nextTarget = selected ? selected.node.position : new THREE.Vector3(0, 0, 0);
    const shift = nextTarget.clone().sub(controls.target).multiplyScalar(0.035);
    controls.target.add(shift);
    camera.position.add(shift);
  }
  controls?.update();
  renderer?.render(scene, camera);
}

renderPlanetButtons();
selectPlanet(selectedId);
bindControls();
if (setupScene()) {
  animate();
}
