// World-space free-orbit camera. Pure controls math for repeatable unit tests.
export const ORBIT_LIMITS=Object.freeze({minDistance:2.8,maxDistance:75,minElevation:-1.20,maxElevation:1.38,maxPan:25});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function createOrbitState(){return {azimuth:0,elevation:.32,distance:12,panX:0,panY:0,panZ:0};}
export function resetOrbit(state,yaw=0){state.azimuth=Number.isFinite(yaw)?yaw+.32:.32;state.elevation=.35;state.distance=13;state.panX=0;state.panY=0;state.panZ=0;return state;}
export function orbitDrag(s,dx,dy){
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return s;
 s.azimuth=((s.azimuth-dx*.0055+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
 s.elevation=clamp(s.elevation+dy*.0045,ORBIT_LIMITS.minElevation,ORBIT_LIMITS.maxElevation);
 return s;
}
export function orbitZoom(s,delta){if(Number.isFinite(delta))s.distance=clamp(s.distance*Math.exp(clamp(delta,-1000,1000)*.0015),ORBIT_LIMITS.minDistance,ORBIT_LIMITS.maxDistance);return s;}
export function orbitPan(s,dx,dy){
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return s;
 const unit=clamp(s.distance*.0018,.006,.08);
 s.panX=clamp(s.panX+Math.cos(s.azimuth)*dx*unit,-ORBIT_LIMITS.maxPan,ORBIT_LIMITS.maxPan);
 s.panZ=clamp(s.panZ-Math.sin(s.azimuth)*dx*unit,-ORBIT_LIMITS.maxPan,ORBIT_LIMITS.maxPan);
 s.panY=clamp(s.panY+dy*unit,-ORBIT_LIMITS.maxPan,ORBIT_LIMITS.maxPan);
 return s;
}
export function orbitPose(s,focus){
 const x=focus.x+s.panX,y=focus.y+s.panY,z=focus.z+s.panZ;
 const h=Math.cos(s.elevation)*s.distance;
 return {target:{x,y,z},position:{x:x+Math.sin(s.azimuth)*h,y:y+Math.sin(s.elevation)*s.distance,z:z+Math.cos(s.azimuth)*h}};
}