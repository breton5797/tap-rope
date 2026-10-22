import type { WorldId } from '../types';
import type { SpriteCache } from './sprites';
import type { TileSpec, WorldArt } from './scenery';
import { makeCanvas, vGrad, type Ctx } from './util';
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

export class Background {
  private world = -1;
  private viewKey = '';
  private scene: HTMLCanvasElement | null = null;
  private tiles: BuiltTile[] = [];
  private sky: CanvasGradient | null = null;

  draw(ctx: Ctx, v: View, world: WorldId, t: number, sprites: SpriteCache): void {
    const art = ARTS[world] ?? PLAYGROUND;
    if (world !== this.world || v.key !== this.viewKey || !this.scene) {
      this.build(ctx, art, v);
      this.world = world;
      this.viewKey = v.key;
    }
    ctx.fillStyle = this.sky ?? '#000';
    ctx.fillRect(v.x0 - MARGIN, v.y0 - MARGIN, v.w + MARGIN * 2, v.h + MARGIN * 2);
    art.backdrop(ctx, v, t, sprites);
    for (const tile of this.tiles) drawTile(ctx, v, tile, t);
    if (this.scene) ctx.drawImage(this.scene, v.x0 - MARGIN, v.y0 - MARGIN, v.w + MARGIN * 2, v.h + MARGIN * 2);
    art.front(ctx, v, t, sprites);
  }

  private build(ctx: Ctx, art: WorldArt, v: View): void {
    this.sky = vGrad(ctx, 0, art.skyTo, art.sky);
    const padded: View = { ...v, x0: v.x0 - MARGIN, y0: v.y0 - MARGIN, w: v.w + MARGIN * 2, h: v.h + MARGIN * 2 };
    const scene = makeCanvas(padded.w * v.k, padded.h * v.k);
    scene.ctx.setTransform(v.k, 0, 0, v.k, -padded.x0 * v.k, -padded.y0 * v.k);
    art.drawScene(scene.ctx, padded);
    this.scene = scene.canvas;
    this.tiles = art.tiles.map((spec) => {
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
