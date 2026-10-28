// Office build stand-in for src/render/photo.ts (build/office-swaps.ts): the office art is bright pastel
// comic art, so the v8 cinematic grade is off — no teal multiply, no per-theme dimming, no wall-foot or
// floor falloff shadows. The floor apron under the lanes is a smooth fill of the floor's own colour: the
// corridor re-samples it into a few x-scaled strips, and a texture there showed as stair-step banding.
import type { Variant } from '../../types';
import { GROUND_Y } from '../../types';
import type { Photo } from '../../render/art';
import { CEIL_Y, FLOOR_BACK, FLOOR_FRONT, laneY } from '../../render/layout';
import { FLOOR_PW, WALL_PW } from '../../render/photo';
import { makeCanvas, vGrad, type Ctx } from '../../render/util';

export * from '../../render/photo';

/** a barely-there warm lift instead of the v8 grade (pastel art stays as painted) */
export function grade(ctx: Ctx, _variant: Variant, x: number, y: number, w: number, h: number, _dim = 0): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#FFE6C8';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

export function themeDim(_theme: number): number {
  return 0;
}

/** the wall photo with only a soft contact line where it meets the floor */
export function photoWall(ctx: Ctx, img: Photo): void {
  const h = GROUND_Y - CEIL_Y;
  ctx.drawImage(img, 0, CEIL_Y, WALL_PW, h);
  ctx.fillStyle = vGrad(ctx, GROUND_Y - 14, GROUND_Y, [[0, 'rgba(60,50,80,0)'], [1, 'rgba(60,50,80,0.18)']]);
  ctx.fillRect(0, GROUND_Y - 14, WALL_PW, 14);
}

/** mean colour of the photo (8×8 sample), or a neutral pastel when it cannot be read */
function meanColour(img: Photo): string {
  try {
    const { ctx } = makeCanvas(8, 8);
    ctx.drawImage(img, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += d[i + c];
    const n = d.length / 4;
    return `rgb(${Math.round(sum[0] / n)},${Math.round(sum[1] / n)},${Math.round(sum[2] / n)})`;
  } catch {
    return '#D8DED9';
  }
}

/** floor texture in the lane band, light tape lane separators, a smooth apron toward the camera */
export function photoFloor(ctx: Ctx, img: Photo, bottom: number, _theme: number): void {
  const back = FLOOR_BACK;
  const front = FLOOR_FRONT;
  ctx.drawImage(img, 0, back, FLOOR_PW, front - back);
  // soft shade along the wall only
  ctx.fillStyle = vGrad(ctx, back, back + 18, [[0, 'rgba(60,50,80,0.2)'], [1, 'rgba(60,50,80,0)']]);
  ctx.fillRect(0, back, FLOOR_PW, 18);
  // white floor tape between the lanes
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const d of [0.5, 1.5]) {
    const y = laneY(d);
    for (let x = 8; x < FLOOR_PW; x += 56) ctx.fillRect(x, y - 1, 34, 2);
  }
  ctx.fillStyle = meanColour(img);
  ctx.fillRect(0, front, FLOOR_PW, bottom - front);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(0, front - 1, FLOOR_PW, 2);
}
