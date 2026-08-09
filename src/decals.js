// decals.js — 바닥(또는 선반 윗면)에 얹는 부드러운 데칼 메시.
//
// 명세 6.13절이 그림자 맵을 금지하므로, 물체를 바닥에 붙여 놓을 수단은 이것뿐이다.
// 그림자가 없으면 책상도 벽난로도 평평한 빛 속에 떠 있는 것처럼 보인다.

import * as THREE from 'three';
import { softShadowTexture } from './textures.js';

// specs 한 줄 = [x, z, rx, rz, strength?, y?]
//   rx, rz  : 반지름(미터). 물체 발자국보다 약간 크게 잡는다.
//   strength: 짙기 0~1.
//   y       : 얹히는 면의 높이. 선반 위 화분처럼 바닥이 아닌 곳에 쓴다.
export function shadowGroup(specs, baseY = 0.006) {
  const tex = softShadowTexture();
  const g = new THREE.Group();
  for (const [x, z, rx, rz, strength = 0.5, y = baseY] of specs) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(rx * 2, rz * 2),
      new THREE.MeshBasicMaterial({
        map: tex,
        color: 0x000000,
        transparent: true,
        opacity: strength,
        depthWrite: false,          // 뒤의 물체를 가리지 않는다
        side: THREE.DoubleSide,     // 거울 시대는 투영 반전으로 winding이 뒤집힌다(6.5절)
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = -1;             // 다른 반투명(원뿔 절두체)보다 먼저 — 바닥에 깔린다
    g.add(m);
  }
  return g;
}
