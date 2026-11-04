// Office stage composer (office module graph): a stage = three separately generated mission parts stitched
// with doors, one bpm, part seeds derived from the run seed (spec §3.1, plan Task A).
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { generateStage } from '../../src/core/levels';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import { beatShape, laneReach, minGap } from '../../src/core/spacing';
import { STAGE_MISSIONS } from '../../src/office/core/missions';
import { HAZARD_KINDS, type Beat, type LaneId } from '../../src/types';

const cfg = DEFAULT_PHYSICS;
const SEEDS = Array.from({ length: 30 }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0);
const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const runs = STAGES.flatMap((stage) => SEEDS.map((seed) => ({ stage, seed, ...generateStage({ ...stage, seed }, cfg, 2) })));

describe('office stage composer', () => {
  it('is deterministic per run seed and differs between seeds', () => {
    const a = generateStage({ ...STAGES[2], seed: 7 }, cfg, 2);
    expect(generateStage({ ...STAGES[2], seed: 7 }, cfg, 2)).toEqual(a);
    expect(generateStage({ ...STAGES[2], seed: 8 }, cfg, 2)).not.toEqual(a);
  });

  it('three parts, two doors, beats tagged with part = section, ids in order', () => {
    for (const r of runs) {
      expect(r.doors.map((d) => d.section)).toEqual([1, 2]);
      expect(r.beats.map((b) => b.id)).toEqual(r.beats.map((_, i) => i));
      for (const b of r.beats) expect(b.part).toBe(b.section);
      expect(new Set(r.beats.map((b) => b.part))).toEqual(new Set([0, 1, 2]));
      // every door sits between the parts it separates
      r.doors.forEach((d) => {
        const before = r.beats.filter((b) => b.section < d.section);
        const after = r.beats.filter((b) => b.section >= d.section);
        expect(before[before.length - 1].time).toBeLessThan(d.time);
        expect(after[0].time).toBeGreaterThan(d.time);
      });
    }
  });

  it('times ascend and every hazard keeps the generator minimum gap across the joins', () => {
    for (const r of runs) {
      r.beats.forEach((b, i) => { if (i > 0) expect(b.time).toBeGreaterThan(r.beats[i - 1].time); });
      const hz = r.beats.filter(isHazard);
      hz.forEach((b, i) => {
        if (i === 0 || b.section === hz[i - 1].section) return;
        expect(b.time - hz[i - 1].time).toBeGreaterThanOrEqual(minGap(beatShape(hz[i - 1]), beatShape(b), cfg) - 1e-9);
      });
    }
  });

  it('each part has about its scripted hazards; a shield waits before each door', () => {
    for (const r of runs) {
      const specs = STAGE_MISSIONS[r.stage.id];
      specs.forEach((m, k) => {
        const n = r.beats.filter((b) => b.part === k && isHazard(b)).length;
        expect(n, `${r.stage.id} part ${k}`).toBeGreaterThanOrEqual(m.hazards);
        expect(n).toBeLessThanOrEqual(m.hazards + 3);
      });
      r.doors.forEach((d) => {
        const shield = r.beats.find((b) => b.section === d.section - 1 && b.obstacles.some((o) => o.kind === 'shield'));
        expect(shield, `${r.stage.id} door ${d.section}`).toBeTruthy();
        expect(shield!.time).toBeLessThan(d.time);
      });
    }
  });

  it('collect sections place ≥ target+2 level-1 coins, each a single item off the hazard beats', () => {
    for (const r of runs) {
      STAGE_MISSIONS[r.stage.id].forEach((m, k) => {
        if (m.kind !== 'collect') return;
        const coins = r.beats.filter((b) => b.part === k && b.obstacles.some((o) => o.kind === 'coin'));
        expect(coins.length, `${r.stage.id}#${r.seed} part ${k}`).toBeGreaterThanOrEqual(m.target + 2);
        for (const b of coins) {
          expect(isHazard(b)).toBe(false);
          expect(b.obstacles).toHaveLength(1);
          expect(b.obstacles[0].level).toBe(1);
          expect(b.obstacles[0].lanes).toHaveLength(1);
        }
      });
    }
  });

  it('a best-lane player at a human pace reaches ≥ target+2 coins and survives every hazard (10 stages × 200 seeds)', () => {
    const many = Array.from({ length: 200 }, (_, i) => Math.imul(i + 101, 2246822519) >>> 0);
    for (const stage of STAGES) {
      for (const seed of many) {
        const { beats } = generateStage({ ...stage, seed }, cfg, 2);
        STAGE_MISSIONS[stage.id].forEach((m, k) => {
          if (m.kind !== 'collect') return;
          // the lanes the player can be in, one lane per LANE_STEP; taking a coin commits them to its lane
          let can: readonly LaneId[] = [0, 1, 2];
          let at = Number.NEGATIVE_INFINITY;
          let got = 0;
          for (const b of beats.filter((x) => x.part === k)) {
            const coin = b.obstacles.find((o) => o.kind === 'coin');
            const reach = laneReach(can, b.time - at, isHazard(b) ? b.blockedLanes : []);
            at = b.time;
            if (isHazard(b)) {
              expect(reach.length, `${stage.id}#${seed} part ${k}: trapped at ${b.time.toFixed(2)}`).toBeGreaterThan(0);
              can = reach;
            } else if (coin && reach.includes(coin.lanes![0])) {
              got += 1;
              can = [coin.lanes![0]];
            } else can = reach;
          }
          expect(got, `${stage.id}#${seed} part ${k}`).toBeGreaterThanOrEqual(m.target + 2);
        });
      }
    }
  });

  it('part 2 opens gently: the first ~8 s of stages 6 and 7 are plain single jumps / slides, then the mix ramps in', () => {
    const plain = (b: Beat): boolean => {
      if (b.obstacles.length !== 1 || b.blockedLanes.length > 0 || b.pulse) return false;
      const [o] = b.obstacles;
      const jump = o.kind === 'floor' && o.level === 1 && b.requiredLevel === 1 && !b.needsSlide;
      const slide = o.kind === 'ceiling' && b.needsSlide && b.requiredLevel === 0;
      return jump || slide;
    };
    for (const id of ['w6-s10', 'w7-s10']) {
      const stage = STAGES.find((s) => s.id === id)!;
      expect(STAGE_MISSIONS[id][0].warmup, id).toBe(8);
      for (const seed of SEEDS) {
        const { beats } = generateStage({ ...stage, seed }, cfg, 2);
        const hz = beats.filter((b) => b.part === 0 && isHazard(b));
        const early = hz.filter((b) => b.time < 2 + 8);
        expect(early.length, `${id}#${seed}`).toBeGreaterThanOrEqual(3);
        for (const b of early) expect(plain(b), `${id}#${seed} beat ${b.id} @${b.time.toFixed(2)}`).toBe(true);
        // after the warm-up the section's own mix comes back
        expect(hz.filter((b) => b.time >= 2 + 8).some((b) => !plain(b)), `${id}#${seed}`).toBe(true);
        expect(hz.length).toBe(STAGE_MISSIONS[id][0].hazards);
      }
    }
    // part 1 and the other part-2 stages keep their openings
    for (const s of STAGES.filter((x) => !['w6-s10', 'w7-s10'].includes(x.id))) {
      for (const m of STAGE_MISSIONS[s.id]) expect(m.warmup, s.id).toBeUndefined();
    }
  });

  it('mission items are flagged: every coin of a collect part or of a part with a bonus collectible, and no other coin', () => {
    for (const r of runs) {
      STAGE_MISSIONS[r.stage.id].forEach((m, k) => {
        const coins = r.beats.filter((b) => b.part === k).flatMap((b) => b.obstacles.filter((o) => o.kind === 'coin'));
        const itemPart = m.kind === 'collect' || m.collectible !== undefined;
        for (const o of coins) expect(o.item === true, `${r.stage.id}#${r.seed} part ${k}`).toBe(itemPart);
        for (const b of r.beats.filter((x) => x.part === k)) {
          for (const o of b.obstacles.filter((x) => x.kind !== 'coin')) expect(o.item, `${r.stage.id} ${o.kind}`).toBeUndefined();
        }
      });
    }
  });

  it("the finale's last hazard is a jump (floor / beam): the leap over the superior", () => {
    for (const r of runs) {
      STAGE_MISSIONS[r.stage.id].forEach((m, k) => {
        if (m.kind !== 'finale') return;
        const hz = r.beats.filter((b) => b.part === k && isHazard(b));
        const last = hz[hz.length - 1];
        expect(last.obstacles.every((o) => o.kind === 'floor' || o.kind === 'beam'), `${r.stage.id} part ${k}`).toBe(true);
        expect(last.requiredLevel).toBeGreaterThanOrEqual(1);
        expect(last.needsSlide).toBe(false);
        expect(last.blockedLanes).toEqual([]);
      });
    }
  });

  it('non-office stages (menu demo, endless) keep the v8 generator', () => {
    const plain = { ...STAGES[0], id: 'endless-3', sections: 1 };
    const out = generateStage(plain, cfg, 2);
    expect(out.doors).toHaveLength(0);
    expect(out.beats.every((b) => b.part === undefined)).toBe(true);
  });
});
