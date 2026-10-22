// The chibi jumper: pose from physics state, squash & stretch, 3단 flip, shield bubble.
import { GROUND_Y, PLAYER_X, type RenderSnapshot, type SkinId } from '../types';
import { drawMoodFx } from './face';
import { drawHead, drawHeadBack, HEAD_Y } from './heads';
import { drawBodyBack, drawChest, lookFor, type SkinLook } from './skins';
import { circle, clamp, oval, radGrad, roundRect, TAU, vGrad, type Ctx } from './util';

const OUTLINE = 'rgba(40,22,55,0.6)';
const BODY_CY = -26;
const FLIP_TIME = 0.5;

/** Mutable pose scratch (one per painter, reused each frame). */
interface Pose {
  sx: number;
  sy: number;
  rot: number;
  tuck: number;
  arm: number;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export class PlayerPainter {
  private prevLevel = 0;
  private flipStart = -1;
  private readonly pose: Pose = { sx: 1, sy: 1, rot: 0, tuck: 0, arm: 0 };
  private readonly torsoGrad = new Map<SkinId, CanvasGradient>();
  private shieldGrad: CanvasGradient | null = null;

  drawShadow(ctx: Ctx, height: number): void {
    const f = 1 / (1 + height / 70);
    ctx.fillStyle = `rgba(20,12,40,${(0.32 * f).toFixed(3)})`;
    oval(ctx, PLAYER_X, GROUND_Y + 1, 18 * f, 4.8 * f);
    ctx.fill();
  }

  draw(ctx: Ctx, snap: RenderSnapshot): void {
    const p = snap.player;
    const t = snap.realTime;
    this.trackFlip(p.level, p.grounded, t);
    this.computePose(snap);
    const pose = this.pose;
    ctx.save();
    ctx.translate(PLAYER_X, GROUND_Y - p.height);
    if (snap.invulnerable && Math.sin(t * 30) > 0) ctx.globalAlpha = 0.35;
    ctx.scale(pose.sx, pose.sy);
    if (pose.rot !== 0) {
      ctx.translate(0, BODY_CY);
      ctx.rotate(pose.rot);
      ctx.translate(0, -BODY_CY);
    }
    const look = lookFor(snap.skin);
    drawBodyBack(ctx, snap.skin, t, !p.grounded);
    this.legs(ctx, look, pose.tuck);
    this.torso(ctx, snap.skin, look);
    drawChest(ctx, snap.skin, t);
    this.arms(ctx, look, pose.arm);
    drawHeadBack(ctx, snap.skin, t, p.vy);
    drawHead(ctx, snap.skin, snap.mood, t);
    drawMoodFx(ctx, snap.mood, t, 0, HEAD_Y);
    ctx.restore();
    if (snap.shield) this.shield(ctx, p.height, t);
  }

  private trackFlip(level: number, grounded: boolean, t: number): void {
    if (level === 3 && this.prevLevel !== 3) this.flipStart = t;
    if (grounded) this.flipStart = -1;
    this.prevLevel = level;
  }

  private computePose(snap: RenderSnapshot): void {
    const p = snap.player;
    const t = snap.realTime;
    const pose = this.pose;
    pose.rot = 0;
    if (p.grounded) {
      const q = p.landTimer < 0.16 ? 1 - p.landTimer / 0.16 : 0;
      pose.sx = 1 + 0.2 * q;
      pose.sy = 1 - 0.24 * q + 0.015 * Math.sin(t * 3.2);
      pose.tuck = 0.35 * q;
      pose.arm = snap.mood === 'cheer' ? 2.6 + Math.sin(t * 12) * 0.25 : 0.32 + 0.05 * Math.sin(t * 3) + q * 0.6;
    } else {
      const st = clamp(p.vy / 700, -1, 1);
      const stretch = st > 0 ? 0.13 * st : 0.06 * -st;
      pose.sy = 1 + stretch;
      pose.sx = 1 - stretch * 0.6;
      const apex = clamp(1 - Math.abs(p.vy) / 650, 0, 1);
      pose.tuck = p.level >= 2 ? 0.45 + 0.55 * apex : 0.18 + 0.15 * apex;
      pose.arm = p.level === 1 ? 2.45 : p.level === 2 ? 1.55 : 2.85;
      if (this.flipStart >= 0) {
        const f = clamp((t - this.flipStart) / FLIP_TIME, 0, 1);
        pose.rot = f < 1 ? -smoothstep(f) * TAU : 0;
      }
    }
    if (snap.mood === 'hurt') pose.arm = 1.3 + Math.sin(t * 22) * 0.5;
  }

  private legs(ctx: Ctx, look: SkinLook, tuck: number): void {
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const hx = s * 4.2;
      const fx = s * (4 + tuck * 1.5);
      const fy = -1.5 - tuck * 9;
      const kx = s * (5.5 + tuck * 6);
      const ky = -7.5 - tuck * 7;
      ctx.beginPath();
      ctx.moveTo(hx, -12);
      ctx.quadraticCurveTo(kx, ky, fx, fy);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 6.4;
      ctx.stroke();
      ctx.strokeStyle = look.limb;
      ctx.lineWidth = 4.8;
      ctx.stroke();
      ctx.fillStyle = look.shoe;
      oval(ctx, fx + s * 1.2, fy + 0.6, 4.4, 2.8);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = look.pants;
    roundRect(ctx, -9, -16, 18, 7, 3);
    ctx.fill();
  }

  private torso(ctx: Ctx, id: SkinId, look: SkinLook): void {
    let g = this.torsoGrad.get(id);
    if (!g) {
      g = vGrad(ctx, -31, -10, [[0, look.shirt], [1, look.shirtDark]]);
      this.torsoGrad.set(id, g);
    }
    ctx.fillStyle = g;
    roundRect(ctx, -10, -31, 20, 20, 8);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    roundRect(ctx, -7.5, -28.5, 4, 11, 2);
    ctx.fill();
  }

  private arms(ctx: Ctx, look: SkinLook, a: number): void {
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const sx = s * 8.6;
      const sy = -27;
      const hx = sx + s * Math.sin(a) * 11.5;
      const hy = sy + Math.cos(a) * 11.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 6.2;
      ctx.stroke();
      ctx.strokeStyle = look.limb;
      ctx.lineWidth = 4.6;
      ctx.stroke();
      ctx.strokeStyle = look.shirt;
      ctx.lineWidth = 5.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (hx - sx) * 0.3, sy + (hy - sy) * 0.3);
      ctx.stroke();
      ctx.fillStyle = look.limb;
      circle(ctx, hx, hy, 3);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private shield(ctx: Ctx, height: number, t: number): void {
    if (!this.shieldGrad) {
      this.shieldGrad = radGrad(ctx, -8, -10, 4, 38, [[0, 'rgba(160,240,255,0.05)'], [0.7, 'rgba(90,200,255,0.18)'], [1, 'rgba(90,200,255,0.45)']]);
    }
    const r = 35 + Math.sin(t * 4) * 1.2;
    ctx.save();
    ctx.translate(PLAYER_X, GROUND_Y - height - 27);
    ctx.fillStyle = this.shieldGrad;
    circle(ctx, 0, 0, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,235,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r - 5, Math.PI * 1.1 + Math.sin(t) * 0.1, Math.PI * 1.35 + Math.sin(t) * 0.1);
    ctx.stroke();
    ctx.restore();
  }
}
