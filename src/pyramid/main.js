// pyramid/main.js — 《쌍거울의 무덤》 부트스트랩. 본편과 같은 기계, 다른 무대.
// 마주 보는 두 청동 거울: A(서쪽 끝)→과거 1(봉인된 시대), B(동쪽 끝)→과거 2(더 옛날).
// 회전만 가능. 빛은 시대별 개구(문/파공)를 통해서만 가운데 벽을 건넌다.
//
// 렌더링: ACES 톤매핑 + PCF 소프트 그림자 + PMREM 환경맵(금속 반사) +
// 시대별 안개. 현재 시대는 도굴꾼의 손전등이 유일한 휴대 광원이다.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPyramidScenes } from './scenes.js';
import { LV, mirrorLevelOf, walkableEra, apertureEra } from './level.js';
import { MirrorPortal } from '../mirror.js';
import { ConeSystem } from '../cone.js';
import { Interact } from './interact.js';
import { bindRefs, state, carried, applyDerivation } from './causal.js';
import { mirrorParams, spawnPoint, dirFromYaw } from '../conemath.js';
import * as audio from '../audio.js';

const MIRROR_FLIP = true;
const EYE = { BODY: 1.62, AVATAR: 1.55 };
const SPEED = 2.8;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 50);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const { scenes, refs, hot } = buildPyramidScenes();

// 금속(열쇠·청동 거울 틀·가슴장식)의 반사를 살리는 환경맵
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  for (const s of Object.values(scenes)) s.environment = env;
  pmrem.dispose();
}

// 현재 시대의 손전등 — 도굴꾼의 유일한 휴대 광원
const flash = new THREE.SpotLight(0xfff3da, 30, 22, 0.5, 0.45, 1.5);
flash.castShadow = true;
flash.shadow.mapSize.set(1024, 1024);
flash.shadow.bias = -0.004;
scenes.PRESENT.add(flash, flash.target);

const lvlA = mirrorLevelOf('A'), lvlB = mirrorLevelOf('B');
const portals = {
  A: new MirrorPortal(lvlA, () => scenes.P1, { hotId: 'mirrorA', style: 'bronze', rtSize: 1024 }),
  B: new MirrorPortal(lvlB, () => scenes.P2, { hotId: 'mirrorB', style: 'bronze', rtSize: 1024 }),
};
portals.A.setPose(0, 0);      // 동쪽을 마주 본다
portals.B.setPose(0, 180);    // 서쪽을 마주 본다
scenes.PRESENT.add(portals.A.group, portals.B.group);
const cones = {
  A: new ConeSystem(lvlA, [
    { scene: scenes.P1, withSpot: true }, { scene: scenes.PRESENT, withSpot: false },
  ], 0xd9a45a, { aperture: apertureEra('P1') }),
  B: new ConeSystem(lvlB, [
    { scene: scenes.P2, withSpot: true }, { scene: scenes.PRESENT, withSpot: false },
  ], 0xf0d890, { aperture: apertureEra('P2') }),
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
    if (name) $('carry').textContent = `들고 있는 것: ${name}`;
  },
  refreshInventory: () => {
    const items = [];
    if (state.key1.type === 'RETRIEVED' && !state.doorOpen) items.push('황금 열쇠');
    if (state.pin.type === 'RETRIEVED' && !state.scarabTaken) items.push('청동 핀');
    if (state.scarabTaken) items.push('황금 스카라베');
    $('inventory').style.display = items.length ? 'block' : 'none';
    $('inventory').textContent = `소지품: ${items.join(', ')}`;
  },
  modeHint: (era) => {
    $('modehint').textContent = era === 'P1' ? '분신 — 봉인된 시대 (F: 돌아가기)'
      : era === 'P2' ? '분신 — 그보다 먼 옛날 (F: 돌아가기)' : '본체 — 현재';
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
    const era = which === 'A' ? 'P1' : 'P2';
    const sp = spawnPoint(pose, coneM, walkableEra(era, state.doorOpen), LV.spawn);
    if (!sp) { hud.msg('빛줄기 안에 발 디딜 자리가 없다.'); return; }
    this.busy = true;
    audio.possessIn();
    hud.fade(() => {
      this.saved = { pos: player.pos.clone(), yaw: player.yaw, pitch: player.pitch };
      const bm = refs.present.bodyMesh;
      bm.position.copy(this.saved.pos);
      bm.rotation.y = this.saved.yaw;
      bm.visible = true;
      const eraRefs = era === 'P1' ? refs.p1 : refs.p2;
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
      hud.msg('물건을 든 채로는 거울을 건널 수 없다. 먼저 내려놓아야 한다 (G)');
      return;
    }
    this.busy = true;
    audio.possessOut();
    hud.fade(() => {
      player.pos.copy(this.saved.pos);
      player.yaw = this.saved.yaw;
      player.pitch = this.saved.pitch;
      refs.present.bodyMesh.visible = false;
      refs.p1.backWindow.visible = false;
      refs.p2.backWindow.visible = false;
      this.mode = 'BODY'; this.era = null; this.portalKey = null;
      audio.setEra('PRESENT');
      hud.modeHint(null);
      this.busy = false;
    });
  },
};

const ctx = {
  camera, portals, cones, hot, hud, player, possession,
  walkableEra: (era) => walkableEra(era, state.doorOpen),
};
const interact = new Interact(ctx);
ctx.interact = interact;

// 문 열림 = 문제 1 완료. 오버레이를 보여 주되, 클릭하면 방 2 탐색을 계속한다.
ctx.onDoorOpen = () => {
  setTimeout(() => {
    localStorage.setItem('pyramid_p1_clear', '1');
    $('win').style.display = 'flex';
    document.exitPointerLock();
  }, 1400);
};
// 스카라베 = 문제 2 완료 (최종 승리)
ctx.onScarab = () => {
  setTimeout(() => {
    localStorage.setItem('pyramid_p2_clear', '1');
    $('win').querySelector('h1').textContent = '황금 스카라베';
    $('win').querySelector('p').innerHTML =
      '사제의 끌이 회반죽을 뜯어냈고, 봉인의 핀은 벽 속에서 수천 년을 기다렸다.<br>'
      + '금고는 도굴꾼들의 시대 내내 굳게 닫혀 있었다 — 당신이 여는 오늘까지.<br>'
      + '새로고침하면 처음부터 다시 시작할 수 있다.';
    $('win').style.display = 'flex';
    document.exitPointerLock();
  }, 1400);
};

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
  $('start').style.display = locked || $('win').style.display === 'flex' ? 'none' : 'flex';
});
$('win').addEventListener('click', () => {
  $('win').style.display = 'none';
  renderer.domElement.requestPointerLock();
});

// ── 이동 ──
let bumpTimer = 0;
function move(dt) {
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
          hud.msg(carried() ? '들고 있던 것이 거울 면에 부딪힌다.' : '거울 너머는 현재다. 돌아가려면 F.');
        } else {
          cone.flashBoundary();
          hud.msg(carried() ? '빛이 닿는 곳은 여기까지다. 내려놓으려면 G.' : '빛이 닿는 곳은 여기까지다.');
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
const flashDir = new THREE.Vector3();
function tick() {
  requestAnimationFrame(tick);
  frameNo++;
  const dt = Math.min(clock.getDelta(), 0.05);
  const avatar = possession.mode === 'AVATAR';
  portals.A.allowUpdate = (frameNo & 1) === 0;
  portals.B.allowUpdate = (frameNo & 1) === 1;
  if (locked) { move(dt); interact.update(); }
  cones.A.tick(dt);
  cones.B.tick(dt);
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('message').style.opacity = 0; }
  const t = clock.elapsedTime;
  for (const fn of refs.anim) fn(t, dt);                 // 횃불·먼지·빛기둥·금빛
  if (avatar) { crackleT -= dt; if (crackleT <= 0) { crackleT = 0.35; audio.crackle(); } }
  audio.setBoundaryHum(avatar
    ? possession.activeCone().boundaryLevel({ x: player.pos.x, y: 0, z: player.pos.z }) : 0);
  camera.position.set(player.pos.x, EYE[possession.mode], player.pos.z);
  camera.quaternion.setFromEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
  // 손전등: 눈높이보다 살짝 낮게 들고 시선을 따라간다
  camera.getWorldDirection(flashDir);
  flash.position.set(camera.position.x, camera.position.y - 0.18, camera.position.z);
  flash.target.position.copy(camera.position).addScaledVector(flashDir, 6);
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

// 개발용 훅 — 헤드리스 스크린샷·상태 점검에 쓴다 (게임 로직과 무관)
window.__ml = { player, possession, scenes, camera, refs, portals, cones, state, applyDerivation };
