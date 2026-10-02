import * as THREE from 'three';
import './style.css';

const worlds = [
  { name:'Mercury', color:'#b9a794', accent:'#dfcbb5', size:.17, orbit:1.55, speed:.83, type:'TERRESTRIAL', year:'88 EARTH DAYS', feature:'IRON-CORE HEART', tagline:'A swift, cratered world in the Sun’s first embrace.', desc:'Small, scorched, and full of surprises.' },
  { name:'Venus', color:'#e1aa6e', accent:'#f5d4a4', size:.27, orbit:2.25, speed:.59, type:'TERRESTRIAL', year:'225 EARTH DAYS', feature:'CLOUD-WRAPPED', tagline:'A bright veil hides a world of immense heat.', desc:'The brightest planet, beneath a dense golden haze.' },
  { name:'Earth', color:'#4e9fd2', accent:'#b7e6fb', size:.29, orbit:3.0, speed:.44, type:'TERRESTRIAL', year:'365 EARTH DAYS', feature:'LIQUID OCEANS', tagline:'Our blue home, seen here as one world among many.', desc:'The only world we know to host life.' },
  { name:'Mars', color:'#c66342', accent:'#f29b73', size:.22, orbit:3.8, speed:.35, type:'TERRESTRIAL', year:'687 EARTH DAYS', feature:'ANCIENT RIVERBEDS', tagline:'A rust-red desert with a watery past.', desc:'A cool, rugged neighbor with giant volcanoes.' },
  { name:'Jupiter', color:'#d9ae85', accent:'#f0cfaa', size:.66, orbit:5.45, speed:.22, type:'GAS GIANT', year:'11.9 EARTH YEARS', feature:'GREAT RED SPOT', tagline:'A vast, banded giant with storms that outlive us.', desc:'The largest planet, with a family of icy moons.' },
  { name:'Saturn', color:'#d4be8b', accent:'#f6e4ae', size:.56, orbit:7.25, speed:.16, type:'GAS GIANT', year:'29.4 EARTH YEARS', feature:'RINGS OF ICE', tagline:'A pale giant wearing the solar system’s signature rings.', desc:'Its magnificent rings are made mostly of ice.' },
  { name:'Uranus', color:'#86c7c8', accent:'#c0f0ed', size:.4, orbit:9.0, speed:.11, type:'ICE GIANT', year:'84 EARTH YEARS', feature:'TILTED AXIS', tagline:'A quiet turquoise world that rolls along its orbit.', desc:'An ice giant with an extreme seasonal tilt.' },
  { name:'Neptune', color:'#527bd6', accent:'#9bc0ff', size:.39, orbit:10.7, speed:.085, type:'ICE GIANT', year:'165 EARTH YEARS', feature:'FAST WINDS', tagline:'A deep-blue frontier at the edge of the planetary parade.', desc:'Dark, cold, and swept by supersonic winds.' }
];
const $ = (id) => document.getElementById(id);
const root = $('universe');
let renderer, scene, camera, clock, sun, system, starfield;
let planets = [], selected = 0, running = true, speedScale = 1, elapsed = 0;
let yaw = -0.48, pitch = .88, radius = 18.5, targetRadius = radius, pointer = null, lastFrame = 0;
const geometry = new THREE.SphereGeometry(1, 40, 28);

function textureFor(def, index) {
  const c = document.createElement('canvas'); c.width=512; c.height=256;
  const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,0,256); g.addColorStop(0,def.accent); g.addColorStop(.46,def.color); g.addColorStop(1,def.color); ctx.fillStyle=g; ctx.fillRect(0,0,512,256);
  let seed=9281+index*733; const rand=()=>{seed=(seed*1664525+1013904223)>>>0; return seed/4294967296;};
  if(index===4||index===5){for(let y=24;y<256;y+=15+rand()*7){ctx.globalAlpha=.13+rand()*.18;ctx.fillStyle=rand()>.5?'#fff0d5':'#74513e';ctx.fillRect(0,y,512,3+rand()*7);}}
  else if(index===6){for(let i=0;i<32;i++){ctx.globalAlpha=.12;ctx.fillStyle=i%2?'#e3ffff':'#275e70';ctx.fillRect(0,rand()*256,512,1+rand()*3);}}
  else {for(let i=0;i<180;i++){const x=rand()*512,y=rand()*256,r=1+rand()*(index===0?7:3);ctx.globalAlpha=.08+rand()*.18;ctx.fillStyle=rand()>.5?'#fff':'#332a29';ctx.beginPath();ctx.ellipse(x,y,r,r*.52,0,0,Math.PI*2);ctx.fill();}}
  if(index===2){for(let i=0;i<35;i++){ctx.globalAlpha=.27;ctx.fillStyle=i%2?'#70b36d':'#d8d8a5';ctx.beginPath();ctx.ellipse(rand()*512,rand()*256,7+rand()*28,3+rand()*12,rand()*3,0,Math.PI*2);ctx.fill();}}
  if(index===4){ctx.globalAlpha=.58;ctx.fillStyle='#a34f38';ctx.beginPath();ctx.ellipse(367,142,29,14,-.3,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function makeGlow(color, size) {
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const grad=x.createRadialGradient(64,64,2,64,64,64);grad.addColorStop(0,color);grad.addColorStop(.24,color+'88');grad.addColorStop(1,color+'00');x.fillStyle=grad;x.fillRect(0,0,128,128);
  const mat=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});const s=new THREE.Sprite(mat);s.scale.set(size,size,1);return s;
}
function init() {
  try {
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,2)); renderer.setSize(root.clientWidth,root.clientHeight); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.2; root.appendChild(renderer.domElement);
  } catch (e) { $('webgl-fallback').hidden=false; root.classList.add('no-webgl'); return; }
  scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x090d18,.014);
  camera=new THREE.PerspectiveCamera(43,root.clientWidth/root.clientHeight,.1,100); clock=new THREE.Clock();
  scene.add(new THREE.AmbientLight(0x657497,1.15));const key=new THREE.PointLight(0xffd7a0,135,90,1.35);scene.add(key);
  system=new THREE.Group();scene.add(system);
  sun=new THREE.Mesh(new THREE.SphereGeometry(.63,48,32),new THREE.MeshBasicMaterial({color:0xffd58b}));system.add(sun);sun.add(makeGlow('#ffb85e',5.1));sun.add(makeGlow('#ffdb9c',2.0));
  const core=new THREE.Mesh(new THREE.SphereGeometry(.49,32,24),new THREE.MeshBasicMaterial({color:0xfff1c1}));sun.add(core);
  for(let i=0;i<worlds.length;i++){
    const d=worlds[i], orbit=new THREE.Group();system.add(orbit);
    const path=new THREE.Mesh(new THREE.TorusGeometry(d.orbit,.006,4,180),new THREE.MeshBasicMaterial({color:0x9ba9c5,transparent:true,opacity:.21}));path.rotation.x=Math.PI/2;system.add(path);
    const body=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:textureFor(d,i),roughness:.86,metalness:.03}));body.scale.setScalar(d.size);body.position.set(d.orbit,0,0);body.rotation.z=i===6?1.35:.04;orbit.add(body);
    const glow=makeGlow(d.accent, d.size*3.8);glow.position.copy(body.position);orbit.add(glow);
    if(i===5){const ring=new THREE.Mesh(new THREE.RingGeometry(d.size*1.22,d.size*1.9,80),new THREE.MeshStandardMaterial({color:0xd9c89b,side:THREE.DoubleSide,transparent:true,opacity:.78,roughness:1}));ring.rotation.x=Math.PI/2.35;body.add(ring);}
    if(i===2){const moonOrbit=new THREE.Group();body.add(moonOrbit);const moon=new THREE.Mesh(new THREE.SphereGeometry(.045,16,12),new THREE.MeshStandardMaterial({color:0xd4d0c3}));moon.position.set(d.size*1.9,0,0);moonOrbit.add(moon);body.userData.moonOrbit=moonOrbit;}
    body.userData={...(body.userData||{}),orbit,def:d,index:i};planets.push(body);
  }
  makeStars();setupInput();resize();animate();selectPlanet(0);requestAnimationFrame(()=>selectPlanet(0));
}
function makeStars(){const n=1100,pos=new Float32Array(n*3),sizes=new Float32Array(n);for(let i=0;i<n;i++){const r=22+Math.random()*42,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);pos[i*3]=r*Math.sin(b)*Math.cos(a);pos[i*3+1]=r*Math.cos(b);pos[i*3+2]=r*Math.sin(b)*Math.sin(a);sizes[i]=Math.random();}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('size',new THREE.BufferAttribute(sizes,1));starfield=new THREE.Points(g,new THREE.PointsMaterial({color:0xb9c9ee,size:.055,transparent:true,opacity:.72,sizeAttenuation:true}));scene.add(starfield);}
function resize(){if(!renderer||!camera)return;const w=root.clientWidth,h=root.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
function cameraPose(){const cp=Math.cos(pitch);camera.position.set(radius*Math.sin(yaw)*cp,radius*Math.sin(pitch),radius*Math.cos(yaw)*cp);camera.lookAt(0,0,0);}
function animate(t=0){requestAnimationFrame(animate);if(!renderer)return;const dt=Math.min(clock.getDelta(),.06);if(running)elapsed+=dt*speedScale;
  for(const p of planets){const {def,index,orbit}=p.userData;orbit.rotation.y=elapsed*def.speed*.20+index*.57;p.rotation.y+=dt*(.12+index*.018);if(p.userData.moonOrbit)p.userData.moonOrbit.rotation.y=elapsed*1.7;}
  sun.rotation.y+=dt*.06;radius+=(targetRadius-radius)*.08;cameraPose();if(t-lastFrame>30){renderer.render(scene,camera);lastFrame=t;}
  const day=Math.floor(elapsed*22)+1;$('day-counter').textContent=`SOL ${String(day).padStart(4,'0')}`;$('clock').textContent=`DAY ${String(day).padStart(3,'0')}`;
}
function selectPlanet(i){selected=(i+worlds.length)%worlds.length;const d=worlds[selected];$('planet-name').textContent=d.name;$('planet-tagline').textContent=d.tagline;$('planet-type').textContent=d.type;$('planet-year').textContent=d.year;$('planet-feature').textContent=d.feature;$('planet-index').textContent=`${String(selected+1).padStart(2,'0')} / 08`;
  document.querySelectorAll('.planet-choice').forEach((b,j)=>{b.setAttribute('aria-pressed',String(j===selected));});planets.forEach((p,j)=>{p.scale.setScalar(worlds[j].size*(j===selected?1.11:1));});}
function setupInput(){
  const list=$('planet-list');worlds.forEach((d,i)=>{const b=document.createElement('button');b.className='planet-choice';b.type='button';b.setAttribute('aria-label',`Explore ${d.name}`);b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="planet-dot" style="--planet:${d.color};--ring:${i===5?'1':''}"></span><span>${d.name}</span>`;b.addEventListener('click',()=>selectPlanet(i));list.append(b);});
  $('play-toggle').addEventListener('click',()=>{running=!running;$('play-toggle').setAttribute('aria-label',running?'Pause simulation':'Resume simulation');$('play-icon').textContent=running?'Ⅱ':'▶';$('play-label').textContent=running?'SIMULATION RUNNING':'SIMULATION PAUSED';});
  $('speed').addEventListener('input',e=>{speedScale=Number(e.target.value);$('speed-value').value=`${speedScale}×`;});
  $('reset-button').addEventListener('click',()=>{elapsed=0;running=true;yaw=-.48;pitch=.88;radius=18.5;targetRadius=18.5;$('play-toggle').setAttribute('aria-label','Pause simulation');$('play-icon').textContent='Ⅱ';$('play-label').textContent='SIMULATION RUNNING';$('speed').value=1;speedScale=1;$('speed-value').value='1×';selectPlanet(0);toast('Back to the beginning');});
  root.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,a'))return;pointer={x:e.clientX,y:e.clientY,id:e.pointerId};root.setPointerCapture(e.pointerId);});root.addEventListener('pointermove',e=>{if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;yaw-=dx*.005;pitch=Math.max(.1,Math.min(1.48,pitch+dy*.004));});root.addEventListener('pointerup',()=>{pointer=null;});root.addEventListener('pointercancel',()=>pointer=null);
  root.addEventListener('wheel',e=>{e.preventDefault();targetRadius=Math.max(12,Math.min(29,targetRadius+e.deltaY*.012));},{passive:false});
  document.addEventListener('keydown',e=>{if(e.target.matches('input,button'))return;if(e.key==='ArrowRight'){selectPlanet(selected+1);document.querySelectorAll('.planet-choice')[selected].focus();}else if(e.key==='ArrowLeft'){selectPlanet(selected-1);document.querySelectorAll('.planet-choice')[selected].focus();}else if(e.key===' '){e.preventDefault();$('play-toggle').click();}});
  $('help-button').addEventListener('click',()=>toast('Drag the starfield to orbit · scroll to zoom · arrows to browse worlds'));
}
let toastTimer;function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800);}
window.addEventListener('resize',resize);
init();
