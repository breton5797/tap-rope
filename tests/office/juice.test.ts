// Office v2.1 pickup / action FX (src/office/render/juice.ts): pooled particles, rings and flying icons.
import { describe, expect, it } from 'vitest';
import { BURSTS, Juice, PARTICLES, flyPoint, pickupFromPopup, takeoffRing } from '../../src/office/render/juice';
import { COPY } from '../../src/flavor';

describe('juice plans', () => {
  it('take-off rings grow with the jump level', () => {
    const r = [1, 2, 3].map((l) => takeoffRing(l));
    expect(r[1].radius).toBeGreaterThan(r[0].radius);
    expect(r[2].radius).toBeGreaterThan(r[1].radius);
    expect(r[2].width).toBeGreaterThan(r[0].width);
    for (const x of r) expect(x.life).toBeLessThanOrEqual(0.4);
  });

  it('has a burst for every pickup and action, short-lived and small', () => {
    for (const k of ['coin', 'heart', 'star', 'pop', 'sparkle', 'heel', 'streak'] as const) {
      expect(BURSTS[k].count).toBeGreaterThan(0);
      expect(BURSTS[k].count).toBeLessThanOrEqual(16);
      expect(BURSTS[k].life).toBeLessThanOrEqual(1.2);
    }
  });

  it('a flying icon starts at the pickup, arcs up and lands on the HUD target', () => {
    const from = { x: 100, y: 400 };
    const to = { x: 300, y: 40 };
    const out = { x: 0, y: 0 };
    flyPoint(from, to, 0, out);
    expect(out).toEqual({ x: 100, y: 400 });
    flyPoint(from, to, 1, out);
    expect(out.x).toBeCloseTo(300, 9);
    expect(out.y).toBeCloseTo(40, 9);
    flyPoint(from, to, 0.5, out);
    expect(out.y).toBeLessThan((400 + 40) / 2);
  });

  it('reads the power-up kind from its popup copy', () => {
    expect(pickupFromPopup(COPY.pickupShield)).toBe('shield');
    expect(pickupFromPopup(COPY.pickupSlow)).toBe('slow');
    expect(pickupFromPopup(COPY.pickupHeart)).toBe('heart');
    expect(pickupFromPopup('PERFECT')).toBeNull();
  });
});

describe('Juice pool', () => {
  it('never grows past its capacity and frees particles after their life', () => {
    const j = new Juice();
    for (let i = 0; i < 100; i++) j.burst('coin', 100, 100, false);
    expect(j.live()).toBeLessThanOrEqual(PARTICLES);
    j.update(BURSTS.coin.life + 0.5);
    expect(j.live()).toBe(0);
  });

  it('reduced motion spawns fewer particles', () => {
    const a = new Juice();
    const b = new Juice();
    a.burst('star', 0, 0, false);
    b.burst('star', 0, 0, true);
    expect(b.live()).toBeLessThan(a.live());
  });

  it('a flyer arrives after its flight time and reports its target', () => {
    const j = new Juice();
    const arrived: string[] = [];
    j.fly('pickup-coin', { x: 0, y: 0 }, { x: 10, y: 10 }, 'coin', (t) => arrived.push(t));
    j.update(0.1);
    expect(arrived).toEqual([]);
    j.update(1);
    expect(arrived).toEqual(['coin']);
    expect(j.flyers()).toBe(0);
  });
});

describe('JuiceFx (wrapped effects)', () => {
  it('passes every call to the v8 effects and turns pickups / actions into juice on the next frame', async () => {
    const { JuiceFx } = await import('../../src/office/render/juice-fx');
    const { initialPlayer } = await import('../../src/core/physics');
    const { computeView } = await import('../../src/office/render/view');
    const calls: string[] = [];
    const inner = {
      burst: (k: string) => calls.push(`burst:${k}`), popup: (t: string) => calls.push(`popup:${t}`),
      shake: () => calls.push('shake'), flash: () => calls.push('flash'),
      impact: (k: string) => calls.push(`impact:${k}`), update: () => calls.push('update'),
    };
    const fx = new JuiceFx();
    const api = fx.wrap(inner as never);
    api.burst('coin');
    api.popup(COPY.pickupHeart, 'info');
    api.impact('jump', { level: 3 });
    api.shake(0.5);
    expect(calls).toEqual(['burst:coin', `popup:${COPY.pickupHeart}`, 'impact:jump', 'shake']);
    // a canvas stand-in: every method is a no-op
    const ctx = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop: () => undefined }) : () => undefined), set: () => true }) as never;
    const snap = { realTime: 1, reducedMotion: false, player: initialPlayer(), shield: false, slowMo: false, running: true } as never;
    const hud = { coin: { x: 300, y: 20 }, chip: { x: Number.NaN, y: Number.NaN } };
    fx.frame(ctx, computeView(390, 844, 2), snap, hud);
    const juice = (fx as unknown as { juice: { live(): number; flyers(): number } }).juice;
    expect(juice.live()).toBeGreaterThan(10); // coin sparkle + rising hearts
    expect(juice.flyers()).toBe(1); // the coin flying to the counter
  });
});
