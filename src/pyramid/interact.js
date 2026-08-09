// pyramid/interact.js — 상호작용. 조준 보조와 원뿔 게이트는 본편과 같은 방식.

import * as THREE from 'three';
import * as audio from '../audio.js';
import {
  state, carried, jewelsSealedE1, JewelE1, Jewel, Rod,
  setJewelsE1, setJewels, setRod, applyDerivation,
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
    switch (id) {
      case 'mirrorA': case 'mirrorB': return '휠: 회전 · F: 빙의';
      // ── SEAL (사제단의 시대 — 흡수 실험장) ──
      case 'sealJewels': return jewelsSealedE1() ? '들여다보기 (E)' : (hold ? '' : '집기 (E)');
      case 'sealCrypt': case 'sealAlcove': case 'sealStele': return hold === 'jewels' ? '놓기 (E)' : '들여다보기 (E)';
      // ── ROB (도굴의 밤 — 진짜 편집) ──
      case 'robAlcove': return hold ? '들여다보기 (E)' : '집기 (E)';
      case 'robRodLoose': return hold ? '' : '집기 (E)';
      case 'robCrypt':
        if (!state.cryptOpen) return hold === 'rod' ? '봉으로 열기 (E)' : '들여다보기 (E)';
        if (hold === 'jewels') return '도로 넣기 (E)';
        if (!hold && state.jewels.type === Jewel.NICHE) return '집기 (E)';
        return hold === 'rod' ? '닫기 (E)' : '들여다보기 (E)';
      case 'robJewelsCrypt': case 'robJewelsLoose': return hold ? '' : '집기 (E)';
      case 'robUrnA': case 'robUrnB': return hold === 'jewels' ? '넣기 (E)' : '들여다보기 (E)';
      case 'robBlock': return hold === 'jewels' ? '밑에 숨기기 (E)'
        : (state.jewels.type === Jewel.BLOCK ? '꺼내기 (E)' : '들여다보기 (E)');
      case 'robStamps': case 'robTools': return '들여다보기 (E)';
      // ── PRESENT ──
      case 'presentBlock': return state.jewels.type === Jewel.BLOCK ? '들어올리기 (E)' : '들여다보기 (E)';
      case 'presentCrypt': case 'presentAlcove': case 'presentUrnA': case 'presentUrnB':
        return '들여다보기 (E)';
      default: return '';
    }
  }

  onE() {
    const c = this.ctx;
    if (!this.hovered) return;
    const id = this.hovered.id;
    const hold = carried();
    const msg = (s, d) => c.hud.msg(s, d);
    switch (id) {
      // ═══ SEAL — 사제단이 모든 편집을 흡수한다 ═══
      case 'sealJewels':
        if (jewelsSealedE1()) msg('이미 일어난 일이다.');
        else if (!hold) { setJewelsE1({ type: JewelE1.CARRIED }); c.hud.carry('가슴장식'); }
        break;
      case 'sealCrypt':
        if (hold === 'jewels' && state.jewelsE1.type === JewelE1.CARRIED) {
          setJewelsE1({ type: JewelE1.ALTAR }); c.hud.carry(null);
          msg('제단에 돌려놓았다.');
        } else msg('크립트가 열려 있다 — 봉인 준비 중이다.');
        break;
      case 'sealAlcove':
        msg('사제단의 여는 봉 — 「쓰임이 끝나면 벽감으로 돌아간다」고 새겨져 있다.');
        break;
      case 'sealStele':
        msg('경문: 「흐트러진 부장품은 정위치로. 상처는 회반죽으로. 우리의 것은 우리의 자리로.」', 7);
        break;

      // ═══ ROB — 도굴의 밤 ═══
      case 'robAlcove':
        if (!hold) { setRod({ type: Rod.CARRIED }); c.hud.carry('여는 봉'); }
        else msg('청동 봉이 벽감에 모셔져 있다.');
        break;
      case 'robRodLoose':
        if (!hold) { setRod({ type: Rod.CARRIED }); c.hud.carry('여는 봉'); }
        break;
      case 'robCrypt':
        if (!state.cryptOpen) {
          if (hold === 'rod') {
            state.cryptOpen = true;
            audio.brickScrape();
            applyDerivation();
            msg('봉이 홈에 맞물리고 뚜껑이 미끄러진다 — 상처 없이 열렸다.');
          } else msg('제단 밑의 봉인된 크립트다. 억지로는 열리지 않는다.');
        } else if (hold === 'jewels') {
          setJewels({ type: Jewel.NICHE }); c.hud.carry(null);
          msg('가슴장식을 크립트에 도로 넣었다.');
        } else if (!hold && state.jewels.type === Jewel.NICHE) {
          setJewels({ type: Jewel.CARRIED }); c.hud.carry('가슴장식');
        } else if (hold === 'rod') {
          state.cryptOpen = false;
          audio.brickScrape();
          applyDerivation();
          msg('뚜껑을 도로 밀어 닫았다.');
        } else msg('크립트가 열려 있다. 비어 있다.');
        break;
      case 'robJewelsCrypt': case 'robJewelsLoose':
        if (!hold) { setJewels({ type: Jewel.CARRIED }); c.hud.carry('가슴장식'); }
        break;
      case 'robUrnA': case 'robUrnB':
        if (hold === 'jewels') {
          setJewels({ type: Jewel.URN }); c.hud.carry(null);
          msg('장식 항아리에 넣었다 — 눈에 띄는 그릇이 눈에 띄는 것을 지켜 줄까.');
        } else msg('장식 항아리다. 값나가 보인다.');
        break;
      case 'robBlock':
        if (hold === 'jewels') {
          audio.brickScrape();
          setJewels({ type: Jewel.BLOCK }); c.hud.carry(null);
          msg('들뜬 바닥돌 밑에 밀어 넣었다 — 밋밋한 돌은 아무도 들추지 않는다.');
        } else if (!hold && state.jewels.type === Jewel.BLOCK) {
          setJewels({ type: Jewel.CARRIED }); c.hud.carry('가슴장식');
        } else msg('들뜬 바닥돌 — 도굴꾼들의 발밑, 등잔 밑의 어둠.');
        break;
      case 'robStamps':
        msg('석판의 인장 도장 — 봉인 뒤의 시대라는 뜻이다. 파공은 도장을 피해 뚫렸다.');
        break;
      case 'robTools':
        msg('도굴꾼의 연장과 침낭 — 그들은 오늘 밤 벽을 마저 뚫을 것이다.');
        break;

      // ═══ PRESENT ═══
      case 'presentCrypt':
        msg(state.cryptOpen || state.jewels.type !== Jewel.NICHE
          ? '크립트가 열린 채 비어 있다 — 뜯은 자국이 없다. 열려 있는 것을 발견했던 모양이다.'
          : '뜯겨 열린 크립트 — 쇠지렛 자국. 그들이 먼저 다녀갔다.');
        break;
      case 'presentAlcove':
        msg('빈 벽감 — 청동이 있던 자리. 「쓰임이 끝나면 돌아간다」는 새김만 남았다.');
        break;
      case 'presentUrnA': case 'presentUrnB':
        msg('부서진 항아리 — 값나가 보이는 것은 전부 이 꼴이 났다.');
        break;
      case 'presentBlock':
        if (state.jewels.type === Jewel.BLOCK) {
          audio.brickScrape();
          setJewels({ type: Jewel.RETRIEVED });
          c.hud.refreshInventory();
          msg('바닥돌 밑에서 가슴장식이 나온다 — 3천 년의 손들이 전부 비껴간 자리.');
          c.win();
        } else msg('들뜬 바닥돌 — 밑은 비어 있다. 아무도 여길 들추지 않았다.');
        break;
    }
  }

  onG() {
    const c = this.ctx;
    const hold = carried();
    if (c.possession.mode !== 'AVATAR') {
      if (state.jewels.type === Jewel.RETRIEVED) c.hud.msg('회수한 물건은 몸에 지닌다.');
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
    if (c.possession.era === 'SEAL') {
      if (hold === 'jewels') { setJewelsE1({ type: JewelE1.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('내려놓았다.'); }
    } else if (hold === 'jewels') {
      setJewels({ type: Jewel.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('가슴장식을 내려놓았다.');
    } else if (hold === 'rod') {
      setRod({ type: Rod.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('봉을 내려놓았다.');
    }
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
