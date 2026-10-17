export const MODES = {
  launch: { name: 'LAUNCH RUN', count: 6, startZ: 65, initialFlight: false },
  trial: { name: 'SKY TRIAL', count: 12, startZ: -140, initialFlight: true },
  free: { name: 'FREE FLIGHT', count: 0, startZ: 65, initialFlight: false }
};
export const MAX_DT = 0.05;
export function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
export function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
export function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const mins = Math.floor(s / 60).toString().padStart(2,'0');
  const sec = Math.floor(s % 60).toString().padStart(2,'0');
  const hundredths = Math.floor((s % 1) * 100).toString().padStart(2,'0');
  return mins + ':' + sec + '.' + hundredths;
}
export function makeGates(mode) {
  if (mode === 'free') return [];
  if (mode === 'launch') return [
    [0,4,-90], [0,24,-196], [-35,39,-300],
    [38,56,-424], [0,78,-540], [-25,104,-700]
  ].map((p,i) => ({ x:p[0], y:p[1], z:p[2], radius: mode === 'launch' ? 15 : 12, id:i }));
  return Array.from({length:12},(_,i)=>({
    x: Math.sin(i*0.98)*95 + Math.cos(i*.34)*28,
    y: 32 + i*13 + 14*Math.sin(i*1.38),
    z: -235 - i*112,
    radius: 15,
    id:i
  }));
}
export function crossedGate(previous, current, gate) {
  if (!gate) return false;
  const r2 = gate.radius * gate.radius;
  const dx = current.x - gate.x, dy = current.y-gate.y, dz = current.z-gate.z;
  const px = previous.x - gate.x, py = previous.y-gate.y, pz = previous.z-gate.z;
  if (dx*dx+dy*dy+dz*dz < r2) return true;
  // Segment-sphere intersection prevents high-speed tunneling.
  const ux = dx-px, uy=dy-py, uz=dz-pz;
  const denom = ux*ux+uy*uy+uz*uz;
  const t = clamp(-(px*ux+py*uy+pz*uz)/(denom||1),0,1);
  const sx = px+t*ux,sy=py+t*uy,sz=pz+t*uz;
  return sx*sx+sy*sy+sz*sz < r2;
}
export function freshState(mode) {
  const config = MODES[mode] || MODES.launch;
  return {
    x:0,y:config.initialFlight?30:1.25,z:config.startZ,
    heading:0,pitch:config.initialFlight?-.04:0,bank:0,
    speed: config.initialFlight?33:0,vy:0,boost:100,
    flying:config.initialFlight, elapsed:0,gates:0,done:false,
    distance:0,mode:mode in MODES ? mode:'launch',
    jumpReady:false
  };
}
export function physicsStep(state, keys, rawDt) {
  const dt=clamp(rawDt,0,MAX_DT), s={...state};
  if (s.done||dt===0) return s;
  s.elapsed+=dt;
  const throttle=keys.has('KeyW')||keys.has('ArrowForward') ? 1:0;
  const brake=keys.has('KeyS') ? 1:0;
  const left=keys.has('KeyA')?1:0,right=keys.has('KeyD')?1:0;
  const steer=right-left;
  const boosting=(keys.has('ShiftLeft')||keys.has('ShiftRight')||keys.has('Boost')) && s.boost>0.2;
  const accel=s.flying?20:26;
  const drag=s.flying?0.011:0.012;
  const maxSpeed=s.flying?140:82;
  s.speed=clamp(s.speed+(throttle*accel-brake*(s.flying?36:47)-5.5-s.speed*s.speed*drag*.06+(boosting?62:0))*dt,0,boosting?180:maxSpeed);
  s.boost=clamp(s.boost+(boosting?-30:8)*dt,0,100);
  const steeringRate=s.flying?0.78:1.15;
  s.heading+=steer*steeringRate*(s.flying?1:clamp(s.speed/22,0.12,1.0))*dt;
  if(s.flying){
    const pitchInput=(keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0);
    s.pitch=clamp(s.pitch+pitchInput*0.62*dt,-0.75,0.75);
    s.pitch=lerp(s.pitch,0,dt*.12);
    const rollInput=(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0);
    s.bank=lerp(s.bank,clamp(rollInput*.75-steer*.32,-1.1,1.1),dt*3);
    // Nose-up gives climb, forward flight sustains lift.
    const lift= (Math.sin(s.pitch)*s.speed)*.92 + Math.max(0,s.speed-20)*.055 - 5.2;
    s.vy=clamp(lerp(s.vy,lift,dt*1.8),-48,68);
    s.y+=s.vy*dt;
  }else{
    s.pitch=lerp(s.pitch,0,dt*4);s.bank=lerp(s.bank,-steer*.08,dt*5);
    s.vy=0;s.y=1.25;
    // Runway ramp launches the car into flight automatically.
    if(s.z< -109 && s.z> -147 && s.speed>19){
      s.y=1.25+(-109-s.z)*.34;
      s.pitch=-.18;
      if(s.z<-138) {s.flying=true;s.vy=7;s.pitch=-.16;}
    }
  }
  s.x+=Math.sin(s.heading)*Math.cos(s.pitch)*s.speed*dt;
  s.z-=Math.cos(s.heading)*Math.cos(s.pitch)*s.speed*dt;
  s.distance+=s.speed*dt;
  if (s.y<1.25){s.y=1.25;s.vy=0;s.pitch=0;s.bank=0;s.flying=false;}
  if (s.y>1500){s.y=1500;s.vy=Math.min(0,s.vy);}
  return s;
}