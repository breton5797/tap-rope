// The operative (and the escorted scientist): picks a rig pose from the player state and draws it
// (GDD-v6 §3). Run cycle locked to the scroll, leap / tucked front flip (2단) / piked somersault
// (3단), fast-fall dive, knee slide, landing absorb, idle breathing, hit recoil, lane-change lean.
import type { Mood, PlayerState } from '../types';
import { applyHurt, applyLand, drawRig, newPose, poseAir, poseIdle, poseRun, poseSlide, STRIDE, type Paint } from './rig';
import { lookFor, type LookId } from './skins';
import { clamp, oval, type Ctx } from './util';

const SPIN_2 = 0.46;
const SPIN_3 = 0.58;

export interface AgentFrame {
  readonly x: number;
  readonly id: LookId;
  readonly p: PlayerState;
  readonly mood: Mood;
  readonly t: number;
  readonly scroll: number;
  readonly running: boolean;
  readonly blink: boolean;
  readonly torch: boolean;
  /** final drawing scale (rig scale × lane depth scale) */
  readonly scale: number;
  /** screen y of the floor under the figure (its lane's floor line) */
  readonly floorY: number;
  /** lane depth scale, applied to the jump height */
  readonly depth: number;
  /** radians of lean while switching lanes */
  readonly lean: number;
  /** scene rim-light colour */
  readonly rim: string;
}

export class AgentPainter {
  private prevLevel = 0;
  private spinStart = -1;
  private readonly pose = newPose();
  /** reused paint settings (no per-frame allocation) */
  private readonly paint: Paint = { look: lookFor('kid'), rim: '', torch: false };

  /** Contact shadow on the floor plane (floorY = the lane's floor line). */
  shadow(ctx: Ctx, x: number, floorY: number, height: number, sliding: boolean, scale: number): void {
    const f = scale / (1 + height / 70);
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.45 * Math.min(1, f);
    oval(ctx, x + (sliding ? 8 * scale : 0), floorY + 1, (sliding ? 30 : 15) * f, 3.6 * f);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  draw(ctx: Ctx, f: AgentFrame): void {
    const { p, t } = f;
    if (p.level >= 2 && p.level !== this.prevLevel) this.spinStart = t;
    if (p.grounded) this.spinStart = -1;
    this.prevLevel = p.level;
    const pose = this.pose;
    if (p.sliding) {
      poseSlide(pose, p.slideAge);
    } else if (!p.grounded) {
      const dur = p.level >= 3 ? SPIN_3 : SPIN_2;
      const spin = this.spinStart >= 0 ? clamp((t - this.spinStart) / dur, 0, 1) : 1;
      poseAir(pose, p.level, p.vy, spin, p.pendingSlide);
    } else if (f.running) {
      poseRun(pose, (f.scroll / STRIDE) * Math.PI * 2);
      applyLand(pose, p.landTimer < 0.16 ? 1 - p.landTimer / 0.16 : 0);
    } else {
      poseIdle(pose, t);
    }
    if (f.mood === 'hurt') applyHurt(pose, t);
    ctx.save();
    ctx.translate(f.x, f.floorY - p.height * f.depth);
    if (f.lean !== 0) ctx.rotate(f.lean);
    ctx.scale(f.scale, f.scale);
    if (f.blink && Math.sin(t * 30) > 0) ctx.globalAlpha = 0.45;
    const paint = this.paint;
    paint.look = lookFor(f.id);
    paint.rim = f.rim;
    paint.torch = f.torch;
    drawRig(ctx, pose, paint);
    ctx.restore();
    if (p.sliding) this.dust(ctx, f);
  }

  /** A low skid of grey dust behind a knee slide. */
  private dust(ctx: Ctx, f: AgentFrame): void {
    const k = clamp(f.p.slideAge * 6, 0, 1);
    ctx.fillStyle = '#9A9590';
    for (let i = 0; i < 5; i++) {
      const u = (f.t * 2.4 + i / 5) % 1;
      ctx.globalAlpha = (1 - u) * 0.22 * k;
      oval(ctx, f.x - (14 + u * 34) * f.scale, f.floorY - (1 + u * 4) * f.scale, (3 + u * 7) * f.scale, (1.6 + u * 2.4) * f.scale);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
