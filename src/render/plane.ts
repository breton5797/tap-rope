// The gameplay plane: ceiling girder band and the floor. Both scroll 1:1 with the
// world-fixed laser emitters.
import { GROUND_Y, type Variant } from '../types';
import { CEIL_Y, FLOOR_DEPTH } from './layout';
import type { ThemeArt } from './themes';
import { circle, radGrad, roundRect, vGrad, type Ctx } from './util';

export const CEIL_TOP = CEIL_Y - 18;
export const CEIL_BOT = CEIL_Y + 8;
export const FLOOR_TOP = GROUND_Y - 2;
export const FLOOR_BOT = GROUND_Y + 260;
/** world x (inside a plane tile) of the steam vents */
export const VENT_X: readonly number[] = [100, 340];

export function drawCeiling(ctx: Ctx, w: number, th: ThemeArt): void {
  ctx.fillStyle = vGrad(ctx, CEIL_TOP, CEIL_BOT, [[0, th.ceil[0]], [1, th.ceil[1]]]);
  ctx.fillRect(0, CEIL_TOP, w, CEIL_BOT - CEIL_TOP);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, CEIL_TOP, w, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = 12; x < w; x += 24) {
    circle(ctx, x, CEIL_TOP + 7, 1.5);
    ctx.fill();
  }
  for (let x = 40; x < w; x += 160) {
    ctx.fillStyle = th.ceilLight;
    roundRect(ctx, x, CEIL_BOT - 4, 60, 4, 2);
    ctx.fill();
    ctx.fillStyle = radGrad(ctx, x + 30, CEIL_BOT, 2, 50, [[0, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(x - 20, CEIL_BOT, 100, 40);
  }
}

export function drawFloor(ctx: Ctx, w: number, th: ThemeArt, variant: Variant): void {
  const front = GROUND_Y + FLOOR_DEPTH;
  ctx.fillStyle = vGrad(ctx, GROUND_Y, front, [[0, th.floorTop[0]], [1, th.floorTop[1]]]);
  ctx.fillRect(0, GROUND_Y, w, FLOOR_DEPTH);
  ctx.strokeStyle = th.seam;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = 0; x < w; x += 48) {
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x - 10, front);
  }
  ctx.moveTo(0, GROUND_Y + FLOOR_DEPTH * 0.5);
  ctx.lineTo(w, GROUND_Y + FLOOR_DEPTH * 0.5);
  ctx.stroke();
  ctx.fillStyle = th.floorLine;
  ctx.fillRect(0, GROUND_Y - 1, w, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = 6; x < w; x += 48) ctx.fillRect(x, GROUND_Y + 3, 24, 2);
  ctx.fillStyle = vGrad(ctx, front, FLOOR_BOT, [[0, th.floorFront[0]], [0.4, th.floorFront[1]], [1, '#05060A']]);
  ctx.fillRect(0, front, w, FLOOR_BOT - front);
  ctx.fillStyle = th.floorLine;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, front, w, 3);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let x = 20; x < w; x += 60) ctx.fillRect(x, front + 8, 4, 40);
  if (variant === 'steam') vents(ctx);
}

function vents(ctx: Ctx): void {
  for (const x of VENT_X) {
    ctx.fillStyle = '#1A1E26';
    roundRect(ctx, x - 18, GROUND_Y + 6, 36, 12, 3);
    ctx.fill();
    ctx.strokeStyle = '#5A6070';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = -12; i <= 12; i += 6) {
      ctx.moveTo(x + i, GROUND_Y + 8);
      ctx.lineTo(x + i - 2, GROUND_Y + 16);
    }
    ctx.stroke();
  }
}
