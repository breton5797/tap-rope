import { describe, expect, it } from 'vitest';
import { ATTACK_LEAD, BOSSES, bossFor, bossView } from '../../src/core/boss';
import { STAGES, stageById } from '../../src/core/content';
import { dailyStage, endlessStage, generateStage } from '../../src/core/levels';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import type { Beat, BossView, Door, LaneId, Obstacle, StageDef } from '../../src/types';
import { HAZARD_KINDS } from '../../src/types';

const at = (id: string) => stageById(id) as StageDef;
const mk = (id: number, time: number, obstacles: Obstacle[], section = 0): Beat => ({
  id, time, obstacles, requiredLevel: obstacles.some((o) => o.kind === 'floor' || o.kind === 'beam') ? 1 : 0,
  needsSlide: obstacles.some((o) => o.kind === 'high' || o.kind === 'ceiling'), pulse: false,
  blockedLanes: [...new Set(obstacles.filter((o) => ['guard', 'drop', 'chaser'].includes(o.kind)).flatMap((o) => o.lanes ?? []))].sort() as LaneId[],
  section,
});
const scene = { world: 0, variant: 'base' } as const;
const door = (time: number, section: number): Door => ({ time, section, transition: 'turn', from: scene, to: scene });

describe('BOSSES (GDD v7 §1)', () => {
  it('has one boss per zone with the table names and codenames', () => {
    expect(BOSSES.map((b) => [b.chapter, b.id, b.name, b.codename])).toEqual([
      [0, 'warden', '정문 경비대장', 'SENTINEL-01'],
      [1, 'sewer-eye', '수로 감시 드론', 'OCULUS'],
      [2, 'lab-ai', '연구소 보안 AI', 'ARGUS'],
      [3, 'core', '서버 코어', 'NEXUS'],
      [4, 'jailer', '간수장 로봇', 'WARDEN-X'],
      [5, 'apc', '경비대 장갑차', 'RHINO'],
      [6, 'chimera', '실험 병기', 'CHIMERA'],
      [7, 'crane', '공장 크레인·프레스', 'TITAN'],
      [8, 'sniper', '옥상 저격 드론', 'RAVEN'],
      [9, 'gunship', '무장 헬기', 'VULTURE'],
    ]);
  });
});

describe('bossFor', () => {
  it('returns the zone boss on the 10 campaign boss stages only', () => {
    for (const s of STAGES) {
      const b = bossFor(s);
      if (s.kind === 'boss') expect(b?.chapter, s.id).toBe(s.chapter);
      else expect(b, s.id).toBeNull();
    }
    expect(bossFor(at('w7-s10'))?.id).toBe('chimera');
  });

  it('endless and daily have no boss', () => {
    expect(bossFor(endlessStage(4, 1))).toBeNull();
    expect(bossFor(dailyStage('2026-10-27'))).toBeNull();
    expect(bossFor({ ...endlessStage(4, 1), kind: 'boss' })).toBeNull();
  });
});

describe('bossView', () => {
  const boss = at('w1-s10');
  const beats = [
    mk(0, 4, [{ kind: 'beam', level: 1, from: 'front' }]),
    mk(1, 5, [{ kind: 'coin', level: 1, lanes: [0] }]),
    mk(2, 6, [{ kind: 'floor', level: 1 }, { kind: 'drone', level: 1 }]),
    mk(3, 12, [{ kind: 'guard', level: 1, lanes: [0, 1] }, { kind: 'floor', level: 1 }], 1),
    mk(4, 13, [{ kind: 'ceiling', level: 1 }], 1),
    mk(5, 20, [{ kind: 'drone', level: 1 }], 2),
    mk(6, 21, [{ kind: 'high', level: 1, from: 'back' }], 2),
  ];
  const doors = [door(9, 1), door(17, 2)];
  const view = (t: number, done = 0) => bossView(boss, beats, doors, t, done, 6) as BossView;

  it('is null off boss stages', () => {
    expect(bossView(at('w1-s9'), beats, doors, 5, 0, 6)).toBeNull();
  });

  it('intro from 2.0s before the first hazard beat, fight after it', () => {
    expect(view(1)).toMatchObject({ id: 'warden', state: 'intro', phase: 0, hp: 1, stateAge: 0 });
    expect(view(2.5)).toMatchObject({ state: 'intro', stateAge: 0.5 });
    expect(view(4)).toMatchObject({ state: 'fight', stateAge: 0 });
    expect(view(5.5, 1).stateAge).toBeCloseTo(1.5, 9);
  });

  it('hp = 1 − done/total, phase = section by doors', () => {
    expect(view(5, 1).hp).toBeCloseTo(5 / 6, 9);
    expect(view(10, 2).phase).toBe(1);
    expect(view(18, 4).phase).toBe(2);
    expect(view(30, 6).hp).toBe(0);
    expect(bossView(boss, beats, doors, 5, 0, 0)?.hp).toBe(1);
  });

  it('staggers for 1.2s after each door', () => {
    expect(view(9)).toMatchObject({ state: 'stagger', phase: 1, stateAge: 0 });
    expect(view(10)).toMatchObject({ state: 'stagger' });
    expect(view(10.2)).toMatchObject({ state: 'fight' });
    expect(view(10.5).stateAge).toBeCloseTo(0.3, 9);
    expect(view(17.6)).toMatchObject({ state: 'stagger', phase: 2 });
  });

  it('is defeated after the last beat', () => {
    expect(view(21).state).toBe('fight');
    expect(view(22.5, 6)).toMatchObject({ state: 'defeated', attack: null });
    expect(view(22.5, 6).stateAge).toBeCloseTo(1.5, 9);
  });

  it('telegraphs the next hazard beat within ATTACK_LEAD (1.6s) as a boss attack', () => {
    expect(ATTACK_LEAD).toBe(1.6);
    expect(view(2.3).attack).toBeNull();
    expect(view(2.4).attack).toMatchObject({ kind: 'beam', lanes: null });
    expect(view(2.4).attack?.timeUntil).toBeCloseTo(1.6, 9);
    expect(view(4.9).attack).toMatchObject({ kind: 'floor' }); // pickup beat skipped; gate → floor
    expect(view(11.5).attack).toMatchObject({ kind: 'lane', lanes: [0, 1] }); // lanejump → lane
    expect(view(12.5).attack).toMatchObject({ kind: 'ceiling' });
    expect(view(19.5).attack).toMatchObject({ kind: 'drone' });
    expect(view(20.5).attack).toMatchObject({ kind: 'beam' });
    expect(view(4).attack).toMatchObject({ kind: 'beam', timeUntil: 0 });
  });

  it('works on generated boss stages: 3 phases, attacks for every hazard', () => {
    for (const s of STAGES.filter((x) => x.kind === 'boss')) {
      const { beats: bs, doors: ds } = generateStage(s, DEFAULT_PHYSICS);
      const hz = bs.filter((b) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind)));
      expect(ds).toHaveLength(2);
      for (const b of hz) {
        const v = bossView(s, bs, ds, b.time - 0.3, 0, hz.length); // hazards are ≥ 0.45s apart
        expect(v?.attack?.timeUntil, `${s.id} beat ${b.id}`).toBeCloseTo(0.3, 9);
        expect(v?.phase).toBe(b.section);
      }
    }
  });
});
