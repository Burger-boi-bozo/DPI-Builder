import test from 'node:test';
import assert from 'node:assert/strict';
// CPU-level geometry verification: no WebGL framebuffer required.
globalThis.document ??= {createElement:()=>({width:0,height:0,getContext:()=>({fillText(){},fillStyle:'',font:'',textAlign:'',textBaseline:''})})};
const {makeCar}=await import('../game/scene.mjs');
test('roadster has a detailed finite PBR body with four separately steerable wheels',()=>{
 const car=makeCar();let meshes=0,verts=0,nonfinite=0,physical=0;
 car.traverse(o=>{
  if(!o.isMesh)return;meshes++;
  if(o.material?.isMeshPhysicalMaterial)physical++;
  const pos=o.geometry.attributes.position;verts+=pos.count;
  for(let i=0;i<pos.count;i++)if(!Number.isFinite(pos.getX(i))||!Number.isFinite(pos.getY(i))||!Number.isFinite(pos.getZ(i)))nonfinite++;
 });
 assert.ok(meshes>=200,`models ${meshes}`);assert.ok(verts>=9000,`vertices ${verts}`);
 assert.ok(physical>=3,`PBR meshes ${physical}`);assert.equal(nonfinite,0);
 assert.equal(car.userData.wheels.length,4);assert.equal(car.userData.springs.length,4);
 for(const {carrier,wheel} of car.userData.springs.map((a,i)=>({...a,wheel:car.userData.wheels[i]}))){
   assert.equal(wheel.parent,carrier);
   assert.ok(carrier.children.some(child=>child.isMesh),'carrier has stationary suspension detail');
 }
});
test('simple distant model reduces draw calls while retaining wheels and body',()=>{
 const car=makeCar(0xc0a0e0,true);let meshes=0;
 car.traverse(o=>{if(o.isMesh)meshes++});
 assert.ok(meshes<160,`distant model ${meshes}`);
 assert.equal(car.userData.wheels.length,4);
});
test('vehicle exposes four separate heat-responsive rotors and isolated brake-lamp material',()=>{
 const one=makeCar(),two=makeCar(0xc0a0e0,true);
 assert.equal(one.userData.brakeRotors.length,4);
 assert.ok(one.userData.brakeRotors.every(o=>o.isMesh&&o.material.isMeshStandardMaterial));
 assert.ok(one.userData.brakeLamp.isMeshBasicMaterial);
 assert.notEqual(one.userData.brakeLamp,two.userData.brakeLamp,'changing the player brake lamp must not recolor NPC cars');
});