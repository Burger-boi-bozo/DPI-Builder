import {surfaceGripAt,waterDepthAt,SLALOM_PYLONS} from './range.mjs';
import {HARDPOINTS,magicFormulaForce,relaxationStep,tirePressureFromHeat} from './engineering.mjs';
import {PT,motorAxleForce,batteryPowerLimits,advanceActuator,brakeBlend,allocateMotorForces,longitudinalMagic,combinedTireLimit,rotationalStep,advanceMeasurements} from './powertrain.mjs?v=3.3.0';
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
// Laboratory approximation: load sensitivity and compound temperature response.
// Peak friction occurs at a warm tread. No measured OEM tire data is assumed.
export function effectiveTireMu(base,tempC,normalN,velocity=0,wear=0){
  const tempFactor=clamp(1-Math.pow((tempC-62)/155,2),.64,1.02);
  const loadFactor=clamp(1-.105*(normalN/5300-1),.80,1.12);
  const wet=base<.75;
  const waterFactor=wet?1-.23*clamp((Math.abs(velocity)-18)/47,0,1):1;
  return clamp(base*tempFactor*loadFactor*waterFactor*(1-.34*clamp(wear,0,1)),.09,1.9);
}
export function brakeFadeFactor(rotorC){return clamp(1-.62*clamp((rotorC-360)/340,0,1),.38,1);}
const corners=[[-1.08,-1.48],[1.08,-1.48],[-1.08,1.45],[1.08,1.45]];
// Positive steering is left: front left is the inside tire; front right
// is inside for a right turn. Ackermann is computed from the physical
// wheelbase and front track, not a duplicated visual wheel rotation.
export function steeringAngles(rackAngle,wheelbase=VEHICLE.wheelbase,track=VEHICLE.track){
 const a=clamp(rackAngle,-.58,.58);
 if(Math.abs(a)<1e-7)return [0,0];
 const centerRadius=wheelbase/Math.tan(Math.abs(a));
 const inner=Math.atan(wheelbase/Math.max(.1,centerRadius-track/2));
 const outer=Math.atan(wheelbase/(centerRadius+track/2));
 return a>0?[inner,outer]:[-outer,-inner];
}
export function steeringCommand(input){
 // Allows analog steering from a gamepad; keyboard remains fully supported.
 if(Number.isFinite(input.steer))return clamp(input.steer,-1,1);
 return Number(!!input.left)-Number(!!input.right);
}

export function makeVehicleDynamics(){return {
 yawRate:0,steerAngle:0,steerCommand:0,
 wheelOmega:[0,0,0,0],longitudinalSlip:[0,0,0,0],slipAngles:[0,0,0,0],
 tireForceX:[0,0,0,0],tireForceY:[0,0,0,0],wheelLoads:[0,0,0,0],
 tireTemperature:[27,27,27,27],carcassTemperature:[25,25,25,25],tirePressure:[240,240,240,240],
 relaxedSlipAngles:[0,0,0,0],tireCompound:'sport',waterDepth:0,batteryTemp:28,
 brakeTemperature:[28,28,28,28],
 tireWear:[0,0,0,0],tcsEnabled:true,tcsActive:false,torqueLimit:1,gear:"D",shiftHold:0,
 soc:88,regenKw:0,powerKw:0,absActive:false,escActive:false,
 driveActuator:0,brakePressure:0,regenForceN:0,frontMotorForceN:0,rearMotorForceN:0,
 vectoringEnabled:true,vectoringMomentNm:0,relaxedLongSlip:[0,0,0,0],
 wheelSpinInitialized:false,metrics:null,energyAudit:{batteryOutJ:0,regenJ:0,frictionBrakeJ:0,tireSlipJ:0},
 longitudinalAccel:0,lateralAccel:0,velocityForward:0,velocityLateral:0,
 gripUtilization:0,brakeDistance:0,contactImpacts:0,impactEnergyJ:0,hitPylons:[],pylonImpacts:0
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
 const steer=steeringCommand(input);
 const c=Math.cos(s.yaw),si=Math.sin(s.yaw);
 const vf=-s.vx*si-s.vz*c,vr=s.vx*c-s.vz*si;
 const speed=Math.hypot(vf,vr);
 // Automotive direction selection: brake to a complete stop before reverse.
 // The held opposite pedal engages the requested direction after 0.3 s;
 // switching while rolling instead requests the brakes, never instant inversion.
 const forwardKey=!!input.throttle&&!input.brake,reverseKey=!!input.brake&&!input.throttle;
 const shifting=(d.gear==='D'&&reverseKey)||(d.gear==='R'&&forwardKey);
 d.shiftHold=shifting&&Math.abs(vf)<.36?d.shiftHold+dt:0;
 if(d.shiftHold>.3){d.gear=d.gear==='D'?'R':'D';d.shiftHold=0;}
 const driving=(d.gear==='D'&&forwardKey)||(d.gear==='R'&&reverseKey);
 const braking=(d.gear==='D'&&reverseKey)||(d.gear==='R'&&forwardKey);
 const driveDirection=d.gear==='D'?1:-1;
 // Rack has steering inertia, rack-angle limiting and speed-dependent range.
 const steerLimit=.56/(1+Math.pow(speed/27,1.35));
 // Mechanical trail and positive caster produce a speed-dependent aligning
 // tendency when the driver releases the steering command.
 const selfAlign=steer===0?clamp(1+speed*HARDPOINTS.trail*Math.sin(HARDPOINTS.caster)*13,1,2.7):1;
 const steerTarget=steer*steerLimit;
 d.steerAngle+=clamp(steerTarget-d.steerAngle,-2.45*selfAlign*dt,2.45*selfAlign*dt);
 d.steerCommand=steer;
 const accelPedal=driving?clamp(Number(input.throttle)||1,0,1):0;
 const brakePedal=braking?clamp(Number(d.gear==='D'?input.brake:input.throttle)||1,0,1):0;
 const steerWheels=steeringAngles(d.steerAngle);
 // Torque/speed map and battery derating; this is an illustrative EV motor map.
 const batteryLimits=batteryPowerLimits(d.soc,d.batteryTemp);
 const motorFront=motorAxleForce(speed,d.soc,d.batteryTemp,'front');
 const motorRear=motorAxleForce(speed,d.soc,d.batteryTemp,'rear');
 const maxMotorForce=Math.min(VEHICLE.maxDriveN,motorFront+motorRear);
 // Charge/discharge, hydraulic pressure and motor requests have finite response.
 d.driveActuator=advanceActuator(d.driveActuator,driving?clamp(Number(input.throttle)||1,0,1):0,dt,PT.motorTimeConstant,.065);
 d.brakePressure=advanceActuator(d.brakePressure,braking?clamp(Number(d.gear==='D'?input.brake:input.throttle)||1,0,1):0,dt,PT.hydraulicRise,PT.hydraulicRelease);
 // Per-wheel slip is sampled from the previous 120 Hz step; the next motor
 // command trims wheel torque when the demanded slip exceeds peak traction.
 const slipExcess=Math.max(...d.longitudinalSlip.map(v=>Math.max(0,driveDirection*v-.12)));
 const torqueLimit=d.tcsEnabled&&driving?clamp(1-1.8*slipExcess,.20,1):1;
 d.torqueLimit+=(torqueLimit-d.torqueLimit)*(1-Math.exp(-24*dt));
 d.tcsActive=!!d.tcsEnabled&&driving&&d.torqueLimit<.95;
 const driveTotal=(driving?driveDirection*d.driveActuator:0)*maxMotorForce*(input.boost?1.12:1)*d.torqueLimit*(d.gear==='R'?.5:1);
 const blend=brakeBlend(d.brakePressure,speed,d.soc,d.batteryTemp);
 const brakeTotal=blend.frictionForceN;
 d.regenForceN=blend.regenForceN;
 d.frontMotorForceN=motorFront;d.rearMotorForceN=motorRear;
 const desiredYaw=clamp(vf*Math.tan(d.steerAngle)/VEHICLE.wheelbase,-2.1,2.1);
 const motorForceByWheel=allocateMotorForces(Math.abs(driveTotal),desiredYaw-d.yawRate,d.steerAngle,d.vectoringEnabled);
 let sumFx=0,sumFy=0,torque=0,maxUtil=0,abs=false,slipPower=0,brakeWork=0;
 const previousAx=d.longitudinalAccel,previousAy=d.lateralAccel;
 if(!d.wheelSpinInitialized){for(let i=0;i<4;i++)d.wheelOmega[i]=vf/VEHICLE.wheelRadius;d.wheelSpinInitialized=true;}
 for(let i=0;i<4;i++){
   const [lx,lz]=corners[i],front=i<2;
   const n=tireNormal(s,m,i,previousAx,previousAy);
   d.wheelLoads[i]=n;
   const wheelF=vf+d.yawRate*lx,wheelR=vr+d.yawRate*lz;
   const delta=(front?steerWheels[i]:0)+(s.suspension?.wheelToe?.[i]||0);
   const wheelLong=wheelF*Math.cos(delta)-wheelR*Math.sin(delta);
   const wheelSide=wheelR*Math.cos(delta)+wheelF*Math.sin(delta);
   // Pacejka-inspired smooth saturation, relative to instantaneous vertical load.
   // Lateral tire force does not exist at zero wheel contact.
   const slipAngle=Math.atan2(wheelSide,Math.max(2,Math.abs(wheelLong)));
   d.relaxedSlipAngles[i]=relaxationStep(d.relaxedSlipAngles[i],slipAngle,speed,dt,1.7);
   d.tirePressure[i]=tirePressureFromHeat(240,d.carcassTemperature[i],25);
   const pressureRatio=d.tirePressure[i]/240;
   const pressureFactor=clamp(1-.12*Math.abs(Math.log(pressureRatio)),.75,1);
   const compoundFactor=d.tireCompound==='touring'?.91:d.tireCompound==='track'?1.09:1;
   const hydroplane=d.waterDepth>0?clamp(1-d.waterDepth*Math.pow(Math.abs(wheelLong)/28,2)*.62,.26,1):1;
   const cx=s.x+lx*c+lz*si,cz=s.z-lx*si+lz*c;
   const effectiveMu=surfaceGripAt(cx,cz,mu);
   const localWater=Math.max(d.waterDepth,waterDepthAt(cx,cz));
   const localHydroplane=localWater>0?clamp(1-localWater*Math.pow(Math.abs(wheelLong)/27,2)*.60,.28,1):1;
   const tireMu=effectiveTireMu(effectiveMu,d.tireTemperature[i],n,speed,d.tireWear[i])*pressureFactor*compoundFactor*hydroplane*localHydroplane;
   const lateralMax=tireMu*n;
   const camber=s.suspension?.wheelCamber?.[i]||0;
   let fy=-magicFormulaForce(d.relaxedSlipAngles[i],n,tireMu,
        VEHICLE.corneringRate*clamp(pressureRatio,.70,1.22),1.12)+camber*n*.12*tireMu;
   fy=clamp(fy,-lateralMax,lateralMax);
   const drive=driveDirection*motorForceByWheel[i];
   const brake=brakeTotal*(front?PT.brakeFrontSplit:1-PT.brakeFrontSplit)/2*brakeFadeFactor(d.brakeTemperature[i]);
   const regenBrake=blend.regenForceN*(front?.3:.7)/2;
   const roadSign=wheelLong>.12?1:wheelLong<-.12?-1:0;
   let demand=drive-(brake+regenBrake)*roadSign;
   // Two-dimensional friction ellipse caps the patch as a single vector.
   const spinTarget=wheelLong/VEHICLE.wheelRadius;
   const rawSlip=clamp((d.wheelOmega[i]*VEHICLE.wheelRadius-wheelLong)/Math.max(2,Math.abs(wheelLong)),-3,3);
   d.relaxedLongSlip[i]=relaxationStep(d.relaxedLongSlip[i],rawSlip,Math.max(8,Math.abs(wheelLong)),dt,PT.wheelSlipRelaxLength);
   const tireLong=longitudinalMagic(d.relaxedLongSlip[i],n,tireMu);
   const longitudinalLimit=Math.sqrt(Math.max(0,lateralMax*lateralMax-fy*fy));
   if(brakePedal&&Math.abs(demand)>longitudinalLimit+.01)abs=true;
   // A patch-slip transient is coupled to motor/brake demand: the force
   // follows wheel rotation yet does not teleport to an infinite-slip state.
   const blendedContact=clamp(.90*demand+.10*tireLong,-longitudinalLimit,longitudinalLimit);
   const limited=combinedTireLimit(blendedContact,fy,lateralMax);
   let fx=limited.fx;fy=limited.fy;
   d.wheelOmega[i]=rotationalStep(d.wheelOmega[i],drive-regenBrake*roadSign,brake,fx,VEHICLE.wheelRadius,VEHICLE.wheelInertia,dt);
   // Low-speed wheel/road synchronisation models rubber coupling; it only
   // acts under positive normal load and never supplies net chassis force.
   if(n>100){d.wheelOmega[i]+=(spinTarget-d.wheelOmega[i])*(1-Math.exp(-12*dt));}
   if(n<100)d.wheelOmega[i]*=Math.exp(-.9*dt);
   d.longitudinalSlip[i]=clamp((d.wheelOmega[i]*VEHICLE.wheelRadius-wheelLong)/Math.max(2,Math.abs(wheelLong)),-3,3);
   d.slipAngles[i]=slipAngle;d.tireForceX[i]=fx;d.tireForceY[i]=fy;
   const fForward=fx*Math.cos(delta)-fy*Math.sin(delta),fRight=fx*Math.sin(delta)+fy*Math.cos(delta);
   sumFx+=fForward;sumFy+=fRight;
   torque+=lz*fRight+lx*fForward;
   maxUtil=Math.max(maxUtil,lateralMax>0?Math.hypot(fx,fy)/lateralMax:0);
   const slipHeat=Math.abs(fy*wheelSide)+Math.abs(fx*(d.wheelOmega[i]*VEHICLE.wheelRadius-wheelLong));
   slipPower+=slipHeat;brakeWork+=Math.abs(brake*wheelLong);
   d.tireTemperature[i]=clamp(d.tireTemperature[i]+(slipHeat*.000075-(d.tireTemperature[i]-26)*.06)*dt,10,145);
   // Wear accrues from frictional work at the contact patch (not distance
   // alone); a sliding tire wears faster, progressively losing adhesion.
   d.tireWear[i]=clamp(d.tireWear[i]+slipHeat*dt/(d.tireCompound==='track'?6.2e7:8.5e7),0,1);
   d.carcassTemperature[i]=clamp(d.carcassTemperature[i]+((d.tireTemperature[i]-d.carcassTemperature[i])*.13- (d.carcassTemperature[i]-24)*.012)*dt,0,115);
   const discHeat=Math.abs(brake*wheelLong)*.00048;
   d.brakeTemperature[i]=clamp(d.brakeTemperature[i]+(discHeat-(d.brakeTemperature[i]-27)*(.032+speed*.0007))*dt,20,690);
 }
 const density=1.225,dragForce=.5*density*VEHICLE.dragCdA*speed*speed;
 const rolling=VEHICLE.rollingResistance*m*9.80665;
 const sign=vf>0?1:vf<0?-1:0;
 sumFx-=sign*(rolling+dragForce);
 // Aerodynamic side drag acts on lateral velocity and prevents endless drift.
 sumFy-=vr*(18+speed*1.3);
 // Yaw moment integrates independently: steering does not rotate the car on rails.
 const desiredRate=desiredYaw;
 const yawError=desiredRate-d.yawRate;
 const severeSlip=Math.abs(Math.atan2(vr,Math.max(2,Math.abs(vf))))>.22;
 d.escActive=!!s.assist&&speed>9&&(Math.abs(yawError)>.7||severeSlip);
 // ESC trims yaw response when trajectory becomes unstable.
 if(d.escActive)torque+=clamp(yawError*3800,-4200,4200);
 d.yawRate=clamp(d.yawRate+(torque/VEHICLE.yawInertia-d.yawRate*(.22+.035*speed))*dt,-2.4,2.4);
 // Dynamic longitudinal and lateral velocities in car coordinates.
 const ax=sumFx/m,ay=sumFy/m;
 let nextForward=vf+ax*dt+vr*d.yawRate*dt;
 // Hydraulic braking is dissipative: it cannot propel the car across zero.
 if(brakePedal&&Math.abs(vf)<.22)nextForward=0;
 else if(brakePedal&&vf*nextForward<0)nextForward=0;
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

 // Elliptical footprint approximates the Roadster's 2.3 m body length.
 // Each slalom pylon can be struck once, dissipating energy and tipping visually.
 if(s.mode==='dynamics'&&s.z< -145){
   for(let i=0;i<SLALOM_PYLONS.length;i++){
     if(d.hitPylons.includes(i))continue;
     const p=SLALOM_PYLONS[i],dx=p.x-s.x,dz=p.z-s.z;
     const side=(dx*Math.cos(s.yaw)-dz*Math.sin(s.y))/1.44;
     const front=(dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw))/2.65;
     if(side*side+front*front<1){
       d.hitPylons.push(i);d.pylonImpacts++;
       const impactSpeed=Math.hypot(s.vx,s.vz);
       const loss=Math.min(1.5,.045*impactSpeed);
       s.vx*=1-loss;s.vz*=1-loss;
       d.yawRate+=clamp(-side*.045,-.07,.07);
       s.structural=clamp(s.structural-.15*impactSpeed,0,100);
       d.impactEnergyJ+=.5*m*(impactSpeed**2)*(1-(1-loss)**2);
     }
   }
 }
 s.speed=Math.hypot(s.vx,s.vz);
 d.longitudinalAccel=ax;d.lateralAccel=ay;d.velocityForward=nextForward;d.velocityLateral=nextSide;
 d.gripUtilization=clamp(maxUtil,0,1);d.absActive=abs;
 // Effective traction battery state: driving depletes, regenerative deceleration restores.
 const tractionWatts=Math.abs(driveTotal*nextForward);
 const regen=Math.min(batteryLimits.chargeW,blend.regenPowerW)*.76;
 d.powerKw=tractionWatts/1000/PT.drivetrainEfficiency;d.regenKw=regen/1000;
 d.energyAudit.batteryOutJ+=d.powerKw*1000*dt;d.energyAudit.regenJ+=regen*dt;
 d.energyAudit.frictionBrakeJ+=brakeWork*dt;d.energyAudit.tireSlipJ+=slipPower*dt;
 d.metrics=advanceMeasurements(d.metrics,s.speed,d.lateralAccel,Math.hypot(s.vx,s.vz)*dt,dt);
 d.soc=clamp(d.soc+(regen-d.powerKw*1000)*dt/(VEHICLE.capacityKWh*3.6e6)*100,0,100);
 d.batteryTemp=clamp(d.batteryTemp+((d.powerKw*.008)-.018*(d.batteryTemp-26))*dt,12,90);
 if(s.speed>1&&brakePedal)d.brakeDistance+=s.speed*dt;
 return d;
}