import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrbitState,orbitPose,orbitDrag,orbitPan,orbitZoom,resetOrbit,ORBIT_LIMITS} from '../game/orbit.mjs';

test('free orbit rotates all the way around the target without coupling to vehicle steering',()=>{
 const s=resetOrbit(createOrbitState(),0),before=orbitPose(s,{x:64,y:1,z:70});
 orbitDrag(s,-160,0);const after=orbitPose(s,{x:64,y:1,z:70});
 assert.notEqual(before.position.x,after.position.x);
 assert.deepEqual(before.target,after.target);
});
test('vertical rotation clamps away from camera flip and division by zero',()=>{
 const s=createOrbitState();orbitDrag(s,0,100000);assert.equal(s.elevation,ORBIT_LIMITS.maxElevation);
 orbitDrag(s,0,-200000);assert.equal(s.elevation,ORBIT_LIMITS.minElevation);
 for(const sign of [-1,1]){orbitDrag(s,sign*1e7,0);const p=orbitPose(s,{x:0,y:0,z:0});assert.ok(Object.values(p.position).every(Number.isFinite));}
});
test('wheel zoom stays within safe camera distances even under extreme input',()=>{
 const s=createOrbitState();orbitZoom(s,-100000);assert.equal(s.distance,ORBIT_LIMITS.minDistance);
 orbitZoom(s,100000);assert.ok(s.distance>ORBIT_LIMITS.minDistance);
 for(let i=0;i<20;i++)orbitZoom(s,1000);assert.equal(s.distance,ORBIT_LIMITS.maxDistance);
});
test('drag pan moves focus, resetting the orbit centers back on vehicle',()=>{
 const s=resetOrbit(createOrbitState(),.6);orbitPan(s,90,-50);
 const p=orbitPose(s,{x:8,y:2,z:7});assert.ok(Math.hypot(p.target.x-8,p.target.y-2,p.target.z-7)>.1);
 resetOrbit(s,.6);assert.deepEqual(orbitPose(s,{x:8,y:2,z:7}).target,{x:8,y:2,z:7});
});
test('invalid input is ignored, camera controls remain finite',()=>{
 const s=createOrbitState();orbitDrag(s,NaN,4);orbitZoom(s,Infinity);orbitPan(s,1,NaN);
 assert.ok(Object.values(s).every(Number.isFinite));
});