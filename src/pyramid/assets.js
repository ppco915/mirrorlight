// pyramid/assets.js — 실사 재질 팩토리.
//
// 두 층으로 이루어진다.
//  1) Poly Haven CC0 PBR 텍스처(assets/textures/, diff·nor_gl·arm 3장 1세트).
//     arm은 AO(R)·Roughness(G)·Metalness(B) 팩 텍스처 — three r160은 세 슬롯에
//     같은 텍스처를 꽂으면 채널별로 알아서 읽는다.
//  2) 절차 캔버스 합성(상형문자 음각 띠, 별 천장, 날개 태양, 불꽃, 먼지…).
//     음각의 입체감은 높이맵에 소벨 필터를 돌려 노멀맵으로 굽는다.
//
// Node(스모크·검증)에는 DOM이 없으므로 모든 로드·캔버스 경로가 꺼지고
// 단색 MeshStandardMaterial로 대체된다 — 씬 그래프 계약은 브라우저와 동일.

import * as THREE from 'three';

export const inBrowser = typeof document !== 'undefined';
const loader = inBrowser ? new THREE.TextureLoader() : null;
const BASE = './assets/textures';

// ── PBR 세트 로드 ──────────────────────────────────────────────
const texCache = new Map();
function loadTex(url, srgb) {
  const k = url + (srgb ? '#s' : '');
  if (!texCache.has(k)) {
    const t = loader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texCache.set(k, t);
  }
  return texCache.get(k);
}
function rep(t, rx, ry, rot = 0) {
  const c = t.clone();
  c.repeat.set(rx, ry);
  if (rot) { c.center.set(0.5, 0.5); c.rotation = rot; }
  c.needsUpdate = true;
  return c;
}

// set: assets/textures/<set>/ 아래 diff·nor_gl·arm.
// opts: repeat [rx,ry], color(시대 색조 곱), rough(러프니스맵 곱), env, side, normalScale
export function pbr(set, {
  repeat = [1, 1], color = 0xffffff, side = THREE.FrontSide,
  rough = 1.0, metal = 0.0, env = 0.35, normalScale = 1.0, rotate = 0,
} = {}) {
  if (!inBrowser) return new THREE.MeshStandardMaterial({ color, side });
  const [rx, ry] = repeat;
  const arm = rep(loadTex(`${BASE}/${set}/arm.jpg`, false), rx, ry, rotate);
  const m = new THREE.MeshStandardMaterial({
    color, side,
    map: rep(loadTex(`${BASE}/${set}/diff.jpg`, true), rx, ry, rotate),
    normalMap: rep(loadTex(`${BASE}/${set}/nor_gl.jpg`, false), rx, ry, rotate),
    aoMap: arm, roughnessMap: arm, metalnessMap: arm,
    roughness: rough, metalness: metal, envMapIntensity: env,
  });
  m.normalScale.set(normalScale, normalScale);
  return m;
}

// ── 공용 소품 재질 ─────────────────────────────────────────────
export const plain = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
export const gold = (extra = {}) => new THREE.MeshStandardMaterial({
  color: 0xc79a34, metalness: 1.0, roughness: 0.38, envMapIntensity: 0.55, ...extra,
});
export const bronze = (extra = {}) => new THREE.MeshStandardMaterial({
  color: 0x5c4322, metalness: 0.9, roughness: 0.58, envMapIntensity: 0.35, ...extra,
});
export const lapis = (extra = {}) => new THREE.MeshStandardMaterial({
  color: 0x1d3d8f, metalness: 0.1, roughness: 0.35, envMapIntensity: 0.4, ...extra,
});
export const ceramic = (color = 0x9a6b42, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.78, envMapIntensity: 0.12, ...extra,
});
export const wood = (color = 0x4a331e, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.85, envMapIntensity: 0.15, ...extra,
});

// ── 캔버스 유틸 ────────────────────────────────────────────────
function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(c, { srgb = true, repeatX = 1, repeatY = 1 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// 높이 캔버스(밝음=돌출) → 노멀맵. 소벨 3×3, 가장자리는 랩 어라운드(타일 안전).
function normalFromHeight(hc, strength = 2.2) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  const [nc, ctx] = cv(w, h);
  const out = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)
        - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * strength;
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)
        - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      out.data[i + 1] = (dy * inv * 0.5 + 0.5) * 255;   // GL 방향(+Y 위)
      out.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return nc;
}

// 결정론 난수 — 새로고침해도 같은 벽화가 나온다.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ── 상형문자 ───────────────────────────────────────────────────
// 각 글리프는 [-1,1]² 좌표계에 스트로크를 그린다. 음각 = 높이맵에 어두운 스트로크.
const GLYPHS = [
  (c) => { // 앙크
    c.beginPath(); c.arc(0, -0.45, 0.33, 0, 6.283); c.moveTo(0, -0.12); c.lineTo(0, 0.9);
    c.moveTo(-0.5, 0.18); c.lineTo(0.5, 0.18); c.stroke();
  },
  (c) => { // 호루스의 눈
    c.beginPath(); c.moveTo(-0.8, 0); c.quadraticCurveTo(0, -0.75, 0.8, 0);
    c.quadraticCurveTo(0, 0.5, -0.8, 0); c.stroke();
    c.beginPath(); c.arc(0, -0.08, 0.2, 0, 6.283); c.stroke();
    c.beginPath(); c.moveTo(-0.35, 0.28); c.lineTo(-0.45, 0.85);
    c.moveTo(0.3, 0.3); c.quadraticCurveTo(0.55, 0.75, 0.2, 0.85); c.stroke();
  },
  (c) => { // 따오기(새)
    c.beginPath(); c.ellipse(0.08, 0.25, 0.5, 0.32, 0, 0, 6.283); c.stroke();
    c.beginPath(); c.moveTo(-0.35, 0.05); c.quadraticCurveTo(-0.62, -0.7, -0.25, -0.75);
    c.quadraticCurveTo(0.15, -0.72, 0.05, -0.5); c.stroke();
    c.beginPath(); c.moveTo(-0.05, 0.55); c.lineTo(-0.05, 0.95); c.moveTo(0.25, 0.55); c.lineTo(0.25, 0.95); c.stroke();
  },
  (c) => { // 뱀
    c.beginPath(); c.moveTo(-0.8, 0.6); c.quadraticCurveTo(-0.3, 0.0, 0.05, 0.45);
    c.quadraticCurveTo(0.4, 0.8, 0.65, 0.25); c.lineTo(0.65, -0.5); c.stroke();
    c.beginPath(); c.arc(0.65, -0.6, 0.14, 0, 6.283); c.stroke();
  },
  (c) => { // 태양 원반
    c.beginPath(); c.arc(0, 0, 0.55, 0, 6.283); c.stroke();
    c.beginPath(); c.arc(0, 0, 0.1, 0, 6.283); c.stroke();
  },
  (c) => { // 물결
    for (const y of [-0.3, 0.25]) {
      c.beginPath(); c.moveTo(-0.8, y);
      for (let i = 0; i < 4; i++) c.lineTo(-0.8 + (i + 0.5) * 0.4, y - 0.25), c.lineTo(-0.8 + (i + 1) * 0.4, y);
      c.stroke();
    }
  },
  (c) => { // 갈대 잎
    c.beginPath(); c.moveTo(0, 0.9); c.lineTo(0, -0.35);
    c.quadraticCurveTo(-0.45, -0.75, 0, -0.9); c.quadraticCurveTo(0.45, -0.75, 0, -0.35); c.stroke();
  },
  (c) => { // 풍뎅이
    c.beginPath(); c.ellipse(0, 0.1, 0.42, 0.5, 0, 0, 6.283); c.stroke();
    c.beginPath(); c.arc(0, -0.55, 0.18, 0, 6.283); c.stroke();
    for (const [a, b] of [[-0.42, -0.2], [-0.48, 0.25], [0.42, -0.2], [0.48, 0.25]]) {
      c.beginPath(); c.moveTo(a * 0.9, b); c.lineTo(a * 1.6, b + 0.3); c.stroke();
    }
  },
  (c) => { // 마아트의 깃털
    c.beginPath(); c.moveTo(0, 0.9); c.quadraticCurveTo(-0.5, 0.1, -0.12, -0.75);
    c.quadraticCurveTo(0.2, -1.0, 0.25, -0.4); c.quadraticCurveTo(0.3, 0.4, 0, 0.9);
    c.moveTo(0.02, 0.6); c.lineTo(0.02, -0.6); c.stroke();
  },
  (c) => { // 제드 기둥
    c.beginPath(); c.moveTo(0, 0.9); c.lineTo(0, -0.9);
    for (const y of [-0.55, -0.25, 0.05]) { c.moveTo(-0.45, y); c.lineTo(0.45, y); }
    c.stroke();
  },
  (c) => { // 카(들어 올린 두 팔)
    c.beginPath(); c.moveTo(-0.6, 0.9); c.lineTo(-0.6, -0.5); c.quadraticCurveTo(-0.6, -0.75, -0.4, -0.75);
    c.moveTo(0.6, 0.9); c.lineTo(0.6, -0.5); c.quadraticCurveTo(0.6, -0.75, 0.4, -0.75);
    c.moveTo(-0.6, 0.55); c.lineTo(0.6, 0.55); c.stroke();
  },
  (c) => { // 바구니
    c.beginPath(); c.moveTo(-0.75, 0.1); c.quadraticCurveTo(0, 0.75, 0.75, 0.1);
    c.moveTo(-0.75, 0.1); c.lineTo(0.75, 0.1); c.stroke();
  },
];

const PAINTS = ['#a33b1f', '#1f4f8f', '#22683a', '#c1912f', '#7a3a7a'];

// 문제 3(벽화·다이얼)이 같은 음각 표현을 쓰도록 캔버스 유틸을 공개한다.
// mural.js가 높이맵→노멀맵 굽기와 안료 팔레트를 다시 구현하지 않게 하는 것이 목적.
export const carveCanvas = cv;                 // (w, h) → [canvas, ctx]
export const carveTexture = toTex;             // (canvas, {srgb}) → CanvasTexture
export const carveNormal = normalFromHeight;   // (높이 캔버스, 세기) → 노멀 캔버스
export const CARVE_PAINTS = PAINTS;

// 문제 3(벽화 코드)용 최소 공개 API — 글리프 스트로크를 외부 캔버스에 그린다.
export function strokeGlyph(ctx, index) { GLYPHS[index % GLYPHS.length](ctx); }
export const GLYPH_COUNT = GLYPHS.length;
export const GLYPH_NAMES = Object.freeze([
  '앙크', '호루스의 눈', '따오기', '뱀', '태양 원반', '물결',
  '갈대 잎', '풍뎅이', '마아트의 깃털', '제드 기둥', '카', '바구니',
]);

// 상형문자 음각 띠. painted: 안료가 남은 시대(과거)면 참.
// 반환 {map, normalMap} — 1024×128, 가로 타일 안전.
export function glyphBandMaps({ seed = 7, painted = false, tone = '#c9ae7d', rows = 1 } = {}) {
  if (!inBrowser) return null;
  const W = 1024, H = 128 * rows, cell = 128;
  const rand = rng(seed);
  // 높이맵: 밝은 바탕 + 어두운 음각 스트로크 + 레지스터 줄
  const [hc, hx] = cv(W, H);
  hx.fillStyle = '#c8c8c8'; hx.fillRect(0, 0, W, H);
  const carve = (draw, cx, cy, s) => {
    hx.save(); hx.translate(cx, cy); hx.scale(s, s);
    hx.strokeStyle = '#404040'; hx.lineWidth = 0.13; hx.lineCap = 'round'; hx.lineJoin = 'round';
    draw(hx); hx.restore();
  };
  const picks = [];
  for (let r = 0; r < rows; r++) {
    hx.fillStyle = '#8a8a8a';
    hx.fillRect(0, r * cell + 2, W, 3); hx.fillRect(0, (r + 1) * cell - 5, W, 3);
    for (let i = 0; i < W / cell; i++) {
      const g = GLYPHS[(rand() * GLYPHS.length) | 0];
      picks.push(g);
      carve(g, i * cell + cell / 2, r * cell + cell / 2, cell * 0.34);
    }
  }
  // 컬러맵: 사암 바탕 × 음각 그늘(+안료)
  const [cc, cx2] = cv(W, H);
  cx2.fillStyle = tone; cx2.fillRect(0, 0, W, H);
  // 바탕 얼룩
  for (let i = 0; i < 340; i++) {
    cx2.fillStyle = `rgba(${80 + rand() * 60 | 0},${60 + rand() * 50 | 0},${35 + rand() * 40 | 0},${0.05 + rand() * 0.06})`;
    cx2.beginPath(); cx2.arc(rand() * W, rand() * H, 3 + rand() * 22, 0, 6.283); cx2.fill();
  }
  let pi = 0;
  const paintRand = rng(seed * 31 + 5);
  for (let r = 0; r < rows; r++) {
    cx2.fillStyle = 'rgba(60,44,26,0.5)';
    cx2.fillRect(0, r * cell + 2, W, 3); cx2.fillRect(0, (r + 1) * cell - 5, W, 3);
    for (let i = 0; i < W / cell; i++) {
      const g = picks[r * (W / cell) + i];
      cx2.save(); cx2.translate(i * cell + cell / 2, r * cell + cell / 2); cx2.scale(cell * 0.34, cell * 0.34);
      cx2.lineCap = 'round'; cx2.lineJoin = 'round';
      if (painted) {
        cx2.strokeStyle = PAINTS[(pi + (paintRand() * 2 | 0)) % PAINTS.length];
        cx2.globalAlpha = 0.85; cx2.lineWidth = 0.15; g(cx2);
      }
      cx2.globalAlpha = painted ? 0.5 : 0.62;
      cx2.strokeStyle = '#3a2c1a'; cx2.lineWidth = painted ? 0.08 : 0.13; g(cx2);
      cx2.restore(); cx2.globalAlpha = 1;
      pi++;
    }
  }
  return { map: toTex(cc), normalMap: toTex(normalFromHeight(hc, 2.6), { srgb: false }) };
}

// 석비 앞면(둥근 이마 + 날개 태양 + 세로 문단). 반환 {map, normalMap}.
export function steleFaceMaps({ seed = 21, painted = true } = {}) {
  if (!inBrowser) return null;
  const W = 512, H = 640;
  const rand = rng(seed);
  const [hc, hx] = cv(W, H);
  hx.fillStyle = '#c4c4c4'; hx.fillRect(0, 0, W, H);
  const [cc, ctx] = cv(W, H);
  ctx.fillStyle = '#c2a271'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = `rgba(90,66,40,${0.04 + rand() * 0.05})`;
    ctx.beginPath(); ctx.arc(rand() * W, rand() * H, 3 + rand() * 18, 0, 6.283); ctx.fill();
  }
  const both = (fn) => { fn(hx, true); fn(ctx, false); };
  // 이마의 태양 원반 + 좌우로 뻗는 날개
  both((c, isH) => {
    c.strokeStyle = isH ? '#484848' : 'rgba(58,44,26,0.6)'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.arc(W / 2, 86, 34, 0, 6.283); c.stroke();
    if (!isH && painted) { c.fillStyle = 'rgba(178,74,32,0.8)'; c.beginPath(); c.arc(W / 2, 86, 30, 0, 6.283); c.fill(); }
    for (const s of [-1, 1]) {
      for (let f = 0; f < 3; f++) {
        c.beginPath();
        c.moveTo(W / 2 + s * 30, 82 + f * 9);
        c.quadraticCurveTo(W / 2 + s * (120 + f * 26), 48 + f * 18, W / 2 + s * (206 + f * 10), 96 + f * 14);
        c.stroke();
      }
    }
    // 문단 구분 세로줄
    c.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      c.beginPath(); c.moveTo(46 + i * 105, 168); c.lineTo(46 + i * 105, H - 40); c.stroke();
    }
  });
  // 세로 열마다 글리프
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 5; row++) {
      const g = GLYPHS[(rand() * GLYPHS.length) | 0];
      const cxp = 98 + col * 105, cyp = 216 + row * 88;
      hx.save(); hx.translate(cxp, cyp); hx.scale(30, 30);
      hx.strokeStyle = '#404040'; hx.lineWidth = 0.15; hx.lineCap = 'round'; hx.lineJoin = 'round';
      g(hx); hx.restore();
      ctx.save(); ctx.translate(cxp, cyp); ctx.scale(30, 30);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (painted) { ctx.strokeStyle = PAINTS[(rand() * PAINTS.length) | 0]; ctx.globalAlpha = 0.8; ctx.lineWidth = 0.17; g(ctx); }
      ctx.strokeStyle = '#3a2c1a'; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.1; g(ctx);
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  const map = toTex(cc), normalMap = toTex(normalFromHeight(hc, 2.4), { srgb: false });
  map.wrapS = map.wrapT = normalMap.wrapS = normalMap.wrapT = THREE.ClampToEdgeWrapping;
  return { map, normalMap };
}

// 별 천장 — 짙은 청금석 바탕에 금색 오각성(이집트 무덤 천장 양식).
export function starCeilingMap({ faded = 0 } = {}) {
  if (!inBrowser) return null;
  const S = 512;
  const [c, ctx] = cv(S, S);
  const mix = (a, b) => Math.round(a + (b - a) * faded);
  ctx.fillStyle = `rgb(${mix(22, 52)},${mix(34, 48)},${mix(84, 46)})`;
  ctx.fillRect(0, 0, S, S);
  const rand = rng(777);
  for (let i = 0; i < 200; i++) {   // 세월의 얼룩
    ctx.fillStyle = `rgba(10,12,20,${0.05 + rand() * 0.08 * (0.4 + faded)})`;
    ctx.beginPath(); ctx.arc(rand() * S, rand() * S, 4 + rand() * 30, 0, 6.283); ctx.fill();
  }
  const star = (x, y, r) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * 1.2566;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a + 0.628) * r * 0.42, y + Math.sin(a + 0.628) * r * 0.42);
    }
    ctx.closePath(); ctx.fill();
  };
  const g = mix(196, 120), gb = mix(74, 60);
  const N = 6, step = S / N;
  for (let ix = 0; ix < N; ix++) {
    for (let iy = 0; iy < N; iy++) {
      if (faded > 0 && rand() < faded * 0.55) continue;   // 떨어져 나간 별
      ctx.fillStyle = `rgba(${g},${mix(150, 100)},${gb},${0.95 - faded * 0.45})`;
      star((ix + 0.5 + (iy % 2 ? 0.5 : 0)) % N * step, (iy + 0.5) * step, 13);
    }
  }
  return toTex(c);
}

// 날개 태양(문 위 수호 문장) — 투명 배경의 안료화.
export function wingedSunMap({ faded = 0 } = {}) {
  if (!inBrowser) return null;
  const W = 1024, H = 256;
  const [c, ctx] = cv(W, H);
  const a = 1 - faded * 0.75;
  // 날개: 세 층의 깃 아치
  for (let layer = 0; layer < 3; layer++) {
    const ly = 108 + layer * 26, span = 470 - layer * 40;
    for (const s of [-1, 1]) {
      for (let f = 0; f < 12; f++) {
        const t = f / 11;
        ctx.strokeStyle = `rgba(${f % 2 ? 168 : 122},${f % 2 ? 118 : 78},${f % 2 ? 44 : 120},${a * 0.85})`;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(W / 2 + s * 46, ly - 18);
        ctx.quadraticCurveTo(W / 2 + s * span * (0.35 + t * 0.3), ly - 66 + t * 20, W / 2 + s * span * (0.5 + t * 0.5), ly + 8 + t * 14);
        ctx.stroke();
      }
    }
  }
  // 원반 + 우라에우스(양쪽 코브라)
  const grad = ctx.createRadialGradient(W / 2, 96, 6, W / 2, 96, 46);
  grad.addColorStop(0, `rgba(226,168,60,${a})`); grad.addColorStop(1, `rgba(164,74,30,${a})`);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(W / 2, 96, 44, 0, 6.283); ctx.fill();
  ctx.strokeStyle = `rgba(70,44,18,${a})`; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(W / 2, 96, 44, 0, 6.283); ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + s * 40, 118);
    ctx.quadraticCurveTo(W / 2 + s * 78, 132, W / 2 + s * 66, 158);
    ctx.quadraticCurveTo(W / 2 + s * 56, 176, W / 2 + s * 72, 180);
    ctx.stroke();
  }
  return toTex(c, { srgb: true });
}

// 불꽃 스프라이트(가법 블렌딩용 방사 그라디언트).
export function flameMap() {
  if (!inBrowser) return null;
  const S = 128;
  const [c, ctx] = cv(S, S);
  const g = ctx.createRadialGradient(S / 2, S * 0.62, 2, S / 2, S * 0.55, S * 0.5);
  g.addColorStop(0, 'rgba(255,244,205,1)');
  g.addColorStop(0.25, 'rgba(255,196,92,0.9)');
  g.addColorStop(0.55, 'rgba(226,110,28,0.45)');
  g.addColorStop(1, 'rgba(120,40,8,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return toTex(c);
}

// 천장 파공으로 쏟아지는 빛기둥(세로 그라디언트, 가법 블렌딩용).
export function beamMap() {
  if (!inBrowser) return null;
  const W = 64, H = 256;
  const [c, ctx] = cv(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const t = toTex(c, { srgb: false });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 먼지 입자.
export function dustMap() {
  if (!inBrowser) return null;
  const S = 32;
  const [c, ctx] = cv(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,240,210,0.9)'); g.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return toTex(c);
}

// 모래 언덕 가장자리 알파(부드럽게 사라지는 원형).
export function sandPatchAlpha() {
  if (!inBrowser) return null;
  const S = 256;
  const [c, ctx] = cv(S, S);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  const rand = rng(4242);
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.48);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#000');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.48, 0, 6.283); ctx.fill();
  // 가장자리를 불규칙하게 갉는다
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) {
    const a = rand() * 6.283, r = S * (0.4 + rand() * 0.12);
    ctx.beginPath(); ctx.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 8 + rand() * 22, 0, 6.283); ctx.fill();
  }
  const t = toTex(c, { srgb: false });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 리넨(덮개 천) 직조 무늬.
export function linenMap() {
  if (!inBrowser) return null;
  const S = 256;
  const [c, ctx] = cv(S, S);
  ctx.fillStyle = '#9c9078'; ctx.fillRect(0, 0, S, S);
  const rand = rng(999);
  for (let y = 0; y < S; y += 3) {
    ctx.fillStyle = `rgba(70,60,42,${0.05 + rand() * 0.07})`;
    ctx.fillRect(0, y, S, 1);
  }
  for (let x = 0; x < S; x += 3) {
    ctx.fillStyle = `rgba(70,60,42,${0.04 + rand() * 0.06})`;
    ctx.fillRect(x, 0, 1, S);
  }
  for (let i = 0; i < 30; i++) {   // 세월의 얼룩
    ctx.fillStyle = `rgba(96,78,52,${0.05 + rand() * 0.07})`;
    ctx.beginPath(); ctx.arc(rand() * S, rand() * S, 6 + rand() * 26, 0, 6.283); ctx.fill();
  }
  return toTex(c, { repeatX: 2, repeatY: 2 });
}
