import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const startedAt = '2026-10-02T07:08:38Z';
const planets = [
  { name: 'Mercury', tagline: 'SMALL BUT SPEEDY', type: 'ROCKY PLANET', order: 'FIRST', year: '88 days', vibe: 'Crater club', description: "The little speedster closest to the Sun. Its crater-covered surface has seen a lot, and it zips through a year in just 88 Earth days.", color: '#beb4a4', dark: '#756d67', radius: .43, orbit: 4.4, rate: .68, phase: 1.1, texture: 'craters', tilt: .01 },
  { name: 'Venus', tagline: 'A REAL HOTHEAD', type: 'ROCKY PLANET', order: 'SECOND', year: '225 days', vibe: 'Cloud queen', description: "Wrapped in thick clouds, Venus keeps its surface hidden. Its intense greenhouse effect makes it the hottest planet in the solar system.", color: '#f8cc83', dark: '#bc804f', radius: .73, orbit: 6.4, rate: .44, phase: 3.6, texture: 'clouds', tilt: .05 },
  { name: 'Earth', tagline: 'HOME SWEET HOME', type: 'ROCKY PLANET', order: 'THIRD', year: '365 days', vibe: 'Mostly blue', description: "Our little blue oasis. Oceans, clouds, and the only life we've found so far. Pretty good place to start.", color: '#81adff', dark: '#1958bc', radius: .79, orbit: 8.5, rate: .31, phase: 5.2, texture: 'earth', tilt: .41 },
  { name: 'Mars', tagline: 'RED & READY', type: 'ROCKY PLANET', order: 'FOURTH', year: '687 days', vibe: 'Rusty explorer', description: "A rusty-red world of dusty plains, giant volcanoes, and robot explorers. The next-door neighbor with a taste for adventure.", color: '#f17950', dark: '#8e3935', radius: .58, orbit: 10.6, rate: .24, phase: 2.1, texture: 'mars', tilt: .44 },
  { name: 'Jupiter', tagline: 'BIG PLANET ENERGY', type: 'GAS GIANT', order: 'FIFTH', year: '11.9 years', vibe: 'Storm machine', description: "The heavyweight of the planetary family. Swirling cloud bands wrap around this gas giant, home to the enormous Great Red Spot storm.", color: '#dfac83', dark: '#9a695c', radius: 1.5, orbit: 14, rate: .13, phase: 4.2, texture: 'bands', tilt: .05 },
  { name: 'Saturn', tagline: 'PUT A RING ON IT', type: 'GAS GIANT', order: 'SIXTH', year: '29.5 years', vibe: 'Ring royalty', description: "The solar system's show-off, wearing spectacular rings made mostly of icy pieces. Even its famous accessories get to orbit.", color: '#edd6a3', dark: '#a39069', radius: 1.17, orbit: 18.1, rate: .09, phase: .65, texture: 'bands', tilt: .47, rings: true },
  { name: 'Uranus', tagline: 'SIDEWAYS IS A VIBE', type: 'ICE GIANT', order: 'SEVENTH', year: '84 years', vibe: 'Mint condition', description: "A cool blue-green giant with an unusual twist: its rotation axis is tipped almost sideways. This planet really does its own thing.", color: '#93e2df', dark: '#409ca6', radius: .97, orbit: 22.5, rate: .066, phase: 3.1, texture: 'ice', tilt: 1.7 },
  { name: 'Neptune', tagline: 'WAY OUT THERE', type: 'ICE GIANT', order: 'EIGHTH', year: '165 years', vibe: 'Deep blue', description: "Out at the edge of the planetary lineup, Neptune is a deep-blue world of fierce winds and dark storms. A very distant kind of cool.", color: '#618bff', dark: '#2c42ad', radius: .94, orbit: 27, rate: .051, phase: 5.55, texture: 'ice', tilt: .49 },
];

const $ = (id) => document.getElementById(id);
const canvas = $('universe');
const stage = $('stage');
const label = $('selection-label');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { selected: 2, paused: reducedMotion, speed: 1, time: 0, topView: false, focused: false, webgl: false };
let renderer, scene, camera, controls, sun, sunGlow, sunRays, focusMarker;
let frameId, lastFrame = null, lastRender = 0, cameraTween = null, destroyed = false;
const planetObjects = [];
const clickTargets = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const scratch = new THREE.Vector3();
const cameraHome = new THREE.Vector3(5, 34, 48);
const mobileCameraHome = new THREE.Vector3(6, 47, 64);
const materialsToDispose = new Set();
const geometryToDispose = new Set();
const texturesToDispose = new Set();
const texturePreviews = [];
const textureMaps = [];

function randomSource(seed) {
  let n = seed >>> 0;
  return () => { n = Math.imul(1664525, n) + 1013904223 >>> 0; return n / 4294967296; };
}
const rand = randomSource(42);
const trackMaterial = (material) => { materialsToDispose.add(material); return material; };
const trackGeometry = (geometry) => { geometryToDispose.add(geometry); return geometry; };
const trackTexture = (texture) => { texturesToDispose.add(texture); return texture; };

function makeTexture(planet, index) {
  const surface = document.createElement('canvas');
  surface.width = 512; surface.height = 256;
  const ctx = surface.getContext('2d');
  if (!ctx) return { texture: null, preview: '' };
  const r = randomSource(100 + index * 127);
  ctx.fillStyle = planet.color;
  ctx.fillRect(0, 0, 512, 256);
  const light = new THREE.Color(planet.color);
  const dark = new THREE.Color(planet.dark);
  const data = ctx.createImageData(512, 256);
  const color = new THREE.Color();
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 512; x++) {
      const u = x / 512 * Math.PI * 2;
      let amount;
      if (planet.texture === 'bands') {
        const wave = y + Math.sin(u * 3 + y * .027) * 2.3 + Math.sin(u * 7 - y * .033) * 1.4;
        amount = .34 + .2 * Math.sin(wave * .2) + .12 * Math.sin(wave * .7) + .07 * Math.sin(wave * 1.3) + r() * .055;
      } else if (planet.texture === 'ice' || planet.texture === 'clouds') {
        amount = .18 + .09 * Math.sin(y * .16 + Math.sin(u * 4) * .9) + .07 * Math.sin(y * .44 + Math.sin(u * 7)) + r() * .045;
      } else if (planet.texture === 'earth') {
        amount = .36 + Math.sin(u * 4 + y * .04) * .05 + r() * .075;
      } else {
        amount = .18 + .09 * Math.sin(u * 5 + y * .058) + .08 * Math.sin(u * 11 - y * .087) + r() * .14;
      }
      color.copy(light).lerp(dark, Math.max(0, Math.min(1, amount)));
      const offset = (y * 512 + x) * 4;
      data.data[offset] = color.r * 255;
      data.data[offset + 1] = color.g * 255;
      data.data[offset + 2] = color.b * 255;
      data.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);

  function blob(cx, cy, rx, ry, fill, irregularity = .3) {
    ctx.beginPath();
    for (let step = 0; step <= 32; step++) {
      const a = step / 32 * Math.PI * 2;
      const f = 1 + Math.sin(a * 5 + cx) * irregularity + Math.sin(a * 9 + cy) * irregularity * .4;
      const x = cx + Math.cos(a) * rx * f;
      const y = cy + Math.sin(a) * ry * f;
      if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  if (planet.texture === 'earth') {
    [[82,66,42,29],[109,110,20,40],[216,74,25,17],[254,111,28,44],[302,63,70,32],[358,139,37,18],[401,171,26,18]].forEach(([x,y,rx,ry], i) => {
      blob(x, y, rx, ry, i % 3 === 0 ? '#8cac66' : '#7da66e', .4);
      blob(x + 4, y + 2, rx * .61, ry * .64, '#b2b77e', .32);
    });
    blob(240, 249, 265, 16, '#d9ebf0', .13);
    blob(251, 0, 265, 12, '#e5f4fa', .1);
    for (let i = 0; i < 52; i++) {
      const x = r() * 512, y = 18 + r() * 220;
      blob(x, y, 6 + r() * 23, 1 + r() * 3, `rgba(255,255,255,${.2 + r() * .48})`, .22);
    }
  } else if (planet.texture === 'craters' || planet.texture === 'mars') {
    for (let i = 0; i < (planet.texture === 'craters' ? 90 : 45); i++) {
      const x = r() * 512, y = r() * 256, radius = 1.5 + r() * 11;
      const g = ctx.createRadialGradient(x - radius * .2, y - radius * .2, 0, x, y, radius);
      g.addColorStop(0, planet.texture === 'mars' ? '#682c382d' : '#48464475');
      g.addColorStop(.78, '#00000020'); g.addColorStop(.85, '#ffffff32'); g.addColorStop(1, '#ffffff00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, radius * 1.5, radius, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (planet.texture === 'mars') blob(245, 4, 260, 10, '#e8dac4', .13);
  } else if (planet.name === 'Jupiter') {
    ctx.save(); ctx.translate(348, 154); ctx.rotate(-.12);
    ctx.fillStyle = '#af644f'; ctx.beginPath(); ctx.ellipse(0, 0, 35, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e4b587'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#d68864'; ctx.beginPath(); ctx.ellipse(2, 0, 23, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const texture = trackTexture(new THREE.CanvasTexture(surface));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return { texture, preview: surface.toDataURL('image/png') };
}

planets.forEach((planet, index) => {
  const { texture, preview } = makeTexture(planet, index);
  textureMaps.push(texture); texturePreviews.push(preview);
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'planet-button';
  button.setAttribute('aria-pressed', String(index === state.selected));
  button.setAttribute('aria-label', `Select ${planet.name}, planet ${index + 1} of 8`);
  button.style.setProperty('--planet-color', planet.color);
  const number = document.createElement('span'); number.className = 'planet-button-number'; number.textContent = String(index + 1).padStart(2, '0'); number.setAttribute('aria-hidden', 'true');
  const orb = document.createElement('span'); orb.className = `mini-planet${planet.rings ? ' is-saturn' : ''}`; orb.setAttribute('aria-hidden', 'true');
  if (preview) orb.style.backgroundImage = `url(${preview})`;
  const name = document.createElement('span'); name.className = 'planet-button-name'; name.textContent = planet.name.toUpperCase();
  button.append(number, orb, name);
  button.addEventListener('click', () => selectPlanet(index));
  $('planet-buttons').append(button);
});

function selectPlanet(index, animate = true) {
  state.selected = index;
  const planet = planets[index];
  $('planet-index').textContent = `${String(index + 1).padStart(2, '0')} / 08`;
  $('planet-tagline').textContent = planet.tagline;
  $('planet-type').textContent = `${planet.type} / ${planet.order} FROM THE SUN`;
  $('planet-name').firstChild.textContent = planet.name;
  $('planet-description').textContent = planet.description;
  $('planet-year').textContent = planet.year;
  $('planet-vibe').textContent = planet.vibe;
  $('profile-art').classList.toggle('is-saturn', Boolean(planet.rings));
  $('profile-art').classList.toggle('is-uranus', planet.name === 'Uranus');
  document.querySelector('.profile-card').style.setProperty('--planet-color', planet.color);
  $('profile-planet').style.backgroundColor = planet.color;
  $('profile-planet').style.backgroundImage = texturePreviews[index] ? `url(${texturePreviews[index]})` : 'none';
  label.querySelector('b').textContent = planet.name.toUpperCase();
  document.querySelectorAll('.planet-button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  if (animate && !reducedMotion) {
    $('profile-art').classList.remove('animate');
    void $('profile-art').offsetWidth;
    $('profile-art').classList.add('animate');
  }
  if (state.focused && state.webgl) focusSelected();
}

function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,216,112,0.75)'); gradient.addColorStop(.3, 'rgba(255,148,42,0.6)'); gradient.addColorStop(.5, 'rgba(255,91,27,0.25)'); gradient.addColorStop(1, 'rgba(255,88,20,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  return trackTexture(new THREE.CanvasTexture(c));
}

function orbitPosition(planet, t, target) {
  const angle = planet.phase + t * planet.rate;
  return target.set(Math.cos(angle) * planet.orbit, Math.sin(angle * 2 + planet.phase) * .15, Math.sin(angle) * planet.orbit * .93);
}

function buildScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(44, 1, .1, 500);
  camera.position.copy(homePosition());
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .06;
  controls.enablePan = false; controls.minDistance = 4.5; controls.maxDistance = 120;
  controls.minPolarAngle = .03; controls.maxPolarAngle = Math.PI * .84;
  controls.rotateSpeed = .5; controls.zoomSpeed = .8;
  controls.addEventListener('start', () => { cameraTween = null; });
  controls.update();
  scene.add(new THREE.AmbientLight('#bcc6fa', .55));
  const hemisphere = new THREE.HemisphereLight('#e9e6ff', '#29253f', 1.2); scene.add(hemisphere);
  const sunlight = new THREE.PointLight('#fff1d1', 100, 0, 1.25); sunlight.position.set(0, 0, 0); scene.add(sunlight);
  const edgeLight = new THREE.DirectionalLight('#dbddff', 1.2); edgeLight.position.set(20, 30, 15); scene.add(edgeLight);

  // This is an intentionally graphic Sun, rather than a scientifically scaled star.
  const sunMaterial = trackMaterial(new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition; void main() { vUv = uv; vNormal = normalize(normalMatrix * normal); vec4 viewPosition = modelViewMatrix * vec4(position, 1.0); vPosition = viewPosition.xyz; gl_Position = projectionMatrix * viewPosition; }`,
    fragmentShader: `uniform float time; varying vec2 vUv; varying vec3 vNormal; varying vec3 vPosition; void main() { float wave = sin(vUv.y * 80.0 + sin(vUv.x * 30.0 + time * 0.2) * 2.8) * 0.5 + 0.5; float fleck = sin(vUv.x * 120.0 + sin(vUv.y * 66.0) * 2.0) * sin(vUv.y * 142.0 + time * 0.1); float edge = pow(max(0.0, dot(normalize(vNormal), normalize(-vPosition))), 0.6); vec3 orange = vec3(1.0, 0.31, 0.045); vec3 cream = vec3(1.0, 0.72, 0.24); vec3 color = mix(orange, cream, 0.55 + wave * 0.24 + fleck * 0.08); color *= 0.65 + edge * 0.55; gl_FragColor = vec4(color, 1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n }`,
  }));
  sun = new THREE.Mesh(trackGeometry(new THREE.SphereGeometry(2.12, 48, 32)), sunMaterial); scene.add(sun);
  sunGlow = new THREE.Sprite(trackMaterial(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: '#ff9a3f', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  sunGlow.scale.set(11.5, 11.5, 1); scene.add(sunGlow);
  sunRays = new THREE.Group();
  const rayGeometry = trackGeometry(new THREE.ConeGeometry(.12, .6, 3));
  const rayMaterial = trackMaterial(new THREE.MeshBasicMaterial({ color: '#ffa558', transparent: true, opacity: .55 }));
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    const ray = new THREE.Mesh(rayGeometry, rayMaterial);
    ray.position.set(Math.cos(angle) * 2.65, 0, Math.sin(angle) * 2.65);
    ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ray.position.clone().normalize());
    sunRays.add(ray);
  }
  scene.add(sunRays);

  planets.forEach((planet, index) => {
    const path = [];
    for (let i = 0; i < 192; i++) {
      const a = i / 192 * Math.PI * 2;
      path.push(new THREE.Vector3(Math.cos(a) * planet.orbit, 0, Math.sin(a) * planet.orbit * .93));
    }
    const orbitLine = new THREE.LineLoop(trackGeometry(new THREE.BufferGeometry().setFromPoints(path)), trackMaterial(new THREE.LineBasicMaterial({ color: planet.color, transparent: true, opacity: .24 })));
    scene.add(orbitLine);
    const root = new THREE.Group(); scene.add(root);
    const axis = new THREE.Group(); axis.rotation.z = planet.tilt; root.add(axis);
    const sphere = new THREE.Mesh(trackGeometry(new THREE.SphereGeometry(planet.radius, 40, 28)), trackMaterial(new THREE.MeshStandardMaterial({ map: textureMaps[index], color: textureMaps[index] ? '#ffffff' : planet.color, roughness: .94, metalness: 0 })));
    sphere.userData.planetIndex = index; axis.add(sphere); clickTargets.push(sphere);
    if (planet.name === 'Earth') {
      const atmosphere = new THREE.Mesh(trackGeometry(new THREE.SphereGeometry(planet.radius * 1.075, 32, 24)), trackMaterial(new THREE.MeshBasicMaterial({ color: '#75b4ff', transparent: true, opacity: .12, side: THREE.BackSide, depthWrite: false })));
      axis.add(atmosphere);
    }
    if (planet.rings) {
      const ringGeometry = trackGeometry(new THREE.RingGeometry(planet.radius * 1.45, planet.radius * 2.3, 96));
      const pos = ringGeometry.attributes.position;
      const uv = ringGeometry.attributes.uv;
      for (let j = 0; j < pos.count; j++) {
        const radius = Math.hypot(pos.getX(j), pos.getY(j));
        uv.setXY(j, (radius - planet.radius * 1.45) / (planet.radius * .85), .5);
      }
      const ringCanvas = document.createElement('canvas'); ringCanvas.width = 128; ringCanvas.height = 2;
      const ctx = ringCanvas.getContext('2d');
      for (let j = 0; j < 128; j++) {
        const pale = .3 + rRing(j) * .45;
        ctx.fillStyle = j > 79 && j < 85 ? '#302c242a' : `rgba(${185 + Math.floor(pale * 75)},${160 + Math.floor(pale * 75)},${112 + Math.floor(pale * 85)},${.45 + pale * .6})`;
        ctx.fillRect(j, 0, 1, 2);
      }
      const ringTexture = trackTexture(new THREE.CanvasTexture(ringCanvas)); ringTexture.colorSpace = THREE.SRGBColorSpace;
      const ring = new THREE.Mesh(ringGeometry, trackMaterial(new THREE.MeshStandardMaterial({ map: ringTexture, side: THREE.DoubleSide, transparent: true, opacity: .92, roughness: .9, depthWrite: false })));
      ring.rotation.x = -Math.PI / 2; ring.userData.planetIndex = index; axis.add(ring); clickTargets.push(ring);
    }
    orbitPosition(planet, 0, root.position);
    sphere.rotation.y = index;
    planetObjects.push({ root, axis, sphere, orbitLine });
  });

  const selectedRing = new THREE.TorusGeometry(1, .022, 5, 72);
  focusMarker = new THREE.Mesh(trackGeometry(selectedRing), trackMaterial(new THREE.MeshBasicMaterial({ color: '#dbff63', transparent: true, opacity: .95, depthWrite: false })));
  focusMarker.rotation.x = -Math.PI / 2; scene.add(focusMarker);
  makeStars(); resize();
  state.webgl = true;
  frameId = requestAnimationFrame(tick);
}

function rRing(x) { return .5 + .5 * Math.sin(x * 1.9) * Math.sin(x * .37); }
function makeStars() {
  const palette = ['#bbb1fc', '#fff9e9', '#8cc6ff'];
  [0, 1, 2].forEach((set) => {
    const count = set === 1 ? 370 : 170;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, y = rand() * 2 - 1, radius = 75 + rand() * 90;
      const h = Math.sqrt(1 - y * y);
      positions[i * 3] = Math.cos(a) * h * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(a) * h * radius;
    }
    const geometry = trackGeometry(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    scene.add(new THREE.Points(geometry, trackMaterial(new THREE.PointsMaterial({ color: palette[set], size: set === 1 ? .16 : .26, transparent: true, opacity: .6, sizeAttenuation: true, depthWrite: false }))));
  });
  const sparkGeometry = trackGeometry(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.24,0,0),new THREE.Vector3(.24,0,0),new THREE.Vector3(0,-.24,0),new THREE.Vector3(0,.24,0)]));
  const sparkMaterial = trackMaterial(new THREE.LineBasicMaterial({ color: '#d7cdfa', transparent: true, opacity: .65 }));
  for (let i = 0; i < 32; i++) {
    const star = new THREE.LineSegments(sparkGeometry, sparkMaterial);
    const a = rand() * Math.PI * 2, radius = 55 + rand() * 35;
    star.position.set(Math.cos(a) * radius, (rand() - .5) * 55, Math.sin(a) * radius);
    star.lookAt(camera.position); scene.add(star);
  }
}

function homePosition() { return stage.clientWidth < 520 ? mobileCameraHome : cameraHome; }
function resize() {
  if (!renderer || !camera) return;
  const width = Math.max(1, stage.clientWidth), height = Math.max(1, stage.clientHeight);
  camera.aspect = width / height; camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function updateObjects(dt) {
  planetObjects.forEach((object, index) => {
    orbitPosition(planets[index], state.time, object.root.position);
    if (!state.paused) object.sphere.rotation.y += dt * state.speed * (index === 1 || index === 6 ? -.17 : .29);
    object.orbitLine.material.opacity = index === state.selected ? .46 : .2;
  });
  const selected = planetObjects[state.selected];
  if (selected) {
    focusMarker.position.copy(selected.root.position); focusMarker.position.y -= planets[state.selected].radius * .05;
    focusMarker.scale.setScalar(planets[state.selected].radius * 1.5);
  }
  sun.material.uniforms.time.value = state.time;
  if (!state.paused) { sun.rotation.y += dt * .035 * state.speed; sunRays.rotation.y += dt * .045 * state.speed; }
  sunGlow.material.opacity = 0.92 + Math.sin(state.time * .4) * .06;
}

function tick(timestamp) {
  if (destroyed || !state.webgl) return;
  frameId = requestAnimationFrame(tick);
  if (document.hidden) { lastFrame = null; return; }
  // Keep mobile GPU use modest without slowing simulation time.
  if (stage.clientWidth < 600 && timestamp - lastRender < 27) return;
  lastRender = timestamp;
  const dt = lastFrame === null ? 0 : Math.min((timestamp - lastFrame) / 1000, .08);
  lastFrame = timestamp;
  if (!state.paused) state.time += dt * state.speed;
  updateObjects(dt);
  if (cameraTween) {
    cameraTween.elapsed += dt;
    const ratio = reducedMotion ? 1 : Math.min(1, cameraTween.elapsed / .75);
    const progress = 1 - Math.pow(1 - ratio, 3);
    camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, progress);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, progress);
    if (ratio >= 1) cameraTween = null;
  } else if (state.focused) {
    const target = planetObjects[state.selected].root.position;
    const offset = scratch.copy(target).sub(controls.target);
    camera.position.add(offset); controls.target.copy(target);
  }
  controls.update();
  renderer.render(scene, camera);
  positionLabel();
}

function positionLabel() {
  if (!camera || !planetObjects[state.selected]) return;
  const planet = planets[state.selected], object = planetObjects[state.selected];
  const p = scratch.copy(object.root.position); p.y += planet.radius * 1.15; p.project(camera);
  const width = stage.clientWidth, height = stage.clientHeight;
  const x = (p.x * .5 + .5) * width + 12, y = (-p.y * .5 + .5) * height;
  const shown = p.z > -1 && p.z < 1 && x > 30 && x < width - 85 && y > 93 && y < height - 72;
  label.style.opacity = shown ? '1' : '0';
  label.style.left = `${x}px`; label.style.top = `${y}px`;
}

function moveCamera(position, target = new THREE.Vector3()) {
  if (!state.webgl) return;
  controls.stopListenToKeyEvents();
  cameraTween = { fromPosition: camera.position.clone(), fromTarget: controls.target.clone(), toPosition: position.clone(), toTarget: target.clone(), elapsed: 0 };
  if (reducedMotion) { camera.position.copy(position); controls.target.copy(target); cameraTween = null; controls.update(); }
}

function focusSelected() {
  if (!state.webgl) return;
  state.focused = true; state.topView = false; updateViewButton();
  const planet = planets[state.selected], target = planetObjects[state.selected].root.position.clone();
  let direction = camera.position.clone().sub(controls.target).normalize();
  if (Math.abs(direction.y) > .98) direction = new THREE.Vector3(.25, .38, 1).normalize();
  const distance = Math.max(5.6, planet.radius * (planet.rings ? 9.5 : 7));
  moveCamera(target.clone().add(direction.multiplyScalar(distance)), target);
}

function showAll() {
  state.focused = false; state.topView = false; updateViewButton();
  moveCamera(homePosition());
}
function updateViewButton() {
  $('view-toggle').setAttribute('aria-pressed', String(state.topView));
  $('view-toggle').innerHTML = `<span aria-hidden="true">◉</span> ${state.topView ? 'ANGLED VIEW' : 'TOP VIEW'}`;
}
function updatePauseButton() {
  $('play-toggle').setAttribute('aria-pressed', String(state.paused));
  $('play-toggle').setAttribute('aria-label', state.paused ? 'Resume simulation' : 'Pause simulation');
  $('play-toggle').querySelector('.play-symbol').textContent = state.paused ? '▶' : 'Ⅱ';
  $('play-toggle').querySelector('.play-text').textContent = state.paused ? 'RESUME' : 'PAUSE';
  $('live-label').textContent = state.paused ? 'TAKING A BREATHER' : 'IN ORBIT';
  document.querySelector('.universe-card').classList.toggle('is-paused', state.paused);
}
function togglePause() { state.paused = !state.paused; updatePauseButton(); }
function orbitCamera(angle) {
  if (!state.webgl) return;
  cameraTween = null;
  const offset = camera.position.clone().sub(controls.target);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
  camera.position.copy(controls.target).add(offset); controls.update();
}
function zoomCamera(amount) {
  if (!state.webgl) return;
  cameraTween = null;
  const offset = camera.position.clone().sub(controls.target);
  const distance = THREE.MathUtils.clamp(offset.length() * amount, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(distance)); controls.update();
}

$('play-toggle').addEventListener('click', togglePause);
$('speed').addEventListener('input', (event) => {
  state.speed = Number(event.target.value);
  $('speed-value').textContent = `${state.speed}×`;
  $('speed').setAttribute('aria-valuetext', `${state.speed} times normal speed`);
});
$('reset').addEventListener('click', () => {
  state.time = 0; state.speed = 1; state.paused = reducedMotion; state.focused = false; state.topView = false;
  $('speed').value = '1'; $('speed-value').textContent = '1×'; $('speed').setAttribute('aria-valuetext', '1 times normal speed');
  planetObjects.forEach((object, index) => { object.sphere.rotation.y = index; });
  selectPlanet(2); updatePauseButton(); updateViewButton(); showAll();
});
$('focus-planet').addEventListener('click', focusSelected);
$('show-all').addEventListener('click', showAll);
$('orbit-left').addEventListener('click', () => orbitCamera(-Math.PI / 12));
$('orbit-right').addEventListener('click', () => orbitCamera(Math.PI / 12));
$('zoom-in').addEventListener('click', () => zoomCamera(.83));
$('zoom-out').addEventListener('click', () => zoomCamera(1.2));
$('view-toggle').addEventListener('click', () => {
  state.focused = false; state.topView = !state.topView; updateViewButton();
  const distance = homePosition().length();
  moveCamera(state.topView ? new THREE.Vector3(.01, distance, .1) : homePosition());
});
canvas.addEventListener('keydown', (event) => {
  if (!state.webgl) return;
  const actions = { ArrowLeft: () => orbitCamera(-Math.PI / 12), ArrowRight: () => orbitCamera(Math.PI / 12), ArrowUp: () => zoomCamera(.83), ArrowDown: () => zoomCamera(1.2), '+': () => zoomCamera(.83), '=': () => zoomCamera(.83), '-': () => zoomCamera(1.2), ' ': togglePause, Home: showAll };
  if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
});
let pointerStart = null;
canvas.addEventListener('pointerdown', (event) => { pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId, time: performance.now() }; });
canvas.addEventListener('pointerup', (event) => {
  if (!pointerStart || !state.webgl || event.pointerId !== pointerStart.id) return;
  const wasClick = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 7 && performance.now() - pointerStart.time < 500;
  pointerStart = null;
  if (!wasClick) return;
  const rect = canvas.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickTargets, false)[0];
  if (hit) selectPlanet(hit.object.userData.planetIndex);
});
canvas.addEventListener('pointercancel', () => { pointerStart = null; });
canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); showFallback('The 3D view lost its WebGL connection. Planet profiles still work. Reload this page to try the scene again.'); });

function showFallback(message = '') {
  state.webgl = false; cancelAnimationFrame(frameId); label.style.display = 'none';
  $('fallback').hidden = false;
  if (message) $('fallback').querySelector('p').textContent = message;
  $('live-label').textContent = 'PROFILE MODE';
  canvas.hidden = true;
  ['play-toggle','speed','reset','focus-planet','show-all','view-toggle','orbit-left','orbit-right','zoom-in','zoom-out'].forEach((id) => { $(id).disabled = true; });
  stage.querySelector('.stage-bottom p').textContent = 'EXPLORE WITH THE PLANET BUTTONS BELOW';
}

selectPlanet(2, false); updatePauseButton();
$('speed').setAttribute('aria-valuetext', '1 times normal speed');
try { buildScene(); } catch (error) {
  console.warn('Orbit Arcade could not start its WebGL view:', error);
  if (renderer) renderer.dispose();
  showFallback();
}
const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
document.addEventListener('visibilitychange', () => { lastFrame = null; });
window.addEventListener('pagehide', () => {
  destroyed = true; cancelAnimationFrame(frameId); resizeObserver.disconnect();
  controls?.dispose(); renderer?.dispose();
  geometryToDispose.forEach((geometry) => geometry.dispose());
  materialsToDispose.forEach((material) => material.dispose());
  texturesToDispose.forEach((texture) => texture.dispose());
}, { once: true });
