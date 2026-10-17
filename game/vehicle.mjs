// Concept AWD EV tire / steering / braking model. Not calibrated to a Tesla.
// Ground-only: 4 contact patches use the suspension solver's individual loads.
// SI: m, s, kg, N, rad, J. The flight integrator remains independent.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const VEHICLE={
 mass:2160,wheelbase:2.93,track:2.16,cgHeight:.53,yawInertia:4400,
 wheelRadius:.45,wheelInertia:2.8,friction:1.06,corneringRate:12.5,
 maxDriveN:16200,maxBrakingN:25900,regenBrakingN:4400,
 capacityKWh:84,dragCdA:.75,rollingResistance:.0115
};
const corners=[[-1.08,-1.48],[1.08,-1.48],[-1.08,1.45],[1.08,1.45]];
export function makeVehicleDynamics(){return {
 yawRate:0,steerAngle:0,steerCommand:0,
 wheelOmega:[0,0,0,0],longitudinalSlip:[0,0,0,0],slipAngles:[0,0,0,0],
 tireForceX:[0,0,0,0],tireForceY:[0,0,0,0],wheelLoads:[0,0,0,0],
 tireTemperature:[27,27,27,27],brakeTemperature:[28,28,28,28],
 soc:88,regenKw:0,powerKw:0,absActive:false,escActive:false,
 longitudinalAccel:0,lateralAccel:0,velocityForward:0,velocityLateral:0,
 gripUtilization:0,brakeDistance:0,contactImpacts:0,impactEnergyJ:0
};}
function tireNormal(s,m,i,ax,ay){
 const base=s.suspension?.normalForces?.[i];
 // Use the sprung-body instantaneous contact load, but permit a settled
 // start before the first 120 Hz suspension update.
 let f=Number.isFinite(base) && s.suspension.forceTotal>100 ? base : m*9.80665/4;
 const front=i<2;
 const side=corners[i][0]>0?1:-1;
 const trLong=m*ax*VEHICLE.cgHeight/(VEHICLE.wheelbase*2);
 const trLat=m*ay*VEHICLE.cgHeight/(VEHICLE.track*2);
 f+=(front?-trLong:trLong)-side*trLat;
 return clamp(f,0,22000);
}
export function stepRoadVehicle(s,input,rawDt,options={}){
 const dt=clamp(rawDt,0,.025),d=s.drivetrain??(s.drivetrain=makeVehicleDynamics());
 if(dt===0)return d;
 const m=options.mass||VEHICLE.mass,mu=clamp(options.mu??s.roadMu??VEHICLE.friction,.12,1.8);
 const steer=(input.left?1:0)-(input.right?1:0);
 const forward=(input.throttle?1:0)-(input.brake?1:0);
 const c=Math.cos(s.yaw),si=Math.sin(s.yaw);
 const vf=-s.vx*si-s.vz*c,vr=s.vx*c-s.vz*si;
 const speed=Math.hypot(vf,vr);
 // Rack has steering inertia, rack-angle limiting and speed-dependent range.
 const steerLimit=.48/(1+Math.pow(speed/22,1.55));
 const steerTarget=steer*steerLimit;
 d.steerAngle+=clamp(steerTarget-d.steerAngle,-1.55*dt,1.55*dt);
 d.steerCommand=steer;
 const accelPedal=forward>0?1:0,brakePedal=forward<0?1:0;
 const powerTaper=clamp(1-speed/96,.17,1);
 const driveTotal=accelPedal*VEHICLE.maxDriveN*powerTaper*(input.boost?1.28:1);
 const brakeTotal=brakePedal*VEHICLE.maxBrakingN;
 let sumFx=0,sumFy=0,torque=0,maxUtil=0,abs=false;
 const previousAx=d.longitudinalAccel,previousAy=d.lateralAccel;
 for(let i=0;i<4;i++){
   const [lx,lz]=corners[i],front=i<2;
   const n=tireNormal(s,m,i,previousAx,previousAy);
   d.wheelLoads[i]=n;
   const wheelF=vf+d.yawRate*lx,wheelR=vr+d.yawRate*lz;
   const delta=front?d.steerAngle:0;
   const wheelLong=wheelF*Math.cos(delta)-wheelR*Math.sin(delta);
   const wheelSide=wheelR*Math.cos(delta)+wheelF*Math.sin(delta);
   // Pacejka-inspired smooth saturation, relative to instantaneous vertical load.
   // Lateral tire force does not exist at zero wheel contact.
   const slipAngle=Math.atan2(wheelSide,Math.max(2,Math.abs(wheelLong)));
   const lateralMax=mu*n;
   let fy=-lateralMax*Math.tanh(VEHICLE.corneringRate*slipAngle);
   const axleFraction=front?.46:.54;
   const drive=driveTotal*axleFraction/2;
   const brake=brakeTotal*(front?.62:.38)/2;
   const roadSign=wheelLong>=-.1?1:-1;
   let demand=drive-brake*roadSign;
   // Combine braking and cornering inside a friction circle (not independent grip).
   const longitudinalLimit=Math.sqrt(Math.max(0,lateralMax*lateralMax-fy*fy));
   if(brakePedal&&Math.abs(demand)>longitudinalLimit+.01)abs=true;
   let fx=clamp(demand,-longitudinalLimit,longitudinalLimit);
   const spinTarget=wheelLong/VEHICLE.wheelRadius;
   const spinMismatch=(d.wheelOmega[i]-spinTarget);
   // Modest transient relaxation. A wheel may over/under-spin, but cannot
   // generate traction beyond the same friction envelope.
   fx=clamp(fx+spinMismatch*20,-longitudinalLimit,longitudinalLimit);
   d.wheelOmega[i]+=clamp((drive-brake*roadSign-fx)*VEHICLE.wheelRadius/VEHICLE.wheelInertia,-240,240)*dt;
   // Rolling wheel speed converges to kinematic speed when fully gripping.
   if(n>100){d.wheelOmega[i]+=(spinTarget-d.wheelOmega[i])*(1-Math.exp(-18*dt));}
   if(n<100)d.wheelOmega[i]*=Math.exp(-.9*dt);
   d.longitudinalSlip[i]=clamp((d.wheelOmega[i]*VEHICLE.wheelRadius-wheelLong)/Math.max(2,Math.abs(wheelLong)),-3,3);
   d.slipAngles[i]=slipAngle;d.tireForceX[i]=fx;d.tireForceY[i]=fy;
   const fForward=fx*Math.cos(delta)-fy*Math.sin(delta),fRight=fx*Math.sin(delta)+fy*Math.cos(delta);
   sumFx+=fForward;sumFy+=fRight;
   torque+=lz*fRight+lx*fForward;
   maxUtil=Math.max(maxUtil,lateralMax>0?Math.hypot(fx,fy)/lateralMax:0);
   const slipHeat=Math.abs(fy*wheelSide)+Math.abs(fx*(d.wheelOmega[i]*VEHICLE.wheelRadius-wheelLong));
   d.tireTemperature[i]=clamp(d.tireTemperature[i]+(slipHeat*.000075-(d.tireTemperature[i]-26)*.06)*dt,10,145);
   const discHeat=Math.abs(brake*wheelLong)*.00048;
   d.brakeTemperature[i]=clamp(d.brakeTemperature[i]+(discHeat-(d.brakeTemperature[i]-27)*.032)*dt,20,690);
 }
 const density=1.225,dragForce=.5*density*VEHICLE.dragCdA*speed*speed;
 const rolling=VEHICLE.rollingResistance*m*9.80665;
 const sign=vf>0?1:vf<0?-1:0;
 sumFx-=sign*(rolling+dragForce);
 // Aerodynamic side drag acts on lateral velocity and prevents endless drift.
 sumFy-=vr*(18+speed*1.3);
 // Yaw moment integrates independently: steering does not rotate the car on rails.
 const desiredRate=clamp(-vf*Math.tan(d.steerAngle)/VEHICLE.wheelbase,-2.1,2.1);
 const yawError=desiredRate-d.yawRate;
 const severeSlip=Math.abs(Math.atan2(vr,Math.max(2,Math.abs(vf))))>.22;
 d.escActive=!!s.assist&&speed>9&&(Math.abs(yawError)>.7||severeSlip);
 // ESC trims yaw response when trajectory becomes unstable.
 if(d.escActive)torque+=clamp(yawError*3800,-4200,4200);
 d.yawRate=clamp(d.yawRate+(torque/VEHICLE.yawInertia-d.yawRate*.18)*dt,-2.4,2.4);
 // Dynamic longitudinal and lateral velocities in car coordinates.
 const ax=sumFx/m,ay=sumFy/m;
 let nextForward=vf+ax*dt+vr*d.yawRate*dt;
 let nextSide=vr+ay*dt-vf*d.yawRate*dt;
 if(!accelPedal&&!brakePedal&&Math.abs(nextForward)<.015)nextForward=0;
 s.yaw+=d.yawRate*dt;
 const cc=Math.cos(s.yaw),ss=Math.sin(s.yaw);
 s.vx=-nextForward*ss+nextSide*cc;
 s.vz=-nextForward*cc-nextSide*ss;
 s.x+=s.vx*dt;s.z+=s.vz*dt;
 // The proving strip has real side barriers. Resolve contact using an
 // impulse/restitution rather than resetting or teleporting the vehicle.
 if(s.mode==='dynamics' && s.z>-120 && s.z<88 && (s.x<54||s.x>74)){
   const side=s.x<54?-1:1,impactSpeed=Math.max(0,s.vx*side);
   s.x=side<0?54:74;
   if(impactSpeed>.1){
     s.vx=-side*impactSpeed*.18;
     s.vz*=Math.max(.4,1-impactSpeed*.023);
     const energy=.5*m*impactSpeed*impactSpeed;
     d.impactEnergyJ+=energy;d.contactImpacts++;
     s.structural=clamp(s.structural-impactSpeed*1.8,0,100);
   }
 }

 s.speed=Math.hypot(s.vx,s.vz);
 d.longitudinalAccel=ax;d.lateralAccel=ay;d.velocityForward=nextForward;d.velocityLateral=nextSide;
 d.gripUtilization=clamp(maxUtil,0,1);d.absActive=abs;
 // Effective traction battery state: driving depletes, regenerative deceleration restores.
 const tractionWatts=driveTotal*Math.max(0,nextForward),recuperatedWatts=brakePedal?Math.min(VEHICLE.regenBrakingN*Math.max(0,nextForward),VEHICLE.regenBrakingN*25):0;
 const regen=Math.min(50000,recuperatedWatts)*.68;
 d.powerKw=tractionWatts/1000/0.91;d.regenKw=regen/1000;
 d.soc=clamp(d.soc+(regen-d.powerKw*1000)*dt/(VEHICLE.capacityKWh*3.6e6)*100,0,100);
 if(s.speed>1&&brakePedal)d.brakeDistance+=s.speed*dt;
 return d;
}