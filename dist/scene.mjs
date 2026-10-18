import * as T from './three.module.min.js';
import {GATES,LOOP,PARKED} from './physics.mjs?v=1.1.0';

const mat=(color,roughness=.65,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const rubber=mat(0x10151c,.9),metal=mat(0x8c97a5,.23,.85),dark=mat(0x111b27,.35,.5);
const white=mat(0xdfe6ea,.25,.5),glass=mat(0x091724,.11,.8),paint=mat(0xb9c8d6,.3,.5);
const glow=(color)=>new T.MeshBasicMaterial({color});
function mesh(geo,material,parent,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,w,h,d,material,x=0,y=0,z=0){return mesh(new T.BoxGeometry(w,h,d),material,parent,x,y,z);}
function sections(parent,items,bottom,material){
  const vertices=[],indices=[];
  for(const [z,w,h] of items)vertices.push(-w,bottom,z,w,bottom,z,w,h,z,-w,h,z);
  for(let i=0;i<items.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=b+4,d=a+4;indices.push(a,b,d,b,c,d);}
  indices.push(0,3,1,1,3,2);const n=items.length*4-4;indices.push(n,n+1,n+3,n+1,n+2,n+3);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return mesh(geo,material,parent);
}
function line(parent,points,color=0xbda2f3){const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));const l=new T.Line(g,new T.LineBasicMaterial({color}));parent.add(l);return l;}
export function makeCar(color=0xdfe6ea,simple=false){
  const group=new T.Group(),body=new T.Group();group.add(body);const shell=color===0xdfe6ea?white:mat(color,.27,.5);
  sections(body,[[-2.36,.92,.59],[-2.04,1.09,.80],[-.6,1.12,.88],[1.48,1.15,.92],[2.22,1.06,.82]],.34,shell);
  sections(body,[[-.86,.91,.9],[-.2,.76,1.51],[.68,.75,1.51],[1.29,.96,.93]],.86,glass);
  sections(body,[[-.20,.77,1.53],[.6,.77,1.53]],1.50,shell);
  box(body,2.07,.12,4.35,dark,0,.31,0);
  box(body,1.94,.035,.06,glow(0xd5efff),0,.64,-2.355);
  box(body,2.09,.065,.05,glow(0xff4d60),0,.75,2.23);
  box(body,2.14,.16,.08,dark,0,.46,2.24);
  box(body,.44,.18,.03,dark,0,.6,2.28);
  const label=makeLabel('RDSTR','#dce3eb',128,32);label.scale.set(.38,.095,1);label.position.set(0,.61,2.31);body.add(label);
  for(const side of [-1,1]){
    box(body,.10,.21,3.10,dark,side*1.09,.35,.02);
    box(body,.05,.02,.35,metal,side*1.137,.86,.15);
    const mirror=box(body,.25,.11,.24,shell,side*1.19,1.04,-.64);mirror.rotation.z=side*.12;
    line(body,[[side*.91,.94,-.79],[side*.76,1.54,-.18],[side*.75,1.54,.69],[side*.97,.95,1.26]],0xc5d2dc);
    line(body,[[side*1.117,.83,-.58],[side*1.13,.44,-.59],[side*1.13,.44,1.08],[side*1.14,.86,1.13]],0x66717b);
    box(body,.09,.27,.30,dark,side*1.075,.64,1.38);
    const attitudeNozzle=mesh(new T.CylinderGeometry(.09,.11,.13,12),metal,body,side*1.16,.66,.68);attitudeNozzle.rotation.z=Math.PI/2;
  }
  const wheels=[];
  for(const x of [-1.08,1.08])for(const z of [-1.48,1.45]){
    const wheel=new T.Group();wheel.position.set(x,.45,z);body.add(wheel);
    const tire=mesh(new T.CylinderGeometry(.45,.45,.35,24),rubber,wheel);tire.rotation.z=Math.PI/2;
    const rim=mesh(new T.CylinderGeometry(.31,.31,.37,24),dark,wheel);rim.rotation.z=Math.PI/2;
    const outer=x>0?.188:-.188;
    const ring=mesh(new T.TorusGeometry(.315,.027,6,24),metal,wheel,outer,0,0);ring.rotation.y=Math.PI/2;
    if(!simple){
      const caliper=box(wheel,.04,.21,.1,mat(0xca3349,.5,.4),outer*.7,.04,.21);
      for(let k=0;k<7;k++){const a=k/7*Math.PI*2;const spoke=box(wheel,.04,.48,.043,metal,outer,0,0);spoke.rotation.x=a;}
    }
    const cap=mesh(new T.CylinderGeometry(.08,.08,.39,12),metal,wheel);cap.rotation.z=Math.PI/2;
    wheels.push(wheel);
  }
  for(const x of [-.78,-.26,.26,.78]){
    const nozzle=mesh(new T.CylinderGeometry(.145,.18,.28,16,1,true),metal,body,x,.48,2.30);nozzle.rotation.x=Math.PI/2;
    const hole=mesh(new T.CircleGeometry(.132,16),rubber,body,x,.48,2.44);
    const rim=mesh(new T.TorusGeometry(.147,.025,6,20),metal,body,x,.48,2.45);
  }
  for(const x of [-.87,.87])for(const z of [-1.42,1.4]){
    const noz=mesh(new T.CylinderGeometry(.17,.13,.1,12),dark,body,x,.28,z);
  }
  // Rear aerofoil and supports, matching the reveal's thin horizontal silhouette.
  for(const x of [-.65,.65])box(body,.065,.23,.16,dark,x,1.02,1.93);
  box(body,2.35,.065,.37,shell,0,1.15,1.96);
  for(const x of [-1.14,1.14])box(body,.035,.16,.4,dark,x,1.18,1.96);
  group.userData={body,wheels};return group;
}
export function makeLabel(text,color='#dce8ff',w=512,h=96){
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');
  ctx.fillStyle=color;ctx.font=`500 ${h*.47}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2,w*.95);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  return new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
}
function instancedBoxes(scene,items,material){const m=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,items.length);const obj=new T.Object3D();items.forEach((a,i)=>{obj.position.set(a[0],a[1],a[2]);obj.scale.set(a[3],a[4],a[5]);obj.rotation.set(0,a[6]||0,0);obj.updateMatrix();m.setMatrixAt(i,obj.matrix)});m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function createScene(container){
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.outputColorSpace=T.SRGBColorSpace;container.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.fog=new T.FogExp2(0xa7a5b3,.0015);
  const camera=new T.PerspectiveCamera(52,innerWidth/innerHeight,.12,2200);
  const sky=new T.Mesh(new T.SphereGeometry(1200,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sun:{value:new T.Vector3(-.55,.24,-.76).normalize()}},vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vDir;uniform vec3 sun;void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);vec3 col=mix(vec3(.74,.62,.59),vec3(.16,.28,.43),pow(h,.45));float s=max(dot(d,sun),0.);col+=vec3(1.,.64,.29)*pow(s,24.)*.25;col+=vec3(1.,.86,.66)*smoothstep(.99955,.99975,s)*2.;gl_FragColor=vec4(col,1.);}` }));scene.add(sky);
  scene.add(new T.HemisphereLight(0xb3d6ff,0x6c5241,2.25));
  const sun=new T.DirectionalLight(0xffdfb9,3.3);sun.position.set(-80,110,-75);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:300});sun.shadow.bias=-.00025;sun.shadow.normalBias=.03;scene.add(sun);scene.add(sun.target);
  const reflectScene=new T.Scene();reflectScene.add(sky.clone());reflectScene.add(new T.HemisphereLight(0xdcecff,0x625a5c,2));
  const pmrem=new T.PMREMGenerator(renderer);const env=pmrem.fromScene(reflectScene,.1,1,1600);scene.environment=env.texture;pmrem.dispose();
  const terrain=new T.PlaneGeometry(2000,2000,80,80);terrain.rotateX(-Math.PI/2);
  const pos=terrain.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const strength=Math.min(1,Math.max(0,(Math.hypot(x,z)-260)/160));pos.setY(i,-.13+strength*(Math.sin(x*.014)*Math.cos(z*.01)*13+Math.sin(z*.039)*3));}terrain.computeVertexNormals();
  mesh(terrain,mat(0x9b8d80,.96),scene).receiveShadow=true;
  const roadMat=mat(0x434953,.96),edgeMat=mat(0xa1a6ad,.9),lineMat=mat(0xe2dfca,.8);
  box(scene,24,.10,480,roadMat,0,-.035,-90);
  box(scene,300,.10,17,roadMat,0,-.04,32);
  box(scene,16,.10,260,roadMat,LOOP.x,-.035,-40);
  box(scene,150,.1,15,roadMat,-40,-.04,-173);
  box(scene,110,.1,180,mat(0x777b80,.98),143,-.06,-95);
  const marks=[];for(let z=-325;z<145;z+=13)if(z<-145||z>-58){marks.push([-5.8,.027,z,.2,.018,6],[5.8,.027,z,.2,.018,6]);}
  for(let x=-145;x<150;x+=16)marks.push([x,.027,32,6,.018,.18]);
  for(let z=-165;z<80;z+=13)marks.push([LOOP.x,.027,z,.17,.018,6]);
  for(let x=-9;x<=9;x+=3)marks.push([x,.027,61,1.5,.018,11]);
  marks.push([-11,.027,-90,.18,.018,470],[11,.027,-90,.18,.018,470]);instancedBoxes(scene,marks,lineMat);
  // A wedge launch ramp, with bright edge stripes visible from the air.
  const rampGeo=new T.BufferGeometry();const v=[-8,0,-62,8,0,-62,-8,7.6,-82,8,7.6,-82,-8,0,-82,8,0,-82];rampGeo.setAttribute('position',new T.Float32BufferAttribute(v,3));rampGeo.setIndex([0,2,1,1,2,3,0,4,2,1,3,5,2,4,3,3,4,5]);rampGeo.computeVertexNormals();mesh(rampGeo,mat(0x454652,.7,.1),scene);
  for(const x of [-7.8,7.8])line(scene,[[x,.06,-62],[x,7.67,-82]],0xc6a4ff);
  for(let j=0;j<4;j++){line(scene,[[-3,.05+j*1.45,-62-j*3.8],[0,.05+j*1.45,-65-j*3.8],[3,.05+j*1.45,-62-j*3.8]],0xc6a4ff);}
  PARKED.forEach((z,i)=>{const c=makeCar([0xdce2e8,0x244653,0x672b37,0xaab0b5,0x333942][i],true);c.position.set(0,0,z);c.rotation.y=Math.PI/2;scene.add(c);});
  // Full suction loop: the inside surface is actually followed by the simulation.
  const loopMat=mat(0x404858,.6,.2);loopMat.side=T.DoubleSide;
  const surf=mesh(new T.CylinderGeometry(LOOP.r,LOOP.r,LOOP.width,96,1,true),loopMat,scene,LOOP.x,LOOP.r,LOOP.z);surf.rotation.z=Math.PI/2;
  for(const x of [LOOP.x-6.1,LOOP.x+6.1]){const rail=mesh(new T.TorusGeometry(LOOP.r+.1,.16,6,96),glow(0xc8a3ff),scene,x,LOOP.r,LOOP.z);rail.rotation.y=Math.PI/2;}
  for(const x of [LOOP.x-6.5,LOOP.x+6.5])box(scene,.4,22,.4,metal,x,11,LOOP.z);
  const loopLabel=makeLabel('SUCTION LOOP  /  APPROACH FROM SOUTH','#d9c4ff');loopLabel.position.set(LOOP.x,45,LOOP.z);loopLabel.scale.set(29,5.5,1);scene.add(loopLabel);
  const rampLabel=makeLabel('LAUNCH  /  HOLD SPACE','#e2d3ff');rampLabel.position.set(0,13,-80);rampLabel.scale.set(19,3.6,1);scene.add(rampLabel);
  // Floodlights, cones, hangars, antennae and a distant launch vehicle.
  const lampPosts=[],lampHeads=[],coneMat=mat(0xd97640),coneBase=mat(0x333842);
  for(let z=-240;z<100;z+=42)for(const x of [-18,18]){lampPosts.push([x,3.9,z,.13,7.8,.13]);lampHeads.push([x,7.9,z,1.5,.14,.4]);}
  instancedBoxes(scene,lampPosts,metal);instancedBoxes(scene,lampHeads,glow(0xffe8c8));
  for(let z=-57;z>-142;z-=12)for(const x of [-9,9]){mesh(new T.ConeGeometry(.32,.85,8),coneMat,scene,x,.43,z);box(scene,.6,.07,.6,coneBase,x,.035,z);}
  const hangar=mat(0x87949c,.65,.2),door=mat(0x344550,.8,.1);
  for(let z=-190;z<=-80;z+=55){box(scene,40,14,35,hangar,155,7,z);box(scene,.12,11,26,door,134.9,5.5,z);for(let y=1;y<11;y+=1)box(scene,.14,.04,26,metal,134.8,y,z);box(scene,43,.35,38,metal,155,14.1,z);for(let j=0;j<7;j++)box(scene,1.1,2,.08,glow(0xb0b8c8),141+j*4,10.5,z+17.6);}
  const word=makeLabel('FLIGHT OPERATIONS','#d2dce4');word.scale.set(30,5.6,1);word.position.set(140,21,-132);scene.add(word);
  for(let i=0;i<3;i++){mesh(new T.CylinderGeometry(5,5,16+i*3,20),mat(0xb3b8bc,.4,.45),scene,197,8+i*1.5,-185+i*27);}
  box(scene,5,49,5,mat(0x4c5968,.6,.4),-180,24.5,-260);
  for(let y=6;y<47;y+=8)box(scene,8,.4,8,metal,-180,y,-260);
  mesh(new T.CylinderGeometry(2.9,2.9,31,24),mat(0xbcc8d3,.3,.7),scene,-166,15.5,-260);
  mesh(new T.ConeGeometry(2.9,9,24),white,scene,-166,35.5,-260);
  const rand=seeded(61);const shrubs=mat(0x5f625a,.9),rockMat=mat(0x777774,.95),mountainMat=mat(0x78828f,.98);
  for(let i=0;i<95;i++){
    const a=rand()*Math.PI*2,r=220+rand()*450,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(x>110&&x<215&&z<5&&z>-230)continue;
    const s=1+rand()*4;
    const rock=mesh(new T.DodecahedronGeometry(s,0),rand()>.5?shrubs:rockMat,scene,x,s*.25,z);rock.scale.set(1,.4+rand()*.5,1);rock.rotation.set(rand(),rand(),rand());rock.castShadow=false;
  }
  for(let i=0;i<40;i++){const a=i/40*Math.PI*2,r=720+rand()*160,h=45+rand()*150;const m=mesh(new T.ConeGeometry(70+rand()*110,h,5),mountainMat,scene,Math.sin(a)*r,h*.34-4,Math.cos(a)*r);m.rotation.y=rand()*6;m.scale.z=.7;m.castShadow=false;}
  const routeGeometry=new T.BufferGeometry();
  const route=new T.Line(routeGeometry,new T.LineDashedMaterial({color:0xc4a7ff,transparent:true,opacity:.35,dashSize:3,gapSize:3,depthWrite:false}));scene.add(route);route.visible=false;
  function setRoute(index){route.geometry.dispose();route.geometry=new T.BufferGeometry().setFromPoints(GATES.slice(index,index+3).map(p=>new T.Vector3(...p)));route.computeLineDistances();}
  const gateGroup=new T.Group();scene.add(gateGroup);const gates=GATES.map((p,i)=>{
    const g=new T.Group();g.position.set(...p);const prev=i?GATES[i-1]:[0,4,42];g.lookAt(p[0]+p[0]-prev[0],p[1],p[2]+p[2]-prev[2]);
    const ring=mesh(new T.TorusGeometry(7.5,.13,8,64),glow(0xc0b4fa),g);ring.castShadow=false;
    const outer=mesh(new T.TorusGeometry(7.82,.035,4,64),new T.MeshBasicMaterial({color:0xb8a1e0,transparent:true,opacity:.45}),g);outer.castShadow=false;
    const number=makeLabel(String(i+1).padStart(2,'0'),'#ebffd1',128,64);number.scale.set(3,1.5,1);number.position.y=9.5;g.add(number);
    gateGroup.add(g);return {group:g,ring,outer,number};
  });
  const car=makeCar();scene.add(car);
  // A translucent contact shadow keeps the flying car legible above the terrain.
  const sc=document.createElement('canvas');sc.width=sc.height=128;const ctx=sc.getContext('2d'),grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(8,15,28,0.5)');grad.addColorStop(.5,'rgba(8,15,28,0.3)');grad.addColorStop(1,'rgba(8,15,28,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const shadow=mesh(new T.PlaneGeometry(6,9),new T.MeshBasicMaterial({map:new T.CanvasTexture(sc),transparent:true,depthWrite:false}),scene);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;shadow.receiveShadow=false;
  // Cold-gas plumes: white vapor, deliberately not rocket flames.
  const particleCount=320,particlePositions=new Float32Array(particleCount*3),particleColors=new Float32Array(particleCount*3),particles=[];
  for(let i=0;i<particleCount;i++){particles.push({life:0,v:new T.Vector3()});particlePositions[i*3+1]=-999;}
  const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(particlePositions,3));pg.setAttribute('color',new T.BufferAttribute(particleColors,3));
  const pc=document.createElement('canvas');pc.width=pc.height=32;const pctx=pc.getContext('2d'),gr=pctx.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'rgba(255,255,255,.7)');gr.addColorStop(.3,'rgba(255,255,255,.4)');gr.addColorStop(1,'rgba(255,255,255,0)');pctx.fillStyle=gr;pctx.fillRect(0,0,32,32);
  const points=new T.Points(pg,new T.PointsMaterial({size:1.3,map:new T.CanvasTexture(pc),vertexColors:true,transparent:true,depthWrite:false,opacity:.65}));points.frustumCulled=false;scene.add(points);
  let cursor=0;
  function emit(at,velocity,color=0xcde9ff){const id=cursor++%particleCount;const p=particles[id];p.life=.45+Math.random()*.5;p.v.copy(velocity);particlePositions.set([at.x,at.y,at.z],id*3);const col=new T.Color(color);particleColors.set([col.r,col.g,col.b],id*3);}
  function updateParticles(dt){for(let i=0;i<particleCount;i++){const p=particles[i];if(p.life<=0)continue;p.life-=dt;particlePositions[i*3]+=p.v.x*dt;particlePositions[i*3+1]+=p.v.y*dt;particlePositions[i*3+2]+=p.v.z*dt;p.v.multiplyScalar(1-dt*.8);if(p.life<=0)particlePositions[i*3+1]=-999;}pg.attributes.position.needsUpdate=true;pg.attributes.color.needsUpdate=true;}
  function setQuality(level){
    const cap=level==='low'?1:level==='high'?2:1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,cap));renderer.setSize(innerWidth,innerHeight);
    renderer.shadowMap.enabled=level!=='low';
    const size=level==='high'?2048:1024;
    if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null;}
    scene.traverse(obj=>{if(obj.material){for(const m of (Array.isArray(obj.material)?obj.material:[obj.material]))m.needsUpdate=true;}});
  }
  return {T,scene,renderer,camera,car,gates,gateGroup,sun,shadow,emit,updateParticles,route,setRoute,setQuality};
}
