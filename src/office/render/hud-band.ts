// Where the DOM HUD sits over the canvas, in logical px (office spec §9 copy placement): canvas extras go
// below the HUD rows and the boss bar and clear of the boss phase line and the countdown digit. Read from the DOM a few times a
// second; without a DOM (tests) nothing is reserved.
import type { View } from '../../render/view';
import type { Rect } from './surprise';

const HUD_ROWS = '.hud__top, .hud__mid, .hud__bars, .boss:not([hidden]), .tut__card, .brief__card, .mission-card';
const PHASE_LINE = '.bossline';
const COUNTDOWN = '.countdown__num';
const REFRESH = 0.25;

export interface HudBand {
  /** logical y under the lowest visible HUD row */
  top: number;
  /** logical y under the boss phase line while it shows, else −Infinity */
  line: number;
  /** the countdown digit's box (logical) while it shows, else null */
  countdown: Rect | null;
  /** logical x of the view's left / right edges */
  left: number;
  right: number;
  /** logical y under the attack callout drawn last frame, else −Infinity (popups stay below it) */
  callout: number;
  /** centres (logical) of the HUD coin counter and the mission chip; NaN when not shown */
  coin: { x: number; y: number };
  chip: { x: number; y: number };
}

const band: HudBand = { top: Number.NEGATIVE_INFINITY, line: Number.NEGATIVE_INFINITY, countdown: null, left: Number.NaN, right: Number.NaN, callout: Number.NEGATIVE_INFINITY,
  coin: { x: Number.NaN, y: Number.NaN }, chip: { x: Number.NaN, y: Number.NaN },
};
let lastRead = Number.NEGATIVE_INFINITY;

function lowest(selector: string, canvasTop: number): number {
  let y = Number.NEGATIVE_INFINITY;
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.width > 0) y = Math.max(y, r.bottom - canvasTop);
  }
  return y;
}

/** the current band (refreshed at most every REFRESH s of `realTime`) */
export function hudBand(canvas: HTMLCanvasElement, v: View, realTime: number): Readonly<HudBand> {
  band.left = v.x0;
  band.right = v.x0 + v.w;
  if (typeof document === 'undefined' || Math.abs(realTime - lastRead) < REFRESH) return band;
  lastRead = realTime;
  const top = canvas.getBoundingClientRect().top;
  const toLogical = (css: number) => (Number.isFinite(css) ? (css - v.oy) / v.s : css);
  band.top = toLogical(lowest(HUD_ROWS, top));
  band.line = toLogical(lowest(PHASE_LINE, top));
  const cd = document.querySelector<HTMLElement>(COUNTDOWN)?.getBoundingClientRect();
  const left = canvas.getBoundingClientRect().left;
  band.countdown = cd && cd.width > 0 && cd.height > 0
    ? { left: (cd.left - left - v.ox) / v.s, right: (cd.right - left - v.ox) / v.s, top: toLogical(cd.top - top), bottom: toLogical(cd.bottom - top) }
    : null;
  centre(COIN, canvas, v, band.coin);
  centre(CHIP, canvas, v, band.chip);
  return band;
}

const COIN = '.hud .chip--coin';
const CHIP = '.mission-chip';

/** the logical centre of the first visible element matching `selector`, NaN when none */
function centre(selector: string, canvas: HTMLCanvasElement, v: View, out: { x: number; y: number }): void {
  const el = document.querySelector<HTMLElement>(selector);
  const r = el?.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  if (!r || r.width <= 0 || r.height <= 0) {
    out.x = Number.NaN;
    out.y = Number.NaN;
    return;
  }
  out.x = (r.left + r.width / 2 - c.left - v.ox) / v.s;
  out.y = (r.top + r.height / 2 - c.top - v.oy) / v.s;
}

/** the band as last read (for modules drawn inside the v8 frame, e.g. popups) */
export const lastHudBand = (): Readonly<HudBand> => band;

/** the office renderer records the callout's bottom each frame (−Infinity when none is shown) */
export function setCalloutBottom(y: number): void {
  band.callout = y;
}
