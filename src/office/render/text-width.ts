// Cached text widths (perf r4): setting ctx.font and calling measureText every frame for the same few strings
// (judgement popups, attack callouts, speech bubbles) showed up at ~4% of the frame on dense stages.
import type { Ctx } from '../../render/util';

const WIDTHS = new Map<string, number>();
const LIMIT = 512;

// a web font that finishes loading changes every width: measure again
if (typeof document !== 'undefined') document.fonts?.addEventListener?.('loadingdone', () => WIDTHS.clear());

/** the width of `text` in `font` (ctx.font is left set to `font` only when it had to measure) */
export function textWidth(ctx: Ctx, font: string, text: string): number {
  const key = `${font}|${text}`;
  const hit = WIDTHS.get(key);
  if (hit !== undefined) return hit;
  if (WIDTHS.size > LIMIT) WIDTHS.clear();
  ctx.font = font;
  const w = ctx.measureText(text).width;
  // 0 = no font / no layout yet: never cached
  if (w > 0) WIDTHS.set(key, w);
  return w;
}
