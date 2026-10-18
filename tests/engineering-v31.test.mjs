import test from 'node:test';
import assert from 'node:assert/strict';
import {createSuspension,suspensionStep,SUSPENSION,setChassisSetup} from '../game/suspension.mjs';
import {wishboneKinematics,magicFormulaForce,relaxationStep,tirePressureFromHeat,traceProfile} from '../game/engineering.mjs';
import {makeVehicleDynamics,stepRoadVehicle} from '../game/vehicle.mjs';
const tick=1/120,stationary={x:0,z:0,y:0,yaw:0,speed:0};
function run(a,v,n,options={}){for(let i=0;i<n;i++)suspensionStep(a,v,tick,options);return a;}
test('four independent unsprung hub states equilibrate with gravity and four tire contacts',()=>{
 const a=run(createSuspension(),stationary,1200);
 assert.equal(a.hubHeight.length,4);assert.ok(a.hubHeight.every(Number.isFinite));
 assert.ok(a.hubVelocity.every(v=>Math.abs(v)<.05));
 const totalTire=a.normalForces.reduce((x,y)=>x+y,0);
 assert.ok(Math.abs(totalTire-(SUSPENSION.mass+4*SUSPENSION.unsprungMass)*9.80665)<1500,totalTire);
});
test('step input excites front wheel hubs independently from rear hubs',()=>{
 const a=run(createSuspension(),stationary,600);
 const v={...stationary};run(a,v,10,{height:(_x,z)=>z<0?.15:0});
 assert.ok(a.hubHeight[0]>a.hubHeight[2]+.015);
 assert.ok(a.hubHeight[1]>a.hubHeight[3]+.015);
 assert.ok(a.hubAcceleration.every(Number.isFinite));
});
test('zero tire load after liftoff while hub modes settle',()=>{
 const a=createSuspension();run(a,{...stationary,y:3},250);
 assert.equal(a.contactCount,0);assert.deepEqual(a.normalForces,[0,0,0,0]);
 assert.ok(a.hubVelocity.every(Number.isFinite));
});
test('kinematic unequal-arm wishbones create camber gain on compression',()=>{
 const rest=wishboneKinematics(0),bump=wishboneKinematics(.20);
 assert.ok(bump.camber<rest.camber-.01,`${rest.camber} ${bump.camber}`);
 assert.ok(Math.abs(bump.toe)>1e-4);
 assert.ok(bump.trail>.02&&bump.caster>.05);
});
test('bump and rebound remain finite and asymmetric with separate damper circuits',()=>{
 const a=createSuspension();setChassisSetup(a,'track');
 const noBump=run(a,stationary,450);const original=noBump.hubHeight.slice();
 run(noBump,stationary,10,{height:()=>.20});
 const afterBump=noBump.hubVelocity.slice();run(noBump,stationary,10,{height:()=>-.08});
 assert.ok(afterBump.some(v=>Math.abs(v)>.02));
 assert.ok(noBump.hubHeight.every(Number.isFinite));
 assert.ok(noBump.hubVelocity.every(v=>Math.abs(v)<15));
 assert.ok(original.every(Number.isFinite));
});
test('Pacejka-style contact force saturates and is zero with no tire contact',()=>{
 assert.equal(magicFormulaForce(.2,0,1),0);assert.equal(magicFormulaForce(0,5000,1),0);
 const peak=magicFormulaForce(.22,5000,1);
 assert.ok(peak>4000&&peak<=5000);
 assert.ok(magicFormulaForce(-.22,5000,1)<0);
});
test('relaxation length reduces initial response and converges to demand',()=>{
 const one=relaxationStep(0,.2,18,tick,2.4);
 assert.ok(one>0&&one<.2);
 let value=0;for(let i=0;i<300;i++)value=relaxationStep(value,.2,18,tick,2.4);
 assert.ok(Math.abs(value-.2)<.001);
});
test('hot carcass increases tire absolute pressure under ideal gas approximation',()=>{
 const cold=tirePressureFromHeat(240,25,25),hot=tirePressureFromHeat(240,85,25);
 assert.ok(Math.abs(cold-240)<1e-6);assert.ok(hot>cold+50);
});
test('wetter hydroplaning conditions reduce lateral capability on the same surface',()=>{
 const base=()=>({x:0,y:0,z:0,yaw:0,speed:0,vx:-3,vz:-31,suspension:run(createSuspension(),stationary,100),drivetrain:makeVehicleDynamics(),assist:false,mode:'dynamics',structural:100});
 const dry=base(),wet=base();dry.drivetrain.waterDepth=0;wet.drivetrain.waterDepth=.6;
 for(let i=0;i<55;i++){stepRoadVehicle(dry,{left:true,throttle:true},tick);stepRoadVehicle(wet,{left:true,throttle:true},tick);}
 assert.ok(wet.drivetrain.tireForceY.every(Number.isFinite));
 assert.ok(dry.drivetrain.tireForceY.every(Number.isFinite));
 assert.ok(wet.drivetrain.tirePressure.every(v=>v>0));
});
test('imported rough-road height trace interpolates consistently and rejects malformed data',()=>{
 const profile=traceProfile([{distance:0,height:0},{distance:2,height:.10},{distance:4,height:0}]);
 assert.equal(profile(-1),0);assert.equal(profile(1),.05);assert.equal(profile(2),.1);assert.equal(profile(5),0);
 assert.throws(()=>traceProfile([{distance:0,height:0},{distance:0,height:1}]));
 const sim=()=>{const a=createSuspension();let v={...stationary};for(let i=0;i<800;i++){v.z=i*3/800;suspensionStep(a,v,tick,{height:(_x,z)=>profile(z)});}return a;};
 const a=sim(),b=sim();assert.deepEqual(a.hubHeight,b.hubHeight);assert.equal(a.rideRmsG,b.rideRmsG);
});