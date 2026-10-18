// Deterministic three-axis rigid-body attitude dynamics for the concept test craft.
// Pilot requests are mapped to torque; angular rates are integrated against inertia.
// Independent virtual cold-gas jet pairs are balanced around the CG. Not OEM data.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const ATTITUDE=Object.freeze({
 dryYawInertia:4180,dryPitchInertia:3510,dryRollInertia:1440,
 propYawInertiaPerKg:.46,propPitchInertiaPerKg:.31,propRollInertiaPerKg:.22,
 maxYawTorque:17500,maxPitchTorque:12200,maxRollTorque:8100,
 dampingYaw:4600,dampingPitch:4200,dampingRoll:2650,
 jetLeverArm:1.23,controlTimeConstant:.09,rateYawLimit:1.6,rateTiltLimit:1.2
});
export function makeAttitudeState(){return {
 yawRate:0,pitchRate:0,rollRate:0,
 yawTorque:0,pitchTorque:0,rollTorque:0,
 yawDemand:0,pitchDemand:0,rollDemand:0,
 jetFlowKg:0,jetForces:[0,0,0,0], angularKineticJ:0
};}
export function inertiaForPropellant(propMass){
 const p=clamp(propMass,0,260);
 return {yaw:ATTITUDE.dryYawInertia+p*ATTITUDE.propYawInertiaPerKg,
  pitch:ATTITUDE.dryPitchInertia+p*ATTITUDE.propPitchInertiaPerKg,
  roll:ATTITUDE.dryRollInertia+p*ATTITUDE.propRollInertiaPerKg};
}
function lag(value,target,dt){return value+(target-value)*(1-Math.exp(-dt/ATTITUDE.controlTimeConstant));}
export function integrateAttitude(s,control,rawDt,propellant=s.propellant||0){
 const dt=clamp(rawDt,0,.025);
 if(!dt)return s.attitude||(s.attitude=makeAttitudeState());
 const a=s.attitude||(s.attitude=makeAttitudeState());
 const inert=inertiaForPropellant(propellant);
 const turn=clamp(control.turn||0,-1,1),forward=clamp(control.forward||0,-1,1),side=clamp(control.lateral||0,-1,1);
 const assist=!!control.assist;
 // Controlled rate targets and steady attitude targets. A released stick
 // leaves the yaw heading unchanged, while pitch/roll settle toward level.
 const yawTarget=turn*.8;
 const pitchTarget=clamp(-forward*.09-(control.verticalSpeed||0)*.012,-.2,.2);
 const rollTarget=clamp(side*.10+turn*.045+(control.windCross||0)*.005,-.22,.22);
 const yawRequest=assist?(yawTarget-a.yawRate)*inert.yaw*3.9:turn*ATTITUDE.maxYawTorque*.7;
 const pitchRequest=assist?(pitchTarget-(s.pitch||0))*inert.pitch*8-a.pitchRate*inert.pitch*3.4:
    (-forward*.43*ATTITUDE.maxPitchTorque);
 const rollRequest=assist?(rollTarget-(s.roll||0))*inert.roll*9-a.rollRate*inert.roll*4.2:
    (side*.54+turn*.20)*ATTITUDE.maxRollTorque;
 a.yawDemand=lag(a.yawDemand,propellant>0?clamp(yawRequest,-ATTITUDE.maxYawTorque,ATTITUDE.maxYawTorque):0,dt);
 a.pitchDemand=lag(a.pitchDemand,propellant>0?clamp(pitchRequest,-ATTITUDE.maxPitchTorque,ATTITUDE.maxPitchTorque):0,dt);
 a.rollDemand=lag(a.rollDemand,propellant>0?clamp(rollRequest,-ATTITUDE.maxRollTorque,ATTITUDE.maxRollTorque):0,dt);
 if(propellant<=0){a.yawDemand=0;a.pitchDemand=0;a.rollDemand=0;}
 a.yawTorque=a.yawDemand-ATTITUDE.dampingYaw*a.yawRate*.4;
 a.pitchTorque=a.pitchDemand-ATTITUDE.dampingPitch*a.pitchRate*.35;
 a.rollTorque=a.rollDemand-ATTITUDE.dampingRoll*a.rollRate*.35;
 a.yawRate=clamp(a.yawRate+(a.yawTorque/inert.yaw)*dt,-ATTITUDE.rateYawLimit,ATTITUDE.rateYawLimit);
 a.pitchRate=clamp(a.pitchRate+(a.pitchTorque/inert.pitch)*dt,-ATTITUDE.rateTiltLimit,ATTITUDE.rateTiltLimit);
 a.rollRate=clamp(a.rollRate+(a.rollTorque/inert.roll)*dt,-ATTITUDE.rateTiltLimit,ATTITUDE.rateTiltLimit);
 s.yaw=(s.yaw||0)+a.yawRate*dt;
 s.pitch=clamp((s.pitch||0)+a.pitchRate*dt,-.45,.45);
 s.roll=clamp((s.roll||0)+a.rollRate*dt,-.48,.48);
 // Virtual nozzle forces are balanced: no spurious net translation from pure
 // attitude commands. Paired opposite jets generate rotational impulses.
 const fyaw=a.yawDemand/(4*ATTITUDE.jetLeverArm);
 const froll=a.rollDemand/(4*ATTITUDE.jetLeverArm);
 const fpitch=a.pitchDemand/(4*ATTITUDE.jetLeverArm);
 a.jetForces=[fyaw+froll+fpitch,-fyaw-froll+fpitch,-fyaw+froll-fpitch,fyaw-froll-fpitch];
 const jetBudget=a.jetForces.reduce((sum,jet)=>sum+Math.abs(jet),0);
 a.jetFlowKg=jetBudget/(2300*4)*dt;
 a.angularKineticJ=.5*(inert.yaw*a.yawRate*a.yawRate+inert.pitch*a.pitchRate*a.pitchRate+inert.roll*a.rollRate*a.rollRate);
 return a;
}