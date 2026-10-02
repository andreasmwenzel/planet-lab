import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const planets = [
  {name:'Mercury', color:'#b8bccf', r:.27, orbit:3.2, year:12, phrase:'THE QUICKSTEP', description:'Small world, big energy. Our innermost dancer zips around the glow at the center.'},
  {name:'Venus', color:'#ffd395', r:.43, orbit:4.5, year:18, phrase:'GOLDEN HOUR', description:'A warm peach-colored lantern. Give the camera a spin and watch this bright little world glide by.'},
  {name:'Earth', color:'#65caff', r:.46, orbit:6, year:26, phrase:'HOME ON THE DANCE FLOOR', description:'The blue one we call home. A tiny moon keeps it company while the whole playground turns.'},
  {name:'Mars', color:'#ff785e', r:.34, orbit:7.6, year:35, phrase:'RED HOT RHYTHM', description:'A rust-red spark with a leisurely groove. Find it just beyond the blue world.'},
  {name:'Jupiter', color:'#e9b788', r:1.02, orbit:10, year:49, phrase:'THE HEADLINER', description:'Big, striped and impossible to ignore. This oversized gas giant brings the bass to our cosmic lineup.'},
  {name:'Saturn', color:'#ffe3a4', r:.82, orbit:13.1, year:65, phrase:'RINGS FOR DAYS', description:'Space’s best-dressed dancer. Its tilted rings are a glittering halo you can admire from every angle.'},
  {name:'Uranus', color:'#83f3dc', r:.62, orbit:16, year:84, phrase:'THE SIDEWAYS SHUFFLE', description:'An icy mint-colored daydream. A tilted little ring adds an unexpected twist to the outer dance floor.'},
  {name:'Neptune', color:'#8197ff', r:.60, orbit:18.7, year:108, phrase:'AFTER-HOURS BLUE', description:'The last blue light on the floor. Slow down the tempo and enjoy its long, sweeping circuit.'}
];
const $ = id => document.getElementById(id);
const canvas=$('scene'), host=canvas.parentElement;
let selected=2, paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches, speed=1, simTime=0;
let renderer, scene, camera, controls, meshes=[], rings=[], glow, moon, sun, clock;
let webgl=false;
const buttons=planets.map((p,i)=>{
  const button=document.createElement('button');
  button.className='planet-button'; button.style.setProperty('--planet-color',p.color);
  button.innerHTML=`<span class="number">${String(i+1).padStart(2,'0')}</span><span class="planet-dot" aria-hidden="true"></span><span class="name">${p.name}</span><span class="arrow" aria-hidden="true">↗</span>`;
  button.setAttribute('aria-label',`Select ${p.name}`);
  button.addEventListener('click',()=>selectPlanet(i));
  $('planet-list').append(button); return button;
});
function selectPlanet(i,announce=true){
  selected=i; const p=planets[i];
  buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
  $('info-name').textContent=p.name; $('info-kicker').textContent=p.phrase;
  $('info-description').textContent=p.description;
  $('info-year').textContent=`${p.year} seconds`;
  $('info-size').textContent=`${(p.r/planets[2].r).toFixed(2)}× Earth`;
  $('marker').textContent=`${String(i+1).padStart(2,'0')} / ${p.name.toUpperCase()}`;
  if(announce)$('announcement').textContent=`${p.name} selected. ${p.description}`;
  rings.forEach((line,j)=>{line.material.color.set(j===i?'#dcff55':'#666681');line.material.opacity=j===i?.75:.19;});
}
function updatePause(){ $('toggle').textContent=paused?'▶ Start party':'Ⅱ Pause party'; $('toggle').setAttribute('aria-pressed',String(paused)); }
$('toggle').addEventListener('click',()=>{paused=!paused;updatePause();});
$('speed').addEventListener('input',e=>{speed=Number(e.target.value);$('speed-value').textContent=`${speed}×`;});
function zoom(mult){if(!webgl)return;const delta=camera.position.clone().sub(controls.target);delta.setLength(THREE.MathUtils.clamp(delta.length()*mult,5,65));camera.position.copy(controls.target).add(delta);controls.update();}
$('zoom-in').addEventListener('click',()=>zoom(.82));$('zoom-out').addEventListener('click',()=>zoom(1.22));
$('reset').addEventListener('click',()=>{
  simTime=0;speed=1;$('speed').value='1';$('speed-value').textContent='1×';
  paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches;updatePause();selectPlanet(2);
  if(webgl){controls.target.set(0,0,0);camera.position.set(0,26,29);controls.update();}
  $('announcement').textContent='Playground reset. Earth selected. Tempo 1×.';
});
selectPlanet(2,false);updatePause();

function stripedTexture(base,accent){
  const c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d');
  ctx.fillStyle=base;ctx.fillRect(0,0,128,64);ctx.fillStyle=accent;
  for(let y=0;y<64;y+=11){ctx.globalAlpha=.3+(y%3)*.12;ctx.fillRect(0,y,128,4+(y%5));}
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,1,.1,250);camera.position.set(0,26,29);
  controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.07;
  controls.minDistance=5;controls.maxDistance=65;controls.enablePan=false;controls.maxPolarAngle=Math.PI*.91;
  scene.add(new THREE.AmbientLight('#d1c2fa',1.5));
  scene.add(new THREE.PointLight('#fff0cb',170,100,1.5));
  const key=new THREE.DirectionalLight('#e9e5ff',2);key.position.set(-10,18,15);scene.add(key);
  sun=new THREE.Mesh(new THREE.SphereGeometry(1.32,48,32),new THREE.MeshBasicMaterial({color:'#fff18b'}));scene.add(sun);
  glow=new THREE.Mesh(new THREE.SphereGeometry(1.55,32,24),new THREE.MeshBasicMaterial({color:'#ffbc59',transparent:true,opacity:.13,side:THREE.BackSide}));scene.add(glow);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.82,.025,8,96),new THREE.MeshBasicMaterial({color:'#ff65b5'}));halo.rotation.x=Math.PI/2;scene.add(halo);
  const positions=[];let seed=19;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<1100;i++){const theta=random()*Math.PI*2,phi=Math.acos(2*random()-1),r=60+random()*40;positions.push(r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta));}
  const starsGeom=new THREE.BufferGeometry();starsGeom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  scene.add(new THREE.Points(starsGeom,new THREE.PointsMaterial({color:'#c5bfe1',size:.095,transparent:true,opacity:.7,sizeAttenuation:true})));
  planets.forEach((p,i)=>{
    const points=[];for(let n=0;n<=160;n++){const a=n/160*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*p.orbit,0,Math.sin(a)*p.orbit));}
    const path=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#666681',transparent:true,opacity:.19}));scene.add(path);rings.push(path);
    const mat=new THREE.MeshStandardMaterial({color:p.color,roughness:.78,metalness:.04});
    if(i===4||i===5){mat.color.set('#ffffff');mat.map=stripedTexture(p.color,i===4?'#8d5b63':'#b99264');}
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(p.r,40,28),mat);mesh.userData.planet=i;scene.add(mesh);meshes.push(mesh);
    const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(p.r*1.09,32,20),new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.1,side:THREE.BackSide}));mesh.add(atmosphere);
    if(i===5||i===6){
      const ring=new THREE.Mesh(new THREE.RingGeometry(p.r*1.3,p.r*(i===5?2.15:1.65),100),new THREE.MeshBasicMaterial({color:i===5?'#e8c38c':'#9df8df',side:THREE.DoubleSide,transparent:true,opacity:i===5?.65:.28}));
      ring.rotation.x=i===5?1.15:.35;ring.rotation.y=.25;mesh.add(ring);
      if(i===5){const band=new THREE.Mesh(new THREE.RingGeometry(p.r*1.77,p.r*1.84,100),new THREE.MeshBasicMaterial({color:'#11121b',side:THREE.DoubleSide}));band.rotation.copy(ring.rotation);mesh.add(band);}
    }
    if(i===2){const land=new THREE.Mesh(new THREE.SphereGeometry(p.r*1.004,32,24),new THREE.MeshStandardMaterial({color:'#9ed78d',roughness:.9}));
      // A handful of abstract raised patches, intentionally not a geographic map.
      for(let j=0;j<7;j++){const patch=new THREE.Mesh(new THREE.SphereGeometry(.10+j%3*.025,12,8),land.material);const a=j*2.399;patch.position.set(Math.cos(a)*p.r*.82,Math.sin(j*1.7)*p.r*.5,Math.sin(a)*p.r*.82).normalize().multiplyScalar(p.r*.95);patch.scale.set(1,.6,1.4);mesh.add(patch);}
    }
  });
  moon=new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),new THREE.MeshStandardMaterial({color:'#dedbd1',roughness:1}));scene.add(moon);
  const selection=new THREE.Mesh(new THREE.RingGeometry(.72,.745,80),new THREE.MeshBasicMaterial({color:'#dcff55',side:THREE.DoubleSide,transparent:true,opacity:.8}));selection.rotation.x=Math.PI/2;scene.add(selection);
  function resize(){const rect=host.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(host);resize();webgl=true;selectPlanet(2,false);clock=new THREE.Clock();
  const projected=new THREE.Vector3();
  renderer.setAnimationLoop(()=>{
    const dt=Math.min(clock.getDelta(),.05);if(!paused)simTime+=dt*speed;
    meshes.forEach((m,i)=>{const p=planets[i],a=simTime/p.year*Math.PI*2+i*1.37;m.position.set(Math.cos(a)*p.orbit,0,Math.sin(a)*p.orbit);m.rotation.y=simTime*.15/(1+i*.15);});
    moon.position.copy(meshes[2].position).add(new THREE.Vector3(Math.cos(simTime*.75)*.85,.08,Math.sin(simTime*.75)*.85));
    glow.scale.setScalar(1+Math.sin(simTime*1.2)*.04);
    selection.position.copy(meshes[selected].position);selection.position.y=-.05;selection.scale.setScalar(Math.max(1,planets[selected].r*1.8));
    controls.update();renderer.render(scene,camera);
    projected.copy(meshes[selected].position);projected.y+=planets[selected].r+.45;projected.project(camera);
    const width=host.clientWidth,height=host.clientHeight;const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
    $('marker').style.display=projected.z<1&&projected.z>-1&&x>35&&x<width-35&&y>35&&y<height-30?'block':'none';
    $('marker').style.left=`${x}px`;$('marker').style.top=`${y}px`;
  });
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,id:e.pointerId};});
  canvas.addEventListener('pointercancel',()=>{down=null;});
  canvas.addEventListener('pointerup',e=>{if(!down||down.id!==e.pointerId)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(moved>6)return;
    const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(meshes,false);if(hits.length)selectPlanet(hits[0].object.userData.planet);
  });
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();webgl=false;renderer.setAnimationLoop(null);showFallback();});
}catch(error){console.warn('3D scene unavailable:',error);if(renderer)renderer.setAnimationLoop(null);showFallback();}
function showFallback(){webgl=false;$('fallback').style.display='flex';$('marker').style.display='none';canvas.style.visibility='hidden';['toggle','speed','zoom-in','zoom-out'].forEach(id=>{$(id).disabled=true;$(id).title='Unavailable without the 3D scene';});}
