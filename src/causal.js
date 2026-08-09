// causal.js — 인과 파생 v2: 시대별 세계선(worldline) 모델.
// 진실 원천은 상류 시대의 사실이며, 하류는 순수 파생이다:
//   ELDER(25년 전) --관리인 함수--> PAST(10년 전) --붕괴/약탈--> PRESENT --> RUIN
//
// 관리인 규칙 (E1→E2 파생, 플레이어가 증거로 학습하는 대상):
//   R4 수선   — 구조 손상은 수리되고 부스러기(증거)가 남는다. 정적 드레싱으로 표현.
//   R5 회수   — E1에 헐겁게 남은 물건은 서랍에 넣고 잠근다 (깔때기).
//   R6 소유   — 관리인 본인의 물건(여벌 열쇠)은 늘 제자리(마루장 밑)로 돌아간다.
//   부착물    — 문에 달린 채로 남은 크랭크는 관리인이 떠나며 가져간다(소실).
//
// 봉인 일반화: 하류 시대에서 만진 물건은 상류 시대에서 굳는다 ("이미 일어난 일이다").

export const KeyLoc = Object.freeze({
  HOOK: 'HOOK', FLOOR: 'FLOOR', DRAWER: 'DRAWER', BOARD: 'BOARD',
  BRICK: 'BRICK', CARRIED: 'CARRIED', RETRIEVED: 'RETRIEVED',
});

// E1의 크랭크: 문에 부착 | 분신이 소지 | 어딘가에 남김
export const CrankE1 = Object.freeze({
  MOUNTED: 'MOUNTED', CARRIED: 'CARRIED',
  FLOOR: 'FLOOR', DRAWER: 'DRAWER', BOARD: 'BOARD',
});
// E2의 크랭크: NONE(관리인이 가져감) | DRAWER(깔때기 결과) | 플레이어 편집들.
// MOUNTED는 E2 문의 빗장에 장착된 상태 — 물체로서는 약탈되지만(놋쇠),
// 그것으로 돌린 빗장의 상태는 인과를 타고 하류로 흐른다.
export const CrankE2 = Object.freeze({
  NONE: 'NONE', DRAWER: 'DRAWER', CARRIED: 'CARRIED', MOUNTED: 'MOUNTED',
  FLOOR: 'FLOOR', BOARD: 'BOARD', BRICK: 'BRICK', RETRIEVED: 'RETRIEVED',
});
export const SmallKey = Object.freeze({
  BOARD: 'BOARD', CARRIED: 'CARRIED', FLOOR: 'FLOOR', BRICK: 'BRICK', RETRIEVED: 'RETRIEVED',
});

export const KeyE1 = Object.freeze({
  HOOK: 'HOOK', CARRIED: 'CARRIED', FLOOR: 'FLOOR', DRAWER: 'DRAWER', BOARD: 'BOARD',
});

export const state = {
  // ── 1장: 문 열쇠 (E2 세계선 — 기존 그대로) ──
  keyLoc: { type: KeyLoc.HOOK },
  sealed: false,             // 문 열쇠의 상류 봉인
  // 문 열쇠의 E1 인스턴스. R6(소유): 어디에 두든 관리인이 걸이로 되돌리므로
  // E2 초기값(HOOK)은 불변이다 — 표시 전용 세계선, 자유 실험의 교보재.
  keyE1: { type: KeyE1.HOOK },
  // ── 2장: 크랭크 세계선 ──
  crankE1: { type: CrankE1.MOUNTED },       // E1의 사실
  crankE2: { type: CrankE2.NONE },          // 파생 초기값; 플레이어 편집 후엔 자율
  crankSealedE1: false,      // E2에서 크랭크를 만지면 E1 봉인
  // ── 2장: 작은 열쇠(관리인의 여벌), E2에서만 조작 ──
  smallKey: { type: SmallKey.BOARD },
  drawerUnlockedE2: false,
  // ── 진행 플래그 (두 잠금은 독립 — 어느 순서로 풀어도 된다) ──
  doorUnlocked: false,       // 자물쇠 (녹슨 열쇠, 현재에서)
  boltMounted: false,        // 빗장 해제 경로 A: 현재에서 크랭크 장착
  boltOpenE2: false,         // 빗장 해제 경로 B: −10년에서 돌려 둠 (상태는 하류로 흐른다)
  doorOpen: false,           // 자물쇠 + 빗장(어느 경로든) 모두 풀리면 열린다
  clothOff: false,
  possessLock: false,
  ruinDirty: true,
};

// E1 문 열쇠의 봉인: E2의 열쇠를 한 번이라도 만졌으면 상류는 굳는다 (단조 조건)
export function elderKeySealed() { return state.keyLoc.type !== KeyLoc.HOOK; }

// 한 손 규칙: 시대 불문 단일 소지 슬롯
export function carried() {
  if (state.keyLoc.type === KeyLoc.CARRIED || state.keyE1.type === KeyE1.CARRIED) return 'doorKey';
  if (state.crankE1.type === CrankE1.CARRIED || state.crankE2.type === CrankE2.CARRIED) return 'crank';
  if (state.smallKey.type === SmallKey.CARRIED) return 'smallKey';
  return null;
}

export function setKeyE1(next) { state.keyE1 = next; applyDerivation(); }

let refs = null;
export function bindRefs(r) { refs = r; applyDerivation(); }

export function setKeyLoc(next) {
  state.keyLoc = next;
  if (next.type === KeyLoc.RETRIEVED) state.sealed = true;
  applyDerivation();
}

// E1 편집: 크랭크. 관리인 함수가 E2 초기값을 다시 계산한다(봉인 전까지).
export function setCrankE1(next) {
  state.crankE1 = next;
  if (!state.crankSealedE1) {
    state.crankE2 = next.type === CrankE1.MOUNTED
      ? { type: CrankE2.NONE }        // 부착물: 가져간다
      : { type: CrankE2.DRAWER };     // 헐거운 물건: 깔때기 → 잠긴 서랍
  }
  applyDerivation();
}

// E2 편집: 크랭크를 만지는 순간 상류(E1) 봉인
export function setCrankE2(next) {
  state.crankSealedE1 = true;
  state.crankE2 = next;
  applyDerivation();
}

export function setSmallKey(next) { state.smallKey = next; applyDerivation(); }

export function applyDerivation() {
  if (!refs) return;
  const kt = state.keyLoc.type;

  // ═══ ELDER (25년 전) ═══
  if (refs.elder) {
    const e1 = state.crankE1.type;
    refs.elder.crankOnDoor.visible = e1 === CrankE1.MOUNTED;
    refs.elder.crankLoose.visible = e1 === CrankE1.FLOOR;
    if (e1 === CrankE1.FLOOR) {
      refs.elder.crankLoose.position.set(state.crankE1.x, 0.05, state.crankE1.z);
    }
    // 문 열쇠의 E1 인스턴스 — 시대는 얼어붙은 순간이므로 플레이어가 둔 자리에
    // 그대로 보인다. E2가 늘 걸이인 것은 관리인이 되돌린 결과다(R6).
    const k1 = state.keyE1.type;
    const dk = refs.elder.doorKey;
    dk.visible = k1 === KeyE1.HOOK || k1 === KeyE1.FLOOR;
    if (k1 === KeyE1.HOOK) {
      dk.position.set(-1.0, 1.33, -2.9); dk.rotation.set(0, 0, 0);
    } else if (k1 === KeyE1.FLOOR) {
      dk.position.set(state.keyE1.x, 0.035, state.keyE1.z);
      dk.rotation.set(-Math.PI / 2, 0, 0.7);
    }
    // 서랍/마루장에 넣은 경우 메시는 감춰지고 조사 텍스트가 답한다.
  }

  // ═══ PAST (10년 전, E2) ═══
  {
    const k = refs.past.key;
    k.visible = kt === KeyLoc.HOOK || kt === KeyLoc.FLOOR || state.sealed;
    if (kt === KeyLoc.HOOK) {
      k.position.copy(refs.past.hookAnchor); k.rotation.set(0, 0, 0);
    } else if (kt === KeyLoc.FLOOR) {
      k.position.set(state.keyLoc.x, 0.035, state.keyLoc.z);
      k.rotation.set(-Math.PI / 2, 0, 0.7);
    } else if (state.sealed) {
      k.position.copy(refs.past.brickAnchor); k.rotation.set(0, Math.PI / 2, 0);
    }
    refs.past.brickLoose.position.x =
      refs.past.brickHome.x + (state.sealed ? -0.09 : 0);

    const c2 = state.crankE2.type;
    refs.past.crankOnDoor.visible = c2 === CrankE2.MOUNTED;
    refs.past.doorBolt.position.x = refs.past.doorBoltHome + (state.boltOpenE2 ? -0.25 : 0);
    const sk = refs.past.smallKeyInBoard;
    sk.visible = state.smallKey.type === SmallKey.BOARD || state.smallKey.type === SmallKey.FLOOR;
    if (state.smallKey.type === SmallKey.BOARD) sk.position.set(-0.8, 0.05, 1.15);
    else if (state.smallKey.type === SmallKey.FLOOR) sk.position.set(state.smallKey.x, 0.035, state.smallKey.z);
    refs.past.drawerContents.visible = state.drawerUnlockedE2;
    refs.past.crankInDrawer.visible = state.drawerUnlockedE2 && c2 === CrankE2.DRAWER;
    refs.past.crankLoose.visible = c2 === CrankE2.FLOOR;
    if (c2 === CrankE2.FLOOR) {
      refs.past.crankLoose.position.set(state.crankE2.x, 0.05, state.crankE2.z);
    }
    refs.past.drawerFront.position.x =
      refs.past.drawerHome.x + (state.drawerUnlockedE2 ? 0.12 : 0);
  }

  // ═══ PRESENT 파생 ═══
  {
    refs.present.floorStain.visible = kt === KeyLoc.FLOOR;
    if (kt === KeyLoc.FLOOR) refs.present.floorStain.position.set(state.keyLoc.x, 0.012, state.keyLoc.z);
    refs.present.drawerKeyGlint.visible = kt === KeyLoc.DRAWER;
    // 찌그러진 틈새: 서랍 속 내용물이 보인다 — 부지깽이는 상수, 크랭크는 조건부
    refs.present.crankGlint.visible = state.crankE2.type === CrankE2.DRAWER;
    // 크랭크를 E2에 노출 방치: 약탈(놋쇠) — 옅은 윤곽 자국만
    refs.present.crankOutline.visible = state.crankE2.type === CrankE2.FLOOR;
    if (state.crankE2.type === CrankE2.FLOOR) {
      refs.present.crankOutline.position.set(state.crankE2.x, 0.012, state.crankE2.z);
    }
    refs.present.doorCrankMounted.visible = state.boltMounted;
    // E2에 장착해 둔 크랭크: 놋쇠는 약탈되어 축에 옅은 윤곽만 남는다 (문고리와 같은 문법)
    refs.present.socketOutline.visible = state.crankE2.type === CrankE2.MOUNTED;
    // 빗장의 상태는 물체가 아니므로 인과를 타고 온다
    refs.present.doorBolt.position.x =
      refs.present.doorBoltHome + ((state.boltOpenE2 || state.doorOpen) ? -0.25 : 0);
  }

  // ═══ RUIN 파생 ═══
  {
    const bricked = state.sealed || kt === KeyLoc.BRICK
      || state.crankE2.type === CrankE2.BRICK || state.crankE2.type === CrankE2.RETRIEVED
      || state.smallKey.type === SmallKey.BRICK || state.smallKey.type === SmallKey.RETRIEVED;
    const b = refs.ruin;
    b.brickLoose.position.set(
      b.brickHome.x + (bricked ? -0.22 : 0),
      b.brickHome.y - (bricked ? 0.55 : 0),
      b.brickHome.z + (bricked ? 0.15 : 0),
    );
    b.brickLoose.rotation.z = bricked ? 0.4 : 0;
    b.brickCavity.visible = bricked;
    // 답안지: 서랍 속 놋쇠는 불을 견딘다 — 잿더미 속 놋쇠 광택
    b.ashGlint.visible = state.crankE2.type === CrankE2.DRAWER;
  }

  state.ruinDirty = true;
}
