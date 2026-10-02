import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const planets = [
  {
    id: 'mercury', name: 'Mercury', kind: 'Terrestrial', shortKind: 'Rocky', color: '#c4b8a9',
    radius: 0.78, orbit: 9.5, speed: 1.08, spin: 0.18, phase: 0.4, tilt: 0.04,
    palette: ['#a59a8c', '#c4b8a9', '#e0d2c1'], texture: 'crater', moons: [],
    orbitLabel: 'Closest path',
    description: 'A compact, cratered world on the innermost track. Its quick lap is intentionally exaggerated so the motion is easy to follow.'
  },
  {
    id: 'venus', name: 'Venus', kind: 'Terrestrial', shortKind: 'Rocky', color: '#f0c47f',
    radius: 1.08, orbit: 13.5, speed: 0.82, spin: -0.07, phase: 1.85, tilt: 0.06,
    palette: ['#bb8050', '#e5ad68', '#f2d399'], texture: 'cloud', moons: [],
    orbitLabel: 'Inner path',
    description: 'A warm, cloud-wrapped neighbor with a softly banded atmosphere and a slow, retrograde spin.'
  },
  {
    id: 'earth', name: 'Earth', kind: 'Terrestrial', shortKind: 'Rocky', color: '#62bfff',
    radius: 1.16, orbit: 18, speed: 0.62, spin: 0.42, phase: 2.75, tilt: 0.12,
    palette: ['#144f9a', '#247fc2', '#5ab8d2'], texture: 'earth', moons: [{ radius: 0.21, orbit: 2.15, speed: 1.7, color: '#c8cfdb' }],
    orbitLabel: 'Home track',
    description: 'Our ocean-rich home, shown with broad land shapes and a small Moon. Planet and satellite sizes are both enlarged for clarity.'
  },
  {
    id: 'mars', name: 'Mars', kind: 'Terrestrial', shortKind: 'Rocky', color: '#ee8066',
    radius: 0.91, orbit: 23, speed: 0.47, spin: 0.4, phase: 4.4, tilt: 0.19,
    palette: ['#923f31', '#ce6346', '#ed9a6c'], texture: 'mars', moons: [
      { radius: 0.11, orbit: 1.62, speed: 2.4, color: '#b9a99d' },
      { radius: 0.08, orbit: 2.05, speed: -1.6, color: '#c9bcae' }
    ],
    orbitLabel: 'Red-world path',
    description: 'A rust-colored desert world with a pair of tiny moons. Its surface markings are artistic texture, not mapped terrain.'
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'Gas giant', shortKind: 'Giant', color: '#e8ad7a',
    radius: 3.05, orbit: 30, speed: 0.27, spin: 0.78, phase: 5.4, tilt: 0.08,
    palette: ['#a96d55', '#d8a77e', '#f1d1a7'], texture: 'jupiter', moons: [
      { radius: 0.19, orbit: 4.15, speed: 1.2, color: '#eadcc5' },
      { radius: 0.15, orbit: 4.8, speed: -0.9, color: '#bdb9ad' },
      { radius: 0.13, orbit: 5.45, speed: 0.75, color: '#e6cfa7' },
      { radius: 0.12, orbit: 6.15, speed: -0.62, color: '#b7c0c1' }
    ],
    orbitLabel: 'Giant-world path',
    description: 'The largest world in this lineup. Soft cloud belts and four tiny moons hint at the busy neighborhood around a gas giant.'
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'Gas giant', shortKind: 'Giant', color: '#e9d09a',
    radius: 2.65, orbit: 38, speed: 0.19, spin: 0.68, phase: 3.3, tilt: 0.25,
    palette: ['#b18b58', '#dfc18c', '#f2e2b7'], texture: 'saturn', moons: [
      { radius: 0.16, orbit: 5.2, speed: 0.66, color: '#c7baa4' },
      { radius: 0.11, orbit: 6.2, speed: -0.52, color: '#e2d7c2' }
    ],
    orbitLabel: 'Ringed-world path',
    description: 'A pale gas giant with a broad, luminous ring system. The rings are intentionally simplified and enlarged as a graphic feature.'
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'Ice giant', shortKind: 'Ice', color: '#82dcd8',
    radius: 1.92, orbit: 47, speed: 0.145, spin: -0.48, phase: 0.95, tilt: 1.14,
    palette: ['#4699a6', '#72c2c2', '#a4ece3'], texture: 'ice', moons: [],
    orbitLabel: 'Outer path',
    description: 'A quiet ice giant with a cool cyan hue and a dramatically tipped axis. Its orbital track is spaced for a readable view.'
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'Ice giant', shortKind: 'Ice', color: '#7396ff',
    radius: 1.88, orbit: 56, speed: 0.112, spin: 0.45, phase: 5.7, tilt: 0.31,
    palette: ['#254aab', '#3f6ce0', '#7396ff'], texture: 'neptune', moons: [],
    orbitLabel: 'Farthest path',
    description: 'A deep-blue outer world tracing the longest arc here. The model compresses distance so every orbit stays in view.'
  }
];

const app = document.querySelector('#app');
const icon = {
  play: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M3 1.7c0-.4.44-.65.78-.44l6.4 4a.87.87 0 0 1 0 1.48l-6.4 4A.52.52 0 0 1 3 10.3z"/></svg>',
  pause: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M2.2 2.05c0-.3.25-.55.55-.55h1.4c.3 0 .55.25.55.55v7.9c0 .3-.25.55-.55.55h-1.4a.55.55 0 0 1-.55-.55zm5.1 0c0-.3.25-.55.55-.55h1.4c.3 0 .55.25.55.55v7.9c0 .3-.25.55-.55.55h-1.4a.55.55 0 0 1-.55-.55z"/></svg>',
  reset: '<svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 6.1A5.2 5.2 0 1 1 3 9.2M3.2 2.8v3.6h3.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  orbit: '<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2" fill="currentColor"/><ellipse cx="8" cy="8" rx="6.5" ry="3" fill="none" stroke="currentColor" stroke-width="1" transform="rotate(-27 8 8)"/><circle cx="13.5" cy="5.1" r="1" fill="currentColor"/></svg>'
};

app.innerHTML = `
  <div id="scene-root" aria-label="Animated 3D planetary system scene"></div>
  <div class="scene-vignette" aria-hidden="true"></div>
  <header class="topbar">
    <div class="brand" aria-label="Orbitarium Planetary Lab">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-copy"><span class="brand-name">ORBITARIUM</span><span class="brand-kicker">PLANETARY LAB / 01</span></span>
    </div>
    <div class="topbar-meta" aria-live="polite">
      <span class="status-live"><span class="live-dot" id="live-dot"></span><span id="status-text">SIMULATION LIVE</span></span>
      <span class="meta-rule" aria-hidden="true"></span>
      <span class="topbar-note">STYLIZED ORBITAL VIEW</span>
    </div>
  </header>

  <section class="intro" aria-label="Introduction">
    <div class="eyebrow">Heliosphere / 01</div>
    <h1>Our solar system,<br><em>in motion.</em></h1>
    <p>Choose a world to follow. Drag to orbit the model; scroll or pinch to zoom.</p>
  </section>

  <nav class="planet-panel glass-card" aria-label="Choose a planet">
    <div class="planet-panel-heading"><span class="panel-label">Select a world</span><span class="panel-count">08 BODIES</span></div>
    <div class="planet-list" id="planet-list"></div>
  </nav>

  <section class="info-panel glass-card" id="info-panel" aria-labelledby="planet-title" aria-live="polite">
    <div class="info-topline">
      <span class="orbit-tag"><span class="orbit-tag-dot" aria-hidden="true"></span><span id="orbit-tag">TRACK 03 / 08</span></span>
      <button class="icon-button" id="next-planet" type="button" aria-label="Select next planet" title="Next planet">›</button>
    </div>
    <h2 id="planet-title">Earth</h2>
    <div class="world-kind" id="planet-kind">Terrestrial</div>
    <p class="info-description" id="planet-description"></p>
    <div class="info-rule" aria-hidden="true"></div>
    <dl class="info-stats">
      <div class="info-stat"><dt>World class</dt><dd id="planet-class">Rocky body</dd></div>
      <div class="info-stat"><dt>Model route</dt><dd id="planet-route">Home track</dd></div>
    </dl>
  </section>

  <div class="selected-label" id="selected-label" aria-hidden="true"><span class="selected-label-dot"></span><span id="selected-label-name">Earth</span></div>

  <div class="interaction-hint" aria-hidden="true"><span>Drag to orbit</span><span class="hint-separator"></span><span>Scroll to zoom</span><span class="hint-separator"></span><span>Tap a planet to select</span></div>

  <section class="control-deck glass-card" aria-label="Simulation controls">
    <div class="deck-top"><span class="panel-label deck-title">${icon.orbit}<span>Flight deck</span></span><span class="deck-hint">Motion and scale are stylized</span></div>
    <div class="deck-controls">
      <button class="play-button" id="play-toggle" type="button" aria-label="Pause simulation">${icon.pause}<span id="play-label">Pause simulation</span></button>
      <button class="reset-button" id="reset-button" type="button" aria-label="Reset simulation, selection, speed, and camera" title="Reset the simulation">${icon.reset}</button>
      <div class="speed-control">
        <div class="speed-label-row"><label for="speed-slider">Simulation speed</label><output class="speed-value" id="speed-value" for="speed-slider">1.0×</output></div>
        <input id="speed-slider" type="range" min="0.25" max="3" step="0.05" value="1" aria-label="Simulation speed" />
      </div>
    </div>
  </section>
`;

const planetList = document.querySelector('#planet-list');
planetList.innerHTML = planets.map((planet, index) => `
  <button class="planet-choice" type="button" data-planet="${planet.id}" aria-pressed="false" style="--planet:${planet.color}" aria-label="Select ${planet.name}, ${planet.kind.toLowerCase()}">
    <span class="planet-dot" aria-hidden="true"></span><span class="planet-index">0${index + 1}</span><span class="planet-name">${planet.name}</span><span class="planet-type-short">${planet.shortKind}</span>
  </button>`).join('');

const sceneRoot = document.querySelector('#scene-root');
const infoPanel = document.querySelector('#info-panel');
const selectedLabel = document.querySelector('#selected-label');
const selectedLabelName = document.querySelector('#selected-label-name');
const playToggle = document.querySelector('#play-toggle');
const playLabel = document.querySelector('#play-label');
const resetButton = document.querySelector('#reset-button');
const speedSlider = document.querySelector('#speed-slider');
const speedValue = document.querySelector('#speed-value');
const liveDot = document.querySelector('#live-dot');
const statusText = document.querySelector('#status-text');

let activeId = 'earth';
let speed = 1;
let elapsed = 0;
let playing = true;
let isStaticFallback = false;
let userAdjustedCamera = false;
let scene, camera, renderer, controls, sunGlow, starPoints;
const planetaryObjects = new Map();
const pickMeshes = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const projectVector = new THREE.Vector3();

function selectPlanet(id, moveFocus = false) {
  const planet = planets.find((entry) => entry.id === id);
  if (!planet) return;
  activeId = id;
  const index = planets.indexOf(planet);
  document.querySelectorAll('.planet-choice').forEach((button) => {
    const isActive = button.dataset.planet === id;
    button.setAttribute('aria-pressed', String(isActive));
    if (isActive && moveFocus) button.focus();
  });
  document.querySelector('#orbit-tag').textContent = `TRACK 0${index + 1} / 08`;
  document.querySelector('#planet-title').textContent = planet.name;
  document.querySelector('#planet-kind').textContent = planet.kind;
  document.querySelector('#planet-description').textContent = planet.description;
  document.querySelector('#planet-class').textContent = planet.kind === 'Terrestrial' ? 'Rocky body' : planet.kind;
  document.querySelector('#planet-route').textContent = planet.orbitLabel;
  selectedLabelName.textContent = planet.name;
  infoPanel.style.setProperty('--accent', planet.color);
  selectedLabel.style.setProperty('--accent', planet.color);
  if (isStaticFallback) {
    document.querySelectorAll('.fallback-planet').forEach((dot) => {
      dot.style.filter = dot.dataset.id === id ? 'brightness(1.5) drop-shadow(0 0 8px white)' : '';
    });
  }
  const selected = planetaryObjects.get(id);
  if (selected) {
    for (const [bodyId, body] of planetaryObjects) {
      body.glow.visible = bodyId === id;
      body.orbitMaterial.opacity = bodyId === id ? 0.62 : 0.21;
      body.orbitMaterial.color.set(bodyId === id ? planet.color : '#73809c');
    }
  }
}

document.querySelectorAll('.planet-choice').forEach((button) => {
  button.addEventListener('click', () => selectPlanet(button.dataset.planet));
});

document.querySelector('#next-planet').addEventListener('click', () => {
  const index = planets.findIndex((planet) => planet.id === activeId);
  selectPlanet(planets[(index + 1) % planets.length].id);
});

function updatePlaybackUI() {
  const disabled = isStaticFallback;
  playToggle.disabled = disabled;
  speedSlider.disabled = disabled;
  playToggle.classList.toggle('is-paused', !playing);
  playToggle.innerHTML = `${playing ? icon.pause : icon.play}<span id="play-label">${playing ? 'Pause simulation' : 'Resume simulation'}</span>`;
  playToggle.setAttribute('aria-label', playing ? 'Pause simulation' : 'Resume simulation');
  liveDot.style.animationPlayState = playing && !disabled ? 'running' : 'paused';
  statusText.textContent = disabled ? '2D PREVIEW ONLY' : playing ? 'SIMULATION LIVE' : 'SIMULATION PAUSED';
  if (disabled) liveDot.style.background = '#ffcf88';
}

playToggle.addEventListener('click', () => {
  if (isStaticFallback) return;
  playing = !playing;
  updatePlaybackUI();
});

speedSlider.addEventListener('input', () => {
  speed = Number(speedSlider.value);
  speedValue.textContent = `${speed.toFixed(1)}×`;
});

function resetSimulation() {
  elapsed = 0;
  speed = 1;
  playing = true;
  speedSlider.value = '1';
  speedValue.textContent = '1.0×';
  selectPlanet('earth');
  userAdjustedCamera = false;
  if (controls && camera && renderer) {
    const distance = fitDistance();
    camera.position.set(distance * 0.12, distance * 0.49, distance * 0.86);
    controls.target.set(0, 0, 0);
    controls.update();
  }
  updatePlaybackUI();
}

resetButton.addEventListener('click', resetSimulation);

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makePlanetTexture(planet, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const random = randomGenerator(seed);
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, planet.palette[2]);
  gradient.addColorStop(0.5, planet.palette[1]);
  gradient.addColorStop(1, planet.palette[0]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (planet.texture === 'earth') {
    const land = ['#6eaa74', '#8cba76', '#a9c783', '#6d9873'];
    for (let i = 0; i < 10; i += 1) {
      const centerX = 18 + random() * 476;
      const centerY = 25 + random() * 206;
      const width = 16 + random() * 48;
      const height = 7 + random() * 23;
      context.beginPath();
      for (let point = 0; point < 9; point += 1) {
        const angle = point / 9 * Math.PI * 2;
        const wobble = 0.7 + random() * 0.55;
        const x = centerX + Math.cos(angle) * width * wobble;
        const y = centerY + Math.sin(angle) * height * wobble;
        if (point === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath();
      context.fillStyle = land[Math.floor(random() * land.length)];
      context.fill();
    }
    context.strokeStyle = 'rgba(245,250,255,.32)';
    context.lineWidth = 2;
    for (let band = 0; band < 11; band += 1) {
      const y = random() * canvas.height;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(110, y - 16 + random() * 32, 320, y + 20 - random() * 40, 512, y + random() * 13 - 6);
      context.stroke();
    }
  } else if (planet.texture === 'crater' || planet.texture === 'mars') {
    const count = planet.texture === 'crater' ? 75 : 40;
    for (let i = 0; i < count; i += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const radius = 1.5 + random() * (planet.texture === 'crater' ? 9 : 7);
      const shade = random() > .5 ? 'rgba(48,35,30,.19)' : 'rgba(255,223,184,.16)';
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = shade;
      context.fill();
      context.beginPath();
      context.arc(x - radius * .17, y - radius * .16, radius * .63, Math.PI, Math.PI * 2);
      context.strokeStyle = 'rgba(255,235,204,.18)';
      context.lineWidth = 1.1;
      context.stroke();
    }
  } else {
    const bandColors = planet.texture === 'jupiter'
      ? ['rgba(107,63,50,.26)', 'rgba(255,235,198,.32)', 'rgba(168,104,66,.3)']
      : ['rgba(71,50,42,.16)', 'rgba(255,240,214,.2)', 'rgba(28,68,118,.14)'];
    for (let y = 0; y < canvas.height; y += 4 + Math.floor(random() * 10)) {
      context.fillStyle = bandColors[Math.floor(random() * bandColors.length)];
      context.fillRect(0, y, canvas.width, 2 + random() * 9);
      if (random() > .78) {
        context.fillStyle = 'rgba(255,255,255,.1)';
        context.fillRect(0, y + 1, canvas.width, 1);
      }
    }
    for (let i = 0; i < 26; i += 1) {
      context.beginPath();
      const y = random() * canvas.height;
      context.ellipse(random() * canvas.width, y, 18 + random() * 70, 1.3 + random() * 4, (random() - .5) * .08, 0, Math.PI * 2);
      context.fillStyle = 'rgba(255,247,223,.1)';
      context.fill();
    }
    if (planet.texture === 'neptune') {
      context.beginPath();
      context.ellipse(213, 142, 19, 8, -.13, 0, Math.PI * 2);
      context.fillStyle = 'rgba(226,137,135,.65)';
      context.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeRadialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const glow = ctx.createRadialGradient(64, 64, 3, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,255,255,.8)');
  glow.addColorStop(.2, 'rgba(255,255,255,.32)');
  glow.addColorStop(.55, 'rgba(255,255,255,.08)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFallback(message = 'WebGL could not start in this browser or device.') {
  isStaticFallback = true;
  const planetsMarkup = planets.map((planet, index) => {
    const angle = (index / planets.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 5.2 + index * 4.3;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const size = Math.max(1.3, 2.2 - index * .08);
    return `<span class="fallback-planet" data-id="${planet.id}" style="--planet:${planet.color};--x:${x}%;--y:${y}%;--size:${size}%" aria-hidden="true"></span>`;
  }).join('');
  const orbits = Array.from({ length: 8 }, (_, index) => `<span class="fallback-orbit" style="--inset:${index * 6.1}%" aria-hidden="true"></span>`).join('');
  sceneRoot.innerHTML = `<div class="scene-fallback" role="img" aria-label="Static schematic of the solar system. Three-dimensional rendering is unavailable."><div class="fallback-diagram">${orbits}<span class="fallback-sun" aria-hidden="true"></span>${planetsMarkup}</div><div class="webgl-note"><strong>3D view unavailable</strong>${message} This static diagram keeps the planetary overview readable.</div></div>`;
  updatePlaybackUI();
}

function fitDistance() {
  const aspect = Math.max(window.innerWidth / Math.max(window.innerHeight, 1), 0.32);
  const verticalFov = THREE.MathUtils.degToRad(52);
  return Math.max(88, Math.min(315, 56 * 1.13 / (Math.tan(verticalFov / 2) * aspect)));
}

function addOrbit(radius) {
  const segments = 192;
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = i / segments * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: '#73809c', transparent: true, opacity: .21, depthWrite: false });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  return material;
}

function addMoon(anchor, moon, seed) {
  const orbitMaterial = new THREE.LineBasicMaterial({ color: '#b6c0d7', transparent: true, opacity: .16, depthWrite: false });
  const points = [];
  for (let index = 0; index <= 72; index += 1) {
    const angle = index / 72 * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * moon.orbit, 0, Math.sin(angle) * moon.orbit));
  }
  const orbitLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), orbitMaterial);
  anchor.add(orbitLine);
  const moonPivot = new THREE.Group();
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(moon.radius, 16, 12),
    new THREE.MeshStandardMaterial({ color: moon.color, roughness: .94, metalness: 0.01 })
  );
  moonMesh.position.x = moon.orbit;
  moonPivot.add(moonMesh);
  anchor.add(moonPivot);
  return { pivot: moonPivot, speed: moon.speed, phase: seed * .73 };
}

function createPlanet(planet, index) {
  const systemPivot = new THREE.Group();
  const anchor = new THREE.Group();
  anchor.position.x = planet.orbit;
  systemPivot.add(anchor);
  scene.add(systemPivot);

  const texture = makePlanetTexture(planet, 913 + index * 177);
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: texture ?? undefined,
    roughness: planet.kind === 'Gas giant' ? .79 : .91,
    metalness: .015
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(planet.radius, 42, 30), material);
  mesh.rotation.z = planet.tilt;
  anchor.add(mesh);
  pickMeshes.push(mesh);

  const glowMaterial = new THREE.SpriteMaterial({
    map: makeRadialTexture() ?? undefined,
    color: planet.color,
    transparent: true,
    opacity: .7,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.setScalar(planet.radius * 4.8);
  glow.visible = false;
  anchor.add(glow);

  if (planet.id === 'saturn') {
    const ringTones = ['#d9c59e', '#8f7557', '#e5d6b8', '#b49a72'];
    const ringBands = [[1.22, 1.62], [1.68, 1.93], [1.98, 2.34]];
    ringBands.forEach(([inner, outer], bandIndex) => {
      const ringMaterial = new THREE.MeshStandardMaterial({
        color: ringTones[bandIndex],
        roughness: .88,
        metalness: .02,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: bandIndex === 1 ? .72 : .84,
        depthWrite: false
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(planet.radius * inner, planet.radius * outer, 96), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.rotation.z = .28;
      anchor.add(ring);
    });
  }

  const moons = planet.moons.map((moon, moonIndex) => addMoon(anchor, moon, index * 1.4 + moonIndex));
  const orbitMaterial = addOrbit(planet.orbit);
  planetaryObjects.set(planet.id, { systemPivot, anchor, mesh, glow, orbitMaterial, moons });
}

function createStarfield() {
  const random = randomGenerator(87014);
  const positions = [];
  const colors = [];
  const colorChoices = [new THREE.Color('#c8d5ff'), new THREE.Color('#ffffff'), new THREE.Color('#a9e5e4'), new THREE.Color('#ffdcb0')];
  for (let index = 0; index < 1450; index += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const radius = 145 + random() * 150;
    positions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    const color = colorChoices[Math.floor(random() * colorChoices.length)];
    const tint = .58 + random() * .42;
    colors.push(color.r * tint, color.g * tint, color.b * tint);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: .62, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: .91, depthWrite: false, blending: THREE.AdditiveBlending });
  starPoints = new THREE.Points(geometry, material);
  scene.add(starPoints);
}

function init3D() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#050812');
  scene.fog = new THREE.FogExp2('#050812', .0007);

  camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, .1, 520);
  const initialDistance = fitDistance();
  camera.position.set(initialDistance * .12, initialDistance * .49, initialDistance * .86);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D solar-system model. Drag to orbit, scroll or pinch to zoom, or select a world from the planet list.');
  renderer.domElement.tabIndex = 0;
  sceneRoot.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = .075;
  controls.rotateSpeed = .64;
  controls.zoomSpeed = .8;
  controls.minDistance = Math.max(38, initialDistance * .34);
  controls.maxDistance = Math.max(330, initialDistance * 1.7);
  controls.minPolarAngle = .16;
  controls.maxPolarAngle = Math.PI / 2 - .08;
  controls.addEventListener('start', () => { userAdjustedCamera = true; });

  scene.add(new THREE.HemisphereLight(0x91add8, 0x1d1931, 1.25));
  const keyLight = new THREE.DirectionalLight(0xffd5a4, 2.35);
  keyLight.position.set(-42, 22, -16);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0x729bff, .46);
  fillLight.position.set(20, 10, 38);
  scene.add(fillLight);
  const sunLight = new THREE.PointLight(0xffc876, 900, 280, 1.5);
  scene.add(sunLight);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(4.05, 56, 40),
    new THREE.MeshStandardMaterial({ color: '#ffcf77', emissive: '#ff872e', emissiveIntensity: 1.65, roughness: .38, metalness: 0 })
  );
  scene.add(sun);
  const radialTexture = makeRadialTexture();
  sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture ?? undefined, color: '#ff9e45', transparent: true, opacity: .72, depthWrite: false, blending: THREE.AdditiveBlending }));
  sunGlow.scale.set(31, 31, 1);
  scene.add(sunGlow);

  createStarfield();
  planets.forEach(createPlanet);

  const downPosition = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (event) => downPosition.set(event.clientX, event.clientY));
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickMeshes, false)[0];
    if (hit) {
      for (const [id, body] of planetaryObjects) if (body.mesh === hit.object) selectPlanet(id);
    }
  });

  window.addEventListener('resize', () => {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (!userAdjustedCamera) {
      const distance = fitDistance();
      camera.position.set(distance * .12, distance * .49, distance * .86);
      controls.update();
    }
  });

  selectPlanet(activeId);
  updatePlaybackUI();
}

function updateSelectedLabel() {
  if (!camera || !renderer) return;
  const body = planetaryObjects.get(activeId);
  if (!body) return;
  body.mesh.getWorldPosition(projectVector);
  projectVector.project(camera);
  const x = (projectVector.x * .5 + .5) * window.innerWidth;
  const y = (-projectVector.y * .5 + .5) * window.innerHeight;
  const inView = projectVector.z > -1 && projectVector.z < 1 && x > 0 && x < window.innerWidth && y > 0 && y < window.innerHeight;
  selectedLabel.style.display = inView ? 'flex' : 'none';
  selectedLabel.style.left = `${x + 12}px`;
  selectedLabel.style.top = `${y}px`;
  selectedLabel.style.transform = 'translateY(-50%)';
}

function animate() {
  if (isStaticFallback) return;
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .045);
  if (playing) elapsed += delta * speed;
  planets.forEach((planet) => {
    const body = planetaryObjects.get(planet.id);
    body.systemPivot.rotation.y = planet.phase + elapsed * planet.speed * .27;
    body.mesh.rotation.y = elapsed * planet.spin;
    body.moons.forEach((moon) => { moon.pivot.rotation.y = moon.phase + elapsed * moon.speed * .55; });
    if (body.glow.visible) {
      const pulse = 1 + Math.sin(elapsed * 2.2) * .055;
      body.glow.scale.setScalar(planet.radius * 4.8 * pulse);
    }
  });
  if (starPoints) starPoints.rotation.y += delta * .0018;
  if (sunGlow) sunGlow.material.opacity = .66 + Math.sin(elapsed * 1.45) * .07;
  controls.update();
  renderer.render(scene, camera);
  updateSelectedLabel();
}

try {
  init3D();
  animate();
} catch (error) {
  console.error('Orbitarium switched to its static fallback:', error);
  if (renderer) {
    try { renderer.dispose(); } catch { /* The fallback remains usable if disposal is unavailable. */ }
  }
  createFallback(error?.message ? `The 3D scene failed to initialize (${error.message}).` : undefined);
}

selectPlanet(activeId);
