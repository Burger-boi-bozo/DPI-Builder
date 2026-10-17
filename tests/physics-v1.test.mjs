import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,step,gateCrossed,GATES,resetPosition,LOOP} from '../game/physics.mjs';
const advance=(s,input,seconds)=>{const events=[];for(let i=0;i<seconds*120;i++)events.push(...step(s,input,1/120));return events;};

test('throttle accelerates, steering changes direction, brakes slow the car',()=>{
  const s=createState('free');advance(s,{throttle:true},1);assert(s.speed>20);assert(s.z<42);
  advance(s,{throttle:true,left:true},.5);assert(s.yaw>0);assert(s.x<0);const v=s.speed;
  advance(s,{brake:true},.4);assert(s.speed<v-10);
});
test('lift consumes air, releasing it lands, ground recharges',()=>{
  const s=createState('trial');advance(s,{lift:true},3);assert(s.y>18);assert(s.air<75);assert(!s.grounded);
  advance(s,{},4);assert(s.grounded);assert.equal(s.y,0);advance(s,{},2);assert.equal(s.air,100);
});
test('empty tank cannot fly forever; free roam has unlimited air',()=>{
  const s=createState();advance(s,{lift:true,boost:true},5);assert(s.air>=0);assert(s.air<1);
  const f=createState('free');advance(f,{lift:true},20);assert.equal(f.air,100);assert(f.y<=70);
});
test('swept gate detection works at high speed and rejects missed or backwards passes',()=>{
  assert(gateCrossed({x:0,y:3,z:5},{x:0,y:3,z:-60},0));
  assert(!gateCrossed({x:12,y:3,z:5},{x:12,y:3,z:-60},0));
  assert(!gateCrossed({x:0,y:25,z:5},{x:0,y:25,z:-60},0));
  assert(!gateCrossed({x:0,y:3,z:-60},{x:0,y:3,z:5},0));
});
test('an airborne barrel roll scores exactly once and records its objective',()=>{
  const s=createState('free');s.y=20;s.grounded=false;
  step(s,{lift:true,roll:1},1/120);const events=advance(s,{lift:true},1.2);
  assert.equal(events.filter(e=>e.type==='roll').length,1);assert.equal(s.score,750);assert(s.objectives.roll);assert.equal(s.roll,0);
});
test('suction attaches to a full loop, returns to ground, and awards completion',()=>{
  const s=createState('free');s.x=LOOP.x;s.z=LOOP.z+5;s.speed=28;
  const events=advance(s,{throttle:true},5);
  assert(events.some(e=>e.type==='loopStart'));assert(events.some(e=>e.type==='loop'));
  assert(s.objectives.loop);assert.equal(s.loopAngle,null);assert.equal(s.y,0);
});
test('reset preserves checkpoint and adds an explicit trial time penalty',()=>{
  const s=createState();s.gate=4;s.time=14;s.score=4000;s.air=2;resetPosition(s);
  assert.equal(s.gate,4);assert.equal(s.time,17);assert.equal(s.resets,1);assert.equal(s.air,100);
  assert.equal(s.x,GATES[3][0]);assert.equal(s.z,GATES[3][2]);assert.equal(s.score,3750);
});
test('crossing every ordered gate finishes the trial and awards all checkpoint points',()=>{
  const s=createState();
  for(let i=0;i<GATES.length;i++){
    const g=GATES[i],prev=i?GATES[i-1]:[0,4,42];const dx=g[0]-prev[0],dz=g[2]-prev[2],len=Math.hypot(dx,dz);
    s.x=g[0]-dx/len*.1;s.z=g[2]-dz/len*.1;s.y=g[1]-1;s.vy=0;s.grounded=false;s.speed=25;s.yaw=Math.atan2(-dx,-dz);
    const events=step(s,{},.02);assert(events.some(e=>e.type==='gate'),`Gate ${i+1} should count`);assert.equal(s.gate,i+1);
  }
  assert(s.completed);assert.equal(s.score,12000+(s.objectives.jump?1200:0));
});
test('stunt runs end at ninety seconds; completed runs freeze',()=>{
  const s=createState('stunt');s.time=89.99;assert(step(s,{},.02).some(e=>e.type==='finish'));const t=s.time;advance(s,{throttle:true},1);assert.equal(s.time,t);assert.equal(s.speed,0);
});
test('jumping the complete vehicle lineup earns the signature stunt once',()=>{
  const s=createState('free');s.z=-95;s.y=8;s.speed=35;s.grounded=false;
  const events=advance(s,{lift:true},1.6);assert(events.some(e=>e.type==='jump'));assert(s.objectives.jump);
});
test('the full course is flyable with ordinary steering and lift inputs, without resets',()=>{
  const s=createState('trial');
  for(let i=0;i<120*90&&!s.completed;i++){
    const g=GATES[s.gate],dx=g[0]-s.x,dz=g[2]-s.z;
    let angle=Math.atan2(-dx,-dz)-s.yaw;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
    const targetSpeed=Math.abs(angle)>.4?16:26;
    step(s,{left:angle>.025,right:angle<-.025,throttle:s.speed<targetSpeed,brake:s.speed>targetSpeed+2,lift:s.vy<(g[1]-1-s.y)*1.4},1/120);
  }
  assert(s.completed);assert.equal(s.gate,12);assert.equal(s.resets,0);assert(s.time<60);
});