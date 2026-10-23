import { describe, expect, it } from 'vitest';
import { INTRO_STAGE, stageNumber } from '../../src/core/campaign';
import { CHAPTERS, DESIGNED_LOOKS, movesForMix, nextStageId, SKINS, stageById, STAGES, WORLDS } from '../../src/core/content';
import type { MoveId } from '../../src/types';

describe('WORLDS (themes)', () => {
  it('has 4 corridor themes', () => {
    expect(WORLDS.map((w) => w.id)).toEqual([0, 1, 2, 3]);
    for (const w of WORLDS) expect(w.name.length * w.subtitle.length).toBeGreaterThan(0);
  });
});

describe('SKINS', () => {
  it('re-imagines the six skins as spies (§7)', () => {
    expect(SKINS.map((s) => [s.id, s.name, s.price])).toEqual([
      ['kid', '요원 K', 0], ['cat', '고양이 요원', 60], ['bunny', '토끼 해커', 90],
      ['ninja', '닌자 요원', 140], ['robot', '로봇 R-7', 200], ['astro', '특수부대', 300],
    ]);
  });
});

describe('CHAPTERS', () => {
  it('follows the §5 table', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(CHAPTERS.map((c) => c.part)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
    expect(CHAPTERS.map((c) => c.name)).toEqual([
      '외곽 경비구역', '지하 수로', '연구동', '서버실', '감옥 블록', '경보 발령', '연구동 비상탈출', '공장 라인', '옥상', '헬기 탈출',
    ]);
    expect(CHAPTERS.map((c) => c.theme)).toEqual([0, 3, 1, 1, 2, 2, 1, 3, 0, 0]);
    expect(CHAPTERS.map((c) => c.variant)).toEqual(['base', 'steam', 'base', 'dark', 'base', 'alarm', 'alarm', 'base', 'night', 'dawn']);
    expect(CHAPTERS[0].briefing).toBe('포로가 잡혀 있는 기지에 잠입한다. 레이저를 넘어라!');
    expect(new Set(CHAPTERS.map((c) => c.briefing)).size).toBe(10);
    for (const c of CHAPTERS) expect(c.subtitle.length).toBeGreaterThan(0);
  });

  it('uses only designed theme × variant pairs, each exactly once', () => {
    const pairs = CHAPTERS.map((c) => `${c.theme}/${c.variant}`);
    expect(new Set(pairs).size).toBe(10);
    for (const c of CHAPTERS) expect(DESIGNED_LOOKS[c.theme]).toContain(c.variant);
    expect(DESIGNED_LOOKS).toEqual({ 0: ['base', 'night', 'dawn'], 1: ['base', 'dark', 'alarm'], 2: ['base', 'alarm'], 3: ['base', 'steam'] });
  });
});

describe('STAGES', () => {
  it('has 100 ordered stages with ids, chapter, theme, variant and kind', () => {
    expect(STAGES).toHaveLength(100);
    STAGES.forEach((s, i) => {
      const chapter = Math.floor(i / 10);
      expect(s).toMatchObject({ chapter, index: i % 10, id: `w${chapter + 1}-s${(i % 10) + 1}` });
      expect(s.world).toBe(CHAPTERS[chapter].theme);
      expect(s.variant).toBe(CHAPTERS[chapter].variant);
      expect(stageNumber(s)).toBe(i + 1);
      const n = i + 1;
      expect(s.kind).toBe(n % 10 === 0 ? 'boss' : n % 10 === 5 ? 'bonus' : 'normal');
    });
  });

  it('has unique spy-mission names with bonus/boss prefixes and the story bosses', () => {
    expect(new Set(STAGES.map((s) => s.name)).size).toBe(100);
    for (const s of STAGES) {
      if (s.kind === 'bonus') expect(s.name.startsWith('보너스 ')).toBe(true);
      else if (s.kind === 'boss') expect(s.name.startsWith('보스 ')).toBe(true);
      else expect(/^(보너스|보스) /.test(s.name)).toBe(false);
    }
    expect(stageById('w5-s10')?.name).toMatch(/탈옥|구출/);
    expect(stageById('w10-s10')?.name).toMatch(/헬기/);
  });

  it('introduces each move exactly at its §5 stage number', () => {
    const intro: Record<MoveId, number> = {
      jump: 1, beam: 2, double: 4, slide: 6, drone: 8, triple: 11, high: 13, rear: 16, gate: 21, pulse: 24,
    };
    expect(INTRO_STAGE).toEqual(intro);
    for (const [move, n] of Object.entries(intro) as [MoveId, number][]) {
      expect(STAGES.findIndex((s) => s.moves.includes(move)) + 1, move).toBe(n);
    }
  });

  it('first-introduction stages are gentle and focus on the new move', () => {
    for (const n of [2, 4, 6, 8, 11, 13, 16, 21, 24]) {
      const s = STAGES[n - 1];
      expect(s.moves.length, s.id).toBeLessThanOrEqual(3);
      const prev = STAGES.slice(0, n - 1).filter((x) => x.kind === 'normal').pop();
      expect(s.bpm).toBeLessThanOrEqual((prev?.bpm ?? s.bpm) + 4);
    }
  });

  it('lists exactly the moves its mix can produce', () => {
    for (const s of STAGES) expect([...s.moves].sort(), s.id).toEqual(movesForMix(s.levelWeights, s.mix).sort());
  });

  it('bosses use every unlocked move', () => {
    for (const boss of STAGES.filter((s) => s.kind === 'boss')) {
      const n = stageNumber(boss);
      for (const m of (Object.keys(INTRO_STAGE) as MoveId[]).filter((x) => INTRO_STAGE[x] <= n)) {
        expect(boss.moves, `${boss.id} ${m}`).toContain(m);
      }
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
      for (const s of ch.slice(0, 9)) expect(ch[9].hazardBeats).toBeGreaterThan(s.hazardBeats);
      if (c > 0) expect(ch[0].bpm).toBeLessThan(STAGES[c * 10 - 1].bpm);
    }
    expect(STAGES[0].bpm).toBeLessThanOrEqual(92);
    expect(STAGES[99].bpm).toBeGreaterThanOrEqual(140);
  });

  it('w1-s1 is a gentle floor-laser-only tutorial', () => {
    const s = STAGES[0];
    expect(s.moves).toEqual(['jump']);
    expect(s.levelWeights).toEqual([1, 0, 0]);
    expect(Object.values(s.mix).every((v) => v === 0)).toBe(true);
    expect(s.hazardBeats).toBeLessThanOrEqual(16);
  });

  it('has unique seeds', () => {
    expect(new Set(STAGES.map((s) => s.seed)).size).toBe(100);
  });
});

describe('stageById / nextStageId', () => {
  it('finds stages across all 100', () => {
    expect(stageById('w7-s3')?.name).toBe(STAGES[62].name);
    expect(stageById('w10-s10')).toBe(STAGES[99]);
    expect(stageById('nope')).toBeUndefined();
  });
  it('returns next id or null', () => {
    expect(nextStageId('w1-s10')).toBe('w2-s1');
    expect(nextStageId('w10-s10')).toBeNull();
    expect(nextStageId('nope')).toBeNull();
  });
});
