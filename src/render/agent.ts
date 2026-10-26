// The operative (and the escorted scientist): picks a rig pose from the player state and draws it
// (GDD-v6 §3). Agent: run cycle locked to the scroll, leap / tucked front flip (2단) / flip with
// arm drive and kick-out (3단), feet-first drop, knee slide, landing absorb, idle breathing, hit
// recoil. Civilian (escort): run, one hurdle for any jump, crouch-run under slides, stumble on hits.
import type { Mood, PlayerState } from '../types';
import { drawRig, newPose, STRIDE, type Paint, type Pose } from './rig';
import {
  applyLand, applyRecoil, applyStumble, hitCurve, poseAir, poseCivRun, poseCrouchRun, poseIdle, poseRun, poseSlide,
  poseVault,
} from './rig-poses';
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
  /** civilian motion set (the escorted scientist): no flips, no knee slides */
  readonly civilian?: boolean;
}

/** soft contact shadow: radial falloff in a unit circle, stretched per draw (built once) */
let shadowGrad: CanvasGradient | null = null;

function shadowFill(ctx: Ctx): CanvasGradient {
  if (!shadowGrad) {
    shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.62)');
    shadowGrad.addColorStop(0.45, 'rgba(0,0,0,0.38)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  }
  return shadowGrad;
}

export class AgentPainter {
  private prevLevel = 0;
  private spinStart = -1;
  private prevMood: Mood = 'idle';
  private hitStart = Number.NEGATIVE_INFINITY;
  private readonly pose = newPose();
  /** reused paint settings (no per-frame allocation) */
  private readonly paint: Paint = { look: lookFor('kid'), rim: '', torch: false };

  /** Soft, slightly elongated contact shadow on the floor plane (floorY = the lane's floor line). */
  shadow(ctx: Ctx, x: number, floorY: number, height: number, sliding: boolean, scale: number): void {
    const f = scale / (1 + height / 70);
    const a = Math.min(1, scale / (1 + height / 45));
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = shadowFill(ctx);
    ctx.translate(x + (sliding ? 6 * scale : 1.5 * scale), floorY + 0.5);
    ctx.scale((sliding ? 34 : 19) * f, 4.2 * f);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx: Ctx, f: AgentFrame): void {
    const { p, t } = f;
    if (f.mood === 'hurt' && this.prevMood !== 'hurt') this.hitStart = t;
    this.prevMood = f.mood;
    const hitAge = f.mood === 'hurt' ? t - this.hitStart : -1;
    const pose = this.pose;
    if (f.civilian) this.civilianPose(pose, f, hitCurve(hitAge));
    else this.agentPose(pose, f, hitAge);
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
    if (p.sliding && !f.civilian) this.dust(ctx, f);
  }

  private agentPose(pose: Pose, f: AgentFrame, hitAge: number): void {
    const { p, t } = f;
    if (p.level >= 2 && p.level !== this.prevLevel) this.spinStart = t;
    if (p.grounded) this.spinStart = -1;
    this.prevLevel = p.level;
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
    // no recoil mid-flip: the rotation already carries the motion
    if (pose.rot === 0 && hitAge >= 0) applyRecoil(pose, hitAge);
  }

  private civilianPose(pose: Pose, f: AgentFrame, hit: number): void {
    const { p } = f;
    const ph = (f.scroll / STRIDE) * Math.PI * 2;
    if (p.sliding) {
      poseCrouchRun(pose, ph);
    } else if (!p.grounded) {
      poseVault(pose, p.vy);
    } else if (f.running) {
      poseCivRun(pose, ph);
      applyLand(pose, p.landTimer < 0.2 ? 1 - p.landTimer / 0.2 : 0);
    } else {
      poseIdle(pose, f.t);
    }
    applyStumble(pose, hit);
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
