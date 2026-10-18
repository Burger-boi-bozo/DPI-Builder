import test from 'node:test';import assert from 'node:assert/strict';
import {ATTITUDE,makeAttitudeState,inertiaForPropellant,integrateAttitude} from '../game/attitude.mjs';
import {makeResearchState,stepResearch} from '../game/research.mjs';
const DT=1/120;
const craft=()=>({...makeResearchState(),y:8,grounded:false,propellant:200,attitude:makeAttitudeState()});
test('propellant mass changes three-axis moment of inertia',()=>{
 const light=inertiaForPropellant(0),heavy=inertiaForPropellant(260);
 for(const axis of ['yaw','roll','pitch'])assert.ok(heavy[axis]>light[axis]);
 assert.equal(light.yaw,ATTITUDE.dryYawInertia);
});
test('attitude jets are a balanced couple, not a free translational thruster',()=>{
 const s=craft();const a=integrateAttitude(s,{turn:1,lateral:1,assist:true},DT,s.propellant);
 assert.ok(Math.abs(a.jetForces.reduce((x,y)=>x+y,0))<1e-10);
 assert.ok(a.jetFlowKg>0);
});
test('holding a turn creates angular rate and heading without instantaneous yaw teleportation',()=>{
 const s=craft();for(let i=0;i<240;i++)integrateAttitude(s,{turn:1,assist:true},DT,s.propellant);
 assert.ok(s.yaw>.3&&s.yaw<2.5,`yaw=${s.yaw}`);
 assert.ok(s.attitude.yawRate>0&&s.attitude.yawRate<=ATTITUDE.rateYawLimit);
});
test('released yaw stick decelerates angular rate and holds heading',()=>{
 const s=craft();for(let i=0;i<90;i++)integrateAttitude(s,{turn:1,assist:true},DT,s.propellant);
 const before=s.attitude.yawRate;
 for(let i=0;i<360;i++)integrateAttitude(s,{assist:true},DT,s.propellant);
 assert.ok(Math.abs(s.attitude.yawRate)<before*.05,`${s.attitude.yawRate} vs ${before}`);
});
test('pitch/roll settle with feedback and do not exceed mechanical limits',()=>{
 const s=craft();s.pitch=.35;s.roll=-.38;
 for(let i=0;i<250;i++)integrateAttitude(s,{assist:true},DT,s.propellant);
 assert.ok(Math.abs(s.pitch)<.07,`pitch ${s.pitch}`);
 assert.ok(Math.abs(s.roll)<.07,`roll ${s.roll}`);
});
test('fully depleted propellant cannot command yaw, pitch or roll jet thrust',()=>{
 const s=craft();s.propellant=0;
 for(let i=0;i<90;i++)integrateAttitude(s,{turn:1,forward:1,lateral:1,assist:false},DT,0);
 assert.equal(s.attitude.yawDemand,0);
 assert.equal(s.attitude.pitchDemand,0);
 assert.equal(s.attitude.rollDemand,0);
 assert.equal(s.yaw,0);
 assert.equal(s.attitude.jetFlowKg,0);
});
test('flight flight-state consumes propellant for angular control and never increases it',()=>{
 const s=craft(),start=s.propellant;
 for(let i=0;i<120;i++)stepResearch(s,{left:true,lift:true},DT);
 assert.ok(s.propellant<start&&s.attitude.angularKineticJ>0);
 assert.ok(s.attitude.jetForces.every(Number.isFinite));
});
test('randomized nonlinear control commands remain finite and repeatable for 30 seconds',()=>{
 const simulate=()=>{const s=craft();let seed=12345678;
  for(let i=0;i<3600;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
   integrateAttitude(s,{turn:v>.7?1:v<.2?-1:0,lateral:v>.8?1:0,forward:v<.25?1:0,assist:i%500<350,verticalSpeed:3*Math.sin(i*.04)},DT,s.propellant);
   for(const v of [s.yaw,s.pitch,s.roll,s.attitude.angularKineticJ,...s.attitude.jetForces])assert.ok(Number.isFinite(v));
  }return [s.yaw,s.pitch,s.roll,s.attitude.yawRate,s.attitude.rollRate];};
 assert.deepEqual(simulate(),simulate());
});
test('fixed 120Hz accumulator produces identical result across 30,60,120Hz render cadences',()=>{
 const simulate=fps=>{const s=makeResearchState();s.y=7;s.grounded=false;const fixed=1/120;let accumulator=0;
 for(let frame=0;frame<fps*3;frame++){accumulator+=1/fps;
  while(accumulator>fixed-1e-12){stepResearch(s,{lift:true,left:true,strafeRight:true},fixed);accumulator-=fixed;}
 }return [s.x,s.y,s.z,s.yaw,s.pitch,s.roll,s.propellant];};
 assert.deepEqual(simulate(30),simulate(60));assert.deepEqual(simulate(60),simulate(120));
});
test('forward and lateral cold-gas flight impulses consume additional propellant',()=>{
 const a=craft(),b=craft();
 for(let i=0;i<120;i++){stepResearch(a,{throttle:true,strafeRight:true},DT);stepResearch(b,{},DT);}
 assert.ok(a.propellant<b.propellant-3,`${a.propellant} vs ${b.propellant}`);
 assert.ok(a.x>b.x+.1&&a.z<b.z-.1);
});
test('empty propellant tank disables translational rocket acceleration',()=>{
 const s=craft();s.propellant=0;
 for(let i=0;i<120;i++)stepResearch(s,{throttle:true,strafeRight:true,lift:true},DT);
 assert.ok(Math.abs(s.vx)<1.1,`vx=${s.vx}`);
 assert.ok(Math.abs(s.vz)<1.1,`vz=${s.vz}`);
 assert.equal(s.propellant,0);
});