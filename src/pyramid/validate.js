// pyramid/validate.js — 《쌍거울의 무덤》 검증.
//   [기하] 개구 차폐를 포함한 원뿔 도달성과 강제 릴레이
//   [모델] 상태 그래프 전수 탐색 — 소프트락 부재
//   node src/pyramid/validate.js

import { insideConeAp, spawnPoint, mirrorParams, toLocal } from '../conemath.js';
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
  const apR = apertureEra('ROB'), apS = apertureEra('SEAL');
  const CRYPT = pt(LV.props.crypt);
  const CRYPT_STAND = { x: 3.7, y: 0, z: -0.35 };
  const ALCOVE = pt(LV.props.alcove);
  const ALCOVE_STAND = { x: -2.8, y: 0, z: -2.45 };
  const BLOCK = pt(LV.props.block);
  const BLOCK_STAND = { x: -5.5, y: 0, z: 1.8 };
  const URNB = pt(LV.props.urnB);
  const A = posesOf('A', 'ROB');
  const B = posesOf('B', 'SEAL');
  const cover = (poses, ap, ...pts) =>
    poses.filter((p) => pts.every((q) => insideConeAp(p, m, ap, q)));

  // Q1: 봉 — 벽감(+기립) 도달 자세 존재
  const q1 = cover(A, apR, ALCOVE, ALCOVE_STAND).length;
  // Q2: 크립트(+기립) — 파공을 통과해 도달하는 자세 존재
  const q2 = cover(A, apR, CRYPT, CRYPT_STAND).length;
  // Q2b: 항아리 유혹 경로도 쐐기 안 (실패 경로가 실제로 시도 가능해야 가르친다)
  const q2b = cover(A, apR, URNB).length;
  // Q3: 바닥돌(+기립) 도달 자세 존재
  const q3 = cover(A, apR, BLOCK, BLOCK_STAND).length;
  // Q4 (강제 릴레이): 크립트와 바닥돌을 동시에 덮는 자세는 없어야 한다
  const q4 = cover(A, apR, CRYPT, BLOCK).length;
  // Q5 (릴레이 성립): 크립트 자세와 바닥돌 자세의 원뿔이 보행 셀을 공유한다
  const walkR = walkableEra('ROB');
  const cells = [];
  for (let x = LV.rooms.x0; x < LV.rooms.x1; x += LV.validate.cellSize) {
    for (let z = LV.rooms.z0; z < LV.rooms.z1; z += LV.validate.cellSize) {
      if (walkR(x, z)) cells.push({ x, y: 0, z });
    }
  }
  const cryptPoses = cover(A, apR, CRYPT, CRYPT_STAND);
  const blockPoses = cover(A, apR, BLOCK, BLOCK_STAND);
  let shared = 0;
  for (const c of cells) {
    if (cryptPoses.some((p) => insideConeAp(p, m, apR, c))
      && blockPoses.some((p) => insideConeAp(p, m, apR, c))) shared++;
  }
  // Q6 (SEAL): 거울 B가 제단의 보석(+기립)에 닿는다 — 흡수 실험장 성립
  const q6 = cover(B, apS, { x: 4.5, y: 0.62, z: -0.35 }, { x: 3.7, y: 0, z: -0.35 }).length;
  // Q7 (교차 차단): SEAL의 B 원뿔은 바닥돌에 닿지 않는다 — 선-은닉 기하 봉쇄
  const q7 = cover(B, apS, BLOCK).length;
  // Q8 (개구의 실효): 쐐기 밖의 매장실 지점은 개구 없인 닿고 개구론 닿지 않는다
  const OFF_WEDGE = { x: 4.5, y: 0.5, z: 2.0 };
  const q8open = cover(A, null, OFF_WEDGE).length;
  const q8ap = cover(A, apR, OFF_WEDGE).length;

  return {
    pass: q1 > 0 && q2 > 0 && q2b > 0 && q3 > 0 && q4 === 0 && shared > 0 && q6 > 0 && q7 === 0
      && q8open > 0 && q8ap === 0,
    alcovePoses: q1, cryptPoses: q2, urnPoses: q2b, blockPoses: q3,
    cryptBlockCoCover: q4, relayCells: shared, sealAltarPoses: q6,
    sealBlockPoses: q7, offWedgeNoAperture: q8open, offWedgeWithAperture: q8ap,
  };
}

// ── 모델 검사 ──
function modelCheck() {
  const S0 = { j: 'NICHE', rod: 'ALCOVE', open: false, hand: null };
  const keyOf = (s) => JSON.stringify(s);
  const next = (s) => {
    const out = [];
    const push = (fn) => { const n = { ...s }; fn(n); out.push(n); };
    if (!s.hand && ['ALCOVE', 'FLOOR'].includes(s.rod)) push((n) => { n.rod = 'CARRIED'; n.hand = 'r'; });
    if (s.hand === 'r') {
      push((n) => { n.rod = 'FLOOR'; n.hand = null; });
      push((n) => { n.open = !n.open; });                       // 봉으로 열기/닫기
    }
    if (!s.hand && s.open && s.j === 'NICHE') push((n) => { n.j = 'CARRIED'; n.hand = 'j'; });
    if (!s.hand && ['FLOOR', 'URN', 'BLOCK'].includes(s.j)) push((n) => { n.j = 'CARRIED'; n.hand = 'j'; });
    if (s.hand === 'j') {
      for (const to of ['FLOOR', 'URN', 'BLOCK']) push((n) => { n.j = to; n.hand = null; });
      if (s.open) push((n) => { n.j = 'NICHE'; n.hand = null; });
    }
    if (!s.hand && s.j === 'BLOCK') push((n) => { n.j = 'RETRIEVED'; });   // 현재 회수 = 승리
    return out;
  };
  const isWin = (s) => s.j === 'RETRIEVED';
  const seen = new Map();
  const q = [S0];
  seen.set(keyOf(S0), S0);
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
