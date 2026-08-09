// pyramid/interact.js — 문제 1의 상호작용.

import * as THREE from 'three';
import * as audio from '../audio.js';
import {
  state, carriedAll, lastCarried, selectHand, ITEM_LABEL,
  key1SealedP2, Key1, JewelP2, Chisel, Pin, Brick,
  setKey1, setJewelsP2, setChisel, sealChiselP2, setPin, setBrickP1, applyDerivation,
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
const PULL_TIME = 1.15;      // 벽돌을 잡아당겨 뽑는 데 걸리는 시간(초, E 길게)
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
    this.pull = null;                    // E 길게 눌러 벽돌을 당기는 중 { id, t, mesh, base }
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

  // ── 벽돌 잡아당기기 (E 길게) ────────────────────────────────
  // 벽에 끼워진 벽돌은 짧게 눌러서는 꿈쩍도 하지 않는다 — E를 누르고 있는 동안
  // 벽돌이 부들부들 떨리며 조금씩 딸려 나오고, 다 뽑히면 아이템 슬롯에 들어간다.
  isPullTarget(id) {
    if (id === 'p1Brick') return state.brickP1.type === Brick.WALL;
    if (id === 'presentBrick') return !state.presentBrickOut;
    return false;
  }

  startPull(id) {
    const r = this.ctx.refs;
    const mesh = id === 'p1Brick' ? r.p1.brick : r.present.brick;
    this.pull = { id, t: 0, scr: 0, mesh, base: mesh.position.clone() };
  }

  cancelPull() {
    if (!this.pull) return;
    this.pull.mesh.position.copy(this.pull.base);   // 벽돌이 도로 주저앉는다
    this.pull.mesh.rotation.y = 0;
    this.pull = null;
    this.ctx.hud.pull(null);
  }

  finishPull() {
    const c = this.ctx;
    const { id, mesh, base } = this.pull;
    mesh.position.copy(base);
    mesh.rotation.y = 0;
    this.pull = null;
    c.hud.pull(null);
    audio.brickScrape();
    if (id === 'p1Brick') {
      setBrickP1({ type: Brick.CARRIED });
      c.hud.carry();
      const inside = [];
      if (state.key1.type === Key1.BRICK) inside.push(ITEM_LABEL.key1);
      if (state.pin.type === Pin.BRICK) inside.push(ITEM_LABEL.pin);
      c.hud.msg(inside.length
        ? `벽돌이 통째로 빠졌다. 공동 안쪽에 넣어 둔 ${josa(inside.join('·'), '이가')} 보인다.`
        : '벽돌이 통째로 빠졌다. 뒤에는 작은 공동이 숨어 있다 — 무언가를 넣고 벽돌로 닫을 수 있다.', 5);
      return;
    }
    // 현재: 뽑는 순간이 곧 개봉이다. 안의 것은 P1에서 벽돌을 닫아 두었을 때만 살아남았다.
    state.presentBrickOut = true;
    const sealed = state.brickP1.type === Brick.WALL;
    const got = [];
    if (state.key1.type === Key1.BRICK && sealed) { setKey1({ type: Key1.RETRIEVED }); got.push(ITEM_LABEL.key1); }
    if (state.pin.type === Pin.BRICK && sealed) { setPin({ type: Pin.RETRIEVED }); got.push(ITEM_LABEL.pin); }
    applyDerivation();
    c.hud.refreshInventory();
    if (got.length) {
      audio.pickup();
      c.hud.msg(`벽돌 뒤에서 ${josa(got.join('·'), '이가')} 나왔다. 수천 년을 벽 속에서 기다려 온 것이다.`, 5);
    } else if (state.key1.type === Key1.BRICK || state.pin.type === Pin.BRICK) {
      c.hud.msg('벽돌이 이상하리만치 쉽게 빠진다 — 이미 누가 들쑤신 자리다. 공동은 텅 비어 있다. 벽돌을 닫아 두지 않은 공동은 도굴꾼들의 몫이 된 것이다.', 6);
    } else {
      c.hud.msg('벽돌을 빼내 챙겼다. 뒤는 텅 비어 있다.');
    }
  }

  // 시선 중앙 광선이 거울 「유리면」에 직접 닿아야 한다 (사거리 RANGE).
  // 프레임·받침을 스치거나 옆·뒤에서 누르는 F는 이동으로 치지 않는다.
  lookingAtPortal() {
    const c = this.ctx;
    this.ray.setFromCamera(this._v2.set(0, 0), c.camera);
    const hits = this.ray.intersectObjects([c.portals.A.glass, c.portals.B.glass], false);
    if (!hits.length) return null;
    return hits[0].object === c.portals.A.glass ? 'A' : 'B';
  }

  targets() {
    const c = this.ctx;
    if (c.possession.mode === 'AVATAR') return c.hot[c.possession.era];
    return [...c.hot.PRESENT, c.portals.A.group, c.portals.B.group];
  }

  update(dt = 1 / 60) {
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
        if (!o?.userData.hot) continue;
        // 조상 어디서든 숨겨졌으면 조준 불가 (그룹만 숨기는 소품이 있다)
        let vis = true;
        for (let a = h.object; a; a = a.parent) if (a.visible === false) { vis = false; break; }
        if (!vis) continue;
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
    // 잡아당기는 중 — 조준이 벗어나거나 E를 놓으면 벽돌이 도로 주저앉는다
    if (this.pull) {
      if (!best || best.id !== this.pull.id) this.cancelPull();
      else {
        this.pull.t += dt;
        const p = Math.min(1, this.pull.t / PULL_TIME);
        const w = performance.now();
        const m = this.pull.mesh;
        // 힘줄수록 크게 떨리며 방 안쪽(-z)으로 딸려 나온다
        m.position.copy(this.pull.base);
        m.position.z += -0.09 * p - 0.014 * p * Math.abs(Math.sin(w * 0.05));
        m.position.x += 0.007 * p * Math.sin(w * 0.033);
        m.position.y += 0.004 * p * Math.sin(w * 0.041);
        m.rotation.y = 0.05 * p * Math.sin(w * 0.026);
        this.pull.scr -= dt;
        if (this.pull.scr <= 0) { this.pull.scr = 0.3; audio.brickScrape(); }
        c.hud.pull(p);
        if (p >= 1) this.finishPull();
        else { c.hud.prompt('힘껏 잡아당긴다…'); return; }
      }
    }
    c.hud.prompt(best ? this.promptFor(best.id) : '');
  }

  promptFor(id) {
    const has = (x) => carriedAll().includes(x);
    const hand = lastCarried();   // 손에 든 것 — 상호작용은 이것으로 판정한다
    const pick = (want) => `${ITEM_LABEL[want]} 골라 들기 (숫자 키)`;
    const kt = state.key1.type;
    switch (id) {
      case 'mirrorA': case 'mirrorB': return '휠: 거울 돌리기 · F: 이동';
      case 'backMirrorA': case 'backMirrorB': return '거울 너머는 현재다 · F: 돌아가기';
      // ── P1 (과거 1) ──
      case 'p1Key': return '집어 들기 (E)';
      case 'p1Pedestal': return '살펴보기 (E)';
      case 'p1Brick':
        if (state.brickP1.type === Brick.WALL) return 'E 길게 눌러 벽돌 잡아당기기';
        if (hand === 'key1' || hand === 'pin') return '공동에 넣기 (E)';
        if (hand === 'brick') return '벽돌 도로 끼우기 (E)';
        if (kt === Key1.BRICK || state.pin.type === Pin.BRICK) return '꺼내기 (E)';
        if (has('brick')) return pick('brick');
        return '살펴보기 (E)';
      case 'p1BrickLoose': return '벽돌 집어 들기 (E)';
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
        if (!state.presentBrickOut) return 'E 길게 눌러 벽돌 잡아당기기';
        // 돌려놓기는 시간선이 꼬였을 때(P1 금고 열림)만 드러나는 수리 동사 —
        // 평소의 핀은 열쇠와 똑같이 일방향 회수다.
        if (state.pin.type === Pin.RETRIEVED && !state.scarabTaken && state.vaultOpenP1) return '핀 돌려놓기 (E)';
        return '벽돌 도로 끼우기 (E)';
      case 'presentUrnA': case 'presentUrnB': return '살펴보기 (E)';
      case 'presentRobber': return '살펴보기 (E)';
      case 'presentScarabLoose': return '집어 들기 (E)';
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
        if (kt === Key1.PEDESTAL || kt === Key1.FLOOR
          || (kt === Key1.BRICK && state.brickP1.type !== Brick.WALL)) {
          setKey1({ type: Key1.CARRIED });
          c.hud.carry('황금 열쇠');
        }
        break;
      case 'p1Pedestal':
        msg('문지기의 좌대다. 열쇠를 모셔 두는 자리인데 — 바로 위 천장에 금이 번져 있다.');
        break;
      case 'p1Brick': {
        if (state.brickP1.type === Brick.WALL) break;   // 끼워진 벽돌은 E 길게(잡아당기기)가 처리
        // 열린 공동: 손에 든 것을 넣거나, 벽돌로 닫거나, 안의 것을 꺼낸다
        if (hand === 'pin') {
          audio.brickScrape();
          setPin({ type: Pin.BRICK });
          c.hud.carry(null);
          msg('핀을 공동 안쪽 깊숙이 넣었다. 이제 벽돌로 닫아야 한다 — 열린 채 두면 도굴꾼들의 몫이 된다.', 5);
          break;
        }
        if (hand === 'key1') {
          audio.brickScrape();
          setKey1({ type: Key1.BRICK });
          c.hud.carry(null);
          msg('열쇠를 공동 안쪽 깊숙이 넣었다. 이제 벽돌로 닫아야 한다 — 열린 채 두면 도굴꾼들의 몫이 된다.', 5);
          break;
        }
        if (hand === 'brick') {
          audio.brickScrape();
          setBrickP1({ type: Brick.WALL });
          c.hud.carry(null);
          msg(kt === Key1.BRICK || state.pin.type === Pin.BRICK
            ? '벽돌을 도로 끼워 넣었다. 감쪽같다 — 공동 안의 것은 이제 세월이 지킨다.'
            : '벽돌을 도로 끼워 넣었다. 감쪽같다.');
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
        } else if (hand) msg(this.wrongItem(hand) + ' 공동은 좁다 — 열쇠나 핀 정도만 들어간다.');
        else msg('벽 속의 작은 공동이다. 무언가를 넣어 두려면 넣은 뒤 벽돌로 닫아야 한다.');
        break;
      }
      case 'p1BrickLoose':
        setBrickP1({ type: Brick.CARRIED });
        c.hud.carry('벽돌');
        break;
      case 'p1SealedDoor':
        if (hand === 'chisel' && !state.doorPlasterOff) {
          audio.plasterCrack();
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
            audio.plasterCrack();
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
          audio.pickup();
          applyDerivation();
          msg('핀이 홈에 꼭 맞는다. 금고문이 열리고, 삭아 가루가 된 밀랍 위에서 스카라베가 손안으로 굴러떨어진다.', 5);
          c.onScarab();
        } else msg('청동 로제트와 핀 구멍이다. 홈에 맞는 핀이 있어야 한다. 이 홈이 드러나 있다는 것은, 과거의 내가 이미 다녀갔다는 뜻이다.');
        break;
      case 'presentHearth':
        msg('들춰진 화덕돌이다. 도굴꾼들이 먼저 뒤졌다. 여기에 무언가를 두는 것은 그들 손에 쥐여 주는 것이나 다름없다.');
        break;
      case 'presentRobber':
        msg('도굴꾼의 해골이다. 천장 파공으로 내려왔지만 봉인된 문은 끝내 열리지 않았고, 뚫고 온 구멍으로 되오를 수도 없었다.', 6);
        break;
      case 'presentScarabLoose':
        if (state.scarabAt) {
          state.scarabAt = null;
          audio.pickup();
          applyDerivation();
          c.hud.refreshInventory();
          msg('스카라베를 다시 품에 넣었다.');
        }
        break;
      case 'presentBrick':
        if (!state.presentBrickOut) break;   // 끼워진 벽돌은 E 길게(잡아당기기)가 처리
        if (state.pin.type === Pin.RETRIEVED && !state.scarabTaken && state.vaultOpenP1) {
          audio.brickScrape();
          state.presentBrickOut = false;   // 되돌리며 벽돌도 도로 끼운다
          setPin({ type: Pin.BRICK });
          c.hud.refreshInventory();
          msg('핀을 공동에 되돌리고 벽돌을 도로 끼웠다. 끊겼던 시간선이 다시 이어진다.');
          break;
        }
        // 챙겨 둔 벽돌을 도로 끼운다
        audio.brickScrape();
        state.presentBrickOut = false;
        applyDerivation();
        c.hud.refreshInventory();
        msg('벽돌을 도로 끼워 넣었다. 벽은 아무 일 없었다는 듯 시치미를 뗀다.');
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
      // 스카라베는 현재의 바닥에 내려놓을 수 있다 — 빛을 건너려면 놓고 가야 하니까.
      if (state.scarabTaken && !state.scarabAt) {
        const p = c.player;
        let x = p.pos.x - Math.sin(p.yaw) * 0.4;
        let z = p.pos.z - Math.cos(p.yaw) * 0.4;
        if (!c.walkableEra('PRESENT')(x, z)) { x = p.pos.x; z = p.pos.z; }
        state.scarabAt = { x, z };
        audio.putdown();
        applyDerivation();
        c.hud.refreshInventory();
        c.hud.msg('스카라베를 바닥에 내려놓았다.');
      } else if (state.key1.type === Key1.RETRIEVED || state.pin.type === Pin.RETRIEVED) {
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
    audio.putdown();
    if (hand === 'key1') { setKey1({ type: Key1.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('열쇠를 바닥에 내려놓았다.'); }
    else if (hand === 'jewels') { setJewelsP2({ type: JewelP2.FLOOR, x, z }); c.hud.carry(null); c.hud.msg('가슴장식을 내려놓았다.'); }
    else if (hand === 'chisel') {
      setChisel({ type: c.possession.era === 'P2' ? Chisel.P2FLOOR : Chisel.P1FLOOR, x, z });
      c.hud.carry(null); c.hud.msg('끌을 바닥에 내려놓았다.');
    } else if (hand === 'pin') { setPin({ type: Pin.P1FLOOR, x, z }); c.hud.carry(null); c.hud.msg('핀을 바닥에 내려놓았다.'); }
    else if (hand === 'brick') {
      setBrickP1({ type: Brick.FLOOR, x, z });
      c.hud.carry(null);
      c.hud.msg('벽돌을 바닥에 내려놓았다. 벽의 공동은 열린 채다.');
    }
  }

  onKeyE(down) {
    if (down) {
      const id = this.hovered?.id;
      if (id && this.isPullTarget(id)) this.startPull(id);   // 길게 눌러 뽑는 대상
      else this.onE();
    } else this.cancelPull();   // 도중에 놓으면 실패
  }

  onWheel(dy) {
    const c = this.ctx;
    if (c.possession.mode !== 'BODY') return;
    const which = this.lookingAtPortal();
    if (!which) return;
    const portal = c.portals[which];
    const prevYaw = portal.yawDeg;
    portal.setPose(portal.railT, portal.yawDeg - dy);
    if (portal.yawDeg !== prevYaw) audio.mirrorGrind();   // 끝각에 막히면 무음
    c.cones[which].update(portal.pose);
    // 과거 씬의 역거울은 같은 물건이다 — 자세를 함께 돌린다
    if (c.backPortals) c.backPortals[which].setPose(portal.railT, portal.yawDeg);
  }
}
