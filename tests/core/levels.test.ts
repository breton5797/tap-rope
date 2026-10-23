import { describe, expect, it } from 'vitest';
import { CHAPTERS, DESIGNED_LOOKS, movesForMix, STAGES } from '../../src/core/content';
import { dailyStage, endlessStage, generateBeats } from '../../src/core/levels';
import { airtimeForLevel, DEFAULT_PHYSICS, physicsForWorld } from '../../src/core/physics';
import { moveForBeat } from '../../src/core/timeline';
import type { Beat, Level, ObstacleKind, PhysicsConfig, StageDef } from '../../src/types';
import { HAZARD_KINDS } from '../../src/types';

const EPS = 1e-6;
const S = 0.18;
const has = (b: Beat, k: ObstacleKind) => b.obstacles.some((o) => o.kind === k);
const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const isJump = (b: Beat) => has(b, 'floor') || has(b, 'beam');
const isSlide = (b: Beat) => has(b, 'high') || has(b, 'ceiling');
const droneOnly = (b: Beat) => has(b, 'drone') && !isJump(b);
const isRear = (b: Beat) => b.obstacles.some((o) => o.kind === 'beam' && o.from === 'back');

/** v4 spacing rule (§4): minimum seconds the generator must leave after `prev` before `next`. */
function minGap(prev: Beat, next: Beat, cfg: PhysicsConfig): number {
  if (prev.requiredLevel > 0) return airtimeForLevel(prev.requiredLevel as Level, cfg) + S;
  if (prev.needsSlide) return 0.6;
  if (droneOnly(prev)) return next.requiredLevel >= 2 ? airtimeForLevel(1, cfg) + S : 0.5;
  return 0;
}

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

  it('respects v4 spacing and the 0.45s reaction floor between hazards', () => {
    for (let i = 1; i < hazards.length; i++) {
      const gap = hazards[i].time - hazards[i - 1].time;
      expect(gap).toBeGreaterThanOrEqual(minGap(hazards[i - 1], hazards[i], cfg) - EPS);
      expect(gap).toBeGreaterThanOrEqual(0.45);
    }
  });

  it('keeps pickup beats reachable', () => {
    beats.forEach((b, i) => {
      if (isHazard(b)) return;
      expect(b.obstacles).toHaveLength(1);
      const o = b.obstacles[0];
      const next = beats.slice(i + 1).find(isHazard);
      if (next) expect(next.time - b.time).toBeGreaterThanOrEqual(airtimeForLevel(o.level, cfg) + S - EPS);
      const prev = beats.slice(0, i).reverse().find(isHazard);
      if (prev) expect(b.time - prev.time).toBeGreaterThanOrEqual(minGap(prev, b, cfg) - EPS);
    });
  });

  it('builds well-formed beats', () => {
    for (const b of beats) {
      expect(isJump(b) && isSlide(b)).toBe(false);
      expect(b.needsSlide).toBe(isSlide(b));
      const req = Math.max(0, ...b.obstacles.filter((o) => o.kind === 'floor' || o.kind === 'beam').map((o) => o.level));
      expect(b.requiredLevel).toBe(req);
      for (const o of b.obstacles) {
        expect([1, 2, 3]).toContain(o.level);
        if (o.kind === 'floor' || o.kind === 'high' || o.kind === 'ceiling' || o.kind === 'drone') expect(o.level).toBe(1);
        if (o.kind === 'beam' || o.kind === 'high') expect(['front', 'back']).toContain(o.from);
      }
      if (has(b, 'drone')) {
        expect(b.obstacles.map((o) => o.kind).sort()).toEqual(isJump(b) ? ['drone', 'floor'] : ['drone']);
      }
    }
    const top = stage.levelWeights[2] > 0 ? 3 : stage.levelWeights[1] > 0 ? 2 : 1;
    for (const b of hazards) expect(b.requiredLevel).toBeLessThanOrEqual(top);
  });

  it('places pulse lasers in runs of 4–8 floor lasers, at most 35% of hazards', () => {
    const pulses = beats.filter((b) => b.pulse);
    expect(pulses.length).toBeLessThanOrEqual(Math.floor(stage.hazardBeats * 0.35));
    for (const n of runs(beats, (b) => b.pulse)) {
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(8);
    }
    for (const b of pulses) expect(b.obstacles).toEqual([{ kind: 'floor', level: 1 }]);
  });

  it('contains every move listed in stage.moves, and only producible moves', () => {
    const used = new Set(hazards.map(moveForBeat));
    for (const m of stage.moves) expect(used.has(m), m).toBe(true);
    const allowed = movesForMix(stage.levelWeights, stage.mix);
    for (const m of used) expect(allowed).toContain(m);
  });

  it('is deterministic', () => {
    expect(generateBeats(stage, cfg)).toEqual(beats);
  });
});

describe('generateBeats details', () => {
  const gen = (id: string) => {
    const s = STAGES.find((x) => x.id === id) as StageDef;
    return generateBeats(s, physicsForWorld(s.world));
  };

  it('offsets by startTime', () => {
    const s = STAGES[3];
    const a = generateBeats(s, DEFAULT_PHYSICS, 2);
    const b = generateBeats(s, DEFAULT_PHYSICS, 12);
    expect(b.map((x) => x.time - 10)).toEqual(a.map((x) => expect.closeTo(x.time, 6)));
  });

  it('w1-s1 is floor lasers only', () => {
    const hz = gen('w1-s1').filter(isHazard);
    expect(hz.every((b) => b.obstacles.every((o) => o.kind === 'floor'))).toBe(true);
  });

  it('introduction stages feature their new move several times (§5 numbers)', () => {
    const count = (id: string, f: (b: Beat) => boolean) => gen(id).filter(f).length;
    expect(count('w1-s2', (b) => has(b, 'beam'))).toBeGreaterThanOrEqual(3);
    expect(count('w1-s4', (b) => b.requiredLevel === 2)).toBeGreaterThanOrEqual(4);
    expect(count('w1-s6', (b) => has(b, 'ceiling'))).toBeGreaterThanOrEqual(3);
    expect(count('w1-s8', (b) => has(b, 'drone'))).toBeGreaterThanOrEqual(3);
    expect(count('w2-s1', (b) => b.requiredLevel === 3)).toBeGreaterThanOrEqual(3);
    expect(count('w2-s3', (b) => has(b, 'high'))).toBeGreaterThanOrEqual(3);
    expect(count('w2-s6', isRear)).toBeGreaterThanOrEqual(3);
    expect(count('w3-s1', (b) => has(b, 'drone') && has(b, 'floor'))).toBeGreaterThanOrEqual(3);
    expect(count('w3-s4', (b) => b.pulse)).toBeGreaterThanOrEqual(4);
  });

  it('mixes jumps and slides in later stages', () => {
    for (const s of STAGES.filter((x) => x.chapter >= 3 && x.kind !== 'bonus')) {
      const hz = generateBeats(s, physicsForWorld(s.world)).filter(isHazard);
      const share = hz.filter(isSlide).length / hz.length;
      expect(share, s.id).toBeGreaterThanOrEqual(0.08);
      expect(share, s.id).toBeLessThanOrEqual(0.45);
    }
  });
});

describe('endlessStage', () => {
  it('ramps difficulty and unlocks moves by chunk', () => {
    const c0 = endlessStage(0, 1);
    const c20 = endlessStage(20, 1);
    expect(c0).toMatchObject({ id: 'endless-0', chapter: 0, kind: 'normal', hazardBeats: 16 });
    expect(c20.bpm).toBeGreaterThan(c0.bpm);
    expect(c20.bpm).toBeLessThanOrEqual(140);
    expect(endlessStage(200, 1).bpm).toBe(140);
    expect(c20.moves.length).toBeGreaterThan(c0.moves.length);
    expect(endlessStage(6, 1).moves).toContain('pulse');
  });

  it('is deterministic and seed dependent', () => {
    expect(endlessStage(3, 9)).toEqual(endlessStage(3, 9));
    expect(endlessStage(3, 9).seed).not.toBe(endlessStage(3, 10).seed);
    expect(endlessStage(3, 9).seed).not.toBe(endlessStage(4, 9).seed);
  });
});

describe('dailyStage', () => {
  it('is deterministic per date and uses the campaign formula', () => {
    const a = dailyStage('2026-10-23');
    expect(a).toEqual(dailyStage('2026-10-23'));
    expect(a).toMatchObject({ id: 'daily-2026-10-23', name: '오늘의 도전', chapter: 0, kind: 'normal' });
    expect(a.hazardBeats).toBeGreaterThanOrEqual(28);
    expect(a.hazardBeats).toBeLessThanOrEqual(36);
    expect(a.seed).not.toBe(dailyStage('2026-10-24').seed);
  });
});

describe('designed theme × variant looks (§5)', () => {
  const ok = (s: StageDef) => DESIGNED_LOOKS[s.world].includes(s.variant);

  it('endless chunks cycle designed looks', () => {
    const looks = Array.from({ length: 64 }, (_, c) => endlessStage(c, 7));
    for (const s of looks) expect(ok(s), `${s.id} ${s.world}/${s.variant}`).toBe(true);
    expect(new Set(looks.map((s) => `${s.world}/${s.variant}`)).size).toBe(10);
  });

  it('daily dates pick one of the 10 chapter looks', () => {
    const start = Date.UTC(2026, 0, 1);
    const seen = new Set<string>();
    for (let d = 0; d < 400; d++) {
      const s = dailyStage(new Date(start + d * 86400000).toISOString().slice(0, 10));
      expect(ok(s), s.id).toBe(true);
      seen.add(`${s.world}/${s.variant}`);
    }
    expect(seen.size).toBe(CHAPTERS.length);
  });

  it('campaign stages only use designed pairs', () => {
    for (const s of STAGES) expect(ok(s), s.id).toBe(true);
  });
});
