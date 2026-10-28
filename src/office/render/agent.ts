// Office build stand-in for src/render/agent.ts (build/office-swaps.ts): the hero is drawn from comic
// frames (hero-<skin>-<frame>.webp, office spec §8) chosen by heroFrame(); the lane change is a lean.
// Same position, size and shadow as the v8 figure. Until a frame has loaded (or for the escort), the v8
// rig is drawn instead.
import type { Mood } from '../../types';
import { AgentPainter as V8AgentPainter, type AgentFrame } from '../../render/agent';
import { cueAge } from '../../render/cues';
import { RIG_SIZE } from '../../render/rig';
import type { Ctx } from '../../render/util';
import { heroFrame, heroLean, type HeroFrameId } from './hero-frames';
import { officeImage } from './images';

export * from '../../render/agent';

/** drawn hero height in rig px for the 640 px frame (the v8 figure is 88 rig px tall; subjects fill ~610 px) */
const HERO_H = 92;
/**
 * Where the feet sit in each frame (fractions of the image). Art contract: 512×640, transparent, subject
 * horizontally centred with its lowest pixel on the bottom edge, every frame facing right; all frames share
 * one pixel scale, so they are drawn at the same size (the jump frame is lifted by the physics height).
 */
const ANCHOR: Readonly<Record<HeroFrameId, readonly [number, number]>> = {
  run1: [0.5, 1], run2: [0.5, 1], run3: [0.5, 1], run4: [0.5, 1],
  jump: [0.5, 1], slide: [0.5, 1], hit: [0.5, 1], win: [0.5, 1],
};

/** scales the v8 contact shadow (peak 0.62) to ~0.25 */
const SHADOW_ALPHA = 0.4;

export class AgentPainter {
  private readonly v8 = new V8AgentPainter();
  private prevMood: Mood = 'idle';
  private hitStart = Number.NEGATIVE_INFINITY;

  shadow(ctx: Ctx, x: number, floorY: number, height: number, sliding: boolean, scale: number): void {
    // the v8 contact shadow peaks at 0.62 alpha; the comic hero gets ~0.25
    ctx.save();
    ctx.globalAlpha *= SHADOW_ALPHA;
    this.v8.shadow(ctx, x, floorY, height, sliding, scale);
    ctx.restore();
  }

  draw(ctx: Ctx, f: AgentFrame): void {
    if (f.mood === 'hurt' && this.prevMood !== 'hurt') this.hitStart = f.t;
    this.prevMood = f.mood;
    const skin = f.id === 'cat' ? 'cat' : 'kid';
    const hitAge = Math.min(cueAge('hit'), f.mood === 'hurt' ? f.t - this.hitStart : Infinity);
    const frame = heroFrame(f.p, f.t, { running: f.running, hitAge, win: f.mood === 'cheer' });
    const img = f.civilian ? null : officeImage(`hero-${skin}-${frame}`);
    if (!img) {
      this.v8.draw(ctx, f);
      return;
    }
    const s = f.scale * RIG_SIZE;
    const h = HERO_H * s;
    const w = (h * img.naturalWidth) / img.naturalHeight;
    const [ax, ay] = ANCHOR[frame];
    ctx.save();
    ctx.translate(f.x, f.floorY - f.p.height * f.depth);
    const lean = f.reduced ? 0 : heroLean(f.p);
    if (lean !== 0) ctx.rotate(lean);
    if (f.blink) ctx.globalAlpha *= 0.55 + 0.45 * Math.abs(Math.sin(f.t * Math.PI * 10));
    ctx.drawImage(img, -w * ax, -h * ay, w, h);
    ctx.restore();
  }
}
