// The service space above the corridor ceiling: girders, ducts, cable trays, vent fans and
// status-light panels. Static parts are baked per tile variant; fan blades and LEDs animate
// at fixed tile positions. Kept dark and subdued so the DOM HUD on top stays readable.
import { CEIL_Y } from './layout';
import type { ThemeArt } from './themes';
import { circle, roundRect, seeded, vGrad, type Ctx } from './util';
import type { View } from './view';

export const TOP_Y = -170;
export const TOP_VARIANTS = 3;
const FAN_X: readonly number[] = [96, 352];
/** which fans / LED panels each top variant has (bit 0 = first, bit 1 = second) */
const FAN_MASK: readonly number[] = [3, 1, 2];
const LED_MASK: readonly number[] = [1, 2, 3];
const FAN_Y = CEIL_Y - 96;
const FAN_R = 17;
const LED_X: readonly number[] = [214, 446];
const LED_Y = CEIL_Y - 44;

function duct(ctx: Ctx, x: number, y: number, w: number, h: number, th: ThemeArt): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, x, y + 4, w, h, 6);
  ctx.fill();
  ctx.fillStyle = vGrad(ctx, y, y + h, [[0, th.duct[0]], [1, th.duct[1]]]);
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let rx = x + 24; rx < x + w - 8; rx += 34) ctx.fillRect(rx, y, 3, h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 4, y + 3, w - 8, 2);
}

function tray(ctx: Ctx, w: number, y: number, th: ThemeArt, rnd: () => number): void {
  ctx.strokeStyle = th.girder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.moveTo(0, y + 8);
  ctx.lineTo(w, y + 8);
  for (let x = 6; x < w; x += 14) {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 8);
  }
  ctx.stroke();
  const cols = ['#0E1018', '#3A2A2E', '#22324A', '#4A3A1E'];
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = cols[i];
    ctx.lineWidth = 2 + rnd() * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y + 1 + i * 1.6);
    for (let x = 0; x <= w; x += 120) ctx.quadraticCurveTo(x - 60, y + 2 + i * 1.6 + rnd() * 3, x, y + 1 + i * 1.6);
    ctx.stroke();
  }
}

function fanHousing(ctx: Ctx, x: number, th: ThemeArt): void {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, x - FAN_R - 6, FAN_Y - FAN_R - 6, FAN_R * 2 + 12, FAN_R * 2 + 12, 6);
  ctx.fill();
  ctx.strokeStyle = th.girder;
  ctx.lineWidth = 2.4;
  circle(ctx, x, FAN_Y, FAN_R + 1);
  ctx.stroke();
}

function ledPanel(ctx: Ctx, x: number): void {
  ctx.fillStyle = '#0B0D14';
  roundRect(ctx, x - 16, LED_Y - 6, 32, 12, 3);
  ctx.fill();
}

/** Baked part of one top tile variant. */
export function drawTop(ctx: Ctx, w: number, th: ThemeArt, seed: number): void {
  const rnd = seeded(seed * 3301 + 7);
  ctx.fillStyle = vGrad(ctx, TOP_Y, CEIL_Y, th.top);
  ctx.fillRect(0, TOP_Y, w, CEIL_Y - TOP_Y + 6);
  ctx.strokeStyle = th.girder;
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (const y of [CEIL_Y - 70, CEIL_Y - 150]) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  const flip = seed % 2 === 0;
  for (let x = 0; x < w; x += 80) {
    ctx.moveTo(flip ? x + 80 : x, CEIL_Y - 70);
    ctx.lineTo(flip ? x : x + 80, CEIL_Y - 150);
  }
  ctx.stroke();
  const dx = 20 + rnd() * 120;
  duct(ctx, dx, CEIL_Y - 62, 150 + rnd() * 80, 26, th);
  if (rnd() < 0.7) duct(ctx, 260 + rnd() * 60, CEIL_Y - 140, 110 + rnd() * 60, 20, th);
  tray(ctx, w, CEIL_Y - 30, th, rnd);
  FAN_X.forEach((x, i) => {
    if (FAN_MASK[seed % FAN_MASK.length] & (1 << i)) fanHousing(ctx, x, th);
  });
  LED_X.forEach((x, i) => {
    if (LED_MASK[seed % LED_MASK.length] & (1 << i)) ledPanel(ctx, x);
  });
}

/** Spinning fan blades and blinking status LEDs for one top tile at screen x0. */
export function topFx(ctx: Ctx, v: View, x0: number, variant: number, t: number, th: ThemeArt): void {
  FAN_X.forEach((fx, i) => {
    const cx = x0 + fx;
    if (!(FAN_MASK[variant % FAN_MASK.length] & (1 << i)) || cx < v.x0 - FAN_R || cx > v.x0 + v.w + FAN_R) return;
    ctx.fillStyle = 'rgba(140,150,170,0.45)';
    const a0 = t * 7 + fx;
    for (let b = 0; b < 3; b++) {
      const a = a0 + (b * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * 8, FAN_Y + Math.sin(a) * 8, 8, 3.2, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2A2E3A';
    circle(ctx, cx, FAN_Y, 3);
    ctx.fill();
  });
  LED_X.forEach((lx, j) => {
    const cx = x0 + lx;
    if (!(LED_MASK[variant % LED_MASK.length] & (1 << j)) || cx < v.x0 - 20 || cx > v.x0 + v.w + 20) return;
    for (let i = 0; i < 4; i++) {
      const on = Math.sin(t * (2 + i * 1.3) + lx + i * 2) > 0.2;
      ctx.fillStyle = on ? (i === 3 ? '#FFB627' : th.led) : 'rgba(80,90,110,0.5)';
      circle(ctx, cx - 10 + i * 6.6, LED_Y, 1.8);
      ctx.fill();
    }
  });
}
