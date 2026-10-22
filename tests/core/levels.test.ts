import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { dailyStage, endlessStage, generateBeats } from '../../src/core/levels';
import { airtimeForLevel, DEFAULT_PHYSICS, physicsForWorld } from '../../src/core/physics';
import type { Beat, Level, StageDef } from '../../src/types';
import { HAZARD_KINDS } from '../../src/types';

const EPS = 1e-6;
const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const birdOnly = (b: Beat) => b.requiredLevel === 0 && b.obstacles.some((o) => o.kind === 'bird');

const cases: StageDef[] = [
  ...STAGES,
  ...[0, 1, 3, 7, 12, 25].map((c) => endlessStage(c, 1234)),
  dailyStage('2026-10-23'),
  dailyStage('2027-01-01'),
];

describe.each(cases.map((s) => [s.id, s] as const))('generateBeats %s', (_id, stage) => {
  const cfg = physicsForWorld(stage.world);
  const beats = generateBeats(stage, cfg);
  const hazards = beats.filter(isHazard);

  it('has exactly hazardBeats hazard beats', () => {
    expect(hazards).toHaveLength(stage.hazardBeats);
  });

  it('is sorted with sequential ids and starts at startTime', () => {
    beats.forEach((b, i) => expect(b.id).toBe(i));
    for (let i = 1; i < beats.length; i++) expect(beats[i].time).toBeGreaterThan(beats[i - 1].time);
    expect(beats[0].time).toBeGreaterThanOrEqual(2.0 - EPS);
  });

  it('quantizes to the half-beat grid', () => {
    const half = 30 / stage.bpm;
    for (const b of beats) {
      const k = (b.time - 2.0) / half;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
    }
  });

  it('respects spacing between hazard beats', () => {
    for (let i = 1; i < hazards.length; i++) {
      const prev = hazards[i - 1];
      const gap = hazards[i].time - prev.time;
      const min = birdOnly(prev) ? 0.5 : airtimeForLevel(prev.requiredLevel as Level, cfg) + 0.18;
      expect(gap).toBeGreaterThanOrEqual(min - EPS);
    }
  });

  it('keeps pickup beats reachable', () => {
    beats.forEach((b, i) => {
      if (isHazard(b)) return;
      const lvl = b.obstacles[0].level;
      const next = beats.slice(i + 1).find(isHazard);
      if (next) expect(next.time - b.time).toBeGreaterThanOrEqual(airtimeForLevel(lvl, cfg) + 0.18 - EPS);
      const prev = beats.slice(0, i).reverse().find(isHazard);
      if (prev && !birdOnly(prev)) {
        const min = airtimeForLevel(prev.requiredLevel as Level, cfg) + 0.18;
        expect(b.time - prev.time).toBeGreaterThanOrEqual(min - EPS);
      }
    });
  });

  it('never combines bird with a level ≥ 2 obstacle', () => {
    for (const b of beats) {
      if (b.obstacles.some((o) => o.kind === 'bird')) expect(b.requiredLevel).toBeLessThanOrEqual(1);
    }
  });

  it('has consistent levels and requiredLevel', () => {
    for (const b of beats) {
      for (const o of b.obstacles) expect([1, 2, 3]).toContain(o.level);
      const req = Math.max(0, ...b.obstacles.filter((o) => o.kind === 'rope' || o.kind === 'hurdle').map((o) => o.level));
      expect(b.requiredLevel).toBe(req);
      if (b.doubleDutch) {
        expect(b.requiredLevel).toBe(1);
        expect(b.obstacles.map((o) => o.kind)).toEqual(['rope']);
      }
    }
  });

  it('respects stage level weights', () => {
    const maxAllowed = stage.levelWeights[2] > 0 ? 3 : stage.levelWeights[1] > 0 ? 2 : 1;
    for (const b of hazards) expect(b.requiredLevel).toBeLessThanOrEqual(maxAllowed);
  });

  it('caps Double-Dutch beats at 35% of hazard beats', () => {
    const dd = beats.filter((b) => b.doubleDutch).length;
    expect(dd).toBeLessThanOrEqual(Math.floor(stage.hazardBeats * 0.35));
  });

  it('has at least one Double-Dutch run of ≥ 4 beats when enabled', () => {
    if (stage.mix.doubleDutch <= 0) {
      expect(beats.some((b) => b.doubleDutch)).toBe(false);
      return;
    }
    const runs = beats.reduce<number[]>((acc, b, i) => {
      if (!b.doubleDutch) return acc;
      if (i > 0 && beats[i - 1].doubleDutch) return [...acc.slice(0, -1), acc[acc.length - 1] + 1];
      return [...acc, 1];
    }, []);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) expect(r).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic', () => {
    expect(generateBeats(stage, cfg)).toEqual(beats);
  });
});

describe('generateBeats details', () => {
  it('offsets by startTime', () => {
    const s = STAGES[3];
    const a = generateBeats(s, DEFAULT_PHYSICS, 2);
    const b = generateBeats(s, DEFAULT_PHYSICS, 12);
    expect(b.map((x) => x.time - 10)).toEqual(a.map((x) => expect.closeTo(x.time, 6)));
  });

  it('W1-S1 is rope-only 1단', () => {
    const beats = generateBeats(STAGES[0], DEFAULT_PHYSICS).filter(isHazard);
    expect(beats.every((b) => b.requiredLevel === 1 && b.obstacles.every((o) => o.kind === 'rope'))).toBe(true);
  });

  it('produces double-dutch sections of 4-8 in W3', () => {
    const all = STAGES.filter((s) => s.world === 2).flatMap((s) => {
      const beats = generateBeats(s, DEFAULT_PHYSICS);
      const runs: number[] = [];
      let run = 0;
      for (const b of beats) {
        if (b.doubleDutch) run++;
        else if (run > 0) { runs.push(run); run = 0; }
      }
      if (run > 0) runs.push(run);
      return runs;
    });
    expect(all.length).toBeGreaterThan(0);
    for (const r of all) {
      expect(r).toBeGreaterThanOrEqual(4);
      expect(r).toBeLessThanOrEqual(8);
    }
  });

  it('later stages contain birds, hurdles, combos and pickups', () => {
    const beats = STAGES.slice(15).flatMap((s) => generateBeats(s, physicsForWorld(s.world)));
    const kinds = new Set(beats.flatMap((b) => b.obstacles.map((o) => o.kind)));
    for (const k of ['rope', 'hurdle', 'bird', 'coin'] as const) expect(kinds.has(k)).toBe(true);
    expect(beats.some((b) => b.obstacles.length >= 2)).toBe(true);
    expect(beats.some((b) => b.requiredLevel === 3)).toBe(true);
  });
});

describe('endlessStage', () => {
  it('ids by chunk and ramps difficulty', () => {
    const c0 = endlessStage(0, 1);
    const c20 = endlessStage(20, 1);
    expect(c0.id).toBe('endless-0');
    expect(c0.hazardBeats).toBe(12);
    expect(c20.bpm).toBeGreaterThan(c0.bpm);
    expect(c20.bpm).toBeLessThanOrEqual(140);
    expect(endlessStage(200, 1).bpm).toBe(140);
    expect(c20.levelWeights[2]).toBeGreaterThan(c0.levelWeights[2]);
    expect(c20.mix.combo).toBeGreaterThan(c0.mix.combo);
  });

  it('is deterministic and seed dependent', () => {
    expect(endlessStage(3, 9)).toEqual(endlessStage(3, 9));
    expect(endlessStage(3, 9).seed).not.toBe(endlessStage(3, 10).seed);
    expect(endlessStage(3, 9).seed).not.toBe(endlessStage(4, 9).seed);
  });
});

describe('dailyStage', () => {
  it('is deterministic per date', () => {
    const a = dailyStage('2026-10-23');
    expect(a).toEqual(dailyStage('2026-10-23'));
    expect(a.id).toBe('daily-2026-10-23');
    expect(a.name).toBe('오늘의 도전');
    expect(a.hazardBeats).toBe(30);
    expect(a.seed).not.toBe(dailyStage('2026-10-24').seed);
  });
});
