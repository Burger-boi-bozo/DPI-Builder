import {createState,step,resetPosition,toggleHold,GATES,PARAMS,clamp} from './physics.mjs';
import {createScene} from './scene.mjs';
import {VehicleAudio} from './audio.mjs';
const $=id=>document.getElementById(id);
const defaults={quality:'balanced',weather:'day',paint:'#b9c1cf',assist:true,unlimited:true,motion:false,guide:true};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}};
const settings={...defaults,...read('roadster-realism-settings-v1',{})};
if(!['performance','balanced','ultra'].includes(settings.quality))settings.quality='balanced';
if(!['day','golden','overcast'].includes(settings.weather))settings.weather='day';
if(!['#b9c1cf','#423354','#8e142b','#151a20'].includes(settings.paint))settings.paint=defaults.paint;
const records=read('roadster-realism-records-v1',{}),keys=new Set(),audio=new VehicleAudio();
let s=createState(),world=null,mode='free',phase='menu',camera=0,last=0,accumulator=0,elapsed=0,uiElapsed=0,toastUntil=0,wasPlaying=false,padStart=false,padHold=false,fpsAverage=60;
let input={},photoReturn='play';
const names={free:'OPEN RANGE',trial:'FLIGHT TRIAL',stunt:'STUNT SESSION'};
const cameras=['CHASE CAMERA','COCKPIT CAMERA','HOOD CAMERA','ORBIT CAMERA'];
function persist(){try{localStorage.setItem('roadster-realism-settings-v1',JSON.stringify(settings));}catch{}}
function storeRecords(){try{localStorage.setItem('roadster-realism-records-v1',JSON.stringify(records));}catch{}}
const formatTime=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${(n%60).toFixed(1).padStart(4,'0')}`;
function toast(title,subtitle='',duration=3){$('toast').querySelector('b').textContent=title;$('toast').querySelector('span').textContent=subtitle;$('toast').classList.add('visible');toastUntil=performance.now()+duration*1000;}
function clearInput(){keys.clear();document.querySelectorAll('[data-key]').forEach(b=>b.classList.remove('pressed'));input={};}
function applySettings(){
  if(world){world.setQuality(settings.quality);world.setWeather(settings.weather);world.setPaint(settings.paint);}
  s.assists=!!settings.assist;s.unlimited=mode==='free'&&!!settings.unlimited;persist();
}
function settle(){for(let i=0;i<90;i++)step(s,{},1/120);s.time=0;s.distance=0;s.maxSpeed=0;s.maxAltitude=0;s.launchTime=null;s.gas=PARAMS.gasCapacity;}
function start(){
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());clearInput();s=createState(mode);s.assists=settings.assist;s.unlimited=mode==='free'&&settings.unlimited;settle();phase='play';accumulator=0;
  $('menu').classList.add('hidden');$('hud').classList.remove('hidden');$('pauseButton').classList.remove('hidden');$('photoOverlay').classList.add('hidden');document.body.classList.add('playing');document.body.classList.remove('photo');world.setPhoto(false);world.setCamera(camera);
  $('sessionName').textContent=names[mode];$('cameraLabel').textContent=cameras[camera];updateHUD();
  toast(mode==='trial'?'Find your line.':mode==='stunt'?'Your 90 seconds start now.':'The range is yours.',mode==='trial'?'Lift for the first gates. Rear thrust changes your flight path.':'WASD drives · Space lifts · H holds altitude',4);
}
function menu(){clearInput();document.querySelectorAll('dialog[open]').forEach(d=>d.close());phase='menu';s=createState(mode);s.assists=settings.assist;s.unlimited=mode==='free'&&settings.unlimited;settle();world.setPhoto(false);world.setCamera(0);$('menu').classList.remove('hidden');$('hud').classList.add('hidden');$('pauseButton').classList.add('hidden');$('photoOverlay').classList.add('hidden');document.body.classList.remove('playing','photo');}
function pause(){if(phase!=='play')return;phase='paused';clearInput();$('pauseDialog').showModal();}
function resume(){if(phase==='paused'){phase='play';accumulator=0;$('pauseDialog').close();clearInput();}}
function openDialog(id){if(phase==='photo')togglePhoto();wasPlaying=phase==='play';if(wasPlaying)phase='dialog';clearInput();$(id).showModal();}
function closeDialog(d){d.close();if(wasPlaying&&phase==='dialog'){phase='play';accumulator=0;}wasPlaying=false;}
function hold(){if(phase!=='play')return;const on=toggleHold(s);toast(on?'Altitude captured.':'Manual vertical control.',on?`${s.hold.toFixed(1)} m · Thrusters will use air to hold position.`:s.altitude<1?'Lift above one metre to engage hold.':'Hold Space to climb; X to descend.',2);updateHUD();}
function fan(){s.fan=!s.fan;toast(`Ground-effect fan ${s.fan?'on':'off'}.`,s.fan?'Additional tire load while on the ground.':'Mechanical grip and aerodynamics only.',2);updateHUD();}
function recover(){if(phase!=='play')return;resetPosition(s);accumulator=0;toast('Vehicle recovered.',mode==='trial'?'+3 seconds · Back to the previous checkpoint.':'Returned to the service pad.',2);}
function changeCamera(){camera=(camera+1)%4;world.setCamera(camera);$('cameraLabel').textContent=cameras[camera];toast(cameras[camera].replace(' CAMERA','').toLowerCase()+' view',camera===3?'Use Photo mode to drag the orbit camera.':'',1.5);}
function togglePhoto(){if(phase==='photo'){phase=photoReturn;world.setPhoto(false);document.body.classList.remove('photo');$('photoOverlay').classList.add('hidden');$('hud').classList.remove('hidden');}else if(phase==='play'){photoReturn=phase;phase='photo';clearInput();world.setPhoto(true);document.body.classList.add('photo');$('photoOverlay').classList.remove('hidden');$('hud').classList.add('hidden');}}
function finish(){phase='results';clearInput();let record=false;if(mode==='trial'){record=!Number.isFinite(records.trial)||s.time<records.trial;if(record){records.trial=s.time;records.splits=[...s.splits];}}else{record=!Number.isFinite(records.stunt)||s.score>records.stunt;if(record)records.stunt=s.score;}storeRecords();
  $('resultTitle').textContent=mode==='trial'?'Line complete.':'Session complete.';$('recordMessage').textContent=record?'A new personal best on this device.':mode==='trial'?`Personal best / ${formatTime(records.trial)}`:`Personal best / ${records.stunt.toLocaleString()} points`;
  const stats=[['TIME',formatTime(s.time)],['SCORE',s.score.toLocaleString()],['TOP SPEED',`${Math.round(s.maxSpeed*2.23694)} mph`],['MAX ALTITUDE',`${s.maxAltitude.toFixed(1)} m`],['AIRTIME',`${s.totalAir.toFixed(1)} s`],['RECOVERIES',String(s.resets)]];
  $('resultStats').replaceChildren(...stats.map(([label,value])=>{const d=document.createElement('div'),l=document.createElement('span'),v=document.createElement('strong');l.textContent=label;v.textContent=value;d.append(l,v);return d;}));$('resultsDialog').showModal();
}
function event(e){switch(e.type){case'gate':{const split=records.splits?.[s.gate-1],delta=split?s.time-split:null;toast(`Gate ${String(s.gate).padStart(2,'0')} cleared.`,delta===null?'Checkpoint air replenished.':`${delta<=0?'−':'+'}${Math.abs(delta).toFixed(2)}s against your best split.`,1.8);break;}case'roll':toast('Full rotation.',`+${e.points.toLocaleString()} points · Chain ×${s.combo}`,2);break;case'landing':if(e.impact>7)toast('Heavy landing.',`${e.impact.toFixed(1)} m/s vertical impact. Cushion with lift.`,2);else toast('Back on the tarmac.',`${e.impact.toFixed(1)} m/s vertical impact`,1.5);break;case'impact':toast('Contact.', 'Brake earlier. Press R to recover if needed.',2);break;case'boundary':toast('Range boundary.', 'Recovered to the service area.',2);break;case'sixty':toast('60 mph.',`${e.time.toFixed(2)} s in this simulation`,2);break;case'stop':if(e.distance>4)toast('Full stop.',`${e.distance.toFixed(1)} m braking distance`,2);break;case'finish':finish();break;}}
function readInput(){
  let throttle=keys.has('KeyW')||keys.has('ArrowUp')?1:0,brake=0;
  if(keys.has('KeyS')||keys.has('ArrowDown')){if(s.forwardSpeed>.65)brake=1;else throttle=-.5;}
  if(throttle>0&&s.forwardSpeed<-.5){brake=1;throttle=0;}
  let steer=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0);
  let values={throttle,brake,steer,lift:keys.has('Space'),descend:keys.has('KeyX'),boost:keys.has('ShiftLeft')||keys.has('ShiftRight'),roll:(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0),pitch:(keys.has('KeyI')?1:0)-(keys.has('KeyK')?1:0),handbrake:keys.has('KeyB')};
  const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard');
  if(pad){const dead=v=>Math.abs(v)<.1?0:Math.sign(v)*(Math.abs(v)-.1)/.9;values.steer=clamp(values.steer-dead(pad.axes[0]),-1,1);values.throttle=Math.max(values.throttle,pad.buttons[7]?.value||0);values.brake=Math.max(values.brake,pad.buttons[6]?.value||0);values.lift||=pad.buttons[0]?.pressed;values.descend||=pad.buttons[1]?.pressed;values.boost||=pad.buttons[2]?.pressed;values.roll+=(pad.buttons[5]?.pressed?1:0)-(pad.buttons[4]?.pressed?1:0);values.pitch+=dead(pad.axes[3]||0);const h=!!pad.buttons[12]?.pressed,st=!!pad.buttons[9]?.pressed;if(h&&!padHold)hold();if(st&&!padStart){if(phase==='play')pause();else if(phase==='paused')resume();}padHold=h;padStart=st;}
  return values;
}
const controls=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyX','ShiftLeft','ShiftRight','KeyQ','KeyE','KeyI','KeyK','KeyB','KeyH','KeyF','KeyC','KeyR','KeyP','KeyO','Escape','KeyM']);
addEventListener('keydown',e=>{
  if(!controls.has(e.code))return;const opened=document.querySelector('dialog[open]');if(opened){if(opened.id==='pauseDialog'&&e.code==='KeyP'){e.preventDefault();resume();}return;}if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(phase!=='menu'||e.code==='KeyM')e.preventDefault();if(e.repeat)return;
  if(e.code==='Escape'||e.code==='KeyP'){if(phase==='photo')togglePhoto();else if(phase==='play')pause();else if(phase==='paused')resume();return;}
  if(e.code==='KeyM'){$('soundButton').click();return;}if(phase!=='play'&&!(e.code==='KeyO'&&phase==='photo'))return;
  const actions={KeyH:hold,KeyF:fan,KeyC:changeCamera,KeyR:recover,KeyO:togglePhoto};if(actions[e.code])actions[e.code]();else keys.add(e.code);
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{clearInput();if(phase==='play')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(phase==='play')pause();}});
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();if(phase!=='play')return;keys.add(b.dataset.key);b.classList.add('pressed');b.setPointerCapture(e.pointerId);});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>{keys.delete(b.dataset.key);b.classList.remove('pressed');});b.addEventListener('contextmenu',e=>e.preventDefault());}
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>{mode=b.dataset.mode;s.mode=mode;document.querySelectorAll('[data-mode]').forEach(el=>{el.classList.toggle('active',el===b);el.setAttribute('aria-pressed',String(el===b));});});
$('startButton').addEventListener('click',()=>{if(world)start();});$('home').addEventListener('click',e=>{e.preventDefault();if(world)menu();});$('controlsButton').addEventListener('click',()=>openDialog('controlsDialog'));$('settingsButton').addEventListener('click',()=>openDialog('settingsDialog'));$('aboutButton').addEventListener('click',()=>openDialog('aboutDialog'));
$('pauseButton').addEventListener('click',pause);$('resumeButton').addEventListener('click',resume);$('restartButton').addEventListener('click',start);$('menuButton').addEventListener('click',menu);$('againButton').addEventListener('click',start);$('resultMenuButton').addEventListener('click',menu);$('holdButton').addEventListener('click',hold);$('fanButton').addEventListener('click',fan);$('cameraButton').addEventListener('click',changeCamera);$('resetButton').addEventListener('click',recover);$('photoButton').addEventListener('click',togglePhoto);$('leavePhoto').addEventListener('click',togglePhoto);
$('fullButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}});
$('soundButton').addEventListener('click',async()=>{try{const enabled=await audio.toggle();$('soundButton').querySelector('b').textContent=enabled?'ON':'OFF';$('soundButton').setAttribute('aria-label',enabled?'Mute sound':'Enable sound');}catch{toast('Sound is unavailable.');}});
for(const d of document.querySelectorAll('dialog')){for(const b of d.querySelectorAll('.close,.close-action'))b.addEventListener('click',()=>closeDialog(d));d.addEventListener('cancel',e=>{e.preventDefault();if(d.id==='pauseDialog')resume();else if(d.id!=='resultsDialog')closeDialog(d);});}
for(const key of Object.keys(defaults)){const el=$(key);if(el.type==='checkbox')el.checked=!!settings[key];else el.value=settings[key];el.addEventListener('change',()=>{settings[key]=el.type==='checkbox'?el.checked:el.value;applySettings();});}
function drawMap(){
  const c=$('map').getContext('2d'),w=440,h=330;c.clearRect(0,0,w,h);const scale=.43,ox=w/2,oy=h/2+13,X=x=>ox+x*scale,Z=z=>oy+(z+190)*scale;
  c.strokeStyle='#c6d5e529';c.lineWidth=12;c.beginPath();c.arc(X(0),Z(-190),191*scale,0,Math.PI*2);c.stroke();c.lineWidth=15;c.beginPath();c.moveTo(X(0),Z(100));c.lineTo(X(0),Z(-620));c.stroke();c.lineWidth=25;c.beginPath();c.moveTo(X(-150),Z(25));c.lineTo(X(65),Z(25));c.stroke();
  c.strokeStyle='#d2ddea38';c.lineWidth=1;c.setLineDash([5,8]);c.beginPath();c.moveTo(X(0),Z(100));c.lineTo(X(0),Z(-620));c.stroke();c.setLineDash([]);
  c.fillStyle='#b1bace25';for(const [x,z] of [[-110,30],[-110,-25],[115,65]])c.fillRect(X(x)-9,Z(z)-7,18,14);
  if(mode==='trial'){c.strokeStyle='#bca1e65c';c.lineWidth=1;c.beginPath();GATES.forEach((g,i)=>{i?c.lineTo(X(g[0]),Z(g[2])):c.moveTo(X(g[0]),Z(g[2]));});c.stroke();GATES.forEach((g,i)=>{c.beginPath();c.arc(X(g[0]),Z(g[2]),i===s.gate?5:2.5,0,Math.PI*2);c.fillStyle=i<s.gate?'#8295a6':i===s.gate?'#d3b3ff':'#7e6a99';c.fill();});}
  const px=clamp(X(s.p.x),12,w-12),pz=clamp(Z(s.p.z),12,h-12);c.save();c.translate(px,pz);c.rotate(-s.yaw);c.beginPath();c.moveTo(0,-7);c.lineTo(-4,5);c.lineTo(0,3);c.lineTo(4,5);c.closePath();c.fillStyle='#ece7f9';c.fill();c.restore();c.fillStyle='#d3daea6e';c.font='12px sans-serif';c.fillText('N ↑',w-39,25);
}
function drawG(){const c=$('gMeter').getContext('2d');c.clearRect(0,0,160,160);c.strokeStyle='#becce52b';c.lineWidth=1;for(const r of [30,58]){c.beginPath();c.arc(80,80,r,0,Math.PI*2);c.stroke();}c.beginPath();c.moveTo(14,80);c.lineTo(146,80);c.moveTo(80,14);c.lineTo(80,146);c.stroke();c.fillStyle='#c7abea';c.beginPath();c.arc(80+clamp(s.gForce.x,-2,2)*27,80+clamp(s.gForce.z,-2,2)*27,4,0,Math.PI*2);c.fill();c.font='12px sans-serif';c.textAlign='center';c.fillStyle='#c4cede';c.fillText(`${Math.hypot(s.gForce.x,s.gForce.z).toFixed(2)} G`,80,158);}
function updateHUD(){
  $('speed').textContent=Math.round(s.speed*2.23694);$('gear').textContent=s.forwardSpeed<-.4?'R':s.speed<.3?'N':'D';$('speedLine').style.width=`${Math.min(100,s.speed/110*100)}%`;
  $('altitude').textContent=s.altitude.toFixed(1);$('vertical').textContent=(s.v.y>=0?'+':'')+s.v.y.toFixed(1);$('clock').textContent=formatTime(mode==='stunt'?Math.max(0,90-s.time):s.time);$('score').textContent=mode==='stunt'?`${s.score.toLocaleString()} PTS${s.combo>1?' / ×'+s.combo:''}`:mode==='trial'?`${s.gate} / ${GATES.length} GATES`:'';
  $('objective').textContent=mode==='trial'?`Gate ${String(Math.min(s.gate+1,GATES.length)).padStart(2,'0')} / ${GATES.length}`:mode==='stunt'?'Keep the sequence alive.':'The range is yours.';
  const target=GATES[Math.min(s.gate,GATES.length-1)];
  if(mode==='trial'){$('guidance').textContent=`${Math.round(Math.hypot(target[0]-s.p.x,target[2]-s.p.z))} m to checkpoint · Target height ${target[1]} m`;}
  else if(mode==='stunt')$('guidance').textContent='Rolls + airtime + soft landings. Link rotations for a multiplier.';
  else $('guidance').textContent=s.unlimited?'Training air enabled · Drive, fly, explore.':'Finite gas · Stop on the purple service pad to refill.';
  $('surfaceTag').textContent=s.grounded?s.surface:'AIRBORNE';$('assistTag').textContent=s.assists?'STABILITY ASSIST':'MANUAL FLIGHT';$('padTag').classList.toggle('hidden',!(s.grounded&&s.speed<.8&&Math.abs(s.p.x)<13&&Math.abs(s.p.z-42)<14&&!s.unlimited));
  const air=s.gas/PARAMS.gasCapacity*100;$('airLabel').textContent=s.unlimited?'∞':`${Math.round(air)}%`;$('airBar').style.width=`${air}%`;$('airBar').style.background=air<20?'#e1a190':'#c1a4ef';$('airHint').textContent=s.unlimited?'TRAINING SUPPLY / UNLIMITED':`${s.gas.toFixed(0)} KG REMAINING${s.gasRate>0?' / '+s.gasRate.toFixed(1)+' KG/S':''}`;
  $('holdLabel').textContent=s.hold===null?'OFF':`${(s.hold-.615).toFixed(0)} M`;$('holdButton').setAttribute('aria-pressed',String(s.hold!==null));$('fanLabel').textContent=s.fan?'ON':'OFF';$('fanButton').setAttribute('aria-pressed',String(s.fan));
  $('surfaceState').textContent=s.grounded?`${s.contacts===4?'FOUR':s.contacts} WHEELS DOWN`:'NO GROUND CONTACT';$('sixty').textContent=`0–60 / ${s.zeroSixty===null?'—':s.zeroSixty.toFixed(2)+'s'}`;
  $('thrustBar').style.width=`${Math.max(Math.abs(input.throttle||0),s.boosting)*100}%`;$('brakeBar').style.width=`${(input.brake||input.handbrake||0)*100}%`;
  for(let i=0;i<4;i++){const percent=clamp(s.wheels[i].load/13000*100,0,100);$(`load${i}`).style.background=`linear-gradient(0deg,${s.wheels[i].slip>.22?'#e2aa8c':'#b49bdb'} ${percent}%,#ffffff16 ${percent}%)`;}
  $('gripText').textContent=s.slip>.22?'TIRE SLIP':'GRIP AVAILABLE';$('fps').textContent=`${Math.round(fpsAverage)} FPS`;
  const marker=$('target');if(mode==='trial'&&settings.guide&&phase==='play'){const p=world.project(target);marker.classList.toggle('hidden',!p.visible);marker.style.left=`${p.x}px`;marker.style.top=`${p.y}px`;marker.querySelector('b').textContent=`GATE ${String(s.gate+1).padStart(2,'0')}`;marker.querySelector('small').textContent=`${Math.round(Math.hypot(target[0]-s.p.x,target[2]-s.p.z))} M`;}else marker.classList.add('hidden');
  drawMap();drawG();
}
function frame(now){
  requestAnimationFrame(frame);const raw=(now-(last||now))/1000,dt=Math.min(.1,raw);last=now;elapsed+=dt;fpsAverage+=(1/Math.max(.005,raw)-fpsAverage)*.025;input=readInput();
  if(phase==='play'){accumulator+=dt;let steps=0;while(accumulator>=1/120&&steps++<12){const events=step(s,input,1/120);accumulator-=1/120;events.forEach(event);if(phase!=='play')break;}}else accumulator=0;
  audio.update(s,input,phase==='play');world.update(s,input,phase==='play'?dt:phase==='menu'?dt:0,phase==='menu'?'menu':'play',elapsed);
  uiElapsed+=dt;if(uiElapsed>.05&&phase!=='menu'){updateHUD();uiElapsed=0;}if(now>toastUntil)$('toast').classList.remove('visible');
}
async function boot(){try{$('startButton').disabled=true;world=await createScene($('world'),settings);applySettings();settle();$('loading').classList.add('hidden');$('startButton').disabled=false;requestAnimationFrame(frame);}catch(e){console.error(e);$('loading').classList.add('hidden');$('errorPanel').classList.remove('hidden');$('errorMessage').textContent='Please enable hardware acceleration and WebGL, then reload. '+(e.message||'');}}
boot();
