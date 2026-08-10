// test/pyramid-smoke.mjs — 문제 1 스모크.
import { buildPyramidScenes } from '../src/pyramid/scenes.js';
import {
  bindRefs, state, carried, carriedAll, key1SealedP2, applyDerivation,
  Key1, JewelP2, Chisel, Pin, VAULT_OPEN,
  setKey1, setJewelsP2, setChisel, sealChiselP2, setPin, dropPresent, takePresent,
} from '../src/pyramid/causal.js';
import { LV, walkableEra, apertureEra } from '../src/pyramid/level.js';
import { nextHint } from '../src/pyramid/hints.js';
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
ok(refs.present.sandTrace && refs.present.doorGroup && refs.present.bodyMesh, 'refs.present 계약');
ok(hot.P1.length >= 5 && hot.P2.length >= 2 && hot.PRESENT.length >= 5, 'hot 등록');

// 3) 열쇠 1 세계선: 매몰의 파생 (이중 존재 금지)
bindRefs(refs);
ok(state.key1.type === Key1.PEDESTAL, '초기: 열쇠는 돌무더기 아래 (매몰 — 이펙트 없이 문구로만)');
ok(!key1SealedP2(), '초기: 과거 2 미봉인');
setKey1({ type: Key1.CARRIED });
ok(carried() === 'key1' && key1SealedP2(), '집는 순간: 소지 + 상류 봉인');
setKey1({ type: Key1.FLOOR, x: -5.0, z: 0.5 });
ok(refs.present.sandTrace.visible, '노출 방치: 현재엔 모래 자국뿐');
setKey1({ type: Key1.CARRIED });
setKey1({ type: Key1.BRICK });
ok(!refs.present.sandTrace.visible, '벽돌 은닉: 흔적 없음');
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
ok(carriedAll().includes('chisel'), '끌 소지');
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
ok(Math.abs(refs.present.falseDoorHinge.rotation.y - 1.9) < 1e-9,
  '가짜 문 개방: 경첩 회전 (1번방 돌문과 동일한 여닫이 문법)');
{ // 젖혀진 석판은 벽면(z=3) 뒤 복도 안에 있다 — 조준 강조가 벽에 번지지 않게
  refs.present.falseDoorSlab.parent.updateMatrixWorld(true);
  const wp = refs.present.falseDoorSlab.getWorldPosition(new (refs.present.falseDoorSlab.position.constructor)());
  ok(wp.z > 3.0, '개방된 석판은 벽면 너머 복도 쪽에 있다');
}

// 9) 손의 규칙은 시대와 무관하게 하나다 — 현재의 소지품도 골라 들고 내려놓는다
state.escaped = false; state.scarabSeated = false; state.collarSeated = false;
state.pectoralOwned = false; state.scarabTaken = false; state.doorOpen = false;
setChisel({ type: Chisel.P2SPOT });
setJewelsP2({ type: JewelP2.ALTAR });
setKey1({ type: Key1.RETRIEVED });
setPin({ type: Pin.RETRIEVED });
applyDerivation();
ok(carriedAll().includes('key1') && carriedAll().includes('pin'),
  '현재: 되찾은 물건이 손에 든 목록에 들어간다');
ok(carried() !== null, '현재: 소지품이 있으면 거울을 건널 수 없다 (carried 판정)');
dropPresent('key1', -5.0, 1.0);
applyDerivation();
ok(!carriedAll().includes('key1'), '현재: 내려놓으면 손에서 빠진다');
ok(refs.present.keyLoose.visible
  && Math.abs(refs.present.keyLoose.position.x + 5.0) < 1e-9, '현재: 바닥의 열쇠가 그 자리에 놓인다');
takePresent('key1');
applyDerivation();
ok(carriedAll().includes('key1') && !refs.present.keyLoose.visible, '현재: 다시 집으면 손으로 돌아온다');
state.doorOpen = true;
applyDerivation();
ok(!carriedAll().includes('key1'), '자물쇠에 쓴 열쇠는 손에서 사라진다 (소모)');
state.doorOpen = false;

// 10) 힌트 사다리 — 진행 단계마다 「지금 걸린 것」이 바뀐다
state.doorOpen = false; state.presentBrickOut = false;
setKey1({ type: Key1.PEDESTAL });
applyDerivation();
const hStart = nextHint();
setKey1({ type: Key1.CARRIED });
applyDerivation();
const hCarry = nextHint();
setKey1({ type: Key1.BRICK });
applyDerivation();
const hSealed = nextHint();
ok(hStart && hCarry && hSealed, '힌트: 문제 1의 각 단계에 할 말이 있다');
ok(hStart !== hCarry && hCarry !== hSealed, '힌트: 단계가 바뀌면 다른 것을 짚는다');
setKey1({ type: Key1.RETRIEVED });
state.doorOpen = true;
applyDerivation();
ok(nextHint() !== hSealed, '힌트: 문이 열리면 다음 문제로 넘어간다');
state.scarabTaken = true; state.pectoralOwned = true;
state.collarSeated = true; state.scarabSeated = true;
applyDerivation();
const hLast = nextHint();
state.escaped = true;
applyDerivation();
ok(hLast && nextHint() === null, '힌트: 탈출한 뒤에는 짚어 줄 것이 없다');
state.escaped = false; state.scarabTaken = false; state.collarSeated = false;
state.scarabSeated = false; state.pectoralOwned = false; state.doorOpen = false;
applyDerivation();

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
process.exit(fails ? 1 : 0);
