// pyramid/main.js — 《쌍거울의 무덤》 부트스트랩. 본편과 같은 기계, 다른 무대.
// 마주 보는 두 청동 거울: A(서쪽 끝)→도굴의 밤(ROB), B(동쪽 끝)→봉인의 날(SEAL).
// 회전만 가능. 빛은 시대별 개구(문/파공)를 통해서만 가운데 벽을 건넌다.

import * as THREE from 'three';
import { buildPyramidScenes } from './scenes.js';
import { LV, mirrorLevelOf, walkableEra, apertureEra } from './level.js';
import { MirrorPortal } from '../mirror.js';
import { ConeSystem } from '../cone.js';
import { Interact } from './interact.js';
import { bindRefs, state, carried } from './causal.js';
import { mirrorParams, spawnPoint, dirFromYaw } from '../conemath.js';
import * as audio from '../audio.js';

const MIRROR_FLIP = true;
const EYE = { BODY: 1.62, AVATAR: 1.55 };
const SPEED = 2.8;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 50);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const { scenes, refs, hot } = buildPyramidScenes();
const lvlA = mirrorLevelOf('A'), lvlB = mirrorLevelOf('B');
const portals = {
  A: new MirrorPortal(lvlA, () => scenes.ROB, { hotId: 'mirrorA' }),
  B: new MirrorPortal(lvlB, () => scenes.SEAL, { hotId: 'mirrorB' }),
};
portals.A.setPose(0, 0);      // 동쪽을 마주 본다
portals.B.setPose(0, 180);    // 서쪽을 마주 본다
scenes.PRESENT.add(portals.A.group, portals.B.group);
const cones = {
  A: new ConeSystem(lvlA, [
    { scene: scenes.ROB, withSpot: true }, { scene: scenes.PRESENT, withSpot: false },
  ], 0xd9a45a, { aperture: apertureEra('ROB') }),
  B: new ConeSystem(lvlB, [
    { scene: scenes.SEAL, withSpot: true }, { scene: scenes.PRESENT, withSpot: false },
  ], 0xf0d890, { aperture: apertureEra('SEAL') }),
};
cones.A.update(portals.A.pose);
cones.B.update(portals.B.pose);
bindRefs(refs);

const $ = (id) => document.getElementById(id);
let msgTimer = 0;
const hud = {
  prompt: (t) => { $('prompt').textContent = t || ''; },
  msg: (t, dur = 3.0) => { $('message').textContent = t; $('message').style.opacity = 1; msgTimer = dur; },
  carry: (name) => {
    $('carry').style.display = name ? 'block' : 'none';
    if (name) $('carry').textContent = `들고 있음: ${name}`;
  },
  refreshInventory: () => {
    const has = state.jewels.type === 'RETRIEVED';
    $('inventory').style.display = has ? 'block' : 'none';
    $('inventory').textContent = '소지: 가슴장식';
  },
  modeHint: (era) => {
    $('modehint').textContent = era === 'ROB' ? '분신 — 낯선 밤 (F: 복귀)'
      : era === 'SEAL' ? '분신 — 낯선 낮 (F: 복귀)' : '본체 — 현재';
    document.body.classList.toggle('avatar', !!era);
  },
  fade: (cb) => {
    const f = $('fade');
    f.style.opacity = 1;
    setTimeout(() => { cb(); f.style.opacity = 0; }, 220);
  },
};

const player = { pos: new THREE.Vector3(-3.5, 0, 1.2), yaw: Math.PI / 2, pitch: 0 };
const coneM = mirrorParams(LV.mirror);

// ── 빙의 (본편 possession의 피라미드판 — 시대·개구·거울별) ──
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
    const portal = portals[which];
    const pose = portal.pose;
    const center = new THREE.Vector3(pose.x, LV.mirror.centerY, pose.z);
    if (camera.position.distanceTo(center) > 3.0) return;
    const era = which === 'A' ? 'ROB' : 'SEAL';
    const sp = spawnPoint(pose, coneM, walkableEra(era), LV.spawn);
    if (!sp) { hud.msg('빛이 설 곳에 닿지 않는다'); return; }
    this.busy = true;
    audio.possessIn();
    hud.fade(() => {
      this.saved = { pos: player.pos.clone(), yaw: player.yaw, pitch: player.pitch };
      const bm = refs.present.bodyMesh;
      bm.position.copy(this.saved.pos);
      bm.rotation.y = this.saved.yaw;
      bm.visible = true;
      const eraRefs = era === 'ROB' ? refs.rob : refs.seal;
      const bw = eraRefs.backWindow;
      const d = dirFromYaw(pose.yawDeg);
      bw.position.set(pose.x, 0, pose.z);
      bw.rotation.y = Math.atan2(d.x, d.z);
      bw.updateMatrixWorld(true);
      const st = eraRefs.backStatue;
      const l = bw.worldToLocal(this.saved.pos.clone());
      st.position.set(Math.max(-0.35, Math.min(0.35, l.x)), 0, -0.30);
      st.rotation.y = Math.PI - (this.saved.yaw - bw.rotation.y);
      bw.visible = true;
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
    if (carried()) {
      audio.glassTap();
      hud.msg('물건은 유리를 건널 수 없다 — 먼저 놓아야 한다 (G)');
      return;
    }
    this.busy = true;
    audio.possessOut();
    hud.fade(() => {
      player.pos.copy(this.saved.pos);
      player.yaw = this.saved.yaw;
      player.pitch = this.saved.pitch;
      refs.present.bodyMesh.visible = false;
      refs.rob.backWindow.visible = false;
      refs.seal.backWindow.visible = false;
      this.mode = 'BODY'; this.era = null; this.portalKey = null;
      audio.setEra('PRESENT');
      hud.modeHint(null);
      this.busy = false;
    });
  },
};

const ctx = { camera, portals, cones, hot, hud, player, walkableEra, possession, win };
const interact = new Interact(ctx);
ctx.interact = interact;

function win() {
  state.possessLock = true;
  setTimeout(() => {
    localStorage.setItem('pyramid_clear', '1');
    $('win').style.display = 'flex';
    document.exitPointerLock();
  }, 1600);
}
ctx.win = win;

// ── 입력 ──
const keys = {};
let locked = false;
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (!locked) return;
  if (e.code === 'KeyF') possession.tryToggle();
  if (e.code === 'KeyE') interact.onKeyE(true);
  if (e.code === 'KeyG') interact.onG();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousemove', (e) => {
  if (!locked) return;
  let dx = e.movementX;
  if (possession.mode === 'AVATAR' && MIRROR_FLIP) dx = -dx;
  player.yaw -= dx * 0.0023;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0023));
});
addEventListener('wheel', (e) => { if (locked) interact.onWheel(Math.max(-50, Math.min(50, e.deltaY)) * 0.08); });
$('start').addEventListener('click', () => {
  audio.init(); audio.resume();
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  $('start').style.display = locked || state.won ? 'none' : 'flex';
});

// ── 이동 ──
let bumpTimer = 0;
function move(dt) {
  const avatar = possession.mode === 'AVATAR';
  const era = avatar ? possession.era : 'PRESENT';
  const walk = walkableEra(era);
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
          hud.msg(carried() ? '들고 있는 것이 유리에 부딪힌다' : '유리 저편은 현재다 — 복귀는 F');
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

// ── 루프 ──
const clock = new THREE.Clock();
let crackleT = 0;
let frameNo = 0;
function tick() {
  requestAnimationFrame(tick);
  frameNo++;
  const dt = Math.min(clock.getDelta(), 0.05);
  const avatar = possession.mode === 'AVATAR';
  portals.A.allowUpdate = (frameNo & 1) === 0;
  portals.B.allowUpdate = (frameNo & 1) === 1;
  if (locked && !state.won) { move(dt); interact.update(); }
  cones.A.tick(dt);
  cones.B.tick(dt);
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('message').style.opacity = 0; }
  const t = clock.elapsedTime;
  const flicker = 1.0 + 0.25 * Math.sin(t * 9.7) * Math.sin(t * 3.1);
  refs.seal.fireLight.intensity = flicker;
  refs.rob.fireLight.intensity = flicker * 0.9;
  if (avatar) { crackleT -= dt; if (crackleT <= 0) { crackleT = 0.35; audio.crackle(); } }
  audio.setBoundaryHum(avatar
    ? possession.activeCone().boundaryLevel({ x: player.pos.x, y: 0, z: player.pos.z }) : 0);
  camera.position.set(player.pos.x, EYE[possession.mode], player.pos.z);
  camera.quaternion.setFromEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
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
}
tick();
