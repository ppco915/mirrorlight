// audio.js — 6.10절 필수 6종 훅 + 시간층 앰비언스.
// 기본은 WebAudio 합성(무자산 폴백), 샘플이 로드되면 그쪽을 쓴다.
// 샘플 출처는 assets/audio/LICENSE.md (OpenGameArt, CC0 위주).
// 첫 사용자 제스처에서 init()이 호출되어야 한다(브라우저 자동재생 정책).

let ctx = null;
let master = null;
let hum = null;               // boundary_hum 상시 오실레이터
const amb = { PAST: null, PRESENT: null };

// ── 샘플 레이어 ──────────────────────────────────────────────
// PAST: 횃불 불꽃 루프 / PRESENT: 던전 저음 앰비언스 / door: 돌문 /
// whoosh+shimmer: 거울 이동. 로드 실패 시 합성음이 그대로 남는다.
const SAMPLE_URL = {
  ambPAST: 'assets/audio/fire_loop.wav',
  ambPRESENT: 'assets/audio/dungeon_ambient.ogg',
  door: 'assets/audio/stone_door.ogg',
  shimmer: 'assets/audio/shimmer.flac',
  pickup1: 'assets/audio/pickup_00.wav',
  pickup2: 'assets/audio/pickup_01.wav',
  pickup3: 'assets/audio/pickup_02.wav',
  stones1: 'assets/audio/sfx100v2_stones_01.ogg',
  stones2: 'assets/audio/sfx100v2_stones_02.ogg',
  stones3: 'assets/audio/sfx100v2_stones_03.ogg',
  // 돌바닥 발소리 — 좌우 3종씩 번갈아 (Fantozzi, CC0)
  stepL1: 'assets/audio/steps/Fantozzi-StoneL1.ogg',
  stepL2: 'assets/audio/steps/Fantozzi-StoneL2.ogg',
  stepL3: 'assets/audio/steps/Fantozzi-StoneL3.ogg',
  stepR1: 'assets/audio/steps/Fantozzi-StoneR1.ogg',
  stepR2: 'assets/audio/steps/Fantozzi-StoneR2.ogg',
  stepR3: 'assets/audio/steps/Fantozzi-StoneR3.ogg',
};
const bufs = {};

async function loadSamples() {
  await Promise.all(Object.entries(SAMPLE_URL).map(async ([key, url]) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      bufs[key] = await ctx.decodeAudioData(await res.arrayBuffer());
    } catch { /* 폴백 유지 */ }
  }));
  // 앰비언스를 샘플 루프로 교체 — 같은 게인 노드를 쓰므로 크로스페이드는 그대로
  for (const kind of ['PAST', 'PRESENT']) {
    const buf = bufs['amb' + kind];
    if (!buf || !amb[kind]) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(amb[kind].gain);
    src.start();
    amb[kind].synthSrc?.stop();
  }
}

function playBuf(key, { vol = 0.5, rate = 1, when = 0 } = {}) {
  const buf = bufs[key];
  if (!buf) return false;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start(t);
  return true;
}

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
  return { gain, synthSrc: src };
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
  loadSamples();   // 비동기 — 도착하는 대로 합성음을 샘플로 교체
}

export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

// 앰비언스 크로스페이드 (이동 전환 0.4초에 맞춤)
export function setEra(era) {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const k of ['PAST', 'PRESENT']) {
    const p = amb[k].gain.gain;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(k === era ? 0.25 : 0, t, 0.15);
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

// 이동음은 반짝임(shimmer)만 — 휘익은 바닥 쓰는 소리처럼 들려서 뺐다.
export function possessIn() {
  if (!ctx) return;
  if (!playBuf('shimmer', { vol: 0.5 })) { blip(300, 900, 0.45, 'sine', 0.25); noiseBurst(0.4, 1200, 2, 0.15); }
}
export function possessOut() {
  if (!ctx) return;
  if (!playBuf('shimmer', { vol: 0.4, rate: 0.8 })) { blip(900, 300, 0.45, 'sine', 0.25); noiseBurst(0.4, 800, 2, 0.12); }
}
export function glassTap()   { if (ctx) { blip(1800, 1200, 0.07, 'triangle', 0.35); noiseBurst(0.05, 3000, 4, 0.2); } }
// 아이템 획득 — Fantasy Sound Library의 Pickup_Gold 차임 3종 무작위
export function pickup() {
  if (!ctx) return;
  if (!playBuf('pickup' + (1 + Math.floor(Math.random() * 3)), { vol: 0.4 })) {
    blip(880, 1320, 0.12, 'triangle', 0.2);   // 폴백: 밝은 띵
  }
}

// 벽돌 뽑기·끼우기 — 실제 돌 부딪는 샘플 3종 무작위 + 낮은 마찰 노이즈 한 겹
export function brickScrape() {
  if (!ctx) return;
  const ok = playBuf('stones' + (1 + Math.floor(Math.random() * 3)),
    { vol: 0.55, rate: 0.82 + Math.random() * 0.14 });
  noiseBurst(0.3, 420, 1.2, ok ? 0.14 : 0.35);   // 긁히는 결 — 샘플 위에 얇게
  if (!ok) noiseBurst(0.2, 900, 1.5, 0.2, 0.1);
}
export function doorUnlock() {
  if (!ctx) return;
  if (!playBuf('door', { vol: 0.8 })) {
    blip(500, 500, 0.1, 'square', 0.15); blip(750, 750, 0.12, 'square', 0.15, 0.15);
    noiseBurst(0.3, 250, 1, 0.3, 0.3);
  }
}
// 발소리 — 좌우를 번갈아, 3종 중 무작위. 배속을 낮춰 깊게 만들고
// 걸음마다 저역 쿵을 한 겹 얹어 「저벅저벅」의 무게를 만든다.
let stepSide = false;
export function footstep() {
  if (!ctx) return;
  stepSide = !stepSide;
  const key = 'step' + (stepSide ? 'L' : 'R') + (1 + Math.floor(Math.random() * 3));
  // 「둠」 — 저역 쿵이 주역, 돌 샘플은 마찰 질감만 살짝
  blip(74 + Math.random() * 10, 40, 0.16, 'sine', 0.55);
  const heel = playBuf(key, { vol: 0.16, rate: 0.62 + Math.random() * 0.06 });
  if (!heel) noiseBurst(0.06, 300 + Math.random() * 150, 1.5, 0.12);
}

// 횃불 샘플 루프가 돌고 있으면 합성 크래클은 얹지 않는다 (이중 소리 방지)
export function crackle()    { if (ctx && !bufs.ambPAST && Math.random() < 0.5) noiseBurst(0.04, 2200 + Math.random() * 1500, 3, 0.06); }
