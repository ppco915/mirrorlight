// pyramid/props.js — glTF 소품 로더 (브라우저 전용 — main.js만 임포트).
// 도굴꾼의 해골: Jake K-H 「skull003」(CC-BY, poly.pizza/m/bjf0z6Qb9Tv).
// 문이 열린 적 없는 시간선에서만 문 앞에 남는다 (파생: visitedP1 ∧ ¬doorPlasterOff).
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
  const pivot = new THREE.Group();
  const box = new THREE.Box3().setFromObject(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  pivot.add(model);

  // 사람 두개골의 1.5배(~36cm), 안면이 하늘을 보게 뒤집어 바닥에 앉힌다
  const size = box.getSize(new THREE.Vector3());
  pivot.scale.setScalar(0.36 / Math.max(size.x, size.z));
  pivot.rotation.set(Math.PI, 0, 0);
  pivot.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -1.4);
  pivot.updateMatrixWorld(true);
  const grounded = new THREE.Box3().setFromObject(pivot);
  pivot.position.y = -grounded.min.y;

  const g = refs.present.robber;
  const gone = [...g.children];
  g.clear();
  g.add(pivot);
  g.userData.hot = 'presentRobber';
  if (hot) {
    const dead = new Set(gone.flatMap((o) => { const l = []; o.traverse((c) => l.push(c)); return l; }));
    for (let i = hot.PRESENT.length - 1; i >= 0; i--) if (dead.has(hot.PRESENT[i])) hot.PRESENT.splice(i, 1);
    hot.PRESENT.push(g);
  }
}
