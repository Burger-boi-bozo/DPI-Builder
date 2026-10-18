import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDynamicsState,stepResearch} from '../game/research.mjs';
import {createSuspension,setChassisSetup,setChassisAdjustment,suspensionStep} from '../game/suspension.mjs';
const DT=1/120;
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('randomized maneuvers remain deterministic, bounded and numerically stable across all chassis presets',()=>{
 for(let seed=1;seed<=10;seed++){
  const run=()=>{
   const rand=random(seed),s=makeDynamicsState(),a=createSuspension();setChassisSetup(a,['comfort','balanced','track'][seed%3]);
   s.roadMu=seed%2?.54:1.06;s.x=64;s.z=78;
   for(let i=0;i<1800;i++){
    if(i%150===0){setChassisAdjustment(a,'springScale',.7+rand()*.75);setChassisAdjustment(a,'damperScale',.7+rand()*.75);}
    const wave=i%720,throttle=wave<400,brake=wave>=400&&wave<530;
    const left=wave>100&&wave<170,right=wave>225&&wave<300;
    stepResearch(s,{throttle,brake,left,right},DT);
    suspensionStep(a,s,DT);s.suspension=a;
    for(const k of ['x','y','z','yaw','vx','vz','speed','structural'])assert.ok(Number.isFinite(s[k]),`${seed} ${i} ${k}`);
    for(const k of ['heave','roll','pitch','rideRmsG','peakTravel','airborneWheelSeconds'])assert.ok(Number.isFinite(a[k]),`${seed} ${i} ${k}`);
    assert.ok(s.speed<180&&s.speed>=0,`speed bounds ${seed}`);
    assert.ok(a.normalForces.every(n=>n>=0&&Number.isFinite(n)),`contact forces ${seed}`);
   }
   return [s.x,s.z,s.yaw,s.speed,a.rideRmsG,a.peakRollDeg];
  };
  assert.deepEqual(run(),run());
 }
});
test('suspension benchmark state resets independently between controlled runs',()=>{
 const a=createSuspension(),car={x:64,y:0,z:57,yaw:0,speed:12};
 for(let i=0;i<90;i++)suspensionStep(a,car,DT);
 assert.ok(a.testTime>.7);
 assert.ok(a.rideRmsG>0);
 const b=createSuspension();assert.equal(b.testTime,0);assert.equal(b.rideRmsG,0);
 assert.equal(b.tune.preset,'balanced');
});