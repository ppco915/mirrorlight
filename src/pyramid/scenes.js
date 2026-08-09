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
    shell(p1, M, { floor: 0xb0925e, wall: 0xc0a274, ceil: 0x907a52, doorKind: 'sealed' });
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
    p1.add(makeCoveredMirror(M, ax + 0.15, az, true));
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
    p2.add(makeUrn(M, 0xa87848, 'p2Urn', LV.props.urnB[0], LV.props.urnB[2]));
    p2.add(makeCoveredMirror(M, ax + 0.15, az, true));
    p2.add(makeCoveredMirror(M, bx - 0.15, bz, false));
    const bw = makeBackWindow(M);
    p2.add(bw.group);
    refs.p2.backWindow = bw.group;
    refs.p2.backStatue = bw.statue;
    p2.add(new THREE.HemisphereLight(0xffdca0, 0x4a3a20, 0.7));
    const t1 = new THREE.PointLight(0xffb45a, 1.1, 12);
    t1.position.set(4, 2.2, 0);
    p2.add(t1);
    refs.p2.fireLight = t1;
    hot.P2.push(jewels, stele);
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
    hot.PRESENT.push(doorG, ...pile.children, glint, brick);
  }

  return { scenes: { P1: p1, P2: p2, PRESENT: present }, refs, hot };
}
