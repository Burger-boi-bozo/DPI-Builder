import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document ??= {createElement:()=>({width:0,height:0,getContext:()=>({fillText(){},fillStyle:'',font:'',textAlign:'',textBaseline:''})})};
const {makeCar}=await import('../game/scene.mjs');
test('expanded Roadster has articulated four-corner arms, interior and steering hardware',()=>{
 const car=makeCar();
 assert.equal(car.userData.wheels.length,4);
 assert.equal(car.userData.controlLinks.length,16);
 assert.ok(car.userData.steerWheel.isGroup);
 let meshes=0,toruses=0,invalid=0;
 car.traverse(n=>{if(n.isMesh){meshes++;if(n.geometry.type==='TorusGeometry')toruses++;
  const p=n.geometry.attributes.position;if(p)for(let i=0;i<p.count;i++)if(!Number.isFinite(p.getX(i))||!Number.isFinite(p.getY(i))||!Number.isFinite(p.getZ(i)))invalid++;
 }});
 assert.ok(meshes>90,`meshes: ${meshes}`);assert.ok(toruses>=10,`fender/wheel toruses ${toruses}`);assert.equal(invalid,0);
});
test('lightweight ghost car retains wheel steering pivots',()=>{
 const ghost=makeCar(0xb9c8e1,true);
 assert.equal(ghost.userData.springs.length,4);
 assert.ok(ghost.userData.steerWheel);
});