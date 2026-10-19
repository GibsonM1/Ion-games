// Ionagrams sound: procedural music + sound effects made on the fly with Web Audio (no audio files).
// window.IonSound: setMusic(on) setSfx(on) unlock() phase(name) intensity(x) sfx(name) ready() CONFIG
// Everything is a safe no-op until unlock() runs from a user gesture (and when Web Audio is missing).
(function(){
'use strict';
const CONFIG={
  MASTER:.5,               // overall volume (classroom headphones: keep it modest)
  MUSIC:.3,                // music bus level, kept under the effects
  SFX:.8,                  // effects bus level
  LOBBY_BPM:96,            // lobby loop tempo
  COUNT_BPM:120,           // countdown pulse tempo
  BUILD_BPM:[100,140],     // build tempo at intensity 0 and at intensity 1
  HEART_BPM:[72,104],      // challenge heartbeat at the start and the end of the challenge
  CHALLENGE_S:25,          // seconds the heartbeat takes to speed up
  LAYERS:[.2,.45,.7,.9],   // intensity that adds each build layer (drums, arpeggio, full groove, lead); checked on bar lines
  XFADE:.45,               // crossfade seconds between phases
  AHEAD:.2,                // schedule notes this many seconds ahead
  TIMER_MS:50              // scheduler wake-up interval
};
let ctx=null,master,musBus,sfxBus,sfxSoft,noise,timer=0,sec=null;
let musicOn=false,sfxOn=false,ph='off',inten=0,step=0,next=0,bpm=100,level=0,t0=0;
const lastFx={};
const mhz=n=>440*Math.pow(2,(n-69)/12);
const ok=()=>!!ctx&&ctx.state==='running';
const hidden=()=>typeof document!=='undefined'&&!!document.hidden;
const lerp=(r,x)=>r[0]+(r[1]-r[0])*x;

// ---------- voices ----------
function env(g,t,v,a,d){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d)}
function osc(out,t,f,d,type,v,o){ // o: {to: glide-to Hz, gt: glide time, a: attack}
  o=o||{};const s=ctx.createOscillator(),g=ctx.createGain(),a=o.a||.004;
  s.type=type||'triangle';s.frequency.setValueAtTime(f,t);
  if(o.to)s.frequency.exponentialRampToValueAtTime(o.to,t+(o.gt||d));
  env(g,t,v,a,d);s.connect(g);g.connect(out);s.start(t);s.stop(t+a+d+.02);
}
function hit(out,t,d,v,ft,f,q){ // noise burst through a filter (one shared noise buffer)
  const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=noise;fl.type=ft;fl.frequency.value=f;fl.Q.value=q||.7;
  env(g,t,v,.002,d);s.connect(fl);fl.connect(g);g.connect(out);s.start(t,Math.random()*.6);s.stop(t+d+.03);
}
function pad(out,t,f,hold,v,type,a,r,det){ // slow attack, flat hold, slow release: no clicks
  const s=ctx.createOscillator(),g=ctx.createGain();s.type=type;s.frequency.value=f;if(det)s.detune.value=det;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.setValueAtTime(v,t+a+hold);g.gain.linearRampToValueAtTime(0,t+a+hold+r);
  s.connect(g);g.connect(out);s.start(t);s.stop(t+a+hold+r+.02);
}
function sweep(out,t,d,v,f0,f1){ // filtered-noise riser / whoosh
  const s=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();
  s.buffer=noise;fl.type='bandpass';fl.Q.value=2;fl.frequency.setValueAtTime(f0,t);fl.frequency.exponentialRampToValueAtTime(f1,t+d);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+d*.85);g.gain.linearRampToValueAtTime(0,t+d);
  s.connect(fl);fl.connect(g);g.connect(out);s.start(t,Math.random()*.6);s.stop(t+d+.02);
}
const kick=(o,t,v)=>osc(o,t,150,.22,'sine',v,{to:45,gt:.1});
const snare=(o,t,v)=>{hit(o,t,.12,v,'bandpass',1900);osc(o,t,200,.05,'triangle',v*.5)};
const hat=(o,t,v)=>hit(o,t,.035,v,'highpass',7500);
const bell=(o,t,f,v)=>{osc(o,t,f,.45,'sine',v);osc(o,t,f*4,.06,'sine',v*.25)}; // soft mallet
const crash=(o,t,v)=>hit(o,t,1.3,v,'highpass',5000);

// ---------- music by phase: each returns the length of one step (a 16th note) in seconds ----------
const CH=[[36,[60,64,67,72]],[34,[58,62,65,70]],[41,[57,60,65,69]],[43,[59,62,67,71]]]; // C Bb F G (bass, arp tones)
const ARP=[0,1,2,3,2,1,3,2];
const LOBBY_BASS=[36,33,41,43]; // C Am F G
const LOBBY_MEL={0:72,3:76,6:79,10:76,12:74,16:72,19:76,22:81,26:79,32:81,35:79,38:76,42:72,44:74,48:74,51:79,54:86,58:83,60:79};
const PENT=[72,74,76,79,81,84];
const PH={
  lobby(s,t){const i=s&15,o=sec.g;
    if(i===0||i===10)osc(o,t,mhz(LOBBY_BASS[(s>>4)&3]),.5,'triangle',i?.2:.32);
    if(i%4===2)hat(o,t,.05);
    const m=LOBBY_MEL[s&63];if(m)bell(o,t,mhz(m),.13);
    return 15/CONFIG.LOBBY_BPM;},
  countdown(s,t){const i=s&15,bar=s>>4,o=sec.g,sp=15/CONFIG.COUNT_BPM; // pulse climbs a step every bar
    if(i%2===0)osc(sec.lp,t,mhz(36+[0,2,4,5,7,9,11,12][Math.min(bar,7)]),.12,'sawtooth',.28);
    if(i%4===2)hat(o,t,.07);
    if(bar>=2&&i%4===0)kick(o,t,.55);
    if(i===0)sweep(o,t,16*sp,.03+.012*Math.min(bar,7),400,3500);
    return sp;},
  build(s,t){const i=s&15,bar=s>>4,c=CH[bar&3],o=sec.g;
    if(i===0)level=CONFIG.LAYERS.filter(x=>inten>=x).length; // layers change only on bar lines
    const L=level;bpm+=(lerp(CONFIG.BUILD_BPM,inten)-bpm)*.04;  // tempo glides, never jumps
    if(L>=3?i%2===0:(i===0||i===6||i===8||(L&&(i===10||i===14))))
      osc(sec.lp,t,mhz(c[0]+(L>=3&&i%4===2?12:0)),.15,'sawtooth',.3);
    if(L>=3)hat(o,t,i%4===2?.08:.03);else if(i%4===2)hat(o,t,.06);
    if(L>=1&&(i===0||i===8||(L>=3&&i===10)))kick(o,t,.7);
    if(L>=1&&(i===4||i===12))snare(o,t,.22);
    if(L>=2&&(L>=3||i%2===0))osc(o,t,mhz(c[1][ARP[i&7]]+12),.08,'square',.045);
    if(L>=4){
      if(i===0||i===3||i===6)[c[1][2],c[1][3]].forEach(n=>osc(sec.lp,t,mhz(n),.18,'sawtooth',.07));
      if(i%2===1)hit(o,t,.03,.03,'bandpass',6000,1.5);
      if((bar&3)===3&&i>=12)osc(o,t,220-(i-12)*35,.14,'sine',.35,{to:110-(i-12)*15});
    }
    return 15/bpm;},
  challenge(s,t){const i=s&15,o=sec.g,el=Math.min(1,Math.max(0,(t-t0)/CONFIG.CHALLENGE_S)),sp=15/lerp(CONFIG.HEART_BPM,el);
    if(i===0){ // suspended pad, alternating Csus4 and Fm/C, filter opening as time runs out
      sec.lp.frequency.setTargetAtTime(500+1300*el,t,.5);
      ((s>>4)&1?[48,53,56,60]:[48,53,55,60]).forEach((n,k)=>pad(sec.lp,t,mhz(n),16*sp-.4,.07,'sawtooth',.8,.8,k%2?7:-7));
    }
    if(i%4===0)osc(o,t,90,.2,'sine',.6,{to:42});        // lub
    if(i%4===1)osc(o,t,80,.16,'sine',.38,{to:40});       // dub
    if(el>.6&&i%4===2)hat(o,t,.04);
    return sp;},
  reveal(s,t){const o=sec.g; // snare roll crescendo, then a hit, then quiet
    if(s<12)hit(o,t,.08,.04+s*.02,'bandpass',2200);
    if(s===12){crash(o,t,.12);osc(o,t,70,.9,'sine',.55,{to:40});[48,55,62].forEach(n=>pad(sec.lp,t,mhz(n),.5,.07,'sawtooth',.02,1.4))}
    return .0625;},
  win(s,t){const o=sec.g,m={0:72,2:76,4:79}[s]; // fanfare, chord, sparkle down, then quiet
    if(m){osc(sec.lp,t,mhz(m),.16,'square',.12);osc(o,t,mhz(m),.2,'triangle',.18)}
    if(s===6){kick(o,t,.8);crash(o,t,.1);osc(o,t,mhz(36),.9,'triangle',.4);[60,64,67,72,76].forEach(n=>pad(sec.lp,t,mhz(n),.8,.05,'sawtooth',.02,1.2,n%2?6:-6))}
    if(s>=16&&s<=28&&s%2===0)bell(o,t,mhz([96,91,88,84,79,76,72][(s-16)/2]),.07);
    return 15/132;},
  review(s,t){const o=sec.lp; // soft IV-I "amen", then a hushed bell now and then
    if(s===0)[53,57,60,65].forEach(n=>pad(o,t,mhz(n),.7,.05,'triangle',.08,1.2));
    if(s===8)[48,55,60,64].forEach(n=>pad(o,t,mhz(n),1.4,.05,'triangle',.08,2));
    if(s>=32&&s%8===0)bell(sec.g,t,mhz(PENT[(s/8*3)%PENT.length]),.045);
    return 15/90;}
};
const STING={reveal:1,win:1,review:1};

function dropSection(){
  if(!sec)return;const g=sec.g;sec=null;
  try{const now=ctx.currentTime;g.gain.cancelScheduledValues(now);g.gain.setTargetAtTime(0,now,CONFIG.XFADE/4)}catch(e){}
  setTimeout(()=>{try{g.disconnect()}catch(e){}},CONFIG.XFADE*1000+800);
}
function newSection(){
  const now=ctx.currentTime,g=ctx.createGain(),lp=ctx.createBiquadFilter();
  lp.type='lowpass';lp.frequency.value=ph==='challenge'?500:1500;lp.connect(g);g.connect(musBus);
  g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(1,now+(STING[ph]?.02:CONFIG.XFADE));
  sec={g,lp};step=0;t0=now;next=now+.03;level=0;bpm=lerp(CONFIG.BUILD_BPM,inten);
}
function tick(){
  try{
    if(!ok()||!musicOn||ph==='off'||hidden())return;
    if(!sec)newSection();
    const now=ctx.currentTime;
    if(next<now-.1)next=now+.03;               // timer was starved (throttled tab): skip ahead, never burst
    for(let n=0;next<now+CONFIG.AHEAD&&n<16;n++){next+=PH[ph](step,next);step++}
  }catch(e){}
}
function startTimer(){if(!timer&&ctx&&!hidden())timer=setInterval(tick,CONFIG.TIMER_MS)}
function stopTimer(){if(timer){clearInterval(timer);timer=0}}
function ramp(p,v){try{p.cancelScheduledValues(ctx.currentTime);p.setTargetAtTime(v,ctx.currentTime,.03)}catch(e){}}
function resume(){try{if(ctx&&ctx.state==='suspended'){const p=ctx.resume();if(p&&p.catch)p.catch(()=>{})}}catch(e){}}

// ---------- sound effects ----------
const FX={
  pick:t=>osc(sfxBus,t,700,.05,'sine',.22,{to:1050}),
  place:t=>{osc(sfxBus,t,340,.07,'triangle',.3,{to:220});hit(sfxBus,t,.02,.1,'bandpass',2500)},
  lock:t=>{hit(sfxBus,t,.025,.15,'bandpass',3000);osc(sfxSoft,t,523,.05,'square',.14);osc(sfxSoft,t+.06,784,.1,'square',.14)},
  unlock:t=>{osc(sfxSoft,t,784,.05,'square',.12);osc(sfxSoft,t+.06,523,.1,'square',.12)},
  swap:t=>{sweep(sfxBus,t,.25,.25,500,4000);osc(sfxBus,t+.22,900,.05,'sine',.18,{to:1200});osc(sfxBus,t+.3,1000,.05,'sine',.18,{to:1350})},
  tick:t=>{osc(sfxBus,t,1500,.03,'sine',.2);osc(sfxBus,t,750,.04,'triangle',.1)},
  done:t=>{[523,659,784,1047].forEach((f,i)=>osc(sfxSoft,t+i*.055,f,.12,'square',.13));kick(sfxBus,t,.4)},
  flag:t=>{osc(sfxSoft,t,880,.05,'square',.15);osc(sfxSoft,t+.08,880,.05,'square',.15)},
  good:t=>[523,659,784].forEach((f,i)=>osc(sfxBus,t+i*.07,f,.18,'triangle',.3)),
  bad:t=>{osc(sfxSoft,t,220,.14,'square',.16,{to:205});osc(sfxSoft,t+.16,175,.24,'square',.16,{to:160})},
  win:t=>{[523,659,784].forEach((f,i)=>osc(sfxBus,t+i*.09,f,.16,'triangle',.3));[523,659,784,1047].forEach(f=>osc(sfxBus,t+.27,f,.8,'triangle',.12))},
  rotten:t=>[392,370,349,330].forEach((f,i)=>osc(sfxSoft,t+i*.28,f,i<3?.22:.7,'sawtooth',.16,{to:i<3?f*.97:f*.85,a:.03})), // sad trombone
  join:t=>{osc(sfxBus,t,660,.12,'sine',.22);osc(sfxBus,t+.09,990,.18,'sine',.2)}
};

// ---------- API ----------
const API={
  CONFIG,
  unlock(){
    try{
      if(!ctx){
        const AC=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);if(!AC)return false;
        ctx=new AC();
        const comp=ctx.createDynamicsCompressor();comp.threshold.value=-12;comp.ratio.value=4;comp.connect(ctx.destination);
        master=ctx.createGain();master.gain.value=CONFIG.MASTER;master.connect(comp);
        musBus=ctx.createGain();musBus.gain.value=musicOn&&!hidden()?CONFIG.MUSIC:0;musBus.connect(master);
        sfxBus=ctx.createGain();sfxBus.gain.value=CONFIG.SFX;sfxBus.connect(master);
        sfxSoft=ctx.createBiquadFilter();sfxSoft.type='lowpass';sfxSoft.frequency.value=2200;sfxSoft.connect(sfxBus);
        const len=ctx.sampleRate*3|0;noise=ctx.createBuffer(1,len,ctx.sampleRate);
        const d=noise.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
      }
      resume();startTimer();return true;
    }catch(e){ctx=null;return false}
  },
  ready:()=>ok(),
  setMusic(on){musicOn=!!on;if(!ctx)return;ramp(musBus.gain,musicOn&&!hidden()?CONFIG.MUSIC:0);if(!musicOn)dropSection();},
  setSfx(on){sfxOn=!!on},
  phase(name){
    if(!(name in PH)&&name!=='off')return;if(name===ph)return;
    ph=name;if(ctx)dropSection();
  },
  intensity(x){x=+x;inten=x>1?1:x>0?x:0},
  sfx(name){
    if(!sfxOn||!ctx||!FX[name])return;resume();if(!ok())return;
    try{const t=ctx.currentTime;if(t-(lastFx[name]??-1)<.03)return;lastFx[name]=t;FX[name](t+.005)}catch(e){}
  }
};
if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',()=>{
  if(!ctx)return;
  if(document.hidden){stopTimer();ramp(musBus.gain,0)}
  else{ramp(musBus.gain,musicOn?CONFIG.MUSIC:0);startTimer()}
});
if(typeof window!=='undefined')window.IonSound=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})();
