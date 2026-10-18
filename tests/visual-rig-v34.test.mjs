import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document ??={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};
import * as T from '../game/three.module.min.js';
const {makeCar}=await import('../game/scene.mjs');
const {ROADSTER_WHEEL_BINDINGS,driveVisualWheelRig,assertRigNodes}=await import('../game/roadster-model.mjs');
test('canonical visual order FL FR RL RR matches all four simulated contact patches',()=>{
 const car=makeCar();const centers=car.userData.springs.map(p=>p.carrier.position);
 assert.deepEqual(car.userData.visualWheelOrder,['FL','FR','RL','RR']);
 assert.ok(centers[0].x<0&&centers[1].x>0&&centers[2].x<0&&centers[3].x>0);
 assert.ok(centers[0].z<0&&centers[1].z<0&&centers[2].z>0&&centers[3].z>0);
});
test('licensed Tesla wheel bindings match front and rear brake components',()=>{
 assert.deepEqual(ROADSTER_WHEEL_BINDINGS.map(b=>b.corner),['FL','FR','RL','RR']);
 assert.deepEqual(ROADSTER_WHEEL_BINDINGS.map(b=>b.front),[true,true,false,false]);
 const root={getObjectByName:name=>({name})};assert.equal(assertRigNodes(root),true);
 assert.throws(()=>assertRigNodes({getObjectByName:name=>name==='TRDEF-WheelFtR'?null:{}}));
});
test('imported visual pivots steer BOTH front tires and NEVER steer rear tires',()=>{
 const rig=Array.from({length:4},(_,i)=>({steer:new T.Group(),spin:new T.Group(),y0:i,corner:ROADSTER_WHEEL_BINDINGS[i].corner}));
 const root=new T.Group();rig.forEach(q=>root.add(q.steer));root.updateMatrixWorld(true);
 driveVisualWheelRig(T,rig,[.33,.27],[-.02,-.02,-.04,-.04],[.06,.08,-.03,.02],[1,2,3,4]);
 assert.ok(rig[0].steer.rotation.y<-.32&&rig[1].steer.rotation.y<-.26);
 assert.equal(rig[2].steer.rotation.y,0);assert.equal(rig[3].steer.rotation.y,0);
 assert.ok(Math.abs(rig[1].steer.position.y-(1+.08))<1e-6);
 assert.deepEqual(rig.map(q=>q.spin.rotation.x),[1,2,3,4]);
});