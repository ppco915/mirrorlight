// mirror.js — MirrorPortal(6.3절): three 예제 Reflector의 반사 카메라 수식을 이식하되,
// 렌더 대상 씬을 자기 씬이 아니라 다른 시대의 씬으로 바꾼 것이 유일한 개조점.
// 현재→과거(정방향)와 과거→현재(역방향) 모두 같은 클래스다.
// 틀은 금동 테두리 + 태양 원반 장식 + 화강암 대좌의 청동 거울 한 가지다.

import * as THREE from 'three';
import { dirFromYaw } from './conemath.js';

// 반사는 한 번만 튕긴다 — 역거울이 현재를 렌더하는 동안 현재의 거울이 또
// 과거를 렌더하려 들면(거울 속 거울) 무한 재귀가 되므로, 중첩 반사는
// 지난 프레임의 상(RT)을 그대로 쓴다.
let bouncing = false;

const SHADER = {
  vertex: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragment: /* glsl */`
    uniform vec3 color;
    uniform float tintMix;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    void main() {
      vec4 base = texture2DProj(tDiffuse, vUv);
      gl_FragColor = vec4(mix(base.rgb, color, tintMix), 1.0);
    }`,
};

export class MirrorPortal {
  // opts: { hotId, fixedPose: {x, z, yawDeg} | null, rtSize }
  constructor(level, getTargetScene, opts = {}) {
    this.level = level;
    this.getTargetScene = getTargetScene;
    this.hotId = opts.hotId || 'mirror';
    this.fixed = opts.fixedPose || null;
    const mir = level.mirror;

    this.group = new THREE.Group();
    // 닦아 세운 청동 거울 — 금동 테두리, 태양 원반 장식, 화강암 대좌.
    const gild = new THREE.MeshStandardMaterial({
      color: 0x7e5f28, metalness: 1.0, roughness: 0.52, envMapIntensity: 0.5,
    });
    const stone = new THREE.MeshStandardMaterial({ color: 0x6e6355, roughness: 0.9 });
    const w = mir.halfWidth * 2, h = mir.halfHeight * 2;
    const bar = (bw, bh, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.09), gild);
      m.position.set(x, y, -0.05);
      m.castShadow = true;
      m.userData.hot = this.hotId;
      this.group.add(m);
    };
    bar(w + 0.24, 0.12, 0, mir.centerY + mir.halfHeight + 0.06);
    bar(w + 0.24, 0.12, 0, mir.centerY - mir.halfHeight - 0.06);
    bar(0.12, h + 0.24, -(mir.halfWidth + 0.06), mir.centerY);
    bar(0.12, h + 0.24, mir.halfWidth + 0.06, mir.centerY);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x4a3a22, metalness: 0.7, roughness: 0.6 }));
    back.position.set(0, mir.centerY, -0.07);
    back.userData.hot = this.hotId;
    this.group.add(back);
    const cavetto = new THREE.Mesh(new THREE.BoxGeometry(w + 0.36, 0.09, 0.13), gild);
    cavetto.position.set(0, mir.centerY + mir.halfHeight + 0.165, -0.05);
    cavetto.castShadow = true;
    this.group.add(cavetto);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 22), gild);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, mir.centerY + mir.halfHeight + 0.3, -0.05);
    disc.castShadow = true;
    this.group.add(disc);
    const horns = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 18, Math.PI), gild);
    horns.position.set(0, mir.centerY + mir.halfHeight + 0.27, -0.05);
    this.group.add(horns);

    // 시계 — 과거로 통하는 문이라는 표지. 태양 원반 앞에 작은 문자반을 달고,
    // 바늘은 거꾸로(반시계) 돈다 — 이 문을 지나면 시간이 되감긴다.
    if (opts.clock) {
      const clock = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.013, 10, 26), gild);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.016, 26),
        new THREE.MeshStandardMaterial({ color: 0xe6d9ba, roughness: 0.6 }));
      face.rotation.x = Math.PI / 2;
      const tickM = new THREE.MeshStandardMaterial({ color: 0x3a2c16, roughness: 0.6, metalness: 0.4 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const tick = new THREE.Mesh(
          new THREE.BoxGeometry(0.006, i % 3 === 0 ? 0.02 : 0.012, 0.004), tickM);
        tick.position.set(Math.sin(a) * 0.066, Math.cos(a) * 0.066, 0.012);
        tick.rotation.z = -a;
        clock.add(tick);
      }
      const handM = new THREE.MeshStandardMaterial({ color: 0x2a1c0a, roughness: 0.5, metalness: 0.5 });
      const mkHand = (len, wdt) => {
        const pivot = new THREE.Group();
        const h = new THREE.Mesh(new THREE.BoxGeometry(wdt, len, 0.004), handM);
        h.position.y = len / 2 - 0.008;
        pivot.add(h);
        pivot.position.z = 0.014;
        clock.add(pivot);
        return pivot;
      };
      this.clockHands = { hour: mkHand(0.045, 0.011), minute: mkHand(0.066, 0.007) };
      const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.012, 10), gild);
      axis.rotation.x = Math.PI / 2;
      axis.position.z = 0.017;
      clock.add(rim, face, axis);
      clock.position.set(0, mir.centerY + mir.halfHeight + 0.3, -0.02);
      clock.traverse((o) => { o.userData.hot = this.hotId; o.castShadow = false; });
      this.group.add(clock);
    }
    for (const [py, pw, pd] of [[0.1, 0.34, 0.52], [0.035, 0.46, 0.64]]) {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + pw, 0.07, pd), stone);
      plinth.position.set(0, py, -0.02);
      plinth.receiveShadow = true;
      plinth.userData.hot = this.hotId;
      this.group.add(plinth);
    }

    const rtSize = opts.rtSize || 512;
    this.rt = new THREE.WebGLRenderTarget(rtSize, rtSize);
    this.textureMatrix = new THREE.Matrix4();
    this.virtualCamera = new THREE.PerspectiveCamera();
    const glassM = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xc08a45) },
        tintMix: { value: 0.16 },
        tDiffuse: { value: this.rt.texture },
        textureMatrix: { value: this.textureMatrix },
      },
      vertexShader: SHADER.vertex,
      fragmentShader: SHADER.fragment,
    });
    this.glass = new THREE.Mesh(new THREE.PlaneGeometry(mir.halfWidth * 2, mir.halfHeight * 2), glassM);
    this.glass.position.set(0, mir.centerY, 0.001);
    this.glass.userData.hot = this.hotId;
    this.glass.onBeforeRender = (renderer, scene, camera) => this.renderReflection(renderer, camera);
    this.group.add(this.glass);

    this.railT = 0.5;
    this.yawDeg = 270;
    if (this.fixed) this.yawDeg = this.fixed.yawDeg;
    // 드로 콜 예산(6.13): 두 거울이 한 화면에 잡히면 한 프레임에 세 씬이 그려진다.
    // 메인 루프가 프레임마다 한 거울씩 갱신을 허가해 최악 프레임을 두 씬으로 줄인다.
    this.allowUpdate = true;
    this.setPose(this.railT, this.yawDeg);
  }

  // 시계 바늘을 거꾸로 돌린다 — 거울 정면(+z)에서 보면 반시계 방향
  tickClock(t) {
    if (!this.clockHands) return;
    this.clockHands.minute.rotation.z = t * 0.9;
    this.clockHands.hour.rotation.z = t * 0.075;
  }

  get pose() {
    if (this.fixed) return { x: this.fixed.x, z: this.fixed.z, yawDeg: this.fixed.yawDeg };
    const [[ax, az], [bx]] = this.level.mirror.rail;
    return { x: ax + (bx - ax) * this.railT, z: az, yawDeg: this.yawDeg };
  }

  setPose(railT, yawDeg) {
    if (!this.fixed) {
      const [y0, y1] = this.level.mirror.yawRangeDeg;
      this.railT = Math.min(1, Math.max(0, railT));
      this.yawDeg = Math.min(y1, Math.max(y0, yawDeg));
    }
    const p = this.pose;
    const d = dirFromYaw(p.yawDeg);
    this.group.position.set(p.x, 0, p.z);
    this.group.rotation.y = Math.atan2(d.x, d.z);   // 로컬 +Z → 투사 방향
  }

  // three r160 Reflector.onBeforeRender 이식(사선 근평면 클리핑 포함)
  renderReflection(renderer, camera) {
    if (bouncing) return;                   // 중첩 반사 금지 — 지난 상 유지
    if (!this.allowUpdate) return;          // 이번 프레임 갱신 차례가 아니면 지난 상 유지
    const scope = this.glass;
    const reflectorWorldPosition = new THREE.Vector3().setFromMatrixPosition(scope.matrixWorld);
    const cameraWorldPosition = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const rotationMatrix = new THREE.Matrix4().extractRotation(scope.matrixWorld);
    const normal = new THREE.Vector3(0, 0, 1).applyMatrix4(rotationMatrix);
    const view = new THREE.Vector3().subVectors(reflectorWorldPosition, cameraWorldPosition);
    if (view.dot(normal) > 0) return;               // 카메라가 거울 뒤편이면 생략

    view.reflect(normal).negate().add(reflectorWorldPosition);
    rotationMatrix.extractRotation(camera.matrixWorld);
    const lookAt = new THREE.Vector3(0, 0, -1).applyMatrix4(rotationMatrix).add(cameraWorldPosition);
    const target = new THREE.Vector3().subVectors(reflectorWorldPosition, lookAt);
    target.reflect(normal).negate().add(reflectorWorldPosition);

    const vc = this.virtualCamera;
    vc.position.copy(view);
    vc.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
    vc.lookAt(target);
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(
      0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1,
    );
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);
    this.textureMatrix.multiply(scope.matrixWorld);

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
    plane.applyMatrix4(vc.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = vc.projectionMatrix;
    const q = new THREE.Vector4(
      (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0],
      (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5],
      -1.0,
      (1.0 + pm.elements[10]) / pm.elements[14],
    );
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1.0 - 0.003;
    pm.elements[14] = clip.w;

    const prevRT = renderer.getRenderTarget();
    const prevXr = renderer.xr.enabled;
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt);
    renderer.state.buffers.depth.setMask(true);
    if (renderer.autoClear === false) renderer.clear();
    bouncing = true;
    renderer.render(this.getTargetScene(), vc);     // ★ 유일한 개조점: 다른 시대를 렌더
    bouncing = false;
    renderer.xr.enabled = prevXr;
    renderer.shadowMap.autoUpdate = prevShadow;
    renderer.setRenderTarget(prevRT);
  }
}
