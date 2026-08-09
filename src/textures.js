// textures.js — 절차적 텍스처 합성. 외부 자산 파일 없음(audio.js와 같은 규율).
//
// 모든 텍스처는 흰색 근처의 회색조다. 재질의 color가 시대 색조를 정하고 map은
// 그 위에 명암 변화만 얹으므로, 한 장으로 네 시간층을 전부 덮는다(ELDER의 따뜻한
// 마루도 RUIN의 잿빛 바닥도 같은 널빤지 무늬를 공유한다 — 같은 방이라는 증거).
//
// 이음매 처리: 저주파 성분은 캔버스 주기의 정수배 사인만 쓰므로 타일 경계가 정확히
// 맞는다. 고주파 성분은 백색 잡음이라 경계가 눈에 띄지 않는다.
//
// DOM 비의존: 픽셀을 Uint8Array에 직접 써서 DataTexture로 만든다. canvas를 쓰지
// 않으므로 브라우저와 노드(검증·스모크)가 완전히 같은 텍스처를 얻는다 — 헤드리스
// 대체물이 필요 없고, 노드 쪽 테스트가 실제 픽셀값을 검사할 수 있다.
// 앞으로 글자나 부드러운 그라디언트 데칼처럼 2D 드로잉이 정말 필요한 텍스처를
// 추가한다면, 그때는 canvas 경로와 헤드리스 가드를 그 함수에만 따로 둔다.

import * as THREE from 'three';

const SIZE = 256;

// 결정론적 난수 — 새로고침해도 같은 무늬가 나온다.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 한 변에 정확히 cycles번 반복하는 각주파수 — 이 값만 쓰면 이음매가 없다.
const k = (cycles) => (cycles * 2 * Math.PI) / SIZE;

// 저주파 얼룩: [x축 반복수, y축 반복수, 진폭, 위상]의 합
function mottle(x, y, waves) {
  let a = 0;
  for (const [fx, fy, amp, ph] of waves) a += amp * Math.sin(k(fx) * x + k(fy) * y + ph);
  return a;
}

// paint(data)는 RGBA Uint8Array를 직접 채운다.
function makeTexture(paint) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  paint(data);
  const t = new THREE.DataTexture(data, SIZE, SIZE);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  // DataTexture의 기본값은 NearestFilter에 밉맵 없음이다. 그대로 두면 먼 바닥이
  // 거칠게 깨지므로, 캔버스 텍스처와 같은 품질이 되도록 선형 보간과 밉맵을 켠다.
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;                 // SIZE가 2의 거듭제곱이라 밉맵 생성이 안전하다
  t.anisotropy = 4;
  // DataTexture는 flipY가 거짓이라 캔버스판보다 세로로 뒤집힌다. 두 무늬 모두
  // 상하 대칭인 반복 무늬라 보이는 차이가 없으므로 기본값을 그대로 둔다.
  t.needsUpdate = true;
  return t;
}

function writeGrey(d, i, g) {
  const v = Math.max(0, Math.min(1, g)) * 255;
  d[i] = d[i + 1] = d[i + 2] = v | 0;
  d[i + 3] = 255;
}

// ── 마루 널빤지 ────────────────────────────────────────────────
// 널빤지 8장 + 이음매 + x축을 따라 흐르는 나뭇결.
let _plank = null;
export function plankTexture() {
  if (_plank) return _plank;
  _plank = makeTexture((d) => {
    const rand = rng(20260809);
    const PLANKS = 8;                       // 256을 나누어 떨어뜨려야 세로 이음매가 맞는다
    const pw = SIZE / PLANKS;
    // 밝기 상한: 결(0.020) + 잡음(0.023) + 얼룩(0.030) = 0.073을 더해도 1을 넘지 않아야
    // 한다. 넘으면 가장 밝은 널빤지가 흰색으로 뭉개져 결이 사라진다.
    const tone = Array.from({ length: PLANKS }, () => 0.85 + rand() * 0.075);
    const waves = [[1, 0, 0.014, rand() * 6.283], [2, 1, 0.009, rand() * 6.283], [0, 3, 0.007, rand() * 6.283]];
    for (let y = 0; y < SIZE; y++) {
      const pi = Math.floor(y / pw);
      const inPlank = y - pi * pw;
      let base = tone[pi];
      if (inPlank < 1.2 || inPlank > pw - 1.8) base *= 0.70;   // 널빤지 사이의 어두운 홈
      for (let x = 0; x < SIZE; x++) {
        // 나뭇결: 널빤지마다 위상을 어긋나게 해 결이 이어지지 않게 한다
        const grain = Math.sin(k(14) * x + pi * 11 + Math.sin(k(2) * x + pi) * 3) * 0.020;
        writeGrey(d, (y * SIZE + x) * 4, base + grain + (rand() - 0.5) * 0.045 + mottle(x, y, waves));
      }
    }
  });
  return _plank;
}

// ── 회반죽 벽 ──────────────────────────────────────────────────
// 널찍한 얼룩 + 고운 입자. 방향성이 없어 벽/천장에 함께 쓴다.
let _plaster = null;
export function plasterTexture() {
  if (_plaster) return _plaster;
  _plaster = makeTexture((d) => {
    const rand = rng(31415926);
    const waves = [
      [1, 1, 0.030, rand() * 6.283], [2, 1, 0.020, rand() * 6.283],
      [1, 3, 0.016, rand() * 6.283], [4, 2, 0.010, rand() * 6.283],
      [3, 5, 0.007, rand() * 6.283],
    ];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        // 기준 0.90: 얼룩 진폭 합(0.083) + 잡음(0.015)을 더해도 1을 넘지 않는다.
        writeGrey(d, (y * SIZE + x) * 4, 0.90 + mottle(x, y, waves) + (rand() - 0.5) * 0.030);
      }
    }
  });
  return _plaster;
}

// 같은 픽셀을 공유하되 반복 횟수만 다른 사본. 미터당 텍셀 밀도를 맞추는 데 쓴다.
// clone()은 source를 공유하므로 GPU 업로드는 원본 한 번뿐이다.
export function tiled(tex, rx, ry) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
