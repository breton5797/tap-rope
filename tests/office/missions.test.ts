// Office v2 missions (spec §3): the per-stage mission script and the pure rules for progress, grade and stars.
import { describe, expect, it } from 'vitest';
import {
  MISSION_BONUS, STAGE_MISSIONS, missionProgress, stageGrade, starsFor, type MissionSpec, type MissionStats,
} from '../../src/office/core/missions';
import { STAGES } from '../../src/core/content';

const stats = (over: Partial<MissionStats> = {}): MissionStats => ({
  hazardsTotal: 8, dodged: 0, hits: 0, collected: 0, finisherClean: false, ...over,
});
const spec = (kind: MissionSpec['kind'], target: number): MissionSpec => ({
  kind, title: 't', target, hazards: target, moves: ['jump'], density: 1, pickupRate: 0.2, line: '',
});

describe('mission script', () => {
  it('three missions for every office stage, in the spec §3.2 order', () => {
    expect(Object.keys(STAGE_MISSIONS).sort()).toEqual(STAGES.map((s) => s.id).sort());
    const kinds = STAGES.map((s) => STAGE_MISSIONS[s.id].map((m) => m.kind).join(','));
    expect(kinds).toEqual([
      'dodge,collect,finale', 'collect,dodge,finale', 'chase,dodge,finale', 'dodge,collect,finale', 'finale,chase,finale',
    ]);
  });

  it('missions only use moves their stage teaches; collect missions name a collectible', () => {
    for (const s of STAGES) {
      for (const m of STAGE_MISSIONS[s.id]) {
        for (const mv of m.moves) expect(s.moves, `${s.id} ${m.title} ${mv}`).toContain(mv);
        for (const f of m.focus ?? []) expect(m.moves).toContain(f);
        if (m.kind === 'collect') expect(m.collectible).toBeTruthy();
        expect(m.title.length).toBeGreaterThan(0);
        expect(m.line.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('missionProgress', () => {
  it('dodge completes at ⌊0.8·N⌋ hazards passed (plan: 6/8 complete, 5/8 not)', () => {
    expect(missionProgress(spec('dodge', 8), stats({ dodged: 6 }))).toEqual({ value: 6, target: 8, complete: true });
    expect(missionProgress(spec('dodge', 8), stats({ dodged: 5 })).complete).toBe(false);
    // the target is the hazards the section really has
    expect(missionProgress(spec('dodge', 8), stats({ hazardsTotal: 10, dodged: 8 }))).toEqual({ value: 8, target: 10, complete: true });
  });

  it('collect needs N items', () => {
    expect(missionProgress(spec('collect', 5), stats({ collected: 4 }))).toEqual({ value: 4, target: 5, complete: false });
    expect(missionProgress(spec('collect', 5), stats({ collected: 5 })).complete).toBe(true);
    expect(missionProgress(spec('collect', 5), stats({ collected: 7 })).value).toBe(7);
  });

  it('chase holds while hits ≤ 2', () => {
    expect(missionProgress(spec('chase', 12), stats({ hits: 2, dodged: 10, hazardsTotal: 12 })).complete).toBe(true);
    expect(missionProgress(spec('chase', 12), stats({ hits: 3, dodged: 9, hazardsTotal: 12 })).complete).toBe(false);
  });

  it('finale needs a clean last jump and hits ≤ 2', () => {
    expect(missionProgress(spec('finale', 8), stats({ hits: 2, finisherClean: true })).complete).toBe(true);
    expect(missionProgress(spec('finale', 8), stats({ hits: 0, finisherClean: false })).complete).toBe(false);
    expect(missionProgress(spec('finale', 8), stats({ hits: 3, finisherClean: true })).complete).toBe(false);
  });
});

describe('grade, stars, bonus', () => {
  it('S = 3 stamps and no hits, A = 3 stamps, B = 1–2, C = 0', () => {
    expect(stageGrade([true, true, true], 0)).toBe('S');
    expect(stageGrade([true, true, true], 1)).toBe('A');
    expect(stageGrade([true, false, true], 0)).toBe('B');
    expect(stageGrade([false, true, false], 3)).toBe('B');
    expect(stageGrade([false, false, false], 0)).toBe('C');
  });

  it('stars = max(1, stamps)', () => {
    expect(starsFor([false, false, false])).toBe(1);
    expect(starsFor([true, false, false])).toBe(1);
    expect(starsFor([true, true, false])).toBe(2);
    expect(starsFor([true, true, true])).toBe(3);
  });

  it('mission bonus grows with the stage', () => {
    expect([0, 1, 4].map(MISSION_BONUS)).toEqual([150, 300, 750]);
  });
});
