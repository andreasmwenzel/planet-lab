import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const icons = {
  pause: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 5v10M13 5v10" stroke="currentColor" stroke-width="2.5"/></svg>',
  play: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m7 4 9 6-9 6V4Z" fill="currentColor"/></svg>',
  reset: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 7a6.5 6.5 0 1 1-.2 6M4 3v4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  focus: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="4.5" stroke="currentColor"/><path d="M10 1v4m0 10v4M1 10h4m10 0h4" stroke="currentColor"/></svg>',
  overview: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><ellipse cx="10" cy="10" rx="8" ry="3.5" transform="rotate(-30 10 10)" stroke="currentColor"/><circle cx="10" cy="10" r="2" fill="currentColor"/></svg>',
  names: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 15 10 4l6 11M6 11h8" stroke="currentColor" stroke-width="1.3"/></svg>',
};

const planets = [
  {name:'Mercury',kind:'Terrestrial planet',subtitle:'The swiftest world',color:'#b5afa0',radius:.37,orbit:4.1,period:.241,phase:2.8,tilt:.035,distance:'0.39 AU',year:'88 days',diameter:'4,879 km',description:'A small, cratered world that circles close to the Sun. Its quiet surface holds the marks of billions of years.'},
  {name:'Venus',kind:'Terrestrial planet',subtitle:'Behind a veil of clouds',color:'#d2b68b',radius:.65,orbit:6,period:.615,phase:5.35,tilt:.022,distance:'0.72 AU',year:'225 days',diameter:'12,104 km',description:'A rocky world wrapped in thick clouds. Beneath that bright veil lies the hottest surface of any planet.'},
  {name:'Earth',kind:'Terrestrial planet',subtitle:'Our small blue home',color:'#7da9ac',radius:.7,orbit:8.1,period:1,phase:.25,tilt:0,distance:'1.00 AU',year:'365 days',diameter:'12,742 km',description:'An ocean world with a thin, life-sustaining atmosphere. The only place where life is known to exist.'},
  {name:'Mars',kind:'Terrestrial planet',subtitle:'A world of rust and dust',color:'#be8267',radius:.5,orbit:10.5,period:1.881,phase:3.92,tilt:.025,distance:'1.52 AU',year:'687 days',diameter:'6,779 km',description:'Iron-rich dust gives Mars its warm red hue. Ancient riverbeds trace a wetter chapter in its distant past.'},
  {name:'Jupiter',kind:'Gas giant',subtitle:'The great banded giant',color:'#c3ad8c',radius:1.45,orbit:14,period:11.86,phase:5.55,tilt:.014,distance:'5.20 AU',year:'11.9 years',diameter:'139,820 km',description:'The largest planet, striped by vast cloud belts. Its Great Red Spot is a storm larger than Earth.'},
  {name:'Saturn',kind:'Gas giant',subtitle:'A delicate ring of ice',color:'#c7b993',radius:1.16,orbit:18.1,period:29.46,phase:2.52,tilt:.025,distance:'9.58 AU',year:'29.5 years',diameter:'116,460 km',description:'An airy giant surrounded by countless pieces of ice and rock. Together, they form its extraordinary rings.'},
  {name:'Uranus',kind:'Ice giant',subtitle:'A world turned sideways',color:'#8bbab7',radius:.88,orbit:22.2,period:84.01,phase:4.33,tilt:.016,distance:'19.2 AU',year:'84 years',diameter:'50,724 km',description:'A pale blue-green giant with an extreme axial tilt. Its seasons unfold over decades as it rolls around the Sun.'},
  {name:'Neptune',kind:'Ice giant',subtitle:'At the edge of the known',color:'#688cae',radius:.85,orbit:26.3,period:164.8,phase:.6,tilt:.019,distance:'30.1 AU',year:'165 years',diameter:'49,244 km',description:'Cold, distant and swept by powerful winds. This deep blue world takes nearly 165 Earth years to circle the Sun.'},
];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let selectedIndex = 2;
let playing = !reducedMotion;
let speed = 1;
let simDays = 0;
let following = false;
let showNames = true;
let renderer, scene, camera, controls, selectionRing, sun, starField;
let ready = false;
let cameraTransition = null;
const bodies = [];
const orbitLines = [];
const projectPoint = new THREE.Vector3();
const lastFollowPosition = new THREE.Vector3();

const app = document.getElementById('app');
app.innerHTML = `
<div class="shell">
  <header class="masthead">
    <div class="brand"><div class="brand-mark" aria-hidden="true"></div><div><div class="brand-name">Still Orbit</div><div class="brand-caption">A pocket observatory</div></div></div>
    <div class="edition"><span>Solar collection</span><span>No. 01 / Eight worlds</span></div>
  </header>
  <section class="introduction" aria-labelledby="page-title">
    <div><p class="eyebrow">An invitation to look closer</p><h1 id="page-title">Everything is in motion.</h1></div>
    <p class="intro-note">Take a moment with our solar system.<br>Choose a world. Find a new perspective.</p>
  </section>
  <main>
    <section class="observatory" aria-label="Interactive solar system">
      <div class="viewport" id="viewport">
        <div class="scene-container" id="scene-container"></div>
        <div class="scene-overlay"><div class="scene-caption">Heliocentric view</div><div class="scene-value" id="motion-state">Orbits in motion</div></div>
        <div class="annotation" id="view-annotation">VIEW 01 — THE WHOLE SYSTEM</div>
        <div class="scene-tools"><button class="tool-button" id="names-button" type="button" aria-pressed="true" aria-label="Show planet names" title="Show or hide planet names">${icons.names}<span class="button-text">Names</span></button></div>
        <div id="scene-labels" aria-label="Select a planet in the scene"></div>
        <div class="scene-instructions"><span class="desktop-hint">Drag to orbit <span>·</span> Scroll to zoom</span><span class="mobile-hint" hidden>Drag to orbit · Pinch to zoom</span></div>
        <div class="view-tools"><button class="tool-button" id="overview-button" type="button" title="Return to whole-system view" aria-label="Whole-system view">${icons.overview}<span class="button-text">Overview</span></button><div class="zoom-group"><button class="tool-button" id="zoom-out" type="button" aria-label="Zoom out" title="Zoom out">−</button><button class="tool-button" id="zoom-in" type="button" aria-label="Zoom in" title="Zoom in">+</button></div></div>
        <div class="fallback" id="fallback" hidden role="status"><div class="fallback-inner"><div class="fallback-symbol" aria-hidden="true"></div><p class="eyebrow">The observatory is offline</p><h2>3D is unavailable here.</h2><p id="fallback-message">This browser could not start WebGL. Try a browser with hardware acceleration enabled. You can still explore every planet using the collection below.</p></div></div>
      </div>
      <aside class="detail" aria-label="Selected planet information">
        <div class="detail-topline"><span class="detail-kicker" id="planet-kind"></span><span class="detail-number" id="planet-number"></span></div>
        <div class="specimen" aria-hidden="true"><span class="portrait-tick"></span><div class="planet-portrait" id="planet-portrait"></div></div>
        <h2 id="planet-title"></h2><p class="planet-subtitle" id="planet-subtitle"></p><p class="planet-description" id="planet-description"></p>
        <dl class="facts"><div class="fact"><dt>From the Sun</dt><dd id="fact-distance"></dd></div><div class="fact"><dt>Orbital period</dt><dd id="fact-year"></dd></div><div class="fact"><dt>Mean diameter</dt><dd id="fact-diameter"></dd></div></dl>
        <button class="follow-button" id="follow-button" type="button" aria-pressed="false">${icons.focus}<span id="follow-label">Follow Earth</span></button>
        <p class="detail-source">Approximate reference data · AU = Earth–Sun distance</p>
      </aside>
      <div class="transport" aria-label="Simulation controls">
        <div class="playback"><button class="play-button" id="play-button" type="button" aria-label="Pause simulation" aria-pressed="false">${icons.pause}</button><div><span class="play-label" id="play-label">Pause</span><span class="play-status">Simulation</span></div><div class="time-divider"></div><div class="time-readout"><span id="elapsed-days">0000</span><small>model days</small></div></div>
        <div class="speed-control"><label for="speed">Time speed</label><output id="speed-value" for="speed">1×</output><input id="speed" type="range" min="0" max="4" step="1" value="2" aria-valuetext="1 times speed" /></div>
        <button class="reset-button" id="reset-button" type="button">${icons.reset}<span>Reset all</span></button>
      </div>
    </section>
    <nav class="planet-shelf" id="planet-shelf" aria-label="Planet collection">${planets.map((p,i)=>`<button class="planet-choice" type="button" data-index="${i}" aria-pressed="${i===selectedIndex}" style="--swatch:${p.color}"><span class="planet-dot" aria-hidden="true"></span><span><span class="planet-name">${p.name}</span><span class="planet-order">World ${String(i+1).padStart(2,'0')}</span></span></button>`).join('')}</nav>
  </main>
  <footer class="footer"><p><strong>A study in motion, not a scale model.</strong> Sizes, spacing and orbital speeds are stylized for exploration. Reference facts describe the real planets.</p><details class="help"><summary>How to explore</summary><div class="help-body"><p>Drag to orbit. Scroll or pinch to zoom. Choose a planet, then Follow to move with it. Overview returns to the full system.</p><p>With the scene focused: arrow keys orbit, + / − zoom, and Space pauses. All actions also have keyboard-accessible buttons. 1× advances 12 model days per second; outer orbits are accelerated.</p></div></details></footer>
  <p class="sr-only" id="announcement" role="status" aria-live="polite"></p>
</div>`;

const $ = id => document.getElementById(id);
const viewport = $('viewport');
const labels = planets.map((p,i) => {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'scene-label'; button.textContent = p.name;
  button.setAttribute('aria-label',`Select ${p.name}`);
  button.addEventListener('click',()=>selectPlanet(i));
  button.hidden = true;
  $('scene-labels').append(button);
  return button;
});
const announce = message => { $('announcement').textContent = message; };
function updateMotionUI() {
  $('play-button').innerHTML = playing ? icons.pause : icons.play;
  $('play-button').setAttribute('aria-label', playing ? 'Pause simulation' : 'Resume simulation');
  $('play-button').setAttribute('aria-pressed', String(!playing));
  $('play-label').textContent = playing ? 'Pause' : 'Resume';
  $('motion-state').textContent = playing ? 'Orbits in motion' : 'A moment, held still';
  $('motion-state').classList.toggle('paused', !playing);
}
function updateFollowingUI() {
  $('follow-label').textContent = following ? 'Return to overview' : `Follow ${planets[selectedIndex].name}`;
  $('follow-button').setAttribute('aria-pressed', String(following));
  $('view-annotation').textContent = following ? `VIEW 02 — FOLLOWING ${planets[selectedIndex].name.toUpperCase()}` : 'VIEW 01 — THE WHOLE SYSTEM';
}
function selectPlanet(index, speak = true) {
  selectedIndex = index;
  const p = planets[index];
  $('planet-kind').textContent = p.kind;
  $('planet-number').textContent = String(index+1).padStart(2,'0');
  $('planet-title').textContent = p.name;
  $('planet-subtitle').textContent = p.subtitle;
  $('planet-description').textContent = p.description;
  $('fact-distance').textContent = p.distance;
  $('fact-year').textContent = p.year;
  $('fact-diameter').textContent = p.diameter;
  $('planet-portrait').style.setProperty('--planet-light', p.color);
  const portraitPattern = index===2 ? 'radial-gradient(ellipse at 30% 30%,#c6d2a0 0 13%,transparent 15%),radial-gradient(ellipse at 66% 58%,#a8c790 0 21%,transparent 23%),repeating-linear-gradient(-25deg,transparent 0 16px,#e1dfcf77 18px 20px,transparent 23px 35px)' : index===4||index===5 ? 'repeating-linear-gradient(7deg,transparent 0 10px,#efe0b788 11px 15px,#53463255 17px 21px)' : 'radial-gradient(ellipse at 33% 50%,#fff3 0 16%,transparent 17%)';
  $('planet-portrait').style.setProperty('--portrait-pattern', portraitPattern);
  document.querySelectorAll('.planet-choice').forEach((button,i)=>button.setAttribute('aria-pressed', String(i===index)));
  labels.forEach((button,i)=>{button.classList.toggle('selected',i===index);button.setAttribute('aria-pressed',String(i===index));});
  orbitLines.forEach((line,i)=>{line.material.color.set(i===index ? '#91846a' : '#496062');line.material.opacity = i===index ? .52 : .24;});
  if (following && ready) focusPlanet();
  updateFollowingUI();
  if (speak) announce(`${p.name} selected. ${p.kind}. ${p.description}`);
}

$('planet-shelf').addEventListener('click',event=>{
  const button = event.target.closest('[data-index]');
  if (button) selectPlanet(Number(button.dataset.index));
});
$('play-button').addEventListener('click',()=>{playing=!playing;updateMotionUI();announce(playing?'Simulation resumed.':'Simulation paused.');});
const speeds = [.25,.5,1,2,4];
$('speed').addEventListener('input',event=>{speed=speeds[Number(event.target.value)];$('speed-value').textContent=`${speed}×`;event.target.setAttribute('aria-valuetext',`${speed} times speed`);});
$('names-button').addEventListener('click',()=>{showNames=!showNames;$('names-button').setAttribute('aria-pressed',String(showNames));});
$('follow-button').addEventListener('click',()=>{if(!ready)return;if(following) overview();else{following=true;focusPlanet();updateFollowingUI();announce(`Following ${planets[selectedIndex].name}.`);}});
$('overview-button').addEventListener('click',()=>overview());
$('zoom-in').addEventListener('click',()=>zoomCamera(.8));
$('zoom-out').addEventListener('click',()=>zoomCamera(1.25));
$('reset-button').addEventListener('click',()=>{
  simDays=0;speed=1;playing=!reducedMotion;showNames=true;following=false;
  $('speed').value='2';$('speed-value').textContent='1×';$('speed').setAttribute('aria-valuetext','1 times speed');
  $('names-button').setAttribute('aria-pressed','true');
  updateMotionUI();selectPlanet(2,false);$('elapsed-days').textContent='0000';
  if(ready){positionBodies();overview(false);}
  announce('Reset to Earth and the whole-system view. Speed is 1 times.');
});

function seededRandom(seed) {
  let value = seed;
  return () => {value=(value*1664525+1013904223)>>>0;return value/4294967296;};
}
function makeTexture(index) {
  const p=planets[index], random=seededRandom(index*871+214);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.fillStyle=p.color;ctx.fillRect(0,0,512,256);
  if(index===4||index===5){
    for(let y=0;y<256;y+=2){
      const strength=Math.sin(y*.135)+Math.sin(y*.052)*.6;
      ctx.fillStyle=strength>0?`rgba(238,214,164,${Math.abs(strength)*.19})`:`rgba(83,57,42,${Math.abs(strength)*.18})`;
      ctx.fillRect(0,y,512,2);
    }
    if(index===4){ctx.save();ctx.translate(175,163);ctx.scale(1,.5);ctx.beginPath();ctx.ellipse(0,0,29,24,0,0,Math.PI*2);ctx.fillStyle='#a7785d';ctx.fill();ctx.beginPath();ctx.ellipse(0,0,19,15,0,0,Math.PI*2);ctx.fillStyle='#b48f70';ctx.fill();ctx.restore();}
  }else if(index===2){
    ctx.fillStyle='#5f939d';ctx.fillRect(0,0,512,256);
    const land = (points,color) => {ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
    land([[32,59],[76,42],[103,59],[118,84],[106,101],[81,97],[69,128],[48,118],[43,90]],'#8d9e74');
    land([[99,126],[127,125],[142,155],[134,179],[113,221],[105,199],[114,164]],'#91a67b');
    land([[234,80],[268,56],[309,68],[339,55],[366,72],[405,73],[435,102],[412,116],[376,108],[352,131],[321,117],[310,93],[275,105]],'#b2ad83');
    land([[245,105],[283,103],[309,144],[291,182],[268,194],[250,161],[234,135]],'#afa77c');
    land([[394,177],[431,165],[454,186],[432,202],[398,198]],'#b1a484');
    ctx.fillStyle='#d8ddd0';ctx.fillRect(0,0,512,9);ctx.fillRect(0,241,512,15);
    for(let i=0;i<45;i++){ctx.save();ctx.translate(random()*512,random()*256);ctx.rotate(-.15);ctx.fillStyle='rgba(241,242,222,.30)';ctx.beginPath();ctx.ellipse(0,0,15+random()*38,2+random()*4,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  }else if(index===0||index===3){
    for(let i=0;i<160;i++){const x=random()*512,y=random()*256,r=1+random()*13;ctx.fillStyle=`rgba(48,42,36,${.025+random()*.11})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(235,219,188,.08)';ctx.stroke();}
    if(index===3){ctx.fillStyle='#dad4b4';ctx.fillRect(0,0,512,9);}
  }else{
    for(let i=0;i<30;i++){ctx.fillStyle=`rgba(231,239,213,${random()*.055})`;ctx.fillRect(0,random()*256,512,1+random()*15);}
  }
  // Fine pigment gives the spheres texture without external image assets.
  for(let i=0;i<5500;i++){ctx.fillStyle=random()>.5?'rgba(255,249,222,.032)':'rgba(12,23,23,.035)';ctx.fillRect(random()*512,random()*256,1.3,1.3);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function makeGlow() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  const gradient=ctx.createRadialGradient(128,128,0,128,128,128);
  gradient.addColorStop(0,'rgba(242,199,118,0.46)');gradient.addColorStop(.2,'rgba(226,171,89,0.20)');gradient.addColorStop(.5,'rgba(187,137,67,0.045)');gradient.addColorStop(1,'rgba(187,137,67,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);return new THREE.CanvasTexture(canvas);
}
function createScene() {
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.32;
    renderer.setClearColor(0x000000,0);
    const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Interactive 3D solar system. Arrow keys orbit; plus and minus zoom; Space pauses. Planet selection is available in the collection buttons.');
    $('scene-container').append(canvas);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();showFallback('The 3D graphics connection was lost. Reload the page to try again. Planet information remains available below.');});
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(43,1,.1,450);
    controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=145;controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI*.88;controls.rotateSpeed=.6;controls.zoomSpeed=.8;
    controls.addEventListener('start',()=>{cameraTransition=null;});
    scene.add(new THREE.AmbientLight(0xa4bac0,1.6));
    const sunlight=new THREE.PointLight(0xffe2b0,95,130,1);scene.add(sunlight);
    const fill=new THREE.DirectionalLight(0xb8d5d9,.75);fill.position.set(-15,24,10);scene.add(fill);
    sun=new THREE.Mesh(new THREE.SphereGeometry(1.95,48,32),new THREE.MeshBasicMaterial({color:0xe3bd73}));scene.add(sun);
    const glowTexture=makeGlow();
    if(glowTexture){const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xffd392,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));glow.scale.set(15,15,1);scene.add(glow);}
    const sphereGeometry=new THREE.SphereGeometry(1,48,32);
    planets.forEach((p,i)=>{
      const group=new THREE.Group();scene.add(group);
      const mesh=new THREE.Mesh(sphereGeometry,new THREE.MeshStandardMaterial({map:makeTexture(i),color:0xffffff,roughness:.98,metalness:0}));mesh.scale.setScalar(p.radius);mesh.rotation.z=i===6?1.5:i===2?.4:.08;group.add(mesh);
      if(i===5){
        const rings=new THREE.Group();rings.rotation.z=.42;
        for(const [inside,outside,color,opacity] of [[1.48,1.82,'#837d65',.6],[1.89,2.35,'#b3a68a',.8],[2.4,2.69,'#796f57',.5]]){
          const ring=new THREE.Mesh(new THREE.RingGeometry(inside,outside,120),new THREE.MeshStandardMaterial({color,side:THREE.DoubleSide,transparent:true,opacity,roughness:1,depthWrite:false}));ring.rotation.x=-Math.PI/2;rings.add(ring);
        }group.add(rings);
      }
      if(i===2){const atmosphere=new THREE.Mesh(sphereGeometry,new THREE.MeshBasicMaterial({color:'#94c6c3',transparent:true,opacity:.08,side:THREE.BackSide}));atmosphere.scale.setScalar(p.radius*1.1);group.add(atmosphere);}
      bodies.push({group,mesh});
      const pts=[];for(let n=0;n<=240;n++){const angle=n/240*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(angle)*p.orbit,Math.sin(angle)*p.orbit*p.tilt,Math.sin(angle)*p.orbit));}
      const orbit=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:i===selectedIndex?'#91846a':'#496062',transparent:true,opacity:i===selectedIndex?.52:.24,depthWrite:false}));orbitLines.push(orbit);scene.add(orbit);
    });
    const random=seededRandom(98761);
    const stars=[];for(let i=0;i<520;i++){const theta=random()*Math.PI*2,phi=Math.acos(random()*2-1),r=100+random()*75;stars.push(r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta));}
    const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));starField=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#adc1ba',size:.13,sizeAttenuation:true,transparent:true,opacity:.5,depthWrite:false}));scene.add(starField);
    selectionRing=new THREE.Mesh(new THREE.RingGeometry(1,1.022,72),new THREE.MeshBasicMaterial({color:'#d8c28f',transparent:true,opacity:.55,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));selectionRing.renderOrder=5;scene.add(selectionRing);
    ready=true;
    positionBodies();resize();overview(false);
    const observer=new ResizeObserver(resize);observer.observe(viewport);
    canvas.addEventListener('keydown',onSceneKey);
    const raycaster=new THREE.Raycaster();let pointerStart=null;
    canvas.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};});
    canvas.addEventListener('pointerup',event=>{
      if(!pointerStart||pointerStart.id!==event.pointerId)return;
      const moved=Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y);pointerStart=null;
      if(moved>6)return;
      const bounds=canvas.getBoundingClientRect();const pointer=new THREE.Vector2(((event.clientX-bounds.left)/bounds.width)*2-1,-((event.clientY-bounds.top)/bounds.height)*2+1);
      raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(bodies.map(b=>b.mesh));
      if(hits.length){const index=bodies.findIndex(b=>b.mesh===hits[0].object);if(index>=0)selectPlanet(index);}
    });
    canvas.addEventListener('pointercancel',()=>{pointerStart=null;});
    requestAnimationFrame(frame);
  } catch(error) {
    console.warn('3D rendering unavailable.',error);
    if(renderer)renderer.dispose();
    showFallback();
  }
}
function showFallback(message) {
  ready=false;playing=false;updateMotionUI();viewport.classList.add('render-unavailable');$('fallback').hidden=false;
  if(message)$('fallback-message').textContent=message;
  labels.forEach(label=>{label.hidden=true;});
  ['play-button','speed','follow-button','overview-button','zoom-out','zoom-in','names-button','reset-button'].forEach(id=>{$(id).disabled=true;});
  announce('3D is unavailable. You can still select planets and read their information.');
}
function wholeSystemPosition() {
  const aspect=Math.max(viewport.clientWidth/Math.max(viewport.clientHeight,1),.5);
  const distance=Math.max(65,69/aspect);
  return new THREE.Vector3(0,.59,.81).normalize().multiplyScalar(Math.min(distance,132));
}
function resize() {
  if(!ready)return;
  const width=viewport.clientWidth,height=viewport.clientHeight;
  renderer.setSize(width,height);camera.aspect=width/Math.max(height,1);camera.updateProjectionMatrix();
  if(!following && !cameraTransition){const direction=camera.position.clone().sub(controls.target).normalize();if(direction.lengthSq()>0)camera.position.copy(direction.multiplyScalar(wholeSystemPosition().length()).add(controls.target));}
}
function beginTransition(target,position,animate=true) {
  if(!ready)return;
  if(!animate||reducedMotion){controls.target.copy(target);camera.position.copy(position);controls.update();cameraTransition=null;return;}
  cameraTransition={start:performance.now(),fromTarget:controls.target.clone(),fromPosition:camera.position.clone(),toTarget:target.clone(),toPosition:position.clone()};
}
function overview(animate=true) {
  if(!ready)return;
  following=false;controls.minDistance=14;controls.maxDistance=145;
  beginTransition(new THREE.Vector3(),wholeSystemPosition(),animate);
  updateFollowingUI();
}
function focusPlanet() {
  if(!ready)return;
  const body=bodies[selectedIndex];const target=body.group.position.clone();
  lastFollowPosition.copy(target);
  const offset=camera.position.clone().sub(controls.target).normalize();
  const distance=planets[selectedIndex].name==='Saturn'?11:Math.max(6.5,planets[selectedIndex].radius*6.5);
  controls.minDistance=Math.max(2.5,planets[selectedIndex].radius*2.8);controls.maxDistance=145;
  beginTransition(target,target.clone().add(offset.multiplyScalar(distance)));
}
function zoomCamera(factor) {
  if(!ready)return;
  cameraTransition=null;
  const offset=camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));
  camera.position.copy(controls.target).add(offset);controls.update();
}
function onSceneKey(event) {
  if(!ready)return;
  const key=event.key;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=',' ','Escape'].includes(key))event.preventDefault();else return;
  if(key===' '){playing=!playing;updateMotionUI();return;}
  if(key==='+'||key==='='){zoomCamera(.85);return;}
  if(key==='-'){zoomCamera(1.18);return;}
  if(key==='Escape'){overview();return;}
  cameraTransition=null;
  const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if(key==='ArrowLeft')spherical.theta-=.12;
  if(key==='ArrowRight')spherical.theta+=.12;
  if(key==='ArrowUp')spherical.phi-=.1;
  if(key==='ArrowDown')spherical.phi+=.1;
  spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);
  camera.position.setFromSpherical(spherical).add(controls.target);controls.update();
}
function positionBodies() {
  bodies.forEach((body,i)=>{
    const p=planets[i];
    // Compress the period range so the outer planets remain visibly alive.
    const displayPeriod=365*Math.pow(p.period,.56);
    const angle=p.phase+simDays/displayPeriod*Math.PI*2;
    body.group.position.set(Math.cos(angle)*p.orbit,Math.sin(angle)*p.orbit*p.tilt,Math.sin(angle)*p.orbit);
    body.mesh.rotation.y=simDays*.025*(i===1||i===6?-1:1);
  });
}
let previousTime=0, lastReadout=-1;
function frame(now) {
  if(!ready)return;
  requestAnimationFrame(frame);
  const dt=Math.min(previousTime?(now-previousTime)/1000:0,.05);previousTime=now;
  if(playing&&!document.hidden)simDays+=dt*12*speed;
  positionBodies();
  if(following){
    const pos=bodies[selectedIndex].group.position;
    const delta=pos.clone().sub(lastFollowPosition);
    camera.position.add(delta);controls.target.add(delta);
    if(cameraTransition){cameraTransition.fromTarget.add(delta);cameraTransition.fromPosition.add(delta);cameraTransition.toTarget.add(delta);cameraTransition.toPosition.add(delta);}
    lastFollowPosition.copy(pos);
  }
  if(cameraTransition){const t=Math.min((now-cameraTransition.start)/1050,1),smooth=t*t*(3-2*t);controls.target.lerpVectors(cameraTransition.fromTarget,cameraTransition.toTarget,smooth);camera.position.lerpVectors(cameraTransition.fromPosition,cameraTransition.toPosition,smooth);if(t===1)cameraTransition=null;}
  controls.update();
  const selected=bodies[selectedIndex].group.position;
  selectionRing.position.copy(selected);selectionRing.quaternion.copy(camera.quaternion);selectionRing.scale.setScalar(planets[selectedIndex].radius*1.5);
  camera.updateMatrixWorld();
  const width=viewport.clientWidth,height=viewport.clientHeight;
  const occupied=[];
  // Give the selected world's label first choice of screen space.
  const order=[selectedIndex,...planets.map((_,i)=>i).filter(i=>i!==selectedIndex)];
  order.forEach(i=>{
    const label=labels[i];projectPoint.copy(bodies[i].group.position).project(camera);
    const x=(projectPoint.x*.5+.5)*width,y=(-projectPoint.y*.5+.5)*height;
    const visible=showNames&&projectPoint.z>-1&&projectPoint.z<1&&x>12&&x<width-55&&y>52&&y<height-55&&(!following||i===selectedIndex);
    if(!visible){label.hidden=true;return;}
    const length=planets[i].name.length*6+24;
    let lx=Math.min(x+13,width-length-8),ly=y-13;
    for(let attempt=0;attempt<3;attempt++){
      if(!occupied.some(r=>lx<r.x+r.w&&lx+length>r.x&&Math.abs(ly-r.y)<28))break;
      ly+=27;
    }
    if(ly>height-55){label.hidden=true;return;}
    occupied.push({x:lx,y:ly,w:length});label.hidden=false;label.style.left=`${lx}px`;label.style.top=`${ly}px`;
  });
  const day=Math.floor(simDays);if(day!==lastReadout){$('elapsed-days').textContent=String(day).padStart(4,'0');lastReadout=day;}
  renderer.render(scene,camera);
}
if(window.matchMedia('(pointer: coarse)').matches){document.querySelector('.desktop-hint').hidden=true;document.querySelector('.mobile-hint').hidden=false;}
selectPlanet(2,false);updateMotionUI();createScene();
