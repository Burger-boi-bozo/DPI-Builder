import test from 'node:test';
import assert from 'node:assert/strict';
import {makeResearchState,stepResearch,setPrecision,windAt,RESEARCH_STAGES} from '../game/research.mjs';
function fly(s,inputs,seconds){let events=[];for(let i=0;i<seconds*120;i++)events.push(...stepResearch(s,inputs,1/120));return events;}
test('X-Flight is a separate certification program with five protocols',()=>{
 assert.equal(RESEARCH_STAGES.length,5);assert.deepEqual(RESEARCH_STAGES.map(x=>x.kind),['hover','gate','gate','gate','land']);
 const s=makeResearchState();assert.equal(s.mode,'research');assert.equal(s.propellant,260);assert.equal(s.structural,100);
});
test('wind field is deterministic for repeatable investigation',()=>{
 assert.deepEqual(windAt(35,60),windAt(35,60));assert.notDeepEqual(windAt(0,60),windAt(50,60));
 assert.ok(Number.isFinite(windAt(55,150).x));
});
test('cold-gas thrust fights gravity but consumes nonrenewable propellant',()=>{
 const s=makeResearchState();const events=fly(s,{lift:true},.75);
 assert.ok(s.y>1);assert.ok(s.vy>0);assert.ok(s.propellant<260);assert.ok(s.thrust>18000);assert.equal(events.some(x=>x.type==='researchAbort'),false);
 const before=s.vy;fly(s,{},.75);assert.ok(s.vy<before);assert.equal(s.lifting,false);
});
test('hover hold actively counteracts gravity and burns propellant',()=>{
 const s=makeResearchState();fly(s,{lift:true},1.4);setPrecision(s,true);
 const altitude=s.y,prop=s.propellant;fly(s,{},1.8);
 assert.ok(Math.abs(s.y-altitude)<3,`hover altitude deviation ${Math.abs(s.y-altitude)}`);
 assert.ok(s.propellant<prop);assert.equal(s.precision,true);
});
test('automatic hover stabilization can be deactivated',()=>{
 const s=makeResearchState();fly(s,{lift:true},1.2);setPrecision(s,true);setPrecision(s,false);
 assert.equal(s.precision,false);const vy=s.vy;fly(s,{},.5);assert.ok(s.vy<vy);
});
test('forward and lateral impulses steer in the flight frame',()=>{
 const s=makeResearchState();fly(s,{lift:true},1.1);const z=s.z,x=s.x;fly(s,{throttle:true,strafeRight:true},2);
 assert.ok(s.z<z-2,`forward z=${s.z}, old=${z}`);assert.ok(s.x>x+2,`strafe x=${s.x}`);
});
test('hard landings reduce structural integrity instead of silently resetting',()=>{
 const s=makeResearchState();s.grounded=false;s.y=2;s.vy=-16;const ev=fly(s,{},.5);
 assert.equal(s.grounded,true);assert.ok(s.structural<100);assert.ok(ev.some(x=>x.type==='researchHardLanding'));
});
test('precision hover protocol needs stability and dwell time',()=>{
 const s=makeResearchState();s.y=8;s.vy=0;s.grounded=false;s.precision=true;s.hoverAltitude=8;
 const ev=fly(s,{},2.0);assert.ok(ev.some(x=>x.type==='researchStage'),`stage ${s.stage} events ${JSON.stringify(ev)}`);assert.equal(s.stage,1);
});
test('calibration gates must be reached in order',()=>{
 const s=makeResearchState();s.stage=1;s.y=12;s.z=-52;s.vz=22;s.grounded=false;s.precision=true;s.hoverAltitude=12;
 const ev=fly(s,{},1);assert.equal(s.stage,2);assert.ok(ev.some(x=>x.type==='researchStage'));
});
test('controlled contact on landing pad certifies pilot',()=>{
 const s=makeResearchState();s.stage=4;s.x=32;s.z=-191;s.y=.08;s.vy=-1.5;s.grounded=false;
 const ev=fly(s,{},.2);assert.equal(s.completed,true);assert.equal(s.failed,false);assert.ok(ev.some(x=>x.type==='researchFinish'));
});
test('unsafe landing disqualifies landing validation',()=>{
 const s=makeResearchState();s.stage=4;s.x=32;s.z=-191;s.y=.08;s.vy=-16;s.grounded=false;
 fly(s,{},.2);assert.equal(s.completed,false);assert.equal(s.stage,4);
});
test('flight limits trigger flight-test abort rather than teleporting the vehicle',()=>{
 const s=makeResearchState();s.x=351;const ev=stepResearch(s,{},.01);
 assert.equal(s.completed,true);assert.equal(s.failed,true);assert.ok(ev.some(x=>x.type==='researchAbort'));
});