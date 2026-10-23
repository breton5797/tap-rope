// Animated variant layers. All of them are stateless functions of time (a fixed pool of
// N particles whose positions are hashed from their index), so they allocate nothing
// per frame, never drift out of sync and cost one path or a few fills each.
import { HORIZON_Y, NEAR_Y, project } from './projection';
import { groundOval } from './scenery';
import { circle, starPath, type Ctx } from './util';
import { BONFIRE_X, BONFIRE_Z } from './variant-props';
import type { View } from './view';

function h(i: number, k: number): number {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Slanted rain streaks over the whole view. */
export function rain(ctx: Ctx, v: View, t: number, n: number): void {
  const H = v.h + 60;
  ctx.strokeStyle = 'rgba(200,215,255,0.36)';
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const sp = 620 + h(i, 1) * 320;
    const len = 12 + h(i, 2) * 14;
    const dy = (t * sp + h(i, 4) * H) % H;
    const x = v.x0 - 30 + h(i, 3) * (v.w + 90) - dy * 0.16;
    const y = v.y0 - 30 + dy;
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * 0.16, y - len);
  }
  ctx.stroke();
}

/** Raindrop ripples popping on the ground plane. */
export function ripples(ctx: Ctx, t: number, n: number): void {
  ctx.strokeStyle = 'rgba(200,225,255,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const period = 0.7 + h(i, 1) * 0.5;
    const cyc = t / period + h(i, 2);
    const k = Math.floor(cyc);
    const f = cyc - k;
    const x = (h(i * 7 + k, 3) - 0.5) * 560;
    const z = -40 + h(i * 7 + k, 4) * 900;
    ctx.globalAlpha = (1 - f) * 0.6;
    groundOval(ctx, x, z, 3 + f * 14, 3 + f * 14);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const LEAF_COLS = ['#F59E2B', '#E5533A', '#F2C230', '#C9661A', '#FFB08A'];

/** Leaves tumbling down across the screen. */
export function leaves(ctx: Ctx, v: View, t: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const T = 6 + h(i, 1) * 4;
    const f = (t / T + h(i, 2)) % 1;
    const y = v.y0 - 20 + f * (v.h + 40);
    const x = v.x0 + h(i, 3) * v.w + Math.sin(t * 1.3 + i) * 22;
    const s = 3.5 + h(i, 5) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (1 + h(i, 4) * 2) + i);
    ctx.scale(Math.cos(t * 3 + i), 1);
    ctx.fillStyle = LEAF_COLS[i % LEAF_COLS.length];
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.9, 0, 0, s);
    ctx.quadraticCurveTo(-s * 0.9, 0, 0, -s);
    ctx.fill();
    ctx.restore();
  }
}

const PASTELS = ['#FFB3C7', '#FFE08A', '#A8EBA0', '#9AD4FF', '#C9B6FF', '#FFFFFF'];

/** Rising sparkles + slowly drifting confetti. */
export function sparkles(ctx: Ctx, v: View, t: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const T = 5 + h(i, 1) * 3;
    const f = (t / T + h(i, 2)) % 1;
    const x = v.x0 + h(i, 3) * v.w + Math.sin(t * 0.9 + i) * 14;
    ctx.fillStyle = PASTELS[i % PASTELS.length];
    if (i % 2 === 0) {
      const y = v.y0 + v.h - f * v.h;
      const a = Math.sin(f * Math.PI);
      ctx.globalAlpha = a;
      starPath(ctx, x, y, 2 + a * 2.5, 0.7, 4);
      ctx.fill();
    } else {
      const y = v.y0 - 10 + f * (v.h + 20);
      ctx.globalAlpha = 0.85;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 2 + i);
      ctx.fillRect(-2.6, -1.3 * Math.abs(Math.cos(t * 3 + i)) - 0.4, 5.2, 2.6 * Math.abs(Math.cos(t * 3 + i)) + 0.8);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/** Fireflies wandering over the lawn at night. */
export function fireflies(ctx: Ctx, v: View, t: number, n: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = v.x0 + (0.5 + 0.45 * Math.sin(t * (0.2 + h(i, 1) * 0.3) + i * 4)) * v.w;
    const y = HORIZON_Y + 40 + (0.5 + 0.5 * Math.sin(t * (0.15 + h(i, 2) * 0.25) + i * 2.3)) * (NEAR_Y - HORIZON_Y - 30);
    const a = 0.5 + 0.5 * Math.sin(t * (2 + h(i, 3) * 3) + i);
    ctx.fillStyle = `rgba(210,255,140,${(0.25 * a).toFixed(3)})`;
    circle(ctx, x, y, 5);
    ctx.fill();
    ctx.fillStyle = `rgba(240,255,190,${(0.9 * a).toFixed(3)})`;
    circle(ctx, x, y, 1.4);
    ctx.fill();
  }
  ctx.restore();
}

const pt = new Float32Array(3);

/** Flickering bonfire flames + rising embers. */
export function bonfire(ctx: Ctx, t: number, reduced: boolean): void {
  project(BONFIRE_X, BONFIRE_Z, 0, pt);
  const [x, y, s] = [pt[0], pt[1], pt[2]];
  const cols = ['#FF6A2B', '#FFA23A', '#FFE07A'];
  for (let k = 0; k < 3; k++) {
    const hgt = (26 - k * 7) * s * (1 + 0.15 * Math.sin(t * (9 + k * 3) + k));
    const w = (11 - k * 3) * s;
    const sway = Math.sin(t * 6 + k) * 2 * s;
    ctx.fillStyle = cols[k];
    ctx.beginPath();
    ctx.moveTo(x - w, y - 2 * s);
    ctx.quadraticCurveTo(x - w * 0.8, y - hgt * 0.6, x + sway, y - hgt);
    ctx.quadraticCurveTo(x + w * 0.8, y - hgt * 0.6, x + w, y - 2 * s);
    ctx.closePath();
    ctx.fill();
  }
  if (reduced) return;
  ctx.fillStyle = '#FFC46B';
  for (let i = 0; i < 10; i++) {
    const f = (t * 0.6 + h(i, 1)) % 1;
    ctx.globalAlpha = 1 - f;
    circle(ctx, x + Math.sin(t * 2 + i) * 8 * s + (h(i, 2) - 0.5) * 14 * s, y - 20 * s - f * 70 * s, 1.2 * s);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Occasional double lightning flash. */
export function lightning(ctx: Ctx, v: View, t: number): void {
  const c = t % 8.3;
  if (!(c < 0.07 || (c > 0.15 && c < 0.21))) return;
  ctx.fillStyle = 'rgba(220,225,255,0.16)';
  ctx.fillRect(v.x0, v.y0, v.w, v.h);
}

