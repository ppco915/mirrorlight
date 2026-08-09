// possession.js — 빙의의 법(6.4절) v2. MODE_BODY ⇄ MODE_AVATAR(era).
// 진입: 해당 거울 3m 이내 + 시선 명중 + 스폰 성립. 복귀: 원뿔 안 어디서나 F —
// 유리까지 걸어 돌아가는 왕복은 배움이 끝난 뒤 노동만 남기므로 제거했다(설계 변경).
// 단 CARRIED면 복귀 거부: 배달의 법은 의식 전환에 얹힌 물건에도 적용된다.

import * as THREE from 'three';
import * as audio from './audio.js';
import { spawnPoint, dirFromYaw } from './conemath.js';
import { state, carried } from './causal.js';

export class Possession {
  constructor(ctx) {
    this.ctx = ctx;
    this.mode = 'BODY';
    this.era = null;          // 'PAST' | 'ELDER'
    this.portalKey = null;    // 'A' | 'B'
    this.saved = null;
    this.busy = false;
  }

  activePortal() { return this.portalKey ? this.ctx.portals[this.portalKey] : null; }
  activeCone() { return this.portalKey ? this.ctx.cones[this.portalKey] : null; }

  tryToggle() {
    if (this.busy || state.possessLock) return;
    if (this.mode === 'BODY') {
      const which = this.ctx.interact.lookingAtPortal();
      if (which) this.enter(which);
    } else this.exit();
  }

  enter(which) {
    const c = this.ctx;
    const portal = c.portals[which];
    if (portal.covered) return;
    const pose = portal.pose;
    const center = new THREE.Vector3(pose.x, c.level.mirror.centerY, pose.z);
    if (c.camera.position.distanceTo(center) > 3.0) return;
    const era = which === 'A' ? 'PAST' : 'ELDER';
    const sp = spawnPoint(pose, c.coneM, c.walkableEra(era), c.level.spawn);
    if (!sp) { c.hud.msg('빛이 설 곳에 닿지 않는다'); return; }

    this.busy = true;
    audio.possessIn();
    c.hud.fade(() => {
      const p = c.player;
      this.saved = { pos: p.pos.clone(), yaw: p.yaw, pitch: p.pitch };
      const bm = c.refs.present.bodyMesh;
      bm.position.copy(this.saved.pos);
      bm.rotation.y = this.saved.yaw;
      bm.visible = true;
      // 해당 시대의 「유리 저편」 합성물 배치
      const eraRefs = era === 'PAST' ? c.refs.past : c.refs.elder;
      const bw = eraRefs.backWindow;
      const d = dirFromYaw(pose.yawDeg);
      bw.position.set(pose.x, 0, pose.z);
      bw.rotation.y = Math.atan2(d.x, d.z);
      bw.updateMatrixWorld(true);
      const st = eraRefs.backStatue;
      st.position.copy(bw.worldToLocal(this.saved.pos.clone()));
      st.rotation.y = this.saved.yaw - bw.rotation.y;
      bw.visible = true;
      // 분신 스폰 (카메라 전방은 -Z: ry = atan2(-d.x, -d.z))
      p.pos.set(sp.x, 0, sp.z);
      p.yaw = Math.atan2(-d.x, -d.z);
      p.pitch = 0;
      this.mode = 'AVATAR';
      this.era = era;
      this.portalKey = which;
      audio.setEra('PAST');
      c.hud.modeHint(era);
      this.busy = false;
    });
  }

  exit() {
    const c = this.ctx;
    if (carried()) {
      audio.glassTap();
      c.hud.msg('물건은 유리를 건널 수 없다 — 먼저 놓아야 한다 (G)');
      return;
    }
    this.busy = true;
    audio.possessOut();
    c.hud.fade(() => {
      const p = c.player;
      p.pos.copy(this.saved.pos);
      p.yaw = this.saved.yaw;
      p.pitch = this.saved.pitch;
      c.refs.present.bodyMesh.visible = false;
      c.refs.past.backWindow.visible = false;
      c.refs.elder.backWindow.visible = false;
      this.mode = 'BODY';
      this.era = null;
      this.portalKey = null;
      audio.setEra('PRESENT');
      c.hud.modeHint(null);
      this.busy = false;
    });
  }
}
