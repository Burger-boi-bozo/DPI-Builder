import {createScene} from './scene.mjs';
import {createState,step,resetPosition,GATES,LOOP,clamp,heightAt,missionGateCount} from './physics.mjs';
import {makeResearchState,stepResearch,RESEARCH_STAGES,setPrecision,makeDynamicsState} from './research.mjs';
import {createSuspension,suspensionStep,SUSPENSION,CHASSIS_SETUPS,setChassisSetup,setChassisAdjustment,tuningParameters} from './suspension.mjs?v=3.0.0';
import {makeVehicleDynamics} from './vehicle.mjs';
import {createOrbitState,orbitDrag,orbitPan,orbitZoom,orbitPose,resetOrbit} from './orbit.mjs?v=3.0.0';

const $=id=>document.getElementById(id);
let world;
try{world=createScene($('world'));}catch(error){$('loading').classList.add('hidden');$('errorPanel').classList.remove('hidden');$('errorMessage').textContent='This game needs WebGL 2. Enable hardware acceleration in your browser, then reload.';console.error(error);}
if(world)initialize(world);

function initialize(w){
 const {T,renderer,scene,camera,car,gates,gateGroup,shadow,sun}=w;
 let state=makeResearchState(),selectedMode='research',phase='menu',cameraMode=0,rollInput=0,countdown=3,calloutTime=0,elapsed=0,last=performance.now(),accumulator=0,previousModalPhase='menu';
 const keys=new Set(),camTarget=new T.Vector3(),camDesired=new T.Vector3(),lookDesired=new T.Vector3(),temp=new T.Vector3(),velocity=new T.Vector3();
 const orbit=createOrbitState();let orbitPointer=null;
 function selectCamera(mode){cameraMode=mode;$('app').dataset.camera=mode===3?'orbit':'standard'; if(mode===3){resetOrbit(orbit,state.yaw||0);if(innerWidth<=760){$('app').dataset.telemetry='closed';$('telemetryToggle').setAttribute('aria-expanded','false');$('telemetryToggle').textContent='SHOW SYSTEMS';}}$('orbitButton').setAttribute('aria-pressed',String(mode===3));$('orbitButton').textContent=mode===3?'EXIT ORBIT':'ORBIT CAM';if(phase!=='menu'){positionCamera(.016,true);updateHud();}}

 const modeTitles={dynamics:'CHASSIS DYNAMICS / DAMPER LAB',research:'X-FLIGHT CERTIFICATION',trial:'FLIGHT TRIAL',stunt:'STUNT RUN',launch:'LAUNCH SPRINT',free:'FREE ROAM'};
 const ghostKey=m=>'roadster-flight-ghost-v2-'+m;
 const isResearchMode=m=>m==='research'||m==='dynamics';
 let suspension=createSuspension(),selectedSetup='balanced',benchmark=null,benchmarkHold=false,recording=[],recordTimer=0,ghostTrack=[],ghostEnabled=true,environmentIndex=0;
 let flightLog=[],trace=[],logTimer=0,lastFlightLog=[],replayElapsed=0,replayPlaying=false,replayIndex=0;
 let records={};try{records=JSON.parse(localStorage.getItem('roadster-flight-records-v1')||'{}');}catch{}
 // Engineering drawer: ground dynamics belongs above flight-only instruments.
 $('researchPanel').insertBefore($('dynamicsModule'),$('researchPanel').querySelector('.research-header'));
 $('dynamicsModule').insertBefore($('tuningWorkbench'),$('dynamicsModule').querySelector('.diag-head'));
 const speedTicks=Array.from({length:22},()=>{const i=document.createElement('i');$('speedTicks').appendChild(i);return i;});
 const progressDots=GATES.map(()=>{const i=document.createElement('i');$('missionProgress').appendChild(i);return i;});
 const ctx=$('minimap').getContext('2d');
 let audioContext,engine,engineGain,gasGain,soundEnabled=false;
 function initAudio(){if(audioContext)return;try{audioContext=new(window.AudioContext||window.webkitAudioContext)();engine=audioContext.createOscillator();engine.type='sine';engineGain=audioContext.createGain();engineGain.gain.value=0;engine.connect(engineGain).connect(audioContext.destination);engine.start();const noise=audioContext.createBuffer(1,audioContext.sampleRate*2,audioContext.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;const source=audioContext.createBufferSource();source.buffer=noise;source.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1900;gasGain=audioContext.createGain();gasGain.gain.value=0;source.connect(filter).connect(gasGain).connect(audioContext.destination);source.start();}catch{soundEnabled=false;}}
 function tone(freq=600,length=.12){if(!soundEnabled||!audioContext)return;const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(freq*1.45,audioContext.currentTime+length);g.gain.setValueAtTime(.065,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+length);o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+length);}
 function cycleEnvironment(){environmentIndex=(environmentIndex+1)%3;const label=w.setEnvironment(environmentIndex);$('environmentButton').textContent=label;displayCallout(label,'LIGHTING PROFILE UPDATED',1.2);try{localStorage.setItem('roadster-v2-lighting',String(environmentIndex));}catch{}}
 function savePhoto(){
   try{const canvas=renderer.domElement;canvas.toBlob(blob=>{if(!blob){displayCallout('PHOTO UNAVAILABLE','TRY AGAIN');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='roadster-flight-'+Date.now()+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');displayCallout('PHOTO CAPTURED','SAVED TO YOUR DOWNLOADS',1.5);}catch{displayCallout('PHOTO UNAVAILABLE','BROWSER BLOCKED SCREENSHOT',1.5);}
 }
 function toggleSound(){soundEnabled=!soundEnabled;initAudio();audioContext?.resume();$('audioButton').setAttribute('aria-label',soundEnabled?'Mute sound':'Enable sound');$('audioWaves').setAttribute('d',soundEnabled?'M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14':'m16 9 5 6m0-6-5 6');}
 function setPhase(p){phase=p;$('app').dataset.state=p;}
 function closeDialogs(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
 function clearKeys(){keys.clear();rollInput=0;document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
 function displayCallout(title,sub='',duration=2){$('callout').querySelector('strong').textContent=title;$('callout').querySelector('span').textContent=sub;calloutTime=duration;$('callout').classList.add('show');}
 function updateGateStyle(){const racing=state.mode==='trial'||state.mode==='launch';gates.forEach((g,i)=>{g.group.visible=racing?i<missionGateCount(state.mode)&&i>=state.gate&&i<=state.gate+2:state.mode==='free';g.ring.material.color.set(i===state.gate&&racing?0xe4ff95:0xab97db);g.number.visible=racing&&i<missionGateCount(state.mode);});gateGroup.visible=phase==='menu'||(state.mode!=='stunt'&&!isResearchMode(state.mode));}
 function start(){
   closeDialogs();clearKeys();benchmarkHold=false;state=selectedMode==='research'?makeResearchState():selectedMode==='dynamics'?makeDynamicsState():createState(selectedMode);suspension=createSuspension();setChassisSetup(suspension,selectedSetup);if(selectedMode==='dynamics')state.drivetrain=makeVehicleDynamics();recording=[];recordTimer=0;ghostTrack=[];flightLog=[];trace=[];logTimer=0;replayElapsed=0;replayPlaying=false;
   $('replayPanel').classList.add('hidden');$('researchPanel').classList.toggle('hidden',!isResearchMode(state.mode));$('app').dataset.mode=state.mode;w.setResearchPhase(isResearchMode(state.mode),state.stage||0);
   try{ghostTrack=JSON.parse(localStorage.getItem(ghostKey(state.mode))||'[]');if(!Array.isArray(ghostTrack))ghostTrack=[];}catch{ghostTrack=[];}
   w.setGhostPose(null);w.resetSkids();setPhase('countdown');countdown=3;accumulator=0;cameraMode=0;$('app').dataset.camera='standard';resetOrbit(orbit,state.yaw||0);$('orbitButton').setAttribute('aria-pressed','false');$('orbitButton').textContent='ORBIT CAM';
   $('menu').classList.add('hidden');$('hud').classList.remove('hidden');$('pauseButton').classList.remove('hidden');$('app').classList.add('playing');$('countdown').classList.remove('hidden');$('countdown').textContent='3';$('callout').classList.remove('show');calloutTime=0;
   updateTuningUI();$('modeName').textContent=modeTitles[state.mode];$('stuntObjectives').classList.toggle('hidden',state.mode!=='stunt');$('missionProgress').classList.toggle('hidden',!['trial','launch'].includes(state.mode));$('targetCompass').classList.toggle('hidden',!['trial','launch'].includes(state.mode));
   $('bestLabel').textContent=state.mode==='dynamics'?'CHASSIS / LIVE':['trial','launch'].includes(state.mode)?'BEST TIME':'BEST SCORE';$('best').textContent=['trial','launch'].includes(state.mode)?(records[state.mode]?formatTime(records[state.mode]):'—'):(records[state.mode]||'—');
   $('ghostStatus').textContent=state.mode==='dynamics'?'SUSPENSION TEST STRIP: 200 METERS':ghostTrack.length?'BEST-RUN GHOST: ACTIVE':'BEST-RUN GHOST: SET A RECORD';
   $('pauseButton').setAttribute('aria-label','Pause game');updateGateStyle();car.scale.setScalar(1);camera.fov=55;camera.updateProjectionMatrix();positionCamera(1,true);updateHud();
   document.activeElement?.blur();if(soundEnabled){initAudio();audioContext?.resume();}tone(350);
 }
 function menu(){closeDialogs();clearKeys();w.setGhostPose(null);w.setResearchPhase(false);$('researchPanel').classList.add('hidden');$('replayPanel').classList.add('hidden');$('app').dataset.mode='menu';setPhase('menu');$('menu').classList.remove('hidden');$('hud').classList.add('hidden');$('pauseButton').classList.add('hidden');$('countdown').classList.add('hidden');$('app').classList.remove('playing');car.visible=true;car.scale.setScalar(1.5);gates.forEach(g=>g.group.visible=true);gateGroup.visible=true;}
 function pause(){if(phase!=='running'&&phase!=='countdown')return;previousModalPhase=phase;setPhase('paused');clearKeys();$('pauseDialog').showModal();}
 function resume(){if(phase!=='paused')return;$('pauseDialog').close();setPhase(previousModalPhase==='countdown'?'countdown':'running');clearKeys();last=performance.now();}
 function openModal(id){if(phase==='running'||phase==='countdown'){previousModalPhase=phase;setPhase('modal');clearKeys();}else previousModalPhase=phase;$(id).showModal();}
 function finish(){
   setPhase('results');clearKeys();let record=false;const time=state.time;
   if(['trial','launch'].includes(state.mode)&&(!records[state.mode]||time<records[state.mode])){records[state.mode]=time;record=true;try{localStorage.setItem(ghostKey(state.mode),JSON.stringify(recording));}catch{}}
   if(state.mode==='stunt'&&(!records.stunt||state.score>records.stunt)){records.stunt=state.score;record=true;}
   if(state.mode==='research'&&!state.failed&&(!records.research||state.score>records.research)){records.research=state.score;record=true;}
   try{localStorage.setItem('roadster-flight-records-v1',JSON.stringify(records));}catch{}
   $('resultEyebrow').textContent=isResearchMode(state.mode)?(state.failed?'EXPERIMENT TERMINATED':state.mode==='dynamics'?'CHASSIS TEST COMPLETED':'FLIGHT CERTIFICATION COMPLETE'):state.mode==='trial'?'ALL 12 GATES CLEARED':state.mode==='launch'?'LAUNCH SPRINT CLEARED':'STUNT RUN COMPLETE';$('resultTitle').textContent=isResearchMode(state.mode)?(state.failed?'Telemetry preserved.':state.mode==='dynamics'?'Suspension test completed.':'Test pilot certified.'):['trial','launch'].includes(state.mode)?'Gravity, defeated.':'That’s one way to park.';
   $('resultDescription').textContent=isResearchMode(state.mode)?`${state.failed?'Test terminated after exceeding safety limits.':'Five flight-certification protocols complete.'} Peak altitude ${state.peakAltitude.toFixed(1)} m. Remaining propellant ${state.propellant.toFixed(1)} kg. Peak nozzle temperature ${state.temperature.toFixed(0)}°C. Structural integrity ${state.structural.toFixed(0)}%.`:['trial','launch'].includes(state.mode)?`You flew the full course. ${state.resets?`${state.resets} reset${state.resets===1?'':'s'} included a 3-second penalty each.`:'A clean run with no resets.'}`:`${Object.values(state.objectives).filter(Boolean).length} of 3 signature stunts completed. Try linking launches, rolls, and smooth landings.`;
   $('resultTime').textContent=formatTime(time);$('resultScore').textContent=state.score.toLocaleString();$('recordMessage').textContent=record?'✦ NEW PERSONAL BEST':'Saved on this device. Ready for another flight?';$('dataButton').classList.toggle('hidden',!isResearchMode(state.mode));$('replayButton').classList.toggle('hidden',!isResearchMode(state.mode));if(isResearchMode(state.mode)){lastFlightLog=[...flightLog];try{localStorage.setItem('roadster-research-last-flight',JSON.stringify(lastFlightLog.slice(-4000)));}catch{}}$('resultsDialog').showModal();tone(850,.35);
 }
 function handleEvents(events){for(const e of events){
   if(e.type==='gate'){displayCallout('GATE CLEARED',`+${e.points}  /  AIR TANK RECHARGED`);tone(700+state.gate*40,.16);updateGateStyle();for(let i=0;i<30;i++){temp.set(state.x+(Math.random()-.5)*8,state.y+Math.random()*5,state.z);velocity.set((Math.random()-.5)*8,Math.random()*6,(Math.random()-.5)*8);w.emit(temp,velocity,0xddff8e);}}
   if(e.type==='roll'){displayCallout('BARREL ROLL',`+${e.points}  /  ATTITUDE CONTROL`);tone(920,.23);}
   if(e.type==='jump'){displayCallout('LINEUP CLEARED',`+${e.points}  /  REVEAL MOMENT`);tone(1100,.25);}
   if(e.type==='loopStart')displayCallout('SUCTION LOCKED','KEEP THE THROTTLE DOWN');
   if(e.type==='loop'){displayCallout('FULL LOOP',`+${e.points}  /  GRIP BEYOND GRAVITY`);tone(1000,.24);}
   if(e.type==='landing'&&!calloutTime){displayCallout('TOUCHDOWN',`+${e.points}  /  AIRTIME BONUS`,1.6);tone(360,.1);}
   if(e.type==='hardLanding'&&!calloutTime)displayCallout('WHEELS DOWN',`+${e.points}  /  TAP LIFT FOR A SOFTER LANDING`,1.8);
   if(e.type==='crash'){displayCallout('RESET TO CHECKPOINT',['trial','launch'].includes(state.mode)?'+3 SECONDS  /  LIFT EARLIER':'LIFT EARLIER TO CLEAR THE CARS');tone(130,.2);positionCamera(1,true);}
   if(e.type==='boundary'){displayCallout('BACK TO THE RANGE','RESET TO CHECKPOINT');positionCamera(1,true);}
   if(e.type==='researchStage'){const next=RESEARCH_STAGES[Math.min(state.stage,RESEARCH_STAGES.length-1)];displayCallout('PROTOCOL VERIFIED',next?next.name:'ALL SYSTEMS CERTIFIED',2.1);w.setResearchPhase(true,state.stage);tone(760,.18);}
   if(e.type==='researchHardLanding'){displayCallout('HARD LANDING',`${e.damage}% AIRFRAME DAMAGE  /  CHECK DESCENT RATE`,2);tone(190,.22);}
   if(e.type==='researchLanding')displayCallout('CONTACT VERIFIED','EVALUATING TOUCHDOWN RATE',1.3);
   if(e.type==='researchAbort'){displayCallout('FLIGHT TERMINATED',e.reason,2);finish();}
   if(e.type==='researchFinish')finish();
   if(e.type==='finish')finish();
 }}
 function formatTime(value){const m=Math.floor(value/60),s=(value%60).toFixed(2).padStart(5,'0');return`${String(m).padStart(2,'0')}:${s}`;}
 function updateHud(){
   $('time').textContent=formatTime(state.mode==='stunt'?Math.max(0,90-state.time):state.time);$('score').textContent=String(state.score).padStart(5,'0');$('speed').textContent=Math.round(Math.abs(state.speed)*2.23694);$('altitude').textContent=state.y.toFixed(1);$('fuelText').textContent=state.mode==='free'?'∞':`${Math.round(state.air)}%`;$('fuelBar').style.width=state.air+'%';$('fuelBar').style.background=state.air<20?'#ff927a':'#c4a7ff';
   $('fuelHint').textContent=state.mode==='free'?'Unlimited cold-gas supply':state.air<15?'Low air · land to recharge':state.grounded?'Ground compressor active':'Gates also refill the tank';
   $('vehicleState').textContent=isResearchMode(state.mode)?(state.grounded?'WEIGHT ON WHEELS':state.precision?'HOVER CONTROLLER ACTIVE':state.lifting?'THRUST VECTOR ENGAGED':'BALLISTIC FLIGHT'):state.loopAngle!==null?'SUCTION LOCKED':state.boosting?'MAIN THRUSTERS ACTIVE':state.grounded?'GROUND CONTACT':state.lifting?'LIFT THRUSTERS ACTIVE':'AIRBORNE';
   $('suctionState').textContent=state.suction?'ON':'OFF';$('cameraName').textContent=['CHASE CAM','HOOD CAM','WIDE CAM','FREE ORBIT'][cameraMode];
   speedTicks.forEach((t,i)=>t.classList.toggle('lit',i<Math.abs(state.speed)/91*22));
   if(isResearchMode(state.mode)){
     const target=state.mode==='dynamics'?{name:'DAMPER / SURFACE LAB',detail:'Explore the test strip. Steer, brake and study load transfer, wet grip, tire slip and suspension travel.'}:RESEARCH_STAGES[Math.min(state.stage,4)];
     $('objective').innerHTML=state.mode==='dynamics'?'SUSPENSION PROVING GROUND':`${target.name} <span>/ ${String(Math.min(state.stage+1,5)).padStart(2,'0')} OF 05</span>`;
     $('guidance').textContent=target.detail;updateResearchHud(target);
   }else if(state.mode==='trial'||state.mode==='launch'){
     const missionLength=missionGateCount(state.mode);
     $('objective').innerHTML=`Gate ${String(Math.min(state.gate+1,missionLength)).padStart(2,'0')} <span>/ ${missionLength}</span>`;
     const g=GATES[Math.min(state.gate,missionLength-1)],dist=Math.hypot(g[0]-state.x,g[2]-state.z);$('guidance').textContent=state.gate===0?'Accelerate toward the first gate.':`Target altitude ${g[1]} m · ${state.y<g[1]-5?'Hold Space to climb.':state.y>g[1]+5?'Release lift to descend.':'Line up with the illuminated ring.'}`;
     $('targetDistance').textContent=`${Math.round(dist)} m`;
     let angle=Math.atan2(-(g[0]-state.x),-(g[2]-state.z))-state.yaw;$('targetArrow').style.transform=`rotate(${-angle}rad)`;
     progressDots.forEach((d,i)=>{d.classList.toggle('done',i<state.gate);d.classList.toggle('current',i===state.gate);});
   }else if(state.mode==='stunt'){$('objective').innerHTML='Make it count.';$('guidance').textContent='Link stunts before the clock runs out.';}else{$('objective').innerHTML='Your sky. Your rules.';$('guidance').textContent='Try the launch ramp ahead or the suction loop to the west.';}
   for(const [key,label] of [['roll','Complete a barrel roll'],['jump','Clear the vehicle lineup'],['loop','Ride the suction loop']]){const el=$(key+'Objective');el.textContent=(state.objectives[key]?'✓ ':'○ ')+label;el.classList.toggle('done',state.objectives[key]);}
   drawMap();
 }
 function updateResearchHud(target){
   $('researchStageNumber').textContent=state.mode==='dynamics'?'TRACK  /  03':'0'+Math.min(5,state.stage+1)+' / 05';
   $('researchStageName').textContent=target.name;
   $('researchStageDetail').textContent=target.detail;
   $('researchVSpeed').textContent=(state.vy>=0?'+':'')+state.vy.toFixed(1);
   $('researchWind').textContent=Math.hypot(state.windX,state.windZ).toFixed(1);
   $('researchThrust').textContent=(state.thrustG||0).toFixed(2);
   $('researchFuel').textContent=state.propellant.toFixed(0);
   $('researchTemp').textContent=state.temperature.toFixed(0);
   $('researchStructure').textContent=state.structural.toFixed(0);
   $('chassisGrip').textContent=Math.round(suspension.grip*100)+'%';
   $('chassisRide').textContent=(suspension.heave*1000).toFixed(0)+' mm';
   $('chassisRoll').textContent=(suspension.roll*180/Math.PI).toFixed(1)+'°';
   $('chassisContacts').textContent=suspension.contactCount+' / 4';
   for(let i=0;i<4;i++){
      $('corner'+i+'Load').textContent=(suspension.normalForces[i]/1000).toFixed(1)+' kN';
      $('corner'+i+'Travel').style.height=(14+Math.round(80*(suspension.compression[i]/SUSPENSION.maxCompression)))+'%';
      $('corner'+i).classList.toggle('no-contact',suspension.normalForces[i]<1);
   }
   const d=state.drivetrain;
   $('dynamicsModule').classList.toggle('hidden',state.mode!=='dynamics');
   if(d&&state.mode==='dynamics'){
      $('driveSoc').textContent=d.soc.toFixed(1)+'%';
      $('drivePower').textContent=(d.powerKw-d.regenKw).toFixed(0)+' kW';
      $('driveSteer').textContent=(d.steerAngle*180/Math.PI).toFixed(1)+'°';
      $('driveSlip').textContent=(Math.atan2(d.velocityLateral,Math.max(2,Math.abs(d.velocityForward)))*180/Math.PI).toFixed(1)+'°';
      $('driveTire').textContent=(d.tireTemperature.reduce((a,b)=>a+b,0)/4).toFixed(0)+'°C';
      $('driveBrake').textContent=(d.brakeTemperature.reduce((a,b)=>a+b,0)/4).toFixed(0)+'°C';
      $('driveGrip').textContent=(d.gripUtilization*100).toFixed(0)+'%';
      $('driveSafety').textContent=d.absActive?'ABS ACTIVE':d.tcsActive?'TORQUE LIMITED':d.escActive?'ESC CORRECTING':d.contactImpacts?'FRAME IMPACT '+d.contactImpacts:'FULL TRACTION';
      $('driveGear').textContent=d.gear;
      $('driveWear').textContent=(100*d.tireWear.reduce((a,b)=>a+b,0)/4).toFixed(1)+'%';
      $('driveTorque').textContent=Math.round(100*d.torqueLimit)+'%';
      $('tractionToggle').textContent='K · TRACTION CONTROL '+(d.tcsEnabled?'ON':'OFF');
      $('tractionToggle').setAttribute('aria-pressed',String(d.tcsEnabled));
      $('surfaceToggle').textContent=state.roadMu<.7?'ROAD / WET':'ROAD / DRY';
      $('benchRms').textContent=suspension.rideRmsG.toFixed(3)+' g';
      $('benchRoll').textContent=suspension.peakRollDeg.toFixed(1)+'°';
      $('benchAirtime').textContent=(suspension.airborneWheelSeconds/4).toFixed(2)+' s';
      $('benchBottoms').textContent=String(suspension.bottomOuts);
      if(benchmark && !benchmarkHold && suspension.testTime>1.5){
        const delta=100*(suspension.rideRmsG/Math.max(.0001,benchmark.rms)-1);
        $('benchComparison').textContent=`BASELINE ${benchmark.setup.toUpperCase()} / ${benchmark.rms.toFixed(3)} g · CURRENT ${suspension.rideRmsG.toFixed(3)} g (${delta>=0?'+':''}${delta.toFixed(1)}% vibration)`;
      }
   }
   $('researchStageNumber').style.color=state.structural<35?'#ff978a':'#b5eaf4';
   $('horizonGround').style.transform=`translateY(${clamp(state.pitch+suspension.pitch,-.3,.3)*130}px) rotate(${clamp(state.roll+suspension.roll,-.45,.45)*180/Math.PI}deg)`;
   $('precisionButton').classList.toggle('selected',state.precision);$('assistButton').classList.toggle('selected',state.assist);
   $('precisionButton').querySelector('b').textContent=state.precision?'ON':'OFF';
   $('assistButton').querySelector('b').textContent=state.assist?'ON':'OFF';
   $('researchHint').textContent=state.propellant<15?'LOW PROPELLANT · DESCEND WHILE YOU CAN':state.temperature>110?'THERMAL LOAD RISING · MODULATE YOUR THRUST':state.precision?'ALTITUDE HOLD ARMED · HOLD SPACE TO CLIMB · Z TO RELEASE':'SPACE LIFT · W/S VECTOR · J/L STRAFE · A/D YAW';
   paintResearchTrace();
 }
 function paintResearchTrace(){
   const cv=$('researchTrace'),c=cv.getContext('2d');const W=cv.width,H=cv.height;
   c.clearRect(0,0,W,H);c.fillStyle='#071321';c.fillRect(0,0,W,H);
   c.strokeStyle='#a2dbfa1e';c.lineWidth=1;
   for(let i=1;i<6;i++){c.beginPath();c.moveTo(0,i*H/6);c.lineTo(W,i*H/6);c.stroke();}
   for(let i=1;i<9;i++){c.beginPath();c.moveTo(i*W/9,0);c.lineTo(i*W/9,H);c.stroke();}
   if(trace.length<2)return;
   for(const [key,color,max] of [[1,'#a9f0ff',55],[2,'#d7a8ff',2.2]]){
     c.beginPath();c.strokeStyle=color;c.lineWidth=2;
     trace.slice(-180).forEach((q,i,ar)=>{const x=i/179*W,y=H-3-clamp(q[key]/max,0,1)*(H-7);i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();
   }
   c.font='9px monospace';c.fillStyle='#a9f0ff';c.fillText('ALT',7,12);c.fillStyle='#d7a8ff';c.fillText('THRUST',42,12);
 }
 function toggleTraction(){
   if(state.mode!=='dynamics'||phase!=='running'||!state.drivetrain)return;
   const d=state.drivetrain;d.tcsEnabled=!d.tcsEnabled;
   displayCallout(d.tcsEnabled?'TRACTION CONTROL ENABLED':'TRACTION CONTROL DISABLED',d.tcsEnabled?'MOTOR TORQUE IS MANAGED WHEN TIRES SLIP':'RAW DRIVER TORQUE / WATCH WHEEL SLIP',1.8);
 }
 function toggleSurface(){if(state.mode!=='dynamics')return;state.roadMu=state.roadMu<.7?1.06:.54;displayCallout(state.roadMu<.7?'WET TEST SURFACE':'DRY TEST SURFACE',state.roadMu<.7?'LESS GRIP / LONGER BRAKING DISTANCE':'FULL TIRE ADHESION',1.6);}
 function updateTuningUI(){
   const t=tuningParameters(suspension.tune);
   $('springTuning').value=String(Math.round(suspension.tune.springScale*100));
   $('damperTuning').value=String(Math.round(suspension.tune.damperScale*100));
   $('springRateLabel').textContent=(t.springRate/1000).toFixed(1)+' kN/m';
   $('damperRateLabel').textContent=Math.round(suspension.tune.damperScale*100)+'%';
   document.querySelectorAll('[data-setup]').forEach(button=>{
     const selected=button.dataset.setup===selectedSetup;
     button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
   });
   $('app').dataset.chassis=selectedSetup;
 }
 function changeSetup(preset){
   if(state.mode!=='dynamics'||!Object.hasOwn(CHASSIS_SETUPS,preset))return;
   selectedSetup=preset;setChassisSetup(suspension,preset);benchmarkHold=false;updateTuningUI();
   if(phase==='running')displayCallout(CHASSIS_SETUPS[preset].label+' SETUP','SPRING / DAMPER / ANTI-ROLL CALIBRATED',1.5);
 }
 function saveBenchmark(){
   if(state.mode!=='dynamics'||suspension.testTime<3||state.z>55){$('benchComparison').textContent='Cross the first speed hump (z ≤ 55 m) before saving a benchmark.';return;}
   benchmark={setup:selectedSetup,rms:suspension.rideRmsG,roll:suspension.peakRollDeg,air:suspension.airborneWheelSeconds/4};benchmarkHold=true;
   $('benchComparison').textContent='BENCHMARK SAVED · Restart the course or select a new setup to compare.';
 }
 function togglePrecision(){if(!isResearchMode(state.mode)||phase!=='running')return;setPrecision(state,!state.precision);displayCallout(state.precision?'ALTITUDE HOLD ENGAGED':'MANUAL VERTICAL CONTROL',state.precision?'PROPELLANT CONSUMPTION CONTINUES':'BALLISTIC DESCENT',1.5);}
 function toggleAssist(){if(!isResearchMode(state.mode)||phase!=='running')return;state.assist=!state.assist;displayCallout(state.assist?'STABILITY AUGMENTATION ON':'DIRECT THRUSTER RESPONSE',state.assist?'WIND COMPENSATION ENABLED':'MANUAL CORRECTION REQUIRED',1.5);}
 function captureData(){exportTelemetry(lastFlightLog,'xflight');}
 function exportDynamicsLog(){
   if(state.mode!=='dynamics'||flightLog.length<3){displayCallout('NO SAMPLES YET','DRIVE FOR A FEW SECONDS',1.5);return;}
   exportTelemetry(flightLog,'chassis-lab');
   displayCallout('RUN DATA EXPORTED',`${flightLog.length} TELEMETRY FRAMES / 20 HZ`,1.6);
 }
 function exportTelemetry(data,label){
   if(!data.length)return;
   const columns=['seconds','x_m','altitude_m','z_m','yaw_rad','pitch_rad','roll_rad','vx_ms','vy_ms','vz_ms','thrust_g','propellant_kg','nozzle_C','airframe_percent','stage','FL_travel_m','FR_travel_m','RL_travel_m','RR_travel_m','FL_normal_N','FR_normal_N','RL_normal_N','RR_normal_N','chassis_heave_m','chassis_pitch_rad','chassis_roll_rad','battery_soc_pct','motor_power_kw','regen_kw','yaw_rate_rads','rack_steer_rad','grip_utilization','FL_tire_C','FR_tire_C','RL_tire_C','RR_tire_C','front_brake_C','rear_brake_C','rail_impacts','gear','tcs_active','available_torque_pct','FL_wear_pct','FR_wear_pct','RL_wear_pct','RR_wear_pct'];
   const rows=[columns.join(','),...data.map(row=>row.map(v=>typeof v==='number'?v.toFixed(3):v).join(','))];
   const uri=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=uri;a.download='roadster-'+label+'-'+Date.now()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(uri),1000);
 }
 function setReplayFrame(){
   if(!lastFlightLog.length)return;
   while(replayIndex<lastFlightLog.length-1&&lastFlightLog[replayIndex+1][0]<replayElapsed)replayIndex++;
   while(replayIndex>0&&lastFlightLog[replayIndex][0]>replayElapsed)replayIndex--;
   const q=lastFlightLog[replayIndex];
   [state.time,state.x,state.y,state.z,state.yaw,state.pitch,state.roll,state.vx,state.vy,state.vz,state.thrustG,state.propellant,state.temperature,state.structural,state.stage]=q;
   if(q.length>=26){suspension.wheelTravel=q.slice(15,19);suspension.normalForces=q.slice(19,23);[suspension.heave,suspension.pitch,suspension.roll]=q.slice(23,26);}
   state.air=100*state.propellant/260;state.grounded=state.y<.01;state.speed=Math.hypot(state.vx,state.vz);
   state.windX=0;state.windZ=0;
   $('replayTime').textContent=formatTime(replayElapsed);
   $('replayScrub').value=String(Math.round(1000*replayElapsed/lastFlightLog.at(-1)[0]));
 }
 function startReplay(){
   if(lastFlightLog.length<2)return;
   closeDialogs();state=makeResearchState();$('hud').classList.remove('hidden');$('replayPanel').classList.remove('hidden');$('researchPanel').classList.remove('hidden');$('app').dataset.mode='research';
   replayElapsed=0;replayIndex=0;replayPlaying=true;cameraMode=2;setPhase('replay');clearKeys();w.setResearchPhase(true,0);w.setGhostPose(null);setReplayFrame();positionCamera(1,true);
 }
 function drawMap(){
   const cx=160,cz=130,scale=.7;const p=(x,z)=>[cx+x*scale,cz+(z+85)*scale];ctx.clearRect(0,0,320,240);ctx.fillStyle='#b5c6db12';
   const p0=p(0,-310);ctx.fillRect(p0[0]-8,p0[1],16,480*scale);const p1=p(-145,32);ctx.fillRect(p1[0],p1[1]-5,290*scale,10);const p2=p(LOOP.x,-165);ctx.fillRect(p2[0]-5,p2[1],10,255*scale);
   ctx.strokeStyle='#a9bbcf20';ctx.lineWidth=1;for(let x=20;x<320;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,240);ctx.stroke();}for(let y=0;y<240;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(320,y);ctx.stroke();}
   const lp=p(LOOP.x,LOOP.z);ctx.strokeStyle='#c4a7ff88';ctx.beginPath();ctx.arc(lp[0],lp[1],7,0,Math.PI*2);ctx.stroke();
   if(state.mode==='trial'||state.mode==='launch'){ctx.strokeStyle='#c4a7ff40';ctx.setLineDash([3,5]);ctx.beginPath();GATES.slice(0,missionGateCount(state.mode)).forEach((g,i)=>{const pos=p(g[0],g[2]);i?ctx.lineTo(...pos):ctx.moveTo(...pos);});ctx.stroke();ctx.setLineDash([]);GATES.slice(0,missionGateCount(state.mode)).forEach((g,i)=>{const pos=p(g[0],g[2]);ctx.fillStyle=i<state.gate?'#7e8c9a':i===state.gate?'#e4ff95':'#b6a2e766';ctx.beginPath();ctx.arc(...pos,i===state.gate?5:2.5,0,Math.PI*2);ctx.fill();});}
   const pos=p(state.x,state.z);ctx.save();ctx.translate(clamp(pos[0],8,312),clamp(pos[1],8,232));ctx.rotate(-state.yaw);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-4.5,5);ctx.lineTo(0,2);ctx.lineTo(4.5,5);ctx.closePath();ctx.fill();ctx.restore();
 }
 function positionCamera(dt,snap=false){
   const y=state.y;
   if(phase==='menu'){
     const mobile=innerWidth<650;car.position.set(0,.45+Math.sin(elapsed*.65)*.10,42);car.rotation.set(-.03,.25+Math.sin(elapsed*.12)*.08,.01);car.scale.setScalar(mobile?1.25:1.5);
     camDesired.set(mobile?10:7,mobile?4.8:3.7,mobile?58:53.5);lookDesired.set(mobile?-3.4:-3.3,mobile?2.5:.55,42);camera.fov=mobile?48:41;
   }else{
     car.scale.setScalar(1);car.position.set(state.x,y,state.z);car.rotation.set(0,state.yaw,0);
     car.userData.body.position.y=suspension.heave;
     car.userData.body.rotation.set(state.pitch+suspension.pitch,0,state.roll+suspension.roll);
     if(car.userData.springs)car.userData.springs.forEach(({carrier,strut,piston,spring},i)=>{
       const travel=suspension.wheelTravel[i];
       carrier.position.y=travel;
       carrier.rotation.y=state.drivetrain&&i<2?state.drivetrain.steerAngle:0;
       piston.position.y=-.35+travel*.35;spring.position.y=-.16+travel*.18;
       spring.scale.set(1,1,Math.max(.65,1-travel*.8));
     });
     const sy=Math.sin(state.yaw),cy=Math.cos(state.yaw);
     if(cameraMode===3){const pose=orbitPose(orbit,{x:state.x,y:y+1.05,z:state.z});camDesired.set(pose.position.x,Math.max(pose.position.y,heightAt(pose.position.x,pose.position.z)+.7),pose.position.z);lookDesired.set(pose.target.x,pose.target.y,pose.target.z);}
     else if(cameraMode===1&&state.loopAngle===null){camDesired.set(state.x-sy*1.5,y+1.5,state.z-cy*1.5);lookDesired.set(state.x-sy*30,y+1.2,state.z-cy*30);}
     else if(state.loopAngle!==null){camDesired.set(LOOP.x+38,20,LOOP.z+32);lookDesired.set(state.x,state.y+1,state.z);}
     else{const distance=cameraMode===2?21:12;camDesired.set(state.x+sy*distance,y+(cameraMode===2?9:4.9),state.z+cy*distance);lookDesired.set(state.x-sy*6,y+1.4,state.z-cy*6);}
     camera.fov+=((cameraMode===3?55:clamp(54+Math.abs(state.speed)*.16+(state.boosting?5:0),54,72))-camera.fov)*(1-Math.exp(-dt*2));
   }
   if(snap){camera.position.copy(camDesired);camTarget.copy(lookDesired);}else{const blend=1-Math.exp(-dt*(phase==='menu'?1.7:7));camera.position.lerp(camDesired,blend);camTarget.lerp(lookDesired,blend);}
   camera.lookAt(camTarget);camera.updateProjectionMatrix();
   car.visible=!(phase!=='menu'&&cameraMode===1&&state.loopAngle===null);
   shadow.position.set(car.position.x,.035+heightAt(car.position.x,car.position.z),car.position.z);shadow.scale.setScalar(1+car.position.y*.028);shadow.material.opacity=Math.max(.1,.8-car.position.y*.015);shadow.rotation.z=-car.rotation.y;
   sun.position.set(car.position.x-80,110,car.position.z-75);sun.target.position.set(car.position.x,0,car.position.z);
 }
 function frame(now){
   requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.06);last=now;elapsed+=dt;
   if(phase==='countdown'){const before=Math.ceil(countdown);countdown-=dt;const after=Math.ceil(countdown);if(before!==after&&after>0)tone(350);$('countdown').textContent=countdown>0?String(after):'GO';if(countdown<=-.45){$('countdown').classList.add('hidden');setPhase('running');displayCallout('YOU HAVE CONTROL',['trial','launch'].includes(state.mode)?'W TO DRIVE  /  SPACE TO LIFT':'THE RANGE IS YOURS',2);tone(700,.2);}}
   if(phase==='running'){
     accumulator+=dt;
     while(accumulator>=1/120&&phase==='running'){
       const input={throttle:keys.has('KeyW')||keys.has('ArrowUp'),brake:keys.has('KeyS')||keys.has('ArrowDown'),left:keys.has('KeyA')||keys.has('ArrowLeft'),right:keys.has('KeyD')||keys.has('ArrowRight'),lift:keys.has('Space'),boost:keys.has('ShiftLeft')||keys.has('ShiftRight'),roll:rollInput};rollInput=0;
       if(isResearchMode(state.mode))handleEvents(stepResearch(state,{...input,strafeLeft:keys.has('KeyJ'),strafeRight:keys.has('KeyL')},1/120));else handleEvents(step(state,input,1/120));
       suspensionStep(suspension,state,1/120,{mass:isResearchMode(state.mode)?1900+state.propellant:2160});state.suspension=suspension;accumulator-=1/120;
     }
     if(calloutTime>0){calloutTime-=dt;if(calloutTime<=0)$('callout').classList.remove('show');}
   }
   if(phase==='replay'){if(replayPlaying){replayElapsed=Math.min(lastFlightLog.at(-1)[0],replayElapsed+dt);if(replayElapsed>=lastFlightLog.at(-1)[0])replayPlaying=false;}setReplayFrame();updateHud();w.setResearchPhase(true,state.stage);} 
   positionCamera(dt);if(phase==='menu')car.userData.body.rotation.set(0,0,0);
   const active=phase==='running';
   if(active&&isResearchMode(state.mode)){
     logTimer+=dt;if(logTimer>=.05){logTimer=0;const d=state.drivetrain;const sample=[state.time,state.x,state.y,state.z,state.yaw,state.pitch,state.roll,state.vx,state.vy,state.vz,state.thrustG,state.propellant,state.temperature,state.structural,state.stage,...suspension.wheelTravel,...suspension.normalForces,suspension.heave,suspension.pitch,suspension.roll,d?.soc??0,d?.powerKw??0,d?.regenKw??0,d?.yawRate??0,d?.steerAngle??0,d?.gripUtilization??0,...(d?.tireTemperature??[0,0,0,0]),d?.brakeTemperature?.[0]??0,d?.brakeTemperature?.[2]??0,d?.contactImpacts??0,d?.gear??'N',d?.tcsActive?1:0,100*(d?.torqueLimit??1),...(d?.tireWear??[0,0,0,0]).map(x=>100*x)];
       if(flightLog.length<3600)flightLog.push(sample);trace.push([state.time,state.y,state.thrustG]);if(trace.length>180)trace.shift();}
   }
   if(active&&['trial','launch'].includes(state.mode)){
     recordTimer+=dt;if(recordTimer>=.10){recordTimer=0;if(recording.length<1800)recording.push([+state.time.toFixed(2),state.x,state.y,state.z,state.yaw,state.pitch,state.roll]);}
   }
   if(active&&ghostTrack.length>1){
     const sample=Math.min(ghostTrack.length-1,Math.max(0,Math.floor(state.time*10)));
     let j=sample;while(j+1<ghostTrack.length&&ghostTrack[j+1][0]<state.time)j++;
     const a=ghostTrack[j],b=ghostTrack[Math.min(j+1,ghostTrack.length-1)];
     const t=clamp((state.time-a[0])/Math.max(.0001,b[0]-a[0]),0,1);
     const angle=Math.atan2(Math.sin(b[4]-a[4]),Math.cos(b[4]-a[4]));
     w.setGhostPose([a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t,a[4]+angle*t,a[5]+(b[5]-a[5])*t,a[6]+(b[6]-a[6])*t]);
   }else w.setGhostPose(null);
   car.userData.wheels.forEach((t,i)=>{if(active)t.rotation.x=suspension.wheelSpin[i];});
   if((active&&(state.lifting||state.boosting))||phase==='menu'){
     car.updateMatrixWorld();for(let j=0;j<(phase==='menu'?2:5);j++){
       if(state.lifting||phase==='menu'){const x=j%2?-.86:.86,z=j%3?1.4:-1.42;temp.set(x,.24,z).applyMatrix4(car.matrixWorld);velocity.set((Math.random()-.5)*1.8,-7-Math.random()*3,(Math.random()-.5)*1.8);w.emit(temp,velocity);}
       if(active&&state.boosting){temp.set((Math.random()-.5)*1.6,.5,2.5).applyMatrix4(car.matrixWorld);velocity.set(Math.sin(state.yaw)*14,Math.random()*.7,Math.cos(state.yaw)*14);w.emit(temp,velocity);}
     }
   }
   if(active&&state.mode==='dynamics'&&Math.floor(elapsed*14)!==Math.floor((elapsed-dt)*14))w.stampSkids(state);
   w.setVehicleEffects(state,elapsed);if(isResearchMode(state.mode))w.updateResearchScene(state,elapsed);
   w.updateParticles(dt);
   if(phase!=='menu')updateHud();
   if(audioContext){const play=soundEnabled&&active;engine.frequency.setTargetAtTime(80+Math.abs(state.speed)*7,audioContext.currentTime,.08);engineGain.gain.setTargetAtTime(play?Math.min(.025,Math.abs(state.speed)*.0004):0,audioContext.currentTime,.08);gasGain.gain.setTargetAtTime(play&&(state.lifting||state.boosting||isResearchMode(state.mode)&&state.precision)?.065:0,audioContext.currentTime,.08);}
   renderer.render(scene,camera);
 }
 // Keyboard and touch both feed the exact same physics controls.
 // Compact HUD on by default. Detailed engineering panels are on demand.
 $('telemetryToggle').addEventListener('click',()=>{
   const opened=$('app').dataset.telemetry==='open';
   $('app').dataset.telemetry=opened?'closed':'open';
   $('telemetryToggle').setAttribute('aria-expanded',String(!opened));
   $('telemetryToggle').textContent=opened?'SHOW SYSTEMS':'HIDE SYSTEMS';
 });

 // Pointer-based free orbit. The canvas is the interaction surface; all HUD controls
 // remain clickable and do not drag the camera. Left-drag rotates, right-drag pans.
 $('orbitButton').addEventListener('click',()=>{if(phase==='running'||phase==='replay'||phase==='countdown')selectCamera(cameraMode===3?0:3);});
 renderer.domElement.addEventListener('contextmenu',e=>{if(cameraMode===3)e.preventDefault();});
 renderer.domElement.addEventListener('pointerdown',e=>{
   if(cameraMode!==3||!['running','replay','countdown'].includes(phase)||(!e.isPrimary&&e.pointerType==='touch'))return;
   if(e.button!==0&&e.button!==2)return;
   orbitPointer={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.button===2||e.shiftKey};
   renderer.domElement.setPointerCapture?.(e.pointerId);e.preventDefault();
 });
 renderer.domElement.addEventListener('pointermove',e=>{
   if(!orbitPointer||orbitPointer.id!==e.pointerId||cameraMode!==3)return;
   const dx=e.clientX-orbitPointer.x,dy=e.clientY-orbitPointer.y;
   orbitPointer.x=e.clientX;orbitPointer.y=e.clientY;
   if(orbitPointer.pan)orbitPan(orbit,dx,dy);else orbitDrag(orbit,dx,dy);
   positionCamera(.016,true);e.preventDefault();
 });
 function releaseOrbitPointer(e){if(orbitPointer?.id===e.pointerId){orbitPointer=null;try{renderer.domElement.releasePointerCapture(e.pointerId);}catch{}}}
 renderer.domElement.addEventListener('pointerup',releaseOrbitPointer);
 renderer.domElement.addEventListener('pointercancel',releaseOrbitPointer);
 renderer.domElement.addEventListener('lostpointercapture',releaseOrbitPointer);
 renderer.domElement.addEventListener('wheel',e=>{if(cameraMode!==3||!['running','replay','countdown'].includes(phase))return;orbitZoom(orbit,e.deltaY);positionCamera(.016,true);e.preventDefault();},{passive:false});
 renderer.domElement.addEventListener('dblclick',e=>{if(cameraMode!==3)return;resetOrbit(orbit,state.yaw||0);positionCamera(.016,true);e.preventDefault();});
 const gameKeys=new Set(['KeyK','KeyB','KeyY','KeyZ','KeyG','KeyJ','KeyL','KeyT','KeyH','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyQ','KeyE','KeyF','KeyC','KeyO','KeyR']);
 window.addEventListener('keydown',e=>{
   if(e.code==='KeyM'&&!e.repeat){toggleSound();return;}
   if(e.code==='KeyT'&&!e.repeat){cycleEnvironment();return;}
   if(e.code==='KeyH'&&!e.repeat){savePhoto();return;}
   if(phase==='replay'&&e.code==='Escape'){menu();return;}
   if(e.code==='Escape'||e.code==='KeyP'){if(phase==='paused'){e.preventDefault();resume();}else if(phase==='running'||phase==='countdown'){e.preventDefault();pause();}return;}
   if(phase!=='running'&&phase!=='countdown')return;
   if(gameKeys.has(e.code))e.preventDefault();keys.add(e.code);
   if(!e.repeat){if(e.code==='KeyB'&&state.mode==='dynamics'){const order=['comfort','balanced','track'];changeSetup(order[(order.indexOf(selectedSetup)+1)%order.length]);return;}if(e.code==='KeyY'&&state.mode==='dynamics'){toggleSurface();return;}if(e.code==='KeyK'&&state.mode==='dynamics'){toggleTraction();return;}if(e.code==='KeyZ'){togglePrecision();return;}if(e.code==='KeyG'){toggleAssist();return;}if(e.code==='KeyQ')rollInput=1;if(e.code==='KeyE')rollInput=-1;if(e.code==='KeyC'){selectCamera((cameraMode+1)%4);}if(e.code==='KeyO'){selectCamera(cameraMode===3?0:3);}if(e.code==='KeyF'){state.suction=!state.suction;displayCallout(state.suction?'SUCTION ENABLED':'SUCTION OFF',state.suction?'WEST LOOP READY':'FREE ROLLING',1.3);}if(e.code==='KeyR'){if(isResearchMode(state.mode)){start();return;}resetPosition(state,phase==='running');positionCamera(1,true);displayCallout('CHECKPOINT RESET',state.mode==='trial'?'+3 SECONDS':'READY FOR ANOTHER TRY',1.5);}}
 });
 window.addEventListener('keyup',e=>keys.delete(e.code));
 window.addEventListener('blur',()=>{clearKeys();pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearKeys();pause();}});
 for(const button of document.querySelectorAll('[data-key]')){
   const key=button.dataset.key;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(key);button.classList.add('pressed');});
   for(const ev of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,()=>{keys.delete(key);button.classList.remove('pressed');});
 }
 document.querySelector('[data-action="roll"]').addEventListener('pointerdown',e=>{e.preventDefault();rollInput=1;});
 document.querySelector('[data-action="reset"]').addEventListener('pointerdown',e=>{e.preventDefault();if(phase!=='running')return;if(isResearchMode(state.mode)){start();return;}resetPosition(state);positionCamera(1,true);displayCallout('CHECKPOINT RESET',state.mode==='trial'?'+3 SECONDS':'READY FOR ANOTHER TRY',1.5);});
 $('surfaceToggle').addEventListener('click',toggleSurface);
 $('tractionToggle').addEventListener('click',toggleTraction);
 document.querySelectorAll('[data-setup]').forEach(button=>button.addEventListener('click',()=>changeSetup(button.dataset.setup)));
 for(const [id,key] of [['springTuning','springScale'],['damperTuning','damperScale']]){
   $(id).addEventListener('input',()=>{if(state.mode!=='dynamics')return;setChassisAdjustment(suspension,key,Number($(id).value)/100);updateTuningUI();});
 }
 $('benchBaseline').addEventListener('click',saveBenchmark);
 $('exportChassisRun').addEventListener('click',exportDynamicsLog);
 $('precisionButton').addEventListener('click',togglePrecision);$('assistButton').addEventListener('click',toggleAssist);
 document.querySelector('[data-action="precision"]').addEventListener('pointerdown',e=>{e.preventDefault();togglePrecision();});
 document.querySelector('[data-action="stabilize"]').addEventListener('pointerdown',e=>{e.preventDefault();toggleAssist();});
 $('dataButton').addEventListener('click',captureData);$('replayButton').addEventListener('click',startReplay);
 $('replayExit').addEventListener('click',menu);$('replayPlay').addEventListener('click',()=>{replayPlaying=!replayPlaying;$('replayPlay').textContent=replayPlaying?'PAUSE REPLAY':'RESUME REPLAY';});
 $('replayScrub').addEventListener('input',e=>{replayElapsed=lastFlightLog.at(-1)[0]*Number(e.target.value)/1000;replayIndex=0;replayPlaying=false;setReplayFrame();});
 $('startButton').addEventListener('click',start);$('againButton').addEventListener('click',start);$('restartButton').addEventListener('click',start);
 $('menuButton').addEventListener('click',menu);$('resultMenuButton').addEventListener('click',menu);$('resumeButton').addEventListener('click',resume);$('pauseButton').addEventListener('click',pause);
 $('brand').addEventListener('click',e=>{e.preventDefault();if(phase==='running'||phase==='countdown')pause();else if(phase==='menu')return;});
 $('controlsButton').addEventListener('click',()=>openModal('controlsDialog'));$('referencesButton').addEventListener('click',()=>openModal('referencesDialog'));$('audioButton').addEventListener('click',toggleSound);
 $('environmentButton').addEventListener('click',cycleEnvironment);$('photoButton').addEventListener('click',savePhoto);
 $('fullButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else displayCallout('FULLSCREEN UNAVAILABLE','USE YOUR BROWSER’S FULLSCREEN OPTION');}catch{displayCallout('FULLSCREEN UNAVAILABLE','USE YOUR BROWSER’S FULLSCREEN OPTION');}});
 document.querySelectorAll('.close-dialog,.close-dialog-button').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
 for(const id of ['controlsDialog','referencesDialog'])$(id).addEventListener('close',()=>{if(id==='referencesDialog'){$('videoContainer').replaceChildren();$('loadVideo').classList.remove('hidden');}if(phase==='modal'){setPhase(previousModalPhase==='countdown'?'countdown':'running');clearKeys();last=performance.now();}});
 $('pauseDialog').addEventListener('cancel',e=>{e.preventDefault();resume();});$('resultsDialog').addEventListener('cancel',e=>{e.preventDefault();menu();});
 $('loadVideo').addEventListener('click',()=>{const f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/qt5p-_tE8d0?autoplay=1';f.title='Tesla Roadster Event — original reveal';f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';$('videoContainer').appendChild(f);$('loadVideo').classList.add('hidden');});
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{selectedMode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(m=>{m.classList.toggle('active',m===b);m.setAttribute('aria-pressed',String(m===b));});$('startButton').innerHTML=selectedMode==='research'?'INITIATE TEST FLIGHT <span>↗</span>':selectedMode==='dynamics'?'BEGIN CHASSIS TEST <span>↗</span>':selectedMode==='free'?'EXPLORE THE RANGE <span>↗</span>':selectedMode==='stunt'?'START STUNT RUN <span>↗</span>':'START FLIGHT <span>↗</span>';tone(450,.08);}));
 window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();positionCamera(1,true);});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('errorPanel').classList.remove('hidden');$('errorMessage').textContent='The graphics connection was lost. Reload to restart the test range.';});
 try{environmentIndex=Number(localStorage.getItem('roadster-v2-lighting')||0)%3;if(environmentIndex<0||!Number.isFinite(environmentIndex))environmentIndex=0;}catch{} $('environmentButton').textContent=w.setEnvironment(environmentIndex);
 menu();positionCamera(1,true);renderer.render(scene,camera);$('loading').classList.add('hidden');$('app').dataset.ready='true';requestAnimationFrame(frame);
}