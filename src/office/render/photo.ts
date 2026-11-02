// Office build stand-in for src/render/photo.ts (build/office-swaps.ts): the office art is bright pastel
// comic art, so the v8 cinematic grade is off — no teal multiply, no per-theme dimming, no wall-foot or
// floor falloff shadows. The floor apron under the lanes is a smooth fill of the floor's own colour: the
// corridor re-samples it into a few x-scaled strips, and a texture there showed as stair-step banding.
import type { Variant } from '../../types';
import { GROUND_Y } from '../../types';
import type { Photo } from '../../render/art';
import { CEIL_Y, FLOOR_BACK, FLOOR_FRONT, laneY } from '../../render/layout';
import { FLOOR_PW, PHOTO_TOP_H, TOP_PW, WALL_PW, lampsOf as v8LampsOf, skyBand as v8SkyBand } from '../../render/photo';
import { makeCanvas, seeded, vGrad, type Ctx } from '../../render/util';

export * from '../../render/photo';

/**
 * stage 10 is the street (theme 4) after dark with no photos of its own: a dusk multiply of this strength
 * over the same art, plus a faint warm street-lamp lift so it stays a readable comic night, not a blackout.
 * Theme 0 at night is its own painted exterior set and takes no extra tint.
 */
const NIGHT_DUSK: Readonly<Partial<Record<number, number>>> = { 4: 0.34 };

/** a barely-there warm lift instead of the v8 grade (pastel art stays as painted); `dim` > 0 at night = dusk */
export function grade(ctx: Ctx, variant: Variant, x: number, y: number, w: number, h: number, dim = 0): void {
  ctx.save();
  if (variant === 'night' && dim > 0) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = dim;
    ctx.fillStyle = '#3B3F7A';
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#FFB36B';
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#FFE6C8';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** the dusk strength of a theme's night look (0 = none); the corridor passes it to grade() as `dim` */
export function themeDim(theme: number): number {
  return NIGHT_DUSK[theme] ?? 0;
}

/**
 * baked light-fixture centres of the part-2 ceilings, in ceiling-tile px: the subway's fluorescent strip is
 * evenly spaced shafts; the street and the food alley are open-air (awnings / string lights) — no shafts.
 */
const PART2_LAMPS: Readonly<Partial<Record<number, readonly number[]>>> = {
  4: [],
  5: [128, 384, 640, 896].map((x) => (x / 1024) * TOP_PW),
  6: [],
};

export function lampsOf(theme: number): readonly number[] {
  return PART2_LAMPS[theme] ?? v8LampsOf(theme);
}

/**
 * the open sky over an exterior set. Night (stage 6, the gate plaza) is a pastel dusk — indigo fading to the
 * periwinkle the wall art paints at its top edge — instead of the v8 near-black; dawn keeps the v8 band.
 */
export function skyBand(ctx: Ctx, kind: 'night' | 'dawn', feather = 44): void {
  if (kind !== 'night') {
    v8SkyBand(ctx, kind, feather);
    return;
  }
  const h = PHOTO_TOP_H;
  ctx.fillStyle = vGrad(ctx, 0, h, [[0, '#2B3157'], [0.6, '#5F6AAE'], [1, '#9AA8E0']]);
  ctx.fillRect(0, 0, TOP_PW, h);
  const rnd = seeded(47);
  ctx.fillStyle = '#FFF6E0';
  for (let i = 0; i < 24; i++) {
    ctx.globalAlpha = 0.35 + rnd() * 0.5;
    const r = 0.8 + rnd() * 1.2;
    ctx.fillRect(rnd() * TOP_PW, rnd() * h * 0.5, r, r);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#9AA8E0';
  ctx.fillRect(0, h, TOP_PW, feather);
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
  // white floor tape between the lanes, outlined so it reads on light floors (F1: it scrolls with the floor)
  for (const d of [0.5, 1.5]) {
    const y = laneY(d);
    for (let x = 8; x < FLOOR_PW; x += 56) {
      ctx.fillStyle = 'rgba(58,46,63,0.25)';
      ctx.fillRect(x - 1, y - 2.5, 36, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(x, y - 1.5, 34, 3);
    }
  }
  ctx.fillStyle = meanColour(img);
  ctx.fillRect(0, front, FLOOR_PW, bottom - front);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(0, front - 1, FLOOR_PW, 2);
}
