import { describe, expect, it } from 'vitest';
import {
  airtimeForLevel,
  CLEAR_H,
  DEFAULT_PHYSICS,
  initialPlayer,
  PERFECT_H,
  physicsForWorld,
  stepPlayer,
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

describe('constants', () => {
  it('exposes GDD values', () => {
    expect(DEFAULT_PHYSICS).toEqual({ gravity: 3000, jumpV: 660, boostV: 700 });
    expect(CLEAR_H).toBe(12);
    expect(PERFECT_H).toBe(40);
  });
});

describe('initialPlayer', () => {
  it('is grounded at rest', () => {
    expect(initialPlayer()).toEqual({
      height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, buffer: 0,
    });
  });
});

describe('tapPlayer', () => {
  it('jumps from the ground', () => {
    const p0 = initialPlayer();
    const { player, action } = tapPlayer(p0, cfg);
    expect(action).toBe('jump');
    expect(player.grounded).toBe(false);
    expect(player.level).toBe(1);
    expect(player.vy).toBe(cfg.jumpV);
    expect(p0.grounded).toBe(true); // immutability
  });

  it('boosts in the air up to level 3, then does nothing', () => {
    let p = tapPlayer(initialPlayer(), cfg).player;
    p = stepPlayer(p, 0.1, cfg).player;
    const b1 = tapPlayer(p, cfg);
    expect(b1.action).toBe('boost');
    expect(b1.player.level).toBe(2);
    expect(b1.player.vy).toBe(cfg.boostV);
    const b2 = tapPlayer(b1.player, cfg);
    expect(b2.action).toBe('boost');
    expect(b2.player.level).toBe(3);
    const b3 = tapPlayer(b2.player, cfg);
    expect(b3.action).toBe('none');
    expect(b3.player).toEqual(b2.player);
  });

  it('buffers a tap when descending close to the ground', () => {
    const p: PlayerState = { ...initialPlayer(), grounded: false, level: 1, height: 20, vy: -300 };
    const { player, action } = tapPlayer(p, cfg);
    expect(action).toBe('buffered');
    expect(player.buffer).toBeCloseTo(0.12);
    expect(player.level).toBe(1);
  });

  it('boosts (not buffers) when descending but still high', () => {
    const p: PlayerState = { ...initialPlayer(), grounded: false, level: 1, height: 40, vy: -300 };
    expect(tapPlayer(p, cfg).action).toBe('boost');
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
    const p = tapPlayer(initialPlayer(), cfg).player;
    const { t, maxH, player } = runUntil(p, cfg, (q) => q.grounded);
    expect(t).toBeGreaterThan(0.42);
    expect(t).toBeLessThan(0.46);
    expect(maxH).toBeGreaterThan(70);
    expect(maxH).toBeLessThan(75);
    expect(player).toMatchObject({ height: 0, vy: 0, level: 0, airTime: 0, landTimer: 0 });
  });

  it('reports landed exactly on the landing step', () => {
    let p = tapPlayer(initialPlayer(), cfg).player;
    let landedCount = 0;
    for (let i = 0; i < 240; i++) {
      const r = stepPlayer(p, DT, cfg);
      if (r.landed) landedCount++;
      p = r.player;
    }
    expect(landedCount).toBe(1);
  });

  it('counts airTime while airborne', () => {
    const p = tapPlayer(initialPlayer(), cfg).player;
    const r = stepPlayer(p, 0.1, cfg);
    expect(r.player.airTime).toBeCloseTo(0.1);
  });

  it('auto-jumps on landing when a tap was buffered', () => {
    const p: PlayerState = { ...initialPlayer(), grounded: false, level: 2, height: 3, vy: -600 };
    const tapped = tapPlayer(p, cfg).player;
    const r = stepPlayer(tapped, 0.02, cfg);
    expect(r.landed).toBe(true);
    expect(r.autoJumped).toBe(true);
    expect(r.player.grounded).toBe(false);
    expect(r.player.level).toBe(1);
    expect(r.player.buffer).toBe(0);
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
    const p = tapPlayer(initialPlayer(), cfg).player;
    const big = stepPlayer(p, 0.25, cfg).player;
    const small = runUntil(p, cfg, () => false, 0.25 - DT / 2).player;
    expect(Math.abs(big.height - small.height)).toBeLessThan(3); // Euler step-size error only
    const land = stepPlayer(p, 1.0, cfg);
    expect(land.landed).toBe(true);
    expect(land.player.grounded).toBe(true);
    expect(land.player.landTimer).toBeGreaterThan(0.5);
  });

  it('ignores non-positive dt', () => {
    const p = tapPlayer(initialPlayer(), cfg).player;
    expect(stepPlayer(p, 0, cfg).player).toEqual(p);
  });
});

describe('airtimeForLevel', () => {
  it('matches GDD targets roughly', () => {
    expect(airtimeForLevel(1, cfg)).toBeCloseTo(0.44, 2);
    expect(airtimeForLevel(2, cfg)).toBeGreaterThan(0.72);
    expect(airtimeForLevel(2, cfg)).toBeLessThan(0.85);
    expect(airtimeForLevel(3, cfg)).toBeGreaterThan(1.0);
    expect(airtimeForLevel(3, cfg)).toBeLessThan(1.2);
  });

  it('agrees with simulation of apex taps', () => {
    let p = tapPlayer(initialPlayer(), cfg).player;
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
    const apex = (c: PhysicsConfig) => (c.jumpV * c.jumpV) / (2 * c.gravity);
    expect(apex(moon)).toBeCloseTo(apex(DEFAULT_PHYSICS), 6);
    expect(airtimeForLevel(1, moon)).toBeGreaterThan(airtimeForLevel(1, DEFAULT_PHYSICS));
  });
});
