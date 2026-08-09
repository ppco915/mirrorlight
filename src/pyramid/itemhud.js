// pyramid/itemhud.js — 실물 3D 아이템 슬롯 바.
//
// 아이콘이 아니라 씬에서 쓰는 실제 소품 메쉬(scenes.js의 메이커)를 슬롯마다
// 미니 씬에 담아, 본 씬 렌더 뒤에 뷰포트·시저를 슬롯 사각형에 맞춰 겹쳐 그린다.
// 슬롯 틀은 DOM(#slots)의 반투명 칸이고, 그 뒤 캔버스 영역에 아이템이 돌아간다.
// 내용물은 causal 상태에서 매 프레임 파생한다(서명 비교로 변경시에만 재구성).
// 들고 있는 것에는 숫자 배지가 붙고 숫자 키로 골라 들 수 있다 — 지금 손에 든 것은
// 밝은 금테로 떠오르고, 되찾아 품에 지닌 것은 회색 테로 구분한다.

import * as THREE from 'three';
import { state, carriedAll, lastCarried, ITEM_LABEL, Key1, Pin } from './causal.js';
import { makeKey, makePectoral, makeChisel, makePin, makeScarab } from './scenes.js';

const F = THREE.FrontSide;
const DEFS = {
  key1: { make: () => makeKey(F, null) },
  jewels: { make: () => makePectoral(F, null) },
  chisel: { make: () => makeChisel(F, null) },
  pin: { make: () => makePin(F, null) },
  scarab: { make: () => makeScarab(F) },
};

export class ItemHud {
  constructor(renderer, envTex) {
    this.renderer = renderer;
    this.envTex = envTex;
    this.container = document.getElementById('slots');
    this.slots = [];
    this.sig = null;
    this.cam = new THREE.PerspectiveCamera(32, 1, 0.01, 10);
    this.cam.position.set(0.15, 0.11, 0.26);
    this.cam.lookAt(0, 0, 0);
  }

  // 슬롯 내용물 = 손에 든 것들(집은 순서) + 현재 시대에 되찾아 지닌 것들
  contents() {
    const out = carriedAll().map((id) => ({ id, inHand: true }));
    if (state.key1.type === Key1.RETRIEVED && !state.doorOpen) out.push({ id: 'key1', inHand: false });
    if (state.pin.type === Pin.RETRIEVED && !state.scarabTaken) out.push({ id: 'pin', inHand: false });
    if (state.scarabTaken) out.push({ id: 'scarab', inHand: false });
    return out;
  }

  sync() {
    const items = this.contents();
    const sel = lastCarried();   // 손에 든 것 — 숫자 키로 바뀐다
    const sig = items.map((i) => i.id + (i.inHand ? (i.id === sel ? '!' : '*') : '')).join(',');
    if (sig === this.sig) return;
    this.sig = sig;
    this.container.innerHTML = '';
    const cap = document.getElementById('handName');
    if (cap) cap.textContent = sel ? `손에 든 것 — ${ITEM_LABEL[sel]}` : '';
    let num = 0;
    this.slots = items.map(({ id, inHand }) => {
      const el = document.createElement('div');
      el.className = 'slot' + (inHand ? ' hand' : '') + (inHand && id === sel ? ' sel' : '');
      el.title = ITEM_LABEL[id];
      if (inHand) {   // 슬롯 번호 = 골라 드는 숫자 키
        num += 1;
        const badge = document.createElement('span');
        badge.className = 'num';
        badge.textContent = num;
        el.appendChild(badge);
      }
      this.container.appendChild(el);
      const scene = new THREE.Scene();
      scene.environment = this.envTex;
      scene.add(new THREE.AmbientLight(0xfff2dd, 0.65));
      const light = new THREE.DirectionalLight(0xfff2dd, 2.4);
      light.position.set(1.5, 2, 2);
      scene.add(light);
      const group = DEFS[id].make();
      // 크기 정규화 — 어떤 소품이든 슬롯에 꽉 차게
      const sphere = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere());
      const s = 0.085 / Math.max(sphere.radius, 1e-4);
      group.scale.setScalar(s);
      group.position.copy(sphere.center).multiplyScalar(-s);
      const spin = new THREE.Group();
      spin.add(group);
      spin.rotation.x = 0.4;                       // 살짝 내려다보는 각
      scene.add(spin);
      return { el, scene, spin };
    });
  }

  // mirrored: 캔버스가 CSS로 좌우 반전된 상태(분신 시점) — 뷰포트 x를 거울상
  // 좌표로 잡아, 반전 후에 DOM 슬롯 틀과 정확히 겹치게 한다.
  render(t, mirrored = false) {
    if (!this.slots.length) return;
    const r = this.renderer;
    const prevAuto = r.autoClear;
    r.autoClear = false;
    r.setScissorTest(true);
    for (const s of this.slots) {
      const rect = s.el.getBoundingClientRect();
      if (rect.width < 4) continue;
      const x = mirrored ? innerWidth - rect.right : rect.left;
      const y = innerHeight - rect.bottom;
      r.setViewport(x, y, rect.width, rect.height);
      r.setScissor(x, y, rect.width, rect.height);
      r.clearDepth();
      s.spin.rotation.y = t * 0.9;
      r.render(s.scene, this.cam);
    }
    r.setScissorTest(false);
    r.setViewport(0, 0, innerWidth, innerHeight);
    r.autoClear = prevAuto;
  }
}
