// pyramid/main.js — 《쌍거울의 무덤》 부트스트랩. 본편과 같은 기계, 다른 무대.
// 마주 보는 두 청동 거울: A(서쪽 끝)→과거 1(봉인된 시대), B(동쪽 끝)→과거 2(더 옛날).
// 회전만 가능. 빛은 시대별 개구(문/파공)를 통해서만 가운데 벽을 건넌다.
//
// 렌더링: ACES 톤매핑 + PCF 소프트 그림자 + PMREM 환경맵(금속 반사) +
// 시대별 안개. 현재 시대는 도굴꾼의 손전등이 유일한 휴대 광원이다.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPyramidScenes, makeScarab, makePectoral } from './scenes.js';
import { LV, mirrorLevelOf, walkableEra, apertureEra } from './level.js';
import { MirrorPortal } from '../mirror.js';
import { ConeSystem } from '../cone.js';
import { Interact } from './interact.js';
import { ItemHud } from './itemhud.js';
import { nextHint } from './hints.js';
import { bindRefs, state, carried, applyDerivation, Key1, Pin } from './causal.js';
import { loadRobberRemains, loadHandRig } from './props.js';
import { mirrorParams, spawnPoint, dirFromYaw } from '../conemath.js';
import * as audio from '../audio.js';

const MIRROR_FLIP = true;
const EYE = { BODY: 1.62, AVATAR: 1.55 };
const SPEED = 2.8;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;   // Soft는 통합 그래픽에서 과하다 (성능 우선)
renderer.localClippingEnabled = true;    // 빛 볼륨을 벽·개구 쐐기로 자르는 데 필요
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 50);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const { scenes, refs, hot } = buildPyramidScenes();

// 금속(열쇠·청동 거울 틀·가슴장식)의 반사를 살리는 환경맵.
// 현재 씬에만 준다 — 과거는 거울빛 밖이 완전한 암흑이어야 하므로
// 이미지 기반 조명(IBL)조차 없어야 한다.
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scenes.PRESENT.environment = envTex;
pmrem.dispose();

// 현재 시대의 손전등 — 도굴꾼의 유일한 휴대 광원
const flash = new THREE.SpotLight(0xfff3da, 30, 22, 0.5, 0.45, 1.5);
flash.castShadow = true;
// 카메라를 따라 도는 광원은 매 프레임 그림자 깊이 패스를 다시 그린다 —
// 상시 비용이므로 512²로 충분하고도 남는다 (1024는 코너 조준 시 프레임을 잡아먹었다).
flash.shadow.mapSize.set(512, 512);
flash.shadow.bias = -0.004;
scenes.PRESENT.add(flash, flash.target);

const lvlA = mirrorLevelOf('A'), lvlB = mirrorLevelOf('B');
const portals = {
  A: new MirrorPortal(lvlA, () => scenes.P1, { hotId: 'mirrorA', rtSize: 768, clock: true }),
  B: new MirrorPortal(lvlB, () => scenes.P2, { hotId: 'mirrorB', rtSize: 768, clock: true }),
};
// 거울 A는 정면(동쪽, 요 0) — 기울인 「정보성 구도」 대신 직각의 단정함을 택했다.
// 원뿔은 ±15° 퍼짐 + 폭 성장으로 요 0에서도 좌대(방위각 -17.8°)를 비추므로
// 과거 1의 열쇠는 여전히 빛 안에 있고, 스폰 반사에는 그 불 밝은 구석이
// 유리 왼쪽 가장자리에 걸린다 — 다가서면 열쇠가 마저 드러난다.
portals.A.setPose(0, 0);
portals.B.setPose(0, 180);    // 서쪽을 마주 본다
scenes.PRESENT.add(portals.A.group, portals.B.group);

// 역방향 포털 — 같은 거울이 과거 씬에도 서 있고, 그 유리는 현재를 비춘다.
// 빙의 중 거울을 보면 현재의 방(내 몸이 서 있는)이 보인다.
const backPortals = {
  A: new MirrorPortal(lvlA, () => scenes.PRESENT, { hotId: 'backMirrorA', rtSize: 768 }),
  B: new MirrorPortal(lvlB, () => scenes.PRESENT, { hotId: 'backMirrorB', rtSize: 768 }),
};
backPortals.A.setPose(0, 0);
backPortals.B.setPose(0, 180);
// 거울빛 스포트라이트의 광원이 이 틀 바로 뒤에 있다 — 그림자를 만들면
// 원뿔 전체가 가려지므로 역거울 틀은 그림자를 드리우지 않는다.
backPortals.A.group.traverse((o) => { o.castShadow = false; });
backPortals.B.group.traverse((o) => { o.castShadow = false; });
scenes.P1.add(backPortals.A.group);
scenes.P2.add(backPortals.B.group);
hot.P1.push(backPortals.A.group);
hot.P2.push(backPortals.B.group);
// 원뿔은 과거 씬에만 붙는다 — 현재에서는 거울빛이 보이지 않고,
// 과거에서는 거울빛(스포트라이트)이 유일한 조명이다.
const cones = {
  // 볼륨은 벽·개구 쐐기 클리핑(opts.wall)으로 판정과 같은 모양으로 잘린다.
  A: new ConeSystem(lvlA, [{ scene: scenes.P1, withSpot: true }],
    0xd9a45a, { aperture: apertureEra('P1'), wall: { x0: LV.rooms.wallX0, x1: LV.rooms.wallX1 } }),
  B: new ConeSystem(lvlB, [{ scene: scenes.P2, withSpot: true }],
    0xf0d890, { aperture: apertureEra('P2'), wall: { x0: LV.rooms.wallX0, x1: LV.rooms.wallX1 } }),
};
cones.A.update(portals.A.pose);
cones.B.update(portals.B.pose);
bindRefs(refs);
loadRobberRemains(refs, hot).catch((e) => console.warn('유해 에셋 로드 실패 — 절차 백골 유지:', e));
const itemHud = new ItemHud(renderer, envTex);   // 실물 3D 아이템 슬롯 바

const $ = (id) => document.getElementById(id);
let msgTimer = 0;
const hud = {
  prompt: (t) => { $('prompt').textContent = t || ''; },
  msg: (t, dur = 3.0) => { $('message').textContent = t; $('message').style.opacity = 1; msgTimer = dur; },
  // 소지품 표시는 실물 3D 슬롯 바(ItemHud)가 맡는다 — 상태에서 매 프레임 파생
  carry: () => itemHud.sync(),
  refreshInventory: () => itemHud.sync(),
  // 벽돌 당기기 게이지 — 진행률(0~1) 또는 null(숨김). 당기는 동안 화면이 힘겨워진다.
  pull: (p) => {
    const bar = $('pullbar');
    bar.style.display = p == null ? 'none' : 'block';
    if (p != null) bar.firstElementChild.style.width = `${(p * 100).toFixed(0)}%`;
    document.body.classList.toggle('pulling', p != null);
  },
  // 힌트 게이지(H 길게) — 진행률(0~1) 또는 null(숨김)
  hint: (p) => {
    const bar = $('hintbar');
    bar.style.display = p == null ? 'none' : 'block';
    if (p == null) return;
    bar.querySelector('i').style.width = `${(p * 100).toFixed(0)}%`;
    bar.querySelector('b').textContent = `힌트 보기 · ${hintsLeft}회 남음`;
  },
  // 시대 표시 텍스트는 두지 않는다 — 화면 반전(CSS)용 클래스만 관리한다
  modeHint: (era) => { document.body.classList.toggle('avatar', !!era); },
  fade: (cb) => {
    const f = $('fade');
    f.style.opacity = 1;
    setTimeout(() => { cb(); f.style.opacity = 0; }, 220);
  },
};

// ── 힌트 (H 길게, 세 번까지) ──
// 답을 흘리지 않도록 세 번으로 묶어 두었다. 무엇을 짚어 줄지는 hints.js가
// 세계선의 상태에서 파생한다 — 진행에 따라 필요한 것이 저절로 다음 차례가 된다.
const HINT_TIME = 1.25;
const HINT_MAX = 3;
let hintsLeft = HINT_MAX;
let hintHold = null;          // { t } — H를 누르고 있는 동안
function beginHint() {
  if (hintHold) return;
  if (hintsLeft <= 0) { hud.msg('힌트를 모두 썼다. 남은 것은 스스로 풀어야 한다.', 4); return; }
  hintHold = { t: 0 };
  hud.hint(0);
}
function cancelHint() {
  if (!hintHold) return;
  hintHold = null;
  hud.hint(null);
}
let lastHint = null;
function useHint() {
  const text = nextHint();
  // 짚어 줄 것이 없는 상태(이미 다 푼 뒤)에서는 횟수를 깎지 않는다
  if (!text) { hud.msg('지금은 더 짚어 줄 것이 없다.', 3); return; }
  // 상황이 그대로면 할 말도 그대로다 — 같은 말을 두 번 파는 것은 셈이 아니다.
  // 세 번은 「서로 다른 세 가지 힌트」를 뜻한다.
  if (text !== lastHint) { hintsLeft--; lastHint = text; }
  audio.glassTap();
  hud.msg(`${text}  (남은 힌트 ${hintsLeft}회)`, 9);
}

const player = { pos: new THREE.Vector3(-3.0, 0, 0), yaw: Math.PI / 2, pitch: 0 };
// 착지는 거울 축선 위(z=0) — 정면의 정사각 거울을 똑바로 마주 보고 일어선다.
// 돌무더기는 앞왼쪽 37°(1.5m), 낙하공(-4.2, -0.9)에서 축선까지 굴러온 동선이다.
const coneM = mirrorParams(LV.mirror);

// ── 이동 (본편 possession의 피라미드판 — 시대·개구·거울별) ──
const possession = {
  mode: 'BODY', era: null, portalKey: null, saved: null, busy: false,
  activeCone() { return this.portalKey ? cones[this.portalKey] : null; },
  tryToggle() {
    if (this.busy || state.possessLock) return;
    if (this.mode === 'BODY') {
      const which = interact.lookingAtPortal();
      if (which) this.enter(which);
    } else this.exit();
  },
  enter(which) {
    // 배달의 법: 물건은 어떤 방향으로도 유리를 건널 수 없다 — 들고 있으면 진입 불가.
    // carried()는 시대를 가리지 않는다 — 현재에서 되찾아 지닌 것도 똑같이 막힌다.
    if (carried()) {
      audio.glassTap();
      hud.msg('물건을 손에 든 채로는 거울을 건널 수 없다. 바닥에 먼저 내려놓아야 한다.');
      return;
    }
    const portal = portals[which];
    const pose = portal.pose;
    const center = new THREE.Vector3(pose.x, LV.mirror.centerY, pose.z);
    if (camera.position.distanceTo(center) > 3.0) return;
    const era = which === 'A' ? 'P1' : 'P2';
    const sp = spawnPoint(pose, coneM, walkableEra(era, state.doorOpen), LV.spawn);
    if (!sp) { hud.msg('거울 빛이 비추는 구역 안에 안전하게 발 디딜 공간이 없다.'); return; }
    this.busy = true;
    audio.possessIn();
    hud.fade(() => {
      // 몸은 현재에 남지만 거울에는 비치지 않는다 — 빙의는 유체이탈이고,
      // 혼이 빠진 몸은 거울이 붙잡지 못한다. 남는 것은 손전등 불빛뿐이다.
      this.saved = { pos: player.pos.clone(), yaw: player.yaw, pitch: player.pitch };
      const d = dirFromYaw(pose.yawDeg);
      player.pos.set(sp.x, 0, sp.z);
      player.yaw = Math.atan2(-d.x, -d.z);
      player.pitch = 0;
      this.mode = 'AVATAR'; this.era = era; this.portalKey = which;
      audio.setEra('PAST');
      hud.modeHint(era);
      this.busy = false;
    });
  },
  exit() {
    // 복귀도 거울 앞에서만 — 원뿔 안 아무 데서나 F로 돌아가지 못한다.
    const pose = portals[this.portalKey].pose;
    if (Math.hypot(player.pos.x - pose.x, player.pos.z - pose.z) > 2.5) {
      hud.msg('거울과의 거리가 너무 멀다. 거울 표면 근처로 돌아가야 한다.');
      return;
    }
    if (carried()) {
      audio.glassTap();
      hud.msg('물건을 손에 든 채로는 거울을 건널 수 없다. 바닥에 먼저 내려놓아야 한다.');
      return;
    }
    this.busy = true;
    audio.possessOut();
    hud.fade(() => {
      player.pos.copy(this.saved.pos);
      // 복귀도 「유리를 통과해 나오는」 문법 — 진입 때와 똑같이 거울을
      // 등지고 방을 향해 나온다 (떠날 때 자세 복원은 문법이 어긋난다).
      const d = dirFromYaw(pose.yawDeg);
      player.yaw = Math.atan2(-d.x, -d.z);
      player.pitch = 0;
      this.mode = 'BODY'; this.era = null; this.portalKey = null;
      applyDerivation();   // 과거에서 바꾼 것(유해 등)이 복귀 화면에 반영된다
      audio.setEra('PRESENT');
      hud.modeHint(null);
      this.busy = false;
    });
  },
};

const ctx = {
  camera, portals, backPortals, cones, hot, hud, player, possession, refs,
  walkableEra: (era) => walkableEra(era, state.doorOpen),
};
const interact = new Interact(ctx);
ctx.interact = interact;

// 문 열림 = 문제 1 완료. 오버레이 없이 돌문이 몇 초에 걸쳐 밀려 열리고,
// 탐색은 끊기지 않는다. 파생은 회전을 즉시 -1.7로 스냅하므로(모델 계약),
// 연출은 매 프레임 그 값을 덮어쓰며 천천히 따라간다.
let doorAnim = null, doorGrindT = 0;
ctx.onDoorOpen = () => {
  localStorage.setItem('pyramid_p1_clear', '1');
  doorAnim = { t: 0, dur: 3.0 };
};
// 스카라베 = 문제 2 완료 — 금고에는 가슴장식이 함께 있었다 (문제 3의 열쇠).
// 오버레이는 두지 않는다: 회수 메시지가 두 보물을 알리고 탐색은 끊기지 않는다.
ctx.onScarab = () => {
  state.pectoralOwned = true;
  localStorage.setItem('pyramid_p2_clear', '1');
};
// 가짜 문 개방 = 탈출 (최종 승리) — 석판이 미끄러진 뒤 탈출 시네마틱으로
ctx.onEscape = () => {
  state.possessLock = true;
  window.isGameCleared = true;
  startOutro(state.scarabTaken || state.pectoralOwned);
};

// ── 입력 ──
const keys = {};
let locked = false;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (!locked || introAnim || outroAnim) return;
  if (e.code === 'KeyF') possession.tryToggle();
  if (e.code === 'KeyE') interact.onKeyE(true);
  if (e.code === 'KeyG') interact.onG();
  if (e.code === 'KeyH') beginHint();
  if (/^Digit[1-9]$/.test(e.code)) interact.onDigit(+e.code.slice(5));   // 손에 들 물건 고르기
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyE') interact.onKeyE(false);   // 길게 누르기(벽돌 당기기) 해제
  if (e.code === 'KeyH') cancelHint();             // 다 차기 전에 놓으면 없던 일이 된다
});
addEventListener('mousemove', (e) => {
  if (!locked || introAnim || outroAnim) return;
  let dx = e.movementX;
  if (possession.mode === 'AVATAR' && MIRROR_FLIP) dx = -dx;
  player.yaw -= dx * 0.0023;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0023));
});
addEventListener('wheel', (e) => { if (locked) interact.onWheel(Math.max(-50, Math.min(50, e.deltaY)) * 0.08); });
// 시동 예열: 셰이더 전량 선컴파일 + 각 반사 RT 1회 렌더.
// 첫 조준에서 거울이 시야에 들어오는 순간 P2의 PBR 프로그램 수십 개가
// 한 프레임에 컴파일되며 멈칫하던 것을 시작 클릭 뒤로 숨긴다.
let warmed = false;
function warmup() {
  if (warmed) return;
  warmed = true;
  // 반사에서 먼지·입자(Points)를 제외한다 — 주 카메라만 레이어 1을 본다.
  camera.layers.enable(1);
  for (const sc of [scenes.PRESENT, scenes.P1, scenes.P2]) {
    sc.traverse((o) => { if (o.isPoints) o.layers.set(1); });
    renderer.compile(sc, camera);
  }
  for (const portal of [portals.A, portals.B, backPortals.A, backPortals.B]) {
    const prev = renderer.getRenderTarget();
    for (const rt of [portal.rtLo, portal.rtHi]) {
      renderer.setRenderTarget(rt);
      renderer.render(portal.getTargetScene(), camera);
    }
    renderer.setRenderTarget(prev);
  }
}
let introAnim = null;
let outroAnim = null;

// ── 탈출 시네마틱 ────────────────────────────────────────────
// 가짜 문이 열리면: T자 탈출 복도를 걸어 나가고, 전리품이 있으면
// 교차로에서 두 손을 들어 스카라베·목걸이를 눈으로 확인한 뒤 떠난다.
let handModel = null;
loadHandRig().then((m) => { handModel = m; }).catch(() => {});
let lootRig = null;

function buildLootRig() {
  const rig = new THREE.Group();
  let topY = 0.04, spread = 0.15;
  if (handModel) {
    const h = handModel;
    const box = new THREE.Box3().setFromObject(h);
    const size = box.getSize(new THREE.Vector3());
    const sc = 0.5 / Math.max(size.x, 1e-6);
    h.scale.setScalar(sc);
    const c = box.getCenter(new THREE.Vector3()).multiplyScalar(sc);
    h.position.set(-c.x, -c.y, -c.z);
    rig.add(h);
    topY = (size.y * sc) / 2 + 0.015;
    spread = Math.max(0.12, (size.x * sc) / 4);
  }
  const scarab = makeScarab(THREE.FrontSide);
  scarab.position.set(spread, topY, 0);
  const pect = makePectoral(THREE.FrontSide);
  pect.scale.setScalar(0.8);
  pect.position.set(-spread, topY + 0.01, 0);
  rig.add(scarab, pect);
  return rig;
}

function startOutro(loot) {
  state.possessLock = true;
  introAnim = null;
  outroAnim = {
    t0: performance.now(), loot, step: 0, lastZ: 1.2, jingled: false, doorSnd: false,
    from: { x: player.pos.x, z: player.pos.z, yaw: player.yaw, pitch: player.pitch },
  };
  // 파생이 열어 둔 경첩을 도로 닫는다 — 눈앞에서 천천히 열어 보이기 위해
  if (refs.present.falseDoorHinge) refs.present.falseDoorHinge.rotation.y = 0;
  document.body.classList.add('cinema');
  scenes.PRESENT.add(camera);          // 카메라 자식(손 리그)이 렌더되도록
  lootRig = buildLootRig();
  lootRig.position.set(0, -0.72, -0.55);   // 시야 아래 대기
  lootRig.rotation.x = 0.35;
  lootRig.visible = false;
  camera.add(lootRig);
}

function endOutro(loot) {
  document.body.classList.remove('cinema');
  if (lootRig) { camera.remove(lootRig); lootRig = null; }
  scenes.PRESENT.remove(camera);
  outroAnim = null;
  showEscapeWin(loot);
  $('fade').style.opacity = 0;
}

function showEscapeWin(loot) {
  localStorage.setItem('pyramid_escape_clear', '1');
  $('win').querySelector('h1').textContent = '탈출';
  $('win').querySelector('p').innerHTML = loot
    ? '무너진 천장으로 들어온 도굴꾼이 신의 이름을 밝혀내고 무덤을 빠져나갑니다.<br>'
      + '손에는 황금 스카라베와 신의 목걸이, 그리고 비밀의 이름 3글자가 쥐여 있습니다.<br>'
      + '화면을 클릭하면 메인 화면으로 돌아가 처음부터 다시 도전할 수 있습니다.'
    : '무너진 천장으로 들어온 도굴꾼이 신의 이름만을 쥔 채 무덤을 빠져나갑니다.<br>'
      + '보물은 어둠 속에 남았습니다 — 빈손의 탈출도 탈출입니다.<br>'
      + '화면을 클릭하면 메인 화면으로 돌아가 처음부터 다시 도전할 수 있습니다.';
  $('win').style.display = 'flex';
  document.exitPointerLock();
}

$('start').addEventListener('click', () => {
  try {
    audio.init(); audio.resume();
    // 포인터 잠금을 먼저 요청한다 — warmup이 사용자 제스처 시한을 갉아먹지 않게.
    // 요청은 조용히 거부될 수 있다(ESC 직후 쿨다운 등) — 거부를 화면에 알린다.
    const req = renderer.domElement.requestPointerLock();
    if (req && req.catch) req.catch(() => {
      hud.msg('마우스 잠금이 거부되었다 — 잠시 뒤 다시 클릭', 4);
      $('start').style.display = 'flex';
    });
    warmup();
  } catch (e) {
    const go = document.querySelector('#start .go');
    if (go) { go.textContent = '⚠ 시작 실패: ' + e.message; go.style.color = '#e0a050'; }
    throw e;
  }
});
// 모듈 그래프가 여기까지 살아서 왔다 — 로딩 문구를 입장 안내로 되돌린다.
// (이 줄이 실행되지 않으면 시작 화면에 「로딩 중…」이나 오류 원문이 남는다.)
if (!window.__bootError) {
  const go = document.querySelector('#start .go');
  if (go) go.textContent = '클릭해서 계속';
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  $('start').style.display = locked || $('win').style.display === 'flex' ? 'none' : 'flex';
  
  if (locked && !window.introStarted) {
    window.introStarted = true;
    // 개발용 미리보기: ?outro=loot(전리품 있음) / ?outro=empty(빈손) —
    // 게임 시작(클릭) 즉시 탈출 시네마틱을 재생한다.
    const devOutro = new URLSearchParams(location.search).get('outro');
    if (devOutro === 'loot' || devOutro === 'empty') {
      window.isGameCleared = true;
      state.escaped = true;
      if (devOutro === 'loot') { state.scarabTaken = true; state.pectoralOwned = true; }
      applyDerivation();
      startOutro(devOutro === 'loot');
    } else {
      introAnim = { t: 0, dur: 12.5 };
      document.body.classList.add('cinema');
      // 윗층 복도·파공은 buildPyramidScenes() 안의 makeBreach가 이미 만들었다 —
      // 여기서 다시 부르면 TypeError로 아래 오디오까지 죽는다.
      audio.introAudioSequence();
    }
  }
});
$('win').addEventListener('click', () => {
  if (window.isGameCleared) {
    location.reload();
    return;
  }
  $('win').style.display = 'none';
  renderer.domElement.requestPointerLock();
});

// ── 이동 ──
let bumpTimer = 0;
function move(dt) {
  if (introAnim || outroAnim) return;
  const avatar = possession.mode === 'AVATAR';
  const era = avatar ? possession.era : 'PRESENT';
  const walk = walkableEra(era, state.doorOpen);
  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  let strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (avatar && MIRROR_FLIP) strafe = -strafe;
  if (!fwd && !strafe) return;
  const len = Math.hypot(fwd, strafe) || 1;
  const s = SPEED * dt / len;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  let nx = player.pos.x + (-sy * fwd + cy * strafe) * s;
  let nz = player.pos.z + (-cy * fwd - sy * strafe) * s;
  if (!walk(nx, player.pos.z)) nx = player.pos.x;
  if (!walk(nx, nz)) nz = player.pos.z;
  if (avatar) {
    const cone = possession.activeCone();
    const r = cone.clampMove(player.pos, { x: nx, z: nz });
    if (r.blocked) {
      bumpTimer -= dt;
      if (bumpTimer <= 0) {
        bumpTimer = 0.8;
        const depth = cone.mirrorSideDepth({ x: player.pos.x, y: 0, z: player.pos.z });
        if (depth < 0.45) {
          audio.glassTap();
          hud.msg(carried() ? '들고 있던 물건이 거울 유리에 부딪힌다.' : 'F: 거울 건너기');
        } else {
          cone.flashBoundary();
          hud.msg('거울 빛이 비추는 경계선이다. 더 이상 어둠 속으로 나아갈 수 없다.');
        }
      }
    }
    nx = r.x; nz = r.z;
  }
  // 발소리 — 실제로 나아간 거리를 쌓아 보폭(0.95m)마다 한 걸음
  stepAcc += Math.hypot(nx - player.pos.x, nz - player.pos.z);
  if (stepAcc >= 0.95) { stepAcc = 0; audio.footstep(); }
  player.pos.set(nx, 0, nz);
}
let stepAcc = 0;

// ── 루프 ──
const _camDir = new THREE.Vector3();
// 동적 픽셀비 조절기: 프레임이 지속적으로 늦으면 한 단계 낮추고,
// 한동안 여유로우면 조심스럽게 되올린다. 통합 그래픽에서의 보험.
const PR_MAX = Math.min(devicePixelRatio, 2);
let prTier = PR_MAX, prSlow = 0, prFast = 0;
function governPixelRatio(dt) {
  if (dt > 0.022) { prSlow += 1; prFast = 0; } else { prFast += 1; prSlow = Math.max(0, prSlow - 0.5); }
  if (prSlow > 45 && prTier > 1) {
    prTier = Math.max(1, prTier - 0.25);
    renderer.setPixelRatio(prTier);
    prSlow = 0;
  } else if (prFast > 360 && prTier < PR_MAX) {
    prTier += 0.25;
    renderer.setPixelRatio(prTier);
    prFast = 0;
  }
}
const clock = new THREE.Clock();
let crackleT = 0;
let frameNo = 0;
const flashDir = new THREE.Vector3();
function tick() {
  requestAnimationFrame(tick);
  frameNo++;
  const dt = Math.min(clock.getDelta(), 0.05);
  governPixelRatio(dt);
  const avatar = possession.mode === 'AVATAR';
  // 반사 갱신 예산 — 두 요구의 화해: 응시 중인 거울은 매 프레임 갱신해
  // 「반사가 한 프레임 늦게 떨리는」 문제를 없애고(원본 Reflector의 이유),
  // 주변시(±30° 밖)나 먼 거울만 저해상·저빈도로 깎아 프레임을 지킨다.
  camera.getWorldDirection(_camDir);
  const rateFor = (portal, phase) => {
    const pp = portal.pose;
    const dx = pp.x - player.pos.x, dz = pp.z - player.pos.z;
    const dist = Math.hypot(dx, dz) || 1e-6;
    const cos = (_camDir.x * dx + _camDir.z * dz) / dist;
    // 이력(hysteresis): 문턱에서 고/저해상 RT가 프레임마다 널뛰지 않게 한다
    const wasFocused = portal._focused === true;
    const focused = dist < 5.5 && (wasFocused ? cos > 0.80 : cos > 0.90);
    portal._focused = focused;
    portal.chooseRT(focused);
    if (focused) return true;                       // 응시 중: 매 프레임, 떨림 없음
    if (dist < 9) return frameNo % 4 === phase * 2; // 주변시: 저해상 1/4
    return frameNo % 8 === phase * 3;               // 원거리: 1/8
  };
  portals.A.allowUpdate = rateFor(portals.A, 0);
  portals.B.allowUpdate = rateFor(portals.B, 1);
  backPortals.A.allowUpdate = rateFor(backPortals.A, 0);
  backPortals.B.allowUpdate = rateFor(backPortals.B, 0);
  if (locked && !introAnim && !outroAnim) { move(dt); interact.update(dt); }
  else cancelHint();
  if (hintHold) {
    hintHold.t += dt;
    const p = Math.min(1, hintHold.t / HINT_TIME);
    hud.hint(p);
    // 다 차면 그 자리에서 한 번만 터진다 — 계속 누르고 있어도 다시 차지 않는다
    if (p >= 1) { hintHold = null; hud.hint(null); useHint(); }
  }
  // 돌문 개방 연출 — 무거운 돌이 서서히 붙었다가 서서히 멎는다 (smoothstep)
  if (doorAnim) {
    doorAnim.t += dt;
    const p = Math.min(1, doorAnim.t / doorAnim.dur);
    const e = p * p * (3 - 2 * p);
    refs.present.doorGroup.rotation.y = -1.7 * e;
    doorGrindT -= dt;
    if (p < 1 && doorGrindT <= 0) { doorGrindT = 0.32; audio.brickScrape(); }
    if (p >= 1) doorAnim = null;
  }
  cones.A.tick(dt);
  cones.B.tick(dt);
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('message').style.opacity = 0; }
  const t = clock.elapsedTime;
  for (const fn of refs.anim) fn(t, dt);                 // 횃불·먼지·빛기둥·금빛
  portals.A.tickClock(t);                                // 거울 위 시계 — 거꾸로 돈다
  portals.B.tickClock(t);
  if (avatar) { crackleT -= dt; if (crackleT <= 0) { crackleT = 0.35; audio.crackle(); } }
  audio.setBoundaryHum(avatar ? possession.activeCone().boundaryLevel({ x: player.pos.x, y: 0, z: player.pos.z }) : 0);
  if (introAnim) {
    introAnim.t += dt;
    const p = Math.min(1, introAnim.t / introAnim.dur);
    const t = introAnim.t;
    
    // The actual hole is at x = -4.2, z = -0.9
    const hx = -4.2, hz = -0.9;
    const sx = -3.0, sz = 0; // 착지점 — 거울 축선 위, 스폰과 동일

    if (t < 3.0) { // 0~3s: Walking in corridor above (towards -X)
      const walkX = 0.8 - (5.0 * (t / 3.0)); // From 0.8 down to -4.2
      const walkY = 6.0 + EYE.BODY + Math.sin(t * 10) * 0.05;
      camera.position.set(walkX, walkY, hz);
      camera.quaternion.setFromEuler(new THREE.Euler(0, player.yaw, 0, 'YXZ'));
    } else if (t < 5.0) { // 3~5s: Vibration / Earthquake
      const shakeG = (t - 3.0) / 2.0;
      const shakeAmp = 0.05 * shakeG; // Keep pre-fall shake moderate
      const shakeX = (Math.random() - 0.5) * shakeAmp;
      const shakeY = (Math.random() - 0.5) * shakeAmp;
      const shakeZ = (Math.random() - 0.5) * shakeAmp;
      camera.position.set(hx + shakeX, 6.0 + EYE.BODY + shakeY, hz + shakeZ);
      camera.quaternion.setFromEuler(new THREE.Euler(shakeX * 0.5, player.yaw + shakeZ * 0.5, 0, 'YXZ'));
    } else if (t < 5.5) { // 5~5.5s: Free fall
      const tp = (t - 5.0) / 0.5;
      const easeIn = tp * tp; // Gravity acceleration
      const fallY = 6.0 + EYE.BODY - ((6.0 + EYE.BODY - 0.5) * easeIn);
      camera.position.set(hx, fallY, hz);
      camera.quaternion.setFromEuler(new THREE.Euler((Math.PI / 2.5) * easeIn, player.yaw, 0, 'YXZ'));
    } else if (t < 7.5) { // 5.5~7.5s: Impact and Dutch Angle Roll
      const tp = (t - 5.5) / 2.0;
      const smooth = tp * (2 - tp);
      const curX = hx + (sx - hx) * smooth;
      const curZ = hz + (sz - hz) * smooth;
      
      // Impact shake: Strong at first, decays rapidly by t=6.0s
      const impactDecay = Math.max(0, 1 - (t - 5.5) * 2.5);
      const shakeAmp = 0.15 * impactDecay;
      const shakeX = (Math.random() - 0.5) * shakeAmp;
      const shakeZ = (Math.random() - 0.5) * shakeAmp;
      
      // Shoulder roll dip (goes down to y=0.1 to simulate pressing against the floor)
      const dipY = 0.5 - 0.4 * Math.sin(smooth * Math.PI); 
      
      // Arc motion for the roll: swing out to the side and back
      const rollOffset = Math.sin(smooth * Math.PI) * 0.4;
      camera.position.set(curX + shakeX, dipY, curZ + shakeZ + rollOffset);
      
      // Full 360 sideways barrel roll (Z-axis)
      const rollAngle = Math.PI * 2 * smooth;
      
      // Pitch downwards while rolling to look at the ground
      const pitchAngle = (Math.PI / 2.5) * (1 - Math.sin(smooth * Math.PI)) + (Math.random() - 0.5) * shakeAmp;
      
      camera.quaternion.setFromEuler(new THREE.Euler(pitchAngle, player.yaw + shakeZ, rollAngle, 'YXZ'));
    } else if (t < 10.5) { // 7.5~10.5s: Groggily looking left and right while lying down
      const tp = (t - 7.5) / 3.0; // 0 to 1 over 3 seconds
      camera.position.set(sx, 0.5, sz);
      
      // Organic look left/right using sine wave
      const lookCycle = Math.sin(tp * Math.PI * 2); 
      // 50 degrees max left/right turn
      const headTurn = lookCycle * (Math.PI / 3.6); 
      
      // Head lifts slightly while looking around (simulate neck muscle effort)
      const headLift = Math.sin(tp * Math.PI) * 0.3; 
      const currentPitch = (Math.PI / 2.5) - headLift;
      
      // Slight camera shake to simulate dizziness/heavy breathing
      const dizzyRoll = Math.sin(tp * Math.PI * 8) * 0.02;
      
      camera.quaternion.setFromEuler(new THREE.Euler(currentPitch, player.yaw + headTurn, dizzyRoll, 'YXZ'));
    } else { // 10.5~12.5s: Stand up slowly
      const tp = (t - 10.5) / 2.0;
      const smooth = tp * tp * (3 - 2 * tp);
      camera.position.set(sx, 0.5 + (EYE.BODY - 0.5) * smooth, sz);
      
      // Smoothly transition pitch from looking down up to normal
      const startingPitch = Math.PI / 2.5;
      const currentPitch = startingPitch * (1 - smooth) + player.pitch * smooth;
      
      camera.quaternion.setFromEuler(new THREE.Euler(currentPitch, player.yaw, 0, 'YXZ'));
      player.pos.set(sx, 0, sz); // Update actual player pos
    }
    if (p >= 1) { introAnim = null; document.body.classList.remove('cinema'); }
  } else if (outroAnim) {
    // 벽시계 기준 — 프레임이 떨어져도 연출 길이는 일정하다
    const t = (performance.now() - outroAnim.t0) / 1000;
    const L = outroAnim.loot;
    const ox = 4.2, eye = EYE.BODY;
    const zStart = 1.2, zEnd = 9.7;
    const back1 = 1.2, door1 = 3.4, walk1 = 7.2;
    // 전리품이 없으면 감상 구간을 건너뛴 타임라인을 쓴다
    const sweep0 = L ? 12.1 : 7.4;
    const sweep1 = sweep0 + 2.4;
    const fade1 = sweep1 + 0.8;

    let z = zStart, bobY = 0, yaw = Math.PI, pitch = 0;
    let camX = ox;
    // 손전등: 문을 바라보는 동안만 — 복도부터는 복도 조명이 맡는다
    // (켜 둔 채 손을 들면 코앞의 손이 하얗게 탄다)
    flash.visible = t < door1;
    if (t < back1) {
      // A. 뒤로 물러난다 — 다이얼 앞에서 문 전체가 보이는 자리까지
      const tp = t / back1, sm = tp * tp * (3 - 2 * tp);
      const f = outroAnim.from;
      camX = f.x + (ox - f.x) * sm;
      z = f.z + (zStart - f.z) * sm;
      let dy = Math.PI - f.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      yaw = f.yaw + dy * sm;
      pitch = f.pitch * (1 - sm);
    } else if (t < door1) {
      // B. 1번방 돌문과 같은 문법 — 돌문 소리와 함께 석판이 벽 속으로 밀려 들어간다
      z = zStart;
      const tp = (t - back1) / (door1 - back1), sm = tp * tp * (3 - 2 * tp);
      if (!outroAnim.doorSnd) { outroAnim.doorSnd = true; audio.doorUnlock(); }
      if (refs.present.falseDoorHinge) refs.present.falseDoorHinge.rotation.y = 1.9 * sm;
    } else if (t < walk1) {
      const tp = (t - door1) / (walk1 - door1);
      const sm = tp * tp * (3 - 2 * tp);
      z = zStart + (zEnd - zStart) * sm;
      bobY = Math.sin(t * 9) * 0.045 * Math.sin(Math.PI * Math.min(1, tp * 1.15));
    } else {
      z = zEnd;
    }
    // 발소리 — 인트로 시네마틱과 동일한 0.5초 박자 (전진 중일 때만)
    if (z > outroAnim.lastZ + 1e-4) {
      if (t - outroAnim.step >= 0.5) { outroAnim.step = t; audio.footstep(); }
    }
    outroAnim.lastZ = z;

    // 전리품 감상 (loot일 때만): 두 손이 시야로 올라온다
    if (L && lootRig) {
      const hidden = { y: -0.72, z: -0.55 }, shown = { y: -0.30, z: -0.46 };
      if (t < 7.4) lootRig.visible = false;
      else if (t < 8.3) {
        lootRig.visible = true;
        const tp = (t - 7.4) / 0.9, sm = tp * tp * (3 - 2 * tp);
        lootRig.position.set(0, hidden.y + (shown.y - hidden.y) * sm, hidden.z + (shown.z - hidden.z) * sm);
        if (!outroAnim.jingled && tp > 0.35) { outroAnim.jingled = true; audio.escapeJingle(); }
      } else if (t < 11.2) {
        const sway = Math.sin((t - 8.3) * 1.4) * 0.012;
        lootRig.position.set(sway, shown.y + Math.sin((t - 8.3) * 2.1) * 0.008, shown.z);
        pitch = -0.16;   // 손끝을 내려다본다
      } else if (t < 12.1) {
        const tp = (t - 11.2) / 0.9, sm = tp * tp * (3 - 2 * tp);
        lootRig.position.set(0, shown.y + (hidden.y - shown.y) * sm, shown.z + (hidden.z - shown.z) * sm);
      } else lootRig.visible = false;
    }

    // 교차로에서 좌우를 둘러본다 — 어느 쪽으로 갈지 고르는 숨 고르기
    if (t >= sweep0 && t < sweep1) {
      const tp = (t - sweep0) / (sweep1 - sweep0);
      yaw = Math.PI + Math.sin(tp * Math.PI * 2) * 0.75;
    }
    // 페이드 아웃 → 승리 오버레이
    if (t >= sweep1) {
      $('fade').style.opacity = Math.min(1, (t - sweep1) / 0.7);
      if (t >= fade1) { endOutro(L); }
    }
    if (outroAnim) {
      camera.position.set(camX, eye + bobY, z);
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    }
  } else {
    camera.position.set(player.pos.x, EYE[possession.mode], player.pos.z);
    camera.quaternion.setFromEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
  }
  // 손전등: 눈높이보다 살짝 낮게 들고 시선을 따라간다.
  // 빙의 중에는 현재에 남은 몸이 손전등을 든 채 서 있다 — 역거울에 그렇게 비친다.
  if (avatar && possession.saved) {
    const s = possession.saved;
    flashDir.set(-Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), -Math.cos(s.yaw) * Math.cos(s.pitch));
    flash.position.set(s.pos.x, EYE.BODY - 0.18, s.pos.z);
    flash.target.position.set(s.pos.x, EYE.BODY, s.pos.z).addScaledVector(flashDir, 6);
  } else {
    camera.getWorldDirection(flashDir);
    flash.position.set(camera.position.x, camera.position.y - 0.18, camera.position.z);
    flash.target.position.copy(camera.position).addScaledVector(flashDir, 6);
  }
  const scene = avatar ? scenes[possession.era] : scenes.PRESENT;
  // 거울상 반전은 CSS(body.avatar canvas)가 맡는다 — GL은 항상 정상 투영으로
  // 그린다 (투영 반전은 와인딩을 뒤집어 DoubleSide 조명 법선을 망가뜨린다).
  renderer.render(scene, camera);
  itemHud.sync();
  itemHud.render(t, avatar && MIRROR_FLIP);
  // G 내려놓기 힌트 — 내려놓을 수 있는 것을 들고 있을 때만 보인다
  document.body.classList.toggle('candrop', locked && !!carried());
}
tick();

// 개발용 훅 — 헤드리스 스크린샷·상태 점검에 쓴다 (게임 로직과 무관)
window.__ml = { player, possession, scenes, camera, refs, portals, backPortals, cones, state, applyDerivation, interact, get outro() { return outroAnim; }, stopCinematics() { introAnim = null; outroAnim = null; document.body.classList.remove('cinema'); } };
