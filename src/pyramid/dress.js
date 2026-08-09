// pyramid/dress.js — 소품 외형을 glTF 에셋으로 교체하는 시각 전용 층.
// 로직·검증(level.js, causal.js, validate.js)은 여기 것을 모른다 — 실패해도
// 절차 기하로 게임은 그대로 돈다. 에셋 출처: assets/README.md.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LV } from './level.js';

const loader = new GLTFLoader();
const load = (url) => new Promise((res, rej) => loader.load(url, (g) => res(g.scene), undefined, rej));

// 거울 반사 렌더는 와인딩이 뒤집힌다 — 시대 씬 소품은 양면이어야 비쳐 보인다.
function doubleSided(root) {
  root.traverse((o) => { if (o.material) o.material.side = THREE.DoubleSide; });
  return root;
}

function tagHot(root, hotId) {
  root.userData.hot = hotId;
  return root;
}

function dropFrom(list, gone) {
  const dead = new Set(gone);
  for (let i = list.length - 1; i >= 0; i--) if (dead.has(list[i])) list.splice(i, 1);
}

export async function dressPyramidScenes({ scenes, refs, hot, portals }) {
  const [door, rubbleL, rubbleH, keyModel, mirrorModel] = await Promise.all([
    load('assets/kaykit/wall_doorway.glb'),
    load('assets/kaykit/rubble_large.glb'),
    load('assets/kaykit/rubble_half.glb'),
    load('assets/kaykit/key.glb'),
    load('assets/mirror.glb'),
  ]);

  // ── 현재: 돌문 — 문짝 노드만 떼어 문틀 치수에 맞춘다 (경첩은 doorG 원점 = z0)
  {
    const doorG = refs.present.doorGroup;
    let panel = null;
    door.traverse((o) => { if (o.name === 'wall_doorway_door') panel = o; });
    if (panel) {
      // 석판은 남긴다 — 아치 문짝 모서리 틈을 뒤에서 막는 돌벽 역할.
      panel.removeFromParent();
      panel.position.set(0, 0, 0);
      const w = LV.doorway.z1 - LV.doorway.z0;
      panel.scale.set(w / 2.0, LV.doorway.y1 / 2.75, 0.32);
      const wrap = new THREE.Group();
      wrap.rotation.y = -Math.PI / 2;          // 모델 +x → 월드 +z (문틀을 따라)
      wrap.position.x = -0.2;                  // 석판 서쪽 면 앞 (방1에서 보인다)
      wrap.add(panel);
      doorG.add(wrap);
      tagHot(doorG, 'presentDoor');
    }
  }

  // ── 현재: 붕괴 돌무더기 — 원뿔 더미를 KayKit 잔해로
  {
    const pile = scenes.PRESENT.children.find(
      (o) => o.isGroup && o.children.some((c) => c.userData.hot === 'presentPile'));
    if (pile) {
      const gone = [...pile.children];
      pile.clear();
      dropFrom(hot.PRESENT, gone);
      rubbleL.scale.set(0.16, 0.28, 0.38);
      rubbleL.position.set(-2.5, 0, -1.8);
      rubbleL.rotation.y = 0.4;
      rubbleH.scale.set(0.14, 0.2, 0.22);
      rubbleH.position.set(-2.75, 0, -1.5);
      rubbleH.rotation.y = -1.1;
      pile.add(tagHot(rubbleL, 'presentPile'), tagHot(rubbleH, 'presentPile'));
      hot.PRESENT.push(rubbleL, rubbleH);
    }
  }

  // ── 과거 1: 좌대 위 열쇠 — 눕힌 KayKit 열쇠
  {
    const key = refs.p1.key;
    if (key) {
      const gone = [...key.children];
      key.clear();
      dropFrom(hot.P1, gone);
      keyModel.rotation.x = -Math.PI / 2;      // xy 평면 → 바닥과 평행
      keyModel.rotation.z = 0.6;
      keyModel.scale.setScalar(0.4);
      keyModel.position.y = -0.02;
      key.add(doubleSided(keyModel));
      tagHot(key, 'p1Key');
      hot.P1.push(key);
    }
  }

  // ── 현재: 두 청동 거울의 프레임 드레싱 (유리는 포털 렌더 타깃 그대로)
  if (portals) {
    const box = new THREE.Box3().setFromObject(mirrorModel);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.9 / size.y;
    for (const [which, yaw] of [['A', 0], ['B', 0]]) {
      const m = mirrorModel.clone(true);
      m.scale.setScalar(s);
      const b = new THREE.Box3().setFromObject(m);
      m.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -0.10 - b.max.z);
      m.rotation.y = yaw;
      m.traverse((o) => {
        if (o.material) {
          o.material = o.material.clone();
          o.material.color.multiply(new THREE.Color(0xd8b06a));   // 청동 기운
        }
      });
      portals[which].group.add(m);
    }
  }
}
