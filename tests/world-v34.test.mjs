import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../game/three.module.min.js';
import {createAutodrome} from '../game/world-v34.mjs';
import {CIRCUIT_POINTS,circuitDistance,surfaceGripAt} from '../game/range.mjs';
test('the new closed loop has enough distinct sections to avoid a rectangle-shaped playground',()=>{
 assert.ok(CIRCUIT_POINTS.length>=12);
 assert.ok(Math.max(...CIRCUIT_POINTS.map(x=>x[0]))-Math.min(...CIRCUIT_POINTS.map(x=>x[0]))>350);
 assert.ok(Math.max(...CIRCUIT_POINTS.map(x=>x[1]))-Math.min(...CIRCUIT_POINTS.map(x=>x[1]))>400);
 for(const [x,z] of CIRCUIT_POINTS)assert.ok(circuitDistance(x,z)<1e-6);
});
test('track is a single triangulated road surface with curb meshes and site facilities',()=>{
 const scene=new T.Scene(),root=createAutodrome(T,scene);
 assert.ok(root.userData.circuitLength>900);
 assert.ok(root.children.length>15);
 const pavement=root.children.find(o=>o.isMesh&&o.geometry.type==='BufferGeometry');
 assert.equal(pavement.geometry.index.count,400*6);
 const p=pavement.geometry.attributes.position;
 for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getZ(i)));
});
test('new track grip and original proving ground friction are deterministic',()=>{
 for(const p of [[0,0],[64,-240],[220,-320],[-100,-35]]){
  assert.equal(surfaceGripAt(...p),surfaceGripAt(...p));
 }
});