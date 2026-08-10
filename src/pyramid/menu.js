// pyramid/menu.js — 《타임즈》 시작 화면: 모험가의 서재 탁자.
//
// 낡은 세계지도를 탁자에 대충 펼쳐 놓고 위에서 내려다보는 실제 3D 씬이다.
// 지도는 캔버스에 절차적으로 그린다 — 양피지 결, 대륙 윤곽과 해안 음영,
// 위경선 도곽, 나침반 장미, 잉크 범선, 접힌 자국, 커피 얼룩, 그리고
// 붉은 펜으로 눌러 그린 동그라미와 항로. 다섯 유적지에는 미니어처 모형이
// 서 있고, 그중 하나를 골라 「모험하기」로 입장한다.
//
// 본편 렌더러와 별개의 캔버스·렌더러를 쓴다 — 게임 쪽 렌더 상태(톤매핑·
// 그림자 설정)를 건드리지 않고, 입장 뒤에는 dispose()로 통째로 반납한다.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { carveNormal } from './assets.js';

// ── 결정론 난수·값 노이즈 (새로고침해도 같은 지도가 나온다) ──
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function field(seed, gw, gh) {
  const r = rng(seed), g = new Float32Array((gw + 1) * (gh + 1));
  for (let i = 0; i < g.length; i++) g[i] = r();
  const ss = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    const x = Math.min(gw - 1e-4, Math.max(0, u * gw)), y = Math.min(gh - 1e-4, Math.max(0, v * gh));
    const xi = Math.floor(x), yi = Math.floor(y), fx = ss(x - xi), fy = ss(y - yi), W = gw + 1;
    const a = g[yi * W + xi], b = g[yi * W + xi + 1], c = g[(yi + 1) * W + xi], d = g[(yi + 1) * W + xi + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
const smooth = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

// ── 다섯 장의 지도 ─────────────────────────────────────────────
export const MAPS = [
  { id: 'giza', name: '저주받은 거울의 무덤', region: '이집트 · 기자 고원', lon: 31, lat: 27, playable: true },
  { id: 'stonehenge', name: '속삭이는 거석의 원', region: '브리튼 · 솔즈베리 평원', lon: -1.8, lat: 51.2 },
  { id: 'parthenon', name: '가라앉은 신의 궁전', region: '그리스 · 아티카', lon: 23.7, lat: 38 },
  { id: 'angkor', name: '밀림에 잠긴 탑', region: '크메르 · 앙코르', lon: 103.9, lat: 13.4 },
  { id: 'machu', name: '태양의 공중 도시', region: '페루 · 안데스', lon: -72.5, lat: -13.2 },
];

// 지도 도법 — 세로를 살짝 눌러 양피지 비율에 맞춘 옛 지도식 등장방형.
const LON0 = -130, LON1 = 160, LAT0 = 72, LAT1 = -58;
const MX = 0.052, MY = 0.075;                       // 도곽 여백
const PW = 2.35, PH = 1.30;                         // 종이 실측(m)
function uvOf(lon, lat) {
  return [MX + (1 - 2 * MX) * (lon - LON0) / (LON1 - LON0),
    MY + (1 - 2 * MY) * (LAT0 - lat) / (LAT0 - LAT1)];
}

// ── 대륙 윤곽 — 옛 지도답게 거칠게 단순화한 손그림 좌표 ──
const LANDS = [
  // 북아메리카 (태평양안→파나마→카리브·멕시코만→플로리다→대서양안→북극권)
  [[-127, 67], [-122, 57], [-125, 47], [-122, 37], [-113, 29], [-105, 22], [-101, 17], [-95, 15],
    [-88, 13], [-83, 9], [-78, 7], [-80, 9], [-84, 12], [-88, 16], [-91, 19], [-96, 21], [-97, 26],
    [-91, 29], [-84, 29], [-81, 24], [-78, 27], [-74, 36], [-69, 43], [-60, 46], [-66, 52],
    [-77, 58], [-85, 63], [-80, 68], [-95, 71], [-115, 72]],
  // 남아메리카
  [[-78, 7], [-70, 10], [-62, 10], [-52, 4], [-44, -3], [-35, -8], [-39, -15], [-41, -23],
    [-48, -28], [-53, -34], [-58, -39], [-62, -41], [-65, -47], [-68, -52], [-72, -54],
    [-75, -48], [-73, -40], [-70, -30], [-70, -18], [-76, -10], [-80, -3]],
  // 그린란드 (위쪽은 도곽에서 잘린다)
  [[-45, 60], [-40, 65], [-32, 68], [-25, 71], [-33, 76], [-45, 78], [-55, 75], [-53, 68], [-48, 63]],
  // 유라시아 (이베리아→지중해 북안→아라비아→인도→동남아→중국→시베리아→스칸디나비아)
  [[-9, 43], [-9, 36], [0, 38], [4, 43], [9, 44], [12, 42], [16, 38], [19, 42], [22, 37],
    [24, 40], [29, 41], [33, 36], [36, 36], [34, 31], [35, 29], [37, 21], [43, 12], [50, 13],
    [57, 17], [59, 23], [54, 26], [48, 29], [57, 27], [62, 25], [67, 24], [70, 21], [73, 16],
    [76, 9], [78, 8], [80, 13], [84, 18], [88, 22], [92, 20], [95, 16], [98, 10], [100, 4],
    [103, 1], [101, 7], [100, 13], [105, 10], [107, 12], [106, 17], [109, 20], [113, 23],
    [117, 24], [121, 28], [121, 33], [118, 36], [120, 39], [124, 40], [127, 42], [131, 43],
    [135, 48], [138, 54], [142, 60], [150, 62], [157, 58], [160, 62], [158, 68], [145, 71],
    [120, 73], [95, 75], [70, 73], [50, 70], [33, 69], [28, 71], [20, 70], [12, 66], [8, 63],
    [10, 59], [12, 56], [18, 57], [24, 59], [28, 60], [23, 57], [17, 55], [12, 54], [9, 55],
    [7, 53], [4, 52], [0, 50], [-2, 48], [-5, 48], [-1, 45], [-2, 43]],
  // 아프리카
  [[-6, 35], [-10, 31], [-15, 27], [-17, 21], [-16, 15], [-12, 9], [-8, 5], [0, 5], [8, 4],
    [9, -1], [12, -6], [13, -12], [12, -18], [14, -23], [17, -29], [19, -34], [25, -34],
    [28, -32], [32, -29], [35, -24], [36, -18], [39, -12], [41, -4], [44, 5], [48, 7], [51, 11],
    [43, 11], [39, 15], [37, 20], [34, 25], [32, 31], [28, 32], [22, 33], [17, 34], [10, 37],
    [5, 36], [0, 36]],
  // 오스트레일리아
  [[114, -22], [113, -26], [115, -32], [118, -35], [124, -33], [130, -32], [136, -35],
    [140, -38], [147, -38], [150, -34], [153, -28], [151, -24], [146, -19], [142, -15],
    [137, -16], [132, -12], [126, -14], [122, -18]],
  // 브리튼·아일랜드
  [[-5, 50], [-3, 53], [-4, 56], [-6, 58], [-3, 58], [-1, 54], [1, 52], [-2, 50]],
  [[-10, 52], [-8, 54], [-10, 55], [-11, 53]],
  // 마다가스카르·일본·보르네오·수마트라·뉴기니
  [[44, -16], [47, -20], [45, -25], [43, -22]],
  [[130, 32], [134, 34], [137, 35], [140, 37], [142, 41], [143, 44], [140, 43], [137, 37], [132, 34], [129, 33]],
  [[109, 1], [114, 4], [117, 1], [115, -3], [110, -2]],
  [[96, 4], [99, 0], [103, -4], [106, -6], [104, -3], [99, 2], [96, 5]],
  [[131, -3], [137, -2], [142, -4], [147, -7], [143, -8], [137, -7], [132, -5]],
];

// ── 지도 텍스처 ────────────────────────────────────────────────
function drawMapCanvas() {
  const W = 2048, H = 1132;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const px = (lon, lat) => { const [u, v] = uvOf(lon, lat); return [u * W, v * H]; };
  const jr = rng(9101);

  // 종이 바탕 + 바다 물빛
  c.fillStyle = '#cfb98c'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(116,128,102,.10)'; c.fillRect(0, 0, W, H);

  // 도곽 — 이중 테두리와 위경도 눈금
  const fx0 = MX * W, fx1 = (1 - MX) * W, fy0 = MY * H, fy1 = (1 - MY) * H;
  c.strokeStyle = 'rgba(74,53,32,.75)'; c.lineWidth = 3;
  c.strokeRect(fx0 - 14, fy0 - 14, fx1 - fx0 + 28, fy1 - fy0 + 28);
  c.lineWidth = 1.2; c.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  c.lineWidth = 1;
  for (let lon = -120; lon <= 160; lon += 10) {
    const [x] = px(lon, 0);
    c.beginPath(); c.moveTo(x, fy0 - 14); c.lineTo(x, fy0); c.moveTo(x, fy1); c.lineTo(x, fy1 + 14); c.stroke();
  }
  for (let lat = -50; lat <= 70; lat += 10) {
    const [, y] = px(0, lat);
    c.beginPath(); c.moveTo(fx0 - 14, y); c.lineTo(fx0, y); c.moveTo(fx1, y); c.lineTo(fx1 + 14, y); c.stroke();
  }
  // 위경선 — 20°마다 희미하게, 적도는 조금 진하게
  c.strokeStyle = 'rgba(96,74,48,.22)';
  for (let lon = -120; lon <= 160; lon += 20) {
    const [x] = px(lon, 0); c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, fy0); c.lineTo(x, fy1); c.stroke();
  }
  for (let lat = -40; lat <= 60; lat += 20) {
    const [, y] = px(0, lat); c.lineWidth = lat === 0 ? 1.8 : 1;
    c.beginPath(); c.moveTo(fx0, y); c.lineTo(fx1, y); c.stroke();
  }

  // 대륙 — 점마다 손떨림을 한 번만 만들어 두고, 음영·채움·윤곽이 같은 선을 쓴다
  const paths = LANDS.map((poly) => poly.map(([lon, lat]) => {
    const [x, y] = px(lon, lat); return [x + (jr() - 0.5) * 5, y + (jr() - 0.5) * 5];
  }));
  const trace = (p) => {
    c.beginPath(); c.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]);
    c.closePath();
  };
  c.save();
  c.beginPath(); c.rect(fx0, fy0, fx1 - fx0, fy1 - fy0); c.clip();
  c.lineJoin = 'round';
  // 해안 음영 — 바깥으로 번지는 겹줄 (옛 지도의 coastal shading)
  c.strokeStyle = '#6b533a';
  for (const [w, a] of [[30, 0.05], [20, 0.06], [12, 0.09], [6, 0.13]]) {
    c.lineWidth = w; c.globalAlpha = a;
    for (const p of paths) { trace(p); c.stroke(); }
  }
  c.globalAlpha = 1;
  // 뭍 채움 + 잉크 윤곽
  c.fillStyle = '#d8c197';
  for (const p of paths) { trace(p); c.fill(); }
  c.strokeStyle = 'rgba(74,53,32,.85)'; c.lineWidth = 2.2;
  for (const p of paths) { trace(p); c.stroke(); }

  // 산맥 기호 — 작은 ⌃ 를 줄지어 찍는다
  c.strokeStyle = 'rgba(80,60,38,.55)'; c.lineWidth = 1.6;
  const range = (a, b, n) => {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const [x, y] = px(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      const s = 7 + jr() * 4, ox = (jr() - 0.5) * 10, oy = (jr() - 0.5) * 8;
      c.beginPath(); c.moveTo(x - s + ox, y + s * 0.7 + oy); c.lineTo(x + ox, y - s * 0.6 + oy);
      c.lineTo(x + s + ox, y + s * 0.7 + oy); c.stroke();
    }
  };
  range([-72, -6], [-70, -38], 9);   // 안데스
  range([-116, 54], [-108, 37], 7);  // 로키
  range([6, 46], [14, 46], 4);       // 알프스
  range([70, 35], [95, 29], 9);      // 히말라야
  range([-4, 32], [7, 31], 3);       // 아틀라스
  // 강 — 나일·아마존
  c.strokeStyle = 'rgba(78,96,112,.5)'; c.lineWidth = 2;
  let [nx, ny] = px(31.2, 31);
  c.beginPath(); c.moveTo(nx, ny);
  for (const [lo, la] of [[32.2, 26], [31.4, 21], [33, 15], [31.5, 10], [33, 5]]) {
    const [x2, y2] = px(lo, la);
    c.quadraticCurveTo(nx + (jr() - 0.5) * 14, ny + (jr() - 0.5) * 14, x2, y2);
    nx = x2; ny = y2;
  }
  c.stroke();
  [nx, ny] = px(-50, -1.5);
  c.beginPath(); c.moveTo(nx, ny);
  for (const [lo, la] of [[-58, -4], [-65, -4.5], [-71, -8]]) {
    const [x2, y2] = px(lo, la);
    c.quadraticCurveTo(nx + (jr() - 0.5) * 12, ny + (jr() - 0.5) * 12, x2, y2);
    nx = x2; ny = y2;
  }
  c.stroke();

  // 지명 — 옛 지도식 라틴어 표기, 살짝 기울여서
  const label = (t, lon, lat, size, rot = 0, italic = false, alpha = 0.55) => {
    const [x, y] = px(lon, lat);
    c.save(); c.translate(x, y); c.rotate(rot);
    c.font = `${italic ? 'italic ' : ''}600 ${size}px Georgia, 'Times New Roman', serif`;
    try { c.letterSpacing = `${Math.round(size * 0.45)}px`; } catch { /* 구형 브라우저 */ }
    c.fillStyle = `rgba(74,53,32,${alpha})`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(t, 0, 0); c.restore();
  };
  label('AMERICA', -103, 47, 30, -0.04);
  label('AMERICA AVSTR.', -59, -22, 24, 0.45);
  label('AFRICA', 17, 9, 32, 0.03);
  label('EVROPA', 20, 51, 22, -0.03, false, 0.5);
  label('ASIA', 88, 47, 34, 0.02);
  label('AVSTRALIA', 133, -27, 22, 0.02);
  label('OCEANVS PACIFICVS', -113, -8, 20, -1.35, true, 0.42);
  label('OCEANVS ATLANTICVS', -33, 6, 20, -0.9, true, 0.42);
  label('MARE INDICVM', 77, -27, 20, 0.06, true, 0.42);

  // 나침반 장미 — 남태평양의 빈 바다에
  {
    const [x, y] = px(-110, -33), R = 108;
    c.save(); c.translate(x, y);
    c.strokeStyle = 'rgba(74,53,32,.6)'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.stroke();
    c.beginPath(); c.arc(0, 0, R * 0.82, 0, 6.283); c.stroke();
    c.lineWidth = 1;
    for (let i = 0; i < 32; i++) {
      const a = i * Math.PI / 16, r0 = i % 4 === 0 ? R * 0.62 : R * 0.74;
      c.beginPath(); c.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
      c.lineTo(Math.sin(a) * R * 0.82, -Math.cos(a) * R * 0.82); c.stroke();
    }
    for (let i = 0; i < 8; i++) {                     // 8방위 별
      const a = i * Math.PI / 4, L = i % 2 === 0 ? R * 0.6 : R * 0.34;
      c.fillStyle = i % 2 === 0 ? 'rgba(74,53,32,.7)' : 'rgba(140,40,28,.55)';
      c.beginPath(); c.moveTo(Math.sin(a) * L, -Math.cos(a) * L);
      c.lineTo(Math.sin(a + 0.35) * L * 0.22, -Math.cos(a + 0.35) * L * 0.22);
      c.lineTo(Math.sin(a - 0.35) * L * 0.22, -Math.cos(a - 0.35) * L * 0.22);
      c.closePath(); c.fill();
    }
    c.font = '700 26px Georgia, serif'; c.fillStyle = 'rgba(74,53,32,.8)';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('N', 0, -R * 0.92 - 16);
    c.restore();
  }

  // 표제 카르투슈 — 왼쪽 위, 북극해 자리에 겹쳐 붙인다
  {
    const x = W * 0.072, y = H * 0.085, w = W * 0.205, h = H * 0.135;
    c.fillStyle = 'rgba(228,209,164,.6)'; c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(74,53,32,.8)'; c.lineWidth = 2.6; c.strokeRect(x, y, w, h);
    c.lineWidth = 1; c.strokeRect(x + 7, y + 7, w - 14, h - 14);
    c.fillStyle = 'rgba(74,53,32,.85)'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '600 34px Georgia, serif';
    try { c.letterSpacing = '10px'; } catch { /* */ }
    c.fillText('TABVLA MVNDI', x + w / 2, y + h * 0.38);
    c.font = 'italic 400 17px Georgia, serif';
    try { c.letterSpacing = '3px'; } catch { /* */ }
    c.fillText('anno domini MDCCXXXIV', x + w / 2, y + h * 0.66);
    c.beginPath(); c.moveTo(x + w * 0.2, y + h * 0.52); c.lineTo(x + w * 0.8, y + h * 0.52); c.stroke();
  }

  // 잉크 범선 — 남대서양
  {
    const [x, y] = px(-30, -33);
    c.save(); c.translate(x, y); c.strokeStyle = 'rgba(60,42,25,.6)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-26, 6); c.quadraticCurveTo(0, 16, 26, 6); c.lineTo(20, 0); c.lineTo(-22, 0); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(-8, 0); c.lineTo(-8, -26); c.moveTo(10, 0); c.lineTo(10, -20); c.stroke();
    c.beginPath(); c.moveTo(-8, -26); c.lineTo(-24, -6); c.lineTo(-8, -6); c.closePath();
    c.moveTo(10, -20); c.lineTo(22, -4); c.lineTo(10, -4); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(-34, 12); c.quadraticCurveTo(-28, 9, -22, 12);
    c.moveTo(30, 12); c.quadraticCurveTo(36, 9, 42, 12); c.stroke();
    c.restore();
  }

  // 커피 잔 자국 — 오스트레일리아 남쪽 바다
  {
    const [x, y] = px(120, -47);
    c.strokeStyle = 'rgba(96,58,26,.16)'; c.lineWidth = 13;
    c.setLineDash([60, 24, 90, 14]); c.beginPath(); c.arc(x, y, 84, 0.4, 6.0); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(96,58,26,.14)';
    for (const [ox, oy, r] of [[-60, 70, 5], [88, -30, 4], [40, 92, 3]]) {
      c.beginPath(); c.arc(x + ox, y + oy, r, 0, 6.283); c.fill();
    }
  }

  // ── 붉은 펜 — 목적지 동그라미와 항로 ──
  const red = (a) => `rgba(178,24,14,${a})`;
  const redRing = (x, y, r, wob) => {
    c.beginPath();
    for (let i = 0; i <= 44; i++) {
      const a = -0.4 + (i / 44) * 7.1;               // 한 바퀴를 넘겨 겹쳐 긋는다
      const rr = r + Math.sin(a * 3.1 + wob) * 3 + (jr() - 0.5) * 2.5;
      const X = x + Math.cos(a) * rr * 1.06, Y = y + Math.sin(a) * rr * 0.94;
      i ? c.lineTo(X, Y) : c.moveTo(X, Y);
    }
    c.stroke();
  };
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const m of MAPS) {
    const [x, y] = px(m.lon, m.lat);
    c.strokeStyle = red(0.85); c.lineWidth = 4.6; redRing(x, y, 42, jr() * 6);
    c.strokeStyle = red(0.38); c.lineWidth = 2.4; redRing(x + 2.5, y + 2, 43, jr() * 6);
    if (m.playable) { c.strokeStyle = red(0.8); c.lineWidth = 3.6; redRing(x - 1, y + 1, 52, jr() * 6); }
  }
  // 항로: 브리튼 → 그리스 → 이집트, 손으로 점선을 눌러 그었다
  {
    const pts = [];
    const seg = (A, C, B) => {
      const [ax, ay] = px(A[0], A[1]), [cx2, cy2] = px(C[0], C[1]), [bx, by] = px(B[0], B[1]);
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, it = 1 - t;
        pts.push([it * it * ax + 2 * it * t * cx2 + t * t * bx + (jr() - 0.5) * 4,
          it * it * ay + 2 * it * t * cy2 + t * t * by + (jr() - 0.5) * 4]);
      }
    };
    seg([-1.8, 49.5], [12, 42], [22, 39.5]);
    seg([25.5, 36.5], [28, 31], [30, 28.5]);
    c.strokeStyle = red(0.75); c.lineWidth = 3.6; c.setLineDash([15, 11]);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) c.lineTo(x, y);
    c.stroke(); c.setLineDash([]);
    const [ex, ey] = pts[pts.length - 1], [qx, qy] = pts[pts.length - 4];
    const a = Math.atan2(ey - qy, ex - qx);
    c.strokeStyle = red(0.7); c.lineWidth = 3.2;
    c.beginPath(); c.moveTo(ex, ey);
    c.lineTo(ex - Math.cos(a - 0.5) * 16, ey - Math.sin(a - 0.5) * 16);
    c.moveTo(ex, ey);
    c.lineTo(ex - Math.cos(a + 0.5) * 16, ey - Math.sin(a + 0.5) * 16); c.stroke();
  }
  c.restore();   // 도곽 클리핑 해제

  // ── 세월 — 얼룩·비네트·접힌 자국·낟알을 화소 단위로 얹는다 ──
  const f1 = field(101, 6, 4), f2 = field(102, 13, 9), f3 = field(103, 41, 29);
  const creasesX = [0.25, 0.5, 0.75], creaseY = 0.5;
  const img = c.getImageData(0, 0, W, H), d = img.data;
  let hseed = 2166136261;
  const hash = () => {
    hseed ^= hseed << 13; hseed ^= hseed >>> 17; hseed ^= hseed << 5;
    return ((hseed >>> 0) % 1000) / 1000;
  };
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W, i = (y * W + x) * 4;
      const edge = Math.min(u, 1 - u, v * 1.81, (1 - v) * 1.81);
      let m = 1 - (1 - smooth(0, 0.16, edge)) * 0.34;
      const stain = smooth(0.56, 0.86, f1(u, v)) * 0.17 + smooth(0.62, 0.92, f2(u, v)) * 0.1;
      m -= stain;
      let cr = 0;
      for (const cx2 of creasesX) cr = Math.max(cr, 1 - Math.abs(u - cx2) * W / 6);
      cr = Math.max(cr, 1 - Math.abs(v - creaseY) * H / 6);
      if (cr > 0) m -= cr * 0.12;
      m += Math.max(0, 1 - Math.abs(v - creaseY - 3 / H) * H / 3) * 0.05;
      m += (f3(u, v) - 0.5) * 0.11;
      if (hash() < 0.0012) m *= 0.55;                // 세월의 티끌
      d[i] = Math.min(255, d[i] * m * (1 + stain * 0.25));
      d[i + 1] *= m;
      d[i + 2] *= m * (1 - stain * 0.35);
    }
  }
  c.putImageData(img, 0, 0);

  // 높이 캔버스 → 노멀 (종이 결 + 접힌 골)
  const hc = document.createElement('canvas'); hc.width = 512; hc.height = 283;
  const h2 = hc.getContext('2d');
  const hi = h2.createImageData(512, 283);
  for (let y = 0; y < 283; y++) {
    for (let x = 0; x < 512; x++) {
      const u = x / 512, v = y / 283;
      let hgt = 128 + (f3(u, v) - 0.5) * 26 + (f2(u, v) - 0.5) * 12;
      for (const cx2 of creasesX) hgt -= Math.max(0, 1 - Math.abs(u - cx2) * 512 / 3.5) * 30;
      hgt -= Math.max(0, 1 - Math.abs(v - creaseY) * 283 / 3.5) * 30;
      const i = (y * 512 + x) * 4;
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = Math.max(0, Math.min(255, hgt));
      hi.data[i + 3] = 255;
    }
  }
  h2.putImageData(hi, 0, 0);

  // 알파(찢긴 가장자리) — 테두리를 한 바퀴 돌며 안쪽으로 들쭉날쭉하게
  const ac = document.createElement('canvas'); ac.width = 512; ac.height = 283;
  const a2 = ac.getContext('2d');
  a2.fillStyle = '#000'; a2.fillRect(0, 0, 512, 283);
  const er = rng(4041), ring = [], STEP = 9;
  for (let x = 0; x <= 512; x += STEP) ring.push([x, 2 + er() * 6]);
  for (let y = 0; y <= 283; y += STEP) ring.push([510 - er() * 6, y]);
  for (let x = 512; x >= 0; x -= STEP) ring.push([x, 281 - er() * 6]);
  for (let y = 283; y >= 0; y -= STEP) ring.push([2 + er() * 6, y]);
  a2.fillStyle = '#fff'; a2.beginPath(); a2.moveTo(ring[0][0], ring[0][1]);
  for (const [x, y] of ring) a2.lineTo(x, y);
  a2.closePath(); a2.fill();

  return { color: cv, height: hc, alpha: ac };
}

// ── 탁자 나무 텍스처 ───────────────────────────────────────────
function drawWoodCanvas() {
  const W = 1024, H = 640, PL = 5, ROW = H / PL;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const r = rng(700);
  const planks = [];
  for (let i = 0; i < PL; i++) {
    planks.push({
      tone: 0.86 + r() * 0.26,
      f: field(710 + i, 160, 2),          // 큰 결 — 가로로 길게 늘어난 무늬
      fine: field(760 + i, 480, 3),       // 잔결
      knots: [],
    });
  }
  for (let i = 0; i < PL; i++) {
    if (r() < 0.5) continue;              // 옹이는 드물고 작아야 한다
    planks[i].knots.push([r() * W, (i + 0.3 + r() * 0.4) * ROW, 7 + r() * 8]);
  }
  const img = c.createImageData(W, H), d = img.data;
  const hcv = document.createElement('canvas'); hcv.width = W; hcv.height = H;
  const hctx = hcv.getContext('2d'), himg = hctx.createImageData(W, H), hd = himg.data;
  const rcv = document.createElement('canvas'); rcv.width = W; rcv.height = H;
  const rctx = rcv.getContext('2d'), rimg = rctx.createImageData(W, H), rd = rimg.data;
  for (let y = 0; y < H; y++) {
    const pi = Math.min(PL - 1, Math.floor(y / ROW)), pl = planks[pi];
    const ly = y - pi * ROW;
    for (let x = 0; x < W; x++) {
      const g0 = pl.f(x / W, ly / ROW) * 0.62 + pl.fine(x / W, ly / ROW) * 0.38;
      let g = 0.76 + Math.pow(g0, 1.5) * 0.45;       // 결 대비
      let kn = 0;
      for (const [kx, ky, kr] of pl.knots) {
        const dd = Math.hypot((x - kx) * 0.9, (y - ky) * 2.2);
        if (dd < kr * 2.2) kn = Math.max(kn, (0.6 + 0.4 * Math.sin(dd * 0.9)) * Math.exp(-dd / kr) * 0.55);
      }
      g *= 1 - kn * 0.5;
      let base = [104 * pl.tone, 71 * pl.tone, 40 * pl.tone];
      if (ly < 2 || ly > ROW - 1.5) { base = [34, 23, 13]; g = 1; }      // 판재 틈
      else if (ly < 3.5) g *= 1.15;                                      // 틈 옆 모서리 하이라이트
      const i = (y * W + x) * 4;
      d[i] = base[0] * g; d[i + 1] = base[1] * g; d[i + 2] = base[2] * g; d[i + 3] = 255;
      const hh = ly < 2 || ly > ROW - 1.5 ? 84 : 128 + (g0 - 0.5) * 26 - kn * 20;
      hd[i] = hd[i + 1] = hd[i + 2] = hh; hd[i + 3] = 255;
      const rr = 196 + g0 * 36 + kn * 16;
      rd[i] = rd[i + 1] = rd[i + 2] = rr; rd[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  hctx.putImageData(himg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  return { color: cv, height: hcv, rough: rcv };
}

const tex = (canvas, srgb = false) => {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

// ── 유적 미니어처 — 지도 위에 세워 둔 게임 말 ──────────────────
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.92, flatShading: true, envMapIntensity: 0.25, ...extra,
});
function buildGiza() {
  const g = new THREE.Group();
  const sand = mat(0x9d8148), sand2 = mat(0x8f7440);
  const py = (r, h, x, z, rot, m2) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), m2 || sand);
    m.position.set(x, h / 2 + 0.002, z); m.rotation.y = rot;
    return m;
  };
  // 받침 없이 종이 위에 바로 — 붉은 펜 동그라미가 모형 발치에 드러난다
  g.add(py(0.045, 0.075, 0.012, -0.004, 0.7),
    py(0.028, 0.046, -0.052, 0.028, 0.5, sand2),
    py(0.018, 0.03, 0.052, 0.038, 0.9, sand2));
  return g;
}
function buildStonehenge() {
  const g = new THREE.Group();
  const stone = mat(0x8d8d84);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.007, 24), mat(0x6d7448));
  base.position.y = 0.0035; g.add(base);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.034, 0.009), stone);
    s.position.set(Math.cos(a) * 0.05, 0.024, Math.sin(a) * 0.05);
    s.rotation.y = -a + Math.PI / 2; s.rotation.z = (i % 3 - 1) * 0.06;
    g.add(s);
    if (i % 3 !== 2) {
      const a2 = a + Math.PI / 9;
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.007, 0.011), stone);
      l.position.set(Math.cos(a2) * 0.05, 0.044, Math.sin(a2) * 0.05);
      l.rotation.y = -a2 + Math.PI / 2;
      g.add(l);
    }
  }
  return g;
}
function buildParthenon() {
  const g = new THREE.Group();
  const marble = mat(0xd6cfbe, { roughness: 0.6 });
  for (const [w, dpt, y] of [[0.12, 0.082, 0.003], [0.112, 0.074, 0.009], [0.104, 0.066, 0.015]]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.006, dpt), marble);
    s.position.y = y; g.add(s);
  }
  for (let i = 0; i < 6; i++) {
    for (const z of [-0.024, 0.024]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.005, 0.032, 8), marble);
      col.position.set(-0.04 + i * 0.016, 0.034, z);
      g.add(col);
    }
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.008, 0.062), marble);
  arch.position.y = 0.054; g.add(arch);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.1, 3), marble);
  roof.rotation.z = Math.PI / 2; roof.scale.set(1, 1, 0.62);   // 능선이 위로 오는 삼각 프리즘
  roof.position.y = 0.064;
  g.add(roof);
  return g;
}
function buildAngkor() {
  const g = new THREE.Group();
  const laterite = mat(0x6e6252);
  const profile = [[0.017, 0], [0.02, 0.008], [0.016, 0.018], [0.012, 0.028], [0.008, 0.04], [0.0025, 0.052]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const tower = (s, x, z) => {
    const m = new THREE.Mesh(new THREE.LatheGeometry(profile, 8), laterite);
    m.scale.setScalar(s); m.position.set(x, 0.008, z);
    return m;
  };
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.008, 0.06), laterite);
  base.position.y = 0.004;
  g.add(base, tower(1.25, 0, 0), tower(0.85, -0.032, 0.012), tower(0.85, 0.032, 0.012));
  const jungle = mat(0x3d5a2e);
  for (const [x, z, r] of [[-0.055, -0.02, 0.013], [0.055, -0.018, 0.011], [0.02, 0.036, 0.009]]) {
    const t = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), jungle);
    t.position.set(x, r + 0.002, z);
    g.add(t);
  }
  return g;
}
function buildMachu() {
  const g = new THREE.Group();
  const peak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.068, 7), mat(0x5c6d3c));
  peak.position.y = 0.036; g.add(peak);
  const terrace = mat(0x8f8a74);
  for (const [r, y] of [[0.036, 0.01], [0.028, 0.021], [0.02, 0.032]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.004, 0.006, 9), terrace);
    t.position.y = y; g.add(t);
  }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.009), mat(0xa8a290));
  hut.position.set(0.004, 0.062, 0); g.add(hut);
  const wayna = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.055, 6), mat(0x4a5c33));
  wayna.position.set(-0.005, 0.0275, -0.052); g.add(wayna);
  return g;
}
const BUILDERS = { giza: buildGiza, stonehenge: buildStonehenge, parthenon: buildParthenon, angkor: buildAngkor, machu: buildMachu };

// ── 메뉴 본체 ─────────────────────────────────────────────────
export function createMenu({ onBegin, onPick, onEnter } = {}) {
  const $ = (id) => document.getElementById(id);
  const canvas = $('menucv');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // 정적 소품 몇 개라 부드러운 쪽

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0705);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.05).texture;
  pm.dispose();

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 20);
  camera.up.set(0, 0, -1);                            // 탑 뷰에서 지도의 북쪽이 화면 위

  // ── 탁자·바닥 ──
  const woodMaps = drawWoodCanvas();
  const woodM = new THREE.MeshStandardMaterial({
    map: tex(woodMaps.color, true), normalMap: tex(carveNormal(woodMaps.height, 0.42)),
    roughnessMap: tex(woodMaps.rough), roughness: 1, envMapIntensity: 0.22,
  });
  const table = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.07, 2.1), woodM);
  table.position.y = -0.035; table.receiveShadow = true;
  scene.add(table);
  const legM = new THREE.MeshStandardMaterial({ color: 0x2e1e10, roughness: 0.85 });
  for (const [x, z] of [[-1.6, -0.9], [1.6, -0.9], [-1.6, 0.9], [1.6, 0.9]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.85, 10), legM);
    leg.position.set(x, -0.5, z);
    scene.add(leg);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ color: 0x17100a, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.93; floor.receiveShadow = true;
  scene.add(floor);

  // ── 지도 종이 — 굴곡과 말린 모서리까지 실제 지오메트리로 ──
  const wave = field(880, 7, 5);
  const paperY = (x, z) => {
    const u = x / PW + 0.5, v = z / PH + 0.5;
    // 최저점이 탁자면(0)보다 확실히 위에 있어야 한다 — 골이 상판 밑으로
    // 내려가면 그 자리가 「구멍」처럼 나무를 드러낸다.
    let y = 0.012 + (wave(u, v) - 0.5) * 0.015;
    const d = Math.hypot(x + PW / 2, z - PH / 2);     // 남서 모서리 말림
    if (d < 0.4) y += Math.pow(1 - d / 0.4, 2.1) * 0.055;
    return y;
  };
  const maps = drawMapCanvas();
  const paperGeo = new THREE.PlaneGeometry(PW, PH, 84, 52);
  paperGeo.rotateX(-Math.PI / 2);
  {
    const pos = paperGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, paperY(pos.getX(i), pos.getZ(i)));
    paperGeo.computeVertexNormals();
  }
  const paperM = new THREE.MeshStandardMaterial({
    map: tex(maps.color, true), normalMap: tex(carveNormal(maps.height, 1.1)),
    alphaMap: tex(maps.alpha), transparent: true, alphaTest: 0.5,
    roughness: 0.94, side: THREE.DoubleSide, envMapIntensity: 0.12,
  });
  const paper = new THREE.Mesh(paperGeo, paperM);
  paper.rotation.y = -0.045;                          // 「대충 펼쳐 놓은」 비스듬함
  paper.receiveShadow = true;
  scene.add(paper);
  paper.updateMatrixWorld(true);

  // ── 유적 미니어처 + 판정 프록시 ──
  const hitProxies = [], rings = new Map(), anchors = new Map();
  const ringGeo = new THREE.TorusGeometry(0.068, 0.0032, 8, 40);
  for (const m of MAPS) {
    const [u, v] = uvOf(m.lon, m.lat);
    const p = new THREE.Vector3((u - 0.5) * PW, 0, (v - 0.5) * PH);
    p.y = paperY(p.x, p.z);
    p.applyMatrix4(paper.matrixWorld);
    const g = BUILDERS[m.id]();
    g.position.copy(p);
    g.rotation.y = (rng(Math.round(m.lon * 7) + 99)() - 0.5) * 0.8;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.13, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    proxy.position.y = 0.05; proxy.userData.map = m;
    g.add(proxy); hitProxies.push(proxy);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
      color: 0xe8c477, emissive: 0xc99b3e, emissiveIntensity: 0.9, roughness: 0.4,
    }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.006; ring.visible = false;
    g.add(ring);
    rings.set(m.id, ring); anchors.set(m.id, p.clone());
    scene.add(g);
  }

  // ── 소품 — 놋 등잔(광원)·나침반·돋보기·두루마리·단검·잉크병·동전 ──
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 0.95, roughness: 0.32, envMapIntensity: 0.6 });
  const props = new THREE.Group();
  scene.add(props);
  const put = (obj, x, y, z, ry = 0) => {
    obj.position.set(x, y, z); obj.rotation.y = ry;
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    props.add(obj);
    return obj;
  };
  // 등잔 — 실제 광원이 이 안에 있다
  const lamp = new THREE.Group();
  let flame;
  {
    const pts = [[0.055, 0], [0.06, 0.008], [0.03, 0.02], [0.045, 0.05], [0.05, 0.07], [0.028, 0.085], [0.012, 0.09]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    lamp.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 20), brass));
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.011, 0.07, 8), brass);
    spout.rotation.z = 1.2; spout.position.set(0.06, 0.075, 0);
    lamp.add(spout);
    flame = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 8),
      new THREE.MeshBasicMaterial({ color: 0xffcf7a }));
    flame.position.set(0.093, 0.105, 0);
    lamp.add(flame);
  }
  put(lamp, -1.38, 0, -0.72, 0.5);
  const lampLight = new THREE.PointLight(0xffc274, 2.1, 7, 2);
  lampLight.position.set(-1.26, 0.34, -0.66);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.bias = -0.003;
  scene.add(lampLight);
  // 나침반
  const compass = new THREE.Group();
  {
    compass.add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.058, 0.02, 24), brass));
    const fcv = document.createElement('canvas'); fcv.width = fcv.height = 128;
    const fc = fcv.getContext('2d');
    fc.fillStyle = '#e6dfc9'; fc.beginPath(); fc.arc(64, 64, 62, 0, 6.3); fc.fill();
    fc.strokeStyle = '#4a3520'; fc.lineWidth = 2; fc.beginPath(); fc.arc(64, 64, 56, 0, 6.3); fc.stroke();
    fc.fillStyle = '#4a3520'; fc.font = '700 20px Georgia'; fc.textAlign = 'center'; fc.textBaseline = 'middle';
    fc.fillText('N', 64, 18); fc.fillText('S', 64, 110); fc.fillText('E', 110, 64); fc.fillText('W', 18, 64);
    fc.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      fc.beginPath(); fc.moveTo(64 + Math.sin(a) * 48, 64 - Math.cos(a) * 48);
      fc.lineTo(64 + Math.sin(a) * 54, 64 - Math.cos(a) * 54); fc.stroke();
    }
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.048, 24),
      new THREE.MeshStandardMaterial({ map: tex(fcv, true), roughness: 0.5 }));
    face.rotation.x = -Math.PI / 2; face.position.y = 0.0102;
    compass.add(face);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.0016, 0.007),
      new THREE.MeshStandardMaterial({ color: 0x8a2418, metalness: 0.4, roughness: 0.4 }));
    needle.position.y = 0.013; needle.rotation.y = 0.9;
    compass.add(needle);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24),
      new THREE.MeshStandardMaterial({ color: 0xdfe8ee, transparent: true, opacity: 0.16, roughness: 0.05, envMapIntensity: 0.9 }));
    glass.rotation.x = -Math.PI / 2; glass.position.y = 0.019;
    compass.add(glass);
  }
  put(compass, -1.45, 0.01, 0.55, 0.3);
  // 돋보기 — 지도 남동쪽 귀퉁이에 걸쳐 놓았다
  const magnifier = new THREE.Group();
  {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.009, 12, 40), brass);
    rim.rotation.x = Math.PI / 2;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.08, 32),
      new THREE.MeshStandardMaterial({
        color: 0xe8eef2, transparent: true, opacity: 0.13, roughness: 0.04,
        envMapIntensity: 1, side: THREE.DoubleSide,
      }));
    lens.rotation.x = -Math.PI / 2;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.17, 10),
      new THREE.MeshStandardMaterial({ color: 0x35220f, roughness: 0.7 }));
    grip.rotation.z = Math.PI / 2; grip.rotation.y = -0.6;
    grip.position.set(0.15, 0, 0.1);
    magnifier.add(rim, lens, grip);
  }
  put(magnifier, 0.98, 0.028, 0.52, -0.4);
  // 두루마리 둘 — 단면에 나선을 그려 만 종이처럼
  const scrollCapTex = (() => {
    const scv = document.createElement('canvas'); scv.width = scv.height = 64;
    const sc = scv.getContext('2d');
    sc.fillStyle = '#cbb58a'; sc.fillRect(0, 0, 64, 64);
    sc.strokeStyle = 'rgba(90,70,45,.65)'; sc.lineWidth = 2;
    sc.beginPath();
    for (let a = 0; a < 22; a += 0.15) {
      const r2 = 2 + a * 1.32;
      const X = 32 + Math.cos(a) * r2, Y = 32 + Math.sin(a) * r2;
      a === 0 ? sc.moveTo(X, Y) : sc.lineTo(X, Y);
    }
    sc.stroke();
    return tex(scv, true);
  })();
  const scrollBody = new THREE.MeshStandardMaterial({ color: 0xc9b489, roughness: 0.95 });
  const scrollCap = new THREE.MeshStandardMaterial({ map: scrollCapTex, roughness: 0.95 });
  const makeScroll = (len, r) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 18), [scrollBody, scrollCap, scrollCap]);
    m.rotation.z = Math.PI / 2;                       // 눕힌다
    return m;
  };
  {
    const s1 = new THREE.Group(); s1.add(makeScroll(0.52, 0.024));
    put(s1, -0.55, 0.032, -0.82, 0.12);
    const s2 = new THREE.Group();
    const roll = makeScroll(0.4, 0.02); s2.add(roll);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0035, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x5a2c1a, roughness: 0.8 }));
    tie.rotation.y = Math.PI / 2; s2.add(tie);
    put(s2, 0.42, 0.024, 0.84, -0.18);
  }
  // 단검
  const dagger = new THREE.Group();
  {
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9c0c4, metalness: 0.9, roughness: 0.28, envMapIntensity: 0.8 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.004, 0.018), steel);
    blade.position.x = 0.085;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0128, 0.038, 4), steel);
    tip.rotation.z = -Math.PI / 2; tip.rotation.x = Math.PI / 4;
    tip.scale.z = 0.22; tip.position.set(0.189, 0, 0);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.007, 0.05), brass);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0095, 0.062, 10),
      new THREE.MeshStandardMaterial({ color: 0x33210f, roughness: 0.75 }));
    grip.rotation.z = Math.PI / 2; grip.position.x = -0.036;
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 10, 8), brass);
    pommel.position.x = -0.072;
    dagger.add(blade, tip, guard, grip, pommel);
  }
  put(dagger, 1.32, 0.012, -0.5, -2.6);
  // 잉크병과 펜
  {
    const pot = new THREE.Group();
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: 0x11161a, roughness: 0.15, metalness: 0.1, envMapIntensity: 0.8 }));
    jar.position.y = 0.025;
    const neck = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.004, 8, 16), brass);
    neck.rotation.x = Math.PI / 2; neck.position.y = 0.052;
    pot.add(jar, neck);
    put(pot, 1.42, 0, 0.62, 0);
    const pen = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0042, 0.15, 8),
      new THREE.MeshStandardMaterial({ color: 0x241505, roughness: 0.6 }));
    shaft.rotation.z = Math.PI / 2;
    const nib = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.018, 6), brass);
    nib.rotation.z = -Math.PI / 2; nib.position.x = 0.083;
    pen.add(shaft, nib);
    put(pen, 1.22, 0.006, 0.72, 0.5);
  }
  // 동전 몇 닢
  {
    const goldM = new THREE.MeshStandardMaterial({ color: 0xd4a944, metalness: 1, roughness: 0.3, envMapIntensity: 0.8 });
    for (const [x, z, ry] of [[1.28, 0.18, 0.3], [1.34, 0.25, 1.2], [1.24, 0.29, 2.1], [0.55, -0.86, 0.8], [0.62, -0.8, 1.7]]) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.0032, 18), goldM);
      put(coin, x, 0.0046, z, ry);
    }
  }

  // ── 조명 ──
  scene.add(new THREE.HemisphereLight(0x8a7355, 0x0b0705, 0.32));
  const moon = new THREE.DirectionalLight(0x8fa5c8, 0.22);
  moon.position.set(1.8, 2.6, 1.2);
  scene.add(moon);
  const fill = new THREE.PointLight(0xffdfae, 0.6, 6, 2);
  fill.position.set(0.7, 1.6, 0.35);
  scene.add(fill);
  // 씬이 정적이므로 그림자 깊이 패스는 첫 프레임에 한 번만 굽는다
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  // ── 카메라 연출 ──
  const CAM = {
    title: { pos: new THREE.Vector3(0.02, 2.34, 0.05), look: new THREE.Vector3(0, 0, -0.03) },
    select: { pos: new THREE.Vector3(0, 1.22, 0.6), look: new THREE.Vector3(0, 0, -0.08) },
  };
  const cur = { pos: CAM.title.pos.clone(), look: CAM.title.look.clone() };
  let tween = null;
  const flyTo = (pos, look, dur, onDone) => {
    tween = { a: { pos: cur.pos.clone(), look: cur.look.clone() }, b: { pos, look }, t: 0, dur, onDone };
  };

  // ── 상호작용 ──
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let phase = 'title', hovered = null, selected = null;
  const tip = $('mTip'), panel = $('mPanel'), enterBtn = $('mEnter');
  const refreshRings = () => {
    for (const m of MAPS) rings.get(m.id).visible = m === hovered || m === selected;
  };
  const select = (m) => {
    selected = m;
    refreshRings();
    if (!m) { panel.classList.remove('show'); return; }
    panel.querySelector('.m-region').textContent = m.region;
    panel.querySelector('.m-name').textContent = m.name;
    enterBtn.disabled = !m.playable;
    enterBtn.textContent = m.playable ? '모험하기' : '준비 중';
    panel.classList.add('show');
    onPick?.(m);
  };
  const onMove = (ev) => {
    if (phase !== 'select') return;
    ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hitProxies, false)[0];
    const m = hit ? hit.object.userData.map : null;
    if (m !== hovered) { hovered = m; refreshRings(); }
    canvas.style.cursor = m ? 'pointer' : 'default';
    if (m) {
      tip.textContent = m.name;
      tip.style.display = 'block';
      tip.style.left = `${Math.min(innerWidth - 180, ev.clientX + 16)}px`;
      tip.style.top = `${ev.clientY + 14}px`;
    } else tip.style.display = 'none';
  };
  const onClick = () => {
    if (phase !== 'select') return;
    select(hovered);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('click', onClick);

  const toSelect = () => {
    if (phase !== 'title') return;
    phase = 'select';
    onBegin?.();
    $('mTitle').classList.add('hide');
    $('mCaption').classList.add('show');
    flyTo(CAM.select.pos, CAM.select.look, 1.6);
  };
  const enterMap = () => {
    if (phase !== 'select' || !selected?.playable) return;
    phase = 'enter';
    panel.classList.remove('show');
    $('mCaption').classList.remove('show');
    tip.style.display = 'none';
    canvas.style.cursor = 'default';
    const p = anchors.get(selected.id);
    flyTo(p.clone().add(new THREE.Vector3(0.03, 0.36, 0.27)), p.clone(), 1.35,
      () => onEnter?.(selected));
    setTimeout(() => $('mFade').classList.add('on'), 620);
  };
  $('mAdventure').addEventListener('click', toSelect);
  enterBtn.addEventListener('click', enterMap);

  // ── 루프 ──
  let running = false, raf = 0, last = 0, T = 0;
  const frame = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now; T += dt;
    if (tween) {
      tween.t += dt;
      const p = Math.min(1, tween.t / tween.dur), e = p * p * (3 - 2 * p);
      cur.pos.lerpVectors(tween.a.pos, tween.b.pos, e);
      cur.look.lerpVectors(tween.a.look, tween.b.look, e);
      if (p >= 1) { const cb = tween.onDone; tween = null; cb?.(); }
    }
    // 숨 쉬듯 아주 느린 표류 + 등잔 불꽃의 흔들림
    camera.position.set(cur.pos.x + Math.sin(T * 0.21) * 0.013, cur.pos.y, cur.pos.z + Math.cos(T * 0.16) * 0.013);
    camera.lookAt(cur.look);
    const fl = Math.sin(T * 11) * 0.5 + Math.sin(T * 23 + 1.7) * 0.3 + Math.sin(T * 5.1) * 0.2;
    lampLight.intensity = 2.1 + fl * 0.4;
    flame.scale.set(1, 1 + fl * 0.16, 1);
    const ringOn = hovered || selected;
    if (ringOn) rings.get(ringOn.id).material.emissiveIntensity = 0.75 + Math.sin(T * 4) * 0.35;
    renderer.render(scene, camera);
  };
  const start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);
  start();

  return {
    get phase() { return phase; },
    get selected() { return selected; },
    start, stop,
    toSelect,
    pick: (id) => { const m = MAPS.find((x) => x.id === id); if (m && phase === 'select') select(m); },
    enter: enterMap,
    // 입장이 거부되면(포인터 락 실패) 지도 화면으로 되돌린다
    abortEnter: () => {
      if (phase !== 'enter') return;
      $('mFade').classList.remove('on');
      phase = 'select';
      $('mCaption').classList.add('show');
      flyTo(CAM.select.pos, CAM.select.look, 0.8);
    },
    // 테스트용: 유적의 화면 좌표
    screenPos: (id) => {
      const p = anchors.get(id)?.clone();
      if (!p) return null;
      p.project(camera);
      return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
    },
    dispose: () => {
      stop();
      removeEventListener('resize', onResize);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('click', onClick);
      renderer.dispose();
    },
  };
}
