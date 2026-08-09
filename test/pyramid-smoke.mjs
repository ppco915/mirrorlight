// test/pyramid-smoke.mjs — 문제 1 스모크.
import { buildPyramidScenes } from '../src/pyramid/scenes.js';
import {
  bindRefs, state, carried, key1SealedP2, applyDerivation,
  Key1, JewelP2, setKey1, setJewelsP2,
} from '../src/pyramid/causal.js';
import { LV, walkableEra, apertureEra } from '../src/pyramid/level.js';
import { throughAperture, insideConeAp, mirrorParams } from '../src/conemath.js';

let fails = 0;
const ok = (cond, name) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); if (!cond) fails++; };

// 1) 개구: 과거 1은 공집합(감금), 과거 2는 열린 통로
const m = mirrorParams(LV.mirror);
const origin = { x: -7, y: 0.9, z: 0 };
ok(!throughAperture(origin, apertureEra('P1'), { x: 3, y: 0.9, z: 0 }), 'P1: 빛이 벽을 넘지 못한다');
ok(throughAperture(origin, apertureEra('P1'), { x: -2.5, y: 0.5, z: -1.8 }), 'P1: 같은 방은 통과');
ok(throughAperture({ x: 7, y: 0.9, z: 0 }, apertureEra('P2'), { x: -2, y: 0.5, z: 0.2 }), 'P2: 열린 통로 통과');
ok(insideConeAp({ x: -7, z: 0, yawDeg: -22 }, m, apertureEra('P1'), { x: -2.5, y: 0.45, z: -1.8 }),
  'P1 원뿔: 좌대 도달');

// 2) 씬/refs 계약
const { scenes, refs, hot } = buildPyramidScenes();
ok(scenes.P1 && scenes.P2 && scenes.PRESENT, 'scenes: 세 시대');
ok(refs.p1.key && refs.p1.brick && refs.p1.backWindow, 'refs.p1 계약');
ok(refs.p2.jewels && refs.p2.backWindow, 'refs.p2 계약');
ok(refs.present.glint && refs.present.sandTrace && refs.present.doorGroup && refs.present.bodyMesh, 'refs.present 계약');
ok(hot.P1.length >= 5 && hot.P2.length >= 2 && hot.PRESENT.length >= 5, 'hot 등록');

// 3) 열쇠 1 세계선: 매몰의 파생 (이중 존재 금지)
bindRefs(refs);
ok(refs.present.glint.visible, '초기: 돌무더기 틈의 금빛 (매몰 — 보이나 못 꺼낸다)');
ok(!key1SealedP2(), '초기: 과거 2 미봉인');
setKey1({ type: Key1.CARRIED });
ok(carried() === 'key1' && key1SealedP2(), '집는 순간: 소지 + 상류 봉인');
ok(!refs.present.glint.visible, '금빛 소멸 — 열쇠는 하나의 세계선');
setKey1({ type: Key1.FLOOR, x: -5.0, z: 0.5 });
ok(refs.present.sandTrace.visible, '노출 방치: 현재엔 모래 자국뿐');
setKey1({ type: Key1.CARRIED });
setKey1({ type: Key1.BRICK });
ok(!refs.present.sandTrace.visible && !refs.present.glint.visible, '벽돌 은닉: 흔적 없음');
setKey1({ type: Key1.RETRIEVED });
state.doorOpen = true;
applyDerivation();
ok(Math.abs(refs.present.doorGroup.rotation.y + 1.7) < 1e-9, '문 열림 파생');
state.doorOpen = false;
applyDerivation();

// 4) 과거 2 실험장
setJewelsP2({ type: JewelP2.CARRIED });
ok(carried() === 'jewels', 'P2 가슴장식 소지');
setJewelsP2({ type: JewelP2.ALTAR });

// 5) 시대별 보행
ok(!walkableEra('P1')(1.0, 0), 'P1: 봉인 너머 금지');
ok(!walkableEra('PRESENT', false)(1.0, 0), '현재: 문 열리기 전 방2 금지');
ok(walkableEra('PRESENT', true)(1.0, 0), '현재: 문 열린 뒤 방2 통행');
ok(walkableEra('P2')(0, 0), 'P2: 열린 통로');
ok(!walkableEra('P1')(-6.9, 2.0), 'P1: 거울 곁 사각지대 비보행(선반)');
ok(!walkableEra('PRESENT')( -2.5, -1.8), '현재: 돌무더기 비보행');

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
process.exit(fails ? 1 : 0);
