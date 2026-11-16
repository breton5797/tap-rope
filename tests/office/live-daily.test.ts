// 오늘의 칼퇴 미션: one deterministic three-mission stage per (date, tier) — only unlocked moves, a superior the
// player has met, theme emphasis inside the fairness rules — recognised by the office levels / missions / boss.
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { generateStage } from '../../src/core/levels';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import { bossFor, bossForSection, bossView } from '../../src/core/boss';
import { cutsceneBefore } from '../../src/core/cutscenes';
import { defaultSave } from '../../src/core/storage';
import { startMissions } from '../../src/office/game/missions';
import { missionsOf } from '../../src/office/core/stage-missions';
import {
  dailyHazards, THEME_PICKUP_MAX, addDays, dailyPlan, dailyUnlocked, parseDailyId, progressTier, themeOf, weekOf,
  type ProgressTier,
} from '../../src/office/core/live';
import { HAZARD_KINDS, type Beat } from '../../src/types';

const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const DATES = Array.from({ length: 60 }, (_, i) => addDays('2026-11-16', i * 3));
const TIERS: readonly ProgressTier[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('progress tier', () => {
  it('is the highest office stage cleared; the daily opens after stage 1', () => {
    expect(progressTier({})).toBe(0);
    expect(progressTier({ 'w1-s10': 1 })).toBe(1);
    expect(progressTier({ 'w1-s10': 3, 'w2-s10': 1, 'w4-s10': 2 })).toBe(4);
    expect(progressTier({ 'w10-s10': 1, 'w1-s10': 0 })).toBe(10);
    expect(progressTier({ 'live-2026-11-16-t3-b2': 3, 'w3-s10': 0 })).toBe(0);
    expect([0, 1, 10].map((t) => dailyUnlocked(t as ProgressTier))).toEqual([false, true, true]);
  });
});

describe('dailyPlan', () => {
  it('is deterministic per (date, tier), differs across dates, and its id round-trips', () => {
    const a = dailyPlan('2026-11-16', 3);
    expect(dailyPlan('2026-11-16', 3)).toEqual(a);
    expect(parseDailyId(a.stage.id)).toEqual({ date: '2026-11-16', tier: 3 });
    expect(a.stage.id.startsWith('live-2026-11-16-t3')).toBe(true);
    const seeds = new Set(DATES.map((d) => dailyPlan(d, 3).stage.seed));
    expect(seeds.size).toBe(DATES.length);
    expect(dailyPlan('2026-11-16', 4).stage.id).not.toBe(a.stage.id);
    expect(parseDailyId('w3-s10')).toBeNull();
    expect(parseDailyId('live-2026-02-30-t3-b1')).toBeNull();
  });

  it('uses only moves the player has unlocked (up to the tier stage), three sections, the hazard counts of the day', () => {
    for (const t of TIERS) {
      const unlocked = STAGES[t - 1].moves;
      for (const d of DATES.slice(0, 10)) {
        const p = dailyPlan(d, t);
        expect(p.stage.sections).toBe(3);
        for (const m of p.stage.moves) expect(unlocked, `${d} t${t} stage ${m}`).toContain(m);
        p.missions.forEach((m, k) => {
          for (const mv of [...m.moves, ...(m.focus ?? [])]) expect(unlocked, `${d} t${t} part ${k} ${mv}`).toContain(mv);
          expect(m.hazards).toBe(dailyHazards(t)[k]);
        });
        expect(p.missions.map((m) => m.kind)).toEqual(['dodge', 'collect', 'finale']);
        // the collect title is the item's name, as in the campaign (the card adds "N개 모으기")
        expect(p.missions[1].title).not.toContain('모으기');
      }
    }
    // tier 1: the three first moves only
    for (const d of DATES) for (const m of dailyPlan(d, 1).missions.flatMap((x) => x.moves)) expect(['jump', 'slide', 'lane']).toContain(m);
  });

  it('brings a superior the player has met; the week theme can favour one (윤이사 on 회식 피하기 weeks)', () => {
    for (const t of TIERS) for (const d of DATES) expect(dailyPlan(d, t).boss.stage, `${d} t${t}`).toBeLessThanOrEqual(t);
    const dinner = DATES.map(weekOf).find((w) => themeOf(w).id === 'dodge-dinner')!;
    const week = Array.from({ length: 7 }, (_, i) => addDays(dinner, i));
    expect(week.filter((d) => dailyPlan(d, 9).boss.slot === 'apc').length).toBeGreaterThanOrEqual(4);
    // over many days several different superiors show up
    expect(new Set(DATES.map((d) => dailyPlan(d, 10).boss.name)).size).toBeGreaterThanOrEqual(6);
  });

  it('theme emphasis stays fair: pickups at most ×THEME_PICKUP_MAX, the collect item, no extra hazards', () => {
    for (const d of DATES) {
      const p = dailyPlan(d, 6);
      const theme = themeOf(weekOf(d));
      expect(p.theme).toBe(theme.id);
      // dodge 0.25 / finale 0.15 at most THEME_PICKUP_MAX times (the collect part is all items anyway)
      expect(p.missions[0].pickupRate).toBeLessThanOrEqual(0.25 * THEME_PICKUP_MAX + 1e-9);
      expect(p.missions[2].pickupRate).toBeLessThanOrEqual(0.15 * THEME_PICKUP_MAX + 1e-9);
      if (!theme.emphasis.pickupMul) expect([p.missions[0].pickupRate, p.missions[2].pickupRate]).toEqual([0.25, 0.15]);
      if (theme.emphasis.collectible) expect(p.missions[1].collectible).toBe(theme.emphasis.collectible);
    }
  });
});

describe('the daily stage in the office systems', () => {
  it('missionsOf, levels, mission tracker and boss all recognise it; no campaign cutscene plays', () => {
    for (const d of DATES.slice(0, 12)) {
      const p = dailyPlan(d, 7);
      expect(missionsOf(p.stage.id)).toEqual(p.missions);
      const { beats, doors } = generateStage(p.stage, DEFAULT_PHYSICS);
      expect(doors.map((x) => x.section)).toEqual([1, 2]);
      [0, 1, 2].forEach((k) => expect(beats.filter((b) => b.part === k && isHazard(b)).length).toBe(dailyHazards(7)[k]));
      expect(startMissions(p.stage, beats)).not.toBeNull();
      for (const s of [0, 1, 2]) expect(bossForSection(p.stage, s)).toMatchObject({ id: p.boss.slot, name: p.boss.name });
      expect(bossFor(p.stage)?.name).toBe(p.boss.name);
      const hz = beats.filter(isHazard);
      expect(bossView(p.stage, beats, doors, 0, 0, hz.length)).toMatchObject({ id: p.boss.slot, hp: 1 });
      expect(cutsceneBefore(p.stage, defaultSave())).toBeNull();
    }
    // memoised: repeated lookups of a daily id return the same object (called per judge event / view change)
    const id = dailyPlan('2026-11-20', 5).stage.id;
    expect(missionsOf(id)).toBe(missionsOf(id));
    const other = dailyPlan('2026-11-21', 5).stage.id;
    expect(missionsOf(other)).toEqual(dailyPlan('2026-11-21', 5).missions);
    expect(missionsOf(id)).toEqual(dailyPlan('2026-11-20', 5).missions);
    // campaign stages are untouched
    expect(missionsOf('w3-s10')?.[0].kind).toBe('chase');
    expect(missionsOf('nope')).toBeUndefined();
  });
});
