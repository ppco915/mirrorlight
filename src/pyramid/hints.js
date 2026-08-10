// pyramid/hints.js — 막혔을 때 짚어 주는 한 마디 (H 길게, 세 번까지).
//
// 규칙 하나: 답을 말하지 않는다. 지금 무엇을 해야 하는지가 아니라,
// 지금 무엇이 걸림돌인지를 짚는다. 「벽돌을 뽑아 열쇠를 넣어라」가 아니라
// 「손에 든 것은 유리를 건너지 못한다」 쪽이다.
//
// 힌트는 세계선의 현재 상태에서 파생된다 — 진행에 따라 저절로 다음 것이 나온다.
// 사다리의 위에서부터 훑어 「아직 안 된 것」 중 가장 이른 것을 짚는다.

import { state, Key1, Chisel, Pin, Brick } from './causal.js';

// 벽돌 하나에 열쇠와 핀이 차례로 실린다 — 두 번 다 같은 걸림돌을 만나므로
// 배달 단계의 문구는 물건 이름만 바꿔 함께 쓴다.
function relayHint(type, hidden, what) {
  if (state.presentBrickOut && type === hidden) {
    return '벽돌은 빠졌다. 구멍 속에 남은 것은 손을 넣어 따로 집어야 한다.';
  }
  if (type === hidden) {
    return state.brickP1.type === Brick.WALL
      ? '숨기고 벽을 닫아 두었다면 그 자리에 그대로 있다. 수천 년 뒤의 같은 벽을 살펴라.'
      : '구멍을 열어 둔 채로 시대를 넘기면, 그 사이에 누군가 뒤져 간다.';
  }
  // 두 열거형이 같은 문자열을 쓰므로 비교는 하나로 족하다
  if (type === Key1.CARRIED) {
    return `손에 든 것은 유리를 건너지 못한다. ${what} 남기려면 시간이 손대지 못할 자리에 두고 와야 한다 — 이 방의 벽에 색이 다른 돌이 하나 있다.`;
  }
  return null;
}

export function nextHint() {
  // ── 문제 1: 잠긴 돌문과 묻힌 열쇠 ──
  if (!state.doorOpen) {
    const k = state.key1.type;
    if (k === Key1.RETRIEVED) return '되찾은 열쇠가 들어갈 구멍은 이 방에 하나뿐이다.';
    const relay = relayHint(k, Key1.BRICK, '열쇠를');
    if (relay) return relay;
    if (k === Key1.FLOOR) {
      return '과거의 바닥에 그냥 두고 온 것은 모래와 세월이 가져간다. 다시 건너가 제대로 감춰라.';
    }
    return '돌무더기 아래의 반짝임은 이 시대에서 꺼낼 수 없다. 무너지기 전의 시대라면 그것이 어디에 놓여 있었는지 볼 수 있다.';
  }

  // ── 문제 2: 굳은 회반죽과 금고 ──
  if (!state.scarabTaken) {
    const c = state.chisel.type, p = state.pin.type;
    if (state.vaultOpenP1) {
      return '과거에서 열어 둔 것은 그 뒤 수천 년 동안 도굴꾼에게도 열려 있었다. 떠나기 전에 닫아라.';
    }
    if (state.vaultOpenNow) return '금고는 이미 열렸다. 밀랍 받침 위의 것을 집으면 된다.';
    if (p === Pin.RETRIEVED) return '청동 로제트 한가운데에 작은 홈이 나 있다.';
    const relay = relayHint(p, Pin.BRICK, '핀을');
    if (relay) return relay;
    if (p === Pin.HEARTH) {
      return '화덕돌 밑은 다음 시대까지는 견딘다. 하지만 도굴꾼의 손까지 견디지는 못한다.';
    }
    if (p === Pin.P1FLOOR) return '과거의 바닥에 둔 것은 세월이 가져간다. 다시 감춰라.';
    if (state.plasterOpen) return '회반죽을 뜯은 자리에 드러난 것부터 챙겨라.';
    if (c === Chisel.CARRIED) {
      return '연장도 유리를 건너지 못한다. 사제들조차 들추지 않을 돌 밑이라면 다음 시대까지 남는다.';
    }
    if (c === Chisel.HEARTH) {
      return '화덕돌 밑에 둔 것은 다음 시대에도 그 자리에 있다. 회반죽을 뜯을 것은 그것이다.';
    }
    if (c === Chisel.P1FLOOR) {
      return '내려놓은 연장은 그 자리에 그대로 있다. 회반죽을 뜯을 것은 그것이다.';
    }
    return '이 시대의 회반죽은 돌처럼 굳었다. 회반죽을 갓 바르던 시대보다 더 오래된 시대라면, 그것을 다루던 연장이 아직 쓰이고 있다.';
  }

  // ── 문제 3: 신의 이름과 가짜 문 ──
  if (!state.escaped) {
    if (!state.collarSeated) {
      return '금고에서 나온 것은 스카라베만이 아니었다. 벽화 속 자칼의 목 언저리가 비어 있다.';
    }
    if (!state.scarabSeated) return '가짜 문 한가운데에 풍뎅이 모양으로 파인 자리가 있다.';
    return '목걸이의 구슬 세 개가 각각 짚고 있는 글자를, 왼쪽부터 그 차례대로.';
  }
  return null;
}
