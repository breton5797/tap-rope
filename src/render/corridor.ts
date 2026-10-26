// Corridor background: pre-rendered tiles cached per (theme, variant, view) = one SceneCache.
// The above-ceiling band scrolls at TOP_PARALLAX; the back wall stands on the floor's far edge and
// is drawn at that depth's scale (perspective around PLAYER_X); the ceiling band scrolls 1:1; the
// floor is drawn in thin depth strips so it reads as a plane seen from ~20° above.
// Memory: only the current scene is kept, plus at most ONE other scene while a door transition
// needs it (the next scene is built in the background before the door; the outgoing procedural
// scene is trimmed to the tiles it still shows). v6: themes with photo art (ArtStore) bake their
// wall / floor / ceiling-strip tiles from the photos, one photo decoded at a time; every tile gets
// the variant's cinematic grade baked in.
import { GROUND_Y, PLAYER_X, type Scene, type Variant, type WorldId } from '../types';
import type { ArtStore, Photo, PhotoSet } from './art';
import {
  FLOOR_PW, grade, lampsOf, PHOTO_TOP_H, photoFloor, photoTop, photoWall, plainWall, skyBand, themeDim, TOP_PW, WALL_PW,
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
const APRON_STRIPS = 6;
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
/** no light shafts (open sky / nothing drawn yet) */
const NO_RIG: ShaftRig = { w: PLANE_W, xs: [], s: 1, y: CEIL_BOT };

function tileHash(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
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

/** stand-in for a photo tile that is not baked yet (never drawn: photo caches draw when complete) */
let EMPTY: HTMLCanvasElement | null = null;

function empty(): HTMLCanvasElement {
  if (!EMPTY) EMPTY = makeCanvas(1, 1).canvas;
  return EMPTY;
}

/**
 * All baked tiles of one look. Procedural tiles bake lazily and synchronously. Photo tiles bake in
 * the background, one per step(): the tile's photo is requested (decoded off-thread), baked when
 * ready and released immediately, so a photo cache never holds more than one decoded photo.
 */
class SceneCache {
  private readonly tiles: (HTMLCanvasElement | null)[][];
  readonly spec: readonly LayerSpec[];
  private readonly k: number;
  /** tiles drawn since the last trim (layer * 8 + index) */
  private readonly used = new Set<number>();
  readonly viewKey: string;

  /** `photo` = the theme's usable photo files (null = procedural look) */
  constructor(
    readonly world: WorldId, readonly variant: Variant, v: View, readonly photo: PhotoSet | null, private readonly art: ArtStore,
  ) {
    this.viewKey = v.key;
    this.k = Math.min(v.s * Math.min(v.dpr, MAX_TILE_DPR), MAX_TILE_K);
    const walls = photo?.walls.length ?? 0;
    this.spec = [
      photo?.ceiling || photo?.sky ? { count: 1, w: TOP_PW } : { count: TOP_VARIANTS, w: WALL_W },
      walls > 0 ? { count: walls, w: WALL_PW } : { count: 1, w: WALL_W },
      { count: 1, w: PLANE_W },
      photo?.floor ? { count: 1, w: FLOOR_PW } : { count: 1, w: PLANE_W },
    ];
    this.tiles = this.spec.map((l) => new Array<HTMLCanvasElement | null>(l.count).fill(null));
  }

  /** true once every tile is baked */
  complete(): boolean {
    return this.tiles.every((row) => row.every((c) => c !== null));
  }

  /** a photo cache can draw only when complete; a procedural one always (it bakes on demand) */
  drawable(): boolean {
    return !this.photo || this.complete();
  }

  /** false once one of its photos failed to decode (the cache must be rebuilt without it) */
  valid(): boolean {
    const p = this.photo;
    if (!p) return true;
    return p.walls.every((n) => this.art.ok(n)) && (!p.floor || this.art.ok(p.floor)) && (!p.ceiling || this.art.ok(p.ceiling));
  }

  matches(s: Scene): boolean {
    return this.world === s.world && this.variant === s.variant;
  }

  tile(layer: L, i: number): HTMLCanvasElement {
    this.used.add(layer * 8 + i);
    return this.tiles[layer][i] ?? (this.photoFile(layer, i) ? empty() : this.bakeProcedural(layer, i));
  }

  /** Bake the next missing tile (photo tiles: once their photo has decoded). */
  step(): void {
    for (let l = 0; l < this.tiles.length; l++) {
      const i = this.tiles[l].indexOf(null);
      if (i < 0) continue;
      const file = this.photoFile(l as L, i);
      if (!file) {
        this.bakeProcedural(l as L, i);
        return;
      }
      const img = this.art.request(file);
      if (!img) return; // decoding; try again next frame
      this.tiles[l][i] = this.bakePhoto(l as L, img);
      this.art.release(file);
      return;
    }
  }

  /** Release every tile not drawn since the previous trim (procedural caches only). */
  trimToUsed(): void {
    // photo tiles are never trimmed: re-baking one would need its photo decoded again
    if (this.used.size === 0 || this.photo) {
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

  /** The photo file a tile is baked from (null = procedural tile). */
  private photoFile(layer: L, i: number): string | null {
    const p = this.photo;
    if (!p) return null;
    if (layer === L.Top) return p.ceiling;
    if (layer === L.Wall) return p.walls[i] ?? null;
    if (layer === L.Floor) return p.floor;
    return null;
  }

  private bakePhoto(layer: L, img: Photo): HTMLCanvasElement {
    const w = this.spec[layer].w;
    if (layer === L.Top) return this.bakeOne(w, 0, PHOTO_TOP_H, PHOTO_TOP_RES, (ctx) => photoTop(ctx, img));
    if (layer === L.Wall) return this.bakeOne(w, CEIL_Y, WALL_H, 1, (ctx) => photoWall(ctx, img));
    return this.bakeOne(w, FLOOR_TOP, FLOOR_BOT - FLOOR_TOP, PHOTO_FLOOR_RES, (ctx) => photoFloor(ctx, img, FLOOR_BOT, this.world));
  }

  private bakeProcedural(layer: L, i: number): HTMLCanvasElement {
    const th = themeOf(this.world);
    const variant = this.variant;
    const w = this.spec[layer].w;
    let c: HTMLCanvasElement;
    const sky = this.photo?.sky;
    if (layer === L.Top && sky) c = this.bakeOne(w, 0, PHOTO_TOP_H, PHOTO_TOP_RES, (ctx) => skyBand(ctx, sky));
    else if (layer === L.Top) c = this.bakeOne(w, TOP_Y, TOP_H, TOP_RES, (ctx) => drawTop(ctx, w, th, i));
    else if (layer === L.Wall) c = this.bakeOne(w, CEIL_Y, WALL_H, 1, (ctx) => plainWall(ctx, th.base, w));
    else if (layer === L.Ceil) {
      // only the opaque girder band is graded; the light glow below it stays transparent. With a
      // photo ceiling the band is dropped (the photo has the ceiling + lamps); alarm keeps its sirens.
      const band = !this.photo?.ceiling && !this.photo?.sky;
      c = this.bakeOne(w, CEIL_TOP, CEIL_LAYER_H, 1, (ctx) => {
        if (band) drawCeiling(ctx, w, th);
        if (variant === 'alarm') for (const x of SIREN_X) sirenHousing(ctx, x);
      }, band ? CEIL_BOT - CEIL_TOP : 0);
    } else c = this.bakeOne(w, FLOOR_TOP, FLOOR_BOT - FLOOR_TOP, 1, (ctx) => drawFloor(ctx, w, th, variant));
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
  /** every live cache (≤ 2 scenes, each with at most a drawable cache + one being built) */
  private caches: SceneCache[] = [];
  /** the cache drawn for slot 0 (current scene) and slot 1 (door scene) this frame */
  private readonly drawn: (SceneCache | null)[] = [null, null];
  private readonly keep: SceneCache[] = [];

  constructor(private readonly art: ArtStore) {}

  /**
   * Keep the current scene (slot 0) and at most one door scene (slot 1) and release every other
   * cache. Per scene the target is a photo cache (when the theme has usable photos) built in the
   * background one tile per frame; until it is complete the scene draws whatever it already has
   * (the previous view's cache after a resize, or a procedural cache) — so photos never pop in
   * over a procedural look, except at boot before the first photo cache is ready. A door scene is
   * only built in the background; it gets a procedural stand-in only if it must be drawn first.
   */
  sync(v: View, cur: Scene, extra: Scene | null): void {
    const k = this.keep;
    k.length = 0;
    this.drawn[0] = this.ensure(v, cur, true);
    this.drawn[1] = extra && !(extra.world === cur.world && extra.variant === cur.variant) ? this.ensure(v, extra, false) : null;
    for (const c of this.caches) if (!k.includes(c)) c.release();
    this.caches.length = 0;
    for (const c of k) this.caches.push(c);
  }

  /** Make sure scene s has its target cache (building) and return the cache to draw (maybe null). */
  private ensure(v: View, s: Scene, mustDraw: boolean): SceneCache | null {
    // while the art is still downloading the photo set isn't final: draw the neutral stand-in
    // rather than baking a partial set (that is how a photo wall over a procedural floor used to stick)
    if (this.art.fetching()) return null;
    const photo = this.art.photoSet(s.world, s.variant);
    let target: SceneCache | null = null;
    let stand: SceneCache | null = null;
    for (const c of this.caches) {
      if (!c.matches(s) || !c.valid()) continue;
      // exact = same view AND the same photo set (a cache built while files were still arriving is stale)
      const exact = c.viewKey === v.key && c.photo === photo;
      if (exact) target = c;
      else if (c.drawable() && (c.photo || !photo) && (!stand || c.photo)) stand = c;
    }
    if (!target) target = new SceneCache(s.world, s.variant, v, photo, this.art);
    this.keep.push(target);
    // up to two tiles per frame (photo tiles still wait for their decode)
    if (!target.complete()) target.step();
    if (!target.complete()) target.step();
    if (target.drawable()) return target;
    // never show the procedural look when photos exist (or may still arrive): the caller draws a
    // dark neutral stand-in instead until the photo cache is complete
    if (!stand && mustDraw && !photo) stand = new SceneCache(s.world, s.variant, v, null, this.art);
    if (stand) this.keep.push(stand);
    return stand;
  }

  /** Debug / test probe: what is drawn for scene s (null = the dark neutral stand-in). */
  probe(s: Scene): { photo: boolean; complete: boolean; sky: boolean } | null {
    const c = this.cacheFor(s);
    return c ? { photo: c.photo !== null, complete: c.complete(), sky: !!c.photo?.sky } : null;
  }

  /** After drawing: trim the door scene's cache (e.g. the outgoing one) to the tiles it showed. */
  endFrame(): void {
    this.drawn[0]?.clearUsed();
    this.drawn[1]?.trimToUsed();
  }

  /**
   * Where the light shafts fall for a scene: tile width / lamp x's (tile px) / depth scale / top y.
   * Photo ceilings use the lamps baked into the art; the procedural band its own fixtures.
   */
  shaftRig(s: Scene): ShaftRig {
    const c = this.cacheFor(s);
    if (!c || c.photo?.sky) return NO_RIG;
    return c.photo?.ceiling ? this.rigs[s.world] : PROC_RIG;
  }

  private cacheFor(s: Scene): SceneCache | null {
    for (const c of this.drawn) if (c && c.matches(s)) return c;
    return null;
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
    let c = this.cacheFor(s);
    if (!c) {
      // not requested via sync: make it the only scene (keeps the two-scene cap)
      this.sync(v, s, null);
      c = this.drawn[0];
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
    if (!c) {
      neutral(ctx, xMin, xMax);
      if (shifted) ctx.restore();
      return;
    }
    this.drawTop(ctx, v, c, scroll, t, xMin, xMax);
    const ww = c.spec[L.Wall].w;
    const wn = c.spec[L.Wall].count;
    eachTile(xMin, xMax, ww, scroll, WALL_S, (m, sx) => {
      const img = c.tile(L.Wall, tileHash(m, 5) % wn);
      ctx.drawImage(img, sx, FLOOR_BACK - WALL_H * WALL_S, ww * WALL_S, WALL_H * WALL_S);
    });
    if (c.photo?.ceiling || c.photo?.sky) soffit(ctx, xMin, xMax);
    if ((!c.photo?.ceiling && !c.photo?.sky) || c.variant === 'alarm') {
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
    const photo = !!c.photo?.ceiling || !!c.photo?.sky;
    if (photo) {
      // the photo ceiling (or open sky) hangs right above the back wall, at its depth and scroll
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
    // the apron in front of the lanes continues down to the bottom of tall screens
    const apron = (FLOOR_BOT - FLOOR_FRONT) / APRON_STRIPS;
    for (let i = 0; i < APRON_STRIPS; i++) {
      const y0 = FLOOR_FRONT + i * apron;
      strip(y0, y0 + apron, i === 0 ? depthScale(FRONT_DEPTH) : depthScale(depthAtY(y0 + apron / 2)));
    }
  }

  release(): void {
    for (const c of this.caches) c.release();
    this.caches = [];
  }
}

/** Dark neutral stand-in while a photo scene is still baking: no procedural detail, just the
 * room's masses (wall, floor) in near-black so nothing pops when the photos arrive. */
function neutral(ctx: Ctx, xMin: number, xMax: number): void {
  ctx.fillStyle = '#121619';
  ctx.fillRect(xMin, WALL_TOP_Y, xMax - xMin, FLOOR_BACK - WALL_TOP_Y);
  ctx.fillStyle = '#1A1E21';
  ctx.fillRect(xMin, FLOOR_BACK, xMax - xMin, FLOOR_FRONT - FLOOR_BACK);
  ctx.fillStyle = '#0B0D0F';
  ctx.fillRect(xMin, FLOOR_FRONT, xMax - xMin, FLOOR_BOT - FLOOR_FRONT);
}

/** cached soffit gradient (per context): the shadow where the ceiling strip meets the wall */
let SOFFIT: { ctx: Ctx; g: CanvasGradient } | null = null;
const SOFFIT_H = 30;

/** Soft shadow + feathered overlap hiding the hard seam between the ceiling photo and the wall. */
function soffit(ctx: Ctx, xMin: number, xMax: number): void {
  if (!SOFFIT || SOFFIT.ctx !== ctx) {
    const g = ctx.createLinearGradient(0, WALL_TOP_Y - 8, 0, WALL_TOP_Y + SOFFIT_H);
    g.addColorStop(0, 'rgba(4,6,8,0)');
    g.addColorStop(0.2, 'rgba(4,6,8,0.62)');
    g.addColorStop(0.45, 'rgba(4,6,8,0.4)');
    g.addColorStop(1, 'rgba(4,6,8,0)');
    SOFFIT = { ctx, g };
  }
  ctx.fillStyle = SOFFIT.g;
  ctx.fillRect(xMin, WALL_TOP_Y - 8, xMax - xMin, SOFFIT_H + 8);
}
