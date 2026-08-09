// interact.js — 6.8절 v2: 중앙 레이캐스트(2.5m), 프롬프트, E/G, 거울 끌기.
// 분신의 상호작용 대상은 활성 원뿔 안에 있어야 한다(빛의 법).

import * as THREE from 'three';
import * as audio from './audio.js';
import {
  state, carried, KeyLoc, KeyE1, CrankE1, CrankE2, SmallKey, elderKeySealed,
  setKeyLoc, setKeyE1, setCrankE1, setCrankE2, setSmallKey, applyDerivation,
} from './causal.js';

const RANGE = 2.5;

// 화면 정규 좌표(NDC) 기준 조준 보조 오프셋 — 반경 0.04 ≈ 화면 높이의 4%
const AIM_OFFSETS = [
  [0, 0],
  [0.04, 0], [-0.04, 0], [0, 0.04], [0, -0.04],
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
    this.grabbing = false;
    this.inspectRuin = false;
    this._tmp = new THREE.Vector3();
    this._v2 = new THREE.Vector2();
  }

  lookingAtPortal() {
    if (this.hovered?.id === 'mirror') return 'A';
    if (this.hovered?.id === 'mirrorB') return 'B';
    return null;
  }

  targets() {
    const c = this.ctx;
    if (c.possession.mode === 'AVATAR') return c.hot[c.possession.era];
    return [...c.hot.PRESENT, c.portals.A.group, c.portals.B.group, ...c.ruinViewer.group.children];
  }

  // 조준 보조: 중앙 + 주변 8방향의 광선 다발로 판정해 모든 대상의 유효 영역을
  // 넓힌다. 작은 물체(크랭크, 열쇠)는 큰 배경(문짝, 빗장)보다 우선한다 —
  // 후보의 점수 = 맞은 메시의 경계구 반지름, 중앙 광선은 0.5배 보너스.
  // 주변 광선의 작은 물체가 중앙의 큰 물체를 이기려면 반지름이 절반 미만이어야
  // 하므로, 비슷한 크기의 이웃끼리는 여전히 중앙 조준이 이긴다.
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
        if (score < bestScore) { bestScore = score; best = { id: o.userData.hot, mesh: o, point: h.point }; }
        break;      // 광선 하나당 첫 유효 명중만
      }
    }
    this.hovered = best;
    c.hud.prompt(best ? this.promptFor(best.id) : (this.grabbing ? '끌기: 마우스 좌우 · 회전: 휠' : ''));
  }

  promptFor(id) {
    const hold = carried();
    switch (id) {
      // ── 본체 (PRESENT) ──
      case 'mirror':        return 'E 홀드: 끌기 · 휠: 회전 · F: 빙의 · B/1·2·3: 자세 기억/호출';
      case 'mirrorB':       return 'F: 빙의';
      case 'mirrorBCloth':  return '천 걷기 (E)';
      case 'handMirror':    return this.inspectRuin ? '접기 (E)' : '들여다보기 (E)';
      case 'door': case 'bolt':
        if (state.doorOpen) return '';
        if (state.crankE2.type === CrankE2.RETRIEVED && !state.boltMounted) return '크랭크 끼우기 (E)';
        if (state.keyLoc.type === KeyLoc.RETRIEVED && !state.doorUnlocked) return '열쇠 돌리기 (E)';
        return '들여다보기 (E)';
      case 'presentBrick': {
        const has = state.keyLoc.type === KeyLoc.BRICK
          || state.crankE2.type === CrankE2.BRICK || state.smallKey.type === SmallKey.BRICK;
        if (has) return '빼기 (E)';
        if (state.smallKey.type === SmallKey.RETRIEVED) return '돌려놓기 (E)';
        return '들여다보기 (E)';
      }
      case 'presentDrawer': case 'presentBoard': case 'presentHook':
      case 'doorOutline': case 'beam': case 'plant':
      case 'boardNails': case 'mortarChips': case 'pastDoor':
        return '들여다보기 (E)';

      // ── 분신 E2 (PAST) ──
      case 'pastKey':
        if (state.sealed) return '들여다보기 (E)';
        return hold ? '' : '집기 (E)';
      case 'drawer':
        if (!state.drawerUnlockedE2) return hold === 'smallKey' ? '열기 (E)' : '들여다보기 (E)';
        if (hold === 'crank' || hold === 'doorKey') return '넣기 (E)';
        if (!hold && state.crankE2.type === CrankE2.DRAWER) return '꺼내기 (E)';
        if (!hold && state.keyLoc.type === KeyLoc.DRAWER) return '꺼내기 (E)';
        return '들여다보기 (E)';
      case 'board':
        if (hold) return '넣기 (E)';
        if (state.keyLoc.type === KeyLoc.BOARD || state.smallKey.type === SmallKey.BOARD
          || state.crankE2.type === CrankE2.BOARD) return '집기 (E)';
        return '들여다보기 (E)';
      case 'brick':
        if (state.sealed && !hold
          && state.crankE2.type !== CrankE2.BRICK && state.smallKey.type !== SmallKey.BRICK)
          return '들여다보기 (E)';
        if (hold) return '넣기 (E)';
        if (state.keyLoc.type === KeyLoc.BRICK || state.crankE2.type === CrankE2.BRICK
          || state.smallKey.type === SmallKey.BRICK) return '꺼내기 (E)';
        return '들여다보기 (E)';
      case 'pastCrank':     return hold ? '' : '집기 (E)';
      case 'pastSmallKey':  return hold ? '' : '집기 (E)';

      // ── 분신 E1 (ELDER) ──
      case 'elderCrank':    return hold ? '' : '뽑기 (E)';
      case 'elderCrankLoose': return hold ? '' : '집기 (E)';
      case 'elderDoor':
        return (hold === 'crank' && !state.crankSealedE1) ? '도로 끼우기 (E)' : '들여다보기 (E)';
      case 'elderDrawer':
        if (hold === 'crank' || hold === 'doorKey') return '넣기 (E)';
        if (!hold && state.crankE1.type === CrankE1.DRAWER) return '꺼내기 (E)';
        if (!hold && state.keyE1.type === KeyE1.DRAWER && !elderKeySealed()) return '꺼내기 (E)';
        return '들여다보기 (E)';
      case 'elderBoard':
        if (hold === 'crank' || hold === 'doorKey') return '넣기 (E)';
        if (!hold && state.crankE1.type === CrankE1.BOARD) return '꺼내기 (E)';
        if (!hold && state.keyE1.type === KeyE1.BOARD && !elderKeySealed()) return '꺼내기 (E)';
        return '들여다보기 (E)';
      case 'elderHookKey':
        if (elderKeySealed()) return '들여다보기 (E)';
        return hold ? '' : '집기 (E)';
      case 'elderBrick': case 'elderPoker':
        return '들여다보기 (E)';
      case 'elderNote':
        return '읽기 (E)';
      default: return '';
    }
  }

  onE() {
    const c = this.ctx;
    if (this.inspectRuin) { this.inspectRuin = false; return; }
    if (!this.hovered) return;
    const id = this.hovered.id;
    if (id === 'mirror') return;
    const hold = carried();
    const msg = (s) => c.hud.msg(s);
    const K = KeyLoc;

    switch (id) {
      // ═══ 본체 (PRESENT) ═══
      case 'mirrorBCloth':
        state.clothOff = true;
        c.portals.B.uncover();
        c.revealConeB();
        audio.possessOut();
        msg('천이 흘러내린다. 오래된 거울이 낯선 시간을 비춘다.');
        break;
      case 'handMirror': this.inspectRuin = true; break;
      case 'door': case 'bolt':
        // 두 잠금은 독립이다 — 어느 쪽을 먼저 풀어도 된다.
        if (state.doorOpen) break;
        if (state.crankE2.type === CrankE2.RETRIEVED && !state.boltMounted) {
          state.boltMounted = true;
          audio.brickScrape();
          applyDerivation();
          c.hud.refreshInventory();
          if (state.doorUnlocked) c.openDoor();
          else msg('크랭크가 축에 맞물리고 빗장이 미끄러진다 — 자물쇠가 남았다.');
        } else if (state.keyLoc.type === K.RETRIEVED && !state.doorUnlocked) {
          state.doorUnlocked = true;
          audio.doorUnlock();
          if (state.boltMounted) c.openDoor();
          else msg('자물쇠가 열렸다 — 그러나 빗장이 막고 있다. 손잡이 축이 비어 있다.');
        } else if (!state.doorUnlocked && !state.boltMounted) {
          msg('자물쇠는 잠겼고, 빗장의 사각 축 구멍은 비어 있다. 열 것이 둘이다.');
        } else if (!state.boltMounted) {
          msg('빈 사각 축 구멍 — 크랭크가 있어야 빗장을 돌린다.');
        } else {
          msg('빗장은 풀렸다. 자물쇠가 남아 있다.');
        }
        break;
      case 'presentBrick': {
        if (state.keyLoc.type === K.BRICK) {
          audio.brickScrape();
          setKeyLoc({ type: K.RETRIEVED });
          msg('벽돌 뒤에서 10년 녹슨 열쇠가 나왔다.');
        } else if (state.crankE2.type === CrankE2.BRICK) {
          audio.brickScrape();
          setCrankE2({ type: CrankE2.RETRIEVED });
          msg('놋쇠 크랭크 — 10년 변색됐지만 온전하다.');
        } else if (state.smallKey.type === SmallKey.BRICK) {
          audio.brickScrape();
          setSmallKey({ type: SmallKey.RETRIEVED });
          msg('작은 열쇠 — 이쪽 시대에서는 쓸 곳이 없다.');
        } else if (state.smallKey.type === SmallKey.RETRIEVED) {
          // 돌려놓기: 회수를 되감아 시간선을 복원한다 (소프트락 방지 검증 통과 조건)
          audio.brickScrape();
          setSmallKey({ type: SmallKey.BRICK });
          msg('작은 열쇠를 제자리에 돌려놓았다 — 시간선이 다시 이어진다.');
        } else msg('헐거운 벽돌이다. 지금은 비어 있다.');
        c.hud.refreshInventory();
        break;
      }
      case 'presentDrawer': {
        const seen = ['녹슨 부지깽이'];
        if (state.keyLoc.type === K.DRAWER) seen.push('열쇠');
        if (state.crankE2.type === CrankE2.DRAWER) seen.push('놋쇠 크랭크');
        msg(`틈새로 ${seen.join('과 ')}가 보인다 — 대들보가 서랍을 눌렀다. 꺼낼 수 없다.`);
        break;
      }
      case 'presentBoard':
        msg('공동이 비어 있다 — 10년 사이 누군가 다녀갔다.');
        break;
      case 'presentHook':
        msg('녹 자국만 남아 있다. 10년 전에는 무엇이 걸려 있었을까.');
        break;
      case 'doorOutline':
        msg('옅은 윤곽과 나사 구멍 — 여기 놋쇠 문고리가 있었다. 놋쇠만 골라 사라졌다.');
        break;
      case 'beam':
        msg('대들보는 방 중앙을 가로질러 책상 위로 떨어졌다.');
        break;
      case 'plant':
        msg(c.possession.mode === 'AVATAR'
          ? (c.possession.era === 'ELDER' ? '어린 묘목이다.' : '나무가 다 자랐다. 같은 화분이다.')
          : '고사한 나무. 화분은 그대로다.');
        break;

      // ═══ 분신 E2 (PAST) ═══
      case 'pastKey':
        if (state.sealed) msg('이미 일어난 일이다.');
        else if (!hold && (state.keyLoc.type === K.HOOK || state.keyLoc.type === K.FLOOR)) {
          setKeyLoc({ type: K.CARRIED });
          c.hud.carry('열쇠');
        }
        break;
      case 'pastDoor':
        msg('축 구멍이 비어 있고 문고리도 없다 — 놋쇠였던 것들만 사라졌다.');
        break;
      case 'boardNails':
        msg('새 못 옆에 오래된 못 자국 — 누군가 열었다가 도로 닫았다.');
        break;
      case 'mortarChips':
        msg('아궁이에 회반죽 부스러기 — 벽돌을 성급히 도로 발랐던 흔적이다.');
        break;
      case 'drawer':
        if (!state.drawerUnlockedE2) {
          if (hold === 'smallKey') {
            state.drawerUnlockedE2 = true;
            audio.brickScrape();
            applyDerivation();
            msg('자물쇠가 돌아간다 — 서랍이 열렸다.');
          } else msg('잠겨 있다. 안에서 쇠붙이가 덜걱인다.');
        } else if (hold === 'crank') {
          setCrankE2({ type: CrankE2.DRAWER });
          c.hud.carry(null);
          msg('크랭크를 서랍에 도로 넣었다.');
        } else if (hold === 'doorKey') {
          setKeyLoc({ type: K.DRAWER });
          c.hud.carry(null);
          msg('서랍에 열쇠를 넣었다.');
        } else if (!hold && state.crankE2.type === CrankE2.DRAWER) {
          setCrankE2({ type: CrankE2.CARRIED });
          c.hud.carry('놋쇠 크랭크');
        } else if (!hold && state.keyLoc.type === K.DRAWER) {
          setKeyLoc({ type: K.CARRIED });
          c.hud.carry('열쇠');
        } else {
          msg('녹슨 부지깽이가 들어 있다 — 관리인의 것이던.');
        }
        break;
      case 'board':
        if (hold === 'doorKey') { setKeyLoc({ type: K.BOARD }); c.hud.carry(null); msg('마루장 밑에 열쇠를 숨겼다.'); }
        else if (hold === 'smallKey') { setSmallKey({ type: SmallKey.BOARD }); c.hud.carry(null); msg('여벌 열쇠를 제자리에 돌려놓았다.'); }
        else if (hold === 'crank') { setCrankE2({ type: CrankE2.BOARD }); c.hud.carry(null); msg('마루장 밑에 크랭크를 숨겼다.'); }
        else if (state.keyLoc.type === K.BOARD) { setKeyLoc({ type: K.CARRIED }); c.hud.carry('열쇠'); }
        else if (state.crankE2.type === CrankE2.BOARD) { setCrankE2({ type: CrankE2.CARRIED }); c.hud.carry('놋쇠 크랭크'); }
        else if (state.smallKey.type === SmallKey.BOARD) {
          setSmallKey({ type: SmallKey.CARRIED });
          c.hud.carry('작은 열쇠');
          msg('가죽끈 달린 작은 열쇠 — 서랍 자물쇠에 맞을 크기다.');
        } else msg('마루장이 들린다. 밑은 비어 있다.');
        break;
      case 'brick':
        if (hold === 'doorKey') {
          audio.brickScrape(); setKeyLoc({ type: K.BRICK }); c.hud.carry(null);
          msg('벽돌을 빼고 열쇠를 넣은 뒤 도로 끼웠다.');
        } else if (hold === 'crank') {
          audio.brickScrape(); setCrankE2({ type: CrankE2.BRICK }); c.hud.carry(null);
          msg('벽돌 뒤에 크랭크를 밀어 넣었다.');
        } else if (hold === 'smallKey') {
          audio.brickScrape(); setSmallKey({ type: SmallKey.BRICK }); c.hud.carry(null);
          msg('벽돌 뒤에 작은 열쇠를 넣었다.');
        } else if (state.keyLoc.type === K.BRICK && !state.sealed) {
          audio.brickScrape(); setKeyLoc({ type: K.CARRIED }); c.hud.carry('열쇠');
        } else if (state.crankE2.type === CrankE2.BRICK) {
          audio.brickScrape(); setCrankE2({ type: CrankE2.CARRIED }); c.hud.carry('놋쇠 크랭크');
        } else if (state.smallKey.type === SmallKey.BRICK) {
          audio.brickScrape(); setSmallKey({ type: SmallKey.CARRIED }); c.hud.carry('작은 열쇠');
        } else if (state.sealed) {
          msg('이미 일어난 일이다.');
        } else msg('벽돌이 헐겁다. 빼낼 수 있을 것 같다.');
        break;
      case 'pastCrank':
        if (!hold) { setCrankE2({ type: CrankE2.CARRIED }); c.hud.carry('놋쇠 크랭크'); }
        break;
      case 'pastSmallKey':
        if (!hold) {
          const fromBoard = state.smallKey.type === SmallKey.BOARD;
          setSmallKey({ type: SmallKey.CARRIED });
          c.hud.carry('작은 열쇠');
          if (fromBoard) msg('가죽끈 달린 작은 열쇠 — 서랍 자물쇠에 맞을 크기다.');
        }
        break;

      // ═══ 분신 E1 (ELDER) ═══
      case 'elderCrank':
        if (hold) { msg('손이 하나뿐이다.'); break; }
        setCrankE1({ type: CrankE1.CARRIED });
        c.hud.carry('놋쇠 크랭크');
        audio.brickScrape();
        msg('크랭크를 축에서 뽑았다.');
        break;
      case 'elderCrankLoose':
        if (!hold) { setCrankE1({ type: CrankE1.CARRIED }); c.hud.carry('놋쇠 크랭크'); }
        break;
      case 'elderDoor':
        if (hold === 'crank') {
          if (state.crankSealedE1) msg('이미 일어난 일이다.');
          else {
            setCrankE1({ type: CrankE1.MOUNTED });
            c.hud.carry(null);
            msg('크랭크를 도로 끼웠다.');
          }
        } else if (state.crankE1.type === CrankE1.MOUNTED) {
          msg('빗장의 크랭크, 놋쇠 문고리 — 문이 잘 손질되어 있다.');
        } else msg('축 구멍이 비었다.');
        break;
      case 'elderDrawer': {
        if (hold === 'crank') { setCrankE1({ type: CrankE1.DRAWER }); c.hud.carry(null); msg('서랍에 넣어 두었다.'); break; }
        if (hold === 'doorKey') { setKeyE1({ type: KeyE1.DRAWER }); c.hud.carry(null); msg('서랍에 넣어 두었다.'); break; }
        if (!hold && state.crankE1.type === CrankE1.DRAWER) { setCrankE1({ type: CrankE1.CARRIED }); c.hud.carry('놋쇠 크랭크'); break; }
        if (!hold && state.keyE1.type === KeyE1.DRAWER) {
          if (elderKeySealed()) { msg('이미 일어난 일이다.'); break; }
          setKeyE1({ type: KeyE1.CARRIED }); c.hud.carry('열쇠'); break;
        }
        const inside = [];
        if (state.crankE1.type === CrankE1.DRAWER) inside.push('크랭크');
        if (state.keyE1.type === KeyE1.DRAWER) inside.push('열쇠');
        msg(inside.length ? `서랍 안: ${inside.join(', ')}.` : '서랍은 비어 있고, 잠겨 있지 않다.');
        break;
      }
      case 'elderBoard':
        if (hold === 'crank') { setCrankE1({ type: CrankE1.BOARD }); c.hud.carry(null); msg('마루장 밑에 넣어 두었다.'); }
        else if (hold === 'doorKey') { setKeyE1({ type: KeyE1.BOARD }); c.hud.carry(null); msg('마루장 밑에 넣어 두었다.'); }
        else if (!hold && state.crankE1.type === CrankE1.BOARD) { setCrankE1({ type: CrankE1.CARRIED }); c.hud.carry('놋쇠 크랭크'); }
        else if (!hold && state.keyE1.type === KeyE1.BOARD) {
          if (elderKeySealed()) msg('이미 일어난 일이다.');
          else { setKeyE1({ type: KeyE1.CARRIED }); c.hud.carry('열쇠'); }
        } else msg('가죽끈 달린 여벌 열쇠가 놓여 있다. 관리인의 것이다 — 내 것이 아니다.');
        break;
      case 'elderBrick':
        msg('회반죽이 단단히 발라져 있다. 꿈쩍도 하지 않는다.');
        break;
      case 'elderPoker':
        msg('부지깽이가 아궁이 곁에 세워져 있다. 잘 손질되어 있다.');
        break;
      case 'elderNote':
        c.hud.msg('빛바랜 쪽지: 「잠그기 전 마지막 순서 — 흩어진 것은 전부 서랍에 모아 잠근다. 여벌 열쇠는 마루 밑 제자리에.」', 7);
        break;
      case 'elderHookKey':
        if (elderKeySealed()) { msg('이미 일어난 일이다.'); break; }
        if (hold) { msg('손이 하나뿐이다.'); break; }
        setKeyE1({ type: KeyE1.CARRIED });
        c.hud.carry('열쇠');
        break;
    }
  }

  // G: 놓기(분신 전용) — 발밑 반경 클램프, 정의상 원뿔 안.
  // 성립하지 않는 두 경우도 침묵하지 않고 이유를 말한다.
  onG() {
    const c = this.ctx;
    const hold = carried();
    if (c.possession.mode !== 'AVATAR') {
      const inv = state.keyLoc.type === KeyLoc.RETRIEVED
        || state.crankE2.type === CrankE2.RETRIEVED
        || state.smallKey.type === SmallKey.RETRIEVED;
      if (inv) c.hud.msg('회수한 물건은 몸에 지닌다 — 현재에는 놓기가 없다.');
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
    if (c.possession.era === 'ELDER') {
      if (hold === 'crank') { setCrankE1({ type: CrankE1.FLOOR, x, z }); c.hud.carry(null); msg2(c, '크랭크를 내려놓았다.'); }
      else if (hold === 'doorKey') { setKeyE1({ type: KeyE1.FLOOR, x, z }); c.hud.carry(null); msg2(c, '열쇠를 내려놓았다.'); }
    } else {
      if (hold === 'doorKey') { setKeyLoc({ type: KeyLoc.FLOOR, x, z }); c.hud.carry(null); msg2(c, '열쇠를 바닥에 내려놓았다.'); }
      else if (hold === 'crank') { setCrankE2({ type: CrankE2.FLOOR, x, z }); c.hud.carry(null); msg2(c, '크랭크를 바닥에 내려놓았다.'); }
      else if (hold === 'smallKey') { setSmallKey({ type: SmallKey.FLOOR, x, z }); c.hud.carry(null); msg2(c, '작은 열쇠를 내려놓았다.'); }
    }
  }

  onKeyE(down) {
    const c = this.ctx;
    if (down) {
      if (c.possession.mode === 'BODY' && this.hovered?.id === 'mirror') { this.grabbing = true; return; }
      this.onE();
    } else this.grabbing = false;
  }

  onMouseMove(dx) {
    if (!this.grabbing) return false;
    const c = this.ctx;
    const [[ax, az], [bx, bz]] = c.level.mirror.rail;
    const dot = Math.cos(c.player.yaw) * (bx - ax) - Math.sin(c.player.yaw) * (bz - az);
    const sign = dot >= 0 ? 1 : -1;
    c.portals.A.setPose(c.portals.A.railT + sign * dx * 0.0018, c.portals.A.yawDeg);
    c.cones.A.update(c.portals.A.pose);
    return true;
  }

  onWheel(dy) {
    const c = this.ctx;
    if (c.possession.mode !== 'BODY' || !(this.grabbing || this.hovered?.id === 'mirror')) return;
    c.portals.A.setPose(c.portals.A.railT, c.portals.A.yawDeg - dy);
    c.cones.A.update(c.portals.A.pose);
  }
}

function msg2(c, s) { c.hud.msg(s); }
