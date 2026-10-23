// Animated variant layers for the corridor: alarm sirens + red wash, steam puffs + fog,
// and the dark-variant lighting mask with the agent's flashlight cone. All stateless in
// time / scroll; heavy shapes are cached sprites or a per-view mask canvas.
import { GROUND_Y, PLAYER_X } from '../types';
import { CEIL_Y } from './layout';
import { CEIL_BOT, VENT_X } from './plane';
import { PLANE_W } from './themes';
import { blitScaled, type SpriteCache } from './sprites';
import { circle, makeCanvas, radGrad, roundRect, type Ctx } from './util';
import type { View } from './view';

/** siren x positions inside a plane tile (scroll 1:1) */
export const SIREN_X: readonly number[] = [120, 360];
const SIREN_Y = CEIL_BOT + 8;

export function sirenHousing(ctx: Ctx, x: number): void {
  ctx.fillStyle = '#2A2E3A';
  roundRect(ctx, x - 9, CEIL_BOT - 2, 18, 6, 2);
  ctx.fill();
  ctx.fillStyle = '#7A1020';
  ctx.beginPath();
  ctx.arc(x, SIREN_Y, 8, Math.PI, Math.PI * 2);
  ctx.lineTo(x + 8, SIREN_Y + 3);
  ctx.lineTo(x - 8, SIREN_Y + 3);
  ctx.fill();
}

function forEachTileX(v: View, scroll: number, xs: readonly number[], fn: (x: number) => void): void {
  const shift = scroll % PLANE_W;
  let base = -shift + Math.floor((v.x0 - 60 + shift) / PLANE_W) * PLANE_W;
  while (base < v.x0 + v.w + 60) {
    for (const x of xs) fn(base + x);
    base += PLANE_W;
  }
}

/** Rotating siren beams + glowing domes. */
export function sirens(ctx: Ctx, v: View, scroll: number, t: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  forEachTileX(v, scroll, SIREN_X, (x) => {
    const a = t * 5 + x * 0.01;
    for (let k = 0; k < 2; k++) {
      const ang = a + k * Math.PI;
      const dx = Math.cos(ang);
      const reach = 150 * Math.abs(Math.sin(ang * 0.5 + 0.7));
      ctx.fillStyle = 'rgba(255,40,60,0.10)';
      ctx.beginPath();
      ctx.moveTo(x, SIREN_Y);
      ctx.lineTo(x + dx * reach - 30, SIREN_Y + 170);
      ctx.lineTo(x + dx * reach + 30, SIREN_Y + 170);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,60,80,0.55)';
    circle(ctx, x, SIREN_Y - 1, 7 + Math.sin(t * 10) * 1.5);
    ctx.fill();
  });
  ctx.restore();
}

export function alarmWash(ctx: Ctx, v: View, t: number): void {
  ctx.fillStyle = `rgba(255,20,50,${(0.06 + 0.07 * (0.5 + 0.5 * Math.sin(t * 5))).toFixed(3)})`;
  ctx.fillRect(v.x0, v.y0, v.w, v.h);
}

function puffSprite(ctx: Ctx): void {
  ctx.fillStyle = radGrad(ctx, 0, 0, 2, 30, [[0, 'rgba(235,240,248,0.9)'], [0.6, 'rgba(220,228,240,0.45)'], [1, 'rgba(220,228,240,0)']]);
  circle(ctx, 0, 0, 30);
  ctx.fill();
}

/** Steam plumes rising from the floor vents. */
export function steamPuffs(ctx: Ctx, v: View, scroll: number, t: number, sprites: SpriteCache, reduced: boolean): void {
  const sp = sprites.get('puff', 62, 62, 31, 31, puffSprite);
  const n = reduced ? 3 : 6;
  forEachTileX(v, scroll, VENT_X, (x) => {
    for (let k = 0; k < n; k++) {
      const f = (t * 0.7 + k / n + x * 0.003) % 1;
      const s = 0.3 + f * 1.4;
      ctx.globalAlpha = (1 - f) * 0.8;
      blitScaled(ctx, sp, x + Math.sin(t * 2 + k) * 8 + f * 14, GROUND_Y + 8 - f * 190, s, s);
    }
  });
  ctx.globalAlpha = 1;
}

/** Low drifting fog bank over the floor (drawn over the stage). */
export function fog(ctx: Ctx, v: View, scroll: number, t: number, sprites: SpriteCache, alpha: number): void {
  const sp = sprites.get('puff', 62, 62, 31, 31, puffSprite);
  const span = v.w + 160;
  for (let i = 0; i < 9; i++) {
    const x = v.x0 - 80 + ((i * 97 - scroll * 0.8 + t * 12) % span + span) % span;
    const y = GROUND_Y - 6 - (i % 3) * 14;
    ctx.globalAlpha = alpha;
    blitScaled(ctx, sp, x, y, 3.4, 1.4);
  }
  ctx.globalAlpha = 1;
}

/** Darkness with a light pool around the agent and a flashlight cone ahead. */
export class Darkness {
  private key = '';
  private mask: HTMLCanvasElement | null = null;
  private readonly res = 0.5;
  private readonly pad = 260;

  draw(ctx: Ctx, v: View, agentHeight: number): void {
    if (this.key !== v.key || !this.mask) {
      this.mask = this.build(v);
      this.key = v.key;
    }
    ctx.drawImage(this.mask, v.x0, v.y0 - this.pad - agentHeight, v.w, v.h + this.pad * 2);
  }

  private build(v: View): HTMLCanvasElement {
    const h = v.h + this.pad * 2;
    const { canvas, ctx } = makeCanvas(v.w * this.res, h * this.res);
    ctx.setTransform(this.res, 0, 0, this.res, -v.x0 * this.res, (this.pad - v.y0) * this.res);
    ctx.fillStyle = 'rgba(2,4,14,0.72)';
    ctx.fillRect(v.x0, v.y0 - this.pad, v.w, h);
    ctx.globalCompositeOperation = 'destination-out';
    const cy = GROUND_Y - 30;
    ctx.fillStyle = radGrad(ctx, PLAYER_X, cy, 10, 90, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
    circle(ctx, PLAYER_X, cy, 90);
    ctx.fill();
    const g = ctx.createLinearGradient(PLAYER_X, 0, PLAYER_X + 300, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.95)');
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(PLAYER_X + 12, cy - 4);
    ctx.lineTo(PLAYER_X + 320, cy - 110);
    ctx.lineTo(PLAYER_X + 320, cy + 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(v.x0, CEIL_Y - 10, v.w, 14);
    return canvas;
  }
}
