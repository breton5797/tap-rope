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

/** drawn hero height in rig px (the v8 figure is 88 rig px tall); frames are 512×640 with the feet at the bottom */
const HERO_H = 92;
/** where the feet sit in each frame (fractions of the image) */
const ANCHOR: Readonly<Record<HeroFrameId, readonly [number, number]>> = {
  run1: [0.5, 0.97], run2: [0.5, 0.97], run3: [0.5, 0.97], run4: [0.5, 0.97],
  jump: [0.5, 0.95], slide: [0.5, 0.97], hit: [0.5, 0.97], win: [0.5, 0.97],
};
/** a slide frame is drawn shorter (the hero is low) */
const SLIDE_H = 0.62;

export class AgentPainter {
  private readonly v8 = new V8AgentPainter();
  private prevMood: Mood = 'idle';
  private hitStart = Number.NEGATIVE_INFINITY;

  shadow(ctx: Ctx, x: number, floorY: number, height: number, sliding: boolean, scale: number): void {
    this.v8.shadow(ctx, x, floorY, height, sliding, scale);
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
    const h = HERO_H * s * (frame === 'slide' ? SLIDE_H : 1);
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
