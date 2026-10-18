import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDynamicsState,stepResearch} from '../game/research.mjs';
import {createSuspension,suspensionStep} from '../game/suspension.mjs';
import {makeVehicleDynamics,VEHICLE,stepRoadVehicle} from '../game/vehicle.mjs';
function run(seconds,input={},config={}){
 const s=Object.assign(makeDynamicsState(),config),a=createSuspension();
 for(let i=0;i<Math.round(seconds*120);i++){
  stepResearch(s,input,1/120);
  suspensionStep(a,s,1/120,{mass:2160});s.suspension=a;
 }
 return {s,a,d:s.drivetrain};
}
test('deterministic fixed-step ground dynamics',()=>{
 const x=run(3,{throttle:true,left:true}),y=run(3,{throttle:true,left:true});
 for(const key of ['x','z','yaw','vx','vz','speed'])assert.ok(Math.abs(x.s[key]-y.s[key])<1e-11,key);
});
test('AWD traction accelerates a car without rail-guided steering',()=>{
 const {s,d}=run(5,{throttle:true});
 assert.ok(s.speed>20&&s.speed<35,s.speed);
 assert.ok(Math.abs(s.yaw)<1e-9);assert.ok(s.z<30);
 assert.ok(d.wheelOmega.every(Number.isFinite));
});
test('yaw comes from lateral contact-patch forces; steering cannot spin a stationary car',()=>{
 const idle=run(3,{left:true});assert.ok(Math.abs(idle.s.yaw)<.001,idle.s.yaw);
 const moving=run(3,{left:true,throttle:true});assert.ok(moving.s.yaw>.3);
 assert.ok(moving.d.slipAngles.some(a=>Math.abs(a)>.025));
});
test('accelerating transfers weight rearward through CG height and suspension',()=>{
 const {a,d}=run(4,{throttle:true});
 assert.ok(d.wheelLoads[2]+d.wheelLoads[3]>d.wheelLoads[0]+d.wheelLoads[1]);
 assert.ok(a.pitch>0,a.pitch);
});
test('braking transfers weight frontward and heats brake discs',()=>{
 const {s,a,d}=run(2.2,{brake:true},{vz:-26});
 assert.ok(s.speed<12,s.speed);assert.ok(d.wheelLoads[0]+d.wheelLoads[1]>d.wheelLoads[2]+d.wheelLoads[3]);
 assert.ok(a.pitch<0,a.pitch);assert.ok(d.brakeTemperature[0]>28);
});
test('wet grip materially increases stopping distance',()=>{
 const dry=run(2.2,{brake:true},{vz:-30,roadMu:1.06});
 const wet=run(2.2,{brake:true},{vz:-30,roadMu:.42});
 assert.ok(wet.s.speed>dry.s.speed+4,`${wet.s.speed} vs ${dry.s.speed}`);
 assert.ok(wet.s.z<dry.s.z-4,`${wet.s.z} vs ${dry.s.z}`);
});
test('combined-slip tires limit longitudinal and lateral grip together',()=>{
 const s=makeDynamicsState();s.vz=-22;s.drivetrain=makeVehicleDynamics();
 stepRoadVehicle(s,{throttle:true,left:true},1/120);
 for(let i=0;i<4;i++){
  const fx=s.drivetrain.tireForceX[i],fy=s.drivetrain.tireForceY[i],cap=VEHICLE.friction*s.drivetrain.wheelLoads[i];
  assert.ok(Math.hypot(fx,fy)<=cap+1e-8);
 }
});
test('traction energy depletes battery, deceleration regenerates energy',()=>{
 const go=run(4,{throttle:true});
 assert.ok(go.d.soc<88&&go.d.powerKw>50);
 const initial=go.d.soc;
 for(let i=0;i<60;i++){stepResearch(go.s,{brake:true},1/120);suspensionStep(go.a,go.s,1/120);go.s.suspension=go.a;}
 assert.ok(go.d.regenKw>0&&go.d.soc>initial,`${go.d.soc} from ${initial}`);
});
test('ABS caps emergency braking at low-grip road load',()=>{
 const {d}=run(.4,{brake:true},{vz:-27,roadMu:.24});
 assert.equal(d.absActive,true);
 assert.ok(d.tireForceX.every(Number.isFinite));
});
test('guardrail contact changes velocity and damages chassis without resetting the mission',()=>{
 const s=makeDynamicsState();s.x=73.9;s.vx=12;s.vz=-3;
 stepResearch(s,{},1/120);stepResearch(s,{},1/120);
 assert.ok(s.x<=74&&s.drivetrain.contactImpacts>0);
 assert.ok(s.structural<100&&s.vx<0);
 assert.equal(s.completed,false);
});
test('wheel rotation and contact loads remain finite through washboard',()=>{
 const {a,d}=run(6,{throttle:true});
 assert.ok(a.wheelSpin.every(Number.isFinite));
 assert.ok(a.normalForces.every(x=>Number.isFinite(x)&&x>=0));
 assert.ok(d.tireTemperature.every(x=>x>=10&&x<=145));
});