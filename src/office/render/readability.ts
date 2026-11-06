// Office hazard readability (v2.1 ambiguity audit): one colour and one sign per move, whatever the prop —
// jump amber, slide blue, lane red, stay-low purple — and pickups that read as "good" (glow disc, no
// footprint). Pure helpers plus the small signs (height ticks, stay-low band, safe-lane arrow, rear arrow).
import type { LaneId, ObstacleKind, VisibleObstacle } from '../../types';
import { HAZARD_KINDS } from '../../types';
import type { Ctx } from '../../render/util';
import { BEAM_H, HIGH_H } from '../../render/layout';
import { ACTION_COLORS, actionCue, type ActionCue } from './props';

/** the hero's drawn height in logical px (agent.ts HERO_H 92 × RIG_SIZE 1.2) */
export const HERO_PX = 110;

/** the callout's move hint: the jump level, the move, and "뒤에서!" for an attack from behind */
export function calloutHint(kind: ObstacleKind, level: number, rear: boolean): string {
  const cue = actionCue(kind);
  const move = cue === 'jump'
    ? kind === 'beam' && level >= 2 ? `점프 ${Math.min(3, level)}단!` : '점프!'
    : cue === 'slide' ? '숙여!' : cue === 'low' ? '낮게!' : '옆으로!';
  return rear ? `뒤에서! ${move}` : move;
}

const LANES: readonly LaneId[] = [0, 1, 2];
const OPEN: LaneId[] = [];

/** the lanes a lane attack leaves open (a shared array: read it before the next call) */
export function safeLanes(blocked: readonly number[]): readonly LaneId[] {
  OPEN.length = 0;
  for (const l of LANES) if (!blocked.includes(l)) OPEN.push(l);
  return OPEN;
}

/** an attack from behind: a rear beam / head-height beam or a chaser */
export const isRear = (o: Pick<VisibleObstacle, 'from' | 'kind'>): boolean => o.from === 'back' || o.kind === 'chaser';

/**
 * The callout hint for a whole beat (combo beats need two moves): 「뒤에서!」 when anything comes from behind,
 * then the moves joined with " + " in the order lane, slide, jump (max level), stay low.
 */
export function beatHint(obs: readonly Pick<VisibleObstacle, 'kind' | 'level' | 'from'>[]): string {
  let rear = false;
  let lane = false;
  let slide = false;
  let low = false;
  let jump = 0;
  for (const o of obs) {
    if (!HAZARD_KINDS.includes(o.kind)) continue;
    if (isRear(o)) rear = true;
    const cue = actionCue(o.kind);
    if (cue === 'lane') lane = true;
    else if (cue === 'slide') slide = true;
    else if (cue === 'low') low = true;
    else jump = Math.max(jump, o.kind === 'beam' ? o.level : 1);
  }
  const moves: string[] = [];
  if (lane) moves.push('옆으로!');
  if (slide) moves.push('숙여!');
  if (jump > 0) moves.push(jump >= 2 ? `점프 ${Math.min(3, jump)}단!` : '점프!');
  if (low) moves.push('낮게!');
  return `${rear ? '뒤에서! ' : ''}${moves.join(' + ')}`;
}

/** the safe-lane chevron moves this far past a combo beat's full-width prop (logical px) so it never sits in it */
export const COMBO_ARROW_SHIFT = 70;

/** x of the safe-lane chevron for a lane attack at `x`; `combo` = its beat also has a full-width hazard */
export function safeArrowX(x: number, combo: boolean): number {
  return combo ? x + COMBO_ARROW_SHIFT : x;
}

const COMBO_LANES = new Map<number, number[]>();

/**
 * Per frame: a predicate "is this full-width hazard's lane already blocked by a lane hazard of its own beat" —
 * a lane-combo beat (lanejump, pointer + cart) then draws one prop per column, not two stacked ones.
 * The returned predicate reads a shared map: use it before the next call.
 */
export function comboBlocked(obs: readonly Pick<VisibleObstacle, 'id' | 'kind' | 'lanes'>[]): (o: Pick<VisibleObstacle, 'id' | 'lanes'>, lane: number) => boolean {
  if (COMBO_LANES.size > 64) COMBO_LANES.clear(); // old beats' empty lists
  for (const v of COMBO_LANES.values()) v.length = 0;
  for (const o of obs) {
    if (!o.lanes || !HAZARD_KINDS.includes(o.kind)) continue;
    const beat = Number.parseInt(o.id, 10);
    const list = COMBO_LANES.get(beat) ?? [];
    if (!COMBO_LANES.has(beat)) COMBO_LANES.set(beat, list);
    for (const l of o.lanes) list.push(l);
  }
  return (o, lane) => !o.lanes && (COMBO_LANES.get(Number.parseInt(o.id, 10))?.includes(lane) ?? false);
}

/** a hazard prop that has passed the hero fades out over this long (s): no debris piling up at the left edge */
export const PASS_FADE = 0.2;

/** opacity factor of a prop `timeUntil` s from the hero (negative = already passed) */
export function passFade(timeUntil: number): number {
  return timeUntil >= 0 ? 1 : Math.max(0, 1 + timeUntil / PASS_FADE);
}

export interface HintSegment {
  readonly text: string;
  readonly color: string;
}

/** the move a hint word names (its action colour); 「뒤에서!」 rides with the move after it */
function segmentCue(text: string): ActionCue {
  if (text.includes('옆으로')) return 'lane';
  if (text.includes('숙여')) return 'slide';
  if (text.includes('낮게')) return 'low';
  return 'jump';
}

/** a beat hint split into its moves (" + "), each coloured like its hazards, for the callout's colour chips */
export function hintSegments(hint: string): HintSegment[] {
  return hint.split(' + ').map((text) => ({ text, color: ACTION_COLORS[segmentCue(text)] }));
}

/** drawn pickup height: collectibles ~0.45×, power-ups / coins ~0.4× the hero */
export function pickupSize(collectible: boolean): number {
  return (collectible ? 0.45 : 0.4) * HERO_PX;
}

/** 1–3 notches on a jump footprint's front edge (the jump level to use), centred on x */
export function heightTicks(ctx: Ctx, x: number, edgeY: number, level: number, s: number): void {
  const n = Math.min(3, Math.max(1, level));
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = ACTION_COLORS.jump;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < n; i++) {
    const nx = x + (i - (n - 1) / 2) * 7 * s;
    ctx.beginPath();
    ctx.moveTo(nx - 2.5 * s, edgeY - 3.5 * s);
    ctx.lineTo(nx + 2.5 * s, edgeY - 3.5 * s);
    ctx.lineTo(nx, edgeY + 1.5 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** stay low: a dashed purple band at 2단 height across the lane with a "↓" under it */
export function stayLowBand(ctx: Ctx, x: number, bandY: number, width: number, s: number): void {
  ctx.save();
  ctx.strokeStyle = ACTION_COLORS.low;
  ctx.lineWidth = 2.2 * s;
  ctx.setLineDash(DASH);
  ctx.beginPath();
  ctx.moveTo(x - width / 2, bandY);
  ctx.lineTo(x + width / 2, bandY);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  arrow(ctx, x, bandY + 6 * s, 9 * s, 1, ACTION_COLORS.low);
  ctx.restore();
}

const DASH = [6, 4];
const NO_DASH: number[] = [];

/** a green chevron on a lane the lane attack leaves open */
export function safeArrow(ctx: Ctx, x: number, floorY: number, s: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#2FD27A';
  ctx.strokeStyle = '#1B6E44';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, floorY - 4 * s);
  ctx.lineTo(x + 7 * s, floorY);
  ctx.lineTo(x - 7 * s, floorY + 4 * s);
  ctx.lineTo(x - 3 * s, floorY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** a pulsing red arrow at the left screen edge pointing right: something comes from behind */
export function rearArrow(ctx: Ctx, x: number, y: number, t: number, reduced: boolean): void {
  const pulse = reduced ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(t * 9));
  ctx.save();
  ctx.globalAlpha *= pulse;
  ctx.fillStyle = ACTION_COLORS.lane;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x + 18, y);
  ctx.lineTo(x, y + 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** a small filled arrow pointing down (dir 1) or up (−1) */
function arrow(ctx: Ctx, x: number, y: number, size: number, dir: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - size / 2, y);
  ctx.lineTo(x + size / 2, y);
  ctx.lineTo(x, y + dir * size * 0.8);
  ctx.closePath();
  ctx.fill();
}

/** pickups read as good: a soft glow disc behind them (mint for mission collectibles, gold otherwise) */
export function glowDisc(ctx: Ctx, x: number, y: number, r: number, collectible: boolean, t: number): void {
  ctx.save();
  ctx.globalAlpha *= 0.55 + 0.15 * Math.sin(t * 4);
  // polish P2: power-ups glow sky, not gold — gold reads as the 법인카드 hazard
  ctx.fillStyle = collectible ? '#9FF5D6' : '#BFE6FF';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha *= 0.8;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** a twinkle beside a pickup */
export function twinkle(ctx: Ctx, x: number, y: number, r: number, t: number): void {
  const k = Math.max(0, Math.sin(t * 6));
  if (k <= 0.05) return;
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.25, y - r * 0.25);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.25, y + r * 0.25);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.25, y + r * 0.25);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.25, y - r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * The laser pointer (최팀장): a thick red beam from the boss's hand to the target height with a bright dot
 * there — head (slide), knee / ankle (jump) — instead of a prop sprite. Dark outline, red body and a white core
 * so it reads on the pastel dusk skies too (art review), plus a halo ring around the dot.
 */
export function pointerBeam(ctx: Ctx, hx: number, hy: number, x: number, y: number, s: number, alpha: number, cue: ActionCue = 'jump'): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  if (hx !== x || hy !== y) {
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'rgba(46,36,51,0.55)';
    ctx.lineWidth = 6;
    ctx.stroke();
    // the beam's body in the move's colour (jump amber / slide blue / stay-low purple), the dot stays red
    ctx.strokeStyle = ACTION_COLORS[cue];
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
  // halo: the warning end-cap where the beam lands
  ctx.fillStyle = 'rgba(255,42,85,0.28)';
  ctx.beginPath();
  ctx.arc(x, y, 11 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FF2A3A';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 5.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------- per-frame sign scan (every hazard ahead, not just the nearest beat) ----------

/**
 * signs (rear arrow, stay-low band, safe-lane chevrons) show this long before an attack arrives (≥ WARN_LEAD);
 * 1.2 → 1.4 s after the first human playtest (difficulty ease): more time to read each sign
 */
export const SIGN_LEAD = 1.4;

/** later lane beats' chevrons are drawn only this far (logical px) from the last drawn set, and faded */
export const CHEVRON_GAP = 80;
const LATER_CHEVRON_ALPHA = 0.45;

interface ChevronPlanItem {
  readonly index: number;
  readonly alpha: number;
}
const PLAN: ChevronPlanItem[] = [];
const ORDER: number[] = [];

/**
 * With the longer lead more lane beats are signed at once on dense stages: the nearest beat's chevrons draw at
 * full strength, a later beat's only when CHEVRON_GAP clear of every set already drawn (faded) — never stacked.
 * Returns a shared array (read it before the next call).
 */
export function chevronPlan(beats: readonly { readonly x: number; readonly tu: number }[]): readonly ChevronPlanItem[] {
  PLAN.length = 0;
  ORDER.length = 0;
  for (let i = 0; i < beats.length; i++) ORDER.push(i);
  ORDER.sort((a, b) => beats[a].tu - beats[b].tu);
  for (const i of ORDER) {
    if (PLAN.some((p) => Math.abs(beats[p.index].x - beats[i].x) < CHEVRON_GAP)) continue;
    PLAN.push({ index: i, alpha: PLAN.length === 0 ? 1 : LATER_CHEVRON_ALPHA });
  }
  return PLAN;
}
const REAR_CHASER_H = 34;

/** a rear attack the office marks with its arrow this frame (its v8 "!" is then suppressed) */
export function rearMarked(o: Pick<VisibleObstacle, 'kind' | 'from' | 'timeUntil'>): boolean {
  return HAZARD_KINDS.includes(o.kind) && isRear(o) && o.timeUntil > 0 && o.timeUntil <= SIGN_LEAD;
}

/** the attack height a rear mark points at (jump beam vs slide vs chaser), logical px above the floor */
function rearHeight(o: Pick<VisibleObstacle, 'kind' | 'level'>): number {
  if (o.kind === 'high') return HIGH_H;
  if (o.kind === 'beam') return BEAM_H[Math.min(3, Math.max(1, o.level)) - 1];
  return REAR_CHASER_H;
}

export interface SignScan {
  /** distinct heights of the rear attacks ahead */
  rearHeights: number[];
  drone: boolean;
  /** one lane-attack obstacle per beat ahead (its beat's blocked lanes are gathered by the caller) */
  laneBeats: VisibleObstacle[];
  /** time until the nearest drone (for the band's position) */
  droneTu: number;
}

const SCAN: SignScan = { rearHeights: [], drone: false, laneBeats: [], droneTu: 0 };
/** ids of the rear hazards the last scan marked with the arrow (warnings.ts drops their v8 "!") */
const MARKED = new Set<string>();

/** the rear obstacle ids marked by the latest scanSigns() (this frame: the renderer scans before drawing) */
export const markedThisFrame = (): ReadonlySet<string> => MARKED;

/** scan every hazard obstacle with 0 < timeUntil ≤ SIGN_LEAD (a shared result: read it before the next call) */
export function scanSigns(obs: readonly VisibleObstacle[]): Readonly<SignScan> {
  SCAN.rearHeights.length = 0;
  SCAN.laneBeats.length = 0;
  SCAN.drone = false;
  SCAN.droneTu = Infinity;
  MARKED.clear();
  for (const o of obs) {
    if (!HAZARD_KINDS.includes(o.kind) || o.timeUntil <= 0 || o.timeUntil > SIGN_LEAD) continue;
    if (isRear(o)) {
      MARKED.add(o.id);
      const h = rearHeight(o);
      if (!SCAN.rearHeights.includes(h)) SCAN.rearHeights.push(h);
    }
    if (o.kind === 'drone') {
      SCAN.drone = true;
      SCAN.droneTu = Math.min(SCAN.droneTu, o.timeUntil);
    }
    if (o.lanes && actionCue(o.kind) === 'lane') {
      const beat = Number.parseInt(o.id, 10);
      if (!SCAN.laneBeats.some((x) => Number.parseInt(x.id, 10) === beat)) SCAN.laneBeats.push(o);
    }
  }
  return SCAN;
}
