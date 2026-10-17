// Four-corner sprung-body model: independent terrain contact, vertical spring/
// damper force, bump stops, roll bars, chassis heave/pitch/roll and tire grip.
// The model is intentionally parameterized rather than claiming OEM Roadster data.
const G=9.80665;
export const SUSPENSION={
  mass:2160, wheelbase:2.93,track:2.16, wheelRadius:.45,
  springRate:38500,damperBump:5100,damperRebound:4200,
  restCompression:.1376,maxCompression:.29,maxDroop:.17,
  bumpStopRate:150000,rollBar:8600,
  pitchInertia:3280,rollInertia:1380,rideHeight:0.0,
  tireMu:1.08
};
export const CHASSIS_SETUPS=Object.freeze({
  comfort:Object.freeze({label:'COMFORT',springRate:31000,damperBump:3400,damperRebound:3200,rollBar:4300}),
  balanced:Object.freeze({label:'BALANCED',springRate:38500,damperBump:5100,damperRebound:4200,rollBar:8600}),
  track:Object.freeze({label:'TRACK',springRate:56000,damperBump:7500,damperRebound:6200,rollBar:15800})
});
export function createChassisTune(preset='balanced'){
  const safe=Object.hasOwn(CHASSIS_SETUPS,preset)?preset:'balanced';
  return {preset:safe,springScale:1,damperScale:1};
}
export function setChassisSetup(a,preset){
  a.tune=createChassisTune(preset);
  return a.tune;
}
export function setChassisAdjustment(a,key,value){
  if(!['springScale','damperScale'].includes(key))return a.tune;
  const val=Number(value);
  if(Number.isFinite(val))a.tune[key]=clamp(val,.70,1.45);
  return a.tune;
}
export function tuningParameters(tuning){
  const chosen=CHASSIS_SETUPS[tuning?.preset]||CHASSIS_SETUPS.balanced;
  const springScale=clamp(Number(tuning?.springScale)||1,.70,1.45),damperScale=clamp(Number(tuning?.damperScale)||1,.70,1.45);
  const springRate=chosen.springRate*springScale;
  return {...chosen,springRate,damperBump:chosen.damperBump*damperScale,
   damperRebound:chosen.damperRebound*damperScale,
   restCompression:SUSPENSION.mass*G/(4*springRate)};
}
const corners=[[-1.08,-1.48],[1.08,-1.48],[-1.08,1.45],[1.08,1.45]];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Driveable suspension proving strip east of the runway: wide, smooth lead-in,
// successive bumps, a washboard, and a shallow offset rut. Height in meters.
export function surfaceAt(x,z){
  const ax=Math.abs(x-64);
  const side=clamp((8.5-ax)/1.5,0,1);
  if(!side||z< -125||z>88)return 0;
  const lead=clamp((z+125)/6,0,1)*clamp((88-z)/6,0,1);
  let bump=0;
  for(const center of [57,39,21]){
    const d=Math.abs(z-center);
    if(d<1.35)bump+=.20*(.5+.5*Math.cos(Math.PI*d/1.35));
  }
  if(z<-2&&z>-65){
    const fade=clamp((-z-2)/6,0,1)*clamp((z+65)/6,0,1);
    bump+=.064*(.5+.5*Math.sin((z+2)*Math.PI*2/2.5))*fade;
  }
  if(z<-77&&z>-112){
    const fade=clamp((-z-77)/4,0,1)*clamp((z+112)/4,0,1);
    bump+=.12*(x>64?1:0)*fade;
  }
  return bump*side*lead;
}
export function createSuspension(){return {
  heave:0,heaveVelocity:0,pitch:0,pitchVelocity:0,roll:0,rollVelocity:0,
  wheelTravel:[0,0,0,0], compression:[0,0,0,0], normalForces:[0,0,0,0],
  contact:[true,true,true,true], tireLoads:[0,0,0,0],
  groundHeights:[0,0,0,0], grip:1, contactCount:4,
  forceTotal:0, maxCompression:0, wheelSpin:[0,0,0,0],
  lastX:0,lastZ:0,verticalAccel:0,slip:0,
  tune:createChassisTune(),testTime:0,accelG2:0,rideRmsG:0,
  peakTravel:0,peakRollDeg:0,airborneWheelSeconds:0,bottomOuts:0
};}
export function suspensionStep(a,vehicle,dt, options={}){
  if(!a||dt<=0)return a;
  dt=clamp(dt,0,1/60);
  const yaw=vehicle.yaw||0,cy=Math.cos(yaw),sy=Math.sin(yaw);
  const height=options.height||surfaceAt;
  const mass=options.mass||SUSPENSION.mass;
  const tune=tuningParameters(options.tune||a.tune);
  const y=Math.max(0,vehicle.y||0);
  const flight=y>.5||vehicle.loopAngle!=null;
  let sum=0, pitchTorque=0,rollTorque=0,contactCount=0;
  const force=[0,0,0,0],travel=[0,0,0,0],contact=[false,false,false,false];
  for(let i=0;i<4;i++){
    const [lx,lz]=corners[i];
    const wx=vehicle.x+lx*cy+lz*sy,wz=vehicle.z-lx*sy+lz*cy;
    const h=height(wx,wz);
    const cornerHeight=y+a.heave+a.roll*lx-a.pitch*lz;
    const cornerVelocity=a.heaveVelocity+a.rollVelocity*lx-a.pitchVelocity*lz;
    // Deflection above the nominal loaded wheel location; positive compression
    // drives the tire toward the road; negative compression allows droop.
    const raw=tune.restCompression-(cornerHeight-h);
    const compression=clamp(raw,0,SUSPENSION.maxCompression);
    const bottomOut=Math.max(0,raw-SUSPENSION.maxCompression);
    // Damping acts against *relative* motion rather than speed alone.
    const damper=cornerVelocity<0?tune.damperBump:tune.damperRebound;
    let f=Math.max(0,tune.springRate*compression-damper*cornerVelocity+SUSPENSION.bumpStopRate*bottomOut);
    if(flight||raw < -SUSPENSION.maxDroop)f=0;
    force[i]=f;contact[i]=f>1;
    if(contact[i])contactCount++;
    sum+=f;rollTorque+=lx*f;pitchTorque-=lz*f;
    a.groundHeights[i]=h;
    // Wheel center extension is distinct from sprung chassis heave.
    travel[i]=clamp(-cornerHeight+h,-SUSPENSION.maxDroop,SUSPENSION.maxCompression);
  }
  // Cross-axle torsion: opposite left/right deflections resist body roll.
  // This changes wheel loads; torque sum remains balanced.
  for(const pair of [[0,1],[2,3]]){
    const [l,r]=pair;const delta=travel[l]-travel[r];
    const anti=tune.rollBar*delta;
    if(force[l]+force[r]>0){
      const correction=clamp(anti,-force[r],force[l]);
      force[l]-=correction;force[r]+=correction;
    }
  }
  sum=0;rollTorque=0;pitchTorque=0;
  for(let i=0;i<4;i++){const [lx,lz]=corners[i];sum+=force[i];rollTorque+=lx*force[i];pitchTorque-=lz*force[i];}
  const accel=flight?(-a.heave*23-a.heaveVelocity*12):(sum/mass-G);
  a.heaveVelocity=clamp(a.heaveVelocity+accel*dt,-8,8);
  a.heave=clamp(a.heave+a.heaveVelocity*dt,-.22,.5);
  if(a.heave<=-.22&&a.heaveVelocity<0)a.heaveVelocity=0;
  if(a.heave>=.5&&a.heaveVelocity>0)a.heaveVelocity=0;
  // Under acceleration, the horizontal CG inertial force produces real
  // pitch/roll moment rather than directly animating a decorative tilt.
  const aLong=clamp(vehicle.drivetrain?.longitudinalAccel||0,-18,18),aLat=clamp(vehicle.drivetrain?.lateralAccel||0,-18,18);
  const pitchAcceleration=flight?(-a.pitch*23-a.pitchVelocity*12):(pitchTorque+mass*aLong*.53)/SUSPENSION.pitchInertia;
  const rollAcceleration=flight?(-a.roll*24-a.rollVelocity*12):(rollTorque+mass*aLat*.53)/SUSPENSION.rollInertia;
  a.pitchVelocity=clamp(a.pitchVelocity+pitchAcceleration*dt,-2.5,2.5);
  a.rollVelocity=clamp(a.rollVelocity+rollAcceleration*dt,-3,3);
  a.pitch=clamp(a.pitch+a.pitchVelocity*dt,-.23,.23);
  a.roll=clamp(a.roll+a.rollVelocity*dt,-.28,.28);
  // A small body-to-ground displacement is not a teleport; tire contact still
  // follows the ground via travel until the suspension reaches its stops.
  a.forceTotal=sum;a.verticalAccel=sum/mass-G;a.contactCount=contactCount;
  a.wheelTravel=travel;a.contact=contact;a.normalForces=force;
  a.tireLoads=force.map(f=>f/G);
  a.compression=travel.map(t=>clamp(tune.restCompression+t,0,SUSPENSION.maxCompression));
  a.maxCompression=Math.max(...a.compression);
  a.grip=clamp(sum/(mass*G),0,1.35)*(contactCount/4);
  if(!flight){
    a.testTime+=dt;
    const verticalG=a.verticalAccel/G;
    a.accelG2+=verticalG*verticalG*dt;
    a.rideRmsG=Math.sqrt(a.accelG2/Math.max(dt,a.testTime));
    a.peakTravel=Math.max(a.peakTravel,...travel.map(Math.abs));
    a.peakRollDeg=Math.max(a.peakRollDeg,Math.abs(a.roll)*180/Math.PI);
    a.airborneWheelSeconds+=(4-contactCount)*dt;
    if(travel.some(t=>t>=SUSPENSION.maxCompression-.001))a.bottomOuts++;
  }
  const speed=vehicle.speed||Math.hypot(vehicle.vx||0,vehicle.vz||0);
  for(let i=0;i<4;i++)a.wheelSpin[i]+=(vehicle.drivetrain?vehicle.drivetrain.wheelOmega[i]:speed/SUSPENSION.wheelRadius)*dt;
  return a;
}