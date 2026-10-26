// The gameplay plane: ceiling girder band and the floor. The floor is baked flat (texture y =
// screen y, texture x = world x) and drawn in thin depth strips by the corridor, each strip
// x-scaled around PLAYER_X, so tile seams converge like a perspective plane seen from above.
import { type Variant } from '../types';
import { CEIL_Y, FLOOR_BACK, FLOOR_FRONT, laneY } from './layout';
import type { ThemeArt } from './themes';
import { circle, radGrad, roundRect, vGrad, type Ctx } from './util';

export const CEIL_TOP = CEIL_Y - 18;
export const CEIL_BOT = CEIL_Y + 8;
export const FLOOR_TOP = FLOOR_BACK;
export const FLOOR_BOT = FLOOR_FRONT + 230;
/** world x (inside a plane tile) of the steam vents (they sit in the far lane, by the wall) */
export const VENT_X: readonly number[] = [100, 340];
export const VENT_Y = FLOOR_BACK + 10;

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

/** Floor texture: three lane strips with dashed lane lines, seams, and the front face below. */
export function drawFloor(ctx: Ctx, w: number, th: ThemeArt, variant: Variant): void {
  const back = FLOOR_BACK;
  const front = FLOOR_FRONT;
  ctx.fillStyle = vGrad(ctx, back, front, [[0, th.floorTop[1]], [0.5, th.floorTop[0]], [1, th.floorTop[1]]]);
  ctx.fillRect(0, back, w, front - back);
  // the middle lane is a touch lighter so the three lanes read at a glance
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, laneY(0.5), w, laneY(1.5) - laneY(0.5));
  // tile seams (vertical in texture space: the strip scaling makes them converge)
  ctx.strokeStyle = th.seam;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = 0; x < w; x += 48) {
    ctx.moveTo(x, back);
    ctx.lineTo(x, front);
  }
  for (const d of [0, 1, 2]) {
    ctx.moveTo(0, laneY(d) + 6);
    ctx.lineTo(w, laneY(d) + 6);
  }
  ctx.stroke();
  // dashed lane lines between the lanes
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const d of [0.5, 1.5]) ctx.fillRect(0, laneY(d) + 1, w, 2);
  ctx.fillStyle = th.floorLine;
  ctx.globalAlpha = 0.75;
  for (const d of [0.5, 1.5]) {
    const y = laneY(d);
    for (let x = 4; x < w; x += 40) ctx.fillRect(x, y - 1.5, 24, 2.5);
  }
  ctx.globalAlpha = 1;
  // little chevrons in each lane centre (running direction)
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const d of [0, 1, 2]) {
    const y = laneY(d) - 6;
    for (let x = 60; x < w; x += 240) {
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 5);
    }
  }
  ctx.stroke();
  // contact shadow along the wall foot + bright wall line
  ctx.fillStyle = vGrad(ctx, back, back + 12, [[0, 'rgba(0,0,0,0.42)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, back, w, 12);
  ctx.fillStyle = th.floorLine;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, back - 1, w, 2);
  ctx.globalAlpha = 1;
  // front edge + face
  ctx.fillStyle = vGrad(ctx, front, FLOOR_BOT, [[0, th.floorFront[0]], [0.35, th.floorFront[1]], [1, '#05060A']]);
  ctx.fillRect(0, front, w, FLOOR_BOT - front);
  ctx.fillStyle = th.floorLine;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(0, front - 1, w, 3);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let x = 20; x < w; x += 60) ctx.fillRect(x, front + 8, 4, 40);
  if (variant === 'steam') vents(ctx);
}

function vents(ctx: Ctx): void {
  for (const x of VENT_X) {
    ctx.fillStyle = '#1A1E26';
    roundRect(ctx, x - 18, VENT_Y - 6, 36, 12, 3);
    ctx.fill();
    ctx.strokeStyle = '#5A6070';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = -12; i <= 12; i += 6) {
      ctx.moveTo(x + i, VENT_Y - 4);
      ctx.lineTo(x + i - 2, VENT_Y + 4);
    }
    ctx.stroke();
  }
}
