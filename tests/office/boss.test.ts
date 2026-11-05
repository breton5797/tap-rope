// Office bosses (office spec §5, §13-4; part 2 spec §1): ten superiors on the v8 boss slots (박과장 and 윤이사
// come back in part 2 on their own slots), one per stage and one per section on stages 5 and 10, with a
// "퇴근 게이지" that restarts for each superior of those multi-superior stages.
import { describe, expect, it } from 'vitest';
import { BOSSES, OFFICE_BOSSES, bossFor, bossForSection, bossView, superiorAt } from '../../src/office/core/boss';
import { BOSS_ATTACKS, BROADCAST_LINE, broadcastLine, phaseLineDue } from '../../src/office/game/boss-lines';
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
  it('has the superiors in story order: seven in part 1, the new 강차장 / 문상무 / 회장님 and three rematches in part 2', () => {
    expect(OFFICE_BOSSES.map((b) => [b.slot, b.name, b.stage, b.section])).toEqual([
      ['warden', '김대리', 1, null],
      ['sewer-eye', '박과장', 2, null],
      ['lab-ai', '최팀장', 3, null],
      ['core', '오부장', 4, null],
      ['jailer', '한전무', 5, 0],
      ['apc', '윤이사', 5, 1],
      ['chimera', '사장님', 5, 2],
      ['crane', '강차장', 6, null],
      ['sewer-eye', '박과장', 7, null],
      ['sniper', '문상무', 8, null],
      ['apc', '윤이사', 9, null],
      ['lab-ai', '최팀장', 10, 0],
      ['jailer', '한전무', 10, 1],
      ['gunship', '회장님', 10, 2],
    ]);
    // every v8 slot is used; a slot always shows the same person (rematches keep their art)
    expect(new Set(OFFICE_BOSSES.map((b) => b.slot)).size).toBe(10);
    for (const b of OFFICE_BOSSES) expect(OFFICE_BOSSES.filter((x) => x.slot === b.slot).every((x) => x.name === b.name)).toBe(true);
  });

  it('a rematch has its own part-2 lines, not the part-1 ones', () => {
    for (const slot of ['sewer-eye', 'apc', 'lab-ai', 'jailer'] as const) {
      const [first, again] = OFFICE_BOSSES.filter((b) => b.slot === slot);
      expect(again.catchphrase, slot).not.toBe(first.catchphrase);
      expect(again.exitLine, slot).not.toBe(first.exitLine);
    }
    expect(superiorAt(7, 0)?.catchphrase).toContain('택시');
    expect(superiorAt(9, 2)?.catchphrase).toContain('2차');
    expect(superiorAt(6, 1)?.title).toBe('차장');
    expect(superiorAt(8, 0)?.title).toBe('상무');
    expect(superiorAt(10, 2)?.title).toBe('회장');
    expect(superiorAt(11, 0)).toBeNull();
  });

  it('every superior has a title, a catchphrase and a "…그래, 가 봐" exit line', () => {
    for (const b of OFFICE_BOSSES) {
      expect(b.title.length, b.name).toBeGreaterThan(0);
      expect(b.catchphrase.length, b.name).toBeGreaterThan(0);
      expect(b.exitLine, b.name).toContain('그래, 가 봐');
    }
  });

  it('BOSSES shows the superiors by name with a comic tag, never the slot id', () => {
    expect(BOSSES.map((b) => b.name)).toEqual([
      '김대리', '박과장', '최팀장', '오부장', '한전무', '윤이사', '사장님', '강차장', '박과장', '문상무', '윤이사', '최팀장', '한전무', '회장님',
    ]);
    expect(BOSSES.map((b) => b.chapter)).toEqual([0, 1, 2, 3, 4, 4, 4, 5, 6, 7, 8, 9, 9, 9]);
    for (const b of BOSSES) {
      expect(b.codename.length).toBeGreaterThan(0);
      expect(b.codename).not.toContain(b.id);
      expect(b.name).not.toContain(b.id);
    }
  });
});

describe('bossFor', () => {
  it('returns the stage superior on w1-s10..w10-s10 (stages 5 / 10 = the first one)', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => bossFor(stage(n))?.name)).toEqual([
      '김대리', '박과장', '최팀장', '오부장', '한전무', '강차장', '박과장', '문상무', '윤이사', '최팀장',
    ]);
  });

  it('a rematch reports its own stage chapter (cutscene / result lookups key on it)', () => {
    expect(bossFor(stage(7))).toMatchObject({ id: 'sewer-eye', chapter: 6 });
    expect(bossFor(stage(9))).toMatchObject({ id: 'apc', chapter: 8 });
    expect(bossFor(stage(10))).toMatchObject({ id: 'lab-ai', chapter: 9 });
    expect(bossFor(stage(2))).toMatchObject({ id: 'sewer-eye', chapter: 1 });
    expect(bossFor(stage(7))?.codename).not.toBe(bossFor(stage(2))?.codename);
  });

  it('is null off boss stages', () => {
    // the office graph has only the five boss stages: off-boss stages are built from stage 1
    expect(STAGES.every((x) => x.kind === 'boss')).toBe(true);
    expect(bossFor({ ...stage(1), id: 'w1-s1', kind: 'normal' })).toBeNull();
    expect(bossFor({ ...stage(1), id: 'w1-s5', kind: 'bonus' })).toBeNull();
    expect(bossFor({ ...stage(1), kind: 'normal' })).toBeNull();
    expect(bossFor({ ...stage(5), id: 'w11-s10', chapter: 10 })).toBeNull();
    expect(bossFor({ ...stage(5), id: 'w6-s10', chapter: 4 })).toBeNull();
  });

  it('bossForSection picks the stage-5 / stage-10 superior per section', () => {
    expect([0, 1, 2].map((i) => bossForSection(stage(5), i)?.name)).toEqual(['한전무', '윤이사', '사장님']);
    expect([0, 1, 2].map((i) => bossForSection(stage(10), i)?.name)).toEqual(['최팀장', '한전무', '회장님']);
    expect([0, 1, 2].map((i) => bossForSection(stage(10), i)?.chapter)).toEqual([9, 9, 9]);
    expect([0, 1, 2].map((i) => bossForSection(stage(8), i)?.name)).toEqual(['문상무', '문상무', '문상무']);
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

  it('stage 10 gauge resets per section like stage 5 (최팀장 → 한전무 → 회장님)', () => {
    expect(view(10, 5, 1)).toMatchObject({ id: 'lab-ai', phase: 0, hp: 0.5 });
    expect(view(10, 9.5, 2)).toMatchObject({ id: 'jailer', phase: 1, hp: 1, state: 'intro' });
    expect(view(10, 21, 5)).toMatchObject({ id: 'gunship', phase: 2, hp: 0.5 });
  });

  it('part-2 single-superior stages keep a whole-stage gauge', () => {
    expect(view(7, 13, 3)).toMatchObject({ id: 'sewer-eye', phase: 1 });
    expect(view(7, 13, 3).hp).toBeCloseTo(0.5, 9);
    expect(view(8, 21, 5)).toMatchObject({ id: 'sniper', phase: 2 });
    expect(view(6, 5, 1)).toMatchObject({ id: 'crane' });
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
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
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
    // the new part-2 superiors have their own attacks, not the generic placeholder set
    for (const slot of ['crane', 'sniper', 'gunship'] as const) expect(BOSS_ATTACKS[slot]).not.toContain('야근 요청');
    expect(BOSS_ATTACKS.crane.join(' ')).toContain('설문');
    expect(BOSS_ATTACKS.sniper.join(' ')).toContain('영수증');
  });

  it('part-2 rematches announce their own commute attacks (keyed by stage), others fall back to the slot', () => {
    const v = (id: BossView['id'], phase: 0 | 1 | 2) => ({ id, phase, hp: 1, state: 'fight', stateAge: 0, attack: null }) as const;
    const text = (n: number, id: BossView['id'], phase: 0 | 1 | 2) => phaseLineDue(-1, v(id, phase), stage(n))?.text;
    // the same slot on its part-1 stage, or with no stage given, keeps the part-1 names
    expect(text(2, 'sewer-eye', 1)).toBe(BOSS_ATTACKS['sewer-eye'][1]);
    expect(phaseLineDue(-1, v('sewer-eye', 1))?.text).toBe(BOSS_ATTACKS['sewer-eye'][1]);
    expect(text(8, 'sniper', 2)).toBe(BOSS_ATTACKS.sniper[2]);
    expect(text(10, 'gunship', 2)).toBe(BOSS_ATTACKS.gunship[2]);
    // rematches: their own names, never the part-1 ones
    const rematch: readonly [number, BossView['id'], 0 | 1 | 2][] = [
      [7, 'sewer-eye', 0], [7, 'sewer-eye', 1], [7, 'sewer-eye', 2], [9, 'apc', 0], [9, 'apc', 1], [9, 'apc', 2],
      [10, 'lab-ai', 0], [10, 'jailer', 1],
    ];
    for (const [n, id, phase] of rematch) {
      const t = text(n, id, phase) ?? '';
      expect(t, `${n} ${id} ${phase}`).toMatch(/[가-힣]/);
      expect(BOSS_ATTACKS[id], `${n} ${id} ${phase}`).not.toContain(t);
    }
    expect([0, 1, 2].map((p) => text(7, 'sewer-eye', p as 0 | 1 | 2)).join(' ')).toMatch(/택시|버스/);
    expect([0, 1, 2].map((p) => text(9, 'apc', p as 0 | 1 | 2)).join(' ')).toMatch(/2차|꼬치|노래방/);
    expect([text(10, 'lab-ai', 0), text(10, 'jailer', 1)].join(' ')).toMatch(/집|현관|퇴근길/);
  });

  it('announces the stage-5 superior of the current section', () => {
    const v = { id: 'apc', phase: 1, hp: 1, state: 'intro', stateAge: 0, attack: null } as const;
    expect(phaseLineDue(0, v)?.text).toBe(BOSS_ATTACKS.apc[1]);
    expect(phaseLineDue(0, v)?.kicker).not.toMatch(/PHASE/);
    expect(BROADCAST_LINE).toBe('네 사장님!');
    // part 2's broadcast is the 단톡방 notice of 회장님: everyone answers him
    expect([0, 4].map(broadcastLine)).toEqual(['네 사장님!', '네 사장님!']);
    expect([5, 9].map(broadcastLine)).toEqual(['네 회장님!', '네 회장님!']);
  });
});
