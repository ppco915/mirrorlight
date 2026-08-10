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
  jingleWin: 'assets/audio/jingle_win.wav',
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
// 거울 회전 — 무거운 청동이 돌받침 위에서 갈리는 소리.
// 휠 틱마다 불리므로 0.11초 스로틀로 연속 회전 시 그르릉— 이 이어진다.
let grindLast = 0;
export function mirrorGrind() {
  if (!ctx || ctx.currentTime - grindLast < 0.13) return;
  grindLast = ctx.currentTime;
  // 훨씬 낮게 — 샘플을 1/4 배속으로 끌어내려 몇 톤짜리 석재가 갈리는 저역만 남긴다
  playBuf('stones' + (1 + Math.floor(Math.random() * 3)), { vol: 0.34, rate: 0.24 + Math.random() * 0.05 });
  noiseBurst(0.24, 110, 0.9, 0.2);
  blip(46 + Math.random() * 8, 34, 0.2, 'sine', 0.16);   // 바닥을 타고 오는 진동
}

// 회반죽 뜯기 — 마른 석회가 부스러지며 떨어지는 소리 (돌 부딪힘과 구분)
export function plasterCrack() {
  if (!ctx) return;
  noiseBurst(0.09, 1500, 0.8, 0.3);
  noiseBurst(0.12, 800, 0.9, 0.28, 0.07);
  noiseBurst(0.2, 420, 1.0, 0.26, 0.16);
  playBuf('stones' + (1 + Math.floor(Math.random() * 3)), { vol: 0.3, rate: 1.35, when: 0.22 });
  blip(120, 60, 0.1, 'sine', 0.2, 0.24);   // 뜯긴 조각이 바닥에 떨어진다
}

// 아이템 획득 — Fantasy Sound Library의 Pickup_Gold 차임 3종 무작위
export function pickup() {
  if (!ctx) return;
  if (!playBuf('pickup' + (1 + Math.floor(Math.random() * 3)), { vol: 0.4 })) {
    blip(880, 1320, 0.12, 'triangle', 0.2);   // 폴백: 밝은 띵
  }
}

// 탈출 시네마틱 — 전리품을 눈앞에 들어 올리는 순간의 징글
export function escapeJingle() {
  if (!ctx) return;
  if (!playBuf('jingleWin', { vol: 0.5 })) {
    blip(660, 990, 0.18, 'triangle', 0.25);
    blip(880, 1320, 0.22, 'triangle', 0.25, 0.18);
  }
}

// 내려놓기 — 획득 차임을 낮게 뒤집은 소리 + 바닥에 닿는 낮은 톡
export function putdown() {
  if (!ctx) return;
  playBuf('pickup' + (1 + Math.floor(Math.random() * 3)), { vol: 0.22, rate: 0.58 });
  blip(160, 90, 0.07, 'sine', 0.18);
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
export function introAudioSequence() {
  if (!ctx) return;
  // 0~3s: Footsteps
  for (let i = 0; i < 6; i++) {
    setTimeout(footstep, i * 500);
  }
  // 3s: Rumble starts (Earthquake warning)
  // 주의: 긴 사인/삼각파 blip은 "띵-" 하는 기계 톤으로 들린다 — 럼블은
  // 노이즈와 돌 샘플로만 만든다.
  setTimeout(() => {
    noiseBurst(2.5, 250, 0.8, 0.6);
    noiseBurst(2.5, 120, 0.5, 0.8);
    playBuf('stones1', { vol: 0.6, rate: 0.7 });
    playBuf('stones2', { vol: 0.5, rate: 0.5, when: 0.9 });
  }, 3000);
  // 5s: Floor collapses (Start falling)
  setTimeout(() => {
    playBuf('stones3', { vol: 0.8, rate: 0.8 }); // Crack!
  }, 5000);
  // 5.5s: Impact! (Massive Cinematic Smash)
  setTimeout(() => {
    // 1. Sharp mid/high frequency crunch
    noiseBurst(0.8, 800, 1.5, 0.8); 
    playBuf('stones1', { vol: 0.9, rate: 0.7 });
    
    // 2. Heavy Boulder Smash (safe volume)
    playBuf('stones2', { vol: 1.0, rate: 0.35 }); 
    playBuf('stones3', { vol: 1.0, rate: 0.45 });
    
    // 3. Cinematic Boom — 긴 사인 스윕 대신 짧은 저역 펀치 (긴 톤은 띠용- 하고 운다)
    blip(85, 38, 0.18, 'sine', 0.85);
    noiseBurst(2.5, 180, 0.5, 1.0);
    
    // 4. Aftermath debris
    setTimeout(() => playBuf('stones1', { vol: 0.8, rate: 0.4 }), 250);
    setTimeout(() => playBuf('stones2', { vol: 0.8, rate: 0.5 }), 500);
    setTimeout(() => playBuf('stones3', { vol: 0.6, rate: 0.4 }), 900);
  }, 5500);
}
