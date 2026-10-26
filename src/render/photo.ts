// Baking the photographic art into corridor tiles (GDD-v6 §2), plus the cinematic colour grade
// shared by photo and procedural tiles. Wall photos are frontal elevations; their left/right seams
// hide behind a procedural structural column split across the tile edges. The floor photo is a
// top-down texture squeezed into the 3-lane depth band (the corridor strips add the perspective).
import { GROUND_Y, type Variant } from '../types';
import { CEIL_Y, FLOOR_BACK, FLOOR_FRONT, laneY } from './layout';
import type { Photo } from './art';
import { seeded, vGrad, type Ctx } from './util';

/** logical tile sizes for the photo layers (keep the photos' aspect ratios) */
export const WALL_PW = 512; // 1024×640 over the 320-tall wall bake
export const FLOOR_PW = 680; // 1024×512 top-down texture; 3 lanes ≈ 340 world px deep, foreshortened
export const TOP_PW = 600; // 1024×256 ceiling strip (lamps baked in), 150 tall, drawn at the wall's depth
export const PHOTO_TOP_H = 150;
const COLUMN_W = 30;

/** baked ceiling lamp centres per theme, in ceiling-tile px (measured from the art; t3 has none,
 * t1 is a continuous light strip → evenly spaced shafts) */
const LAMPS: readonly (readonly number[])[] = [
  [82, 343, 602, 886].map((x) => (x / 1024) * TOP_PW),
  [128, 384, 640, 896].map((x) => (x / 1024) * TOP_PW),
  [231, 482, 751, 1011].map((x) => (x / 1024) * TOP_PW),
  [],
];

export function lampsOf(theme: number): readonly number[] {
  return LAMPS[theme] ?? [];
}

/** extra darkening per theme so the four looks sit together (t1's white lab walls are brightest) */
const THEME_DIM: readonly number[] = [0, 0.15, 0, 0.05];
/** floor-3 rust diamond plate is busy: a darker multiply calms it */
const FLOOR_DIM: readonly number[] = [0.12, 0.18, 0.12, 0.38];

export function themeDim(theme: number): number {
  return THEME_DIM[theme] ?? 0;
}

interface GradeSpec {
  readonly mul: string; // multiply tint (shadows / overall light level)
  readonly mulA: number;
  readonly add: string; // screen tint (highlights / haze)
  readonly addA: number;
}

/** Scene variants = lighting + colour grade (teal shadows, warm highlights), never separate images. */
const GRADES: Readonly<Record<Variant, GradeSpec>> = {
  base: { mul: '#8FAAB2', mulA: 0.12, add: '#FF9A50', addA: 0.05 },
  alarm: { mul: '#8A3038', mulA: 0.26, add: '#FF2A3A', addA: 0.05 },
  dark: { mul: '#1C2638', mulA: 0.4, add: '#3FE0D0', addA: 0.03 },
  steam: { mul: '#9AAAB0', mulA: 0.26, add: '#B8C4C8', addA: 0.16 },
  night: { mul: '#26365E', mulA: 0.48, add: '#4A70C0', addA: 0.05 },
  dawn: { mul: '#B88A6A', mulA: 0.26, add: '#FF9040', addA: 0.14 },
};

/** Apply the variant grade over a baked region (tiles are opaque, so plain blend modes are safe);
 * `dim` darkens a little more (per-theme balance). */
export function grade(ctx: Ctx, variant: Variant, x: number, y: number, w: number, h: number, dim = 0): void {
  const g = GRADES[variant] ?? GRADES.base;
  ctx.save();
  if (dim > 0) {
    ctx.globalAlpha = dim;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = g.mulA;
  ctx.fillStyle = g.mul;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = g.addA;
  ctx.fillStyle = g.add;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Half of a steel column at tile edge x (side −1 = the half left of x, +1 = right of x). */
function columnHalf(ctx: Ctx, x: number, side: -1 | 1): void {
  const top = CEIL_Y;
  const h = GROUND_Y - CEIL_Y;
  const half = COLUMN_W / 2;
  const x0 = side < 0 ? x - half : x;
  ctx.fillStyle = '#1B1F24';
  ctx.fillRect(x0, top, half, h);
  // flange edges: lit left edge, dark right edge (key light from the left/front)
  if (side < 0) {
    ctx.fillStyle = '#3A424C';
    ctx.fillRect(x - half, top, 3, h);
    ctx.fillStyle = '#262C33';
    ctx.fillRect(x - half + 3, top, half - 3, h);
  } else {
    ctx.fillStyle = '#14171B';
    ctx.fillRect(x + half - 3, top, 3, h);
  }
  // web shadow down the middle + bolt plates
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x - 1, top, 2, h);
  ctx.fillStyle = '#2E353D';
  for (const y of [top + 40, top + h * 0.52]) ctx.fillRect(x0 + (side < 0 ? 3 : 0), y, half - 3, 14);
  ctx.fillStyle = '#5B636C';
  for (const y of [top + 44, top + h * 0.52 + 4]) {
    for (const dx of [-8, 8]) {
      if (Math.sign(dx) !== side) continue;
      ctx.fillRect(x + dx - 1, y, 2, 2);
      ctx.fillRect(x + dx - 1, y + 5, 2, 2);
    }
  }
  // painted hazard foot
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#B98A1E' : '#15171A';
    const y = GROUND_Y - 34 + i * 8;
    ctx.fillRect(x0, y, half, 8);
  }
}

/** Procedural fallback wall (no photo yet / missing): the theme's plain base finish, structural
 * columns at the tile edges and the same occlusion as the photo walls — no decorative props. */
export function plainWall(ctx: Ctx, base: (ctx: Ctx, w: number) => void, w: number): void {
  base(ctx, w);
  ctx.fillStyle = vGrad(ctx, CEIL_Y, CEIL_Y + 60, [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, CEIL_Y, w, 60);
  columnHalf(ctx, 0, 1);
  columnHalf(ctx, w, -1);
}

/** Wall tile from a photo elevation (its edges already blend into the neighbours, and its bottom
 * edge is the floor line): photo + a soft occlusion along the floor. */
export function photoWall(ctx: Ctx, img: Photo): void {
  const h = GROUND_Y - CEIL_Y;
  ctx.drawImage(img, 0, CEIL_Y, WALL_PW, h);
  ctx.fillStyle = vGrad(ctx, GROUND_Y - 34, GROUND_Y, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.5)']]);
  ctx.fillRect(0, GROUND_Y - 34, WALL_PW, 34);
}

/** Floor tile from the top-down photo: texture in the lane band, worn lane paint, occlusion, front face. */
export function photoFloor(ctx: Ctx, img: Photo, bottom: number, theme: number): void {
  const back = FLOOR_BACK;
  const front = FLOOR_FRONT;
  ctx.drawImage(img, 0, back, FLOOR_PW, front - back);
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = FLOOR_DIM[theme] ?? 0.12;
  ctx.fillRect(0, back, FLOOR_PW, front - back);
  ctx.globalAlpha = 1;
  // light falloff: dim far edge (wall shadow) and a lit band through the middle lane
  ctx.fillStyle = vGrad(ctx, back, front, [
    [0, 'rgba(0,0,0,0.55)'], [0.18, 'rgba(0,0,0,0.12)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.25)'],
  ]);
  ctx.fillRect(0, back, FLOOR_PW, front - back);
  // worn painted lane separators (amber, broken)
  ctx.fillStyle = 'rgba(255,176,32,0.38)';
  for (const d of [0.5, 1.5]) {
    const y = laneY(d);
    for (let x = 8; x < FLOOR_PW; x += 56) ctx.fillRect(x, y - 1, 34, 2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (const d of [0.5, 1.5]) ctx.fillRect(0, laneY(d) + 1, FLOOR_PW, 1);
  // apron in front of the lanes: the same floor continues toward the camera (fills tall screens),
  // falling off into shadow, behind a worn painted edge line
  for (let y = front; y < bottom; y += front - back) ctx.drawImage(img, 0, y, FLOOR_PW, front - back);
  ctx.fillStyle = vGrad(ctx, front, bottom, [[0, 'rgba(0,0,0,0.25)'], [0.45, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0.88)']]);
  ctx.fillRect(0, front, FLOOR_PW, bottom - front);
  ctx.fillStyle = 'rgba(255,176,32,0.32)';
  ctx.fillRect(0, front - 1, FLOOR_PW, 2);
}

/** Ceiling strip above the back wall (tile y 0..PHOTO_TOP_H): the photo, fading into darkness at the top. */
export function photoTop(ctx: Ctx, img: Photo): void {
  ctx.drawImage(img, 0, 0, TOP_PW, PHOTO_TOP_H);
  ctx.fillStyle = vGrad(ctx, 0, 60, [[0, 'rgba(5,6,10,1)'], [1, 'rgba(5,6,10,0)']]);
  ctx.fillRect(0, 0, TOP_PW, 60);
}

/** Open sky above an exterior wall (tile y 0..PHOTO_TOP_H, horizon at the bottom): night = deep
 * navy with sparse stars and a faint city glow; dawn = indigo fading into an amber horizon. */
export function skyBand(ctx: Ctx, kind: 'night' | 'dawn'): void {
  const h = PHOTO_TOP_H;
  ctx.fillStyle = kind === 'night'
    ? vGrad(ctx, 0, h, [[0, '#03050B'], [0.6, '#0B1428'], [1, '#1C2A44']])
    : vGrad(ctx, 0, h, [[0, '#0E1226'], [0.45, '#3A2E48'], [0.8, '#B4643C'], [1, '#F0A050']]);
  ctx.fillRect(0, 0, TOP_PW, h);
  if (kind === 'night') {
    const rnd = seeded(41);
    ctx.fillStyle = '#DDE6FF';
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.25 + rnd() * 0.55;
      ctx.fillRect(rnd() * TOP_PW, rnd() * h * 0.7, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  // haze at the horizon line (where the wall top meets the sky)
  ctx.fillStyle = vGrad(ctx, h - 30, h, [[0, 'rgba(255,190,140,0)'], [1, kind === 'night' ? 'rgba(90,110,160,0.35)' : 'rgba(255,200,140,0.45)']]);
  ctx.fillRect(0, h - 30, TOP_PW, 30);
}
