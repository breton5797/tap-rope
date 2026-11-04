// Part 2 rendering logic (part 2 spec §3): the speech bubble's superior is looked up by stage (rematches
// say their part-2 lines), the urgent clock fires at the end of each part, the sprite lists hold each slot once.
import { describe, expect, it } from 'vitest';
import { clockUrgent } from '../../src/office/render/clock';
import { superiorOnStage } from '../../src/office/render/superior';
import { OFFICE_ART, OFFICE_EXTRA_ART } from '../../src/office/render/images';

describe('superiorOnStage', () => {
  it('rematches on stages 7, 9 and 10 use their part-2 lines, not their part-1 ones', () => {
    expect(superiorOnStage(6, 0)?.catchphrase).toContain('택시');
    expect(superiorOnStage(8, 0)?.catchphrase).toContain('2차');
    expect(superiorOnStage(9, 0)?.catchphrase).toContain('통화');
    expect(superiorOnStage(9, 1)?.catchphrase).toContain('집 앞');
    expect(superiorOnStage(9, 2)?.name).toBe('회장님');
  });

  it('part 1 keeps its superiors', () => {
    expect(superiorOnStage(1, 0)?.name).toBe('박과장');
    expect(superiorOnStage(1, 0)?.catchphrase).toContain('최종');
    expect(superiorOnStage(4, 1)?.name).toBe('윤이사');
    expect(superiorOnStage(4, 1)?.catchphrase).toContain('저녁');
  });

  it('is null off the stage table', () => {
    expect(superiorOnStage(10, 0)).toBeNull();
    expect(superiorOnStage(-1, 0)).toBeNull();
  });
});

describe('clockUrgent', () => {
  it('turns red near the end of stage 5 (18:00) and stage 10 (18:30) only', () => {
    expect(clockUrgent(4, 0.9)).toBe(true);
    expect(clockUrgent(9, 0.9)).toBe(true);
    for (const i of [0, 3, 5, 6, 7, 8]) expect(clockUrgent(i, 0.95)).toBe(false);
    expect(clockUrgent(4, 0.5)).toBe(false);
    expect(clockUrgent(9, 0.8)).toBe(false);
  });
});

describe('office sprite lists', () => {
  it('request each superior slot once (rematch slots are not repeated)', () => {
    expect(new Set(OFFICE_ART).size).toBe(OFFICE_ART.length);
    expect(new Set(OFFICE_EXTRA_ART).size).toBe(OFFICE_EXTRA_ART.length);
    for (const slot of ['crane', 'sniper', 'gunship']) {
      expect(OFFICE_ART).toContain(`boss-${slot}`);
      expect(OFFICE_EXTRA_ART).toContain(`boss-${slot}-throw6`);
    }
  });
});

describe('part 2 music', () => {
  it('voices themes 4 (street), 5 (subway) and 6 (food alley) with their own major loops', async () => {
    const { OFFICE_STYLES } = await import('../../src/office/audio/music');
    const part1 = [0, 1, 2, 3].map((w) => OFFICE_STYLES[w as 0]);
    for (const w of [4, 5, 6] as const) {
      expect(part1).not.toContain(OFFICE_STYLES[w]);
      expect(OFFICE_STYLES[w].pad.slice(0, 3)).toEqual([0, 4, 7]);
    }
    expect(OFFICE_STYLES[5].hits).toHaveLength(4); // subway: driving four-on-the-floor
  });
});

describe('part 2 collectibles', () => {
  it('stages 6–10 draw their own collect-mission sprites', async () => {
    const { collectibleFor } = await import('../../src/office/render/collectibles');
    const { STAGE_MISSIONS } = await import('../../src/office/core/missions');
    for (let i = 5; i < 10; i++) {
      const parts = STAGE_MISSIONS[`w${i + 1}-s10`] ?? [];
      parts.forEach((p, k) => expect(collectibleFor(i, k)).toBe(p.collectible ?? null));
    }
  });
});

describe('part 2 superiors on the photo rig', () => {
  it('crane, sniper and gunship stand like every other superior', async () => {
    const { BOSS_PHOTO_RIGS } = await import('../../src/office/render/boss-rigs');
    for (const slot of ['crane', 'sniper', 'gunship'] as const) expect(BOSS_PHOTO_RIGS[slot]).toBe(BOSS_PHOTO_RIGS.warden);
  });
});

describe('stage 7 lanejump readability', () => {
  it('every lane + laser beat signs both moves, each in its own action colour', async () => {
    const { STAGES } = await import('../../src/core/content');
    const { generateStage } = await import('../../src/core/levels');
    const { DEFAULT_PHYSICS } = await import('../../src/core/physics');
    const { actionCue } = await import('../../src/office/render/props');
    const { beatHint } = await import('../../src/office/render/readability');
    const { HAZARD_KINDS } = await import('../../src/types');
    let combos = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { beats } = generateStage({ ...STAGES[6], seed }, DEFAULT_PHYSICS, 2);
      for (const b of beats) {
        const hz = b.obstacles.filter((o) => HAZARD_KINDS.includes(o.kind));
        const cues = new Set(hz.map((o) => actionCue(o.kind)));
        if (!cues.has('lane') || cues.size < 2) continue;
        combos++;
        const hint = beatHint(hz.map((o) => ({ kind: o.kind, level: o.level, from: o.from ?? null })));
        expect(hint).toContain('옆으로!');
        expect(hint).toMatch(/점프!|숙여!|낮게!/);
      }
    }
    expect(combos).toBeGreaterThan(0);
  });
});

describe('callout hint colour chips (art review: combo moves)', () => {
  it('splits a combo hint into one segment per move, each in its action colour', async () => {
    const { hintSegments } = await import('../../src/office/render/readability');
    const { ACTION_COLORS } = await import('../../src/office/render/props');
    expect(hintSegments('옆으로! + 점프!')).toEqual([
      { text: '옆으로!', color: ACTION_COLORS.lane }, { text: '점프!', color: ACTION_COLORS.jump },
    ]);
    expect(hintSegments('뒤에서! 옆으로! + 숙여!')).toEqual([
      { text: '뒤에서! 옆으로!', color: ACTION_COLORS.lane }, { text: '숙여!', color: ACTION_COLORS.slide },
    ]);
    expect(hintSegments('점프 2단!')).toEqual([{ text: '점프 2단!', color: ACTION_COLORS.jump }]);
    expect(hintSegments('낮게!')).toEqual([{ text: '낮게!', color: ACTION_COLORS.low }]);
  });
});
