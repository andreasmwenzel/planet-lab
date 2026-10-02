import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const planets = [
  {name:'Mercury',color:'#c6b3ac',radius:.3,orbit:3.4,period:16,type:'ROCKY / SPEED DEMON',diameter:'4,879 km',year:'88 Earth days',description:'Small world, fast company. Mercury makes the quickest lap around the Sun, wearing a surface full of ancient scars.'},
  {name:'Venus',color:'#eeb477',radius:.48,orbit:4.6,period:23,type:'ROCKY / CLOUD QUEEN',diameter:'12,104 km',year:'225 Earth days',description:'Behind those luminous clouds is a fiercely hot world. Venus spins slowly, in the opposite direction to most planets.'},
  {name:'Earth',color:'#64c6dc',radius:.51,orbit:6,period:32,type:'ROCKY / HOME BASE',diameter:'12,742 km',year:'365 Earth days',description:'The blue one. Oceans, shifting clouds, and the only life we know. Sometimes the best destination is home.'},
  {name:'Mars',color:'#ef795e',radius:.37,orbit:7.4,period:43,type:'ROCKY / RED REBEL',diameter:'6,779 km',year:'687 Earth days',description:'Rust-red deserts and enormous volcanoes. Mars is a dusty little world with a spectacular sense of scale.'},
  {name:'Jupiter',color:'#deb68e',radius:1.02,orbit:10.2,period:65,type:'GAS GIANT / BIG ENERGY',diameter:'139,820 km',year:'11.9 Earth years',description:'The heavyweight of the lineup. Jupiter wears swirling cloud bands and hosts a storm larger than Earth.'},
  {name:'Saturn',color:'#efcd83',radius:.86,orbit:13,period:85,type:'GAS GIANT / RING LEADER',diameter:'116,460 km',year:'29.5 Earth years',description:'Dressed for the occasion. Saturn’s extraordinary rings are made mostly of countless pieces of ice.'},
  {name:'Uranus',color:'#9edddb',radius:.64,orbit:15.7,period:108,type:'ICE GIANT / SIDEWAYS SOUL',diameter:'50,724 km',year:'84 Earth years',description:'A cool blue-green outsider. Uranus is tilted so dramatically that it rolls around the Sun on its side.'},
  {name:'Neptune',color:'#7a91fa',radius:.62,orbit:18,period:137,type:'ICE GIANT / FAR-OUT FRIEND',diameter:'49,244 km',year:'165 Earth years',description:'Out at the edge of the planetary lineup, this deep-blue world carries some of the fastest winds in the solar system.'}
];
const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused = reducedMotion, speed = 1, elapsed = 0, selected = 2, following = false;
let renderer, scene, camera, controls, worlds = [], selectionRing, clock, frame;
const viewport = $('viewport');
planets.forEach((p,i) => {
  const button = document.createElement('button');
  button.className = 'planet-button';
  button.style.setProperty('--planet',p.color);
  button.innerHTML = `<span class="dot" aria-hidden="true"></span>${p.name}<span class="number">0${i+1}</span>`;
  button.setAttribute('aria-pressed','false');
  button.addEventListener('click',() => select(i));
  $('planet-list').append(button);
});
function select(index){
  selected = index;
  const p = planets[index];
  $('planet-name').textContent=p.name;
  $('planet-type').textContent=p.type;
  $('planet-number').textContent=`0${index+1} / 08`;
  $('planet-description').textContent=p.description;
  $('planet-diameter').textContent=p.diameter;
  $('planet-year').textContent=p.year;
  document.querySelectorAll('.planet-button').forEach((button,i)=>button.setAttribute('aria-pressed',String(index===i)));
  if (following) visit();
}
function updatePause(){
  $('pause').setAttribute('aria-pressed',String(paused));
  $('pause-label').textContent=paused?'RESUME':'PAUSE';
  $('pause-icon').textContent=paused?'▶':'Ⅱ';
  $('motion-state').textContent=paused?'Ⅱ HOLDING STILL':'● IN ORBIT';
}
$('pause').addEventListener('click',()=>{paused=!paused;updatePause();});
$('speed').addEventListener('input',e=>{speed=Number(e.target.value);$('speed-output').textContent=`${speed.toFixed(1).replace('.0','')}×`;});
function systemView(){
  if (!camera) return;
  following=false;camera.position.set(21,23,30);controls.target.set(0,0,0);controls.update();
  $('scene-coordinate').textContent='HELIOCENTRIC / WIDE VIEW';
}
function visit(){
  if (!camera || !worlds.length) return;
  following=true;
  const pos=worlds[selected].position;
  const distance=planets[selected].radius*5+2.2;
  camera.position.copy(pos).add(new THREE.Vector3(distance*.7,distance*.55,distance));
  controls.target.copy(pos);controls.update();
  $('scene-coordinate').textContent=`UP CLOSE / ${planets[selected].name.toUpperCase()}`;
}
$('visit').addEventListener('click',visit);
$('wide-view').addEventListener('click',systemView);
$('reset').addEventListener('click',()=>{
  elapsed=0;speed=1;paused=reducedMotion;following=false;$('speed').value='1';$('speed-output').textContent='1×';select(2);updatePause();systemView();
});
select(2);updatePause();

function planetTexture(p,index){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle=p.color;ctx.fillRect(0,0,256,128);
  // Deterministic, painted textures. No external assets.
  let seed=97+index*731;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  if(index===2){
    ctx.fillStyle='#498877';
    for(let i=0;i<22;i++){const x=random()*256,y=random()*128;ctx.beginPath();ctx.moveTo(x,y);for(let k=0;k<10;k++){const a=k/10*Math.PI*2;ctx.lineTo(x+Math.cos(a)*(6+random()*18),y+Math.sin(a)*(3+random()*10));}ctx.closePath();ctx.fill();}
    ctx.fillStyle='#fff8';for(let i=0;i<35;i++){ctx.beginPath();ctx.ellipse(random()*256,random()*128,7+random()*15,1+random()*2,-.2,0,Math.PI*2);ctx.fill();}
  }else if(index>=4||index===1){
    for(let y=0;y<128;y+=2){ctx.fillStyle=`rgba(${random()>.5?'255,247,219':'61,29,69'},${.06+random()*.2})`;ctx.fillRect(0,y,256,1+random()*5);}
    if(index===4){ctx.fillStyle='#b7684f';ctx.beginPath();ctx.ellipse(170,82,19,8,.1,0,Math.PI*2);ctx.fill();}
  }else{
    for(let i=0;i<180;i++){ctx.fillStyle=`rgba(45,23,44,${random()*.25})`;ctx.beginPath();ctx.arc(random()*256,random()*128,1+random()*5,0,Math.PI*2);ctx.fill();}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function init(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0x181322,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  viewport.append(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.1,250);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=1.5;controls.maxDistance=80;controls.enablePan=false;
  scene.add(new THREE.AmbientLight(0xddd3ef,1.5));
  const light=new THREE.PointLight(0xffdfb1,110,0,1.1);scene.add(light);
  const sun=new THREE.Mesh(new THREE.SphereGeometry(1.4,48,32),new THREE.MeshBasicMaterial({color:0xffba64}));scene.add(sun);
  // Three translucent shells give the star a warm, graphic aura.
  [1.49,1.64,1.89].forEach((radius,i)=>{const shell=new THREE.Mesh(new THREE.SphereGeometry(radius,32,24),new THREE.MeshBasicMaterial({color:0xff783e,transparent:true,opacity:.12-i*.028,depthWrite:false,side:THREE.BackSide}));scene.add(shell);});
  const corona=new THREE.Mesh(new THREE.RingGeometry(1.75,1.79,96),new THREE.MeshBasicMaterial({color:0xffa562,side:THREE.DoubleSide,transparent:true,opacity:.6}));corona.rotation.x=Math.PI/2;scene.add(corona);
  planets.forEach((p,i)=>{
    const orbitPoints=[];for(let j=0;j<=180;j++){const a=j/180*Math.PI*2;orbitPoints.push(new THREE.Vector3(Math.cos(a)*p.orbit,0,Math.sin(a)*p.orbit));}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints),new THREE.LineBasicMaterial({color:i===2?0xb87cbb:0x79627e,transparent:true,opacity:i===2?.55:.3}));scene.add(line);
    const group=new THREE.Group();const mesh=new THREE.Mesh(new THREE.SphereGeometry(p.radius,40,28),new THREE.MeshStandardMaterial({map:planetTexture(p,i),roughness:.92,metalness:0}));mesh.rotation.z=i===6?Math.PI/2:.12;group.add(mesh);group.userData.planetIndex=i;group.userData.body=mesh;
    if(i===5){const rings=new THREE.Group();[ [1.18,1.36,.65], [1.4,1.64,.9], [1.69,1.93,.48] ].forEach(([a,b,opacity])=>{const ring=new THREE.Mesh(new THREE.RingGeometry(a,b,120),new THREE.MeshStandardMaterial({color:0xe3c399,side:THREE.DoubleSide,transparent:true,opacity,roughness:1}));ring.rotation.x=Math.PI/2;rings.add(ring);});rings.rotation.z=.38;group.add(rings);}
    if(i===2){const moon=new THREE.Mesh(new THREE.SphereGeometry(.115,18,12),new THREE.MeshStandardMaterial({color:0xc8bbc8,roughness:1}));moon.position.set(.88,0,.5);group.add(moon);}
    scene.add(group);worlds.push(group);
  });
  selectionRing=new THREE.Mesh(new THREE.RingGeometry(1,1.035,80),new THREE.MeshBasicMaterial({color:0xe9ff70,side:THREE.DoubleSide,transparent:true,opacity:.95,depthTest:false}));selectionRing.renderOrder=10;scene.add(selectionRing);
  const starPositions=[];for(let i=0;i<750;i++){const a=i*2.39996,z=1-2*(i+.5)/750,r=Math.sqrt(1-z*z),rad=85+(i%13);starPositions.push(Math.cos(a)*r*rad,z*rad,Math.sin(a)*r*rad);}
  const stars=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3)),new THREE.PointsMaterial({color:0xb5a8ca,size:.075,sizeAttenuation:true,transparent:true,opacity:.7}));scene.add(stars);
  const belt=[];for(let i=0;i<800;i++){const a=i*2.39996,r=8.5+((i*37)%101)/101*.7;belt.push(Math.cos(a)*r,Math.sin(i*13)*.12,Math.sin(a)*r);}
  scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(belt,3)),new THREE.PointsMaterial({color:0xad8f94,size:.026,transparent:true,opacity:.7})));
  const resize=()=>{const width=viewport.clientWidth,height=viewport.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(viewport);resize();systemView();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
  viewport.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  viewport.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const rect=viewport.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(worlds,true)[0];if(hit){let object=hit.object;while(object.parent && object.userData.planetIndex===undefined)object=object.parent;if(object.userData.planetIndex!==undefined)select(object.userData.planetIndex);}down=null;});
  viewport.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_'].includes(e.key))return;e.preventDefault();const offset=camera.position.clone().sub(controls.target);const spherical=new THREE.Spherical().setFromVector3(offset);if(e.key==='ArrowLeft')spherical.theta-=.12;if(e.key==='ArrowRight')spherical.theta+=.12;if(e.key==='ArrowUp')spherical.phi-=.1;if(e.key==='ArrowDown')spherical.phi+=.1;if(e.key==='+'||e.key==='=')spherical.radius*=.88;if(e.key==='-'||e.key==='_')spherical.radius*=1.12;spherical.radius=THREE.MathUtils.clamp(spherical.radius,controls.minDistance,controls.maxDistance);spherical.phi=THREE.MathUtils.clamp(spherical.phi,.06,Math.PI-.06);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);showFallback();});
  clock=new THREE.Clock();
  const tick=()=>{
    frame=requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.05);if(!paused)elapsed+=dt*speed;
    worlds.forEach((group,i)=>{const p=planets[i],a=elapsed/p.period*Math.PI*2+i*1.76+.35;group.position.set(Math.cos(a)*p.orbit,0,Math.sin(a)*p.orbit);group.userData.body.rotation.y=elapsed*.15;});
    if(following){const next=worlds[selected].position;const delta=next.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(next);}
    selectionRing.position.copy(worlds[selected].position);selectionRing.quaternion.copy(camera.quaternion);const size=planets[selected].radius*1.35;selectionRing.scale.setScalar(size);
    controls.update();renderer.render(scene,camera);
  };tick();
}
function showFallback(){
  $('fallback').hidden=false;viewport.style.display='none';['pause','speed','wide-view','visit'].forEach(id=>$(id).disabled=true);$('motion-state').textContent='3D UNAVAILABLE';$('scene-coordinate').textContent='PLANET NOTES AVAILABLE';document.querySelector('.scene-help').textContent='EXPLORE PLANET NOTES IN THE LINEUP';
}
try{init();}catch(error){console.warn('3D view unavailable:',error);showFallback();}
