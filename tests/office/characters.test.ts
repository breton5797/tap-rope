// v2.2 four heroes (spec §1–2): stats per character and the fairness invariants that rank above them —
// a character may jump higher, switch lanes faster or slide longer than the default, never the other way.
import { describe, expect, it } from 'vitest';
import { SKINS } from '../../src/core/content';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import { LANE_STEP } from '../../src/core/spacing';
import { LANE_SWITCH_TIME } from '../../src/types';
import { CHARACTERS, characterFor, statsFor } from '../../src/office/core/characters';

const IDS = ['kid', 'cat', 'bunny', 'robot'] as const;

describe('characters', () => {
  it('are the four office hires, two men and two women, all free', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual(IDS);
    expect(CHARACTERS.map((c) => c.name)).toEqual(['칼퇴준', '정시원', '고도약', '유행운']);
    expect(CHARACTERS.filter((c) => c.gender === 'm')).toHaveLength(2);
    expect(SKINS.map((s) => [s.id, s.name, s.price])).toEqual(CHARACTERS.map((c) => [c.id, c.name, 0]));
  });

  it('carry copy, an accent colour and five star axes in 1..5', () => {
    for (const c of CHARACTERS) {
      expect(c.role.length).toBeGreaterThan(0);
      expect(c.blurb.length).toBeGreaterThan(0);
      expect(c.catchphrase.length).toBeGreaterThan(0);
      expect(c.accent).toMatch(/^#[0-9a-f]{6}$/i);
      for (const v of Object.values(c.stars)) expect(v).toBeGreaterThanOrEqual(1);
      for (const v of Object.values(c.stars)) expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('follow the spec table', () => {
    expect(CHARACTERS.map((c) => c.stars)).toEqual([
      { jump: 3, agility: 3, hearts: 3, focus: 3, luck: 3 },
      { jump: 3, agility: 5, hearts: 2, focus: 3, luck: 3 },
      { jump: 5, agility: 3, hearts: 3, focus: 2, luck: 2 },
      { jump: 3, agility: 3, hearts: 4, focus: 2, luck: 5 },
    ]);
    const kid = statsFor('kid');
    expect(kid.physics).toEqual({ ...DEFAULT_PHYSICS, laneSwitchTime: LANE_SWITCH_TIME });
    expect([kid.laneTime, kid.slideTime, kid.hearts, kid.feverGain, kid.coinMul]).toEqual([0.3, 0.55, 3, 1, 1]);
    const cat = statsFor('cat');
    expect([cat.laneTime, cat.slideTime, cat.hearts, cat.physics.slideTime]).toEqual([0.24, 0.65, 2, 0.65]);
    expect(cat.physics.laneSwitchTime).toBeCloseTo(LANE_SWITCH_TIME * 0.8, 9);
    const bunny = statsFor('bunny');
    expect(bunny.physics.jumpV).toBeCloseTo(DEFAULT_PHYSICS.jumpV * 1.12, 9);
    expect(bunny.physics.boostV).toBeCloseTo(DEFAULT_PHYSICS.boostV * 1.08, 9);
    expect([bunny.feverGain, bunny.coinMul, bunny.hearts]).toEqual([0.8, 0.8, 3]);
    const robot = statsFor('robot');
    expect([robot.hearts, robot.feverGain, robot.coinMul]).toEqual([4, 0.8, 1.5]);
    expect(robot.physics).toEqual(kid.physics);
  });

  it('never make a character harder to control than the default (fairness)', () => {
    for (const id of IDS) {
      const s = statsFor(id);
      expect(s.physics.jumpV).toBeGreaterThanOrEqual(DEFAULT_PHYSICS.jumpV);
      expect(s.physics.boostV).toBeGreaterThanOrEqual(DEFAULT_PHYSICS.boostV);
      expect(s.physics.gravity).toBe(DEFAULT_PHYSICS.gravity);
      expect(s.physics.fallV).toBe(DEFAULT_PHYSICS.fallV);
      expect(s.laneTime).toBeLessThanOrEqual(LANE_STEP); // the generator assumes LANE_STEP per lane
      expect(s.slideTime).toBeGreaterThanOrEqual(DEFAULT_PHYSICS.slideTime);
      expect(s.physics.laneSwitchTime ?? LANE_SWITCH_TIME).toBeLessThanOrEqual(LANE_SWITCH_TIME);
    }
  });

  it('fall back to the balanced hire for an unknown skin', () => {
    expect(characterFor('ninja').id).toBe('kid');
    expect(statsFor('astro')).toEqual(statsFor('kid'));
  });
});
