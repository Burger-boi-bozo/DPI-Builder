// Physical route descriptions shared by the renderer, minimap and tire solver.
// Coordinates use metres; no procedural label or lane may imply a different
// collision surface than this data layer.
export const PROVING_ROUTES=Object.freeze({
  damper:Object.freeze({name:'Suspension corridor',x:64,z0:88,z1:-125,halfWidth:8.5}),
  slalom:Object.freeze({name:'Slalom & braking',x:64,z0:-125,z1:-316,halfWidth:10}),
  skidpad:Object.freeze({name:'Skidpad',x:137,z:-264,radius:36,width:13}),
  connector:Object.freeze({name:'Handling connector',z:-264,x0:64,x1:137,width:14})
});
export const SLALOM_PYLONS=Object.freeze(Array.from({length:8},(_,i)=>Object.freeze({
  x:64+(i%2?-4.15:4.15),z:-163-i*17
})));
export const WET_PATCH=Object.freeze({x0:54,x1:74,z0:-252,z1:-223,depth:.007});
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
export function waterDepthAt(x,z){
 const w=WET_PATCH;
 return w.depth*smooth(w.x0,w.x0+3,x)*(1-smooth(w.x1-3,w.x1,x))
  *smooth(w.z0,w.z0+3,z)*(1-smooth(w.z1-3,w.z1,z));
}
export function surfaceGripAt(x,z,base=1.06){
 // Localized wet asphalt; the manual wet toggle still affects all surfaces.
 const depth=waterDepthAt(x,z);
 const wet=1-.26*(depth/WET_PATCH.depth);
 const gravel=x>204&&x<250&&z< -160&&z> -340?.68:1;
 return Math.max(.12,base*wet*gravel);
}
export function isPaved(x,z){
 const p=PROVING_ROUTES;
 return (Math.abs(x-p.damper.x)<p.damper.halfWidth&&z<=p.damper.z0&&z>=p.damper.z1)
 ||(Math.abs(x-p.slalom.x)<p.slalom.halfWidth&&z<=p.slalom.z0&&z>=p.slalom.z1)
 ||(Math.abs(z-p.connector.z)<p.connector.width/2&&x>=p.connector.x0&&x<=p.connector.x1)
 ||(Math.abs(Math.hypot(x-p.skidpad.x,z-p.skidpad.z)-p.skidpad.radius)<p.skidpad.width/2);
}