// Office mission items (Obstacle.item): a flagged coin is a mission item — the judge still reports it as a
// collected coin (pickup FX / sound unchanged) and counts it in `items`, and scoring never pays it as ₵.
// v8 never sets the flag, so its judge results and coins are exactly as before (no `items` field at all).
import { describe, expect, it } from 'vitest';
import { judgeBeat } from '../../src/core/judge';
import { DEFAULT_PHYSICS, initialPlayer } from '../../src/core/physics';
import { applyJudge, initialScore } from '../../src/core/scoring';
import type { Beat, Obstacle, PlayerState } from '../../src/types';

const beat = (obstacles: Obstacle[]): Beat => ({ id: 3, time: 2, obstacles, requiredLevel: 0, needsSlide: false, pulse: false, blockedLanes: [], section: 0 });
const air: PlayerState = { ...initialPlayer(), height: 40, vy: 0, grounded: false, level: 1, airTime: 0.2, lastTap: 'jump' };

describe('mission items', () => {
  it('a plain coin: collected, paid as ₵, no items field (v8 shape)', () => {
    const r = judgeBeat(beat([{ kind: 'coin', level: 1, lanes: [1] }]), air, DEFAULT_PHYSICS);
    expect(r.collected).toEqual(['coin']);
    expect('items' in r).toBe(false);
    expect(applyJudge(initialScore(), r).score.coins).toBe(1);
  });

  it('a flagged item: still a collected coin for FX, counted in items, never ₵ (fever or coin multiplier included)', () => {
    const r = judgeBeat(beat([{ kind: 'coin', level: 1, lanes: [1], item: true }]), air, DEFAULT_PHYSICS);
    expect(r.collected).toEqual(['coin']);
    expect(r.items).toBe(1);
    expect(applyJudge(initialScore(), r).score.coins).toBe(0);
    expect(applyJudge({ ...initialScore(), feverTime: 3 }, r).score.coins).toBe(0);
    expect(applyJudge(initialScore(), r, { feverGain: 1, coinMul: 1.5 }).score.coins).toBe(0);
  });

  it('an item that is missed (other lane) counts nothing', () => {
    const r = judgeBeat(beat([{ kind: 'coin', level: 1, lanes: [0], item: true }]), air, DEFAULT_PHYSICS);
    expect(r.collected).toEqual([]);
    expect('items' in r).toBe(false);
  });
});
