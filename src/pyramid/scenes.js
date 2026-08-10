// pyramid/scenes.js — 문제 1의 세 시대, 실사 무대.
// P1(과거 1): 봉인 직후의 무덤 — 좌대의 황금 열쇠, 회반죽 봉인문, 헐거운 벽돌.
// P2(과거 2, 더 옛날): 통로가 열려 있던 사제단의 시절 — 부장품이 온전하다.
// PRESENT: 수천 년 뒤 — 무너진 천장, 돌무더기 틈의 금빛, 도굴당한 매장실.
//
// 재질은 Poly Haven CC0 PBR 세트(assets.js), 벽화·별 천장·불꽃은 절차 합성.
// Node(스모크 테스트)에서는 assets.js가 단색 재질로 대체되므로 계약은 동일하다.
//
// 시대 간 연속성이 곧 증거다: 같은 벽돌 벽·같은 별 천장·같은 석비가
// 시대마다 낡아 가는 모습으로 다시 나타난다.

import * as THREE from 'three';
import { LV } from './level.js';
import { muralMaps, dialTiles, muralData, cellCenterUV, BEAD_CELLS } from './mural.js';
import {
  inBrowser, pbr, plain, gold, bronze, lapis, ceramic, wood,
  glyphBandMaps, steleFaceMaps, starCeilingMap, wingedSunMap,
  flameMap, dustMap, beamMap, sandPatchAlpha, linenMap,
} from './assets.js';

const H = 3.0;

// 결정론 난수 — 돌무더기·먼지 배치가 새로고침마다 같다.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function box(w, h, d, material, x, y, z, hotId) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  if (hotId) m.userData.hot = hotId;
  return m;
}

function markHot(obj, hotId) {
  obj.traverse((o) => { o.userData.hot = hotId; });
  return obj;
}

// ── 시대 팔레트 ────────────────────────────────────────────────
// 같은 텍스처에 색조만 다르게 곱한다 — 같은 방이라는 증거.
const ERA = {
  // 과거는 거울빛이 유일한 조명이다 — 배경·안개 모두 암흑에 가깝다.
  P1: {
    side: THREE.DoubleSide, painted: true, sunFade: 0.25, starFade: 0.3,
    wall: 0xcbb488, floor: 0xd2bd97, tint: 0xc9ae7d, band: 0xa08e72, ceil: 0xb8b1a2,
    fog: [0x060402, 0.05], bg: 0x060402,
  },
  P2: {
    side: THREE.DoubleSide, painted: true, sunFade: 0.0, starFade: 0.0,
    wall: 0xdcc59b, floor: 0xe0cba6, tint: 0xd4b988, band: 0xb2a080, ceil: 0xffffff,
    fog: [0x070503, 0.045], bg: 0x070503,
  },
  PRESENT: {
    side: THREE.FrontSide, painted: false, sunFade: 0.8, starFade: 1.0,
    wall: 0x9c9384, floor: 0x8f887c, tint: 0x8f867a, band: 0x7c756a, ceil: 0xffffff,
    fog: [0x040404, 0.055], bg: 0x040404,
  },
};

// ═══════════════ 방 껍데기 ═══════════════
// doorKind: 'sealed'(P1 회반죽 봉인) | 'open'(P2 열린 통로) | 'door'(현재, 문틀만)
function shell(scene, era, doorKind, anim) {
  const E = ERA[era];
  const R = LV.rooms, W = R.x1 - R.x0, D = R.z1 - R.z0;
  const S = E.side;

  // 바닥 — 닳은 석재 타일
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    pbr('mixed_stone_tiles', { repeat: [W / 2.2, D / 2.2], color: E.floor, side: S, env: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 천장 — 과거: 청금석 바탕에 금빛 별(무덤 천장 양식), 현재: 갈라진 회반죽
  let ceilM;
  if (era === 'PRESENT') {
    ceilM = pbr('worn_cracked_plaster', { repeat: [W / 3, D / 3], color: 0x8a8378, side: S, env: 0.1 });
  } else {
    const star = starCeilingMap({ faded: E.starFade });
    ceilM = new THREE.MeshStandardMaterial({ color: E.ceil, roughness: 0.95, side: S });
    if (star) { star.repeat.set(W / 1.6, D / 1.6); ceilM.map = star; }
    else ceilM.color.setHex(0x2a3454);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilM);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = H;
  scene.add(ceil);

  // 둘레 벽 — 대형 사암 석축
  const wallMat = (w) => pbr('large_sandstone_blocks_01', { repeat: [w / 3, 1], color: E.wall, side: S, env: 0.18 });
  for (const [w, p, ry] of [
    [W, [0, R.z0], 0], [W, [0, R.z1], Math.PI],
    [D, [R.x1, 0], -Math.PI / 2], [D, [R.x0, 0], Math.PI / 2],
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallMat(w));
    m.position.set(p[0], H / 2, p[1]);
    m.rotation.y = ry;
    m.receiveShadow = true;
    scene.add(m);
  }

  // 가운데 돌벽 (문틀 개구부만 남긴다)
  const midM = pbr('large_sandstone_blocks_01', { repeat: [0.8, 1], color: E.wall, side: S, env: 0.18 });
  const g = LV.doorway;
  const seg = (z0, z1, y0, y1) => {
    if (z1 - z0 < 0.02 || y1 - y0 < 0.02) return;
    scene.add(box(0.5, y1 - y0, z1 - z0, midM, 0, (y0 + y1) / 2, (z0 + z1) / 2));
  };
  seg(R.z0, g.z0, 0, H);
  seg(g.z1, R.z1, 0, H);
  seg(g.z0, g.z1, g.y1, H);

  // 상형문자 음각 띠 — 네 벽을 두르는 장식 레지스터
  const band = glyphBandMaps({ seed: 7, painted: E.painted, tone: hex(E.tint) });
  if (band) {
    const bandMat = (w) => {
      const m = new THREE.MeshStandardMaterial({
        map: band.map.clone(), normalMap: band.normalMap.clone(),
        color: E.band, roughness: 0.95, side: S, envMapIntensity: 0.08,
      });
      m.map.repeat.set(w / 2.6, 1); m.map.needsUpdate = true;
      m.normalMap.repeat.set(w / 2.6, 1); m.normalMap.needsUpdate = true;
      return m;
    };
    for (const [w, p, ry] of [
      [W, [0, R.z0 + 0.012], 0], [W, [0, R.z1 - 0.012], Math.PI],
      [D, [R.x1 - 0.012, 0], -Math.PI / 2], [D, [R.x0 + 0.012, 0], Math.PI / 2],
    ]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.34), bandMat(w));
      strip.position.set(p[0], 2.32, p[1]);
      strip.rotation.y = ry;
      scene.add(strip);
    }
    // 허리선(안료 띠) — 과거에만 선명하다. 현재는 벽만 남는다.
    // MeshBasic이면 암흑 속에서 저 혼자 빛난다 — 조명을 받는 재질로 그린다.
    if (era !== 'PRESENT') {
      const lineM = new THREE.MeshStandardMaterial({
        color: 0x6e3018, transparent: true, opacity: 0.5, roughness: 1, side: S,
      });
      for (const [w, p, ry] of [[W, [0, R.z0 + 0.01], 0], [W, [0, R.z1 - 0.01], Math.PI]]) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.05), lineM);
        line.position.set(p[0], 1.02, p[1]);
        line.rotation.y = ry;
        scene.add(line);
      }
    }
  }

  // 문 위의 날개 태양 — 두 방 모두에서 보인다
  const sunT = wingedSunMap({ faded: E.sunFade });
  if (sunT) {
    for (const sx of [-1, 1]) {
      const sun = new THREE.Mesh(
        new THREE.PlaneGeometry(2.3, 0.58),
        new THREE.MeshStandardMaterial({
          map: sunT, transparent: true, roughness: 0.9, side: S, envMapIntensity: 0.1,
        }),
      );
      sun.position.set(sx * 0.262, 2.52, 0);
      sun.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(sun);
    }
  }

  // 문틀 — 화강암 문설주·상인방·처마곡면(이집트 코니스).
  // 동일 평면 z-파이팅 방지: 문설주는 벽 개구부 면(z=±0.6)을 5mm 삼키고,
  // 상인방은 개구부 윗면(y=y1)을 삼키도록 키워, 이음면이 전부 문틀 속에 묻힌다.
  // 과거의 문틀은 무늬 없는 다듬은 통돌 — 블록 텍스처의 이음매·노멀맵이
  // 개구부를 스치는 거울빛에 밝은 줄무늬로 과장돼 보였다 (갓 지은 시절이기도 하다).
  // 현재는 손전등 정면광이라 블록 무늬가 세월의 질감으로 잘 읽힌다.
  const granite = era === 'PRESENT'
    ? pbr('granite_wall', { repeat: [0.5, 1], rotate: Math.PI / 2, color: 0x6e6660, side: S, env: 0.15 })
    : plain(0x84766a, { side: S, roughness: 0.55, envMapIntensity: 0.15 });
  for (const dz of [-1, 1]) {
    scene.add(box(0.62, g.y1 + 0.06, 0.24, granite, 0, (g.y1 + 0.06) / 2, dz * 0.715));
  }
  scene.add(box(0.64, 0.36, 1.92, granite, 0, g.y1 + 0.14, 0));  // 상인방 (y 1.96~2.32)
  scene.add(box(0.72, 0.14, 2.1, granite, 0, g.y1 + 0.36, 0));   // 코니스
  scene.add(box(1.0, 0.03, 1.5, granite, 0, 0.013, 0));          // 문지방 (밑면은 바닥 아래로)

  // 횃불 받침 — 과거는 거울빛만 비추므로 불을 끈 받침만 남고,
  // 현재는 받침째 뜯겨 그을음만 남았다.
  const sconceAt = [[-5.4, R.z0, 0], [-1.8, R.z1, Math.PI]];
  if (era === 'P2') sconceAt.push([1.8, R.z0, 0], [5.4, R.z1, Math.PI]);
  const lights = [];
  sconceAt.forEach(([x, z, ry], i) => {
    if (era === 'PRESENT') {
      const soot = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, side: S }));
      soot.position.set(x, 1.95, z + (z < 0 ? 0.015 : -0.015));
      soot.rotation.y = ry;
      scene.add(soot);
      return;
    }
    const t = makeTorch(S, false, anim, 11 + i * 7);
    t.group.position.set(x, 1.55, z + (z < 0 ? 0.1 : -0.1));
    t.group.rotation.y = ry;
    scene.add(t.group);
  });
  return { lights };
}

function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

// ═══════════════ 소품 ═══════════════

// 벽걸이 횃불. lit=false면 약탈 후의 빈 청동 받침만 남는다.
function makeTorch(side, lit, anim, seed) {
  const g = new THREE.Group();
  const br = bronze({ side });
  const bracket = box(0.07, 0.3, 0.1, br, 0, -0.1, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 18), br);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.06, 0.1);
  g.add(bracket, ring);
  let light = null;
  if (lit) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.62, 8), wood(0x4a331e, { side }));
    stick.position.set(0, 0.12, 0.1);
    stick.rotation.x = -0.12;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.16, 8), wood(0x241610, { side }));
    head.position.set(0, 0.44, 0.135);
    g.add(stick, head);
    const fm = flameMap();
    if (fm) {
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({
        map: fm, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        color: 0xffb860, opacity: 0.85,
      }));
      flame.position.set(0, 0.6, 0.14);
      flame.scale.set(0.19, 0.32, 1);
      g.add(flame);
      light = new THREE.PointLight(0xff9a45, 11, 12, 1.9);
      light.position.set(0, 0.66, 0.16);
      g.add(light);
      const rand = rng(seed);
      const ph = rand() * 6.28, sp = 8 + rand() * 3;
      anim.push((t) => {
        const f = 1 + 0.22 * Math.sin(t * sp + ph) * Math.sin(t * 3.1 + ph * 2);
        light.intensity = 11 * f;
        flame.scale.set(0.19 * (0.9 + 0.15 * f), 0.32 * (0.85 + 0.25 * f), 1);
        flame.material.opacity = 0.68 + 0.2 * f;
      });
    } else {
      light = new THREE.PointLight(0xff9a45, 11, 12, 1.9);
      light.position.set(0, 0.66, 0.16);
      g.add(light);
    }
  }
  return { group: g, light };
}

// 황금 열쇠 — 고리 머리가 앙크(생명의 표), 이가 둘 달린 청동기 시대풍 열쇠.
// 좌대 위(y0.5)나 바닥(y0.04)에 눕는다.
export function makeKey(side, hotId) {
  const g = new THREE.Group();
  const au = gold({ side });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.17, 10), au);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  for (const cx of [-0.055, 0.02]) {                       // 마디 장식
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.005, 8, 12), au);
    collar.rotation.y = Math.PI / 2;
    collar.position.x = cx;
    g.add(collar);
  }
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 8, 18), au);   // 앙크 고리
  loop.rotation.x = Math.PI / 2;
  loop.position.set(-0.117, 0, 0);
  const cross = box(0.008, 0.008, 0.062, au, -0.093, 0, 0);
  g.add(loop, cross);
  for (const dz of [0, 0.024] ) {                          // 이 두 개
    g.add(box(0.01, 0.03, 0.012, au, 0.062 + dz * 0.9, -0.014, 0.012 + dz));
  }
  g.traverse((o) => { o.castShadow = true; });
  if (hotId) markHot(g, hotId);
  return g;
}

// 문지기의 좌대 — 화강암 기단 + 몸돌 + 갓돌.
function makePedestal(side, hotId, era) {
  const [cx, , cz] = LV.props.keySpot;
  const c = era === 'PRESENT' ? 0x7e766c : 0x9a8a74;
  const m = pbr('granite_wall', { repeat: [0.3, 0.3], rotate: Math.PI / 2, color: c, side, env: 0.12 });
  const g = new THREE.Group();
  g.add(box(0.42, 0.07, 0.42, m, cx, 0.035, cz));
  const shaftM = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.165, 0.33, 12), m);
  shaftM.position.set(cx, 0.235, cz);
  shaftM.castShadow = shaftM.receiveShadow = true;
  g.add(shaftM);
  g.add(box(0.36, 0.05, 0.36, m, cx, 0.425, cz));
  g.add(box(0.3, 0.03, 0.3, m, cx, 0.465, cz));
  if (hotId) markHot(g, hotId);
  return g;
}

// 카노푸스 단지(설화석고). smashed면 도굴꾼이 깨뜨린 조각들만 남는다.
function makeUrn(side, hotId, x, z, { smashed = false, tint = 0xb2a284 } = {}) {
  const g = new THREE.Group();
  const alab = new THREE.MeshStandardMaterial({
    color: tint, roughness: 0.74, envMapIntensity: 0.06, side,
  });
  if (smashed) {
    const rand = rng((x * 37 + z * 91) | 0);
    for (let i = 0; i < 6; i++) {
      const a = rand() * 6.283, r = 0.08 + rand() * 0.22;
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.05 + rand() * 0.05), alab);
      shard.position.set(x + Math.cos(a) * r, 0.03, z + Math.sin(a) * r);
      shard.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      shard.castShadow = true;
      if (hotId) shard.userData.hot = hotId;
      g.add(shard);
    }
    // 깨진 밑동
    const stump = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0), new THREE.Vector2(0.14, 0.01),
      new THREE.Vector2(0.185, 0.1), new THREE.Vector2(0.19, 0.16),
    ], 14), alab);
    stump.position.set(x, 0, z);
    stump.castShadow = true;
    if (hotId) stump.userData.hot = hotId;
    g.add(stump);
  } else {
    const jar = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0), new THREE.Vector2(0.14, 0.01),
      new THREE.Vector2(0.19, 0.14), new THREE.Vector2(0.2, 0.32),
      new THREE.Vector2(0.15, 0.52), new THREE.Vector2(0.11, 0.56),
    ], 18), alab);
    jar.position.set(x, 0, z);
    jar.castShadow = jar.receiveShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.012, 8, 18), gold({ side }));
    band.rotation.x = Math.PI / 2;
    band.position.set(x, 0.55, z);
    const lid = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0), new THREE.Vector2(0.115, 0.005),
      new THREE.Vector2(0.09, 0.07), new THREE.Vector2(0.035, 0.12),
      new THREE.Vector2(0.001, 0.15),
    ], 16), alab);
    lid.position.set(x, 0.56, z);
    lid.castShadow = true;
    for (const o of [jar, band, lid]) { if (hotId) o.userData.hot = hotId; g.add(o); }
  }
  return g;
}

// 제단 — 화강암 기단, 상형문자 띠를 두른 몸돌, 갓돌과 봉헌 그릇.
function makeAltar(side, era) {
  const [cx, , cz] = LV.props.altar;
  const E = ERA[era];
  const g = new THREE.Group();
  const granite = pbr('granite_wall', { repeat: [0.4, 0.3], rotate: Math.PI / 2, color: era === 'PRESENT' ? 0x6f6860 : 0x8c7d6a, side, env: 0.12 });
  g.add(box(0.92, 0.1, 0.92, granite, cx, 0.05, cz));
  g.add(box(0.68, 0.62, 0.68, granite, cx, 0.41, cz));
  g.add(box(0.86, 0.09, 0.86, granite, cx, 0.765, cz));
  const band = glyphBandMaps({ seed: 40, painted: E.painted, tone: hex(E.tint) });
  if (band) {
    const bm = new THREE.MeshStandardMaterial({
      map: band.map, normalMap: band.normalMap, color: E.band,
      roughness: 0.95, side, envMapIntensity: 0.08,
    });
    for (const [dx, dz, ry] of [[0, 0.345, 0], [0, -0.345, Math.PI], [0.345, 0, -Math.PI / 2], [-0.345, 0, Math.PI / 2]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.3), bm);
      p.position.set(cx + dx, 0.45, cz + dz);
      p.rotation.y = ry;
      g.add(p);
    }
  }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.02, 0), new THREE.Vector2(0.1, 0.015),
    new THREE.Vector2(0.13, 0.05), new THREE.Vector2(0.12, 0.07),
  ], 16), bronze({ side }));
  bowl.position.set(cx - 0.22, 0.81, cz + 0.18);
  bowl.castShadow = true;
  g.add(bowl);
  if (era === 'P2') {   // 봉헌 빵과 기름 등잔 — 사제단이 다녀간 흔적
    for (const [dx, dz] of [[0.1, 0.2], [0.22, 0.12], [0.16, -0.05]]) {
      const bread = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 10), ceramic(0xc9a25a, { side }));
      bread.position.set(cx + dx, 0.865, cz + dz);
      bread.castShadow = true;
      g.add(bread);
    }
  }
  return g;
}

// 가슴장식 — 황금 반달 목걸이에 청금석 풍뎅이와 구슬 줄.
export function makePectoral(side, hotId) {
  const g = new THREE.Group();
  const au = gold({ side }), lz = lapis({ side });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 10, 22, Math.PI), au);
  arc.rotation.x = Math.PI / 2;
  g.add(arc);
  const scarab = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), lz);
  scarab.scale.set(1, 0.55, 1.25);
  scarab.position.set(0, 0.02, 0.1);
  g.add(scarab);
  for (const s of [-1, 1]) {   // 풍뎅이의 금 날개
    const wing = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10, s > 0 ? -0.5 : Math.PI - 0.7, 1.2), au);
    wing.rotation.x = -Math.PI / 2;
    wing.position.set(s * 0.035, 0.02, 0.1);
    g.add(wing);
  }
  const beadC = [0xd8a93c, 0x1d3d8f, 0x9a3b22];
  for (let i = 0; i < 9; i++) {
    const a = -1.35 + (i / 8) * 2.7;
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8),
      i % 3 === 1 ? lz : new THREE.MeshStandardMaterial({
        color: beadC[i % 3], metalness: i % 3 === 0 ? 1 : 0.1,
        roughness: 0.35, envMapIntensity: 1.0, side,
      }));
    bead.position.set(Math.sin(a) * 0.145, 0.012, Math.cos(a) * 0.145);
    bead.castShadow = true;
    g.add(bead);
  }
  g.traverse((o) => { o.castShadow = true; });
  if (hotId) markHot(g, hotId);
  return g;
}

// 석비 — 둥근 이마의 사암 비석. 앞면에 날개 태양과 세로 경문.
function makeStele(side, era, hotId) {
  const E = ERA[era];
  const g = new THREE.Group();
  const stone = pbr('large_sandstone_blocks_01', { repeat: [0.25, 0.35], color: E.wall, side, env: 0.15 });
  const body = box(0.72, 0.92, 0.09, stone, 0, -0.11, 0);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.09, 20, 1, false, 0, Math.PI), stone);
  top.rotation.set(Math.PI / 2, 0, 0);
  top.position.set(0, 0.35, 0);
  top.castShadow = true;
  g.add(body, top);
  const face = steleFaceMaps({ seed: 21, painted: E.painted });
  if (face) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.9),
      new THREE.MeshStandardMaterial({
        map: face.map, normalMap: face.normalMap, roughness: 0.9, side,
        envMapIntensity: 0.12, color: era === 'PRESENT' ? 0x9a9184 : 0xffffff,
      }));
    p.position.set(0, 0.02, 0.048);
    g.add(p);
  }
  if (hotId) markHot(g, hotId);
  return g;
}

// 천으로 덮인 옛 거울(시대 씬 속 소품 — 재귀 방지).
function makeCoveredMirror(side, x, z, facingEast) {
  const g = new THREE.Group();
  const cloth = linenMap();
  const m = cloth
    ? new THREE.MeshStandardMaterial({ map: cloth, color: 0x9a8e78, roughness: 1.0, envMapIntensity: 0.06, side })
    : plain(0x9a8e78, { side });
  const core = box(1.02, 1.95, 0.34, m, 0, 0.975, 0);
  const drape = box(1.14, 0.5, 0.46, m, 0, 0.25, 0);       // 바닥에 고인 자락
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.02, 6, 20), wood(0x6a5638, { side }));
  rope.rotation.x = Math.PI / 2;
  rope.position.y = 1.15;
  rope.scale.set(1, 0.36, 1);
  g.add(core, drape, rope);
  g.position.set(x, 0, z);
  g.rotation.y = facingEast ? Math.PI / 2 : -Math.PI / 2;
  return g;
}

// 수의를 두른 사람 형상 — 유리 저편 합성물과 현재의 본체 표식에 쓴다.
function makeFigure(side) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x8a8274, roughness: 0.9, side });
  const robe = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.001, 0), new THREE.Vector2(0.21, 0.02),
    new THREE.Vector2(0.15, 0.55), new THREE.Vector2(0.17, 0.95),
    new THREE.Vector2(0.13, 1.22), new THREE.Vector2(0.001, 1.3),
  ], 12), m);
  robe.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), m);
  head.position.y = 1.38;
  head.scale.set(0.9, 1.1, 0.95);
  head.castShadow = true;
  g.add(robe, head);
  return g;
}

// 도굴꾼의 유해 — 봉인문 앞에 웅크린 백골. 처음부터 놓여 있는 붙박이 소품.
function makeRobberCorpse(side, hotId) {
  const g = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({ color: 0xcbbd9e, roughness: 0.85, side });
  const rag = new THREE.MeshStandardMaterial({ color: 0x3a3229, roughness: 1.0, side });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), bone);
  skull.scale.set(0.9, 0.82, 1.05);
  skull.position.set(0, 0.07, 0.42);
  skull.rotation.x = 0.5;
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.06), bone);
  jaw.position.set(0, 0.025, 0.47);
  // 갈비뼈 — 흉곽의 완만한 호
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.09 - i * 0.008, 0.008, 6, 10, Math.PI), bone);
    rib.rotation.set(Math.PI / 2, 0, 0.15);
    rib.position.set(0, 0.045, 0.22 - i * 0.07);
    g.add(rib);
  }
  // 팔뼈 하나는 문 쪽으로 뻗어 있다 — 긁다 멈춘 손
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6), bone);
  arm.rotation.set(Math.PI / 2, 0, -0.5);
  arm.position.set(-0.16, 0.03, 0.34);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.06), bone);
  hand.position.set(-0.28, 0.02, 0.44);
  // 다리뼈 둘
  for (const [dx, rz] of [[0.03, 0.25], [0.09, 0.1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 6), bone);
    leg.rotation.set(Math.PI / 2, 0, rz);
    leg.position.set(dx, 0.03, -0.28);
    g.add(leg);
  }
  // 삭은 옷가지 — 골반께에 눌어붙은 천
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.4), rag);
  cloth.rotation.x = -Math.PI / 2;
  cloth.position.set(0.01, 0.012, -0.05);
  g.add(skull, jaw, arm, hand, cloth);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (hotId) o.userData.hot = hotId; } });
  return g;
}

// 유리 저편(이동 중 거울 너머로 보이는 현재) — 어두운 틀 + 본체 실루엣.
function makeBackWindow(side) {
  const bw = new THREE.Group();
  bw.add(box(1.1, 1.9, 0.06, plain(0x2c241a, { side }), 0, 0.95, -0.04));
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.75),
    new THREE.MeshBasicMaterial({ color: 0x0a0806, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  dark.position.y = 0.95;
  bw.add(dark);
  const statue = makeFigure(side);
  bw.add(statue);
  bw.visible = false;
  // 거울빛 스포트라이트의 광원이 바로 뒤에 있다 — 그림자를 만들면 원뿔 전체가 가려진다
  bw.traverse((o) => { o.castShadow = false; });
  return { group: bw, statue };
}

// 봉헌 선반(P1 서쪽 구석) — 돌 궤 위에 항아리와 등잔.
function makeShelf(side, zc, era) {
  const g = new THREE.Group();
  const E = ERA[era];
  const stone = pbr('large_sandstone_blocks_01', { repeat: [0.35, 0.2], color: E.wall, side, env: 0.15 });
  g.add(box(1.0, 0.55, 1.7, stone, -6.9, 0.275, zc));
  const rand = rng(zc > 0 ? 5 : 6);
  for (const dz of [-0.55, -0.1, 0.35]) {
    const r = 0.07 + rand() * 0.04;
    // 채널별로 흙빛만 흔든다 — 통짜 덧셈은 자리올림으로 색이 튄다
    const cr = 0x8a + ((rand() * 0x22) | 0), cg = 0x5e + ((rand() * 0x16) | 0), cb = 0x38 + ((rand() * 0x10) | 0);
    const pot = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0), new THREE.Vector2(r, 0.01),
      new THREE.Vector2(r + 0.035, 0.1), new THREE.Vector2(r - 0.01, 0.2),
      new THREE.Vector2(r + 0.01, 0.24),
    ], 12), ceramic((cr << 16) | (cg << 8) | cb, { side }));
    pot.position.set(-6.9 + (rand() - 0.5) * 0.3, 0.55, zc + dz + rand() * 0.2);
    pot.castShadow = true;
    g.add(pot);
  }
  return g;
}

// 붕괴 돌무더기 — 바위·판석 조각·모래 무덤. 금빛이 보이는 틈을 남겨 둔다.
function makeRockPile(side, hotId) {
  const g = new THREE.Group();
  const [px, , pz] = LV.props.keySpot;   // 붕괴 더미는 열쇠 자리를 따라간다
  const rockM = pbr('rock_boulder_dry', { repeat: [1.6, 1.6], color: 0x8a7d6c, side, env: 0.08 });
  const slabM = pbr('rock_boulder_dry', { repeat: [0.6, 0.6], color: 0x9a8f80, side, env: 0.08 });
  const sandM = pbr('dense_sand', { repeat: [2.4, 2.4], color: 0xa4957c, side, env: 0.06 });
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 15), sandM);
  mound.scale.set(1.7, 0.17, 1.45);
  mound.position.set(px, -0.03, pz);
  mound.receiveShadow = true;
  g.add(mound);
  const rand = rng(20260809);
  // 금빛 틈(+0.12, +0.28) 방향은 비워 두고 바위를 두른다
  const spots = [
    [-0.45, -0.35, 0.36], [0.32, -0.44, 0.32], [-0.18, 0.42, 0.34],
    [0.5, 0.14, 0.28], [-0.55, 0.28, 0.3], [0.02, -0.12, 0.42], [-0.05, 0.68, 0.22],
  ];
  for (const [dx, dz, r] of spots) {
    // 구체 + 저주파 사인 변위 — 이음매 없이 매끈한 노멀의 울퉁불퉁한 바위
    const geo = new THREE.SphereGeometry(r, 16, 12);
    const pos = geo.attributes.position;
    const [a1, a2, a3] = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const d = 1
        + 0.16 * Math.sin(v.x * 5.1 / r + a1) * Math.sin(v.z * 4.3 / r + a2)
        + 0.1 * Math.sin(v.y * 6.7 / r + a3);
      pos.setXYZ(i, v.x * d, v.y * d * 0.82, v.z * d);
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, rockM);
    rock.position.set(px + dx, r * 0.5, pz + dz);
    rock.rotation.y = rand() * 6.28;
    rock.rotation.x = (rand() - 0.5) * 0.5;
    rock.castShadow = rock.receiveShadow = true;
    rock.userData.hot = hotId;
    g.add(rock);
  }
  for (let i = 0; i < 3; i++) {   // 천장에서 떨어진 판석 조각
    const slab = box(0.55 + rand() * 0.3, 0.1, 0.4 + rand() * 0.2, slabM,
      px + (rand() - 0.5) * 1.6, 0.3 + i * 0.15, pz + (rand() - 0.5) * 1.3, hotId);
    slab.rotation.set((rand() - 0.5) * 0.6, rand() * 3, (rand() - 0.5) * 0.4);
    g.add(slab);
  }
  return g;
}

// 천장 파공 + 쏟아지는 빛기둥.
function makeBreach(scene, anim) {
  const [px, , pz] = LV.props.keySpot;   // 붕괴 더미는 열쇠 자리를 따라간다
  // 뚫린 구멍(들쭉날쭉한 어둠)
  const holeGeo = new THREE.CircleGeometry(0.85, 14);
  const hp = holeGeo.attributes.position;
  const rand = rng(88);
  for (let i = 1; i < hp.count; i++) {
    hp.setX(i, hp.getX(i) * (0.75 + rand() * 0.5));
    hp.setY(i, hp.getY(i) * (0.75 + rand() * 0.5));
  }
  const hole = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color: 0x090a0c, fog: false }));
  hole.rotation.x = Math.PI / 2;
  hole.position.set(px, H - 0.01, pz);
  scene.add(hole);
  // 빛기둥
  const bm = beamMap();
  if (bm) {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.95, H, 18, 1, true),
      new THREE.MeshBasicMaterial({
        map: bm, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        color: 0xcfe0f5,
      }),
    );
    beam.position.set(px + 0.06, H / 2, pz + 0.14);
    scene.add(beam);
    anim.push((t) => { beam.material.opacity = 0.085 + 0.03 * Math.sin(t * 0.7); });
  }
  // 파공으로 새어 드는 낮빛 — 유일하게 그림자를 드리우는 광원
  const sun = new THREE.DirectionalLight(0xbdd2ec, 2.6);
  sun.position.set(px + 0.4, H + 2, pz + 0.8);
  sun.target.position.set(px, 0, pz);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 12;
  sun.shadow.bias = -0.002;
  scene.add(sun, sun.target);
}

// 떠다니는 먼지.
function makeDust(scene, anim, { x0, x1, z0, z1, count, seed, color = 0xd8c9a8, size = 0.02 }) {
  const dm = dustMap();
  if (!dm) return;
  const rand = rng(seed);
  const n = count;
  const posArr = new Float32Array(n * 3);
  const drift = [];
  for (let i = 0; i < n; i++) {
    posArr[i * 3] = x0 + rand() * (x1 - x0);
    posArr[i * 3 + 1] = 0.15 + rand() * (H - 0.4);
    posArr[i * 3 + 2] = z0 + rand() * (z1 - z0);
    drift.push([(rand() - 0.5) * 0.05, -0.02 - rand() * 0.035, (rand() - 0.5) * 0.05, rand() * 6.28]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    map: dm, color, size, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true,
  }));
  scene.add(pts);
  anim.push((t, dt) => {
    const p = geo.attributes.position;
    for (let i = 0; i < n; i++) {
      let y = p.getY(i) + drift[i][1] * dt;
      if (y < 0.1) y = H - 0.3;
      p.setXYZ(i,
        p.getX(i) + (drift[i][0] + Math.sin(t * 0.6 + drift[i][3]) * 0.02) * dt,
        y,
        p.getZ(i) + drift[i][2] * dt);
    }
    p.needsUpdate = true;
  });
}

// 모래 더미(현재) — 벽 밑과 구석에 흘러든 사구 자락.
function sandDrifts(scene, side) {
  const alpha = sandPatchAlpha();
  if (!alpha) return;
  const sandM = new THREE.MeshStandardMaterial({
    map: pbr('dense_sand', { repeat: [1.5, 1.5], side }).map,
    normalMap: pbr('dense_sand', { repeat: [1.5, 1.5], side }).normalMap,
    color: 0xb5a68a, alphaMap: alpha, transparent: true, depthWrite: false,
    roughness: 0.95, side, envMapIntensity: 0.08,
  });
  const rand = rng(313);
  const spots = [
    [-6.8, 2.4, 1.7], [-5.5, -2.6, 1.4], [-0.9, 2.5, 1.2], [-0.75, -2.3, 1.0],
    [3.2, 2.6, 1.5], [6.5, -2.2, 1.3], [6.8, 1.8, 1.1], [-4.2, 0.4, 0.9],
  ];
  spots.forEach(([x, z, s], i) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(s, 20), sandM);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = rand() * 6.28;
    p.position.set(x, 0.008 + i * 0.0012, z);
    p.receiveShadow = true;
    scene.add(p);
  });
}

// ── 문제 2 소품 ────────────────────────────────────────────────

// 청동 끌 — 사제의 연장. 자루, 납작한 날, 두들겨 뭉개진 머리.
export function makeChisel(side, hotId) {
  const g = new THREE.Group();
  const br = bronze({ side, color: 0x6a4f28 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.2, 10), br);
  shaft.rotation.z = Math.PI / 2;
  const blade = box(0.09, 0.012, 0.036, br, 0.135, 0, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), br);
  head.scale.set(0.65, 1, 1);
  head.position.x = -0.11;
  g.add(shaft, blade, head);
  g.traverse((o) => { o.castShadow = true; });
  if (hotId) markHot(g, hotId);
  return g;
}

// 청동 핀 — 고리 머리가 달린 빗장 핀. 벽감 구멍에 꽂히는 +z 방향.
export function makePin(side, hotId) {
  const g = new THREE.Group();
  const br = bronze({ side, color: 0x74582c });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.007, 0.15, 10), br);
  shaft.rotation.x = Math.PI / 2;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 12), br);
  collar.position.z = 0.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.007, 8, 14), br);
  ring.position.z = 0.085;
  g.add(shaft, collar, ring);
  g.traverse((o) => { o.castShadow = true; });
  if (hotId) markHot(g, hotId);
  return g;
}

// 황금 스카라베 — 금고 좌대 위의 부장 성물.
export function makeScarab(side) {
  const g = new THREE.Group();
  const au = gold({ side });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), au);
  body.scale.set(1.15, 0.55, 0.85);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), au);
  head.scale.set(1.3, 0.7, 1);
  head.position.set(0, 0.004, 0.062);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.005, 6, 16), au);
  seam.rotation.y = Math.PI / 2;
  seam.scale.set(0.6, 1.05, 1);
  g.add(body, head, seam);
  for (const s of [-1, 1]) {
    for (const [dz, a] of [[0.03, 0.5], [-0.005, 0.1], [-0.04, -0.4]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.05, 6), au);
      leg.rotation.z = s * (Math.PI / 2 - 0.5);
      leg.rotation.y = a;
      leg.position.set(s * 0.06, -0.02, dz);
      g.add(leg);
    }
  }
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

// 헐거운 벽돌 — 벽에서 뽑아 손에 드는 실물. 슬롯 바와 바닥 표시가 같은 메이커를 쓴다.
export function makeBrick(side, color = 0xdfbe84) {
  const g = new THREE.Group();
  g.add(box(0.34, 0.18, 0.14,
    pbr('large_sandstone_blocks_01', { repeat: [0.12, 0.06], color, side, env: 0.15 }),
    0, 0, 0));
  return g;
}

// 몰탈 테 — 가운데가 뚫린 프레임. 벽돌이 있으면 둘레 유격을 메우고,
// 벽돌이 빠지면 포켓 개구부를 두른다 (솔리드 상자면 개구부를 가려 버린다).
function makeMortarFrame(side, color) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, envMapIntensity: 0.08, side });
  const bar = (w, h, x, y) => {
    const b = box(w, h, 0.03, m, x, y, 0);
    b.castShadow = false;
    g.add(b);
  };
  bar(0.42, 0.03, 0, 0.105);
  bar(0.42, 0.03, 0, -0.105);
  bar(0.04, 0.18, -0.19, 0);
  bar(0.04, 0.18, 0.19, 0);
  return g;
}

// 벽돌이 빠진 자리 — 검은 판이 아니라 진짜 벽 속 포켓.
// 상하좌우 석재 베벨이 4cm 깊이를 만들고, 뒷판은 실제 벽면이 그대로 비치되
// 반투명 그늘에 가라앉는다 — 벽돌 하나가 빠진 벽처럼 읽힌다.
function makeBrickPocket(side, era) {
  const g = new THREE.Group();
  const w = 0.34, h = 0.18, z0 = 2.956, z1 = 2.999, mid = (z0 + z1) / 2, d = z1 - z0;
  const stoneM = pbr('large_sandstone_blocks_01', {
    repeat: [0.08, 0.04], color: era === 'PRESENT' ? 0x4a4036 : 0x5f4e39, side, env: 0.04,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), stoneM);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -h / 2, mid);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), stoneM);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, h / 2, mid);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(d, h), stoneM);
  left.rotation.y = Math.PI / 2;
  left.position.set(-w / 2, 0, mid);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(d, h), stoneM);
  right.rotation.y = -Math.PI / 2;
  right.position.set(w / 2, 0, mid);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.62 }));
  shade.rotation.y = Math.PI;
  shade.position.set(0, 0, z1);
  g.add(floor, ceil, left, right, shade);
  g.traverse((o) => { o.castShadow = false; o.receiveShadow = true; });
  return g;
}

// 금고 속 감실 — 다듬은 돌을 회반죽으로 미장하고 테두리에 붉은 선을 두른 방.
// 뒷판은 벽면 바로 앞에 서고 네 면이 앞으로 뻗어 실제 깊이를 만든다 (벽을 뚫을 수는
// 없으므로 감실 전체가 벽에서 앞으로 돌출한 감실함이다 — 이집트 나오스의 문법).
// 봉헌물은 화강암 선반 위 밀랍 받침에 앉는다. 현재 시대에는 밀랍이 삭고 먼지가 앉았다.
function makeVaultCavity(side, era, nx, ny, nz, frameM) {
  const aged = era === 'PRESENT';
  const g = new THREE.Group();
  // 미장은 테두리 앞면(zL)까지 덮는다 — 중간에서 끊으면 화강암 상자의 안쪽 면이
  // 드러나는데, BoxGeometry는 면마다 UV를 늘여 붙이므로 그 자리에 결이 죽죽 늘어진다.
  const zB = nz - 0.045, zL = nz + 0.165;   // 뒷판 ~ 앞 테두리
  const zC = nz + 0.045;                    // 봉헌물이 앉는 자리 (닫힌 문 안쪽)
  const hw = 0.32, hh = 0.32;               // 안쪽 반폭·반높이
  // 손전등이 1m 앞에서 정면으로 때리는 자리다 — 반사율을 낮게 잡지 않으면
  // 회반죽이 하얗게 날아가 판지처럼 보인다. 과거는 거울빛만 닿으므로 조금 밝게.
  // 반복 수는 면마다 실제 크기에 맞춘다 (BoxGeometry는 면마다 UV를 0~1로 늘여
  // 붙이므로, 한 값으로 통일하면 좁고 깊은 면에서 결이 죽죽 늘어난다).
  const TILE = 0.36;
  const lin = (w, h) => pbr('worn_cracked_plaster', {
    repeat: [w / TILE, h / TILE], color: aged ? 0x2f2a23 : 0x6f6450, side, env: 0.04, rough: 1.0,
  });
  const zMid = (zB + zL) / 2, depth = zL - zB;
  g.add(box(hw * 2, hh * 2, 0.03, lin(hw * 2, hh * 2), nx, ny, zB));
  g.add(box(hw * 2, 0.03, depth, lin(hw * 2, depth), nx, ny + hh, zMid));
  g.add(box(hw * 2, 0.03, depth, lin(hw * 2, depth), nx, ny - hh, zMid));
  g.add(box(0.03, hh * 2, depth, lin(depth, hh * 2), nx - hw, ny, zMid));
  g.add(box(0.03, hh * 2, depth, lin(depth, hh * 2), nx + hw, ny, zMid));
  // 뒷판의 붉은 테 — 봉헌 감실이라는 표시. 세월에 삭아 흐려진다.
  const paint = new THREE.MeshStandardMaterial({
    color: aged ? 0x452a1e : 0x7e2f19, roughness: 1, side,
    transparent: true, opacity: aged ? 0.5 : 0.85, envMapIntensity: 0.03,
  });
  for (const [w, h, dx, dy] of [[0.5, 0.018, 0, 0.24], [0.5, 0.018, 0, -0.24],
    [0.018, 0.5, -0.25, 0], [0.018, 0.5, 0.25, 0]]) {
    g.add(box(w, h, 0.004, paint, nx + dx, ny + dy, zB + 0.017));
  }
  // 화강암 선반 — 봉헌물이 앉는 자리. 닫힌 문에 닿지 않을 만큼만 앞으로 나온다.
  const shelfY = ny - 0.15;
  g.add(box(hw * 2 - 0.03, 0.04, 0.15, frameM, nx, shelfY, zC - 0.015));
  // 밀랍 받침 — 봉헌물을 고정하던 판. 현재는 삭아 부스러기만 남았다.
  const waxM = new THREE.MeshStandardMaterial({
    color: aged ? 0x4a4234 : 0x8d7d5c, roughness: aged ? 0.95 : 0.62,
    envMapIntensity: 0.04, side,
  });
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.022, 18), waxM);
  wax.position.set(nx, shelfY + 0.031, zC);
  wax.scale.set(1, 1, 0.62);
  wax.castShadow = wax.receiveShadow = true;
  g.add(wax);
  if (aged) {
    // 삭아 떨어진 밀랍 부스러기와 벽에서 흘러내린 먼지
    const rand = rng(4271);
    for (let i = 0; i < 9; i++) {
      const c = box(0.012 + rand() * 0.016, 0.006 + rand() * 0.008, 0.01 + rand() * 0.014,
        waxM, nx + (rand() - 0.5) * 0.5, shelfY + 0.025, zC + (rand() - 0.5) * 0.09);
      c.rotation.set(rand(), rand() * 3, rand());
      g.add(c);
    }
    const dust = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 - 0.06, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0x4a443a, roughness: 1, transparent: true, opacity: 0.55, side, envMapIntensity: 0.02,
      }));
    dust.rotation.x = -Math.PI / 2;
    dust.position.set(nx, shelfY + 0.021, zC - 0.015);
    g.add(dust);
  }
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return { group: g, shelfY, zMid: zC };
}

// 벽감 금고 — 화강암 테두리, 회전하는 금고문(경첩 그룹), 문에 붙은 로제트와 핀 구멍.
// 반환 refs: { plaster, vaultDoor(경첩 그룹), rosette, scarab, pectoral }
function makeNicheVault(scene, side, era, { plasterHot, plasterVisible = true }) {
  const [nx, ny, nz] = LV.props.niche;
  const aged = era === 'PRESENT';
  // 깊어진 감실은 안쪽 면이 넓게 드러난다 — 반복을 키워야 화강암 결이 살고,
  // 반사율을 낮춰야 손전등 정면광에 하얗게 뜨지 않는다.
  const frameM = pbr('granite_wall', { repeat: [0.75, 0.75], rotate: Math.PI / 2, color: aged ? 0x53504a : 0x6d6357, side, env: 0.1 });
  // 테두리(상하좌우) — 깊이 0.22의 감실함. 벽면(z0)에서 앞으로 뻗는다.
  const fz = nz + 0.06;
  scene.add(box(0.78, 0.07, 0.22, frameM, nx, ny + 0.355, fz));
  scene.add(box(0.78, 0.07, 0.22, frameM, nx, ny - 0.355, fz));
  scene.add(box(0.07, 0.64, 0.22, frameM, nx - 0.355, ny, fz));
  scene.add(box(0.07, 0.64, 0.22, frameM, nx + 0.355, ny, fz));
  // 안쪽 감실 — 미장한 네 면, 붉은 테, 화강암 선반, 밀랍 받침
  const cav = makeVaultCavity(side, era, nx, ny, nz, frameM);
  scene.add(cav.group);
  // 봉헌물 — 밀랍 받침 위의 스카라베, 그 곁에 눕힌 가슴장식
  const scarab = makeScarab(side);
  scarab.position.set(nx + 0.055, cav.shelfY + 0.06, cav.zMid + 0.015);
  scarab.rotation.y = -0.25;
  scarab.visible = false;
  scene.add(scarab);
  const pectoral = makePectoral(side, null);
  pectoral.scale.setScalar(0.72);
  pectoral.position.set(nx - 0.115, cav.shelfY + 0.05, cav.zMid + 0.005);
  pectoral.rotation.set(-1.35, 0.2, 0);
  pectoral.visible = false;
  scene.add(pectoral);
  // 금고문 — 왼쪽 경첩으로 방 안쪽(+z)으로 열린다
  const hinge = new THREE.Group();
  hinge.position.set(nx - 0.19, ny, nz + 0.135);
  const doorM = new THREE.MeshStandardMaterial({
    color: aged ? 0x4e3f28 : 0x7e5f2c, metalness: 0.85,
    roughness: aged ? 0.72 : 0.55, envMapIntensity: aged ? 0.25 : 0.45, side,
  });
  const panel = box(0.4, 0.42, 0.035, doorM, 0.19, 0, 0, plasterHot);
  hinge.add(panel);
  // 로제트(문에 부착) — 꽃잎 살과 중심 핀 구멍
  const rosette = new THREE.Group();
  rosette.position.set(0.19, 0.06, 0.028);
  const rosM = aged ? bronze({ side, color: 0x574427 }) : gold({ side, envMapIntensity: 0.5 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 8, 20), rosM);
  rosette.add(rim);
  for (let i = 0; i < 8; i++) {
    const petal = box(0.06, 0.018, 0.012, rosM, 0, 0, 0);
    petal.position.set(Math.cos(i * Math.PI / 4) * 0.048, Math.sin(i * Math.PI / 4) * 0.048, 0);
    petal.rotation.z = i * Math.PI / 4;
    rosette.add(petal);
  }
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10), plain(0x0a0704, { side }));
  hole.rotation.x = Math.PI / 2;
  rosette.add(hole);
  rosette.traverse((o) => { o.userData.hot = plasterHot; });
  hinge.add(rosette);
  scene.add(hinge);
  // 회반죽 덮개 — 벽감 전체를 봉한 층
  const plasterM = pbr('rough_plaster_broken', {
    repeat: [0.5, 0.5], color: aged ? 0x8e887a : 0xe8dec2, side, env: 0.08,
  });
  const plaster = box(0.66, 0.66, 0.05, plasterM, nx, ny, nz + 0.17, plasterHot);
  plaster.visible = plasterVisible;
  scene.add(plaster);
  return { plaster, vaultDoor: hinge, rosette, scarab, pectoral };
}

// 화덕 — 바닥의 평평한 화덕돌과 둘레의 냇돌, 그을음 자국.
// 화덕 — 진흙 벽돌로 쌓은 얕은 사발(위에서 보면 벽돌 그릇). 바닥 판을 뚫는 대신
// 벽돌 테를 바닥 위로 올리고, 테에서 중심으로 내려가는 오목 곡면(선반 회전체)을
// 깔아 진짜 얕은 구멍처럼 보이게 한다.
function makeHearth(scene, side, era, hotId) {
  const [hx, , hz] = LV.props.hearth;
  const aged = era === 'PRESENT';
  const slabM = pbr('rock_boulder_dry', { repeat: [0.5, 0.5], color: aged ? 0x8a8178 : 0xa39684, side, env: 0.08 });
  const soot = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20),
    new THREE.MeshBasicMaterial({ color: 0x0c0a07, transparent: true, opacity: 0.55 }));
  soot.rotation.x = -Math.PI / 2;
  soot.position.set(hx, 0.004, hz);
  scene.add(soot);
  const rand = rng(era === 'P1' ? 71 : era === 'P2' ? 72 : 73);

  // 오목한 내부 — 불에 그을린 회벽. 테(r 0.30, +7.5cm)에서 중심으로 완만히 꺼진다
  const bowlM = pbr('rough_plaster_broken', {
    repeat: [0.7, 0.7], color: aged ? 0x35302a : 0x4d4335, side: THREE.DoubleSide, env: 0.04,
  });
  const pts = [];
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    pts.push(new THREE.Vector2(0.015 + t * 0.29, 0.012 + t * t * 0.065));
  }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 26), bowlM);
  bowl.position.set(hx, 0, hz);
  bowl.receiveShadow = true;
  bowl.userData.hot = hotId;
  scene.add(bowl);
  const center = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x14100b, roughness: 1, envMapIntensity: 0.04, side }));
  center.rotation.x = -Math.PI / 2;
  center.position.set(hx, 0.0125, hz);
  center.userData.hot = hotId;
  scene.add(center);

  // 테두리 — 둘레를 두르는 진흙 벽돌 링 (그을리고 조금씩 어긋나 있다)
  const brikM = pbr('large_sandstone_blocks_01', {
    repeat: [0.15, 0.08], color: aged ? 0x63513f : 0x86694a, side, env: 0.06,
  });
  const N = 11;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rand() * 0.12;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.09), brikM);
    b.position.set(hx + Math.cos(a) * 0.315, 0.05 + rand() * 0.014, hz + Math.sin(a) * 0.315);
    b.rotation.y = -a + Math.PI / 2 + (rand() - 0.5) * 0.18;
    b.rotation.z = (rand() - 0.5) * 0.1;
    b.castShadow = b.receiveShadow = true;
    b.userData.hot = hotId;
    scene.add(b);
  }

  let lid = null;
  if (!aged) {
    // 화덕돌이 벽돌 테 위에 얹혀 사발을 덮고 있다
    lid = box(0.54, 0.05, 0.54, slabM, hx, 0.095, hz, hotId);
  } else {
    // 도굴꾼이 들춰낸 화덕돌 — 비스듬히 밀쳐졌고, 사발 속이 드러났다
    lid = box(0.54, 0.05, 0.54, slabM, hx - 0.38, 0.05, hz + 0.28, hotId);
    lid.rotation.z = 0.22;
    // 사발 안의 것들 — 식은 재 무더기, 숯덩이, 깨진 그릇 조각
    const ash = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 1, envMapIntensity: 0.05, side }));
    ash.scale.set(1, 0.26, 0.85);
    ash.position.set(hx + 0.04, 0.026, hz - 0.03);
    ash.userData.hot = hotId;
    scene.add(ash);
    const coalM = new THREE.MeshStandardMaterial({ color: 0x171006, roughness: 0.95, envMapIntensity: 0.05, side });
    for (const [dx, dz2, r] of [[-0.09, 0.05, 0.032], [-0.02, -0.1, 0.026], [0.11, 0.08, 0.022]]) {
      const coal = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), coalM);
      coal.scale.y = 0.7;
      coal.position.set(hx + dx, 0.032, hz + dz2);
      coal.castShadow = true;
      coal.userData.hot = hotId;
      scene.add(coal);
    }
    const shard = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.013, 6, 10, Math.PI * 0.85),
      new THREE.MeshStandardMaterial({ color: 0x8a5232, roughness: 0.85, envMapIntensity: 0.08, side }));
    shard.rotation.set(-Math.PI / 2 + 0.35, 0, 0.8);
    shard.position.set(hx + 0.02, 0.04, hz + 0.13);
    shard.castShadow = true;
    shard.userData.hot = hotId;
    scene.add(shard);
  }
  scene.add(lid);
  return { lid };
}

// ═══════════════ 본 빌드 ═══════════════
export function buildPyramidScenes() {
  const refs = { p1: {}, p2: {}, present: {}, anim: [] };
  const hot = { P1: [], P2: [], PRESENT: [] };
  const anim = refs.anim;
  const [ax, az] = LV.mirrorA.pos;
  const [kx, , kz] = LV.props.keySpot;
  const [brx, bry, brz] = LV.props.brick;

  // ═══════════ P1 — 과거 1 (봉인 직후: 좌대의 열쇠, 회반죽 봉인문) ═══════════
  const p1 = new THREE.Scene();
  p1.background = new THREE.Color(ERA.P1.bg);
  p1.fog = new THREE.FogExp2(...ERA.P1.fog);
  {
    const S = ERA.P1.side;
    shell(p1, 'P1', 'sealed', anim);

    // 봉인문: 문틀을 메운 석판 위에 회반죽, 그 위에 인장 도장
    const slabM = pbr('rock_boulder_dry', { repeat: [1, 1.4], color: 0xa39684, side: S, env: 0.1 });
    p1.add(box(0.4, LV.doorway.y1, 1.18, slabM, 0, LV.doorway.y1 / 2, 0));
    const plasterM = pbr('rough_plaster_broken', { repeat: [0.7, 1], color: 0xf0e6ca, side: S, env: 0.08 });
    const plaster = box(0.1, LV.doorway.y1 - 0.16, 1.06, plasterM, -0.24, LV.doorway.y1 / 2, 0, 'p1SealedDoor');
    p1.add(plaster);
    refs.p1.doorPlaster = plaster;   // 끌로 뜯을 수 있다 (무해 — 열쇠는 이미 봉인됨)
    const sealM = ceramic(0x8a3a2a, { side: S });
    for (const [dy, dz] of [[0.55, 0.16], [0.55, -0.18], [1.05, 0.0], [1.05, 0.33], [1.55, 0.16], [1.55, -0.18]]) {
      const stamp = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.025, 14), sealM);
      stamp.rotation.z = Math.PI / 2;
      stamp.position.set(-0.3, dy, dz);
      stamp.userData.hot = 'p1Stamps';
      stamp.castShadow = true;
      p1.add(stamp);
    }

    // 문지기의 좌대와 황금 열쇠
    p1.add(makePedestal(S, 'p1Pedestal', 'P1'));
    const key = makeKey(S, 'p1Key');
    key.position.set(kx, 0.5, kz);
    p1.add(key);
    refs.p1.key = key;

    // 좌대 위 천장의 균열 — 훗날 무너질 자리라는 복선
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x241c12, transparent: true, opacity: 0.5, side: S }));
    crack.rotation.x = Math.PI / 2;
    crack.rotation.z = 0.7;
    crack.position.set(kx, H - 0.012, kz);
    crack.scale.set(1, 0.16, 1);
    p1.add(crack);

    // 남벽의 헐거운 벽돌 — 몰탈 소켓에 앉혀져 살짝만 돌출한다.
    // 소켓(어두운 몰탈 테)이 벽돌 둘레의 유격을 메워 떠 보이지 않게 한다.
    const mortar1 = makeMortarFrame(S, 0x2a2118);
    mortar1.traverse((o) => { o.userData.hot = 'p1Brick'; });
    mortar1.position.set(brx, bry, 2.965);
    p1.add(mortar1);
    const brick = box(0.34, 0.18, 0.14,
      pbr('large_sandstone_blocks_01', { repeat: [0.12, 0.06], color: 0xdfbe84, side: S, env: 0.15 }),
      brx, bry, 3.03, 'p1Brick');
    p1.add(brick);
    refs.p1.brick = brick;
    // 뽑힌 자리 — 실제 벽면을 뒷판 삼는 벽 속 포켓
    const hole1 = makeBrickPocket(S, 'P1');
    hole1.traverse((o) => { o.userData.hot = 'p1Brick'; });
    hole1.position.set(brx, bry, 0);
    hole1.visible = false;
    p1.add(hole1);
    refs.p1.brickHole = hole1;
    // 바닥에 내려놓은 벽돌 (인과가 위치를 정한다)
    const brickLoose = makeBrick(S);
    brickLoose.traverse((o) => { o.userData.hot = 'p1BrickLoose'; });
    brickLoose.rotation.y = 0.6;
    brickLoose.visible = false;
    p1.add(brickLoose);
    refs.p1.brickLoose = brickLoose;

    // ── 문제 2: 화덕돌 밑 공동 (P2에서 온 물건의 착지점) ──
    const hearth1 = makeHearth(p1, S, 'P1', 'p1Hearth');
    refs.p1.hearthLid = hearth1.lid;
    // ── 문제 2: 북벽의 회반죽 벽감 — 회반죽 → 로제트 → 금고문 → 스카라베 ──
    const vault1 = makeNicheVault(p1, S, 'P1', { plasterHot: 'p1Niche' });
    refs.p1.plaster = vault1.plaster;
    refs.p1.vaultDoor = vault1.vaultDoor;
    refs.p1.scarab = vault1.scarab;
    // 금고 속의 가슴장식 — 사제들이 스카라베와 함께 봉인했다. 과거 1에서 금고를
    // 열어 보면 두 보물이 나란히 보여야 세계선이 화면과 어긋나지 않는다.
    refs.p1.pectoralInVault = vault1.pectoral;
    // 과거에서는 봉헌물을 집을 수 없다 — 조준하면 금고 자체를 살펴본 것으로 친다
    for (const o of [vault1.scarab, vault1.pectoral]) markHot(o, 'p1Niche');
    // 개방된 벽감 곁에 꽂힌 청동 핀 / 바닥에 놓인 끌·핀 (인과가 위치를 정한다)
    const [nx1, ny1, nz1] = LV.props.niche;
    const pinInNiche = makePin(S, 'p1Pin');
    pinInNiche.position.set(nx1 + 0.24, ny1 - 0.17, nz1 + 0.1);
    pinInNiche.visible = false;
    p1.add(pinInNiche);
    refs.p1.pinInNiche = pinInNiche;
    const chiselLoose = makeChisel(S, 'p1Chisel');
    chiselLoose.visible = false;
    p1.add(chiselLoose);
    refs.p1.chisel = chiselLoose;
    const pinLoose = makePin(S, 'p1Pin');
    pinLoose.visible = false;
    p1.add(pinLoose);
    refs.p1.pinLoose = pinLoose;

    p1.add(makeUrn(S, 'p1Urn', LV.props.urnA[0], LV.props.urnA[2]));
    for (const zc of [-2.0, 2.0]) p1.add(makeShelf(S, zc, 'P1'));

    const bw = makeBackWindow(S);
    p1.add(bw.group);
    refs.p1.backWindow = bw.group;
    refs.p1.backStatue = bw.statue;

    // 거울빛(원뿔 스포트라이트)이 유일한 조명 — 발밑을 겨우 분간할 만큼만 남긴다
    p1.add(new THREE.HemisphereLight(0xffd9a0, 0x1a130a, 0.008));
    // 모든 메쉬가 그림자를 받아야 한다 — 유일한 조명이 그림자 스포트이므로
    // 하나라도 빠지면 가운데 벽 너머에서 저 혼자 밝게 뜬다 (글리프 띠·천장·선반이 그랬다).
    // shadowSide=BackSide: 과거 재질은 DoubleSide라 그림자 맵에 앞면 자신이 찍혀
    // 빛과 평행한 면(문틀 안쪽)에 바이어스로 못 잡는 자기그림자 줄무늬가 생긴다.
    p1.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m) m.shadowSide = THREE.BackSide;
      }
    });

    p1.traverse((o) => { if (o.userData?.hot) hot.P1.push(o); });
  }

  // ═══════════ P2 — 과거 2 (더 옛날: 통로 열림, 사제단의 방2) ═══════════
  const p2 = new THREE.Scene();
  p2.background = new THREE.Color(ERA.P2.bg);
  p2.fog = new THREE.FogExp2(...ERA.P2.fog);
  {
    const S = ERA.P2.side;
    shell(p2, 'P2', 'open', anim);

    p2.add(makeAltar(S, 'P2'));
    const jewels = makePectoral(S, 'p2Jewels');
    p2.add(jewels);
    refs.p2.jewels = jewels;

    {
      const fmTex = muralMaps({ painted: true });      // 과거: 안료가 아직 살아 있다
      const fm = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.35),
        fmTex
          ? new THREE.MeshStandardMaterial({ ...fmTex, roughness: 0.92, side: ERA.P2.side, envMapIntensity: 0.1 })
          : plain(0xc0a274, { side: ERA.P2.side }));
      fm.position.set(5.4, 1.5, -2.955);
      fm.userData.hot = 'p2Mural';
      p2.add(fm);
    }
    const stele = makeStele(S, 'P2', 'p2Stele');
    stele.position.set(3.0, 1.24, -2.9);
    p2.add(stele);

    // ── 문제 2: 사제의 끌 — 경문 곁 나무 작업대 위 ──
    const bench = new THREE.Group();
    const bw2 = wood(0x53381f, { side: S });
    bench.add(box(0.42, 0.035, 0.26, bw2, 3.2, 0.42, -2.6));
    for (const [dx, dz] of [[-0.16, -0.08], [0.16, -0.08], [-0.16, 0.08], [0.16, 0.08]]) {
      bench.add(box(0.04, 0.4, 0.04, bw2, 3.2 + dx, 0.2, -2.6 + dz));
    }
    const mallet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.11, 10), wood(0x6a4a28, { side: S }));
    mallet.rotation.z = Math.PI / 2;
    mallet.position.set(3.05, 0.485, -2.55);
    mallet.castShadow = true;
    bench.add(mallet);
    p2.add(bench);
    const chisel = makeChisel(S, 'p2Chisel');
    p2.add(chisel);
    refs.p2.chisel = chisel;
    // ── 문제 2: 화덕 (같은 화덕이 시대를 관통한다) ──
    makeHearth(p2, S, 'P2', 'p2Hearth');

    p2.add(makeUrn(S, 'p2Urn', LV.props.urnB[0], LV.props.urnB[2]));
    p2.add(makeUrn(S, null, LV.props.urnA[0], LV.props.urnA[2]));
    for (const zc of [-2.0, 2.0]) p2.add(makeShelf(S, zc, 'P2'));

    // 동벽에 붙인 봉헌 궤 — 벽 여백(비보행 0.3m) 안
    const chest = new THREE.Group();
    const cw = wood(0x5a3f24, { side: S });
    chest.add(box(0.5, 0.34, 0.26, cw, 7.32, 0.17, 2.2));
    chest.add(box(0.52, 0.07, 0.28, cw, 7.32, 0.375, 2.2));
    const chestBand = bronze({ side: S });
    chest.add(box(0.52, 0.03, 0.285, chestBand, 7.32, 0.3, 2.2));
    p2.add(chest);

    // 거울 A의 옛 원형(천 덮인 소품) — 열린 통로 너머 먼 배경
    p2.add(makeCoveredMirror(S, ax + 0.15, az, true));

    const bw = makeBackWindow(S);
    p2.add(bw.group);
    refs.p2.backWindow = bw.group;
    refs.p2.backStatue = bw.statue;

    // 거울빛이 유일한 조명
    p2.add(new THREE.HemisphereLight(0xffdca0, 0x1c150a, 0.008));
    // P1과 같은 이유 — 모든 메쉬가 그림자를 받고, 닫힌 박스는 뒷면만 그림자 맵에 쓴다
    p2.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m) m.shadowSide = THREE.BackSide;
      }
    });

    p2.traverse((o) => { if (o.userData?.hot) hot.P2.push(o); });
  }

  // ═══════════ PRESENT — 현재 (붕괴와 도굴 이후) ═══════════
  const present = new THREE.Scene();
  present.background = new THREE.Color(ERA.PRESENT.bg);
  present.fog = new THREE.FogExp2(...ERA.PRESENT.fog);
  {
    const S = ERA.PRESENT.side;
    shell(present, 'PRESENT', 'door', anim);
    sandDrifts(present, S);

    // 잠긴 돌문 (경첩: 문틀 남쪽 z0) — 화강암 판문 + 청동 자물쇠판
    const doorG = new THREE.Group();
    doorG.position.set(0, 0, LV.doorway.z0);
    const slab = box(0.22, LV.doorway.y1 - 0.04, 1.16,
      pbr('rock_boulder_dry', { repeat: [1, 1.4], color: 0x9a9188, side: S, env: 0.1 }),
      0, LV.doorway.y1 / 2, 0.6, 'presentDoor');
    doorG.add(slab);
    const colBand = glyphBandMaps({ seed: 90, painted: false, tone: '#8a8074' });
    if (colBand) {
      const col = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.32),
        new THREE.MeshStandardMaterial({
          map: colBand.map, normalMap: colBand.normalMap, color: 0x847c72,
          roughness: 0.95, side: S, envMapIntensity: 0.08,
        }));
      col.rotation.y = -Math.PI / 2;
      col.rotation.z = Math.PI / 2;
      col.position.set(-0.115, 1.0, 0.35);
      doorG.add(col);
    }
    const plate = box(0.03, 0.24, 0.17, bronze({ side: S, color: 0x5c4426 }), -0.12, 1.0, 0.75, 'presentDoor');
    const hole = box(0.04, 0.085, 0.05, plain(0x0c0906, { side: S }), -0.125, 0.985, 0.75, 'presentDoor');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 8, 18), bronze({ side: S, color: 0x50401f }));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-0.14, 1.28, 0.75);
    ring.userData.hot = 'presentDoor';
    doorG.add(plate, hole, ring);
    present.add(doorG);
    refs.present.doorGroup = doorG;

    // 붕괴 돌무더기 + 틈새의 금빛(파생) + 천장 파공과 빛기둥
    const pile = makeRockPile(S, 'presentPile');
    present.add(pile);
    const glint = new THREE.Group();
    const nug = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), gold({ side: S }));
    glint.add(nug);
    const glintLight = new THREE.PointLight(0xffd070, 1.4, 1.6, 2);
    glint.add(glintLight);
    glint.position.set(kx + 0.12, 0.3, kz + 0.28);
    nug.userData.hot = 'presentPile';
    present.add(glint);
    refs.present.glint = glint;
    anim.push((t) => { glintLight.intensity = glint.visible ? 1.1 + 0.7 * Math.sin(t * 2.6) : 0; });
    makeBreach(present, anim);

    // 헐거운 벽돌 — 색이 다른 돌 하나. 몰탈 소켓이 유격을 메운다
    const mortarNow = makeMortarFrame(S, 0x241d15);
    mortarNow.traverse((o) => { o.userData.hot = 'presentBrick'; });
    mortarNow.position.set(brx, bry, 2.965);
    present.add(mortarNow);
    const brick = box(0.34, 0.18, 0.14,
      pbr('large_sandstone_blocks_01', { repeat: [0.12, 0.06], color: 0xa6947a, side: S, env: 0.15 }),
      brx, bry, 3.03, 'presentBrick');
    present.add(brick);
    refs.present.brick = brick;
    // 뽑힌 자리 — 실제 벽면을 뒷판 삼는 벽 속 포켓. 뽑은 벽돌은 아이템창(품)으로 간다
    const holeNow = makeBrickPocket(S, 'PRESENT');
    holeNow.traverse((o) => { o.userData.hot = 'presentBrick'; });
    holeNow.position.set(brx, bry, 0);
    holeNow.visible = false;
    present.add(holeNow);
    refs.present.brickHole = holeNow;
    // 구멍 속에 살아남은 열쇠·핀 — P1에서 벽돌을 닫아 두었을 때만 보인다 (파생).
    // 뽑는 순간 자동 회수가 아니라, 구멍 안에 놓인 실물을 E로 집는다.
    const keyInBrick = makeKey(S, 'presentBrick');
    keyInBrick.position.set(-3.95, 0.725, 2.975);
    keyInBrick.visible = false;
    present.add(keyInBrick);
    refs.present.keyInBrick = keyInBrick;
    const pinInBrick = makePin(S, 'presentBrick');
    pinInBrick.position.set(-4.06, 0.725, 2.972);
    pinInBrick.visible = false;
    present.add(pinInBrick);
    refs.present.pinInBrick = pinInBrick;

    // 열쇠를 방치했을 때 남는 모래 자국(파생)
    const traceG = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16),
      new THREE.MeshBasicMaterial({ color: 0x565046, transparent: true, opacity: 0.55 }));
    disc.rotation.x = -Math.PI / 2;
    const sil = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x3e382f, transparent: true, opacity: 0.6 }));
    sil.rotation.x = -Math.PI / 2;
    sil.position.y = 0.001;
    traceG.add(disc, sil);
    traceG.visible = false;
    present.add(traceG);
    refs.present.sandTrace = traceG;

    // ── 문제 2: 벽감 (현재) — 광물화된 회반죽 / 드러난 로제트와 금고문 ──
    const vaultNow = makeNicheVault(present, S, 'PRESENT', { plasterHot: 'presentNiche' });
    refs.present.nichePlaster = vaultNow.plaster;
    refs.present.rosette = vaultNow.rosette;
    refs.present.vaultDoor = vaultNow.vaultDoor;
    refs.present.scarab = vaultNow.scarab;
    refs.present.pectoralInVault = vaultNow.pectoral;
    refs.present.rosette.visible = false;   // 회반죽이 열려야 드러난다 (파생이 관리)
    // 열린 금고 속 봉헌물은 조준 대상이다 — E로 회수한다
    for (const o of [vaultNow.scarab, vaultNow.pectoral]) markHot(o, 'presentVaultScarab');
    // ── 문제 2: 들춰진 화덕돌 — 도굴꾼들이 먼저 뒤졌다 ──
    makeHearth(present, S, 'PRESENT', 'presentHearth');

    // 매장실: 도굴 이후 — 깨진 단지, 빈 제단, 색 바랜 석비
    present.add(makeAltar(S, 'PRESENT'));
    present.add(makeUrn(S, 'presentUrnB', LV.props.urnB[0], LV.props.urnB[2], { smashed: true, tint: 0xb0a68e }));
    present.add(makeUrn(S, 'presentUrnA', LV.props.urnA[0], LV.props.urnA[2], { smashed: true, tint: 0xb0a68e }));
    const stele = makeStele(S, 'PRESENT', null);
    stele.position.set(3.0, 1.24, -2.9);
    present.add(stele);

    // ── 문제 3: 아누비스 벽화 (북벽) — 목걸이 홈과 글리프 밭 ──
    const MW = 1.9, MH = 1.35, MX = 5.4, MY = 1.5, MZ = -2.955;
    const muralTex = muralMaps();                    // 현재: 안료가 씻겨 나갔다
    const mural = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH),
      muralTex
        ? new THREE.MeshStandardMaterial({ ...muralTex, roughness: 0.95, side: S, envMapIntensity: 0.08 })
        : plain(0xb09a74, { side: S }));
    mural.position.set(MX, MY, MZ);
    mural.userData.hot = 'mural';
    present.add(mural);
    const uvLocal = (r, c2) => {
      const { u, v } = cellCenterUV(r, c2);
      return { x: MX + (u - 0.5) * MW, y: MY + (0.5 - v) * MH };
    };
    // 앉힌 목걸이(호 + 구슬 셋)와 글리프 표식 — 파생이 켠다
    const seated = new THREE.Group();
    const beadPts = BEAD_CELLS.map(([r, c2]) => uvLocal(r, c2));
    for (const p2 of beadPts) {
      // 구슬 자체가 은은히 빛난다 — 표식은 배경 판이 아니라 보석이 맡는다
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8),
        lapis({ side: S, emissive: 0x3a5aa0, emissiveIntensity: 0.55 }));
      bead.position.set(p2.x, p2.y, MZ + 0.015);
      seated.add(bead);
    }
    const arcCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(beadPts[0].x - 0.35, beadPts[0].y + 0.12, MZ + 0.012),
      new THREE.Vector3(beadPts[1].x, beadPts[1].y - 0.16, MZ + 0.012),
      new THREE.Vector3(beadPts[2].x + 0.35, beadPts[2].y + 0.12, MZ + 0.012),
    );
    seated.add(new THREE.Mesh(new THREE.TubeGeometry(arcCurve, 20, 0.016, 8), gold({ side: S })));
    seated.visible = false;
    present.add(seated);
    refs.present.collarSeatedMesh = seated;
    // 글리프 표식: 가장자리가 0으로 사그라드는 원형 후광 — 네모난 배경 판이
    // 밝은 사암 위에서 흰 사각형으로 떠 보이던 결함의 교체품.
    const haloTex = (() => {
      if (!inBrowser) return null;
      const cnv = document.createElement('canvas');
      cnv.width = cnv.height = 64;
      const c2 = cnv.getContext('2d');
      const g = c2.createRadialGradient(32, 32, 2, 32, 32, 31);
      g.addColorStop(0, 'rgba(255,214,128,0.85)');
      g.addColorStop(0.55, 'rgba(255,196,96,0.28)');
      g.addColorStop(1, 'rgba(255,196,96,0)');
      c2.fillStyle = g;
      c2.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(cnv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    refs.present.glyphMarks = beadPts.map((p2) => {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26),
        haloTex
          ? new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
          : new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
      mark.position.set(p2.x, p2.y, MZ + 0.008);
      mark.visible = false;
      present.add(mark);
      return mark;
    });

    // ── 문제 3: 가짜 문 (남벽) — 풍뎅이 소켓과 세 글리프 다이얼 ──
    const FD = new THREE.Group();
    FD.position.set(4.2, 0, 2.955);
    // 남벽의 문: 로컬 +z 돌출부(소켓·다이얼·석판)가 방 안(-z)을 향하도록 돌린다.
    // 돌리지 않으면 전부 벽돌 속에 묻힌다 — 실제로 묻혀 있었다(발견된 결함).
    FD.rotation.y = Math.PI;
    // 위 회전 덕분에 로컬 +z가 방 쪽(관객 쪽)이다. 아래 깊이는 전부 그 규약을 따른다:
    // z가 클수록 관객에게 가깝고, z > -0.045 여야 벽면(월드 3.0) 앞에 남는다.
    const graniteM = pbr('granite_wall', { repeat: [1.2, 1.6], color: 0x8f8578, side: S, env: 0.12 });
    const jambM = pbr('large_sandstone_blocks_01', { repeat: [0.5, 1.1], color: 0xa2937a, side: S, env: 0.1 });
    // 설주에 새길 상형문자 띠 — 맞은편 벽화와 같은 음각 파이프라인을 쓴다
    const fdBand = glyphBandMaps({ seed: 61, painted: false, tone: '#a89a80' });
    const bandMat = (vertical) => {
      if (!fdBand) return jambM;
      const turn = (t) => {
        const c = t.clone();
        if (vertical) { c.center.set(0.5, 0.5); c.rotation = Math.PI / 2; }
        c.needsUpdate = true;
        return c;
      };
      return new THREE.MeshStandardMaterial({
        map: turn(fdBand.map), normalMap: turn(fdBand.normalMap),
        roughness: 0.92, side: S, envMapIntensity: 0.1,
      });
    };

    // 계단식 감실 — 세 단이 안으로 좁아지며 물러난다(가짜 문의 T자 벽감 윤곽).
    // z(관객 쪽 앞면)와 두께를 이어 붙여 틈도 겹침도 없이 쌓는다: 0.190 → -0.010.
    const STEPS = [
      { ow: 2.02, oh: 2.42, iw: 1.86, ih: 2.32, z: 0.190, d: 0.07, m: 'band' },
      { ow: 1.86, oh: 2.32, iw: 1.62, ih: 2.20, z: 0.120, d: 0.07, m: graniteM },
      { ow: 1.62, oh: 2.20, iw: 1.34, ih: 2.06, z: 0.050, d: 0.06, m: jambM },
    ];
    for (const st of STEPS) {
      const sw = (st.ow - st.iw) / 2, zc = st.z - st.d / 2;
      const sideM = st.m === 'band' ? bandMat(true) : st.m;
      const topM = st.m === 'band' ? bandMat(false) : st.m;
      FD.add(box(sw, st.oh, st.d, sideM, -(st.iw + sw) / 2, st.oh / 2, zc, 'falseDoor'));
      FD.add(box(sw, st.oh, st.d, sideM, (st.iw + sw) / 2, st.oh / 2, zc, 'falseDoor'));
      FD.add(box(st.iw, st.oh - st.ih, st.d, topM, 0, (st.ih + st.oh) / 2, zc, 'falseDoor'));
    }

    // 말린 갈대발(드럼 몰딩) — 감실 상단을 가로지르는 원통
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.34, 14), graniteM);
    drum.rotation.z = Math.PI / 2;
    // y는 감실 상단(2.06) 아래로, z는 석판 앞면(-0.010)보다 앞으로 — 둘 중 하나라도
    // 어기면 석판이 미끄러질 때 몰딩을 뚫고 지나간다.
    drum.position.set(0, 1.99, 0.050);
    drum.userData.hot = 'falseDoor';
    FD.add(drum);

    // 둥근 테두리 몰딩 — 문 전체를 감싸는 반원 롤
    for (const rx of [-1.06, 1.06]) {
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.46, 12), graniteM);
      v.position.set(rx, 1.23, 0.220);
      FD.add(v);
    }
    const hRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.22, 12), graniteM);
    hRoll.rotation.z = Math.PI / 2;
    hRoll.position.set(0, 2.46, 0.220);
    FD.add(hRoll);

    // 카베토 코니스 — 위로 갈수록 관객 쪽으로 벌어지는 처마
    const cornice = box(2.26, 0.22, 0.10, graniteM, 0, 2.60, 0.240);
    cornice.rotation.x = 0.22;
    FD.add(cornice);

    // 감실 맨 안쪽의 어둠 — 석판이 열렸을 때 드러나는 면
    FD.add(box(1.34, 2.06, 0.008, plain(0x090705, { side: S }), 0, 1.03, -0.036));

    // 석판: 모든 테두리보다 뒤에 둔다 — 열릴 때 설주 뒤로 깨끗하게 미끄러진다
    const fdSlab = box(1.32, 2.04, 0.02,
      pbr('large_sandstone_blocks_01', { repeat: [0.55, 0.85], color: 0x9a8c72, side: S, env: 0.08 }),
      0, 1.02, -0.020, 'falseDoor');
    FD.add(fdSlab);
    refs.present.falseDoorSlab = fdSlab;
    refs.present.falseDoorHomeX = fdSlab.position.x;

    // 풍뎅이 소켓 (중앙 보스) — 자리만 어둡게 패였다
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 18), plain(0x1a130a, { side: S }));
    socket.rotation.x = Math.PI / 2;
    socket.position.set(0, 1.62, 0.010);
    socket.userData.hot = 'falseDoor';
    FD.add(socket);
    const seatedScarab = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), gold({ side: S }));
    seatedScarab.scale.set(1.25, 0.55, 1);
    seatedScarab.rotation.x = Math.PI / 2;
    seatedScarab.position.set(0, 1.62, 0.040);
    seatedScarab.visible = false;
    FD.add(seatedScarab);
    refs.present.scarabSeatedMesh = seatedScarab;

    // 세 글리프 다이얼 — 감실 안, 안쪽 테두리 앞면과 거의 나란하다
    const tiles = dialTiles();
    refs.present.dialTiles = tiles;
    refs.present.dialMats = [];
    [-0.45, 0, 0.45].forEach((dx, i) => {
      const mat = tiles
        ? new THREE.MeshStandardMaterial({ map: tiles[0], roughness: 0.85, side: S, envMapIntensity: 0.1 })
        : plain(0x8a7a5c, { side: S });
      const dial = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.06), mat);
      dial.position.set(dx, 1.05, 0.025);
      dial.userData.hot = `dial${i}`;
      FD.add(dial);
      refs.present.dialMats.push(mat);
    });
    // 계단이 만드는 그늘이 곧 깊이다 — 손전등이 그림자를 드리우게 한다
    FD.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    present.add(FD);

    // 서쪽 구석: 선반이 있던 자리의 어두운 자국 — 도굴꾼들이 궤째 들어냈다
    for (const zc of [-2.0, 2.0]) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.7),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(-6.9, 0.006, zc);
      present.add(mark);
    }

    // 도굴꾼의 유해 — 봉인문 앞. 처음부터 놓여 있는 붙박이 소품이다.
    const robber = makeRobberCorpse(S, 'presentRobber');
    robber.position.set(-0.7, 0, 1.15);    // 문 우측 앞
    robber.rotation.y = 0.9;
    present.add(robber);
    refs.present.robber = robber;

    // 내려놓은 스카라베 (G로 내려놓고 E로 다시 집는다 — 파생이 위치·표시를 관리)
    const scarabLoose = makeScarab(S);
    scarabLoose.position.y = 0.034;
    scarabLoose.visible = false;
    scarabLoose.userData.hot = 'presentScarabLoose';
    present.add(scarabLoose);
    refs.present.scarabLoose = scarabLoose;

    // 본체 표식(이동 중 현재에 남는 몸)
    const body = makeFigure(S);
    body.visible = false;
    present.add(body);
    refs.present.bodyMesh = body;

    present.add(new THREE.HemisphereLight(0x8a94a8, 0x14110c, 0.14));
    makeDust(present, anim, { x0: -3.6, x1: -1.4, z0: -2.6, z1: -0.9, count: 110, seed: 333, color: 0xcfe0f5, size: 0.016 });
    makeDust(present, anim, { x0: -7, x1: 7, z0: -2.7, z1: 2.7, count: 60, seed: 334, size: 0.014 });

    present.traverse((o) => { if (o.userData?.hot) hot.PRESENT.push(o); });
  }

  return { scenes: { P1: p1, P2: p2, PRESENT: present }, refs, hot };
}
