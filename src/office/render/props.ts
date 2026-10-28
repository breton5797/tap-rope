// Office prop hazards (office spec §5): each hazard keeps its v8 position, timing and hit box; only its look
// changes to the superior's prop (events.attackVariant) or, on a cart event's beat, the cart / robot.
// The office renderer sets the frame context once per frame (setPropFrame) before anything is drawn.
import type { BossAttackKind, BossId, VisibleObstacle } from '../../types';
import { LANE_HAZARD_KINDS } from '../../types';
import { BEAM_H, HIGH_H } from '../../render/layout';
import { attackVariant } from '../core/events';
import { makeCanvas } from '../../render/util';
import { officeImage } from './images';

interface PropFrame {
  slot: BossId;
  seed: number;
  /** beat id → prop for the cart event's beat */
  carts: ReadonlyMap<number, string>;
}

const NO_CARTS: ReadonlyMap<number, string> = new Map();
const frame: PropFrame = { slot: 'warden', seed: 1, carts: NO_CARTS };

export function setPropFrame(slot: BossId, seed: number, carts: ReadonlyMap<number, string> = NO_CARTS): void {
  frame.slot = slot;
  frame.seed = seed;
  frame.carts = carts;
}

/** prop heights in logical px at depth scale 1: each prop fills (and slightly overfills) its hazard's footprint */
export const PROP_SIZE = { floor: 50, ceiling: 72, drone: 54, guard: 96, drop: 70, chaser: 68, high: 46 } as const;
/** a beam stack's prop rises this much over its top beam, then is scaled like the others */
const BEAM_PAD = 16;
const PROP_SCALE = 1.3;

/**
 * A flying hazard as one prop: a head-height prop around the 'high' beam, or a beam stack as one prop
 * standing on the floor and reaching over its top beam (1단 42, 2단 73, 3단 104 px: its height reads as the jump).
 */
export function flyingSpan(o: Pick<VisibleObstacle, 'kind' | 'level'>): { bottom: number; h: number } {
  if (o.kind === 'high') return { bottom: HIGH_H - PROP_SIZE.high / 2, h: PROP_SIZE.high };
  return { bottom: 0, h: Math.round((BEAM_H[Math.min(3, Math.max(1, o.level)) - 1] + BEAM_PAD) * PROP_SCALE) };
}

/** the attack kind a hazard obstacle is delivered as (boss.ts attackKind, per obstacle) */
export function attackKindOf(o: Pick<VisibleObstacle, 'kind'>): BossAttackKind {
  if (LANE_HAZARD_KINDS.includes(o.kind)) return 'lane';
  if (o.kind === 'beam' || o.kind === 'high') return 'beam';
  if (o.kind === 'ceiling' || o.kind === 'floor' || o.kind === 'drone') return o.kind;
  return 'drone';
}

/** beat id from a VisibleObstacle id (`${beatId}-${index}`) */
export const beatIdOf = (o: Pick<VisibleObstacle, 'id'>): number => Number.parseInt(o.id, 10);

/** the prop id for this obstacle in the current frame */
export function propIdFor(o: Pick<VisibleObstacle, 'id' | 'kind'>): string {
  const beat = beatIdOf(o);
  const cart = LANE_HAZARD_KINDS.includes(o.kind) ? frame.carts.get(beat) : undefined;
  return cart ?? attackVariant(frame.slot, attackKindOf(o), frame.seed, beat);
}

/** the prop sprite, or null (not loaded / missing: draw the v8 hazard) */
export function propImage(o: Pick<VisibleObstacle, 'id' | 'kind'>): HTMLImageElement | null {
  return officeImage(`prop-${propIdFor(o)}`);
}

/** white outline width in logical px (≈ 2–3 device-independent px at play size) */
const OUTLINE = 1.6;
const OUTLINE_DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71],
];
/** silhouette size: the outline only needs a small white copy */
const SILHOUETTE_PX = 160;
const silhouettes = new WeakMap<HTMLImageElement, HTMLCanvasElement | null>();

function silhouette(img: HTMLImageElement): HTMLCanvasElement | null {
  if (silhouettes.has(img)) return silhouettes.get(img) ?? null;
  let out: HTMLCanvasElement | null = null;
  try {
    const k = SILHOUETTE_PX / Math.max(img.naturalWidth, img.naturalHeight);
    const { canvas, ctx } = makeCanvas(Math.max(1, Math.round(img.naturalWidth * k)), Math.max(1, Math.round(img.naturalHeight * k)));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    out = canvas;
  } catch {
    out = null;
  }
  silhouettes.set(img, out);
  return out;
}

/** draw a prop with a white outline, its centre-bottom (ay = 1) or centre (ay = 0.5) at (x, y); `flip` mirrors it */
export function drawProp(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, h: number, ay: number, flip = false, alpha = 1): void {
  const w = (h * img.naturalWidth) / img.naturalHeight;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  const sil = silhouette(img);
  if (sil) for (const [dx, dy] of OUTLINE_DIRS) ctx.drawImage(sil, -w / 2 + dx * OUTLINE, -h * ay + dy * OUTLINE, w, h);
  ctx.drawImage(img, -w / 2, -h * ay, w, h);
  ctx.restore();
}
