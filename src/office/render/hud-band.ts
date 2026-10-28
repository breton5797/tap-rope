// Where the DOM HUD sits over the canvas, in logical px (office spec §9 copy placement): canvas extras go
// below the HUD rows and the boss bar and clear of the boss phase line. Read from the DOM a few times a
// second; without a DOM (tests) nothing is reserved.
import type { View } from '../../render/view';

const HUD_ROWS = '.hud__top, .hud__mid, .hud__bars, .boss:not([hidden]), .tut__card, .brief__card';
const PHASE_LINE = '.bossline';
const REFRESH = 0.25;

export interface HudBand {
  /** logical y under the lowest visible HUD row */
  top: number;
  /** logical y under the boss phase line while it shows, else −Infinity */
  line: number;
}

const band: HudBand = { top: Number.NEGATIVE_INFINITY, line: Number.NEGATIVE_INFINITY };
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
  if (typeof document === 'undefined' || Math.abs(realTime - lastRead) < REFRESH) return band;
  lastRead = realTime;
  const top = canvas.getBoundingClientRect().top;
  const toLogical = (css: number) => (Number.isFinite(css) ? (css - v.oy) / v.s : css);
  band.top = toLogical(lowest(HUD_ROWS, top));
  band.line = toLogical(lowest(PHASE_LINE, top));
  return band;
}

/** the band as last read (for modules drawn inside the v8 frame, e.g. popups) */
export const lastHudBand = (): Readonly<HudBand> => band;
