// Four-corner spring/damper model with independent unsprung displacement.
// All distances meters; forces newtons. This is a rigid chassis approximation,
// not a soft-body solver.
export const corners=[[-.84,-1.425],[.84,-1.425],[-.84,1.425],[.84,1.425]];
export const setup={sprungMass:1740,unsprungMass:45,spring:39000,bump:4300,rebound:6400,antiroll:14000,travel:.17,radius:.355,ride:.38};
export const initialSuspension=()=>corners.map(()=>({compression:0,velocity:0,force:0,contact:true,unsprung:0}));
export function simulateSuspension(s,dt,roadHeight=()=>0){
 const sus=s.suspension??(s.suspension=initialSuspension());
 const frontRoll=s.roll,bodyPitch=s.pitch;
 const comps=[];
 for(let i=0;i<4;i++){
  const [x,z]=corners[i],c=sus[i];
  const cy=roadHeight(s.x+x,s.z+z);
  const target=Math.max(-setup.travel,Math.min(setup.travel,cy-s.y+frontRoll*x+bodyPitch*z));
  const delta=target-c.compression;
  const vel=delta/Math.max(dt,.001);
  const f=setup.spring*target+(vel>0?setup.bump:setup.rebound)*vel;
  const accel=(f-setup.spring*c.compression)/setup.unsprungMass;
  c.velocity=Math.max(-3,Math.min(3,c.velocity+accel*dt));
  c.compression=Math.max(-setup.travel,Math.min(setup.travel,c.compression+c.velocity*dt));
  c.unsprung=cy;
  c.contact=true;c.force=Math.max(0,setup.sprungMass*9.81/4+f);
  comps.push(c.compression);
 }
 for(const [a,b] of [[0,1],[2,3]]){
  let delta=comps[a]-comps[b],bar=setup.antiroll*delta;
  sus[a].force=Math.max(0,sus[a].force-bar);
  sus[b].force=Math.max(0,sus[b].force+bar);
 }
 return sus;
}