// mirror.js — MirrorPortal(6.3절): three 예제 Reflector의 반사 카메라 수식을 이식하되,
// 렌더 대상 씬을 자기 씬이 아니라 scenes[era](= PAST)로 바꾼 것이 유일한 개조점.
// RuinViewer: 폐허 씬 고정 카메라를 ruinDirty일 때만 RT로 렌더(손거울은 보기 전용).

import * as THREE from 'three';
import { dirFromYaw } from './conemath.js';

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
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    void main() {
      vec4 base = texture2DProj(tDiffuse, vUv);
      gl_FragColor = vec4(mix(base.rgb, color, 0.12), 1.0);
    }`,
};

export class MirrorPortal {
  // opts: { hotId, fixedPose: {x, z, yawDeg} | null, covered: bool, tint }
  constructor(level, getTargetScene, opts = {}) {
    this.level = level;
    this.getTargetScene = getTargetScene;
    this.hotId = opts.hotId || 'mirror';
    this.fixed = opts.fixedPose || null;
    this.covered = !!opts.covered;
    const mir = level.mirror;

    this.group = new THREE.Group();
    const frameM = new THREE.MeshLambertMaterial({ color: this.fixed ? 0x4a4234 : 0x3a2c1c });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(mir.halfWidth * 2 + 0.14, mir.halfHeight * 2 + 0.14, 0.08), frameM);
    frame.position.set(0, mir.centerY, -0.05);
    frame.userData.hot = this.hotId;
    this.group.add(frame);
    for (const wx of [-0.4, 0.4]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), frameM);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.06, -0.05);
      this.group.add(wheel);
    }
    // 천 덮개: 걷기 전엔 유리를 가리고 반사 렌더도 생략된다
    this.cloth = new THREE.Mesh(
      new THREE.BoxGeometry(mir.halfWidth * 2 + 0.2, mir.halfHeight * 2 + 0.22, 0.16),
      new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }),
    );
    this.cloth.position.set(0, mir.centerY, 0.02);
    this.cloth.userData.hot = this.hotId + 'Cloth';
    this.cloth.visible = this.covered;
    this.group.add(this.cloth);

    this.rt = new THREE.WebGLRenderTarget(512, 512);
    this.textureMatrix = new THREE.Matrix4();
    this.virtualCamera = new THREE.PerspectiveCamera();
    const glassM = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xb08850) },
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
    this.setPose(this.railT, this.yawDeg);
  }

  get pose() {
    if (this.fixed) return { x: this.fixed.x, z: this.fixed.z, yawDeg: this.fixed.yawDeg };
    const [[ax, az], [bx]] = this.level.mirror.rail;
    return { x: ax + (bx - ax) * this.railT, z: az, yawDeg: this.yawDeg };
  }

  uncover() {
    this.covered = false;
    this.cloth.visible = false;
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
    if (this.covered) return;               // 천에 가린 동안은 렌더 생략
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
    renderer.render(this.getTargetScene(), vc);     // ★ 유일한 개조점: PAST 씬을 렌더
    renderer.xr.enabled = prevXr;
    renderer.shadowMap.autoUpdate = prevShadow;
    renderer.setRenderTarget(prevRT);
  }
}

export class RuinViewer {
  constructor(level, ruinScene) {
    this.scene = ruinScene;
    this.rt = new THREE.WebGLRenderTarget(256, 256);
    // 손거울 속 고정 시점: 남벽에서 방 안(벽난로 쪽 포함)을 향한다
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 20);
    const p = level.handMirror.pos;
    this.camera.position.set(p[0], p[1], p[2] - 0.15);
    this.camera.lookAt(1.6, 0.7, -0.6);

    this.group = new THREE.Group();
    const tex = this.rt.texture;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;                              // 거울상: 좌우 반전
    tex.offset.x = 1;
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.19, 24),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.025, 8, 24),
      new THREE.MeshLambertMaterial({ color: 0x6a5a3a }),
    );
    face.userData.hot = 'handMirror';
    rim.userData.hot = 'handMirror';
    this.group.add(face, rim);
    this.group.position.set(p[0], p[1], p[2] - 0.04);
    this.group.rotation.y = Math.PI;                // 북쪽(방 안)을 향한 면
  }

  render(renderer) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(prev);
  }
}
