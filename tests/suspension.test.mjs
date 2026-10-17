import test from 'node:test';
import assert from 'node:assert/strict';
import {createSuspension,suspensionStep,surfaceAt,SUSPENSION} from '../game/suspension.mjs';
function run(a,v,secs,step=1/120,options={}){for(let i=0;i<secs/step;i++)suspensionStep(a,v,step,options);return a;}
test('dedicated dynamics mode begins on the damper lane and bypasses certification targets',async()=>{
 const {makeDynamicsState,stepResearch}=await import('../game/research.mjs');
 const s=makeDynamicsState();assert.equal(s.mode,'dynamics');assert.equal(s.x,64);assert.equal(s.z,78);
 for(let i=0;i<240;i++)stepResearch(s,{throttle:true},1/120);
 assert.equal(s.stage,0);assert.equal(s.completed,false);assert.ok(s.z<78);
});
test('nominal four-corner loads support a 2160 kg sprung body without persistent bounce',()=>{
 const a=run(createSuspension(),{x:0,z:0,y:0,yaw:0,speed:0},5);
 assert.equal(a.contactCount,4);assert.ok(Math.abs(a.heave)<.025,`${a.heave}`);
 assert.ok(Math.abs(a.roll)<.015&&Math.abs(a.pitch)<.015);
 assert.ok(Math.abs(a.forceTotal-SUSPENSION.mass*9.80665)<500);
});
test('a raised terrain surface compresses front and rear independently',()=>{
 const a=createSuspension();const v={x:0,z:0,y:0,yaw:0,speed:0};
 suspensionStep(a,v,1/120,{height:(x,z)=>z<0?.18:0});
 assert.ok(a.normalForces[0]>a.normalForces[2],`${a.normalForces}`);
 assert.ok(a.normalForces[1]>a.normalForces[3]);
});
test('left wheel rut induces body roll while forces settle into equilibrium',()=>{
 const a=createSuspension();const v={x:0,z:0,y:0,yaw:0,speed:0};
 run(a,v,1,1/120,{height:(x)=>x<0?.08:0});
 assert.ok(Math.abs(a.roll)>.004,`${a.roll}`);
 assert.ok(a.contactCount===4); // static equilibrium redistributes displacement into roll
});
test('skyborne vehicle has no positive wheel normal forces',()=>{
 const a=run(createSuspension(),{x:0,y:8,z:0,yaw:0,speed:42},2);
 assert.equal(a.contactCount,0);assert.ok(a.normalForces.every(f=>f===0));
 assert.ok(Math.abs(a.heave)<.02);
});
test('terrain is level on hover pad; proving ground has staggered physical bumps',()=>{
 assert.equal(surfaceAt(0,42),0);assert.equal(surfaceAt(60,0),0);
 assert.ok(surfaceAt(64,57)>.18);assert.ok(surfaceAt(64,55)<.05);
 assert.ok(surfaceAt(64,-24.6)>.005);assert.ok(surfaceAt(66,-96)>.06);
});
test('simulation is stable with 120Hz updates and finite under severe uneven terrain',()=>{
 const a=createSuspension(),v={x:64,y:0,z:58,yaw:0,speed:25};
 for(let i=0;i<1200;i++){v.z=58-i*.045;suspensionStep(a,v,1/120);}
 assert.ok([a.heave,a.pitch,a.roll,a.maxCompression,a.grip].every(Number.isFinite));
 assert.ok(a.maxCompression<=SUSPENSION.maxCompression+1e-9);
 assert.ok(Math.abs(a.roll)<=.28&&Math.abs(a.pitch)<=.23);
});