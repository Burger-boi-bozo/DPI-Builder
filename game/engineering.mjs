// Experimental, parameterized suspension hard points, not OEM dimensions.
// All distances are in meters, angles in radians. Positive X points outward
// from the vehicle center for either wheel side.
export const HARDPOINTS=Object.freeze({
  upperInner:{x:.48,y:.50,z:-.09},upperOuter:{x:.85,y:.42,z:-.02},
  lowerInner:{x:.45,y:-.02,z:.03},lowerOuter:{x:.89,y:-.13,z:0},
  tieInner:{x:.47,y:.11,z:.12},tieOuter:{x:.87,y:.09,z:.16},
  caster:6.5*Math.PI/180,trail:.072,uprightHeight:.55
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Intersect each wishbone's rigid projected length with a horizontal line at
// the displaced upright pick-up. This captures camber gain from unequal arms;
// tie-rod steering change is a small-angle geometric projection.
function outerX(inner,outer,travel){
 const length2=(outer.x-inner.x)**2+(outer.y-inner.y)**2;
 const dy=outer.y+travel-inner.y;
 return inner.x+Math.sqrt(Math.max(0,length2-dy*dy));
}
export function wishboneKinematics(travel,side=1,p=HARDPOINTS){
 const t=clamp(Number.isFinite(travel)?travel:0,-.17,.29);
 const xU=outerX(p.upperInner,p.upperOuter,t),xL=outerX(p.lowerInner,p.lowerOuter,t);
 const xU0=outerX(p.upperInner,p.upperOuter,0),xL0=outerX(p.lowerInner,p.lowerOuter,0);
 const camber=-.018+Math.atan2((xU-xL)-(xU0-xL0),p.uprightHeight);
 const dx=(xU+xL-xU0-xL0)/2;
 const rodXY=p.tieOuter.x-p.tieInner.x,rodZ=p.tieOuter.z-p.tieInner.z;
 const rodLength2=rodXY*rodXY+rodZ*rodZ;
 const newRodX=rodXY+dx;
 const newRodZ=Math.sign(rodZ||1)*Math.sqrt(Math.max(.00000001,rodLength2-newRodX*newRodX));
 const toe=clamp((newRodZ-rodZ)*.16,-.065,.065);
 return {travel:t,camber:camber*side,toe:toe*side,caster:p.caster*side,trail:p.trail,
  upperOutboard:xU*side,lowerOutboard:xL*side,trackChange:dx*side};
}
// Temperature and wheel pressure remain conceptual unless OEM measurements
// are supplied. Positive load and force are always in SI units.
export function tirePressureFromHeat(coldKpa,carcassC,ambientC=20){
 const absKpa=Math.max(70,coldKpa)+101.325;
 return Math.max(50,absKpa*(273.15+carcassC)/(273.15+ambientC)-101.325);
}
// Pacejka-like MF shape, with independently tunable stiffness, shape and peak;
// peak is strictly capped by mu*Fz and force is zero without contact.
export function magicFormulaForce(slip,normalN,mu,stiffness=10,shape=1.32){
 if(!(normalN>0)||!(mu>0)||!Number.isFinite(slip))return 0;
 const B=Math.max(.05,stiffness),C=clamp(shape,.65,2),D=Math.max(0,normalN*mu),E=.45;
 const s=B*slip;
 return D*Math.sin(C*Math.atan(s-E*(s-Math.atan(s))));
}
export function relaxationStep(previous,target,speed,dt,length=1.8){
 if(!(dt>0))return previous;
 const rate=Math.max(.5,Math.abs(speed))/Math.max(.2,length);
 return previous+(target-previous)*(1-Math.exp(-rate*dt));
}
// Recorded displacement traces can be fed into this repeatable profile runner.
// This format intentionally includes only displacement and distance, not a
// fabricated measured data set.
export function traceProfile(samples){
 if(!Array.isArray(samples)||samples.length<2)throw Error('Trace requires two or more samples');
 const sorted=samples.map(x=>({distance:Number(x.distance),height:Number(x.height)})).sort((a,b)=>a.distance-b.distance);
 if(sorted.some(x=>!Number.isFinite(x.distance)||!Number.isFinite(x.height)))throw Error('Trace must have finite SI values');
 if(sorted.some((x,i)=>i&&x.distance<=sorted[i-1].distance))throw Error('Trace distances must increase');
 return distance=>{
  if(distance<=sorted[0].distance)return sorted[0].height;
  if(distance>=sorted.at(-1).distance)return sorted.at(-1).height;
  let lo=0,hi=sorted.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(sorted[mid].distance<=distance)lo=mid;else hi=mid;}
  const a=sorted[lo],b=sorted[hi],u=(distance-a.distance)/(b.distance-a.distance);
  return a.height+(b.height-a.height)*u;
 };
}