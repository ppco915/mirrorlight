// pyramid/scenes.js — 세 시대의 두 방. SEAL(봉인의 날, 횃불 황금빛) /
// ROB(도굴의 밤, 차가운 어둠 속 호박빛) / PRESENT(모래 먼지의 잿빛).
// 마주 보는 두 거울은 각 시대 씬 안에서 천에 덮인 소품으로만 존재한다(재귀 금지).

import * as THREE from 'three';
import { plasterTexture, tiled } from '../textures.js';
import { LV } from './level.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

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

// 두 방 껍데기 + 가운데 벽. gap: 통로 형태 {z0,z1,y0,y1} | 'breach' 파공 여부
function shell(scene, M, { floor, wall, ceil, gapKind }) {
  const R = LV.rooms, W = R.x1 - R.x0, D = R.z1 - R.z0, H = 3.0;
  const tex = () => ({ map: tiled(plasterTexture(), 5, 2) });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M(floor, { map: tiled(plasterTexture(), 7, 3) }));
  f.rotation.x = -Math.PI / 2;
  scene.add(f);
  const c = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M(ceil, tex()));
  c.rotation.x = Math.PI / 2; c.position.y = H;
  scene.add(c);
  const walls = [
    [W, [0, R.z0], 0], [W, [0, R.z1], Math.PI],
    [D, [R.x1, 0], -Math.PI / 2], [D, [R.x0, 0], Math.PI / 2],
  ];
  for (const [w, p, ry] of walls) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), M(wall, tex()));
    m.position.set(p[0], H / 2, p[1]); m.rotation.y = ry;
    scene.add(m);
  }
  // 가운데 벽: 통로/파공을 남기고 상자들로 조립
  const wallM = M(wall, tex());
  const seg = (z0, z1, y0, y1) => {
    if (z1 - z0 < 0.02 || y1 - y0 < 0.02) return;
    scene.add(box(0.5, y1 - y0, z1 - z0, wallM, 0, (y0 + y1) / 2, (z0 + z1) / 2));
  };
  const g = gapKind === 'door' ? LV.doorway : LV.breach;
  seg(R.z0, g.z0, 0, H);              // 남쪽 벽체
  seg(g.z1, R.z1, 0, H);              // 북쪽 벽체
  seg(g.z0, g.z1, g.y1, H);           // 개구 위 인방
  if (gapKind === 'breach') {
    // 파공: 봉인 석판의 잔해 — 개구 둘레 테두리 강조
    const rim = M(0x6a5238);
    scene.add(box(0.56, 0.06, g.z1 - g.z0 + 0.2, rim, 0, g.y1 + 0.03, (g.z0 + g.z1) / 2));
  }
  return g;
}

function makePectoral(M, hotId) {
  // 가슴장식: 금 반원 + 청금석 구슬
  const g = new THREE.Group();
  const gold = M.metal(0xd9b13a);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 16, Math.PI), gold);
  arc.rotation.x = Math.PI / 2;
  g.add(arc);
  for (const a of [-0.6, 0, 0.6]) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), M(0x2a4a8a));
    bead.position.set(Math.sin(a) * 0.11, 0.02, Math.cos(a) * 0.11 - 0.0);
    g.add(bead);
  }
  if (hotId) g.traverse((o) => { o.userData.hot = hotId; });
  return g;
}

function makeRod(M, hotId) {
  const g = new THREE.Group();
  const bronze = M.metal(0xb08a3e);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), bronze);
  const head = box(0.09, 0.05, 0.05, bronze, 0, 0.27, 0);
  g.add(shaft, head);
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
    const lid = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 10), M(color));
    lid.position.set(x, 0.78, z);
    if (hotId) { body.userData.hot = hotId; lid.userData.hot = hotId; }
    g.add(body, lid);
  }
  return g;
}

function makeAltarCrypt(M, bodyColor, hotId) {
  // 제단 밑 크립트: 받침 + 미닫이 뚜껑 + 공동
  const [cx, , cz] = LV.props.crypt;
  const g = new THREE.Group();
  g.add(box(0.7, 0.35, 0.7, M(bodyColor), cx, 0.175, cz));               // 받침
  g.add(box(0.8, 0.08, 0.8, M(bodyColor), cx, 0.9, cz));                 // 제단 상판
  for (const dz of [-0.3, 0.3]) g.add(box(0.12, 0.5, 0.12, M(bodyColor), cx - 0.3, 0.6, cz + dz));
  const cavity = box(0.5, 0.16, 0.5, M(0x0a0705), cx, 0.44, cz);
  cavity.userData.hot = hotId;
  g.add(cavity);
  const lid = box(0.56, 0.06, 0.56, M(0x8a6f4a), cx, 0.52, cz, hotId);
  g.add(lid);
  return { group: g, lid, cavity };
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

export function buildPyramidScenes() {
  const refs = { seal: {}, rob: {}, present: {} };
  const hot = { SEAL: [], ROB: [], PRESENT: [] };
  const [ax, az] = LV.mirrorA.pos, [bx, bz] = LV.mirrorB.pos;
  const [alx, aly, alz] = LV.props.alcove;
  const [blx, , blz] = LV.props.block;

  // ═══════════ SEAL — 봉인의 날 (사제단, 열린 통로) ═══════════
  const seal = new THREE.Scene();
  seal.background = new THREE.Color(0x2a1f10);
  {
    const M = matFor(true);
    shell(seal, M, { floor: 0xb99a68, wall: 0xc7a878, ceil: 0x9a8258, gapKind: 'door' });
    const crypt = makeAltarCrypt(M, 0xa8845a, 'sealCrypt');
    seal.add(crypt.group);
    crypt.lid.position.set(LV.props.crypt[0], 0.15, LV.props.crypt[2] + 0.7); // 봉인 전: 열려 있음
    const jewels = makePectoral(M, 'sealJewels');
    seal.add(jewels);
    refs.seal.jewels = jewels;
    // 사제단의 도구 자리(벽감) — 봉이 모셔져 있다 (조사만)
    seal.add(box(0.5, 0.6, 0.12, M(0x8a6f48), alx, aly, alz + 0.02, 'sealAlcove'));
    const rod1 = makeRod(M, 'sealAlcove');
    rod1.position.set(alx, aly, alz + 0.09);
    seal.add(rod1);
    // 벽문(경문) — 사제단의 서약: 사전 증거
    const stele = box(0.7, 0.9, 0.06, M(0xcbb086), 3.0, 1.3, -2.9, 'sealStele');
    seal.add(stele);
    seal.add(makeUrn(M, 0xa87848, null, LV.props.urnB[0], LV.props.urnB[2]));
    seal.add(makeUrn(M, 0xa87848, null, LV.props.urnA[0], LV.props.urnA[2]));
    seal.add(makeCoveredMirror(M, ax + 0.15, az, true));
    seal.add(makeCoveredMirror(M, bx - 0.15, bz, false));
    const bw = makeBackWindow(M);
    seal.add(bw.group);
    refs.seal.backWindow = bw.group;
    refs.seal.backStatue = bw.statue;
    seal.add(new THREE.HemisphereLight(0xffdca0, 0x4a3a20, 0.7));
    const t1 = new THREE.PointLight(0xffb45a, 1.1, 12); t1.position.set(4, 2.2, 0); seal.add(t1);
    const t2 = new THREE.PointLight(0xffb45a, 0.8, 12); t2.position.set(-4, 2.2, 0); seal.add(t2);
    refs.seal.fireLight = t1;
    hot.SEAL.push(jewels, crypt.lid, crypt.cavity, stele, rod1);
  }

  // ═══════════ ROB — 도굴의 밤 (봉인된 석판 + 파공) ═══════════
  const rob = new THREE.Scene();
  rob.background = new THREE.Color(0x0e0c12);
  {
    const M = matFor(true);
    shell(rob, M, { floor: 0x8a7350, wall: 0x98805c, ceil: 0x6e5c40, gapKind: 'breach' });
    const crypt = makeAltarCrypt(M, 0x8a6f4a, 'robCrypt');
    rob.add(crypt.group);
    refs.rob.cryptLid = crypt.lid;
    const jc = makePectoral(M, 'robJewelsCrypt');
    jc.position.set(LV.props.crypt[0], 0.47, LV.props.crypt[2]);
    jc.visible = false;
    rob.add(jc);
    refs.rob.jewelsInCrypt = jc;
    const jl = makePectoral(M, 'robJewelsLoose');
    jl.visible = false;
    rob.add(jl);
    refs.rob.jewelsLoose = jl;
    // 봉헌 벽감 + 여는 봉 (정위치 — 사제단의 습관이 남긴 선물)
    rob.add(box(0.5, 0.6, 0.12, M(0x7a6240), alx, aly, alz + 0.02, 'robAlcove'));
    const rodA = makeRod(M, 'robAlcove');
    rodA.position.set(alx, aly, alz + 0.09);
    rob.add(rodA);
    refs.rob.rodInAlcove = rodA;
    const rodL = makeRod(M, 'robRodLoose');
    rodL.visible = false;
    rodL.rotation.z = Math.PI / 2;
    rob.add(rodL);
    refs.rob.rodLoose = rodL;
    // 석판의 인장 도장들(시대 증거) + 도굴꾼의 세간
    for (const dz of [0.25, 0.45]) {
      const stamp = box(0.06, 0.12, 0.12, M(0x8a3a2a), -0.29, 1.3, dz, 'robStamps');
      rob.add(stamp);
      hot.ROB.push(stamp);
    }
    rob.add(box(0.5, 0.1, 0.3, M(0x5a4a34), -1.6, 0.05, 1.4, 'robTools'));
    // 들뜬 바닥돌 (아직 아무도 모른다 — 현재의 발견이 여기로 이끈다)
    const block = box(0.5, 0.09, 0.5, M(0x7e6a4c), blx, 0.045, blz, 'robBlock');
    rob.add(block);
    rob.add(makeUrn(M, 0x8a6038, 'robUrnB', LV.props.urnB[0], LV.props.urnB[2]));
    rob.add(makeUrn(M, 0x8a6038, 'robUrnA', LV.props.urnA[0], LV.props.urnA[2]));
    rob.add(makeCoveredMirror(M, ax + 0.15, az, true));
    rob.add(makeCoveredMirror(M, bx - 0.15, bz, false));
    const bw = makeBackWindow(M);
    rob.add(bw.group);
    refs.rob.backWindow = bw.group;
    refs.rob.backStatue = bw.statue;
    rob.add(new THREE.HemisphereLight(0x8a7c9a, 0x14100c, 0.35));
    const torch = new THREE.PointLight(0xff9a4a, 1.0, 9);
    torch.position.set(-2.5, 1.6, 0.5);
    rob.add(torch);
    refs.rob.fireLight = torch;
    hot.ROB.push(jc, jl, crypt.lid, crypt.cavity, rodA, rodL, block, ...[]);
  }

  // ═══════════ PRESENT — 현재 (털린 무덤) ═══════════
  const present = new THREE.Scene();
  present.background = new THREE.Color(0x1a1712);
  {
    const M = matFor(false);
    shell(present, M, { floor: 0x8a8070, wall: 0x9a9078, ceil: 0x6e675a, gapKind: 'breach' });
    const crypt = makeAltarCrypt(M, 0x7e7460, 'presentCrypt');
    present.add(crypt.group);
    refs.present.cryptLid = crypt.lid;
    const pry = box(0.08, 0.02, 0.3, new THREE.MeshBasicMaterial({ color: 0x3a2c1c }), LV.props.crypt[0] - 0.31, 0.5, LV.props.crypt[2], 'presentCrypt');
    present.add(pry);
    refs.present.pryMarks = pry;
    // 빈 벽감 (청동은 사라졌다)
    present.add(box(0.5, 0.6, 0.12, M(0x6e675a), alx, aly, alz + 0.02, 'presentAlcove'));
    // 들뜬 바닥돌 + 그 밑의 보석 (파생)
    const block = box(0.5, 0.09, 0.5, M(0x76705e), blx, 0.05, blz, 'presentBlock');
    present.add(block);
    const jb = makePectoral(M, null);
    jb.position.set(blx, 0.02, blz);
    jb.visible = false;
    present.add(jb);
    refs.present.jewelsInBlock = jb;
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
    hot.PRESENT.push(crypt.lid, crypt.cavity, pry, block, ...present.children.filter((o) => o.userData?.hot));
  }

  return { scenes: { SEAL: seal, ROB: rob, PRESENT: present }, refs, hot };
}
