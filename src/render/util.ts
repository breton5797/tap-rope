// Small drawing helpers shared by every render module.

export type Ctx = CanvasRenderingContext2D;
export type Stops = readonly (readonly [number, string])[];

export const TAU = Math.PI * 2;
export const FONT = 'Rajdhani, "IBM Plex Sans KR", "Arial Narrow", system-ui, sans-serif';

/** Colors per jump level (index 1..3); index 0 is a neutral fallback. */
export const LEVEL_FILL: readonly string[] = ['#A7B4C8', '#3DDC97', '#FFB627', '#FF5E5B'];
export const LEVEL_DARK: readonly string[] = ['#5D6A80', '#138456', '#B06F00', '#B32D2B'];
export const LEVEL_LIGHT: readonly string[] = ['#E3E9F2', '#B9F7DA', '#FFE5A1', '#FFB8B6'];

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/** Deterministic PRNG so pre-rendered scenery is identical every build. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
}

export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
}

/** Star path with `points` tips. */
export function starPath(ctx: Ctx, x: number, y: number, r: number, inner: number, points: number): void {
  ctx.beginPath();
  const n = points * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2;
    const rad = i % 2 === 0 ? r : inner;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function vGrad(ctx: Ctx, y0: number, y1: number, stops: Stops): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function radGrad(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: Stops): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Drop a canvas's backing store now (WebKit keeps it until GC otherwise). */
export function releaseCanvas(c: HTMLCanvasElement | null): void {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

export interface Surface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: Ctx;
}

export function makeCanvas(pw: number, ph: number): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(pw));
  canvas.height = Math.max(1, Math.ceil(ph));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return { canvas, ctx };
}

/** Text with a thick rounded outline. Caller sets font/textAlign/baseline. */
export function outlinedText(ctx: Ctx, text: string, x: number, y: number, fill: string | CanvasGradient, stroke: string, lw: number): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
