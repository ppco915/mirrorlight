// pyramid/validate.js — 문제 1 검증.
//   node src/pyramid/validate.js

import { insideConeAp, spawnPoint, mirrorParams } from '../conemath.js';
import { LV, mirrorLevelOf, walkableEra, apertureEra } from './level.js';
import { muralData, BEAD_CELLS, ROWS, COLS } from './mural.js';
import { GLYPH_COUNT } from './assets.js';

const m = mirrorParams(LV.mirror);
const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });

function posesOf(which, era) {
  const lvl = mirrorLevelOf(which).mirror;
  const [px, pz] = (which === 'A' ? LV.mirrorA : LV.mirrorB).pos;
  const walk = walkableEra(era);
  const out = [];
  for (let yaw = lvl.yawRangeDeg[0]; yaw <= lvl.yawRangeDeg[1] + 1e-9; yaw += 0.5) {
    const pose = { x: px, z: pz, yawDeg: yaw };
    if (spawnPoint(pose, m, walk, LV.spawn)) out.push(pose);
  }
  return out;
}

function geometry() {
  const apP1 = apertureEra('P1'), apP2 = apertureEra('P2');
  const KEY = pt(LV.props.keySpot);
  const KEY_STAND = pt([LV.props.keyStand[0], 0, LV.props.keyStand[2]]);
  const BRICK = pt(LV.props.brick);
  const BRICK_STAND = pt([LV.props.brickStand[0], 0, LV.props.brickStand[2]]);
  const A = posesOf('A', 'P1');
  const B = posesOf('B', 'P2');
  const cover = (poses, ap, ...pts) =>
    poses.filter((p) => pts.every((q) => insideConeAp(p, m, ap, q)));

  // V1: 좌대의 열쇠(+기립) 도달 자세 존재
  const v1 = cover(A, apP1, KEY, KEY_STAND).length;
  // V2: 벽돌(+기립) 도달 자세 존재
  const v2 = cover(A, apP1, BRICK, BRICK_STAND).length;
  // V0 (강제 릴레이): 열쇠와 벽돌을 동시에 덮는 자세는 없어야 한다
  const v0 = cover(A, apP1, KEY, BRICK).length;
  // V3 (릴레이 성립): 두 자세군의 원뿔이 보행 셀을 공유한다
  const walk1 = walkableEra('P1');
  const cells = [];
  for (let x = LV.rooms.x0; x < 0; x += LV.validate.cellSize) {
    for (let z = LV.rooms.z0; z < LV.rooms.z1; z += LV.validate.cellSize) {
      if (walk1(x, z)) cells.push({ x, y: 0, z });
    }
  }
  const keyPoses = cover(A, apP1, KEY, KEY_STAND);
  const brickPoses = cover(A, apP1, BRICK, BRICK_STAND);
  let shared = 0;
  for (const c of cells) {
    if (keyPoses.some((p) => insideConeAp(p, m, apP1, c))
      && brickPoses.some((p) => insideConeAp(p, m, apP1, c))) shared++;
  }
  // V4 (감금): 과거 1의 빛은 봉인된 벽을 결코 넘지 않는다
  const ROOM2_PT = { x: 3.0, y: 0.9, z: 0 };
  const v4 = cover(A, apP1, ROOM2_PT).length;
  const v4noAp = cover(A, null, ROOM2_PT).length;    // 개구 규칙이 실제로 막고 있음을 증명
  // V5 (과거 2): 열린 통로로 거울 B가 제단(+기립)에 닿는다
  const v5 = cover(B, apP2, pt([4.5, 0.62, -0.35]), { x: 3.7, y: 0, z: -0.35 }).length;
  // ── 문제 2 기하 ──
  const HEARTH = pt([LV.props.hearth[0], 0.05, LV.props.hearth[2]]);
  const HEARTH_STAND = pt([LV.props.hearthStand[0], 0, LV.props.hearthStand[2]]);
  const NICHE = pt(LV.props.niche);
  const NICHE_STAND = pt([LV.props.nicheStand[0], 0, LV.props.nicheStand[2]]);
  const CHISEL = pt(LV.props.chiselP2);
  // W1: 화덕이 거울 B의 문틀 쐐기 안 (P2→P1 인계점 성립)
  const w1 = cover(B, apP2, HEARTH, HEARTH_STAND).length;
  // W2: 화덕이 거울 A의 원뿔 안 (P1에서 회수 가능)
  const w2 = cover(A, apP1, HEARTH, HEARTH_STAND).length;
  // W3: 벽감(+기립)이 거울 A의 원뿔 안
  const w3 = cover(A, apP1, NICHE, NICHE_STAND).length;
  // W4 (핀 릴레이 강제): 벽감과 벽돌을 동시에 덮는 자세 부재 + 공유 셀 존재
  const w4 = cover(A, apP1, NICHE, BRICK).length;
  const nichePoses = cover(A, apP1, NICHE, NICHE_STAND);
  let w4shared = 0;
  for (const c of cells) {
    if (nichePoses.some((p) => insideConeAp(p, m, apP1, c))
      && brickPoses.some((p) => insideConeAp(p, m, apP1, c))) w4shared++;
  }
  // W5: 끌의 자리(P2, 경문 곁)가 거울 B의 원뿔 안
  const w5 = cover(B, apP2, CHISEL).length;

  // V6 (회수 불능 부재): 과거 1의 모든 보행 셀이 어떤 자세의 원뿔에 포함된다
  let uncovered = 0;
  for (const c of cells) {
    if (!A.some((p) => insideConeAp(p, m, apP1, c))) uncovered++;
  }

  return {
    pass: v1 > 0 && v2 > 0 && v0 === 0 && shared > 0 && v4 === 0 && v4noAp > 0 && v5 > 0 && uncovered === 0
      && w1 > 0 && w2 > 0 && w3 > 0 && w4 === 0 && w4shared > 0 && w5 > 0,
    keyPoses: v1, brickPoses: v2, keyBrickCoCover: v0, relayCells: shared,
    room2LeakWithAperture: v4, room2ReachNoAperture: v4noAp,
    p2AltarPoses: v5, uncoveredCells: uncovered, cells: cells.length,
    hearthWedgePoses: w1, hearthP1Poses: w2, nichePoses: w3,
    nicheBrickCoCover: w4, pinRelayCells: w4shared, chiselPoses: w5,
  };
}

// ── 모델 검사: 문제 1(열쇠·문) + 문제 2(끌·회반죽·핀·금고·스카라베) ──
// 거울 B(P2)는 문이 열려야 닿는다 — P2 행동은 door를 요구한다.
function modelCheck() {
  const S0 = {
    k: 'PEDESTAL', door: false, hand: null,
    ch: 'P2SPOT', plaster: false, doorPl: false, pin: 'NICHE', vault: false, scarab: false,
    collar: false, seated: false, escaped: false,
  };
  const keyOf = (s) => JSON.stringify(s);
  const next = (s) => {
    const out = [];
    const push = (fn) => { const n = { ...s }; fn(n); out.push(n); };
    // 문제 1
    if (!s.hand && ['PEDESTAL', 'FLOOR', 'BRICK'].includes(s.k)) push((n) => { n.k = 'CARRIED'; n.hand = 'k'; });
    if (s.hand === 'k') for (const to of ['FLOOR', 'BRICK']) push((n) => { n.k = to; n.hand = null; });
    if (!s.hand && s.k === 'BRICK') push((n) => { n.k = 'RETRIEVED'; });
    if (s.k === 'RETRIEVED' && !s.door) push((n) => { n.door = true; });
    // 문제 2 — 끌 (P2 행동은 door 필요; P2FLOOR는 사제단이 회수하므로 P1에 못 온다)
    if (s.door && !s.hand && ['P2SPOT', 'P2FLOOR'].includes(s.ch)) push((n) => { n.ch = 'CARRIED2'; n.hand = 'c'; });
    if (s.hand === 'c') for (const to of ['P2FLOOR', 'HEARTH']) push((n) => { n.ch = to; n.hand = null; });
    if (!s.hand && s.ch === 'HEARTH') push((n) => { n.ch = 'CARRIED1'; n.hand = 'c1'; });
    if (s.hand === 'c1') {
      for (const to of ['P1FLOOR', 'HEARTH']) push((n) => { n.ch = to; n.hand = null; });
      if (!s.plaster) push((n) => { n.plaster = true; });          // S: 벽감 개방 (일방향)
      if (!s.doorPl) push((n) => { n.doorPl = true; });            // 무해한 문 회반죽
    }
    if (!s.hand && s.ch === 'P1FLOOR') push((n) => { n.ch = 'CARRIED1'; n.hand = 'c1'; });
    // 문제 2 — 핀 (회반죽이 열려야 잡을 수 있다)
    if (!s.hand && s.pin === 'NICHE' && s.plaster) push((n) => { n.pin = 'CARRIED'; n.hand = 'p'; });
    if (!s.hand && ['P1FLOOR2', 'HEARTH2', 'BRICK2'].includes(s.pin)) push((n) => { n.pin = 'CARRIED'; n.hand = 'p'; });
    if (s.hand === 'p') {
      for (const to of ['P1FLOOR2', 'HEARTH2', 'BRICK2']) push((n) => { n.pin = to; n.hand = null; });
      push((n) => { n.vault = !n.vault; });                        // P1에서 금고 개폐 (가역)
    }
    if (!s.hand && s.pin === 'BRICK2') push((n) => { n.pin = 'RETRIEVED'; });
    // 돌려놓기: 회수한 핀을 현재의 벽돌에 되돌리면 시간선이 복원된다 (소프트락 방지)
    if (!s.hand && s.pin === 'RETRIEVED' && !s.scarab) push((n) => { n.pin = 'BRICK2'; });
    // 현재의 금고 개방: S 필수 + 핀 회수 + P1 종료 상태의 금고가 닫혀 있어야(도굴 회피)
    // 금고에서 스카라베와 가슴장식을 함께 얻는다.
    if (s.pin === 'RETRIEVED' && s.plaster && !s.vault && !s.scarab) push((n) => { n.scarab = true; });
    // 문제 3 (현재 전용): 벽화에 목걸이 앉히기, 소켓에 풍뎅이, 다이얼(지식 — 게이트 아님)
    if (s.scarab && !s.collar) push((n) => { n.collar = true; });
    if (s.scarab && !s.seated) push((n) => { n.seated = true; });
    if (s.seated && !s.escaped) push((n) => { n.escaped = true; });
    return out;
  };
  const isWin = (s) => s.escaped;
  const seen = new Map([[keyOf(S0), S0]]);
  const q = [S0];
  while (q.length) {
    const s = q.pop();
    for (const n of next(s)) {
      const k = keyOf(n);
      if (!seen.has(k)) { seen.set(k, n); q.push(n); }
    }
  }
  const winnable = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, s] of seen) {
      if (winnable.has(k)) continue;
      if (isWin(s) || next(s).some((n) => winnable.has(keyOf(n)))) { winnable.add(k); changed = true; }
    }
  }
  const stuck = [...seen.keys()].filter((k) => !winnable.has(k));
  return { pass: stuck.length === 0, states: seen.size, stuck: stuck.slice(0, 3) };
}

// ── 문제 3: 벽화 데이터 일관성 — 게임과 문이 같은 답을 본다 ──
function muralCheck() {
  const a = muralData(), b = muralData();
  const deterministic = JSON.stringify(a) === JSON.stringify(b);
  const codeDistinct = new Set(a.code).size === 3;
  const codeInRange = a.code.every((g) => g >= 0 && g < GLYPH_COUNT);
  const beadsInGrid = BEAD_CELLS.every(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS);
  const codeMatchesField = a.code.every((g, i) => a.field[a.beadCells[i][0]][a.beadCells[i][1]] === g);
  return {
    pass: deterministic && codeDistinct && codeInRange && beadsInGrid && codeMatchesField,
    deterministic, codeDistinct, codeInRange, beadsInGrid, codeMatchesField, code: a.code,
  };
}

export function validatePyramid() {
  const geo = geometry();
  const model = modelCheck();
  const mural = muralCheck();
  return { pass: geo.pass && model.pass && mural.pass, geo, model, mural };
}

const isNode = typeof process !== 'undefined' && !!process.versions?.node;
if (isNode && process.argv[1] && /pyramid[\\/]validate\.js$/.test(process.argv[1])) {
  const t0 = Date.now();
  const r = validatePyramid();
  console.log(JSON.stringify(r, null, 2));
  console.log(`(${Date.now() - t0}ms)`);
  process.exit(r.pass ? 0 : 1);
}
