// Office build stand-in for src/render/popups.ts (build/office-swaps.ts): the judge / pickup popups are the
// v8 ones, shifted down as a group when they would rise under the DOM HUD rows or the boss bar (the office
// pickup lines are long, e.g. "노캔 이어폰 · 못 들은 척 1회").
import { drawPopups as v8Popups, type PopupPool } from '../../render/popups';
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

/** v8 popup font sizes per style (render/popups.ts STYLES) */
const SIZE: Readonly<Record<string, number>> = { perfect: 26, great: 24, good: 22, miss: 24, combo: 16, info: 14 };
const EDGE = 8;

/** x shift that keeps popups centred on the hero (`heroX`) inside the view's left edge, given their half width */
export function popupShift(heroX: number, viewLeft: number, halfWidth: number): number {
  return Math.max(0, viewLeft + EDGE + halfWidth - heroX);
}

/** half the width of the widest active popup at the office scale */
function halfWidest(ctx: Ctx, pool: PopupPool): number {
  let w = 0;
  for (const p of pool.items) {
    if (!p.active) continue;
    ctx.font = `700 ${SIZE[p.style] ?? 16}px ${HUD_FONT}`;
    w = Math.max(w, ctx.measureText(p.text).width);
  }
  return (w * POPUP_SCALE) / 2;
}

export function drawPopups(ctx: Ctx, pool: PopupPool): void {
  const band = lastHudBand();
  let highest = Number.POSITIVE_INFINITY;
  for (const p of pool.items) if (p.active) highest = Math.min(highest, p.y0 - p.bump - DRIFT);
  if (!Number.isFinite(highest)) return;
  const shift = Number.isFinite(band.top) ? Math.max(0, band.top + GAP - highest) : 0;
  // F11: the judge popups read big right above the hero's head, never cut by the screen edge
  const dx = Number.isFinite(band.left) ? popupShift(PLAYER_X, band.left, halfWidest(ctx, pool)) : 0;
  const anchor = highest + DRIFT;
  ctx.save();
  ctx.translate(PLAYER_X + dx, anchor + shift);
  ctx.scale(POPUP_SCALE, POPUP_SCALE);
  ctx.translate(-PLAYER_X, -anchor);
  v8Popups(ctx, pool);
  ctx.restore();
}
