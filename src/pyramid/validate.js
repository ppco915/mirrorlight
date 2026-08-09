// pyramid/validate.js — 문제 1 검증.
//   node src/pyramid/validate.js

import { insideConeAp, spawnPoint, mirrorParams } from '../conemath.js';
import { LV, mirrorLevelOf, walkableEra, apertureEra } from './level.js';

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
  // V6 (회수 불능 부재): 과거 1의 모든 보행 셀이 어떤 자세의 원뿔에 포함된다
  let uncovered = 0;
  for (const c of cells) {
    if (!A.some((p) => insideConeAp(p, m, apP1, c))) uncovered++;
  }

  return {
    pass: v1 > 0 && v2 > 0 && v0 === 0 && shared > 0 && v4 === 0 && v4noAp > 0 && v5 > 0 && uncovered === 0,
    keyPoses: v1, brickPoses: v2, keyBrickCoCover: v0, relayCells: shared,
    room2LeakWithAperture: v4, room2ReachNoAperture: v4noAp,
    p2AltarPoses: v5, uncoveredCells: uncovered, cells: cells.length,
  };
}

// ── 모델 검사: 열쇠 1의 세계선 + 문 ──
function modelCheck() {
  const S0 = { k: 'PEDESTAL', door: false, hand: null };
  const keyOf = (s) => JSON.stringify(s);
  const next = (s) => {
    const out = [];
    const push = (fn) => { const n = { ...s }; fn(n); out.push(n); };
    if (!s.hand && ['PEDESTAL', 'FLOOR', 'BRICK'].includes(s.k)) push((n) => { n.k = 'CARRIED'; n.hand = 'k'; });
    if (s.hand === 'k') for (const to of ['FLOOR', 'BRICK']) push((n) => { n.k = to; n.hand = null; });
    if (!s.hand && s.k === 'BRICK') push((n) => { n.k = 'RETRIEVED'; });
    if (s.k === 'RETRIEVED' && !s.door) push((n) => { n.door = true; });
    return out;
  };
  const isWin = (s) => s.door;
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

export function validatePyramid() {
  const geo = geometry();
  const model = modelCheck();
  return { pass: geo.pass && model.pass, geo, model };
}

const isNode = typeof process !== 'undefined' && !!process.versions?.node;
if (isNode && process.argv[1] && /pyramid[\\/]validate\.js$/.test(process.argv[1])) {
  const t0 = Date.now();
  const r = validatePyramid();
  console.log(JSON.stringify(r, null, 2));
  console.log(`(${Date.now() - t0}ms)`);
  process.exit(r.pass ? 0 : 1);
}
