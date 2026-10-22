import { describe, expect, it } from 'vitest';
import { laneItems, moveForBeat, ropeState as ropeStateV2, visibleObstacles } from '../../src/core/timeline';
import type { Beat, JumpLevel, Obstacle } from '../../src/types';
import { LANE_LEAD, SCROLL_SPEED } from '../../src/types';

const ropeState = (beats: readonly Beat[], t: number) => ropeStateV2(beats, t, 'long');

const TAU = Math.PI * 2;

function mk(id: number, time: number, obstacles: Obstacle[], requiredLevel: JumpLevel, doubleDutch = false): Beat {
  return { id, time, obstacles, requiredLevel, doubleDutch };
}
const rope = (id: number, time: number, level: 1 | 2 | 3 = 1, dd = false) =>
  mk(id, time, [{ kind: 'rope', level }], level, dd);

/** distance of phase to nearest multiple of 2π */
const mod0 = (p: number) => {
  const m = ((p % TAU) + TAU) % TAU;
  return Math.min(m, TAU - m);
};

describe('ropeState', () => {
  const beats = [rope(0, 2), rope(1, 3), rope(2, 5)];

  it('phase ≡ 0 exactly at each pass', () => {
    for (const b of beats) expect(mod0(ropeState(beats, b.time).phaseA)).toBeLessThan(1e-9);
  });

  it('interpolates linearly between passes', () => {
    const s = ropeState(beats, 2.5);
    expect(s.phaseA).toBeCloseTo(Math.PI);
    expect(s.speed).toBeCloseTo(TAU);
    expect(ropeState(beats, 4).speed).toBeCloseTo(Math.PI);
    expect(s.phaseB).toBeNull();
  });

  it('idles before the first pass and keeps spinning after the last', () => {
    const before = ropeState(beats, 1.4);
    expect(before.speed).toBeCloseTo(TAU / 1.2);
    expect(mod0(before.phaseA)).toBeCloseTo(Math.PI, 5); // 0.6s before the first pass = half an idle turn
    const after = ropeState(beats, 6);
    expect(after.speed).toBeCloseTo(Math.PI);
    expect(after.phaseA).toBeCloseTo(TAU * 2 + Math.PI);
  });

  it('idles with no beats', () => {
    const s = ropeState([], 1.2);
    expect(mod0(s.phaseA)).toBeLessThan(1e-9);
    expect(s.phaseB).toBeNull();
  });

  it('spins L times around a multi-under beat', () => {
    const b = [rope(0, 2), rope(1, 4, 3), rope(2, 6)];
    expect(mod0(ropeState(b, 4 - 0.12).phaseA)).toBeLessThan(1e-9);
    expect(mod0(ropeState(b, 4).phaseA)).toBeLessThan(1e-9);
    expect(mod0(ropeState(b, 4 + 0.12).phaseA)).toBeLessThan(1e-9);
    expect(ropeState(b, 6).phaseA).toBeCloseTo(TAU * 4);
    const two = [rope(0, 2), rope(1, 4, 2)];
    expect(mod0(ropeState(two, 4.06).phaseA)).toBeLessThan(1e-9);
  });

  it('ignores beats without a rope', () => {
    const b = [rope(0, 2), mk(1, 2.5, [{ kind: 'hurdle', level: 1 }], 1), rope(2, 3)];
    expect(ropeState(b, 2.5).phaseA).toBeCloseTo(Math.PI);
  });

  describe('double dutch', () => {
    const dd = [rope(0, 2), rope(1, 4, 1, true), rope(2, 4.6, 1, true), rope(3, 5.2, 1, true), rope(4, 5.8, 1, true), rope(5, 8)];

    it('rope A passes on even DD beats, rope B on odd ones', () => {
      expect(mod0(ropeState(dd, 4).phaseA)).toBeLessThan(1e-9);
      expect(mod0(ropeState(dd, 5.2).phaseA)).toBeLessThan(1e-9);
      const b1 = ropeState(dd, 4.6).phaseB;
      const b3 = ropeState(dd, 5.8).phaseB;
      expect(b1).not.toBeNull();
      expect(mod0(b1 ?? 1)).toBeLessThan(1e-9);
      expect(mod0(b3 ?? 1)).toBeLessThan(1e-9);
      expect(ropeState(dd, 4.6).phaseA).toBeCloseTo(TAU + Math.PI); // A halfway between 4 and 5.2
    });

    it('phaseB is null outside the DD window', () => {
      expect(ropeState(dd, 2.9).phaseB).toBeNull();
      expect(ropeState(dd, 3.1).phaseB).not.toBeNull();
      expect(ropeState(dd, 6.2).phaseB).not.toBeNull();
      expect(ropeState(dd, 6.4).phaseB).toBeNull();
    });
  });
});


describe('ropeState mode', () => {
  it('reports the rope mode', () => {
    const beats = [rope(0, 2), rope(1, 3)];
    expect(ropeStateV2(beats, 2.5, 'solo')).toMatchObject({ mode: 'solo', phaseB: null });
    expect(ropeStateV2(beats, 2.5, 'long').mode).toBe('long');
    expect(ropeStateV2(beats, 2.5, 'solo').phaseA).toBeCloseTo(Math.PI);
  });
});

describe('moveForBeat', () => {
  const m = (obstacles: Obstacle[], req: JumpLevel, dd = false) => moveForBeat(mk(0, 1, obstacles, req, dd));

  it('maps beats to moves by priority', () => {
    expect(m([{ kind: 'ring', level: 2 }], 0)).toBe('tumble');
    expect(m([{ kind: 'ball', level: 1, lane: 1 }, { kind: 'rope', level: 1 }], 1)).toBe('side');
    expect(m([{ kind: 'rope', level: 2, cross: true }], 2)).toBe('cross');
    expect(m([{ kind: 'rope', level: 2, back: true }], 2)).toBe('back');
    expect(m([{ kind: 'rope', level: 3 }], 3)).toBe('triple');
    expect(m([{ kind: 'hurdle', level: 2 }], 2)).toBe('double');
    expect(m([{ kind: 'bird', level: 1 }], 0)).toBe('bird');
    expect(m([{ kind: 'bird', level: 1 }, { kind: 'rope', level: 1 }], 1)).toBe('jump');
    expect(m([{ kind: 'rope', level: 1 }], 1, true)).toBe('dd');
    expect(m([{ kind: 'rope', level: 1 }], 1)).toBe('jump');
    expect(m([{ kind: 'coin', level: 2 }], 0)).toBe('jump');
  });
});

describe('visibleObstacles', () => {
  const beats = [
    mk(0, 3, [{ kind: 'rope', level: 1 }, { kind: 'hurdle', level: 2 }], 2),
    mk(1, 3.5, [{ kind: 'bird', level: 1 }], 0),
    mk(2, 4, [{ kind: 'coin', level: 1, lane: -1 }], 0),
    mk(3, 4.5, [{ kind: 'shield', level: 2, lane: 1 }], 0),
    mk(4, 5, [{ kind: 'heart', level: 3 }], 0),
    mk(5, 5.5, [{ kind: 'ring', level: 2 }], 0),
    mk(6, 6, [{ kind: 'ball', level: 1, lane: 1 }, { kind: 'ball', level: 1, lane: -1 }], 0),
    mk(7, 30, [{ kind: 'hurdle', level: 1 }], 1),
  ];

  it('places non-rope obstacles by z with lanes and heights', () => {
    const v = visibleObstacles(beats, 3);
    expect(v.map((o) => o.id)).toEqual(['0-1', '1-0', '2-0', '3-0', '4-0', '5-0', '6-0', '6-1']);
    expect(v[0]).toEqual({ id: '0-1', kind: 'hurdle', level: 2, lane: 0, z: 0, height: 0 });
    expect(v[1].z).toBeCloseTo(0.5 * SCROLL_SPEED);
    expect(v.map((o) => o.height)).toEqual([0, 110, 50, 120, 185, 0, 0, 0]);
    expect(v.map((o) => o.lane)).toEqual([0, 0, -1, 1, 0, 0, 1, -1]);
  });

  it('keeps -80 <= z <= 900', () => {
    const at = (t: number) => visibleObstacles(beats, t).map((o) => o.id);
    expect(at(3.3)).toContain('0-1'); // z = -72
    expect(at(3.4)).not.toContain('0-1'); // z = -96
    expect(at(30 - 900 / SCROLL_SPEED)).toContain('7-0');
    expect(at(30 - 901 / SCROLL_SPEED)).not.toContain('7-0');
  });
});

describe('laneItems', () => {
  const beats = [
    rope(0, 2),
    mk(1, 3, [{ kind: 'rope', level: 1 }, { kind: 'ball', level: 1, lane: 1 }, { kind: 'ball', level: 1 }], 1),
    rope(2, 10),
  ];

  it('shows upcoming beats within LANE_LEAD and just-passed ones, with move and ball lanes', () => {
    const items = laneItems(beats, 2.1);
    expect(items).toEqual([
      { beatId: 0, timeUntil: expect.closeTo(-0.1, 6), kinds: ['rope'], level: 1, move: 'jump', ballLanes: [] },
      { beatId: 1, timeUntil: expect.closeTo(0.9, 6), kinds: ['rope', 'ball', 'ball'], level: 1, move: 'side', ballLanes: [1, 0] },
    ]);
    expect(laneItems(beats, 2.3).map((i) => i.beatId)).toEqual([1]);
    expect(laneItems(beats, 10 - LANE_LEAD + 0.01).map((i) => i.beatId)).toEqual([2]);
  });
});
