// V3.3: isolated, deterministic longitudinal dynamics for a dual-axle EV.
// All forces are newtons, torques newton-metres, speed m/s and power watts.
// Numerical values are engineering *hypotheses*, not manufacturer measurements.
export const PT=Object.freeze({
  frontFinalDrive:8.8,rearFinalDrive:8.5,
  frontPeakTorqueNm:620,rearPeakTorqueNm:780,
  frontBaseRpm:5200,rearBaseRpm:5100,frontRedlineRpm:16000,rearRedlineRpm:16000,
  frontMaxPowerW:255000,rearMaxPowerW:360000,
  drivetrainEfficiency:.92,motorTimeConstant:.032,
  hydraulicRise:.085,hydraulicRelease:.10,
  regenMaxPowerW:76000,regenForceCapN:4400,
  driveFrontSplit:.46,brakeFrontSplit:.62,
  wheelSlipRelaxLength:.58, longitudinalStiffness:13.5,
  maxBatteryDischargeW:635000,batteryCapacityKWh:84
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function motorTorqueCurve(rpm,axle='front'){
  const front=axle==='front';
  const peak=front?PT.frontPeakTorqueNm:PT.rearPeakTorqueNm;
  const base=front?PT.frontBaseRpm:PT.rearBaseRpm;
  const redline=front?PT.frontRedlineRpm:PT.rearRedlineRpm;
  const maxPower=front?PT.frontMaxPowerW:PT.rearMaxPowerW;
  const r=Math.abs(rpm);
  if(!Number.isFinite(r)||r>=redline)return 0;
  // Constant torque below base speed, then constant power, finally roll-off.
  const envelope=r<=base?peak:Math.min(peak,maxPower/Math.max(1,r*2*Math.PI/60));
  const tail=r>redline*.90?clamp((redline-r)/(redline*.10),0,1):1;
  return envelope*tail;
}
export function batteryPowerLimits(soc,tempC){
  const s=clamp(soc,0,100),t=clamp(tempC,-30,120);
  const socFactor=clamp((s-2)/15,.12,1);
  const cold=clamp((t+5)/22,.2,1);
  const heat=clamp((76-t)/17,.15,1);
  const dischargeW=PT.maxBatteryDischargeW*Math.min(socFactor,cold,heat);
  const chargeFactor=clamp((98-s)/12,0,1)*clamp((62-t)/15,.2,1)*cold;
  return {dischargeW,chargeW:PT.regenMaxPowerW*chargeFactor};
}
export function motorAxleForce(speedMps,soc,tempC,axle='front'){
  const front=axle==='front',ratio=front?PT.frontFinalDrive:PT.rearFinalDrive;
  const rpm=Math.abs(speedMps)*ratio/.45*60/(2*Math.PI);
  const torque=motorTorqueCurve(rpm,axle),limits=batteryPowerLimits(soc,tempC);
  const maxForce=torque*ratio*PT.drivetrainEfficiency/.45;
  const powerLimited=limits.dischargeW/(Math.max(1.7,Math.abs(speedMps)));
  return Math.max(0,Math.min(maxForce,powerLimited));
}
export function advanceActuator(current,target,dt,rise,release=rise){
  const c=clamp(current,0,1),t=clamp(target,0,1);
  const tau=t>c?rise:release;
  return clamp(c+(t-c)*(1-Math.exp(-dt/Math.max(.0001,tau))),0,1);
}
export function brakeBlend(pressure,speed,soc,batteryTemp){
  const p=clamp(pressure,0,1),v=Math.abs(speed);
  const limits=batteryPowerLimits(soc,batteryTemp);
  const requested=p*25900;
  const regenForce=v<.45?0:Math.min(requested*.33,PT.regenForceCapN,limits.chargeW/Math.max(1,v));
  return {requestedForceN:requested,regenForceN:regenForce,frictionForceN:Math.max(0,requested-regenForce),regenPowerW:regenForce*v};
}
// Mirror-symmetric differential mapping with conservative independent torque
// vectoring. All allocations are nonnegative and sum to the requested force.
export function allocateMotorForces(totalN,yawError,steerAngle,vectoringEnabled=true){
  const demand=Math.max(0,totalN),front=demand*PT.driveFrontSplit,rear=demand-front;
  const vector=vectoringEnabled?clamp(yawError*.075+steerAngle*.08,-.11,.11):0;
  // Positive yawError requests additional right-side driving force.
  return [front*(.5-vector),front*(.5+vector),rear*(.5-vector),rear*(.5+vector)];
}
export function longitudinalMagic(slip,normalN,mu,shape=1.28){
  if(!(normalN>0)||!(mu>0)||!Number.isFinite(slip))return 0;
  const x=PT.longitudinalStiffness*clamp(slip,-6,6),e=.48;
  return normalN*mu*Math.sin(shape*Math.atan(x-e*(x-Math.atan(x))));
}
export function combinedTireLimit(fx,fy,muFz,ellipse=1){
  if(!(muFz>0))return {fx:0,fy:0,utilization:0};
  const capX=muFz,capY=muFz*Math.max(.1,ellipse);
  const util=Math.hypot(fx/capX,fy/capY);
  const factor=util>1?1/util:1;
  return {fx:fx*factor,fy:fy*factor,utilization:Math.min(1,util)};
}
export function rotationalStep(omega,motorForceN,frictionBrakeN,tireForceN,radius,inertia,dt){
  if(!(dt>0))return omega;
  const brakeDirection=omega>.05?1:omega<-.05?-1:0;
  const acceleration=(motorForceN*radius-frictionBrakeN*radius*brakeDirection-tireForceN*radius)/Math.max(.2,inertia);
  let result=omega+clamp(acceleration,-1400,1400)*dt;
  if(frictionBrakeN>0&&brakeDirection!==0&&Math.sign(result)!==brakeDirection)result=0;
  return clamp(result,-800,800);
}
export function advanceMeasurements(metrics,speed,accelLateral,travelM,dt){
  const m=metrics||{t0:0,t060:null,quarterMileS:null,peakLateralG:0,travelM:0,elapsed:0};
  const previous=m.travelM;
  m.elapsed+=dt;m.travelM+=Math.max(0,travelM);
  m.peakLateralG=Math.max(m.peakLateralG,Math.abs(accelLateral)/9.80665);
  if(m.t060==null&&Math.abs(speed)>=26.8224)m.t060=m.elapsed;
  if(m.quarterMileS==null&&previous<402.336&&m.travelM>=402.336)m.quarterMileS=m.elapsed;
  return m;
}