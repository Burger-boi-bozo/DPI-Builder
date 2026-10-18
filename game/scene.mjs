import {PROVING_ROUTES,SLALOM_PYLONS,WET_PATCH} from './range.mjs';
import {surfaceAt} from './suspension.mjs';
import * as T from './three.module.min.js';
import {GATES,LOOP,PARKED} from './physics.mjs';
import {RESEARCH_STAGES} from './research.mjs';

const mat=(color,roughness=.65,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const rubber=mat(0x10151c,.9),metal=mat(0x8c97a5,.23,.85),dark=mat(0x111b27,.35,.5);
const white=new T.MeshPhysicalMaterial({color:0xe8edf2,metalness:.55,roughness:.24,clearcoat:1,clearcoatRoughness:.08}),glass=new T.MeshPhysicalMaterial({color:0x0b1b27,metalness:.48,roughness:.095,clearcoat:1,transparent:true,opacity:.74,depthWrite:false}),paint=mat(0xb9c8d6,.3,.5);
const glow=(color)=>new T.MeshBasicMaterial({color});
function mesh(geo,material,parent,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,w,h,d,material,x=0,y=0,z=0){return mesh(new T.BoxGeometry(w,h,d),material,parent,x,y,z);}
function sections(parent,items,bottom,material){
  const vertices=[],indices=[];
  // Cubic subdivision removes the faceted silhouette of the original
  // five-station blockout without a heavy imported mesh.
  const smooth=[];
  for(let j=0;j<items.length-1;j++)for(let k=0;k<5;k++){
    const t=k/5,a=items[Math.max(0,j-1)],b=items[j],c=items[j+1],d=items[Math.min(items.length-1,j+2)];
    const interp=n=>{const m0=(c[n]-a[n])*.5,m1=(d[n]-b[n])*.5;return (2*t*t*t-3*t*t+1)*b[n]+(t*t*t-2*t*t+t)*m0+(-2*t*t*t+3*t*t)*c[n]+(t*t*t-t*t)*m1;};
    smooth.push([interp(0),Math.max(.1,interp(1)),interp(2)]);
  }
  smooth.push(items.at(-1));
  for(const [z,w,h] of smooth)vertices.push(-w,bottom,z,w,bottom,z,w,h,z,-w,h,z);
  for(let i=0;i<smooth.length-1;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=b+4,d=a+4;indices.push(a,b,d,b,c,d);}
  indices.push(0,3,1,1,3,2);const n=smooth.length*4-4;indices.push(n,n+1,n+3,n+1,n+2,n+3);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return mesh(geo,material,parent);
}
function line(parent,points,color=0xbda2f3){const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));const l=new T.Line(g,new T.LineBasicMaterial({color}));parent.add(l);return l;}
export function makeCar(color=0xdfe6ea,simple=false){
  const group=new T.Group(),body=new T.Group();group.add(body);const shell=color===0xdfe6ea?white:new T.MeshPhysicalMaterial({color,metalness:.54,roughness:.25,clearcoat:1});
  sections(body,[[-2.36,.92,.59],[-2.04,1.09,.80],[-.6,1.12,.88],[1.48,1.15,.92],[2.22,1.06,.82]],.34,shell);
  sections(body,[[-.86,.91,.9],[-.2,.76,1.51],[.68,.75,1.51],[1.29,.96,.93]],.86,glass);
  sections(body,[[-.20,.77,1.53],[.6,.77,1.53]],1.50,shell);
  // Interior is modeled beneath the glazing, with identifiable seat bolsters,
  // console, steering wheel and an instrument binnacle.
  const cabin=new T.Group();body.add(cabin);
  const upholstery=mat(0x202b33,.87,.02),leather=mat(0x111820,.89,.02),stitch=mat(0x536371,.91),screen=glow(0x6a8794);
  box(cabin,1.56,.12,1.74,leather,0,.85,.12);
  for(const side of [-1,1]){
    const seat=new T.Group();seat.position.set(side*.42,.90,.35);cabin.add(seat);
    box(seat,.58,.14,.63,upholstery,0,0,.11);
    const back=box(seat,.57,.80,.13,upholstery,0,.42,.41);back.rotation.x=-.18;
    for(const edge of [-.245,.245])box(seat,.08,.56,.17,leather,edge,.34,.38);
    box(seat,.26,.07,.12,stitch,0,.71,.44);
  }
  box(cabin,1.65,.20,.34,leather,0,.97,-.65);
  box(cabin,.42,.22,.024,screen,0,1.03,-.80);
  const steerWheel=new T.Group();steerWheel.position.set(-.49,1.08,-.48);steerWheel.rotation.x=-.31;cabin.add(steerWheel);
  mesh(new T.TorusGeometry(.18,.025,8,24),leather,steerWheel);
  box(steerWheel,.31,.022,.035,metal,0,0,0);box(steerWheel,.09,.085,.04,dark,0,0,.04);
  box(body,2.07,.12,4.35,dark,0,.31,0);
  box(body,1.94,.035,.06,glow(0xd5efff),0,.64,-2.355);
  const brakeLamp=glow(0xff4558);
  box(body,2.09,.065,.05,brakeLamp,0,.75,2.23);
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
  // Flowing hood and deck contours avoid the single-box silhouette;
  // curved fender arches are concentric with the actual suspension pivots.
  const bodyEdge=mat(0x14202a,.56,.38),trim=mat(0x3f5763,.34,.62);
  for(const side of [-1,1]){
    for(const z of [-1.48,1.45]){
      const arch=mesh(new T.TorusGeometry(.57,.042,7,32,Math.PI),bodyEdge,body,side*1.151,.46,z);
      arch.rotation.y=Math.PI/2;arch.rotation.z=Math.PI;
      const accent=mesh(new T.TorusGeometry(.605,.012,5,32,Math.PI),trim,body,side*1.162,.46,z);
      accent.rotation.y=Math.PI/2;accent.rotation.z=Math.PI;
    }
    const sill=box(body,.12,.055,2.29,bodyEdge,side*1.105,.29,.14);sill.rotation.y=side*.01;
    box(body,.36,.018,.045,trim,side*.95,.84,.41); // flush door handle
    line(body,[[side*.95,.87,-.66],[side*1.11,.86,-.53],[side*1.13,.42,-.5]],0x536978);
  }
  // Thin full-width aerodynamic vent, rear reflector and segmented lamps.
  const tail=glow(0xff283e);
  for(const side of [-1,1])for(let k=0;k<3;k++){
    box(body,.24,.042,.03,tail,side*(.72+k*.19),.77,2.295);
  }
  // Sculpted side air channels, running-light signatures and diffuser vanes.
  const carbon=mat(0x080d16,.34,.38);
  for(const side of [-1,1]){
    const lower=box(body,.055,.11,1.14,carbon,side*1.142,.52,.26);lower.rotation.y=side*.09;
    const flowing=box(body,.014,.025,2.2,mat(0x9dbac9,.29,.73),side*1.15,.74,-.04);
    flowing.rotation.y=side*.06;
    const drl=box(body,.52,.027,.07,glow(0xf4fcff),side*.68,.80,-2.31);drl.rotation.y=side*.09;
    const intake=box(body,.21,.14,.15,carbon,side*.88,.44,-2.29);intake.rotation.y=side*.14;
  }
  for(let i=0;i<7;i++){
    const z=1.68+i*.09;
    box(body,1.6,.019,.035,carbon,0,.35,z);
  }
  for(const x of [-.8,.8]){
    const rotor=box(body,.23,.07,.24,metal,x,.43,-1.94);rotor.rotation.y=x*.13;
    const wedge=box(body,.25,.09,.17,carbon,x,.25,2.1);wedge.rotation.y=x*.09;
  }
  // Sculpted splitter, hood creases, side sills and independent light lenses.
  const carbonDetail=mat(0x090e13,.42,.58),lampLens=new T.MeshPhysicalMaterial({color:0xc8e9ff,metalness:.18,roughness:.09,clearcoat:1,transparent:true,opacity:.85});
  box(body,2.14,.055,.18,carbonDetail,0,.27,-2.41);
  box(body,1.8,.035,.08,carbonDetail,0,.23,2.44);
  for(const side of [-1,1]){
    line(body,[[side*.53,.84,-2.09],[side*.70,.91,-1.43],[side*.86,.91,-.92]],0x8eacb9);
    line(body,[[side*.97,.83,-.57],[side*1.08,.69,-.20],[side*1.08,.68,1.18]],0x526473);
    line(body,[[side*.92,.83,1.34],[side*.69,.85,2.10]],0x9db6c3);
    const strip=box(body,.62,.044,.075,lampLens,side*.60,.81,-2.34);strip.rotation.y=side*.13;
    const scoop=box(body,.1,.15,.72,carbonDetail,side*1.15,.46,1.15);scoop.rotation.y=side*.1;
    box(body,.12,.045,2.8,carbonDetail,side*1.08,.31,.18);
  }
  // Vent arrays are inside the outer bumper and bodywork, not fake rockets.
  for(let i=0;i<9;i++)for(const side of [-1,1]){
    box(body,.02,.012,.042,carbonDetail,side*(.54+i*.052),.84,-2.25+i*.01);
  }
  const wheels=[],springs=[],brakeRotors=[];
  for(const x of [-1.08,1.08])for(const z of [-1.48,1.45]){
    const wheel=new T.Group();wheel.position.set(x,.45,z);body.add(wheel);
    const tire=mesh(new T.CylinderGeometry(.45,.45,.35,24),rubber,wheel);tire.rotation.z=Math.PI/2;
    const rim=mesh(new T.CylinderGeometry(.31,.31,.37,24),dark,wheel);rim.rotation.z=Math.PI/2;
    const outer=x>0?.188:-.188;
    const ring=mesh(new T.TorusGeometry(.315,.027,6,24),metal,wheel,outer,0,0);ring.rotation.y=Math.PI/2;
    let caliper;
    if(!simple){
      caliper=box(wheel,.04,.21,.1,mat(0xca3349,.5,.4),outer*.7,.04,.21);
      for(let k=0;k<7;k++){const a=k/7*Math.PI*2;const spoke=box(wheel,.04,.48,.043,metal,outer,0,0);spoke.rotation.x=a;}
    }
    const cap=mesh(new T.CylinderGeometry(.08,.08,.39,12),metal,wheel);cap.rotation.z=Math.PI/2;
    // Exposed telescopic damper and coil: wheel travel drives this assembly.
    const strut=new T.Group();strut.position.set(x*.82,.88,z);body.add(strut);
    const guide=mesh(new T.CylinderGeometry(.052,.052,.37,10),metal,strut);guide.position.y=-.13;
    const piston=mesh(new T.CylinderGeometry(.033,.033,.32,10),dark,strut);piston.position.y=-.35;
    const spring=mesh(new T.TorusGeometry(.073,.017,5,10),glow(0xe5b7ff),strut);spring.rotation.x=Math.PI/2;spring.position.y=-.16;
    const carrier=new T.Group();carrier.add(wheel);body.add(carrier);carrier.position.set(x,0,z);wheel.position.set(0,.45,0);
    // Calipers mount to the hub carrier, not the rotating tire.
    if(caliper){carrier.add(caliper);caliper.position.set(outer*.7,.49,.21);}
    if(!simple){
      const rotor=mesh(new T.CylinderGeometry(.355,.355,.020,40),mat(0x818d99,.34,.72),wheel,outer*.58,0,0);rotor.rotation.z=Math.PI/2;
      brakeRotors.push(rotor);
      for(const offset of [-.16,.16]){
        const ridge=mesh(new T.TorusGeometry(.428,.009,4,36),carbonDetail,wheel,offset,0,0);ridge.rotation.y=Math.PI/2;
      }
      for(let k=0;k<20;k++){
        const angle=k*Math.PI/10,groove=box(wheel,.20,.017,.09,carbonDetail,0,Math.sin(angle)*.448,Math.cos(angle)*.448);groove.rotation.x=-angle;
      }
      // Thin arms behind each wheel visibly connect the hub to the chassis.
      const link=box(carrier,.48,.038,.055,metal,-x*.18,.59,.10);link.rotation.z=(x<0?-.17:.17);
      const link2=box(carrier,.43,.045,.06,dark,-x*.19,.32,-.14);link2.rotation.z=(x<0?.12:-.12);
    }
    // remove first parent so the carrier owns the wheel / steering pivot.
    springs.push({strut,guide,piston,spring,carrier});wheels.push(wheel);
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
  // Link geometries have physically separate inboard and upright endpoints.
  // Updating both endpoints means the control arms change angle with wheel travel.
  const controlLinks=[];
  if(!simple)for(let i=0;i<springs.length;i++){
    const sx=i%2?1:-1,z=i<2?-1.48:1.45;
    for(const tier of [0,1])for(const fore of [-1,1]){
      const segment=mesh(new T.CylinderGeometry(.022,.026,1,9),tier?metal:dark,body);
      segment.castShadow=true;
      controlLinks.push({mesh:segment,corner:i,sx,z,tier,fore});
    }
  }
  group.userData={body,wheels,springs,brakeLamp,brakeRotors,steerWheel,controlLinks};return group;
}
export function makeLabel(text,color='#dce8ff',w=512,h=96){
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');
  ctx.fillStyle=color;ctx.font=`500 ${h*.47}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2,w*.95);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  return new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
}
function instancedBoxes(scene,items,material){const m=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,items.length);const obj=new T.Object3D();items.forEach((a,i)=>{obj.position.set(a[0],a[1],a[2]);obj.scale.set(a[3],a[4],a[5]);obj.rotation.set(0,a[6]||0,0);obj.updateMatrix();m.setMatrixAt(i,obj.matrix)});m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function surfaceNoise(base,range,seed=115){
 const can=document.createElement('canvas');can.width=can.height=256;
 const ctx=can.getContext('2d'),pixels=ctx.createImageData(256,256),rand=seeded(seed);
 for(let i=0;i<256*256;i++){
   const n=rand()-.5,v=Math.round(Math.max(0,Math.min(255,base+n*range)));
   pixels.data[i*4]=v;pixels.data[i*4+1]=v;pixels.data[i*4+2]=Math.round(v*.96);pixels.data[i*4+3]=255;
 }
 ctx.putImageData(pixels,0,0);const tex=new T.CanvasTexture(can);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(52,52);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}
export function createScene(container){
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.outputColorSpace=T.SRGBColorSpace;container.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.fog=new T.FogExp2(0xa7a5b3,.00124);
  const camera=new T.PerspectiveCamera(52,innerWidth/innerHeight,.12,2200);
  const sky=new T.Mesh(new T.SphereGeometry(1200,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sun:{value:new T.Vector3(-.55,.24,-.76).normalize()}},vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vDir;uniform vec3 sun;void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);vec3 col=mix(vec3(.74,.62,.59),vec3(.16,.28,.43),pow(h,.45));float s=max(dot(d,sun),0.);col+=vec3(1.,.64,.29)*pow(s,24.)*.25;col+=vec3(1.,.86,.66)*smoothstep(.99955,.99975,s)*2.;gl_FragColor=vec4(col,1.);}` }));scene.add(sky);
  scene.add(new T.HemisphereLight(0xb3d6ff,0x6c5241,2.25));
  const sun=new T.DirectionalLight(0xffdfb9,3.3);sun.position.set(-80,110,-75);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:1,far:300});sun.shadow.bias=-.00025;sun.shadow.normalBias=.03;scene.add(sun);scene.add(sun.target);
  const reflectScene=new T.Scene();reflectScene.add(sky.clone());reflectScene.add(new T.HemisphereLight(0xdcecff,0x625a5c,2));
  const pmrem=new T.PMREMGenerator(renderer);const env=pmrem.fromScene(reflectScene,.1,1,1600);scene.environment=env.texture;pmrem.dispose();
  const terrain=new T.PlaneGeometry(2000,2000,80,80);terrain.rotateX(-Math.PI/2);
  const pos=terrain.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const strength=Math.min(1,Math.max(0,(Math.hypot(x,z)-260)/160));pos.setY(i,-.13+strength*(Math.sin(x*.014)*Math.cos(z*.01)*13+Math.sin(z*.039)*3));}terrain.computeVertexNormals();
  const sand=mat(0xa39b90,.98);sand.map=surfaceNoise(205,39,71);sand.needsUpdate=true;mesh(terrain,sand,scene).receiveShadow=true;
  const roadMat=mat(0x676d76,.9,.06),edgeMat=mat(0xa1a6ad,.9),lineMat=mat(0xe2dfca,.8);roadMat.map=surfaceNoise(168,27,19);roadMat.needsUpdate=true;
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
  // Handling campus beyond the south end of the suspension corridor:
  // continuous slalom/braking pavement, transverse connector and skidpad.
  // Surface friction and water are supplied by range.mjs to all four tires.
  const campusMat=mat(0x393f48,.92,.02),kerbMat=mat(0x9caaa7,.76),wetMat=new T.MeshPhysicalMaterial({color:0x526c82,roughness:.16,metalness:.12,clearcoat:.75,transparent:true,opacity:.62,depthWrite:false});
  box(scene,20,.09,200,campusMat,64,-.025,-219);
  box(scene,75,.09,14,campusMat,102,-.025,-264);
  const campusRing=mesh(new T.RingGeometry(30,42,128),campusMat,scene,137,.024,-264);campusRing.rotation.x=-Math.PI/2;campusRing.receiveShadow=true;
  for(const radius of [30.2,41.8]){
    const marking=mesh(new T.RingGeometry(radius-.12,radius+.12,128),kerbMat,scene,137,.035,-264);marking.rotation.x=-Math.PI/2;marking.receiveShadow=true;
  }
  const pitch=PROVING_ROUTES.slalom;
  const campusLines=[];
  for(let z=pitch.z1;z<pitch.z0;z+=12){campusLines.push([54.25,.035,z,.16,.015,6],[73.75,.035,z,.16,.015,6]);}
  for(let z=-314;z<-135;z+=20)campusLines.push([64,.035,z,.18,.015,8]);
  campusLines.push([64,.042,-316,18,.015,.38],[64,.042,-130,18,.015,.38]);
  instancedBoxes(scene,campusLines,lineMat);
  const pylonShell=mat(0xff7747,.8),pylonCollar=mat(0xfce6cf,.86),pylonFoot=mat(0x303842,.9);
  const coursePylons=[];
  for(const p of SLALOM_PYLONS){
    const assembly=new T.Group();assembly.position.set(p.x,0,p.z);scene.add(assembly);coursePylons.push(assembly);
    mesh(new T.ConeGeometry(.32,1.06,12),pylonShell,assembly,0,.54,0);
    mesh(new T.CylinderGeometry(.215,.245,.13,12),pylonCollar,assembly,0,.48,0);
    box(assembly,.7,.035,.7,pylonFoot,0,.018,0);
  }
  // The wet braking block is rendered translucent to expose the line texture.
  const puddle=box(scene,WET_PATCH.x1-WET_PATCH.x0,.015,WET_PATCH.z1-WET_PATCH.z0,wetMat,(WET_PATCH.x1+WET_PATCH.x0)/2,.044,(WET_PATCH.z0+WET_PATCH.z1)/2);
  puddle.receiveShadow=false;
  for(const [name,x,z] of [['SLALOM / 8 CONES',64,-145],['WET BRAKE TEST',64,-228],['SKIDPAD',137,-264]]){
    const badge=makeLabel(name,'#e8f8ff');badge.position.set(x,4.8,z);badge.scale.set(23,3,1);scene.add(badge);
  }
  const gateGroup=new T.Group();scene.add(gateGroup);const gates=GATES.map((p,i)=>{
    const g=new T.Group();g.position.set(...p);const prev=i?GATES[i-1]:[0,4,42];g.lookAt(p[0]+p[0]-prev[0],p[1],p[2]+p[2]-prev[2]);
    const ring=mesh(new T.TorusGeometry(7.5,.13,8,64),glow(0xc0b4fa),g);ring.castShadow=false;
    const outer=mesh(new T.TorusGeometry(7.82,.035,4,64),new T.MeshBasicMaterial({color:0xb8a1e0,transparent:true,opacity:.45}),g);outer.castShadow=false;
    const number=makeLabel(String(i+1).padStart(2,'0'),'#ebffd1',128,64);number.scale.set(3,1.5,1);number.position.y=9.5;g.add(number);
    gateGroup.add(g);return {group:g,ring,outer,number};
  });
  const car=makeCar();scene.add(car);
  // Experimental-flight propulsion: no flames for cold-gas jets. The inner
  // nozzles pulse with pressure; cones of vapor are spawned in game.mjs.
  const jetMaterial=new T.MeshBasicMaterial({color:0x9ce9ff,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
  const vehicleJets=[];
  for(const x of [-.83,.83])for(const z of [-1.42,1.48]){
    const core=mesh(new T.ConeGeometry(.22,1.35,16),jetMaterial.clone(),car.userData.body,x,-.21,z);
    core.rotation.z=Math.PI;core.castShadow=false;core.receiveShadow=false;vehicleJets.push(core);
  }
  // Suspension dynamics track: raised concrete, washboard and asymmetric wheel rut.
  // Geometry samples exactly the same physical height function as the four tire contacts.
  const stripGeometry=new T.PlaneGeometry(18,213,36,852);stripGeometry.rotateX(-Math.PI/2);
  const stripPositions=stripGeometry.getAttribute('position');
  for(let i=0;i<stripPositions.count;i++){
    const x=64+stripPositions.getX(i),z=-18.5+stripPositions.getZ(i);
    stripPositions.setY(i,.025+surfaceAt(x,z));
  }
  stripGeometry.computeVertexNormals();
  const proving=new T.Mesh(stripGeometry,mat(0x2b323f,.8,.08));proving.position.set(64,0,-18.5);proving.receiveShadow=true;scene.add(proving);
  for(const side of [-8.5,8.5])line(scene,[[64+side,.055,86],[64+side,.055,-123]],0xffba8f);
  // Concrete crash rails match the collision boundaries in the dynamics solver.
  for(const side of [-10.1,10.1]){
    for(let z=79;z>-117;z-=6){
      box(scene,.33,.78,5.85,mat(0x707c86,.83,.18),64+side,.43,z);
      box(scene,.36,.09,5.85,metal,64+side,.88,z);
    }
    line(scene,[[64+side,.96,86],[64+side,.96,-120]],0xd3eef1);
  }

  for(const z of [56,38,20,-3,-67,-76,-115]){
    const sign=makeLabel(z>0?'DAMPER / IMPULSE':z>-67?'WASHBOARD / COMPLIANCE':'CROSS-AXLE / RUT','#ffedcf');
    sign.position.set(78,2,z);sign.scale.set(16,3.2,1);scene.add(sign);
  }
  // Research campus: an illuminated lift platform, sensor gantries, a
  // crosswind calibration corridor and a precision touchdown pad.
  const researchGroup=new T.Group();scene.add(researchGroup);researchGroup.visible=false;
  const signal=new T.MeshBasicMaterial({color:0x80ecff,transparent:true,opacity:.78,depthWrite:false,side:T.DoubleSide});
  const magenta=new T.MeshBasicMaterial({color:0xba88ff,transparent:true,opacity:.76,depthWrite:false});
  const ink=mat(0x171d2c,.52,.45),brushed=mat(0x586777,.37,.77),led=glow(0x72e8f5);
  const researchRings=[];
  for(let k=1;k<=3;k++){
    const target=RESEARCH_STAGES[k];
    const rig=new T.Group();rig.position.set(target.x,target.y,target.z);
    const tube=mesh(new T.TorusGeometry(target.radius,.26,12,96),k===2?magenta.clone():signal.clone(),rig);
    const orbit=mesh(new T.TorusGeometry(target.radius+1,.035,4,96),signal.clone(),rig);
    orbit.rotation.z=.16;
    for(let i=0;i<8;i++){
      const angle=(i/8)*Math.PI*2;
      const tick=box(rig,.65,.16,.13,led,Math.sin(angle)*(target.radius+1.5),Math.cos(angle)*(target.radius+1.5),0);
      tick.rotation.z=-angle;
    }
    const number=makeLabel('PROTOCOL '+String(k+1).padStart(2,'0'),'#c9f9ff',256,56);
    number.position.set(0,target.radius+3,0);number.scale.set(15,3.2,1);rig.add(number);
    researchGroup.add(rig);researchRings.push({rig,tube,orbit});
  }
  function createPad(x,z,r,accent){
    const pad=new T.Group();pad.position.set(x,.08,z);researchGroup.add(pad);
    const disc=mesh(new T.CylinderGeometry(r,r,.20,72),ink,pad,0,.04,0);
    const markings=new T.MeshBasicMaterial({color:accent,transparent:true,opacity:.94,depthWrite:false});
    const rings=[.97,.78,.49];
    for(const r0 of rings){const t=mesh(new T.TorusGeometry(r*r0,.08,6,96),markings,pad,0,.16,0);t.rotation.x=Math.PI/2;t.castShadow=false;}
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;const tick=box(pad,.52,.035,1.15,markings,Math.sin(a)*r*.88,.18,Math.cos(a)*r*.88);
      tick.rotation.y=a;
    }
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;const x0=Math.sin(a)*(r+2.2),z0=Math.cos(a)*(r+2.2);
      box(pad,.25,3,.25,brushed,x0,1.5,z0);
      const lamp=mesh(new T.IcosahedronGeometry(.38,1),markings,pad,x0,3.25,z0);lamp.castShadow=false;
    }
    return pad;
  }
  createPad(0,42,11,0x77e2f6);createPad(32,-191,13,0xc8a0fa);
  const researchLabel=makeLabel('R&D  //  EXPERIMENTAL FLIGHT TEST RANGE','#d9f5fc');
  researchLabel.position.set(0,20,42);researchLabel.scale.set(34,4.8,1);researchGroup.add(researchLabel);
  // Tracking sensors, photogrammetry markers, and mast floodlights.
  const sensorParts=[],sensorLights=[];
  for(let i=0;i<24;i++){
    const side=i%2===0?-1:1,step=i>>1;
    const x=side*(29+step%3*3),z=53-step*22;
    sensorParts.push([x,5,z,.25,10,.25],[x,10.25,z,3.6,.33,.46]);
    sensorLights.push([x,10.75,z,.65,.2,.6]);
  }
  instancedBoxes(researchGroup,sensorParts,brushed);instancedBoxes(researchGroup,sensorLights,led);
  // Wind shear vanes near the departure pad respond to actual simulated wind.
  const windVanes=[];
  for(let i=0;i<7;i++){
    const vane=new T.Group();vane.position.set(-30+i*10,6,-16);
    const stem=mesh(new T.CylinderGeometry(.06,.06,12,8),brushed,vane,0,0,0);
    const flag=mesh(new T.ConeGeometry(.45,3.5,3),signal.clone(),vane,0,6,0);
    flag.rotation.z=-Math.PI/2;vane.add(flag);windVanes.push(flag);
    researchGroup.add(vane);
  }
  const researchClouds=[];
  const plumeMat=new T.MeshBasicMaterial({color:0x86cdf2,transparent:true,opacity:.07,depthWrite:false,blending:T.AdditiveBlending});
  for(let i=0;i<7;i++){
    const cloud=mesh(new T.SphereGeometry(1,12,8),plumeMat,researchGroup,0,0,0);
    cloud.scale.set(14+i*2,1.1,5+i);researchClouds.push(cloud);
  }
  function setResearchPhase(enabled,stage=0){
    researchGroup.visible=enabled;
    if(enabled)researchRings.forEach((r,i)=>{
      r.rig.visible=i>=stage-1 && i<=stage+1;
      r.tube.material.opacity=i===stage-1?.98:.22;
      r.orbit.material.opacity=i===stage-1?.9:.16;
    });
  }
  function updateResearchScene(s,t){
    if(!researchGroup.visible)return;
    const gust=Math.atan2(s.windX||0,-(s.windZ||1));
    windVanes.forEach((v,i)=>{v.rotation.y=gust;v.rotation.z=-Math.PI/2+.12*Math.sin(t*2+i);});
    researchRings.forEach((r,i)=>{r.orbit.rotation.z=t*.14*(i%2?-1:1);r.rig.scale.setScalar(1+.01*Math.sin(t*2.5+i));});
    researchClouds.forEach((m,i)=>{
      m.position.set(-24+i*12+(s.windX||0)*t*.05,12+i*3,-38-i*20);
      m.material.opacity=.04+.016*Math.sin(t*.7+i);
    });
  }
  function setVehicleEffects(s,t){
    if(s.mode==='dynamics'&&s.drivetrain){
      const d=s.drivetrain;
      if(coursePylons)coursePylons.forEach((p,i)=>{p.rotation.z+=((d.hitPylons?.includes(i)?1.22:0)-p.rotation.z)*.12;});
      car.userData.brakeLamp.color.setHex(d.regenKw>1||d.brakeTemperature.some((v,i)=>d.tireForceX[i]<-1000)?0xffacb7:0xff4558);
      car.userData.brakeRotors.forEach((r,i)=>{
        const glowFactor=Math.max(0,Math.min(1,(d.brakeTemperature[i]-330)/350));
        r.material.color.setRGB(.51+glowFactor*.48,.57-glowFactor*.32,.62-glowFactor*.52);
      });
    }else car.userData.brakeLamp.color.setHex(0xff4558);
    const power=s.lifting?(s.thrustG?Math.min(1,s.thrustG/2):1):0;
    vehicleJets.forEach((jet,i)=>{
      jet.visible=power>.01;
      jet.material.opacity=power*(.16+.11*Math.sin(t*35+i));
      jet.scale.y=.65+power*.85;
    });
  }
  // V2: best-run ghost is an independently shaded lightweight duplicate.
  const ghost=makeCar(0xc4a5ef,true);scene.add(ghost);ghost.visible=false;
  ghost.traverse(part=>{if(part.isMesh){part.material=part.material.clone();part.material.transparent=true;part.material.opacity=.27;part.material.depthWrite=false;part.castShadow=false;part.receiveShadow=false;}});
  function setGhostPose(pose){
    ghost.visible=!!pose;
    if(!pose)return;
    const [x,y,z,yaw,pitch,roll]=pose;
    ghost.position.set(x,y,z);ghost.rotation.set(0,yaw,0);
    ghost.userData.body.rotation.set(pitch,0,roll||0);
  }
  // Clearer wind-resistant silhouette: ambient accent pools and runway approach stripes.
  const approachGlow=glow(0x9b80ee);
  for(let z=92;z>=-64;z-=16){for(const side of [-1,1]){
    box(scene,1.1,.025,.22,approachGlow,side*10,.04,z);
  }}
  const ambience=new T.PointLight(0x9b76d6,1.3,26,2);ambience.position.set(0,3,12);scene.add(ambience);
  let environmentIndex=0;
  const hemi=scene.children.find(child=>child.isHemisphereLight);
  const environments=[
    {name:'GOLDEN HOUR',exposure:1.15,sun:3.3,fog:0xa7a5b3,hemi:2.25},
    {name:'BLUE HOUR',exposure:.93,sun:1.8,fog:0x666e94,hemi:1.8},
    {name:'MOONLIGHT',exposure:.72,sun:.7,fog:0x333f64,hemi:1.35}
  ];
  function setEnvironment(index){
    environmentIndex=(index+environments.length)%environments.length;
    const e=environments[environmentIndex];renderer.toneMappingExposure=e.exposure;
    sun.intensity=e.sun;scene.fog.color.setHex(e.fog);if(hemi)hemi.intensity=e.hemi;
    return e.name;
  }

  // Tire-track decal pool. Stamps are generated only from actual loaded,
  // sliding contact patches and match the road height in the solver.
  const trackMaterial=new T.MeshBasicMaterial({color:0x0c1119,transparent:true,opacity:.37,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  const trackGeo=new T.PlaneGeometry(.24,.72);trackGeo.rotateX(-Math.PI/2);
  const skidPool=new T.InstancedMesh(trackGeo,trackMaterial,520);
  skidPool.count=0;skidPool.frustumCulled=false;skidPool.castShadow=false;skidPool.receiveShadow=false;scene.add(skidPool);
  const skidDummy=new T.Object3D();let skidCounter=0;
  function resetSkids(){skidCounter=0;skidPool.count=0;}
  function stampSkids(state){
    if(state.mode!=='dynamics'||state.y>.25||!state.drivetrain||state.speed<4)return;
    const d=state.drivetrain,sy=Math.sin(state.yaw),cy=Math.cos(state.yaw);
    const corners=[[-1.08,-1.48],[1.08,-1.48],[-1.08,1.45],[1.08,1.45]];
    for(let i=0;i<4;i++){
      if(d.wheelLoads[i]<900||Math.abs(d.longitudinalSlip[i])<.17&&Math.abs(d.slipAngles[i])<.105)continue;
      const [lx,lz]=corners[i];const x=state.x+lx*cy+lz*sy,z=state.z-lx*sy+lz*cy;
      skidDummy.position.set(x,surfaceAt(x,z)+.038,z);
      skidDummy.rotation.set(0,state.yaw+(i<2?d.steerAngle:0),0);
      skidDummy.scale.set(1,1,1);skidDummy.updateMatrix();
      skidPool.setMatrixAt(skidCounter%520,skidDummy.matrix);
      skidCounter++;skidPool.count=Math.min(520,skidCounter);
    }
    skidPool.instanceMatrix.needsUpdate=true;
  }
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
  return {T,scene,renderer,camera,car,ghost,gates,gateGroup,sun,shadow,emit,updateParticles,stampSkids,resetSkids,setGhostPose,setEnvironment,setResearchPhase,updateResearchScene,setVehicleEffects};
}