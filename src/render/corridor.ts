// Corridor background: pre-rendered tiles cached per (theme, variant, view) = one SceneCache.
// The above-ceiling band scrolls at TOP_PARALLAX; the back wall stands on the floor's far edge and
// is drawn at that depth's scale (perspective around PLAYER_X); the ceiling band scrolls 1:1; the
// floor is drawn in thin depth strips so it reads as a plane seen from ~20° above.
// Memory: only the current scene is kept, plus at most ONE other scene while a door transition
// needs it. The incoming scene pre-bakes only the tiles visible at the door (one per frame); the
// outgoing scene is trimmed to the tiles it still shows each frame and released when done.
// v6: when the theme's photo art is decoded (ArtStore) the wall / floor / top layers bake from the
// photos (3 wall variants); until then (or without art) they bake procedurally. Every tile gets the
// variant's cinematic grade baked in.
import { GROUND_Y, PLAYER_X, type Scene, type Variant, type WorldId } from '../types';
import type { ArtStore, ThemeArt } from './art';
import {
  FLOOR_PW, grade, lampsOf, PHOTO_TOP_H, photoFloor, photoTop, photoWall, plainWall, themeDim, TOP_PW, WALL_PW,
} from './photo';
import { sirenHousing, SIREN_X } from './corridor-fx';
import { CEIL_Y, depthAtY, depthScale, FLOOR_BACK, FLOOR_FRONT, FRONT_DEPTH, WALL_DEPTH } from './layout';
import { drawCeiling, drawFloor, CEIL_BOT, CEIL_TOP, FLOOR_BOT, FLOOR_TOP } from './plane';
import { PLANE_W, themeOf, WALL_W } from './themes';
import { drawTop, TOP_VARIANTS, TOP_Y, topFx } from './top-band';
import { makeCanvas, releaseCanvas, type Ctx } from './util';
import type { View } from './view';

export const TOP_PARALLAX = 0.55;
/** the dim band above the ceiling is rendered at reduced resolution */
const TOP_RES = 0.65;
/** corridor tiles bake at most at this device-pixel ratio (memory: iOS Safari canvas limits) */
const MAX_TILE_DPR = 2;
/** …and never denser than this many device px per logical px (big iPads) */
const MAX_TILE_K = 2.0;
/** photo floor / top band bake at reduced resolution (the floor is re-sampled into strips anyway) */
const PHOTO_FLOOR_RES = 0.8;
const PHOTO_TOP_RES = 0.5;
/** floor surface strips (more = smoother converging seams) */
const FLOOR_STRIPS = 20;
const WALL_S = depthScale(WALL_DEPTH);
const WALL_H = GROUND_Y - CEIL_Y;
const TOP_H = CEIL_Y + 6 - TOP_Y;
/** screen y of the back wall's top edge (photo ceilings sit right above it, at the wall's depth) */
const WALL_TOP_Y = FLOOR_BACK - (GROUND_Y - CEIL_Y) * depthScale(WALL_DEPTH);
const CEIL_LAYER_H = CEIL_BOT - CEIL_TOP + 44;


export interface ShaftRig {
  readonly w: number;
  readonly xs: readonly number[];
  readonly s: number;
  readonly y: number;
}

/** procedural ceiling band fixtures: x = 40 + 160k, 60 wide (see plane.drawCeiling) */
const PROC_RIG: ShaftRig = { w: PLANE_W, xs: [70, 230, 390], s: 1, y: CEIL_BOT - 2 };

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

interface LayerSpec {
  readonly count: number;
  readonly w: number;
}

/** All baked tiles of one look; tiles bake lazily (on demand or one per warm() call). */
class SceneCache {
  private readonly tiles: (HTMLCanvasElement | null)[][];
  readonly spec: readonly LayerSpec[];
  private readonly k: number;
  /** tiles drawn since the last trim (layer * 8 + index) */
  private readonly used = new Set<number>();
  private readonly viewKey: string;

  /** `art` = decoded photos for this theme (null = procedural look) */
  constructor(
    readonly key: string, readonly world: WorldId, readonly variant: Variant, v: View, readonly art: ThemeArt | null,
  ) {
    this.viewKey = v.key;
    this.k = Math.min(v.s * Math.min(v.dpr, MAX_TILE_DPR), MAX_TILE_K);
    const walls = art?.walls.length ?? 0;
    this.spec = [
      art?.ceiling ? { count: 1, w: TOP_PW } : { count: TOP_VARIANTS, w: WALL_W },
      walls > 0 ? { count: walls, w: WALL_PW } : { count: 1, w: WALL_W },
      { count: 1, w: PLANE_W },
      art?.floor ? { count: 1, w: FLOOR_PW } : { count: 1, w: PLANE_W },
    ];
    this.tiles = this.spec.map((l) => new Array<HTMLCanvasElement | null>(l.count).fill(null));
  }

  /** true once every tile is baked (the photos are no longer needed) */
  complete(): boolean {
    return this.tiles.every((row) => row.every((c) => c !== null));
  }

  matches(s: Scene, v: View): boolean {
    return this.world === s.world && this.variant === s.variant && this.viewKey === v.key;
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

  /** Bake the first missing tile of any layer; false when complete. */
  warmAny(): boolean {
    for (let l = 0; l < this.tiles.length; l++) {
      const i = this.tiles[l].indexOf(null);
      if (i >= 0) {
        this.bake(l as L, i);
        return true;
      }
    }
    return false;
  }

  /** Release every tile not drawn since the previous trim (no-op if nothing was drawn). */
  trimToUsed(): void {
    // photo caches are never trimmed: their photos are closed once baked, so a trimmed tile
    // could not be re-baked (and a photo scene is only 6 tiles)
    if (this.used.size === 0 || this.art) {
      this.used.clear();
      return;
    }
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
    const art = this.art;
    const w = this.spec[layer].w;
    let c: HTMLCanvasElement;
    if (layer === L.Top) {
      const img = art?.ceiling;
      c = img
        ? this.bakeOne(w, 0, PHOTO_TOP_H, PHOTO_TOP_RES, (ctx) => photoTop(ctx, img))
        : this.bakeOne(w, TOP_Y, TOP_H, TOP_RES, (ctx) => drawTop(ctx, w, th, i));
    } else if (layer === L.Wall) {
      const img = art?.walls[i];
      c = img
        ? this.bakeOne(w, CEIL_Y, WALL_H, 1, (ctx) => photoWall(ctx, img))
        : this.bakeOne(w, CEIL_Y, WALL_H, 1, (ctx) => plainWall(ctx, th.base, w));
    } else if (layer === L.Ceil) {
      // only the opaque girder band is graded; the light glow below it stays transparent. With a
      // photo ceiling the band is dropped (the photo has the ceiling + lamps); alarm keeps its sirens.
      const band = !art?.ceiling;
      c = this.bakeOne(w, CEIL_TOP, CEIL_LAYER_H, 1, (ctx) => {
        if (band) drawCeiling(ctx, w, th);
        if (variant === 'alarm') for (const x of SIREN_X) sirenHousing(ctx, x);
      }, band ? CEIL_BOT - CEIL_TOP : 0);
    } else {
      const img = art?.floor;
      c = img
        ? this.bakeOne(w, FLOOR_TOP, FLOOR_BOT - FLOOR_TOP, PHOTO_FLOOR_RES, (ctx) => photoFloor(ctx, img, FLOOR_BOT, this.world))
        : this.bakeOne(w, FLOOR_TOP, FLOOR_BOT - FLOOR_TOP, 1, (ctx) => drawFloor(ctx, w, th, variant));
    }
    this.tiles[layer][i] = c;
    return c;
  }

  private bakeOne(w: number, y: number, h: number, res: number, draw: (ctx: Ctx) => void, gradeH = h): HTMLCanvasElement {
    const k = this.k * res;
    const { canvas, ctx } = makeCanvas(w * k, h * k);
    ctx.setTransform(k, 0, 0, k, 0, -y * k);
    draw(ctx);
    if (gradeH > 0) grade(ctx, this.variant, 0, y, w, gradeH, themeDim(this.world));
    return canvas;
  }
}

export class Corridor {
  private caches: SceneCache[] = [];

  constructor(private readonly art: ArtStore) {}

  /**
   * Keep exactly the current scene (slot 0) and at most one door scene (slot 1); release the rest.
   * The door scene pre-bakes, one tile per call, the tiles visible at `warmScroll` (the corridor
   * scroll at the door), so the transition never stalls a frame. No per-frame allocations once
   * both caches exist.
   */
  sync(v: View, cur: Scene, extra: Scene | null, warmScroll = 0): void {
    const a = this.take(v, cur, true) as SceneCache;
    const b = extra && !(extra.world === cur.world && extra.variant === cur.variant) ? this.take(v, extra, false) : null;
    for (const c of this.caches) if (c !== a && c !== b) c.release();
    this.caches.length = 0;
    this.caches.push(a);
    // photo caches finish baking (one tile per frame) so their decoded photos can be closed
    if (a.art && !a.complete()) a.warmAny();
    if (b) {
      this.caches.push(b);
      this.fillVisibleTiles(v, b, warmScroll);
      if (!b.warm(this.needed) && b.art) b.warmAny();
    }
    // photos stay decoded only while a cache of that theme still has tiles to bake
    this.keep.length = 0;
    for (const c of this.caches) if (c.art && !c.complete() && !this.keep.includes(c.world)) this.keep.push(c.world);
    if (b && !b.art && this.art.has(b.world)) this.keep.push(b.world);
    if (!a.art && this.art.has(a.world)) this.keep.push(a.world);
    this.art.keepOnly(this.keep);
  }

  private readonly keep: WorldId[] = [];

  /**
   * The cache for scene s (existing or new; not yet placed in a slot). A procedural cache is
   * replaced once its theme's photos are decoded. A door scene with photos still decoding is not
   * created yet (null), so it never bakes a procedural look that would pop to photo later.
   */
  private take(v: View, s: Scene, current: boolean): SceneCache | null {
    for (const c of this.caches) {
      if (!c.matches(s, v)) continue;
      if (c.art || !this.art.has(s.world)) return c;
      const art = this.art.theme(s.world);
      if (!art) return c;
      c.release();
      return new SceneCache(sceneKey(s, v), s.world, s.variant, v, art);
    }
    const art = this.art.theme(s.world);
    if (!art && this.art.has(s.world) && !current) return null;
    return new SceneCache(sceneKey(s, v), s.world, s.variant, v, art);
  }

  /** After drawing: trim the door scene (slot 1, e.g. the outgoing one) to the tiles it showed. */
  endFrame(): void {
    this.caches.forEach((c, i) => (i > 0 ? c.trimToUsed() : c.clearUsed()));
  }

  /** Tile ids (layer * 8 + index) visible at a given scroll into this.needed: floor, ceiling, walls, top. */
  private fillVisibleTiles(v: View, c: SceneCache, scroll: number): void {
    const out = this.needed;
    out.length = 0;
    out.push(L.Floor * 8, L.Ceil * 8);
    const xMin = v.x0 - 12;
    const xMax = v.x0 + v.w + 12;
    this.wallCount = c.spec[L.Wall].count;
    this.topCount = c.spec[L.Top].count;
    eachTile(xMin, xMax, c.spec[L.Wall].w, scroll, WALL_S, this.pushWall);
    if (c.art?.ceiling) eachTile(xMin, xMax, c.spec[L.Top].w, scroll, WALL_S, this.pushTop);
    else eachTile(xMin, xMax, c.spec[L.Top].w, scroll * TOP_PARALLAX, 1, this.pushTop);
  }

  private readonly needed: number[] = [];
  private wallCount = 1;
  private topCount = 1;
  private readonly pushWall = (m: number): void => {
    this.needed.push(L.Wall * 8 + (tileHash(m, 5) % this.wallCount));
  };
  private readonly pushTop = (m: number): void => {
    this.needed.push(L.Top * 8 + (tileHash(m, 11) % this.topCount));
  };

  /**
   * Where the light shafts fall for a scene: tile width / lamp x's (tile px) / depth scale / top y.
   * Photo ceilings use the lamps baked into the art; the procedural band its own fixtures.
   */
  shaftRig(s: Scene, v: View): ShaftRig {
    let photo = false;
    for (const c of this.caches) if (c.matches(s, v) && c.art?.ceiling) photo = true;
    if (!photo) return PROC_RIG;
    const r = this.rigs[s.world];
    return r;
  }

  private readonly rigs: readonly ShaftRig[] = [0, 1, 2, 3].map((t) => ({
    w: TOP_PW, xs: lampsOf(t), s: WALL_S, y: WALL_TOP_Y - 18,
  }));

  /** Total backing-store bytes of every cached corridor tile. */
  bytes(): number {
    return this.caches.reduce((b, c) => b + c.bytes(), 0);
  }

  /** Draw one scene, offset by (ox, oy) and clipped to its shifted copy of the view. */
  drawScene(ctx: Ctx, v: View, s: Scene, scroll: number, t: number, ox: number, oy: number): void {
    let c: SceneCache | null = null;
    for (const x of this.caches) if (x.matches(s, v)) c = x;
    if (!c) {
      // not requested via sync: build on demand as the only scene (keeps the two-scene cap)
      this.sync(v, s, null);
      c = this.caches[0];
    }
    if (!c) {
      return;
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
    const ww = c.spec[L.Wall].w;
    const wn = c.spec[L.Wall].count;
    eachTile(xMin, xMax, ww, scroll, WALL_S, (m, sx) => {
      const img = c.tile(L.Wall, tileHash(m, 5) % wn);
      ctx.drawImage(img, sx, FLOOR_BACK - WALL_H * WALL_S, ww * WALL_S, WALL_H * WALL_S);
    });
    if (!c.art?.ceiling || c.variant === 'alarm') {
      const ceil = c.tile(L.Ceil, 0);
      eachTile(xMin, xMax, PLANE_W, scroll, 1, (_m, sx) => ctx.drawImage(ceil, sx, CEIL_TOP, PLANE_W, CEIL_LAYER_H));
    }
    this.drawFloor(ctx, c.tile(L.Floor, 0), c.spec[L.Floor].w, scroll, xMin, xMax);
    if (shifted) ctx.restore();
  }

  private drawTop(ctx: Ctx, v: View, c: SceneCache, scroll: number, t: number, xMin: number, xMax: number): void {
    const sc = scroll * TOP_PARALLAX;
    const th = themeOf(c.world);
    const tw = c.spec[L.Top].w;
    const tn = c.spec[L.Top].count;
    const photo = !!c.art?.ceiling;
    if (photo) {
      // the photo ceiling hangs right above the back wall, at its depth and scroll
      const h = PHOTO_TOP_H * WALL_S;
      eachTile(xMin, xMax, tw, scroll, WALL_S, (_m, sx) => ctx.drawImage(c.tile(L.Top, 0), sx, WALL_TOP_Y - h, tw * WALL_S + 0.5, h));
      return;
    }
    eachTile(xMin, xMax, tw, sc, 1, (m, sx) => {
      const idx = tileHash(m, 11) % tn;
      ctx.drawImage(c.tile(L.Top, idx), sx, TOP_Y, tw, TOP_H);
      if (!photo && c.variant !== 'dark') topFx(ctx, v, sx, idx, t, th);
    });
  }

  /** Floor surface in depth strips (each x-scaled around PLAYER_X), then the front face. */
  private drawFloor(ctx: Ctx, img: HTMLCanvasElement, fw: number, scroll: number, xMin: number, xMax: number): void {
    const ky = img.height / (FLOOR_BOT - FLOOR_TOP);
    const strip = (y0: number, y1: number, s: number): void => {
      const sy = (y0 - FLOOR_TOP) * ky;
      const sh = Math.max(1, (y1 - y0) * ky);
      // +0.6 logical px of overlap hides hairline gaps between strips
      eachTile(xMin, xMax, fw, scroll, s, (_m, sx) => {
        ctx.drawImage(img, 0, sy, img.width, sh, sx, y0, fw * s + 0.6, y1 - y0 + 0.6);
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
