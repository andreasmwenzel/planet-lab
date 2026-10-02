import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const worlds = [
  {name:'Sol',kind:'THE STAR',color:'#ffbd49',orbit:'0 AU',year:'—',vibe:'Radiant',description:'The whole bright reason this neighborhood stays together.',size:1.06,distance:0,speed:0},
  {name:'Mercury',kind:'THE QUICK ONE',color:'#b8a99a',orbit:'0.4 AU',year:'88 days',vibe:'Zippy',description:'A little iron pebble doing laps at truly unreasonable speed.',size:.29,distance:2.05,speed:1.65},
  {name:'Venus',kind:'THE CLOUD COVER',color:'#ff9a67',orbit:'0.7 AU',year:'225 days',vibe:'Sultry',description:'A glowing apricot wrapped in clouds with a flair for drama.',size:.43,distance:3.08,speed:1.18},
  {name:'Earth',kind:'THE BLUE DOT',color:'#69c9db',orbit:'1 AU',year:'365 days',vibe:'Lively',description:'Our improbable little ocean pebble. Hi, home.',size:.46,distance:4.17,speed:.9},
  {name:'Mars',kind:'THE RED ONE',color:'#fb705a',orbit:'1.5 AU',year:'687 days',vibe:'Dusty',description:'A rusty desert with a soft spot for tiny robots.',size:.36,distance:5.3,speed:.69},
  {name:'Jupiter',kind:'THE BIG FRIEND',color:'#dbac81',orbit:'5.2 AU',year:'11.9 years',vibe:'Swirly',description:'A striped giant so big it practically has its own weather.',size:.81,distance:7.1,speed:.36},
  {name:'Saturn',kind:'THE SHOW-OFF',color:'#dfc679',orbit:'9.5 AU',year:'29.4 years',vibe:'Iconic',description:'A pale gold giant accessorized with spectacular icy rings.',size:.7,distance:9.08,speed:.25}
];
const $ = (id) => document.getElementById(id);
const buttons = $('planet-buttons');
let selected = 0;
let running = true;
let speed = 1;
let renderer, scene, camera, controls, clock;
let bodies = [];
let raf = 0;

function buildPlanetButtons(){
  worlds.forEach((world,index)=>{
    const button=document.createElement('button');
    button.className='planet-choice'; button.type='button'; button.dataset.index=String(index);
    button.style.setProperty('--planet-color',world.color);
    button.setAttribute('aria-pressed',index===0?'true':'false');
    button.setAttribute('aria-label',`Select ${world.name}`);
    button.innerHTML=`<span class="planet-dot" aria-hidden="true"></span><span>${world.name}</span>`;
    button.addEventListener('click',()=>selectWorld(index));
    buttons.append(button);
  });
}

function selectWorld(index){
  selected=(index+worlds.length)%worlds.length;
  const world=worlds[selected];
  document.querySelectorAll('.planet-choice').forEach((button,i)=>button.setAttribute('aria-pressed',i===selected?'true':'false'));
  $('planet-kicker').textContent=world.kind;
  $('planet-index').textContent=`${String(selected+1).padStart(2,'0')} / 07`;
  $('planet-name').textContent=world.name;
  $('planet-description').textContent=world.description;
  $('planet-orbit').textContent=world.orbit;
  $('planet-year').textContent=world.year;
  $('planet-vibe').textContent=world.vibe;
  $('planet-glyph').textContent=selected===0?'✳':'✦';
  $('planet-glyph').style.color=world.color;
  $('planet-glyph').style.borderColor=`${world.color}88`;
  $('planet-glyph').style.backgroundColor=`${world.color}18`;
  bodies.forEach((body,i)=>{if(body.halo) body.halo.visible=i===selected;});
}

function makeOrbit(distance){
  const points=[];
  for(let i=0;i<=180;i++){const a=i/180*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*distance,0,Math.sin(a)*distance));}
  const geometry=new THREE.BufferGeometry().setFromPoints(points);
  const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x77728f,transparent:true,opacity:.24}));
  scene.add(line);
}

function makeCanvasTexture(draw){
  const canvas=document.createElement('canvas'); canvas.width=256; canvas.height=128;
  const ctx=canvas.getContext('2d'); draw(ctx,canvas.width,canvas.height);
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; return texture;
}

function initScene(){
  const host=$('scene');
  try{
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  }catch(error){showFallback();return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(host.clientWidth,host.clientHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(42,host.clientWidth/host.clientHeight,.1,100);
  camera.position.set(1.2,10.8,18.7);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true; controls.dampingFactor=.06; controls.minDistance=8; controls.maxDistance=28;
  controls.maxPolarAngle=Math.PI*.86; controls.target.set(0,0,0);
  scene.add(new THREE.AmbientLight(0x8b91c5,1.15));
  const keyLight=new THREE.PointLight(0xffc46a,115,40,1.55); keyLight.position.set(0,0,0); scene.add(keyLight);
  const rim=new THREE.DirectionalLight(0xb0caff,1.15); rim.position.set(-3,8,-5); scene.add(rim);

  const starGeometry=new THREE.BufferGeometry();
  const starPositions=new Float32Array(1050*3);
  for(let i=0;i<1050;i++){
    const radius=12+Math.random()*30, theta=Math.random()*Math.PI*2, y=(Math.random()-.5)*22;
    starPositions[i*3]=Math.cos(theta)*radius; starPositions[i*3+1]=y; starPositions[i*3+2]=Math.sin(theta)*radius;
  }
  starGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
  const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0xcbd1ff,size:.055,transparent:true,opacity:.78,sizeAttenuation:true})); scene.add(stars);

  worlds.forEach((world,index)=>{
    if(index>0) makeOrbit(world.distance);
    const orbitGroup=new THREE.Group(); scene.add(orbitGroup);
    const color=new THREE.Color(world.color);
    let texture;
    if(index===0){
      texture=makeCanvasTexture((ctx,w,h)=>{
        const gradient=ctx.createLinearGradient(0,0,w,h); gradient.addColorStop(0,'#fff3b3');gradient.addColorStop(.42,'#ffbf4c');gradient.addColorStop(1,'#ed6742');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
        for(let i=0;i<18;i++){ctx.fillStyle=`rgba(255,245,160,${Math.random()*.22})`;ctx.beginPath();ctx.ellipse(Math.random()*w,Math.random()*h,5+Math.random()*32,2+Math.random()*10,Math.random()*3,0,Math.PI*2);ctx.fill();}
      });
    }else if(index===3){
      texture=makeCanvasTexture((ctx,w,h)=>{
        ctx.fillStyle='#247ea1';ctx.fillRect(0,0,w,h);
        for(let i=0;i<12;i++){ctx.fillStyle=['#69a86e','#9ab76a','#d1a766'][i%3];ctx.beginPath();ctx.ellipse(Math.random()*w,Math.random()*h,10+Math.random()*35,5+Math.random()*16,Math.random()*4,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle='rgba(245,248,224,.55)';ctx.fillRect(0,0,w,9);ctx.fillRect(0,h-9,w,9);
      });
    }else if(index===5){
      texture=makeCanvasTexture((ctx,w,h)=>{ctx.fillStyle='#cb986e';ctx.fillRect(0,0,w,h);for(let y=4;y<h;y+=14){ctx.fillStyle=y%2?'#f0c69d':'#9e664b';ctx.globalAlpha=.54;ctx.fillRect(0,y,w,5+Math.random()*5);}ctx.globalAlpha=1;});
    }else{
      texture=makeCanvasTexture((ctx,w,h)=>{ctx.fillStyle=world.color;ctx.fillRect(0,0,w,h);for(let i=0;i<20;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.11)':'rgba(0,0,0,.09)';ctx.beginPath();ctx.ellipse(Math.random()*w,Math.random()*h,8+Math.random()*34,2+Math.random()*9,Math.random()*3,0,Math.PI*2);ctx.fill();}});
    }
    const material=new THREE.MeshStandardMaterial({map:texture,color:color,roughness:.88,metalness:index===0?.05:0});
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(world.size,36,28),material);
    sphere.userData.worldIndex=index;
    const startAngle=[0,1.1,2.1,3.7,4.9,1.8,5.1][index];
    sphere.position.set(Math.cos(startAngle)*world.distance,0,Math.sin(startAngle)*world.distance);
    orbitGroup.add(sphere);
    let halo=null;
    if(index===0){
      const corona=new THREE.Mesh(new THREE.SphereGeometry(world.size*1.24,32,24),new THREE.MeshBasicMaterial({color:0xffa93d,transparent:true,opacity:.13,side:THREE.BackSide}));
      sphere.add(corona);
      const flare=new THREE.PointLight(0xffa847,31,18,2); sphere.add(flare);
    }else{
      halo=new THREE.Mesh(new THREE.RingGeometry(world.size*1.16,world.size*1.23,48),new THREE.MeshBasicMaterial({color:0xd9ff5a,side:THREE.DoubleSide,transparent:true,opacity:.9}));
      halo.rotation.x=-Math.PI/2; halo.visible=false; sphere.add(halo);
      if(index===6){
        const ring=new THREE.Mesh(new THREE.RingGeometry(world.size*1.24,world.size*1.78,72),new THREE.MeshStandardMaterial({color:0xc5a871,roughness:.8,side:THREE.DoubleSide,transparent:true,opacity:.74}));
        ring.rotation.x=-Math.PI/2.28; sphere.add(ring);
      }
      if(index===3){const moon=new THREE.Mesh(new THREE.SphereGeometry(.095,16,12),new THREE.MeshStandardMaterial({color:0xd3d0bc}));moon.position.set(.75,.1,.05);sphere.add(moon);}
    }
    bodies.push({sphere,orbitGroup,halo,startAngle});
  });

  const raycaster=new THREE.Raycaster(); const pointer=new THREE.Vector2(); let down=null;
  renderer.domElement.addEventListener('pointerdown',(event)=>{down={x:event.clientX,y:event.clientY};});
  renderer.domElement.addEventListener('pointerup',(event)=>{
    if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5){down=null;return;}
    const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(bodies.map(b=>b.sphere),false);
    if(hits.length)selectWorld(hits[0].object.userData.worldIndex);down=null;
  });
  const resize=()=>{if(!renderer)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));};
  new ResizeObserver(resize).observe(host);
  clock=new THREE.Clock(); $('loading').classList.add('gone');
  animate();
}

function animate(){
  raf=requestAnimationFrame(animate);
  if(!renderer||!scene)return;
  const dt=Math.min(clock.getDelta(),.05);
  if(running&&speed>0){
    bodies.forEach((body,index)=>{
      const world=worlds[index];
      if(index>0)body.orbitGroup.rotation.y+=dt*world.speed*speed*.25;
      body.sphere.rotation.y+=dt*(index===0?.12:.45+index*.04)*speed;
    });
  }
  controls.update();renderer.render(scene,camera);
}

function showFallback(){
  $('loading').classList.add('gone');$('fallback').hidden=false;
  $('scene-shell').classList.add('no-webgl');
}

buildPlanetButtons();
selectWorld(0);
$('play').addEventListener('click',()=>{
  running=!running;$('play').setAttribute('aria-pressed',String(running));
  $('play-icon').textContent=running?'Ⅱ':'▶';$('play-label').textContent=running?'PAUSE':'RESUME';
});
$('speed').addEventListener('input',(event)=>{speed=Number(event.target.value);$('speed-value').textContent=`${speed.toFixed(speed%1?2:0).replace(/0+$/,'').replace(/\.$/,'')}×`;});
$('reset').addEventListener('click',()=>{
  if(controls){controls.reset();camera.position.set(1.2,10.8,18.7);controls.target.set(0,0,0);}
  bodies.forEach((body,index)=>{body.orbitGroup.rotation.set(0,0,0);body.sphere.rotation.set(0,0,0);const a=body.startAngle;body.sphere.position.set(Math.cos(a)*worlds[index].distance,0,Math.sin(a)*worlds[index].distance);});
  speed=1;$('speed').value='1';$('speed-value').textContent='1×';running=true;$('play').setAttribute('aria-pressed','true');$('play-icon').textContent='Ⅱ';$('play-label').textContent='PAUSE';selectWorld(0);
});
const dialog=$('tips');$('help').addEventListener('click',()=>dialog.showModal());
$('close-tips').addEventListener('click',()=>dialog.close());$('done-tips').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',(event)=>{if(event.target===dialog)dialog.close();});

if('ResizeObserver' in window){initScene();}else{
  try{initScene();}catch{showFallback();}
}
