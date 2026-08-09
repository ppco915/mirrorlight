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

export const state = {
  key1: { type: Key1.PEDESTAL },
  jewelsP2: { type: JewelP2.ALTAR },   // 문제 2 예정 — 사제단이 흡수하는 실험장
  doorOpen: false,
  possessLock: false,
};

export function key1SealedP2() { return state.key1.type !== Key1.PEDESTAL; }

export function carried() {
  if (state.key1.type === Key1.CARRIED) return 'key1';
  if (state.jewelsP2.type === JewelP2.CARRIED) return 'jewels';
  return null;
}

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
  if (jt === JewelP2.ALTAR) j.position.set(4.5, 0.62, -0.35);
  else if (jt === JewelP2.FLOOR) j.position.set(state.jewelsP2.x, 0.06, state.jewelsP2.z);

  // ═══ PRESENT 파생 ═══
  refs.present.glint.visible = kt === Key1.PEDESTAL;      // 돌무더기 틈의 금빛
  refs.present.sandTrace.visible = kt === Key1.FLOOR;     // 모래에 삭은 자국
  if (kt === Key1.FLOOR) refs.present.sandTrace.position.set(state.key1.x, 0.012, state.key1.z);
  refs.present.doorGroup.rotation.y = state.doorOpen ? -1.7 : 0;
}
