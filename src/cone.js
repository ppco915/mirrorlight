// cone.js — 빛의 법(6.6절): 원뿔 판정·이동 클램프·시각화.
// v2: 거울(포털)마다 하나의 ConeSystem 인스턴스. 판정 수식은 conemath와 동일.

import * as THREE from 'three';
import { insideConeAp, toLocal, mirrorParams, dirFromYaw } from './conemath.js';

export class ConeSystem {
  // attach: [{ scene, withSpot }] — 원뿔 시각화를 넣을 씬 목록
  // opts.aperture: 벽 개구 차폐 (피라미드 두 방 레벨용, 없으면 무시)
  // opts.wall: {x0, x1} — 가운데 벽의 두 면. 있으면 빛 볼륨을 벽에서 자르고,
  //   개구가 실재하면 그 너머는 개구를 통과한 쐐기 단면만 그린다 (판정과 동일 모델).
  constructor(level, attach, colorHex = 0xffcf8a, opts = {}) {
    this.m = mirrorParams(level.mirror);
    this.level = level;
    this.color = colorHex;
    this.aperture = opts.aperture || null;
    this.wall = opts.wall || null;
    const wedge = !!(this.aperture && this.wall
      && this.aperture.z1 > this.aperture.z0 && this.aperture.y1 > this.aperture.y0);
    this.nearPlanes = (this.aperture && this.wall) ? [new THREE.Plane()] : [];
    this.farPlanes = wedge
      ? [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()]
      : null;
    this.pose = null;
    this._o = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this.outlines = [];
    this.groups = [];
    for (const { scene, withSpot } of attach) {
      const g = this.buildViz(withSpot);
      scene.add(g);
      this.groups.push(g);
    }
    this.flash = 0;
  }

  setVisible(v) { for (const g of this.groups) g.visible = v; }

  buildViz(withSpot) {
    const m = this.m;
    const g = new THREE.Group();
    const gw = m.coneLength * m.spreadTan;
    const nx = m.halfWidth, ny = m.halfHeight;
    const fx = m.halfWidth + gw, fy = m.halfHeight + gw;
    const L = m.coneLength;
    const c = [
      [-nx, -ny, 0], [nx, -ny, 0], [nx, ny, 0], [-nx, ny, 0],
      [-fx, -fy, L], [fx, -fy, L], [fx, fy, L], [-fx, fy, L],
    ];
    const idx = [0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7, 4, 5, 6, 4, 6, 7];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(c.flat(), 3));
    geo.setIndex(idx);
    const volMat = (planes) => new THREE.MeshBasicMaterial({
      color: this.color, transparent: true, opacity: 0.07, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
      clippingPlanes: planes || [],
    });
    g.add(new THREE.Mesh(geo, volMat(this.nearPlanes)));
    if (this.farPlanes) g.add(new THREE.Mesh(geo, volMat(this.farPlanes)));
    const fy0 = -m.centerY + 0.02;
    const oGeo = new THREE.BufferGeometry();
    oGeo.setAttribute('position', new THREE.Float32BufferAttribute(
      [-nx, fy0, 0, nx, fy0, 0, fx, fy0, L, -fx, fy0, L], 3,
    ));
    const oMat = new THREE.LineBasicMaterial({
      color: this.color, transparent: true, opacity: 0.55, clippingPlanes: this.nearPlanes,
    });
    g.add(new THREE.LineLoop(oGeo, oMat));
    this.outlines.push(oMat);
    // 바닥 쐐기 채움 — 수평 빔은 코사인 법칙 때문에 바닥을 거의 못 밝히므로,
    // 이동 가능 구역은 은은한 가법 채움으로 직접 보여 준다.
    // 볼륨과 똑같이 벽·개구 쐐기로 자른다 — 옆방에서는 문 폭을 통과한
    // 쐐기 단면만 밝아야 한다 (갈 수 있는 곳 = 밝은 곳, 판정과 동일 모델).
    const fGeo = new THREE.BufferGeometry();
    fGeo.setAttribute('position', new THREE.Float32BufferAttribute(
      [-nx, fy0, 0, nx, fy0, 0, fx, fy0, L, -fx, fy0, L], 3,
    ));
    fGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const fillMat = (planes) => new THREE.MeshBasicMaterial({
      color: this.color, transparent: true, opacity: 0.14, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      clippingPlanes: planes || [],
    });
    g.add(new THREE.Mesh(fGeo, fillMat(this.nearPlanes)));
    if (this.farPlanes) g.add(new THREE.Mesh(fGeo, fillMat(this.farPlanes)));
    if (withSpot) {
      // 과거를 비추는 유일한 광원 — 거울빛. 그림자를 켜서 벽이 빛을 막고,
      // 열린 통로(개구)로만 옆방에 새어 들게 한다 (개구 차폐의 물리적 대응물).
      const apex = m.halfWidth / m.spreadTan;
      const spot = new THREE.SpotLight(this.color, 42, m.coneLength + apex + 3,
        Math.atan(m.spreadTan) + 0.12, 0.55, 1.05);
      spot.position.set(0, 0, -apex);
      spot.castShadow = true;
      spot.shadow.mapSize.set(512, 512);   // 거울빛 그림자 — 512로 개구 차폐엔 충분하다
      spot.shadow.bias = -0.0005;
      spot.shadow.normalBias = 0.06;      // 비스듬한 면의 아크네 줄무늬 방지
      spot.shadow.camera.near = 0.4;
      spot.shadow.camera.far = m.coneLength + apex + 3;
      const tgt = new THREE.Object3D();
      tgt.position.set(0, -1.4, m.coneLength);   // 살짝 내리깔아 바닥까지 스친다
      g.add(tgt);
      spot.target = tgt;
      g.add(spot);
    }
    return g;
  }

  update(pose) {
    this.pose = pose;
    const d = dirFromYaw(pose.yawDeg);
    const ry = Math.atan2(d.x, d.z);
    for (const g of this.groups) {
      g.position.set(pose.x, this.m.centerY, pose.z);
      g.rotation.y = ry;
    }
    this.updateClipPlanes(pose);
  }

  // 월드 좌표 클리핑 평면 갱신. 근접 구간은 거울 쪽 벽면에서 끝나고,
  // 개구 쐐기는 광원(거울 중심)에서 개구 네 모서리를 지나는 평면으로 깎는다
  // — conemath.throughAperture와 같은 바늘구멍 모델의 기하판.
  updateClipPlanes(pose) {
    if (!this.nearPlanes.length) return;
    const ap = this.aperture, wall = this.wall, m = this.m;
    const side = pose.x >= ap.x ? 1 : -1;
    const face = side > 0 ? wall.x1 : wall.x0;
    this.nearPlanes[0].normal.set(side, 0, 0);
    this.nearPlanes[0].constant = -side * face;
    if (!this.farPlanes) return;
    const oppFace = side > 0 ? wall.x0 : wall.x1;
    this.farPlanes[0].normal.set(-side, 0, 0);
    this.farPlanes[0].constant = side * oppFace;
    const O = this._o.set(pose.x, m.centerY, pose.z);
    const D = this._d.set(ap.x, (ap.y0 + ap.y1) / 2, (ap.z0 + ap.z1) / 2);
    const mk = (pl, nx, ny, nz) => {
      pl.setFromNormalAndCoplanarPoint(this._n.set(nx, ny, nz).normalize(), O);
      if (pl.distanceToPoint(D) < 0) pl.negate();
    };
    mk(this.farPlanes[1], -(ap.z0 - O.z), 0, ap.x - O.x);
    mk(this.farPlanes[2], -(ap.z1 - O.z), 0, ap.x - O.x);
    mk(this.farPlanes[3], ap.y0 - O.y, -(ap.x - O.x), 0);
    mk(this.farPlanes[4], ap.y1 - O.y, -(ap.x - O.x), 0);
  }

  contains(p) { return this.pose ? insideConeAp(this.pose, this.m, this.aperture, p) : false; }

  clampMove(from, to) {
    const inC = (x, z) => this.contains({ x, y: 0, z });
    if (inC(to.x, to.z)) return { x: to.x, z: to.z, blocked: false };
    if (inC(to.x, from.z)) return { x: to.x, z: from.z, blocked: true };
    if (inC(from.x, to.z)) return { x: from.x, z: to.z, blocked: true };
    return { x: from.x, z: from.z, blocked: true };
  }

  boundaryLevel(p) {
    if (!this.pose) return 0;
    const l = toLocal(this.pose, this.m, p);
    const grow = Math.max(l.z, 0) * this.m.spreadTan;
    const slack = Math.min(
      this.m.halfWidth + grow - Math.abs(l.x),
      this.m.coneLength - l.z,
      l.z,
    );
    return Math.min(1, Math.max(0, 1 - slack / 0.6));
  }

  mirrorSideDepth(p) {
    return this.pose ? toLocal(this.pose, this.m, p).z : Infinity;
  }

  flashBoundary() { this.flash = 0.5; }

  tick(dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    const pulse = this.flash > 0 ? (Math.sin(this.flash * 40) * 0.5 + 0.5) : 0;
    for (const mat of this.outlines) {
      mat.opacity = 0.55 + 0.45 * pulse;
      mat.color.setHex(pulse > 0.5 ? 0xffffff : this.color);
    }
  }
}
