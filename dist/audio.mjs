// Synthesized EV harmonics, rolling noise, tire slip and expanding gas.
export class VehicleAudio {
  constructor(){this.enabled=false;this.ctx=null;}
  async toggle(){this.enabled=!this.enabled;if(this.enabled){this.init();await this.ctx.resume();}else if(this.ctx)await this.ctx.suspend();return this.enabled;}
  init(){
    if(this.ctx)return;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){this.enabled=false;return;}
    const c=this.ctx=new Audio();this.master=c.createGain();this.master.gain.value=.32;this.master.connect(c.destination);
    this.motor=c.createOscillator();this.motor.type='sine';this.motorGain=c.createGain();this.motorGain.gain.value=0;this.motor.connect(this.motorGain).connect(this.master);this.motor.start();
    this.harmonic=c.createOscillator();this.harmonic.type='triangle';this.harmonicGain=c.createGain();this.harmonicGain.gain.value=0;this.harmonic.connect(this.harmonicGain).connect(this.master);this.harmonic.start();
    const buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=(last+Math.random()*.14-.07)/1.025;data[i]=last*3;}
    const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;
    this.windFilter=c.createBiquadFilter();this.windFilter.type='lowpass';this.windFilter.frequency.value=900;this.windGain=c.createGain();this.windGain.gain.value=0;noise.connect(this.windFilter).connect(this.windGain).connect(this.master);
    this.thrustFilter=c.createBiquadFilter();this.thrustFilter.type='highpass';this.thrustFilter.frequency.value=450;this.thrustGain=c.createGain();this.thrustGain.gain.value=0;noise.connect(this.thrustFilter).connect(this.thrustGain).connect(this.master);
    this.tireFilter=c.createBiquadFilter();this.tireFilter.type='bandpass';this.tireFilter.frequency.value=1800;this.tireFilter.Q.value=2.3;this.tireGain=c.createGain();this.tireGain.gain.value=0;noise.connect(this.tireFilter).connect(this.tireGain).connect(this.master);noise.start();
  }
  update(s,input,active){
    if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime,k=active?1:0;
    const smooth=(param,v)=>param.setTargetAtTime(v,t,.09);
    smooth(this.motor.frequency,95+Math.abs(s.forwardSpeed)*10);smooth(this.harmonic.frequency,195+Math.abs(s.forwardSpeed)*20);
    smooth(this.motorGain.gain,k*(.018+Math.abs(input.throttle||0)*.05)*Math.min(1,s.speed/2));smooth(this.harmonicGain.gain,k*Math.abs(input.throttle||0)*.017);
    smooth(this.windGain.gain,k*Math.min(.22,(s.speed/95)**2*.24));smooth(this.windFilter.frequency,300+s.speed*17);
    smooth(this.thrustGain.gain,k*Math.min(.8,s.lifting*.65+s.boosting*.45));smooth(this.tireGain.gain,k*s.grounded*Math.min(.16,Math.max(0,s.slip-.12)*.4)*Math.min(1,s.speed/9));
  }
}
