import { describe, expect, it } from 'vitest';
import {
  airtimeForLevel,
  CLEAR_H,
  DEFAULT_PHYSICS,
  initialPlayer,
  PERFECT_H,
  physicsForWorld,
  slidePlayer,
  stepPlayer,
  SWIPE_WINDOW,
  swipePlayer,
  tapPlayer,
} from '../../src/core/physics';
import type { PhysicsConfig, PlayerState } from '../../src/types';

const cfg = DEFAULT_PHYSICS;
const DT = 1 / 240;

function runUntil(
  p: PlayerState,
  c: PhysicsConfig,
  until: (p: PlayerState) => boolean,
  maxT = 5,
): { player: PlayerState; t: number; maxH: number; slideStarted: boolean } {
  let cur = p;
  let t = 0;
  let maxH = cur.height;
  let slideStarted = false;
  while (t < maxT) {
    const r = stepPlayer(cur, DT, c);
    cur = r.player;
    slideStarted = slideStarted || r.slideStarted;
    t += DT;
    maxH = Math.max(maxH, cur.height);
    if (until(cur)) break;
  }
  return { player: cur, t, maxH, slideStarted };
}

const jumped = (): PlayerState => tapPlayer(initialPlayer(), cfg).player;
const high = (): PlayerState => stepPlayer(jumped(), SWIPE_WINDOW + 0.02, cfg).player;
const sliding = (): PlayerState => slidePlayer(initialPlayer(), cfg).player;

describe('constants', () => {
  it('exposes GDD v4 values', () => {
    expect(DEFAULT_PHYSICS).toEqual({ gravity: 3000, jumpV: 660, boostV: 700, fallV: 1400, slideTime: 0.55 });
    expect(CLEAR_H).toBe(24);
    expect(PERFECT_H).toBe(40);
    expect(SWIPE_WINDOW).toBe(0.25);
  });

  it('uses the same physics for every theme', () => {
    for (const w of [0, 1, 2, 3] as const) expect(physicsForWorld(w)).toEqual(DEFAULT_PHYSICS);
  });
});

describe('initialPlayer', () => {
  it('stands on the floor, not sliding', () => {
    expect(initialPlayer()).toEqual({
      height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, buffer: 0,
      sliding: false, slideTime: 0, slideAge: 0, pendingSlide: false, lastTap: 'none',
    });
  });
});

describe('tapPlayer', () => {
  it('jumps from the floor and records lastTap', () => {
    const p0 = initialPlayer();
    const { player, action } = tapPlayer(p0, cfg);
    expect(action).toBe('jump');
    expect(player).toMatchObject({ grounded: false, level: 1, vy: cfg.jumpV, lastTap: 'jump' });
    expect(p0.grounded).toBe(true);
  });

  it('boosts in the air up to level 3, then does nothing', () => {
    const b1 = tapPlayer(stepPlayer(jumped(), 0.1, cfg).player, cfg);
    expect(b1.action).toBe('boost');
    expect(b1.player).toMatchObject({ level: 2, vy: cfg.boostV, lastTap: 'boost' });
    const b2 = tapPlayer(b1.player, cfg);
    expect(b2.player.level).toBe(3);
    const b3 = tapPlayer(b2.player, cfg);
    expect(b3.action).toBe('none');
    expect(b3.player).toEqual({ ...b2.player, lastTap: 'none' });
  });

  it('buffers a tap when descending close to the floor', () => {
    const p: PlayerState = { ...initialPlayer(), grounded: false, level: 1, height: 20, vy: -300, lastTap: 'jump' };
    const { player, action } = tapPlayer(p, cfg);
    expect(action).toBe('buffered');
    expect(player.buffer).toBeCloseTo(0.12);
    expect(player.lastTap).toBe('none');
  });

  it('cancels a slide and jumps', () => {
    const r = tapPlayer(sliding(), cfg);
    expect(r.action).toBe('jump');
    expect(r.player).toMatchObject({ sliding: false, slideTime: 0, slideAge: 0, grounded: false, level: 1 });
  });

  it('a boost during a dive cancels the dive', () => {
    const dive = swipePlayer(high(), 'down', cfg).player;
    const r = tapPlayer(dive, cfg);
    expect(r.action).toBe('boost');
    expect(r.player.pendingSlide).toBe(false);
  });
});

describe('swipePlayer / slidePlayer', () => {
  it('↓ right after a ground jump converts it into a slide', () => {
    const p = stepPlayer(jumped(), 0.1, cfg).player;
    const r = swipePlayer(p, 'down', cfg);
    expect(r.action).toBe('slide');
    expect(r.player).toMatchObject({
      height: 0, vy: 0, grounded: true, level: 0, sliding: true, slideTime: cfg.slideTime, slideAge: 0, lastTap: 'none',
    });
  });

  it('↓ in the air later dives, and the slide starts on landing', () => {
    const r = swipePlayer(high(), 'down', cfg);
    expect(r.action).toBe('dive');
    expect(r.player).toMatchObject({ vy: -cfg.fallV, pendingSlide: true });
    const landed = runUntil(r.player, cfg, (q) => q.grounded);
    expect(landed.slideStarted).toBe(true);
    expect(landed.player).toMatchObject({ sliding: true, pendingSlide: false, level: 0 });
    expect(landed.t).toBeLessThan(0.12);
  });

  it('↓ after an air tap dives too', () => {
    const b = tapPlayer(stepPlayer(jumped(), 0.05, cfg).player, cfg).player;
    expect(swipePlayer(b, 'down', cfg).action).toBe('dive');
  });

  it('a buffered tap then ↓ becomes a dive into a slide', () => {
    const p: PlayerState = { ...initialPlayer(), grounded: false, level: 1, height: 20, vy: -300 };
    const r = swipePlayer(tapPlayer(p, cfg).player, 'down', cfg);
    expect(r.action).toBe('dive');
    expect(r.player.buffer).toBe(0);
    expect(runUntil(r.player, cfg, (q) => q.grounded).player.sliding).toBe(true);
  });

  it('only ↓ acts; nothing while already sliding or diving', () => {
    for (const d of ['up', 'left', 'right'] as const) {
      const p = jumped();
      expect(swipePlayer(p, d, cfg)).toEqual({ player: p, action: 'none' });
    }
    // ↓ while sliding restarts the slide (back-to-back slide lasers)
    const restarted = swipePlayer(sliding(), 'down', cfg);
    expect(restarted.action).toBe('slide');
    expect(restarted.player.slideTime).toBe(cfg.slideTime);
    const dive = swipePlayer(high(), 'down', cfg).player;
    expect(swipePlayer(dive, 'down', cfg).action).toBe('none');
  });

  it('slidePlayer (keyboard ↓, no tap) slides from the floor and always dives in the air', () => {
    expect(slidePlayer(initialPlayer(), cfg).action).toBe('slide');
    // the jump was a separate key press, so there is no touch to convert — dive into a slide
    expect(slidePlayer(stepPlayer(jumped(), 0.12, cfg).player, cfg).action).toBe('dive');
    expect(slidePlayer(high(), cfg).action).toBe('dive');
    expect(slidePlayer(sliding(), cfg).action).toBe('slide');
  });
});

describe('stepPlayer', () => {
  it('stays grounded and counts landTimer', () => {
    const r = stepPlayer(initialPlayer(), 0.5, cfg);
    expect(r.player.grounded).toBe(true);
    expect(r.player.landTimer).toBeCloseTo(0.5);
    expect(r).toMatchObject({ landed: false, autoJumped: false, slideStarted: false });
  });

  it('1단 jump: airtime ≈ 0.44s, apex ≈ 73px', () => {
    const { t, maxH, player } = runUntil(jumped(), cfg, (q) => q.grounded);
    expect(t).toBeGreaterThan(0.42);
    expect(t).toBeLessThan(0.46);
    expect(maxH).toBeGreaterThan(70);
    expect(maxH).toBeLessThan(75);
    expect(player).toMatchObject({ height: 0, vy: 0, level: 0, airTime: 0, landTimer: 0, lastTap: 'none' });
  });

  it('a slide lasts slideTime, ageing as it goes', () => {
    const s = sliding();
    const mid = stepPlayer(s, 0.3, cfg).player;
    expect(mid.sliding).toBe(true);
    expect(mid.slideTime).toBeCloseTo(0.25);
    expect(mid.slideAge).toBeCloseTo(0.3);
    const done = stepPlayer(s, 0.6, cfg).player;
    expect(done).toMatchObject({ sliding: false, slideTime: 0, slideAge: 0, grounded: true });
  });

  it('reports landed exactly once per jump', () => {
    let p = jumped();
    let landedCount = 0;
    for (let i = 0; i < 240; i++) {
      const r = stepPlayer(p, DT, cfg);
      if (r.landed) landedCount++;
      p = r.player;
    }
    expect(landedCount).toBe(1);
  });

  it('auto-jumps on landing when a tap was buffered (tap beats a pending slide)', () => {
    const p: PlayerState = { ...initialPlayer(), grounded: false, level: 2, height: 3, vy: -600, pendingSlide: true };
    const r = stepPlayer(tapPlayer(p, cfg).player, 0.02, cfg);
    expect(r).toMatchObject({ landed: true, autoJumped: true, slideStarted: false });
    expect(r.player).toMatchObject({ grounded: false, level: 1, buffer: 0, lastTap: 'jump', sliding: false });
  });

  it('is robust to large dt (sub-steps)', () => {
    const p = jumped();
    const big = stepPlayer(p, 0.25, cfg).player;
    const small = runUntil(p, cfg, () => false, 0.25 - DT / 2).player;
    expect(Math.abs(big.height - small.height)).toBeLessThan(3);
    const land = stepPlayer(p, 1.0, cfg);
    expect(land.landed).toBe(true);
    expect(land.player.landTimer).toBeGreaterThan(0.5);
    const dive = stepPlayer(swipePlayer(high(), 'down', cfg).player, 1.0, cfg);
    expect(dive.slideStarted).toBe(true);
    expect(dive.player.sliding).toBe(false); // the whole slide fits in that one long step
  });

  it('ignores non-positive dt', () => {
    const p = jumped();
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


describe('v4 review fixes', () => {
  it('CLEAR_H matches the drawn floor fence (24px)', () => {
    expect(CLEAR_H).toBe(24);
  });
});
