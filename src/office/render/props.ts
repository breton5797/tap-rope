// Office prop hazards (office spec §5): each hazard keeps its v8 position, timing and hit box; only its look
// changes to the superior's prop (events.attackVariant) or, on a cart event's beat, the cart / robot.
// The office renderer sets the frame context once per frame (setPropFrame) before anything is drawn.
import type { BossAttackKind, BossId, VisibleObstacle } from '../../types';
import { LANE_HAZARD_KINDS } from '../../types';
import { BEAM_H, HIGH_H } from '../../render/layout';
import { attackVariant } from '../core/events';
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

/** drawn prop heights in logical px at depth scale 1: each prop fills its hazard's footprint */
export const PROP_SIZE = { floor: 38, ceiling: 56, drone: 42, guard: 74, drop: 54, chaser: 52, high: 36 } as const;

/**
 * A flying hazard as one prop: a head-height prop around the 'high' beam, or a beam stack as one prop
 * standing on the floor up to just over its top beam (1단 32, 2단 56, 3단 80 px: its height reads as the jump).
 */
export function flyingSpan(o: Pick<VisibleObstacle, 'kind' | 'level'>): { bottom: number; h: number } {
  if (o.kind === 'high') return { bottom: HIGH_H - PROP_SIZE.high / 2, h: PROP_SIZE.high };
  return { bottom: 0, h: BEAM_H[Math.min(3, Math.max(1, o.level)) - 1] + 16 };
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

/** draw a prop with its centre-bottom (ay = 1) or centre (ay = 0.5) at (x, y); `flip` mirrors it */
export function drawProp(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, h: number, ay: number, flip = false, alpha = 1): void {
  const w = (h * img.naturalWidth) / img.naturalHeight;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h * ay, w, h);
  ctx.restore();
}
