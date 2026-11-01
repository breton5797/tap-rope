// Office prop hazards (office spec §5): each hazard keeps its v8 position, timing and hit box; only its look
// changes to the superior's prop (events.attackVariant) or, on a cart event's beat, the cart / robot.
// The office renderer sets the frame context once per frame (setPropFrame) before anything is drawn.
import type { BossAttackKind, BossId, LaserFrom, ObstacleKind, VisibleObstacle } from '../../types';
import { LANE_HAZARD_KINDS } from '../../types';
import { BEAM_H, HIGH_H, flyingX } from '../../render/layout';
import type { View } from '../../render/view';
import { attackVariant } from '../core/events';
import { makeCanvas } from '../../render/util';
import { officeImage } from './images';
import { heightTicks } from './readability';

interface PropFrame {
  slot: BossId;
  seed: number;
  /** beat id → prop for the cart event's beat */
  carts: ReadonlyMap<number, string>;
}

const NO_CARTS: ReadonlyMap<number, string> = new Map();
const frame: PropFrame = { slot: 'warden', seed: 1, carts: NO_CARTS };

/** prop id per (beat, kind) for the current slot + seed (attackVariant hashes; draw calls repeat per frame) */
const chosen = new Map<string, string>();

export function setPropFrame(slot: BossId, seed: number, carts: ReadonlyMap<number, string> = NO_CARTS): void {
  if (frame.slot !== slot || frame.seed !== seed || frame.carts !== carts) chosen.clear();
  frame.slot = slot;
  frame.seed = seed;
  frame.carts = carts;
}

/** prop heights in logical px at depth scale 1: each fills its hazard's footprint, all ≤ 0.8× the hero (110) */
export const PROP_SIZE = { floor: 50, ceiling: 72, drone: 54, guard: 70, drop: 70, chaser: 68, high: 46 } as const;
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
  const key = `${beat}:${o.kind}`;
  const hit = chosen.get(key);
  if (hit !== undefined) return hit;
  const cart = LANE_HAZARD_KINDS.includes(o.kind) ? frame.carts.get(beat) : undefined;
  const id = cart ?? attackVariant(frame.slot, attackKindOf(o), frame.seed, beat);
  chosen.set(key, id);
  return id;
}

/** the prop sprite, or null (not loaded / missing: draw the v8 hazard) */
export function propImage(o: Pick<VisibleObstacle, 'id' | 'kind'>): HTMLImageElement | null {
  const id = propIdFor(o);
  let name = PROP_NAMES.get(id);
  if (!name) {
    name = `prop-${id}`;
    PROP_NAMES.set(id, name);
  }
  const img = officeImage(name);
  if (img && UNOUTLINED.has(id)) NO_OUTLINE.add(img);
  return img;
}

/** sprite names per prop id, built once */
const PROP_NAMES = new Map<string, string>();

/** the move that beats a hazard (the rhythm-lane chip): jump, slide, change lane, or stay low (drone) */
export type ActionCue = 'jump' | 'slide' | 'lane' | 'low';

export function actionCue(kind: ObstacleKind): ActionCue {
  if (LANE_HAZARD_KINDS.includes(kind)) return 'lane';
  if (kind === 'high' || kind === 'ceiling') return 'slide';
  if (kind === 'drone') return 'low';
  return 'jump';
}

/** cue colours: jump orange, slide blue, lane-change red, drone ("don't jump high") purple */
export const ACTION_COLORS: Readonly<Record<ActionCue, string>> = {
  jump: '#FF9F1C', slide: '#3B8BFF', lane: '#C2103A', low: '#9B5CFF',
};

/**
 * The hazard's footprint on its lane's floor: a soft tinted ellipse in the cue colour with a crisp rim
 * (lane hazards also paint the blocked lane red across `laneBand` px), so the lane and the move read at a glance.
 */
const LANE_DASH = [5, 3];
const NO_DASH: number[] = [];

export function drawFootprint(
  ctx: CanvasRenderingContext2D, kind: ObstacleKind, x: number, floorY: number, width: number, alpha = 1, _laneBand = 0,
  level = 0,
): void {
  const cue = actionCue(kind);
  const color = ACTION_COLORS[cue];
  const rx = width * (cue === 'lane' ? 0.75 : 0.55);
  const ry = Math.max(2, rx * 0.22);
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (cue === 'lane') {
    // lane change: a crimson OUTLINE only (a filled red read like the amber jump mark on peach floors)
    ctx.beginPath();
    ctx.ellipse(x, floorY, rx, ry, 0, 0, Math.PI * 2);
    ctx.globalAlpha *= 0.85;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(LANE_DASH);
    ctx.stroke();
    ctx.setLineDash(NO_DASH);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.ellipse(x, floorY, rx, ry, 0, 0, Math.PI * 2);
  ctx.globalAlpha *= 0.4;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha /= 0.4;
  ctx.globalAlpha *= 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
  // jumps: 1–3 notches on the ring's front edge = the level to jump
  if (cue === 'jump' && level > 0) heightTicks(ctx, x, floorY + ry, level, Math.max(0.6, width / 50));
}

/** outline rings in logical px: white inside, the move's colour, dark comic ink outside (≈ 2 px dark at play size) */
const OUTLINE_WHITE = 1.1;
const OUTLINE_CUE = 2.3;
const OUTLINE_INK = 3.4;
const INK = '#2E2433';
const OUTLINE_DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71],
];
/** silhouette size: the outline only needs a small flat copy */
const SILHOUETTE_PX = 160;
const silhouettes = new Map<string, WeakMap<HTMLImageElement, HTMLCanvasElement | null>>();

function silhouette(img: HTMLImageElement, color: string): HTMLCanvasElement | null {
  let byImg = silhouettes.get(color);
  if (!byImg) {
    byImg = new WeakMap();
    silhouettes.set(color, byImg);
  }
  if (byImg.has(img)) return byImg.get(img) ?? null;
  let out: HTMLCanvasElement | null = null;
  try {
    const k = SILHOUETTE_PX / Math.max(img.naturalWidth, img.naturalHeight);
    const { canvas, ctx } = makeCanvas(Math.max(1, Math.round(img.naturalWidth * k)), Math.max(1, Math.round(img.naturalHeight * k)));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    out = canvas;
  } catch {
    out = null;
  }
  byImg.set(img, out);
  return out;
}

/** a solid `color` outline `r` px around an image drawn at (x, y, w, h) (silhouettes cached per colour) */
export function outlineImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, color: string, r: number): void {
  ring(ctx, silhouette(img, color), x, y, w, h, r);
}

/**
 * Perf (review): the ink + move-colour + white rings baked once per (image, cue) into one canvas, so a prop
 * costs two drawImage calls instead of 24. Ring widths are fractions of the drawn height (tuned at 50 px).
 */
const BAKE_H = 128;
const RING_REF_H = 50;
const baked = new WeakMap<HTMLImageElement, Map<string, { canvas: HTMLCanvasElement; pad: number } | null>>();

function bakedRings(img: HTMLImageElement, cue: ActionCue | null): { canvas: HTMLCanvasElement; pad: number } | null {
  let byCue = baked.get(img);
  if (!byCue) {
    byCue = new Map();
    baked.set(img, byCue);
  }
  const key = cue ?? '-';
  if (byCue.has(key)) return byCue.get(key) ?? null;
  let out: { canvas: HTMLCanvasElement; pad: number } | null = null;
  try {
    const k = BAKE_H / RING_REF_H;
    const pad = Math.ceil(OUTLINE_INK * k) + 1;
    const h = BAKE_H;
    const w = Math.max(1, Math.round((h * img.naturalWidth) / img.naturalHeight));
    const { canvas, ctx } = makeCanvas(w + 2 * pad, h + 2 * pad);
    ring(ctx, silhouette(img, INK), pad, pad, w, h, OUTLINE_INK * k);
    if (cue) ring(ctx, silhouette(img, ACTION_COLORS[cue]), pad, pad, w, h, OUTLINE_CUE * k);
    ring(ctx, silhouette(img, '#FFFFFF'), pad, pad, w, h, OUTLINE_WHITE * k);
    out = { canvas, pad };
  } catch {
    out = null;
  }
  byCue.set(key, out);
  return out;
}

function ring(ctx: CanvasRenderingContext2D, sil: HTMLCanvasElement | null, x: number, y: number, w: number, h: number, r: number): void {
  if (sil) for (const [dx, dy] of OUTLINE_DIRS) ctx.drawImage(sil, x + dx * r, y + dy * r, w, h);
}

/** props drawn without the outline rings (thin art the rings would smear, e.g. the laser-pointer dot chain) */
const NO_OUTLINE = new WeakSet<HTMLImageElement>();
const UNOUTLINED: ReadonlySet<string> = new Set(['pointer']);

/**
 * Draw a prop with a dark comic outline around a white one, its centre-bottom (ay = 1) or centre (ay = 0.5)
 * at (x, y); `flip` mirrors it; `m` (F6) nudges it and turns it around its own centre.
 */
export function drawProp(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, h: number, ay: number, flip = false, alpha = 1,
  m?: Readonly<PropMotion>, cue: ActionCue | null = null,
): void {
  const w = (h * img.naturalWidth) / img.naturalHeight;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // pivot at the prop's centre
  ctx.translate(x + (m?.dx ?? 0), y - h * ay + h / 2 + (m?.dy ?? 0));
  if (m && m.rot !== 0) ctx.rotate(m.rot);
  if (flip) ctx.scale(-1, 1);
  if (!NO_OUTLINE.has(img)) {
    // dark ink outermost (reads on every floor, stage 5's lavender too), the move's colour, then white
    const r = bakedRings(img, cue);
    if (r) {
      const k = h / BAKE_H;
      ctx.drawImage(r.canvas, -w / 2 - r.pad * k, -h / 2 - r.pad * k, w + 2 * r.pad * k, h + 2 * r.pad * k);
    }
  }
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// ---------- v2 feel pack ----------

/**
 * F2: middle-lane x of a flying prop's centre — the beam head itself (v8 flyingX), so the prop covers the
 * hero exactly when the judge decides (it used to trail behind the head by its own width).
 */
export function flyingPropCenter(from: LaserFrom, timeUntil: number, v: View): number {
  return flyingX(from, timeUntil, v);
}

export interface PropMotion {
  dx: number;
  dy: number;
  rot: number;
}

/** one shared result (read it before the next call): no allocation per frame */
const MOTION: PropMotion = { dx: 0, dy: 0, rot: 0 };

const motion = (dx: number, dy: number, rot: number): PropMotion => {
  MOTION.dx = dx;
  MOTION.dy = dy;
  MOTION.rot = rot;
  return MOTION;
};

/**
 * F6 prop life: a small idle motion per prop id at phase `t` (seconds + a per-obstacle offset). Drawing
 * only — at most a few px, so the prop still sits on its hazard's hit box.
 */
export function propMotion(id: string, t: number): PropMotion {
  switch (id) {
    case 'paper-plane': return motion(0, Math.sin(t * 7) * 3, Math.sin(t * 7 + 0.6) * 0.18); // sine glide
    case 'golf': case 'latte-bubble': return motion(0, 0, -t * 10); // rolling
    case 'clipboard': case 'corp-card': case 'envelope': return motion(0, 0, t * 9); // spinning
    case 'papers': case 'doc-tornado': case 'postit': case 'paper-jam':
      return motion(Math.sin(t * 13) * 1.5, Math.sin(t * 9) * 1.5, Math.sin(t * 11) * 0.12); // fluttering
    case 'cart': case 'robot': case 'whiteboard': return motion(0, -Math.abs(Math.sin(t * 18)) * 2, 0); // wheels bumping
    case 'door': case 'revolving-door': case 'elevator': return motion(0, 0, Math.sin(t * 4) * 0.06); // swinging
    default: return motion(0, Math.sin(t * 4) * 1.5, Math.sin(t * 3) * 0.05); // gentle bob
  }
}

/** the hero's (visual) lane this frame, set by the office renderer */
let heroLane = 1;

export function setFocusLane(lane: number): void {
  heroLane = lane;
}

/** the hero's (visual) lane this frame */
export const focusLane = (): number => heroLane;

/** the lane a held / thrown bundle is drawn in: follows the hero only once it is clearly in another lane */
let held = 1;
const HELD_SWITCH = 0.6;

export function heldLane(): number {
  if (Math.abs(heroLane - held) > HELD_SWITCH) held = Math.round(heroLane);
  return held;
}

/**
 * Declutter: a full-width hazard is drawn full size in the hero's lane and smaller in the other lanes, so
 * three hero-sized props never stack on top of each other (the hit box is the lane, not the drawing).
 */
export function laneSizeK(d: number): number {
  return 1 - 0.25 * Math.min(1, Math.abs(d - heroLane));
}

// ---------- beam stacks as a thrown bundle ----------

export interface StackItem {
  /** centre height above the floor (a beam height), x nudge and tilt of this item */
  readonly height: number;
  readonly dx: number;
  readonly rot: number;
}

/** item size (logical px at depth scale 1): small enough to leave gaps between the beam heights */
export const STACK_ITEM = 28;
const STACKS: readonly (readonly StackItem[])[] = [1, 2, 3].map((level) =>
  level === 1 ? [] : BEAM_H.slice(0, level).map((height, i) => ({ height, dx: (i - (level - 1) / 2) * 12, rot: (i - 1) * 0.16 + 0.05 })));

/**
 * A 2단/3단 beam drawn as a column of small items, one per beam height (its physical height stays the jump
 * the beam asks for), instead of one hero-sized blob; a 1단 beam stays a single prop ([]).
 */
export function stackItems(level: number): readonly StackItem[] {
  return STACKS[Math.min(3, Math.max(1, level)) - 1];
}

/** draw a stack around the column at x: item centres at their beam heights × `depth` above `floorY`, items × `size` */
export function drawStack(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement, items: readonly StackItem[], x: number, floorY: number, depth: number,
  size: number, flip: boolean, alpha: number, m: Readonly<PropMotion>, cue: ActionCue | null = null,
): void {
  for (const it of items) {
    ITEM_MOTION.dx = m.dx + it.dx * depth;
    ITEM_MOTION.dy = m.dy;
    ITEM_MOTION.rot = m.rot + it.rot;
    drawProp(ctx, img, x, floorY - it.height * depth, STACK_ITEM * size, 0.5, flip, alpha, ITEM_MOTION, cue);
  }
}

const ITEM_MOTION: PropMotion = { dx: 0, dy: 0, rot: 0 };
