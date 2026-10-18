// Roadster V3.4 — a driving environment, not a random collection of boxes.
// World coordinates are metres. The closed-loop asphalt is at grade y=0,
// agreeing with the flat collision plane away from the original damper strip.
import {CIRCUIT_POINTS,circuitDistance} from './range.mjs';

export function createAutodrome(T,scene){
  const root=new T.Group();root.name='WEST TEXAS ENGINEERING AUTODROME';scene.add(root);
  const asMat=(c,r=.85,m=0)=>new T.MeshStandardMaterial({color:c,roughness:r,metalness:m});
  const tarmac=asMat(0x303943,.91,.03),kerbRed=asMat(0xa5443b,.89),kerbWhite=asMat(0xd3cec2,.84),lineMat=new T.MeshBasicMaterial({color:0xd9d8c4});
  const sand=asMat(0x877d6d,.96),steel=asMat(0x6b7782,.5,.65),dark=asMat(0x18232e,.73,.2),lamp=new T.MeshBasicMaterial({color:0xf7e8c7});
  const trackCurve=new T.CatmullRomCurve3(CIRCUIT_POINTS.map(([x,z])=>new T.Vector3(x,0,z)),true,'catmullrom',.35);
  const totalSamples=400, pts=[],edges=[],indices=[],uvs=[];
  // One continuous paved strip; no seams between curve segments.
  for(let i=0;i<=totalSamples;i++){
    const u=i/totalSamples,p=trackCurve.getPointAt(u),t=trackCurve.getTangentAt(u),nx=-t.z,nz=t.x;
    pts.push({p,nx,nz});for(const side of [-1,1]){edges.push(p.x+nx*12*side,.042,p.z+nz*12*side);uvs.push(side<0?0:1,i/14);}
    if(i<totalSamples){const k=2*i;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(edges,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  const asphalt=new T.Mesh(g,tarmac);asphalt.receiveShadow=true;asphalt.castShadow=false;root.add(asphalt);
  // A grounded terrain plate conceals the older uneven desert mesh under the
  // whole circuit and gives the same level base to the collision solver.
  const base=new T.Mesh(new T.PlaneGeometry(780,760),sand);base.rotation.x=-Math.PI/2;base.position.set(69,-.12,-212);base.receiveShadow=true;root.add(base);
  const stripeMesh=(items,geometry,material)=>{
    const im=new T.InstancedMesh(geometry,material,items.length),dummy=new T.Object3D();
    items.forEach(([x,y,z,sx,sy,sz,yaw=0],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix)});
    im.receiveShadow=true;im.castShadow=false;root.add(im);return im;
  };
  const center=[],red=[],white=[],posts=[],rails=[];
  for(let i=0;i<totalSamples;i+=2){
    const {p,nx,nz}=pts[i],t=trackCurve.getTangentAt(i/totalSamples),yaw=Math.atan2(t.x,t.z);
    if(i%8===0)center.push([p.x,.080,p.z,.2,.018,4.8,yaw]);
    for(const sign of [-1,1]){
      const x=p.x+nx*11.8*sign,z=p.z+nz*11.8*sign;
      (i%4<2?red:white).push([x,.067,z,1.05,.025,3.3,yaw]);
      if(i%12===0){const px=p.x+nx*15*sign,pz=p.z+nz*15*sign;
        posts.push([px,.73,pz,.14,1.4,.14]);
        rails.push([px,.95,pz,.16,.26,8,yaw]);}
    }
  }
  stripeMesh(center,new T.BoxGeometry(1,1,1),lineMat);
  stripeMesh(red,new T.BoxGeometry(1,1,1),kerbRed);
  stripeMesh(white,new T.BoxGeometry(1,1,1),kerbWhite);
  stripeMesh(posts,new T.BoxGeometry(1,1,1),steel);
  stripeMesh(rails,new T.BoxGeometry(1,1,1),steel);
  const makeBox=(w,h,d,x,y,z,material,ry=0)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.rotation.y=ry;m.castShadow=true;m.receiveShadow=true;root.add(m);return m};
  // Permanently occupied test complex, with glazing, colonnades and solar roof.
  const building=asMat(0xb7bfc4,.75,.24),concrete=asMat(0x676e73,.92),glass=new T.MeshPhysicalMaterial({color:0x253f51,metalness:.35,roughness:.14,transparent:true,opacity:.7});
  makeBox(95,.4,55,270,.17,-62,concrete);
  for(let i=0;i<4;i++){
    const z=-78+i*21;
    makeBox(17,8,14,241,4,z,building);
    makeBox(17,3.1,.16,241,4.9,z+7.12,glass);
    makeBox(20,.38,17,241,8.1,z,dark);
    for(let j=0;j<3;j++)makeBox(4.7,.042,7,233+j*6.9,8.35,z,asMat(0x385367,.26,.35));
  }
  // Wind tunnel hangar and two enormous concrete rocket-blast deflectors.
  makeBox(29,15,57,-220,7.5,-225,building);
  makeBox(27,12,.14,-220,6,-196.4,glass);
  makeBox(32,.4,61,-220,15.1,-225,dark);
  const platform=new T.Mesh(new T.CylinderGeometry(13,13,.7,64),concrete);platform.position.set(-210,.35,-320);platform.receiveShadow=true;root.add(platform);
  for(const sign of [-1,1]){
    const reflector=new T.Mesh(new T.CylinderGeometry(5.6,5.6,.65,32),steel);
    reflector.rotation.z=Math.PI/2;reflector.position.set(-210+sign*9,6.2,-320);root.add(reflector);
    const tube=new T.Mesh(new T.CylinderGeometry(4.3,4.3,5.6,32,1,true),dark);tube.rotation.z=Math.PI/2;tube.position.set(-210+sign*9,6.2,-320);root.add(tube);
  }
  // Solar test-roof, lighting, communications spires and dense desert flora.
  const solar=asMat(0x102a42,.16,.48),vegetation=asMat(0x4c6656,.96),stems=asMat(0x625642,.95),rocks=asMat(0x67635c,.99);
  const solarPanels=[];
  for(let col=0;col<9;col++)for(let row=0;row<7;row++)solarPanels.push([-255+col*6,.42,-48+row*5,4.5,.12,3.7]);
  stripeMesh(solarPanels,new T.BoxGeometry(1,1,1),solar);
  const rand=(seed)=>{let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296)};const random=rand(2026);
  const trunks=[],leaves=[],pebbles=[];
  for(let i=0;i<950;i++){
    const x=(random()-.5)*750+65,z=(random()-.5)*740-212;
    if(circuitDistance(x,z)<22||Math.abs(x-64)<15&&z>-326&&z<90||x>217&&x<302&&z>-100&&z<10)continue;
    const scale=.45+random()*1.2;
    if(random()<.4){trunks.push([x,.7*scale,z,.12*scale,1.4*scale,.13*scale]);leaves.push([x,1.5*scale,z,.8*scale,1.8*scale,.8*scale]);}
    else pebbles.push([x,.11*scale,z,1.1*scale,.17*scale,.75*scale]);
  }
  stripeMesh(trunks,new T.BoxGeometry(1,1,1),stems);stripeMesh(leaves,new T.DodecahedronGeometry(1,0),vegetation);stripeMesh(pebbles,new T.DodecahedronGeometry(1,0),rocks);
  const towers=[],heads=[];
  for(let i=0;i<totalSamples;i+=32){const {p,nx,nz}=pts[i];for(const side of [-1,1]){
    towers.push([p.x+nx*18*side,7.3,p.z+nz*18*side,.26,14.6,.26]);
    heads.push([p.x+nx*18*side,14.8,p.z+nz*18*side,1.6,.22,.8]);
  }}
  stripeMesh(towers,new T.BoxGeometry(1,1,1),steel);stripeMesh(heads,new T.BoxGeometry(1,1,1),lamp);
  // Finish gantry over the track, plus two elevated grandstand structures.
  const start=pts[4];makeBox(27,.75,.8,start.p.x,7.9,start.p.z,steel);for(const side of [-1,1])makeBox(.7,15,.7,start.p.x+start.nx*13*side,7.5,start.p.z+start.nz*13*side,steel);
  for(let j=0;j<2;j++){
    const x=-30+j*45,z=-56;makeBox(38,5,16,x,2.8,z,building);makeBox(38,.2,19,x,5.4,z,dark);
    for(let k=0;k<5;k++)makeBox(35,.24,2.2,x,1+k*.7,z+7-k*2,steel);
  }
  root.userData={circuitLength:Math.round(trackCurve.getLength()),roadWidth:24,objectCount:root.children.length};
  return root;
}