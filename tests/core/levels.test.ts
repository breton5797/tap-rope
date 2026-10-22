import { describe, expect, it } from 'vitest';
import { movesForMix, STAGES } from '../../src/core/content';
import { dailyStage, endlessStage, generateBeats } from '../../src/core/levels';
import { airtimeForLevel, airtimeTumble, DEFAULT_PHYSICS, physicsForWorld } from '../../src/core/physics';
import { moveForBeat } from '../../src/core/timeline';
import type { Beat, Level, ObstacleKind, PhysicsConfig, StageDef } from '../../src/types';
import { HAZARD_KINDS } from '../../src/types';

const EPS = 1e-6;
const S = 0.18;
const has = (b: Beat, k: ObstacleKind) => b.obstacles.some((o) => o.kind === k);
const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const balls = (b: Beat) => b.obstacles.filter((o) => o.kind === 'ball');
const ropes = (b: Beat) => b.obstacles.filter((o) => o.kind === 'rope');
const isCross = (b: Beat) => ropes(b).some((o) => o.cross);
const isBack = (b: Beat) => ropes(b).some((o) => o.back);
const birdOnly = (b: Beat) => b.requiredLevel === 0 && has(b, 'bird');

/** v2 spacing rule: minimum seconds the generator must leave after `prev` before `next`. */
function minGap(prev: Beat, next: Beat, cfg: PhysicsConfig): number {
  const a1 = airtimeForLevel(1, cfg);
  const after = has(prev, 'ring') ? airtimeTumble(cfg) + S
    : isCross(prev) ? airtimeForLevel(2, cfg) + S
      : prev.requiredLevel > 0 ? airtimeForLevel(prev.requiredLevel as Level, cfg) + S
        : birdOnly(prev) ? 0.5 : a1 + S; // ball-only
  const n = balls(next).length;
  const before = n === 2 ? 2 * a1 + 0.3 : n === 1 ? a1 + S : isCross(next) ? airtimeForLevel(2, cfg) + S : 0;
  return Math.max(after, before);
}

/** consecutive runs of beats matching `f` (runs are broken by any other beat) */
function runs(beats: readonly Beat[], f: (b: Beat) => boolean): number[] {
  return beats.reduce<number[]>((acc, b, i) => {
    if (!f(b)) return acc;
    if (i > 0 && f(beats[i - 1])) return [...acc.slice(0, -1), acc[acc.length - 1] + 1];
    return [...acc, 1];
  }, []);
}

const cases: StageDef[] = [
  ...STAGES,
  ...[0, 1, 2, 3, 4, 5, 7, 12, 25].map((c) => endlessStage(c, 1234)),
  ...['2026-10-23', '2026-10-24', '2027-01-01', '2027-02-14'].map(dailyStage),
];

describe.each(cases.map((s) => [s.id, s] as const))('generateBeats %s', (_id, stage) => {
  const cfg = physicsForWorld(stage.world);
  const beats = generateBeats(stage, cfg);
  const hazards = beats.filter(isHazard);
  const solo = stage.ropeMode === 'solo';

  it('has exactly hazardBeats hazard beats, sorted, sequential ids, on the half-beat grid', () => {
    expect(hazards).toHaveLength(stage.hazardBeats);
    beats.forEach((b, i) => expect(b.id).toBe(i));
    for (let i = 1; i < beats.length; i++) expect(beats[i].time).toBeGreaterThan(beats[i - 1].time);
    expect(beats[0].time).toBeGreaterThanOrEqual(2.0 - EPS);
    const half = 30 / stage.bpm;
    for (const b of beats) {
      const k = (b.time - 2.0) / half;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
    }
  });

  it('respects v2 spacing between hazard beats', () => {
    for (let i = 1; i < hazards.length; i++) {
      const gap = hazards[i].time - hazards[i - 1].time;
      expect(gap).toBeGreaterThanOrEqual(minGap(hazards[i - 1], hazards[i], cfg) - EPS);
    }
  });

  it('keeps pickup beats reachable in a lane', () => {
    beats.forEach((b, i) => {
      if (isHazard(b)) return;
      expect(b.obstacles).toHaveLength(1);
      const o = b.obstacles[0];
      expect([-1, 0, 1]).toContain(o.lane ?? 0);
      const next = beats.slice(i + 1).find(isHazard);
      if (next) expect(next.time - b.time).toBeGreaterThanOrEqual(airtimeForLevel(o.level, cfg) + S - EPS);
      const prev = beats.slice(0, i).reverse().find(isHazard);
      if (prev) expect(b.time - prev.time).toBeGreaterThanOrEqual((birdOnly(prev) ? 0.5 : minGap(prev, b, cfg)) - EPS);
    });
  });

  it('never combines bird with level ≥ 2 or a ring', () => {
    for (const b of beats.filter((x) => has(x, 'bird'))) {
      expect(b.requiredLevel).toBeLessThanOrEqual(1);
      expect(has(b, 'ring')).toBe(false);
    }
  });

  it('has consistent levels and requiredLevel', () => {
    for (const b of beats) {
      for (const o of b.obstacles) expect([1, 2, 3]).toContain(o.level);
      const req = Math.max(0, ...b.obstacles.filter((o) => o.kind === 'rope' || o.kind === 'hurdle').map((o) => o.level));
      expect(b.requiredLevel).toBe(req);
    }
    const top = stage.levelWeights[2] > 0 ? 3 : stage.levelWeights[1] > 0 ? 2 : 1;
    for (const b of hazards) expect(b.requiredLevel).toBeLessThanOrEqual(top);
  });

  it('keeps long-only features out of solo and solo-only features out of long', () => {
    for (const b of beats) {
      if (solo) {
        expect(has(b, 'ring') || has(b, 'hurdle') || b.doubleDutch).toBe(false);
      } else {
        expect(isBack(b)).toBe(false);
        expect(isCross(b)).toBe(false);
      }
    }
  });

  it('places 1–2 balls per beat in distinct lanes, optionally with a 1단 rope', () => {
    for (const b of beats.filter((x) => balls(x).length > 0)) {
      const lanes = balls(b).map((o) => o.lane ?? 0);
      expect(lanes.length).toBeLessThanOrEqual(2);
      expect(new Set(lanes).size).toBe(lanes.length);
      expect(b.requiredLevel).toBeLessThanOrEqual(1);
      expect(b.obstacles.every((o) => o.kind === 'ball' || o.kind === 'rope')).toBe(true);
    }
  });

  it('puts cross only on level 1–2 ropes', () => {
    for (const b of beats.filter(isCross)) {
      expect(ropes(b).every((o) => o.level <= 2)).toBe(true);
      expect(b.obstacles).toHaveLength(1);
    }
  });

  it('places back ropes only in solo runs of 3–8', () => {
    const r = runs(beats, isBack);
    for (const n of r) {
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(8);
    }
    for (const b of beats.filter(isBack)) expect(b.obstacles).toHaveLength(1);
  });

  it('keeps rings alone (no rope, ball, bird or pickup)', () => {
    for (const b of beats.filter((x) => has(x, 'ring'))) expect(b.obstacles.map((o) => o.kind)).toEqual(['ring']);
  });

  it('never pairs a cross rope with a bird', () => {
    for (const b of beats.filter(isCross)) expect(has(b, 'bird')).toBe(false);
  });

  it('never puts a ball on a rope beat that changes direction (↓ and a side hop cannot share a jump)', () => {
    let prevBack = false;
    for (const b of beats) {
      if (ropes(b).length === 0) continue;
      if (balls(b).length > 0) expect(isBack(b)).toBe(prevBack);
      prevBack = isBack(b);
    }
    beats.forEach((b, i) => {
      if (!isBack(b)) return;
      const next = beats.slice(i + 1).find((x) => ropes(x).length > 0 || balls(x).length > 0);
      if (next && !isBack(next)) expect(balls(next)).toHaveLength(0); // first beat after a section
    });
  });

  it('caps back ropes at 35% of hazard beats', () => {
    expect(beats.filter(isBack).length).toBeLessThanOrEqual(Math.floor(stage.hazardBeats * 0.35));
  });

  it('gives solo stages that list cross at least 4 cross ropes (≥ 20 hazards)', () => {
    if (!solo || !stage.moves.includes('cross') || stage.hazardBeats < 20) return;
    expect(beats.filter(isCross).length).toBeGreaterThanOrEqual(4);
  });

  it('caps Double-Dutch at 35% in runs of 4–8 (long only)', () => {
    const dd = beats.filter((b) => b.doubleDutch);
    expect(dd.length).toBeLessThanOrEqual(Math.floor(stage.hazardBeats * 0.35));
    for (const n of runs(beats, (b) => b.doubleDutch)) {
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(8);
    }
    for (const b of dd) expect(b.obstacles.map((o) => [o.kind, o.level])).toEqual([['rope', 1]]);
  });

  it('contains every move listed in stage.moves, and only producible moves', () => {
    const used = new Set(hazards.map(moveForBeat));
    for (const m of stage.moves) expect(used.has(m)).toBe(true);
    const allowed = movesForMix(stage.ropeMode, stage.levelWeights, stage.mix);
    for (const m of used) expect(allowed).toContain(m);
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

  it('introduction stages feature their new move several times', () => {
    const count = (id: string, f: (b: Beat) => boolean) => {
      const s = STAGES.find((x) => x.id === id) as StageDef;
      return generateBeats(s, physicsForWorld(s.world)).filter(f).length;
    };
    expect(count('w1-s2', (b) => has(b, 'hurdle'))).toBeGreaterThanOrEqual(3);
    expect(count('w1-s3', (b) => b.requiredLevel === 2)).toBeGreaterThanOrEqual(4);
    expect(count('w1-s4', (b) => has(b, 'ball'))).toBeGreaterThanOrEqual(4);
    expect(count('w2-s1', (b) => has(b, 'ring'))).toBeGreaterThanOrEqual(4);
    expect(count('w2-s2', isCross)).toBeGreaterThanOrEqual(4);
    expect(count('w2-s3', (b) => b.requiredLevel === 3)).toBeGreaterThanOrEqual(3);
    expect(count('w3-s1', isBack)).toBeGreaterThanOrEqual(6);
    expect(count('w3-s2', (b) => b.doubleDutch)).toBeGreaterThanOrEqual(4);
  });

  it('balances cross and back in late solo stages (each 15–30% of hazards)', () => {
    for (const s of STAGES.slice(14).filter((x) => x.ropeMode === 'solo')) {
      const hz = generateBeats(s, physicsForWorld(s.world)).filter(isHazard);
      for (const f of [isCross, isBack]) {
        const share = hz.filter(f).length / hz.length;
        expect(share).toBeGreaterThanOrEqual(0.15);
        expect(share).toBeLessThanOrEqual(0.3);
      }
    }
  });

  it('allows level-2 back ropes only from W3-S5 on', () => {
    const backLevels = (s: StageDef) => generateBeats(s, physicsForWorld(s.world)).filter(isBack).map((b) => b.requiredLevel);
    for (const s of STAGES.slice(0, 14)) expect(backLevels(s).every((l) => l === 1)).toBe(true);
    expect(STAGES.slice(14).some((s) => backLevels(s).includes(2))).toBe(true);
  });
});

describe('endlessStage', () => {
  it('alternates long/solo by chunk and ramps difficulty', () => {
    const c0 = endlessStage(0, 1);
    const c20 = endlessStage(20, 1);
    expect(c0.id).toBe('endless-0');
    expect(c0.hazardBeats).toBe(12);
    expect([0, 1, 2, 3].map((c) => endlessStage(c, 1).ropeMode)).toEqual(['long', 'solo', 'long', 'solo']);
    expect(c20.bpm).toBeGreaterThan(c0.bpm);
    expect(c20.bpm).toBeLessThanOrEqual(140);
    expect(endlessStage(200, 1).bpm).toBe(140);
    expect(c20.levelWeights[2]).toBeGreaterThan(c0.levelWeights[2]);
    expect(c20.mix.combo).toBeGreaterThan(c0.mix.combo);
    for (const c of [1, 3, 9]) {
      const s = endlessStage(c, 1);
      expect([s.mix.hurdle, s.mix.doubleDutch, s.mix.ring]).toEqual([0, 0, 0]);
    }
  });

  it('is deterministic and seed dependent', () => {
    expect(endlessStage(3, 9)).toEqual(endlessStage(3, 9));
    expect(endlessStage(3, 9).seed).not.toBe(endlessStage(3, 10).seed);
    expect(endlessStage(3, 9).seed).not.toBe(endlessStage(4, 9).seed);
  });
});

describe('dailyStage', () => {
  it('is deterministic per date and picks the rope mode by seed', () => {
    const a = dailyStage('2026-10-23');
    expect(a).toEqual(dailyStage('2026-10-23'));
    expect(a.id).toBe('daily-2026-10-23');
    expect(a.name).toBe('오늘의 도전');
    expect(a.hazardBeats).toBe(30);
    expect(a.seed).not.toBe(dailyStage('2026-10-24').seed);
    const modes = new Set(Array.from({ length: 20 }, (_, d) => dailyStage(`2026-11-${String(d + 1).padStart(2, '0')}`).ropeMode));
    expect(modes).toEqual(new Set(['long', 'solo']));
  });
});
