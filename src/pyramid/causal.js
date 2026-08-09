// pyramid/causal.js — 세계선 모델: SEAL(봉인의 날) → [사제단] → ROB(도굴의 밤)
//   → [도굴] → PRESENT.
// 사제단 규칙(구간 1): 흐트러진 부장품은 정위치로(가슴장식 → 크립트),
//   자기 도구는 정위치로(여는 봉 → 봉헌 벽감). SEAL의 편집은 전부 흡수된다.
// 도굴 규칙(구간 2): 보이는 것·값진 것은 전부 사라진다. 노출·항아리·크립트 —
//   전부 실패. 밋밋한 들뜬 바닥돌만 눈에 띄지 않아 살아남는다.
// 봉인: 하류(ROB)에서 만진 물건은 상류(SEAL)에서 굳는다.

export const JewelE1 = Object.freeze({ ALTAR: 'ALTAR', CARRIED: 'CARRIED', FLOOR: 'FLOOR' });
export const Jewel = Object.freeze({
  NICHE: 'NICHE', CARRIED: 'CARRIED', FLOOR: 'FLOOR',
  URN: 'URN', BLOCK: 'BLOCK', RETRIEVED: 'RETRIEVED',
});
export const Rod = Object.freeze({ ALCOVE: 'ALCOVE', CARRIED: 'CARRIED', FLOOR: 'FLOOR' });

export const state = {
  jewelsE1: { type: JewelE1.ALTAR },   // SEAL의 표시 전용 세계선 (사제단이 되돌린다)
  jewels: { type: Jewel.NICHE },       // ROB의 진실 (초기: 크립트 안, 닫힘)
  rod: { type: Rod.ALCOVE },           // ROB의 여는 봉 (정위치 = 벽감)
  cryptOpen: false,                    // ROB의 고정물 상태 — 하류로 흐른다
  doorAnimating: false,
  won: false,
  possessLock: false,
};

export function jewelsSealedE1() { return state.jewels.type !== Jewel.NICHE || state.cryptOpen; }

export function carried() {
  if (state.jewelsE1.type === JewelE1.CARRIED || state.jewels.type === Jewel.CARRIED) return 'jewels';
  if (state.rod.type === Rod.CARRIED) return 'rod';
  return null;
}

let refs = null;
export function bindRefs(r) { refs = r; applyDerivation(); }

export function setJewelsE1(next) { state.jewelsE1 = next; applyDerivation(); }
export function setJewels(next) { state.jewels = next; applyDerivation(); }
export function setRod(next) { state.rod = next; applyDerivation(); }

export function applyDerivation() {
  if (!refs) return;
  const jt = state.jewels.type;

  // ═══ SEAL: 표시 전용 세계선 ═══
  const j1 = state.jewelsE1.type;
  refs.seal.jewels.visible = j1 === JewelE1.ALTAR || j1 === JewelE1.FLOOR;
  if (j1 === JewelE1.ALTAR) refs.seal.jewels.position.set(4.5, 0.62, -0.35);
  else if (j1 === JewelE1.FLOOR) refs.seal.jewels.position.set(state.jewelsE1.x, 0.06, state.jewelsE1.z);

  // ═══ ROB: 진실 원천 표시 ═══
  refs.rob.cryptLid.position.y = state.cryptOpen ? 0.15 : 0.52;
  refs.rob.cryptLid.position.z = state.cryptOpen ? 0.35 : -0.35;
  refs.rob.jewelsInCrypt.visible = state.cryptOpen && jt === Jewel.NICHE;
  refs.rob.jewelsLoose.visible = jt === Jewel.FLOOR;
  if (jt === Jewel.FLOOR) refs.rob.jewelsLoose.position.set(state.jewels.x, 0.06, state.jewels.z);
  refs.rob.rodInAlcove.visible = state.rod.type === Rod.ALCOVE;
  refs.rob.rodLoose.visible = state.rod.type === Rod.FLOOR;
  if (state.rod.type === Rod.FLOOR) refs.rob.rodLoose.position.set(state.rod.x, 0.05, state.rod.z);

  // ═══ PRESENT 파생 ═══
  // 크립트: ROB 종료 상태가 닫힘+보석이면 도굴꾼이 억지로 뜯었다(쇠지렛 자국).
  // 이미 열려 있었다면 자국 없이 열린 채 비어 있다. 어느 쪽이든 내용물은 없다.
  refs.present.cryptLid.position.y = 0.15;
  refs.present.cryptLid.position.z = 0.35;
  refs.present.pryMarks.visible = !state.cryptOpen && jt === Jewel.NICHE;
  // 들뜬 바닥돌: 유일한 생존 은닉처
  refs.present.jewelsInBlock.visible = jt === Jewel.BLOCK;
  // 항아리·노출·크립트에 남긴 보석, 벽감·바닥의 봉 — 전부 소실 (정적 드레싱)
  state.ruinDirty = true;
}
