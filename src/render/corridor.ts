// Corridor background: pre-rendered tiles cached per (theme, variant, view) = one SceneCache.
// The above-ceiling band scrolls at TOP_PARALLAX; the back wall stands on the floor's far edge and
// is drawn at that depth's scale (perspective around PLAYER_X); the ceiling band scrolls 1:1; the
// floor is drawn in thin depth strips so it reads as a plane seen from ~20° above.
// Memory: only the current scene is kept, plus at most ONE other scene while a door transition
// needs it. The incoming scene pre-bakes only the tiles visible at the door (one per frame); the
// outgoing scene is trimmed to the tiles it still shows each frame and released when done.
import { GROUND_Y, PLAYER_X, type Scene, type Variant, type WorldId } from '../types';
import { sirenHousing, SIREN_X } from './corridor-fx';
import { CEIL_Y, depthAtY, depthScale, FLOOR_BACK, FLOOR_FRONT, FRONT_DEPTH, WALL_DEPTH } from './layout';
import { drawCeiling, drawFloor, CEIL_BOT, CEIL_TOP, FLOOR_BOT, FLOOR_TOP } from './plane';
import { drawWall, PLANE_W, themeOf, WALL_VARIANTS, WALL_W } from './themes';
import { drawTop, TOP_VARIANTS, TOP_Y, topFx } from './top-band';
import { makeCanvas, releaseCanvas, type Ctx } from './util';
import type { View } from './view';

export const TOP_PARALLAX = 0.55;
/** the dim band above the ceiling is rendered at reduced resolution */
const TOP_RES = 0.65;
/** corridor tiles bake at most at this device-pixel ratio (memory: iOS Safari canvas limits) */
const MAX_TILE_DPR = 2;
/** …and never denser than this many device px per logical px (big iPads) */
const MAX_TILE_K = 2.6;
/** floor surface strips (more = smoother converging seams) */
const FLOOR_STRIPS = 12;
const WALL_S = depthScale(WALL_DEPTH);
const WALL_H = GROUND_Y - CEIL_Y;
const TOP_H = CEIL_Y + 6 - TOP_Y;
const CEIL_LAYER_H = CEIL_BOT - CEIL_TOP + 44;

const GRADE: Readonly<Record<Variant, string | null>> = {
  base: null,
  alarm: 'rgba(120,0,24,0.16)',
  dark: 'rgba(4,6,18,0.62)',
  steam: 'rgba(200,214,224,0.10)',
  night: 'rgba(16,22,70,0.32)',
  dawn: 'rgba(255,150,80,0.10)',
};

function tileHash(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function sceneKey(s: Scene, v: View): string {
  return `${s.world}|${s.variant}|${v.key}`;
}

/** Calls fn(m, screenX) for every tile m whose projected span overlaps [xMin, xMax]. */
function eachTile(xMin: number, xMax: number, w: number, scroll: number, s: number, fn: (m: number, sx: number) => void): void {
  let m = Math.floor((PLAYER_X + (xMin - PLAYER_X) / s + scroll) / w);
  let sx = PLAYER_X + (m * w - scroll - PLAYER_X) * s;
  while (sx < xMax) {
    fn(m, sx);
    m++;
    sx += w * s;
  }
}

const enum L {
  Top = 0,
  Wall = 1,
  Ceil = 2,
  Floor = 3,
}

/** All baked tiles of one look; tiles bake lazily (on demand or one per warm() call). */
class SceneCache {
  private readonly tiles: (HTMLCanvasElement | null)[][] = [
    new Array<HTMLCanvasElement | null>(TOP_VARIANTS).fill(null),
    new Array<HTMLCanvasElement | null>(WALL_VARIANTS).fill(null),
    [null],
    [null],
  ];
  private readonly k: number;
  private readonly grade: string | null;
  /** tiles drawn since the last trim (layer * 8 + index) */
  private readonly used = new Set<number>();

  constructor(readonly key: string, readonly world: WorldId, readonly variant: Variant, v: View) {
    this.k = Math.min(v.s * Math.min(v.dpr, MAX_TILE_DPR), MAX_TILE_K);
    this.grade = GRADE[variant] ?? null;
  }

  tile(layer: L, i: number): HTMLCanvasElement {
    this.used.add(layer * 8 + i);
    return this.tiles[layer][i] ?? this.bake(layer, i);
  }

  /** Bake the first missing tile among `needed` (layer * 8 + index); false when none is missing. */
  warm(needed: readonly number[]): boolean {
    for (const n of needed) {
      const l = Math.floor(n / 8) as L;
      if (!this.tiles[l][n % 8]) {
        this.bake(l, n % 8);
        return true;
      }
    }
    return false;
  }

  /** Release every tile not drawn since the previous trim (no-op if nothing was drawn). */
  trimToUsed(): void {
    if (this.used.size === 0) return;
    this.tiles.forEach((row, l) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] && !this.used.has(l * 8 + i)) {
          releaseCanvas(row[i]);
          row[i] = null;
        }
      }
    });
    this.used.clear();
  }

  clearUsed(): void {
    this.used.clear();
  }

  bytes(): number {
    let b = 0;
    for (const row of this.tiles) for (const c of row) if (c) b += c.width * c.height * 4;
    return b;
  }

  release(): void {
    for (const row of this.tiles) {
      for (let i = 0; i < row.length; i++) {
        releaseCanvas(row[i]);
        row[i] = null;
      }
    }
  }

  private bake(layer: L, i: number): HTMLCanvasElement {
    const th = themeOf(this.world);
    const variant = this.variant;
    let c: HTMLCanvasElement;
    if (layer === L.Top) c = this.bakeOne(WALL_W, TOP_Y, TOP_H, TOP_RES, (ctx) => drawTop(ctx, WALL_W, th, i));
    else if (layer === L.Wall) c = this.bakeOne(WALL_W, CEIL_Y, WALL_H, 1, (ctx) => drawWall(ctx, this.world, WALL_W, variant, i));
    else if (layer === L.Ceil) {
      c = this.bakeOne(PLANE_W, CEIL_TOP, CEIL_LAYER_H, 1, (ctx) => {
        drawCeiling(ctx, PLANE_W, th);
        if (variant === 'alarm') for (const x of SIREN_X) sirenHousing(ctx, x);
      });
    } else c = this.bakeOne(PLANE_W, FLOOR_TOP, FLOOR_BOT - FLOOR_TOP, 1, (ctx) => drawFloor(ctx, PLANE_W, th, variant));
    this.tiles[layer][i] = c;
    return c;
  }

  private bakeOne(w: number, y: number, h: number, res: number, draw: (ctx: Ctx) => void): HTMLCanvasElement {
    const k = this.k * res;
    const { canvas, ctx } = makeCanvas(w * k, h * k);
    ctx.setTransform(k, 0, 0, k, 0, -y * k);
    draw(ctx);
    if (this.grade) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = this.grade;
      ctx.fillRect(0, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    return canvas;
  }
}

export class Corridor {
  private caches: SceneCache[] = [];

  /**
   * Keep exactly the scenes in `want` (first = current, at most one more) and release the rest.
   * A non-current scene pre-bakes, one tile per call, the tiles visible at `warmScroll` (the
   * corridor scroll at the door), so the transition never stalls a frame.
   */
  sync(v: View, want: readonly Scene[], warmScroll = 0): void {
    const keys = want.slice(0, 2).map((s) => sceneKey(s, v));
    const keep: SceneCache[] = [];
    for (const c of this.caches) {
      if (keys.includes(c.key) && !keep.some((k) => k.key === c.key)) keep.push(c);
      else c.release();
    }
    this.caches = keep;
    want.slice(0, 2).forEach((s, i) => {
      const key = keys[i];
      let c = this.caches.find((x) => x.key === key);
      if (!c) {
        c = new SceneCache(key, s.world, s.variant, v);
        this.caches.push(c);
      }
      if (i > 0) c.warm(this.visibleTiles(v, warmScroll));
    });
  }

  /** After drawing: trim the outgoing (non-current) scene to the tiles it still showed. */
  endFrame(): void {
    this.caches.forEach((c, i) => (i > 0 ? c.trimToUsed() : c.clearUsed()));
  }

  /** Tile ids (layer * 8 + index) visible at a given scroll: floor, ceiling, walls, top band. */
  private visibleTiles(v: View, scroll: number): number[] {
    const out = [L.Floor * 8, L.Ceil * 8];
    const xMin = v.x0 - 12;
    const xMax = v.x0 + v.w + 12;
    eachTile(xMin, xMax, WALL_W, scroll, WALL_S, (m) => out.push(L.Wall * 8 + (tileHash(m, 5) % WALL_VARIANTS)));
    eachTile(xMin, xMax, WALL_W, scroll * TOP_PARALLAX, 1, (m) => out.push(L.Top * 8 + (tileHash(m, 11) % TOP_VARIANTS)));
    return out;
  }

  /** Total backing-store bytes of every cached corridor tile. */
  bytes(): number {
    return this.caches.reduce((b, c) => b + c.bytes(), 0);
  }

  /** Draw one scene, offset by (ox, oy) and clipped to its shifted copy of the view. */
  drawScene(ctx: Ctx, v: View, s: Scene, scroll: number, t: number, ox: number, oy: number): void {
    const key = sceneKey(s, v);
    let c = this.caches.find((x) => x.key === key);
    if (!c) {
      // not requested via sync (e.g. preview); build on demand, keeping the two-scene cap
      this.sync(v, [s, ...this.caches.slice(0, 1).map((x) => ({ world: x.world, variant: x.variant }))]);
      c = this.caches.find((x) => x.key === key) as SceneCache;
    }
    const shifted = ox !== 0 || oy !== 0;
    if (shifted) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(v.x0 - 12 + ox, v.y0 - 12 + oy, v.w + 24, v.h + 24);
      ctx.clip();
      ctx.translate(ox, oy);
    }
    const xMin = v.x0 - 12 - ox;
    const xMax = v.x0 + v.w + 12 - ox;
    ctx.fillStyle = '#05060A';
    ctx.fillRect(xMin, v.y0 - 12 - oy, xMax - xMin, v.h + 24);
    this.drawTop(ctx, v, c, scroll, t, xMin, xMax);
    eachTile(xMin, xMax, WALL_W, scroll, WALL_S, (m, sx) => {
      const img = c.tile(L.Wall, tileHash(m, 5) % WALL_VARIANTS);
      ctx.drawImage(img, sx, FLOOR_BACK - WALL_H * WALL_S, WALL_W * WALL_S, WALL_H * WALL_S);
    });
    const ceil = c.tile(L.Ceil, 0);
    eachTile(xMin, xMax, PLANE_W, scroll, 1, (_m, sx) => ctx.drawImage(ceil, sx, CEIL_TOP, PLANE_W, CEIL_LAYER_H));
    this.drawFloor(ctx, c.tile(L.Floor, 0), scroll, xMin, xMax);
    if (shifted) ctx.restore();
  }

  private drawTop(ctx: Ctx, v: View, c: SceneCache, scroll: number, t: number, xMin: number, xMax: number): void {
    const sc = scroll * TOP_PARALLAX;
    const th = themeOf(c.world);
    eachTile(xMin, xMax, WALL_W, sc, 1, (m, sx) => {
      const idx = tileHash(m, 11) % TOP_VARIANTS;
      ctx.drawImage(c.tile(L.Top, idx), sx, TOP_Y, WALL_W, TOP_H);
      if (c.variant !== 'dark') topFx(ctx, v, sx, idx, t, th);
    });
  }

  /** Floor surface in depth strips (each x-scaled around PLAYER_X), then the front face. */
  private drawFloor(ctx: Ctx, img: HTMLCanvasElement, scroll: number, xMin: number, xMax: number): void {
    const ky = img.height / (FLOOR_BOT - FLOOR_TOP);
    const strip = (y0: number, y1: number, s: number): void => {
      const sy = (y0 - FLOOR_TOP) * ky;
      const sh = Math.max(1, (y1 - y0) * ky);
      // +0.6 logical px of overlap hides hairline gaps between strips
      eachTile(xMin, xMax, PLANE_W, scroll, s, (_m, sx) => {
        ctx.drawImage(img, 0, sy, img.width, sh, sx, y0, PLANE_W * s + 0.6, y1 - y0 + 0.6);
      });
    };
    const step = (FLOOR_FRONT - FLOOR_BACK) / FLOOR_STRIPS;
    for (let i = 0; i < FLOOR_STRIPS; i++) {
      const y0 = FLOOR_BACK + i * step;
      strip(y0, y0 + step, depthScale(depthAtY(y0 + step / 2)));
    }
    strip(FLOOR_FRONT, FLOOR_BOT, depthScale(FRONT_DEPTH));
  }

  release(): void {
    for (const c of this.caches) c.release();
    this.caches = [];
  }
}
