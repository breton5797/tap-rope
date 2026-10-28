// Office content (office spec §4, §13): five boss stages of three sections, two free characters, the clock.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildCampaign, designCustomStage } from '../../src/core/campaign';
import * as v8 from '../../src/core/content';
import { defaultSave } from '../../src/core/storage';
import type { MoveId } from '../../src/types';
import {
  CHAPTER_SCENES, CHAPTERS, DESIGNED_LOOKS, OFFICE_CLOCK, SKINS, STAGES, nextStageId, sceneFor, stageById, transitionFor,
} from '../../src/office/core/content';

const digest = (v: unknown): string => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

/** spec §13 table: moves each stage introduces */
const NEW_MOVES: readonly (readonly MoveId[])[] = [
  ['jump', 'slide', 'lane'],
  ['double', 'drone', 'drop'],
  ['chaser', 'high'],
  ['triple'],
  ['rear'],
];
const IDS = ['w1-s10', 'w2-s10', 'w3-s10', 'w4-s10', 'w5-s10'];

describe('v8 campaign is untouched', () => {
  it('buildCampaign output matches the pre-office snapshot', () => {
    expect(digest(buildCampaign(v8.CHAPTERS))).toBe('30c6e0054d7846f9');
  });
});

describe('office stages', () => {
  it('five boss stages with the w{n}-s10 ids, three sections each', () => {
    expect(STAGES.map((s) => s.id)).toEqual(IDS);
    STAGES.forEach((s, i) => {
      expect(s.kind).toBe('boss');
      expect(s.sections).toBe(3);
      expect(s.chapter).toBe(i);
      expect(stageById(s.id)).toBe(s);
    });
    expect(CHAPTERS).toHaveLength(5);
  });

  it('each stage has every move taught so far and none taught later', () => {
    STAGES.forEach((s, i) => {
      const taught = NEW_MOVES.slice(0, i + 1).flat();
      const later = NEW_MOVES.slice(i + 1).flat();
      for (const m of taught) expect(s.moves, `${s.id} ${m}`).toContain(m);
      for (const m of later) expect(s.moves, `${s.id} ${m}`).not.toContain(m);
    });
  });

  it('difficulty rises stage by stage', () => {
    for (let i = 1; i < STAGES.length; i += 1) {
      expect(STAGES[i].bpm).toBeGreaterThanOrEqual(STAGES[i - 1].bpm);
      expect(STAGES[i].hazardBeats).toBeGreaterThanOrEqual(STAGES[i - 1].hazardBeats);
    }
  });

  it('stage order ends at stage 5', () => {
    expect(IDS.slice(0, 4).map((id) => nextStageId(id))).toEqual(IDS.slice(1));
    expect(nextStageId('w5-s10')).toBeNull();
  });

  it('stage 5 is the lobby at dusk (world 3, dawn) and every look is designed', () => {
    expect(STAGES[4]).toMatchObject({ world: 3, variant: 'dawn' });
    expect(CHAPTER_SCENES).toHaveLength(CHAPTERS.length);
    for (const c of CHAPTERS) expect(DESIGNED_LOOKS[c.theme]).toContain(c.variant);
    for (const s of CHAPTER_SCENES) for (const sc of s.scenes) expect(DESIGNED_LOOKS[sc.world]).toContain(sc.variant);
    STAGES.forEach((s) => expect(sceneFor(s, 0)).toEqual({ world: s.world, variant: s.variant }));
    expect(transitionFor(STAGES[3], 1)).toBe('elevator');
    expect(transitionFor(STAGES[4], 1)).toBe('stairs');
  });
});

describe('designCustomStage', () => {
  const shape = { id: 'x', name: 'x', n: 10, chapter: 0, index: 9, kind: 'boss' as const, world: 0 as const, variant: 'base' as const, d: 0.3, seed: 7 };

  it('uses exactly the listed moves', () => {
    const s = designCustomStage(shape, ['jump', 'lane', 'slide']);
    expect([...s.moves].sort()).toEqual(['jump', 'lane', 'slide']);
    expect(s.sections).toBe(3);
    expect(s.seed).toBe(7);
  });

  it('gives intro moves a bigger share than without the intro', () => {
    const moves: MoveId[] = ['jump', 'lane', 'slide', 'drop'];
    expect(designCustomStage(shape, moves, ['drop']).mix.drop).toBeGreaterThan(designCustomStage(shape, moves).mix.drop);
  });
});

describe('office characters', () => {
  it('칼퇴준 and 정시원, both free and owned on a fresh save', () => {
    expect(SKINS).toEqual([{ id: 'kid', name: '칼퇴준', price: 0 }, { id: 'cat', name: '정시원', price: 0 }]);
  });

  it('v8 still owns only the free agent on a fresh save', () => {
    expect(defaultSave().ownedSkins).toEqual(['kid']);
  });
});

describe('OFFICE_CLOCK', () => {
  it('17:30 at the start, +6 minutes per stage, 18:00 at the end', () => {
    expect(OFFICE_CLOCK(0, 0)).toBe('17:30');
    expect(OFFICE_CLOCK(0, 1)).toBe('17:36');
    expect(OFFICE_CLOCK(2, 0.5)).toBe('17:45');
    expect(OFFICE_CLOCK(4, 0.999)).toBe('17:59');
    expect(OFFICE_CLOCK(4, 1)).toBe('18:00');
  });

  it('restart uses the stage start clock and clamps progress', () => {
    [0, 1, 2, 3, 4].forEach((n) => expect(OFFICE_CLOCK(n, 0)).toBe(`17:${String(30 + 6 * n).padStart(2, '0')}`));
    expect(OFFICE_CLOCK(0, -1)).toBe('17:30');
    expect(OFFICE_CLOCK(4, 2)).toBe('18:00');
  });
});
