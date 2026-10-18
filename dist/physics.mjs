export const GATES = [
  [0, 4, -22], [0, 15, -98], [0, 12, -163], [34, 20, -213],
  [91, 24, -202], [119, 17, -145], [108, 10, -75], [71, 15, -12],
  [18, 20, 24], [-43, 13, 19], [-59, 9, -41], [0, 5, -37]
];
export const LOOP={x:-87,z:-88,r:20,width:12};
export const PARKED=[-100,-109,-118,-127,-136];
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const MEDALS={trial:[48,65,90],stunt:[12000,7000,3500]};
export function medalFor(mode,value){
  const targets=MEDALS[mode];if(!targets)return 'EXPLORER';
  const index=targets.findIndex(target=>mode==='trial'?value<=target:value>=target);
  return ['GOLD','SILVER','BRONZE'][index]||'FINISHER';
}
export function gateNavigation(s){
  const g=GATES[Math.min(s.gate,GATES.length-1)],prev=s.gate?GATES[s.gate-1]:[0,4,42];
  const dx=g[0]-prev[0],dz=g[2]-prev[2],length=Math.hypot(dx,dz),nx=dx/length,nz=dz/length;
  const passed=(s.x-g[0])*nx+(s.z-g[2])*nz>1;
  return {x:g[0]-(passed?nx*24:0),y:g[1],z:g[2]-(passed?nz*24:0),recovering:passed};
}
export function toggleAltitudeHold(s){
  if(s.holdAltitude!==null){s.holdAltitude=null;return false;}
  if(s.grounded||s.y<2||s.air<=0||s.loopAngle!==null)return false;
  s.holdAltitude=s.y;return true;
}
function awardStunt(s,base,type,events){
  if(s.mode!=='trial'){
    s.combo=s.comboTime>0?Math.min(5,s.combo+1):1;s.comboTime=7;
    s.maxCombo=Math.max(s.maxCombo,s.combo);
  }
  const multiplier=s.mode==='trial'?1:s.combo,points=base*multiplier;
  s.score+=points;events.push({type,points,multiplier});
}
export function heightAt(x,z){return Math.abs(x)<8 && z<=-62 && z>=-82 ? (-62-z)*.38 : 0;}
export function createState(mode='trial'){
  return {mode,x:0,y:0,z:42,yaw:0,speed:0,vy:0,air:100,time:0,score:0,gate:0,
    grounded:true,airtime:0,roll:0,rollTime:0,rollDirection:1,suction:true,
    loopAngle:null,loopCooldown:0,completed:false,jumpArmed:false,
    objectives:{roll:false,jump:false,loop:false},resets:0,boosting:false,lifting:false,pitch:0,
    holdAltitude:null,holding:false,combo:0,comboTime:0,maxCombo:0,splits:[],maxAltitude:0,maxSpeed:0};
}
export function resetPosition(s,penalty=true){
  let x=0,y=0,z=42,yaw=0;
  if(s.mode==='trial'&&s.gate>0&&s.gate<GATES.length){
    const prev=GATES[s.gate-1],next=GATES[s.gate];
    x=prev[0];y=prev[1];z=prev[2];yaw=Math.atan2(-(next[0]-x),-(next[2]-z));
  }
  Object.assign(s,{x,y,z,yaw,speed:0,vy:0,air:100,grounded:y===0,airtime:0,
    roll:0,rollTime:0,pitch:0,loopAngle:null,loopCooldown:1,lifting:false,boosting:false,jumpArmed:false,
    holdAltitude:null,holding:false,combo:0,comboTime:0});
  if(penalty){s.resets++;if(s.mode==='trial')s.time+=3;s.score=Math.max(0,s.score-250);}
}
export function gateCrossed(a,b,index){
  const g=GATES[index];if(!g)return false;
  const prev=index===0?[0,4,42]:GATES[index-1];
  let nx=g[0]-prev[0],nz=g[2]-prev[2];const mag=Math.hypot(nx,nz);nx/=mag;nz/=mag;
  const d0=(a.x-g[0])*nx+(a.z-g[2])*nz,d1=(b.x-g[0])*nx+(b.z-g[2])*nz;
  if(d0>0||d1<0||Math.abs(d1-d0)<1e-7)return false;
  const t=-d0/(d1-d0),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t+1,z=a.z+(b.z-a.z)*t;
  return Math.hypot(x-g[0],y-g[1],z-g[2])<7.5;
}
export function step(s,input,dt){
  const events=[];if(s.completed)return events;dt=clamp(dt,0,.04);s.time+=dt;
  s.comboTime=Math.max(0,s.comboTime-dt);if(s.comboTime===0)s.combo=0;
  s.loopCooldown=Math.max(0,s.loopCooldown-dt);
  const old={x:s.x,y:s.y,z:s.z};
  if(input.roll&&!s.rollTime&&s.y>2&&s.loopAngle===null&&s.air>=7){s.rollTime=1.05;s.rollDirection=input.roll;if(s.mode!=='free')s.air-=7;}
  if(s.rollTime>0){s.rollTime=Math.max(0,s.rollTime-dt);s.roll=s.rollDirection*(1-s.rollTime/1.05)*Math.PI*2;
    if(s.rollTime===0){s.roll=0;if(s.y>1){s.objectives.roll=true;awardStunt(s,750,'roll',events);}}
  }
  if(input.lift||input.descend||s.grounded||s.air<=0||s.loopAngle!==null)s.holdAltitude=null;
  s.holding=s.holdAltitude!==null;
  s.lifting=!!input.lift&&s.air>0&&s.loopAngle===null;
  s.boosting=!!input.boost&&s.air>0;
  let acceleration=(input.throttle?24:0)-(input.brake?(s.speed>1?43:14):0)+(s.boosting?47:0);
  acceleration-=Math.sign(s.speed)*(.7+.0047*s.speed*s.speed);
  if(!input.throttle&&!input.brake&&!s.boosting&&Math.abs(s.speed)<.09)s.speed=0;
  else s.speed=clamp(s.speed+acceleration*dt,-12,s.boosting?91:67);
  if(s.loopAngle!==null){
    s.speed=Math.max(25,s.speed);s.loopAngle+=s.speed/LOOP.r*dt;
    s.x=LOOP.x;s.y=LOOP.r*(1-Math.cos(s.loopAngle));s.z=LOOP.z-LOOP.r*Math.sin(s.loopAngle);
    s.pitch=s.loopAngle;s.yaw=0;s.grounded=true;s.air=Math.min(100,s.air+20*dt);
    if(s.loopAngle>=Math.PI*2){s.loopAngle=null;s.loopCooldown=3;s.y=0;s.z=LOOP.z-3;s.pitch=0;s.objectives.loop=true;awardStunt(s,1500,'loop',events);}
  } else {
    const steer=(input.left?1:0)-(input.right?1:0);
    const turn=(s.grounded?Math.min(1.65,Math.abs(s.speed)*.085):1.32)*Math.sign(s.speed||1);
    s.yaw+=steer*turn*dt;
    s.x-=Math.sin(s.yaw)*s.speed*dt;s.z-=Math.cos(s.yaw)*s.speed*dt;
    const ground=heightAt(s.x,s.z),oldGround=heightAt(old.x,old.z);
    if(s.holding){s.vy+=(clamp((s.holdAltitude-s.y)*3,-6,6)-s.vy)*6*dt;s.y+=s.vy*dt;}
    else if(s.lifting){if(s.grounded){s.vy=6;s.grounded=false;}s.vy+=(8-s.vy)*2.2*dt;s.y+=s.vy*dt;}
    else if(s.grounded&&oldGround>ground+.5){s.grounded=false;s.vy=Math.max(5,s.speed*.38);s.y+=s.vy*dt;}
    else if(s.grounded){s.y=ground;s.vy=0;}
    else{s.vy-=(input.descend?19:12)*dt;s.y+=s.vy*dt;}
    if(!s.grounded){
      s.airtime+=dt;
      if(s.y<=ground){
        const impact=s.vy;s.y=ground;s.vy=0;s.grounded=true;
        if(s.airtime>1.15){
          const smooth=impact>-10,base=Math.round(s.airtime*60/10)*10,multiplier=smooth&&s.mode!=='trial'?Math.max(1,s.combo):1;
          const pts=base*multiplier;s.score+=pts;events.push({type:smooth?'landing':'hardLanding',points:pts,multiplier});
          if(!smooth){s.combo=0;s.comboTime=0;}
        }
        s.airtime=0;s.rollTime=0;s.roll=0;
      }
    }
    s.y=Math.min(70,s.y);if(s.y>=70)s.vy=Math.min(0,s.vy);
    s.pitch=s.grounded&&ground>0?.36:clamp(s.vy*.013,-.2,.18);
    if(s.suction&&s.grounded&&s.speed>13&&s.loopCooldown===0&&Math.abs(s.x-LOOP.x)<5&&s.z<LOOP.z+5&&s.z>LOOP.z-4&&Math.cos(s.yaw)>.9){s.loopAngle=.01;events.push({type:'loopStart'});}
  }
  if(s.mode==='free')s.air=100;
  else if(s.lifting||s.boosting||s.holding)s.air=Math.max(0,s.air-((s.lifting?9:0)+(s.boosting?13:0)+(s.holding?6:0))*dt);
  else if(s.grounded)s.air=Math.min(100,s.air+33*dt);
  if(s.z<-97&&s.z>-139&&Math.abs(s.x)<5&&s.y>3)s.jumpArmed=true;
  if(s.jumpArmed&&s.z<-141&&Math.abs(s.x)<8&&s.y>2){s.jumpArmed=false;if(!s.objectives.jump){s.objectives.jump=true;awardStunt(s,1200,'jump',events);}}
  if(Math.abs(s.x)<3.3&&s.y<1.9&&PARKED.some(z=>Math.abs(z-s.z)<3)&&Math.abs(s.speed)>3){resetPosition(s);events.push({type:'crash'});return events;}
  if(Math.abs(s.x)>370||Math.abs(s.z)>400){resetPosition(s);events.push({type:'boundary'});return events;}
  if(s.mode==='trial'&&gateCrossed(old,s,s.gate)){
    s.gate++;s.splits.push(s.time);s.score+=1000;s.air=Math.min(100,s.air+38);events.push({type:'gate',points:1000});
    if(s.gate===GATES.length){s.completed=true;events.push({type:'finish'});}
  }
  if(s.mode==='stunt'&&s.time>=90){s.completed=true;events.push({type:'finish'});}
  s.maxAltitude=Math.max(s.maxAltitude,s.y);s.maxSpeed=Math.max(s.maxSpeed,Math.abs(s.speed));
  return events;
}
