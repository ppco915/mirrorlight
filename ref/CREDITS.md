# 외부 에셋 · 오픈소스 출처 목록

《거울빛: 쌍거울의 무덤》에 사용된 모든 외부 자원의 출처와 라이선스를 정리한
문서입니다. 아래에 명시된 항목을 제외한 나머지는 전부 자체 제작물입니다 —
맵(두 방·복도)과 모든 소품(거울·제단·단지·화덕·금고·가짜 문·해골 폴백 등)의
지오메트리는 three.js 기본 도형을 코드로 조립해 만들었고, 상형문자·별 천장·
날개 태양·불꽃·먼지 텍스처는 캔버스로 합성했습니다(외부 이미지 없음).

라이선스 요약:

- **CC0 (퍼블릭 도메인)** — 출처 표기 의무 없음. 본 문서에는 감사의 뜻으로 기재.
- **CC-BY 3.0 / CC-BY** — 저작자 표기 의무 있음. 본 문서의 표기로 이행함.
- **MIT / SIL OFL 1.1** — 오픈소스 라이브러리·폰트 라이선스. 고지로 이행함.

---

## 1. 3D 모델

| 파일 | 에셋 (저작자) | 라이선스 | 출처 | 사용처 / 변형 |
| --- | --- | --- | --- | --- |
| `assets/models/skull.glb` | skull003 (Jake K-H) | CC-BY | [poly.pizza/m/bjf0z6Qb9Tv](https://poly.pizza/m/bjf0z6Qb9Tv) | 봉인문 앞 도굴꾼의 해골 3구 — 재질을 뼈 빛깔로 교체 |
| `assets/models/hand.glb` | Fists (Sean Tarrant) | CC-BY | [poly.pizza/m/0ZYcRcJnZ74](https://poly.pizza/m/0ZYcRcJnZ74) | 탈출 시네마틱의 1인칭 손 — 재질을 살빛으로 교체 |

## 2. PBR 텍스처 — Poly Haven (전부 CC0)

모두 [Poly Haven](https://polyhaven.com)의 CC0 텍스처입니다. 각 세트는
`diff`(베이스 컬러) · `nor_gl`(노멀) · `arm`(AO·러프니스·메탈) 3장으로
구성되며, 해상도 축소 외의 변형은 없습니다.

| 디렉터리 (`assets/textures/`) | 원본 에셋 | 사용처 |
| --- | --- | --- |
| `large_sandstone_blocks_01` | [Large Sandstone Blocks 01](https://polyhaven.com/a/large_sandstone_blocks_01) | 벽·석축 |
| `mixed_stone_tiles` | [Mixed Stone Tiles](https://polyhaven.com/a/mixed_stone_tiles) | 바닥 |
| `granite_wall` | [Granite Wall](https://polyhaven.com/a/granite_wall) | 문·문틀·좌대·제단 |
| `rock_boulder_dry` | [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry) | 붕괴 잔해 바위 |
| `dense_sand` | [Dense Sand](https://polyhaven.com/a/dense_sand) | 모래 둔덕·사구 |
| `rough_plaster_broken` | [Rough Plaster Broken](https://polyhaven.com/a/rough_plaster_broken) | 봉인 회반죽 |
| `worn_cracked_plaster` | [Worn Cracked Plaster](https://polyhaven.com/a/worn_cracked_plaster) | 현재 시대의 갈라진 천장 |

## 3. 사운드 — OpenGameArt

| 파일 (`assets/audio/`) | 에셋 (저작자) | 라이선스 | 출처 | 사용처 / 변형 |
| --- | --- | --- | --- | --- |
| `dungeon_ambient.ogg` | Loopable Dungeon Ambience | CC0 | [OpenGameArt](https://opengameart.org/content/loopable-dungeon-ambience) | 현재 시대 배경 앰비언스 |
| `fire_loop.wav` | Fireplace Sound Loop | CC0 | [OpenGameArt](https://opengameart.org/content/fireplace-sound-loop) | 과거 시대 횃불 — 20초·모노 리샘플 |
| `stone_door.ogg` | Stone Door | CC0 | [OpenGameArt](https://opengameart.org/content/stone-door) | 돌문·가짜 문 개방 |
| `steps/Fantozzi-Stone{L,R}{1,2,3}.ogg` | Fantozzi's Footsteps (Fantozzi) | CC0 | [OpenGameArt](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone) | 돌바닥 발소리 — 저속 재생 + 저역 레이어 |
| `sfx100v2_stones_0{1,2,3}.ogg` | 100 CC0 SFX #2 (rubberduck) | CC0 | [OpenGameArt](https://opengameart.org/content/100-cc0-sfx-2) | 벽돌 뽑기·끼우기, 거울 회전 저역 |
| `shimmer.flac` | Shimmer / Glitter / Magic | CC-BY 3.0 | [OpenGameArt](https://opengameart.org/content/shimmer-glitter-magic) | 거울 이동 반짝임 |
| `pickup_0{0,1,2}.wav` | Fantasy Sound Effects Library (Little Robot Sound Factory) | CC-BY 3.0 | [OpenGameArt](https://opengameart.org/content/fantasy-sound-effects-library) | 아이템 획득 차임 — 16비트 변환 |
| `jingle_win.wav` | Fantasy Sound Effects Library (Little Robot Sound Factory) | CC-BY 3.0 | [OpenGameArt](https://opengameart.org/content/fantasy-sound-effects-library) | 탈출 시네마틱 전리품 징글 — 16비트·모노 변환 |

## 4. 라이브러리 · 폰트

| 자원 | 버전 | 라이선스 | 출처 | 사용처 |
| --- | --- | --- | --- | --- |
| [Three.js](https://threejs.org) (GLTFLoader, RoomEnvironment 포함) | r160 | MIT | [github.com/mrdoob/three.js](https://github.com/mrdoob/three.js) | 렌더링 엔진 전반 (unpkg CDN 로드) |
| [Pretendard](https://github.com/orioncactus/pretendard) | v1.3.9 | SIL OFL 1.1 | [github.com/orioncactus/pretendard](https://github.com/orioncactus/pretendard) | 게임 UI 서체 (jsDelivr CDN 로드) |
| [Noto Sans KR](https://fonts.google.com/noto/specimen/Noto+Sans+KR) | — | SIL OFL 1.1 | Google Fonts | 제출 문서(`docs/게임소개.html`) 서체 |

## 5. 이식한 코드

| 위치 | 원본 | 라이선스 | 내용 |
| --- | --- | --- | --- |
| `src/mirror.js` | Three.js r160 예제 [`Reflector.js`](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Reflector.js) | MIT | 반사 가상 카메라·사선 근평면 클리핑 수식을 이식하고, 대상 씬을 과거 씬으로 바꾸는 개조를 더함 |

## 6. 인접 선례 (디자인 참고 — 자원 사용 없음)

Viewfinder, The Art of Reflection, Shady Part of Me, In My Shadow,
Day of the Tentacle, The Past Within — 메커니즘 발상의 참고로만 언급하며,
어떤 자원도 사용하지 않았습니다.
