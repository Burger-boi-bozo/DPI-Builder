
import './style.css';
import { MODES, makeGates, freshState, physicsStep, crossedGate, formatTime, clamp } from './physics.js';
import { createWorld } from './scene.js';

const $=id=>document.getElementById(id);
const world=createWorld($('world'));
let mode='launch',phase='menu',state=freshState(mode),gates=makeGates(mode);
let last=performance.now(),lookBack=false,sound=false,soundSystem=null,noticeEnd=0,controlsFrom='menu';
const keys=new Set();
const bestKey=m=>'roadster-v2-best-'+m;
function readBest(m){try{const x=Number(localStorage.getItem(bestKey(m)));return x>0?x:null;}catch{return null;}}
function saveBest(m,t){try{localStorage.setItem(bestKey(m),String(t));}catch{}}
function swapView(name){for(const id of ['menu','hud','pauseOverlay','resultOverlay','controlsOverlay'])$(id).classList.add('hidden');$(name).classList.remove('hidden');}
function setMode(next){
  mode=next in MODES?next:'launch';
  document.querySelectorAll('.mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  state=freshState(mode);gates=makeGates(mode);world.setGates(gates);world.update(state,0,0,false);
}
function notify(msg){
  $('toast').textContent=msg;$('toast').classList.add('show');noticeEnd=performance.now()+2400;
}
function setStatus(msg){$('statusText').textContent=msg;}
function start(){
  state=freshState(mode);gates=makeGates(mode);
  world.setGates(gates);world.update(state,0,0,false);
  keys.clear();phase='playing';document.body.classList.add('playing');swapView('hud');
  $('missionTitle').textContent='0'+(Object.keys(MODES).indexOf(mode)+1)+' / '+MODES[mode].name;
  $('gateTotal').textContent=String(gates.length).padStart(2,'0');
  $('gateCurrent').textContent='0';
  $('bestTime').textContent=readBest(mode)?formatTime(readBest(mode)):'—';
  $('timer').textContent='00:00.00';
  if(mode==='free'){$('gateTotal').textContent='∞';$('missionTitle').textContent='03 / FREE FLIGHT';}
  setStatus(mode==='trial'?'FLIGHT SYSTEMS ACTIVE':'READY FOR TAKEOFF');
  notify(mode==='trial'?'SKY TRIAL // 12 GATES':'SYSTEMS ARMED // GOOD LUCK');
  last=performance.now();
}
function restart(){if(phase!=='menu')start();}
function hangar(){
  phase='menu';keys.clear();document.body.classList.remove('playing');
  swapView('menu');state=freshState(mode);world.update(state,0,0,false);
  $('speedLines').classList.remove('active');
}
function pause(){
  if(phase!=='playing')return;
  phase='paused';keys.clear();swapView('pauseOverlay');$('speedLines').classList.remove('active');
}
function resume(){
  if(phase!=='paused')return;
  phase='playing';swapView('hud');last=performance.now();
}
function togglePause(){if(phase==='playing')pause();else if(phase==='paused')resume();}
function toggleFlight(){
  if(phase!=='playing')return;
  if(state.flying){
    state.flying=false;state.pitch=0;state.bank=0;state.vy=0;
    if(state.y>3)state.y=2.8;else state.y=1.25;
    notify('ROAD MODE // REENGAGED');
  }else{
    state.flying=true;state.y=Math.max(state.y,3);
    state.pitch=.1;state.vy=7;
    state.speed=Math.max(state.speed,22);
    notify('ROCKET FLIGHT // ENGAGED');
  }
}
function finish(){
  if(phase!=='playing')return;
  phase='finished';keys.clear();$('speedLines').classList.remove('active');
  const prev=readBest(mode),best=!prev||state.elapsed<prev;
  if(best)saveBest(mode,state.elapsed);
  $('resultTime').textContent=formatTime(state.elapsed);
  $('resultMessage').textContent=best?'NEW PERSONAL BEST // FLIGHT VERIFIED':'MISSION COMPLETE // BEAT YOUR RECORD';
  swapView('resultOverlay');
}
function showControls(){
  controlsFrom=phase;
  if(phase==='playing'){phase='paused';keys.clear();}
  $('controlsOverlay').classList.remove('hidden');
  if(controlsFrom==='playing')$('hud').classList.add('hidden');
}
function closeControls(){
  $('controlsOverlay').classList.add('hidden');
  if(controlsFrom==='playing'){phase='playing';swapView('hud');last=performance.now();}
}
function drawHud(){
  const kmh=Math.round(state.speed*3.6);
  $('speed').textContent=String(kmh).padStart(3,'0');
  $('altitude').innerHTML=String(Math.max(0,Math.round(state.y-1.25))).padStart(4,'0')+' <small>M</small>';
  $('vertical').innerHTML=(state.vy>=0?'+':'')+state.vy.toFixed(1)+' <small>M/S</small>';
  $('flightState').textContent=state.flying?'FLIGHT':'DRIVE';
  $('boostBar').style.width=state.boost.toFixed(1)+'%';
  $('boostPercent').textContent=Math.round(state.boost)+'%';
  $('timer').textContent=formatTime(state.elapsed);
  $('gateCurrent').textContent=String(state.gates);
  if(mode==='free'){
    $('targetHint').textContent='UNRESTRICTED TEST AREA';
    $('gateCurrent').textContent=String(Math.round(state.distance/1000)).padStart(2,'0');
  }else{
    const g=gates[state.gates];
    const distance=g?Math.sqrt(Math.pow(state.x-g.x,2)+Math.pow(state.y-g.y,2)+Math.pow(state.z-g.z,2)):0;
    $('targetHint').textContent='TARGET '+String(state.gates+1).padStart(2,'0')+' // '+Math.round(distance)+' M';
  }
}
function makeSound(){
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext)return null;
  const audio=new AudioContext(),gain=audio.createGain(),osc=audio.createOscillator(),lfo=audio.createOscillator(),lfogain=audio.createGain();
  gain.gain.value=.0001;gain.connect(audio.destination);
  osc.type='sawtooth';osc.frequency.value=45;osc.connect(gain);osc.start();
  lfo.type='sine';lfo.frequency.value=11;lfogain.gain.value=4;lfo.connect(lfogain);lfogain.connect(osc.frequency);lfo.start();
  return {audio,gain,osc};
}
function setSound(on){
  sound=on;
  $('soundBtn').textContent=on?'SOUND ON':'SOUND OFF';
  if(on&&!soundSystem){try{soundSystem=makeSound();}catch{sound=false;}}
  if(soundSystem) {soundSystem.audio.resume().catch(()=>{});}
}
function soundTick(boosting){
  if(!soundSystem)return;
  const a=soundSystem.audio,active=sound&&phase==='playing';
  soundSystem.gain.gain.setTargetAtTime(active?clamp(.025+state.speed*.00024+(boosting?.014:0),.025,.08):0.00001,a.currentTime,.16);
  soundSystem.osc.frequency.setTargetAtTime(36+state.speed*.72+(boosting?17:0),a.currentTime,.1);
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('playBtn').addEventListener('click',start);
$('brand').addEventListener('click',e=>{e.preventDefault();hangar();});
$('resetBtn').addEventListener('click',restart);
$('resumeBtn').addEventListener('click',resume);
$('menuBtn').addEventListener('click',hangar);
$('againBtn').addEventListener('click',start);
$('resultMenuBtn').addEventListener('click',hangar);
$('soundBtn').addEventListener('click',()=>setSound(!sound));
$('settingsBtn').addEventListener('click',showControls);
$('closeControlsBtn').addEventListener('click',closeControls);
window.addEventListener('keydown',e=>{
  const prevent=['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  if(prevent.includes(e.code))e.preventDefault();
  if(e.repeat&&['KeyF','KeyC','KeyR','Escape','Enter'].includes(e.code))return;
  if(e.code==='Escape'){togglePause();return;}
  if(e.code==='Enter'&&phase==='menu'){start();return;}
  if(e.code==='Enter'&&phase==='paused'){resume();return;}
  if(e.code==='KeyR'&&phase==='playing'){restart();return;}
  if(e.code==='KeyF'){toggleFlight();return;}
  if(e.code==='KeyC'&&phase==='playing'){notify('CAMERA // '+world.cameraNext());return;}
  if(e.code==='KeyV'&&phase==='playing'){lookBack=true;return;}
  keys.add(e.code);
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyV')lookBack=false;});
window.addEventListener('blur',()=>{if(phase==='playing')pause();});
window.addEventListener('resize',world.resize);
for(const b of document.querySelectorAll('.mobile-controls button')){
  const down=e=>{
    e.preventDefault();b.setPointerCapture?.(e.pointerId);
    if(b.dataset.action==='flight'){toggleFlight();return;}
    const code=b.dataset.action==='boost'?'Boost':b.dataset.key;
    if(code)keys.add(code);
  };
  const up=e=>{e.preventDefault();const code=b.dataset.action==='boost'?'Boost':b.dataset.key;if(code)keys.delete(code);};
  b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
}
function tick(now){
  const dt=Math.min(Math.max(0,(now-last)/1000),.05);last=now;
  if(phase==='playing'){
    const previous={x:state.x,y:state.y,z:state.z};
    state=physicsStep(state,keys,dt);
    if(mode!=='free'&&gates[state.gates]&&crossedGate(previous,state,gates[state.gates])){
      state.gates++;
      setStatus('GATE '+String(state.gates).padStart(2,'0')+' VERIFIED');
      notify('CHECKPOINT '+String(state.gates).padStart(2,'0')+' // CLEARED');
      if(state.gates===gates.length)finish();
    }else if(mode==='free'){setStatus(state.flying?'UNRESTRICTED FLIGHT':'GROUND TEST ACTIVE');}
    const boosting=(keys.has('ShiftLeft')||keys.has('ShiftRight')||keys.has('Boost'))&&state.boost>.2;
    $('speedLines').classList.toggle('active',boosting);
    world.update(state,dt,state.gates,boosting);drawHud();soundTick(boosting);
  }else{
    world.update(state,0,state.gates,false);soundTick(false);
  }
  if(noticeEnd&&now>noticeEnd){$('toast').classList.remove('show');noticeEnd=0;}
  world.render(phase==='menu',lookBack);
  requestAnimationFrame(tick);
}
setMode('launch');requestAnimationFrame(tick);