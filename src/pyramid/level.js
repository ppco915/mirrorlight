// pyramid/level.js — 《쌍거울의 무덤》 무대 수치.
// 두 방(서: 전실, 동: 매장실), 가운데 돌벽. 거울 A(서쪽 끝, 도굴의 밤 ROB)와
// 거울 B(동쪽 끝, 봉인의 날 SEAL)가 서로를 마주 본다 — 회전만 가능, 이동 불가.
// 시대별 통로: SEAL은 열린 문(개구 大), ROB은 도굴꾼의 파공(개구 小·바닥 높이),
// PRESENT는 부서져 열린 통로. 빛은 개구를 통해서만 벽을 건넌다.

export const LV = {
  rooms: { x0: -7.5, x1: 7.5, z0: -3, z1: 3, wallX0: -0.25, wallX1: 0.25 },
  margin: 0.3,
  wallX: 0,
  doorway: { x: 0, z0: -0.6, z1: 0.6, y0: 0, y1: 2.0 },     // SEAL 개구 + 보행
  breach: { x: 0, z0: -0.55, z1: 0.05, y0: 0, y1: 0.9 },    // ROB/PRESENT 개구 + 보행
  mirror: { halfWidth: 0.5, halfHeight: 0.9, coneLength: 15, spreadAngleDeg: 15, centerY: 0.9 },
  mirrorA: { pos: [-7.0, 0], yawRangeDeg: [-50, 50], era: 'ROB' },
  mirrorB: { pos: [7.0, 0], yawRangeDeg: [130, 230], era: 'SEAL' },
  spawn: { start: 0.6, max: 1.4, step: 0.1 },
  props: {
    crypt: [4.5, 0.45, -0.35],       // 제단 밑 보물 크립트 (파공 쐐기 안)
    alcove: [-2.8, 1.1, -2.9],       // 봉헌 벽감 — 여는 봉의 정위치 (전실)
    block: [-5.5, 0.05, 2.3],        // 들뜬 바닥돌 — 도굴꾼이 놓친 유일한 은닉처
    urnB: [5.3, 0.4, -0.6],          // 장식 항아리 (매장실, 유혹용 실패 경로)
    urnA: [-5.8, 0.4, -2.2],         // 장식 항아리 (전실)
  },
  obstacles: [
    { name: 'altar', x0: 4.15, x1: 4.85, z0: -0.7, z1: 0.0 },
    { name: 'urnB', x0: 5.05, x1: 5.55, z0: -0.85, z1: -0.35 },
    { name: 'urnA', x0: -6.05, x1: -5.55, z0: -2.45, z1: -1.95 },
    { name: 'mirrorA', x0: -7.45, x1: -6.7, z0: -0.4, z1: 0.4 },
    { name: 'mirrorB', x0: 6.7, x1: 7.45, z0: -0.4, z1: 0.4 },
  ],
  validate: { cellSize: 0.25 },
};

export function mirrorLevelOf(which) {
  const mdef = which === 'A' ? LV.mirrorA : LV.mirrorB;
  return {
    mirror: {
      ...LV.mirror,
      rail: [mdef.pos, mdef.pos],            // 퇴화 레일 = 위치 고정, 요만 가변
      yawRangeDeg: mdef.yawRangeDeg,
    },
  };
}

// 시대별 보행 판정. 두 방 + 시대별 통로 − 장애물.
export function walkableEra(era) {
  const R = LV.rooms, m = LV.margin;
  const gap = era === 'SEAL' ? LV.doorway
    : era === 'ROB' ? LV.breach
      : { z0: LV.breach.z0, z1: LV.doorway.z1 };            // PRESENT: 부서져 넓게 열림
  return (x, z) => {
    if (x < R.x0 + m || x > R.x1 - m || z < R.z0 + m || z > R.z1 - m) return false;
    if (x > R.wallX0 - m && x < R.wallX1 + m) {             // 가운데 벽 지대
      if (z < gap.z0 + 0.1 || z > gap.z1 - 0.1) return false;
    }
    for (const o of LV.obstacles) {
      if (x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m) return false;
    }
    return true;
  };
}

export function apertureEra(era) {
  return era === 'SEAL' ? LV.doorway : era === 'ROB' ? LV.breach : null;
}
