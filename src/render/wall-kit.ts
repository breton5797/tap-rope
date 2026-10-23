// Building blocks for the corridor's back wall, drawn into pre-rendered tiles.
import type { Variant } from '../types';
import { circle, FONT, radGrad, roundRect, seeded, starPath, vGrad, type Ctx } from './util';

export function panels(ctx: Ctx, x0: number, w: number, y0: number, y1: number, pw: number, fill: string, edge: string, light: string): void {
  for (let x = x0; x < x0 + w; x += pw) {
    ctx.fillStyle = fill;
    roundRect(ctx, x + 1.5, y0 + 1.5, pw - 3, y1 - y0 - 3, 4);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = light;
    ctx.fillRect(x + 4, y0 + 4, pw - 8, 2);
    ctx.fillStyle = edge;
    for (const [bx, by] of [[x + 6, y0 + 8], [x + pw - 6, y0 + 8], [x + 6, y1 - 8], [x + pw - 6, y1 - 8]] as const) {
      circle(ctx, bx, by, 1.3);
      ctx.fill();
    }
  }
}

export function pipe(ctx: Ctx, x0: number, w: number, y: number, r: number, c0: string, c1: string, joint: string): void {
  ctx.fillStyle = vGrad(ctx, y - r, y + r, [[0, c0], [0.45, c0], [1, c1]]);
  ctx.fillRect(x0, y - r, w, r * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x0, y - r + 1.5, w, Math.max(1, r * 0.35));
  ctx.fillStyle = joint;
  for (let x = x0 + 30; x < x0 + w; x += 120) {
    roundRect(ctx, x, y - r - 2, 8, r * 2 + 4, 2);
    ctx.fill();
  }
}

/** Sky seen through windows, per variant. */
export function windowSky(ctx: Ctx, x: number, y: number, w: number, h: number, variant: Variant, seed: number): void {
  const stops: readonly (readonly [number, string])[] =
    variant === 'dawn' ? [[0, '#3B2A6E'], [0.45, '#E0647C'], [0.8, '#FFB070'], [1, '#FFE2A0']]
      : variant === 'night' ? [[0, '#050A24'], [0.7, '#14205A'], [1, '#2A3A7A']]
        : [[0, '#5AA8E8'], [1, '#BFE4FF']];
  ctx.fillStyle = vGrad(ctx, y, y + h, stops);
  ctx.fillRect(x, y, w, h);
  const rnd = seeded(seed);
  if (variant === 'night') {
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < w * 0.25; i++) {
      ctx.globalAlpha = 0.4 + rnd() * 0.6;
      circle(ctx, x + rnd() * w, y + rnd() * h * 0.6, 0.4 + rnd() * 0.8);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  skyline(ctx, x, y + h, w, variant, rnd);
}

function skyline(ctx: Ctx, x: number, base: number, w: number, variant: Variant, rnd: () => number): void {
  const night = variant === 'night';
  ctx.fillStyle = night ? '#0A0E26' : variant === 'dawn' ? '#4A2850' : '#7FA6C8';
  let bx = x;
  while (bx < x + w) {
    const bw = 8 + rnd() * 14;
    const bh = 10 + rnd() * 30;
    ctx.fillRect(bx, base - bh, bw, bh);
    if (night) {
      ctx.fillStyle = '#FFD27A';
      for (let i = 0; i < 4; i++) if (rnd() < 0.5) ctx.fillRect(bx + 2 + rnd() * (bw - 4), base - bh + 3 + rnd() * (bh - 6), 1.6, 2);
      ctx.fillStyle = '#0A0E26';
    }
    bx += bw + 1;
  }
}

export function windowFrame(ctx: Ctx, x: number, y: number, w: number, h: number, frame: string, variant: Variant, seed: number): void {
  ctx.save();
  roundRect(ctx, x, y, w, h, 6);
  ctx.clip();
  windowSky(ctx, x, y, w, h, variant, seed);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.15, y);
  ctx.lineTo(x + w * 0.45, y);
  ctx.lineTo(x + w * 0.15, y + h);
  ctx.lineTo(x - w * 0.15, y + h);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = frame;
  ctx.lineWidth = 4;
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();
}

export function monitor(ctx: Ctx, x: number, y: number, w: number, h: number, glow: string, seed: number): void {
  ctx.fillStyle = '#1A1F2E';
  roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 4);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, x + w / 2, y + h / 2, 2, w, [[0, '#123A3A'], [1, '#07161C']]);
  ctx.fillRect(x, y, w, h);
  const rnd = seeded(seed);
  ctx.strokeStyle = glow;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const px = x + 3 + (i / 10) * (w - 6);
    const py = y + h * 0.7 - rnd() * h * 0.45;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = glow;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 4, y + 4 + i * 4, 6 + rnd() * 14, 1.6);
}

export function cell(ctx: Ctx, x: number, y: number, w: number, h: number, num: string): void {
  ctx.fillStyle = vGrad(ctx, y, y + h, [[0, '#14111E'], [1, '#221C30']]);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#3A3348';
  roundRect(ctx, x + 8, y + h - 22, w - 16, 10, 3);
  ctx.fill();
  ctx.fillStyle = '#5A5070';
  roundRect(ctx, x + 10, y + h - 26, 18, 6, 3);
  ctx.fill();
  ctx.strokeStyle = '#9AA0B8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let bx = x + 6; bx < x + w; bx += 10) {
    ctx.moveTo(bx, y);
    ctx.lineTo(bx, y + h);
  }
  ctx.moveTo(x, y + h * 0.35);
  ctx.lineTo(x + w, y + h * 0.35);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#FFD23F';
  roundRect(ctx, x + w / 2 - 11, y - 14, 22, 11, 3);
  ctx.fill();
  ctx.font = `800 8px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2A2238';
  ctx.fillText(num, x + w / 2, y - 8.3);
}

export function hazardBand(ctx: Ctx, x0: number, w: number, y: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#FFC93C';
  ctx.fillRect(x0, y, w, h);
  ctx.fillStyle = '#26232E';
  for (let x = x0 - h; x < x0 + w + h; x += h * 2) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + h, y);
    ctx.lineTo(x + h * 2, y);
    ctx.lineTo(x + h, y + h);
    ctx.fill();
  }
  ctx.restore();
}

export function sign(ctx: Ctx, x: number, y: number, text: string, bg: string, fg: string): void {
  ctx.font = `800 9px ${FONT}`;
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = bg;
  roundRect(ctx, x - w / 2, y - 8, w, 16, 4);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

export function wallLamp(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.fillStyle = radGrad(ctx, x, y + 4, 1, 34, [[0, color], [1, 'rgba(0,0,0,0)']]);
  ctx.globalCompositeOperation = 'lighter';
  circle(ctx, x, y + 4, 34);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#2A2F40';
  roundRect(ctx, x - 7, y - 4, 14, 8, 3);
  ctx.fill();
  ctx.fillStyle = '#FFF4CC';
  roundRect(ctx, x - 5, y, 10, 4, 2);
  ctx.fill();
}

export function crate(ctx: Ctx, x: number, base: number, s: number): void {
  ctx.fillStyle = '#8A6A44';
  roundRect(ctx, x, base - s, s, s, 3);
  ctx.fill();
  ctx.strokeStyle = '#5A4228';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 3, base - 3);
  ctx.lineTo(x + s - 3, base - s + 3);
  ctx.stroke();
}

export function camera(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = '#3A4058';
  ctx.fillRect(x - 1.5, y, 3, 8);
  ctx.fillStyle = '#D8DEEA';
  roundRect(ctx, x - 10, y + 6, 18, 9, 3);
  ctx.fill();
  ctx.fillStyle = '#1A1F2E';
  circle(ctx, x - 8, y + 10.5, 3);
  ctx.fill();
  ctx.fillStyle = '#FF3B4E';
  circle(ctx, x + 4, y + 9, 1.4);
  ctx.fill();
}

export function badgeStar(ctx: Ctx, x: number, y: number, r: number, c: string): void {
  ctx.fillStyle = c;
  starPath(ctx, x, y, r, r * 0.45, 5);
  ctx.fill();
}
