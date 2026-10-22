import { describe, expect, it } from 'vitest';
import { movesForMix, nextStageId, SKINS, stageById, STAGES, WORLDS } from '../../src/core/content';
import type { MoveId } from '../../src/types';

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
    expect(new Set(STAGES.map((s) => s.name)).size).toBe(20);
  });

  it('follows the GDD v2 §12 rope-mode table', () => {
    expect(STAGES.map((s) => s.ropeMode.charAt(0)).join('')).toBe('llsll' + 'lslsl' + 'slsls' + 'lslsl');
  });

  it('introduces each move on the §12 schedule', () => {
    const intro = (m: MoveId) => STAGES.find((s) => s.moves.includes(m))?.id;
    expect(intro('jump')).toBe('w1-s1');
    expect(intro('double')).toBe('w1-s3');
    expect(intro('side')).toBe('w1-s4');
    expect(intro('tumble')).toBe('w2-s1');
    expect(intro('bird')).toBe('w2-s1');
    expect(intro('cross')).toBe('w2-s2');
    expect(intro('triple')).toBe('w2-s3');
    expect(intro('back')).toBe('w3-s1');
    expect(intro('dd')).toBe('w3-s2');
    expect(STAGES[1].mix.hurdle).toBeGreaterThan(0);
  });

  it('W4 uses every move of its rope mode', () => {
    for (const s of STAGES.filter((x) => x.world === 3)) {
      const all = s.ropeMode === 'long' ? ['tumble', 'dd'] : ['cross', 'back'];
      for (const m of ['jump', 'double', 'triple', 'side', 'bird', ...all]) expect(s.moves).toContain(m);
    }
  });

  it('keeps long-only and solo-only features in their modes', () => {
    for (const s of STAGES) {
      if (s.ropeMode === 'solo') {
        expect([s.mix.hurdle, s.mix.doubleDutch, s.mix.ring]).toEqual([0, 0, 0]);
      } else {
        expect([s.mix.cross, s.mix.back]).toEqual([0, 0]);
      }
    }
  });

  it('lists exactly the moves its mix can produce', () => {
    for (const s of STAGES) expect([...s.moves].sort()).toEqual(movesForMix(s.ropeMode, s.levelWeights, s.mix).sort());
  });

  it('W1-S1 is a gentle 1단-only long-rope tutorial', () => {
    const s = STAGES[0];
    expect(s.ropeMode).toBe('long');
    expect(s.moves).toEqual(['jump']);
    expect(s.levelWeights).toEqual([1, 0, 0]);
    expect(Object.values(s.mix).every((v) => v === 0)).toBe(true);
    expect(s.bpm).toBeLessThanOrEqual(95);
    expect(s.hazardBeats).toBeLessThanOrEqual(16);
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

  it('has unique seeds and mix values in 0..1', () => {
    expect(new Set(STAGES.map((s) => s.seed)).size).toBe(20);
    for (const s of STAGES) for (const v of Object.values(s.mix)) expect(v >= 0 && v <= 1).toBe(true);
  });
});

describe('movesForMix', () => {
  const none = { hurdle: 0, bird: 0, combo: 0, doubleDutch: 0, ball: 0, ring: 0, cross: 0, back: 0 };
  it('ignores features that do not exist in the rope mode', () => {
    const all = { ...none, bird: 1, doubleDutch: 1, ball: 1, ring: 1, cross: 1, back: 1 };
    expect(movesForMix('long', [1, 1, 1], all)).toEqual(['jump', 'double', 'triple', 'tumble', 'side', 'dd', 'bird']);
    expect(movesForMix('solo', [1, 0, 0], all)).toEqual(['jump', 'side', 'cross', 'back', 'bird']);
    expect(movesForMix('long', [1, 0, 0], none)).toEqual(['jump']);
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
