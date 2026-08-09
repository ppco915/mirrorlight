// pyramid/mural.js — 문제 3 「아누비스의 목걸이와 가짜 문」의 단일 진실 원천.
// 벽화의 글리프 밭, 목걸이 구슬이 앉는 세 칸, 그리고 가짜 문의 정답 코드는
// 전부 여기서 결정론적으로 파생된다 — 게임과 검증이 같은 답을 본다.
// 데이터는 순수(노드에서 검증 가능), 캔버스 합성은 브라우저에서만.

import * as THREE from 'three';
import { inBrowser, strokeGlyph, GLYPH_COUNT, GLYPH_NAMES } from './assets.js';

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

// ── 캔버스 합성 (브라우저 전용) ────────────────────────────────
// 벽화: 모래빛 바탕 + 좌측의 아누비스(자칼) 음각 실루엣 + 글리프 밭 + 목걸이 홈.
export function muralMaps() {
  if (!inBrowser) return null;
  const W = 1024, H = 720;
  const cnv = document.createElement('canvas');
  cnv.width = W; cnv.height = H;
  const c = cnv.getContext('2d');
  c.fillStyle = '#b09a74';
  c.fillRect(0, 0, W, H);
  const rand = rng(SEED + 1);
  for (let i = 0; i < 900; i++) {                    // 풍화 얼룩
    c.fillStyle = `rgba(60,45,25,${0.02 + rand() * 0.05})`;
    c.fillRect(rand() * W, rand() * H, 2 + rand() * 5, 2 + rand() * 5);
  }
  c.strokeStyle = '#4a3820';
  c.lineWidth = 7;
  c.lineCap = 'round';
  // 아누비스: 앉은 자칼 프로필 (좌측 1/3)
  c.save();
  c.translate(W * 0.17, H * 0.56);
  c.scale(1.05, 1.05);
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
  c.stroke();
  c.restore();
  // 목걸이 홈: 자칼의 목에서 시작해 글리프 밭을 가로지르는 얕은 호
  const arc = collarArcPx(W, H);
  c.strokeStyle = 'rgba(40,28,12,0.55)';
  c.lineWidth = 13;
  c.beginPath();
  c.moveTo(arc[0].x, arc[0].y);
  c.quadraticCurveTo(arc[1].x, arc[1].y + 70, arc[2].x, arc[2].y);
  c.stroke();
  // 글리프 밭
  const data = muralData();
  c.lineWidth = 6;
  c.strokeStyle = '#3e2f18';
  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      const { u, v } = cellCenterUV(r, col);
      c.save();
      c.translate(u * W, v * H);
      c.scale(38, 38);
      c.lineWidth = 6 / 38;
      strokeGlyph(c, data.field[r][col]);
      c.restore();
    }
  }
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function collarArcPx(W, H) {
  const [a, b, d] = BEAD_CELLS;
  const p = (rc) => {
    const { u, v } = cellCenterUV(rc[0], rc[1]);
    return { x: u * W, y: v * H };
  };
  return [p(a), p(b), p(d)];
}

// 다이얼 면: 글리프 하나가 새겨진 타일 (12장 캐시)
let _tiles = null;
export function dialTiles() {
  if (!inBrowser) return null;
  if (_tiles) return _tiles;
  _tiles = [];
  for (let i = 0; i < GLYPH_COUNT; i++) {
    const cnv = document.createElement('canvas');
    cnv.width = cnv.height = 128;
    const c = cnv.getContext('2d');
    c.fillStyle = '#8a7a5c';
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#2e2210';
    c.lineCap = 'round';
    c.save();
    c.translate(64, 64);
    c.scale(46, 46);
    c.lineWidth = 7 / 46;
    strokeGlyph(c, i);
    c.restore();
    const tex = new THREE.CanvasTexture(cnv);
    tex.colorSpace = THREE.SRGBColorSpace;
    _tiles.push(tex);
  }
  return _tiles;
}
