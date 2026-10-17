
import * as THREE from 'three';
import { clamp,lerp } from './physics.js';

const V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const RED=0xef343d,CYAN=0x73ebff;
const rough=(color,metalness=.1,roughness=.55)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const glow=(color,intensity=2)=>new THREE.MeshBasicMaterial({color,transparent:false,toneMapped:false});
const rand=(n)=>{const x=Math.sin(n*127.1+72.7)*43758.5453;return x-Math.floor(x);};
const radians=Math.PI/180;
function mesh(geo,mat,parent,pos=null){const m=new THREE.Mesh(geo,mat);if(pos)m.position.set(...pos);parent.add(m);return m;}
function box(w,h,d,mat,parent,x,y,z){return mesh(new THREE.BoxGeometry(w,h,d),mat,parent,[x,y,z]);}
function ball(w,h,d,mat,parent,x,y,z){const m=mesh(new THREE.SphereGeometry(1,20,12),mat,parent,[x,y,z]);m.scale.set(w,h,d);return m;}
function seg(parent,a,b,mat,rad=.025){const len=a.distanceTo(b);const m=mesh(new THREE.CylinderGeometry(rad,rad,len,5),mat,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V3(0,1,0),b.clone().sub(a).normalize());return m;}
function buildCar(){
  const car=new THREE.Group();
  const paint=new THREE.MeshPhysicalMaterial({color:0xb70817,metalness:.68,roughness:.24,clearcoat:1,clearcoatRoughness:.13});
  const redDark=new THREE.MeshStandardMaterial({color:0x4f0610,metalness:.7,roughness:.32});
  const charcoal=rough(0x091018,.65,.38),chrome=rough(0x9faab5,.85,.22);
  const glass=new THREE.MeshPhysicalMaterial({color:0x101b2c,metalness:.48,roughness:.12,transparent:true,opacity:.94,clearcoat:1});
  const tire=rough(0x090b0f,0,.91);
  const led=glow(0xe9faff),tail=glow(0xff242a),flame=glow(0x87efff);
  // Sculpted taper. Vehicle faces negative Z.
  const stations=[[-2.45,.43,.37],[-2.1,.75,.54],[-1.35,.91,.58],[.1,1.00,.59],[1.52,.92,.59],[2.18,.72,.43]];
  const verts=[],faces=[];
  for(const [z,w,h] of stations){verts.push(-w,.05,z,w,.05,z,-w,h,z,w,h,z);}
  for(let i=0;i<stations.length-1;i++){const a=i*4,b=(i+1)*4;for(const [p,q,r,t] of [[0,1,2,3],[2,3,0,1],[0,2,1,3],[1,3,0,2]]){faces.push(a+p,b+p,a+q,a+q,b+p,b+q);}}
  faces.push(0,2,1,1,2,3);const last=(stations.length-1)*4;faces.push(last,last+1,last+2,last+1,last+3,last+2);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(faces);geo.computeVertexNormals();
  mesh(geo,paint,car);
  // Curved fenders and aerodynamic panels.
  for(const side of [-1,1]){
    const f=ball(.32,.26,.86,paint,car,side*.78,.45,-1.39);f.rotation.y=side*.1;
    const r=ball(.35,.28,.81,paint,car,side*.79,.46,1.41);
    box(.06,.025,3.8,redDark,car,side*.87,.23,0);
    box(.016,.02,1.3,chrome,car,side*.90,.56,-.24);
    const head=box(.42,.068,.075,led,car,side*.51,.48,-2.23);head.rotation.y=side*.13;
    box(.35,.085,.06,tail,car,side*.53,.45,2.2);
    box(.02,.025,.24,chrome,car,side*.93,.84,-.85);
  }
  // Cockpit and windscreen.
  ball(.81,.38,1.26,charcoal,car,0,.72,-.22);
  const canopy=ball(.73,.32,1.13,glass,car,0,.95,-.27);
  canopy.rotation.x=.08;
  box(.1,.025,1.14,charcoal,car,0,1.17,-.18);
  const frame=new THREE.Group();frame.position.set(0,.86,-.87);frame.rotation.x=-.24;car.add(frame);
  box(1.48,.025,.045,chrome,frame,0,0,0);
  // Front splitter, intakes, mirrors and diffuser.
  box(1.32,.10,.22,charcoal,car,0,.05,-2.35);
  box(.84,.065,.12,charcoal,car,0,.28,-2.28);
  box(1.44,.055,.16,charcoal,car,0,.17,2.32);
  for(const side of [-1,1]){
    ball(.14,.07,.22,paint,car,side*.99,.78,-.7);
    box(.12,.045,.26,redDark,car,side*.69,.62,1.67);
  }
  const wheels=[];
  for(const x of [-1.04,1.04])for(const z of [-1.48,1.46]){
    const mount=new THREE.Group();mount.position.set(x,-.13,z);car.add(mount);
    const wheel=mesh(new THREE.CylinderGeometry(.44,.44,.25,24),tire,mount);
    wheel.rotation.z=Math.PI/2;
    const rim=mesh(new THREE.CylinderGeometry(.265,.265,.268,16),chrome,mount);rim.rotation.z=Math.PI/2;
    const hub=mesh(new THREE.CylinderGeometry(.08,.08,.29,12),charcoal,mount);hub.rotation.z=Math.PI/2;
    for(let j=0;j<6;j++){const angle=j*Math.PI/3;box(.285,.045,.058,charcoal,mount,Math.cos(angle)*.08,Math.sin(angle)*.08,0).rotation.z=angle;}
    wheels.push(mount);
  }
  // Rear cold gas rocket pair.
  const jets=[];
  for(const x of [-.47,.47]){
    const jet=new THREE.Group();jet.position.set(x,.23,2.32);car.add(jet);
    const barrel=mesh(new THREE.CylinderGeometry(.16,.21,.38,18),chrome,jet);barrel.rotation.x=Math.PI/2;
    const core=mesh(new THREE.CylinderGeometry(.11,.11,.38,18),charcoal,jet);core.rotation.x=Math.PI/2;
    const flameMesh=mesh(new THREE.ConeGeometry(.20,2.0,18),new THREE.MeshBasicMaterial({color:0x65dbff,transparent:true,opacity:.65,depthWrite:false,toneMapped:false}),jet,[0,0,1.42]);
    flameMesh.rotation.x=Math.PI/2;flameMesh.visible=false;flameMesh.scale.y=1;
    jets.push(flameMesh);
  }
  const underglow=mesh(new THREE.PlaneGeometry(3,6),new THREE.MeshBasicMaterial({color:0xff162e,transparent:true,opacity:.11,depthWrite:false,side:THREE.DoubleSide}),car,[0,-.49,.25]);underglow.rotation.x=-Math.PI/2;
  car.userData={wheels,jets,paint,underglow};car.castShadow=true;
  car.traverse(m=>{if(m.isMesh&&m!==underglow){m.castShadow=true;m.receiveShadow=false;}});
  return car;
}
function makeSky(scene){
  const skyGeo=new THREE.SphereGeometry(4900,48,24);
  const skyMat=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 w; void main(){w=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 w; void main(){float h=normalize(w).y;vec3 zenith=vec3(.018,.045,.12);vec3 blue=vec3(.13,.28,.45);vec3 horizon=vec3(.82,.43,.29);float t=smoothstep(-.13,.85,h);vec3 color=mix(horizon,mix(blue,zenith,smoothstep(.02,.95,h)),t);gl_FragColor=vec4(color,1.);}'
  });
  mesh(skyGeo,skyMat,scene);
  const sun=mesh(new THREE.SphereGeometry(48,32,24),new THREE.MeshBasicMaterial({color:0xffd2ae,toneMapped:false}),scene,[-520,245,-1580]);
  const makeGlow=()=>{
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext('2d'),r=ctx.createRadialGradient(64,64,0,64,64,64);
    r.addColorStop(0,'rgba(255,222,188,.63)');r.addColorStop(.3,'rgba(255,133,101,.28)');r.addColorStop(1,'rgba(255,91,81,0)');
    ctx.fillStyle=r;ctx.fillRect(0,0,128,128);
    return new THREE.CanvasTexture(canvas);
  };
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:makeGlow(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.position.copy(sun.position);sprite.scale.set(560,560,1);scene.add(sprite);
}
function makeWorld(scene){
  const group=new THREE.Group();scene.add(group);
  const ground=rough(0x202533,.03,.96),asphalt=rough(0x111822,.15,.75),line=glow(0xc3ccd4),redNeon=glow(RED),cyanNeon=glow(CYAN),metal=rough(0x313a48,.46,.57);
  const terrain=mesh(new THREE.PlaneGeometry(7000,7000),ground,group,[0,-.36,0]);terrain.rotation.x=-Math.PI/2;terrain.receiveShadow=true;
  const runway=box(27,.18,300,asphalt,group,0,-.15,-45);runway.receiveShadow=true;
  for(let z=-161;z<106;z+=26){box(.3,.032,11,line,group,0,.01,z);for(const x of [-13.1,13.1])box(.2,.03,18,redNeon,group,x,.04,z);}
  for(let z=80;z>=-150;z-=23){for(const x of [-15.6,15.6]){
    const pole=box(.12,2.0,.12,metal,group,x,.95,z);
    const lamp=ball(.33,.12,.33,cyanNeon,group,x,2.1,z);
    const cone=mesh(new THREE.ConeGeometry(.55,2,10,1,true),new THREE.MeshBasicMaterial({color:CYAN,transparent:true,opacity:.08,side:THREE.DoubleSide,depthWrite:false}),group,[x,1.0,z]);cone.rotation.x=Math.PI;
  }}
  const ramp=box(27,.7,35,asphalt,group,0,3.2,-126);ramp.rotation.x=.24;ramp.receiveShadow=true;
  for(const x of [-12.7,12.7]){const rail=box(.3,.17,34,redNeon,group,x,3.45,-126);rail.rotation.x=.24;}
  box(30,.2,7,rough(0x363b48),group,0,9,-151);
  // Coastal cliffs and kilometer-high needle monuments create depth.
  const stoneMats=[rough(0x293244),rough(0x34404c),rough(0x3b3c49),rough(0x293846)];
  for(let i=0;i<130;i++){
    const x=(rand(i*1.28)-.5)*3800,z=(rand(i*2.92)-.56)*4800;
    if(Math.abs(x)<125 && z>-950 && z<200)continue;
    const size=25+rand(i*5.13)*120,height=size*(1.15+rand(i*8.9)*2);
    const hill=mesh(new THREE.ConeGeometry(size,height,5,1),stoneMats[i%4],group,[x,height/2-.4,z]);
    hill.rotation.y=rand(i*4.5)*Math.PI;
    if(i%12===0){const peak=mesh(new THREE.ConeGeometry(3,35,4),cyanNeon,group,[x,height+15,z]);peak.rotation.y=Math.PI/4;}
  }
  const accent=rough(0x181e2e,.58,.42);
  for(let i=0;i<28;i++){
    const x=(rand(i*2.7)>.5?1:-1)*(150+rand(i*.123)*240),
      z=-170-i*88+(rand(i*4.21)-.5)*80,h=18+rand(i*8.3)*110;
    const tower=box(7+rand(i*17)*9,h,6+rand(i*15)*9,accent,group,x,h/2,z);
    box(1,.35,1,cyanNeon,group,x,h+.1,z);
    for(let y=8;y<h-5;y+=12)box(7,.09,.11,redNeon,group,x,y,z+4);
  }
  // Volumetric-looking distant cloud silhouettes.
  const cloudMat=new THREE.MeshBasicMaterial({color:0xeeb0a0,transparent:true,opacity:.12,depthWrite:false});
  for(let i=0;i<33;i++){
    const x=(rand(i*21)-.5)*1900,z=(rand(i*31)-.6)*2000,y=125+rand(i*32)*260;
    for(let j=0;j<3;j++)ball(35+rand(i*11+j)*32,5+rand(i*7+j)*7,17+rand(i*9+j)*20,cloudMat,group,x+j*22,y+rand(i+j)*4,z);
  }
  const landing=mesh(new THREE.CircleGeometry(14,48),new THREE.MeshBasicMaterial({color:0x283945,transparent:true,opacity:.9,side:THREE.DoubleSide}),group,[0,.04,65]);landing.rotation.x=-Math.PI/2;
  const runCircle=mesh(new THREE.RingGeometry(9.8,10.1,64),redNeon,group,[0,.06,65]);runCircle.rotation.x=-Math.PI/2;
  const runwaySign=box(16,4,.3,metal,group,0,7.7,101);
  for(const x of [-9.2,9.2])box(.35,14,.35,metal,group,x,7.0,101);
  box(15,.15,.3,redNeon,group,0,9.3,101);
  return group;
}
function buildGate(data,i){
  const group=new THREE.Group();group.position.set(data.x,data.y,data.z);
  const inactive=new THREE.MeshBasicMaterial({color:0x7895a9,transparent:true,opacity:.32,depthWrite:false});
  const active=new THREE.MeshBasicMaterial({color:0x67f2ff,transparent:true,opacity:1,depthWrite:false,toneMapped:false});
  const torus=mesh(new THREE.TorusGeometry(data.radius,.58,12,78),inactive,group);
  mesh(new THREE.TorusGeometry(data.radius+1.2,.065,6,78),inactive,group);
  const core=mesh(new THREE.IcosahedronGeometry(.75,1),glow(RED),group);
  const flag=box(3,.16,.18,glow(RED),group,0,data.radius+2,0);
  const badge=mesh(new THREE.PlaneGeometry(5,2.1),new THREE.MeshBasicMaterial({color:0x0c1622,side:THREE.DoubleSide}),group,[0,-data.radius-2,0]);
  group.userData={torus,active,inactive,core,i,passed:false};
  return group;
}
export function createWorld(canvas){
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x6f5c60,.00054);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<700?1.4:1.8));
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.42;
  renderer.shadowMap.enabled=window.innerWidth>850;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  makeSky(scene);
  scene.add(new THREE.HemisphereLight(0xd2eafa,0x3d2437,2.7));
  const sunlight=new THREE.DirectionalLight(0xffd5ad,3.4);sunlight.position.set(-320,450,-640);sunlight.castShadow=window.innerWidth>850;
  sunlight.shadow.mapSize.set(1024,1024);sunlight.shadow.camera.left=-50;sunlight.shadow.camera.right=50;sunlight.shadow.camera.top=55;sunlight.shadow.camera.bottom=-55;sunlight.shadow.bias=-.00015;scene.add(sunlight);
  makeWorld(scene);
  const car=buildCar();scene.add(car);
  const camera=new THREE.PerspectiveCamera(66,window.innerWidth/window.innerHeight,.15,7000);
  camera.position.set(9,7,87);
  const shake=V3(),up=V3(0,1,0),look=V3(0,0,0),target=V3(0,0,0);
  let gates=[],lastState=null,camMode=0,frame=0;
  const particles=[];const particleGeo=new THREE.IcosahedronGeometry(1,0);
  for(let i=0;i<68;i++){
    const material=new THREE.MeshBasicMaterial({color:i%4===0?0xff5d41:0x8be9ff,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
    const p=mesh(particleGeo,material,scene);p.visible=false;p.userData.life=0;particles.push(p);
  }
  function setGates(data){
    gates.forEach(g=>scene.remove(g));gates=data.map(buildGate);gates.forEach(g=>scene.add(g));
  }
  function resize(){
    const w=window.innerWidth,h=window.innerHeight;
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,w<700?1.4:1.8));
  }
  function update(state,dt,activeGate=-1,boosting=false){
    lastState=state;frame++;
    car.position.set(state.x,state.y,state.z);
    car.rotation.order='YXZ';car.rotation.set(state.pitch,state.heading,state.bank);
    for(const w of car.userData.wheels)w.rotation.x+=state.speed*dt*.9;
    car.userData.jets.forEach((f,i)=>{f.visible=boosting;f.scale.y=boosting?(1.25+Math.sin(frame*.7+i*4)*.32):.2;});
    car.userData.underglow.material.opacity=.08+(boosting?.12:0);
    sunlight.target.position.copy(car.position);sunlight.position.set(state.x-300,state.y+450,state.z-640);sunlight.target.updateMatrixWorld();
    gates.forEach((gate,i)=>{
      gate.visible=i>=Math.max(0,activeGate-1)&&i<activeGate+5;
      const isActive=i===activeGate;
      gate.userData.torus.material=isActive?gate.userData.active:gate.userData.inactive;
      gate.scale.setScalar(isActive?1+Math.sin(frame*.045)*.012:1);
      gate.rotation.z=isActive?Math.sin(frame*.015)*.022:0;
      gate.userData.core.rotation.y+=dt*1.7;
    });
    if(state.speed>18){
      const amount=boosting?3:1;
      for(let j=0;j<amount;j++){
        const slot=particles.find(p=>p.userData.life<=0);
        if(!slot)break;
        slot.visible=true;slot.userData.life=.35+Math.random()*.30;
        const off=V3((Math.random()-.5)*1.15,-.1,2.1+Math.random()*.5);
        off.applyEuler(car.rotation);slot.position.copy(car.position).add(off);
        const scl=.09+Math.random()*(boosting?.3:.15);slot.scale.setScalar(scl);
        slot.material.opacity=boosting?.9:.35;
      }
    }
    for(const p of particles){
      if(p.userData.life<=0)continue;
      p.userData.life-=dt;p.position.y+=dt*.6;p.position.z+=Math.cos(state.heading)*dt*6;
      p.material.opacity=Math.min(.7,p.userData.life*1.8);
      p.scale.multiplyScalar(1+dt*.6);
      if(p.userData.life<=0)p.visible=false;
    }
  }
  function render(menuMode=false,viewBack=false){
    if(lastState){
      const state=lastState;
      if(menuMode){
        const t=performance.now()*.00018;
        target.set(state.x+Math.sin(t)*14,state.y+5+Math.sin(t*.8)*2,state.z+Math.cos(t)*16);
        camera.position.lerp(target,.027);
        look.set(state.x,state.y+.55,state.z);camera.lookAt(look);
      }else{
        const offsets=[V3(0,4.8,13),V3(0,9.5,27),V3(0,.8,-1.5)];
        const offset=offsets[camMode].clone();
        if(viewBack)offset.set(0,4,-14);
        offset.applyEuler(car.rotation);
        target.copy(car.position).add(offset);
        if(camMode===2&&!viewBack)camera.position.lerp(target,.44);else camera.position.lerp(target,.12);
        const lookAhead=V3(0,camMode===2?.5:2,-(camMode===2?45:18)).applyEuler(car.rotation);
        look.copy(car.position).add(lookAhead);
        camera.lookAt(look);
        const fov=camMode===2?83:clamp(65+state.speed*.11,67,85);
        camera.fov=lerp(camera.fov,fov,.05);camera.updateProjectionMatrix();
      }
    }
    renderer.render(scene,camera);
  }
  function cameraNext(){camMode=(camMode+1)%3;return ['CHASE','LONG CHASE','COCKPIT'][camMode];}
  return {scene,renderer,camera,car,resize,setGates,update,render,cameraNext};
}