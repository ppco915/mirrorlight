// test/pyramid-smoke.mjs — 문제 1 스모크.
import { buildPyramidScenes } from '../src/pyramid/scenes.js';
import {
  bindRefs, state, carried, key1SealedP2, applyDerivation,
  Key1, JewelP2, Chisel, Pin, VAULT_OPEN,
  setKey1, setJewelsP2, setChisel, sealChiselP2, setPin,
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
ok(!walkableEra('PRESENT')(-4.2, -0.9), '현재: 돌무더기 비보행');

// 7) 문제 2: 끌 세계선 · 회반죽 상태 흐름 · 금고 파생
setChisel({ type: Chisel.CARRIED });
ok(carried() === 'chisel', '끌 소지 = 한 손 규칙');
setChisel({ type: Chisel.HEARTH });
ok(refs.p2.chisel.visible === false, '화덕에 넣은 끌: P2 표시 이탈');
sealChiselP2();
setChisel({ type: Chisel.CARRIED });
state.plasterOpen = true;
applyDerivation();
ok(!refs.p1.plaster.visible && !refs.present.nichePlaster.visible, 'S: 벽감 개방이 현재까지 흐른다');
ok(refs.present.rosette.visible, '현재: 드러난 로제트');
setChisel({ type: Chisel.P1FLOOR, x: -3.0, z: 0.0 });
ok(refs.p1.pinInNiche.visible, '개방된 벽감 속 핀 표시');
setPin({ type: Pin.CARRIED });
state.vaultOpenP1 = true;
applyDerivation();
ok(Math.abs(refs.present.vaultDoor.rotation.y - VAULT_OPEN) < 1e-9, 'P1 금고 개방 → 현재 금고도 열림(도굴 노출)');
state.vaultOpenP1 = false;
applyDerivation();
setPin({ type: Pin.BRICK });
setPin({ type: Pin.RETRIEVED });
state.scarabTaken = true;
applyDerivation();
ok(Math.abs(refs.present.vaultDoor.rotation.y - VAULT_OPEN) < 1e-9, '현재 개방: 스카라베 회수 후 금고 열림');
ok(!refs.present.scarab.visible && !refs.present.pectoralInVault.visible, '회수 후 감실은 빈다');
state.scarabTaken = false;
state.vaultOpenNow = true;
applyDerivation();
ok(refs.present.scarab.visible && refs.present.pectoralInVault.visible, '현재 금고 개방 → 봉헌물이 감실에 드러난다');
state.vaultOpenNow = false;
state.scarabTaken = true;
applyDerivation();
ok(!refs.p1.plaster.visible, '일방향 상태 유지');

// 8) 문제 3: 벽화 데이터 · 목걸이/가짜 문 파생
const { muralData } = await import('../src/pyramid/mural.js');
{
  const a = muralData(), b = muralData();
  ok(JSON.stringify(a) === JSON.stringify(b), '벽화: 결정론 (게임과 문이 같은 답)');
  ok(new Set(a.code).size === 3, '벽화: 코드 세 글리프 서로 다름');
}
state.pectoralOwned = true;
state.collarSeated = true;
applyDerivation();
ok(refs.present.collarSeatedMesh.visible, '목걸이 안착: 벽화에 표시');
ok(refs.present.glyphMarks.every((m) => m.visible), '구슬 세 글리프 표식 점등');
state.scarabSeated = true;
applyDerivation();
ok(refs.present.scarabSeatedMesh.visible, '풍뎅이 소켓 안착 표시');
state.escaped = true;
applyDerivation();
ok(Math.abs(refs.present.falseDoorSlab.position.x - (refs.present.falseDoorHomeX + 1.35)) < 1e-9,
  '가짜 문 개방: 석판이 벽 속으로');

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
process.exit(fails ? 1 : 0);
