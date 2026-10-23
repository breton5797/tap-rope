import type { Variant, WorldId } from '../types';
import type { SpriteCache } from './sprites';
import type { TileSpec, WorldArt } from './scenery';
import { makeCanvas, vGrad, type Ctx } from './util';
import { lookOf, type VariantLook } from './variants';
import type { View } from './view';
import { PLAYGROUND } from './world-playground';
import { BEACH } from './world-beach';
import { CITY } from './world-city';
import { MOON } from './world-moon';

/** extra logical px around the view so screen shake never exposes an edge */
const MARGIN = 12;

const ARTS: readonly WorldArt[] = [PLAYGROUND, BEACH, CITY, MOON];

interface BuiltTile {
  readonly spec: TileSpec;
  readonly canvas: HTMLCanvasElement;
}

/** Theme backdrop + pre-rendered scene, cached per (theme, variant, view size). */
export class Background {
  private key = '';
  private scene: HTMLCanvasElement | null = null;
  private tiles: BuiltTile[] = [];
  private sky: CanvasGradient | null = null;

  draw(ctx: Ctx, v: View, world: WorldId, variant: Variant, t: number, sprites: SpriteCache, reduced: boolean): void {
    const art = ARTS[world] ?? PLAYGROUND;
    const look = lookOf(variant);
    const key = `${world}|${variant}|${v.key}`;
    if (key !== this.key || !this.scene) {
      this.build(ctx, art, look, v, world, variant);
      this.key = key;
    }
    ctx.fillStyle = this.sky ?? '#000';
    ctx.fillRect(v.x0 - MARGIN, v.y0 - MARGIN, v.w + MARGIN * 2, v.h + MARGIN * 2);
    if (look.keepBackdrop(world)) art.backdrop(ctx, v, t, sprites);
    look.backdrop(ctx, t, sprites, world);
    for (const tile of this.tiles) drawTile(ctx, v, tile, t);
    if (this.scene) ctx.drawImage(this.scene, v.x0 - MARGIN, v.y0 - MARGIN, v.w + MARGIN * 2, v.h + MARGIN * 2);
    art.front(ctx, v, t, sprites, variant);
    look.ground(ctx, v, t, world, reduced);
  }

  /** Variant layers drawn over the stage (rain, falling leaves, sparkles). */
  overlay(ctx: Ctx, v: View, world: WorldId, variant: Variant, t: number, reduced: boolean): void {
    lookOf(variant).overlay(ctx, v, t, world, reduced);
  }

  private build(ctx: Ctx, art: WorldArt, look: VariantLook, v: View, world: WorldId, variant: Variant): void {
    this.sky = vGrad(ctx, -90, art.skyTo, look.sky ?? art.sky);
    const padded: View = { ...v, x0: v.x0 - MARGIN, y0: v.y0 - MARGIN, w: v.w + MARGIN * 2, h: v.h + MARGIN * 2 };
    const scene = makeCanvas(padded.w * v.k, padded.h * v.k);
    const sctx = scene.ctx;
    sctx.setTransform(v.k, 0, 0, v.k, -padded.x0 * v.k, -padded.y0 * v.k);
    art.drawScene(sctx, padded, variant);
    if (look.grade) {
      sctx.globalCompositeOperation = 'source-atop';
      sctx.fillStyle = look.grade;
      sctx.fillRect(padded.x0, padded.y0, padded.w, padded.h);
      sctx.globalCompositeOperation = 'source-over';
    }
    look.scene(sctx, padded, world, art);
    this.scene = scene.canvas;
    const specs = look.keepTiles(world) ? [...art.tiles, ...look.tiles] : look.tiles;
    this.tiles = specs.map((spec) => {
      const tile = makeCanvas(spec.w * v.k, spec.h * v.k);
      tile.ctx.setTransform(v.k, 0, 0, v.k, 0, -spec.y * v.k);
      spec.draw(tile.ctx, spec.w);
      return { spec, canvas: tile.canvas };
    });
  }
}

function drawTile(ctx: Ctx, v: View, tile: BuiltTile, t: number): void {
  const { spec, canvas } = tile;
  const shift = (t * spec.speed) % spec.w;
  let x = -shift + Math.floor((v.x0 - MARGIN + shift) / spec.w) * spec.w;
  const end = v.x0 + v.w + MARGIN;
  while (x < end) {
    ctx.drawImage(canvas, x, spec.y, spec.w, spec.h);
    x += spec.w;
  }
}
