// Office move sheet (part-1 playtest): the guide lists every move the ten stages teach, in teaching order,
// and all move copy uses one word per move — 점프 / 숙이기 / 줄 바꾸기.
import { describe, expect, it } from 'vitest';
import { FAIL_TIPS, MOVE_ORDER, MOVES } from '../../src/office/ui/moves';

describe('office move sheet', () => {
  it('teaches 12 moves: part 1 in stage order, then 7단계 lanejump', () => {
    expect(MOVE_ORDER).toEqual(['jump', 'slide', 'lane', 'double', 'beam', 'drone', 'drop', 'chaser', 'high', 'triple', 'rear', 'lanejump']);
  });

  it('says 줄 바꾸기 / 숙이기 / 점프 (never 레인, 슬라이딩, 옆으로 비키기)', () => {
    for (const id of MOVE_ORDER) {
      const text = `${MOVES[id].name} ${MOVES[id].hint} ${FAIL_TIPS[id]}`;
      expect(text, id).not.toMatch(/레인|슬라이딩|옆으로 비키/);
    }
    expect(MOVES.lane.name).toBe('줄 바꾸기');
    expect(MOVES.lanejump.name).toBe('줄 바꾸기 + 점프');
  });
});
