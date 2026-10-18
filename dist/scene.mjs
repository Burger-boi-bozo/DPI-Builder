import * as T from './three.module.min.js';
import {buildVehicle} from './vehicle.mjs?v=1.2.2';
import {GATES,OBSTACLES,surfaceAt,terrainHeight} from './physics.mjs?v=1.2.2';
import {RGBELoader} from './RGBELoader.mjs';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function random(seed=1257){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
const rand=random();
function texture(size,draw){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
function asphaltTexture(){return texture(1024,(c,n)=>{c.fillStyle='#55595c';c.fillRect(0,0,n,n);const data=c.getImageData(0,0,n,n);for(let i=0;i<data.data.length;i+=4){const noise=rand()*30-15;data.data[i]+=noise;data.data[i+1]+=noise;data.data[i+2]+=noise;}c.putImageData(data,0,0);c.strokeStyle='rgba(20,23,25,.22)';c.lineWidth=1.4;for(let i=0;i<23;i++){c.beginPath();let x=rand()*n,y=rand()*n;c.moveTo(x,y);for(let j=0;j<7;j++){x+=rand()*45-22;y+=rand()*50;c.lineTo(x,y);}c.stroke();}});}
export async function createScene(container,settings){
  const scene=new T.Scene();scene.background=new T.Color(0xb3c2cd);scene.fog=new T.FogExp2(0xb4c4ce,.00065);
  let renderer;try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{renderer=new T.WebGLRenderer({antialias:false,alpha:false,powerPreference:'default'});}renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;container.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(52,1,.07,4000);camera.position.set(6,3.5,34);
  const hemi=new T.HemisphereLight(0xcee2ff,0x726a57,1.15);scene.add(hemi);
  const sun=new T.DirectionalLight(0xffeddb,3.4);sun.position.set(-80,120,-60);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.near=1;sun.shadow.camera.far=320;sun.shadow.camera.left=-36;sun.shadow.camera.right=36;sun.shadow.camera.top=36;sun.shadow.camera.bottom=-36;sun.shadow.normalBias=.018;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
  const mat=(color,roughness=.85,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
  const mesh=(geo,material,pos,cast=false,parent=scene)=>{const m=new T.Mesh(geo,material);if(pos)m.position.set(...pos);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;};
  const box=(size,pos,m,cast=false,parent=scene)=>mesh(new T.BoxGeometry(...size),m,pos,cast,parent);
  const roadTex=asphaltTexture();roadTex.wrapS=roadTex.wrapT=T.RepeatWrapping;roadTex.repeat.set(1000,1000);roadTex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const concrete=mat(0x96958e),asphalt=new T.MeshStandardMaterial({map:roadTex,color:0x868b90,roughness:.94,bumpMap:roadTex,bumpScale:.018});
  const landTex=texture(512,(c,n)=>{c.fillStyle='#87856c';c.fillRect(0,0,n,n);for(let i=0;i<35000;i++){let l=rand()*45+65;c.fillStyle=`rgba(${l+17},${l+14},${l},.25)`;c.fillRect(rand()*n,rand()*n,rand()*8+1,rand()*8+1);}});landTex.wrapS=landTex.wrapT=T.RepeatWrapping;landTex.repeat.set(180,180);landTex.anisotropy=8;
  const land=mesh(new T.PlaneGeometry(5000,5000),new T.MeshStandardMaterial({map:landTex,roughness:1}),[0,-.045,0]);land.rotation.x=-Math.PI/2;
  // A single tiled runway plus a connected high-speed circular handling track.
  const road=mesh(new T.PlaneGeometry(38,1400),asphalt,[0,.001,-240]);road.rotation.x=-Math.PI/2;road.geometry.attributes.uv.array.forEach((_,i,a)=>a[i]*=i%2?1400/5000:38/5000);
  const ringGeo=new T.RingGeometry(178,204,256,1);const ringUV=ringGeo.attributes.uv;for(let i=0;i<ringUV.count;i++){ringUV.setXY(i,ringGeo.attributes.position.getX(i)/5000+.5,ringGeo.attributes.position.getY(i)/5000+.5);}ringUV.needsUpdate=true;const track=mesh(ringGeo,asphalt,[0,.008,-190]);track.rotation.x=-Math.PI/2;
  const apron=mesh(new T.PlaneGeometry(260,105),asphalt,[-38,.005,25]);apron.rotation.x=-Math.PI/2;const apuv=apron.geometry.attributes.uv;for(let i=0;i<apuv.count;i++)apuv.setXY(i,apuv.getX(i)*260/5000,apuv.getY(i)*105/5000);
  const lineMat=mat(0xdad9cc),yellow=mat(0xc5a862),dark=mat(0x151a20,.73),metal=mat(0x8e969e,.47,.7),purple=mat(0x8e75b9,.5);
  const mark=(w,d,x,z,m=lineMat)=>box([w,.006,d],[x,.018,z],m);
  for(let i=0;i<68;i++)mark(.25,7,0,90-i*15);
  for(const x of [-17.5,17.5])mark(.14,1380,x,-240);
  for(let i=0;i<6;i++)for(const side of [-1,1])mark(.8,19,side*(3+i*1.7),67);
  for(const radius of [179,203]){const m=mesh(new T.RingGeometry(radius,radius+.14,256),lineMat,[0,.019,-190]);m.rotation.x=-Math.PI/2;}
  const pad=mesh(new T.RingGeometry(8.5,8.6,64),purple,[0,.025,42]);pad.rotation.x=-Math.PI/2;mark(17,.1,0,50,purple);mark(17,.1,0,34,purple);
  function label(text,x,y,z,w=12,h=3,color='#e4e5df',rotation=0){const tex=texture(512,(c,n)=>{c.fillStyle=color;c.font='bold 78px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,n/2,n/2,n-28);});const m=mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:T.DoubleSide}),[x,y,z]);m.rotation.y=rotation;return m;}
  let padLabel=label('AIR SERVICE',0,.03,54,10,2.5,'#b39bcf');padLabel.rotation.x=-Math.PI/2;
  const runwayLabel=label('09',0,.03,84,12,8);runwayLabel.rotation.x=-Math.PI/2;
  // Weathered braking-zone rubber, concrete joints, and edge lights.
  const rubberTex=texture(256,(c,n)=>{c.fillStyle='rgba(0,0,0,0)';c.fillRect(0,0,n,n);for(let i=0;i<180;i++){c.strokeStyle=`rgba(10,12,14,${rand()*.03})`;c.lineWidth=rand()*3+1;c.beginPath();let x=rand()*n;c.moveTo(x,0);c.lineTo(x+rand()*4,n);c.stroke();}});const rubberMat=new T.MeshBasicMaterial({map:rubberTex,transparent:true,depthWrite:false,opacity:.5});
  for(const x of [-.9,.9,-4,4]){const m=mesh(new T.PlaneGeometry(.38,130),rubberMat,[x,.028,-30-rand()*90]);m.rotation.x=-Math.PI/2;}
  const lightMat=new T.MeshStandardMaterial({color:0xb1d3ff,emissive:0x7399cf,emissiveIntensity:1});
  const lights=new T.InstancedMesh(new T.CylinderGeometry(.09,.15,.2,6),lightMat,160),dummy=new T.Object3D();scene.add(lights);
  for(let i=0;i<160;i++){dummy.position.set((i%2?1:-1)*19.2,.1,120-Math.floor(i/2)*16);dummy.updateMatrix();lights.setMatrixAt(i,dummy.matrix);}
  // Industrial test facility: corrugated hangars, inset doors, roof ridges and apron markings.
  for(let index=0;index<OBSTACLES.length;index++){const b=OBSTACLES[index];box([b.w,b.h,b.d],[b.x,b.h/2,b.z],mat(index===2?0x626c70:0x8a8d87),true);box([b.w+.6,.4,b.d+1],[b.x,b.h+.2,b.z],metal,true);
    for(let k=0;k<3;k++){let x=b.x+(k-1)*b.w*.29;box([b.w*.25,b.h*.67,.13],[x,b.h*.34,b.z+b.d/2+.08],dark);for(let j=0;j<10;j++)box([b.w*.25,.04,.15],[x,1+j*.75,b.z+b.d/2+.14],metal);}
    const ridges=new T.InstancedMesh(new T.BoxGeometry(.06,b.h,.035),metal,Math.floor(b.w*2)),d=new T.Object3D();scene.add(ridges);for(let j=0;j<ridges.count;j++){d.position.set(b.x-b.w/2+j*.5,b.h/2,b.z+b.d/2+.03);d.updateMatrix();ridges.setMatrixAt(j,d.matrix);}
    label(index===2?'CONTROL / 03':`FLIGHT OPERATIONS / 0${index+1}`,b.x,b.h-1.6,b.z+b.d/2+.21,b.w*.75,2);for(let j=0;j<8;j++)mark(.08,9,b.x-b.w/2+j*5,b.z+b.d/2+7,yellow);
  }
  // Service gantries and safety barriers.
  for(const x of [-27,27]){box([.18,8,.18],[x,4,30],metal,true);box([5,.16,.18],[x+(x<0?2:-2),8,30],metal,true);box([1,.1,.6],[x+(x<0?4:-4),7.9,30],lightMat);}
  for(let i=0;i<22;i++){const z=70-i*7;box([.35,.7,5.5],[-68,.35,z],concrete,true);box([.37,.15,2],[-68,.5,z],i%2?purple:lineMat);}
  const coneGeo=new T.ConeGeometry(.22,.7,12),coneMat=mat(0xc37140);const cones=new T.InstancedMesh(coneGeo,coneMat,64);scene.add(cones);for(let i=0;i<64;i++){const a=i/64*Math.PI*2;dummy.position.set(Math.sin(a)*176,.35,-190+Math.cos(a)*176);dummy.updateMatrix();cones.setMatrixAt(i,dummy.matrix);}
  // Smoothly rising launch ramp, exactly matching physics.surfaceAt.
  const rampGeo=new T.PlaneGeometry(16,40,4,50);rampGeo.rotateX(-Math.PI/2);const rp=rampGeo.attributes.position;for(let i=0;i<rp.count;i++){const x=46+rp.getX(i),z=-170+rp.getZ(i);rp.setXYZ(i,x,surfaceAt(Math.min(53.99,Math.max(38.01,x)),Math.min(-150.001,Math.max(-189.999,z))).height+.014,z);}rampGeo.computeVertexNormals();mesh(rampGeo,concrete);
  for(const x of [38,54]){const curve=new T.CatmullRomCurve3(Array.from({length:21},(_,i)=>V(x,6*(i/20)**2+.1,-150-i*2)));mesh(new T.TubeGeometry(curve,40,.065,6,false),yellow);}
  label('LAUNCH  →',30,1.8,-145,8,1.5,'#c7b4e9',Math.PI);
  // Low rolling ridges, with no artificial mountain cones.
  const terrain=new T.PlaneGeometry(4200,4200,160,160);terrain.rotateX(-Math.PI/2);const tp=terrain.attributes.position,colors=[];
  for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getZ(i),h=terrainHeight(x,z)||-7;tp.setY(i,h);const c=new T.Color(0x878878).lerp(new T.Color(0xb4b4a0),clamp01(h/140));colors.push(c.r,c.g,c.b);}terrain.setAttribute('color',new T.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();mesh(terrain,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));
  const shrubs=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),mat(0x6b7259),1900);scene.add(shrubs);let count=0;while(count<1900){const x=(rand()-.5)*1500,z=(rand()-.5)*1600-180;if(Math.abs(x)<30||Math.hypot(x,z+190)<215||OBSTACLES.some(b=>Math.abs(x-b.x)<b.w/2+15&&Math.abs(z-b.z)<b.d/2+15))continue;const k=.18+rand()*.6;dummy.position.set(x,k*.25,z);dummy.scale.set(k,k*.45,k*.8);dummy.rotation.y=rand()*6.28;dummy.updateMatrix();shrubs.setMatrixAt(count++,dummy.matrix);}dummy.scale.set(1,1,1);
  // Batch immutable opaque scenery by material. Keep dynamic and instanced objects separate.
  scene.updateMatrixWorld(true);
  const batches=new Map();
  scene.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.material.transparent)return;
    const attributes=Object.keys(o.geometry.attributes).sort().join(',');
    const key=[o.material.uuid,o.castShadow,o.receiveShadow,attributes].join('|');
    if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);
  });
  for(const objects of batches.values()){
    if(objects.length<2)continue;
    const parts=objects.map(o=>{const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!g.index)return g;const flat=g.toNonIndexed();g.dispose();return flat;}),merged=new T.BufferGeometry();
    for(const name of Object.keys(parts[0].attributes)){
      const attributes=parts.map(g=>g.attributes[name]),data=new Float32Array(attributes.reduce((n,a)=>n+a.array.length,0));let offset=0;
      for(const a of attributes){data.set(a.array,offset);offset+=a.array.length;}
      merged.setAttribute(name,new T.BufferAttribute(data,attributes[0].itemSize,attributes[0].normalized));
    }
    const combined=mesh(merged,objects[0].material,null,objects[0].castShadow);combined.receiveShadow=objects[0].receiveShadow;
    for(const o of objects){o.parent.remove(o);o.geometry.dispose();}for(const p of parts)p.dispose();
    merged.computeBoundingSphere();
  }
  // Flight gates stay thin and readable; the geometry does not block the runway.
  const gates=[];for(let i=0;i<GATES.length;i++){const g=GATES[i],previous=i?GATES[i-1]:[0,3,42],group=new T.Group();group.position.set(...g);group.rotation.y=Math.atan2(g[0]-previous[0],g[2]-previous[2]);scene.add(group);const ring=mesh(new T.TorusGeometry(6.8,.055,6,80),new T.MeshStandardMaterial({color:0xb3a0da,emissive:0x60408d,emissiveIntensity:.8}),null,false,group);const tick=mesh(new T.TorusGeometry(6.9,.12,6,30,Math.PI*.35),new T.MeshBasicMaterial({color:0xb8a0f0}),null,false,group);tick.rotation.z=Math.PI*.325;gates.push({group,ring,tick});}
  const car=buildVehicle();scene.add(car.root);
  const groundShadow=texture(128,(c,n)=>{const g=c.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(.5,'rgba(0,0,0,.32)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,n,n);});
  const contactShadow=mesh(new T.PlaneGeometry(3.5,5.6),new T.MeshBasicMaterial({map:groundShadow,transparent:true,depthWrite:false,opacity:.65}));contactShadow.rotation.x=-Math.PI/2;
  let environment=null,sky=null;
  try{sky=await new RGBELoader().loadAsync('./assets/sky.hdr');sky.mapping=T.EquirectangularReflectionMapping;const pmrem=new T.PMREMGenerator(renderer);environment=pmrem.fromEquirectangular(sky);scene.environment=environment.texture;scene.background=sky;scene.backgroundIntensity=.8;scene.backgroundBlurriness=0;pmrem.dispose();}catch{const e=new T.Scene();e.background=new T.Color(0xacc4dc);e.add(new T.HemisphereLight(0xddeaff,0x9b8d75,3));const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshBasicMaterial({color:0x777768}));floor.rotation.x=-Math.PI/2;floor.position.y=-3;e.add(floor);const pm=new T.PMREMGenerator(renderer);environment=pm.fromScene(e,.05);scene.environment=environment.texture;pm.dispose();}
  // A fixed pool of soft billboards simulates expanding cold-gas plumes and tire dust.
  const CAP=720,positions=new Float32Array(CAP*3),sizes=new Float32Array(CAP),alphas=new Float32Array(CAP),pcolors=new Float32Array(CAP*3),particles=Array.from({length:CAP},()=>({life:0,max:1,p:V(),v:V(),size:1,type:0}));
  const pgeo=new T.BufferGeometry();pgeo.setAttribute('position',new T.BufferAttribute(positions,3));pgeo.setAttribute('size',new T.BufferAttribute(sizes,1));pgeo.setAttribute('alpha',new T.BufferAttribute(alphas,1));pgeo.setAttribute('pcolor',new T.BufferAttribute(pcolors,3));
  const pmat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{pixelScale:{value:650}},vertexShader:'attribute float size; attribute float alpha; attribute vec3 pcolor; varying float a; varying vec3 c; uniform float pixelScale; void main(){vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=min(170.,size*pixelScale/max(1.,-p.z));a=alpha;c=pcolor;}',fragmentShader:'varying float a; varying vec3 c; void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(c,a*pow(1.-r*r,2.));}'});const points=new T.Points(pgeo,pmat);points.frustumCulled=false;scene.add(points);let cursor=0,emission=0;
  const emit=(position,velocity,type=0)=>{const p=particles[cursor++%CAP];p.life=p.max=type?1.7:1.1+rand()*.7;p.p.copy(position);p.v.copy(velocity);p.size=type?.3:.15;p.type=type;};
  // Fixed-size skid-mark pool: new segments appear only while a loaded tire slips.
  const skidMax=1800,skidPos=new Float32Array(skidMax*18),skidGeo=new T.BufferGeometry();skidGeo.setAttribute('position',new T.BufferAttribute(skidPos,3));const skidMesh=mesh(skidGeo,new T.MeshBasicMaterial({color:0x15181a,transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide}));skidMesh.frustumCulled=false;let skidCursor=0;const lastSkids=[null,null,null,null];
  let quality='balanced',timeOfDay='day',cameraMode=0,photo=false,orbitYaw=.8,orbitPitch=.20,orbitDistance=7,orbitDrag=null;
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{if(photo){orbitDrag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);}});canvas.addEventListener('pointermove',e=>{if(orbitDrag&&photo){orbitYaw-=(e.clientX-orbitDrag[0])*.006;orbitPitch=T.MathUtils.clamp(orbitPitch+(e.clientY-orbitDrag[1])*.004,-.05,1.3);orbitDrag=[e.clientX,e.clientY];}});canvas.addEventListener('pointerup',()=>orbitDrag=null);canvas.addEventListener('wheel',e=>{if(photo){orbitDistance=T.MathUtils.clamp(orbitDistance+e.deltaY*.008,3,24);e.preventDefault();}},{passive:false});
  function setQuality(value){quality=value;renderer.setPixelRatio(Math.min(devicePixelRatio,value==='ultra'?2:value==='balanced'?1.5:1));renderer.shadowMap.enabled=value!=='performance';const n=value==='ultra'?4096:2048;if(sun.shadow.mapSize.x!==n){sun.shadow.mapSize.set(n,n);sun.shadow.map?.dispose();sun.shadow.map=null;}resize();}
  function setWeather(value){timeOfDay=value;const golden=value==='golden';sun.color.set(golden?0xffc28c:0xffeddb);sun.intensity=value==='overcast'?1.15:3.4;hemi.intensity=value==='overcast'?1.8:1.15;renderer.toneMappingExposure=golden?.95:1.05;scene.fog.color.set(golden?0xc6b7a5:0xb4c4ce);scene.backgroundIntensity=golden?.55:.8;scene.environmentIntensity=golden?.75:1;}
  function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();pmat.uniforms.pixelScale.value=h*renderer.getPixelRatio()*.8;}
  addEventListener('resize',resize);setQuality(settings.quality);setWeather(settings.weather);
  function update(s,input,dt,mode='play',elapsed=0){
    car.update(s,input.brake||input.handbrake);const cockpit=cameraMode===1&&mode!=='menu'&&!photo;car.glass.opacity=cockpit?.18:.84;car.glass.envMapIntensity=cockpit?.45:1.7;const golden=timeOfDay==='golden';sun.position.copy(s.p).add(V(-85,golden?45:120,-65));sun.target.position.copy(s.p);sun.target.updateMatrixWorld();
    contactShadow.position.set(s.p.x,surfaceAt(s.p.x,s.p.z).height+.024,s.p.z);contactShadow.rotation.z=-s.yaw;contactShadow.material.opacity=.55*Math.max(0,1-s.altitude/7);
    for(let i=0;i<gates.length;i++){const g=gates[i];g.group.visible=s.mode==='trial'&&i>=s.gate;g.ring.material.emissiveIntensity=i===s.gate?2:.2;g.tick.material.opacity=i===s.gate?1:.35;g.tick.rotation.z=Math.PI*.325+elapsed*.12;}
    emission+=dt*75;while(emission>=1){emission--;if(s.lifting>.02)for(const x of [-.83,.83]){const local=V(x,-.35,Math.random()<.5?-1.35:1.35);const pos=local.applyQuaternion(s.q).add(s.p),vel=V((rand()-.5)*1.5,-12*s.lifting,(rand()-.5)*1.5).applyQuaternion(s.q).add(s.v);emit(pos,vel);}
      if(s.boosting)for(const x of [-.6,.6])emit(V(x,-.12,2.31).applyQuaternion(s.q).add(s.p),V((rand()-.5)*2,(rand()-.5)*2,20).applyQuaternion(s.q).add(s.v));
      if(s.grounded&&s.speed>5&&(s.surface==='GRAVEL'||s.slip>.22))for(const w of s.wheels)if(w.load>500)emit(w.point.clone().add(V(0,.08,0)),s.v.clone().multiplyScalar(.1).add(V((rand()-.5)*2,1.5,0)),1);
    }
    for(let i=0;i<CAP;i++){const p=particles[i];if(p.life>0){p.life-=dt;p.p.addScaledVector(p.v,dt);p.v.multiplyScalar(Math.exp(-1.6*dt));if(p.p.y<.12){p.p.y=.12;p.v.y=Math.abs(p.v.y)*.12;p.v.x+=dt*(rand()-.5)*10;}p.size+=dt*(p.type?1.5:2.4);positions.set(p.p.toArray(),i*3);sizes[i]=p.size;alphas[i]=Math.max(0,p.life/p.max)*(p.type?.22:.40);pcolors.set(p.type?[.58,.54,.44]:[.88,.91,.94],i*3);}else alphas[i]=0;}
    for(const name of ['position','size','alpha','pcolor'])pgeo.attributes[name].needsUpdate=true;
    if(dt>0)for(let i=0;i<4;i++){const w=s.wheels[i];if(w.contact&&w.slip>.17&&s.speed>4&&s.surface==='ASPHALT'){const p=w.point.clone();p.y=.032;const old=lastSkids[i];if(old&&p.distanceTo(old)>.08&&p.distanceTo(old)<2){const side=V(.105,0,0).applyAxisAngle(V(0,1,0),s.yaw+w.angle),a=old.clone().sub(side),b=old.clone().add(side),c=p.clone().sub(side),d=p.clone().add(side);skidPos.set([...a.toArray(),...b.toArray(),...c.toArray(),...b.toArray(),...d.toArray(),...c.toArray()],skidCursor++%skidMax*18);skidGeo.attributes.position.needsUpdate=true;lastSkids[i]=p;}else if(!old||p.distanceTo(old)>2)lastSkids[i]=p;}else lastSkids[i]=null;}
    let desired,target;
    if(mode==='menu'){const a=-.75+Math.sin(elapsed*.06)*.18;const portrait=camera.aspect<.8;desired=s.p.clone().add(V(Math.sin(a)*(portrait?11:9.5),portrait?2.9:2.25,-Math.cos(a)*(portrait?11:9.5)));target=s.p.clone().add(V(portrait?.05:1.8,portrait?1.2:-.45,.35));camera.fov=portrait?55:39;}
    else if(photo||cameraMode===3){desired=s.p.clone().add(V(Math.sin(orbitYaw)*Math.cos(orbitPitch)*orbitDistance,Math.sin(orbitPitch)*orbitDistance+.5,Math.cos(orbitYaw)*Math.cos(orbitPitch)*orbitDistance));target=s.p.clone().add(V(0,.15,0));camera.fov=45;}
    else if(cameraMode===1){desired=V(-.39,.48,.12).applyQuaternion(s.q).add(s.p);target=V(-.39,.39,-50).applyQuaternion(s.q).add(s.p);camera.fov=80;}
    else if(cameraMode===2){desired=V(0,.46,-1.3).applyQuaternion(s.q).add(s.p);target=V(0,.5,-50).applyQuaternion(s.q).add(s.p);camera.fov=70;}
    else{const yaw=new T.Quaternion().setFromAxisAngle(V(0,1,0),s.yaw);desired=V(0,2.25,6.8+s.speed*.012).applyQuaternion(yaw).add(s.p);target=V(0,.45,-4.8).applyQuaternion(yaw).add(s.p);camera.fov=61+(settings.motion?Math.min(8,s.speed*.08):0);}
    if(mode==='menu'||cameraMode===1||cameraMode===2||photo||dt===0)camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-dt*6));
    if(cameraMode===1||cameraMode===2)camera.up.copy(V(0,1,0).applyQuaternion(s.q));else camera.up.set(0,1,0);
    camera.position.y=Math.max(.12,camera.position.y);camera.lookAt(target);camera.updateProjectionMatrix();renderer.render(scene,camera);
  }
  function project(position){const p=V(...position).project(camera);return {x:(p.x*.5+.5)*container.clientWidth,y:(-.5*p.y+.5)*container.clientHeight,visible:p.z<1&&p.z>0&&Math.abs(p.x)<.95&&Math.abs(p.y)<.85};}
  return {renderer,scene,camera,car,update,resize,setQuality,setWeather,project,setCamera:n=>{cameraMode=n;},setPhoto:v=>{photo=v;},setPaint:v=>car.paint.color.set(v),stats:()=>renderer.info.render};
}
const clamp01=x=>Math.max(0,Math.min(1,x));
