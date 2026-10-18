// Tesla Roadster 2020 by metarex.4d, CC BY 4.0, republished with attribution:
// https://sketchfab.com/3d-models/tesla-roadster-2020-1fbf29e297bd4a17ac39a00a378441d8
// Source archive: https://github.com/stevenzhang070302/tesla-roadster-webgi
// This is a licensed visual asset, NOT a physics collision mesh.

export const ROADSTER_WHEEL_BINDINGS=Object.freeze([
  Object.freeze({name:'TRDEF-WheelFtL',brake:'TRDEF-WheelBrakeFtL',corner:'FL',front:true}),
  Object.freeze({name:'TRDEF-WheelFtR',brake:'TRDEF-WheelBrakeFtR',corner:'FR',front:true}),
  Object.freeze({name:'TRDEF-WheelBkL',brake:'TRDEF-WheelBrakeBkL',corner:'RL',front:false}),
  Object.freeze({name:'TRDEF-WheelBkR',brake:'TRDEF-WheelBrakeBkR',corner:'RR',front:false})
]);

export function assertRigNodes(root){
  if(!root?.getObjectByName)throw Error('GLTF scene not available');
  for(const wheel of ROADSTER_WHEEL_BINDINGS){if(!root.getObjectByName(wheel.name))throw Error(`Licensed Roadster missing ${wheel.name}`);}
  return true;
}

export function driveVisualWheelRig(T,rig,angles,camber,travel,spin){
  if(!Array.isArray(rig)||rig.length!==4)return;
  for(let i=0;i<4;i++){
    const q=rig[i];
    q.steer.rotation.y=i<2?-(angles?.[i]||0):0;
    q.steer.rotation.z=camber?.[i]||0;
    // Wheel hub position follows the independent suspension state; conversion
    // from metres to glTF local units accounts for transform inheritance.
    const scl=q.steer.parent.getWorldScale(new T.Vector3());
    q.steer.position.y=q.y0+(travel?.[i]||0)/Math.max(.01,Math.abs(scl.y));
    q.spin.rotation.x=spin?.[i]||0;
  }
}

export async function upgradeRoadsterVisual(T,car,{url='./roadster-2020.glb',onStatus=()=>{}}={}){
  try{
    // Keep import dynamic so browser loading failures cannot stop flight/physics
    // and the CPU-only test runner can still import the game without WebGL.
    const [{GLTFLoader},{DRACOLoader}]=await Promise.all([import('./GLTFLoader.js'),import('./DRACOLoader.js')]);
    const draco=new DRACOLoader();draco.setDecoderPath('./draco/');
    const loader=new GLTFLoader();loader.setDRACOLoader(draco);
    const gltf=await loader.loadAsync(url);
    const source=gltf.scene;assertRigNodes(source);
    const body=car.userData.body;
    const imported=new T.Group();imported.name='Roadster 2020 / licensed exterior + interior';body.add(imported);imported.add(source);
    imported.rotation.y=Math.PI;
    imported.updateMatrixWorld(true);
    const wheelNodes=ROADSTER_WHEEL_BINDINGS.map(b=>source.getObjectByName(b.name));
    const worldPos=node=>body.worldToLocal(node.getWorldPosition(new T.Vector3()));
    const before=wheelNodes.map(worldPos);
    const sep=(before[0].distanceTo(before[2])+before[1].distanceTo(before[3]))/2;
    if(!(sep>0.5&&sep<12))throw Error('Invalid imported wheelbase '+sep);
    imported.scale.setScalar(2.93/sep);
    imported.updateMatrixWorld(true);
    const coords=wheelNodes.map(worldPos);
    const cx=coords.reduce((v,p)=>v+p.x,0)/4,cy=coords.reduce((v,p)=>v+p.y,0)/4,cz=coords.reduce((v,p)=>v+p.z,0)/4;
    imported.position.set(-cx,.45-cy,-cz);imported.updateMatrixWorld(true);
    const rig=ROADSTER_WHEEL_BINDINGS.map((binding,i)=>{
      const wheel=wheelNodes[i],caliper=source.getObjectByName(binding.brake),parent=wheel.parent;
      const pivot=new T.Group();pivot.name='DYNAMIC_'+binding.corner+'_STEERING_HUB';pivot.position.copy(wheel.position);
      parent.add(pivot);
      const spin=new T.Group();spin.name='DYNAMIC_'+binding.corner+'_WHEEL_SPIN';pivot.add(spin);
      wheel.position.set(0,0,0);spin.add(wheel);
      if(caliper){pivot.attach(caliper);} // brake hardware steers, not spins
      return {corner:binding.corner,steer:pivot,spin,y0:pivot.position.y};
    });
    // The imported car replaces the old simplified chassis in one atomic step.
    // Preserve fallback until all four independently steerable hubs are ready.
    const procedurals=body.children.filter(n=>n!==imported&&!n.userData?.keepWhenRealModel);
    for(const child of procedurals)child.visible=false;
    source.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
    car.userData.importedWheelRig=rig;
    car.userData.importedCar=imported;
    car.userData.visualAsset='metarex.4d Tesla Roadster 2020 (CC BY 4.0)';
    onStatus('DETAILED ROADSTER MODEL');
    draco.dispose();
    return true;
  }catch(error){onStatus('PROCEDURAL FALLBACK');console.warn('Roadster model unavailable, retaining fallback',error);return false;}
}