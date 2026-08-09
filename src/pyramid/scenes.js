// pyramid/scenes.js — 문제 1의 세 시대.
// P1(과거 1): 방1만 밝다 — 좌대의 열쇠, 회반죽으로 봉인된 문(인장 도장), 헐거운 벽돌.
// P2(과거 2, 더 옛날): 통로 열림 — 사제단의 방2 (문제 2 예정 무대).
// PRESENT: 돌무더기(붕괴) 틈의 금빛, 잠긴 돌문, 헐거운 벽돌, 털린 방2.

import * as THREE from 'three';
import { plasterTexture, tiled } from '../textures.js';
import { LV } from './level.js';

function matFor(mirrorEra) {
  const side = mirrorEra ? THREE.DoubleSide : THREE.FrontSide;
  const M = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, side, ...extra });
  M.metal = (color, { specular = 0xfff2cc, shininess = 55, ...extra } = {}) =>
    new THREE.MeshPhongMaterial({ color, specular, shininess, side, ...extra });
  return M;
}

function box(w, h, d, material, x, y, z, hotId) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  if (hotId) m.userData.hot = hotId;
  return m;
}

// 두 방 껍데기. doorKind: 'sealed'(석판+회반죽) | 'open'(통로) | 'door'(돌문 소품 별도)
function shell(scene, M, { floor, wall, ceil, doorKind }) {
  const R = LV.rooms, W = R.x1 - R.x0, D = R.z1 - R.z0, H = 3.0;
  const tex = () => ({ map: tiled(plasterTexture(), 5, 2) });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M(floor, { map: tiled(plasterTexture(), 7, 3) }));
  f.rotation.x = -Math.PI / 2;
  scene.add(f);
  const c = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M(ceil, tex()));
  c.rotation.x = Math.PI / 2; c.position.y = H;
  scene.add(c);
  for (const [w, p, ry] of [[W, [0, R.z0], 0], [W, [0, R.z1], Math.PI], [D, [R.x1, 0], -Math.PI / 2], [D, [R.x0, 0], Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), M(wall, tex()));
    m.position.set(p[0], H / 2, p[1]); m.rotation.y = ry;
    scene.add(m);
  }
  const wallM = M(wall, tex());
  const g = LV.doorway;
  const seg = (z0, z1, y0, y1) => {
    if (z1 - z0 < 0.02 || y1 - y0 < 0.02) return;
    scene.add(box(0.5, y1 - y0, z1 - z0, wallM, 0, (y0 + y1) / 2, (z0 + z1) / 2));
  };
  seg(R.z0, g.z0, 0, H);
  seg(g.z1, R.z1, 0, H);
  seg(g.z0, g.z1, g.y1, H);
  if (doorKind === 'sealed') {
    // 문틀을 가득 메운 석판 + 회반죽 + 인장 도장들
    scene.add(box(0.4, g.y1, g.z1 - g.z0, M(0xb5a078), 0, g.y1 / 2, 0));
    const plaster = box(0.1, g.y1 - 0.2, g.z1 - g.z0 - 0.15, M(0xd8ccae), -0.24, g.y1 / 2, 0, 'p1SealedDoor');
    scene.add(plaster);
    for (const dy of [0.6, 1.1, 1.6]) {
      const stamp = box(0.05, 0.14, 0.14, M(0x8a3a2a), -0.3, dy, 0.12, 'p1Stamps');
      scene.add(stamp);
    }
    return { plaster };
  }
  return {};
}

function makeKey(M, hotId) {
  const g = new THREE.Group();
  const gold = M.metal(0xd9b13a);
  const shaft = box(0.04, 0.2, 0.02, gold, 0, 0, 0);
  const tooth = box(0.06, 0.04, 0.02, gold, 0.035, -0.08, 0);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 14), gold);
  bow.position.y = 0.12;
  g.add(shaft, tooth, bow);
  if (hotId) g.traverse((o) => { o.userData.hot = hotId; });
  return g;
}

function makePectoral(M, hotId) {
  const g = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 16, Math.PI), M.metal(0xd9b13a));
  arc.rotation.x = Math.PI / 2;
  g.add(arc);
  for (const a of [-0.6, 0, 0.6]) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), M(0x2a4a8a));
    bead.position.set(Math.sin(a) * 0.11, 0.02, Math.cos(a) * 0.11);
    g.add(bead);
  }
  if (hotId) g.traverse((o) => { o.userData.hot = hotId; });
  return g;
}

function makeUrn(M, color, hotId, x, z, { smashed = false } = {}) {
  const g = new THREE.Group();
  if (smashed) {
    for (const [dx, dz, r] of [[-0.1, 0.05, 0.12], [0.12, -0.06, 0.1], [0.02, 0.14, 0.08]]) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(r, 0.16, 5), M(color));
      shard.position.set(x + dx, 0.08, z + dz);
      shard.rotation.z = dx * 4;
      if (hotId) shard.userData.hot = hotId;
      g.add(shard);
    }
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.7, 10), M(color));
    body.position.set(x, 0.35, z);
    if (hotId) body.userData.hot = hotId;
    g.add(body);
  }
  return g;
}

function makeAltar(M, bodyColor) {
  const [cx, , cz] = LV.props.altar;
  const g = new THREE.Group();
  g.add(box(0.7, 0.35, 0.7, M(bodyColor), cx, 0.175, cz));
  g.add(box(0.8, 0.08, 0.8, M(bodyColor), cx, 0.9, cz));
  return g;
}

function makeCoveredMirror(M, x, z, facingEast) {
  const g = new THREE.Group();
  g.add(box(1.05, 1.98, 0.35, M(0xd8cdb0), 0, 0.99, 0));
  g.position.set(x, 0, z);
  g.rotation.y = facingEast ? Math.PI / 2 : -Math.PI / 2;
  return g;
}

function makeStatue(M) {
  const g = new THREE.Group();
  const grey = M(0x9a8f7a);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.15, 10), grey);
  body.position.y = 0.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), grey);
  head.position.y = 1.34;
  g.add(body, head);
  return g;
}

function makeBackWindow(M) {
  const bw = new THREE.Group();
  bw.add(box(1.1, 1.9, 0.06, M(0x4a3a24), 0, 0.95, -0.04));
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.75),
    new THREE.MeshBasicMaterial({ color: 0x0c0a08, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  dark.position.y = 0.95;
  bw.add(dark);
  const statue = makeStatue(M);
  bw.add(statue);
  bw.visible = false;
  return { group: bw, statue };
}

function rockPile(M, hotId) {
  const g = new THREE.Group();
  const rock = M(0x9a8a6c);
  for (const [dx, dz, r, h] of [[-0.35, -0.2, 0.35, 0.5], [0.15, 0.1, 0.42, 0.65], [0.3, -0.45, 0.3, 0.42], [-0.1, 0.35, 0.3, 0.4], [0, -0.15, 0.28, 0.85]]) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), rock);
    s.position.set(-2.5 + dx, h / 2, -1.8 + dz);
    s.rotation.y = dx * 7;
    s.userData.hot = hotId;
    g.add(s);
  }
  return g;
}

export function buildPyramidScenes() {
  const refs = { p1: {}, p2: {}, present: {} };
  const hot = { P1: [], P2: [], PRESENT: [] };
  const [ax, az] = LV.mirrorA.pos, [bx, bz] = LV.mirrorB.pos;
  const [kx, , kz] = LV.props.keySpot;
  const [brx, bry, brz] = LV.props.brick;

  // ═══════════ P1 — 과거 1 (봉인된 문, 좌대의 열쇠) ═══════════
  const p1 = new THREE.Scene();
  p1.background = new THREE.Color(0x241a0e);
  {
    const M = matFor(true);
    const doorParts = shell(p1, M, { floor: 0xb0925e, wall: 0xc0a274, ceil: 0x907a52, doorKind: 'sealed' });
    // 문지기의 좌대 + 열쇠
    p1.add(box(0.32, 0.45, 0.32, M(0xa8946a), kx, 0.225, kz, 'p1Pedestal'));
    const key = makeKey(M, 'p1Key');
    key.position.set(kx, 0.5, kz);
    p1.add(key);
    refs.p1.key = key;
    // 남벽의 헐거운 벽돌 (색이 살짝 다르다 — 유일한 은닉처)
    const brick = box(0.34, 0.18, 0.14, M(0xcaa96f), brx, bry, brz, 'p1Brick');
    p1.add(brick);
    refs.p1.brick = brick;
    // 화덕돌 밑 공동 (문제 2 — P2에서 온 물건의 착지점)
    const hearthLid = box(0.5, 0.06, 0.5, M(0x8e7a52), LV.props.hearth[0], 0.03, LV.props.hearth[2], 'p1Hearth');
    p1.add(hearthLid);
    refs.p1.hearthLid = hearthLid;
    // 북벽의 회반죽 벽감: 회반죽 → 홈(로제트) → 금고문 → 스카라베
    const [nx, ny, nz] = LV.props.niche;
    p1.add(box(0.7, 0.7, 0.1, M(0x9a8560), nx, ny, nz + 0.02));                  // 벽감 틀
    const plaster = box(0.6, 0.6, 0.07, M(0xd8ccae), nx, ny, nz + 0.06, 'p1Niche');
    p1.add(plaster);
    refs.p1.plaster = plaster;
    const rosette = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16), M.metal(0xb08a3e));
    rosette.position.set(nx, ny, nz + 0.08);
    rosette.userData.hot = 'p1Niche';
    p1.add(rosette);
    const pinInNiche = box(0.04, 0.04, 0.16, M.metal(0xb08a3e), nx + 0.18, ny - 0.15, nz + 0.09, 'p1Pin');
    pinInNiche.visible = false;
    p1.add(pinInNiche);
    refs.p1.pinInNiche = pinInNiche;
    const vaultDoor = box(0.4, 0.4, 0.05, M(0x8a7350), nx, ny, nz + 0.05, 'p1Niche');
    p1.add(vaultDoor);
    refs.p1.vaultDoor = vaultDoor;
    const scarab = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.metal(0xd9b13a));
    scarab.scale.set(1.3, 0.6, 1);
    scarab.position.set(nx, ny - 0.05, nz + 0.02);
    scarab.visible = false;
    p1.add(scarab);
    refs.p1.scarab = scarab;
    // 문 봉인 회반죽 참조 (끌로 뜯을 수 있다 — 무해)
    refs.p1.doorPlaster = doorParts.plaster;
    const chiselLoose = box(0.05, 0.05, 0.3, M.metal(0x9a7a3e), 0, 0, 0, 'p1Chisel');
    chiselLoose.visible = false;
    p1.add(chiselLoose);
    refs.p1.chisel = chiselLoose;
    const pinLoose = box(0.04, 0.04, 0.16, M.metal(0xb08a3e), 0, 0, 0, 'p1Pin');
    pinLoose.visible = false;
    p1.add(pinLoose);
    refs.p1.pinLoose = pinLoose;
    p1.add(makeUrn(M, 0xa87848, 'p1Urn', LV.props.urnA[0], LV.props.urnA[2]));
    // 서쪽 구석의 봉헌 선반 — 거울 곁 사각지대의 비보행 드레싱
    for (const zc of [-2.0, 2.0]) {
      p1.add(box(1.0, 0.55, 1.7, M(0x9a815a), -6.9, 0.275, zc));
      for (const dz of [-0.5, 0.1, 0.6]) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.22, 8), M(0x8a6a44));
        pot.position.set(-6.9, 0.66, zc + dz);
        p1.add(pot);
      }
    }
    // 자기 자신(거울 1)의 소품은 두지 않는다 — 반사 가상 카메라 코앞을 막아
    // 유리 전체가 천 상자로 덮여 보인다. 빙의 중엔 「유리 저편」 합성물이 대신한다.
    const bw = makeBackWindow(M);
    p1.add(bw.group);
    refs.p1.backWindow = bw.group;
    refs.p1.backStatue = bw.statue;
    p1.add(new THREE.HemisphereLight(0xffd9a0, 0x44351e, 0.6));
    const torch = new THREE.PointLight(0xffab50, 1.1, 11);
    torch.position.set(-3.5, 2.2, 0.5);
    p1.add(torch);
    refs.p1.fireLight = torch;
    const sealHots = [];
    p1.traverse((o) => { if (o.userData?.hot) sealHots.push(o); });
    hot.P1.push(...sealHots);
    refs.p1.hotList = sealHots;
  }

  // ═══════════ P2 — 과거 2 (더 옛날: 통로 열림, 사제단의 방2) ═══════════
  const p2 = new THREE.Scene();
  p2.background = new THREE.Color(0x2a1f10);
  {
    const M = matFor(true);
    shell(p2, M, { floor: 0xb99a68, wall: 0xc7a878, ceil: 0x9a8258, doorKind: 'open' });
    p2.add(makeAltar(M, 0xa8845a));
    const jewels = makePectoral(M, 'p2Jewels');
    p2.add(jewels);
    refs.p2.jewels = jewels;
    const stele = box(0.7, 0.9, 0.06, M(0xcbb086), 3.0, 1.3, -2.9, 'p2Stele');
    p2.add(stele);
    const chisel = box(0.05, 0.05, 0.3, M.metal(0x9a7a3e), 3.2, 0.45, -2.6, 'p2Chisel');
    p2.add(chisel);
    refs.p2.chisel = chisel;
    const hearthLid2 = box(0.5, 0.06, 0.5, M(0x9a8560), LV.props.hearth[0], 0.03, LV.props.hearth[2], 'p2Hearth');
    p2.add(hearthLid2);
    p2.add(makeUrn(M, 0xa87848, 'p2Urn', LV.props.urnB[0], LV.props.urnB[2]));
    // 거울 A의 옛 원형만 소품으로 남긴다(열린 통로 너머 먼 배경 — 정상적인 반사 대상).
    // 거울 B 자신의 소품은 두지 않는다 — 반사 카메라 코앞을 막는다.
    p2.add(makeCoveredMirror(M, ax + 0.15, az, true));
    const bw = makeBackWindow(M);
    p2.add(bw.group);
    refs.p2.backWindow = bw.group;
    refs.p2.backStatue = bw.statue;
    p2.add(new THREE.HemisphereLight(0xffdca0, 0x4a3a20, 0.7));
    const t1 = new THREE.PointLight(0xffb45a, 1.1, 12);
    t1.position.set(4, 2.2, 0);
    p2.add(t1);
    refs.p2.fireLight = t1;
    const p2Hots = [];
    p2.traverse((o) => { if (o.userData?.hot) p2Hots.push(o); });
    hot.P2.push(...p2Hots);
  }

  // ═══════════ PRESENT — 현재 ═══════════
  const present = new THREE.Scene();
  present.background = new THREE.Color(0x1a1712);
  {
    const M = matFor(false);
    shell(present, M, { floor: 0x8a8070, wall: 0x9a9078, ceil: 0x6e675a, doorKind: 'open' });
    // 잠긴 돌문 (경첩: 문틀 남쪽) + 열쇠 구멍
    const doorG = new THREE.Group();
    doorG.position.set(0, 0, LV.doorway.z0);
    const slab = box(0.3, LV.doorway.y1, LV.doorway.z1 - LV.doorway.z0, M(0xb0a080), 0, LV.doorway.y1 / 2, (LV.doorway.z1 - LV.doorway.z0) / 2, 'presentDoor');
    const hole = box(0.05, 0.1, 0.06, M(0x201a10), -0.16, 1.0, 0.75, 'presentDoor');
    doorG.add(slab, hole);
    present.add(doorG);
    refs.present.doorGroup = doorG;
    // 붕괴 돌무더기 + 틈새의 금빛 (파생)
    const pile = rockPile(M, 'presentPile');
    present.add(pile);
    const glint = box(0.05, 0.03, 0.05, new THREE.MeshBasicMaterial({ color: 0xe8c85a }), kx + 0.12, 0.16, kz + 0.28);
    glint.userData.hot = 'presentPile';
    present.add(glint);
    refs.present.glint = glint;
    // 천장 파공 (붕괴의 원인)
    present.add(box(1.4, 0.05, 1.2, M(0x3a352c), kx, 2.96, kz));
    // 헐거운 벽돌 + 모래 자국 데칼
    const brick = box(0.34, 0.18, 0.14, M(0x8e8266), brx, bry, brz, 'presentBrick');
    present.add(brick);
    const trace = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), new THREE.MeshBasicMaterial({ color: 0x6e6252 }));
    trace.rotation.x = -Math.PI / 2;
    trace.visible = false;
    present.add(trace);
    refs.present.sandTrace = trace;
    // 벽감 (현재): 광물화된 회반죽 / 드러난 로제트와 금고문
    const [nx, ny, nz] = LV.props.niche;
    present.add(box(0.7, 0.7, 0.1, M(0x76705e), nx, ny, nz + 0.02));
    const nichePlaster = box(0.6, 0.6, 0.07, M(0x8e8878), nx, ny, nz + 0.06, 'presentNiche');
    present.add(nichePlaster);
    refs.present.nichePlaster = nichePlaster;
    const rosette2 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16), M.metal(0x8a7350));
    rosette2.position.set(nx, ny, nz + 0.08);
    rosette2.userData.hot = 'presentNiche';
    rosette2.visible = false;
    present.add(rosette2);
    refs.present.rosette = rosette2;
    const vaultDoor2 = box(0.4, 0.4, 0.05, M(0x6e675a), nx, ny, nz + 0.05, 'presentNiche');
    present.add(vaultDoor2);
    refs.present.vaultDoor = vaultDoor2;
    const scarab2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.metal(0xd9b13a));
    scarab2.scale.set(1.3, 0.6, 1);
    scarab2.position.set(nx, ny - 0.05, nz + 0.02);
    scarab2.visible = false;
    present.add(scarab2);
    refs.present.scarab = scarab2;
    // 화덕돌: 도굴꾼이 들춰냈다 — 공동은 비어 있다 (은닉처의 구간별 생존)
    const hearthPried = box(0.5, 0.06, 0.5, M(0x76705e), LV.props.hearth[0] - 0.35, 0.05, LV.props.hearth[2] + 0.25, 'presentHearth');
    hearthPried.rotation.z = 0.25;
    present.add(hearthPried);
    present.add(box(0.44, 0.04, 0.44, M(0x2a2620), LV.props.hearth[0], 0.02, LV.props.hearth[2], 'presentHearth'));
    // 방2: 털린 무덤 (문제 2 예정 무대)
    present.add(makeAltar(M, 0x7e7460));
    present.add(makeUrn(M, 0x7a6a52, 'presentUrnB', LV.props.urnB[0], LV.props.urnB[2], { smashed: true }));
    present.add(makeUrn(M, 0x7a6a52, 'presentUrnA', LV.props.urnA[0], LV.props.urnA[2], { smashed: true }));
    const statue = makeStatue(M);
    statue.visible = false;
    present.add(statue);
    refs.present.bodyMesh = statue;
    present.add(new THREE.HemisphereLight(0xb8b0a0, 0x2c2820, 0.5));
    const dir = new THREE.DirectionalLight(0xd8d0c0, 0.3);
    dir.position.set(1, 3, 1);
    present.add(dir);
    const prHots = [];
    present.traverse((o) => { if (o.userData?.hot) prHots.push(o); });
    hot.PRESENT.push(...prHots);
  }

  return { scenes: { P1: p1, P2: p2, PRESENT: present }, refs, hot };
}
