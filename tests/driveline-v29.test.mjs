import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDynamicsState,stepResearch} from '../game/research.mjs';
import {createSuspension,suspensionStep} from '../game/suspension.mjs';
import {stepRoadVehicle,effectiveTireMu,makeVehicleDynamics} from '../game/vehicle.mjs';
const DT=1/120;
function scenario(duration,input={},initial={},tcs=true){
 const s=Object.assign(makeDynamicsState(),initial),a=createSuspension();s.drivetrain=makeVehicleDynamics();s.drivetrain.tcsEnabled=tcs;
 for(let i=0;i<duration*120;i++){
  stepResearch(s,input,DT);suspensionStep(a,s,DT);s.suspension=a;
 }
 return {s,a,d:s.drivetrain};
}
test('braking at a standstill does not generate reverse propulsion',()=>{
 const r=scenario(.25,{brake:true});
 assert.equal(r.d.gear,'D');assert.ok(r.s.speed<.01,`creep ${r.s.speed}`);
});
test('hold reverse at a stop to engage R; vehicle moves backwards under power',()=>{
 const r=scenario(2.4,{brake:true});
 assert.equal(r.d.gear,'R');assert.ok(r.d.velocityForward<-.8,`reverse vf ${r.d.velocityForward}`);
 assert.ok(r.s.z>78.3);assert.ok(r.d.soc<88);
});
test('direction cannot switch while moving, but switches after coming to a stop',()=>{
 const s=makeDynamicsState();s.vz=-25;s.drivetrain=makeVehicleDynamics();
 for(let i=0;i<100;i++)stepRoadVehicle(s,{brake:true},DT);
 assert.equal(s.drivetrain.gear,'D');assert.ok(s.drivetrain.velocityForward>5);
 s.vx=0;s.vz=0;s.drivetrain.velocityForward=0;
 for(let i=0;i<65;i++)stepRoadVehicle(s,{brake:true},DT);
 assert.equal(s.drivetrain.gear,'R');
 for(let i=0;i<15;i++)stepRoadVehicle(s,{throttle:true},DT);
 assert.equal(s.drivetrain.gear,'R');
});
test('TCS limits delivered motor torque on wet surface under excessive slip',()=>{
 const on=scenario(2.5,{throttle:true},{roadMu:.24},true);
 const off=scenario(2.5,{throttle:true},{roadMu:.24},false);
 assert.equal(on.d.tcsActive,true);assert.ok(on.d.torqueLimit<.75,`TCS limited ${on.d.torqueLimit}`);
 assert.equal(off.d.tcsActive,false);assert.equal(off.d.torqueLimit,1);
 assert.ok(on.d.tireWear[0]<off.d.tireWear[0],`wear ${on.d.tireWear[0]} vs ${off.d.tireWear[0]}`);
});
test('tire degradation is monotonic and reduces adhesion without breaking load bounds',()=>{
 const fresh=effectiveTireMu(1.06,62,5300,28,0),old=effectiveTireMu(1.06,62,5300,28,.95);
 assert.ok(old<fresh*.72&&old>0);
 const r=scenario(4,{throttle:true},{roadMu:.25},false);
 assert.ok(r.d.tireWear.every(w=>w>0&&w<1));
 assert.ok(r.d.wheelLoads.every(n=>n>=0&&n<22001));
});
test('reverse-to-drive re-engagement requires near-zero forward velocity',()=>{
 const s=makeDynamicsState();s.drivetrain=makeVehicleDynamics();s.drivetrain.gear='R';s.vz=8;
 for(let i=0;i<45;i++)stepRoadVehicle(s,{throttle:true},DT);
 assert.equal(s.drivetrain.gear,'R');
 s.vx=0;s.vz=0;
 for(let i=0;i<70;i++)stepRoadVehicle(s,{throttle:true},DT);
 assert.equal(s.drivetrain.gear,'D');
});