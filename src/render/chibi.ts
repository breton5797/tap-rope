// Top-down chibi body kit (camera above-front, looking down ~60°). Local coords: the feet
// sit at the origin, up is negative. From above the head dominates; shoulders read as a
// wide oval, the torso is almost hidden, and the feet peek out below.
import { circle, oval, radGrad, type Ctx } from './util';

export const HEAD_CY = -29;
export const HEAD_R = 15.5;
export const SHOULDER_Y = -15;
export const SHOULDER_X = 13;
export const OUTLINE = 'rgba(40,22,55,0.6)';

export interface BodyStyle {
  readonly shirt: string;
  readonly shirtDark: string;
  readonly pants: string;
  readonly limb: string;
  readonly shoe: string;
}

/** Feet + short leg stubs + hips. tuck 0..1 pulls the feet up under the body. */
export function drawLower(ctx: Ctx, st: BodyStyle, tuck: number): void {
  const fy = -1 - tuck * 6;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    const fx = s * (5.2 - tuck * 1.5);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(s * 4.4, -8);
    ctx.lineTo(fx, fy - 1);
    ctx.stroke();
    ctx.strokeStyle = st.limb;
    ctx.lineWidth = 4.4;
    ctx.stroke();
    ctx.fillStyle = st.shoe;
    oval(ctx, fx, fy + 0.5, 4.3, 3.1);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    oval(ctx, fx - 1, fy - 0.6, 1.8, 1);
    ctx.fill();
  }
  ctx.fillStyle = st.pants;
  oval(ctx, 0, -9, 9.5, 4.6);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Shoulders seen from above: a wide soft oval with top light. */
export function drawShoulders(ctx: Ctx, st: BodyStyle, wide = 1): void {
  ctx.fillStyle = radGrad(ctx, -3, SHOULDER_Y - 4, 2, 18 * wide, [[0, st.shirt], [0.7, st.shirt], [1, st.shirtDark]]);
  oval(ctx, 0, SHOULDER_Y, 15.5 * wide, 8);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  oval(ctx, -5 * wide, SHOULDER_Y - 3.4, 6 * wide, 2.4);
  ctx.fill();
}

/** Arm seen from above: sleeve stub then limb, optional round fist. */
export function drawArm(ctx: Ctx, st: BodyStyle, sx: number, sy: number, hx: number, hy: number, fist: boolean): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(hx, hy);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 6.2;
  ctx.stroke();
  ctx.strokeStyle = st.limb;
  ctx.lineWidth = 4.6;
  ctx.stroke();
  ctx.strokeStyle = st.shirt;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + (hx - sx) * 0.28, sy + (hy - sy) * 0.28);
  ctx.stroke();
  if (!fist) return;
  ctx.fillStyle = st.limb;
  circle(ctx, hx, hy, 3.1);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Head ball filled with the crown colour (hair / fur / metal). */
export function headBall(ctx: Ctx, light: string, mid: string, dark: string, r = HEAD_R): void {
  ctx.fillStyle = radGrad(ctx, -3, HEAD_CY - 6, 1, r * 1.15, [[0, light], [0.55, mid], [1, dark]]);
  circle(ctx, 0, HEAD_CY, r);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

/**
 * The face as a band on the lower part of the head (clipped to the head circle).
 * dx shifts it sideways for characters looking left/right.
 */
export function faceBand(ctx: Ctx, skin: string, shade: string, dx: number, ry = 8, r = HEAD_R): void {
  ctx.save();
  circle(ctx, 0, HEAD_CY, r - 0.6);
  ctx.clip();
  ctx.fillStyle = radGrad(ctx, dx - 2, HEAD_CY + 5, 1, 15, [[0, skin], [0.75, skin], [1, shade]]);
  oval(ctx, dx, HEAD_CY + r * 0.52, r * 0.82, ry);
  ctx.fill();
  ctx.restore();
}

/** Spiral hair whorl on the crown. */
export function whorl(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 18; i++) {
    const a = i * 0.55;
    const rr = 0.4 + i * 0.28;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.75;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/** Hair strands radiating from the whorl toward the forehead. */
export function strands(ctx: Ctx, x: number, y: number, color: string, n: number, r = HEAD_R): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.15 + (0.7 * i) / (n - 1));
    ctx.moveTo(x + Math.cos(a) * 4, y + Math.sin(a) * 3);
    ctx.quadraticCurveTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9 - 2, x + Math.cos(a) * (r - 3), HEAD_CY + 5);
  }
  ctx.stroke();
}
