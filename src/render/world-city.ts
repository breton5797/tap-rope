// World 2 — 네온 시티: night skyline with lit windows, glowing neon signs, wet reflective street.
import { GROUND_Y } from '../types';
import { blit, type SpriteCache } from './sprites';
import { starField, wrapped, type TileSpec, type WorldArt } from './scenery';
import { circle, FONT, oval, roundRect, seeded, vGrad, type Ctx } from './util';
import type { View } from './view';

const WINDOW_COLORS = ['#FFD27A', '#7FF3FF', '#FF9BE0'];
const NEON_PINK = '#FF4FD8';
const NEON_CYAN = '#3BF4FF';

interface Win {
  readonly x: number;
  readonly y: number;
  readonly c: string;
}
/** windows chosen to twinkle; filled while the scene is built */
let twinkles: Win[] = [];

function building(ctx: Ctx, rnd: () => number, x: number, w: number, h: number, near: boolean, out: Win[]): void {
  const top = GROUND_Y - h;
  ctx.fillStyle = near
    ? vGrad(ctx, top, GROUND_Y, [[0, '#1E1446'], [1, '#110B2B']])
    : vGrad(ctx, top, GROUND_Y, [[0, '#33246A'], [1, '#2A1D5A']]);
  ctx.fillRect(x, top, w, h + 2);
  if (near) {
    ctx.fillStyle = 'rgba(140,110,255,0.35)';
    ctx.fillRect(x, top, 1.5, h);
    ctx.fillRect(x, top, w, 1.2);
  }
  if (rnd() < 0.35) {
    ctx.fillStyle = near ? '#1E1446' : '#33246A';
    ctx.fillRect(x + w * 0.4, top - 10, 2, 10);
    ctx.fillStyle = '#FF5E7A';
    circle(ctx, x + w * 0.4 + 1, top - 11, 1.4);
    ctx.fill();
  }
  const cols = Math.floor((w - 6) / 7);
  const rows = Math.floor((h - 10) / 9);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rnd() < (near ? 0.32 : 0.22);
      if (!lit && !near) continue;
      const wx = x + 4 + c * 7;
      const wy = top + 7 + r * 9;
      const col = WINDOW_COLORS[Math.floor(rnd() * 3)];
      ctx.fillStyle = lit ? col : 'rgba(80,60,140,0.35)';
      ctx.globalAlpha = lit ? (near ? 0.9 : 0.45) : 1;
      ctx.fillRect(wx, wy, 3.4, 4.6);
      if (lit && near && rnd() < 0.18 && out.length < 18) out.push({ x: wx, y: wy, c: col });
    }
  }
  ctx.globalAlpha = 1;
}

function skyline(ctx: Ctx, v: View, near: boolean, seed: number, out: Win[]): void {
  const rnd = seeded(seed);
  let x = v.x0 - 10;
  while (x < v.x0 + v.w) {
    const w = near ? 26 + rnd() * 30 : 18 + rnd() * 26;
    const centerGap = near && x > 120 && x < 230;
    const h = near ? (centerGap ? 30 + rnd() * 25 : 50 + rnd() * 75) : 70 + rnd() * 90;
    building(ctx, rnd, x, w, h, near, out);
    x += w + (near ? 2 + rnd() * 6 : rnd() * 4);
  }
}

function neonSign(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, text: string): void {
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,30,0.85)';
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 5);
  ctx.stroke();
  ctx.font = `800 ${Math.round(h * 0.52)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function signPosts(ctx: Ctx, cx: number, top: number, spread: number): void {
  ctx.fillStyle = '#0E0A24';
  ctx.fillRect(cx - spread / 2, top, 2.5, GROUND_Y - top);
  ctx.fillRect(cx + spread / 2 - 2.5, top, 2.5, GROUND_Y - top);
}

function street(ctx: Ctx, v: View): void {
  const bottom = v.y0 + v.h;
  ctx.fillStyle = vGrad(ctx, GROUND_Y, bottom, [[0, '#2A1F55'], [0.3, '#171134'], [1, '#09061A']]);
  ctx.fillRect(v.x0, GROUND_Y, v.w, bottom - GROUND_Y);
  ctx.fillStyle = '#4A3A8A';
  ctx.fillRect(v.x0, GROUND_Y - 1, v.w, 4);
  ctx.fillStyle = 'rgba(190,170,255,0.5)';
  ctx.fillRect(v.x0, GROUND_Y - 1, v.w, 1);
  const refl: readonly (readonly [number, string])[] = [[112, NEON_PINK], [270, NEON_CYAN], [24, '#FFD27A'], [196, '#FF9BE0'], [340, '#7FF3FF']];
  for (const [rx, c] of refl) {
    const g = ctx.createLinearGradient(0, GROUND_Y + 3, 0, GROUND_Y + 70);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.16;
    ctx.fillRect(rx - 18, GROUND_Y + 3, 36, 67);
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 4; i++) ctx.fillRect(rx - 12 + i * 2, GROUND_Y + 6 + i * 11, 24 - i * 4, 1.4);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,210,120,0.22)';
  for (let x = v.x0 - 20; x < v.x0 + v.w; x += 46) ctx.fillRect(x, 520, 26, 2.5);
  ctx.fillStyle = 'rgba(160,140,255,0.08)';
  oval(ctx, 60, 500, 40, 5);
  ctx.fill();
  oval(ctx, 300, 506, 34, 4);
  ctx.fill();
}

function drawScene(ctx: Ctx, v: View): void {
  starField(ctx, seeded(4), v.x0, v.y0, v.w, 300 - v.y0, 80, 1.3);
  ctx.save();
  ctx.shadowColor = '#FFF2C9';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#FFF2C9';
  circle(ctx, 72, 96, 15);
  ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = 'destination-out';
  circle(ctx, 80, 90, 13);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = vGrad(ctx, 330, GROUND_Y, [[0, 'rgba(255,80,200,0)'], [1, 'rgba(255,80,200,0.22)']]);
  ctx.fillRect(v.x0, 330, v.w, GROUND_Y - 330);
  const wins: Win[] = [];
  skyline(ctx, v, false, 21, wins);
  skyline(ctx, v, true, 33, wins);
  twinkles = wins;
  signPosts(ctx, 112, 350, 30);
  signPosts(ctx, 270, 344, 26);
  neonSign(ctx, 241, 322, 58, 22, NEON_CYAN, 'JUMP');
  street(ctx, v);
}

function ropeSign(ctx: Ctx): void {
  neonSign(ctx, 0, 0, 64, 28, NEON_PINK, 'ROPE');
}

const HAZE: TileSpec = {
  y: 120,
  h: 210,
  w: 660,
  speed: 4,
  draw(ctx, w) {
    const rnd = seeded(9);
    for (let i = 0; i < 6; i++) {
      const x = rnd() * w;
      const y = 150 + rnd() * 160;
      const rx = 60 + rnd() * 80;
      wrapped(x, w, (xx) => {
        ctx.fillStyle = vGrad(ctx, y - 8, y + 8, [[0, 'rgba(70,40,130,0.25)'], [1, 'rgba(255,90,200,0.22)']]);
        oval(ctx, xx, y, rx, 7);
        ctx.fill();
      });
    }
  },
};

function airplane(ctx: Ctx, t: number): void {
  const cyc = (t % 26) / 26;
  const x = -40 + cyc * 460;
  const y = 150 - cyc * 40;
  ctx.fillStyle = 'rgba(200,190,255,0.5)';
  ctx.fillRect(x - 7, y - 0.8, 14, 1.6);
  const blink = (t % 1.2) < 0.15;
  ctx.fillStyle = blink ? '#FFFFFF' : '#FF4D6A';
  circle(ctx, x + 7, y, blink ? 1.8 : 1.2);
  ctx.fill();
  ctx.fillStyle = '#5CFF9D';
  circle(ctx, x - 7, y, 1);
  ctx.fill();
}

function flicker(t: number): number {
  const f = Math.sin(t * 13.1) * Math.sin(t * 7.7) * Math.sin(t * 2.3);
  return f > 0.55 ? 0.25 : 1;
}

export const CITY: WorldArt = {
  sky: [[0, '#05051A'], [0.45, '#160B3E'], [0.8, '#3C1462'], [1, '#6E1C6E']],
  skyTo: GROUND_Y - 20,
  tiles: [HAZE],
  drawScene,
  backdrop() {
    /* stars and moon are static */
  },
  front(ctx: Ctx, _v: View, t: number, sprites: SpriteCache) {
    for (let i = 0; i < twinkles.length; i++) {
      const w = twinkles[i];
      const a = 0.5 + 0.5 * Math.sin(t * (0.8 + (i % 4) * 0.45) + i * 2.3);
      ctx.globalAlpha = a < 0.25 ? 0 : a;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(w.x, w.y, 3.4, 4.6);
    }
    airplane(ctx, t);
    ctx.globalAlpha = flicker(t);
    blit(ctx, sprites.get('w2rope', 92, 56, 14, 14, ropeSign), 80, 322);
    ctx.globalAlpha = 1;
  },
};
