// conemath.js — 원뿔(빛의 법) 순수 기하. three.js 의존 없음.
// 게임(cone.js)과 검증(validate.js)이 동일한 판정을 공유하기 위한 단일 원천.
//
// 요(yaw) 규약: 도 단위 스칼라, 투사 방향 d = (cos yaw, 0, sin yaw).
//   yaw 270° = 북(-z), yawRangeDeg [150, 390] = 북 기준 ±120°.
//   범위가 360을 넘도록 연속 스칼라로 유지하여 클램프를 단순화한다.

export const DEG = Math.PI / 180;

export function dirFromYaw(yawDeg) {
  const a = yawDeg * DEG;
  return { x: Math.cos(a), z: Math.sin(a) };
}

export function mirrorParams(levelMirror) {
  return {
    halfWidth: levelMirror.halfWidth,
    halfHeight: levelMirror.halfHeight,
    coneLength: levelMirror.coneLength,
    spreadTan: Math.tan(levelMirror.spreadAngleDeg * DEG),
    centerY: levelMirror.centerY,
  };
}

// pose: {x, z, yawDeg} — 거울면 중심의 바닥 투영과 요.
// 반환: 거울 로컬 좌표 {x: 횡, y: 종, z: 투사축}.
export function toLocal(pose, m, p) {
  const d = dirFromYaw(pose.yawDeg);
  const rx = p.x - pose.x, rz = p.z - pose.z;
  return {
    z: rx * d.x + rz * d.z,
    x: -rx * d.z + rz * d.x,
    y: p.y - m.centerY,
  };
}

// 6.6절 insideCone의 순수 함수판. p는 월드 좌표 {x, y, z}.
export function insideCone(pose, m, p) {
  const l = toLocal(pose, m, p);
  if (l.z < 0 || l.z > m.coneLength) return false;
  const grow = l.z * m.spreadTan;
  return Math.abs(l.x) <= m.halfWidth + grow && Math.abs(l.y) <= m.halfHeight + grow;
}

// 분신 스폰 규칙(6.4-3 확장): 투사축을 따라 start(0.6m)부터 보행 가능 지점이
// 나올 때까지 전진하되 max(1.4m)에서 중단한다. 상한이 복귀 반경 1.5m보다 작아야
// "스폰은 됐는데 복귀 거리 밖" 소프트락이 구조적으로 불가능하다.
// 보행 불가면 null → 빙의 거부.
export function spawnPoint(pose, m, isWalkable, cfg = { start: 0.6, max: 1.4, step: 0.1 }) {
  const d = dirFromYaw(pose.yawDeg);
  for (let t = cfg.start; t <= cfg.max + 1e-9; t += cfg.step) {
    const x = pose.x + d.x * t, z = pose.z + d.z * t;
    if (isWalkable(x, z)) return { x, z, t };
  }
  return null;
}

// 레벨 데이터의 walk 블록으로 보행 판정 함수를 만든다.
// 검증과 게임 충돌이 같은 정의를 쓴다(4장: PAST의 z > southLimitZ는 비보행).
export function makeWalkable(level) {
  const hw = level.room.w / 2, hd = level.room.d / 2;
  const m = level.walk.margin, zMax = level.walk.southLimitZ;
  const obs = level.walk.obstacles.map((o) => ({
    x0: o.min[0] - m, x1: o.max[0] + m,
    z0: o.min[1] - m, z1: o.max[1] + m,
  }));
  return (x, z) => {
    if (Math.abs(x) > hw - m || z < -hd + m || z > zMax) return false;
    for (const o of obs) {
      if (x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1) return false;
    }
    return true;
  };
}
