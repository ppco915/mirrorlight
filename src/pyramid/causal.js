// pyramid/causal.js — 문제 1의 세계선.
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

export const state = {
  key1: { type: Key1.PEDESTAL },
  jewelsP2: { type: JewelP2.ALTAR },
  doorOpen: false,
  // ── 문제 2 ──
  chisel: { type: Chisel.P2SPOT },
  chiselSealedP2: false,     // P1에서 끌을 만지면 P2 인스턴스 봉인
  pin: { type: Pin.NICHE },
  plasterOpen: false,        // S: P1에서 끌로 연 벽감 — 상태는 현재까지 흐른다 (일방향)
  doorPlasterOff: false,     // 끌로 문 봉인을 뜯은 경우 (무해 — 열쇠는 이미 봉인됨)
  vaultOpenP1: false,        // P1에서 금고를 열어 두면 도굴 구간에 노출된다
  scarabTaken: false,        // 현재에서 금고 개방 = 문제 2 승리
  possessLock: false,
};

export function key1SealedP2() { return state.key1.type !== Key1.PEDESTAL; }

export function carried() {
  if (state.key1.type === Key1.CARRIED) return 'key1';
  if (state.jewelsP2.type === JewelP2.CARRIED) return 'jewels';
  if (state.chisel.type === Chisel.CARRIED) return 'chisel';
  if (state.pin.type === Pin.CARRIED) return 'pin';
  return null;
}
export function setChisel(next) {
  if ([Chisel.HEARTH, Chisel.P1FLOOR].includes(state.chisel.type) || state.chiselSealedP2) {
    // P1 영역에 들어온 뒤로는 P2 인스턴스가 굳는다
  }
  state.chisel = next;
  applyDerivation();
}
export function sealChiselP2() { state.chiselSealedP2 = true; }
export function setPin(next) { state.pin = next; applyDerivation(); }

let refs = null;
export function bindRefs(r) { refs = r; applyDerivation(); }
export function setKey1(next) { state.key1 = next; applyDerivation(); }
export function setJewelsP2(next) { state.jewelsP2 = next; applyDerivation(); }

export function applyDerivation() {
  if (!refs) return;
  const kt = state.key1.type;

  // ═══ P1 (과거 1) ═══
  const k = refs.p1.key;
  k.visible = kt === Key1.PEDESTAL || kt === Key1.FLOOR;
  if (kt === Key1.PEDESTAL) k.position.set(-2.5, 0.5, -1.8);
  else if (kt === Key1.FLOOR) k.position.set(state.key1.x, 0.04, state.key1.z);
  refs.p1.brick.position.x = -4.0 + (kt === Key1.BRICK ? 0.09 : 0);   // 넣은 뒤 살짝 돌출

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
  refs.p1.hearthLid.position.y = 0.03;
  refs.p1.plaster.visible = !state.plasterOpen;
  refs.p1.doorPlaster.visible = !state.doorPlasterOff;
  const pt2 = state.pin.type;
  refs.p1.pinInNiche.visible = state.plasterOpen && pt2 === Pin.NICHE;
  refs.p1.pinLoose.visible = pt2 === Pin.P1FLOOR;
  if (pt2 === Pin.P1FLOOR) refs.p1.pinLoose.position.set(state.pin.x, 0.03, state.pin.z);
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
  refs.present.vaultDoor.rotation.y = (state.vaultOpenP1 || state.scarabTaken) ? -1.2 : 0;
  refs.present.scarab.visible = state.plasterOpen && !state.vaultOpenP1 && !state.scarabTaken
    && false; // 스카라베는 금고 개방 순간에만 드러난다 (개방 액션에서 회수)
}
