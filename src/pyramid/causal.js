// pyramid/causal.js — 문제 1의 세계선.
import * as audio from '../audio.js';
// 시대: P2(과거 2, 더 옛날) → P1(과거 1) → PRESENT.
// 열쇠 1의 파생 (P1의 사실 → 현재):
//   PEDESTAL(좌대에 그대로) → 붕괴가 그 자리를 덮는다: 돌무더기 틈의 금빛 —
//     보이지만 꺼낼 수 없다 (매몰은 접근을 부수고 물건은 보존한다).
//   FLOOR(다른 곳에 노출) → 모래와 세월에 사라진다 (자국뿐, 과거 재편집으로 복구).
//   BRICK(벽돌 뒤) → 살아남는다. 유일한 배달로.
// 과거 2의 열쇠 인스턴스는 지킴이의 것 — 표시 전용이며, P1에서 만지는 순간 봉인.

export const Key1 = Object.freeze({
  PEDESTAL: 'PEDESTAL', CARRIED: 'CARRIED', FLOOR: 'FLOOR', BRICK: 'BRICK', RETRIEVED: 'RETRIEVED',
});
export const JewelP2 = Object.freeze({ ALTAR: 'ALTAR', CARRIED: 'CARRIED', FLOOR: 'FLOOR' });
// 문제 2 — 끌: P2에서 태어나 화덕돌 밑으로만 P1에 도달한다.
export const Chisel = Object.freeze({
  P2SPOT: 'P2SPOT', CARRIED: 'CARRIED', P2FLOOR: 'P2FLOOR', HEARTH: 'HEARTH', P1FLOOR: 'P1FLOOR',
});
// 문제 2 — 청동 핀: 회반죽 뒤 벽감 속에서 태어나, 벽돌로만 현재에 도달한다.
export const Pin = Object.freeze({
  NICHE: 'NICHE', CARRIED: 'CARRIED', P1FLOOR: 'P1FLOOR', HEARTH: 'HEARTH',
  BRICK: 'BRICK', RETRIEVED: 'RETRIEVED',
});
// 벽돌 자체도 물건이다: 벽에 끼워져 있거나(WALL), 뽑아 들었거나(CARRIED),
// 바닥에 내려놓았다(FLOOR). WALL이 아니면 벽 속 공동이 열려 있다 — 열린 채로
// 시대가 흐르면 도굴꾼들이 공동을 털어 간다. 닫아 두었을 때만 안의 것이 살아남는다.
export const Brick = Object.freeze({ WALL: 'WALL', CARRIED: 'CARRIED', FLOOR: 'FLOOR' });

export const state = {
  key1: { type: Key1.PEDESTAL },
  jewelsP2: { type: JewelP2.ALTAR },
  doorOpen: false,
  brickP1: { type: Brick.WALL },
  presentBrickOut: false,    // 현재 시대에서 벽돌을 뽑아 둔 상태 (과거를 고치면 리셋)
  // ── 문제 2 ──
  chisel: { type: Chisel.P2SPOT },
  chiselSealedP2: false,     // P1에서 끌을 만지면 P2 인스턴스 봉인
  pin: { type: Pin.NICHE },
  plasterOpen: false,        // S: P1에서 끌로 연 벽감 — 상태는 현재까지 흐른다 (일방향)
  doorPlasterOff: false,     // 끌로 문 봉인을 뜯은 경우 (무해 — 열쇠는 이미 봉인됨)
  vaultOpenP1: false,        // P1에서 금고를 열어 두면 도굴 구간에 노출된다
  scarabTaken: false,        // 현재에서 금고 개방 = 문제 2 승리
  scarabAt: null,            // G로 내려놓은 위치 {x, z} — 품에 없을 때만 값이 있다
  possessLock: false,
};

export function key1SealedP2() { return state.key1.type !== Key1.PEDESTAL; }

export function carried() {
  if (state.key1.type === Key1.CARRIED) return 'key1';
  if (state.jewelsP2.type === JewelP2.CARRIED) return 'jewels';
  if (state.chisel.type === Chisel.CARRIED) return 'chisel';
  if (state.pin.type === Pin.CARRIED) return 'pin';
  if (state.brickP1.type === Brick.CARRIED) return 'brick';
  return null;
}

// ── 다중 소지 ──────────────────────────────────────────────────
// 여러 물건을 동시에 들 수 있다. handOrder는 집어 든 순서(슬롯 바의 표시 순서)이고,
// 그중 「손에 든」 활성 아이템은 숫자 키로 고른다 — 새로 집으면 그것이 손에 들리고,
// 상호작용과 G(내려놓기)는 손에 든 것을 쓴다. 거울을 건너는 규칙은 그대로다:
// 하나라도 들고 있으면 못 건넌다 (carried()가 판정).
const handOrder = [];
let selectedHand = null;   // 숫자 키로 골라 든 것 — 놓거나 숨기면 마지막에 집은 것으로 복귀
function trackHand(id, wasCarried, isCarried) {
  if (wasCarried === isCarried) return;
  const i = handOrder.indexOf(id);
  if (i >= 0) handOrder.splice(i, 1);
  if (isCarried) {
    handOrder.push(id); selectedHand = id;   // 갓 집은 것이 손에 들린다
    if (id !== 'brick') audio.pickup();      // 벽돌은 돌 소리(brickScrape)가 맡는다
  }
}
export function carriedAll() {
  const now = [];
  if (state.key1.type === Key1.CARRIED) now.push('key1');
  if (state.jewelsP2.type === JewelP2.CARRIED) now.push('jewels');
  if (state.chisel.type === Chisel.CARRIED) now.push('chisel');
  if (state.pin.type === Pin.CARRIED) now.push('pin');
  if (state.brickP1.type === Brick.CARRIED) now.push('brick');
  return handOrder.filter((id) => now.includes(id));
}
export function lastCarried() {
  const all = carriedAll();
  if (!all.length) return null;
  return all.includes(selectedHand) ? selectedHand : all[all.length - 1];
}
export function selectHand(id) {
  if (!carriedAll().includes(id)) return false;
  selectedHand = id;
  return true;
}
export const ITEM_LABEL = Object.freeze({
  key1: '황금 열쇠', jewels: '황금 가슴장식', chisel: '청동 끌',
  pin: '청동 핀', scarab: '황금 스카라베', brick: '벽돌',
});

export function setChisel(next) {
  trackHand('chisel', state.chisel.type === Chisel.CARRIED, next.type === Chisel.CARRIED);
  state.chisel = next;
  applyDerivation();
}
export function sealChiselP2() { state.chiselSealedP2 = true; }
export function setPin(next) {
  trackHand('pin', state.pin.type === Pin.CARRIED, next.type === Pin.CARRIED);
  state.pin = next;
  applyDerivation();
}
export function setBrickP1(next) {
  trackHand('brick', state.brickP1.type === Brick.CARRIED, next.type === Brick.CARRIED);
  state.brickP1 = next;
  // 과거의 벽이 달라졌다 — 현재의 벽은 그 결과로 다시 파생된다
  state.presentBrickOut = false;
  applyDerivation();
}

let refs = null;
export function bindRefs(r) { refs = r; applyDerivation(); }
export function setKey1(next) {
  trackHand('key1', state.key1.type === Key1.CARRIED, next.type === Key1.CARRIED);
  state.key1 = next;
  applyDerivation();
}
export function setJewelsP2(next) {
  trackHand('jewels', state.jewelsP2.type === JewelP2.CARRIED, next.type === JewelP2.CARRIED);
  state.jewelsP2 = next;
  applyDerivation();
}

export function applyDerivation() {
  if (!refs) return;
  const kt = state.key1.type;

  // ═══ P1 (과거 1) ═══
  const bt = state.brickP1.type;
  const cavityOpen = bt !== Brick.WALL;   // 벽돌이 벽에 없으면 공동이 열려 있다
  const k = refs.p1.key;
  k.visible = kt === Key1.PEDESTAL || kt === Key1.FLOOR || (kt === Key1.BRICK && cavityOpen);
  if (kt === Key1.PEDESTAL) k.position.set(-2.5, 0.5, -1.8);
  else if (kt === Key1.FLOOR) k.position.set(state.key1.x, 0.04, state.key1.z);
  else if (kt === Key1.BRICK) k.position.set(-3.95, 0.725, 2.975);   // 포켓 바닥 위
  // 벽돌 세계선: 벽에 있거나, 손에 있거나, 바닥에 있다. 무언가 들어 있으면 살짝 돌출
  const stuffed = kt === Key1.BRICK || state.pin.type === Pin.BRICK;
  refs.p1.brick.visible = bt === Brick.WALL;
  refs.p1.brick.position.set(-4.0, 0.8, 3.03 - (bt === Brick.WALL && stuffed ? 0.04 : 0));
  refs.p1.brickHole.visible = cavityOpen;
  refs.p1.brickLoose.visible = bt === Brick.FLOOR;
  if (bt === Brick.FLOOR) refs.p1.brickLoose.position.set(state.brickP1.x, 0.09, state.brickP1.z);

  // ═══ P2 (과거 2) ═══
  const j = refs.p2.jewels;
  const jt = state.jewelsP2.type;
  j.visible = jt === JewelP2.ALTAR || jt === JewelP2.FLOOR;
  if (jt === JewelP2.ALTAR) j.position.set(4.5, 0.83, -0.35);   // 제단 갓돌 위
  else if (jt === JewelP2.FLOOR) j.position.set(state.jewelsP2.x, 0.06, state.jewelsP2.z);

  // ═══ 문제 2: P1 표시 ═══
  const ct = state.chisel.type;
  refs.p1.chisel.visible = ct === Chisel.P1FLOOR;
  if (ct === Chisel.P1FLOOR) refs.p1.chisel.position.set(state.chisel.x, 0.04, state.chisel.z);
  refs.p1.hearthLid.position.y = 0.095;   // 벽돌 테 위에 얹힌 화덕돌
  refs.p1.plaster.visible = !state.plasterOpen;
  refs.p1.doorPlaster.visible = !state.doorPlasterOff;
  const pt2 = state.pin.type;
  refs.p1.pinInNiche.visible = state.plasterOpen && pt2 === Pin.NICHE;
  refs.p1.pinLoose.visible = pt2 === Pin.P1FLOOR || (pt2 === Pin.BRICK && cavityOpen);
  if (pt2 === Pin.P1FLOOR) refs.p1.pinLoose.position.set(state.pin.x, 0.03, state.pin.z);
  else if (pt2 === Pin.BRICK) refs.p1.pinLoose.position.set(-4.06, 0.725, 2.972);
  refs.p1.vaultDoor.rotation.y = state.vaultOpenP1 ? -1.2 : 0;
  refs.p1.scarab.visible = state.plasterOpen && state.vaultOpenP1;

  // ═══ 문제 2: P2 표시 ═══
  refs.p2.chisel.visible = ct === Chisel.P2SPOT || ct === Chisel.P2FLOOR;
  if (ct === Chisel.P2SPOT) refs.p2.chisel.position.set(3.2, 0.45, -2.6);
  else if (ct === Chisel.P2FLOOR) refs.p2.chisel.position.set(state.chisel.x, 0.04, state.chisel.z);

  // ═══ PRESENT 파생 ═══
  refs.present.glint.visible = kt === Key1.PEDESTAL;      // 돌무더기 틈의 금빛
  refs.present.sandTrace.visible = kt === Key1.FLOOR;     // 모래에 삭은 자국
  if (kt === Key1.FLOOR) refs.present.sandTrace.position.set(state.key1.x, 0.012, state.key1.z);
  refs.present.doorGroup.rotation.y = state.doorOpen ? -1.7 : 0;
  // 벽감: 회반죽이 돌이 된 채(S 미발생) / 홈이 드러난 채(S 발생).
  // 금고를 P1에서 열어 두었으면 도굴 구간이 비웠다.
  refs.present.nichePlaster.visible = !state.plasterOpen;
  refs.present.rosette.visible = state.plasterOpen;
  if (refs.present.scarabLoose) {
    refs.present.scarabLoose.visible = !!state.scarabAt;
    if (state.scarabAt) refs.present.scarabLoose.position.set(state.scarabAt.x, 0.034, state.scarabAt.z);
  }
  refs.present.vaultDoor.rotation.y = (state.vaultOpenP1 || state.scarabTaken) ? -1.2 : 0;
  refs.present.scarab.visible = state.plasterOpen && !state.vaultOpenP1 && !state.scarabTaken
    && false; // 스카라베는 금고 개방 순간에만 드러난다 (개방 액션에서 회수)
  // 벽돌(현재): 뽑혀 있으면 벽에는 포켓 — 뽑은 벽돌은 아이템창(품)에 있다
  refs.present.brick.visible = !state.presentBrickOut;
  refs.present.brickHole.visible = state.presentBrickOut;
}
