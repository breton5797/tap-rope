import { describe, expect, it } from 'vitest';
import { CHAPTERS, DESIGNED_LOOKS, movesForMix, sceneFor, STAGES, transitionFor } from '../../src/core/content';
import { DOOR_BREAK, dailyStage, ENDLESS_MAX_BPM, endlessStage, endlessVariant, generateBeats, generateStage } from '../../src/core/levels';
import { airtimeForLevel, DEFAULT_PHYSICS, physicsForWorld } from '../../src/core/physics';
import { moveForBeat } from '../../src/core/timeline';
import type { Beat, LaneId, Level, MoveId, ObstacleKind, PhysicsConfig, StageDef } from '../../src/types';
import { HAZARD_KINDS, LANE_HAZARD_KINDS, LANES } from '../../src/types';

const EPS = 1e-6;
const S = 0.18;
const has = (b: Beat, k: ObstacleKind) => b.obstacles.some((o) => o.kind === k);
const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const isJump = (b: Beat) => has(b, 'floor') || has(b, 'beam');
const isSlide = (b: Beat) => has(b, 'high') || has(b, 'ceiling');
const droneOnly = (b: Beat) => has(b, 'drone') && !isJump(b);
const isRear = (b: Beat) => b.obstacles.some((o) => o.kind === 'beam' && o.from === 'back');
const isLane = (b: Beat) => b.obstacles.some((o) => LANE_HAZARD_KINDS.includes(o.kind));
const safeLanes = (b: Beat): LaneId[] => LANES.filter((l) => !b.blockedLanes.includes(l));
const JUMP_ONLY: readonly MoveId[] = ['jump', 'beam', 'double', 'triple', 'rear', 'pulse'];

/** v4 spacing rule (§4) + v5 lane gaps (§5): minimum seconds the generator must leave after `prev` before `next`. */
function minGap(prev: Beat, next: Beat, cfg: PhysicsConfig): number {
  const lane = isLane(prev) ? 0.45 : 0;
  const swap = isLane(prev) && isLane(next) && !safeLanes(prev).some((l) => safeLanes(next).includes(l)) ? 0.6 : 0;
  let v4 = 0;
  if (prev.requiredLevel > 0) v4 = airtimeForLevel(prev.requiredLevel as Level, cfg) + S;
  else if (prev.needsSlide) v4 = 0.6;
  else if (droneOnly(prev)) v4 = next.requiredLevel >= 2 ? airtimeForLevel(1, cfg) + S : 0.5;
  return Math.max(v4, lane, swap);
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
  const { doors } = generateStage(stage, cfg);

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

  it('respects v4/v5 spacing and the 0.45s reaction floor between hazards', () => {
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
      expect(o.lanes).toHaveLength(1);
      if (next && isLane(next)) expect(next.blockedLanes).not.toContain(o.lanes?.[0]);
    });
  });

  it('v5 lane hazards: one kind per beat, 1–2 lanes (chaser 1), never all 3, never in a pulse', () => {
    for (const b of beats) {
      const lane = b.obstacles.filter((o) => LANE_HAZARD_KINDS.includes(o.kind));
      const union = [...new Set(lane.flatMap((o) => o.lanes ?? []))].sort();
      expect(b.blockedLanes).toEqual(union);
      expect(safeLanes(b).length).toBeGreaterThanOrEqual(1);
      expect(lane.length).toBeLessThanOrEqual(1);
      for (const o of lane) {
        expect(o.level).toBe(1);
        expect(o.lanes?.length).toBeGreaterThanOrEqual(1);
        expect(o.lanes?.length).toBeLessThanOrEqual(o.kind === 'chaser' ? 1 : 2);
        expect([...(o.lanes ?? [])]).toEqual([...new Set(o.lanes)].sort());
      }
      if (lane.length > 0) {
        expect(b.pulse).toBe(false);
        expect(has(b, 'drone')).toBe(false);
        expect(b.requiredLevel).toBeLessThanOrEqual(1);
        expect(b.obstacles.filter((o) => !LANE_HAZARD_KINDS.includes(o.kind)).length).toBeLessThanOrEqual(1);
      }
      for (const o of b.obstacles) if (!LANE_HAZARD_KINDS.includes(o.kind) && HAZARD_KINDS.includes(o.kind)) expect(o.lanes).toBeUndefined();
    }
  });

  it('the first lane beat blocks the start lane (1), so a lane change is really needed', () => {
    const first = hazards.find(isLane);
    if (stage.mix.lane > 0) expect(first, 'stage has lane beats').toBeDefined();
    if (first) expect(first.blockedLanes).toContain(1);
  });

  it('always leaves a reachable safe lane: non-overlapping consecutive lane beats ≥ 0.6s apart', () => {
    const laneBeats = hazards.filter(isLane);
    for (let i = 1; i < laneBeats.length; i++) {
      const [a, b] = [laneBeats[i - 1], laneBeats[i]];
      const overlap = safeLanes(a).some((l) => safeLanes(b).includes(l));
      if (!overlap) expect(b.time - a.time, `${a.id}→${b.id}`).toBeGreaterThanOrEqual(0.6 - EPS);
    }
  });

  it('splits into stage.sections sections with a door in the middle of each break', () => {
    const half = 30 / stage.bpm;
    expect(doors).toHaveLength(stage.sections - 1);
    beats.forEach((b, i) => {
      if (i > 0) expect(b.section).toBeGreaterThanOrEqual(beats[i - 1].section);
      expect(b.section).toBeLessThan(stage.sections);
    });
    const ideal = stage.hazardBeats / stage.sections;
    for (let k = 0; k < stage.sections; k++) {
      const n = hazards.filter((b) => b.section === k).length;
      expect(Math.abs(n - ideal), `section ${k}`).toBeLessThanOrEqual(4);
    }
    doors.forEach((door, j) => {
      expect(door.section).toBe(j + 1);
      // hazards only: v8 boss stages leave a shield pickup inside the break
      const before = hazards.filter((b) => b.section === j).pop() as Beat;
      const after = hazards.find((b) => b.section === j + 1) as Beat;
      expect(after.time - before.time).toBeGreaterThanOrEqual(DOOR_BREAK);
      expect(door.time).toBeGreaterThan(before.time + 0.8);
      expect(door.time).toBeLessThan(after.time - 0.8);
      const k = (door.time - 2.0) / half;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
      expect(door.from).toEqual(sceneFor(stage, j));
      expect(door.to).toEqual(sceneFor(stage, j + 1));
      expect(door.transition).toBe(transitionFor(stage, j + 1));
    });
    expect(DOOR_BREAK).toBe(2.4);
  });

  it('balances section sizes (max / min hazards ≤ 1.3 from 10 hazards per section)', () => {
    if (stage.sections < 2 || stage.hazardBeats / stage.sections < 10) return;
    const sizes = Array.from({ length: stage.sections }, (_, k) => hazards.filter((b) => b.section === k).length);
    expect(Math.max(...sizes) / Math.min(...sizes), sizes.join('/')).toBeLessThanOrEqual(1.3);
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
    expect(generateStage(stage, cfg)).toEqual({ beats, doors });
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
    const da = generateStage(STAGES[13], DEFAULT_PHYSICS, 2).doors;
    const db = generateStage(STAGES[13], DEFAULT_PHYSICS, 12).doors;
    expect(db.map((x) => x.time - 10)).toEqual(da.map((x) => expect.closeTo(x.time, 6)));
  });

  it('w1-s1 is floor lasers only', () => {
    const hz = gen('w1-s1').filter(isHazard);
    expect(hz.every((b) => b.obstacles.every((o) => o.kind === 'floor'))).toBe(true);
  });

  it('introduction stages feature their new move several times (§5 numbers)', () => {
    const count = (id: string, f: (b: Beat) => boolean) => gen(id).filter(f).length;
    expect(count('w1-s2', isLane)).toBeGreaterThanOrEqual(4);
    expect(count('w1-s3', (b) => has(b, 'beam'))).toBeGreaterThanOrEqual(3);
    expect(count('w1-s9', (b) => has(b, 'drop'))).toBeGreaterThanOrEqual(3);
    expect(count('w2-s8', (b) => has(b, 'chaser'))).toBeGreaterThanOrEqual(3);
    expect(count('w3-s7', (b) => isLane(b) && (isJump(b) || isSlide(b)))).toBeGreaterThanOrEqual(3);
    expect(count('w1-s4', (b) => b.requiredLevel === 2)).toBeGreaterThanOrEqual(4);
    expect(count('w1-s6', (b) => has(b, 'ceiling'))).toBeGreaterThanOrEqual(3);
    expect(count('w1-s8', (b) => has(b, 'drone'))).toBeGreaterThanOrEqual(3);
    expect(count('w2-s1', (b) => b.requiredLevel === 3)).toBeGreaterThanOrEqual(3);
    expect(count('w2-s3', (b) => has(b, 'high'))).toBeGreaterThanOrEqual(3);
    expect(count('w2-s6', isRear)).toBeGreaterThanOrEqual(3);
    expect(count('w3-s1', (b) => has(b, 'drone') && has(b, 'floor'))).toBeGreaterThanOrEqual(3);
    expect(count('w3-s4', (b) => b.pulse)).toBeGreaterThanOrEqual(4);
  });

  it('mixes jumps and slides in later stages (among beats with a full-width laser)', () => {
    for (const s of STAGES.filter((x) => x.chapter >= 3 && x.kind !== 'bonus')) {
      const hz = generateBeats(s, physicsForWorld(s.world)).filter((b) => isHazard(b) && (isJump(b) || isSlide(b) || has(b, 'drone')));
      const share = hz.filter(isSlide).length / hz.length;
      expect(share, s.id).toBeGreaterThanOrEqual(0.06); // v4: 0.08 — v5 lane moves crowd the move quota
      expect(share, s.id).toBeLessThanOrEqual(0.45);
    }
  });
});

/** lane beats a human can't reach at one lane per 0.3s (DP over the set of lanes it can be in) */
function unreachableLaneBeats(beats: readonly Beat[]): number {
  let can: LaneId[] = [1];
  let t = 0;
  let bad = 0;
  for (const b of beats.filter(isLane)) {
    const k = Math.min(2, Math.floor((b.time - t) / 0.3 + 1e-9));
    const next = LANES.filter((l) => !b.blockedLanes.includes(l) && can.some((c) => Math.abs(c - l) <= k));
    if (next.length === 0) bad++;
    can = next.length > 0 ? next : safeLanes(b);
    t = b.time;
  }
  return bad;
}

describe('lane reachability at a human pace (one lane per 0.3s)', () => {
  const cfg = DEFAULT_PHYSICS;

  it('every campaign stage', () => {
    for (const s of STAGES) expect(unreachableLaneBeats(generateBeats(s, cfg)), s.id).toBe(0);
  });

  it('365 daily dates', () => {
    const start = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 365; d++) {
      const s = dailyStage(new Date(start + d * 86400000).toISOString().slice(0, 10));
      expect(unreachableLaneBeats(generateBeats(s, cfg)), s.id).toBe(0);
    }
  });

  it('endless seeds × chunks', () => {
    for (let seed = 1; seed <= 12; seed++) {
      for (let chunk = 0; chunk < 30; chunk++) {
        const s = endlessStage(chunk, seed);
        expect(unreachableLaneBeats(generateBeats(s, cfg)), `${seed}/${chunk}`).toBe(0);
      }
    }
  });

  it("a lane-only stress stage full of ['L','L'] / ['L',1,'L'] patterns stays reachable", () => {
    let tightPairs = 0;
    let sandwiches = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const base = STAGES[89];
      const stress: StageDef = {
        // 120 bpm: a half beat of 0.25s puts back-to-back lane beats at 0.5s (< LANE_SWAP_GAP)
        ...base, id: `stress-${seed}`, seed, bpm: 120, hazardBeats: 60, moves: ['jump', 'lane', 'drop'], levelWeights: [1, 0, 0],
        mix: { ...base.mix, lane: 1, drop: 0.5, chaser: 0, laneCombo: 0, pulse: 0 },
      };
      const beats = generateBeats(stress, cfg);
      expect(unreachableLaneBeats(beats), stress.id).toBe(0);
      const hz = beats.filter(isHazard);
      hz.forEach((b, i) => {
        if (i > 0 && isLane(b) && isLane(hz[i - 1]) && b.time - hz[i - 1].time < 0.6 - EPS) tightPairs++;
        if (i > 1 && isLane(b) && !isLane(hz[i - 1]) && isLane(hz[i - 2]) && b.time - hz[i - 2].time < 1.3) sandwiches++;
      });
    }
    expect(tightPairs).toBeGreaterThan(20); // ['L','L'] at LANE_GAP
    expect(sandwiches).toBeGreaterThan(5); // ['L',1,'L']
  });
});

describe('v5 fatigue: fewer jump-only hazards (§5)', () => {
  const normalAfter2 = (c: number) => STAGES.filter((s) => s.chapter === c && s.kind === 'normal' && s.chapter * 10 + s.index + 1 > 2);
  const hazardsOf = (s: StageDef) => generateBeats(s, physicsForWorld(s.world)).filter(isHazard);

  it('lane beats are ≥ 15% of hazards in every chapter (normal stages after stage 2)', () => {
    for (let c = 0; c < 10; c++) {
      const hz = normalAfter2(c).flatMap(hazardsOf);
      expect(hz.filter(isLane).length / hz.length, `chapter ${c + 1}`).toBeGreaterThanOrEqual(0.15);
    }
  });

  it('jump-only hazards drop well below the v4 share (≈ 0.70)', () => {
    const hz = Array.from({ length: 10 }, (_, c) => normalAfter2(c)).flat().flatMap(hazardsOf);
    expect(hz.filter((b) => JUMP_ONLY.includes(moveForBeat(b))).length / hz.length).toBeLessThan(0.6);
  });
});

describe('endlessStage', () => {
  it('ramps difficulty and unlocks moves by chunk', () => {
    const c0 = endlessStage(0, 1);
    const c20 = endlessStage(20, 1);
    expect(c0).toMatchObject({ id: 'endless-0', chapter: 0, kind: 'normal', hazardBeats: 18, sections: 1 });
    expect(c20.bpm).toBeGreaterThan(c0.bpm);
    expect(endlessStage(15, 1).bpm).toBe(140);
    expect(c20.moves.length).toBeGreaterThan(c0.moves.length);
    expect(endlessStage(6, 1).moves).toContain('pulse');
  });

  it('v8: keeps ramping after chunk 15 — +1 bpm per chunk up to 160', () => {
    const bpms = Array.from({ length: 60 }, (_, c) => endlessStage(c, 1).bpm);
    for (let c = 1; c < bpms.length; c++) expect(bpms[c], `chunk ${c}`).toBeGreaterThanOrEqual(bpms[c - 1]);
    expect(bpms[16]).toBe(141);
    expect(bpms[25]).toBe(150);
    expect(endlessStage(200, 1).bpm).toBe(ENDLESS_MAX_BPM);
  });

  it('v8: chunks after 15 vary (plain / mirror / dense), seeded; earlier chunks stay plain', () => {
    for (let c = 0; c <= 15; c++) expect(endlessVariant(c, 7)).toBe('plain');
    const late = Array.from({ length: 60 }, (_, k) => endlessVariant(16 + k, 7));
    expect(new Set(late)).toEqual(new Set(['plain', 'mirror', 'dense']));
    const dense = late.indexOf('dense') + 16;
    expect(endlessStage(dense, 7)).toMatchObject({ hazardBeats: 24, pickupRate: 0.15 });
    const mirror = late.indexOf('mirror') + 16;
    const m = endlessStage(mirror, 7);
    expect(m.mirror).toBe(true);
    const plainBeats = generateBeats({ ...m, mirror: undefined }, DEFAULT_PHYSICS);
    const mirrored = generateBeats(m, DEFAULT_PHYSICS);
    expect(mirrored.map((b) => b.time)).toEqual(plainBeats.map((b) => b.time));
    mirrored.forEach((b, i) => expect(b.blockedLanes).toEqual(plainBeats[i].blockedLanes.map((l) => 2 - l).sort()));
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
    expect(a).toMatchObject({ id: 'daily-2026-10-23', name: '일일 작전', chapter: 0, kind: 'normal', sections: 2 });
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
