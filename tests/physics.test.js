import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,physicsStep,makeGates,crossedGate,formatTime,clamp} from '../src/physics.js';
test('all modes initialize independently',()=>{for (const mode of ['launch','trial','free']) assert.equal(freshState(mode).mode,mode);});
test('trial has 12 rings and free flight has no objectives',()=>{assert.equal(makeGates('trial').length,12);assert.equal(makeGates('launch').length,6);assert.equal(makeGates('free').length,0);});
test('throttle gains velocity and boost consumes charge',()=>{let s=freshState('free');for(let i=0;i<60;i++)s=physicsStep(s,new Set(['KeyW','ShiftLeft']),1/60);assert.ok(s.speed>20);assert.ok(s.boost<100);assert.ok(s.z<65);});
test('flight can climb and ground collision recovers vehicle',()=>{let s=freshState('trial');const h=s.y;for(let i=0;i<90;i++)s=physicsStep(s,new Set(['KeyW','ArrowUp']),1/60);assert.ok(s.y>h);s.y=-8;s=physicsStep(s,new Set(),.016);assert.equal(s.flying,false);assert.equal(s.y,1.25);});
test('time step is safely capped',()=>{const a=physicsStep(freshState('launch'),new Set(['KeyW']),100);const b=physicsStep(freshState('launch'),new Set(['KeyW']),.05);assert.equal(a.speed,b.speed);});
test('gates support segment crossing even at high speed',()=>{const g={x:0,y:10,z:-10,radius:8};assert.equal(crossedGate({x:0,y:10,z:20},{x:0,y:10,z:-40},g),true);assert.equal(crossedGate({x:30,y:10,z:20},{x:30,y:10,z:-40},g),false);});
test('time format and clamp',()=>{assert.equal(formatTime(65.123),'01:05.12');assert.equal(clamp(-2,0,1),0);});
test('reveal demonstration locks to the inverted suction loop and exits safely',()=>{
  let s=freshState('showcase');s.suction=true;s.z=-231;
  let inverted=false;
  for(let i=0;i<720;i++){
    s=physicsStep(s,new Set(['KeyW']),1/60);
    if(s.loopActive&&s.y>95)inverted=true;
    if(s.loopComplete)break;
  }
  assert.ok(inverted,'car should drive upside down at loop apex');
  assert.ok(s.loopComplete,'car should finish the full loop');
  assert.ok(!s.loopActive);
  assert.equal(s.flying,false);
  assert.equal(s.y,1.25);
});
test('all reveal checkpoints are well formed',()=>{
  assert.equal(makeGates('showcase').length,5);
  assert.ok(makeGates('showcase').every(g=>g.radius>0));
});