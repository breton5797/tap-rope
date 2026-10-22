// World 0 — 놀이터: bright day, fluffy clouds, rolling hills, slide & swings, grass + sand.
import { GROUND_Y } from '../types';
import { blit, type SpriteCache } from './sprites';
import { cloud, wrapped, type TileSpec, type WorldArt } from './scenery';
import { circle, oval, radGrad, roundRect, seeded, TAU, vGrad, type Ctx } from './util';
import type { View } from './view';

function ridgeY(x: number, base: number, amp: number, f: number, ph: number): number {
  return base - amp * (0.62 * Math.sin(x * f + ph) + 0.38 * Math.sin(x * f * 2.3 + ph * 1.7));
}

function hill(ctx: Ctx, v: View, base: number, amp: number, f: number, ph: number, fill: CanvasGradient): void {
  ctx.beginPath();
  ctx.moveTo(v.x0, GROUND_Y + 4);
  for (let x = v.x0; x <= v.x0 + v.w + 6; x += 6) ctx.lineTo(x, ridgeY(x, base, amp, f, ph));
  ctx.lineTo(v.x0 + v.w + 6, GROUND_Y + 4);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function tree(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = '#8A5A3B';
  roundRect(ctx, x - s * 0.11, y - s * 0.75, s * 0.22, s * 0.8, s * 0.08);
  ctx.fill();
  const g = radGrad(ctx, x - s * 0.25, y - s * 1.25, s * 0.1, s * 0.95, [[0, '#A6EB86'], [0.55, '#5FBF58'], [1, '#3A9447']]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x - s * 0.32, y - s * 0.85, s * 0.42, 0, TAU);
  ctx.arc(x + s * 0.32, y - s * 0.88, s * 0.4, 0, TAU);
  ctx.moveTo(x + s * 0.5, y - s * 1.3);
  ctx.arc(x, y - s * 1.3, s * 0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  circle(ctx, x - s * 0.18, y - s * 1.5, s * 0.13);
  ctx.fill();
}

function slide(ctx: Ctx, x: number, y: number): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#79A6CB';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 46);
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x + 14, y - 46);
  for (let i = 1; i < 5; i++) {
    ctx.moveTo(x, y - i * 9);
    ctx.lineTo(x + 14, y - i * 9);
  }
  ctx.stroke();
  ctx.fillStyle = '#F7C44F';
  roundRect(ctx, x - 3, y - 50, 22, 6, 3);
  ctx.fill();
  const g = ctx.createLinearGradient(x + 14, y - 46, x + 60, y);
  g.addColorStop(0, '#FF9C7A');
  g.addColorStop(1, '#F06A6A');
  ctx.strokeStyle = g;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(x + 16, y - 44);
  ctx.bezierCurveTo(x + 34, y - 40, x + 36, y - 6, x + 62, y - 3);
  ctx.stroke();
}

function swings(ctx: Ctx, x: number, y: number): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6E93BC';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + 4, y - 52);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x + 52, y);
  ctx.lineTo(x + 62, y - 52);
  ctx.lineTo(x + 72, y);
  ctx.moveTo(x + 2, y - 52);
  ctx.lineTo(x + 64, y - 52);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,95,120,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const sx of [22, 44]) {
    ctx.moveTo(x + sx - 5, y - 51);
    ctx.lineTo(x + sx - 5, y - 17);
    ctx.moveTo(x + sx + 5, y - 51);
    ctx.lineTo(x + sx + 5, y - 17);
  }
  ctx.stroke();
  ctx.fillStyle = '#FFC145';
  for (const sx of [22, 44]) {
    roundRect(ctx, x + sx - 7, y - 18, 14, 4, 2);
    ctx.fill();
  }
}

function groundLayer(ctx: Ctx, v: View): void {
  const bottom = v.y0 + v.h;
  ctx.fillStyle = vGrad(ctx, GROUND_Y, bottom, [[0, '#8EE062'], [0.12, '#72CB4F'], [0.55, '#5AB045'], [1, '#3F8B37']]);
  ctx.fillRect(v.x0, GROUND_Y, v.w, bottom - GROUND_Y);
  ctx.fillStyle = '#C2F590';
  ctx.fillRect(v.x0, GROUND_Y - 1, v.w, 2.5);
  const rnd = seeded(77);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 260; i++) {
    const x = v.x0 + rnd() * v.w;
    const y = GROUND_Y + 8 + rnd() * (bottom - GROUND_Y);
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(48,120,40,0.45)' : 'rgba(190,245,140,0.35)';
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x - 3, y - 4);
    ctx.moveTo(x + 1, y);
    ctx.lineTo(x + 2, y - 5);
    ctx.stroke();
  }
  const petals = ['#FFFFFF', '#FFE066', '#FF9EC4'];
  for (let i = 0; i < 26; i++) {
    const x = v.x0 + rnd() * v.w;
    const y = GROUND_Y + 30 + rnd() * (bottom - GROUND_Y - 30);
    ctx.fillStyle = petals[i % 3];
    for (let p = 0; p < 5; p++) {
      circle(ctx, x + Math.cos(p * 1.256) * 2.2, y + Math.sin(p * 1.256) * 2.2, 1.6);
      ctx.fill();
    }
    ctx.fillStyle = '#FFB627';
    circle(ctx, x, y, 1.2);
    ctx.fill();
  }
}

function sandPit(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(60,110,40,0.35)';
  oval(ctx, 180, 484, 124, 17);
  ctx.fill();
  ctx.fillStyle = vGrad(ctx, 467, 499, [[0, '#FFEBC0'], [0.5, '#F4D394'], [1, '#E2B66E']]);
  oval(ctx, 180, 482, 120, 15);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(180, 482, 112, 12, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  const rnd = seeded(5);
  ctx.fillStyle = 'rgba(190,140,70,0.45)';
  for (let i = 0; i < 40; i++) {
    const a = rnd() * TAU;
    const r = Math.sqrt(rnd());
    circle(ctx, 180 + Math.cos(a) * 105 * r, 483 + Math.sin(a) * 11 * r, 0.8);
    ctx.fill();
  }
}

function drawScene(ctx: Ctx, v: View): void {
  hill(ctx, v, 418, 20, 0.018, 0.6, vGrad(ctx, 380, 470, [[0, '#B4EBAA'], [1, '#90D58C']]));
  hill(ctx, v, 442, 13, 0.026, 2.1, vGrad(ctx, 415, 470, [[0, '#7DD07A'], [1, '#5DB563']]));
  const rnd = seeded(3);
  for (let x = v.x0 + 10; x < v.x0 + v.w; x += 38 + rnd() * 40) {
    if (x > 80 && x < 290 && rnd() < 0.55) continue;
    tree(ctx, x, ridgeY(x, 442, 13, 0.026, 2.1) + 8, 20 + rnd() * 12);
  }
  slide(ctx, 92, 466);
  swings(ctx, 222, 466);
  ctx.fillStyle = vGrad(ctx, 360, 470, [[0, 'rgba(235,248,255,0)'], [1, 'rgba(235,248,255,0.32)']]);
  ctx.fillRect(v.x0, 360, v.w, 110);
  ctx.fillStyle = '#4FA453';
  ctx.beginPath();
  for (let x = v.x0; x < v.x0 + v.w + 14; x += 14 + ((x * 7) % 9)) {
    ctx.moveTo(x + 10, 470);
    ctx.arc(x, 470, 10 + ((x * 13) % 5), Math.PI, TAU);
  }
  ctx.fill();
  groundLayer(ctx, v);
  sandPit(ctx);
}

const FAR_CLOUDS: TileSpec = {
  y: 20,
  h: 190,
  w: 540,
  speed: 4,
  draw(ctx, w) {
    const rnd = seeded(11);
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 6; i++) {
      const x = rnd() * w;
      const y = 60 + rnd() * 110;
      const s = 12 + rnd() * 10;
      wrapped(x, w, (xx) => cloud(ctx, xx, y, s, '#FFFFFF', '#CFE6FA'));
    }
    ctx.globalAlpha = 1;
  },
};

const NEAR_CLOUDS: TileSpec = {
  y: 50,
  h: 290,
  w: 720,
  speed: 10,
  draw(ctx, w) {
    const rnd = seeded(29);
    for (let i = 0; i < 4; i++) {
      const x = (i + rnd() * 0.6) * (w / 4);
      const y = 120 + rnd() * 150;
      const s = 26 + rnd() * 16;
      wrapped(x, w, (xx) => cloud(ctx, xx, y, s, '#FFFFFF', '#C7DFF5'));
    }
  },
};

function sunSprite(ctx: Ctx): void {
  ctx.fillStyle = radGrad(ctx, 0, 0, 10, 80, [[0, 'rgba(255,250,210,0.95)'], [0.35, 'rgba(255,240,170,0.35)'], [1, 'rgba(255,240,170,0)']]);
  circle(ctx, 0, 0, 80);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -6, -8, 2, 28, [[0, '#FFFDE8'], [0.6, '#FFE57A'], [1, '#FFC93C']]);
  circle(ctx, 0, 0, 26);
  ctx.fill();
}

function raysSprite(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(255,248,200,0.16)';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 120, a - 0.09, a + 0.09);
    ctx.closePath();
    ctx.fill();
  }
}

const KITE_QUADS: readonly (readonly [number, number, string])[] = [[-1, -1, '#FF5E5B'], [1, -1, '#FFD23F'], [1, 1, '#FF5E5B'], [-1, 1, '#FFD23F']];

function kite(ctx: Ctx, v: View, t: number): void {
  const x = 84 + Math.sin(t * 0.7) * 7;
  const y = 182 + Math.sin(t * 1.1) * 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y + 12);
  ctx.quadraticCurveTo(x - 30, y + 90, v.x0 - 4, 330);
  ctx.stroke();
  ctx.strokeStyle = '#FF5E7A';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y + 12);
  for (let i = 1; i <= 8; i++) ctx.lineTo(x + Math.sin(t * 4 + i * 0.9) * 4, y + 12 + i * 5);
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.3) * 0.12);
  for (const [sx, sy, c] of KITE_QUADS) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(sx * 9, 0);
    ctx.lineTo(0, sy > 0 ? 13 : -11);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(120,40,40,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(9, 0);
  ctx.lineTo(0, 13);
  ctx.lineTo(-9, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export const PLAYGROUND: WorldArt = {
  sky: [[0, '#47A9F5'], [0.45, '#86CEFF'], [0.8, '#C9ECFF'], [1, '#FFF3D8']],
  skyTo: GROUND_Y - 20,
  tiles: [FAR_CLOUDS, NEAR_CLOUDS],
  drawScene,
  backdrop(ctx: Ctx, _v: View, t: number, sprites: SpriteCache) {
    ctx.save();
    ctx.translate(292, 88);
    ctx.rotate(t * 0.06);
    blit(ctx, sprites.get('w0rays', 240, 240, 120, 120, raysSprite), 0, 0);
    ctx.restore();
    blit(ctx, sprites.get('w0sun', 160, 160, 80, 80, sunSprite), 292, 88);
  },
  front(ctx: Ctx, v: View, t: number) {
    kite(ctx, v, t);
  },
};
