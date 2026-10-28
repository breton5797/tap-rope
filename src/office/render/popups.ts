// Office build stand-in for src/render/popups.ts (build/office-swaps.ts): the v8 popup pool (PopupPool), drawn
// office-style — bigger, right above the hero, kept on screen and below the DOM HUD rows (the office pickup lines
// are long, e.g. "노캔 이어폰 · 못 들은 척 1회"), never doubled, and quickly dimmed so they never hide the hero.
import type { PopupPool } from '../../render/popups';
import { PLAYER_X } from '../../types';
import { HUD_FONT } from '../../render/lane-icons';
import type { Ctx } from '../../render/util';
import { lastHudBand } from './hud-band';

export * from '../../render/popups';

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

/** x shift that keeps popups centred on the hero (`heroX`) inside the view's left edge, given their half width */
export function popupShift(heroX: number, viewLeft: number, halfWidth: number): number {
  return Math.max(0, viewLeft + EDGE + halfWidth - heroX);
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
    ctx.font = fontOf(STYLE[p.style]?.size ?? 16);
    w = Math.max(w, ctx.measureText(p.text).width);
  }
  return (w * POPUP_SCALE) / 2;
}

/** never two popups with the same text at once: the newest one stays (art review: no stacked PERFECTs) */
function coalesce(pool: PopupPool): void {
  for (const p of pool.items) {
    if (!p.active) continue;
    for (const q of pool.items) if (q !== p && q.active && q.text === p.text && q.age > p.age) q.active = false;
  }
}

function drawOne(ctx: Ctx, p: PopupPool['items'][number]): void {
  const st = STYLE[p.style] ?? STYLE.info;
  const k = Math.min(1, p.age / 0.12);
  const sc = 1.12 - 0.12 * k * (2 - k);
  const y = p.y0 - DRIFT * Math.min(1, p.age / p.life) - p.bump;
  ctx.save();
  ctx.globalAlpha = popupAlpha(p.age, p.life);
  ctx.translate(PLAYER_X, y);
  ctx.scale(sc, sc);
  ctx.font = fontOf(st.size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(46,36,51,0.85)';
  ctx.strokeText(p.text, 0, 0);
  ctx.fillStyle = st.color;
  ctx.fillText(p.text, 0, 0);
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

export function drawPopups(ctx: Ctx, pool: PopupPool): void {
  coalesce(pool);
  const band = lastHudBand();
  let highest = Number.POSITIVE_INFINITY;
  for (const p of pool.items) if (p.active) highest = Math.min(highest, p.y0 - p.bump - DRIFT);
  if (!Number.isFinite(highest)) return;
  // below the HUD rows and below the attack callout while it shows
  const shift = popupRise(Math.max(band.top, band.callout), highest);
  const dx = Number.isFinite(band.left) ? popupShift(PLAYER_X, band.left, halfWidest(ctx, pool)) : 0;
  const anchor = highest + DRIFT;
  ctx.save();
  ctx.translate(PLAYER_X + dx, anchor + shift);
  ctx.scale(POPUP_SCALE, POPUP_SCALE);
  ctx.translate(-PLAYER_X, -anchor);
  for (const p of pool.items) if (p.active) drawOne(ctx, p);
  ctx.restore();
}
