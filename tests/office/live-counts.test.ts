// The run hook's weekly-goal counts, folded from a session's events (office module graph).
import { describe, expect, it } from 'vitest';
import { stageById } from '../../src/core/content';
import { createSession, type GameEvent } from '../../src/game/session';
import { ZERO_COUNTS, startCounts, trackCounts } from '../../src/office/game/live/counts';
import { dailyPlan } from '../../src/office/core/live';
import { HAZARD_KINDS, type Beat, type StageDef } from '../../src/types';

const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const judge = (beatId: number, over: Partial<{ grade: 'perfect' | 'great' | 'miss'; hit: boolean; items: number }> = {}): GameEvent => ({
  type: 'judge', shielded: false,
  result: { beatId, grade: over.grade ?? 'perfect', hit: over.hit ?? false, reason: over.hit ? 'low' : null, collected: over.items ? ['coin'] : [], ...(over.items ? { items: over.items } : {}) },
});
const session = (id: string, seed = 7) => createSession('stage', { ...(stageById(id) as StageDef), seed });

describe('live run counts', () => {
  it('starts at zero for every metric', () => {
    expect(startCounts()).toEqual(ZERO_COUNTS);
    expect(Object.values(ZERO_COUNTS).every((v) => v === 0)).toBe(true);
  });

  it('counts perfects, jumps (jump / boost taps) and 아이스 아메리카노 pickups as coffee', () => {
    const s = session('w2-s10');
    const ev: GameEvent[] = [
      judge(s.beats[0].id), judge(s.beats[1].id, { grade: 'great' }),
      { type: 'tap', action: 'jump', level: 1 }, { type: 'tap', action: 'boost', level: 2 }, { type: 'tap', action: 'none', level: 0 },
      { type: 'pickup', kind: 'slow' }, { type: 'pickup', kind: 'heart' },
    ];
    expect(trackCounts(startCounts(), s, ev)).toEqual({ ...ZERO_COUNTS, perfects: 1, jumps: 2, coffee: 1 });
  });

  it('mission items count by the collectible of the part: 커피 쿠폰 → coffee, 서류 → docs', () => {
    const s1 = session('w1-s10'); // part 1 collects 커피 쿠폰
    const coupon = s1.beats.find((b) => b.part === 1 && b.obstacles.some((o) => o.kind === 'coin'))!;
    expect(trackCounts(startCounts(), s1, [judge(coupon.id, { items: 1 })]).coffee).toBe(1);
    const s2 = session('w2-s10'); // part 0 collects 서류
    const doc = s2.beats.find((b) => b.part === 0 && b.obstacles.some((o) => o.kind === 'coin'))!;
    expect(trackCounts(startCounts(), s2, [judge(doc.id, { items: 2 })]).docs).toBe(2);
  });

  it('dodge-dinner counts hazards passed while 윤이사 is the superior', () => {
    const s9 = session('w9-s10');
    const hz = s9.beats.filter(isHazard);
    const c = trackCounts(startCounts(), s9, [judge(hz[0].id), judge(hz[1].id, { hit: true, grade: 'miss' }), judge(hz[2].id)]);
    expect(c['dodge-dinner']).toBe(2);
    const s5 = session('w5-s10'); // 윤이사 is section 1 only
    const sec0 = s5.beats.find((b) => b.section === 0 && isHazard(b))!;
    const sec1 = s5.beats.find((b) => b.section === 1 && isHazard(b))!;
    expect(trackCounts(startCounts(), s5, [judge(sec0.id), judge(sec1.id)])['dodge-dinner']).toBe(1);
    expect(trackCounts(startCounts(), session('w3-s10'), [judge(session('w3-s10').beats.find(isHazard)!.id)])['dodge-dinner']).toBe(0);
  });

  it('part2-clears counts a cleared part-2 campaign stage (not a failed run, a part-1 stage or the daily)', () => {
    const end = (cleared: boolean): GameEvent => ({ type: 'end', cleared });
    expect(trackCounts(startCounts(), session('w7-s10'), [end(true)])['part2-clears']).toBe(1);
    expect(trackCounts(startCounts(), session('w7-s10'), [end(false)])['part2-clears']).toBe(0);
    expect(trackCounts(startCounts(), session('w4-s10'), [end(true)])['part2-clears']).toBe(0);
    const daily = createSession('stage', dailyPlan('2026-11-16', 9).stage);
    expect(trackCounts(startCounts(), daily, [end(true)])['part2-clears']).toBe(0);
  });
});
