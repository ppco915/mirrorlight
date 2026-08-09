// main.js — 부트스트랩 v2: 두 포털(A→PAST, B→ELDER), 시대 라우팅, 자세 북마크.
// 메인 카메라는 PRESENT(본체) 또는 빙의한 시대만 렌더한다. RUIN은 절대 메인 렌더 금지.

import * as THREE from 'three';
import { buildScenes } from './scenes.js';
import { MirrorPortal, RuinViewer } from './mirror.js';
import { ConeSystem } from './cone.js';
import { Possession } from './possession.js';
import { Interact } from './interact.js';
import { bindRefs, applyDerivation, state, carried, CrankE2 } from './causal.js';
import { mirrorParams, makeWalkable } from './conemath.js';
import * as audio from './audio.js';

const MIRROR_FLIP = true;      // 6.5절 기능 플래그 (판정 무관, 표현 계층)
const EYE = { BODY: 1.62, AVATAR: 1.55 };
const RADIUS = 0.28;
const SPEED = 2.8;

const level = await (await fetch('./level.json')).json();

// ── 렌더러 / 카메라 ────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 40);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── 월드 구성 ─────────────────────────────────────────────────
const { scenes, refs, hot, colliders } = buildScenes(level);
const portals = {
  A: new MirrorPortal(level, () => scenes.PAST, { hotId: 'mirror' }),
  B: new MirrorPortal(level, () => scenes.ELDER, {
    hotId: 'mirrorB', covered: true,
    fixedPose: { x: level.mirrorB.pos[0], z: level.mirrorB.pos[1], yawDeg: level.mirrorB.yawDeg },
  }),
};
scenes.PRESENT.add(portals.A.group, portals.B.group);
const ruinViewer = new RuinViewer(level, scenes.RUIN);
scenes.PRESENT.add(ruinViewer.group);

const cones = {
  A: new ConeSystem(level, [
    { scene: scenes.PAST, withSpot: true },
    { scene: scenes.PRESENT, withSpot: false },
  ], 0xffcf8a),
  B: new ConeSystem(level, [
    { scene: scenes.ELDER, withSpot: true },
    { scene: scenes.PRESENT, withSpot: false },
  ], 0xf2e2a8),
};
cones.A.update(portals.A.pose);
cones.B.update(portals.B.pose);
cones.B.groups[1].visible = false;    // 천을 걷기 전엔 현재 씬에 B 원뿔 숨김
bindRefs(refs);

// ── HUD ───────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
let msgTimer = 0;
const hud = {
  prompt: (t) => { $('prompt').textContent = t || ''; },
  msg: (t) => { $('message').textContent = t; $('message').style.opacity = 1; msgTimer = 3.0; },
  carry: (name) => {
    $('carry').style.display = name ? 'block' : 'none';
    if (name) $('carry').textContent = `들고 있음: ${name}`;
  },
  refreshInventory: () => {
    const items = [];
    if (state.keyLoc.type === 'RETRIEVED') items.push('10년 녹슨 열쇠');
    if (state.crankE2.type === 'RETRIEVED' && !state.boltMounted) items.push('놋쇠 크랭크');
    if (state.smallKey.type === 'RETRIEVED') items.push('작은 열쇠');
    $('inventory').style.display = items.length ? 'block' : 'none';
    $('inventory').textContent = `소지: ${items.join(', ')}`;
  },
  modeHint: (era) => {
    $('modehint').textContent = era === 'PAST' ? '분신 — 10년 전 (F: 복귀)'
      : era === 'ELDER' ? '분신 — 낯선 시간 (F: 복귀)' : '본체 — 현재';
    document.body.classList.toggle('avatar', !!era);
  },
  fade: (cb) => {
    const f = $('fade');
    f.style.opacity = 1;
    setTimeout(() => { cb(); f.style.opacity = 0; }, 220);
  },
};

// ── 공유 컨텍스트 ─────────────────────────────────────────────
const player = { pos: new THREE.Vector3(0, 0, 1.0), yaw: 0, pitch: 0 };
const walkable = makeWalkable(level);
const ctx = {
  level, scenes, refs, hot, camera, renderer, portals, cones, ruinViewer, hud, player,
  coneM: mirrorParams(level.mirror),
  walkableEra: () => walkable,      // ELDER/PAST 동일 보행 규정
  revealConeB: () => { cones.B.groups[1].visible = true; },
};
const possession = new Possession(ctx);
const interact = new Interact(ctx);
ctx.possession = possession;
ctx.interact = interact;

let doorAnim = -1;
ctx.openDoor = () => {
  state.possessLock = true;
  state.doorOpen = true;
  audio.doorUnlock();
  hud.msg('마지막 잠금이 풀렸다 — 문이 열린다.');
  applyDerivation();
  doorAnim = 0;
};

// ── 입력 ──────────────────────────────────────────────────────
const keys = {};
const bookmarks = [null, null, null];
let locked = false;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (!locked) return;
  if (e.code === 'KeyF') possession.tryToggle();
  if (e.code === 'KeyE') interact.onKeyE(true);
  if (e.code === 'KeyG') interact.onG();
  // 자세 북마크: B 저장(빈 슬롯 순서), 1/2/3 호출 — 본체 전용
  if (possession.mode === 'BODY') {
    if (e.code === 'KeyB') {
      const i = bookmarks.findIndex((b) => b === null);
      const slot = i === -1 ? 0 : i;
      bookmarks[slot] = { railT: portals.A.railT, yawDeg: portals.A.yawDeg };
      hud.msg(`거울 자세를 ${slot + 1}번에 기억했다.`);
    }
    const d = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code];
    if (d !== undefined && bookmarks[d]) {
      portals.A.setPose(bookmarks[d].railT, bookmarks[d].yawDeg);
      cones.A.update(portals.A.pose);
      hud.msg(`${d + 1}번 자세로 조준했다.`);
    }
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyE') interact.onKeyE(false); });
addEventListener('mousemove', (e) => {
  if (!locked) return;
  let dx = e.movementX;
  if (interact.onMouseMove(dx)) return;
  if (possession.mode === 'AVATAR' && MIRROR_FLIP) dx = -dx;
  player.yaw -= dx * 0.0023;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0023));
});
addEventListener('wheel', (e) => { if (locked) interact.onWheel(Math.max(-50, Math.min(50, e.deltaY)) * 0.08); });

const startEl = $('start');
startEl.addEventListener('click', () => {
  audio.init(); audio.resume();
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  startEl.style.display = locked || state.doorOpen ? 'none' : 'flex';
});

// ── 이동/충돌 ─────────────────────────────────────────────────
function blockedAt(x, z, era) {
  if (Math.abs(x) > 4 - RADIUS - 0.02 || Math.abs(z) > 3 - RADIUS - 0.02) return true;
  for (const b of colliders[era]) {
    if (x > b.x0 - RADIUS && x < b.x1 + RADIUS && z > b.z0 - RADIUS && z < b.z1 + RADIUS) return true;
  }
  return false;
}

let bumpTimer = 0;
function move(dt) {
  const avatar = possession.mode === 'AVATAR';
  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  let strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (avatar && MIRROR_FLIP) strafe = -strafe;
  if (!fwd && !strafe) return;
  const len = Math.hypot(fwd, strafe) || 1;
  const s = SPEED * dt / len;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  let nx = player.pos.x + (-sy * fwd + cy * strafe) * s;
  let nz = player.pos.z + (-cy * fwd - sy * strafe) * s;
  // 분신은 스폰·검증과 동일한 walkable 술어, 본체는 PRESENT AABB
  const blocked = avatar
    ? (x, z) => !walkable(x, z)
    : (x, z) => blockedAt(x, z, 'PRESENT');
  if (blocked(nx, player.pos.z)) nx = player.pos.x;
  if (blocked(nx, nz)) nz = player.pos.z;
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
          hud.msg(carried()
            ? '들고 있는 것이 유리에 탁 부딪힌다 — 물건은 유리를 건널 수 없다'
            : '유리 저편은 현재다 — 복귀는 F');
        } else {
          cone.flashBoundary();
          hud.msg(carried() ? '빛이 여기까지만 닿는다 — G로 내려놓는다' : '빛이 여기까지만 닿는다');
        }
      }
    }
    nx = r.x; nz = r.z;
  }
  player.pos.set(nx, 0, nz);
}

// ── 루프 ──────────────────────────────────────────────────────
const clock = new THREE.Clock();
let crackleT = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const avatar = possession.mode === 'AVATAR';

  if (locked && !state.doorOpen) { move(dt); interact.update(); }
  cones.A.tick(dt);
  cones.B.tick(dt);

  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('message').style.opacity = 0; }

  const t = clock.elapsedTime;
  const flicker = 1.0 + 0.25 * Math.sin(t * 9.7) * Math.sin(t * 3.1);
  refs.past.fireLight.intensity = flicker;
  refs.elder.fireLight.intensity = flicker * 0.95;
  if (avatar) { crackleT -= dt; if (crackleT <= 0) { crackleT = 0.35; audio.crackle(); } }

  audio.setBoundaryHum(avatar
    ? possession.activeCone().boundaryLevel({ x: player.pos.x, y: 0, z: player.pos.z }) : 0);

  if (doorAnim >= 0) {
    doorAnim += dt;
    refs.present.door.rotation.y = -Math.min(doorAnim / 1.4, 1) * 1.9;
    if (doorAnim > 1.6) {
      doorAnim = -1;
      localStorage.setItem('mirrorlight_clear', '2');
      $('win').style.display = 'flex';
      document.exitPointerLock();
    }
  }

  camera.position.set(player.pos.x, EYE[possession.mode], player.pos.z);
  camera.quaternion.setFromEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));

  if (state.ruinDirty) { ruinViewer.render(renderer); state.ruinDirty = false; }

  const scene = avatar ? scenes[possession.era] : scenes.PRESENT;
  if (avatar && MIRROR_FLIP) {
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[0] *= -1;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    renderer.render(scene, camera);
    camera.updateProjectionMatrix();
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  } else {
    renderer.render(scene, camera);
  }

  if (interact.inspectRuin && !avatar) {
    const size = renderer.getSize(new THREE.Vector2());
    const s = Math.min(size.x, size.y) * 0.62;
    renderer.setScissorTest(true);
    renderer.setViewport((size.x - s) / 2, (size.y - s) / 2, s, s);
    renderer.setScissor((size.x - s) / 2, (size.y - s) / 2, s, s);
    renderer.render(scenes.RUIN, ruinViewer.camera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.x, size.y);
  }
}
tick();
