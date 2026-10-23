import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { DIFFICULTY_WEIGHTS, stageDifficulty } from '../../src/core/difficulty';
import { generateBeats } from '../../src/core/levels';
import { physicsForWorld } from '../../src/core/physics';
import type { Beat, JumpLevel, Obstacle, StageDef } from '../../src/types';
import { HAZARD_KINDS } from '../../src/types';

/** largest allowed rise between consecutive normal stages, relative to the previous score */
const MAX_NORMAL_JUMP = 0.25;

const t0 = performance.now();
const scored = STAGES.map((s) => ({ s, beats: generateBeats(s, physicsForWorld(s.world)) }))
  .map(({ s, beats }) => ({ s, beats, d: stageDifficulty(s, beats) }));
const genMs = performance.now() - t0;

const normals = (c: number) => scored.filter((x) => x.s.chapter === c && x.s.kind === 'normal');
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function mk(id: number, time: number, obstacles: Obstacle[], requiredLevel: JumpLevel): Beat {
  return { id, time, obstacles, requiredLevel, doubleDutch: false };
}
const rope = (id: number, time: number, level: 1 | 2 | 3 = 1) => mk(id, time, [{ kind: 'rope', level }], level);

describe('stageDifficulty basics', () => {
  const stage = STAGES[0] as StageDef;

  it('documents positive weights that sum to 1', () => {
    const ws = Object.values(DIFFICULTY_WEIGHTS);
    expect(ws.every((w) => w > 0)).toBe(true);
    expect(ws.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('is 0 with fewer than two hazards and ignores pickups', () => {
    expect(stageDifficulty(stage, [])).toBe(0);
    expect(stageDifficulty(stage, [rope(0, 2)])).toBe(0);
    const coins = [rope(0, 2), mk(1, 2.5, [{ kind: 'coin', level: 1 }], 0), rope(2, 3)];
    expect(stageDifficulty(stage, coins)).toBeCloseTo(stageDifficulty(stage, [rope(0, 2), rope(2, 3)]), 9);
  });

  it('rises with density, move changes, multi-level and combined beats', () => {
    const slow = [rope(0, 2), rope(1, 3), rope(2, 4), rope(3, 5)];
    const fast = [rope(0, 2), rope(1, 2.7), rope(2, 3.4), rope(3, 4.1)];
    const varied = [rope(0, 2), rope(1, 3, 2), rope(2, 4), rope(3, 5, 3)];
    const combo = slow.map((b) => mk(b.id, b.time, [{ kind: 'rope', level: 1 }, { kind: 'hurdle', level: 1 }], 1));
    const base = stageDifficulty(stage, slow);
    expect(stageDifficulty(stage, fast)).toBeGreaterThan(base);
    expect(stageDifficulty(stage, varied)).toBeGreaterThan(base);
    expect(stageDifficulty(stage, combo)).toBeGreaterThan(base);
  });
});

describe('§18 balance of the 100-stage campaign', () => {
  it('generates all 100 stages in under 1s', () => {
    expect(genMs).toBeLessThan(1000);
  });

  it('chapter means of normal stages increase strictly', () => {
    const means = Array.from({ length: 10 }, (_, c) => mean(normals(c).map((x) => x.d)));
    for (let c = 1; c < 10; c++) expect(means[c]).toBeGreaterThan(means[c - 1]);
  });

  it('bonus is easier than its chapter normal mean; boss at least its chapter normal max', () => {
    for (let c = 0; c < 10; c++) {
      const ns = normals(c).map((x) => x.d);
      const bonus = scored.find((x) => x.s.chapter === c && x.s.kind === 'bonus');
      const boss = scored.find((x) => x.s.chapter === c && x.s.kind === 'boss');
      expect(bonus?.d).toBeLessThan(mean(ns));
      expect(boss?.d).toBeGreaterThanOrEqual(Math.max(...ns));
    }
  });

  it(`adjacent normal stages never jump more than +${MAX_NORMAL_JUMP * 100}%`, () => {
    const ns = scored.filter((x) => x.s.kind === 'normal');
    for (let i = 1; i < ns.length; i++) {
      expect(ns[i].d, `${ns[i - 1].s.id} → ${ns[i].s.id}`).toBeLessThanOrEqual(ns[i - 1].d * (1 + MAX_NORMAL_JUMP));
    }
  });

  it('never asks for two hazards closer than 0.45s', () => {
    for (const { s, beats } of scored) {
      const hz = beats.filter((b) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind)));
      for (let i = 1; i < hz.length; i++) expect(hz[i].time - hz[i - 1].time, s.id).toBeGreaterThanOrEqual(0.45);
    }
  });
});
