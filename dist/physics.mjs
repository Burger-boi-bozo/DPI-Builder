/** Fixed-step rigid-body vehicle. SI units; parameters are estimates, not OEM data. */
import {Vector3 as V, Quaternion as Q, Euler} from './three.module.min.js';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const PARAMS=Object.freeze({dryMass:1740,gasCapacity:240,exhaustVelocity:900,wheelRadius:.355,wheelbase:2.86,track:1.79,spring:92000,damper:6200,restLength:.43,mu:1.35,power:820000,maxDrive:16700,dragArea:.62,downforceArea:1.1,liftForce:34500,boostForce:18500,fanForce:7200});
export const GATES=[[0,3,-55],[0,9,-135],[0,12,-225],[28,9,-295],[85,5,-320],[124,8,-260],[108,10,-185],[45,4,-120]];
export const WHEELS=[[-.895,.12,-1.43],[.895,.12,-1.43],[-.895,.12,1.43],[.895,.12,1.43]];
export const OBSTACLES=[{x:-110,z:30,w:44,d:34,h:13},{x:-110,z:-25,w:44,d:34,h:13},{x:115,z:65,w:34,d:24,h:9}];
export function terrainHeight(x,z){
  const r=Math.hypot(x,z+190),u=clamp((r-1050)/400,0,1),t=u*u*(3-2*u);
  const base=(Math.sin(x*.005+Math.cos(z*.003))*Math.cos(z*.006)*.5+.5)*80+(Math.sin(x*.011-z*.007)*.5+.5)*30;
  return Math.max(0,base*t-7);
}
export function surfaceAt(x,z){
  // Launch ramp: analytic surface used by both the visual mesh and contact solver.
  if(x>38&&x<54&&z<-150&&z>-190){const t=(-z-150)/40;return {height:6*t*t,normal:new V(0,1,.3*t).normalize(),grip:1.1,type:'RAMP'};}
  const radius=Math.hypot(x,z+190),road=Math.abs(x)<19&&z<95&&z>-620 || radius>178&&radius<204 || Math.abs(x)<70&&Math.abs(z-20)<70;
  const height=terrainHeight(x,z),normal=height>0?new V(-(terrainHeight(x+1,z)-terrainHeight(x-1,z))*.5,1,-(terrainHeight(x,z+1)-terrainHeight(x,z-1))*.5).normalize():new V(0,1,0);
  return {height,normal,grip:road?1:.60,type:road?'ASPHALT':'GRAVEL'};
}
export function createState(mode='free'){
  return {mode,p:new V(0,.615,42),v:new V(),q:new Q(),w:new V(),time:0,gas:PARAMS.gasCapacity,mass:1980,steer:0,wheels:WHEELS.map(()=>({length:.38,compression:.05,load:0,slip:0,spin:0,angle:0,contact:false,point:new V()})),grounded:true,contacts:4,speed:0,forwardSpeed:0,altitude:0,accel:new V(),gForce:new V(),roll:0,pitch:0,yaw:0,hold:null,fan:true,assists:true,unlimited:mode==='free',lifting:0,boosting:0,gasRate:0,damage:0,airtime:0,totalAir:0,maxSpeed:0,maxAltitude:0,gate:0,splits:[],score:0,combo:0,comboTime:0,rollTravel:0,resets:0,completed:false,distance:0,zeroSixty:null,launchTime:null,brakeDistance:0,braking:false,events:[],previousGrounded:true};
}
export function toggleHold(s){if(s.hold!==null){s.hold=null;return false;}if(s.altitude<1||s.gas<=0)return false;s.hold=s.p.y;return true;}
export function resetPosition(s,penalty=true){
  const opts={mode:s.mode,assists:s.assists,unlimited:s.unlimited,fan:s.fan};
  const keep={time:s.time,score:s.score,gate:s.gate,splits:s.splits,resets:s.resets,maxSpeed:s.maxSpeed,maxAltitude:s.maxAltitude,totalAir:s.totalAir};
  Object.assign(s,createState(s.mode),opts,keep);
  if(s.mode==='trial'&&s.gate>0){const g=GATES[s.gate-1],n=GATES[s.gate]||g;s.p.set(g[0],g[1],g[2]);s.q.setFromAxisAngle(new V(0,1,0),Math.atan2(-(n[0]-g[0]),-(n[2]-g[2])));s.grounded=false;s.hold=g[1];}
  if(penalty){s.resets++;s.time+=3;s.score=Math.max(0,s.score-250);}
}
export function gateCrossed(a,b,index){
  const g=GATES[index];if(!g)return false;const prev=index?GATES[index-1]:[0,3,42];
  const n=new V(g[0]-prev[0],0,g[2]-prev[2]).normalize(),c=new V(...g);
  const d0=a.clone().sub(c).dot(n),d1=b.clone().sub(c).dot(n);
  if(d0>0||d1<0||d1-d0<1e-9)return false;
  return a.clone().lerp(b,-d0/(d1-d0)).distanceTo(c)<6.8;
}
const inertia=new V(2850,3150,910);
export function step(s,input={},dt=1/120){
  if(s.completed)return [];if(!Number.isFinite(dt)||dt<=0)return [];dt=Math.min(dt,1/60);
  const events=[],old=s.p.clone(),oldVelocity=s.v.clone(),P=PARAMS;
  s.time+=dt;s.mass=P.dryMass+s.gas;s.comboTime=Math.max(0,s.comboTime-dt);if(!s.comboTime)s.combo=0;
  const F=new V(0,-s.mass*9.80665,0),torque=new V(),up=new V(0,1,0).applyQuaternion(s.q),forward=new V(0,0,-1).applyQuaternion(s.q),worldW=s.w.clone().applyQuaternion(s.q),inv=s.q.clone().invert();
  const apply=(force,offset)=>{F.add(force);torque.add(offset.clone().cross(force));};
  const speed=s.v.length();s.speed=speed;s.forwardSpeed=s.v.dot(forward);
  const steerTarget=clamp(input.steer||0,-1,1)*(.52/(1+Math.abs(s.forwardSpeed)/27));
  s.steer+=(steerTarget-s.steer)*(1-Math.exp(-7*dt));
  const throttle=clamp(input.throttle||0,-1,1),brake=clamp(input.brake||0,0,1),handbrake=!!input.handbrake;
  let contacts=0,maxSlip=0;
  for(let i=0;i<4;i++){
    const wheel=s.wheels[i],anchor=new V(...WHEELS[i]).applyQuaternion(s.q),origin=s.p.clone().add(anchor),front=i<2;
    let sf=surfaceAt(origin.x,origin.z),den=up.dot(sf.normal),length=den>.25?(origin.y-sf.height-P.wheelRadius)/up.y:2;
    const contact=origin.clone().addScaledVector(up,-length-P.wheelRadius);sf=surfaceAt(contact.x,contact.z);
    length=den>.25?(origin.y-sf.height-P.wheelRadius)/up.y:2;
    wheel.length=clamp(length,.16,P.restLength+.06);wheel.contact=length<P.restLength+.06&&length>-.35&&den>.25;
    wheel.compression=Math.max(0,P.restLength-length);wheel.load=0;wheel.slip=0;
    // Ackermann geometry: inner wheel follows a tighter turning circle.
    wheel.angle=front&&Math.abs(s.steer)>.001?Math.atan(P.wheelbase/(P.wheelbase/Math.tan(s.steer)+(i===0?-.5:.5)*P.track)):0;
    if(!wheel.contact){wheel.spin+=(front?0:throttle*16)*dt;continue;}
    const r=anchor.clone().addScaledVector(up,-length-P.wheelRadius),point=s.p.clone().add(r);wheel.point.copy(point);point.y=sf.height;
    const velocity=s.v.clone().add(worldW.clone().cross(r)),normalSpeed=velocity.dot(sf.normal);
    const load=clamp(P.spring*wheel.compression-P.damper*normalSpeed,0,44000);wheel.load=load;
    if(load<1)continue;contacts++;apply(sf.normal.clone().multiplyScalar(load),r);
    const dir=new V(-Math.sin(wheel.angle),0,-Math.cos(wheel.angle)).applyQuaternion(s.q);dir.addScaledVector(sf.normal,-dir.dot(sf.normal)).normalize();
    const right=dir.clone().cross(sf.normal).normalize(),long=velocity.dot(dir),lateral=velocity.dot(right);
    const slipAngle=Math.atan2(lateral,Math.abs(long)+2.2);
    let lateralForce=-slipAngle*73500;
    // Static friction removes low-speed side drift without injecting energy.
    if(Math.abs(long)<2)lateralForce=-lateral*s.mass/(4*dt);
    const drive=front?0:throttle*Math.min(P.maxDrive,P.power/Math.max(8,Math.abs(long)))/2;
    const braking=(brake*27000/4+(handbrake&&!front?11000:0)+(!throttle?Math.min(Math.abs(long)*130,700):0));
    const rolling=.014*load;
    let longitudinal=drive-Math.sign(long)*(Math.min(braking+rolling,Math.abs(long)*s.mass/(4*dt)));
    const limit=P.mu*sf.grip*load*(handbrake&&!front?.66:1),demand=Math.hypot(longitudinal,lateralForce),ratio=demand>limit?limit/demand:1;
    longitudinal*=ratio;lateralForce*=ratio;
    wheel.slip=Math.max(Math.abs(slipAngle),Math.max(0,Math.abs(drive)-limit)/Math.max(1000,limit));maxSlip=Math.max(maxSlip,wheel.slip);
    apply(dir.multiplyScalar(longitudinal).add(right.multiplyScalar(lateralForce)),r);
    wheel.spin+=(long/P.wheelRadius+(i>1?Math.sign(throttle)*wheel.slip*14:0))*dt;
  }
  s.contacts=contacts;s.grounded=contacts>0;
  // Quadratic aerodynamic drag and downforce, plus the optional ground-effect fan.
  F.addScaledVector(s.v,-.5*1.225*P.dragArea*speed);
  F.addScaledVector(up,-.5*1.225*P.downforceArea*s.forwardSpeed*s.forwardSpeed);
  if(s.fan&&s.grounded)F.addScaledVector(up,-P.fanForce*clamp(1-s.p.y/2,0,1));
  if(s.grounded||input.lift||input.descend||s.gas<=0)s.hold=null;
  let lift=0;
  if(input.lift)lift=s.assists?s.mass*(9.80665+clamp((6-s.v.y)*3,-8,12))/Math.max(.35,up.y):P.liftForce;
  else if(s.hold!==null)lift=s.mass*(9.80665+clamp((s.hold-s.p.y)*4-s.v.y*3,-8,10))/Math.max(.35,up.y);
  else if(input.descend&&!s.grounded&&s.assists)lift=s.mass*(9.80665+clamp((-3-s.v.y)*3,-9,8))/Math.max(.35,up.y);
  lift=clamp(lift,0,P.liftForce);
  const boost=input.boost?P.boostForce:0;
  let attitude=new V();
  if(!s.grounded||lift>s.mass*9.8){
    const targetUp=new V(0,1,0).applyQuaternion(inv);
    if(s.assists&&!input.roll){attitude.x=targetUp.z*11000-s.w.x*5200;attitude.z=-targetUp.x*9000-s.w.z*3300;}
    else{attitude.x=clamp(input.pitch||0,-1,1)*6600-s.w.x*800;attitude.z=-(input.roll||0)*6500-s.w.z*650;}
    attitude.y=((input.steer||0)*.78-s.w.y)*5200;
    attitude.clampLength(0,13000);
  }
  const wanted=(lift+boost+attitude.length()/1.15)/P.exhaustVelocity,available=s.unlimited?1:Math.min(1,s.gas/Math.max(1e-9,wanted*dt));
  s.gasRate=wanted*available;s.lifting=lift/P.liftForce*available;s.boosting=boost/P.boostForce*available;
  if(!s.unlimited)s.gas=Math.max(0,s.gas-s.gasRate*dt);
  else s.gas=P.gasCapacity;
  F.addScaledVector(up,lift*available);F.addScaledVector(forward,boost*available);
  torque.add(attitude.multiplyScalar(available).applyQuaternion(s.q));
  // Hull contacts allow imperfect landings and overturns instead of snapping upright.
  for(const x of [-.86,.86])for(const z of [-1.8,1.8])for(const y of [-.23,.58]){
    const r=new V(x,y,z).applyQuaternion(s.q),p=s.p.clone().add(r),sf=surfaceAt(p.x,p.z),depth=sf.height+.035-p.y;
    if(depth>0){const vel=s.v.clone().add(worldW.clone().cross(r));const n=clamp(depth*150000-vel.dot(sf.normal)*10000,0,100000);apply(sf.normal.clone().multiplyScalar(n),r);apply(new V(vel.x,0,vel.z).multiplyScalar(-Math.min(1800,n/(speed+.1))),r);}
  }
  // Hangar walls are physical obstacles; broad-phase boxes expanded by car radius.
  for(const b of OBSTACLES)if(s.p.y<b.h+.5&&Math.abs(s.p.x-b.x)<b.w/2+1.2&&Math.abs(s.p.z-b.z)<b.d/2+2){
    const dx=b.w/2+1.2-Math.abs(s.p.x-b.x),dz=b.d/2+2-Math.abs(s.p.z-b.z),n=dx<dz?new V(Math.sign(s.p.x-b.x)||1,0,0):new V(0,0,Math.sign(s.p.z-b.z)||1);
    s.p.addScaledVector(n,Math.min(dx,dz));const vn=s.v.dot(n);if(vn<0){s.v.addScaledVector(n,-1.18*vn);s.damage=clamp(s.damage+Math.abs(vn)*.8,0,100);if(Math.abs(vn)>3)events.push({type:'impact'});}
  }
  s.v.addScaledVector(F,dt/s.mass);s.p.addScaledVector(s.v,dt);
  const localTorque=torque.applyQuaternion(inv),angularMomentum=s.w.clone().multiply(inertia),gyro=s.w.clone().cross(angularMomentum);
  s.w.add(localTorque.sub(gyro).divide(inertia).multiplyScalar(dt));s.w.multiplyScalar(Math.exp(-.06*dt));s.w.clampLength(0,12);
  const omega=new Q(s.w.x*dt*.5,s.w.y*dt*.5,s.w.z*dt*.5,0).premultiply(s.q);
  s.q.set(s.q.x+omega.x,s.q.y+omega.y,s.q.z+omega.z,s.q.w+omega.w).normalize();
  s.accel.copy(s.v).sub(oldVelocity).multiplyScalar(1/dt);s.gForce.copy(s.accel).applyQuaternion(inv).multiplyScalar(1/9.80665);
  const angles=new Euler().setFromQuaternion(s.q,'YXZ');s.yaw=angles.y;s.pitch=angles.x;s.roll=angles.z;
  s.altitude=Math.max(0,s.p.y-.615-surfaceAt(s.p.x,s.p.z).height);s.speed=s.v.length();s.maxSpeed=Math.max(s.maxSpeed,s.speed);s.maxAltitude=Math.max(s.maxAltitude,s.altitude);s.distance+=s.p.distanceTo(old);
  s.surface=surfaceAt(s.p.x,s.p.z).type;s.slip=maxSlip;
  if(!s.grounded){s.airtime+=dt;s.totalAir+=dt;s.rollTravel+=s.w.z*dt;if(Math.abs(s.rollTravel)>Math.PI*2){s.rollTravel%=Math.PI*2;s.combo=Math.min(5,s.comboTime>0?s.combo+1:1);s.comboTime=8;s.score+=1000*s.combo;events.push({type:'roll',points:1000*s.combo});}}
  else{if(!s.previousGrounded&&s.airtime>.4){const impact=Math.max(0,-oldVelocity.y);s.damage=clamp(s.damage+Math.max(0,impact-5)*2,0,100);events.push({type:'landing',impact});if(impact<5){s.score+=Math.round(s.airtime*100);s.comboTime=8;}else{s.combo=0;s.comboTime=0;}}s.airtime=0;s.rollTravel=0;}
  s.previousGrounded=s.grounded;
  // Only the marked pit pad refills finite air, with the vehicle stopped.
  if(s.grounded&&speed<.8&&Math.abs(s.p.x)<13&&Math.abs(s.p.z-42)<14&&!lift&&!boost)s.gas=Math.min(P.gasCapacity,s.gas+24*dt);
  if(s.launchTime===null&&throttle>.1)s.launchTime=s.time;
  if(s.zeroSixty===null&&s.launchTime!==null&&s.speed>=26.8224){s.zeroSixty=s.time-s.launchTime;events.push({type:'sixty',time:s.zeroSixty});}
  if(brake>.5&&s.speed>2){if(!s.braking)s.brakeDistance=0;s.braking=true;s.brakeDistance+=s.p.distanceTo(old);}else if(s.speed<.5&&s.braking){s.braking=false;events.push({type:'stop',distance:s.brakeDistance});}
  if(s.mode==='trial'&&gateCrossed(old,s.p,s.gate)){s.gate++;s.splits.push(s.time);s.score+=1000;s.gas=P.gasCapacity;events.push({type:'gate'});if(s.gate===GATES.length){s.completed=true;events.push({type:'finish'});}}
  if(s.mode==='stunt'&&s.time>=90){s.completed=true;events.push({type:'finish'});}
  if(Math.hypot(s.p.x,s.p.z+200)>1400||s.p.y< -10){resetPosition(s);events.push({type:'boundary'});}
  return events;
}
