// Office build stand-in for src/render/boss-art.ts (build/office-swaps.ts): the superior's standing figure
// (public-office/art/boss-<slot>.webp) with more poses (v2 F5/F9): -idle2 alternating while it backpedals,
// -throw1..6 (or the single -attack) across the attack telegraph, -tired once its own gauge has run out.
// A pose frame that is missing falls back (throwN → attack → idle). Each image is trimmed to its opaque box once and baked at the drawn size (one canvas per pose).
import type { BossId } from '../../types';
import { makeCanvas, releaseCanvas } from '../../render/util';
import { imageState, officeImage } from './images';

export interface FitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** idle (+ idle2 alternating with the backpedal), throw1..6 across the telegraph, attack (single-frame throw), tired */
export type BossPose = 'idle' | 'idle2' | 'attack' | 'tired' | 'throw1' | 'throw2' | 'throw3' | 'throw4' | 'throw5' | 'throw6';
const POSES: readonly BossPose[] = ['idle', 'idle2', 'attack', 'tired', 'throw1', 'throw2', 'throw3', 'throw4', 'throw5', 'throw6'];

/** what to try when a pose frame is missing: throwN → attack → idle, idle2 / tired → idle */
const FALLBACK: Readonly<Record<BossPose, BossPose | null>> = {
  idle: null, idle2: 'idle', attack: 'idle', tired: 'idle',
  throw1: 'attack', throw2: 'attack', throw3: 'attack', throw4: 'attack', throw5: 'attack', throw6: 'attack',
};

interface Baked {
  canvas: HTMLCanvasElement;
  img: HTMLImageElement;
  k: number;
  w: number;
  h: number;
  fit: FitRect;
}

const FULL: FitRect = { x: 0, y: 0, w: 1, h: 1 };
const FIT: FitRect = { ...FULL };
let pose: BossPose = 'idle';
let currentId: BossId | null = null;
/** baked canvas per pose of the current boss */
const baked = new Map<BossPose, Baked>();
/** file names per boss and pose, built once */
const NAMES = new Map<BossId, Record<BossPose, string>>();
/** opaque box of each image (source px), scanned once */
const boxes = new WeakMap<HTMLImageElement, FitRect>();

/** the office renderer sets the pose each frame (attack during a throw, tired when the gauge is empty) */
export function setBossPose(p: BossPose): void {
  pose = p;
}

function namesOf(id: BossId): Record<BossPose, string> {
  let n = NAMES.get(id);
  if (!n) {
    n = Object.fromEntries(POSES.map((p) => [p, p === 'idle' ? `boss-${id}` : `boss-${id}-${p}`])) as Record<BossPose, string>;
    NAMES.set(id, n);
  }
  return n;
}

function opaqueBox(img: HTMLImageElement): FitRect {
  const cached = boxes.get(img);
  if (cached) return cached;
  const box: FitRect = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  try {
    const sc = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * sc));
    const h = Math.max(1, Math.round(img.naturalHeight * sc));
    const probe = makeCanvas(w, h);
    probe.ctx.drawImage(img, 0, 0, w, h);
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
    if (x1 >= x0 && y1 >= y0) Object.assign(box, { x: x0 / sc, y: y0 / sc, w: (x1 - x0 + 1) / sc, h: (y1 - y0 + 1) / sc });
  } catch {
    // keep the full image
  }
  boxes.set(img, box);
  return box;
}

/** the trimmed figure, fitted (contain) into the w×h box, bottom-aligned and centred */
function bake(img: HTMLImageElement, w: number, h: number, k: number): Baked {
  const surf = makeCanvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
  const cw = surf.canvas.width;
  const ch = surf.canvas.height;
  const b = opaqueBox(img);
  const s = Math.min(cw / b.w, ch / b.h);
  const dw = b.w * s;
  const dh = b.h * s;
  const dx = (cw - dw) / 2;
  const dy = ch - dh;
  surf.ctx.drawImage(img, b.x, b.y, b.w, b.h, dx, dy, dw, dh);
  return { canvas: surf.canvas, img, k, w, h, fit: { x: dx / cw, y: dy / ch, w: dw / cw, h: dh / ch } };
}

function clear(): void {
  for (const b of baked.values()) releaseCanvas(b.canvas);
  baked.clear();
}

/** v8 contract: the baked figure for boss `id` at w×h logical px (k device px each), null while it loads */
export function bossPhoto(id: BossId, w: number, h: number, k: number): HTMLCanvasElement | null {
  if (id !== currentId) {
    currentId = id;
    clear();
  }
  const names = namesOf(id);
  let usePose: BossPose | null = pose;
  let img: HTMLImageElement | null = null;
  while (usePose && !img) {
    img = officeImage(names[usePose]);
    if (!img) usePose = FALLBACK[usePose];
  }
  if (!img || !usePose) {
    Object.assign(FIT, FULL);
    return null;
  }
  let b = baked.get(usePose);
  if (!b || b.img !== img || Math.abs(b.k - k) > 0.05 || Math.abs(b.w - w) > 1 || Math.abs(b.h - h) > 1) {
    if (b) releaseCanvas(b.canvas);
    b = bake(img, w, h, k);
    baked.set(usePose, b);
  }
  Object.assign(FIT, b.fit);
  return b.canvas;
}

/** v8 contract: the current boss's figure is still loading (not known missing) */
export function bossPhotoPending(): boolean {
  return currentId !== null && !baked.has('idle') && imageState(namesOf(currentId).idle) === 'loading';
}

/** v8 contract: where the figure sits in the boss box (fractions; full box when none is baked) */
export function bossPhotoFit(): Readonly<FitRect> {
  return FIT;
}

/** v8 contract: bytes held by the baked figures */
export function bossBytes(): number {
  let n = 0;
  for (const b of baked.values()) n += b.canvas.width * b.canvas.height * 4;
  return n;
}
