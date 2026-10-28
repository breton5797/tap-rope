// Office build stand-in for src/render/popups.ts (build/office-swaps.ts): the judge / pickup popups are the
// v8 ones, shifted down as a group when they would rise under the DOM HUD rows or the boss bar (the office
// pickup lines are long, e.g. "노캔 이어폰 · 못 들은 척 1회").
import { drawPopups as v8Popups, type PopupPool } from '../../render/popups';
import type { Ctx } from '../../render/util';
import { lastHudBand } from './hud-band';

export * from '../../render/popups';

/** room kept between the HUD and the highest popup's text centre */
const GAP = 16;
/** how far a popup rises over its life (v8 drawPopups: 16 px drift) */
const DRIFT = 16;

export function drawPopups(ctx: Ctx, pool: PopupPool): void {
  const top = lastHudBand().top;
  let highest = Number.POSITIVE_INFINITY;
  for (const p of pool.items) if (p.active) highest = Math.min(highest, p.y0 - p.bump - DRIFT);
  const shift = Number.isFinite(top) && Number.isFinite(highest) ? Math.max(0, top + GAP - highest) : 0;
  if (shift === 0) {
    v8Popups(ctx, pool);
    return;
  }
  ctx.save();
  ctx.translate(0, shift);
  v8Popups(ctx, pool);
  ctx.restore();
}
