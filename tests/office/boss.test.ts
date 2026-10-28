// Office bosses (office spec §5, §13-4): seven superiors on the v8 boss slots, one per stage and one per
// section on stage 5, with a "퇴근 게이지" that restarts for each stage-5 superior.
import { describe, expect, it } from 'vitest';
import { BOSSES, OFFICE_BOSSES, bossFor, bossForSection, bossView } from '../../src/office/core/boss';
import { BOSS_ATTACKS, BROADCAST_LINE, phaseLineDue } from '../../src/office/game/boss-lines';
import { STAGES, stageById } from '../../src/core/content';
import { generateStage } from '../../src/core/levels';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import type { Beat, BossView, Door, Obstacle, StageDef } from '../../src/types';
import { HAZARD_KINDS } from '../../src/types';

// office stages keep the v8 boss-stage shape (w{n}-s10, chapter n-1, kind 'boss', 3 sections)
const stage = (n: number, seed?: number): StageDef => {
  const s = stageById(`w${n}-s10`) as StageDef;
  return seed === undefined ? s : { ...s, seed };
};
const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const mk = (id: number, time: number, obstacles: Obstacle[], section: number): Beat => ({
  id, time, obstacles, requiredLevel: 0, needsSlide: false, pulse: false, blockedLanes: [], section,
});
const scene = { world: 0, variant: 'base' } as const;
const door = (time: number, section: number): Door => ({ time, section, transition: 'turn', from: scene, to: scene });
const floor = (id: number, time: number, section: number) => mk(id, time, [{ kind: 'floor', level: 1 }], section);

describe('OFFICE_BOSSES', () => {
  it('has the seven superiors on distinct v8 slots in rank order', () => {
    expect(OFFICE_BOSSES.map((b) => [b.slot, b.name, b.stage, b.section])).toEqual([
      ['warden', '김대리', 1, null],
      ['sewer-eye', '박과장', 2, null],
      ['lab-ai', '최팀장', 3, null],
      ['core', '오부장', 4, null],
      ['jailer', '한전무', 5, 0],
      ['apc', '윤이사', 5, 1],
      ['chimera', '사장님', 5, 2],
    ]);
    expect(new Set(OFFICE_BOSSES.map((b) => b.slot)).size).toBe(7);
  });

  it('every superior has a title, a catchphrase and a "…그래, 가 봐" exit line', () => {
    for (const b of OFFICE_BOSSES) {
      expect(b.title.length, b.name).toBeGreaterThan(0);
      expect(b.catchphrase.length, b.name).toBeGreaterThan(0);
      expect(b.exitLine, b.name).toContain('그래, 가 봐');
    }
  });

  it('BOSSES shows the superiors by name with a comic tag, never the slot id', () => {
    expect(BOSSES.map((b) => b.name)).toEqual(['김대리', '박과장', '최팀장', '오부장', '한전무', '윤이사', '사장님']);
    for (const b of BOSSES) {
      expect(b.codename.length).toBeGreaterThan(0);
      expect(b.codename).not.toContain(b.id);
      expect(b.name).not.toContain(b.id);
    }
  });
});

describe('bossFor', () => {
  it('returns the stage superior on w1-s10..w5-s10 (stage 5 = the first one, 한전무)', () => {
    expect([1, 2, 3, 4, 5].map((n) => bossFor(stage(n))?.name)).toEqual(['김대리', '박과장', '최팀장', '오부장', '한전무']);
  });

  it('is null off boss stages', () => {
    for (const s of STAGES.filter((x) => x.kind !== 'boss').slice(0, 20)) expect(bossFor(s), s.id).toBeNull();
    expect(bossFor({ ...stage(1), kind: 'normal' })).toBeNull();
    expect(bossFor(stage(6))).toBeNull();
  });

  it('bossForSection picks the stage-5 superior per section', () => {
    expect([0, 1, 2].map((i) => bossForSection(stage(5), i)?.name)).toEqual(['한전무', '윤이사', '사장님']);
    expect([0, 1, 2].map((i) => bossForSection(stage(2), i)?.name)).toEqual(['박과장', '박과장', '박과장']);
  });
});

describe('bossView', () => {
  // 2 hazards per section
  const beats = [floor(0, 4, 0), floor(1, 6, 0), floor(2, 12, 1), floor(3, 14, 1), floor(4, 20, 2), floor(5, 22, 2)];
  const doors = [door(9, 1), door(17, 2)];
  const view = (n: number, t: number, done: number) => bossView(stage(n), beats, doors, t, done, 6) as BossView;

  it('stages 1-4 keep one superior and a whole-stage gauge', () => {
    expect(view(3, 13, 3)).toMatchObject({ id: 'lab-ai', phase: 1 });
    expect(view(3, 13, 3).hp).toBeCloseTo(0.5, 9);
    expect(view(3, 9.5, 2).state).toBe('stagger');
  });

  it('stage 5 gauge resets per section', () => {
    expect(view(5, 5, 1)).toMatchObject({ id: 'jailer', phase: 0, hp: 0.5 });
    expect(view(5, 8, 2)).toMatchObject({ id: 'jailer', hp: 0 });
    // section 1: 윤이사 arrives with a full gauge although 2 hazards are already done
    expect(view(5, 9.5, 2)).toMatchObject({ id: 'apc', phase: 1, hp: 1, state: 'intro' });
    expect(view(5, 13, 3)).toMatchObject({ id: 'apc', hp: 0.5, state: 'fight' });
    expect(view(5, 16, 4)).toMatchObject({ id: 'apc', hp: 0 });
    expect(view(5, 18, 4)).toMatchObject({ id: 'chimera', phase: 2, hp: 1 });
    expect(view(5, 21, 5)).toMatchObject({ id: 'chimera', hp: 0.5 });
    expect(view(5, 30, 6)).toMatchObject({ id: 'chimera', hp: 0, state: 'defeated' });
  });

  it('stage 5 on generated beats: the section superior telegraphs each hazard of its own section', () => {
    for (const seed of [1, 7, 99]) {
      const s = stage(5, seed);
      const { beats: bs, doors: ds } = generateStage(s, DEFAULT_PHYSICS);
      const hz = bs.filter(isHazard);
      const slot = ['jailer', 'apc', 'chimera'];
      hz.forEach((b, i) => {
        const v = bossView(s, bs, ds, b.time - 0.3, i, hz.length) as BossView;
        expect(v.id, `seed ${seed} beat ${b.id}`).toBe(slot[b.section]);
        const own = hz.filter((x) => x.section === b.section);
        const before = hz.filter((x) => x.section < b.section).length;
        expect(v.hp).toBeCloseTo(1 - (i - before) / own.length, 9);
      });
    }
  });

  it('restart uses stage start state: a fresh session (time 0, nothing done) shows a full gauge', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const s = stage(n, 1234 + n);
      const { beats: bs, doors: ds } = generateStage(s, DEFAULT_PHYSICS);
      const v = bossView(s, bs, ds, 0, 0, bs.filter(isHazard).length) as BossView;
      expect(v.hp, `stage ${n}`).toBe(1);
      expect(v.phase).toBe(0);
      expect(v.id).toBe(bossFor(s)?.id);
    }
  });
});

describe('office boss lines', () => {
  it('names an attack per phase for every superior in Korean', () => {
    for (const b of OFFICE_BOSSES) {
      expect(BOSS_ATTACKS[b.slot]).toHaveLength(3);
      for (const a of BOSS_ATTACKS[b.slot]) expect(a).toMatch(/[가-힣]/);
    }
    expect(BOSS_ATTACKS.warden[0]).toContain('포스트잇');
    expect(BOSS_ATTACKS['lab-ai'][2]).toContain('레이저 포인터');
  });

  it('announces the stage-5 superior of the current section', () => {
    const v = { id: 'apc', phase: 1, hp: 1, state: 'intro', stateAge: 0, attack: null } as const;
    expect(phaseLineDue(0, v)?.text).toBe(BOSS_ATTACKS.apc[1]);
    expect(phaseLineDue(0, v)?.kicker).not.toMatch(/PHASE/);
    expect(BROADCAST_LINE).toBe('네 사장님!');
  });
});
