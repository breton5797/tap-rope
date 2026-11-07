// Office v2.2 art-director fix: per-hero frame-set scale. A set the art worker shrank to fit its 512×640 canvas
// (고도약's jumps) draws the hero smaller mid-air; each jump / slide / hit set is scaled so its median figure
// extent matches the hero's run1 (one opaque scan per image, cached once the whole set has settled). The
// feet stay on the canvas bottom; a scaled frame may overflow above the canvas. Also the hurt blink floor.
import { opaqueBox } from './boss-art';
import { imageState, officeImage } from './images';

export type FrameSet = 'jump' | 'slide' | 'hit';

/** median figure extent (max of w, h) of a set relative to run1, as drawn by the reference art (칼퇴준) */
export const SET_EXPECT: Readonly<Record<FrameSet, number>> = { jump: 1, slide: 0.81, hit: 1 };
const DEADBAND = 0.04;
const MAX_SCALE = 1.25;

/** the set a frame belongs to (run and win are the reference / a still: never rescaled) */
export function setOf(frame: string): FrameSet | null {
  if (frame.startsWith('jump')) return 'jump';
  if (frame.startsWith('slide')) return 'slide';
  if (frame.startsWith('hit')) return 'hit';
  return null;
}

/** scale for a set from run1's extent and the set's frame extents: only up, ignoring ≤4% differences */
export function setScale(run1: number, extents: readonly number[], expect: number): number {
  if (extents.length === 0 || !(run1 > 0)) return 1;
  const sorted = [...extents].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const k = (expect * run1) / median;
  if (k <= 1 + DEADBAND) return 1;
  return Math.min(MAX_SCALE, k);
}

const COUNT: Readonly<Record<FrameSet, number>> = { jump: 8, slide: 4, hit: 4 };
/** settled scales per skin and set (looked up without building strings) */
const scales = new Map<string, Partial<Record<FrameSet, number>>>();

function extent(img: HTMLImageElement): number {
  const b = opaqueBox(img);
  return Math.max(b.w, b.h);
}

/** the draw scale for `frame` of `skin` (1 until run1 and the whole set have loaded or failed) */
export function heroSetScale(skin: string, frame: string): number {
  const set = setOf(frame);
  if (!set) return 1;
  let bySet = scales.get(skin);
  if (!bySet) {
    bySet = {};
    scales.set(skin, bySet);
  }
  const done = bySet[set];
  if (done !== undefined) return done;
  const run1 = officeImage(`hero-${skin}-run1`);
  if (!run1) return 1;
  const ext: number[] = [];
  for (let i = 1; i <= COUNT[set]; i++) {
    const name = `hero-${skin}-${set}${i}`;
    const img = officeImage(name); // requests it when not yet asked for
    if (img) ext.push(extent(img));
    else if (imageState(name) === 'loading') return 1;
  }
  if (ext.length === 0) {
    const still = officeImage(`hero-${skin}-${set}`);
    if (still) ext.push(extent(still));
  }
  const k = setScale(extent(run1), ext, SET_EXPECT[set]);
  bySet[set] = k;
  return k;
}

/** the hurt (invulnerable) blink alpha; never below 0.6 while the shield is up (the hero stays readable) */
export function blinkAlpha(t: number, shielded: boolean): number {
  const lo = shielded ? 0.6 : 0.55;
  return lo + (1 - lo) * Math.abs(Math.sin(t * Math.PI * 10));
}

const WARM_SETS: readonly FrameSet[] = ['jump', 'slide', 'hit'];
const warmed = new Map<string, number>();

/**
 * perf r4: settle one frame set's scale for `skin` per call (its opaque scans read every frame of the set — a
 * ~50 ms spike on the hero's first jump otherwise); true while a set was handled, false once all are.
 */
export function warmHeroSets(skin: string, warm: (set: FrameSet) => void = (set) => heroSetScale(skin, `${set}1`)): boolean {
  const i = warmed.get(skin) ?? 0;
  if (i >= WARM_SETS.length) return false;
  warm(WARM_SETS[i]);
  warmed.set(skin, i + 1);
  return true;
}
