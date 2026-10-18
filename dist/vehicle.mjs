import * as T from './three.module.min.js';
import {WHEELS} from './physics.mjs';
const vec=p=>new T.Vector3(...p);
export function buildVehicle(){
  const root=new T.Group();
  const paint=new T.MeshPhysicalMaterial({color:0xb9c1cf,metalness:.8,roughness:.25,clearcoat:1,clearcoatRoughness:.13,envMapIntensity:1.2});
  const carbon=new T.MeshStandardMaterial({color:0x11151b,metalness:.4,roughness:.43});
  const black=new T.MeshStandardMaterial({color:0x080b0f,roughness:.62});
  const aluminum=new T.MeshStandardMaterial({color:0x9aa4b1,metalness:.95,roughness:.28});
  const rimMat=new T.MeshPhysicalMaterial({color:0x424854,metalness:.95,roughness:.26,clearcoat:.65});
  const glass=new T.MeshPhysicalMaterial({color:0x19252c,metalness:.08,roughness:.08,transparent:true,opacity:.84,clearcoat:1,side:T.DoubleSide,envMapIntensity:1.7});
  const white=new T.MeshStandardMaterial({color:0xf2f6ff,emissive:0xddeaff,emissiveIntensity:2.2});
  const tail=new T.MeshStandardMaterial({color:0xb91c28,emissive:0xfa1029,emissiveIntensity:2});
  const brakeMat=new T.MeshStandardMaterial({color:0x8f3247,metalness:.65,roughness:.35});
  const rubber=new T.MeshStandardMaterial({color:0x141517,roughness:.91});
  const mesh=(geo,mat,parent=root)=>{const m=new T.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const box=(size,pos,mat,parent=root)=>{const m=mesh(new T.BoxGeometry(...size),mat,parent);m.position.set(...pos);return m;};
  const panel=(points,mat=paint,parent=root)=>{const g=new T.BufferGeometry(),vertices=[];for(let i=1;i<points.length-1;i++)vertices.push(...points[0],...points[i],...points[i+1]);g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();const m=mesh(g,mat,parent);m.material.side=T.DoubleSide;return m;};
  const tube=(points,r,mat,parent=root,segments=36)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(vec)),segments,r,5,false),mat,parent);
  const sections=[[-2.32,.81,.10],[-2.16,.94,.16],[-1.70,.99,.25],[-1.43,1.0,.28],[-.98,.965,.28],[-.55,.92,.29],[0,.93,.30],[.6,.96,.32],[1.10,1.01,.34],[1.43,1.035,.34],[1.85,1.02,.32],[2.28,.97,.29]];
  const profile=z=>{let i=0;while(i<sections.length-2&&z>sections[i+1][0])i++;const a=sections[i],b=sections[i+1],t=T.MathUtils.smoothstep(z,a[0],b[0]);return [T.MathUtils.lerp(a[1],b[1],t),T.MathUtils.lerp(a[2],b[2],t)];};
  // Fine surface tessellation retains sharp design creases at the hood and shoulders.
  for(const sign of [-1,1]){
    const positions=[],uvs=[],indices=[],N=140,M=12;
    for(let iz=0;iz<=N;iz++){const z=-2.32+4.6*iz/N,[width,top]=profile(z);for(let ix=0;ix<=M;ix++){const t=ix/M;const shoulder=Math.exp(-Math.pow((Math.abs(z)-1.43)/.52,2))*.10;const y=top+shoulder*Math.pow(t,3)-.045*Math.pow(t,10);positions.push(sign*width*t,y,z);uvs.push(t,iz/N);}}
    for(let iz=0;iz<N;iz++)for(let ix=0;ix<M;ix++){const z=-2.32+4.6*(iz+.5)/N;if(z>-.82&&z<1.38&&ix/M<.78)continue;const a=iz*(M+1)+ix,b=a+M+1;if(sign>0)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);}
    let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();mesh(g,paint);
    const v=[],idx=[];
    for(let i=0;i<=N;i++){const z=-2.32+4.6*i/N,[width,top]=profile(z),d=Math.min(Math.abs(z+1.43),Math.abs(z-1.43)),arch=d<.435?-.235+Math.sqrt(.435*.435-d*d):-.36;const shoulder=Math.exp(-Math.pow((Math.abs(z)-1.43)/.52,2))*.10;v.push(sign*width,top+shoulder-.045,z,sign*(width-.018),arch,z);}
    for(let i=0;i<N;i++){const a=i*2;if(sign<0)idx.push(a,a+1,a+2,a+1,a+3,a+2);else idx.push(a,a+2,a+1,a+1,a+2,a+3);}
    g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();mesh(g,paint);
    // Wheel arch lips, panel gaps, sill and flush door handle.
    for(const z of [-1.43,1.43]){const pts=[];for(let i=0;i<=32;i++){const a=Math.PI*i/32;const zz=z+.437*Math.cos(a);pts.push([sign*(profile(zz)[0]+.002),-.235+.437*Math.sin(a),zz]);}tube(pts,.009,carbon);}
    tube([[sign*.942,.289,-.73],[sign*.94,.02,-.64],[sign*.94,-.28,-.56],[sign*.96,-.30,.72],[sign*.98,.05,.82],[sign*.98,.32,.89]],.004,black);
    box([.055,.095,1.91],[sign*.956,-.325,.04],carbon);
    box([.006,.018,.16],[sign*.965,.24,.61],aluminum);
    const mirror=mesh(new T.SphereGeometry(1,16,8),carbon);mirror.position.set(sign*1.07,.35,-.63);mirror.scale.set(.15,.055,.12);box([.14,.025,.025],[sign*.98,.32,-.62],carbon);
    panel([[sign*.77,.30,-.82],[sign*.67,.70,-.05],[sign*.69,.73,.64],[sign*.86,.35,1.44]],glass);
    tube([[sign*.78,.305,-.84],[sign*.68,.709,-.05],[sign*.70,.739,.64],[sign*.87,.35,1.45]],.016,paint);
    tube([[sign*.695,.725,.60],[sign*.82,.34,.76]],.014,carbon);
    // Headlight blades follow the triangular fender opening.
    panel([[sign*.91,.202,-1.99],[sign*.70,.17,-2.14],[sign*.76,.27,-1.79]],black);
    tube([[sign*.91,.209,-1.99],[sign*.756,.253,-1.865]],.014,white,root,12);
    for(let i=0;i<4;i++)box([.018,.018,.06],[sign*(.78+i*.029),.235-i*.006,-1.90-i*.018],white);
    box([.023,.015,.16],[sign*.969,.22,-.91],new T.MeshStandardMaterial({color:0xc88b36,emissive:0x7d3511}));
  }
  // Faceted hood centre, front intake and splitter.
  tube([[-.70,.17,-2.14],[-.65,.275,-1.2],[-.60,.29,-.82]],.0035,carbon);
  tube([[.70,.17,-2.14],[.65,.275,-1.2],[.60,.29,-.82]],.0035,carbon);
  panel([[-.81,.1,-2.32],[.81,.1,-2.32],[.75,-.30,-2.33],[-.75,-.30,-2.33]],carbon);
  box([1.56,.11,.03],[0,-.15,-2.341],black);
  box([1.78,.055,.24],[0,-.34,-2.25],carbon);
  tube([[-.79,.112,-2.325],[0,.105,-2.35],[.79,.112,-2.325]],.007,white);
  // Curved panoramic glazing: two tessellated trapezoids and a narrow roof cap.
  function glassPatch(z0,z1,y0,y1,w0,w1){const p=[],ind=[],N=20,M=20;for(let iz=0;iz<=N;iz++)for(let ix=0;ix<=M;ix++){let u=iz/N,v=ix/M*2-1;p.push(v*T.MathUtils.lerp(w0,w1,u),T.MathUtils.lerp(y0,y1,u)+.025*(1-v*v),T.MathUtils.lerp(z0,z1,u));}for(let i=0;i<N;i++)for(let j=0;j<M;j++){let a=i*(M+1)+j;ind.push(a,a+M+1,a+1,a+1,a+M+1,a+M+2);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ind);g.computeVertexNormals();mesh(g,glass);}
  glassPatch(-.84,-.05,.30,.705,.78,.68);glassPatch(-.05,.67,.705,.735,.68,.70);glassPatch(.67,1.60,.735,.345,.70,.82);
  tube([[-.68,.708,-.05],[0,.736,-.05],[.68,.708,-.05]],.013,paint);
  tube([[-.70,.74,.67],[0,.765,.67],[.70,.74,.67]],.012,paint);
  // Rear diffuser, continuous tail lamp, carbon fins and four cold-gas nozzles.
  panel([[-.97,.29,2.28],[.97,.29,2.28],[.95,-.27,2.24],[-.95,-.27,2.24]],carbon);
  box([1.92,.045,.028],[0,.225,2.294],tail);
  box([1.96,.025,.13],[0,.29,2.23],paint);
  box([1.74,.1,.35],[0,-.28,2.13],carbon);
  for(const x of [-.83,-.50,-.2,.2,.5,.83])box([.018,.18,.51],[x,-.28,2.04],carbon);
  const nozzle=(pos,axis)=>{const g=new T.Group();g.position.set(...pos);g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vec(axis));root.add(g);mesh(new T.CylinderGeometry(.069,.095,.12,24,1,true),aluminum,g);const dark=mesh(new T.CircleGeometry(.066,24),black,g);dark.rotation.x=-Math.PI/2;dark.position.y=.057;return g;};
  for(const x of [-.61,-.21,.21,.61])nozzle([x,-.12,2.29],[0,0,1]);
  for(const x of [-.83,.83])for(const z of [-1.35,1.35])nozzle([x,-.32,z],[0,-1,0]);
  for(const x of [-.98,.98])nozzle([x,.04,.97],[Math.sign(x),0,0]);
  const plateCanvas=document.createElement('canvas');plateCanvas.width=512;plateCanvas.height=128;const ctx=plateCanvas.getContext('2d');ctx.fillStyle='#11151c';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#7e8795';ctx.lineWidth=4;ctx.strokeRect(4,4,504,120);ctx.font='48px sans-serif';ctx.textAlign='center';ctx.fillStyle='#d3dae5';ctx.fillText('R O A D S T E R',256,82);const plate=new T.CanvasTexture(plateCanvas);plate.colorSpace=T.SRGBColorSpace;
  const plateMesh=mesh(new T.PlaneGeometry(.49,.12),new T.MeshStandardMaterial({map:plate,roughness:.5}));plateMesh.position.set(0,.077,2.307);plateMesh.rotation.y=0;
  // Interior includes two bucket seats, dash, a live instrument panel and yoke.
  const interior=new T.Group();root.add(interior);box([1.68,.14,1.90],[0,-.25,.10],black,interior);box([1.47,.15,.28],[0,.16,-.58],carbon,interior);
  for(const x of [-.39,.39]){box([.42,.12,.48],[x,-.14,.16],black,interior);const seat=box([.41,.56,.12],[x,.1,.43],black,interior);seat.rotation.x=-.14;for(const side of [-1,1]){const bolster=box([.07,.45,.18],[x+side*.22,.05,.38],carbon,interior);bolster.rotation.z=-side*.1;}box([.24,.18,.10],[x,.45,.43],black,interior);tube([[x-.12,.42,.34],[x-.12,-.05,.08]],.019,new T.MeshStandardMaterial({color:0x7356a6,roughness:1}),interior);}
  box([.21,.10,.87],[0,-.04,.13],carbon,interior);
  const dashboard=document.createElement('canvas');dashboard.width=512;dashboard.height=256;const dashTexture=new T.CanvasTexture(dashboard);dashTexture.colorSpace=T.SRGBColorSpace;const screen=mesh(new T.PlaneGeometry(.40,.20),new T.MeshBasicMaterial({map:dashTexture}),interior);screen.position.set(-.38,.285,-.53);screen.rotation.y=0;screen.rotation.x=-.15;
  const yoke=new T.Group();yoke.position.set(-.39,.22,-.35);interior.add(yoke);tube([[-.17,.07,0],[-.17,-.07,0],[-.09,-.12,0],[.09,-.12,0],[.17,-.07,0],[.17,.07,0]],.024,carbon,yoke);box([.12,.065,.04],[0,-.015,0],aluminum,yoke);
  const wheelRigs=[];
  for(let i=0;i<4;i++){
    const rig=new T.Group(),spin=new T.Group();root.add(rig);rig.add(spin);const sign=i%2?1:-1;
    const tire=mesh(new T.CylinderGeometry(.355,.355,.265,64,1,true),rubber,spin);tire.rotation.z=Math.PI/2;
    for(const side of [-1,1]){const wall=mesh(new T.TorusGeometry(.288,.067,12,64),rubber,spin);wall.rotation.y=Math.PI/2;wall.position.x=side*.115;}
    for(const x of [-.085,0,.085]){const groove=mesh(new T.TorusGeometry(.355,.004,4,64),black,spin);groove.rotation.y=Math.PI/2;groove.position.x=x;}
    const rim=mesh(new T.CylinderGeometry(.273,.273,.22,48,1,true),rimMat,spin);rim.rotation.z=Math.PI/2;
    const disc=mesh(new T.CylinderGeometry(.221,.221,.018,48),aluminum,spin);disc.rotation.z=Math.PI/2;disc.position.x=sign*.03;
    // Vent slots are instanced, keeping all four detailed wheels inexpensive to render.
    const holes=new T.InstancedMesh(new T.SphereGeometry(.007,5,4),black,36),dummy=new T.Object3D();spin.add(holes);
    for(let j=0;j<36;j++){let a=j/36*Math.PI*2;dummy.position.set(sign*.046,Math.cos(a)*(.167+(j%2)*.024),Math.sin(a)*(.167+(j%2)*.024));dummy.scale.set(.4,1,1);dummy.updateMatrix();holes.setMatrixAt(j,dummy.matrix);}
    for(let j=0;j<6;j++){const a=j*Math.PI/3,points=[[sign*.135,Math.cos(a-.15)*.065,Math.sin(a-.15)*.065],[sign*.135,Math.cos(a+.07)*.265,Math.sin(a+.07)*.265],[sign*.135,Math.cos(a+.32)*.265,Math.sin(a+.32)*.265],[sign*.135,Math.cos(a+.40)*.065,Math.sin(a+.40)*.065]];panel(points,rimMat,spin);const edge=box([.021,.195,.026],[sign*.15,Math.cos(a+.13)*.165,Math.sin(a+.13)*.165],aluminum,spin);edge.rotation.x=a+.13;}
    const hub=mesh(new T.CylinderGeometry(.06,.06,.025,24),carbon,spin);hub.rotation.z=Math.PI/2;hub.position.x=sign*.155;
    const caliper=box([.065,.17,.065],[sign*.053,.04,-.195],brakeMat,rig);caliper.rotation.x=-.2;
    const ring=mesh(new T.TorusGeometry(.278,.009,6,64),aluminum,spin);ring.rotation.y=Math.PI/2;ring.position.x=sign*.132;
    wheelRigs.push({rig,spin});
  }
  root.traverse(o=>{if(o.isMesh){o.frustumCulled=true;if(o.material===glass)o.castShadow=false;}});
  let lastDash=-1;
  function update(s,braking){root.position.copy(s.p);root.quaternion.copy(s.q);for(let i=0;i<4;i++){const a=WHEELS[i],w=s.wheels[i],r=wheelRigs[i];r.rig.position.set(a[0],a[1]-w.length,a[2]);r.rig.rotation.y=w.angle;r.spin.rotation.x=-w.spin;}
    yoke.rotation.z=s.steer*2.7;tail.emissiveIntensity=braking?5:1.8;
    const mph=Math.round(s.speed*2.23694);if(mph!==lastDash){const c=dashboard.getContext('2d');c.fillStyle='#05090e';c.fillRect(0,0,512,256);c.fillStyle='#e9edff';c.font='96px sans-serif';c.textAlign='center';c.fillText(mph,256,140);c.font='24px sans-serif';c.fillStyle='#b7a0ea';c.fillText('MPH     •     DRIVE',256,202);dashTexture.needsUpdate=true;lastDash=mph;}}
  return {root,paint,glass,interior,update};
}
