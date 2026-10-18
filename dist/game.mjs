import {createScene} from './scene.mjs?v=1.1.0';
import {createState,step,resetPosition,GATES,LOOP,clamp,heightAt,toggleAltitudeHold,gateNavigation,medalFor} from './physics.mjs?v=1.1.0';

const $=id=>document.getElementById(id);
let world;
try{world=createScene($('world'));}catch(error){$('loading').classList.add('hidden');$('errorPanel').classList.remove('hidden');$('errorMessage').textContent='This game needs WebGL 2. Enable hardware acceleration in your browser, then reload.';console.error(error);}
if(world)initialize(world);

function initialize(w){
 const {T,renderer,scene,camera,car,gates,gateGroup,shadow,sun}=w;
 let state=createState(),selectedMode='trial',phase='menu',cameraMode=0,rollInput=0,countdown=3,calloutTime=0,elapsed=0,last=performance.now(),accumulator=0,previousModalPhase='menu',hudElapsed=0;
 const keys=new Set(),camTarget=new T.Vector3(),camDesired=new T.Vector3(),lookDesired=new T.Vector3(),temp=new T.Vector3(),velocity=new T.Vector3();
 const modeTitles={trial:'FLIGHT TRIAL',stunt:'STUNT RUN',free:'FREE ROAM'};
 let records={};try{const saved=JSON.parse(localStorage.getItem('roadster-flight-records-v1')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))records=saved;}catch{}
 const settings={quality:'balanced',motion:window.matchMedia('(prefers-reduced-motion: reduce)').matches,guide:true};try{const saved=JSON.parse(localStorage.getItem('roadster-pilot-settings-v1')||'{}');if(saved&&typeof saved==='object'){if(['low','balanced','high'].includes(saved.quality))settings.quality=saved.quality;if(typeof saved.motion==='boolean')settings.motion=saved.motion;if(typeof saved.guide==='boolean')settings.guide=saved.guide;}}catch{}
 const markerVector=new T.Vector3(),markerDirection=new T.Vector3();let splitDelta=null;
 function saveSettings(){try{localStorage.setItem('roadster-pilot-settings-v1',JSON.stringify(settings));}catch{}}
 function applySettings(){w.setQuality(settings.quality);$('qualitySelect').value=settings.quality;$('motionToggle').checked=settings.motion;$('guideToggle').checked=settings.guide;}
 function changeCamera(){cameraMode=(cameraMode+1)%3;positionCamera(1,true);}
 function hold(){if(phase!=='running')return;const was=state.holdAltitude!==null,enabled=toggleAltitudeHold(state);displayCallout(enabled?'ALTITUDE LOCKED':was?'MANUAL FLIGHT':'LIFT OFF FIRST',enabled?`${state.holdAltitude.toFixed(1)} m  /  SPACE OR X TO RELEASE`:was?'YOU HAVE VERTICAL CONTROL':'HOLD SPACE, THEN PRESS H',1.5);tone(enabled?620:300,.1);updateHud();}
 function updateMarker(){
   const visible=settings.guide&&state.mode==='trial'&&!state.completed&&phase!=='menu';
   w.route.visible=visible;
   if(!visible){$('gateMarker').classList.add('hidden');return;}
   const target=gateNavigation(state);markerVector.set(target.x,target.y,target.z);markerDirection.copy(markerVector).sub(camera.position);
   const front=markerDirection.dot(camera.getWorldDirection(temp))>0;
   markerVector.project(camera);const inside=front&&Math.abs(markerVector.x)<.88&&Math.abs(markerVector.y)<.76;
   $('gateMarker').classList.toggle('hidden',!inside);
   if(inside){$('gateMarker').style.left=`${(markerVector.x*.5+.5)*innerWidth}px`;$('gateMarker').style.top=`${(-markerVector.y*.5+.5)*innerHeight}px`;$('markerLabel').textContent=target.recovering?'TURN BACK HERE':`GATE ${String(state.gate+1).padStart(2,'0')}`;$('markerHeight').textContent=`${Math.round(Math.hypot(target.x-state.x,target.z-state.z))} m · ALT ${target.y} m`;}
 }
 const speedTicks=Array.from({length:22},()=>{const i=document.createElement('i');$('speedTicks').appendChild(i);return i;});
 const progressDots=GATES.map(()=>{const i=document.createElement('i');$('missionProgress').appendChild(i);return i;});
 const ctx=$('minimap').getContext('2d');
 let audioContext,engine,engineGain,gasGain,soundEnabled=false;
 function initAudio(){if(audioContext)return;try{audioContext=new(window.AudioContext||window.webkitAudioContext)();engine=audioContext.createOscillator();engine.type='sine';engineGain=audioContext.createGain();engineGain.gain.value=0;engine.connect(engineGain).connect(audioContext.destination);engine.start();const noise=audioContext.createBuffer(1,audioContext.sampleRate*2,audioContext.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;const source=audioContext.createBufferSource();source.buffer=noise;source.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1900;gasGain=audioContext.createGain();gasGain.gain.value=0;source.connect(filter).connect(gasGain).connect(audioContext.destination);source.start();}catch{soundEnabled=false;}}
 function tone(freq=600,length=.12){if(!soundEnabled||!audioContext)return;const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(freq*1.45,audioContext.currentTime+length);g.gain.setValueAtTime(.065,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+length);o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+length);}
 function toggleSound(){soundEnabled=!soundEnabled;initAudio();audioContext?.resume();$('audioButton').setAttribute('aria-label',soundEnabled?'Mute sound':'Enable sound');$('audioWaves').setAttribute('d',soundEnabled?'M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14':'m16 9 5 6m0-6-5 6');}
 function setPhase(p){phase=p;$('app').dataset.state=p;}
 function closeDialogs(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
 function clearKeys(){keys.clear();rollInput=0;document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
 function displayCallout(title,sub='',duration=2){$('callout').querySelector('strong').textContent=title;$('callout').querySelector('span').textContent=sub;calloutTime=duration;$('callout').classList.add('show');}
 function updateGateStyle(){gates.forEach((g,i)=>{g.group.visible=state.mode==='trial'?i>=state.gate&&i<=state.gate+2:state.mode==='free';g.ring.material.color.set(i===state.gate&&state.mode==='trial'?0xe4ff95:0xab97db);g.number.visible=state.mode==='trial';});gateGroup.visible=phase==='menu'||state.mode!=='stunt';w.setRoute(state.gate);}
 function start(){
   closeDialogs();clearKeys();state=createState(selectedMode);setPhase('countdown');countdown=3;accumulator=0;cameraMode=0;splitDelta=null;
   $('menu').classList.add('hidden');$('hud').classList.remove('hidden');$('pauseButton').classList.remove('hidden');$('app').classList.add('playing');$('countdown').classList.remove('hidden');$('countdown').textContent='3';$('callout').classList.remove('show');calloutTime=0;
   $('modeName').textContent=modeTitles[state.mode];$('stuntObjectives').classList.toggle('hidden',state.mode!=='stunt');$('missionProgress').classList.toggle('hidden',state.mode!=='trial');$('targetCompass').classList.toggle('hidden',state.mode!=='trial');
   $('bestLabel').textContent=state.mode==='trial'?'BEST TIME':'BEST SCORE';$('best').textContent=state.mode==='trial'?(records.trial?formatTime(records.trial):'—'):(records.stunt11||'—');
   $('pauseButton').setAttribute('aria-label','Pause game');updateGateStyle();car.scale.setScalar(1);camera.fov=55;camera.updateProjectionMatrix();positionCamera(1,true);updateHud();
   document.activeElement?.blur();if(soundEnabled){initAudio();audioContext?.resume();}tone(350);
 }
 function menu(){closeDialogs();clearKeys();setPhase('menu');$('menu').classList.remove('hidden');$('hud').classList.add('hidden');$('pauseButton').classList.add('hidden');$('countdown').classList.add('hidden');$('app').classList.remove('playing');car.visible=true;car.scale.setScalar(1.5);gates.forEach(g=>g.group.visible=true);gateGroup.visible=true;}
 function pause(){if(phase!=='running'&&phase!=='countdown')return;previousModalPhase=phase;setPhase('paused');clearKeys();$('pauseDialog').showModal();}
 function resume(){if(phase!=='paused')return;$('pauseDialog').close();setPhase(previousModalPhase==='countdown'?'countdown':'running');clearKeys();last=performance.now();}
 function openModal(id){if(phase==='running'||phase==='countdown'){previousModalPhase=phase;setPhase('modal');clearKeys();}else previousModalPhase=phase;$(id).showModal();}
 function finish(){
   setPhase('results');clearKeys();let record=false;const time=state.time;
   if(state.mode==='trial'&&(!records.trial||time<records.trial)){records.trial=time;record=true;}
   if(state.mode==='stunt'&&(!records.stunt11||state.score>records.stunt11)){records.stunt11=state.score;record=true;}
   if(state.mode==='trial'&&record)records.trialSplits=[...state.splits];
   try{localStorage.setItem('roadster-flight-records-v1',JSON.stringify(records));}catch{}
   $('resultEyebrow').textContent=state.mode==='trial'?'ALL 12 GATES CLEARED':'STUNT RUN COMPLETE';$('resultTitle').textContent=state.mode==='trial'?'Gravity, defeated.':'That’s one way to park.';
   $('resultDescription').textContent=state.mode==='trial'?`You flew the full course. ${state.resets?`${state.resets} reset${state.resets===1?'':'s'} included a 3-second penalty each.`:'A clean run with no resets.'}`:`${Object.values(state.objectives).filter(Boolean).length} of 3 signature stunts completed. Try linking launches, rolls, and smooth landings.`;
   const medal=medalFor(state.mode,state.mode==='trial'?time:state.score);$('resultMedal').textContent=`✦ ${medal}`;$('resultMedal').dataset.medal=medal.toLowerCase();
   $('resultDetails').textContent=`TOP SPEED ${Math.round(state.maxSpeed*2.23694)} MPH  ·  MAX HEIGHT ${state.maxAltitude.toFixed(1)} m${state.mode==='stunt'?`  ·  BEST CHAIN ×${Math.max(1,state.maxCombo)}`:''}`;
   $('resultTime').textContent=formatTime(time);$('resultScore').textContent=state.score.toLocaleString();$('recordMessage').textContent=record?'✦ NEW PERSONAL BEST':'Saved on this device. Ready for another flight?';$('resultsDialog').showModal();tone(850,.35);
 }
 function handleEvents(events){for(const e of events){
   if(e.type==='gate'){const bestSplit=records.trialSplits?.[state.gate-1];splitDelta=Number.isFinite(bestSplit)?state.time-bestSplit:null;displayCallout('GATE CLEARED',`+${e.points}  /  AIR TANK RECHARGED`);tone(700+state.gate*40,.16);updateGateStyle();for(let i=0;i<30;i++){temp.set(state.x+(Math.random()-.5)*8,state.y+Math.random()*5,state.z);velocity.set((Math.random()-.5)*8,Math.random()*6,(Math.random()-.5)*8);w.emit(temp,velocity,0xddff8e);}}
   if(e.type==='roll'){displayCallout('BARREL ROLL',`+${e.points}${e.multiplier>1?`  /  ×${e.multiplier} CHAIN`:'  /  ATTITUDE CONTROL'}`);tone(920,.23);}
   if(e.type==='jump'){displayCallout('LINEUP CLEARED',`+${e.points}${e.multiplier>1?`  /  ×${e.multiplier} CHAIN`:'  /  REVEAL MOMENT'}`);tone(1100,.25);}
   if(e.type==='loopStart')displayCallout('SUCTION LOCKED','KEEP THE THROTTLE DOWN');
   if(e.type==='loop'){displayCallout('FULL LOOP',`+${e.points}${e.multiplier>1?`  /  ×${e.multiplier} CHAIN`:'  /  GRIP BEYOND GRAVITY'}`);tone(1000,.24);}
   if(e.type==='landing'||e.type==='hardLanding'){for(let i=0;i<18;i++){temp.set(state.x+(Math.random()-.5)*2,.15,state.z+(Math.random()-.5)*3);velocity.set((Math.random()-.5)*7,Math.random()*2,(Math.random()-.5)*7);w.emit(temp,velocity,0xc9b5a0);}}
   if(e.type==='landing'&&!calloutTime){displayCallout('TOUCHDOWN',`+${e.points}  /  AIRTIME BONUS`,1.6);tone(360,.1);}
   if(e.type==='hardLanding'&&!calloutTime)displayCallout('WHEELS DOWN',`+${e.points}  /  TAP LIFT FOR A SOFTER LANDING`,1.8);
   if(e.type==='crash'){displayCallout('RESET TO CHECKPOINT',state.mode==='trial'?'+3 SECONDS  /  LIFT EARLIER':'LIFT EARLIER TO CLEAR THE CARS');tone(130,.2);positionCamera(1,true);}
   if(e.type==='boundary'){displayCallout('BACK TO THE RANGE','RESET TO CHECKPOINT');positionCamera(1,true);}
   if(e.type==='finish')finish();
 }}
 function formatTime(value){const m=Math.floor(value/60),s=(value%60).toFixed(2).padStart(5,'0');return`${String(m).padStart(2,'0')}:${s}`;}
 function updateHud(){
   $('time').textContent=formatTime(state.mode==='stunt'?Math.max(0,90-state.time):state.time);$('score').textContent=String(state.score).padStart(5,'0');$('speed').textContent=Math.round(Math.abs(state.speed)*2.23694);$('altitude').textContent=state.y.toFixed(1);$('fuelText').textContent=state.mode==='free'?'∞':`${Math.round(state.air)}%`;$('fuelBar').style.width=state.air+'%';$('fuelBar').style.background=state.air<20?'#ff927a':'#c4a7ff';
   $('fuelHint').textContent=state.mode==='free'?'Unlimited cold-gas supply':state.air<15?'Low air · land to recharge':state.grounded?'Ground compressor active':state.holding?'Altitude hold uses 6% air / sec':'Gates also refill the tank';
   $('vehicleState').textContent=state.loopAngle!==null?'SUCTION LOCKED':state.boosting?'MAIN THRUSTERS ACTIVE':state.holding?'ALTITUDE HOLD ACTIVE':state.grounded?'GROUND CONTACT':state.lifting?'LIFT THRUSTERS ACTIVE':'AIRBORNE';
   $('holdButton').setAttribute('aria-pressed',String(state.holding));$('holdState').textContent=state.holding?'ON':'OFF';$('holdHint').textContent=state.holding?`Holding ${state.holdAltitude.toFixed(1)} m · uses air`:state.grounded?'Lift first, then lock your height.':'H to hold · X to descend';
   $('comboPanel').classList.toggle('hidden',state.mode==='trial'||state.combo===0);$('comboValue').textContent=`×${state.combo}`;$('comboBar').style.width=`${state.comboTime/7*100}%`;
   $('runTarget').textContent=state.mode==='trial'?'GOLD ≤ 48s  ·  SILVER ≤ 65s  ·  BRONZE ≤ 90s':state.mode==='stunt'?'GOLD 12,000  ·  SILVER 7,000  ·  BRONZE 3,500':'UNLIMITED AIR · EXPLORE EVERY STUNT';
   $('splitTime').textContent=state.mode==='trial'&&state.gate>0?(splitDelta===null?`SPLIT ${state.gate} · ${formatTime(state.splits[state.gate-1])}`:`${splitDelta>0?'+':'−'}${Math.abs(splitDelta).toFixed(2)}s VS YOUR BEST`):'';$('splitTime').classList.toggle('ahead',splitDelta!==null&&splitDelta<=0);
   $('suctionState').textContent=state.suction?'ON':'OFF';$('cameraName').textContent=['CHASE CAM','HOOD CAM','WIDE CAM'][cameraMode];
   speedTicks.forEach((t,i)=>t.classList.toggle('lit',i<Math.abs(state.speed)/91*22));
   if(state.mode==='trial'){
     $('objective').innerHTML=`Gate ${String(Math.min(state.gate+1,12)).padStart(2,'0')} <span>/ 12</span>`;
     const nav=gateNavigation(state),g=[nav.x,nav.y,nav.z],dist=Math.hypot(g[0]-state.x,g[2]-state.z);$('guidance').textContent=nav.recovering?'Gate missed. Follow the marker back, then turn through the ring.':state.gate===0?'Accelerate toward the first gate.':`Target altitude ${g[1]} m · ${state.y<g[1]-5?'Hold Space to climb.':state.y>g[1]+5?'Release hold / lift to descend.':'Line up with the illuminated ring.'}`;
     $('targetDistance').textContent=`${Math.round(dist)} m`;
     let angle=Math.atan2(-(g[0]-state.x),-(g[2]-state.z))-state.yaw;$('targetArrow').style.transform=`rotate(${-angle}rad)`;
     progressDots.forEach((d,i)=>{d.classList.toggle('done',i<state.gate);d.classList.toggle('current',i===state.gate);});
   }else if(state.mode==='stunt'){$('objective').innerHTML='Make it count.';$('guidance').textContent='Link stunts before the clock runs out.';}else{$('objective').innerHTML='Your sky. Your rules.';$('guidance').textContent='Try the launch ramp ahead or the suction loop to the west.';}
   for(const [key,label] of [['roll','Complete a barrel roll'],['jump','Clear the vehicle lineup'],['loop','Ride the suction loop']]){const el=$(key+'Objective');el.textContent=(state.objectives[key]?'✓ ':'○ ')+label;el.classList.toggle('done',state.objectives[key]);}
   drawMap();
 }
 function drawMap(){
   const cx=160,cz=130,scale=.7;const p=(x,z)=>[cx+x*scale,cz+(z+85)*scale];ctx.clearRect(0,0,320,240);ctx.fillStyle='#b5c6db12';
   const p0=p(0,-310);ctx.fillRect(p0[0]-8,p0[1],16,480*scale);const p1=p(-145,32);ctx.fillRect(p1[0],p1[1]-5,290*scale,10);const p2=p(LOOP.x,-165);ctx.fillRect(p2[0]-5,p2[1],10,255*scale);
   ctx.strokeStyle='#a9bbcf20';ctx.lineWidth=1;for(let x=20;x<320;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,240);ctx.stroke();}for(let y=0;y<240;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(320,y);ctx.stroke();}
   const lp=p(LOOP.x,LOOP.z);ctx.strokeStyle='#c4a7ff88';ctx.beginPath();ctx.arc(lp[0],lp[1],7,0,Math.PI*2);ctx.stroke();
   if(state.mode==='trial'){ctx.strokeStyle='#c4a7ff40';ctx.setLineDash([3,5]);ctx.beginPath();GATES.forEach((g,i)=>{const pos=p(g[0],g[2]);i?ctx.lineTo(...pos):ctx.moveTo(...pos);});ctx.stroke();ctx.setLineDash([]);GATES.forEach((g,i)=>{const pos=p(g[0],g[2]);ctx.fillStyle=i<state.gate?'#7e8c9a':i===state.gate?'#e4ff95':'#b6a2e766';ctx.beginPath();ctx.arc(...pos,i===state.gate?5:2.5,0,Math.PI*2);ctx.fill();});}
   const pos=p(state.x,state.z);ctx.save();ctx.translate(clamp(pos[0],8,312),clamp(pos[1],8,232));ctx.rotate(-state.yaw);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-4.5,5);ctx.lineTo(0,2);ctx.lineTo(4.5,5);ctx.closePath();ctx.fill();ctx.restore();
 }
 function positionCamera(dt,snap=false){
   const y=state.y;
   if(phase==='menu'){
     const mobile=innerWidth<650;car.position.set(0,.45+Math.sin(elapsed*.65)*.10,42);car.rotation.set(-.03,.25+Math.sin(elapsed*.12)*.08,.01);car.scale.setScalar(mobile?1.25:1.5);
     camDesired.set(mobile?10:7,mobile?4.8:3.7,mobile?58:53.5);lookDesired.set(mobile?-3.4:-3.3,mobile?2.5:.55,42);camera.fov=mobile?48:41;
   }else{
     car.scale.setScalar(1);car.position.set(state.x,y,state.z);car.rotation.set(0,state.yaw,0);car.userData.body.rotation.set(state.pitch,0,state.roll+(settings.motion?0:((keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0))*(state.grounded?-.025:.13)));
     const sy=Math.sin(state.yaw),cy=Math.cos(state.yaw);
     if(cameraMode===1&&state.loopAngle===null){camDesired.set(state.x-sy*1.5,y+1.5,state.z-cy*1.5);lookDesired.set(state.x-sy*30,y+1.2,state.z-cy*30);}
     else if(state.loopAngle!==null){camDesired.set(LOOP.x+38,20,LOOP.z+32);lookDesired.set(state.x,state.y+1,state.z);}
     else{const distance=cameraMode===2?21:12;camDesired.set(state.x+sy*distance,y+(cameraMode===2?9:4.9),state.z+cy*distance);lookDesired.set(state.x-sy*6,y+1.4,state.z-cy*6);}
     camera.fov+=((settings.motion?58:clamp(54+Math.abs(state.speed)*.16+(state.boosting?5:0),54,72))-camera.fov)*(1-Math.exp(-dt*2));
   }
   if(snap){camera.position.copy(camDesired);camTarget.copy(lookDesired);}else{const blend=1-Math.exp(-dt*(phase==='menu'?1.7:7));camera.position.lerp(camDesired,blend);camTarget.lerp(lookDesired,blend);}
   camera.lookAt(camTarget);camera.updateProjectionMatrix();
   car.visible=!(phase!=='menu'&&cameraMode===1&&state.loopAngle===null);
   shadow.position.set(car.position.x,.035+heightAt(car.position.x,car.position.z),car.position.z);shadow.scale.setScalar(1+car.position.y*.028);shadow.material.opacity=Math.max(.1,.8-car.position.y*.015);shadow.rotation.z=-car.rotation.y;
   sun.position.set(car.position.x-80,110,car.position.z-75);sun.target.position.set(car.position.x,0,car.position.z);
 }
 function frame(now){
   requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.06);last=now;elapsed+=dt;
   if(phase==='countdown'){const before=Math.ceil(countdown);countdown-=dt;const after=Math.ceil(countdown);if(before!==after&&after>0)tone(350);$('countdown').textContent=countdown>0?String(after):'GO';if(countdown<=-.45){$('countdown').classList.add('hidden');setPhase('running');displayCallout('YOU HAVE CONTROL',state.mode==='trial'?'W TO DRIVE  /  SPACE TO LIFT':'THE RANGE IS YOURS',2);tone(700,.2);}}
   if(phase==='running'){
     accumulator+=dt;
     while(accumulator>=1/120&&phase==='running'){
       const input={throttle:keys.has('KeyW')||keys.has('ArrowUp'),brake:keys.has('KeyS')||keys.has('ArrowDown'),left:keys.has('KeyA')||keys.has('ArrowLeft'),right:keys.has('KeyD')||keys.has('ArrowRight'),lift:keys.has('Space'),descend:keys.has('KeyX'),boost:keys.has('ShiftLeft')||keys.has('ShiftRight'),roll:rollInput};rollInput=0;
       handleEvents(step(state,input,1/120));accumulator-=1/120;
     }
     if(calloutTime>0){calloutTime-=dt;if(calloutTime<=0)$('callout').classList.remove('show');}
   }
   positionCamera(dt);if(phase==='menu')car.userData.body.rotation.set(0,0,0);
   const active=phase==='running';car.userData.wheels.forEach(t=>{if(active)t.rotation.x-=state.speed*dt/.45;});
   if((active&&(state.lifting||state.boosting||state.holding))||phase==='menu'){
     car.updateMatrixWorld();for(let j=0;j<(phase==='menu'?2:5);j++){
       if(state.lifting||state.holding||phase==='menu'){const x=j%2?-.86:.86,z=j%3?1.4:-1.42;temp.set(x,.24,z).applyMatrix4(car.matrixWorld);velocity.set((Math.random()-.5)*1.8,-7-Math.random()*3,(Math.random()-.5)*1.8);w.emit(temp,velocity);}
       if(active&&state.boosting){temp.set((Math.random()-.5)*1.6,.5,2.5).applyMatrix4(car.matrixWorld);velocity.set(Math.sin(state.yaw)*14,Math.random()*.7,Math.cos(state.yaw)*14);w.emit(temp,velocity);}
     }
   }
   w.updateParticles(dt);
   hudElapsed+=dt;if(phase!=='menu'&&hudElapsed>.05){updateHud();hudElapsed=0;}
   updateMarker();$('app').classList.toggle('boosting',active&&state.boosting&&!settings.motion);
   if(state.mode==='trial'&&gates[state.gate])gates[state.gate].outer.scale.setScalar(1+Math.sin(elapsed*3)*.018);
   if(audioContext){const play=soundEnabled&&active;engine.frequency.setTargetAtTime(80+Math.abs(state.speed)*7,audioContext.currentTime,.08);engineGain.gain.setTargetAtTime(play?Math.min(.025,Math.abs(state.speed)*.0004):0,audioContext.currentTime,.08);gasGain.gain.setTargetAtTime(play&&(state.lifting||state.boosting||state.holding)?.065:0,audioContext.currentTime,.08);}
   renderer.render(scene,camera);
 }
 // Keyboard and touch both feed the exact same physics controls.
 const gameKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyQ','KeyE','KeyF','KeyC','KeyR','KeyH','KeyX']);
 window.addEventListener('keydown',e=>{
   if(e.code==='KeyM'&&!e.repeat){toggleSound();return;}
   if(e.code==='Escape'||e.code==='KeyP'){if(phase==='paused'){e.preventDefault();resume();}else if(phase==='running'||phase==='countdown'){e.preventDefault();pause();}return;}
   if(phase!=='running'&&phase!=='countdown')return;
   if(gameKeys.has(e.code))e.preventDefault();keys.add(e.code);
   if(!e.repeat){if(e.code==='KeyQ')rollInput=1;if(e.code==='KeyE')rollInput=-1;if(e.code==='KeyC')changeCamera();if(e.code==='KeyH')hold();if(e.code==='KeyF'){state.suction=!state.suction;displayCallout(state.suction?'SUCTION ENABLED':'SUCTION OFF',state.suction?'WEST LOOP READY':'FREE ROLLING',1.3);}if(e.code==='KeyR'){resetPosition(state,phase==='running');positionCamera(1,true);displayCallout('CHECKPOINT RESET',state.mode==='trial'?'+3 SECONDS':'READY FOR ANOTHER TRY',1.5);}}
 });
 window.addEventListener('keyup',e=>keys.delete(e.code));
 window.addEventListener('blur',()=>{clearKeys();pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearKeys();pause();}});
 for(const button of document.querySelectorAll('[data-key]')){
   const key=button.dataset.key;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(key);button.classList.add('pressed');});
   for(const ev of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,()=>{keys.delete(key);button.classList.remove('pressed');});
 }
 document.querySelector('[data-action="roll"]').addEventListener('pointerdown',e=>{e.preventDefault();rollInput=1;});
 document.querySelector('[data-action="reset"]').addEventListener('pointerdown',e=>{e.preventDefault();if(phase!=='running')return;resetPosition(state);positionCamera(1,true);displayCallout('CHECKPOINT RESET',state.mode==='trial'?'+3 SECONDS':'READY FOR ANOTHER TRY',1.5);});
 $('holdButton').addEventListener('click',()=>{hold();document.activeElement?.blur();});$('cameraButton').addEventListener('click',()=>{changeCamera();document.activeElement?.blur();});
 document.querySelector('[data-action="hold"]').addEventListener('pointerdown',e=>{e.preventDefault();hold();});
 $('settingsButton').addEventListener('click',()=>openModal('settingsDialog'));
 $('qualitySelect').addEventListener('change',()=>{settings.quality=$('qualitySelect').value;w.setQuality(settings.quality);saveSettings();});
 $('motionToggle').addEventListener('change',()=>{settings.motion=$('motionToggle').checked;saveSettings();});
 $('guideToggle').addEventListener('change',()=>{settings.guide=$('guideToggle').checked;saveSettings();});
 $('startButton').addEventListener('click',start);$('againButton').addEventListener('click',start);$('restartButton').addEventListener('click',start);
 $('menuButton').addEventListener('click',menu);$('resultMenuButton').addEventListener('click',menu);$('resumeButton').addEventListener('click',resume);$('pauseButton').addEventListener('click',pause);
 $('brand').addEventListener('click',e=>{e.preventDefault();if(phase==='running'||phase==='countdown')pause();else if(phase==='menu')return;});
 $('controlsButton').addEventListener('click',()=>openModal('controlsDialog'));$('referencesButton').addEventListener('click',()=>openModal('referencesDialog'));$('audioButton').addEventListener('click',toggleSound);
 $('fullButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else displayCallout('FULLSCREEN UNAVAILABLE','USE YOUR BROWSER’S FULLSCREEN OPTION');}catch{displayCallout('FULLSCREEN UNAVAILABLE','USE YOUR BROWSER’S FULLSCREEN OPTION');}});
 document.querySelectorAll('.close-dialog,.close-dialog-button').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
 for(const id of ['controlsDialog','referencesDialog','settingsDialog'])$(id).addEventListener('close',()=>{if(id==='referencesDialog'){$('videoContainer').replaceChildren();$('loadVideo').classList.remove('hidden');}if(phase==='modal'){setPhase(previousModalPhase==='countdown'?'countdown':'running');clearKeys();last=performance.now();}});
 $('pauseDialog').addEventListener('cancel',e=>{e.preventDefault();resume();});$('resultsDialog').addEventListener('cancel',e=>{e.preventDefault();menu();});
 $('loadVideo').addEventListener('click',()=>{const f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/qt5p-_tE8d0?autoplay=1';f.title='Tesla Roadster Event — original reveal';f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';$('videoContainer').appendChild(f);$('loadVideo').classList.add('hidden');});
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{selectedMode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(m=>{m.classList.toggle('active',m===b);m.setAttribute('aria-pressed',String(m===b));});$('startButton').innerHTML=selectedMode==='free'?'EXPLORE THE RANGE <span>↗</span>':selectedMode==='stunt'?'START STUNT RUN <span>↗</span>':'START FLIGHT <span>↗</span>';tone(450,.08);}));
 window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();positionCamera(1,true);});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('errorPanel').classList.remove('hidden');$('errorMessage').textContent='The graphics connection was lost. Reload to restart the test range.';});
 applySettings();menu();positionCamera(1,true);renderer.render(scene,camera);$('loading').classList.add('hidden');$('app').dataset.ready='true';requestAnimationFrame(frame);
}
