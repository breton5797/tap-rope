import { describe, expect, it } from 'vitest';
import { AgentPainter, type AgentFrame } from '../../src/render/agent';
import { initialPlayer } from '../../src/core/physics';
import { drawHead } from '../../src/render/rig-head';
import { newPose } from '../../src/render/rig-skeleton';
import { lookFor, tintLook } from '../../src/render/skins';
import type { Ctx } from '../../src/render/util';

/** records every colour the head paints with (fill / stroke styles and gradient stops) */
function recordingCtx(): { ctx: Ctx; colours: string[] } {
  const colours: string[] = [];
  const gradient = { addColorStop: (_: number, c: string) => colours.push(c.toLowerCase()) };
  const target: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over' };
  const ctx = new Proxy(target, {
    get: (t, k: string) => (k in t ? t[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => gradient : () => undefined),
    set: (t, k: string, v) => {
      if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string') colours.push(v.toLowerCase());
      t[k] = v;
      return true;
    },
  }) as unknown as Ctx;
  return { ctx, colours };
}

describe('cosmetic colour variant (v8 A5)', () => {
  const kid = lookFor('kid');

  it('tints the accent and the lens bloom, keeping the bloom position', () => {
    const t = tintLook(kid, '#ffb347');
    expect(t.accent).toBe('#ffb347');
    expect(t.glow?.color).toBe('#ffb347');
    expect(t.glow?.x).toBe(kid.glow?.x);
    expect(kid.accent).toBe('#7CFF6A'); // the shared base look is never mutated
  });

  it('the tinted look reaches the head paint (lens + bloom), the default green does not', () => {
    const { ctx, colours } = recordingCtx();
    drawHead(ctx, newPose(), tintLook(kid, '#ffb347'), true);
    expect(colours).toContain('#ffb347');
    expect(colours.some((c) => c.startsWith('#7cff6a'))).toBe(false);
  });

  it('ignores a malformed tint (the bloom needs #RRGGBB)', () => {
    expect(tintLook(kid, 'amber')).toBe(kid);
  });
});

describe('cosmetic ghost-trail colour (v8 A5)', () => {
  /** draws the agent through a lane switch (ghosts sample while the switch animates) */
  function laneSwitch(trail: string | null, fever: boolean): string[] {
    const { ctx, colours } = recordingCtx();
    const painter = new AgentPainter();
    for (let i = 0; i < 12; i++) {
      const p = { ...initialPlayer(), lane: 2 as const, laneFrom: 1 as const, laneAge: i * 0.01 };
      const f: AgentFrame = {
        x: 108, id: 'kid', p, mood: 'idle', t: 1 + i / 60, scroll: i * 4, running: true, blink: false, torch: false,
        scale: 1, floorY: 470, depth: 1, lean: 0, rim: '#ffffff', fever, reduced: false, tint: null, trail,
      };
      painter.draw(ctx, f);
    }
    return colours;
  }

  it('a lane-switch ghost trail takes the equipped colour', () => {
    expect(laneSwitch('#b48cff', false)).toContain('#b48cff');
    expect(laneSwitch(null, false)).not.toContain('#b48cff');
  });

  it('overdrive keeps its amber trail', () => {
    expect(laneSwitch('#b48cff', true)).not.toContain('#b48cff');
  });
});
