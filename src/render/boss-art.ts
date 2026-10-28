// Boss photo sprite (GDD-v7 §1): `./art/boss-<id>.webp` (transparent). Only the current boss is fetched;
// the compressed Blob is kept (tens of KB) and decoded only to bake ONE canvas at the size it is drawn
// (box × scale × device px), after which the bitmap is closed. A resize re-bakes from the Blob. Any
// failure (missing file, decode error) leaves the procedural silhouette in place.
import type { BossId } from '../types';
import { BOSS_PHOTO_GRADE } from './boss-rigs';
import { makeCanvas, releaseCanvas } from './util';

interface Baked {
  canvas: HTMLCanvasElement;
  /** device px per logical px it was baked for, and the logical size it covers */
  k: number;
  w: number;
  h: number;
}

let currentId: BossId | null = null;
let blob: Blob | null = null;
let missing = false;
let busy = false;
let baked: Baked | null = null;

/** where the trimmed subject sits inside the boss box (fractions of the box), see bossPhotoFit() */
export interface FitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const FIT: FitRect = { x: 0, y: 0, w: 1, h: 1 };

/** the photo's opaque bounding box in source px (trimmed once per decode) */
const BOX = { x: 0, y: 0, w: 1, h: 1 };

/** Opaque (alpha > 16) bounding box of a bitmap, scanned on a ≤256px copy. */
function opaqueBox(bmp: ImageBitmap): void {
  const sc = Math.min(1, 256 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * sc));
  const h = Math.max(1, Math.round(bmp.height * sc));
  const probe = makeCanvas(w, h);
  probe.ctx.drawImage(bmp, 0, 0, w, h);
  const d = probe.ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] <= 16) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  releaseCanvas(probe.canvas);
  if (x1 < 0) {
    BOX.x = 0;
    BOX.y = 0;
    BOX.w = bmp.width;
    BOX.h = bmp.height;
    return;
  }
  BOX.x = x0 / sc;
  BOX.y = y0 / sc;
  BOX.w = (x1 - x0 + 1) / sc;
  BOX.h = (y1 - y0 + 1) / sc;
}
/** bumps on every boss switch so stale async work is dropped */
let generation = 0;

async function fetchArt(id: BossId, gen: number): Promise<void> {
  try {
    const res = await fetch(`./art/boss-${id}.webp`, { cache: 'force-cache' });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || (type && !type.startsWith('image/'))) throw new Error('no art');
    const b = await res.blob();
    if (gen !== generation) return;
    if (b.size === 0) throw new Error('empty');
    blob = b;
  } catch {
    if (gen === generation) missing = true;
  } finally {
    if (gen === generation) busy = false;
  }
}

async function bake(gen: number, k: number, w: number, h: number): Promise<void> {
  try {
    if (!blob || typeof createImageBitmap !== 'function') throw new Error('no bitmap');
    const bmp = await createImageBitmap(blob);
    if (gen !== generation) {
      bmp.close();
      return;
    }
    opaqueBox(bmp);
    const surf = makeCanvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    // the trimmed subject, fitted (contain) into the box, bottom-aligned and centred
    const cw = surf.canvas.width;
    const ch = surf.canvas.height;
    const fit = Math.min(cw / BOX.w, ch / BOX.h);
    const dw = BOX.w * fit;
    const dh = BOX.h * fit;
    const dx = (cw - dw) / 2;
    const dy = ch - dh;
    surf.ctx.drawImage(bmp, BOX.x, BOX.y, BOX.w, BOX.h, dx, dy, dw, dh);
    bmp.close();
    // grade the photo into the corridor: teal shadow tone, darker toward its base (background depth)
    if (BOSS_PHOTO_GRADE) {
      const g = surf.ctx.createLinearGradient(0, 0, 0, ch);
      for (const [at, c] of BOSS_PHOTO_GRADE) g.addColorStop(at, c);
      surf.ctx.globalCompositeOperation = 'source-atop';
      surf.ctx.fillStyle = g;
      surf.ctx.fillRect(0, 0, cw, ch);
      surf.ctx.globalCompositeOperation = 'source-over';
    }
    FIT.x = dx / cw;
    FIT.y = dy / ch;
    FIT.w = dw / cw;
    FIT.h = dh / ch;
    if (baked) releaseCanvas(baked.canvas);
    baked = { canvas: surf.canvas, k, w, h };
  } catch {
    if (gen === generation) missing = true;
  } finally {
    if (gen === generation) busy = false;
  }
}

/**
 * The baked photo for boss `id` drawn at logical size w×h on a canvas of k device px per logical px,
 * or null while it loads / when it doesn't exist. Kicks off fetch / decode work as needed.
 */
export function bossPhoto(id: BossId, w: number, h: number, k: number): HTMLCanvasElement | null {
  if (id !== currentId) {
    generation++;
    currentId = id;
    blob = null;
    missing = false;
    busy = false;
    if (baked) releaseCanvas(baked.canvas);
    baked = null;
    FIT.x = 0;
    FIT.y = 0;
    FIT.w = 1;
    FIT.h = 1;
  }
  if (missing) return null;
  const stale = !baked || Math.abs(baked.k - k) > 0.05 || Math.abs(baked.w - w) > 1 || Math.abs(baked.h - h) > 1;
  if (stale && !busy) {
    busy = true;
    if (!blob) void fetchArt(id, generation);
    else void bake(generation, k, w, h);
  }
  return baked ? baked.canvas : null;
}

/** The current boss's photo is still being fetched / decoded (not known missing, not baked yet). */
export function bossPhotoPending(): boolean {
  return currentId !== null && !missing && !baked;
}

/** Where the photo's subject sits in the boss box (fractions; full box when no photo is baked). */
export function bossPhotoFit(): Readonly<FitRect> {
  return FIT;
}

/** Bytes held by the baked boss photo (memory report). */
export function bossBytes(): number {
  return baked ? baked.canvas.width * baked.canvas.height * 4 : 0;
}
