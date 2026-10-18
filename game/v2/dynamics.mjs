import {simulateSuspension} from './suspension.mjs';
export const P={mass:2100,Iz:3900,wheelbase:2.85,lf:1.33,lr:1.52,track:1.68,wheelRadius:.355,cgHeight:.52,ride:.38,steerMax:.56,drag:.49,rolling:.013,frontDistribution:.51};
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function fresh(){return{x:0,z:85,y:0,yaw:Math.PI,vx:0,vz:0,speed:0,steer:0,yawRate:0,roll:0,pitch:0,wheels:[0,0,0,0],wheelSpin:0,slip:0,score:0,combo:0,distance:0,brake:0,throttle:0,handbrake:0,grip:1,gear:'D',surface:'ASPHALT',tire:[{},{},{},{}]};}
export function surfaceAt(x,z){if(Math.abs(x)<19&&z>-820&&z<820)return{mu:1.13,label:'ASPHALT'};if(Math.hypot(x+150,z-95)<75)return{mu:1.08,label:'PADDOCK'};if(Math.hypot(x-305,z+30)<595&&Math.hypot(x-305,z+30)>95)return{mu:1.00,label:'TRACK'};return{mu:.61,label:'DIRT'};}
const pace=(slip,peak,stiffness)=>peak*Math.sin(1.38*Math.atan(stiffness*slip-.4*(stiffness*slip-Math.atan(stiffness*slip))));
export function step(s,k,dt,muOverride){
 dt=clamp(dt,0,1/60);
 const t=+(!!(k.KeyW||k.ArrowUp)),b=+(!!(k.KeyS||k.ArrowDown)),hb=+(!!k.Space),turn=+(!!(k.KeyA||k.ArrowLeft))-+(!!(k.KeyD||k.ArrowRight));
 const surf=surfaceAt(s.x,s.z),mu=muOverride??surf.mu;s.surface=surf.label;s.grip=mu;s.throttle=t;s.brake=b;s.handbrake=hb;
 const fX=-Math.sin(s.yaw),fZ=-Math.cos(s.yaw),rX=Math.cos(s.yaw),rZ=-Math.sin(s.yaw);
 let u=s.vx*fX+s.vz*fZ,v=s.vx*rX+s.vz*rZ;
 const target=turn*P.steerMax/(1+Math.max(0,Math.abs(u)-7)*.021);
 s.steer+=clamp(target-s.steer,-dt*2.8,dt*2.8);
 const steer=s.steer;
 const yaw=s.yawRate;
 // Static axle weights plus longitudinal and lateral load transfer.
 const staticFront=P.mass*9.81*P.frontDistribution,staticRear=P.mass*9.81*(1-P.frontDistribution);
 const previousAx=s.ax??0,previousAy=s.ay??0;
 const transferX=clamp(-previousAx*P.mass*P.cgHeight/P.wheelbase,-.27*P.mass*9.81,.27*P.mass*9.81);
 const transferY=clamp(previousAy*P.mass*P.cgHeight/P.track,-.2*P.mass*9.81,.2*P.mass*9.81);
 const axleF=clamp(staticFront+transferX,1200,P.mass*9.81-1200),axleR=P.mass*9.81-axleF;
 const load=[axleF/2-transferY*.52,axleF/2+transferY*.52,axleR/2-transferY*.48,axleR/2+transferY*.48].map(x=>Math.max(200,x));
 const engine=18000*Math.max(.12,1-Math.abs(u)/115)*t;
 const totalBraking=b*23500;
 const forces=[];let totalFx=0,totalFy=0,moment=0;
 for(let i=0;i<4;i++){
  const front=i<2,side=i%2===0?-1:1,x=side*P.track/2,z=front?-P.lf:P.lr;
  const ux=u-yaw*x,vy=v+yaw*(front?P.lf:-P.lr);
  const a=front?steer:0,ca=Math.cos(a),sa=Math.sin(a);
  const vl=ux*ca+vy*sa,vt=-ux*sa+vy*ca;
  const alpha=Math.atan2(vt,Math.max(2,Math.abs(vl)));
  const normal=load[i];
  const sensitivity=clamp(1-.13*(normal/(P.mass*9.81/4)-1),.82,1.12);
  let grip=mu*sensitivity*(hb&&!front?.53:1)*normal;
  let fxLocal=(engine/4)-(totalBraking*(front?.31:.19))*Math.sign(vl||1)-(hb&&!front?normal*mu*.68*Math.sign(vl||1):0);
  const dragPart=(P.drag*u*Math.abs(u)+P.rolling*P.mass*9.81*Math.tanh(u*4))/4;
  fxLocal-=dragPart;
  fxLocal=clamp(fxLocal,-grip,grip);
  const maxFy=Math.sqrt(Math.max(0,grip*grip-fxLocal*fxLocal));
  const fyLocal=clamp(-pace(alpha,grip,9.8),-maxFy,maxFy);
  const fx=fxLocal*ca-fyLocal*sa,fy=fxLocal*sa+fyLocal*ca;
  totalFx+=fx;totalFy+=fy;
  moment+=z*fy-x*fx;
  forces.push({load:normal,fx,fy,slip:alpha,grip,steer:a});
 }
 // Local body axes: positive z is aft, so heading-positive yaw is opposite conventional yaw.
 const ax=totalFx/P.mass+v*yaw,ay=totalFy/P.mass-u*yaw;
 s.ax=clamp(totalFx/P.mass,-18,18);s.ay=clamp(totalFy/P.mass,-18,18);
 u+=ax*dt;v+=ay*dt;
 const yawAcc=-moment/P.Iz;
 s.yawRate=clamp((yaw+yawAcc*dt)*Math.exp(-.12*dt),-2.5,2.5);
 if(Math.abs(u)<.12&&!t&&!b){u*=Math.exp(-5*dt);v*=Math.exp(-9*dt);s.yawRate*=Math.exp(-8*dt);}
 s.yaw+=s.yawRate*dt;
 const newFX=-Math.sin(s.yaw),newFZ=-Math.cos(s.yaw),newRX=Math.cos(s.yaw),newRZ=-Math.sin(s.yaw);
 s.vx=u*newFX+v*newRX;s.vz=u*newFZ+v*newRZ;
 s.x+=s.vx*dt;s.z+=s.vz*dt;
 for(const a of [['x','vx','vz'],['z','vz','vx']])if(Math.abs(s[a[0]])>990){s[a[0]]=clamp(s[a[0]],-990,990);s[a[1]]*=-.15;s[a[2]]*=.78;}
 s.speed=Math.hypot(s.vx,s.vz);s.distance+=s.speed*dt;
 s.slip=Math.atan2(Math.abs(v),Math.max(1,Math.abs(u)));
 const drifting=s.speed>9&&s.slip>.12&&s.slip<.85;
 if(drifting){s.combo+=dt;s.score+=Math.floor(dt*55*s.speed*.25*(1+Math.min(s.combo,5)*.2));}else s.combo=Math.max(0,s.combo-dt*1.4);
 s.roll+=(clamp(-s.ay*.012,-.13,.13)-s.roll)*Math.min(1,dt*5);
 s.pitch+=(clamp(s.ax*.012,-.085,.085)-s.pitch)*Math.min(1,dt*4);
 s.wheelSpin+=u/P.wheelRadius*dt;
 s.tire=forces;
 simulateSuspension(s,dt);
 for(let i=0;i<4;i++)s.wheels[i]+=(s.suspension[i].compression-s.wheels[i])*Math.min(1,dt*13);
 return s;
}