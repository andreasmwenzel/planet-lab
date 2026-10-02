import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const bodies = [
  { name: 'Mercury', kind: 'TERRESTRIAL', color: '#aaa7a0', orbit: 4.5, radius: .36, rate: .31, period: '88 days', summary: 'A small, cratered world that circles closest to the Sun.', palette: ['#938f88', '#bab4a8', '#746f6a'], surface: 'rocky' },
  { name: 'Venus', kind: 'TERRESTRIAL', color: '#d8ad74', orbit: 6.4, radius: .62, rate: .22, period: '225 days', summary: 'A bright, cloud-wrapped planet with a remarkably hot surface.', palette: ['#bb8b59', '#e3be85', '#946c4b'], surface: 'cloud' },
  { name: 'Earth', kind: 'TERRESTRIAL', color: '#6fa5b1', orbit: 8.6, radius: .7, rate: .17, period: '365 days', summary: 'A blue world of oceans, weather, and one known living biosphere.', palette: ['#153b55', '#4b8e79', '#d9ca9d'], surface: 'earth' },
  { name: 'Mars', kind: 'TERRESTRIAL', color: '#c47b60', orbit: 11.1, radius: .49, rate: .13, period: '687 days', summary: 'A rust-colored desert world with the tallest volcano we know.', palette: ['#a9523e', '#d2815a', '#70433c'], surface: 'rocky' },
  { name: 'Jupiter', kind: 'GAS GIANT', color: '#d0a875', orbit: 14.7, radius: 1.43, rate: .085, period: '11.9 years', summary: 'The giant of the system, banded by immense, restless cloud belts.', palette: ['#9b6346', '#e5c79a', '#b87955'], surface: 'bands' },
  { name: 'Saturn', kind: 'GAS GIANT', color: '#d1be94', orbit: 18.5, radius: 1.2, rate: .065, period: '29.5 years', summary: 'A pale gas giant whose wide rings are made mostly of ice.', palette: ['#a98d66', '#e0d0aa', '#bfaa7d'], surface: 'bands' },
  { name: 'Uranus', kind: 'ICE GIANT', color: '#9abfc0', orbit: 22.3, radius: .89, rate: .048, period: '84 years', summary: 'A cool blue-green world that rolls around the Sun on its side.', palette: ['#5f999c', '#aad0cb', '#7ab3b3'], surface: 'ice' },
  { name: 'Neptune', kind: 'ICE GIANT', color: '#6f8fbd', orbit: 26.2, radius: .86, rate: .038, period: '165 years', summary: 'A distant blue planet, swept by some of the fastest winds measured.', palette: ['#234574', '#5485bd', '#30609a'], surface: 'ice' },
];

const canvas = document.querySelector('#planetCanvas');
const stage = document.querySelector('#sceneShell');
const fallbackView = document.querySelector('#fallbackView');
const label = document.querySelector('#bodyLabel');
const labelText = document.querySelector('#bodyLabelText');
const card = {
  kicker: document.querySelector('#planetKicker'),
  name: document.querySelector('#planetName'),
  summary: document.querySelector('#planetSummary'),
  index: document.querySelector('#planetIndexLarge'),
  fact: document.querySelector('#factValue'),
};
const tabButtons = [...document.querySelectorAll('.planet-tab')];
const pauseButton = document.querySelector('#pauseButton');
const pauseLabel = document.querySelector('#pauseLabel');
const resetButton = document.querySelector('#resetButton');
const speedRange = document.querySelector('#speedRange');
const speedOutput = document.querySelector('#speedOutput');

let selectedIndex = 2;
let playing = true;
let speed = 1;
let simTime = 0;
let renderer;
let scene;
let camera;
let controls;
let clock;
let sun;
let starField;
let planetEntries = [];
let raycaster;
let pointerStart = null;
let renderFrame = 0;
let usableWebGL = false;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function makeSurfaceTexture(body) {
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 512;
  canvasTexture.height = 256;
  const context = canvasTexture.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const image = context.createImageData(canvasTexture.width, canvasTexture.height);
  const [deep, light, accent] = body.palette.map((hex) => new THREE.Color(hex));
  const cloudColor = new THREE.Color('#dce2d4');
  let colorR = 0;
  let colorG = 0;
  let colorB = 0;
  const blendInto = (from, to, amount) => {
    colorR = from.r + (to.r - from.r) * amount;
    colorG = from.g + (to.g - from.g) * amount;
    colorB = from.b + (to.b - from.b) * amount;
  };
  const linearToSrgb = (channel) => channel <= .0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - .055;
  for (let y = 0; y < canvasTexture.height; y += 1) {
    const lat = (y / canvasTexture.height) * Math.PI;
    for (let x = 0; x < canvasTexture.width; x += 1) {
      const lon = (x / canvasTexture.width) * Math.PI * 2;
      const wave = Math.sin(lon * 3.1 + Math.sin(lat * 5.2) * 1.9) + Math.sin(lon * 8.5 - lat * 9.2) * .36 + Math.sin(lon * 13.3 + lat * 2.7) * .18;
      let mix = .27 + .18 * Math.sin(lat * 17 + Math.sin(lon * 4) * 1.5) + .09 * wave;
      if (body.surface === 'bands') {
        const stripe = Math.sin(lat * (body.name === 'Jupiter' ? 46 : 38) + Math.sin(lon * 2.4) * .24 + Math.sin(lon * 7) * .07);
        const broad = .5 + .28 * Math.sin(lat * 18 + Math.sin(lon * 1.8) * .28);
        blendInto(deep, light, Math.max(.08, Math.min(.92, broad + stripe * .18)));
        if (body.name === 'Jupiter') {
          const storm = Math.pow(Math.max(0, 1 - Math.abs((lon - 3.5) * 2.0) - Math.abs((lat - 1.55) * 6)), 2);
          const amount = storm * .75;
          colorR += (accent.r - colorR) * amount;
          colorG += (accent.g - colorG) * amount;
          colorB += (accent.b - colorB) * amount;
        }
      } else if (body.surface === 'earth') {
        const continent = Math.sin(lon * 2.8 + Math.sin(lat * 8) * .8) + .54 * Math.sin(lon * 7.1 - lat * 3.2) + .3 * Math.cos(lon * 10 + lat * 7);
        blendInto(deep, light, Math.max(0, Math.min(1, (continent - .18) * 1.4)));
        if (Math.abs(lat - Math.PI / 2) > 1.34) {
          colorR += (accent.r - colorR) * .64;
          colorG += (accent.g - colorG) * .64;
          colorB += (accent.b - colorB) * .64;
        }
        const cloud = Math.sin(lon * 24 + lat * 9) + Math.cos(lon * 13 - lat * 17);
        const cloudAmount = Math.max(0, cloud - 1.35) * .17;
        colorR += (cloudColor.r - colorR) * cloudAmount;
        colorG += (cloudColor.g - colorG) * cloudAmount;
        colorB += (cloudColor.b - colorB) * cloudAmount;
      } else {
        if (body.surface === 'ice') mix += .16;
        const threshold = body.surface === 'cloud' ? Math.sin(lat * 11 + Math.sin(lon * 3) * .7) * .19 : Math.sin(lon * 4.7 + Math.cos(lat * 9)) * .22;
        blendInto(deep, light, Math.max(0, Math.min(1, mix + threshold)));
        const fleck = Math.sin(lon * 47 + lat * 21) * Math.sin(lat * 38 - lon * 6);
        if (fleck > .81) {
          colorR += (accent.r - colorR) * .32;
          colorG += (accent.g - colorG) * .32;
          colorB += (accent.b - colorB) * .32;
        }
      }
      const shade = .89 + .11 * Math.sin(lat);
      const i = (y * canvasTexture.width + x) * 4;
      image.data[i] = Math.round(Math.min(1, linearToSrgb(colorR * shade)) * 255);
      image.data[i + 1] = Math.round(Math.min(1, linearToSrgb(colorG * shade)) * 255);
      image.data[i + 2] = Math.round(Math.min(1, linearToSrgb(colorB * shade)) * 255);
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addStarfield() {
  const starCount = 1000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const colorOptions = [new THREE.Color('#c5d8dc'), new THREE.Color('#e7d2b2'), new THREE.Color('#819eae')];
  for (let i = 0; i < starCount; i += 1) {
    const radius = 80 + Math.random() * 70;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: .16, vertexColors: true, transparent: true, opacity: .7, sizeAttenuation: true, depthWrite: false });
  starField = new THREE.Points(geometry, material);
  scene.add(starField);
}

function addSolarSystem() {
  const sunGeometry = new THREE.SphereGeometry(1.62, 56, 40);
  const sunMaterial = new THREE.MeshStandardMaterial({ color: '#f3c27e', emissive: '#e99b43', emissiveIntensity: 1.8, roughness: .7 });
  sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.y = 0;
  scene.add(sun);
  const sunAura = new THREE.Mesh(new THREE.SphereGeometry(2.35, 48, 32), new THREE.MeshBasicMaterial({ color: '#d88b45', transparent: true, opacity: .11, side: THREE.BackSide, depthWrite: false }));
  scene.add(sunAura);
  const innerGlow = new THREE.Mesh(new THREE.SphereGeometry(1.84, 48, 32), new THREE.MeshBasicMaterial({ color: '#ffc985', transparent: true, opacity: .13, side: THREE.BackSide, depthWrite: false }));
  scene.add(innerGlow);
  const coreLight = new THREE.PointLight('#f6ba77', 155, 96, 1.65);
  coreLight.position.set(0, 0, 0);
  scene.add(coreLight);
  const amb = new THREE.AmbientLight('#9bb6c0', .63);
  scene.add(amb);
  const fill = new THREE.DirectionalLight('#dce7df', 1.2);
  fill.position.set(-10, 22, 16);
  scene.add(fill);

  for (const [index, body] of bodies.entries()) {
    const orbitGeometry = new THREE.BufferGeometry();
    const coords = [];
    for (let step = 0; step <= 240; step += 1) {
      const theta = (step / 240) * Math.PI * 2;
      coords.push(Math.cos(theta) * body.orbit, 0, Math.sin(theta) * body.orbit);
    }
    orbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
    const orbitMaterial = new THREE.LineBasicMaterial({ color: index < 4 ? '#5a777e' : '#53676f', transparent: true, opacity: index === 2 ? .39 : .2, depthWrite: false });
    const orbitLine = new THREE.LineLoop(orbitGeometry, orbitMaterial);
    scene.add(orbitLine);

    const group = new THREE.Group();
    scene.add(group);
    const texture = makeSurfaceTexture(body);
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: texture || undefined,
      roughness: body.name === 'Earth' ? .84 : .96,
      metalness: .015,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(body.radius, 48, 32), material);
    group.add(mesh);
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(body.radius * 1.23, 40, 28),
      new THREE.MeshBasicMaterial({ color: body.color, transparent: true, opacity: .11, side: THREE.BackSide, depthWrite: false })
    );
    aura.visible = index === selectedIndex;
    group.add(aura);
    if (body.name === 'Saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(body.radius * 1.27, body.radius * 1.88, 112),
        new THREE.MeshStandardMaterial({ color: '#cfba8e', roughness: .9, metalness: .04, side: THREE.DoubleSide, transparent: true, opacity: .62, depthWrite: false })
      );
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = .11;
      group.add(ring);
      const innerRing = new THREE.Mesh(
        new THREE.RingGeometry(body.radius * 1.08, body.radius * 1.23, 112),
        new THREE.MeshBasicMaterial({ color: '#a8875f', side: THREE.DoubleSide, transparent: true, opacity: .42, depthWrite: false })
      );
      innerRing.rotation.x = Math.PI / 2;
      innerRing.rotation.z = .11;
      group.add(innerRing);
    }
    group.position.set(Math.cos(index * 1.37) * body.orbit, 0, Math.sin(index * 1.37) * body.orbit);
    planetEntries.push({ body, group, mesh, aura, orbitLine, baseAngle: index * 1.37, texture });
  }
}

function selectPlanet(index, announce = true) {
  if (!Number.isInteger(index) || index < 0 || index >= bodies.length) return;
  selectedIndex = index;
  const body = bodies[index];
  card.kicker.textContent = `${body.kind} · ${String(index + 1).padStart(2, '0')}`;
  card.name.textContent = body.name;
  card.summary.textContent = body.summary;
  card.index.textContent = String(index + 1).padStart(2, '0');
  card.fact.textContent = body.period;
  labelText.textContent = body.name.toUpperCase();
  if (announce) {
    tabButtons[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
  }
  for (const [tabIndex, button] of tabButtons.entries()) {
    const active = tabIndex === index;
    button.classList.toggle('is-selected', active);
    button.setAttribute('aria-pressed', String(active));
  }
  planetEntries.forEach((entry, entryIndex) => {
    entry.aura.visible = entryIndex === index;
    entry.orbitLine.material.opacity = entryIndex === index ? .39 : (entryIndex < 4 ? .2 : .14);
    entry.orbitLine.material.color.set(entryIndex === index ? body.color : '#53676f');
  });
  label.classList.remove('is-visible');
}

function handlePlanetPointer(event) {
  if (!renderer || !raycaster) return;
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(planetEntries.map((entry) => entry.mesh), false);
  if (!hits.length) return;
  const entry = planetEntries.find((candidate) => candidate.mesh === hits[0].object);
  if (entry) selectPlanet(bodies.indexOf(entry.body));
}

function positionLabel() {
  if (!camera || !planetEntries.length || fallbackView.hidden === false) return;
  const active = planetEntries[selectedIndex];
  const projected = active.group.position.clone().project(camera);
  const inFrame = projected.z < 1 && projected.z > -1 && Math.abs(projected.x) < .95 && Math.abs(projected.y) < .95;
  if (!inFrame) {
    label.classList.remove('is-visible');
    return;
  }
  const bounds = stage.getBoundingClientRect();
  const x = (projected.x * .5 + .5) * bounds.width;
  const y = (-projected.y * .5 + .5) * bounds.height;
  label.style.left = `${Math.min(bounds.width - 110, Math.max(18, x + 17))}px`;
  label.style.top = `${Math.min(bounds.height - 40, Math.max(48, y - 12))}px`;
  label.classList.add('is-visible');
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const { width, height } = stage.getBoundingClientRect();
  if (width < 1 || height < 1) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  renderFrame = window.requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .05);
  if (playing) simTime += delta * speed * (reducedMotion ? .15 : 1);
  for (const entry of planetEntries) {
    const angle = entry.baseAngle + simTime * entry.body.rate;
    entry.group.position.set(Math.cos(angle) * entry.body.orbit, 0, Math.sin(angle) * entry.body.orbit);
    entry.mesh.rotation.y += delta * (entry.body.name === 'Venus' ? -.22 : .34) * (playing ? speed : 0);
  }
  sun.rotation.y += delta * .035;
  if (starField) starField.rotation.y = Math.sin(simTime * .025) * .006;
  controls?.update();
  positionLabel();
  renderer.render(scene, camera);
}

function showFallback() {
  usableWebGL = false;
  stage.classList.add('is-fallback');
  fallbackView.hidden = false;
  label.classList.remove('is-visible');
  pauseButton.disabled = true;
  pauseButton.setAttribute('aria-disabled', 'true');
  speedRange.disabled = true;
  speedRange.setAttribute('aria-disabled', 'true');
  document.querySelector('#pauseLabel').textContent = '3D motion unavailable';
  pauseButton.setAttribute('aria-label', '3D motion controls unavailable because WebGL is not supported');
}

function startScene() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor('#09151e', 1);
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#09151e', .0019);
    camera = new THREE.PerspectiveCamera(42, 1, .1, 220);
    camera.position.set(0, 37, 62);
    camera.lookAt(0, 0, 0);
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = .055;
    controls.enablePan = false;
    controls.minDistance = 27;
    controls.maxDistance = 110;
    controls.minPolarAngle = .18;
    controls.maxPolarAngle = Math.PI * .48;
    controls.target.set(0, 0, 0);
    controls.update();
    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    addStarfield();
    addSolarSystem();
    resizeRenderer();
    usableWebGL = true;
    canvas.addEventListener('pointerdown', (event) => { pointerStart = { x: event.clientX, y: event.clientY }; });
    canvas.addEventListener('pointerup', (event) => {
      if (!pointerStart) return;
      const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      pointerStart = null;
      if (moved < 6) handlePlanetPointer(event);
    });
    canvas.addEventListener('pointercancel', () => { pointerStart = null; });
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      cancelAnimationFrame(renderFrame);
      showFallback();
    }, { once: true });
    window.addEventListener('resize', resizeRenderer, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(resizeRenderer).observe(stage);
    animate();
  } catch (error) {
    console.warn('Solarium could not initialize its WebGL scene:', error);
    cancelAnimationFrame(renderFrame);
    try { renderer?.dispose(); } catch { /* context setup may have failed before initialization */ }
    showFallback();
  }
}

for (const button of tabButtons) {
  button.addEventListener('click', () => selectPlanet(Number(button.dataset.planet)));
}
pauseButton.addEventListener('click', () => {
  if (!usableWebGL) return;
  playing = !playing;
  pauseButton.setAttribute('aria-pressed', String(!playing));
  pauseLabel.textContent = playing ? 'Pause motion' : 'Resume motion';
});
speedRange.addEventListener('input', () => {
  speed = Number(speedRange.value);
  speedOutput.value = `${speed.toFixed(1)}×`;
  speedOutput.textContent = `${speed.toFixed(1)}×`;
});
resetButton.addEventListener('click', () => {
  simTime = 0;
  speed = 1;
  speedRange.value = '1';
  speedOutput.value = '1.0×';
  speedOutput.textContent = '1.0×';
  if (usableWebGL && controls) {
    controls.reset();
    camera.position.set(0, 37, 62);
    controls.target.set(0, 0, 0);
    controls.update();
  }
  if (!playing && usableWebGL) {
    playing = true;
    pauseButton.setAttribute('aria-pressed', 'false');
    pauseLabel.textContent = 'Pause motion';
  }
  selectPlanet(2);
});

selectPlanet(selectedIndex, false);
startScene();
