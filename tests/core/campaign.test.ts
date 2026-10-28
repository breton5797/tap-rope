// v8 campaign shaping guards (GDD-v8 A3/A4): boss relief, per-stage move subsets, a bounded move quota,
// warm-up section openers, an isolated first new move on intro stages and the boss door supply.
import { describe, expect, it } from 'vitest';
import { campaignMoves, curveD, stageNumber } from '../../src/core/campaign';
import { STAGES } from '../../src/core/content';
import { dailyStage, endlessStage, generateBeats, generateStage, ISOLATE } from '../../src/core/levels';
import { moveForBeat } from '../../src/core/moves';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import { mulberry32 } from '../../src/core/rng';
import { planSpecs } from '../../src/core/specs';
import type { Beat } from '../../src/types';
import { HAZARD_KINDS } from '../../src/types';

const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const hazardsOf = (b: readonly Beat[]) => b.filter(isHazard);
const QUOTA_MAX_SHARE = 0.3;
const CHOSEN_CAP = 9; // jump + lane (+ slide) + 3 focus + 2 others (+ beam for a rear pick)
const MOVE_CAP = 10; // a high / gate pick also lists its slide / drone

describe('v8 bosses (campaign only)', () => {
  const bosses = STAGES.filter((s) => s.kind === 'boss');

  it('d bump +0.04, ×1.25 hazards (≤ 52), pickups 0.25', () => {
    for (const s of bosses) {
      const n = stageNumber(s);
      const normal = Math.round(14 + 34 * curveD(n));
      expect(curveD(n), s.id).toBeCloseTo(Math.min(1, 0.8 * ((n - 1) / 99) + 0.2 + 0.04), 6);
      expect(s.hazardBeats, s.id).toBe(Math.min(52, Math.round(normal * 1.25)));
      expect(s.pickupRate, s.id).toBe(0.25);
    }
  });

  it('leaves one 1단 shield in each door break, in a lane the next hazard leaves open', () => {
    for (const s of bosses) {
      const { beats, doors } = generateStage(s, DEFAULT_PHYSICS);
      for (const door of doors) {
        const lastBefore = hazardsOf(beats).filter((b) => b.time < door.time).pop() as Beat;
        const next = hazardsOf(beats).find((b) => b.time > door.time) as Beat;
        const supply = beats.filter((b) => b.time > lastBefore.time && b.time < next.time && b.obstacles[0].kind === 'shield');
        expect(supply, `${s.id} door ${door.section}`).toHaveLength(1);
        expect(supply[0].obstacles[0].level).toBe(1);
        expect(next.blockedLanes).not.toContain(supply[0].obstacles[0].lanes?.[0]);
      }
    }
  });
});

describe('v8 stage identity (campaign only)', () => {
  it('non-intro normal stages use a move subset with jump and lane; bosses keep every move', () => {
    for (const s of STAGES.filter((x) => x.kind === 'normal' && !x.intro && stageNumber(x) > 2)) {
      expect(s.moves, s.id).toContain('jump');
      expect(s.moves, s.id).toContain('lane');
      expect(s.moves.length, s.id).toBeLessThanOrEqual(MOVE_CAP);
      expect(campaignMoves(stageNumber(s)).length, s.id).toBeLessThanOrEqual(CHOSEN_CAP);
      for (const m of campaignMoves(stageNumber(s))) expect(s.moves, `${s.id} ${m}`).toContain(m);
    }
  });

  it('late zones vary their stages: no two neighbouring normal stages share the same move set', () => {
    const late = STAGES.filter((s) => s.kind === 'normal' && s.chapter >= 3);
    for (let i = 1; i < late.length; i++) {
      if (late[i].chapter !== late[i - 1].chapter) continue;
      expect(late[i].moves.join(), `${late[i - 1].id} ${late[i].id}`).not.toBe(late[i - 1].moves.join());
    }
  });

  it(`the move quota adds at most ${QUOTA_MAX_SHARE * 100}% of a stage's hazards`, () => {
    for (const s of STAGES) {
      const forced = planSpecs(s, mulberry32(s.seed)).filter((x) => x.forced).length;
      expect(forced / s.hazardBeats, s.id).toBeLessThanOrEqual(QUOTA_MAX_SHARE);
    }
  });

  it('intro stages: no 삼단, 이단 ≤ 0.1 (unless teaching it), softer pulse / lanejump focus', () => {
    for (const s of STAGES.filter((x) => x.intro)) {
      if (s.intro !== 'triple') expect(s.levelWeights[2], s.id).toBe(0);
      if (s.intro !== 'double' && s.intro !== 'triple') expect(s.levelWeights[1], s.id).toBeLessThanOrEqual(0.1);
    }
    expect(STAGES.find((s) => s.intro === 'pulse')?.mix.pulse).toBe(0.4);
    expect(STAGES.find((s) => s.intro === 'lanejump')?.mix.laneCombo).toBe(0.35);
  });
});

describe('v8 pacing (campaign only)', () => {
  const warm = (b: Beat): boolean => {
    if (b.pulse || b.obstacles.length !== 1) return false;
    const o = b.obstacles[0];
    return (o.kind === 'floor' && b.requiredLevel === 1) || (o.kind === 'guard' && o.lanes?.length === 1) || o.kind === 'ceiling';
  };

  it('every section of a normal or boss stage opens on a warm-up hazard', () => {
    for (const s of STAGES.filter((x) => x.kind !== 'bonus' && stageNumber(x) > 1)) {
      const hz = hazardsOf(generateBeats(s, DEFAULT_PHYSICS));
      for (let k = 0; k < s.sections; k++) {
        const first = hz.find((b) => b.section === k) as Beat;
        expect(warm(first), `${s.id} section ${k}: ${moveForBeat(first)}`).toBe(true);
      }
    }
  });

  it(`an intro stage's first chunk with the new move has ≥ ${ISOLATE}s of room before and after it`, () => {
    for (const s of STAGES.filter((x) => x.intro && x.intro !== 'jump')) {
      const hz = hazardsOf(generateBeats(s, DEFAULT_PHYSICS));
      const i = hz.findIndex((b) => moveForBeat(b) === s.intro);
      expect(i, s.id).toBeGreaterThanOrEqual(0);
      let a = i;
      while (a > 0 && hz[a].time - hz[a - 1].time < ISOLATE - 1e-6 && moveForBeat(hz[a - 1]) === s.intro) a--;
      let z = i;
      while (z + 1 < hz.length && hz[z + 1].time - hz[z].time < ISOLATE - 1e-6 && moveForBeat(hz[z + 1]) === s.intro) z++;
      if (a > 0) expect(hz[a].time - hz[a - 1].time, `${s.id} before`).toBeGreaterThanOrEqual(ISOLATE - 1e-6);
      if (z + 1 < hz.length) expect(hz[z + 1].time - hz[z].time, `${s.id} after`).toBeGreaterThanOrEqual(ISOLATE - 1e-6);
    }
  });

  it('daily and endless stages never get the campaign shaping', () => {
    for (const s of [dailyStage('2026-10-28'), endlessStage(3, 9), endlessStage(20, 9)]) {
      expect(s.campaign, s.id).toBeUndefined();
      expect(s.intro, s.id).toBeUndefined();
    }
  });
});
