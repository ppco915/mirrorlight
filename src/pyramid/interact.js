// pyramid/interact.js — 문제 1의 상호작용.

import * as THREE from 'three';
import * as audio from '../audio.js';
import {
  state, carried, key1SealedP2, Key1, JewelP2, Chisel, Pin,
  setKey1, setJewelsP2, setChisel, sealChiselP2, setPin, applyDerivation,
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
        if (hold === 'key1' || hold === 'pin') return '벽돌 뒤에 넣기 (E)';
        if (kt === Key1.BRICK || state.pin.type === Pin.BRICK) return '꺼내기 (E)';
        return '들여다보기 (E)';
      case 'p1SealedDoor':
        return hold === 'chisel' ? '회반죽 뜯기 (E)' : '들여다보기 (E)';
      case 'p1Stamps': case 'p1Urn': return '들여다보기 (E)';
      case 'p1Hearth':
        if (hold === 'chisel' || hold === 'pin') return '화덕돌 밑에 넣기 (E)';
        if (state.chisel.type === Chisel.HEARTH || state.pin.type === Pin.HEARTH) return '꺼내기 (E)';
        return '들여다보기 (E)';
      case 'p1Niche':
        if (!state.plasterOpen) return hold === 'chisel' ? '회반죽 뜯기 (E)' : '들여다보기 (E)';
        if (hold === 'pin') return state.vaultOpenP1 ? '금고 닫기 (E)' : '핀으로 열기 (E)';
        return '들여다보기 (E)';
      case 'p1Pin': case 'p1Chisel': return hold ? '' : '집기 (E)';
      case 'p2Chisel': return hold ? '' : '집기 (E)';
      case 'p2Hearth':
        if (hold === 'chisel') return '화덕돌 밑에 넣기 (E)';
        if (state.chisel.type === Chisel.HEARTH) return '꺼내기 (E)';
        return '들여다보기 (E)';
      case 'presentNiche': return '들여다보기 (E)';
      case 'presentHearth': return '들여다보기 (E)';
      // ── P2 (과거 2) ──
      case 'p2Jewels': return hold ? '' : '집기 (E)';
      case 'p2Chisel':
        if (!hold && (state.chisel.type === Chisel.P2SPOT || state.chisel.type === Chisel.P2FLOOR)) {
          if (state.chiselSealedP2) { msg('이미 일어난 일이다.'); break; }
          setChisel({ type: Chisel.CARRIED });
          c.hud.carry('청동 끌');
        }
        break;
      case 'p2Hearth':
        if (hold === 'chisel') {
          audio.brickScrape();
          setChisel({ type: Chisel.HEARTH });
          c.hud.carry(null);
          msg('화덕돌 밑에 끌을 밀어 넣었다 — 사제단은 화덕 밑을 보지 않는다.');
        } else if (state.chisel.type === Chisel.HEARTH && !state.chiselSealedP2) {
          setChisel({ type: Chisel.CARRIED });
          c.hud.carry('청동 끌');
        } else if (state.chisel.type === Chisel.HEARTH) msg('이미 일어난 일이다.');
        else msg('화덕돌이 들린다 — 밑에 작은 공동이 있다.');
        break;
      case 'p2Stele': case 'p2Urn': return '읽기 (E)';
      // ── PRESENT ──
      case 'presentDoor':
        if (state.doorOpen) return '';
        return kt === Key1.RETRIEVED ? '열쇠 돌리기 (E)' : '들여다보기 (E)';
      case 'presentPile': return '들여다보기 (E)';
      case 'presentBrick':
        if (kt === Key1.BRICK || state.pin.type === Pin.BRICK) return '빼기 (E)';
        if (state.pin.type === Pin.RETRIEVED && !state.scarabTaken) return '돌려놓기 (E)';
        return '들여다보기 (E)';
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
        if (hold === 'pin') {
          audio.brickScrape();
          setPin({ type: Pin.BRICK });
          c.hud.carry(null);
          msg('벽돌 뒤에 핀을 넣었다 — 세월이 비껴가는 자리.');
          break;
        }
        if (!hold && state.pin.type === Pin.BRICK) {
          audio.brickScrape();
          setPin({ type: Pin.CARRIED });
          c.hud.carry('청동 핀');
          break;
        }
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
        if (hold === 'chisel' && !state.doorPlasterOff) {
          audio.brickScrape();
          state.doorPlasterOff = true;
          applyDerivation();
          msg('회반죽이 떨어지고 열쇠 구멍이 드러난다 — 그러나 그 열쇠는 이미 일어난 일이다.', 5);
        } else if (state.doorPlasterOff) msg('드러난 자물쇠 — 열쇠는 이미 일어난 일이다.');
        else msg('문이 회반죽으로 봉인되어 있다. 열쇠 구멍까지 덮였다 — 이 시대에는 열 수 없다.');
        break;
      case 'p1Stamps':
        msg('회반죽 위의 인장 도장 — 봉인 이후의 시대라는 뜻이다. 세월이 이 회반죽을 갉아낼 것이다.');
        break;
      case 'p1Urn':
        msg('온전한 항아리다. 아직은.');
        break;
      case 'p1Hearth':
        if (hold === 'chisel') { audio.brickScrape(); setChisel({ type: Chisel.HEARTH }); c.hud.carry(null); msg('화덕돌 밑에 끌을 넣었다.'); }
        else if (hold === 'pin') { audio.brickScrape(); setPin({ type: Pin.HEARTH }); c.hud.carry(null); msg('화덕돌 밑에 핀을 넣었다 — 도굴꾼들이 화덕부터 들추지 않기를.'); }
        else if (state.chisel.type === Chisel.HEARTH) { sealChiselP2(); setChisel({ type: Chisel.CARRIED }); c.hud.carry('청동 끌'); msg('더 먼 과거에서 온 끌 — 손에 잡힌다.'); }
        else if (state.pin.type === Pin.HEARTH) { setPin({ type: Pin.CARRIED }); c.hud.carry('청동 핀'); }
        else msg('화덕돌이 들린다 — 밑에 작은 공동이 있다.');
        break;
      case 'p1Niche':
        if (!state.plasterOpen) {
          if (hold === 'chisel') {
            audio.brickScrape();
            state.plasterOpen = true;
            applyDerivation();
            msg('회반죽이 떨어져 나간다 — 청동 로제트와 핀 구멍, 그리고 그 곁의 청동 핀.', 5);
          } else msg('회반죽으로 봉해진 벽감 — 바른 지 오래지 않다. 손톱으로는 어림없다.');
        } else if (hold === 'pin') {
          audio.doorUnlock();
          state.vaultOpenP1 = !state.vaultOpenP1;
          applyDerivation();
          msg(state.vaultOpenP1
            ? '핀이 홈에 맞고 금고문이 돌아간다 — 황금 스카라베. 그러나 이 문이 열린 채 남으면, 그들이 지나갈 것이다.'
            : '금고문을 도로 닫았다 — 홈은 남고, 문은 시치미를 뗀다.', 5);
        } else if (state.vaultOpenP1) {
          msg('스카라베가 좌대에 밀랍으로 붙어 있다 — 삼천 년이 이것을 떼어낼 것이다. 지금은 아니다.');
        } else msg('청동 로제트 — 핀 구멍이 비어 있다.');
        break;
      case 'p1Pin':
        if (!hold) { setPin({ type: Pin.CARRIED }); c.hud.carry('청동 핀'); }
        break;
      case 'p1Chisel':
        if (!hold) { setChisel({ type: Chisel.CARRIED }); c.hud.carry('청동 끌'); }
        break;

      // ═══ P2 (사제단 흡수 실험장 — 문제 2 예정) ═══
      case 'p2Jewels':
        if (key1SealedP2()) { /* 무관 — 보석은 열쇠와 다른 세계선 */ }
        if (!hold) { setJewelsP2({ type: JewelP2.CARRIED }); c.hud.carry('가슴장식'); }
        break;
      case 'p2Chisel':
        if (!hold && (state.chisel.type === Chisel.P2SPOT || state.chisel.type === Chisel.P2FLOOR)) {
          if (state.chiselSealedP2) { msg('이미 일어난 일이다.'); break; }
          setChisel({ type: Chisel.CARRIED });
          c.hud.carry('청동 끌');
        }
        break;
      case 'p2Hearth':
        if (hold === 'chisel') {
          audio.brickScrape();
          setChisel({ type: Chisel.HEARTH });
          c.hud.carry(null);
          msg('화덕돌 밑에 끌을 밀어 넣었다 — 사제단은 화덕 밑을 보지 않는다.');
        } else if (state.chisel.type === Chisel.HEARTH && !state.chiselSealedP2) {
          setChisel({ type: Chisel.CARRIED });
          c.hud.carry('청동 끌');
        } else if (state.chisel.type === Chisel.HEARTH) msg('이미 일어난 일이다.');
        else msg('화덕돌이 들린다 — 밑에 작은 공동이 있다.');
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
      case 'presentNiche':
        if (!state.plasterOpen) msg('돌이 된 회반죽 — 지금 이걸 쪼면 천장이 또 내려앉는다. 갓 발린 시대라면 이야기가 다르다.');
        else if (state.vaultOpenP1) msg('금고가 열린 채 비어 있다 — 그들이 먼저 보았다. 과거 1에서 문을 닫아 두면 시간선이 바뀐다.');
        else if (state.scarabTaken) msg('빈 금고 — 스카라베는 내 손에 있다.');
        else if (state.pin.type === Pin.RETRIEVED) {
          audio.doorUnlock();
          state.scarabTaken = true;
          applyDerivation();
          msg('핀이 홈에 맞는다 — 금고문이 열리고, 밀랍은 가루가 되어 스카라베가 손에 떨어진다.', 5);
          c.onScarab();
        } else msg('청동 로제트와 핀 구멍 — 홈에 맞는 핀이 필요하다. 여기 홈이 있다는 것은, 과거의 내가 이미 다녀갔다는 뜻이다.');
        break;
      case 'presentHearth':
        msg('들춰진 화덕돌 — 그들이 먼저 뒤졌다. 여기 두는 것은 그들에게 두는 것이다.');
        break;
      case 'presentBrick':
        if (state.pin.type === Pin.BRICK) {
          audio.brickScrape();
          setPin({ type: Pin.RETRIEVED });
          c.hud.refreshInventory();
          msg('벽돌 뒤에서 청동 핀이 나온다 — 갓 만든 것처럼 차갑다.');
          break;
        }
        if (state.pin.type === Pin.RETRIEVED && !state.scarabTaken) {
          audio.brickScrape();
          setPin({ type: Pin.BRICK });
          c.hud.refreshInventory();
          msg('핀을 제자리에 돌려놓았다 — 시간선이 다시 이어진다.');
          break;
        }
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
    else if (hold === 'chisel') {
      setChisel({ type: c.possession.era === 'P2' ? Chisel.P2FLOOR : Chisel.P1FLOOR, x, z });
      c.hud.carry(null); c.hud.msg('끌을 내려놓았다.');
    } else if (hold === 'pin') { setPin({ type: Pin.P1FLOOR, x, z }); c.hud.carry(null); c.hud.msg('핀을 내려놓았다.'); }
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
