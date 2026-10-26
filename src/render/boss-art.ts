// Boss photo sprite (GDD-v7 §1): `./art/boss-<id>.webp` (transparent). Only the current boss is fetched;
// the compressed Blob is kept (tens of KB) and decoded only to bake ONE canvas at the size it is drawn
// (box × scale × device px), after which the bitmap is closed. A resize re-bakes from the Blob. Any
// failure (missing file, decode error) leaves the procedural silhouette in place.
import type { BossId } from '../types';
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
    const surf = makeCanvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    // fit (contain) the photo into the box, bottom-aligned: the rigs' anchors assume the subject fills it
    const fit = Math.min(surf.canvas.width / bmp.width, surf.canvas.height / bmp.height);
    const dw = bmp.width * fit;
    const dh = bmp.height * fit;
    surf.ctx.drawImage(bmp, (surf.canvas.width - dw) / 2, surf.canvas.height - dh, dw, dh);
    bmp.close();
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

/** Bytes held by the baked boss photo (memory report). */
export function bossBytes(): number {
  return baked ? baked.canvas.width * baked.canvas.height * 4 : 0;
}
