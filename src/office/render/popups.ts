// Office build stand-in for src/render/popups.ts (build/office-swaps.ts): the v8 popup pool (PopupPool), drawn
// office-style — bigger, right above the hero, kept on screen and below the DOM HUD rows (the office pickup lines
// are long, e.g. "노캔 이어폰 · 못 들은 척 1회"), never doubled, and quickly dimmed so they never hide the hero.
import type { PopupPool } from '../../render/popups';
import { PLAYER_X } from '../../types';
import { HUD_FONT } from '../../render/lane-icons';
import type { Ctx } from '../../render/util';
import { lastHudBand } from './hud-band';

export * from '../../render/popups';
import { textWidth } from './text-width';
import { makeCanvas } from '../../render/util';

/** room kept between the HUD and the highest popup's text centre */
const GAP = 16;
/** judge popups are drawn this much larger than v8 */
const POPUP_SCALE = 1.35;
/** how far a popup rises over its life (v8 drawPopups: 16 px drift) */
const DRIFT = 16;

/** v8 popup styles (render/popups.ts STYLES): font size and colour */
const STYLE: Readonly<Record<string, { size: number; color: string }>> = {
  perfect: { size: 26, color: '#3FE0D0' }, great: { size: 24, color: '#A6F0E8' }, good: { size: 22, color: '#E8ECEF' },
  miss: { size: 24, color: '#FF2A3A' }, combo: { size: 16, color: '#FFB020' }, info: { size: 14, color: '#E8ECEF' },
};
const EDGE = 8;
/** popups dim to half within this long, so they never hide the hero (art review) */
const DIM_TIME = 0.15;

/** x shift that keeps popups centred on the hero (`heroX`) inside the view's edges, given their half width */
export function popupShift(heroX: number, viewLeft: number, viewRight: number, halfWidth: number): number {
  const right = viewRight - EDGE - halfWidth - heroX;
  const left = viewLeft + EDGE + halfWidth - heroX;
  return left > 0 ? left : Math.min(0, right);
}

/** opacity at `age` of a popup living `life` s: full → half within DIM_TIME, then fade out over the last 20% */
export function popupAlpha(age: number, life: number): number {
  if (age >= life) return 0;
  const dim = age < DIM_TIME ? 1 - 0.5 * (age / DIM_TIME) : 0.5;
  const tail = age > life * 0.8 ? (life - age) / (life * 0.2) : 1;
  return Math.max(0, dim * tail);
}

const fontOf = (size: number): string => FONTS.get(size) ?? `700 ${size}px ${HUD_FONT}`;
const FONTS = new Map(Object.values(STYLE).map((st) => [st.size, `700 ${st.size}px ${HUD_FONT}`]));

/** half the width of the widest active popup at the office scale */
function halfWidest(ctx: Ctx, pool: PopupPool): number {
  let w = 0;
  for (const p of pool.items) {
    if (!p.active) continue;
    w = Math.max(w, textWidth(ctx, fontOf(STYLE[p.style]?.size ?? 16), p.text));
  }
  // the settle-in pop (×1.12) and the stroke both widen the drawn text
  return (w * POPUP_SCALE * 1.12) / 2 + 3;
}

/** never two popups with the same text at once: the newest one stays (art review: no stacked PERFECTs) */
function coalesce(pool: PopupPool): void {
  for (const p of pool.items) {
    if (!p.active) continue;
    for (const q of pool.items) if (q !== p && q.active && q.text === p.text && q.age > p.age) q.active = false;
  }
}

/** judgement popups fade to this while an attack callout is on screen (they never compete with it) */
const UNDER_CALLOUT = 0.35;

/** the popups' opacity factor given the callout's bottom (−Infinity = no callout this frame) */
export function calloutFade(callout: number): number {
  return Number.isFinite(callout) ? UNDER_CALLOUT : 1;
}

/** bitmap render scales (device px per text unit) are rounded up to this step: a few bitmaps per text */
const BUCKET = 0.25;

/** the bitmap scale for a draw at `m` device px per text unit (never below it: bitmaps are only downscaled) */
export function popupBucket(m: number): number {
  return Math.ceil(m / BUCKET - 1e-9) * BUCKET;
}

/** the popup text painted as before: white outer rim, dark ink, the style colour (centre at 0, 0) */
function paintText(ctx: Ctx, text: string, size: number, color: string): void {
  ctx.font = fontOf(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // white outer rim, then dark ink: the teal PERFECT reads on pastel walls too (art review)
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#FFFFFF';
  ctx.strokeText(text, 0, 0);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(46,36,51,0.85)';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
}

interface TextBitmap {
  readonly canvas: HTMLCanvasElement;
  /** text units from the bitmap's centre to its edges */
  readonly halfW: number;
  readonly halfH: number;
}

/**
 * perf r4: each (text, style, scale bucket) is painted once into a bitmap and blitted — three text passes
 * per popup per frame were ~4% of a dense frame. Null where no canvas can be made (tests): paint directly.
 */
const BITMAPS = new Map<string, TextBitmap | null>();

function textBitmap(ctx: Ctx, text: string, size: number, color: string, scale: number): TextBitmap | null {
  const key = `${size}|${color}|${scale}|${text}`;
  const hit = BITMAPS.get(key);
  if (hit !== undefined) return hit;
  if (BITMAPS.size > 96) BITMAPS.clear();
  let out: TextBitmap | null = null;
  try {
    const halfW = textWidth(ctx, fontOf(size), text) / 2 + 6;
    const halfH = size * 0.8 + 4;
    if (halfW > 6) {
      const { canvas, ctx: b } = makeCanvas(2 * halfW * scale, 2 * halfH * scale);
      b.setTransform(scale, 0, 0, scale, canvas.width / 2, canvas.height / 2);
      paintText(b, text, size, color);
      out = { canvas, halfW: canvas.width / scale / 2, halfH: canvas.height / scale / 2 };
    }
  } catch {
    out = null;
  }
  // a missing width (fonts not ready) is not cached as a failure
  if (out || textWidth(ctx, fontOf(size), text) > 0) BITMAPS.set(key, out);
  return out;
}

// a web font that finishes loading changes the glyphs: paint again
if (typeof document !== 'undefined') document.fonts?.addEventListener?.('loadingdone', () => BITMAPS.clear());

/** a fixed word is baked once; a text with a number (combo counts, ₵ amounts) changes every time: painted */
export function bitmapWorthy(text: string): boolean {
  return !/\d/.test(text);
}

function drawOne(ctx: Ctx, p: PopupPool['items'][number], fade: number): void {
  const st = STYLE[p.style] ?? STYLE.info;
  const k = Math.min(1, p.age / 0.12);
  const sc = 1.12 - 0.12 * k * (2 - k);
  const y = p.y0 - DRIFT * Math.min(1, p.age / p.life) - p.bump;
  ctx.save();
  ctx.globalAlpha = popupAlpha(p.age, p.life) * fade;
  ctx.translate(PLAYER_X, y);
  ctx.scale(sc, sc);
  const m = ctx.getTransform();
  const bmp = bitmapWorthy(p.text) ? textBitmap(ctx, p.text, st.size, st.color, popupBucket(Math.hypot(m.a, m.b))) : null;
  if (bmp) ctx.drawImage(bmp.canvas, -bmp.halfW, -bmp.halfH, 2 * bmp.halfW, 2 * bmp.halfH);
  else paintText(ctx, p.text, st.size, st.color);
  ctx.restore();
}

/**
 * v8 contract. Office: popups centred right above the hero at 1.35×, kept on screen and under the HUD, never
 * two with the same text, dimming to half within 0.15 s so a PERFECT never hides the hero.
 */
/**
 * How far to push the popups down so the highest one's scaled text (centre `highest`, scaled POPUP_SCALE×
 * around its resting line) stays GAP below `line` (the HUD rows / the attack callout); 0 without a line.
 */
export function popupRise(line: number, highest: number): number {
  if (!Number.isFinite(line)) return 0;
  return Math.max(0, line + GAP - highest - DRIFT + DRIFT * POPUP_SCALE);
}

/** half the white outer rim's stroke (7 px) around the judgement text: part of its drawn box */
export const POPUP_RIM = 3.5;

/** room between the attack callout's bottom and the top of the highest judgement text (logical px) */
const CALLOUT_MARGIN = 6;

interface PopupGeom {
  readonly y0: number;
  readonly bump: number;
  readonly age: number;
  readonly life: number;
  readonly size: number;
}

/** the settle-in pop: 1.12× on spawn easing to 1× within 0.12 s */
const popScale = (age: number): number => {
  const k = Math.min(1, age / 0.12);
  return 1.12 - 0.12 * k * (2 - k);
};
const restY = (p: PopupGeom): number => p.y0 - DRIFT * Math.min(1, p.age / p.life) - p.bump;

/** the resting anchor the stack scales around (v8 drift, office 1.35×) */
function anchorOf(items: readonly PopupGeom[]): number {
  let highest = Number.POSITIVE_INFINITY;
  for (const p of items) highest = Math.min(highest, p.y0 - p.bump - DRIFT);
  return highest + DRIFT;
}

/**
 * The stack's vertical shift: below the HUD rows (popupRise) and, while a callout shows, far enough that the
 * scaled text box of every popup (its pop included) starts below the callout's bottom — never intersecting it.
 */
function stackShift(items: readonly PopupGeom[], callout: number, hudLine: number): number {
  const anchor = anchorOf(items);
  let shift = popupRise(hudLine, anchor - DRIFT);
  if (Number.isFinite(callout)) {
    let top = Number.POSITIVE_INFINITY;
    for (const p of items) top = Math.min(top, anchor + POPUP_SCALE * (restY(p) - anchor) - (p.size / 2 + POPUP_RIM) * popScale(p.age) * POPUP_SCALE);
    shift = Math.max(shift, callout + CALLOUT_MARGIN - top);
  }
  return shift;
}

/** test seam: each popup's drawn text centre and top after the stack shift (logical px) */
export function popupBoxes(items: readonly PopupGeom[], callout: number, hudLine: number): { centre: number; top: number }[] {
  const anchor = anchorOf(items);
  const shift = stackShift(items, callout, hudLine);
  return items.map((p) => {
    const centre = anchor + shift + POPUP_SCALE * (restY(p) - anchor);
    return { centre, top: centre - (p.size / 2 + POPUP_RIM) * popScale(p.age) * POPUP_SCALE };
  });
}

/** reused per frame: the active popups' geometry (no per-frame allocation once warm) */
const GEOM: { y0: number; bump: number; age: number; life: number; size: number }[] = [];

export function drawPopups(ctx: Ctx, pool: PopupPool): void {
  coalesce(pool);
  const band = lastHudBand();
  let n = 0;
  for (const p of pool.items) {
    if (!p.active) continue;
    const g = GEOM[n] ?? (GEOM[n] = { y0: 0, bump: 0, age: 0, life: 1, size: 16 });
    g.y0 = p.y0;
    g.bump = p.bump;
    g.age = p.age;
    g.life = p.life;
    g.size = STYLE[p.style]?.size ?? 16;
    n++;
  }
  if (n === 0) return;
  const items = n === GEOM.length ? GEOM : GEOM.slice(0, n);
  const highest = anchorOf(items) - DRIFT;
  // below the HUD rows, and entirely below the attack callout while it shows (round 2 #9)
  const shift = stackShift(items, band.callout, band.top);
  const dx = Number.isFinite(band.left) ? popupShift(PLAYER_X, band.left, band.right, halfWidest(ctx, pool)) : 0;
  const anchor = highest + DRIFT;
  ctx.save();
  ctx.translate(PLAYER_X + dx, anchor + shift);
  ctx.scale(POPUP_SCALE, POPUP_SCALE);
  ctx.translate(-PLAYER_X, -anchor);
  const fade = calloutFade(band.callout);
  for (const p of pool.items) if (p.active) drawOne(ctx, p, fade);
  ctx.restore();
}

/** the fixed popup words with their styles, baked ahead (the run's first PERFECT no longer pays for its bitmap) */
const WARM_WORDS: readonly (readonly [string, string])[] = [['PERFECT', 'perfect'], ['GREAT', 'great'], ['GOOD', 'good'], ['OVERDRIVE', 'combo']];

/** what warmPopups bakes for a view of `k` device px per logical px: the words and the pop's scale buckets */
export function warmPopupPlan(k: number): { texts: string[]; buckets: number[] } {
  const buckets = [...new Set([1, 1.04, 1.08, 1.12].map((sc) => popupBucket(k * POPUP_SCALE * sc)))];
  return { texts: WARM_WORDS.map(([t]) => t), buckets };
}

/** bake one pending warm-up bitmap; false once all are baked (call while idle) */
export function warmPopups(ctx: Ctx, k: number): boolean {
  const { buckets } = warmPopupPlan(k);
  for (const [text, style] of WARM_WORDS) {
    const st = STYLE[style] ?? STYLE.info;
    for (const b of buckets) {
      if (BITMAPS.has(`${st.size}|${st.color}|${b}|${text}`)) continue;
      textBitmap(ctx, text, st.size, st.color, b);
      return true;
    }
  }
  return false;
}
