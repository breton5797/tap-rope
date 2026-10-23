// Interchangeable wall features. Each tile variant fills three slots with features picked by
// a seeded hash, so the corridor doesn't visibly repeat. Features draw in tile coords.
import { GROUND_Y, type Variant } from '../types';
import { CEIL_Y } from './layout';
import { circle, FONT, radGrad, roundRect, vGrad, type Ctx } from './util';
import { camera, cell, crate, monitor, sign, windowFrame } from './wall-kit';

export type Feature = (ctx: Ctx, x: number, w: number, rnd: () => number, variant: Variant) => void;

/** y at a fraction of the way from the ceiling down to the floor */
export const at = (f: number): number => Math.round(CEIL_Y + (GROUND_Y - CEIL_Y) * f);
const FLOOR_TOP = GROUND_Y - 24;

function label(ctx: Ctx, x: number, y: number, text: string, color: string): void {
  ctx.font = `800 8px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function door(ctx: Ctx, x: number, w: number, frame: string, panel: string, stripe: string, text: string, open: boolean): void {
  const dw = Math.min(w - 10, 86);
  const dx = x + (w - dw) / 2;
  const top = at(0.3);
  ctx.fillStyle = frame;
  roundRect(ctx, dx - 6, top - 6, dw + 12, FLOOR_TOP - top + 6, 6);
  ctx.fill();
  ctx.fillStyle = '#0E1018';
  ctx.fillRect(dx, top, dw, FLOOR_TOP - top);
  const gap = open ? 10 : 0;
  ctx.fillStyle = vGrad(ctx, top, FLOOR_TOP, [[0, panel], [1, frame]]);
  ctx.fillRect(dx, top, dw / 2 - gap, FLOOR_TOP - top);
  ctx.fillRect(dx + dw / 2 + gap, top, dw / 2 - gap, FLOOR_TOP - top);
  ctx.fillStyle = stripe;
  ctx.fillRect(dx, top + (FLOOR_TOP - top) * 0.55, dw / 2 - gap, 5);
  ctx.fillRect(dx + dw / 2 + gap, top + (FLOOR_TOP - top) * 0.55, dw / 2 - gap, 5);
  ctx.fillStyle = open ? '#3DDC97' : '#FF3358';
  circle(ctx, dx + dw + 12, top + 30, 3);
  ctx.fill();
  sign(ctx, dx + dw / 2, top - 16, text, stripe, '#16141E');
}

function lockers(ctx: Ctx, x: number, w: number, color: string, dark: string): void {
  const n = Math.max(2, Math.floor((w - 10) / 28));
  const lw = (w - 10) / n;
  const top = at(0.34);
  for (let i = 0; i < n; i++) {
    const lx = x + 5 + i * lw;
    ctx.fillStyle = vGrad(ctx, top, FLOOR_TOP, [[0, color], [1, dark]]);
    roundRect(ctx, lx + 1, top, lw - 2, FLOOR_TOP - top, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < 3; k++) ctx.fillRect(lx + 5, top + 8 + k * 4, lw - 10, 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(lx + lw - 7, top + 50, 2, 10);
  }
}

function tank(ctx: Ctx, x: number, w: number, glass: string, liquid: string, rnd: () => number): void {
  const tw = Math.min(56, w - 16);
  const tx = x + (w - tw) / 2;
  const top = at(0.22);
  ctx.fillStyle = '#7A8896';
  roundRect(ctx, tx - 6, top - 10, tw + 12, 12, 4);
  ctx.fill();
  roundRect(ctx, tx - 6, FLOOR_TOP - 10, tw + 12, 12, 4);
  ctx.fill();
  ctx.fillStyle = glass;
  ctx.fillRect(tx, top, tw, FLOOR_TOP - 10 - top);
  ctx.fillStyle = radGrad(ctx, tx + tw / 2, FLOOR_TOP - 60, 4, 80, [[0, liquid], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(tx, top + 30, tw, FLOOR_TOP - 40 - top);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 7; i++) {
    circle(ctx, tx + 6 + rnd() * (tw - 12), top + 40 + rnd() * (FLOOR_TOP - top - 60), 1 + rnd() * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(tx + 5, top + 4, 4, FLOOR_TOP - top - 20);
}

function gauges(ctx: Ctx, x: number, w: number, rnd: () => number): void {
  const top = at(0.36);
  ctx.fillStyle = '#2A2224';
  roundRect(ctx, x + 10, top, w - 20, 70, 6);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const gx = x + 10 + ((i + 0.5) * (w - 20)) / 3;
    ctx.fillStyle = '#F2EEE4';
    circle(ctx, gx, top + 26, 11);
    ctx.fill();
    ctx.strokeStyle = '#C8323F';
    ctx.lineWidth = 1.6;
    const a = Math.PI * (0.8 + rnd() * 1.4);
    ctx.beginPath();
    ctx.moveTo(gx, top + 26);
    ctx.lineTo(gx + Math.cos(a) * 8, top + 26 + Math.sin(a) * 8);
    ctx.stroke();
    ctx.fillStyle = i === 1 ? '#3DDC97' : '#FFC93C';
    circle(ctx, gx, top + 54, 3);
    ctx.fill();
  }
}

function ladder(ctx: Ctx, x: number, w: number): void {
  const lx = x + w / 2;
  ctx.strokeStyle = '#8A8F9E';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lx - 10, CEIL_Y + 10);
  ctx.lineTo(lx - 10, FLOOR_TOP);
  ctx.moveTo(lx + 10, CEIL_Y + 10);
  ctx.lineTo(lx + 10, FLOOR_TOP);
  for (let y = CEIL_Y + 22; y < FLOOR_TOP; y += 14) {
    ctx.moveTo(lx - 10, y);
    ctx.lineTo(lx + 10, y);
  }
  ctx.stroke();
}

function board(ctx: Ctx, x: number, w: number, rnd: () => number): void {
  const top = at(0.3);
  ctx.fillStyle = '#7A5A3E';
  roundRect(ctx, x + 12, top, w - 24, 72, 4);
  ctx.fill();
  const cols = ['#FFFFFF', '#FFE08A', '#FFB3C0', '#B9E6FF'];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = cols[i % cols.length];
    const px = x + 18 + rnd() * (w - 56);
    const py = top + 6 + rnd() * 34;
    ctx.save();
    ctx.translate(px + 12, py + 14);
    ctx.rotate((rnd() - 0.5) * 0.3);
    ctx.fillRect(-12, -14, 24, 28);
    ctx.fillStyle = '#C8323F';
    circle(ctx, 0, -12, 1.8);
    ctx.fill();
    ctx.restore();
  }
}

function labRoom(ctx: Ctx, x: number, w: number, rnd: () => number): void {
  const top = at(0.2);
  const h = 120;
  ctx.fillStyle = vGrad(ctx, top, top + h, [[0, '#BFF3E6'], [1, '#7FD8C6']]);
  roundRect(ctx, x + 6, top, w - 12, h, 6);
  ctx.fill();
  const n = Math.floor((w - 24) / 28);
  for (let i = 0; i < n; i++) {
    const fx = x + 16 + i * 28;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    roundRect(ctx, fx, top + h - 34, 12, 26, 5);
    ctx.fill();
    ctx.fillStyle = ['#FF7AB6', '#7BE0FF', '#B8FF7A', '#FFD27A'][i % 4];
    roundRect(ctx, fx + 1.5, top + h - 20 - rnd() * 8, 9, 12, 4);
    ctx.fill();
  }
  ctx.strokeStyle = '#9AAAB8';
  ctx.lineWidth = 4;
  roundRect(ctx, x + 6, top, w - 12, h, 6);
  ctx.stroke();
}

function windowSlot(ctx: Ctx, x: number, w: number, frame: string, variant: Variant, rnd: () => number, big: boolean): void {
  const h = big ? 150 : 72;
  windowFrame(ctx, x + 8, big ? at(0.18) : at(0.3), w - 16, h, frame, variant, Math.floor(rnd() * 999));
  if (big && variant === 'dawn') lightShaft(ctx, x + 8, w - 16);
}

/** Warm sunrise light falling from a big window onto the floor. */
function lightShaft(ctx: Ctx, x: number, w: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, at(0.2), 0, GROUND_Y);
  g.addColorStop(0, 'rgba(255,190,120,0.22)');
  g.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x + 20, at(0.2));
  ctx.lineTo(x + w, at(0.2));
  ctx.lineTo(x + w - 50, GROUND_Y);
  ctx.lineTo(x - 40, GROUND_Y);
  ctx.fill();
  ctx.restore();
}

export interface FeatureSet {
  readonly window: Feature;
  readonly list: readonly Feature[];
}

export const FEATURES: readonly FeatureSet[] = [
  {
    window: (c, x, w, r, v) => windowSlot(c, x, w, '#56627E', v, r, v === 'night' || v === 'dawn'),
    list: [
      (c, x, w, r, v) => windowSlot(c, x, w, '#56627E', v, r, false),
      (c, x, w, r) => door(c, x, w, '#3A4562', '#56627E', '#FFC93C', r() < 0.5 ? 'B-2' : 'EXIT', r() < 0.3),
      (c, x, w) => lockers(c, x, w, '#4A6A9A', '#2A3A5A'),
      (c, x, w, r) => {
        monitor(c, x + w / 2 - 30, at(0.28), 60, 40, '#3DFFB4', Math.floor(r() * 99));
        camera(c, x + w / 2, CEIL_Y + 8);
        sign(c, x + w / 2, at(0.52), 'SECURITY', '#FFC93C', '#26232E');
      },
      (c, x, w) => {
        crate(c, x + w - 40, FLOOR_TOP, 28);
        crate(c, x + w - 66, FLOOR_TOP, 24);
        crate(c, x + w - 54, FLOOR_TOP - 26, 22);
      },
    ],
  },
  {
    window: (c, x, w, r, v) => windowSlot(c, x, w, '#9AAAB8', v, r, true),
    list: [
      (c, x, w, r) => labRoom(c, x, w, r),
      (c, x, w, r) => {
        monitor(c, x + w / 2 - 30, at(0.26), 60, 40, '#3DFFB4', Math.floor(r() * 99));
        monitor(c, x + w / 2 - 30, at(0.44), 60, 28, '#7BE0FF', Math.floor(r() * 99));
      },
      (c, x, w, r) => tank(c, x, w, 'rgba(200,255,240,0.35)', 'rgba(80,255,200,0.6)', r),
      (c, x, w, r) => door(c, x, w, '#B9C7D2', '#F2F7FA', '#3DDCB4', r() < 0.5 ? 'LAB-07' : 'CLEAN', r() < 0.3),
      (c, x, w) => sign(c, x + w / 2, at(0.4), 'BIOHAZARD', '#FFC93C', '#26232E'),
    ],
  },
  {
    window: (c, x, w, r, v) => windowSlot(c, x, w, '#6A6280', v, r, true),
    list: [
      (c, x, w, r) => cell(c, x + 6, at(0.3), w - 12, GROUND_Y - 26 - at(0.3), `A-${10 + Math.floor(r() * 20)}`),
      (c, x, w, r) => cell(c, x + 6, at(0.3), w - 12, GROUND_Y - 26 - at(0.3), `B-${10 + Math.floor(r() * 20)}`),
      (c, x, w, r) => door(c, x, w, '#2A2536', '#5A546A', '#C8323F', r() < 0.5 ? 'GUARD' : 'BLOCK A', false),
      (c, x, w, r) => board(c, x, w, r),
    ],
  },
  {
    window: (c, x, w, r, v) => windowSlot(c, x, w, '#6A5050', v, r, true),
    list: [
      (c, x, w, r) => gauges(c, x, w, r),
      (c, x, w, r) => tank(c, x, w, 'rgba(120,90,70,0.6)', 'rgba(120,255,150,0.45)', r),
      (c, x, w) => ladder(c, x, w),
      (c, x, w) => sign(c, x + w / 2, at(0.42), 'DANGER', '#FFC93C', '#26232E'),
      (c, x, w, r) => {
        crate(c, x + w / 2 - 14, FLOOR_TOP, 28);
        label(c, x + w / 2, at(0.5), r() < 0.5 ? 'P-3' : 'P-7', '#FFC93C');
      },
    ],
  },
];
