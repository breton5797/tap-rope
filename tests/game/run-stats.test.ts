// v2.2 seams (office four heroes): v8 runs ignore the chosen skin — same physics, 3 hearts, ×1 fever and coins.
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { DEFAULT_PHYSICS, physicsForWorld } from '../../src/core/physics';
import { applyJudge, initialScore } from '../../src/core/scoring';
import { runStats } from '../../src/flavor';
import { createSession, MAX_HEARTS } from '../../src/game/session';
import { toHud } from '../../src/game/snapshot';
import type { JudgeResult } from '../../src/types';

const coin: JudgeResult = { beatId: 0, grade: 'perfect', hit: false, reason: null, collected: ['coin'] };

describe('v8 run stats seam', () => {
  it('is the world physics, MAX_HEARTS and ×1 for every skin', () => {
    for (const skin of ['kid', 'cat', 'bunny', 'robot', 'ninja', 'astro'] as const) {
      expect(runStats(0, skin)).toEqual({ physics: physicsForWorld(0), hearts: MAX_HEARTS, feverGain: 1, coinMul: 1 });
    }
  });

  it('leaves a session with a skin identical to one without', () => {
    const plain = createSession('stage', STAGES[3]);
    const cat = createSession('stage', STAGES[3], { skin: 'cat' });
    expect(cat).toEqual(plain);
    expect(cat.cfg).toBe(DEFAULT_PHYSICS);
    expect(toHud(cat).maxHearts).toBe(MAX_HEARTS);
  });

  it('scores with ×1 mods exactly like no mods, without a coin carry', () => {
    const a = applyJudge(initialScore(), coin);
    const b = applyJudge(initialScore(), coin, { feverGain: 1, coinMul: 1 });
    expect(b).toEqual(a);
    expect('coinFrac' in b.score).toBe(false);
  });
});

describe('scoring mods', () => {
  it('scales the fever gauge gain', () => {
    const r = applyJudge(initialScore(), coin, { feverGain: 0.8, coinMul: 1 });
    expect(r.score.feverGauge).toBeCloseTo(0.12 * 0.8, 9);
  });

  it('multiplies coins and carries the fraction (×1.5: 1, 2, 1, 2 …; ×0.8: four of five)', () => {
    const run = (mul: number, n: number): number[] => {
      let s = initialScore();
      const out: number[] = [];
      for (let i = 0; i < n; i += 1) {
        s = applyJudge(s, { ...coin, grade: 'none' }, { feverGain: 1, coinMul: mul }).score;
        out.push(s.coins);
      }
      return out;
    };
    expect(run(1.5, 4)).toEqual([1, 3, 4, 6]);
    expect(run(0.8, 5)).toEqual([0, 1, 2, 3, 4]);
  });
});
