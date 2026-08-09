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
      case 'mirrorA': case 'mirrorB': return '휠: 거울 돌리기 · F: 빙의';
      // ── P1 (과거 1) ──
      case 'p1Key': return hold ? '' : '집어 들기 (E)';
      case 'p1Pedestal': return '살펴보기 (E)';
      case 'p1Brick':
        if (hold === 'key1') return '벽돌 뒤에 숨기기 (E)';
        if (kt === Key1.BRICK) return '꺼내기 (E)';
        return '살펴보기 (E)';
      case 'p1SealedDoor': case 'p1Stamps': case 'p1Urn': return '살펴보기 (E)';
      // ── P2 (과거 2) ──
      case 'p2Jewels': return hold ? '' : '집어 들기 (E)';
      case 'p2Stele': return '경문 읽기 (E)';
      case 'p2Urn': return '살펴보기 (E)';
      // ── PRESENT ──
      case 'presentDoor':
        if (state.doorOpen) return '';
        return kt === Key1.RETRIEVED ? '열쇠 꽂아 돌리기 (E)' : '살펴보기 (E)';
      case 'presentPile': return '살펴보기 (E)';
      case 'presentBrick': return kt === Key1.BRICK ? '벽돌 빼내기 (E)' : '살펴보기 (E)';
      case 'presentUrnA': case 'presentUrnB': return '살펴보기 (E)';
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
          c.hud.carry('황금 열쇠');
        }
        break;
      case 'p1Pedestal':
        msg('문지기의 좌대다. 열쇠를 모셔 두는 자리인데 — 바로 위 천장에 금이 번져 있다.');
        break;
      case 'p1Brick':
        if (hold === 'key1') {
          audio.brickScrape();
          setKey1({ type: Key1.BRICK });
          c.hud.carry(null);
          msg('벽돌을 빼내고 열쇠를 밀어 넣은 뒤 도로 끼워 두었다. 벽 속이라면 세월도 어쩌지 못한다.');
        } else if (kt === Key1.BRICK) {
          audio.brickScrape();
          setKey1({ type: Key1.CARRIED });
          c.hud.carry('황금 열쇠');
        } else msg('이 벽돌만 빛깔이 살짝 다르다. 흔들어 보니 헐겁게 움직인다.');
        break;
      case 'p1SealedDoor':
        msg('문이 회반죽으로 통째로 봉인되어 있다. 열쇠 구멍까지 덮여 버려서, 이 시대에는 열 방법이 없다.');
        break;
      case 'p1Stamps':
        msg('회반죽에 찍힌 인장들 — 봉인이 끝난 뒤의 시대라는 뜻이다. 이 회반죽도 언젠가는 세월에 삭아 떨어질 것이다.');
        break;
      case 'p1Urn':
        msg('아직은 멀쩡한 단지다. 아직은.');
        break;

      // ═══ P2 (사제단 흡수 실험장 — 문제 2 예정) ═══
      case 'p2Jewels':
        if (key1SealedP2()) { /* 무관 — 보석은 열쇠와 다른 세계선 */ }
        if (!hold) { setJewelsP2({ type: JewelP2.CARRIED }); c.hud.carry('황금 가슴장식'); }
        break;
      case 'p2Stele':
        msg('경문이 새겨져 있다. 「흐트러진 것은 제자리로. 상한 곳은 회반죽으로. 우리의 것은 우리의 자리로.」', 7);
        break;
      case 'p2Urn':
        msg('봉헌 단지다. 사제들의 손길이 아직 선명하다.');
        break;

      // ═══ PRESENT ═══
      case 'presentDoor':
        if (state.doorOpen) break;
        if (kt === Key1.RETRIEVED) {
          state.doorOpen = true;
          audio.doorUnlock();
          applyDerivation();
          c.hud.refreshInventory();
          msg('열쇠가 맞아 들어간다 — 돌문이 무겁게 밀려 열리고, 어둠 속에 매장실이 드러난다.', 5);
          c.onDoorOpen();
        } else msg('돌문은 잠겨 있다. 봉인 회반죽은 세월에 삭아 떨어졌는지, 열쇠 구멍만 덩그러니 드러나 있다.');
        break;
      case 'presentPile':
        msg(kt === Key1.PEDESTAL
          ? '무너져 내린 천장 돌덩이들이다. 족히 몇 톤은 되어 보인다. 틈새 깊은 곳에서 금빛이 반짝이지만, 손을 넣을 수조차 없다.'
          : '무너져 내린 천장 돌덩이들이다. 족히 몇 톤은 되어 보인다. 틈새는 텅 비어 있다.');
        break;
      case 'presentBrick':
        if (kt === Key1.BRICK) {
          audio.brickScrape();
          setKey1({ type: Key1.RETRIEVED });
          c.hud.refreshInventory();
          msg('벽돌 뒤에서 황금 열쇠가 나왔다. 수천 년을 벽 속에서 기다려 온 것이다.');
        } else msg('빛깔이 다른 헐거운 벽돌이다. 빼내 보니 뒤는 텅 비어 있다.');
        break;
      case 'presentUrnA': case 'presentUrnB':
        msg('산산조각 난 단지 — 도굴꾼들이 휩쓸고 지나간 자국이다.');
        break;
    }
  }

  onG() {
    const c = this.ctx;
    const hold = carried();
    if (c.possession.mode !== 'AVATAR') {
      if (state.key1.type === Key1.RETRIEVED) c.hud.msg('되찾은 물건은 품에 지니고 다닌다.');
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
    if (hold === 'key1') { setKey1({ type: Key1.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('열쇠를 바닥에 내려놓았다.'); }
    else if (hold === 'jewels') { setJewelsP2({ type: JewelP2.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('가슴장식을 내려놓았다.'); }
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
