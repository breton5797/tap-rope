// The chibi jumper seen from above-front: foreshortened body, big head showing the crown,
// squash & stretch, 3단 spin, 덤블링 somersault, 엇걸어 crossed arms, solo rope handles.
import { LANE_W, type RenderSnapshot, type SkinId } from '../types';
import { drawMoodFx } from './face';
import { drawHead, drawHeadBack, HEAD_Y } from './heads';
import { groundRy, groundY, HEIGHT_K, project, screenX } from './projection';
import { drawBodyBack, drawChest, lookFor, type SkinLook } from './skins';
import { circle, clamp, oval, radGrad, roundRect, TAU, vGrad, type Ctx } from './util';

const OUTLINE = 'rgba(40,22,55,0.6)';
const BODY_CY = -24;
const FLIP_TIME = 0.5;
const TUMBLE_TIME = 0.62;
const K = HEIGHT_K;

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
  /** screen position of the feet this frame (for effects / popups) */
  feetX = 180;
  feetY = 454;
  private prevLevel = 0;
  private flipStart = -1;
  private readonly pose: Pose = { sx: 1, sy: 1, rot: 0, tuck: 0, arm: 0 };
  private readonly torsoGrad = new Map<SkinId, CanvasGradient>();
  private shieldGrad: CanvasGradient | null = null;
  private readonly pt = new Float32Array(3);
  /** solo rope: screen positions of the two hands (set by the renderer), NaN = free */
  readonly hands = new Float32Array([Number.NaN, 0, Number.NaN, 0]);

  drawShadow(ctx: Ctx, laneX: number, height: number): void {
    const f = 1 / (1 + height / 60);
    ctx.fillStyle = `rgba(20,12,40,${(0.26 * f).toFixed(3)})`;
    oval(ctx, screenX(laneX * LANE_W, 0), groundY(0), 19 * f, groundRy(0, 15) * f);
    ctx.fill();
  }

  draw(ctx: Ctx, snap: RenderSnapshot): void {
    const p = snap.player;
    const t = snap.realTime;
    project(p.laneX * LANE_W, 0, p.height, this.pt);
    this.feetX = this.pt[0];
    this.feetY = this.pt[1];
    this.trackFlip(p.level, p.grounded, t, snap.rope.mode === 'solo');
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
    ctx.save();
    ctx.scale(1, K);
    drawBodyBack(ctx, snap.skin, t, !p.grounded);
    this.legs(ctx, look, pose.tuck);
    this.torso(ctx, snap.skin, look);
    drawChest(ctx, snap.skin, t);
    ctx.restore();
    this.arms(ctx, look, snap);
    ctx.translate(0, HEAD_Y * (K - 1) + 3);
    drawHeadBack(ctx, snap.skin, t, p.vy);
    drawHead(ctx, snap.skin, snap.mood, t);
    drawMoodFx(ctx, snap.mood, t, 0, HEAD_Y);
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
        ctx.quadraticCurveTo((hx + ex) / 2, hy + 4, ex, this.feetY - 3);
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
      pose.tuck = p.level >= 2 || p.tumble ? 0.45 + 0.55 * apex : 0.18 + 0.15 * apex;
      pose.arm = p.level === 1 ? 2.45 : p.level === 2 ? 1.55 : 2.85;
      this.airSpin(snap);
    }
    if (snap.mood === 'hurt') pose.arm = 1.3 + Math.sin(t * 22) * 0.5;
  }

  private airSpin(snap: RenderSnapshot): void {
    const p = snap.player;
    const pose = this.pose;
    if (p.tumble) {
      const f = clamp(p.airTime / TUMBLE_TIME, 0, 1);
      pose.rot = -smoothstep(f) * TAU;
      pose.sy *= 1 - 0.16 * Math.sin(f * Math.PI);
      pose.tuck = 1;
      pose.arm = 1.4;
    } else if (this.flipStart >= 0) {
      const f = clamp((snap.realTime - this.flipStart) / FLIP_TIME, 0, 1);
      pose.rot = f < 1 ? -smoothstep(f) * TAU : 0;
    }
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
      oval(ctx, fx + s * 1.2, fy + 0.6, 4.4, 3.4);
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

  private arms(ctx: Ctx, look: SkinLook, snap: RenderSnapshot): void {
    const sy = -27 * K;
    const solo = !Number.isNaN(this.hands[0]) && this.pose.rot === 0;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const sx = s * 8.6;
      let hx: number;
      let hy: number;
      if (solo) {
        hx = (this.hands[i * 2] - this.feetX) / this.pose.sx;
        hy = (this.hands[i * 2 + 1] - this.feetY) / this.pose.sy;
      } else if (snap.player.cross) {
        hx = -s * 7;
        hy = sy + 7;
      } else {
        const a = this.pose.arm;
        hx = sx + s * Math.sin(a) * 11.5;
        hy = sy + Math.cos(a) * 11.5 * K;
      }
      this.limb(ctx, look, sx, sy, hx, hy, !solo);
    }
  }

  private limb(ctx: Ctx, look: SkinLook, sx: number, sy: number, hx: number, hy: number, fist: boolean): void {
    ctx.lineCap = 'round';
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
    if (!fist) return;
    ctx.fillStyle = look.limb;
    circle(ctx, hx, hy, 3);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** 3단 on a solo rope: a whoosh ring around the kid instead of a flip. */
  private spinCue(ctx: Ctx, t: number): void {
    ctx.save();
    ctx.translate(this.feetX, this.feetY - 24);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const a = t * 14 + i * Math.PI;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 10, 0, a, a + 1.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  private shield(ctx: Ctx, t: number): void {
    if (!this.shieldGrad) {
      this.shieldGrad = radGrad(ctx, -8, -10, 4, 38, [[0, 'rgba(160,240,255,0.05)'], [0.7, 'rgba(90,200,255,0.18)'], [1, 'rgba(90,200,255,0.45)']]);
    }
    const r = 33 + Math.sin(t * 4) * 1.2;
    ctx.save();
    ctx.translate(this.feetX, this.feetY - 25);
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

