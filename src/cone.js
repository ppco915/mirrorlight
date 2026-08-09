// cone.js — 빛의 법(6.6절): 원뿔 판정·이동 클램프·시각화.
// v2: 거울(포털)마다 하나의 ConeSystem 인스턴스. 판정 수식은 conemath와 동일.

import * as THREE from 'three';
import { insideConeAp, toLocal, mirrorParams, dirFromYaw } from './conemath.js';

export class ConeSystem {
  // attach: [{ scene, withSpot }] — 원뿔 시각화를 넣을 씬 목록
  // opts.aperture: 벽 개구 차폐 (피라미드 두 방 레벨용, 없으면 무시)
  constructor(level, attach, colorHex = 0xffcf8a, opts = {}) {
    this.m = mirrorParams(level.mirror);
    this.level = level;
    this.color = colorHex;
    this.aperture = opts.aperture || null;
    this.pose = null;
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
    const frustum = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: this.color, transparent: true, opacity: 0.07, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    g.add(frustum);
    const fy0 = -m.centerY + 0.02;
    const oGeo = new THREE.BufferGeometry();
    oGeo.setAttribute('position', new THREE.Float32BufferAttribute(
      [-nx, fy0, 0, nx, fy0, 0, fx, fy0, L, -fx, fy0, L], 3,
    ));
    const oMat = new THREE.LineBasicMaterial({ color: this.color, transparent: true, opacity: 0.55 });
    g.add(new THREE.LineLoop(oGeo, oMat));
    this.outlines.push(oMat);
    if (withSpot) {
      const apex = m.halfWidth / m.spreadTan;
      const spot = new THREE.SpotLight(this.color, 2.4, m.coneLength + apex + 2.5,
        Math.atan(m.spreadTan) + 0.10, 0.45, 0.6);
      spot.position.set(0, 0, -apex);
      const tgt = new THREE.Object3D();
      tgt.position.set(0, 0, m.coneLength);
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
