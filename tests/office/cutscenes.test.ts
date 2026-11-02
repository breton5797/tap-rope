// Office story (office spec §4; part 2 spec §1): opening, one superior cutscene per stage (stages 5 / 10: one
// shot per section superior), the 18:00 칼퇴 bridge into part 2 ("…그런데 단톡방 알림이") after stage 5, and the
// ending at the 18:30 front door with the "내일 출근 09:00" twist. Hero lines are spoken by the chosen character.
import { describe, expect, it } from 'vitest';
import { CUTSCENE_IMAGES, CUTSCENES, FAIL_IMAGE, HERO, cutsceneAfter, cutsceneBefore } from '../../src/office/core/cutscenes';
import { stageById } from '../../src/core/content';
import { defaultSave, markCutsceneSeen } from '../../src/core/storage';
import type { CutsceneId, StageDef } from '../../src/types';

const stage = (n: number) => stageById(`w${n}-s10`) as StageDef;
const save0 = defaultSave();
const seen = (...ids: CutsceneId[]) => ids.reduce((s, id) => markCutsceneSeen(s, id), save0);

describe('office CUTSCENES', () => {
  it('has the opening, ten superior cutscenes, the part-2 bridge and the ending in story order', () => {
    expect(CUTSCENES.map((c) => c.id)).toEqual([
      'op-start', 'boss-1', 'boss-2', 'boss-3', 'boss-4', 'boss-5', 'rescue',
      'boss-6', 'boss-7', 'boss-8', 'boss-9', 'boss-10', 'escape-end',
    ]);
    expect(CUTSCENES.find((c) => c.id === 'op-start')?.shots).toHaveLength(2);
    expect(CUTSCENES.find((c) => c.id === 'escape-end')?.shots).toHaveLength(2);
  });

  it('uses exactly the spec images', () => {
    expect([...CUTSCENE_IMAGES].sort()).toEqual([
      'boss-1-a', 'boss-10-a', 'boss-10-b', 'boss-10-c', 'boss-2-a', 'boss-3-a', 'boss-4-a', 'boss-5-a', 'boss-5-b', 'boss-5-c',
      'boss-6-a', 'boss-7-a', 'boss-8-a', 'boss-9-a', 'end-1', 'end-2', 'end-3', 'fail', 'op-1', 'op-2', 'rescue-1', 'rescue-2',
    ]);
    const used = new Set(CUTSCENES.flatMap((c) => c.shots.map((s) => s.image)));
    for (const name of CUTSCENE_IMAGES.filter((n) => n !== 'fail')) expect(used.has(`./art/cut/${name}.webp`), name).toBe(true);
    expect(FAIL_IMAGE).toBe('./art/cut/fail.webp');
  });

  it('stage 5 introduces 한전무, 윤이사 and 사장님 one shot each', () => {
    const c = CUTSCENES.find((x) => x.id === 'boss-5');
    expect(c?.shots.map((s) => s.image)).toEqual(['./art/cut/boss-5-a.webp', './art/cut/boss-5-b.webp', './art/cut/boss-5-c.webp']);
    expect(c?.shots.map((s) => s.speaker)).toEqual(['한전무', '윤이사', '사장님']);
  });

  it('stage 10 introduces 최팀장, 한전무 and 회장님 one shot each', () => {
    const c = CUTSCENES.find((x) => x.id === 'boss-10');
    expect(c?.shots.map((s) => s.image)).toEqual(['./art/cut/boss-10-a.webp', './art/cut/boss-10-b.webp', './art/cut/boss-10-c.webp']);
    expect(c?.shots.map((s) => s.speaker)).toEqual(['최팀장', '한전무', '회장님']);
  });

  it('stages 6-9: the superior speaks, then the hero answers', () => {
    const names = ['강차장', '박과장', '문상무', '윤이사'];
    [6, 7, 8, 9].forEach((n, i) => {
      const c = CUTSCENES.find((x) => x.id === `boss-${n}`);
      expect(c?.shots.map((s) => s.speaker)).toEqual([names[i], HERO]);
      expect(c?.shots.every((s) => s.image === `./art/cut/boss-${n}-a.webp`)).toBe(true);
    });
    // a rematch says its part-2 line, not the part-1 one
    const again = CUTSCENES.find((x) => x.id === 'boss-7')?.shots[0].caption;
    expect(again).not.toBe(CUTSCENES.find((x) => x.id === 'boss-2')?.shots[0].caption);
  });

  it('the part-2 bridge: 18:00:00 칼퇴, then the 단톡방 알림', () => {
    const r = CUTSCENES.find((c) => c.id === 'rescue');
    expect(r?.shots[0].caption).toContain('18:00:00');
    expect(r?.shots.map((s) => s.caption).join(' ')).toContain('단톡방');
  });

  it('ends on the "내일 출근 09:00" twist after the 18:30 front door', () => {
    const end = CUTSCENES.find((c) => c.id === 'escape-end');
    expect(end?.shots[0].caption).toContain('18:30');
    expect(end?.shots[0].caption).toContain('현관문');
    expect(end?.shots[end.shots.length - 1].caption).toContain('내일 출근 09:00');
  });

  it('keeps the player shot timing and Ken Burns ranges, comic all-ages copy (no spy words)', () => {
    for (const c of CUTSCENES) {
      expect(c.title.length).toBeGreaterThan(0);
      for (const s of c.shots) {
        expect(s.image).toMatch(/^\.\/art\/cut\/[a-z0-9-]+\.webp$/);
        expect(s.seconds).toBeGreaterThanOrEqual(2);
        expect(s.seconds).toBeLessThanOrEqual(4);
        expect(s.caption).not.toMatch(/작전|요원|본부|포로|MISSION/);
        for (const k of [s.from, s.to]) {
          expect(k.zoom).toBeGreaterThanOrEqual(1);
          expect(k.zoom).toBeLessThanOrEqual(1.4);
        }
      }
    }
  });
});

describe('cutsceneBefore / cutsceneAfter', () => {
  it('plays the opening, then 김대리, before stage 1; each superior before its stage, once', () => {
    expect(cutsceneBefore(stage(1), save0)?.id).toBe('op-start');
    expect(cutsceneBefore(stage(1), seen('op-start'))?.id).toBe('boss-1');
    expect(cutsceneBefore(stage(1), seen('op-start', 'boss-1'))).toBeNull();
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => cutsceneBefore(stage(n), save0)?.id)).toEqual([
      'boss-2', 'boss-3', 'boss-4', 'boss-5', 'boss-6', 'boss-7', 'boss-8', 'boss-9', 'boss-10',
    ]);
    expect(cutsceneBefore(stage(3), seen('boss-3'))).toBeNull();
    expect(cutsceneBefore({ ...stage(1), id: 'w1-s1', kind: 'normal' }, save0)).toBeNull();
  });

  it('plays the part-2 bridge after the first clear of stage 5, the ending after the first clear of stage 10', () => {
    expect(cutsceneAfter('w5-s10', true, save0)?.id).toBe('rescue');
    expect(cutsceneAfter('w5-s10', false, save0)).toBeNull();
    expect(cutsceneAfter('w5-s10', true, seen('rescue'))).toBeNull();
    expect(cutsceneAfter('w10-s10', true, save0)?.id).toBe('escape-end');
    expect(cutsceneAfter('w10-s10', false, save0)).toBeNull();
    expect(cutsceneAfter('w10-s10', true, seen('escape-end'))).toBeNull();
    for (const n of [1, 2, 3, 4, 6, 7, 8, 9]) expect(cutsceneAfter(`w${n}-s10`, true, save0)).toBeNull();
  });

  it('hero lines are spoken by the chosen character (archive replays say 나)', () => {
    const heroShots = (c: ReturnType<typeof cutsceneBefore>) => (c?.shots ?? []).filter((s) => ['칼퇴준', '정시원', HERO].includes(s.speaker ?? ''));
    expect(CUTSCENES.flatMap((c) => c.shots).some((s) => s.speaker === HERO)).toBe(true);
    const kid = heroShots(cutsceneBefore(stage(1), { ...save0, skin: 'kid' }));
    const cat = heroShots(cutsceneBefore(stage(1), { ...save0, skin: 'cat' }));
    expect(kid.length).toBeGreaterThan(0);
    expect(kid.every((s) => s.speaker === '칼퇴준')).toBe(true);
    expect(cat.every((s) => s.speaker === '정시원')).toBe(true);
    expect(cutsceneAfter('w5-s10', true, { ...save0, skin: 'cat' })?.shots.some((s) => s.speaker === '정시원')).toBe(true);
    expect(cutsceneAfter('w10-s10', true, { ...save0, skin: 'cat' })?.shots.some((s) => s.speaker === '정시원')).toBe(true);
  });

  it('v2.2: the two new hires speak their own names too', () => {
    for (const [skin, name] of [['bunny', '고도약'], ['robot', '유행운']] as const) {
      const shots = cutsceneBefore(stage(1), { ...save0, skin })?.shots ?? [];
      expect(shots.some((s) => s.speaker === name)).toBe(true);
      expect(shots.some((s) => s.speaker === HERO)).toBe(false);
    }
  });
});
