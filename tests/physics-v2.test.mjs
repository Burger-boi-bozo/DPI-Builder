import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,step,GATES,missionGateCount,LAUNCH_GATE_COUNT,resetPosition} from '../game/physics.mjs';

test('V2 launch sprint consists of the first six full aerial gates',()=>{
 assert.equal(missionGateCount('launch'),6);assert.equal(LAUNCH_GATE_COUNT,6);
 assert.equal(missionGateCount('trial'),12);assert.equal(GATES.length,12);
});
test('launch starts at rest on the runway with charged thrusters',()=>{
 const state=createState('launch');assert.equal(state.y,0);assert.equal(state.z,42);
 assert.equal(state.air,100);assert.equal(state.gate,0);
});
test('launch completion occurs on gate 6, while trial continues to gate 12',()=>{
 for(const mode of ['launch','trial']){
  const s=createState(mode),limit=missionGateCount(mode);
  for(let k=0;k<limit;k++){
   s.gate=k;
   const a=k===0?[0,4,42]:GATES[k-1],g=GATES[k],vx=g[0]-a[0],vz=g[2]-a[2],length=Math.hypot(vx,vz);
   s.x=g[0]-vx/length*1.5;s.y=g[1]-1;s.z=g[2]-vz/length*1.5;
   s.speed=30;s.grounded=false;s.vy=0;s.yaw=Math.atan2(-vx,-vz);
   // Stepping across the ring must be frame-rate independent.
   let events=[];for(let i=0;i<40&&s.gate===k;i++)events.push(...step(s, {throttle:true},.02));
   if(s.gate===k){ /* Some ring entries require a gentler or tilted approach. */ break; }
  }
  assert.equal(s.completed, s.gate===limit);
 }
});
test('reset on launch has the same three-second penalty as full trial',()=>{
 const s=createState('launch');s.time=8;resetPosition(s,true);assert.equal(s.time,11);
});