// Corridor background: pre-rendered parallax tiles cached per (theme, variant, view).
// The above-ceiling band and the back wall scroll at WALL_PARALLAX and come in several
// tile variants picked by hash(tile index), so the pattern doesn't visibly repeat; the
// ceiling band and the floor scroll 1:1 with the world (emitters sit on them).
import { GROUND_Y, type Variant, type WorldId } from '../types';
import { sirenHousing, SIREN_X } from './corridor-fx';
import { CEIL_Y } from './layout';
import { drawCeiling, drawFloor, CEIL_BOT, CEIL_TOP, FLOOR_BOT, FLOOR_TOP } from './plane';
import { drawWall, PLANE_W, themeOf, WALL_VARIANTS, WALL_W } from './themes';
import { drawTop, TOP_VARIANTS, TOP_Y, topFx } from './top-band';
import { makeCanvas, releaseCanvas, type Ctx } from './util';
import type { View } from './view';

export const WALL_PARALLAX = 0.55;
/** the dim band above the ceiling is rendered at reduced resolution */
const TOP_RES = 0.65;
/** corridor tiles bake at most at this device-pixel ratio (memory: iOS Safari canvas limits) */
const MAX_TILE_DPR = 2;
/** …and never denser than this many device px per logical px (big iPads) */
const MAX_TILE_K = 2.6;
const TOP_SALT = 11;

const GRADE: Readonly<Record<Variant, string | null>> = {
  base: null,
  alarm: 'rgba(120,0,24,0.16)',
  dark: 'rgba(4,6,18,0.62)',
  steam: 'rgba(200,214,224,0.10)',
  night: 'rgba(16,22,70,0.32)',
  dawn: 'rgba(255,150,80,0.10)',
};

interface Layer {
  readonly canvases: readonly HTMLCanvasElement[];
  readonly y: number;
  readonly h: number;
  readonly w: number;
  readonly factor: number;
  readonly salt: number;
}

function tileHash(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function bake(v: View, w: number, y: number, h: number, res: number, draw: (ctx: Ctx) => void, grade: string | null): HTMLCanvasElement {
  const k = Math.min(v.s * Math.min(v.dpr, MAX_TILE_DPR), MAX_TILE_K) * res;
  const { canvas, ctx } = makeCanvas(w * k, h * k);
  ctx.setTransform(k, 0, 0, k, 0, -y * k);
  draw(ctx);
  if (grade) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = grade;
    ctx.fillRect(0, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  return canvas;
}

export class Corridor {
  private key = '';
  private world: WorldId = 0;
  private layers: Layer[] = [];

  draw(ctx: Ctx, v: View, world: WorldId, variant: Variant, scroll: number, t: number): void {
    const key = `${world}|${variant}|${v.key}`;
    if (key !== this.key) {
      this.build(v, world, variant);
      this.key = key;
      this.world = world;
    }
    ctx.fillStyle = '#05060A';
    ctx.fillRect(v.x0 - 12, v.y0 - 12, v.w + 24, v.h + 24);
    for (const l of this.layers) {
      const shift = (scroll * l.factor) % l.w;
      let m = Math.floor((v.x0 - 12 + shift) / l.w);
      let x = -shift + m * l.w;
      while (x < v.x0 + v.w + 12) {
        const idx = l.canvases.length > 1 ? tileHash(m, l.salt) % l.canvases.length : 0;
        ctx.drawImage(l.canvases[idx], x, l.y, l.w, l.h);
        if (l.salt === TOP_SALT && variant !== 'dark') topFx(ctx, v, x, idx, t, themeOf(this.world));
        x += l.w;
        m++;
      }
    }
  }

  /** Free every cached tile (only the current theme × variant × view is ever kept). */
  private release(): void {
    for (const l of this.layers) for (const c of l.canvases) releaseCanvas(c);
    this.layers = [];
  }

  private build(v: View, world: WorldId, variant: Variant): void {
    this.release();
    const th = themeOf(world);
    const grade = GRADE[variant] ?? null;
    const tops: HTMLCanvasElement[] = [];
    for (let i = 0; i < TOP_VARIANTS; i++) {
      tops.push(bake(v, WALL_W, TOP_Y, CEIL_Y + 6 - TOP_Y, TOP_RES, (ctx) => drawTop(ctx, WALL_W, th, i), grade));
    }
    const walls: HTMLCanvasElement[] = [];
    for (let i = 0; i < WALL_VARIANTS; i++) {
      walls.push(bake(v, WALL_W, CEIL_Y, GROUND_Y - CEIL_Y, 1, (ctx) => drawWall(ctx, world, WALL_W, variant, i), grade));
    }
    const ceil = bake(v, PLANE_W, CEIL_TOP, CEIL_BOT - CEIL_TOP + 44, 1, (ctx) => {
      drawCeiling(ctx, PLANE_W, th);
      if (variant === 'alarm') for (const x of SIREN_X) sirenHousing(ctx, x);
    }, grade);
    const floor = bake(v, PLANE_W, FLOOR_TOP, FLOOR_BOT - FLOOR_TOP, 1, (ctx) => drawFloor(ctx, PLANE_W, th, variant), grade);
    this.layers = [
      { canvases: tops, y: TOP_Y, h: CEIL_Y + 6 - TOP_Y, w: WALL_W, factor: WALL_PARALLAX, salt: TOP_SALT },
      { canvases: walls, y: CEIL_Y, h: GROUND_Y - CEIL_Y, w: WALL_W, factor: WALL_PARALLAX, salt: 5 },
      { canvases: [ceil], y: CEIL_TOP, h: CEIL_BOT - CEIL_TOP + 44, w: PLANE_W, factor: 1, salt: 0 },
      { canvases: [floor], y: FLOOR_TOP, h: FLOOR_BOT - FLOOR_TOP, w: PLANE_W, factor: 1, salt: 0 },
    ];
  }
}
