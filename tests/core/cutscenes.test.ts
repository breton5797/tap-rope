import { describe, expect, it } from 'vitest';
import { STAGES, stageById } from '../../src/core/content';
import { CUTSCENE_IMAGES, CUTSCENES, cutsceneAfter, cutsceneBefore } from '../../src/core/cutscenes';
import { dailyStage, endlessStage } from '../../src/core/levels';
import { defaultSave, markCutsceneSeen } from '../../src/core/storage';
import type { CutsceneId, StageDef } from '../../src/types';

const at = (id: string) => stageById(id) as StageDef;
const save0 = defaultSave();

describe('CUTSCENES (GDD v7 §2)', () => {
  it('has the 13 cutscenes in story order', () => {
    expect(CUTSCENES.map((c) => c.id)).toEqual([
      'op-start', 'boss-1', 'boss-2', 'boss-3', 'boss-4', 'boss-5', 'rescue',
      'boss-6', 'boss-7', 'boss-8', 'boss-9', 'boss-10', 'escape-end',
    ]);
  });

  it('uses 2–4 shots of 2–4s with Ken Burns in range and operations-voice captions', () => {
    for (const c of CUTSCENES) {
      expect(c.title.length, c.id).toBeGreaterThan(0);
      expect(c.shots.length, c.id).toBeGreaterThanOrEqual(2);
      expect(c.shots.length, c.id).toBeLessThanOrEqual(4);
      for (const s of c.shots) {
        expect(s.image).toMatch(/^\.\/art\/cut\/[a-z0-9-]+\.webp$/);
        expect(s.seconds).toBeGreaterThanOrEqual(2);
        expect(s.seconds).toBeLessThanOrEqual(4);
        expect(s.caption.length).toBeGreaterThan(0);
        expect(/[!?]/.test(s.caption), s.caption).toBe(false);
        if (s.speaker !== undefined) expect(['본부', '요원', '포로']).toContain(s.speaker);
        for (const k of [s.from, s.to]) {
          expect(k.zoom).toBeGreaterThanOrEqual(1);
          expect(k.zoom).toBeLessThanOrEqual(1.4);
          expect(k.x >= 0 && k.x <= 1 && k.y >= 0 && k.y <= 1).toBe(true);
        }
      }
    }
  });

  it('needs at most 23 distinct images, listed in CUTSCENE_IMAGES', () => {
    const used = [...new Set(CUTSCENES.flatMap((c) => c.shots.map((s) => s.image)))];
    expect(used.length).toBeLessThanOrEqual(23);
    expect([...CUTSCENE_IMAGES].sort()).toEqual(used.map((p) => p.replace('./art/cut/', '').replace('.webp', '')).sort());
  });

  it('boss cutscenes name the zone boss', () => {
    expect(CUTSCENES.find((c) => c.id === 'boss-7')?.title).toContain('CHIMERA');
  });
});

describe('cutsceneBefore', () => {
  it('plays op-start before 1-1 and boss-N before N-10, once', () => {
    expect(cutsceneBefore(at('w1-s1'), save0)?.id).toBe('op-start');
    expect(cutsceneBefore(at('w1-s1'), markCutsceneSeen(save0, 'op-start'))).toBeNull();
    for (let n = 1; n <= 10; n++) {
      const id = `boss-${n}` as CutsceneId;
      expect(cutsceneBefore(at(`w${n}-s10`), save0)?.id).toBe(id);
      expect(cutsceneBefore(at(`w${n}-s10`), markCutsceneSeen(save0, id))).toBeNull();
    }
  });

  it('nothing before other stages, endless or daily', () => {
    for (const s of STAGES.filter((x) => x.id !== 'w1-s1' && x.kind !== 'boss')) expect(cutsceneBefore(s, save0), s.id).toBeNull();
    expect(cutsceneBefore(endlessStage(0, 1), save0)).toBeNull();
    expect(cutsceneBefore(dailyStage('2026-10-27'), save0)).toBeNull();
  });
});

describe('cutsceneAfter', () => {
  it('rescue after clearing 5-10 and escape-end after 10-10, first time only', () => {
    expect(cutsceneAfter('w5-s10', true, save0)?.id).toBe('rescue');
    expect(cutsceneAfter('w10-s10', true, save0)?.id).toBe('escape-end');
    expect(cutsceneAfter('w5-s10', true, markCutsceneSeen(save0, 'rescue'))).toBeNull();
    expect(cutsceneAfter('w10-s10', true, markCutsceneSeen(save0, 'escape-end'))).toBeNull();
  });

  it('nothing on failure or other stages', () => {
    expect(cutsceneAfter('w5-s10', false, save0)).toBeNull();
    expect(cutsceneAfter('w5-s9', true, save0)).toBeNull();
    expect(cutsceneAfter(null, true, save0)).toBeNull();
  });
});
