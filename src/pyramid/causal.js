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

// 금고문이 열린 각도(rad). 활짝 젖혀야 감실 속 봉헌물이 정면에서 보인다 —
// 반쯤 연 문은 제 몸으로 감실을 가린다.
export const VAULT_OPEN = -2.2;

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
  vaultOpenNow: false,       // 현재에서 핀으로 금고문을 연 상태 (봉헌물이 드러난다)
  scarabTaken: false,        // 금고 속 스카라베를 회수 = 문제 2 승리
  scarabAt: null,            // G로 내려놓은 위치 {x, z} — 품에 없을 때만 값이 있다
  // 현재 시대에서 G로 내려놓은 자리 {x, z}. 손의 규칙은 시대와 무관하게 같다 —
  // 현재의 소지품도 숫자 키로 골라 들고, 내려놓고, 다시 집을 수 있다.
  presentDrop: { key1: null, pin: null, brick: null, jewels: null },
  // ── 문제 3: 아누비스의 목걸이와 가짜 문 (현재 전용 — 거울은 쉰다) ──
  pectoralOwned: false,      // 금고에는 스카라베와 가슴장식이 함께 있었다 (R6: 정위치)
  collarSeated: false,       // 벽화의 홈에 목걸이를 앉힘 → 구슬이 세 글리프를 가리킨다
  scarabSeated: false,       // 가짜 문의 풍뎅이 소켓 — 이름의 봉인을 깨운다
  dials: [0, 0, 0],          // 가짜 문의 세 글리프 다이얼
  escaped: false,            // 가짜 문 개방 = 탈출 (최종 승리)
  possessLock: false,
};

export function key1SealedP2() { return state.key1.type !== Key1.PEDESTAL; }

export function carried() {
  return carriedAll()[0] ?? null;
}

// ── 소지 ────────────────────────────────────────────────────────
// 손의 규칙은 시대와 무관하게 하나다. 여러 물건을 동시에 들 수 있고,
// handOrder는 집어 든 순서(슬롯 바의 표시 순서), 그중 「손에 든」 활성 아이템은
// 숫자 키로 고른다. 상호작용과 G(내려놓기)는 손에 든 것을 쓴다.
// 거울을 건너는 규칙도 하나다: 하나라도 들고 있으면 못 건넌다 (carried()가 판정).
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

// 지금 손에 있는 것들 — 과거의 CARRIED와 현재의 「되찾아 품에 지닌」이 같은 목록이다.
// 이미 자물쇠·금고·벽화에 쓴 것은 소모되었으므로 세지 않는다.
function heldNow() {
  const now = [];
  const d = state.presentDrop;
  if (state.key1.type === Key1.CARRIED) now.push('key1');
  else if (state.key1.type === Key1.RETRIEVED && !state.doorOpen && !d.key1) now.push('key1');
  if (state.jewelsP2.type === JewelP2.CARRIED) now.push('jewels');
  else if (state.pectoralOwned && !state.collarSeated && !d.jewels) now.push('jewels');
  if (state.chisel.type === Chisel.CARRIED) now.push('chisel');
  if (state.pin.type === Pin.CARRIED) now.push('pin');
  else if (state.pin.type === Pin.RETRIEVED && !state.scarabTaken && !d.pin) now.push('pin');
  if (state.brickP1.type === Brick.CARRIED) now.push('brick');
  else if (state.presentBrickOut && !d.brick) now.push('brick');
  if (state.scarabTaken && !state.scarabAt && !state.scarabSeated) now.push('scarab');
  return now;
}
export function carriedAll() {
  const now = heldNow();
  // 현재 시대의 소지품은 setter 없이 상태 플래그로 들어오기도 한다 — 순서 목록에
  // 없으면 뒤에 붙여, 숫자 키 슬롯이 과거와 똑같이 매겨지게 한다.
  for (const id of now) if (!handOrder.includes(id)) handOrder.push(id);
  return handOrder.filter((id) => now.includes(id));
}

// 현재 시대: 내려놓기 / 다시 집기. 스카라베만 기존 scarabAt을 쓴다(파생·검증 계약).
export function dropPresent(id, x, z) {
  if (id === 'scarab') state.scarabAt = { x, z };
  else state.presentDrop[id] = { x, z };
  applyDerivation();
}
export function takePresent(id) {
  if (id === 'scarab') state.scarabAt = null;
  else state.presentDrop[id] = null;
  if (!handOrder.includes(id)) handOrder.push(id);
  selectedHand = id;
  applyDerivation();
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
  if (kt === Key1.PEDESTAL) k.position.set(-4.2, 0.5, -0.9);
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
  refs.p1.vaultDoor.rotation.y = state.vaultOpenP1 ? VAULT_OPEN : 0;
  refs.p1.scarab.visible = state.plasterOpen && state.vaultOpenP1;
  if (refs.p1.pectoralInVault) refs.p1.pectoralInVault.visible = state.plasterOpen && state.vaultOpenP1;

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
  // 금고문: P1에서 열어 두었으면(도굴) 처음부터 열려 있고, 현재에서 핀으로 열면 열린다.
  // 회수 뒤에도 열린 채다 — 한 번 연 문은 닫지 않는다.
  refs.present.vaultDoor.rotation.y =
    (state.vaultOpenP1 || state.vaultOpenNow || state.scarabTaken) ? VAULT_OPEN : 0;
  // 봉헌물은 「도굴을 면했고 + 현재에서 문을 열었고 + 아직 회수 전」일 때만 감실에 놓여 있다
  const treasureInVault = state.plasterOpen && state.vaultOpenNow
    && !state.vaultOpenP1 && !state.scarabTaken;
  refs.present.scarab.visible = treasureInVault;
  if (refs.present.pectoralInVault) refs.present.pectoralInVault.visible = treasureInVault;
  // 벽돌(현재): 뽑혀 있으면 벽에는 포켓 — 뽑은 벽돌은 아이템창(품)에 있다.
  // 구멍 속 열쇠·핀은 P1에서 벽돌을 닫아 두었을 때만 살아남아 보인다 (E로 집는다).
  refs.present.brick.visible = !state.presentBrickOut;
  refs.present.brickHole.visible = state.presentBrickOut;
  const sealedNow = state.brickP1.type === Brick.WALL;
  if (refs.present.keyInBrick) {
    refs.present.keyInBrick.visible = state.presentBrickOut && sealedNow && kt === Key1.BRICK;
    refs.present.pinInBrick.visible = state.presentBrickOut && sealedNow && state.pin.type === Pin.BRICK;
  }
  // 현재 시대에 G로 내려놓은 물건들 — 과거의 바닥 소품과 같은 규칙으로 놓이고 집힌다
  const drop = state.presentDrop;
  const lay = (obj, at, y) => {
    if (!obj) return;
    obj.visible = !!at;
    if (at) obj.position.set(at.x, y, at.z);
  };
  lay(refs.present.keyLoose, drop.key1, 0.04);
  lay(refs.present.pinLoose, drop.pin, 0.03);
  lay(refs.present.brickLooseNow, drop.brick, 0.09);
  lay(refs.present.pectoralLoose, drop.jewels, 0.05);

  // ═══ 문제 3 파생 (현재 전용) ═══
  if (refs.present.collarSeatedMesh) {
    refs.present.collarSeatedMesh.visible = state.collarSeated;
    for (const m of refs.present.glyphMarks) m.visible = state.collarSeated;
    refs.present.scarabSeatedMesh.visible = state.scarabSeated;
    if (refs.present.dialMats && refs.present.dialTiles) {
      refs.present.dialMats.forEach((mat, i) => {
        const t = refs.present.dialTiles[state.dials[i]];
        if (t && mat.map !== t) { mat.map = t; mat.needsUpdate = true; }
      });
    }
    // 열린 가짜 문: 석판이 옆으로 미끄러지며 벽 「속」으로 들어간다.
    // z까지 벽면 뒤로 물리지 않으면 석판이 벽 앞에 그대로 남아, 문을 조준할 때
    // 함께 빛나는 「벽이 반짝이는」 결함이 된다 (같은 hot 그룹이므로).
    const slab = refs.present.falseDoorSlab;
    slab.position.x = refs.present.falseDoorHomeX + (state.escaped ? 1.35 : 0);
    slab.position.z = refs.present.falseDoorHomeZ - (state.escaped ? 0.16 : 0);
    if (refs.present.escapeCorr) refs.present.escapeCorr.visible = state.escaped;
  }
}
