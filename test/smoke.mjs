// test/smoke.mjs — 통합 스모크 테스트 (node, 브라우저 불필요).
//   npm test
// 씬/refs 계약, 관리인 파생(E1→E2), 의도 경로 전이, 봉인, 두 잠금 독립,
// E1 문 열쇠의 표시 전용 세계선(R6 불변), 포털/원뿔 기하.

import { readFileSync } from 'node:fs';
import { buildScenes } from '../src/scenes.js';
import {
  bindRefs, state, carried, elderKeySealed,
  KeyLoc, KeyE1, CrankE1, CrankE2, SmallKey,
  setKeyLoc, setKeyE1, setCrankE1, setCrankE2, setSmallKey,
} from '../src/causal.js';
import { MirrorPortal } from '../src/mirror.js';
import { mirrorImageLocal } from '../src/possession.js';
import { insideCone, spawnPoint, mirrorParams, makeWalkable } from '../src/conemath.js';
import * as THREE from 'three';

const level = JSON.parse(readFileSync(new URL('../level.json', import.meta.url), 'utf8'));
let fails = 0;
const ok = (cond, name) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); if (!cond) fails++; };

// 1) 씬 구성과 refs 계약 (4개 시간층)
const { scenes, refs, hot, colliders } = buildScenes(level);
ok(scenes.ELDER && scenes.PAST && scenes.PRESENT && scenes.RUIN, 'scenes: 네 시간층');
ok(refs.elder.crankOnDoor && refs.elder.crankLoose && refs.elder.doorKey && refs.elder.backWindow, 'refs.elder 계약');
ok(refs.past.key && refs.past.smallKeyInBoard && refs.past.crankInDrawer
  && refs.past.drawerContents && refs.past.drawerFront && refs.past.crankLoose, 'refs.past 계약');
ok(refs.present.crankGlint && refs.present.crankOutline && refs.present.doorCrankMounted
  && refs.present.drawerKeyGlint && refs.present.bodyMesh, 'refs.present 계약');
ok(refs.ruin.ashGlint && refs.ruin.brickCavity, 'refs.ruin 계약');
ok(hot.ELDER.length >= 7 && hot.PAST.length >= 12 && hot.PRESENT.length >= 7, 'hot 등록 수량');
ok(colliders.ELDER.length === 4 && colliders.PAST.length === 4 && colliders.PRESENT.length === 4, '충돌 AABB');

// 2) E1 문 열쇠: 표시 전용 세계선 — 어디에 두든 E2는 걸이(R6 불변)
bindRefs(refs);
ok(!elderKeySealed() && refs.elder.doorKey.visible, '초기: E1 열쇠 걸이, 봉인 없음');
setKeyE1({ type: KeyE1.CARRIED });
ok(carried() === 'doorKey', 'E1 열쇠 소지 = 한 손 규칙 공유');
setKeyE1({ type: KeyE1.FLOOR, x: -0.5, z: 0.0 });
ok(state.keyLoc.type === KeyLoc.HOOK, 'R6: E1 열쇠를 옮겨도 E2는 걸이 그대로');
ok(refs.elder.doorKey.visible && Math.abs(refs.elder.doorKey.position.x + 0.5) < 1e-9, 'E1 열쇠 바닥 표시');
setKeyE1({ type: KeyE1.HOOK });

// 3) 관리인 파생: 부착물은 소실, 헐거운 것은 잠긴 서랍으로 (깔때기)
ok(state.crankE2.type === CrankE2.NONE && refs.elder.crankOnDoor.visible, '초기: 크랭크 장착, E2 부재');
ok(!refs.ruin.ashGlint.visible, '초기: 폐허 잿더미에 광택 없음');
setCrankE1({ type: CrankE1.CARRIED });
ok(state.crankE2.type === CrankE2.DRAWER, '뽑는 순간 깔때기: E2 서랍으로');
ok(refs.ruin.ashGlint.visible, '답안지: 잿더미 놋쇠 광택 등장');
setCrankE1({ type: CrankE1.FLOOR, x: -0.5, z: 0.2 });
ok(refs.elder.crankLoose.visible && state.crankE2.type === CrankE2.DRAWER, 'E1 바닥에 남겨도 깔때기 유지');
setCrankE1({ type: CrankE1.MOUNTED });
ok(state.crankE2.type === CrankE2.NONE && !refs.ruin.ashGlint.visible, '봉인 전 재장착 가역');

// 4) 의도 경로: 뽑기 → E2 서랍 → 해정 → 벽돌 → 회수
setCrankE1({ type: CrankE1.CARRIED });
setCrankE1({ type: CrankE1.FLOOR, x: -0.5, z: 0.2 });
setSmallKey({ type: SmallKey.CARRIED });
ok(carried() === 'smallKey', '한 손 규칙: 작은 열쇠 소지');
state.drawerUnlockedE2 = true;
setSmallKey({ type: SmallKey.FLOOR, x: -2.2, z: -0.8 });
ok(refs.past.smallKeyInBoard.visible, 'E2 바닥의 작은 열쇠 표시');
setCrankE2({ type: CrankE2.CARRIED });
ok(state.crankSealedE1, 'E2에서 만지면 E1 봉인');
setCrankE2({ type: CrankE2.BRICK });
ok(refs.ruin.brickCavity.visible, '답안지: 폐허 벽돌 열림');
setCrankE2({ type: CrankE2.RETRIEVED });
ok(!refs.present.crankGlint.visible, '회수 후 틈새 광택 없음');

// 5) 두 잠금 독립: 크랭크 먼저 끼워도 성립 (게이트 없음)
state.boltMounted = true;
ok(!state.doorUnlocked && state.boltMounted, '빗장 먼저 해제 가능 (순서 자유)');
ok(refs.present.doorCrankMounted, '장착 크랭크 메시 참조 존재');

// 6) 노출 방치 파생 + 1장 회귀
setCrankE2({ type: CrankE2.FLOOR, x: 1.0, z: 0.3 });
ok(refs.past.crankLoose.visible && refs.present.crankOutline.visible, '노출 크랭크: 현재 윤곽 데칼');
setKeyLoc({ type: KeyLoc.CARRIED });
ok(elderKeySealed(), 'E2 열쇠를 만지면 E1 인스턴스 봉인 (단조)');
setKeyLoc({ type: KeyLoc.BRICK });
setKeyLoc({ type: KeyLoc.RETRIEVED });
ok(state.sealed && refs.past.key.visible, '1장: 회수·봉인 그대로');

// 7) 포털/원뿔 기하
const m = mirrorParams(level.mirror);
const walkable = makeWalkable(level);
const A = new MirrorPortal(level, () => scenes.PAST, { hotId: 'mirror' });
A.setPose(1.7, 500);
ok(A.railT === 1 && A.yawDeg === 390, '포털 A: 클램프');
const bPose = { x: level.mirrorB.pos[0], z: level.mirrorB.pos[1], yawDeg: level.mirrorB.yawDeg };
const B = new MirrorPortal(level, () => scenes.ELDER, { hotId: 'mirrorB', covered: true, fixedPose: bPose });
B.setPose(0.2, 300);
ok(B.pose.x === bPose.x && B.pose.yawDeg === bPose.yawDeg, '포털 B: 고정 자세 불변');
B.uncover();
ok(!B.covered && !B.cloth.visible, '포털 B: 천 걷기 (게이트 없음)');
ok(insideCone(bPose, m, { x: 0, y: 1.0, z: -2.85 }), 'B 원뿔: 문 포함');
ok(!insideCone(bPose, m, { x: 3.55, y: 0.7, z: 0.9 }), 'B 원뿔: 벽난로 제외');
ok(!!spawnPoint(bPose, m, walkable, level.spawn), 'B 원뿔: 스폰 성립');

// 8) 본체의 상: 유리 저편(-z)에, 유리 폭 안에 맺힌다 (유령 시점 버그 회귀 방지)
{
  const bw = new THREE.Group();
  bw.position.set(-1.0, 0, 2.6);
  bw.rotation.y = Math.atan2(0, -1);           // 북향 거울
  bw.updateMatrixWorld(true);
  const img = mirrorImageLocal(bw, new THREE.Vector3(2.0, 0, 1.2));
  ok(img.z < 0, '본체 상: 유리 저편(-z)');
  ok(Math.abs(img.x) <= 0.35 + 1e-9, '본체 상: 유리 폭 안으로 클램프');
}

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
process.exit(fails ? 1 : 0);
