import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const planets = [
  { name:'Mercury', type:'TERRESTRIAL PLANET', color:'#b7a89c', radius:.48, orbit:6.4, period:9, angle:3.7, distance:'0.39', year:['88','days'], diameter:'4,879', tagline:'Small world. Big temperature swings.', description:'The smallest planet travels closest to the Sun. Its cratered surface has almost no atmosphere to hold on to warmth.' },
  { name:'Venus', type:'TERRESTRIAL PLANET', color:'#e2bb84', radius:.79, orbit:9.2, period:14, angle:5.0, distance:'0.72', year:['225','days'], diameter:'12,104', tagline:'Beautiful from a safe distance.', description:'A thick blanket of clouds hides a volcanic landscape. Its dense atmosphere traps heat, making Venus hotter than Mercury.' },
  { name:'Earth', type:'TERRESTRIAL PLANET', color:'#6eaab5', radius:.85, orbit:12.2, period:20, angle:1.1, distance:'1.00', year:['365','days'], diameter:'12,742', tagline:'A familiar blue marble.', description:'Our ocean-covered home is the only world known to host life. A thin atmosphere makes all the difference.' },
  { name:'Mars', type:'TERRESTRIAL PLANET', color:'#ca7960', radius:.64, orbit:15.4, period:28, angle:2.5, distance:'1.52', year:['687','days'], diameter:'6,779', tagline:'A rust-red world of possibilities.', description:'Iron-rich dust gives Mars its warm color. This cold desert holds giant volcanoes, deep canyons, and traces of ancient water.' },
  { name:'Jupiter', type:'GAS GIANT', color:'#d1b398', radius:2.0, orbit:20.0, period:45, angle:3.4, distance:'5.20', year:['11.9','years'], diameter:'139,820', tagline:'The giant of the neighborhood.', description:'Jupiter is the largest planet in our solar system. Bands of swirling clouds wrap around a world with no solid surface.' },
  { name:'Saturn', type:'GAS GIANT', color:'#d8c49b', radius:1.66, orbit:25.1, period:61, angle:.25, distance:'9.58', year:['29.4','years'], diameter:'116,460', tagline:'Dressed for the occasion.', description:'Saturn’s remarkable rings are made mostly of ice, with some rock and dust. The planet itself is a light, airy gas giant.' },
  { name:'Uranus', type:'ICE GIANT', color:'#9ed6d6', radius:1.18, orbit:30.4, period:79, angle:4.45, distance:'19.2', year:['84','years'], diameter:'50,724', tagline:'A wonderfully sideways world.', description:'Uranus rolls around the Sun with its axis tipped nearly sideways. Methane in its cold atmosphere gives it a blue-green hue.' },
  { name:'Neptune', type:'ICE GIANT', color:'#608bd2', radius:1.14, orbit:35.4, period:100, angle:2.25, distance:'30.1', year:['165','years'], diameter:'49,244', tagline:'Out where the sunlight fades.', description:'The outermost planet is a deep blue, windy world. So far from the Sun, Neptune takes about 165 Earth years to complete one orbit.' }
];
const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const speedSteps = [.25,.5,1,2,5,10];
const state = { selected:2, paused:reducedMotion, speed:1, time:0, orbits:true, labels:true, focused:false, available:false };
const bodies = [];
const labels = [];
const pickTargets = [];
let renderer, scene, camera, controls, sun, selectedHalo, orbitGroup;
let lastTime = performance.now();
let transition = null;
let trackedPosition = new THREE.Vector3();
const projected = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();
const worldUp = new THREE.Vector3(0,1,0);
const overviewDirection = new THREE.Vector3(.12,.74,1).normalize();
let homeDistance = 86;
let seed = 79451;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };

for (const [i,p] of planets.entries()) {
  const button = document.createElement('button');
  button.className = 'planet-choice';
  button.type = 'button';
  button.style.setProperty('--planet-color',p.color);
  button.setAttribute('aria-pressed',String(i === state.selected));
  button.setAttribute('aria-label',`Select ${p.name}`);
  button.innerHTML = `<span class="planet-chip ${p.name.toLowerCase()}" aria-hidden="true"></span><span>${p.name}</span>`;
  button.addEventListener('click', () => selectPlanet(i));
  $('planet-selector').append(button);
  const label = document.createElement('span');
  label.className = `planet-label${i === state.selected ? ' selected' : ''}`;
  label.textContent = p.name;
  $('planet-labels').append(label);
  labels.push(label);
}

function selectPlanet(index, announce = true) {
  state.selected = index;
  const p = planets[index];
  $('planet-name').textContent = p.name;
  $('planet-category').textContent = p.type;
  $('planet-number').textContent = `${String(index+1).padStart(2,'0')} / 08`;
  $('planet-tagline').textContent = p.tagline;
  $('planet-description').textContent = p.description;
  $('planet-distance').innerHTML = `${p.distance} <span>AU</span>`;
  $('planet-year').innerHTML = `${p.year[0]} <span>${p.year[1]}</span>`;
  $('planet-diameter').innerHTML = `${p.diameter} <span>km</span>`;
  $('planet-preview').className = `planet-preview ${p.name.toLowerCase()}`;
  $('planet-preview').style.setProperty('--planet-color',p.color);
  $('focus-label').textContent = state.focused ? `Viewing ${p.name} · zoom out` : `Get closer to ${p.name}`;
  [...$('planet-selector').children].forEach((button,i) => button.setAttribute('aria-pressed',String(i===index)));
  labels.forEach((label,i) => label.classList.toggle('selected',i===index));
  if (orbitGroup) orbitGroup.children.forEach((orbit,i) => {
    orbit.material.color.set(i===index ? '#a5dbc6' : '#526779');
    orbit.material.opacity = i===index ? .45 : .21;
  });
  if (state.focused && state.available) focusSelected();
  if (announce) $('announcer').textContent = `${p.name} selected. ${p.tagline} ${p.description}`;
}

function updatePlayback() {
  $('play-label').textContent = state.paused ? 'Resume' : 'Pause';
  $('play-symbol').textContent = state.paused ? '▶' : 'Ⅱ';
  $('play-pause').setAttribute('aria-label',`${state.paused ? 'Resume' : 'Pause'} simulation`);
  $('motion-status').textContent = state.available ? (state.paused ? 'PAUSED' : 'IN MOTION') : '3D UNAVAILABLE';
  $('live-dot').classList.toggle('paused',state.paused || !state.available);
}
function setSpeed() {
  state.speed = speedSteps[Number($('speed').value)];
  $('speed-output').textContent = `${state.speed}×`;
  $('speed').setAttribute('aria-valuetext',`${state.speed} times normal speed`);
}
$('play-pause').addEventListener('click', () => {state.paused = !state.paused; updatePlayback();});
$('speed').addEventListener('input',setSpeed);
$('toggle-orbits').addEventListener('click', () => {
  state.orbits = !state.orbits;
  $('toggle-orbits').setAttribute('aria-pressed',String(state.orbits));
  if (orbitGroup) orbitGroup.visible = state.orbits;
});
$('toggle-labels').addEventListener('click', () => {
  state.labels = !state.labels;
  $('toggle-labels').setAttribute('aria-pressed',String(state.labels));
  $('planet-labels').hidden = !state.labels;
});
$('reset').addEventListener('click', () => {
  state.time = 0;
  state.paused = reducedMotion;
  state.focused = false;
  state.orbits = true;
  state.labels = true;
  $('speed').value = '2';
  setSpeed();
  $('toggle-orbits').setAttribute('aria-pressed','true');
  $('toggle-labels').setAttribute('aria-pressed','true');
  $('planet-labels').hidden = false;
  if (orbitGroup) orbitGroup.visible = true;
  selectPlanet(2,false);
  updatePlayback();
  if (state.available) { updatePositions(); goOverview(); }
  $('announcer').textContent = 'Simulation reset. Earth selected, normal speed, system overview.';
});
$('focus-planet').addEventListener('click', () => state.focused ? goOverview() : focusSelected());
$('overview').addEventListener('click',goOverview);
$('zoom-in').addEventListener('click', () => zoomCamera(.8));
$('zoom-out').addEventListener('click', () => zoomCamera(1.25));
$('rotate-left').addEventListener('click', () => rotateCamera(-.18));
$('rotate-right').addEventListener('click', () => rotateCamera(.18));

function makeTexture(p,index) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const context = canvas.getContext('2d');
  const image = context.createImageData(512,256);
  const base = new THREE.Color(p.color);
  for (let y=0; y<256; y++) for (let x=0; x<512; x++) {
    const u=x/512, v=y/256, lon=u*Math.PI*2, lat=(v-.5)*Math.PI;
    const grain = (random()-.5)*.075;
    let r=base.r, g=base.g, b=base.b;
    let shade = .9 + grain;
    if (index===2) {
      const field = Math.sin(lon*2.2+Math.cos(lat*4)*1.6)+.58*Math.sin(lon*5.3-lat*3.8)+.28*Math.cos(lon*11+lat*8);
      const land = field > .48 && Math.abs(lat)<1.23;
      const clouds = Math.sin(lon*9+lat*13+Math.sin(lon*3)*2)+Math.cos(lon*4-lat*18);
      [r,g,b] = land ? [.13+grain,.33+grain,.21+grain] : [.028+grain*.2,.17+grain,.30+grain];
      if (Math.abs(lat)>1.32 || clouds>1.48) {r+=.35;g+=.36;b+=.36;}
      shade=1;
    } else if (index===4 || index===5) {
      const bands=Math.sin(v*100+Math.sin(lon*3)*.7)+.45*Math.cos(v*182+Math.sin(lon*6));
      shade = .86 + bands*(index===4?.14:.07) + grain;
      if (index===4) {
        const storm = Math.pow((u-.69)/.062,2)+Math.pow((v-.59)/.038,2);
        if (storm<1) {r=.50;g=.21;b=.11;shade=1+.15*Math.sin(storm*30);}
      }
    } else if (index===0 || index===3) {
      shade += .12*Math.sin(lon*7+Math.cos(lat*9)*1.5)*Math.sin(lat*11)+.09*Math.cos(lon*16-lat*14);
      if (index===3 && Math.abs(lat)>1.35) {r=.58;g=.59;b=.55;}
    } else if (index===1) shade += .08*Math.sin(v*49+Math.sin(lon*3)*3)+.05*Math.cos(lon*7+v*35);
    else shade += .028*Math.sin(v*65+Math.sin(lon*3))+.018*Math.cos(v*112);
    const k=(y*512+x)*4;
    image.data[k]=Math.max(0,Math.min(255,r*shade*255));
    image.data[k+1]=Math.max(0,Math.min(255,g*shade*255));
    image.data[k+2]=Math.max(0,Math.min(255,b*shade*255));
    image.data[k+3]=255;
  }
  context.putImageData(image,0,0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
function glowTexture() {
  const canvas=document.createElement('canvas'); canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(128,128,0,128,128,128);
  gradient.addColorStop(0,'rgba(255,241,187,1)');
  gradient.addColorStop(.17,'rgba(255,197,94,.6)');
  gradient.addColorStop(.32,'rgba(255,157,65,.2)');
  gradient.addColorStop(.62,'rgba(254,115,48,.045)');
  gradient.addColorStop(1,'rgba(254,115,48,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
  return new THREE.CanvasTexture(canvas);
}
function makeRing() {
  const geometry = new THREE.RingGeometry(2.05,3.18,128,1);
  const material = new THREE.MeshStandardMaterial({color:'#c5b397',side:THREE.DoubleSide,transparent:true,opacity:.8,roughness:1});
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=1;
  const ctx=canvas.getContext('2d');
  for(let i=0;i<256;i++) {
    const gap=(i>136&&i<157)||(i>224&&i<229);
    const c=Math.round(140+random()*86);
    ctx.fillStyle=`rgba(${c},${Math.round(c*.9)},${Math.round(c*.73)},${gap?.05:.45+random()*.5})`;
    ctx.fillRect(i,0,1,1);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const position=geometry.attributes.position;
  const uv=geometry.attributes.uv;
  for(let i=0;i<position.count;i++) uv.setXY(i,(Math.hypot(position.getX(i),position.getY(i))-2.05)/1.13,.5);
  material.map=texture;
  const ring=new THREE.Mesh(geometry,material);
  ring.rotation.x=-Math.PI/2+.4;
  ring.rotation.y=.18;
  return ring;
}
function createScene() {
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
  renderer.setClearColor(0x090e17,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.4;
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('role','img');
  renderer.domElement.setAttribute('aria-label','Stylized 3D solar system. Drag to orbit and scroll or pinch to zoom. When focused, use arrow keys to orbit, plus or minus to zoom, and Escape for overview. Use the planet buttons for accessible selection.');
  $('viewport').prepend(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(43,1,.1,800);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;
  controls.rotateSpeed=.55;controls.zoomSpeed=.85;controls.minDistance=4;controls.maxDistance=230;
  controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI*.91;
  controls.addEventListener('start', () => {transition=null;});
  scene.add(new THREE.AmbientLight('#c4d8ed',1.05));
  const fill=new THREE.DirectionalLight('#fff2d8',2.4);fill.position.set(-25,35,20);scene.add(fill);
  const light=new THREE.PointLight('#ffe0a0',750,150,1.75);scene.add(light);
  const starVertices=[], starColors=[];
  for(let i=0;i<1250;i++) {
    const a=random()*Math.PI*2,z=random()*2-1,r=130+random()*130,s=Math.sqrt(1-z*z);
    starVertices.push(r*s*Math.cos(a),r*z,r*s*Math.sin(a));
    const brightness=.2+random()*.55;
    starColors.push(brightness*.84,brightness*.92,brightness);
  }
  const starsGeometry=new THREE.BufferGeometry();
  starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starVertices,3));
  starsGeometry.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
  scene.add(new THREE.Points(starsGeometry,new THREE.PointsMaterial({size:.26,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.85,depthWrite:false})));
  const sunMaterial=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:`varying vec3 vNormal;varying vec3 vPosition;void main(){vNormal=normal;vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uTime;varying vec3 vNormal;varying vec3 vPosition;void main(){float n=sin(vPosition.x*16.+sin(vPosition.y*12.)+uTime*.17)*cos(vPosition.z*15.-vPosition.y*6.);float n2=sin(vPosition.x*34.+vPosition.y*25.)*sin(vPosition.z*28.);vec3 col=mix(vec3(1.,.39,.055),vec3(1.,.86,.43),.66+n*.11+n2*.055);gl_FragColor=vec4(col*1.35,1.);}`});
  sun=new THREE.Mesh(new THREE.SphereGeometry(2.65,64,40),sunMaterial);scene.add(sun);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:'#ffd190',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.8}));glow.scale.set(24,24,1);scene.add(glow);
  orbitGroup=new THREE.Group();scene.add(orbitGroup);
  const geometry=new THREE.SphereGeometry(1,48,32);
  planets.forEach((p,i) => {
    const orbitPoints=[];for(let j=0;j<256;j++) {const a=j/256*Math.PI*2;orbitPoints.push(new THREE.Vector3(Math.cos(a)*p.orbit,0,Math.sin(a)*p.orbit));}
    const orbit=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(orbitPoints),new THREE.LineBasicMaterial({color:i===state.selected?'#a5dbc6':'#526779',transparent:true,opacity:i===state.selected?.45:.21}));orbitGroup.add(orbit);
    const group=new THREE.Group();scene.add(group);
    const body=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:makeTexture(p,i),roughness:.95,metalness:0}));body.scale.setScalar(p.radius);body.rotation.z=i===6?1.65:.07;body.userData.planetIndex=i;group.add(body);pickTargets.push(body);
    if(i===5){const ring=makeRing();ring.userData.planetIndex=i;group.add(ring);pickTargets.push(ring);}
    if(i===2 || i===6 || i===7) {
      const atmosphere=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:i===2?'#67b9e7':'#8ad2e0',transparent:true,opacity:.055,side:THREE.BackSide,depthWrite:false}));atmosphere.scale.setScalar(p.radius*1.06);group.add(atmosphere);
    }
    // A wider invisible hit sphere makes small planets comfortable to select.
    const hit=new THREE.Mesh(new THREE.SphereGeometry(Math.max(p.radius*1.35,.9),16,12),new THREE.MeshBasicMaterial({visible:false}));hit.userData.planetIndex=i;group.add(hit);pickTargets.push(hit);
    bodies.push({group,body});
  });
  selectedHalo=new THREE.Mesh(new THREE.RingGeometry(1,1.027,80),new THREE.MeshBasicMaterial({color:'#b9efd9',transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));scene.add(selectedHalo);
  state.available=true;
  updatePositions();resize(true);
  const observer=new ResizeObserver(() => resize(false));observer.observe($('viewport'));
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let down=null;
  renderer.domElement.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY,time:performance.now()};});
  renderer.domElement.addEventListener('pointerup',event=>{
    if(!down || Math.hypot(event.clientX-down.x,event.clientY-down.y)>7 || performance.now()-down.time>600){down=null;return;}
    down=null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(pickTargets,false);if(hits.length)selectPlanet(hits[0].object.userData.planetIndex);
  });
  renderer.domElement.addEventListener('pointercancel',()=>{down=null;});
  renderer.domElement.addEventListener('keydown',event=>{
    let handled=true;
    if(event.key==='ArrowLeft')rotateCamera(-.12);
    else if(event.key==='ArrowRight')rotateCamera(.12);
    else if(event.key==='ArrowUp')rotateCamera(0,-.1);
    else if(event.key==='ArrowDown')rotateCamera(0,.1);
    else if(event.key==='+' || event.key==='=')zoomCamera(.85);
    else if(event.key==='-')zoomCamera(1.18);
    else if(event.key==='Escape')goOverview();
    else handled=false;
    if(handled)event.preventDefault();
  });
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();showFallback();});
}
function showFallback() {
  state.available=false;
  document.querySelector('.app').classList.add('no-webgl');
  $('fallback').hidden=false;
  for(const id of ['play-pause','speed','focus-planet','zoom-in','zoom-out','rotate-left','rotate-right','overview','toggle-orbits','toggle-labels'])$(id).disabled=true;
  $('scene-hint').textContent='Choose a planet below to explore its field notes.';
  updatePlayback();
}
function resize(initial=false) {
  if(!state.available)return;
  const rect=$('viewport').getBoundingClientRect();
  if(!rect.width || !rect.height)return;
  camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height,false);
  const verticalFov=THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*camera.aspect);
  homeDistance=39/Math.sin(Math.min(verticalFov,horizontalFov)/2);
  controls.maxDistance=Math.max(230,homeDistance*1.7);
  if(initial){camera.position.copy(overviewDirection).multiplyScalar(homeDistance);controls.target.set(0,0,0);controls.update();}
  else if(!state.focused) {
    const offset=camera.position.clone().sub(controls.target).normalize().multiplyScalar(homeDistance);
    camera.position.copy(controls.target).add(offset);controls.update();
  }
}
function updatePositions() {
  bodies.forEach(({group,body},i)=>{
    const p=planets[i],a=p.angle+state.time/p.period*Math.PI*2;
    group.position.set(Math.cos(a)*p.orbit,0,Math.sin(a)*p.orbit);
    body.rotation.y=state.time*.12;
  });
}
function goOverview() {
  if(!state.available)return;
  state.focused=false;
  transition={target:new THREE.Vector3(),distance:homeDistance,overview:true};
  $('focus-label').textContent=`Get closer to ${planets[state.selected].name}`;
  $('scene-hint').textContent='Drag to orbit · Scroll to zoom · Select a planet';
}
function focusSelected() {
  if(!state.available)return;
  state.focused=true;
  trackedPosition.copy(bodies[state.selected].group.position);
  transition={target:trackedPosition.clone(),distance:Math.max(7,planets[state.selected].radius*(state.selected===5?8:6)),overview:false};
  $('focus-label').textContent=`Viewing ${planets[state.selected].name} · zoom out`;
  $('scene-hint').textContent=`Following ${planets[state.selected].name} · Drag to look around`;
}
function zoomCamera(factor) {
  if(!state.available)return;
  transition=null;
  const offset=camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));
  camera.position.copy(controls.target).add(offset);controls.update();
}
function rotateCamera(theta,phi=0) {
  if(!state.available)return;
  transition=null;
  const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  spherical.theta+=theta;spherical.phi=THREE.MathUtils.clamp(spherical.phi+phi,.08,Math.PI*.91);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(!state.available || document.hidden)return;
  if(!state.paused)state.time+=dt*state.speed;
  updatePositions();
  sun.material.uniforms.uTime.value=state.time;
  if(transition) {
    desiredTarget.copy(state.focused?bodies[state.selected].group.position:transition.target);
    const smoothing=reducedMotion?1:1-Math.exp(-dt*6);
    const offset=transition.overview?overviewDirection.clone():camera.position.clone().sub(controls.target).normalize();
    const distance=THREE.MathUtils.lerp(camera.position.distanceTo(controls.target),transition.distance,smoothing);
    controls.target.lerp(desiredTarget,smoothing);
    camera.position.copy(controls.target).addScaledVector(offset,distance);
    trackedPosition.copy(desiredTarget);
    if(controls.target.distanceTo(desiredTarget)<.015 && Math.abs(distance-transition.distance)<.02)transition=null;
  } else if(state.focused) {
    const target=bodies[state.selected].group.position;
    const delta=target.clone().sub(trackedPosition);
    controls.target.add(delta);camera.position.add(delta);trackedPosition.copy(target);
  }
  controls.update();
  const selected=bodies[state.selected].group.position;
  selectedHalo.position.copy(selected);
  selectedHalo.quaternion.copy(camera.quaternion);
  selectedHalo.scale.setScalar(planets[state.selected].radius*1.48);
  selectedHalo.visible=!state.focused;
  camera.updateMatrixWorld();
  const width=$('viewport').clientWidth,height=$('viewport').clientHeight;
  bodies.forEach(({group},i)=>{
    projected.copy(group.position).project(camera);
    const visible=projected.z>-1 && projected.z<1 && Math.abs(projected.x)<1.1 && Math.abs(projected.y)<1.1;
    labels[i].hidden=!visible || (state.focused && i===state.selected);
    if(visible){
      const pixelRadius=planets[i].radius*height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.position.distanceTo(group.position));
      labels[i].style.transform=`translate(${(projected.x*.5+.5)*width+pixelRadius+5}px,${(-projected.y*.5+.5)*height-10}px)`;
    }
  });
  renderer.render(scene,camera);
}
try {createScene();} catch(error) {console.warn('Planet Lab could not initialize its 3D view:',error);showFallback();}
selectPlanet(2,false);updatePlayback();
requestAnimationFrame(animate);
