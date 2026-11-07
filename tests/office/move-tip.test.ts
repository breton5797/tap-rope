// @vitest-environment jsdom
// R4: one-time move tips in part 2 — the first lane hazard after 2부 starts, and the first lanejump (stage 7).
// Shown once a little before the beat, never again (own storage key), never with the mission card, never on
// autoplay, still under reduced motion (no pulse).
import { beforeEach, describe, expect, it } from 'vitest';
import { TIP_LEAD, TIP_KEY, TipRunner, loadTips, pickTip, saveTip } from '../../src/office/render/move-tip';
import type { VisibleObstacle } from '../../src/types';

const ob = (id: string, kind: VisibleObstacle['kind'], timeUntil: number, lanes: number[] | null = null) =>
  ({ id, kind, timeUntil, lanes, level: 1, from: null, height: 0, sudden: false }) as unknown as VisibleObstacle;

beforeEach(() => localStorage.clear());

describe('tip store', () => {
  it('remembers seen tips under its own key and survives junk', () => {
    expect(loadTips()).toEqual([]);
    saveTip('lane2');
    saveTip('lane2');
    saveTip('lanejump');
    expect(loadTips()).toEqual(['lane2', 'lanejump']);
    localStorage.setItem(TIP_KEY, '{bad');
    expect(loadTips()).toEqual([]);
    localStorage.setItem(TIP_KEY, JSON.stringify([3, 'lane2', null]));
    expect(loadTips()).toEqual(['lane2']);
  });
});

describe('pickTip', () => {
  const lane = [ob('4-0', 'guard', 1.2, [1])];
  const combo = [ob('9-0', 'guard', 1.2, [1]), ob('9-1', 'floor', 1.2)];
  it('part 1 never shows a tip', () => {
    expect(pickTip(2, lane, [])).toBeNull();
  });
  it('the first lane hazard of part 2 gets the lane tip', () => {
    expect(pickTip(5, lane, [])).toMatchObject({ id: 'lane2', beat: 4 });
    expect(pickTip(5, lane, ['lane2'])).toBeNull();
  });
  it('a lanejump beat on stage 7 gets the lanejump tip, before the plain lane tip', () => {
    expect(pickTip(6, combo, [])).toMatchObject({ id: 'lanejump', beat: 9 });
    expect(pickTip(6, combo, ['lanejump'])).toMatchObject({ id: 'lane2' });
  });
  it('only for the NEXT hazard beat: a jump arriving first means no lane tip yet (never contradicts the callout)', () => {
    const obs = [ob('3-0', 'floor', 0.9), ob('4-0', 'guard', 1.4, [1])];
    expect(pickTip(5, obs, [])).toBeNull();
    expect(pickTip(5, [ob('4-0', 'guard', 1.0, [1])], [])).toMatchObject({ beat: 4 });
  });

  it('only inside the lead window (not too early, not too late to read)', () => {
    expect(pickTip(5, [ob('4-0', 'guard', TIP_LEAD + 0.2, [1])], [])).toBeNull();
    expect(pickTip(5, [ob('4-0', 'guard', 0.3, [1])], [])).toBeNull();
  });
});

describe('TipRunner', () => {
  it('shows once, for its time or until the beat passes, then marks it seen', () => {
    const r = new TipRunner();
    expect(r.frame(5, [ob('4-0', 'guard', 1.2, [1])], 10, false)?.id).toBe('lane2');
    expect(r.frame(5, [ob('4-0', 'guard', 0.7, [1])], 10.5, false)?.id).toBe('lane2');
    expect(r.frame(5, [ob('4-0', 'guard', -0.4, [1])], 11.6, false)).toBeNull();
    expect(loadTips()).toEqual(['lane2']);
    expect(r.frame(5, [ob('8-0', 'guard', 1.2, [0])], 13, false)).toBeNull();
  });
  it('waits while another overlay is up (one overlay at a time), and tries the next lane beat', () => {
    const r = new TipRunner();
    expect(r.frame(5, [ob('4-0', 'guard', 1.2, [1])], 10, true)).toBeNull();
    expect(loadTips()).toEqual([]);
    expect(r.frame(5, [ob('6-0', 'guard', 1.2, [2])], 12, false)?.beat).toBe(6);
  });
});
