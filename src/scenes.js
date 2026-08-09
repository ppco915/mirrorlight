// scenes.js — 네 시간층 씬. ELDER(25년 전) / PAST(10년 전) / PRESENT / RUIN.
// 같은 좌표계, 드레싱만 다르다. 시대 정렬의 증거(못 자국, 회반죽 부스러기,
// 문고리 윤곽, 화분의 성장)는 정적 드레싱 차이로 배치한다.

import * as THREE from 'three';
import { plankTexture, plasterTexture, tiled } from './textures.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function makeScene(bg) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(bg);
  return s;
}

// 거울 시대(ELDER/PAST)는 DoubleSide (6.5절: 투영 반전이 winding을 뒤집으므로)
function matFor(mirrorEra) {
  return (color, extra = {}) => new THREE.MeshLambertMaterial({
    color, side: mirrorEra ? THREE.DoubleSide : THREE.FrontSide, ...extra,
  });
}

function box(w, h, d, material, x, y, z, hotId) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (hotId) m.userData.hot = hotId;
  return m;
}

function shell(scene, M, { floor, wall, ceil, wallH = 2.6, perWallH = null, ceiling = true }) {
  // 텍스처는 흰색 근처의 회색조이므로 시대별 color가 색조를 그대로 정한다.
  // 반복 횟수는 미터당 텍셀 밀도를 맞춘 값 — 바닥 한 타일 = 2m×2m(널빤지 폭 25cm).
  const f = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), M(floor, { map: tiled(plankTexture(), 4, 3) }));
  f.rotation.x = -Math.PI / 2;
  scene.add(f);
  if (ceiling) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), M(ceil, { map: tiled(plasterTexture(), 4, 3) }));
    c.rotation.x = Math.PI / 2; c.position.y = wallH;
    scene.add(c);
  }
  const walls = [
    ['N', 8, [0, -3], 0], ['S', 8, [0, 3], Math.PI],
    ['E', 6, [4, 0], -Math.PI / 2], ['W', 6, [-4, 0], Math.PI / 2],
  ];
  for (const [name, w, p, ry] of walls) {
    const h = perWallH?.[name] ?? wallH;
    if (h <= 0) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M(wall, { map: tiled(plasterTexture(), w / 2, h / 2) }));
    m.position.set(p[0], h / 2, p[1]); m.rotation.y = ry;
    scene.add(m);
  }
}

function makeKey(M, hotId, color = 0xd8b84a) {
  const g = new THREE.Group();
  const met = M(color);
  const shaft = box(0.035, 0.16, 0.018, met, 0, -0.05, 0);
  const tooth = box(0.05, 0.035, 0.018, met, 0.03, -0.11, 0);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.012, 8, 16), met);
  bow.position.y = 0.05;
  g.add(shaft, tooth, bow);
  if (hotId) g.traverse((o) => { o.userData.hot = hotId; });
  return g;
}

function makeCrank(M, hotId) {
  // ㄴ자 놋쇠 크랭크: 축 + 팔 + 손잡이
  const g = new THREE.Group();
  const brass = M(0xc9a437);
  const shaft = box(0.05, 0.05, 0.16, brass, 0, 0, 0.06);
  const arm = box(0.05, 0.16, 0.05, brass, 0, -0.06, 0.14);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 8), brass);
  grip.position.set(0, -0.14, 0.14);
  grip.rotation.x = Math.PI / 2;
  g.add(shaft, arm, grip);
  if (hotId) g.traverse((o) => { o.userData.hot = hotId; });
  return g;
}

function makeStatue(M) {
  const g = new THREE.Group();
  const grey = M(0x8f8f9a);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.15, 10), grey);
  body.position.y = 0.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), grey);
  head.position.y = 1.34;
  g.add(body, head);
  return g;
}

function makeFireplace(M, bodyColor, brickColor, hotId, { flush = false } = {}) {
  const g = new THREE.Group();
  const main = box(0.6, 1.5, 1.1, M(bodyColor), 3.75, 0.75, 0.9);
  const hearth = box(0.18, 0.5, 0.5, M(0x120c08), 3.44, 0.3, 0.9);
  const mantel = box(0.7, 0.06, 1.2, M(bodyColor), 3.72, 1.05, 0.9);
  // flush=참이면 벽돌이 벽면과 같은 면 (E1: 회반죽으로 단단히 밀봉)
  const loose = box(0.16, 0.12, 0.26, M(brickColor), flush ? 3.5 : 3.44, 0.7, 0.9, hotId);
  const cavity = box(0.14, 0.13, 0.27, M(0x0a0705), 3.5, 0.7, 0.9);
  cavity.visible = false;
  g.add(main, hearth, mantel, loose, cavity);
  return { group: g, loose, cavity, home: V3(3.44, 0.7, 0.9) };
}

function makeDoor(M, color, hotId, { knocker = false, outline = false, bolt = false } = {}) {
  const g = new THREE.Group();
  g.position.set(-0.5, 0, -2.93);
  const panel = box(1.0, 2.15, 0.08, M(color), 0.5, 1.075, 0, hotId);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), M(0xc9b26a));
  knob.position.set(0.85, 1.05, 0.07);
  if (hotId) knob.userData.hot = hotId;
  g.add(panel, knob);
  const parts = { group: g };
  if (knocker) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16), M(0xc9a437));
    ring.position.set(0.5, 1.5, 0.06);
    if (hotId) ring.userData.hot = hotId;
    g.add(ring);
  }
  if (outline) {
    // 사라진 문고리의 옅은 윤곽 + 나사 구멍 (약탈의 증거)
    const pale = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16),
      new THREE.MeshBasicMaterial({ color: 0x8a7f6a }));
    pale.position.set(0.5, 1.5, 0.051);
    pale.userData.hot = 'doorOutline';
    g.add(pale);
    for (const dy of [0.065, -0.065]) {
      const holeDot = new THREE.Mesh(new THREE.CircleGeometry(0.009, 6),
        new THREE.MeshBasicMaterial({ color: 0x2a241c }));
      holeDot.position.set(0.5, 1.5 + dy, 0.052);
      g.add(holeDot);
    }
  }
  if (bolt) {
    // 실내 쪽 빗장 + 빈 사각 축 구멍 (게임 시작부터 보이는 목표물)
    const bar = box(0.6, 0.07, 0.05, M(0x4a4640), 0.28, 0.75, 0.08, hotId);
    const socket = box(0.07, 0.07, 0.06, M(0x201c16), 0.62, 0.75, 0.085, hotId);
    g.add(bar, socket);
    parts.bolt = bar;
    parts.socket = socket;
  }
  return parts;
}

function coneMesh(r, h, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), material);
  m.position.set(x, y, z);
  return m;
}

function makePlant(M, scale, x, z) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.16, 8), M(0x7a4a30));
  pot.position.set(x, 0.58, z);
  pot.userData.hot = 'plant';
  const bush = coneMesh(0.14 * scale, 0.42 * scale, M(0x3f6b34), x, 0.66 + 0.21 * scale, z);
  bush.userData.hot = 'plant';
  g.add(pot, bush);
  return g;
}

function makeCoveredMirror(M, x, z, yawRad) {
  const g = new THREE.Group();
  g.add(box(1.05, 1.98, 0.4, M(0xcfc8b8), 0, 0.99, 0));
  g.position.set(x, 0, z);
  g.rotation.y = yawRad;
  return g;
}

function makeBackWindow(M) {
  // 빙의 중 뒤돌아볼 때의 「유리 저편」 합성물: 틀 + 어두운 유리 + 본체 조각상
  const bw = new THREE.Group();
  bw.add(box(1.1, 1.9, 0.06, M(0x2a2118), 0, 0.95, -0.04));
  const dark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 1.75),
    new THREE.MeshBasicMaterial({ color: 0x0a0d14, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  dark.position.y = 0.95;
  bw.add(dark);
  const statue = makeStatue(M);
  bw.add(statue);
  bw.visible = false;
  return { group: bw, statue };
}

export function buildScenes(level) {
  const refs = { elder: {}, past: {}, present: {}, ruin: {} };
  const hot = { ELDER: [], PAST: [], PRESENT: [] };
  const [mbx, , mbz] = level.props.protoMirror.pos;
  const a = level.mirrorB.yawDeg * Math.PI / 180;
  const mbYawRad = Math.atan2(Math.cos(a), Math.sin(a));
  const [plx, , plz] = level.props.plant.pos;

  // ═══════════════ ELDER (25년 전 — 관리인의 시대) ═══════════════
  const elder = makeScene(0x2a1c0c);
  {
    const M = matFor(true);
    shell(elder, M, { floor: 0x7a5638, wall: 0x9a7a58, ceil: 0x624832 });
    elder.add(box(3.4, 0.32, 0.36, M(0x584028), 0, 2.4, -0.2));   // 대들보: 천장에 온전
    // 문: 문고리 달림 + 빗장에 크랭크 장착
    const door = makeDoor(M, 0x7a5230, 'elderDoor', { knocker: true, bolt: true });
    elder.add(door.group);
    // 장착 크랭크: 문 앞으로 돌출 (로컬 +z가 방 안쪽 +z를 향하도록 무회전)
    const crankOnDoor = makeCrank(M, 'elderCrank');
    crankOnDoor.position.set(0.12, 0.75, -2.86);
    elder.add(crankOnDoor);
    // 관리인의 쪽지: 회수 규칙의 사전 증거 — 크랭크를 가지러 온 자리에서 읽게 된다
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.17),
      new THREE.MeshLambertMaterial({ color: 0xe8dfc0, side: THREE.DoubleSide }));
    note.position.set(-0.25, 1.35, -2.885);
    note.rotation.z = 0.06;
    note.userData.hot = 'elderNote';
    elder.add(note);
    refs.elder.crankOnDoor = crankOnDoor;
    // 걸이 + 문 열쇠 (2장 시점엔 봉인 상태)
    const hookBar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), M(0x666655));
    hookBar.rotation.x = Math.PI / 2 - 0.35;
    hookBar.position.set(-1.0, 1.4, -2.94);
    elder.add(hookBar);
    const elderDoorKey = makeKey(M, 'elderHookKey');
    elderDoorKey.position.set(-1.0, 1.33, -2.9);
    elder.add(elderDoorKey);
    refs.elder.doorKey = elderDoorKey;
    // 책상: 온전, 서랍 잠기지 않음
    elder.add(box(1.2, 0.75, 0.7, M(0x8a6238), -3.2, 0.375, -1.0));
    const drawer = box(0.05, 0.2, 0.5, M(0x9c744a), -2.58, 0.4, -1.0, 'elderDrawer');
    elder.add(drawer);
    // 마루장: 깨끗한 못, 밑엔 관리인의 여벌 열쇠(가죽끈) — 조사만 가능
    const board = box(0.8, 0.035, 0.6, M(0xa8845a), -0.8, 0.018, 1.0, 'elderBoard');
    elder.add(board);
    const spare = makeKey(M, 'elderBoard', 0x9a9284);
    spare.position.set(-0.8, 0.05, 1.0);
    spare.rotation.x = -Math.PI / 2;
    spare.visible = false;                       // 마루장 밑 — 들추면 텍스트로 답한다
    elder.add(spare);
    // 벽난로: 벽돌이 회반죽으로 밀봉(flush) + 부지깽이가 세워져 있다
    const fp = makeFireplace(M, 0x9a5a42, 0xb06a50, 'elderBrick', { flush: true });
    elder.add(fp.group);
    const poker = box(0.03, 0.9, 0.03, M(0x3a3a3a), 3.3, 0.45, 0.55, 'elderPoker');
    poker.rotation.z = 0.18;
    elder.add(poker);
    // 화분: 묘목 (성장의 화살표) · 남쪽 선반
    // 자기 자신(옛 거울)은 배치하지 않는다 — 재귀 렌더 금지, 「유리 저편」 합성물이 대신한다
    const plant = makePlant(M, 0.55, plx, plz);
    elder.add(plant);
    hot.ELDER.push(plant);
    elder.add(box(7.6, 0.5, 0.5, M(0x6e5234), 0, 0.25, 2.75));
    // 헐겁게 남긴 크랭크의 표시용 메시 (FLOOR 상태)
    const crankLoose = makeCrank(M, 'elderCrankLoose');
    crankLoose.visible = false;
    crankLoose.rotation.x = -Math.PI / 2;
    elder.add(crankLoose);
    refs.elder.crankLoose = crankLoose;
    // 유리 저편 합성물 (B 자세 고정)
    const bw = makeBackWindow(M);
    elder.add(bw.group);
    refs.elder.backWindow = bw.group;
    refs.elder.backStatue = bw.statue;
    // 조명: 황금빛, 손질된 방
    elder.add(new THREE.HemisphereLight(0xffe0b0, 0x4a3826, 0.7));
    const dir = new THREE.DirectionalLight(0xffd090, 0.5);
    dir.position.set(1.5, 2.4, 1);
    elder.add(dir);
    const fire = new THREE.PointLight(0xff9c50, 1.0, 7);
    fire.position.set(3.2, 1.0, 0.9);
    elder.add(fire);
    refs.elder.fireLight = fire;
    hot.ELDER.push(crankOnDoor, crankLoose, drawer, board, fp.loose, poker, door.group, note);
  }

  // ═══════════════ PAST (10년 전, E2 — 버려진 시대) ═══════════════
  const past = makeScene(0x201409);
  {
    const M = matFor(true);
    shell(past, M, { floor: 0x6b4a32, wall: 0x8a6a4f, ceil: 0x55402e });
    past.add(box(3.4, 0.32, 0.36, M(0x4a3524), 0, 2.4, -0.2));    // 대들보: 아직 천장에
    // 문: 문고리 사라짐(윤곽+나사 구멍), 빗장의 축 구멍은 비어 있다
    const door = makeDoor(M, 0x6a4526, 'pastDoor', { outline: true, bolt: true });
    past.add(door.group);
    // 걸이 + 문 열쇠 (1장 그대로)
    const hookBar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), M(0x555555));
    hookBar.rotation.x = Math.PI / 2 - 0.35;
    hookBar.position.set(-1.0, 1.4, -2.94);
    past.add(hookBar);
    refs.past.hookAnchor = V3(-1.0, 1.33, -2.9);
    const key = makeKey(M, 'pastKey');
    past.add(key);
    refs.past.key = key;
    // 책상 + 잠긴 서랍 (덜걱이는 소리) + 열면 보이는 내용물
    past.add(box(1.2, 0.75, 0.7, M(0x7a5636), -3.2, 0.375, -1.0));
    const drawerFront = box(0.05, 0.2, 0.5, M(0x8f6a42), -2.58, 0.4, -1.0, 'drawer');
    past.add(drawerFront);
    refs.past.drawerFront = drawerFront;
    refs.past.drawerHome = V3(-2.58, 0.4, -1.0);
    const contents = new THREE.Group();
    const pokerIn = box(0.03, 0.03, 0.45, M(0x4a4038), -2.52, 0.34, -1.0);
    contents.add(pokerIn);
    contents.visible = false;
    past.add(contents);
    refs.past.drawerContents = contents;
    const crankInDrawer = makeCrank(M, 'drawer');
    crankInDrawer.position.set(-2.5, 0.38, -0.85);
    crankInDrawer.rotation.set(-Math.PI / 2, 0, 1.1);
    crankInDrawer.visible = false;
    past.add(crankInDrawer);
    refs.past.crankInDrawer = crankInDrawer;
    // 마루장: 새 못과 오래된 못 자국(수선의 증거), 밑에 여벌 열쇠
    const board = box(0.8, 0.035, 0.6, M(0x9a7a4e), -0.8, 0.018, 1.0, 'board');
    past.add(board);
    for (const [nx, nz, fresh] of [[-1.05, 0.78, 1], [-0.55, 0.78, 1], [-1.05, 1.22, 0], [-0.55, 1.22, 1], [-0.9, 1.0, 0]]) {
      const nail = new THREE.Mesh(new THREE.CircleGeometry(fresh ? 0.012 : 0.009, 6),
        new THREE.MeshBasicMaterial({ color: fresh ? 0xc8c0a8 : 0x1c1710 }));
      nail.rotation.x = -Math.PI / 2;
      nail.position.set(nx, 0.038, nz);
      nail.userData.hot = 'boardNails';
      past.add(nail);
      hot.PAST.push(nail);
    }
    const smallKeyMesh = makeKey(M, 'pastSmallKey', 0x9a9284);
    smallKeyMesh.position.set(-0.8, 0.05, 1.15);
    smallKeyMesh.rotation.x = -Math.PI / 2;
    past.add(smallKeyMesh);
    refs.past.smallKeyInBoard = smallKeyMesh;
    // 벽난로: 벽돌 헐거움 + 아궁이에 회반죽 부스러기(성급한 수선의 증거)
    const fp = makeFireplace(M, 0x8a4a3a, 0xa85c46, 'brick');
    past.add(fp.group);
    refs.past.brickLoose = fp.loose;
    refs.past.brickHome = fp.home.clone();
    refs.past.brickAnchor = V3(3.36, 0.7, 0.9);
    for (const [cx, cz] of [[3.32, 0.72], [3.36, 0.95], [3.3, 1.1]]) {
      const chip = box(0.05, 0.02, 0.04, M(0xcfc4b0), cx, 0.06, cz, 'mortarChips');
      chip.rotation.y = cx * 7;
      past.add(chip);
      hot.PAST.push(chip);
    }
    // 화분: 다 자란 나무 (E1의 묘목과 같은 자리) · 남쪽 선반 · 덮인 옛 거울
    const plant = makePlant(M, 1.5, plx, plz);
    past.add(plant);
    hot.PAST.push(plant);
    past.add(box(7.6, 0.5, 0.5, M(0x5e452c), 0, 0.25, 2.75));
    past.add(makeCoveredMirror(M, mbx, mbz, mbYawRad));
    // E2에 노출 방치된 크랭크의 표시용 메시
    const crankLoose = makeCrank(M, 'pastCrank');
    crankLoose.visible = false;
    crankLoose.rotation.x = -Math.PI / 2;
    past.add(crankLoose);
    refs.past.crankLoose = crankLoose;
    // 유리 저편 합성물 (A 자세 가변)
    const bw = makeBackWindow(M);
    past.add(bw.group);
    refs.past.backWindow = bw.group;
    refs.past.backStatue = bw.statue;
    // 조명
    past.add(new THREE.HemisphereLight(0xffd2a0, 0x3a2c20, 0.55));
    const warmDir = new THREE.DirectionalLight(0xffc080, 0.45);
    warmDir.position.set(2, 2.4, 1);
    past.add(warmDir);
    const fire = new THREE.PointLight(0xff9040, 1.1, 7);
    fire.position.set(3.2, 1.0, 0.9);
    past.add(fire);
    refs.past.fireLight = fire;
    hot.PAST.push(key, drawerFront, crankInDrawer, board, smallKeyMesh, fp.loose, crankLoose, door.group);
  }

  // ═══════════════════════ PRESENT ═══════════════════════
  const present = makeScene(0x17181a);
  {
    const M = matFor(false);
    shell(present, M, { floor: 0x54504a, wall: 0x6b6660, ceil: 0x4a4642 });
    // 무너진 대들보 + 잔해
    const beam = box(3.6, 0.34, 0.38, M(0x3a3129), 0, 1.0, -0.2);
    beam.rotation.z = 0.5;
    beam.userData.hot = 'beam';
    present.add(beam);
    const rubbleM = M(0x44403a);
    present.add(coneMesh(0.5, 0.8, rubbleM, -1.0, 0.4, -0.5), coneMesh(0.6, 1.0, rubbleM, 0.6, 0.5, 0.1), coneMesh(0.4, 0.6, rubbleM, 1.2, 0.3, -0.8));
    present.add(box(1.2, 0.04, 0.9, M(0x2c2825), 0, 2.57, -0.2));
    // 책상: 눌려 찌그러짐, 틈새로 내용물이 보인다
    const desk = box(1.2, 0.5, 0.7, M(0x565046), -3.2, 0.25, -1.0);
    desk.rotation.z = 0.07;
    present.add(desk);
    const pDrawer = box(0.05, 0.14, 0.5, M(0x605848), -2.59, 0.3, -1.0, 'presentDrawer');
    pDrawer.rotation.z = 0.12;
    present.add(pDrawer);
    const keyGlint = box(0.02, 0.025, 0.12, M(0xb89a40), -2.61, 0.39, -1.0);
    keyGlint.visible = false;
    present.add(keyGlint);
    refs.present.drawerKeyGlint = keyGlint;
    const crankGlint = box(0.025, 0.03, 0.1, M(0xc9a437), -2.6, 0.37, -0.88);
    crankGlint.visible = false;
    present.add(crankGlint);
    refs.present.crankGlint = crankGlint;
    const pokerGlint = box(0.015, 0.02, 0.3, M(0x5a4438), -2.62, 0.35, -1.08);
    present.add(pokerGlint);                     // 부지깽이: 항상 틈새에 보인다
    // 마루장: 뜯긴 채 빈 공동
    const hole = box(0.8, 0.02, 0.6, M(0x161310), -0.8, 0.012, 1.0, 'presentBoard');
    present.add(hole);
    const torn = box(0.75, 0.03, 0.25, M(0x6e5a3c), -1.35, 0.05, 1.35);
    torn.rotation.set(0.15, 0.5, 0);
    present.add(torn);
    // 벽난로: 온전
    const fp = makeFireplace(M, 0x6e5a52, 0x7e6055, 'presentBrick');
    present.add(fp.group);
    refs.present.brickLoose = fp.loose;
    // 걸이: 비어 있음 + 녹 자국
    const hookBar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), M(0x4a4a4a));
    hookBar.rotation.x = Math.PI / 2 - 0.35;
    hookBar.position.set(-1.0, 1.4, -2.94);
    hookBar.userData.hot = 'presentHook';
    present.add(hookBar);
    const rust = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), new THREE.MeshBasicMaterial({ color: 0x4e2f22 }));
    rust.position.set(-1.0, 1.33, -2.985);
    rust.userData.hot = 'presentHook';
    present.add(rust);
    // 문: 자물쇠 + 빗장(빈 축 구멍) + 문고리 윤곽
    const door = makeDoor(M, 0x4e4538, 'door', { outline: true, bolt: true });
    present.add(door.group);
    refs.present.door = door.group;
    const crankMounted = makeCrank(M, null);
    crankMounted.position.set(0.12, 0.75, -2.86);
    crankMounted.visible = false;
    present.add(crankMounted);
    refs.present.doorCrankMounted = crankMounted;
    // 파생 데칼: 열쇠 녹물, 크랭크 약탈 윤곽
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), new THREE.MeshBasicMaterial({ color: 0x3e2c20 }));
    stain.rotation.x = -Math.PI / 2;
    stain.visible = false;
    present.add(stain);
    refs.present.floorStain = stain;
    const outline = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), new THREE.MeshBasicMaterial({ color: 0x62605a }));
    outline.rotation.x = -Math.PI / 2;
    outline.visible = false;
    present.add(outline);
    refs.present.crankOutline = outline;
    // 레일 + 본체 조각상 + 다 자란 화분(고사) + 남쪽 선반
    present.add(box(5.2, 0.02, 0.08, M(0x2c2c30), 0, 0.012, 2.6));
    const statue = makeStatue(M);
    statue.visible = false;
    present.add(statue);
    refs.present.bodyMesh = statue;
    const plant = makePlant(M, 1.5, plx, plz);
    present.add(plant);
    hot.PRESENT.push(plant);
    present.add(box(7.6, 0.5, 0.5, M(0x4a3e30), 0, 0.25, 2.75));
    // 조명
    present.add(new THREE.HemisphereLight(0x9aa0a8, 0x2c2c30, 0.5));
    const dir = new THREE.DirectionalLight(0xcfd4da, 0.32);
    dir.position.set(-1.5, 2.5, 1.5);
    present.add(dir);
    hot.PRESENT.push(pDrawer, hole, fp.loose, hookBar, rust, beam, door.group);
  }

  // ═══════════════════════ RUIN ═══════════════════════
  const ruin = makeScene(0x0a1516);
  {
    const M = matFor(false);
    shell(ruin, M, {
      floor: 0x2e3a3a, wall: 0x3a4a4a, ceil: 0,
      ceiling: false, perWallH: { N: 0.8, S: 0.9, W: 0.7, E: 2.6 },
    });
    const ashM = M(0x37393a);
    ruin.add(coneMesh(0.7, 0.5, ashM, -3.2, 0.25, -1.0));         // 책상 → 잿더미
    // 잿더미 속 놋쇠 광택 (크랭크가 서랍에 있을 때의 답안지)
    const glint = box(0.06, 0.03, 0.12, new THREE.MeshBasicMaterial({ color: 0xd8b455 }), -3.1, 0.42, -0.95);
    glint.visible = false;
    ruin.add(glint);
    refs.ruin.ashGlint = glint;
    ruin.add(coneMesh(0.9, 0.7, ashM, 0, 0.35, -0.2), coneMesh(0.6, 0.5, ashM, 0.9, 0.25, 0.4), coneMesh(0.5, 0.4, ashM, -0.8, 0.2, -0.9));
    ruin.add(box(0.8, 0.02, 0.6, M(0x101414), -0.8, 0.012, 1.0));
    const fp = makeFireplace(M, 0x5e6a66, 0x6e7a72, null);
    ruin.add(fp.group);
    refs.ruin.brickLoose = fp.loose;
    refs.ruin.brickCavity = fp.cavity;
    refs.ruin.brickHome = fp.home.clone();
    ruin.add(new THREE.HemisphereLight(0x7fd4cc, 0x1a2626, 0.6));
    const dir = new THREE.DirectionalLight(0x9fe8e0, 0.3);
    dir.position.set(1, 3, 1);
    ruin.add(dir);
  }

  // ═══════════════════ 충돌 AABB (수평) ═══════════════════
  const strip = (o) => ({ x0: o.min[0], x1: o.max[0], z0: o.min[1], z1: o.max[1] });
  const walkObs = level.walk.obstacles.map(strip);
  const southBand = { x0: -4, x1: 4, z0: level.walk.southLimitZ, z1: 3 };
  const colliders = {
    ELDER: [...walkObs, southBand],
    PAST: [...walkObs, southBand],
    PRESENT: [
      { x0: -3.8, x1: -2.55, z0: -1.35, z1: -0.65 },              // 찌그러진 책상
      { x0: 3.25, x1: 4.0, z0: 0.55, z1: 1.25 },                  // 벽난로
      { x0: level.props.beamAABB.min[0], x1: level.props.beamAABB.max[0],
        z0: level.props.beamAABB.min[2], z1: level.props.beamAABB.max[2] }, // 대들보
      { x0: mbx - 0.35, x1: mbx + 0.35, z0: mbz - 0.35, z1: mbz + 0.35 },   // 옛 거울(현재)
    ],
  };

  return { scenes: { ELDER: elder, PAST: past, PRESENT: present, RUIN: ruin }, refs, hot, colliders };
}
