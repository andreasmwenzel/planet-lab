import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const planets = [
 {name:'Mercury',color:'#a69e91',size:.36,radius:4.0,rate:1.32,period:'88 days',diameter:'4,879 km',distance:'57.9M km',type:'TERRESTRIAL',description:'Small, rocky, and sun-scorched. Mercury races around our star faster than any other planet.',fact:'The smallest planet in our solar system.'},
 {name:'Venus',color:'#d9b782',size:.58,radius:5.5,rate:.97,period:'225 days',diameter:'12,104 km',distance:'108.2M km',type:'TERRESTRIAL',description:'A bright world wrapped in thick clouds. Its atmosphere traps heat beneath a golden veil.',fact:'The hottest planet, despite being second.'},
 {name:'Earth',color:'#67aabc',size:.64,radius:7.15,rate:.73,period:'365 days',diameter:'12,742 km',distance:'149.6M km',type:'TERRESTRIAL',description:'Our blue home. Oceans, clouds, and a thin atmosphere make this world unlike any other we know.',fact:'The only world known to support life.'},
 {name:'Mars',color:'#cf7356',size:.46,radius:8.8,rate:.58,period:'687 days',diameter:'6,779 km',distance:'227.9M km',type:'TERRESTRIAL',description:'A rusty-red desert world, shaped by ancient rivers, vast volcanoes, and a restless curiosity.',fact:'Home to the enormous volcano Olympus Mons.'},
 {name:'Jupiter',color:'#c7ab8c',size:1.25,radius:11.4,rate:.32,period:'11.9 years',diameter:'139,820 km',distance:'778.6M km',type:'GAS GIANT',description:'The giant of the neighborhood. Bands of swirling clouds surround a world with no solid surface.',fact:'Its Great Red Spot is a long-lived storm.'},
 {name:'Saturn',color:'#d5c594',size:1.04,radius:14.5,rate:.23,period:'29.5 years',diameter:'116,460 km',distance:'1.43B km',type:'GAS GIANT',description:'A pale gold giant wearing a spectacular halo. Countless fragments of ice and rock form its rings.',fact:'Its rings are wide, but remarkably thin.'},
 {name:'Uranus',color:'#91ced0',size:.78,radius:17.4,rate:.16,period:'84 years',diameter:'50,724 km',distance:'2.87B km',type:'ICE GIANT',description:'A quiet blue-green world with an unusual tilt. Uranus rolls around the Sun almost on its side.',fact:'Its rotation axis is tilted about 98°.'},
 {name:'Neptune',color:'#657dd3',size:.76,radius:20.0,rate:.12,period:'165 years',diameter:'49,244 km',distance:'4.50B km',type:'ICE GIANT',description:'Deep blue and far from home. Powerful winds sweep through the atmosphere of this distant giant.',fact:'The farthest planet from the Sun.'}
];
const $ = id => document.getElementById(id);
let selected=2, paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches, speed=1, elapsed=0;
let renderer, scene, camera, controls, meshes=[], selectionRing, sunHalo, ready=false;
const homePosition=new THREE.Vector3(10,25,29);
const list=$('planet-list');
planets.forEach((p,i)=>{
 const button=document.createElement('button');button.className='planet-button';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',`Select ${p.name}`);
 button.innerHTML=`<span class="mini-planet" style="background:${p.color}"></span><span><span class="number">0${i+1}</span><span class="name">${p.name}</span></span>`;
 button.addEventListener('click',()=>selectPlanet(i));list.append(button);
});
function selectPlanet(index){
 selected=index;const p=planets[index];
 [...list.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
 $('planet-number').textContent=`0${index+1} / 08`;$('planet-name').textContent=p.name;$('planet-class').textContent=p.type;
 $('planet-description').textContent=p.description;$('period').textContent=p.period;$('diameter').textContent=p.diameter;$('distance').textContent=p.distance;$('planet-fact').textContent=p.fact;$('info-dot').style.background=p.color;
 if(selectionRing)selectionRing.scale.setScalar(p.size+0.25);
}
function syncPlay(){ $('play').setAttribute('aria-pressed',String(paused));$('play-text').textContent=paused?'Resume motion':'Pause motion';$('play-symbol').textContent=paused?'▶':'Ⅱ';$('motion-label').textContent=ready?(paused?'SYSTEM PAUSED':'SYSTEM IN MOTION'):'3D VIEW UNAVAILABLE'; }
$('play').addEventListener('click',()=>{paused=!paused;syncPlay()});
$('speed').addEventListener('input',e=>{speed=Number(e.target.value);$('speed-value').textContent=`${speed}×`});
function resetCamera(){if(!ready)return;camera.position.copy(homePosition);controls.target.set(0,0,0);controls.update()}
$('reset').addEventListener('click',()=>{elapsed=0;speed=1;$('speed').value='1';$('speed-value').textContent='1×';paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches;selectPlanet(2);syncPlay();resetCamera();updatePositions()});
$('home').addEventListener('click',resetCamera);
function zoom(factor){if(!ready)return;const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(factor);offset.setLength(THREE.MathUtils.clamp(offset.length(),8,65));camera.position.copy(controls.target).add(offset);controls.update()}
$('zoom-in').addEventListener('click',()=>zoom(.85));$('zoom-out').addEventListener('click',()=>zoom(1.17));
function makeTexture(index){
 const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=planets[index].color;ctx.fillRect(0,0,512,256);
 let seed=23+index*39;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 if(index===2){ctx.fillStyle='#497367';for(let i=0;i<40;i++){const x=random()*512,y=random()*256;ctx.beginPath();for(let j=0;j<9;j++){const a=j/9*Math.PI*2,r=8+random()*24;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.7;j?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill()}ctx.fillStyle='#e1eeee77';for(let i=0;i<90;i++){ctx.beginPath();ctx.ellipse(random()*512,random()*256,10+random()*28,1+random()*3,0,0,7);ctx.fill()}}
 else if(index>=4){for(let y=0;y<256;y+=3){ctx.fillStyle=`rgba(${random()>.5?'255,235,203':'35,52,65'},${.05+random()*.2})`;ctx.fillRect(0,y,512,2+random()*9)}}
 else {for(let i=0;i<650;i++){ctx.fillStyle=`rgba(${random()>.5?'255,238,217':'49,28,20'},${random()*.19})`;ctx.beginPath();ctx.arc(random()*512,random()*256,1+random()*5,0,7);ctx.fill()}}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,210,120,0.85)');g.addColorStop(.2,'rgba(255,151,60,.4)');g.addColorStop(.5,'rgba(255,135,40,.09)');g.addColorStop(1,'rgba(255,120,30,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)}
function updatePositions(){meshes.forEach((mesh,i)=>{const a=elapsed*planets[i].rate*.12+[3.5,4.8,1.3,2.5,5.8,3.6,.4,2.0][i];mesh.position.set(Math.cos(a)*planets[i].radius,0,Math.sin(a)*planets[i].radius);mesh.rotation.y=elapsed*.09;});if(selectionRing&&meshes[selected])selectionRing.position.copy(meshes[selected].position)}
try {
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(44,1,.1,160);camera.position.copy(homePosition);
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
 $('universe').appendChild(renderer.domElement);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.minDistance=8;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.84;controls.enablePan=false;
 scene.add(new THREE.AmbientLight(0xa6c1d6,1.15));const light=new THREE.PointLight(0xffdfb0,95,0,1.25);scene.add(light);
 const sun=new THREE.Mesh(new THREE.SphereGeometry(1.7,64,48),new THREE.MeshBasicMaterial({color:0xffc174}));scene.add(sun);
 sunHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));sunHalo.scale.set(13,13,1);scene.add(sunHalo);
 const starPositions=[];let seed=42;function rand(){seed=(seed*16807)%2147483647;return seed/2147483647}for(let i=0;i<1600;i++){const theta=rand()*Math.PI*2,z=rand()*2-1,r=65+rand()*20;starPositions.push(r*Math.sqrt(1-z*z)*Math.cos(theta),r*z,r*Math.sqrt(1-z*z)*Math.sin(theta))}const stars=new THREE.BufferGeometry();stars.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:0xb8c9d8,size:.09,transparent:true,opacity:.65})));
 planets.forEach((p,i)=>{
 const ringPoints=[];for(let j=0;j<=180;j++){const angle=j/180*Math.PI*2;ringPoints.push(new THREE.Vector3(Math.cos(angle)*p.radius,-.03,Math.sin(angle)*p.radius))}scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPoints),new THREE.LineBasicMaterial({color:0x76909f,transparent:true,opacity:i===2?.29:.15})));
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(p.size,48,32),new THREE.MeshStandardMaterial({map:makeTexture(i),roughness:.9,metalness:0}));mesh.userData.planetIndex=i;meshes.push(mesh);scene.add(mesh);
 if(i===5){const rings=new THREE.Mesh(new THREE.RingGeometry(1.34,2.1,96),new THREE.MeshStandardMaterial({color:0xc1b388,side:THREE.DoubleSide,transparent:true,opacity:.78,roughness:1}));rings.rotation.x=Math.PI/2+.22;mesh.add(rings)}
 if(i===2){const atmo=new THREE.Mesh(new THREE.SphereGeometry(p.size*1.06,32,24),new THREE.MeshBasicMaterial({color:0x8fcfff,transparent:true,opacity:.1,side:THREE.BackSide}));mesh.add(atmo)}
 });
 selectionRing=new THREE.Mesh(new THREE.RingGeometry(1,1.025,64),new THREE.MeshBasicMaterial({color:0xbce4cf,side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));scene.add(selectionRing);
 const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();let downPoint=null;
 renderer.domElement.addEventListener('pointerdown',e=>{downPoint={x:e.clientX,y:e.clientY}});
 renderer.domElement.addEventListener('pointerup',e=>{if(!downPoint||Math.hypot(e.clientX-downPoint.x,e.clientY-downPoint.y)>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(meshes,false);if(hits.length)selectPlanet(hits[0].object.userData.planetIndex);downPoint=null});
 const resize=()=>{const r=$('universe').getBoundingClientRect();camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);};new ResizeObserver(resize).observe($('universe'));resize();ready=true;
 let last=performance.now();function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;if(!paused)elapsed+=dt*speed;updatePositions();selectionRing.quaternion.copy(camera.quaternion);controls.update();renderer.render(scene,camera)}requestAnimationFrame(animate);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;$('fallback').hidden=false;$('motion-label').textContent='3D VIEW UNAVAILABLE';$('play').disabled=true;$('speed').disabled=true;});
} catch(error){$('fallback').hidden=false;$('motion-label').textContent='3D VIEW UNAVAILABLE';$('play').disabled=true;$('speed').disabled=true;console.warn('Unable to initialize the WebGL scene.',error);}
selectPlanet(2);syncPlay();if(!ready){$('motion-label').textContent='3D VIEW UNAVAILABLE';$('home').disabled=true;$('zoom-in').disabled=true;$('zoom-out').disabled=true;}
