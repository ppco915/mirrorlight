// pyramid/interact.js — 문제 1의 상호작용.

import * as THREE from 'three';
import * as audio from '../audio.js';
import {
  state, carriedAll, lastCarried, selectHand, ITEM_LABEL,
  key1SealedP2, Key1, JewelP2, Chisel, Pin,
  setKey1, setJewelsP2, setChisel, sealChiselP2, setPin, applyDerivation,
} from './causal.js';

// 받침 유무에 맞는 조사 — '열쇠는 / 핀은' 식으로 자연스럽게 붙인다
function josa(word, pair) {
  const c = word.charCodeAt(word.length - 1);
  const tail = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  const [a, b] = { 은는: ['은', '는'], 을를: ['을', '를'], 이가: ['이', '가'] }[pair];
  return word + (tail ? a : b);
}

const RANGE = 2.5;
const AIM_OFFSETS = [
  [0, 0], [0.04, 0], [-0.04, 0], [0, 0.04], [0, -0.04],
  [0.028, 0.028], [-0.028, 0.028], [0.028, -0.028], [-0.028, -0.028],
];
const HL_COLOR = 0xffa843;   // 조준 강조 발광색 — 따뜻한 호박빛
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
    this._hl = { id: null, mats: [] };   // 조준 강조 중인 재질과 원래 발광값
  }

  // 조준 강조 — 같은 hot 그룹의 모든 메쉬 재질에 발광을 얹는다.
  // 재질은 hot 그룹 안에서만 공유되므로(감사 완료) 그룹째 함께 빛난다.
  setHighlight(id) {
    if (this._hl.id === id) return;
    for (const e of this._hl.mats) {
      e.mat.emissive.setHex(e.hex);
      e.mat.emissiveIntensity = e.intensity;
    }
    this._hl = { id, mats: [] };
    if (!id) return;
    const seen = new Set();
    for (const root of this.targets()) {
      root.traverse((o) => {
        if (o.userData?.hot !== id || !o.isMesh) return;
        const m = o.material;
        if (!m || !m.emissive || seen.has(m)) return;
        seen.add(m);
        this._hl.mats.push({ mat: m, hex: m.emissive.getHex(), intensity: m.emissiveIntensity ?? 1 });
        m.emissive.setHex(HL_COLOR);
      });
    }
  }

  // 잘못 든 물건으로 시도했을 때의 안내. want가 이 자리에 필요한 물건이면
  // 힌트를 덧붙인다 — 들고 있으면 바꿔 들기, 없으면 무엇이 필요한지.
  wrongItem(handId, wantId = null) {
    let s = `${josa(ITEM_LABEL[handId], '은는')} 여기에 쓰는 물건이 아니다.`;
    if (wantId && carriedAll().includes(wantId)) {
      s += ` ${josa(ITEM_LABEL[wantId], '을를')} 골라 들어야 한다. (숫자 키)`;
    } else if (wantId) {
      s += ` ${josa(ITEM_LABEL[wantId], '이가')} 필요하다.`;
    }
    return s;
  }

  // 숫자 키 — 들고 있는 것 중 n번째를 손에 든다
  onDigit(n) {
    const id = carriedAll()[n - 1];
    if (!id || !selectHand(id)) return;
    this.ctx.hud.carry();   // 슬롯 바 강조 갱신
    this.ctx.hud.msg(`${josa(ITEM_LABEL[id], '을를')} 손에 들었다.`, 1.6);
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
    this.setHighlight(best ? best.id : null);
    if (this._hl.mats.length) {   // 숨 쉬듯 맥동하는 강조
      const p = 0.13 + 0.07 * Math.sin(performance.now() * 0.006);
      for (const e of this._hl.mats) e.mat.emissiveIntensity = p;
    }
    c.hud.prompt(best ? this.promptFor(best.id) : '');
  }

  promptFor(id) {
    const has = (x) => carriedAll().includes(x);
    const hand = lastCarried();   // 손에 든 것 — 상호작용은 이것으로 판정한다
    const pick = (want) => `${ITEM_LABEL[want]} 골라 들기 (숫자 키)`;
    const kt = state.key1.type;
    switch (id) {
      case 'mirrorA': case 'mirrorB': return '휠: 거울 돌리기 · F: 빙의';
      case 'backMirrorA': case 'backMirrorB': return '거울 너머는 현재다 · F: 돌아가기';
      // ── P1 (과거 1) ──
      case 'p1Key': return '집어 들기 (E)';
      case 'p1Pedestal': return '살펴보기 (E)';
      case 'p1Brick':
        if (hand === 'key1' || hand === 'pin') return '벽돌 뒤에 숨기기 (E)';
        if (kt === Key1.BRICK || state.pin.type === Pin.BRICK) return '꺼내기 (E)';
        if (has('key1')) return pick('key1');
        if (has('pin')) return pick('pin');
        return '살펴보기 (E)';
      case 'p1SealedDoor':
        if (state.doorPlasterOff) return '살펴보기 (E)';
        if (hand === 'chisel') return '회반죽 뜯어내기 (E)';
        if (has('chisel')) return pick('chisel');
        return '살펴보기 (E)';
      case 'p1Stamps': case 'p1Urn': return '살펴보기 (E)';
      case 'p1Hearth':
        if (hand === 'chisel' || hand === 'pin') return '화덕돌 밑에 숨기기 (E)';
        if (state.chisel.type === Chisel.HEARTH || state.pin.type === Pin.HEARTH) return '꺼내기 (E)';
        if (has('chisel')) return pick('chisel');
        if (has('pin')) return pick('pin');
        return '살펴보기 (E)';
      case 'p1Niche':
        if (!state.plasterOpen) {
          if (hand === 'chisel') return '회반죽 뜯어내기 (E)';
          if (has('chisel')) return pick('chisel');
          return '살펴보기 (E)';
        }
        if (hand === 'pin') return state.vaultOpenP1 ? '금고문 닫기 (E)' : '핀 꽂아 열기 (E)';
        if (has('pin')) return pick('pin');
        return '살펴보기 (E)';
      case 'p1Pin': case 'p1Chisel': return '집어 들기 (E)';
      case 'p2Chisel': return '집어 들기 (E)';
      case 'p2Hearth':
        if (hand === 'chisel') return '화덕돌 밑에 숨기기 (E)';
        if (state.chisel.type === Chisel.HEARTH) return '꺼내기 (E)';
        if (has('chisel')) return pick('chisel');
        return '살펴보기 (E)';
      // ── P2 (과거 2) ──
      case 'p2Jewels': return '집어 들기 (E)';
      case 'p2Stele': return '경문 읽기 (E)';
      case 'p2Urn': return '살펴보기 (E)';
      // ── PRESENT ──
      case 'presentDoor':
        if (state.doorOpen) return '';
        return kt === Key1.RETRIEVED ? '열쇠 꽂아 돌리기 (E)' : '살펴보기 (E)';
      case 'presentPile': return '살펴보기 (E)';
      case 'presentNiche':
        if (state.plasterOpen && !state.scarabTaken && !state.vaultOpenP1
          && state.pin.type === Pin.RETRIEVED) return '핀 꽂아 열기 (E)';
        return '살펴보기 (E)';
      case 'presentHearth': return '살펴보기 (E)';
      case 'presentBrick':
        if (kt === Key1.BRICK || state.pin.type === Pin.BRICK) return '벽돌 빼내기 (E)';
        if (state.pin.type === Pin.RETRIEVED && !state.scarabTaken) return '돌려놓기 (E)';
        return '살펴보기 (E)';
      case 'presentUrnA': case 'presentUrnB': return '살펴보기 (E)';
      default: return '';
    }
  }

  onE() {
    const c = this.ctx;
    if (!this.hovered) return;
    const id = this.hovered.id;
    const hand = lastCarried();   // 손에 든 것 — 도구를 쓰는 상호작용은 이것으로만 판정
    const kt = state.key1.type;
    const msg = (s, d) => c.hud.msg(s, d);
    switch (id) {
      // ═══ P1 ═══
      case 'p1Key':
        if (kt === Key1.PEDESTAL || kt === Key1.FLOOR) {
          setKey1({ type: Key1.CARRIED });
          c.hud.carry('황금 열쇠');
        }
        break;
      case 'p1Pedestal':
        msg('문지기의 좌대다. 열쇠를 모셔 두는 자리인데 — 바로 위 천장에 금이 번져 있다.');
        break;
      case 'p1Brick': {
        // 손에 든 것만 숨긴다 — 벽 틈은 좁아 열쇠나 핀 정도만 들어간다
        if (hand === 'pin') {
          audio.brickScrape();
          setPin({ type: Pin.BRICK });
          c.hud.carry(null);
          msg('벽돌을 빼내고 핀을 밀어 넣었다. 벽 속이라면 세월도 어쩌지 못한다.');
          break;
        }
        if (hand === 'key1') {
          audio.brickScrape();
          setKey1({ type: Key1.BRICK });
          c.hud.carry(null);
          msg('벽돌을 빼내고 열쇠를 밀어 넣은 뒤 도로 끼워 두었다. 벽 속이라면 세월도 어쩌지 못한다.');
          break;
        }
        if (state.pin.type === Pin.BRICK) {
          audio.brickScrape();
          setPin({ type: Pin.CARRIED });
          c.hud.carry('청동 핀');
        } else if (kt === Key1.BRICK) {
          audio.brickScrape();
          setKey1({ type: Key1.CARRIED });
          c.hud.carry('황금 열쇠');
        } else if (hand) msg(this.wrongItem(hand) + ' 벽 틈은 좁다.');
        else msg('이 벽돌만 빛깔이 살짝 다르다. 흔들어 보니 헐겁게 움직인다.');
        break;
      }
      case 'p1SealedDoor':
        if (hand === 'chisel' && !state.doorPlasterOff) {
          audio.brickScrape();
          state.doorPlasterOff = true;
          applyDerivation();
          msg('회반죽이 떨어져 나가고 열쇠 구멍이 드러난다. 하지만 그 열쇠는 — 이미 일어난 일이다.', 5);
        } else if (state.doorPlasterOff) msg('자물쇠가 드러나 있다. 열쇠는 — 이미 일어난 일이다.');
        else if (hand) msg(this.wrongItem(hand, 'chisel'));
        else msg('문이 회반죽으로 통째로 봉인되어 있다. 열쇠 구멍까지 덮여 버려서, 이 시대에는 열 방법이 없다.');
        break;
      case 'p1Stamps':
        msg('회반죽에 찍힌 인장들 — 봉인이 끝난 뒤의 시대라는 뜻이다. 이 회반죽도 언젠가는 세월에 삭아 떨어질 것이다.');
        break;
      case 'p1Urn':
        msg('아직은 멀쩡한 단지다. 아직은.');
        break;
      case 'p1Hearth': {
        if (hand === 'chisel') { audio.brickScrape(); setChisel({ type: Chisel.HEARTH }); c.hud.carry(null); msg('화덕돌 밑에 끌을 밀어 넣었다.'); }
        else if (hand === 'pin') { audio.brickScrape(); setPin({ type: Pin.HEARTH }); c.hud.carry(null); msg('화덕돌 밑에 핀을 넣었다. 도굴꾼들이 화덕부터 들추지 않기를 빌 뿐이다.'); }
        else if (state.chisel.type === Chisel.HEARTH) { sealChiselP2(); setChisel({ type: Chisel.CARRIED }); c.hud.carry('청동 끌'); msg('더 먼 과거에서 건너온 끌이 손에 잡힌다.'); }
        else if (state.pin.type === Pin.HEARTH) { setPin({ type: Pin.CARRIED }); c.hud.carry('청동 핀'); }
        else if (hand) msg(this.wrongItem(hand) + ' 화덕돌 밑 빈 공간은 얕다.');
        else msg('화덕돌이 들썩인다. 밑에 작은 빈 공간이 있다.');
        break;
      }
      case 'p1Niche':
        if (!state.plasterOpen) {
          if (hand === 'chisel') {
            audio.brickScrape();
            state.plasterOpen = true;
            applyDerivation();
            msg('회반죽이 뜯겨 나간다. 청동 로제트와 핀 구멍, 그리고 그 곁에 꽂힌 청동 핀이 드러난다.', 5);
          } else if (hand) msg(this.wrongItem(hand, 'chisel'));
          else msg('회반죽으로 봉해진 벽감이다. 바른 지 얼마 되지 않았지만, 맨손으로는 어림도 없다.');
        } else if (hand === 'pin') {
          audio.doorUnlock();
          state.vaultOpenP1 = !state.vaultOpenP1;
          applyDerivation();
          msg(state.vaultOpenP1
            ? '핀이 홈에 맞아 들어가고 금고문이 돌아간다 — 황금 스카라베다. 하지만 문을 열어 둔 채 떠나면, 도굴꾼들의 시대가 이곳을 지나갈 것이다.'
            : '금고문을 도로 닫았다. 홈은 남았지만, 문은 아무 일 없었다는 듯 시치미를 뗀다.', 5);
        } else if (state.vaultOpenP1) {
          msg('스카라베가 밀랍으로 좌대에 단단히 붙어 있다. 이걸 떼어내는 것은 삼천 년 세월의 몫이다. 지금은 아니다.');
        } else if (hand) msg(this.wrongItem(hand, 'pin'));
        else msg('청동 로제트다. 핀 구멍이 비어 있다.');
        break;
      case 'p1Pin':
        setPin({ type: Pin.CARRIED });
        c.hud.carry('청동 핀');
        break;
      case 'p1Chisel':
        setChisel({ type: Chisel.CARRIED });
        c.hud.carry('청동 끌');
        break;

      // ═══ P2 (사제단 흡수 실험장 — 문제 2 예정) ═══
      case 'p2Jewels':
        if (key1SealedP2()) { /* 무관 — 보석은 열쇠와 다른 세계선 */ }
        setJewelsP2({ type: JewelP2.CARRIED });
        c.hud.carry('황금 가슴장식');
        break;
      case 'p2Chisel':
        if (state.chisel.type === Chisel.P2SPOT || state.chisel.type === Chisel.P2FLOOR) {
          if (state.chiselSealedP2) { msg('이미 일어난 일이다.'); break; }
          setChisel({ type: Chisel.CARRIED });
          c.hud.carry('청동 끌');
        }
        break;
      case 'p2Hearth':
        if (hand === 'chisel') {
          audio.brickScrape();
          setChisel({ type: Chisel.HEARTH });
          c.hud.carry(null);
          msg('화덕돌 밑에 끌을 밀어 넣었다. 사제들은 화덕 밑까지 살피지 않는다.');
        } else if (state.chisel.type === Chisel.HEARTH && !state.chiselSealedP2) {
          setChisel({ type: Chisel.CARRIED });
          c.hud.carry('청동 끌');
        } else if (state.chisel.type === Chisel.HEARTH) msg('이미 일어난 일이다.');
        else if (hand) msg(this.wrongItem(hand) + ' 화덕돌 밑 빈 공간은 얕다.');
        else msg('화덕돌이 들썩인다. 밑에 작은 빈 공간이 있다.');
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
      case 'presentNiche':
        if (!state.plasterOpen) msg('세월에 돌처럼 굳은 회반죽이다. 지금 이걸 쪼아 냈다가는 천장이 또 내려앉는다. 갓 바른 시절이라면 이야기가 다르겠지만.');
        else if (state.vaultOpenP1) msg('금고가 열린 채 텅 비어 있다. 도굴꾼들이 먼저 본 것이다. 과거에서 금고문을 닫아 두면 시간선이 달라질 것이다.');
        else if (state.scarabTaken) msg('빈 금고다. 스카라베는 이미 내 손안에 있다.');
        else if (state.pin.type === Pin.RETRIEVED) {
          audio.doorUnlock();
          state.scarabTaken = true;
          applyDerivation();
          msg('핀이 홈에 꼭 맞는다. 금고문이 열리고, 삭아 가루가 된 밀랍 위에서 스카라베가 손안으로 굴러떨어진다.', 5);
          c.onScarab();
        } else msg('청동 로제트와 핀 구멍이다. 홈에 맞는 핀이 있어야 한다. 이 홈이 드러나 있다는 것은, 과거의 내가 이미 다녀갔다는 뜻이다.');
        break;
      case 'presentHearth':
        msg('들춰진 화덕돌이다. 도굴꾼들이 먼저 뒤졌다. 여기에 무언가를 두는 것은 그들 손에 쥐여 주는 것이나 다름없다.');
        break;
      case 'presentBrick':
        if (state.pin.type === Pin.BRICK) {
          audio.brickScrape();
          setPin({ type: Pin.RETRIEVED });
          c.hud.refreshInventory();
          msg('벽돌 뒤에서 청동 핀이 나왔다. 갓 벼려 낸 것처럼 차갑다.');
          break;
        }
        if (state.pin.type === Pin.RETRIEVED && !state.scarabTaken) {
          audio.brickScrape();
          setPin({ type: Pin.BRICK });
          c.hud.refreshInventory();
          msg('핀을 제자리에 돌려놓았다. 끊겼던 시간선이 다시 이어진다.');
          break;
        }
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
    // 손에 든 것(숫자 키로 고른 것)을 내려놓는다 — G를 반복하면 차례로 빈다.
    const hand = lastCarried();
    if (c.possession.mode !== 'AVATAR') {
      if (state.key1.type === Key1.RETRIEVED || state.pin.type === Pin.RETRIEVED) {
        c.hud.msg('되찾은 물건은 품에 지니고 다닌다.');
      }
      return;
    }
    if (!hand) { c.hud.msg('빈손이다.'); return; }
    const p = c.player;
    const cone = c.possession.activeCone();
    let x = p.pos.x - Math.sin(p.yaw) * 0.4;
    let z = p.pos.z - Math.cos(p.yaw) * 0.4;
    if (!cone.contains({ x, y: 0, z }) || !c.walkableEra(c.possession.era)(x, z)) {
      x = p.pos.x; z = p.pos.z;
    }
    if (hand === 'key1') { setKey1({ type: Key1.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('열쇠를 바닥에 내려놓았다.'); }
    else if (hand === 'jewels') { setJewelsP2({ type: JewelP2.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('가슴장식을 내려놓았다.'); }
    else if (hand === 'chisel') {
      setChisel({ type: c.possession.era === 'P2' ? Chisel.P2FLOOR : Chisel.P1FLOOR, x, z });
      c.hud.carry(null); c.hud.msg('끌을 바닥에 내려놓았다.');
    } else if (hand === 'pin') { setPin({ type: Pin.P1FLOOR, x, z }); c.hud.carry(null); c.hud.msg('핀을 바닥에 내려놓았다.'); }
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
    // 과거 씬의 역거울은 같은 물건이다 — 자세를 함께 돌린다
    if (c.backPortals) c.backPortals[which].setPose(portal.railT, portal.yawDeg);
  }
}
