// pyramid/level.js — 《쌍거울의 무덤》 문제 1 기준 무대 수치.
// 방1(서)과 방2(동), 가운데 돌벽의 문. 거울 1(방1 서쪽 끝)→과거 1,
// 거울 2(방2 동쪽 끝)→과거 2(더 옛날). 회전만 가능.
// 과거 1: 문이 회반죽으로 봉인(개구 없음 — 빛도 몸도 방1에 갇힌다).
// 과거 2: 통로 열림(봉인 이전). 현재: 문이 잠겨 있고 열쇠 1로 연다.

export const LV = {
  rooms: { x0: -7.5, x1: 7.5, z0: -3, z1: 3, wallX0: -0.25, wallX1: 0.25 },
  margin: 0.3,
  doorway: { x: 0, z0: -0.6, z1: 0.6, y0: 0, y1: 2.0 },
  mirror: { halfWidth: 0.5, halfHeight: 0.9, coneLength: 15, spreadAngleDeg: 15, centerY: 0.9 },
  mirrorA: { pos: [-7.0, 0], yawRangeDeg: [-50, 50], era: 'P1' },
  mirrorB: { pos: [7.0, 0], yawRangeDeg: [130, 230], era: 'P2' },
  spawn: { start: 0.6, max: 1.4, step: 0.1 },
  props: {
    keySpot: [-2.5, 0.45, -1.8],     // 과거 1: 문지기의 좌대 위 열쇠 / 현재: 돌무더기 밑
    keyStand: [-2.5, 0, -1.15],
    brick: [-4.0, 0.8, 2.93],        // 방1 남벽의 헐거운 벽돌 (유일한 은닉처)
    brickStand: [-4.0, 0, 2.35],
    door: [-0.27, 1.0, 0],
    altar: [4.5, 0.45, -0.35],       // 방2 (문제 2 예정 무대)
    alcove: [-2.8, 1.1, -2.9],
    urnB: [5.3, 0.4, -0.6],
    urnA: [-5.8, 0.4, -2.2],
    // ── 문제 2 ──
    hearth: [-3.5, 0.05, 0.3],       // 화덕돌 밑 공동 — P2→P1은 견디고 도굴은 못 견딘다
    hearthStand: [-3.2, 0, 0.7],
    chiselP2: [3.2, 0.45, -2.6],     // 사제의 끌 (P2, 경문 곁)
    niche: [-3.5, 1.25, -2.95],      // 회반죽에 덮인 벽감 (방1 북벽) — 핀과 금고의 자리
    nicheStand: [-3.5, 0, -2.45],
  },
  obstacles: [
    { name: 'altar', x0: 4.15, x1: 4.85, z0: -0.7, z1: 0.0 },
    { name: 'urnB', x0: 5.05, x1: 5.55, z0: -0.85, z1: -0.35 },
    { name: 'urnA', x0: -6.05, x1: -5.55, z0: -2.45, z1: -1.95 },
    { name: 'mirrorA', x0: -7.45, x1: -6.7, z0: -0.4, z1: 0.4 },
    { name: 'mirrorB', x0: 6.7, x1: 7.45, z0: -0.4, z1: 0.4 },
  ],
  // 시대별 추가 장애물: 과거 1의 좌대와 서쪽 구석의 봉헌 선반(거울 곁 사각지대 —
  // 빛이 물리적으로 닿지 못하는 곳은 걷지 못하게 막는다, 명세 4장의 규정),
  // 현재의 돌무더기.
  eraObstacles: {
    P1: [
      { x0: -2.68, x1: -2.32, z0: -1.98, z1: -1.62 },
      { x0: -7.5, x1: -6.35, z0: -3, z1: -1.1 },
      { x0: -7.5, x1: -6.35, z0: 1.1, z1: 3 },
    ],
    PRESENT: [{ x0: -3.1, x1: -1.9, z0: -2.4, z1: -1.2 }],
  },
  validate: { cellSize: 0.25 },
};

export function mirrorLevelOf(which) {
  const mdef = which === 'A' ? LV.mirrorA : LV.mirrorB;
  return { mirror: { ...LV.mirror, rail: [mdef.pos, mdef.pos], yawRangeDeg: mdef.yawRangeDeg } };
}

// 시대별 보행. 과거 1: 방1만(문 봉인). 과거 2: 양쪽(통로 열림).
// 현재: 문이 열리기 전엔 방1만, 열린 뒤 양쪽.
export function walkableEra(era, doorOpen = false) {
  const R = LV.rooms, m = LV.margin;
  const passable = era === 'P2' || (era === 'PRESENT' && doorOpen);
  return (x, z) => {
    if (x < R.x0 + m || x > R.x1 - m || z < R.z0 + m || z > R.z1 - m) return false;
    if (x > R.wallX0 - m && x < R.wallX1 + m) {
      if (!passable) return false;
      if (z < LV.doorway.z0 + 0.1 || z > LV.doorway.z1 - 0.1) return false;
    }
    if (era === 'P1' && x > R.wallX0 - m) return false;          // 봉인 너머 금지
    if (era === 'PRESENT' && !doorOpen && x > R.wallX0 - m) return false;
    for (const o of LV.obstacles) {
      if (x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m) return false;
    }
    for (const o of (LV.eraObstacles[era] || [])) {
      if (x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m) return false;
    }
    return true;
  };
}

// 시대별 개구. 과거 1: 없음(빈 구간 — 빛이 벽을 넘지 못한다). 과거 2: 열린 통로.
export function apertureEra(era) {
  if (era === 'P1') return { x: 0, z0: 0, z1: -1, y0: 0, y1: -1 };   // 공집합
  if (era === 'P2') return LV.doorway;
  return null;
}
