// The chibi jumper seen from above (~60° down): crown-dominant head with the face as a
// lower band, wide shoulders, feet peeking out. Squash & stretch, 3단 spin, 덤블링
// somersault, 엇걸어 crossed arms and solo rope handles.
import { LANE_W, type RenderSnapshot, type SkinId } from '../types';
import { drawArm, drawLower, drawShoulders, HEAD_CY, OUTLINE, SHOULDER_X, SHOULDER_Y } from './chibi';
import { drawMoodFx } from './face';
import { drawHead, drawHeadBack } from './heads';
import { groundRy, groundY, project, screenX } from './projection';
import { drawTail, lookFor, type SkinLook } from './skins';
import { circle, clamp, oval, radGrad, roundRect, TAU, type Ctx } from './util';

const BODY_CY = -20;
const FLIP_TIME = 0.5;
const TUMBLE_TIME = 0.62;

interface Pose {
  sx: number;
  sy: number;
  rot: number;
  tuck: number;
  /** local hand position of the right hand; the left mirrors it */
  hx: number;
  hy: number;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export class PlayerPainter {
  /** screen position of the feet this frame (for effects / popups) */
  feetX = 180;
  feetY = 454;
  private prevLevel = 0;
  private crossed = false;
  private flipStart = -1;
  private readonly pose: Pose = { sx: 1, sy: 1, rot: 0, tuck: 0, hx: 17, hy: -6 };
  private shieldGrad: CanvasGradient | null = null;
  private readonly pt = new Float32Array(3);
  /** solo rope: screen positions of the two hands (set by the renderer), NaN = free */
  readonly hands = new Float32Array([Number.NaN, 0, Number.NaN, 0]);

  drawShadow(ctx: Ctx, laneX: number, height: number): void {
    const f = 1 / (1 + height / 60);
    ctx.fillStyle = `rgba(20,12,40,${(0.28 * f).toFixed(3)})`;
    oval(ctx, screenX(laneX * LANE_W, 0), groundY(0) - 1, 20 * f, groundRy(0, 16) * f);
    ctx.fill();
  }

  draw(ctx: Ctx, snap: RenderSnapshot): void {
    const p = snap.player;
    const t = snap.realTime;
    project(p.laneX * LANE_W, 0, p.height, this.pt);
    this.feetX = this.pt[0];
    this.feetY = this.pt[1];
    this.trackFlip(p.level, p.grounded, t, snap.rope.mode === 'solo');
    this.crossed = p.cross;
    this.computePose(snap);
    const pose = this.pose;
    const look = lookFor(snap.skin);
    ctx.save();
    ctx.translate(this.feetX, this.feetY);
    if (snap.invulnerable && Math.sin(t * 30) > 0) ctx.globalAlpha = 0.35;
    ctx.scale(pose.sx, pose.sy);
    if (pose.rot !== 0) {
      ctx.translate(0, BODY_CY);
      ctx.rotate(pose.rot);
      ctx.translate(0, -BODY_CY);
    }
    drawTail(ctx, snap.skin, t, !p.grounded);
    drawLower(ctx, look, pose.tuck);
    drawHeadBack(ctx, snap.skin, t, p.vy);
    drawShoulders(ctx, look);
    this.arms(ctx, look);
    drawHead(ctx, snap.skin, snap.mood, t);
    drawMoodFx(ctx, snap.mood, t, 0, HEAD_CY + 4);
    ctx.restore();
    if (!p.grounded && p.level === 3 && snap.rope.mode === 'solo') this.spinCue(ctx, t);
    if (snap.shield) this.shield(ctx, t);
  }

  /** Re-draw the solo-rope fists over the rope ends. */
  drawHandsOver(ctx: Ctx, skin: SkinId): void {
    if (Number.isNaN(this.hands[0])) return;
    const look = lookFor(skin);
    for (let i = 0; i < 2; i++) this.fist(ctx, this.hands[i * 2], this.hands[i * 2 + 1], look);
  }

  /** 엇걸어: the rope crosses in an X in front of the belly (solo rope only). */
  drawCrossX(ctx: Ctx, main: string, dark: string): void {
    if (Number.isNaN(this.hands[0])) return;
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? dark : main;
      ctx.lineWidth = pass === 0 ? 5.6 : 3.4;
      ctx.beginPath();
      for (let i = 0; i < 2; i++) {
        const hx = this.hands[i * 2];
        const hy = this.hands[i * 2 + 1];
        const ex = this.feetX + (hx < this.feetX ? 15 : -15);
        ctx.moveTo(hx, hy);
        ctx.quadraticCurveTo((hx + ex) / 2, hy + 4, ex, this.feetY - 2);
      }
      ctx.stroke();
    }
  }

  private fist(ctx: Ctx, x: number, y: number, look: SkinLook): void {
    ctx.fillStyle = '#C98A4B';
    roundRect(ctx, x - 2.2, y - 2, 4.4, 9, 2.2);
    ctx.fill();
    ctx.fillStyle = look.limb;
    circle(ctx, x, y, 3.2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private trackFlip(level: number, grounded: boolean, t: number, solo: boolean): void {
    if (level === 3 && this.prevLevel !== 3 && !solo) this.flipStart = t;
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
      pose.sx = 1 + 0.18 * q;
      pose.sy = 1 - 0.2 * q + 0.015 * Math.sin(t * 3.2);
      pose.tuck = 0.3 * q;
      this.setHands(17 + q * 3, -6 + Math.sin(t * 3) * 0.6);
      if (snap.mood === 'cheer') this.setHands(20, -32 + Math.sin(t * 12) * 3);
    } else {
      const st = clamp(p.vy / 700, -1, 1);
      const stretch = st > 0 ? 0.12 * st : 0.05 * -st;
      pose.sy = 1 + stretch;
      pose.sx = 1 - stretch * 0.6;
      const apex = clamp(1 - Math.abs(p.vy) / 650, 0, 1);
      pose.tuck = p.level >= 2 || p.tumble ? 0.5 + 0.5 * apex : 0.2 + 0.15 * apex;
      if (p.level === 1) this.setHands(21, -24);
      else if (p.level === 2) this.setHands(9, -5);
      else this.setHands(18, -40);
      this.airSpin(snap);
    }
    if (snap.mood === 'hurt') this.setHands(21, -18 + Math.sin(t * 22) * 5);
  }

  private setHands(hx: number, hy: number): void {
    this.pose.hx = hx;
    this.pose.hy = hy;
  }

  private airSpin(snap: RenderSnapshot): void {
    const p = snap.player;
    const pose = this.pose;
    if (p.tumble) {
      const f = clamp(p.airTime / TUMBLE_TIME, 0, 1);
      pose.rot = -smoothstep(f) * TAU;
      pose.sy *= 1 - 0.18 * Math.sin(f * Math.PI);
      pose.tuck = 1;
      this.setHands(8, -6);
    } else if (this.flipStart >= 0) {
      const f = clamp((snap.realTime - this.flipStart) / FLIP_TIME, 0, 1);
      pose.rot = f < 1 ? -smoothstep(f) * TAU : 0;
    }
  }

  private arms(ctx: Ctx, look: SkinLook): void {
    const solo = !Number.isNaN(this.hands[0]) && this.pose.rot === 0;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const sx = s * SHOULDER_X;
      let hx = s * this.pose.hx;
      let hy = this.pose.hy;
      if (solo) {
        hx = (this.hands[i * 2] - this.feetX) / this.pose.sx;
        hy = (this.hands[i * 2 + 1] - this.feetY) / this.pose.sy;
      } else if (this.crossed) {
        hx = -s * 8;
        hy = -8;
      }
      drawArm(ctx, look, sx, SHOULDER_Y + 1, hx, hy, !solo);
    }
  }

  /** 3단 on a solo rope: a whoosh ring around the kid instead of a flip. */
  private spinCue(ctx: Ctx, t: number): void {
    ctx.save();
    ctx.translate(this.feetX, this.feetY - 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const a = t * 14 + i * Math.PI;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 11, 0, a, a + 1.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  private shield(ctx: Ctx, t: number): void {
    if (!this.shieldGrad) {
      this.shieldGrad = radGrad(ctx, -8, -10, 4, 38, [[0, 'rgba(160,240,255,0.05)'], [0.7, 'rgba(90,200,255,0.18)'], [1, 'rgba(90,200,255,0.45)']]);
    }
    const r = 31 + Math.sin(t * 4) * 1.2;
    ctx.save();
    ctx.translate(this.feetX, this.feetY - 22);
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
