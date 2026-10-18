import test from 'node:test';
import assert from 'node:assert/strict';
import {PT,motorTorqueCurve,batteryPowerLimits,motorAxleForce,advanceActuator,brakeBlend,allocateMotorForces,longitudinalMagic,combinedTireLimit,rotationalStep,advanceMeasurements} from '../game/powertrain.mjs';
import {makeDynamicsState,stepResearch} from '../game/research.mjs';
import {createSuspension,suspensionStep} from '../game/suspension.mjs';
const DT=1/120;
function run(seconds,input,initial={}){const s=Object.assign(makeDynamicsState(),initial),a=createSuspension();s.suspension=a;
 for(let j=0;j<Math.round(seconds/DT);j++){stepResearch(s,input,DT);suspensionStep(a,s,DT);}
 return {s,a,d:s.drivetrain};}
test('front/rear motors have independent torque-speed envelopes and valid redlines',()=>{
 assert.ok(motorTorqueCurve(0,'front')>400);
 assert.ok(motorTorqueCurve(0,'rear')>motorTorqueCurve(0,'front'));
 assert.ok(motorTorqueCurve(9000,'front')<motorTorqueCurve(3000,'front'));
 assert.equal(motorTorqueCurve(20000,'rear'),0);
 assert.equal(motorTorqueCurve(NaN,'front'),0);
});
test('motor drive-force demand declines monotonically as speed reaches governed maximum',()=>{
 const speeds=[0,10,30,45,65,95],forces=speeds.map(v=>motorAxleForce(v,80,30,'rear'));
 assert.ok(forces[0]>0 && forces[1]>0);
 assert.ok(forces[5]<forces[1]/10);
 for(const x of forces)assert.ok(Number.isFinite(x)&&x>=0);
});
test('battery protects against cold, heat, low SOC and limits regen at high SOC',()=>{
 const baseline=batteryPowerLimits(70,30);
 assert.ok(batteryPowerLimits(1,30).dischargeW<baseline.dischargeW);
 assert.ok(batteryPowerLimits(75,83).dischargeW<baseline.dischargeW);
 assert.ok(batteryPowerLimits(75,-15).dischargeW<baseline.dischargeW);
 assert.ok(batteryPowerLimits(99,30).chargeW<baseline.chargeW);
 assert.equal(batteryPowerLimits(100,30).chargeW,0);
});
test('hydraulic brake pressure has finite rise/release times with no overshoot',()=>{
 let v=0;
 for(let i=0;i<10;i++)v=advanceActuator(v,1,DT,PT.hydraulicRise,PT.hydraulicRelease);
 assert.ok(v>0.5&&v<1);
 const old=v;
 for(let i=0;i<10;i++)v=advanceActuator(v,0,DT,PT.hydraulicRise,PT.hydraulicRelease);
 assert.ok(v>0&&v<old);
});
test('regeneration is speed, battery and driver-pressure limited',()=>{
 assert.equal(brakeBlend(1,0,40,30).regenForceN,0);
 const middle=brakeBlend(1,20,40,30);
 assert.ok(middle.regenForceN>0&&middle.regenForceN<=PT.regenForceCapN);
 assert.ok(middle.frictionForceN+middle.regenForceN-middle.requestedForceN<1e-9);
 assert.equal(brakeBlend(1,20,100,30).regenForceN,0);
});
test('motor vectoring is symmetric and never creates artificial net drive force',()=>{
 const a=allocateMotorForces(12000,.4,.23,true),b=allocateMotorForces(12000,-.4,-.23,true);
 assert.ok(a.every(v=>v>=0)&&b.every(v=>v>=0));
 assert.ok(Math.abs(a.reduce((x,y)=>x+y,0)-12000)<1e-8);
 assert.ok(Math.abs(a[0]-b[1])<1e-8&&Math.abs(a[2]-b[3])<1e-8);
 assert.deepEqual(allocateMotorForces(100,0,0,false),[23,23,27,27]);
});
test('longitudinal tire curve is odd in slip and has zero force off-ground',()=>{
 for(const slip of [.015,.07,.14,.4,1]){
  const pos=longitudinalMagic(slip,5200,1.05),neg=longitudinalMagic(-slip,5200,1.05);
  assert.ok(Math.abs(pos+neg)<1e-8);
  assert.ok(Math.abs(pos)<=5200*1.05+1e-8);
 }
 assert.equal(longitudinalMagic(.3,0,1),0);
});
test('contact friction ellipse never creates force or violates available force',()=>{
 const r=combinedTireLimit(6000,4000,4500);
 assert.ok(Math.hypot(r.fx,r.fy)<=4500+1e-8);
 assert.ok(Math.hypot(r.fx,r.fy)>4300);
 assert.deepEqual(combinedTireLimit(1000,1000,0),{fx:0,fy:0,utilization:0});
});
test('wheel angular momentum responds to traction reaction and brake torque',()=>{
 const spin=rotationalStep(40,0,0,1000,.45,2.8,DT),brake=rotationalStep(40,0,3000,0,.45,2.8,DT);
 assert.ok(spin<40&&brake<40);
 assert.ok(Math.abs(rotationalStep(2,0,100000,0,.45,2.8,DT))<.01);
});
test('trip metrics track distance, lateral acceleration and 0-60 threshold',()=>{
 let metrics=null;
 for(let i=0;i<61;i++)metrics=advanceMeasurements(metrics,i/2,i/5,7,DT);
 assert.ok(metrics.t060>0);
 assert.ok(metrics.quarterMileS>0);
 assert.ok(metrics.peakLateralG>0);
 assert.ok(metrics.elapsed>.5);
});
test('ground integrator exposes finite energy accounting and directional axle forces',()=>{
 const {d,s}=run(3,{throttle:true});
 assert.ok(s.speed>14&&s.speed<37);
 assert.ok(d.energyAudit.batteryOutJ>100000);
 assert.equal(d.energyAudit.regenJ,0);
 assert.ok(d.frontMotorForceN>0&&d.rearMotorForceN>0);
 assert.ok(d.metrics.elapsed>2.9);
 assert.ok(d.relaxedLongSlip.every(Number.isFinite));
});
test('regenerative deceleration always moves energy into the battery when SOC allows',()=>{
 const {s,a,d}=run(3,{throttle:true});const before=d.soc,regenBefore=d.energyAudit.regenJ;
 for(let i=0;i<120;i++){stepResearch(s,{brake:true},DT);suspensionStep(a,s,DT);}
 assert.ok(d.regenKw>0 || s.speed<.45);
 assert.ok(d.energyAudit.regenJ>regenBefore);
 assert.ok(d.soc>before);
});
test('numerical state remains finite on aggressive wet slalom and braking maneuvers',()=>{
 const {s,a,d}=run(5,{throttle:true,left:true,boost:true},{roadMu:.36});
 for(let i=0;i<240;i++){stepResearch(s,{brake:true,right:true},DT);suspensionStep(a,s,DT);}
 for(const key of ['x','z','yaw','vx','vz','speed'])assert.ok(Number.isFinite(s[key]));
 assert.ok(d.wheelOmega.every(x=>Number.isFinite(x)&&Math.abs(x)<800));
 assert.ok(d.energyAudit.batteryOutJ>=0&&d.energyAudit.regenJ>=0&&d.energyAudit.frictionBrakeJ>=0);
 assert.ok(d.tireForceX.every(Number.isFinite));
});
test('identical initial conditions produce bit-for-bit deterministic wheel and energy states',()=>{
 const once=()=>{const {s,d}=run(4.3,{throttle:true,left:true},{roadMu:.65});return [s.x,s.z,s.yaw,...d.wheelOmega,d.energyAudit.batteryOutJ,d.energyAudit.tireSlipJ];};
 assert.deepEqual(once(),once());
});