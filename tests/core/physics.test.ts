import { describe, expect, it } from 'vitest';
import {
  airtimeForLevel,
  airtimeTumble,
  CLEAR_H,
  DEFAULT_PHYSICS,
  initialPlayer,
  PERFECT_H,
  physicsForWorld,
  stepPlayer,
  SWIPE_WINDOW,
  swipePlayer,
  tapPlayer,
} from '../../src/core/physics';
import type { PhysicsConfig, PlayerState } from '../../src/types';

const cfg = DEFAULT_PHYSICS;
const DT = 1 / 240;

/** Advance until `until` returns true or maxT elapses; returns final player + elapsed. */
function runUntil(
  p: PlayerState,
  c: PhysicsConfig,
  until: (p: PlayerState) => boolean,
  maxT = 5,
): { player: PlayerState; t: number; maxH: number } {
  let cur = p;
  let t = 0;
  let maxH = cur.height;
  while (t < maxT) {
    cur = stepPlayer(cur, DT, c).player;
    t += DT;
    maxH = Math.max(maxH, cur.height);
    if (until(cur)) break;
  }
  return { player: cur, t, maxH };
}

const jumped = (): PlayerState => tapPlayer(initialPlayer(), cfg).player;
const boosted = (): PlayerState => tapPlayer(stepPlayer(jumped(), 0.1, cfg).player, cfg).player;

describe('constants', () => {
  it('exposes GDD values', () => {
    expect(DEFAULT_PHYSICS).toEqual({ gravity: 3000, jumpV: 660, boostV: 700, tumbleV: 980 });
    expect(CLEAR_H).toBe(12);
    expect(PERFECT_H).toBe(40);
    expect(SWIPE_WINDOW).toBe(0.25);
  });
});

describe('initialPlayer', () => {
  it('is grounded at rest in the centre lane', () => {
    expect(initialPlayer()).toEqual({
      height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, buffer: 0,
      lane: 0, laneX: 0, tumble: false, cross: false, backward: false, lastTap: 'none', pendingSwipe: null,
    });
  });
});

describe('tapPlayer', () => {
  it('jumps from the ground and records lastTap', () => {
    const p0 = initialPlayer();
    const { player, action } = tapPlayer(p0, cfg);
    expect(action).toBe('jump');
    expect(player).toMatchObject({ grounded: false, level: 1, vy: cfg.jumpV, lastTap: 'jump' });
    expect(p0.grounded).toBe(true); // immutability
  });

  it('boosts in the air up to level 3, then does nothing', () => {
    const b1 = { player: boosted(), action: 'boost' };
    expect(b1.player).toMatchObject({ level: 2, vy: cfg.boostV, lastTap: 'boost' });
    const b2 = tapPlayer(b1.player, cfg);
    expect(b2.action).toBe('boost');
    expect(b2.player.level).toBe(3);
    const b3 = tapPlayer(b2.player, cfg);
    expect(b3.action).toBe('none');
    expect(b3.player).toEqual({ ...b2.player, lastTap: 'none' });
  });

  it('buffers a tap when descending close to the ground', () => {
    const p: PlayerState = { ...initialPlayer(), grounded: false, level: 1, height: 20, vy: -300, lastTap: 'jump' };
    const { player, action } = tapPlayer(p, cfg);
    expect(action).toBe('buffered');
    expect(player.buffer).toBeCloseTo(0.12);
    expect(player.level).toBe(1);
    expect(player.lastTap).toBe('none');
  });

  it('boosts (not buffers) when descending but still high', () => {
    const p: PlayerState = { ...initialPlayer(), grounded: false, level: 1, height: 40, vy: -300 };
    expect(tapPlayer(p, cfg).action).toBe('boost');
  });

  it('is ignored while tumbling', () => {
    const t = swipePlayer(jumped(), 'up', cfg, 'long').player;
    const r = tapPlayer(t, cfg);
    expect(r.action).toBe('none');
    expect(r.player).toBe(t);
  });
});

describe('swipePlayer', () => {
  it('up right after a ground jump = tumble', () => {
    const p = stepPlayer(jumped(), 0.1, cfg).player;
    const r = swipePlayer(p, 'up', cfg, 'long');
    expect(r.action).toBe('tumble');
    expect(r.player.tumble).toBe(true);
    expect(r.player.vy).toBeCloseTo(Math.sqrt(cfg.tumbleV ** 2 - 2 * cfg.gravity * p.height), 6);
    expect(swipePlayer(r.player, 'up', cfg, 'long').action).toBe('none');
  });

  it('a full tumble flies higher than a 2단 apex and lands in airtimeTumble', () => {
    const t = swipePlayer(jumped(), 'up', cfg, 'solo').player;
    const { t: air, maxH, player } = runUntil(t, cfg, (q) => q.grounded);
    expect(air).toBeCloseTo(airtimeTumble(cfg), 1);
    expect(maxH).toBeGreaterThan(154);
    expect(player).toMatchObject({ tumble: false, cross: false, lastTap: 'none' });
  });

  it('left/right after a ground jump moves one lane, clamped', () => {
    const r = swipePlayer(jumped(), 'left', cfg, 'long');
    expect(r.action).toBe('side');
    expect(r.player.lane).toBe(-1);
    expect(swipePlayer(r.player, 'left', cfg, 'long').action).toBe('none');
    expect(swipePlayer(r.player, 'right', cfg, 'long').player.lane).toBe(0);
    expect(swipePlayer(jumped(), 'right', cfg, 'solo').player.lane).toBe(1);
  });

  it('left/right after an air tap = cross', () => {
    const r = swipePlayer(boosted(), 'right', cfg, 'solo');
    expect(r.action).toBe('cross');
    expect(r.player.cross).toBe(true);
    expect(r.player.lane).toBe(0);
  });

  it('down after a ground jump toggles backward in solo only', () => {
    const r = swipePlayer(jumped(), 'down', cfg, 'solo');
    expect(r.action).toBe('reverse');
    expect(r.player.backward).toBe(true);
    const back = swipePlayer(tapPlayer(runUntil(r.player, cfg, (q) => q.grounded).player, cfg).player, 'down', cfg, 'solo');
    expect(back.player.backward).toBe(false);
    expect(swipePlayer(jumped(), 'down', cfg, 'long').action).toBe('none');
  });

  it('backward persists across landings', () => {
    const r = swipePlayer(jumped(), 'down', cfg, 'solo').player;
    expect(runUntil(r, cfg, (q) => q.grounded).player.backward).toBe(true);
  });

  it('does nothing outside the swipe window, on the ground, or with up/down after air tap', () => {
    const late = stepPlayer(jumped(), SWIPE_WINDOW + 0.02, cfg).player;
    expect(swipePlayer(late, 'up', cfg, 'long').action).toBe('none');
    expect(swipePlayer(late, 'left', cfg, 'long').action).toBe('none');
    expect(swipePlayer(late, 'down', cfg, 'solo').action).toBe('none');
    expect(swipePlayer(initialPlayer(), 'left', cfg, 'long').action).toBe('none');
    expect(swipePlayer(boosted(), 'up', cfg, 'long').action).toBe('none');
    expect(swipePlayer(boosted(), 'down', cfg, 'solo').action).toBe('none');
    const p = initialPlayer();
    expect(swipePlayer(p, 'up', cfg, 'long').player).toBe(p);
  });
});

describe('stepPlayer', () => {
  it('stays grounded and counts landTimer', () => {
    const r = stepPlayer(initialPlayer(), 0.5, cfg);
    expect(r.player.grounded).toBe(true);
    expect(r.player.landTimer).toBeCloseTo(0.5);
    expect(r.landed).toBe(false);
  });

  it('1단 jump: airtime ≈ 0.44s, apex ≈ 73px', () => {
    const { t, maxH, player } = runUntil(jumped(), cfg, (q) => q.grounded);
    expect(t).toBeGreaterThan(0.42);
    expect(t).toBeLessThan(0.46);
    expect(maxH).toBeGreaterThan(70);
    expect(maxH).toBeLessThan(75);
    expect(player).toMatchObject({ height: 0, vy: 0, level: 0, airTime: 0, landTimer: 0, lastTap: 'none' });
  });

  it('reports landed exactly on the landing step', () => {
    let p = jumped();
    let landedCount = 0;
    for (let i = 0; i < 240; i++) {
      const r = stepPlayer(p, DT, cfg);
      if (r.landed) landedCount++;
      p = r.player;
    }
    expect(landedCount).toBe(1);
  });

  it('counts airTime while airborne', () => {
    expect(stepPlayer(jumped(), 0.1, cfg).player.airTime).toBeCloseTo(0.1);
  });

  it('eases laneX toward lane at ~9 lanes/s', () => {
    const p = swipePlayer(jumped(), 'left', cfg, 'long').player;
    expect(p.laneX).toBe(0);
    expect(stepPlayer(p, 0.05, cfg).player.laneX).toBeCloseTo(-0.45);
    expect(stepPlayer(p, 0.2, cfg).player.laneX).toBe(-1);
    const g: PlayerState = { ...initialPlayer(), lane: 1, laneX: 0.5 };
    expect(stepPlayer(g, 1, cfg).player.laneX).toBe(1);
  });

  it('auto-jumps on landing when a tap was buffered', () => {
    const p: PlayerState = { ...initialPlayer(), grounded: false, level: 2, height: 3, vy: -600, cross: true };
    const tapped = tapPlayer(p, cfg).player;
    const r = stepPlayer(tapped, 0.02, cfg);
    expect(r.landed).toBe(true);
    expect(r.autoJumped).toBe(true);
    expect(r.player).toMatchObject({ grounded: false, level: 1, buffer: 0, lastTap: 'jump', cross: false });
  });

  it('expires the buffer if landing is far away', () => {
    const p: PlayerState = { ...initialPlayer(), grounded: false, level: 1, height: 25, vy: -1 };
    const tapped = tapPlayer(p, cfg).player;
    expect(tapped.buffer).toBeGreaterThan(0);
    const r = runUntil(tapped, cfg, (q) => q.grounded);
    expect(r.player.grounded).toBe(true);
    expect(r.player.buffer).toBe(0);
  });

  it('is robust to large dt (sub-steps)', () => {
    const p = jumped();
    const big = stepPlayer(p, 0.25, cfg).player;
    const small = runUntil(p, cfg, () => false, 0.25 - DT / 2).player;
    expect(Math.abs(big.height - small.height)).toBeLessThan(3); // Euler step-size error only
    const land = stepPlayer(p, 1.0, cfg);
    expect(land.landed).toBe(true);
    expect(land.player.grounded).toBe(true);
    expect(land.player.landTimer).toBeGreaterThan(0.5);
  });

  it('ignores non-positive dt', () => {
    const p = jumped();
    expect(stepPlayer(p, 0, cfg).player).toEqual(p);
  });
});

describe('airtimeForLevel / airtimeTumble', () => {
  it('matches GDD targets roughly', () => {
    expect(airtimeForLevel(1, cfg)).toBeCloseTo(0.44, 2);
    expect(airtimeForLevel(2, cfg)).toBeGreaterThan(0.72);
    expect(airtimeForLevel(2, cfg)).toBeLessThan(0.85);
    expect(airtimeForLevel(3, cfg)).toBeGreaterThan(1.0);
    expect(airtimeForLevel(3, cfg)).toBeLessThan(1.2);
    expect(airtimeTumble(cfg)).toBeCloseTo((2 * 980) / 3000, 6);
  });

  it('agrees with simulation of apex taps', () => {
    let p = jumped();
    let t = 0;
    let taps = 1;
    while (t < 3) {
      const r = stepPlayer(p, DT, cfg);
      t += DT;
      if (taps < 3 && p.vy > 0 && r.player.vy <= 0) {
        p = tapPlayer(r.player, cfg).player;
        taps++;
        continue;
      }
      p = r.player;
      if (r.landed) break;
    }
    expect(t).toBeCloseTo(airtimeForLevel(3, cfg), 1);
  });
});

describe('physicsForWorld', () => {
  it('is default on earth worlds', () => {
    expect(physicsForWorld(0)).toEqual(DEFAULT_PHYSICS);
  });

  it('moon: lower gravity, same apex, longer hang time', () => {
    const moon = physicsForWorld(3);
    expect(moon.gravity).toBeCloseTo(3000 * 0.82);
    const apex = (c: PhysicsConfig, v: number) => (v * v) / (2 * c.gravity);
    expect(apex(moon, moon.jumpV)).toBeCloseTo(apex(DEFAULT_PHYSICS, DEFAULT_PHYSICS.jumpV), 6);
    expect(apex(moon, moon.tumbleV)).toBeCloseTo(apex(DEFAULT_PHYSICS, DEFAULT_PHYSICS.tumbleV), 6);
    expect(airtimeForLevel(1, moon)).toBeGreaterThan(airtimeForLevel(1, DEFAULT_PHYSICS));
    expect(airtimeTumble(moon)).toBeGreaterThan(airtimeTumble(DEFAULT_PHYSICS));
  });
});


describe('v2 review fixes', () => {
  const cfg = DEFAULT_PHYSICS;
  const airborneJump = (airTime: number): PlayerState => {
    let p = tapPlayer(initialPlayer(), cfg).player;
    p = stepPlayer(p, airTime, cfg).player;
    return p;
  };

  it('a swipe during a buffered (pre-landing) tap is kept for the auto-jump', () => {
    let p = tapPlayer(initialPlayer(), cfg).player;
    while (!(p.vy < 0 && p.height < 20)) p = stepPlayer(p, 1 / 240, cfg).player;
    p = tapPlayer(p, cfg).player;
    expect(p.buffer).toBeGreaterThan(0);
    const swiped = swipePlayer(p, 'left', cfg, 'long');
    expect(swiped.action).toBe('none');
    expect(swiped.player.pendingSwipe).toBe('left');
    const landed = stepPlayer(swiped.player, 0.05, cfg);
    expect(landed.autoJumped).toBe(true);
    expect(landed.player.pendingSwipe).toBe('left'); // the session applies it to the new jump
  });

  it('a pending swipe is dropped when the buffer expires without a jump', () => {
    const p: PlayerState = { ...airborneJump(0.3), pendingSwipe: 'up', buffer: 0 };
    let q = p;
    for (let i = 0; i < 60 && !q.grounded; i++) q = stepPlayer(q, 1 / 60, cfg).player;
    expect(q.grounded).toBe(true);
    expect(q.pendingSwipe).toBeNull();
  });

  it('every swipe is ignored while tumbling', () => {
    const t = swipePlayer(airborneJump(0.02), 'up', cfg, 'solo').player;
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      expect(swipePlayer(t, dir, cfg, 'solo').action).toBe('none');
    }
  });

  it('a late swipe still reaches the full tumble apex', () => {
    const apex = (start: number): number => {
      let p = swipePlayer(airborneJump(start), 'up', cfg, 'long').player;
      let top = p.height;
      while (!p.grounded) {
        p = stepPlayer(p, 1 / 240, cfg).player;
        top = Math.max(top, p.height);
      }
      return top;
    };
    const full = (cfg.tumbleV * cfg.tumbleV) / (2 * cfg.gravity);
    for (const start of [0, 0.1, 0.2]) expect(apex(start)).toBeCloseTo(full, -1);
  });

  it('a swipe exactly at the window edge still counts', () => {
    const p = { ...airborneJump(0.1), airTime: SWIPE_WINDOW };
    expect(swipePlayer(p, 'right', cfg, 'long').action).toBe('side');
  });
});
