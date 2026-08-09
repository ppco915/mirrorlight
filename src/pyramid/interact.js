// pyramid/interact.js — 문제 1의 상호작용.

import * as THREE from 'three';
import * as audio from '../audio.js';
import {
  state, carried, key1SealedP2, Key1, JewelP2,
  setKey1, setJewelsP2, applyDerivation,
} from './causal.js';

const RANGE = 2.5;
const AIM_OFFSETS = [
  [0, 0], [0.04, 0], [-0.04, 0], [0, 0.04], [0, -0.04],
  [0.028, 0.028], [-0.028, 0.028], [0.028, -0.028], [-0.028, -0.028],
];
function hitRadius(mesh) {
  const g = mesh.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  return g.boundingSphere.radius;
}

export class Interact {
  constructor(ctx) {
    this.ctx = ctx;
    this.ray = new THREE.Raycaster();
    this.ray.far = RANGE;
    this.hovered = null;
    this._tmp = new THREE.Vector3();
    this._v2 = new THREE.Vector2();
  }

  lookingAtPortal() {
    if (this.hovered?.id === 'mirrorA') return 'A';
    if (this.hovered?.id === 'mirrorB') return 'B';
    return null;
  }

  targets() {
    const c = this.ctx;
    if (c.possession.mode === 'AVATAR') return c.hot[c.possession.era];
    return [...c.hot.PRESENT, c.portals.A.group, c.portals.B.group];
  }

  update() {
    const c = this.ctx;
    const targets = this.targets();
    const avatar = c.possession.mode === 'AVATAR';
    const cone = avatar ? c.possession.activeCone() : null;
    let best = null, bestScore = Infinity;
    for (let i = 0; i < AIM_OFFSETS.length; i++) {
      this.ray.setFromCamera(this._v2.set(AIM_OFFSETS[i][0], AIM_OFFSETS[i][1]), c.camera);
      const hits = this.ray.intersectObjects(targets, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData.hot) o = o.parent;
        if (!o?.userData.hot || o.visible === false) continue;
        if (cone) {
          const p = o.getWorldPosition(this._tmp);
          if (!cone.contains({ x: p.x, y: p.y, z: p.z })) break;
        }
        const score = hitRadius(h.object) * (i === 0 ? 0.5 : 1);
        if (score < bestScore) { bestScore = score; best = { id: o.userData.hot, mesh: o }; }
        break;
      }
    }
    this.hovered = best;
    c.hud.prompt(best ? this.promptFor(best.id) : '');
  }

  promptFor(id) {
    const hold = carried();
    const kt = state.key1.type;
    switch (id) {
      case 'mirrorA': case 'mirrorB': return '휠: 회전 · F: 빙의';
      // ── P1 (과거 1) ──
      case 'p1Key': return hold ? '' : '집기 (E)';
      case 'p1Pedestal': return '들여다보기 (E)';
      case 'p1Brick':
        if (hold === 'key1') return '벽돌 뒤에 넣기 (E)';
        if (kt === Key1.BRICK) return '꺼내기 (E)';
        return '들여다보기 (E)';
      case 'p1SealedDoor': case 'p1Stamps': case 'p1Urn': return '들여다보기 (E)';
      // ── P2 (과거 2) ──
      case 'p2Jewels': return hold ? '' : '집기 (E)';
      case 'p2Stele': case 'p2Urn': return '읽기 (E)';
      // ── PRESENT ──
      case 'presentDoor':
        if (state.doorOpen) return '';
        return kt === Key1.RETRIEVED ? '열쇠 돌리기 (E)' : '들여다보기 (E)';
      case 'presentPile': return '들여다보기 (E)';
      case 'presentBrick': return kt === Key1.BRICK ? '빼기 (E)' : '들여다보기 (E)';
      case 'presentUrnA': case 'presentUrnB': return '들여다보기 (E)';
      default: return '';
    }
  }

  onE() {
    const c = this.ctx;
    if (!this.hovered) return;
    const id = this.hovered.id;
    const hold = carried();
    const kt = state.key1.type;
    const msg = (s, d) => c.hud.msg(s, d);
    switch (id) {
      // ═══ P1 ═══
      case 'p1Key':
        if (!hold && (kt === Key1.PEDESTAL || kt === Key1.FLOOR)) {
          setKey1({ type: Key1.CARRIED });
          c.hud.carry('열쇠 1');
        }
        break;
      case 'p1Pedestal':
        msg('문지기의 좌대 — 열쇠가 놓이는 자리다. 천장의 균열이 그 위에서 자라고 있다.');
        break;
      case 'p1Brick':
        if (hold === 'key1') {
          audio.brickScrape();
          setKey1({ type: Key1.BRICK });
          c.hud.carry(null);
          msg('벽돌을 빼고 열쇠를 넣은 뒤 도로 끼웠다 — 벽 속은 세월이 비껴간다.');
        } else if (kt === Key1.BRICK) {
          audio.brickScrape();
          setKey1({ type: Key1.CARRIED });
          c.hud.carry('열쇠 1');
        } else msg('색이 살짝 다른 벽돌 — 헐겁다.');
        break;
      case 'p1SealedDoor':
        msg('문이 회반죽으로 봉인되어 있다. 열쇠 구멍까지 덮였다 — 이 시대에는 열 수 없다.');
        break;
      case 'p1Stamps':
        msg('회반죽 위의 인장 도장 — 봉인 이후의 시대라는 뜻이다. 세월이 이 회반죽을 갉아낼 것이다.');
        break;
      case 'p1Urn':
        msg('온전한 항아리다. 아직은.');
        break;

      // ═══ P2 (사제단 흡수 실험장 — 문제 2 예정) ═══
      case 'p2Jewels':
        if (key1SealedP2()) { /* 무관 — 보석은 열쇠와 다른 세계선 */ }
        if (!hold) { setJewelsP2({ type: JewelP2.CARRIED }); c.hud.carry('가슴장식'); }
        break;
      case 'p2Stele':
        msg('경문: 「흐트러진 것은 정위치로. 상처는 회반죽으로. 우리의 것은 우리의 자리로.」', 7);
        break;
      case 'p2Urn':
        msg('봉헌 항아리 — 사제단의 손길이 닿아 있다.');
        break;

      // ═══ PRESENT ═══
      case 'presentDoor':
        if (state.doorOpen) break;
        if (kt === Key1.RETRIEVED) {
          state.doorOpen = true;
          audio.doorUnlock();
          applyDerivation();
          c.hud.refreshInventory();
          msg('열쇠가 돌아간다 — 돌문이 밀려 열린다. 방 2가 어둠 속에 있다.', 5);
          c.onDoorOpen();
        } else msg('돌문은 잠겨 있다. 열쇠 구멍만 드러나 있다 — 회반죽은 세월이 이미 갉아냈다.');
        break;
      case 'presentPile':
        msg(kt === Key1.PEDESTAL
          ? '무너진 천장 돌덩이들 — 몇 톤은 된다. 틈새 깊은 곳에서 금빛이 반짝인다. 꺼낼 수 없다.'
          : '무너진 천장 돌덩이들 — 몇 톤은 된다. 틈새는 비어 있다.');
        break;
      case 'presentBrick':
        if (kt === Key1.BRICK) {
          audio.brickScrape();
          setKey1({ type: Key1.RETRIEVED });
          c.hud.refreshInventory();
          msg('벽돌 뒤에서 열쇠 1이 나온다 — 수천 년을 벽 속에서 기다렸다.');
        } else msg('색이 다른 헐거운 벽돌 — 뒤는 비어 있다.');
        break;
      case 'presentUrnA': case 'presentUrnB':
        msg('부서진 항아리 — 도굴의 흔적이다.');
        break;
    }
  }

  onG() {
    const c = this.ctx;
    const hold = carried();
    if (c.possession.mode !== 'AVATAR') {
      if (state.key1.type === Key1.RETRIEVED) c.hud.msg('회수한 물건은 몸에 지닌다.');
      return;
    }
    if (!hold) { c.hud.msg('빈손이다.'); return; }
    const p = c.player;
    const cone = c.possession.activeCone();
    let x = p.pos.x - Math.sin(p.yaw) * 0.4;
    let z = p.pos.z - Math.cos(p.yaw) * 0.4;
    if (!cone.contains({ x, y: 0, z }) || !c.walkableEra(c.possession.era)(x, z)) {
      x = p.pos.x; z = p.pos.z;
    }
    if (hold === 'key1') { setKey1({ type: Key1.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('열쇠를 내려놓았다.'); }
    else if (hold === 'jewels') { setJewelsP2({ type: JewelP2.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('내려놓았다.'); }
  }

  onKeyE(down) { if (down) this.onE(); }

  onWheel(dy) {
    const c = this.ctx;
    if (c.possession.mode !== 'BODY') return;
    const which = this.lookingAtPortal();
    if (!which) return;
    const portal = c.portals[which];
    portal.setPose(portal.railT, portal.yawDeg - dy);
    c.cones[which].update(portal.pose);
  }
}
