import { describe, expect, it } from 'vitest';
import { CHAPTERS, movesForMix, nextStageId, SKINS, stageById, STAGES, WORLDS } from '../../src/core/content';
import { INTRO_STAGE, stageNumber } from '../../src/core/campaign';
import type { MoveId } from '../../src/types';

const LONG_ONLY: readonly MoveId[] = ['tumble', 'dd'];
const SOLO_ONLY: readonly MoveId[] = ['cross', 'back'];

describe('WORLDS (themes)', () => {
  it('has 4 themes with moon low gravity', () => {
    expect(WORLDS.map((w) => w.id)).toEqual([0, 1, 2, 3]);
    expect(WORLDS[3].gravityScale).toBe(0.82);
    expect(WORLDS.slice(0, 3).every((w) => w.gravityScale === 1)).toBe(true);
  });
});

describe('SKINS', () => {
  it('lists skins with prices, kid free', () => {
    expect(SKINS.map((s) => [s.id, s.price])).toEqual([
      ['kid', 0], ['cat', 60], ['bunny', 90], ['ninja', 140], ['robot', 200], ['astro', 300],
    ]);
  });
});

describe('CHAPTERS', () => {
  it('follows the §15 table', () => {
    expect(CHAPTERS).toHaveLength(10);
    expect(CHAPTERS.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(CHAPTERS.map((c) => c.theme)).toEqual([0, 1, 2, 3, 0, 0, 1, 2, 3, 0]);
    expect(CHAPTERS.map((c) => c.variant)).toEqual([
      'base', 'base', 'base', 'base', 'night', 'autumn', 'night', 'rain', 'eclipse', 'rainbow',
    ]);
    expect(CHAPTERS[0].name).toBe('놀이터');
    expect(CHAPTERS[9].name).toBe('무지개 피날레');
    expect(new Set(CHAPTERS.map((c) => c.name)).size).toBe(10);
    for (const c of CHAPTERS) expect(c.subtitle.length).toBeGreaterThan(0);
  });
});

describe('STAGES', () => {
  it('has 100 ordered stages with ids, chapter, theme, variant and kind', () => {
    expect(STAGES).toHaveLength(100);
    STAGES.forEach((s, i) => {
      const chapter = Math.floor(i / 10);
      expect(s.chapter).toBe(chapter);
      expect(s.index).toBe(i % 10);
      expect(s.id).toBe(`w${chapter + 1}-s${(i % 10) + 1}`);
      expect(s.world).toBe(CHAPTERS[chapter].theme);
      expect(s.variant).toBe(CHAPTERS[chapter].variant);
      expect(stageNumber(s)).toBe(i + 1);
      const n = i + 1;
      expect(s.kind).toBe(n % 10 === 0 ? 'boss' : n % 10 === 5 ? 'bonus' : 'normal');
    });
  });

  it('has unique fun names with bonus/boss prefixes', () => {
    expect(new Set(STAGES.map((s) => s.name)).size).toBe(100);
    for (const s of STAGES) {
      if (s.kind === 'bonus') expect(s.name.startsWith('보너스 ')).toBe(true);
      else if (s.kind === 'boss') expect(s.name.startsWith('보스 ')).toBe(true);
      else expect(/^(보너스|보스) /.test(s.name)).toBe(false);
    }
  });

  it('never runs 3+ stages of the same rope mode in a row', () => {
    for (let i = 2; i < STAGES.length; i++) {
      const modes = new Set([STAGES[i - 2], STAGES[i - 1], STAGES[i]].map((s) => s.ropeMode));
      expect(modes.size).toBe(2);
    }
  });

  it('introduces each move exactly at its §16 stage number, on the right rope', () => {
    const intro: Record<MoveId, [number, 'long' | 'solo']> = {
      jump: [1, 'long'], double: [4, 'solo'], side: [6, 'long'], bird: [8, 'long'], tumble: [11, 'long'],
      cross: [13, 'solo'], triple: [16, 'long'], back: [21, 'solo'], dd: [24, 'long'],
    };
    for (const [move, [n, mode]] of Object.entries(intro) as [MoveId, [number, string]][]) {
      const first = STAGES.findIndex((s) => s.moves.includes(move));
      expect(first + 1).toBe(n);
      expect(STAGES[n - 1].ropeMode).toBe(mode);
      expect(INTRO_STAGE[move]).toBe(n);
    }
    expect(STAGES[1].mix.hurdle).toBeGreaterThan(0); // n=2 introduces the hurdle
    expect(STAGES[0].mix.hurdle).toBe(0);
  });

  it('first-introduction stages are gentle and focus on the new move', () => {
    for (const n of [4, 6, 8, 11, 13, 16, 21, 24]) {
      const s = STAGES[n - 1];
      expect(s.moves.length).toBeLessThanOrEqual(3);
      const prev = STAGES.slice(0, n - 1).filter((x) => x.kind === 'normal').pop();
      expect(s.bpm).toBeLessThanOrEqual((prev?.bpm ?? s.bpm) + 4);
    }
  });

  it('keeps solo-only moves on solo and long-only moves on long ropes', () => {
    for (const s of STAGES) {
      const banned = s.ropeMode === 'solo' ? LONG_ONLY : SOLO_ONLY;
      for (const m of banned) expect(s.moves).not.toContain(m);
      if (s.ropeMode === 'solo') expect([s.mix.hurdle, s.mix.doubleDutch, s.mix.ring]).toEqual([0, 0, 0]);
      else expect([s.mix.cross, s.mix.back]).toEqual([0, 0]);
    }
  });

  it('lists exactly the moves its mix can produce', () => {
    for (const s of STAGES) expect([...s.moves].sort()).toEqual(movesForMix(s.ropeMode, s.levelWeights, s.mix).sort());
  });

  it('bosses use every unlocked move of their rope', () => {
    for (const boss of STAGES.filter((s) => s.kind === 'boss')) {
      const n = stageNumber(boss);
      const unlocked = (Object.keys(INTRO_STAGE) as MoveId[]).filter((m) => INTRO_STAGE[m] <= n);
      const banned = boss.ropeMode === 'solo' ? LONG_ONLY : SOLO_ONLY;
      for (const m of unlocked.filter((x) => !banned.includes(x))) expect(boss.moves).toContain(m);
    }
  });

  it('shapes the §17 curve: bpm, hazards, bonus and boss', () => {
    for (const s of STAGES) {
      expect(s.bpm).toBeGreaterThanOrEqual(84);
      expect(s.bpm).toBeLessThanOrEqual(150);
      for (const v of [...s.levelWeights, ...Object.values(s.mix), s.pickupRate]) expect(v >= 0 && v <= 1).toBe(true);
      if (s.kind === 'bonus') {
        expect(s.hazardBeats).toBeGreaterThanOrEqual(12);
        expect(s.hazardBeats).toBeLessThanOrEqual(16);
        expect(s.pickupRate).toBe(0.8);
      }
      if (s.kind === 'boss') expect(s.hazardBeats).toBeLessThanOrEqual(60);
    }
    for (let c = 0; c < 10; c++) {
      const ch = STAGES.filter((s) => s.chapter === c);
      const boss = ch[9];
      for (const s of ch.slice(0, 9)) expect(boss.hazardBeats).toBeGreaterThan(s.hazardBeats);
      if (c > 0) expect(ch[0].bpm).toBeLessThan(STAGES[c * 10 - 1].bpm); // breather after the boss
    }
    expect(STAGES[0].bpm).toBeLessThanOrEqual(92);
    expect(STAGES[99].bpm).toBeGreaterThanOrEqual(140);
  });

  it('W1-S1 is a gentle 1단-only long-rope tutorial', () => {
    const s = STAGES[0];
    expect(s.ropeMode).toBe('long');
    expect(s.moves).toEqual(['jump']);
    expect(s.levelWeights).toEqual([1, 0, 0]);
    expect(Object.values(s.mix).every((v) => v === 0)).toBe(true);
    expect(s.hazardBeats).toBeLessThanOrEqual(16);
  });

  it('has unique seeds', () => {
    expect(new Set(STAGES.map((s) => s.seed)).size).toBe(100);
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
  it('finds stages across all 100', () => {
    expect(stageById('w7-s3')?.name).toBe(STAGES[62].name);
    expect(stageById('w10-s10')).toBe(STAGES[99]);
    expect(stageById('nope')).toBeUndefined();
  });
  it('returns next id or null', () => {
    expect(nextStageId('w1-s9')).toBe('w1-s10');
    expect(nextStageId('w1-s10')).toBe('w2-s1');
    expect(nextStageId('w9-s10')).toBe('w10-s1');
    expect(nextStageId('w10-s10')).toBeNull();
    expect(nextStageId('nope')).toBeNull();
  });
});
