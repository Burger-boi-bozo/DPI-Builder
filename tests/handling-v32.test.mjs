import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDynamicsState,stepResearch} from '../game/research.mjs';
import {createSuspension,suspensionStep} from '../game/suspension.mjs';
import {makeVehicleDynamics,steeringAngles,steeringCommand,stepRoadVehicle} from '../game/vehicle.mjs';
import {PROVING_ROUTES,SLALOM_PYLONS,surfaceGripAt,waterDepthAt,isPaved} from '../game/range.mjs';
const STEP=1/120;
function drive(seconds,turn){
 const s=makeDynamicsState(),a=createSuspension();s.suspension=a;
 for(let i=0;i<seconds*120;i++){
  stepResearch(s,i<140?{throttle:true}:{throttle:true,...turn},STEP);
  suspensionStep(a,s,STEP);
 }
 return s;
}
test('Ackermann inside front wheel turns farther than outside front wheel',()=>{
 const [li,ro]=steeringAngles(.36);assert.ok(li>ro&&ro>0,`${li},${ro}`);
 const [lo,ri]=steeringAngles(-.36);assert.ok(ri<lo&&lo<0,`${lo},${ri}`);
 assert.deepEqual(steeringAngles(0),[0,0]);
});
test('analog steering input is proportional and clamped without disabling keys',()=>{
 assert.equal(steeringCommand({left:true}),1);
 assert.equal(steeringCommand({right:true}),-1);
 assert.equal(steeringCommand({left:true,right:true}),0);
 assert.equal(steeringCommand({steer:-.35}),-.35);
 assert.equal(steeringCommand({steer:90}),1);
});
test('A steers left, D steers right; world trajectory mirrors',()=>{
 const left=drive(2.1,{left:true}),right=drive(2.1,{right:true});
 assert.ok(left.x<62.5&&right.x>65.5,`${left.x} / ${right.x}`);
 assert.ok(left.yaw>.2&&right.yaw<-.2,`${left.yaw} / ${right.yaw}`);
 assert.ok(Math.abs((left.x-64)+(right.x-64))<.18);
});
test('steering cannot yaw vehicle while stopped; caster returns released rack',()=>{
 const s=makeDynamicsState();s.drivetrain=makeVehicleDynamics();
 for(let i=0;i<80;i++)stepRoadVehicle(s,{left:true},STEP);
 assert.ok(Math.abs(s.yaw)<.001);
 s.vz=-10;
 for(let i=0;i<25;i++)stepRoadVehicle(s,{left:true},STEP);
 const held=s.drivetrain.steerAngle;
 for(let i=0;i<80;i++)stepRoadVehicle(s,{},STEP);
 assert.ok(held>.1&&Math.abs(s.drivetrain.steerAngle)<.02);
});
test('localized wet asphalt reduces grip and raises water depth smoothly',()=>{
 const wet=waterDepthAt(64,-237),dry=waterDepthAt(64,-170);
 assert.ok(wet>.005&&dry===0);
 assert.ok(surfaceGripAt(64,-237,1.06)<surfaceGripAt(64,-170,1.06));
 assert.ok(Math.abs(waterDepthAt(54,-237))<.00001);
});
test('slalom, skidpad and connector share navigable paved geometry',()=>{
 assert.equal(SLALOM_PYLONS.length,8);
 assert.equal(isPaved(64,-200),true);
 assert.equal(isPaved(137+PROVING_ROUTES.skidpad.radius,-264),true);
 assert.equal(isPaved(104,-264),true);
 assert.equal(isPaved(260,-450),false);
});
test('slalom pylon impacts dissipate energy and cannot score repeatedly',()=>{
 const p=SLALOM_PYLONS[0],s=makeDynamicsState();
 s.x=p.x;s.z=p.z+1.8;s.vz=-14;s.drivetrain=makeVehicleDynamics();
 const old=s.structural;
 for(let i=0;i<65;i++)stepRoadVehicle(s,{},STEP);
 assert.ok(s.drivetrain.hitPylons.includes(0));
 assert.ok(s.drivetrain.impactEnergyJ>0&&s.structural<old);
 const strikes=s.drivetrain.pylonImpacts;
 for(let i=0;i<40;i++)stepRoadVehicle(s,{},STEP);
 assert.equal(s.drivetrain.pylonImpacts,strikes);
});