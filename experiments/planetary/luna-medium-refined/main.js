import * as THREE from 'three';

const style = document.createElement('style');
style.textContent = `
:root{color-scheme:dark;--ink:#e9e7df;--muted:#8b929a;--line:rgba(226,231,237,.16);--gold:#e9bd83;--night:#080d15;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}html,body{margin:0;min-width:320px;min-height:100%;background:var(--night);color:var(--ink)}body{min-height:100svh}button,input{font:inherit}button{color:inherit}#app{position:relative;isolation:isolate;min-height:100svh;overflow:hidden;background:radial-gradient(ellipse at 70% 45%,#14202a 0%,#0b111a 45%,#080d15 78%)}#stage{position:absolute;inset:0;z-index:-1}#stage canvas{display:block;width:100%;height:100%;touch-action:none}.grain{position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.16;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.88' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.14'/%3E%3C/svg%3E")}.masthead{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5.3vw;border-bottom:1px solid rgba(255,255,255,.06);position:relative;z-index:2}.wordmark{font-size:12px;letter-spacing:.16em;text-decoration:none;color:#efede7;font-weight:650}.wordmark i{font-style:normal;color:#8d969b;margin:0 5px}.mark{color:var(--gold);font-size:16px;vertical-align:-1px;margin-right:8px}.edition{display:flex;align-items:center;gap:10px;color:#9aa1a5;font-size:9px;letter-spacing:.16em}.live-dot{width:5px;height:5px;background:#cfaa79;border-radius:50%;box-shadow:0 0 9px #cfaa79}.edition-line{height:1px;width:24px;background:var(--line)}.icon-button{border:1px solid var(--line);width:29px;height:29px;border-radius:50%;background:transparent;color:#aeb3b4;cursor:pointer}.intro{position:absolute;left:8.6vw;top:19%;z-index:1;pointer-events:none}.eyebrow{font-size:9px;letter-spacing:.2em;color:#a6a89f;margin:0 0 18px;font-weight:600}.intro h1{font-family:Georgia,"Times New Roman",serif;font-size:clamp(40px,5.2vw,70px);line-height:.99;font-weight:400;letter-spacing:-.045em;margin:0;color:#eeece4}.intro h1 em,.planet-card h2 em,dialog em{color:#d6b38a;font-weight:400}.dek{font-size:12px;line-height:1.8;color:#9ca3a7;margin:21px 0 0;letter-spacing:.015em}.scene-caption{position:absolute;left:8.6vw;top:51%;display:flex;align-items:center;gap:12px;font-size:8px;letter-spacing:.19em;color:#b0b6b7}.caption-rule{width:27px;height:1px;background:var(--gold)}.caption-note{color:#78838a;font-size:8px;letter-spacing:.12em;margin-left:5px}.planet-nav{position:absolute;right:5.5vw;top:23%;z-index:2;display:flex;flex-direction:column;gap:3px}.planet-nav button{border:0;background:transparent;text-align:left;padding:7px 11px;color:#9ca5aa;font-size:10px;letter-spacing:.07em;cursor:pointer;display:flex;align-items:center;gap:11px;border-left:1px solid transparent;transition:color .2s,border-color .2s,transform .2s}.planet-nav button:hover,.planet-nav button:focus-visible{color:#f0ece3;transform:translateX(-3px)}.planet-nav button[aria-current=true]{color:#f1e2ce;border-color:var(--gold)}.planet-nav .num{font-size:8px;color:#657078;font-variant-numeric:tabular-nums}.planet-card{position:absolute;right:5.5vw;bottom:19%;width:214px;padding:17px 0 0;border-top:1px solid rgba(225,220,208,.24);z-index:1}.card-top{display:flex;justify-content:space-between;align-items:center}.card-top .eyebrow{font-size:8px;margin:0;color:#b59c7d}.coordinates{font-size:9px;color:#707a80;font-variant-numeric:tabular-nums}.planet-card h2{font:400 29px/1 Georgia,"Times New Roman",serif;margin:11px 0 9px;letter-spacing:-.025em}.body-copy{font-size:10px;line-height:1.65;color:#a0a7a8;margin:0;min-height:34px}.card-meta{display:flex;gap:32px;margin-top:16px;padding-top:12px;border-top:1px solid rgba(225,220,208,.11)}.card-meta div{display:flex;flex-direction:column;gap:6px}.meta-label{font-size:7px;letter-spacing:.17em;color:#747e83}.card-meta strong{font-size:10px;font-weight:500;color:#d5d5ce}.controls{position:absolute;left:8.6vw;bottom:11%;display:flex;align-items:center;gap:20px;z-index:3}.play-button,.reset-button{border:0;background:none;cursor:pointer;color:#e8e5dc;display:flex;align-items:center;gap:9px;font-size:8px;letter-spacing:.15em;padding:10px 0}.play-icon{width:26px;height:26px;border:1px solid rgba(220,210,191,.42);border-radius:50%;display:grid;place-items:center;color:#e0bc8d;font-size:10px;letter-spacing:0}.control-divider{height:26px;width:1px;background:var(--line)}.speed-control{display:flex;align-items:center;gap:10px;color:#a4abae;font-size:8px;letter-spacing:.14em}.speed-control input{appearance:none;width:92px;height:2px;background:linear-gradient(90deg,#d3ad7e var(--fill,28%),rgba(220,230,235,.24) var(--fill,28%));outline:0;cursor:pointer}.speed-control input::-webkit-slider-thumb{appearance:none;width:8px;height:8px;border:1px solid #e3c39a;background:#0b1219;border-radius:50%}.speed-control input::-moz-range-thumb{width:7px;height:7px;border:1px solid #e3c39a;background:#0b1219;border-radius:50%}.speed-control output{width:28px;font-size:9px;color:#ddd6ca;font-variant-numeric:tabular-nums}.reset-button{color:#91999e;margin-left:2px}.reset-button:hover,.play-button:hover,.reset-button:focus-visible,.play-button:focus-visible{color:#f4d4a7}footer{position:absolute;bottom:0;left:5.3vw;right:5.3vw;height:48px;border-top:1px solid rgba(255,255,255,.07);display:flex;justify-content:space-between;align-items:center;color:#626e75;font-size:7px;letter-spacing:.16em;z-index:1}.footer-center{color:#828c90}button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid #d7b385;outline-offset:4px}dialog{background:#111a22;color:var(--ink);border:1px solid rgba(226,231,237,.22);max-width:380px;padding:38px;box-shadow:0 24px 100px #000a}dialog::backdrop{background:#02060bb8;backdrop-filter:blur(4px)}dialog h2{font:400 36px/1.04 Georgia,serif;letter-spacing:-.04em;margin:0 0 20px}dialog p:not(.eyebrow){font-size:12px;line-height:1.8;color:#aab1b2}.dialog-note{border-top:1px solid var(--line);padding-top:16px;margin-top:22px}.close{position:absolute;right:15px;top:12px;background:none;border:0;font-size:23px;color:#aab1b2;cursor:pointer}#webgl-note{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);max-width:400px;width:calc(100% - 48px);padding:26px;border:1px solid var(--line);background:#111923;color:#e9e7df;line-height:1.7;font-size:13px;text-align:center}#webgl-note strong{display:block;font:24px Georgia,serif;margin-bottom:10px;color:#e3c39a}
@media(max-width:760px){.masthead{height:62px;padding:0 22px}.edition{font-size:7px;gap:7px}.edition-line{width:12px}.intro{left:25px;top:13%;}.intro h1{font-size:clamp(42px,11vw,58px)}.dek{font-size:11px;margin-top:15px}.scene-caption{left:25px;top:auto;bottom:39%;gap:8px}.caption-note{font-size:7px}.planet-nav{top:auto;right:15px;bottom:19%;gap:0}.planet-nav button{padding:7px 8px;font-size:9px;gap:8px}.planet-card{left:25px;right:auto;bottom:20%;width:min(43vw,190px);padding-top:11px}.planet-card h2{font-size:24px}.body-copy{font-size:9px;min-height:45px}.card-meta{gap:20px;margin-top:10px;padding-top:9px}.controls{left:25px;bottom:10%;gap:14px}.speed-control input{width:65px}.control-divider{height:22px}.play-button,.reset-button{font-size:7px}.play-icon{width:23px;height:23px}.reset-button span{display:none}footer{left:22px;right:22px;height:37px;font-size:6px}.footer-center{display:none}#stage{inset:0}.scene-caption{bottom:40%}}@media(max-width:390px){.planet-card{width:40vw}.planet-nav{right:7px}.planet-nav button{padding:7px 6px}.planet-nav .num{display:none}.intro{top:12%}.planet-card{bottom:20%}.controls{bottom:9%;gap:10px}.speed-control{gap:7px}}
`;
document.head.append(style);

const bodies = [
  {name:'Sol', type:'THE STAR', color:0xffc578, radius:.61, orbit:0, period:'—', detail:'The steady heart of this small system. Every path begins here.'},
  {name:'Mercury', type:'TERRESTRIAL', color:0x9b9b92, radius:.105, orbit:1.04, period:'88 days', detail:'A small, quick world, keeping close to the warmth.'},
  {name:'Venus', type:'TERRESTRIAL', color:0xdab37e, radius:.17, orbit:1.48, period:'225 days', detail:'Cloud-wrapped and bright, turning slowly beneath its veil.'},
  {name:'Earth', type:'TERRESTRIAL', color:0x6eafc0, radius:.19, orbit:1.98, period:'365 days', detail:'Our blue home, a little ocean-lit point in the dark.'},
  {name:'Mars', type:'TERRESTRIAL', color:0xc87554, radius:.145, orbit:2.55, period:'687 days', detail:'A rust-colored neighbor with a long, unhurried year.'},
  {name:'Jupiter', type:'GAS GIANT', color:0xd8b28c, radius:.39, orbit:3.55, period:'11.9 years', detail:'A giant of soft bands, accompanied by faint moonlight.'},
  {name:'Saturn', type:'GAS GIANT', color:0xd4c292, radius:.33, orbit:4.55, period:'29.4 years', detail:'A pale giant wearing a wide, delicate ring.'},
  {name:'Uranus', type:'ICE GIANT', color:0x90cbd0, radius:.245, orbit:5.48, period:'84 years', detail:'An ice-blue world, tilted into its own unusual seasons.'},
  {name:'Neptune', type:'ICE GIANT', color:0x6685ce, radius:.24, orbit:6.42, period:'165 years', detail:'A distant blue wanderer at the edge of this little view.'}
];
const stage = document.querySelector('#stage');
const nav = document.querySelector('#planet-nav');
const setInfo = (index) => {
  const b = bodies[index];
  document.querySelector('#body-type').textContent = b.type;
  document.querySelector('#body-index').textContent = `${String(index + 1).padStart(2,'0')} / 09`;
  document.querySelector('#body-name').textContent = b.name;
  document.querySelector('#body-copy').textContent = b.detail;
  document.querySelector('#body-orbit').textContent = index ? `${b.orbit.toFixed(1)} au*` : 'Center';
  document.querySelector('#body-year').textContent = b.period;
  [...nav.children].forEach((button, i) => button.setAttribute('aria-current', i === index ? 'true' : 'false'));
  selected = index;
};
let selected = 0;
bodies.slice(1).forEach((b,i) => {
  const button = document.createElement('button');
  button.type='button'; button.setAttribute('aria-current','false');
  button.innerHTML = `<span class="num">0${i+1}</span><span>${b.name}</span>`;
  button.addEventListener('click',()=>setInfo(i+1)); nav.append(button);
});
setInfo(0);
const about=document.querySelector('#about');
document.querySelector('#help').addEventListener('click',()=>about.showModal());
about.querySelector('.close').addEventListener('click',()=>about.close());
about.addEventListener('click',e=>{if(e.target===about)about.close()});

let renderer, scene, camera, root, planets=[], orbitLabels=[], raycaster, pointer, running=true, speed=.55, elapsed=0;
let drag=null, yaw=0.18, pitch=.42, distance=12.6;
try {
  renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
  renderer.setSize(stage.clientWidth,stage.clientHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.25;
  stage.append(renderer.domElement);
  scene=new THREE.Scene(); scene.background=null;
  camera=new THREE.PerspectiveCamera(38,stage.clientWidth/stage.clientHeight,.1,100);
  root=new THREE.Group(); scene.add(root);
  const ambient=new THREE.AmbientLight(0x8191a2,1.5); scene.add(ambient);
  const starLight=new THREE.PointLight(0xffd39a,110,28,1.6); starLight.position.set(0,0,0); scene.add(starLight);
  const fill=new THREE.DirectionalLight(0x9dbde0,1.2); fill.position.set(-6,5,-5); scene.add(fill);
  const sphere=new THREE.SphereGeometry(1,32,24);
  const sunMat=new THREE.MeshStandardMaterial({color:0xffbd67,emissive:0xe28c30,emissiveIntensity:2.6,roughness:.8});
  const sun=new THREE.Mesh(sphere,sunMat); sun.scale.setScalar(bodies[0].radius); root.add(sun); planets.push(sun);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(.78,32,24),new THREE.MeshBasicMaterial({color:0xc3874f,transparent:true,opacity:.065,side:THREE.BackSide,depthWrite:false}));root.add(halo);
  for(let i=1;i<bodies.length;i++){
    const b=bodies[i];
    const pts=[]; for(let j=0;j<=180;j++){const a=j/180*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*b.orbit,0,Math.sin(a)*b.orbit))}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xaab6b9,transparent:true,opacity:.15}));root.add(line);
    const mat=new THREE.MeshStandardMaterial({color:b.color,roughness:.78,metalness:.02});
    const ball=new THREE.Mesh(sphere,mat);ball.scale.setScalar(b.radius);ball.userData.bodyIndex=i;root.add(ball);planets.push(ball);
    if(b.name==='Saturn'){
      const ring=new THREE.Mesh(new THREE.RingGeometry(.46,.76,64),new THREE.MeshStandardMaterial({color:0xcab995,side:THREE.DoubleSide,transparent:true,opacity:.72,roughness:.8}));ring.rotation.x=-Math.PI/2.5;ring.rotation.y=.12;ball.add(ring);
    }
    if(b.name==='Earth'){
      const moon=new THREE.Mesh(new THREE.SphereGeometry(.045,16,12),new THREE.MeshStandardMaterial({color:0xb9b8aa,roughness:1}));moon.position.set(.32,.01,.03);ball.add(moon);
    }
  }
  const starsCount=1000, positions=new Float32Array(starsCount*3);
  for(let i=0;i<starsCount;i++){const r=15+Math.random()*30, a=Math.random()*Math.PI*2, y=(Math.random()-.5)*25;positions[i*3]=Math.cos(a)*r;positions[i*3+1]=y;positions[i*3+2]=Math.sin(a)*r}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xcad5db,size:.035,transparent:true,opacity:.6,sizeAttenuation:true}));scene.add(stars);
  raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
  const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};
  window.addEventListener('resize',resize);
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;yaw-=dx*.005;pitch=Math.max(-.15,Math.min(1.15,pitch+dy*.004));drag.x=e.clientX;drag.y=e.clientY});
  canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const rect=canvas.getBoundingClientRect();pointer.x=(e.clientX-rect.left)/rect.width*2-1;pointer.y=-(e.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(planets,false)[0];if(hit){const index=hit.object.userData.bodyIndex??0;setInfo(index)}}drag=null});
  canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(8,Math.min(20,distance+e.deltaY*.009))},{passive:false});
  let last=performance.now();
  const tick=now=>{requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.06);last=now;if(running)elapsed+=dt*speed;
    planets.forEach((p,i)=>{if(i===0)return;const b=bodies[i],phase=elapsed*(.22+1.12/(b.orbit*.52));p.position.set(Math.cos(phase)*b.orbit,Math.sin(phase*1.8+i)*.018,Math.sin(phase)*b.orbit);p.rotation.y+=dt*(.18+i*.025)});
    const target=new THREE.Vector3(0,0,0);const cy=Math.cos(pitch),sy=Math.sin(pitch);camera.position.set(Math.sin(yaw)*cy*distance,sy*distance,Math.cos(yaw)*cy*distance);camera.lookAt(target);renderer.render(scene,camera)};
  requestAnimationFrame(tick);
} catch (error) {
  stage.innerHTML='<div id="webgl-note" role="status"><strong>The observatory is quiet</strong>This browser or device could not start WebGL, which is needed to draw the moving planets. Your controls and this note remain available, but the 3D scene cannot be shown here.</div>';
}

const play=document.querySelector('#play');
play.addEventListener('click',()=>{running=!running;play.setAttribute('aria-label',running?'Pause simulation':'Resume simulation');document.querySelector('#play-label').textContent=running?'PAUSE':'PLAY';document.querySelector('.play-icon').textContent=running?'Ⅱ':'▶'});
const slider=document.querySelector('#speed'), out=document.querySelector('#speed-value');
function setSpeed(){speed=Number(slider.value);out.value=`${speed.toFixed(1)}×`;slider.style.setProperty('--fill',`${speed/2*100}%`)}
slider.addEventListener('input',setSpeed);setSpeed();
document.querySelector('#reset').addEventListener('click',()=>{elapsed=0;speed=.55;slider.value='.55';setSpeed();yaw=.18;pitch=.42;distance=12.6;running=true;play.setAttribute('aria-label','Pause simulation');document.querySelector('#play-label').textContent='PAUSE';document.querySelector('.play-icon').textContent='Ⅱ';setInfo(0)});
