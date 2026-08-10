// pyramid/props.js — glTF 소품 로더 (브라우저 전용 — main.js만 임포트).
// 도굴꾼의 해골: Jake K-H 「skull003」(CC-BY, poly.pizza/m/bjf0z6Qb9Tv).
// 봉인문 앞에 처음부터 놓여 있는 붙박이 소품이다.
// 로드에 실패하면 scenes.js의 절차 백골이 그대로 남는다 (시각 전용 층).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadRobberRemains(refs, hot) {
  const gltf = await new GLTFLoader().loadAsync('assets/models/skull.glb');
  const model = gltf.scene;

  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      // 수천 년 묵은 뼈 — 낡은 상아빛, 광 없는 표면
      o.material = new THREE.MeshStandardMaterial({
        color: 0x776750, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.15,
      });
    }
  });

  // 피벗을 기하 중심으로 옮겨야 회전이 제자리에서 돈다
  const box = new THREE.Box3().setFromObject(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  const size = box.getSize(new THREE.Vector3());

  // 세 구 — 크기·방향을 조금씩 다르게 흩어 놓는다. 전부 안면이 하늘을 본다.
  const g = refs.present.robber;
  const gone = [...g.children];
  g.clear();
  for (const [dx, dz, sc, spin] of [
    [0, 0, 0.36, -1.4],          // 원래 자리 — 1.5배 큰 놈
    [0.55, -0.4, 0.27, 0.7],     // 문 쪽으로 조금
    [-0.35, 0.5, 0.31, 2.4],     // 방 안쪽으로 조금
  ]) {
    const pivot = new THREE.Group();
    pivot.add(model.clone(true));
    pivot.scale.setScalar(sc / Math.max(size.x, size.z));
    pivot.rotation.set(Math.PI, 0, 0);
    pivot.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), spin);
    pivot.updateMatrixWorld(true);
    const grounded = new THREE.Box3().setFromObject(pivot);
    pivot.position.set(dx, -grounded.min.y, dz);
    g.add(pivot);
  }
  g.userData.hot = 'presentRobber';
  if (hot) {
    const dead = new Set(gone.flatMap((o) => { const l = []; o.traverse((c) => l.push(c)); return l; }));
    for (let i = hot.PRESENT.length - 1; i >= 0; i--) if (dead.has(hot.PRESENT[i])) hot.PRESENT.splice(i, 1);
    hot.PRESENT.push(g);
  }
}

// 탈출 시네마틱의 1인칭 손 — Sean Tarrant 「Fists」(CC-BY, poly.pizza/m/0ZYcRcJnZ74).
// 실패하면 null — 시네마틱은 손 없이 전리품만 띄운다.
export async function loadHandRig() {
  const gltf = await new GLTFLoader().loadAsync('assets/models/hand.glb');
  const model = gltf.scene;
  // 원본은 쨍한 분홍 — 사막에 그을린 도굴꾼의 살빛으로 덮는다
  const skin = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.9, metalness: 0.0 });
  model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = skin; } });
  return model;
}
