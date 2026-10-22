import { describe, expect, it } from 'vitest';
import { nextStageId, SKINS, stageById, STAGES, WORLDS } from '../../src/core/content';

describe('WORLDS', () => {
  it('has 4 worlds with moon low gravity', () => {
    expect(WORLDS.map((w) => w.name)).toEqual(['놀이터', '노을 해변', '네온 시티', '달 기지']);
    expect(WORLDS.map((w) => w.id)).toEqual([0, 1, 2, 3]);
    expect(WORLDS[3].gravityScale).toBe(0.82);
    expect(WORLDS[0].subtitle).toBe('햇살 가득 첫 줄넘기');
  });
});

describe('SKINS', () => {
  it('lists skins with prices, kid free', () => {
    expect(SKINS.map((s) => [s.id, s.price])).toEqual([
      ['kid', 0], ['cat', 60], ['bunny', 90], ['ninja', 140], ['robot', 200], ['astro', 300],
    ]);
  });
});

describe('STAGES', () => {
  it('has 20 ordered stages with ids w{n}-s{m}', () => {
    expect(STAGES).toHaveLength(20);
    STAGES.forEach((s, i) => {
      expect(s.world).toBe(Math.floor(i / 5));
      expect(s.index).toBe(i % 5);
      expect(s.id).toBe(`w${s.world + 1}-s${s.index + 1}`);
      expect(s.name.length).toBeGreaterThan(0);
    });
  });

  it('W1-S1 is a gentle 1단-only tutorial', () => {
    const s = STAGES[0];
    expect(s.levelWeights).toEqual([1, 0, 0]);
    expect(s.mix).toEqual({ hurdle: 0, bird: 0, combo: 0, doubleDutch: 0 });
    expect(s.bpm).toBeLessThanOrEqual(95);
    expect(s.hazardBeats).toBeLessThanOrEqual(16);
  });

  it('introduces features on schedule', () => {
    const w = (i: number) => STAGES.filter((s) => s.world === i);
    expect(w(0).some((s) => s.mix.hurdle > 0)).toBe(true);
    expect(STAGES[2].levelWeights[1]).toBeGreaterThan(0);
    expect(w(0).every((s) => s.mix.bird === 0 && s.levelWeights[2] === 0)).toBe(true);
    expect(w(1).some((s) => s.mix.bird > 0)).toBe(true);
    expect(w(1).some((s) => s.levelWeights[2] > 0)).toBe(true);
    expect(STAGES.slice(0, 10).every((s) => s.mix.doubleDutch === 0)).toBe(true);
    expect(w(2).every((s) => s.mix.doubleDutch > 0)).toBe(true);
  });

  it('ramps bpm and hazard beats (small breather allowed at a new world)', () => {
    for (let i = 1; i < STAGES.length; i++) {
      const slack = STAGES[i].index === 0 ? 4 : 0;
      expect(STAGES[i].bpm).toBeGreaterThanOrEqual(STAGES[i - 1].bpm - slack);
      expect(STAGES[i].hazardBeats).toBeGreaterThanOrEqual(STAGES[i - 1].hazardBeats - slack);
    }
    expect(STAGES[19].bpm).toBeGreaterThanOrEqual(128);
    expect(STAGES[19].bpm).toBeLessThanOrEqual(136);
    expect(STAGES[19].hazardBeats).toBeGreaterThanOrEqual(36);
  });

  it('has unique seeds', () => {
    expect(new Set(STAGES.map((s) => s.seed)).size).toBe(20);
  });
});

describe('stageById / nextStageId', () => {
  it('finds stages', () => {
    expect(stageById('w2-s3')?.name).toBe(STAGES[7].name);
    expect(stageById('nope')).toBeUndefined();
  });
  it('returns next id or null', () => {
    expect(nextStageId('w1-s5')).toBe('w2-s1');
    expect(nextStageId('w4-s5')).toBeNull();
    expect(nextStageId('nope')).toBeNull();
  });
});
