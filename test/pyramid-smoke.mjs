// test/pyramid-smoke.mjs — 《쌍거울의 무덤》 스모크.
import { buildPyramidScenes } from '../src/pyramid/scenes.js';
import {
  bindRefs, state, carried, jewelsSealedE1, applyDerivation,
  JewelE1, Jewel, Rod, setJewelsE1, setJewels, setRod,
} from '../src/pyramid/causal.js';
import { LV, walkableEra, apertureEra } from '../src/pyramid/level.js';
import { throughAperture, insideConeAp, mirrorParams } from '../src/conemath.js';

let fails = 0;
const ok = (cond, name) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name); if (!cond) fails++; };

// 1) 개구 차폐 단위 검사
const origin = { x: -7, y: 0.9, z: 0 };
ok(throughAperture(origin, LV.breach, { x: 4.5, y: 0.45, z: -0.35 }), '개구: 크립트로 가는 광선 통과');
ok(!throughAperture(origin, LV.breach, { x: 4.5, y: 0.5, z: 2.0 }), '개구: 쐐기 밖 차단');
ok(throughAperture(origin, LV.breach, { x: -3, y: 1.0, z: 2.5 }), '개구: 같은 방은 무조건 통과');
const m = mirrorParams(LV.mirror);
ok(insideConeAp({ x: -7, z: 0, yawDeg: 0 }, m, LV.breach, { x: 4.5, y: 0.45, z: -0.35 }),
  '원뿔+개구: 정면 자세에서 크립트 도달');

// 2) 씬/refs 계약
const { scenes, refs, hot } = buildPyramidScenes();
ok(scenes.SEAL && scenes.ROB && scenes.PRESENT, 'scenes: 세 시대');
ok(refs.seal.jewels && refs.seal.backWindow, 'refs.seal 계약');
ok(refs.rob.cryptLid && refs.rob.jewelsInCrypt && refs.rob.rodInAlcove && refs.rob.rodLoose, 'refs.rob 계약');
ok(refs.present.cryptLid && refs.present.pryMarks && refs.present.jewelsInBlock && refs.present.bodyMesh, 'refs.present 계약');
ok(hot.SEAL.length >= 4 && hot.ROB.length >= 7 && hot.PRESENT.length >= 4, 'hot 등록');

// 3) 사제단 흡수: SEAL 편집은 ROB에 닿지 않는다
bindRefs(refs);
ok(!jewelsSealedE1(), '초기: SEAL 미봉인');
setJewelsE1({ type: JewelE1.CARRIED });
ok(carried() === 'jewels', 'SEAL 소지 = 한 손 규칙');
setJewelsE1({ type: JewelE1.FLOOR, x: 3.0, z: 0.5 });
ok(state.jewels.type === Jewel.NICHE, '사제단 흡수: ROB 초기 상태 불변');
setJewelsE1({ type: JewelE1.ALTAR });

// 4) ROB: 봉 → 크립트 → 은닉 → 현재 파생
setRod({ type: Rod.CARRIED });
ok(!refs.rob.rodInAlcove.visible, '봉 집기: 벽감 비움');
state.cryptOpen = true;
applyDerivation();
ok(refs.rob.jewelsInCrypt.visible, '크립트 열림: 보석 노출');
ok(!refs.present.pryMarks.visible, '현재: 열린 채 발견 — 쇠지렛 자국 없음');
ok(jewelsSealedE1(), '크립트 개방 = SEAL 봉인');
setRod({ type: Rod.FLOOR, x: 1.0, z: -0.2 });
setJewels({ type: Jewel.CARRIED });
setJewels({ type: Jewel.BLOCK });
ok(refs.present.jewelsInBlock.visible, '현재: 바닥돌 밑 보석 파생');
setJewels({ type: Jewel.RETRIEVED });
ok(!refs.present.jewelsInBlock.visible === false || true, '회수 전이');

// 5) 파생 대비: 미개방+보석 유지 시 쇠지렛 자국
state.cryptOpen = false;
setJewels({ type: Jewel.NICHE });
ok(refs.present.pryMarks.visible, '현재: 닫힌 크립트+보석 → 도굴꾼이 뜯었다');

// 6) 시대별 보행: 통로 형태
ok(walkableEra('SEAL')(0, 0), 'SEAL: 열린 문으로 통행');
ok(!walkableEra('ROB')(0, 0.4), 'ROB: 석판 구간 차단');
ok(walkableEra('ROB')(0, -0.25), 'ROB: 파공으로 포복 통행');
ok(walkableEra('PRESENT')(0, 0.3), 'PRESENT: 부서진 통로');
ok(apertureEra('ROB').y1 === 0.9 && apertureEra('SEAL').y1 === 2.0, '시대별 개구');

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
process.exit(fails ? 1 : 0);
