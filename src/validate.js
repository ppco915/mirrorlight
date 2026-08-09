// validate.js — 검증 v2. 세 묶음:
//   [1장 기하] 조건 0~3 (6.12절 그대로, 이동한 장애물 반영 재검증)
//   [2장 기하] B 고정 자세의 담보 + E2 서랍↔벽돌 릴레이 + 분리 조건
//   [모델 검사] 관리인 규칙을 포함한 상태 그래프 전수 탐색 — 모든 도달 상태에서
//               승리가 여전히 도달 가능함을 증명한다 (소프트락 부재).
//   node src/validate.js  |  window.validateLevel(level)

import { insideCone, toLocal, spawnPoint, mirrorParams, makeWalkable } from './conemath.js';

const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });

function railPose(level, x, yawDeg) {
  return { x, z: level.mirror.rail[0][1], yawDeg };
}

function condition0(level, m) {
  const hook = pt(level.props.hook.pos);
  const brick = pt(level.validate.brickPoint);
  const [x0, x1] = [level.mirror.rail[0][0], level.mirror.rail[1][0]];
  const [y0, y1] = level.mirror.yawRangeDeg;
  let violations = 0;
  for (let x = x0; x <= x1 + 1e-9; x += 0.05) {
    for (let yaw = y0; yaw <= y1 + 1e-9; yaw += 0.1) {
      const pose = railPose(level, x, yaw);
      if (insideCone(pose, m, hook) && insideCone(pose, m, brick)) violations++;
    }
  }
  return { pass: violations === 0, violations };
}

function usablePoses(level, m, walkable, dx = 0.05, dyaw = 0.5) {
  const [x0, x1] = [level.mirror.rail[0][0], level.mirror.rail[1][0]];
  const [y0, y1] = level.mirror.yawRangeDeg;
  const poses = [];
  for (let x = x0; x <= x1 + 1e-9; x += dx) {
    for (let yaw = y0; yaw <= y1 + 1e-9; yaw += dyaw) {
      const pose = railPose(level, x, yaw);
      if (spawnPoint(pose, m, walkable, level.spawn)) poses.push(pose);
    }
  }
  return poses;
}

function walkableCells(level, walkable) {
  const hw = level.room.w / 2, hd = level.room.d / 2;
  const s = level.validate.cellSize;
  const cells = [];
  for (let x = -hw + s / 2; x < hw; x += s) {
    for (let z = -hd + s / 2; z < hd; z += s) {
      if (walkable(x, z)) cells.push({ x, y: 0, z });
    }
  }
  return cells;
}

function reachSet(poses, m, cells, target) {
  const tp = poses.filter((p) => insideCone(p, m, target));
  const set = new Set();
  cells.forEach((c, i) => {
    for (const p of tp) if (insideCone(p, m, c)) { set.add(i); return; }
  });
  return { poseCount: tp.length, set };
}

function geometryCh1(level, m, poses, cells) {
  const hook = pt(level.props.hook.pos);
  const brick = pt(level.validate.brickPoint);
  const c0 = condition0(level, m);
  const hookReach = reachSet(poses, m, cells, hook);
  const brickReach = reachSet(poses, m, cells, brick);
  const shared = [...hookReach.set].filter((i) => brickReach.set.has(i));
  let uncovered = 0;
  cells.forEach((c) => {
    if (!poses.some((p) => insideCone(p, m, c))) uncovered++;
  });
  return {
    pass: c0.pass && hookReach.poseCount > 0 && shared.length > 0 && uncovered === 0,
    c0, hookPoses: hookReach.poseCount, relayCells: shared.length,
    cells: cells.length, uncovered,
  };
}

function geometryCh2(level, m, walkable, poses, cells) {
  const drawer = pt(level.validate.drawerPoint);
  const brick = pt(level.validate.brickPoint);
  const bPose = { x: level.mirrorB.pos[0], z: level.mirrorB.pos[1], yawDeg: level.mirrorB.yawDeg };

  // B 고정 자세: 상호작용 지점들(크랭크 몸체·문손잡이·기립 바닥·마루장)이 전부
  // 여유(slack) 0.15m 이상으로 원뿔 안에 있어야 한다. 단일 좌표 검사는 v2.1에서
  // 크랭크가 원뿔 밖에 놓이는 결함을 놓쳤다 — 검사 대상은 좌표가 아니라 여유다.
  const required = [
    [0.12, 0.75, -2.80], [0.12, 0.55, -2.72], [-0.18, 0.75, -2.80], [0.42, 0.75, -2.80],
    [0.35, 1.05, -2.86],
    [0.10, 0, -2.45], [-0.25, 0, -2.45],
    [-0.8, 0.05, 1.0], [-1.05, 0.05, 1.0], [-0.55, 0.05, 1.0],
    [-0.8, 0, 0.55],
  ];
  const slackOf = (p) => {
    const l = toLocal(bPose, m, { x: p[0], y: p[1], z: p[2] });
    const grow = l.z * m.spreadTan;
    return Math.min(m.halfWidth + grow - Math.abs(l.x), m.halfHeight + grow - Math.abs(l.y),
      l.z - 0.05, m.coneLength - l.z);
  };
  const minSlack = Math.min(...required.map(slackOf));
  const bCovers = minSlack >= 0.15;
  const bExcludesBrick = !insideCone(bPose, m, brick);
  const bSpawn = !!spawnPoint(bPose, m, walkable, level.spawn);

  // E2: 서랍과 벽돌은 한 원뿔에 담기지 않는다 (조건 0의 2장 판형 — 재조준 강제)
  let coCover = 0;
  for (const p of poses) if (insideCone(p, m, drawer) && insideCone(p, m, brick)) coCover++;
  // E2: 마루장+서랍 동시 자세 존재 (열쇠 획득→해정이 한 번의 빙의로 가능)
  const board = pt(level.validate.boardPoint);
  const boardDrawer = poses.filter((p) => insideCone(p, m, board) && insideCone(p, m, drawer)).length;
  // E2 릴레이: 서랍 영역 원뿔과 벽돌 원뿔의 보행 공유 셀
  const dReach = reachSet(poses, m, cells, drawer);
  const fReach = reachSet(poses, m, cells, brick);
  const relay = [...dReach.set].filter((i) => fReach.set.has(i)).length;

  return {
    pass: bCovers && bExcludesBrick && bSpawn && coCover === 0 && boardDrawer > 0 && relay > 0,
    bCovers, bMinSlack: +minSlack.toFixed(3), bExcludesBrick, bSpawn,
    drawerBrickCoCover: coCover, boardDrawerPoses: boardDrawer, relayCells: relay,
  };
}

// ── 모델 검사: 상태 그래프 전수 탐색 ──────────────────────────
// 상태: [crankE1, crankE2, doorKeyE2, smallKey, hand, unlocked, sealedE1]
// 관리인 파생: crankE1이 MOUNTED면 E2엔 크랭크 없음(NONE), 아니면 서랍(DRAWER).
// 문 열쇠의 E1 인스턴스는 제외한다 — R6(제자리 복귀)으로 E2 파생이 불변이고
// 봉인은 E1 행동만 막으므로 진행에 영향을 주지 않는다(표시 전용 세계선).
// 기하 검증이 이동 가능성을 보장하므로 여기서는 위치 추상화로 행동만 본다.
// 승리 = 문 열쇠와 크랭크 둘 다 RETRIEVED (두 잠금 독립, 순서 자유).
function modelCheck() {
  const S0 = {
    c1: 'MOUNTED', c2: 'NONE', dk: 'HOOK', sk: 'BOARD', hand: null,
    unlocked: false, sealed: false,
  };
  const keyOf = (s) => JSON.stringify(s);
  const derive = (s) => {
    if (!s.sealed) s.c2 = s.c1 === 'MOUNTED' ? 'NONE' : 'DRAWER';
    return s;
  };
  const next = (s) => {
    const out = [];
    const push = (fn) => {
      const n = { ...s };
      fn(n);
      out.push(derive(n));
    };
    // E1 행동 (크랭크 세계선, 봉인 전까지 가역)
    if (!s.hand && s.c1 === 'MOUNTED') push((n) => { n.c1 = 'CARRIED'; });
    if (!s.hand && ['FLOOR', 'DRAWER', 'BOARD'].includes(s.c1) && !s.sealed) push((n) => { n.c1 = 'CARRIED'; });
    if (s.c1 === 'CARRIED') {
      for (const to of ['FLOOR', 'DRAWER', 'BOARD']) push((n) => { n.c1 = to; });
      if (!s.sealed) push((n) => { n.c1 = 'MOUNTED'; });
    }
    // E2 행동: 작은 열쇠
    if (!s.hand && s.sk === 'BOARD') push((n) => { n.sk = 'CARRIED'; n.hand = 'sk'; });
    if (!s.hand && s.sk === 'FLOOR') push((n) => { n.sk = 'CARRIED'; n.hand = 'sk'; });
    if (!s.hand && s.sk === 'BRICK') push((n) => { n.sk = 'CARRIED'; n.hand = 'sk'; });
    if (s.hand === 'sk') {
      for (const to of ['FLOOR', 'BOARD', 'BRICK']) push((n) => { n.sk = to; n.hand = null; });
      if (!s.unlocked) push((n) => { n.unlocked = true; });   // 해정 (열쇠는 손에 남는다)
    }
    // E2 행동: 크랭크 (만지면 E1 봉인)
    if (!s.hand && s.unlocked && s.c2 === 'DRAWER') push((n) => { n.c2 = 'CARRIED'; n.hand = 'c'; n.sealed = true; });
    if (!s.hand && ['FLOOR', 'BOARD', 'BRICK'].includes(s.c2)) push((n) => { n.c2 = 'CARRIED'; n.hand = 'c'; n.sealed = true; });
    if (s.hand === 'c') {
      for (const to of ['FLOOR', 'BOARD', 'BRICK']) push((n) => { n.c2 = to; n.hand = null; n.sealed = true; });
      if (s.unlocked) push((n) => { n.c2 = 'DRAWER'; n.hand = null; n.sealed = true; });
    }
    // E2 행동: 문 열쇠 (1장 세계선 — 서랍은 해정 후에만 여닫는다)
    if (!s.hand && ['HOOK', 'FLOOR', 'BOARD', 'BRICK'].includes(s.dk)) push((n) => { n.dk = 'CARRIED'; n.hand = 'dk'; });
    if (!s.hand && s.dk === 'DRAWER' && s.unlocked) push((n) => { n.dk = 'CARRIED'; n.hand = 'dk'; });
    if (s.hand === 'dk') {
      for (const to of ['FLOOR', 'BOARD', 'BRICK']) push((n) => { n.dk = to; n.hand = null; });
      if (s.unlocked) push((n) => { n.dk = 'DRAWER'; n.hand = null; });
    }
    if (!s.hand && s.dk === 'BRICK') push((n) => { n.dk = 'RETRIEVED'; });
    // 현재 회수 (분신이 아닐 때 = hand 비어 있을 때만 의미: hand는 분신 손)
    if (!s.hand && s.c2 === 'BRICK') push((n) => { n.c2 = 'RETRIEVED'; n.sealed = true; });
    if (!s.hand && s.sk === 'BRICK') push((n) => { n.sk = 'RETRIEVED'; });
    // 돌려놓기: 회수된 작은 열쇠를 현재의 벽돌에 되돌리면 시간선이 복원된다
    if (!s.hand && s.sk === 'RETRIEVED') push((n) => { n.sk = 'BRICK'; });
    return out;
  };
  const isWin = (s) => s.c2 === 'RETRIEVED' && s.dk === 'RETRIEVED';

  // 전방 탐색: 도달 가능 상태 수집
  const seen = new Map();
  const q = [derive({ ...S0 })];
  seen.set(keyOf(q[0]), q[0]);
  while (q.length) {
    const s = q.pop();
    for (const n of next(s)) {
      const k = keyOf(n);
      if (!seen.has(k)) { seen.set(k, n); q.push(n); }
    }
  }
  // 각 도달 상태에서 승리 도달 가능성 (역방향 대신 상태 수가 작으므로 개별 BFS)
  const winnable = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [k, s] of seen) {
      if (winnable.has(k)) continue;
      if (isWin(s) || next(s).some((n) => winnable.has(keyOf(n)))) {
        winnable.add(k); changed = true;
      }
    }
  }
  const stuck = [...seen.keys()].filter((k) => !winnable.has(k));
  return { pass: stuck.length === 0, states: seen.size, stuck: stuck.slice(0, 3) };
}

export function validateLevel(level) {
  const m = mirrorParams(level.mirror);
  const walkable = makeWalkable(level);
  const poses = usablePoses(level, m, walkable);
  const cells = walkableCells(level, walkable);
  const ch1 = geometryCh1(level, m, poses, cells);
  const ch2 = geometryCh2(level, m, walkable, poses, cells);
  const model = modelCheck();
  return { pass: ch1.pass && ch2.pass && model.pass, usablePoses: poses.length, ch1, ch2, model };
}

if (typeof window !== 'undefined') window.validateLevel = validateLevel;

const isNode = typeof process !== 'undefined' && !!process.versions?.node;
if (isNode && process.argv[1] && /validate\.js$/.test(process.argv[1])) {
  const { readFileSync } = await import('node:fs');
  const level = JSON.parse(readFileSync(new URL('../level.json', import.meta.url), 'utf8'));
  const t0 = Date.now();
  const r = validateLevel(level);
  console.log(JSON.stringify(r, null, 2));
  console.log(`(${Date.now() - t0}ms)`);
  process.exit(r.pass ? 0 : 1);
}
