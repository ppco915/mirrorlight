// pyramid/mural.js — 문제 3 「아누비스의 목걸이와 가짜 문」의 단일 진실 원천.
// 벽화의 글리프 밭, 목걸이 구슬이 앉는 세 칸, 그리고 가짜 문의 정답 코드는
// 전부 여기서 결정론적으로 파생된다 — 게임과 검증이 같은 답을 본다.
// 데이터는 순수(노드에서 검증 가능), 캔버스 합성은 브라우저에서만.

import * as THREE from 'three';
import {
  inBrowser, strokeGlyph, GLYPH_COUNT, GLYPH_NAMES,
  carveCanvas, carveTexture, carveNormal, CARVE_PAINTS,
} from './assets.js';

export { GLYPH_NAMES };

const SEED = 20260809;
export const ROWS = 3, COLS = 6;
// 목걸이 홈의 호를 따라 구슬 세 개가 앉는 칸 [행, 열] — 가운데가 한 칸 처진 발자국 모양
export const BEAD_CELLS = [[0, 2], [1, 3], [0, 4]];
// 글리프 밭이 차지하는 벽화의 UV 영역 (왼쪽 1/3은 아누비스 상)
export const GRID_UV = { x0: 0.36, x1: 0.97, y0: 0.10, y1: 0.90 };

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function muralData() {
  const rand = rng(SEED);
  const field = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) row.push(Math.floor(rand() * GLYPH_COUNT));
    field.push(row);
  }
  // 코드 세 글자는 서로 달라야 다이얼이 모호하지 않다 — 중복이면 다음 글리프로 회전
  const used = new Set();
  for (const [r, c] of BEAD_CELLS) {
    let g = field[r][c];
    while (used.has(g)) g = (g + 1) % GLYPH_COUNT;
    field[r][c] = g;
    used.add(g);
  }
  const code = BEAD_CELLS.map(([r, c]) => field[r][c]);
  return { rows: ROWS, cols: COLS, field, beadCells: BEAD_CELLS, code };
}

// 칸 중심의 UV 좌표 (벽화 평면 로컬 배치용)
export function cellCenterUV(r, c) {
  const u = GRID_UV.x0 + ((c + 0.5) / COLS) * (GRID_UV.x1 - GRID_UV.x0);
  const v = GRID_UV.y0 + ((r + 0.5) / ROWS) * (GRID_UV.y1 - GRID_UV.y0);
  return { u, v };
}

// 목걸이 홈 곡선 — 세 구슬 자리를 t = 0, 0.5, 1에서 정확히 지나는 2차 베지에.
// 제어점은 보간 조건 c = (4·M − A − B) / 2 에서 유도한다 (M = 가운데 자리).
// 베지에는 아핀 변환에 불변이므로, 같은 세 점을 캔버스(px)로 사상해 그린 홈과
// 벽면(로컬 미터)으로 사상해 세운 금띠·손에 든 장식이 전부 같은 자취를 그린다.
export function collarCurveUV() {
  const [A, M, B] = BEAD_CELLS.map(([r, c]) => cellCenterUV(r, c));
  return {
    a: A,
    c: { u: (4 * M.u - A.u - B.u) / 2, v: (4 * M.v - A.v - B.v) / 2 },
    b: B,
  };
}

// ── 캔버스 합성 (브라우저 전용) ────────────────────────────────
// 벽화는 다른 벽면과 같은 음각 규약을 따른다. 높이 캔버스(밝음=돌출, 어두움=파임)를
// 소벨로 노멀맵으로 굽고, 색 캔버스에는 안료와 그늘을 따로 칠한다.
// painted=참이면 안료가 살아 있는 시대(P2), 거짓이면 씻겨 나간 현재.
const W = 1024, H = 720;

// 자칼 윤곽 — 색과 높이 두 캔버스에 같은 경로를 그린다.
function anubisPath(c) {
  c.beginPath();
  c.moveTo(-120, 150);                       // 앞다리 아래
  c.lineTo(-120, 10);                        // 가슴
  c.quadraticCurveTo(-118, -60, -70, -78);   // 목
  c.lineTo(-96, -128);                       // 귀 앞선
  c.lineTo(-76, -196); c.lineTo(-52, -128);  // 귀 1
  c.lineTo(-40, -128);
  c.lineTo(-24, -200); c.lineTo(-6, -126);   // 귀 2
  c.quadraticCurveTo(30, -112, 96, -92);     // 이마→주둥이
  c.lineTo(128, -84);                        // 코끝
  c.quadraticCurveTo(120, -66, 60, -62);     // 턱
  c.quadraticCurveTo(-8, -50, -16, 0);       // 목덜미 아래
  c.quadraticCurveTo(60, 30, 120, 40);       // 등
  c.quadraticCurveTo(160, 120, 120, 150);    // 뒷다리
  c.closePath();
}

// 자칼 내부의 세부 — 귀 안쪽, 눈, 목걸이 두 줄, 다리 경계
function anubisDetail(c) {
  c.beginPath();
  c.moveTo(-72, -180); c.lineTo(-60, -136);
  c.moveTo(-26, -184); c.lineTo(-14, -134);
  c.stroke();
  c.beginPath(); c.ellipse(48, -96, 13, 8, -0.15, 0, 6.283); c.stroke();
  c.beginPath();
  c.moveTo(-66, -68); c.quadraticCurveTo(-32, -34, -12, -8);
  c.moveTo(-92, -44); c.quadraticCurveTo(-46, -12, -22, 14);
  c.stroke();
  c.beginPath(); c.moveTo(-64, 150); c.lineTo(-64, 8); c.stroke();
  c.beginPath(); c.moveTo(112, 44); c.quadraticCurveTo(150, 92, 126, 148); c.stroke();
}

const CACHE = new Map();

export function muralMaps({ painted = false } = {}) {
  if (!inBrowser) return null;
  const key = painted ? 'painted' : 'faded';
  if (CACHE.has(key)) return CACHE.get(key);

  const [hc, hx] = carveCanvas(W, H);        // 높이
  const [cc, cx] = carveCanvas(W, H);        // 색
  const rand = rng(SEED + 1);
  hx.fillStyle = '#c6c6c6'; hx.fillRect(0, 0, W, H);
  cx.fillStyle = painted ? '#c2a878' : '#b09a74'; cx.fillRect(0, 0, W, H);

  // 돌결과 풍화 — 경계가 없는 방사 그라디언트로 찍는다. 원을 단색으로 채우면
  // 소벨이 원 둘레를 또렷한 테두리로 구워 벽 전체가 물방울무늬가 된다(발견된 결함).
  // 난수 호출 순서는 그대로 두어 얼룩의 자리와 결정론을 보존한다.
  for (let i = 0; i < 520; i++) {
    const x = rand() * W, y = rand() * H, r = 3 + rand() * 26;
    const v = rand() < 0.5 ? 150 : 206;
    const hg = hx.createRadialGradient(x, y, 0, x, y, r);
    hg.addColorStop(0, `rgba(${v},${v},${v},0.10)`);
    hg.addColorStop(1, `rgba(${v},${v},${v},0)`);
    hx.fillStyle = hg;
    hx.beginPath(); hx.arc(x, y, r, 0, 6.283); hx.fill();
    const cr = 70 + rand() * 60 | 0, cgn = 52 + rand() * 45 | 0, cb = 30 + rand() * 35 | 0;
    const ca = 0.05 + rand() * (painted ? 0.05 : 0.08);
    const cg = cx.createRadialGradient(x, y, 0, x, y, r);
    cg.addColorStop(0, `rgba(${cr},${cgn},${cb},${ca})`);
    cg.addColorStop(1, `rgba(${cr},${cgn},${cb},0)`);
    cx.fillStyle = cg;
    cx.beginPath(); cx.arc(x, y, r, 0, 6.283); cx.fill();
  }

  const both = (fn) => { fn(hx, true); fn(cx, false); };
  const carved = (c, isH, alpha) => {
    c.strokeStyle = isH ? '#454545' : `rgba(58,42,22,${alpha})`;
    c.lineCap = 'round'; c.lineJoin = 'round';
  };

  // 테두리 홈 + 아누비스 칸과 글리프 밭을 가르는 세로 홈 (GRID_UV에서 파생)
  both((c, isH) => {
    carved(c, isH, 0.5); c.lineWidth = 9;
    c.strokeRect(26, 26, W - 52, H - 52);
    const dx = GRID_UV.x0 * W - 26;
    c.beginPath(); c.moveTo(dx, 40); c.lineTo(dx, H - 40); c.stroke();
  });
  // 레지스터 줄 — 글리프 밭의 행 경계
  both((c, isH) => {
    carved(c, isH, 0.3); c.lineWidth = 5;
    for (let r = 0; r <= ROWS; r++) {
      const y = (GRID_UV.y0 + (r / ROWS) * (GRID_UV.y1 - GRID_UV.y0)) * H;
      c.beginPath(); c.moveTo(GRID_UV.x0 * W, y); c.lineTo(GRID_UV.x1 * W, y); c.stroke();
    }
  });

  // 아누비스: 검은 자칼. 얕게 파인 면 + 윤곽 음각 + 금빛 세부
  both((c, isH) => {
    c.save(); c.translate(W * 0.17, H * 0.56); c.scale(1.05, 1.05);
    anubisPath(c);
    c.fillStyle = isH ? '#b2b2b2' : (painted ? 'rgba(22,20,26,0.88)' : 'rgba(46,38,30,0.34)');
    c.fill();
    carved(c, isH, painted ? 0.85 : 0.5);
    if (!isH && painted) c.strokeStyle = 'rgba(12,10,14,0.9)';
    c.lineWidth = 9; anubisPath(c); c.stroke();
    if (!isH) c.strokeStyle = painted ? 'rgba(198,154,52,0.75)' : 'rgba(86,68,40,0.4)';
    c.lineWidth = 5; anubisDetail(c);
    c.restore();
  });

  // 목걸이 홈: 구슬 세 자리를 지나는 정준 곡선 — 장식이 이 홈에 정확히 앉는다
  const curve = collarCurveUV();
  both((c, isH) => {
    c.strokeStyle = isH ? '#3a3a3a' : 'rgba(38,26,12,0.5)';
    c.lineWidth = 15; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(curve.a.u * W, curve.a.v * H);
    c.quadraticCurveTo(curve.c.u * W, curve.c.v * H, curve.b.u * W, curve.b.v * H);
    c.stroke();
  });

  // 구슬이 앉는 세 자리 — 고리로만 판다. 안을 채우면 코드 글리프를 가린다.
  for (const [r, col] of BEAD_CELLS) {
    const { u, v } = cellCenterUV(r, col);
    const x = u * W, y = v * H;
    both((c, isH) => {
      c.beginPath(); c.arc(x, y, 36, 0, 6.283);
      c.fillStyle = isH ? 'rgba(150,150,150,0.55)' : 'rgba(40,28,12,0.16)';
      c.fill();
      c.strokeStyle = isH ? '#3e3e3e' : 'rgba(30,20,8,0.5)';
      c.lineWidth = 6; c.stroke();
    });
  }

  // 글리프 밭 — 안료를 먼저 칠하고 그 위에 음각 그늘 (다른 벽면과 같은 순서)
  const data = muralData();
  const paintRand = rng(SEED * 7 + 3);
  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      const { u, v } = cellCenterUV(r, col);
      const x = u * W, y = v * H, s = 38, g = data.field[r][col];
      hx.save(); hx.translate(x, y); hx.scale(s, s);
      hx.strokeStyle = '#404040'; hx.lineWidth = 6 / s;
      hx.lineCap = 'round'; hx.lineJoin = 'round';
      strokeGlyph(hx, g); hx.restore();
      cx.save(); cx.translate(x, y); cx.scale(s, s);
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      if (painted) {
        cx.strokeStyle = CARVE_PAINTS[(paintRand() * CARVE_PAINTS.length) | 0];
        cx.globalAlpha = 0.85; cx.lineWidth = 8 / s;
        strokeGlyph(cx, g);
      }
      cx.globalAlpha = painted ? 0.5 : 0.66;
      cx.strokeStyle = '#3a2c1a'; cx.lineWidth = (painted ? 5 : 7) / s;
      strokeGlyph(cx, g);
      cx.restore(); cx.globalAlpha = 1;
    }
  }

  // 노멀맵은 절반 해상도로 구워도 충분하다 — 소벨 비용을 4분의 1로 줄인다.
  const [sc, sx] = carveCanvas(W / 2, H / 2);
  sx.drawImage(hc, 0, 0, W / 2, H / 2);
  const map = carveTexture(cc);
  const normalMap = carveTexture(carveNormal(sc, 2.3), { srgb: false });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  normalMap.wrapS = normalMap.wrapT = THREE.ClampToEdgeWrapping;
  const out = { map, normalMap };
  CACHE.set(key, out);
  return out;
}

// 다이얼 면: 글리프 하나가 새겨진 타일 (12장 캐시)
let _tiles = null;
export function dialTiles() {
  if (!inBrowser) return null;
  if (_tiles) return _tiles;
  _tiles = [];
  const rand = rng(SEED + 77);
  for (let i = 0; i < GLYPH_COUNT; i++) {
    const [cnv, c] = carveCanvas(128, 128);
    c.fillStyle = '#8d7c5e'; c.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 60; k++) {                    // 돌 얼룩
      c.fillStyle = `rgba(${60 + rand() * 50 | 0},${46 + rand() * 40 | 0},${26 + rand() * 30 | 0},${0.05 + rand() * 0.07})`;
      c.beginPath(); c.arc(rand() * 128, rand() * 128, 2 + rand() * 9, 0, 6.283); c.fill();
    }
    // 타일 모따기 — 좌상은 빛, 우하는 그늘. 돌덩이가 돌아가는 느낌을 준다.
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(255,240,205,0.30)';
    c.beginPath(); c.moveTo(3, 125); c.lineTo(3, 3); c.lineTo(125, 3); c.stroke();
    c.strokeStyle = 'rgba(26,18,8,0.42)';
    c.beginPath(); c.moveTo(125, 3); c.lineTo(125, 125); c.lineTo(3, 125); c.stroke();
    // 음각 글리프: 다이얼은 노멀맵을 갈아 끼울 수 없으므로(causal.js가 map만 교체한다)
    // 홈의 입체감을 색에 직접 굽는다 — 위쪽 홈벽은 그늘, 아래쪽 홈벽은 빛.
    const stroke = (dx, dy, style, lw) => {
      c.save(); c.translate(64 + dx, 64 + dy); c.scale(44, 44);
      c.strokeStyle = style; c.lineWidth = lw / 44;
      c.lineCap = 'round'; c.lineJoin = 'round';
      strokeGlyph(c, i); c.restore();
    };
    stroke(2.2, 2.2, 'rgba(255,242,210,0.42)', 7);
    stroke(-2.2, -2.2, 'rgba(24,16,6,0.50)', 7);
    stroke(0, 0, 'rgba(48,36,18,0.92)', 6);
    const tex = carveTexture(cnv);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    _tiles.push(tex);
  }
  return _tiles;
}
