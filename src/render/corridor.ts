// Corridor background: pre-rendered parallax tiles cached per (theme, variant, view).
// back wall + above-ceiling structure scroll at WALL_PARALLAX; the ceiling band and the
// floor scroll 1:1 with the world (emitters sit on them).
import type { Variant, WorldId } from '../types';
import { drawCeiling, drawFloor, drawTop, CEIL_BOT, CEIL_TOP, FLOOR_BOT, FLOOR_TOP, TOP_Y } from './plane';
import { PLANE_W, themeOf, WALL_W } from './themes';
import { GROUND_Y } from '../types';
import { makeCanvas, type Ctx } from './util';
import { sirenHousing, SIREN_X } from './corridor-fx';
import type { View } from './view';

export const WALL_PARALLAX = 0.55;

const GRADE: Readonly<Record<Variant, string | null>> = {
  base: null,
  alarm: 'rgba(120,0,24,0.16)',
  dark: 'rgba(4,6,18,0.62)',
  steam: 'rgba(200,214,224,0.10)',
  night: 'rgba(16,22,70,0.32)',
  dawn: 'rgba(255,150,80,0.10)',
};

interface Layer {
  readonly canvas: HTMLCanvasElement;
  readonly y: number;
  readonly h: number;
  readonly w: number;
  readonly factor: number;
}

function layer(v: View, w: number, y: number, h: number, factor: number, draw: (ctx: Ctx) => void, grade: string | null): Layer {
  const { canvas, ctx } = makeCanvas(w * v.k, h * v.k);
  ctx.setTransform(v.k, 0, 0, v.k, 0, -y * v.k);
  draw(ctx);
  if (grade) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = grade;
    ctx.fillRect(0, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  return { canvas, y, h, w, factor };
}

export class Corridor {
  private key = '';
  private layers: Layer[] = [];

  draw(ctx: Ctx, v: View, world: WorldId, variant: Variant, scroll: number): void {
    const key = `${world}|${variant}|${v.key}`;
    if (key !== this.key) {
      this.build(v, world, variant);
      this.key = key;
    }
    ctx.fillStyle = '#05060A';
    ctx.fillRect(v.x0 - 12, v.y0 - 12, v.w + 24, v.h + 24);
    for (const l of this.layers) {
      const shift = (scroll * l.factor) % l.w;
      let x = -shift + Math.floor((v.x0 - 12 + shift) / l.w) * l.w;
      while (x < v.x0 + v.w + 12) {
        ctx.drawImage(l.canvas, x, l.y, l.w, l.h);
        x += l.w;
      }
    }
  }

  private build(v: View, world: WorldId, variant: Variant): void {
    const th = themeOf(world);
    const grade = GRADE[variant] ?? null;
    const wall = layer(v, WALL_W, TOP_Y, GROUND_Y - TOP_Y, WALL_PARALLAX, (ctx) => {
      drawTop(ctx, WALL_W, th);
      th.drawWall(ctx, WALL_W, variant);
    }, grade);
    const ceil = layer(v, PLANE_W, CEIL_TOP, CEIL_BOT - CEIL_TOP + 44, 1, (ctx) => {
      drawCeiling(ctx, PLANE_W, th);
      if (variant === 'alarm') for (const x of SIREN_X) sirenHousing(ctx, x);
    }, grade);
    const floor = layer(v, PLANE_W, FLOOR_TOP, FLOOR_BOT - FLOOR_TOP, 1, (ctx) => drawFloor(ctx, PLANE_W, th, variant), grade);
    this.layers = [wall, ceil, floor];
  }
}
