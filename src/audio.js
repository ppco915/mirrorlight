// audio.js — 6.10절 필수 6종 훅 + 시간층 앰비언스. 외부 자산 없이 WebAudio 합성.
// 첫 사용자 제스처에서 init()이 호출되어야 한다(브라우저 자동재생 정책).

let ctx = null;
let master = null;
let hum = null;               // boundary_hum 상시 오실레이터
const amb = { PAST: null, PRESENT: null };

function noiseBuffer(seconds = 2) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {          // 갈색 잡음(저역 성분 위주)
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

function makeAmbience(kind) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const filt = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  if (kind === 'PAST') {                 // 난롯불: 저역 럼블
    filt.type = 'lowpass'; filt.frequency.value = 220;
  } else {                               // 바람: 느리게 흔들리는 밴드패스
    filt.type = 'bandpass'; filt.frequency.value = 400; filt.Q.value = 1.5;
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.13; lfoG.gain.value = 180;
    lfo.connect(lfoG).connect(filt.frequency); lfo.start();
  }
  src.connect(filt).connect(gain).connect(master);
  src.start();
  return gain;
}

export function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'sine'; osc.frequency.value = 55;
  const g = ctx.createGain(); g.gain.value = 0;
  osc.connect(g).connect(master); osc.start();
  hum = { osc, g };

  amb.PAST = makeAmbience('PAST');
  amb.PRESENT = makeAmbience('PRESENT');
  setEra('PRESENT');
}

export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

// 앰비언스 크로스페이드 (빙의 전환 0.4초에 맞춤)
export function setEra(era) {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const k of ['PAST', 'PRESENT']) {
    amb[k].gain.cancelScheduledValues(t);
    amb[k].gain.setTargetAtTime(k === era ? 0.25 : 0, t, 0.15);
  }
}

// boundary_hum: 경계 접근도 0(멀다)~1(닿음)에 따라 저음 상승
export function setBoundaryHum(level) {
  if (!ctx) return;
  const t = ctx.currentTime;
  hum.g.gain.setTargetAtTime(0.12 * level, t, 0.08);
  hum.osc.frequency.setTargetAtTime(55 + 40 * level, t, 0.08);
}

function blip(freq0, freq1, dur, type = 'sine', vol = 0.3, when = 0) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(freq1, 1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noiseBurst(dur, freq, q, vol, when = 0) {
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(Math.min(dur + 0.1, 1));
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}

export function possessIn()  { if (ctx) { blip(300, 900, 0.45, 'sine', 0.25); noiseBurst(0.4, 1200, 2, 0.15); } }
export function possessOut() { if (ctx) { blip(900, 300, 0.45, 'sine', 0.25); noiseBurst(0.4, 800, 2, 0.12); } }
export function glassTap()   { if (ctx) { blip(1800, 1200, 0.07, 'triangle', 0.35); noiseBurst(0.05, 3000, 4, 0.2); } }
export function brickScrape(){ if (ctx) { noiseBurst(0.35, 500, 1.2, 0.35); noiseBurst(0.2, 900, 1.5, 0.2, 0.1); } }
export function doorUnlock() { if (ctx) { blip(500, 500, 0.1, 'square', 0.15); blip(750, 750, 0.12, 'square', 0.15, 0.15); noiseBurst(0.3, 250, 1, 0.3, 0.3); } }
export function crackle()    { if (ctx && Math.random() < 0.5) noiseBurst(0.04, 2200 + Math.random() * 1500, 3, 0.06); }
