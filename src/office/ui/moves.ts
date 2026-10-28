// Office move catalogue (칼퇴근 대작전), swapped in for src/ui/moves.ts: the same moves and gestures, named
// after the office props that stand in for each hazard (spec §5). Glyphs come from the v8 module.
import type { MoveId } from '../../types';
import type { MoveInfo } from '../../ui/moves';

export * from '../../ui/moves';

export const MOVES: Readonly<Record<MoveId, MoveInfo>> = {
  jump: { id: 'jump', name: '점프', hint: '오른쪽 탭: 점프. 바닥의 서류 더미 넘기.', gesture: '탭', tone: 'sky' },
  beam: { id: 'beam', name: '결재판 부메랑', hint: '날아오는 결재판 개수만큼 점프 단수를 맞춘다.', gesture: '탭', tone: 'pink' },
  double: { id: 'double', name: '2단 점프', hint: '공중에서 한 번 더 탭: 2단 점프.', gesture: '탭 ×2', tone: 'violet' },
  slide: { id: 'slide', name: '숙이기', hint: '오른쪽 아래로 밀기: 숙이기. 머리 위 장애물 피하기.', gesture: '오른쪽 ↓', tone: 'mint' },
  drone: { id: 'drone', name: '종이비행기 편대', hint: '편대 구간은 낮게. 2단 점프 금지.', gesture: '탭 1회', tone: 'sun', warn: true },
  triple: { id: 'triple', name: '3단 점프', hint: '세 번 탭: 3단 점프. 높이 쌓인 결재판 넘기.', gesture: '탭 ×3', tone: 'violet' },
  high: { id: 'high', name: '커피 쟁반', hint: '머리 높이로 날아오는 쟁반은 점프 말고 숙이기.', gesture: '오른쪽 ↓', tone: 'mint' },
  rear: { id: 'rear', name: '뒤에서 날아오는 서류', hint: '뒤에서 접근! 경고 표식 확인 후 점프.', gesture: '경고 후 탭', tone: 'pink', warn: true },
  gate: { id: 'gate', name: '서류 + 편대', hint: '바닥 서류와 종이비행기: 1단 점프만.', gesture: '탭 1회', tone: 'sun', warn: true },
  pulse: { id: 'pulse', name: '서류 연타', hint: '줄줄이 쌓인 서류. 박자에 맞춰 연속 점프.', gesture: '박자 탭', tone: 'sky' },
  lane: { id: 'lane', name: '레인 이동', hint: '왼쪽 위·아래로 밀기: 레인 이동. 포스트잇 폭풍 피하기.', gesture: '왼쪽 ↑↓', tone: 'mint' },
  drop: { id: 'drop', name: '용지 걸림', hint: '경고등 켜진 레인에서 미리 비키기.', gesture: '왼쪽 ↑↓', tone: 'sun', warn: true },
  chaser: { id: 'chaser', name: '따라오는 상사', hint: '뒤에서 상사가 쫓아온다! 표식 레인에서 비키기.', gesture: '왼쪽 ↑↓', tone: 'pink', warn: true },
  lanejump: { id: 'lanejump', name: '이동 + 점프', hint: '레인 이동과 점프를 동시에.', gesture: '↑↓ + 탭', tone: 'violet' },
};

/** result card tip: what the prop is → what to do (one line) */
export const FAIL_TIPS: Readonly<Record<MoveId, string>> = {
  jump: '서류 더미 → 발 앞에 오기 직전 탭',
  beam: '결재판 → 개수만큼 탭',
  double: '결재판 2장 → 점프 꼭대기에서 한 번 더 탭',
  triple: '결재판 3장 → 박자에 맞춰 탭 세 번',
  slide: '머리 위 장애물 → 오른쪽 아래로 밀어 숙이기',
  high: '커피 쟁반 → 점프 말고 숙이기',
  drone: '종이비행기 편대 → 2단 점프 금지, 탭 한 번만',
  gate: '서류 + 편대 → 1단 점프만 (탭 한 번)',
  rear: '뒤에서 오는 서류 → 경고 표식을 보고 박자에 탭',
  pulse: '서류 연타 → 박자마다 짧게 연속 탭',
  lane: '포스트잇 폭풍 → 왼쪽 위·아래로 밀어 레인 이동',
  drop: '용지 걸림 → 경고등 레인에서 미리 비키기',
  chaser: '따라오는 상사 → 표식 레인에서 옆으로 이동',
  lanejump: '이동 + 점프 → 레인 먼저 옮기고 바로 탭',
};

/** guide sheet order = the order the five office stages teach them (spec §13) */
export const MOVE_ORDER: readonly MoveId[] = [
  'jump', 'slide', 'lane', 'double', 'beam', 'drone', 'drop', 'chaser', 'high', 'triple', 'rear',
];
