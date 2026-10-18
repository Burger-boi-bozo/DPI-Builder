import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState,step} from '../game/physics.mjs';
import {WORLD_BOUNDS,CIRCUIT_POINTS} from '../game/range.mjs';
const source=readFileSync(new URL('../game/game.mjs',import.meta.url),'utf8');
test('rendered wheel animation helper is actually imported by main gameplay',()=>{
 assert.match(source,/import\s*\{\s*driveVisualWheelRig\s*\}\s*from\s*['"]\.\/roadster-model\.mjs['"]/);
 assert.match(source,/driveVisualWheelRig\(T,car\.userData\.importedWheelRig/);
});
test('free roam never resets for any point on the new closed circuit',()=>{
 for(const [x,z] of CIRCUIT_POINTS){
   const s=createState('free');s.x=x;s.z=z;s.speed=0;
   const out=step(s,{},1/120);
   assert.ok(!out.some(e=>e.type==='boundary'),`unexpected boundary at ${x},${z}`);
   assert.equal(s.resets,0);
 }
});
test('playable boundaries include the new road network but still reject far-away positions',()=>{
 assert.ok(Math.min(...CIRCUIT_POINTS.map(p=>p[1]))>WORLD_BOUNDS.minZ);
 assert.ok(Math.max(...CIRCUIT_POINTS.map(p=>p[0]))<WORLD_BOUNDS.maxX);
 const s=createState('free');s.x=WORLD_BOUNDS.maxX+5;
 assert.ok(step(s,{},1/120).some(e=>e.type==='boundary'));
 assert.equal(s.x,0);
});
test('the unrelated 2020 model is never loaded by default',()=>{
 const scene=readFileSync(new URL('../game/scene.mjs',import.meta.url),'utf8');
 assert.match(scene,/get\('legacy-roadster'\)===['"]2020['"]/);
 assert.match(scene,/use2020Model\?upgradeRoadsterVisual/);
});