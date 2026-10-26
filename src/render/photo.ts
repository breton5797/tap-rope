// Baking the photographic art into corridor tiles (GDD-v6 §2), plus the cinematic colour grade
// shared by photo and procedural tiles. Wall photos are frontal elevations; their left/right seams
// hide behind a procedural structural column split across the tile edges. The floor photo is a
// top-down texture squeezed into the 3-lane depth band (the corridor strips add the perspective).
import { GROUND_Y, type Variant } from '../types';
import { CEIL_Y, FLOOR_BACK, FLOOR_FRONT, laneY } from './layout';
import { vGrad, type Ctx } from './util';

/** logical tile sizes for the photo layers (keep the photos' aspect ratios) */
export const WALL_PW = 512; // 1024×640 over the 320-tall wall bake
export const FLOOR_PW = 680; // 1024×512 top-down texture; 3 lanes ≈ 340 world px deep, foreshortened
export const TOP_PW = 600; // 1024×256 ceiling services strip, 150 tall
const TOP_PH = 150;
const COLUMN_W = 30;

interface GradeSpec {
  readonly mul: string; // multiply tint (shadows / overall light level)
  readonly mulA: number;
  readonly add: string; // screen tint (highlights / haze)
  readonly addA: number;
}

/** Scene variants = lighting + colour grade (teal shadows, warm highlights), never separate images. */
const GRADES: Readonly<Record<Variant, GradeSpec>> = {
  base: { mul: '#7FA2AE', mulA: 0.42, add: '#FF9A50', addA: 0.07 },
  alarm: { mul: '#8A3038', mulA: 0.55, add: '#FF2A3A', addA: 0.08 },
  dark: { mul: '#1C2638', mulA: 0.86, add: '#3FE0D0', addA: 0.02 },
  steam: { mul: '#9AAAB0', mulA: 0.38, add: '#B8C4C8', addA: 0.16 },
  night: { mul: '#26365E', mulA: 0.72, add: '#4A70C0', addA: 0.05 },
  dawn: { mul: '#B88A6A', mulA: 0.4, add: '#FF9040', addA: 0.14 },
};

/** Apply the variant grade over a baked region (tiles are opaque, so plain blend modes are safe). */
export function grade(ctx: Ctx, variant: Variant, x: number, y: number, w: number, h: number): void {
  const g = GRADES[variant] ?? GRADES.base;
  ctx.save();
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

/** Wall tile from a photo elevation: photo, edge columns, baseboard shadow, ceiling occlusion. */
export function photoWall(ctx: Ctx, img: ImageBitmap): void {
  const h = GROUND_Y - CEIL_Y;
  ctx.drawImage(img, 0, CEIL_Y, WALL_PW, h);
  // ambient occlusion under the ceiling and along the floor
  ctx.fillStyle = vGrad(ctx, CEIL_Y, CEIL_Y + 60, [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, CEIL_Y, WALL_PW, 60);
  ctx.fillStyle = vGrad(ctx, GROUND_Y - 40, GROUND_Y, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]);
  ctx.fillRect(0, GROUND_Y - 40, WALL_PW, 40);
  columnHalf(ctx, 0, 1);
  columnHalf(ctx, WALL_PW, -1);
}

/** Floor tile from the top-down photo: texture in the lane band, worn lane paint, occlusion, front face. */
export function photoFloor(ctx: Ctx, img: ImageBitmap, bottom: number): void {
  const back = FLOOR_BACK;
  const front = FLOOR_FRONT;
  ctx.drawImage(img, 0, back, FLOOR_PW, front - back);
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
  // front edge: steel nosing + dark face
  ctx.fillStyle = vGrad(ctx, front, bottom, [[0, '#2A2F35'], [0.06, '#15181C'], [1, '#050608']]);
  ctx.fillRect(0, front, FLOOR_PW, bottom - front);
  ctx.fillStyle = '#5A626C';
  ctx.fillRect(0, front - 1, FLOOR_PW, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let x = 30; x < FLOOR_PW; x += 85) ctx.fillRect(x, front + 6, 3, 30);
}

/** Service space above the ceiling: dark void + the ceiling-services photo along its bottom. */
export function photoTop(ctx: Ctx, img: ImageBitmap, top: number): void {
  const bottom = CEIL_Y + 6;
  ctx.fillStyle = vGrad(ctx, top, bottom, [[0, '#040506'], [1, '#0E1114']]);
  ctx.fillRect(0, top, TOP_PW, bottom - top);
  ctx.drawImage(img, 0, bottom - TOP_PH, TOP_PW, TOP_PH);
  ctx.fillStyle = vGrad(ctx, bottom - TOP_PH, bottom - TOP_PH + 50, [[0, 'rgba(4,5,6,1)'], [1, 'rgba(4,5,6,0)']]);
  ctx.fillRect(0, bottom - TOP_PH, TOP_PW, 50);
}
