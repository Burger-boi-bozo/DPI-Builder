import test from 'node:test';
import assert from 'node:assert/strict';
import {createSuspension,suspensionStep,SUSPENSION} from '../game/suspension.mjs';
const vehicle={x:0,y:0,z:0,yaw:0,speed:10};
test('road rise excites compression damper faster than static ride height',()=>{
 const rising=createSuspension();
 suspensionStep(rising,vehicle,1/120,{height:()=>0});
 const staticRoad=structuredClone(rising);
 staticRoad.previousWheelRoad.fill(.06);
 suspensionStep(staticRoad,vehicle,1/120,{height:()=>.06});
 suspensionStep(rising,vehicle,1/120,{height:()=>.06});
 assert.ok(rising.normalForces[0]>staticRoad.normalForces[0],`${rising.normalForces[0]}, ${staticRoad.normalForces[0]}`);
});
test('slow terrain rise produces bounded finite contact loads',()=>{
 const a=createSuspension();for(let i=0;i<480;i++){
   const h=.12*Math.sin(i/25);
   suspensionStep(a,vehicle,1/120,{height:()=>h});
 }
 assert.ok(a.normalForces.every(v=>Number.isFinite(v)&&v>=0&&v<2e5));
 assert.ok(a.roadRiseSpeed.every(Number.isFinite));
});
test('progressive spring end-travel exceeds nominal linear response without early-rate change',()=>{
 const a=createSuspension(),b=createSuspension();
 const v={...vehicle};
 suspensionStep(a,v,1/120,{height:()=>.2});
 suspensionStep(b,v,1/120,{height:()=>.1});
 assert.ok(a.normalForces[0]>b.normalForces[0]);
 assert.ok(a.compression[0]<=SUSPENSION.maxCompression);
});