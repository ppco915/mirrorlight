# 텍스처 에셋 출처

이 디렉터리의 PBR 텍스처는 전부 [Poly Haven](https://polyhaven.com)의 **CC0**
(퍼블릭 도메인) 에셋이다. 각 세트는 `diff.jpg`(베이스 컬러) ·
`nor_gl.jpg`(노멀, GL 방향) · `arm.jpg`(AO·러프니스·메탈 팩) 3장으로 구성된다.

| 디렉터리 | 원본 에셋 | 용도 |
| --- | --- | --- |
| `large_sandstone_blocks_01` | Large Sandstone Blocks 01 | 벽·석축 |
| `mixed_stone_tiles` | Mixed Stone Tiles | 바닥 |
| `granite_wall` | Granite Wall | 문·문틀·좌대·제단 |
| `rock_boulder_dry` | Rock Boulder Dry | 붕괴 잔해 바위 |
| `dense_sand` | Dense Sand | 모래 둔덕·사구 |
| `rough_plaster_broken` | Rough Plaster Broken | 봉인 회반죽 |
| `worn_cracked_plaster` | Worn Cracked Plaster | 현재 시대의 갈라진 천장 |

상형문자 띠·별 천장·날개 태양·불꽃·먼지 텍스처는 외부 에셋이 아니라
`src/pyramid/assets.js`가 캔버스로 합성한다 (음각 노멀맵은 높이맵 소벨 변환).
