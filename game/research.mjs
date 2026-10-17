// Roadster X-Flight: deterministic, physically inspired experimental-flight model.
// An original concept simulation. Thruster performance is hypothetical, not Tesla performance data.
import {clamp} from './physics.mjs';
export const RESEARCH_STAGES=[
  {name:'HOVER CAPTURE',detail:'Lift to 6–11 m. Stabilize over the launch pad for 1.8 s.',kind:'hover',x:0,y:8,z:42,radius:12},
  {name:'VECTOR TRANSFER',detail:'Navigate the low calibration torus.',kind:'gate',x:0,y:12,z:-36,radius:13},
  {name:'ASCENT CORRIDOR',detail:'Climb through the elevated crosswind ring.',kind:'gate',x:-18,y:26,z:-91,radius:15},
  {name:'LATERAL IMPULSE',detail:'Shift east to the final approach torus.',kind:'gate',x:32,y:18,z:-144,radius:15},
  {name:'SOFT DOCKING',detail:'Land at the violet pad below 3 m/s vertical and 5 m/s lateral.',kind:'land',x:32,y:0,z:-191,radius:12}
];
const G=9.80665, DRY_MASS=1900, PROP_CAPACITY=260, THRUST_MAX=42500;
const GRAVITY=G;
export function windAt(t,altitude=0){
  const shear=1+Math.min(2,Math.max(0,altitude)/110);
  return {x:(1.65+1.45*Math.sin(t*.19)+.55*Math.sin(t*1.13))*shear,
    z:(.25+1.25*Math.cos(t*.23)+.45*Math.sin(t*.83))*shear};
}
export function makeResearchState(){return {
  mode:'research',x:0,y:0,z:42,yaw:0,pitch:0,roll:0,speed:0,vy:0,vx:0,vz:0,
  air:100,propellant:PROP_CAPACITY,temperature:23,structural:100,thrust:0,thrustG:0,
  windX:0,windZ:0,slip:0,grounded:true,boosting:false,lifting:false,precision:false,assist:true,
  time:0,score:0,gate:0,stage:0,stableTime:0,completed:false,failed:false,
  objectives:{roll:false,jump:false,loop:false},resets:0,loopAngle:null,suction:false,
  verticalSpeed:0,peakAltitude:0,highestGs:0,landingGs:0,flightDistance:0,energy:100,
  events:0, hardLandings:0, cda:.85
};}
export function setPrecision(state,on){state.precision=!!on;state.hoverAltitude=Math.max(0,state.y);}
function sweptGate(a,b,target){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,dist2=dx*dx+dy*dy+dz*dz;
  const dot=(target.x-a.x)*dx+(target.y-a.y)*dy+(target.z-a.z)*dz;
  const u=dist2>1e-9?clamp(dot/dist2,0,1):0;
  return Math.hypot(a.x+u*dx-target.x,a.y+u*dy-target.y,a.z+u*dz-target.z)<target.radius;
}
export function stepResearch(s,input,rawDt){
  const dt=clamp(rawDt,0,.025),events=[];
  if(!dt||s.completed)return events;
  s.time+=dt;
  const previous={x:s.x,y:s.y,z:s.z};
  const wind=windAt(s.time,s.y);s.windX=wind.x;s.windZ=wind.z;
  const mass=DRY_MASS+s.propellant;
  const propAvailable=s.propellant>0;
  const lift=!!input.lift&&propAvailable,boost=!!input.boost&&propAvailable;
  s.lifting=lift;s.boosting=boost;
  const lateral=(input.strafeRight?1:0)-(input.strafeLeft?1:0);
  const turn=(input.left?1:0)-(input.right?1:0);
  const forward=(input.throttle?1:0)-(input.brake?1:0);
  const yawRate=s.grounded?.8:.67;
  s.yaw+=turn*yawRate*dt;
  // The closed-loop hover controller maintains a user-selected altitude, and
  // uses propellant to do so; it does not disable gravity or create free lift.
  let accelerationUp=0;
  if(propAvailable){
    if(lift){accelerationUp=19.2;}
    else if(s.precision&&!s.grounded){
      const err=clamp((s.hoverAltitude??s.y)-s.y,-10,10);
      accelerationUp=clamp(G+err*2.2-s.vy*3.7,-9,THRUST_MAX/mass);
    }
  }
  if(!lift&&!s.precision&&s.grounded)accelerationUp=0;
  const thrustN=Math.min(THRUST_MAX,Math.abs(accelerationUp)*mass);
  s.thrust=thrustN;s.thrustG=accelerationUp/G;
  // Mass flow = thrust / exhaust velocity. Effective exhaust velocity here is
  // a concept design parameter; it is intentionally exposed by the model.
  const exhaustVelocity=2300;
  s.propellant=Math.max(0,s.propellant-thrustN/exhaustVelocity*dt-(boost?3.7*dt:0));
  s.air=100*s.propellant/PROP_CAPACITY;
  const yawSin=Math.sin(s.yaw),yawCos=Math.cos(s.yaw);
  const driveForce=(s.grounded?9.5:3.4)*forward+(boost?11.6:0);
  const sideForce=(s.grounded?3.2:5.5)*lateral;
  const ax= -yawSin*driveForce + yawCos*sideForce;
  const az= -yawCos*driveForce - yawSin*sideForce;
  const rvx=s.vx-wind.x,rvz=s.vz-wind.z;
  const relativeSpeed=Math.hypot(rvx,rvz,s.vy);
  const density=1.225*Math.exp(-Math.max(0,s.y)/8500);
  const drag=.5*density*s.cda*relativeSpeed/mass;
  const damp=s.grounded?2.5:(s.assist?.11:.015);
  const sideDamp=s.precision&&!forward&&!lateral&&!s.grounded?.8:damp;
  s.vx+=(ax-drag*rvx-sideDamp*s.vx)*dt;
  s.vz+=(az-drag*rvz-sideDamp*s.vz)*dt;
  s.vy+=(accelerationUp-G-drag*s.vy)*dt;
  if(s.grounded&&!lift){s.vy=0;}
  // Stable hovering needs some lateral counter-wind impulse: closed-loop jets.
  if(s.precision&&!s.grounded&&s.assist&&!lateral&&!forward){
    const correction=1-Math.exp(-1.6*dt);
    s.vx+=(wind.x*.15-s.vx)*correction;
    s.vz+=(wind.z*.15-s.vz)*correction;
    s.propellant=Math.max(0,s.propellant-1.2*dt);
  }
  s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;
  const horizontalSpeed=Math.hypot(s.vx,s.vz);
  s.flightDistance+=Math.hypot(s.vx,s.vy,s.vz)*dt;
  if(s.y<=0){
    if(!s.grounded){
      const verticalImpact=Math.abs(s.vy),horizontalImpact=horizontalSpeed;
      s.landingGs=1+verticalImpact*verticalImpact/(2*G*.35);
      s.lastLandingStage=s.stage;s.lastTouchdownX=s.x;s.lastTouchdownZ=s.z;
      if(verticalImpact>4.8||horizontalImpact>12){
        s.hardLandings++;
        const damage=clamp((verticalImpact-4.8)*6+(horizontalImpact-12)*1.2,0,78);
        s.structural=clamp(s.structural-damage,0,100);
        events.push({type:'researchHardLanding',damage:Math.round(damage)});
      }else if(verticalImpact>.5)events.push({type:'researchLanding'});
    }
    s.y=0;s.vy=0;s.grounded=true;
    if(!lift){s.vx*=Math.max(0,1-.65*dt);s.vz*=Math.max(0,1-.65*dt);}
  }else s.grounded=false;
  s.speed=horizontalSpeed;
  s.verticalSpeed=s.vy;
  s.peakAltitude=Math.max(s.peakAltitude,s.y);
  s.highestGs=Math.max(s.highestGs,Math.abs(accelerationUp-G)/G);
  s.slip=Math.atan2(lateral?sideForce:s.vx-wind.x,Math.max(1,Math.abs(driveForce)));
  const yawPitch=clamp(-s.vy*.026,-.25,.24);
  s.pitch+=(yawPitch-s.pitch)*(1-Math.exp(-3*dt));
  const rollTarget=clamp((-lateral*.18-turn*.12-(s.vx-wind.x)*.012),-.34,.34);
  s.roll+=(rollTarget-s.roll)*(1-Math.exp(-3*dt));
  // Thermal and structural models are bounded, rate-based approximations.
  const heating=(thrustN/THRUST_MAX)*17+(boost?22:0)+.014*relativeSpeed*relativeSpeed;
  s.temperature=clamp(s.temperature+(heating-(s.temperature-23)*.09)*dt,23,320);
  if(s.temperature>145){s.structural=Math.max(0,s.structural-(s.temperature-145)*.012*dt);}
  if(s.structural<=0||s.y>230||Math.abs(s.x)>350||Math.abs(s.z)>400){
    s.completed=true;s.failed=true;events.push({type:'researchAbort',reason:s.structural<=0?'STRUCTURAL LIMIT':'TEST-RANGE LIMIT'});
    return events;
  }
  const target=RESEARCH_STAGES[s.stage];
  if(target){
    if(target.kind==='hover'){
      const stable=s.y>=6&&s.y<=11&&Math.hypot(s.x,s.z-42)<11&&Math.abs(s.vy)<3.2&&horizontalSpeed<6;
      s.stableTime=stable?s.stableTime+dt:Math.max(0,s.stableTime-dt*2);
      if(s.stableTime>=1.8){s.stage++;s.gate++;s.score+=1600;events.push({type:'researchStage',stage:s.stage,points:1600});}
    } else if(target.kind==='gate'&&sweptGate(previous,s,target)){
      s.stage++;s.gate++;s.score+=1500;events.push({type:'researchStage',stage:s.stage,points:1500});
    } else if(target.kind==='land'&&s.grounded&&horizontalSpeed<5&&
      Math.hypot(s.x-target.x,s.z-target.z)<target.radius &&
      s.lastLandingStage===4 && Math.hypot(s.lastTouchdownX-target.x,s.lastTouchdownZ-target.z)<target.radius && s.landingGs>0&&s.landingGs<2.8){
      s.score+=2500+Math.round(s.propellant);s.stage++;s.gate++;s.completed=true;
      events.push({type:'researchStage',stage:s.stage,points:2500});
      events.push({type:'researchFinish'});
    }
  }
  return events;
}