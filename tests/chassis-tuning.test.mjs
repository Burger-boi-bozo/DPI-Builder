import test from 'node:test';
import assert from 'node:assert/strict';
import {SUSPENSION,CHASSIS_SETUPS,createSuspension,setChassisSetup,setChassisAdjustment,tuningParameters,suspensionStep} from '../game/suspension.mjs';
import {effectiveTireMu,brakeFadeFactor,makeVehicleDynamics,stepRoadVehicle} from '../game/vehicle.mjs';
const DT=1/120;
function settle(preset){const a=createSuspension();setChassisSetup(a,preset);const car={x:0,y:0,z:0,yaw:0,speed:0};for(let i=0;i<600;i++)suspensionStep(a,car,DT);return a;}
function bumps(preset){const a=createSuspension();setChassisSetup(a,preset);const car={x:64,y:0,z:70,yaw:0,speed:17};for(let i=0;i<720;i++){car.z=70-i*.17;suspensionStep(a,car,DT);}return a;}
test('all three chassis setups settle near force equilibrium on level ground',()=>{
 for(const name of Object.keys(CHASSIS_SETUPS)){
  const a=settle(name);assert.equal(a.contactCount,4,name);
  assert.ok(Math.abs(a.forceTotal-SUSPENSION.mass*9.80665)<500,name);
  assert.ok(Math.abs(a.heave)<.025,`${name}: ${a.heave}`);
 }
});
test('setups have distinct, bounded spring, damping and antiroll coefficients',()=>{
 const c=tuningParameters({preset:'comfort'}),t=tuningParameters({preset:'track'});
 assert.ok(t.springRate>c.springRate*1.7);
 assert.ok(t.damperBump>c.damperBump*2);
 assert.ok(t.rollBar>c.rollBar*3);
});
test('suspension fine tune bounds prevent unstable and nonfinite parameters',()=>{
 const a=createSuspension();setChassisAdjustment(a,'springScale',99);
 setChassisAdjustment(a,'damperScale',-.7);setChassisAdjustment(a,'madeUp',4);
 assert.equal(a.tune.springScale,1.45);assert.equal(a.tune.damperScale,.70);
 setChassisAdjustment(a,'springScale',NaN);assert.equal(a.tune.springScale,1.45);
 const params=tuningParameters(a.tune);assert.ok(Object.values(params).filter(x=>typeof x==='number').every(Number.isFinite));
});
test('preset selection resets fine tuning to a known configuration',()=>{
 const a=createSuspension();setChassisAdjustment(a,'springScale',1.3);setChassisSetup(a,'comfort');
 assert.equal(a.tune.springScale,1);assert.equal(a.tune.preset,'comfort');
 setChassisSetup(a,'invalid');assert.equal(a.tune.preset,'balanced');
});
test('reproducible washboard yields distinct setup response metrics',()=>{
 const c=bumps('comfort'),b=bumps('balanced'),t=bumps('track');
 for(const a of [c,b,t]){
  assert.ok(a.rideRmsG>.02&&a.rideRmsG<3);
  assert.ok(a.peakTravel>.04&&a.peakTravel<.31);
  assert.ok(a.testTime>5);
  assert.ok(a.peakRollDeg>=0&&Number.isFinite(a.airborneWheelSeconds));
 }
 assert.ok(Math.abs(c.rideRmsG-b.rideRmsG)>.005);
 assert.ok(Math.abs(t.rideRmsG-b.rideRmsG)>.005);
});
test('thermal friction curve makes cold and overheated tread less grippy than warm tread',()=>{
 const optimal=effectiveTireMu(1.06,62,5400,15);
 assert.ok(optimal>effectiveTireMu(1.06,-2,5400,15));
 assert.ok(optimal>effectiveTireMu(1.06,142,5400,15));
});
test('loaded tires and wet high-speed conditions lose more grip',()=>{
 assert.ok(effectiveTireMu(1,60,13000,20)<effectiveTireMu(1,60,3000,20));
 assert.ok(effectiveTireMu(.54,60,5300,60)<effectiveTireMu(.54,60,5300,12));
 assert.ok(effectiveTireMu(1.06,60,5300,60)>effectiveTireMu(.54,60,5300,12));
});
test('overheated friction brakes fade while ambient brakes operate at full strength',()=>{
 assert.equal(brakeFadeFactor(28),1);
 assert.equal(brakeFadeFactor(360),1);
 assert.ok(brakeFadeFactor(630)<.6);
 assert.equal(brakeFadeFactor(700),.38);
});
test('overheated brake rotors increase a controlled stopping distance',()=>{
 function run(hot){const s={x:0,y:0,z:25,yaw:0,vx:0,vz:-30,speed:30,mode:'dynamics',roadMu:1.06,structural:100};s.drivetrain=makeVehicleDynamics();if(hot)s.drivetrain.brakeTemperature.fill(675);for(let i=0;i<90;i++)stepRoadVehicle(s,{brake:true},DT);return s;}
 const normal=run(false),faded=run(true);
 assert.ok(faded.speed>normal.speed+1.8,`${normal.speed} vs ${faded.speed}`);
 assert.ok(faded.z<normal.z-1,`${normal.z} vs ${faded.z}`);
});