// pyramid/interact.js — 문제 1의 상호작용.

import * as THREE from 'three';
import * as audio from '../audio.js';
import {
  state, carriedAll, lastCarried, selectHand, ITEM_LABEL,
  key1SealedP2, Key1, JewelP2, Chisel, Pin, Brick,
  setKey1, setJewelsP2, setChisel, sealChiselP2, setPin, setBrickP1, applyDerivation,
  dropPresent, takePresent,
} from './causal.js';

// 집어 드는 대상 — 손에 무엇을 들고 있든 프롬프트는 「획득」으로 남는다.
// 그 밖의 구조물은 물건을 든 순간 전부 「사용하기」가 된다 (어떤 물건이 맞는지는
// 알려 주지 않는다 — 눌러 보고 알아내는 것이 이 게임의 몫이다).
const PICKUPS = new Set([
  'p1Key', 'p1Pin', 'p1Chisel', 'p1BrickLoose', 'p2Jewels', 'p2Chisel',
  'presentScarabLoose', 'presentVaultScarab',
  'presentKeyLoose', 'presentPinLoose', 'presentBrickLoose', 'presentPectoralLoose',
]);
const MIRRORS = new Set(['mirrorA', 'mirrorB', 'backMirrorA', 'backMirrorB']);
// 현재 시대에 내려놓은 물건 ↔ 아이템 id
const LOOSE_ID = Object.freeze({
  presentKeyLoose: 'key1', presentPinLoose: 'pin',
  presentBrickLoose: 'brick', presentPectoralLoose: 'jewels',
  presentScarabLoose: 'scarab',
});
// 방 1 봉인 석판 — 과거의 온전한 문장과 현재의 부스러진 판독
const SLAB_FULL = '과거를 비추는 저주받은 거울을 석실에 같이 매장한다.';
const SLAB_BROKEN = '과거...저주받은...거울..매장..';
import { muralData, GLYPH_NAMES } from './mural.js';

// 받침 유무에 맞는 조사 — '열쇠는 / 핀은' 식으로 자연스럽게 붙인다
function josa(word, pair) {
  const c = word.charCodeAt(word.length - 1);
  const tail = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  const [a, b] = { 은는: ['은', '는'], 을를: ['을', '를'], 이가: ['이', '가'] }[pair];
  return word + (tail ? a : b);
}
// [이름]은 — 대괄호 뒤에 붙는 조사도 이름의 받침을 따른다.
function tagged(word, pair) {
  return `[${word}]${josa(word, pair).slice(word.length)}`;
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

  // 잘못 든 물건으로 시도했을 때의 안내. 어느 자리에서든 문구는 하나다 —
  // 무엇이 필요한지는 절대 알려주지 않는다 (그게 곧 정답을 흘리는 일이다).
  wrongItem(handId) {
    return `${tagged(ITEM_LABEL[handId], '은는')} 사용할 수 없습니다.`;
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
        ? `벽돌이 빠졌다. 구멍 안에 넣어 둔 ${josa(inside.join('·'), '이가')} 보인다.`
        : '벽돌이 빠졌다. 뒤에 작은 구멍이 있다 — 무언가를 넣고 벽돌로 닫을 수 있다.', 4);
      return;
    }
    // 현재: 벽돌만 품에 들어온다. 안의 것은 구멍 속에 보이고, E로 따로 집는다.
    // (P1에서 벽돌을 닫아 두었을 때만 살아남아 있다.)
    state.presentBrickOut = true;
    const sealed = state.brickP1.type === Brick.WALL;
    applyDerivation();
    c.hud.refreshInventory();
    const inside = [];
    if (sealed && state.key1.type === Key1.BRICK) inside.push(ITEM_LABEL.key1);
    if (sealed && state.pin.type === Pin.BRICK) inside.push(ITEM_LABEL.pin);
    if (inside.length) {
      c.hud.msg(`벽돌이 빠졌다. 구멍 안에 ${josa(inside.join('·'), '이가')} 보인다.`, 4);
    } else if (state.key1.type === Key1.BRICK || state.pin.type === Pin.BRICK) {
      c.hud.msg('벽돌이 헐겁게 빠진다 — 누가 먼저 뒤진 자리다. 구멍은 텅 비어 있다.', 5);
    } else {
      c.hud.msg('벽돌을 빼냈다. 구멍은 비어 있다.');
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

  // 표시 규칙: 뽑기 대상 > (물건을 들었으면) 사용하기 > 대상별 기본 문구.
  // 할 일이 없는 상태(연 문·탈출 뒤)는 기본 문구가 비어 있고, 그때는 조용히 둔다.
  promptFor(id) {
    if (this.isPullTarget(id)) return '[E 길게 누르기] 벽돌 뽑기';
    const base = this.basePrompt(id);
    if (!base) return '';
    if (lastCarried() && !PICKUPS.has(id) && !MIRRORS.has(id)) return '[E] 사용하기';
    return base;
  }

  basePrompt(id) {
    const hand = lastCarried();   // 손에 든 것 — 상호작용은 이것으로 판정한다
    const kt = state.key1.type;
    switch (id) {
      case 'mirrorA': case 'mirrorB': return '[E] 조사 · [휠] 거울 회전 · [F] 건너기';
      case 'backMirrorA': case 'backMirrorB': return '[E] 조사 · [F] 복귀';
      // ── P1 (과거 1) ──
      case 'p1Key': return '[E] 황금 열쇠 획득';
      case 'p1Pedestal': return '[E] 조사';
      case 'p1Brick':
        if (kt === Key1.BRICK || state.pin.type === Pin.BRICK) return '[E] 꺼내기';
        return '[E] 조사';
      case 'p1BrickLoose': return '[E] 벽돌 획득';
      case 'p1SealedDoor': return '[E] 조사';
      case 'p1Stamps': case 'p1Urn': return '[E] 조사';
      case 'p1Slab': case 'presentSlab': return '[E] 조사';
      case 'p1Hearth':
        if (state.chisel.type === Chisel.HEARTH || state.pin.type === Pin.HEARTH) return '[E] 꺼내기';
        return '[E] 조사';
      case 'p1Niche':
        if (state.plasterOpen && state.vaultOpenP1) return '[E] 금고문 닫기';
        return '[E] 조사';
      case 'p1Pin': return '[E] 청동 핀 획득';
      case 'p1Chisel': return '[E] 청동 끌 획득';
      case 'p2Chisel': return '[E] 청동 끌 획득';
      case 'p2Hearth':
        if (state.chisel.type === Chisel.HEARTH) return '[E] 꺼내기';
        return '[E] 조사';
      // ── P2 (과거 2) ──
      case 'p2Jewels': return '[E] 가슴장식 획득';
      case 'p2Stele': return '[E] 비석 읽기';
      case 'p2Urn': return '[E] 조사';
      // ── PRESENT ──
      case 'presentDoor':
        if (state.doorOpen) return '';
        return kt === Key1.RETRIEVED ? '[E] 열쇠로 잠금 해제' : '[E] 조사';
      case 'presentPile': return '[E] 조사';
      case 'presentNiche':
        if (state.plasterOpen && !state.scarabTaken && !state.vaultOpenP1
          && !state.vaultOpenNow && state.pin.type === Pin.RETRIEVED) return '[E] 핀 꽂아 열기';
        return '[E] 조사';
      case 'presentVaultScarab': return '[E] 황금 스카라베 회수';
      case 'presentHearth': return '[E] 조사';
      case 'presentBrick': {
        const sealed = state.brickP1.type === Brick.WALL;
        if (sealed && kt === Key1.BRICK) return '[E] 열쇠 획득';
        if (sealed && state.pin.type === Pin.BRICK) return '[E] 핀 획득';
        return '[E] 조사';
      }
      case 'presentUrnA': case 'presentUrnB': return '[E] 조사';
      case 'presentRobber': return '[E] 유해 조사';
      case 'presentScarabLoose': return '[E] 스카라베 회수';
      case 'presentKeyLoose': return '[E] 황금 열쇠 획득';
      case 'presentPinLoose': return '[E] 청동 핀 획득';
      case 'presentBrickLoose': return '[E] 벽돌 획득';
      case 'presentPectoralLoose': return '[E] 가슴장식 획득';
      case 'mural': return '[E] 벽화 조사';
      case 'p2Mural': return '[E] 벽화 조사';
      case 'falseDoor':
        return state.escaped ? '' : '[E] 조사';
      case 'dial0': case 'dial1': case 'dial2':
        return state.escaped ? '' : '[E] 다이얼 회전';
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
      // ═══ 거울 ═══
      case 'mirrorA': case 'mirrorB': case 'backMirrorA': case 'backMirrorB':
        msg('신비한 기운이 느껴지는 거울이다.');
        break;
      // ═══ P1 ═══
      case 'p1Key':
        if (kt === Key1.PEDESTAL || kt === Key1.FLOOR
          || (kt === Key1.BRICK && state.brickP1.type !== Brick.WALL)) {
          setKey1({ type: Key1.CARRIED });
          c.hud.carry('황금 열쇠');
        }
        break;
      case 'p1Pedestal':
        msg('문지기의 좌대다. 열쇠가 올려져 있으나 바로 위 천장에 거대한 균열이 가 있다.');
        break;
      case 'p1Brick': {
        if (state.brickP1.type === Brick.WALL) break;   // 끼워진 벽돌은 E 길게(잡아당기기)가 처리
        // 열린 공동: 손에 든 것을 넣거나, 벽돌로 닫거나, 안의 것을 꺼낸다
        if (hand === 'pin') {
          audio.brickScrape();
          setPin({ type: Pin.BRICK });
          c.hud.carry(null);
          msg('청동 핀을 벽 속 구멍에 넣었다.');
          break;
        }
        if (hand === 'key1') {
          audio.brickScrape();
          setKey1({ type: Key1.BRICK });
          c.hud.carry(null);
          msg('황금 열쇠를 벽 속 구멍에 넣었다.');
          break;
        }
        if (hand === 'brick') {
          audio.brickScrape();
          setBrickP1({ type: Brick.WALL });
          c.hud.carry(null);
          msg('벽돌을 끼워 구멍을 봉했다.');
          break;
        }
        if (state.pin.type === Pin.BRICK) {
          audio.brickScrape();
          setPin({ type: Pin.CARRIED });
          c.hud.carry('청동 핀');
          msg('구멍 속에서 청동 핀을 꺼냈다.');
        } else if (kt === Key1.BRICK) {
          audio.brickScrape();
          setKey1({ type: Key1.CARRIED });
          c.hud.carry('황금 열쇠');
          msg('구멍 속에서 황금 열쇠를 꺼냈다.');
        } else if (hand) msg(this.wrongItem(hand));
        else msg('벽 속의 작은 구멍이다. 물건을 넣고 벽돌로 닫을 수 있다.');
        break;
      }
      case 'p1BrickLoose':
        setBrickP1({ type: Brick.CARRIED });
        c.hud.carry('벽돌');
        msg('벽돌을 획득했다.');
        break;
      case 'p1SealedDoor':
        if (hand === 'chisel' && !state.doorPlasterOff) {
          audio.plasterCrack();
          state.doorPlasterOff = true;
          applyDerivation();
          msg('회반죽을 뜯어내자 자물쇠가 드러났다. 하지만 열쇠의 행방은 이미 결정되어 있다.', 5);
        } else if (state.doorPlasterOff) msg('열쇠 구멍이 드러나 있지만, 열쇠는 이미 이 시대에 없다.');
        else if (hand) msg(this.wrongItem(hand));
        else msg('문 전체가 두꺼운 회반죽으로 봉인되어 있다. 열쇠 구멍까지 덮여 있어 이 시대에서는 열 수 없다.');
        break;
      case 'p1Stamps':
        msg('회반죽에 찍힌 인장들이다. 봉인이 완료된 시대라는 뜻이다.');
        break;
      case 'p1Slab': msg(SLAB_FULL, 7); break;
      case 'presentSlab': msg(SLAB_BROKEN, 6); break;
      case 'p1Urn':
        msg('온전한 상태의 봉헌 단지다.');
        break;
      case 'p1Hearth': {
        if (hand === 'chisel') { audio.brickScrape(); setChisel({ type: Chisel.HEARTH }); c.hud.carry(null); msg('화덕돌 밑에 끌을 밀어 넣었다.'); }
        else if (hand === 'pin') { audio.brickScrape(); setPin({ type: Pin.HEARTH }); c.hud.carry(null); msg('화덕돌 밑에 핀을 숨겼다. 도굴꾼들 눈에 띄지 않기를 바랄 뿐이다.'); }
        else if (state.chisel.type === Chisel.HEARTH) { sealChiselP2(); setChisel({ type: Chisel.CARRIED }); c.hud.carry('청동 끌'); msg('더 먼 과거에서 남겨진 청동 끌을 꺼냈다.'); }
        else if (state.pin.type === Pin.HEARTH) { setPin({ type: Pin.CARRIED }); c.hud.carry('청동 핀'); msg('화덕 밑에서 청동 핀을 꺼냈다.'); }
        else if (hand) msg(this.wrongItem(hand));
        else msg('화덕돌 밑에 작은 빈 공간이 있다.');
        break;
      }
      case 'p1Niche':
        if (!state.plasterOpen) {
          if (hand === 'chisel') {
            audio.plasterCrack();
            state.plasterOpen = true;
            applyDerivation();
            msg('굳은 회반죽이 뜯겨 나가며 청동 로제트와 핀 구멍, 청동 핀이 드러났다.', 5);
          } else if (hand) msg(this.wrongItem(hand));
          else msg('회반죽으로 봉해진 벽감이다. 맨손으로는 뜯어낼 수 없다.');
        } else if (hand === 'pin' && !state.vaultOpenP1) {
          audio.doorUnlock();
          state.vaultOpenP1 = true;
          applyDerivation();
          msg('핀을 꽂자 금고문이 열리며 황금 스카라베가 드러났다. 문을 열어둔 채 떠나면 도굴꾼들에게 털리고 만다.', 5);
        } else if (state.vaultOpenP1) {
          // 닫기는 맨손으로 된다 — 여는 것만 핀이 필요하다 (되돌리기 안전장치)
          audio.doorUnlock();
          state.vaultOpenP1 = false;
          applyDerivation();
          msg('금고문을 밀어 닫았다. 문이 다시 빈틈없이 봉해졌다.', 4);
        } else if (hand) msg(this.wrongItem(hand));
        else msg('청동 로제트 장식이다. 핀 구멍이 비어 있다.');
        break;
      case 'p1Pin':
        setPin({ type: Pin.CARRIED });
        c.hud.carry('청동 핀');
        msg('청동 핀을 획득했다.');
        break;
      case 'p1Chisel':
        setChisel({ type: Chisel.CARRIED });
        c.hud.carry('청동 끌');
        msg('청동 끌을 획득했다.');
        break;

      // ═══ P2 ═══
      case 'p2Jewels':
        if (key1SealedP2()) { /* 무관 — 보석은 열쇠와 다른 세계선 */ }
        setJewelsP2({ type: JewelP2.CARRIED });
        c.hud.carry('황금 가슴장식');
        msg('황금 가슴장식을 획득했다.');
        break;
      case 'p2Chisel':
        if (state.chisel.type === Chisel.P2SPOT || state.chisel.type === Chisel.P2FLOOR) {
          if (state.chiselSealedP2) { msg('이미 과거에서 지나간 일이다.'); break; }
          setChisel({ type: Chisel.CARRIED });
          c.hud.carry('청동 끌');
          msg('청동 끌을 획득했다.');
        }
        break;
      case 'p2Hearth':
        if (hand === 'chisel') {
          audio.brickScrape();
          setChisel({ type: Chisel.HEARTH });
          c.hud.carry(null);
          msg('화덕돌 밑에 끌을 숨겼다. 사제들은 화덕 밑까지 뒤지지 않을 것이다.');
        } else if (state.chisel.type === Chisel.HEARTH && !state.chiselSealedP2) {
          setChisel({ type: Chisel.CARRIED });
          c.hud.carry('청동 끌');
          msg('화덕 밑에서 청동 끌을 꺼냈다.');
        } else if (state.chisel.type === Chisel.HEARTH) msg('이미 과거에서 지나간 일이다.');
        else if (hand) msg(this.wrongItem(hand));
        else msg('화덕돌 밑에 작은 빈 공간이 있다.');
        break;
      case 'p2Stele':
        msg('비석에 경문이 새겨져 있다. 「흐트러진 것은 제자리로. 상한 곳은 회반죽으로. 우리의 보물은 우리의 자리로.」', 7);
        break;
      case 'p2Urn':
        msg('사제들의 정성이 남아있는 봉헌 단지다.');
        break;

      // ═══ PRESENT ═══
      case 'presentDoor':
        if (state.doorOpen) break;
        if (kt === Key1.RETRIEVED) {
          state.doorOpen = true;
          audio.doorUnlock();
          applyDerivation();
          c.hud.refreshInventory();
          msg('열쇠를 꽂자 둔중한 돌문이 열리기 시작한다.', 4);
          c.onDoorOpen();
        } else msg('돌문은 잠겨 있다. 봉인 회반죽은 삭아 떨어졌고 열쇠 구멍만 드러나 있다.');
        break;
      case 'presentPile':
        msg(kt === Key1.PEDESTAL
          ? '천장이 무너지며 쏟아진 바위 더미다. 틈새에서 무언가 반짝이지만 꺼낼 수 없다.'
          : '천장이 무너지며 쏟아진 바위 더미다. 틈새는 비어 있다.');
        break;
      case 'presentNiche':
        if (!state.plasterOpen) msg('수천 년 동안 돌처럼 굳어버린 회반죽이다. 지금 쪼아냈다간 천장이 무너진다. 회반죽을 갓 바른 과거의 시대로 돌아가야 한다.');
        else if (state.vaultOpenP1) msg('금고가 열린 채 비어 있다. 도굴꾼들이 털어간 후다. 과거로 돌아가 금고를 닫아야 한다.');
        else if (state.scarabTaken) msg('텅 빈 금고다. 봉헌물은 이미 회수했다.');
        else if (state.vaultOpenNow) msg('금고 안쪽 밀랍 받침 위에 황금 스카라베와 가슴장식이 놓여 있다.');
        else if (state.pin.type === Pin.RETRIEVED) {
          audio.doorUnlock();
          state.vaultOpenNow = true;
          applyDerivation();
          msg('핀을 꽂자 청동 금고문이 삐걱이며 열린다. 안쪽 밀랍 받침 위에 황금 스카라베가 놓여 있다.', 5);
        } else msg('청동 로제트 장식이다. 과거의 내가 이미 회반죽을 뜯어낸 흔적이 있다.');
        break;
      case 'presentVaultScarab':
        if (state.scarabTaken) break;
        state.scarabTaken = true;
        audio.pickup();
        applyDerivation();
        c.hud.refreshInventory();
        msg('밀랍 받침에서 황금 스카라베를 집어 들었다. 그 곁에 놓여 있던 신의 가슴장식도 함께 챙겼다.', 5);
        c.onScarab();
        break;
      case 'presentHearth':
        msg('도굴꾼들이 들춰낸 화덕돌이다. 이미 뒤져간 자리에 물건을 숨길 수는 없다.');
        break;
      case 'presentRobber':
        msg('먼저 들어왔던 도굴꾼의 유해다. 문은 열리지 않았고 위로 돌아가지도 못한 채 갇혀 죽은 듯하다.', 6);
        break;
      case 'presentScarabLoose': case 'presentKeyLoose': case 'presentPinLoose':
      case 'presentBrickLoose': case 'presentPectoralLoose': {
        const item = LOOSE_ID[id];
        takePresent(item);
        audio.pickup();
        c.hud.carry();
        msg(`${josa(ITEM_LABEL[item], '을를')} 다시 챙겼다.`);
        break;
      }
      case 'presentBrick': {
        if (!state.presentBrickOut) break;   // 끼워진 벽돌은 E 길게(잡아당기기)가 처리
        // 구멍 안에 살아남은 것이 있으면 먼저 집는다 — 벽돌 되끼우기는 그다음
        const sealed = state.brickP1.type === Brick.WALL;
        if (sealed && kt === Key1.BRICK) {
          setKey1({ type: Key1.RETRIEVED });
          audio.pickup();
          c.hud.carry();
          msg('벽 속 구멍에 보관되어 있던 열쇠를 획득했다.');
          break;
        }
        if (sealed && state.pin.type === Pin.BRICK) {
          setPin({ type: Pin.RETRIEVED });
          audio.pickup();
          c.hud.carry();
          msg('벽 속 구멍에 보관되어 있던 핀을 획득했다.');
          break;
        }
        if (hand === 'brick') {
          audio.brickScrape();
          state.presentBrickOut = false;
          state.presentDrop.brick = null;
          applyDerivation();
          c.hud.carry();
          msg('벽돌을 끼워 구멍을 봉했다.');
          break;
        }
        if (hand) msg(this.wrongItem(hand));
        else msg('벽돌이 빠진 구멍이다. 벽돌로 다시 막을 수 있다.');
        break;
      }
      case 'mural': {
        const md = muralData();
        const names = md.code.map((g) => `「${GLYPH_NAMES[g]}」`).join(' ');
        if (state.collarSeated) {
          msg(`목걸이의 구슬 세 개가 가리키는 상형문자 — 차례대로 ${names}.`);
        } else if (hand === 'jewels') {
          state.collarSeated = true;
          state.presentDrop.jewels = null;
          applyDerivation();
          c.hud.carry();
          msg(`목걸이가 홈에 딱 들어맞자, 구슬 세 개가 상형문자 위에서 빛을 발한다 — 차례대로 ${names}.`, 7);
        } else if (hand) {
          msg(this.wrongItem(hand));
        } else {
          msg('자칼 신의 벽화다. 상형문자 사이로 목 언저리에 구슬 세 개가 들어갈 홈이 패여 있다.');
        }
        break;
      }
      case 'p2Mural':
        msg('갓 그려진 벽화다. 안료가 또렷하며, 목 언저리의 홈은 비어 있다.');
        break;
      case 'falseDoor':
        if (state.escaped) break;
        if (hand === 'scarab' && !state.scarabSeated) {
          audio.brickScrape();
          state.scarabSeated = true;
          state.scarabAt = null;
          applyDerivation();
          c.hud.carry();
          msg('황금 스카라베가 소켓에 맞물리자 봉인이 풀리고 다이얼이 작동한다.');
          checkFalseDoor(c);
        } else if (hand && !state.scarabSeated) {
          msg(this.wrongItem(hand));
        } else if (state.scarabSeated) {
          msg('세 글자로 된 신의 이름을 아는 자만 통과할 수 있다. 다이얼을 맞춰라.');
        } else {
          msg('가짜 문이다. 중앙에 스카라베 홈과 아래에 3개의 다이얼이 있다.');
        }
        break;
      case 'dial0': case 'dial1': case 'dial2': {
        if (state.escaped) break;
        const di = Number(id.slice(4));
        state.dials[di] = (state.dials[di] + 1) % GLYPH_NAMES.length;
        audio.brickScrape();
        applyDerivation();
        checkFalseDoor(c);
        break;
      }
      case 'presentUrnA': case 'presentUrnB':
        msg('산산조각 난 단지다. 도굴꾼들이 휩쓸고 간 자국이다.');
        break;
    }
  }

  // 손에 든 것(숫자 키로 고른 것)을 발 앞에 내려놓는다 — 시대와 무관하게 같은 규칙이다.
  // 과거에서는 물건이 그 시대의 세계선에 남고(setter), 현재에서는 바닥 자리에 놓인다.
  onG() {
    const c = this.ctx;
    const hand = lastCarried();
    if (!hand) { c.hud.msg('손에 든 물건이 없다.'); return; }
    const avatar = c.possession.mode === 'AVATAR';
    const era = avatar ? c.possession.era : 'PRESENT';
    const p = c.player;
    const cone = avatar ? c.possession.activeCone() : null;
    let x = p.pos.x - Math.sin(p.yaw) * 0.4;
    let z = p.pos.z - Math.cos(p.yaw) * 0.4;
    if ((cone && !cone.contains({ x, y: 0, z })) || !c.walkableEra(era)(x, z)) {
      x = p.pos.x; z = p.pos.z;
    }
    audio.putdown();
    if (!avatar) dropPresent(hand, x, z);
    else if (hand === 'key1') setKey1({ type: Key1.FLOOR, x, z });
    else if (hand === 'jewels') setJewelsP2({ type: JewelP2.FLOOR, x, z });
    else if (hand === 'chisel') setChisel({ type: era === 'P2' ? Chisel.P2FLOOR : Chisel.P1FLOOR, x, z });
    else if (hand === 'pin') setPin({ type: Pin.P1FLOOR, x, z });
    else if (hand === 'brick') setBrickP1({ type: Brick.FLOOR, x, z });
    c.hud.carry();
    c.hud.msg(`${josa(ITEM_LABEL[hand], '을를')} 바닥에 내려놓았다.`);
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

// 가짜 문 판정: 풍뎅이가 앉아 있고 세 다이얼이 이름과 일치하면 열린다.
function checkFalseDoor(c) {
  if (state.escaped || !state.scarabSeated) return;
  const code = muralData().code;
  if (state.dials.every((d, i) => d === code[i])) {
    state.escaped = true;
    applyDerivation();
    c.hud.msg('신의 이름이 일치했다! 석판이 벽 속으로 미끄러지며 어둠 너머에서 시원한 바람이 불어온다.', 5);
    c.onEscape();
  }
}
