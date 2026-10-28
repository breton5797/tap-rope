// Office stage composer (office module graph): a stage = three separately generated mission parts stitched
// with doors, one bpm, part seeds derived from the run seed (spec §3.1, plan Task A).
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../src/core/content';
import { generateStage } from '../../src/core/levels';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import { beatShape, minGap } from '../../src/core/spacing';
import { STAGE_MISSIONS } from '../../src/office/core/missions';
import { HAZARD_KINDS, LANES, type Beat } from '../../src/types';

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

  it('collect sections place ≥ target+2 level-1 pickups on free lanes', () => {
    for (const r of runs) {
      STAGE_MISSIONS[r.stage.id].forEach((m, k) => {
        if (m.kind !== 'collect') return;
        const part = r.beats.filter((b) => b.part === k);
        const coins = part.filter((b) => b.obstacles.some((o) => o.kind === 'coin'));
        expect(coins.length, `${r.stage.id}#${r.seed} part ${k}`).toBeGreaterThanOrEqual(m.target + 2);
        for (const b of coins) {
          expect(isHazard(b)).toBe(false);
          for (const o of b.obstacles) {
            expect(o.level).toBe(1);
            expect(o.lanes).toHaveLength(1);
            // the lane the next hazard leaves open
            const next = part.find((x) => x.time > b.time && isHazard(x));
            if (next) expect(next.blockedLanes).not.toContain(o.lanes![0]);
            expect(LANES).toContain(o.lanes![0]);
          }
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
