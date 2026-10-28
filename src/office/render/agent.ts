// Office build stand-in for src/render/agent.ts (build/office-swaps.ts): the hero is drawn from comic
// frames (hero-<skin>-<frame>.webp, office spec §8; art contract: 512×640, feet bottom-centre, facing right)
// chosen by heroPose() — run cycle locked to the scroll, take-off stretch, landing squash + dust, 2단 spin,
// 3단 glide, slide in/out (v2 F3/F4); the lane change is a lean. Frames are never mirrored.
// Same position, size and shadow as the v8 figure. Until a frame has loaded (or for the escort), the v8
// rig is drawn instead.
import type { Mood } from '../../types';
import { AgentPainter as V8AgentPainter, type AgentFrame } from '../../render/agent';
import { cueAge } from '../../render/cues';
import { RIG_SIZE } from '../../render/rig';
import type { Ctx } from '../../render/util';
import { frameFallbacks, heroLean, heroPose, type HeroFrameId, type PoseCtx } from './hero-frames';
import { officeImage } from './images';

export * from '../../render/agent';

/** drawn hero height in rig px for the 640 px frame (the v8 figure is 88 rig px tall; subjects fill ~610 px) */
const HERO_H = 92;
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

  /** reused pose input (no per-frame allocation) */
  private readonly poseCtx: Mutable<PoseCtx> = {
    running: true, hitAge: Infinity, win: false, scroll: 0, landAge: Infinity, jumpAge: Infinity, boostAge: Infinity,
    runFrames: 4, art: (frame) => officeImage(heroName(this.skin, frame)) !== null,
  };
  private skin: 'kid' | 'cat' = 'kid';

  draw(ctx: Ctx, f: AgentFrame): void {
    if (f.mood === 'hurt' && this.prevMood !== 'hurt') this.hitStart = f.t;
    this.prevMood = f.mood;
    this.skin = f.id === 'cat' ? 'cat' : 'kid';
    const c = this.poseCtx;
    c.running = f.running;
    c.hitAge = Math.min(cueAge('hit'), f.mood === 'hurt' ? f.t - this.hitStart : Infinity);
    c.win = f.mood === 'cheer';
    c.scroll = f.scroll;
    c.landAge = cueAge('land');
    c.jumpAge = cueAge('jump');
    c.boostAge = cueAge('boost');
    c.runFrames = c.art('run8') && c.art('run5') ? 8 : 4;
    const pose = heroPose(f.p, c);
    const img = f.civilian ? null : this.image(pose.frame);
    if (!img) {
      this.v8.draw(ctx, f);
      return;
    }
    const s = f.scale * RIG_SIZE;
    const h = HERO_H * s;
    const w = (h * img.naturalWidth) / img.naturalHeight;
    const reduced = f.reduced === true;
    const feetY = f.floorY - f.p.height * f.depth;
    if (pose.dust > 0 && !reduced) dust(ctx, f.x, f.floorY, s, pose.dust);
    if (f.p.sliding && !reduced) slideStreaks(ctx, f.x, f.floorY, s, f.t);
    ctx.save();
    ctx.translate(f.x, feetY);
    const lean = reduced ? 0 : heroLean(f.p);
    if (lean !== 0) ctx.rotate(lean);
    // squash / stretch around the feet, spin around the body centre (F4)
    if (!reduced) ctx.scale(pose.sx, pose.sy);
    if (pose.rot !== 0 && !reduced) {
      ctx.translate(0, -h / 2);
      ctx.rotate(pose.rot);
      ctx.translate(0, h / 2);
    }
    if (f.blink) ctx.globalAlpha *= 0.55 + 0.45 * Math.abs(Math.sin(f.t * Math.PI * 10));
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  /** the loaded image for a pose frame: the frame itself, its base frame, then any loaded frame */
  private image(frame: string): HTMLImageElement | null {
    const own = officeImage(heroName(this.skin, frame));
    if (own) return own;
    for (const k of frameFallbacks(baseFrame(frame))) {
      const img = officeImage(heroName(this.skin, k));
      if (img) return img;
    }
    return null;
  }
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** animation frames fall back to the base set: jumpN → jump, slideN → slide, hitN → hit, run5..8 → run1..4 */
function baseFrame(frame: string): HeroFrameId {
  if (frame.startsWith('jump')) return 'jump';
  if (frame.startsWith('slide')) return 'slide';
  if (frame.startsWith('hit')) return 'hit';
  const n = /^run(\d)$/.exec(frame);
  if (n) return `run${((Number(n[1]) - 1) % 4) + 1}` as HeroFrameId;
  return (frame === 'hit' || frame === 'win' ? frame : 'run1') as HeroFrameId;
}

/** file names per skin and frame, built once (no string building per frame) */
const NAMES = { kid: new Map<string, string>(), cat: new Map<string, string>() };
function heroName(skin: 'kid' | 'cat', frame: string): string {
  let n = NAMES[skin].get(frame);
  if (!n) {
    n = `hero-${skin}-${frame}`;
    NAMES[skin].set(frame, n);
  }
  return n;
}

/** landing dust: three soft puffs spreading from the feet */
function dust(ctx: Ctx, x: number, floorY: number, s: number, k: number): void {
  const spread = (1 - k) * 18 * s;
  ctx.save();
  ctx.fillStyle = 'rgba(235,228,220,0.9)';
  for (let i = -1; i <= 1; i++) {
    ctx.globalAlpha = 0.55 * k;
    ctx.beginPath();
    ctx.ellipse(x + i * (8 * s + spread), floorY - 2 * s, (5 + 4 * (1 - k)) * s, (2.5 + 2 * (1 - k)) * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** F11: a slide reads as speed — white streaks trailing behind the low hero, not an impact puff */
function slideStreaks(ctx: Ctx, x: number, floorY: number, s: number, t: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const y = floorY - (6 + i * 7) * s;
    const run = ((t * 14 + i * 0.37) % 1) * 10 * s;
    const len = (18 + (i % 2) * 10) * s;
    ctx.globalAlpha = 0.7 - i * 0.12;
    ctx.lineWidth = (2 - i * 0.3) * s;
    ctx.beginPath();
    ctx.moveTo(x - 30 * s - run, y);
    ctx.lineTo(x - 30 * s - run - len, y);
    ctx.stroke();
  }
  ctx.restore();
}
