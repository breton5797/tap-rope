// Boss effect sprites (GDD-v7 §1): baked once per device scale in the shared SpriteCache — glow, fireball,
// smoke puff and a four-point muzzle flare — plus the deterministic scatter table the explosions use.
import { blitScaled, type Sprite, type SpriteCache } from './sprites';
import type { Ctx } from './util';

export const BOSS_RED = '#FF2A3A';

/** deterministic pseudo-random table (explosion points, spark angles): no Math.random in the draw loop */
export const SCATTER = new Float32Array(64);
for (let i = 0; i < SCATTER.length; i++) {
  const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  SCATTER[i] = s - Math.floor(s);
}

function radial(ctx: Ctx, r: number, stops: readonly (readonly [number, string])[]): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
}

function glowRed(ctx: Ctx): void {
  radial(ctx, 16, [[0, 'rgba(255,255,255,1)'], [0.16, 'rgba(255,90,100,0.95)'], [0.45, 'rgba(255,42,58,0.35)'], [1, 'rgba(255,42,58,0)']]);
}

function glowAmber(ctx: Ctx): void {
  radial(ctx, 16, [[0, 'rgba(255,255,240,1)'], [0.2, 'rgba(255,190,80,0.9)'], [0.5, 'rgba(255,140,30,0.3)'], [1, 'rgba(255,120,20,0)']]);
}

function fireball(ctx: Ctx): void {
  radial(ctx, 32, [
    [0, 'rgba(255,255,235,1)'], [0.2, 'rgba(255,214,120,0.95)'], [0.45, 'rgba(255,120,40,0.7)'],
    [0.75, 'rgba(160,40,20,0.3)'], [1, 'rgba(60,20,10,0)'],
  ]);
}

function smoke(ctx: Ctx): void {
  radial(ctx, 32, [[0, 'rgba(46,48,52,0.75)'], [0.55, 'rgba(36,38,42,0.45)'], [1, 'rgba(30,32,36,0)']]);
}

/** four-point muzzle flare: long horizontal streak + short vertical one + hot centre */
function flare(ctx: Ctx): void {
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 2; k++) {
    const len = k === 0 ? 30 : 14;
    const g = k === 0 ? ctx.createLinearGradient(-len, 0, len, 0) : ctx.createLinearGradient(0, -len, 0, len);
    g.addColorStop(0, 'rgba(255,42,58,0)');
    g.addColorStop(0.5, 'rgba(255,230,230,1)');
    g.addColorStop(1, 'rgba(255,42,58,0)');
    ctx.fillStyle = g;
    if (k === 0) ctx.fillRect(-len, -1.6, len * 2, 3.2);
    else ctx.fillRect(-1.4, -len, 2.8, len * 2);
  }
  radial(ctx, 10, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,120,130,0.8)'], [1, 'rgba(255,42,58,0)']]);
}

export interface FxSprites {
  glowR: Sprite;
  glowA: Sprite;
  fire: Sprite;
  smoke: Sprite;
  flare: Sprite;
}

/** shared holder (refreshed every frame from the cache: a resize rebuilds the bitmaps) */
const FX: FxSprites = {} as FxSprites;

export function fxSprites(sprites: SpriteCache): Readonly<FxSprites> {
  FX.glowR = sprites.get('bossGlowR', 32, 32, 16, 16, glowRed);
  FX.glowA = sprites.get('bossGlowA', 32, 32, 16, 16, glowAmber);
  FX.fire = sprites.get('bossFire', 64, 64, 32, 32, fireball);
  FX.smoke = sprites.get('bossSmoke', 64, 64, 32, 32, smoke);
  FX.flare = sprites.get('bossFlare', 60, 30, 30, 15, flare);
  return FX;
}

/** Additive blit of a centred sprite at radius r (sprite half-size = native radius `nr`). */
export function glowAt(ctx: Ctx, sp: Sprite, x: number, y: number, r: number, nr: number, a: number): void {
  if (a <= 0.01 || r <= 0.1) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, a);
  blitScaled(ctx, sp, x, y, r / nr, r / nr);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Normal-blend blit of a centred sprite at radius r. */
export function puffAt(ctx: Ctx, sp: Sprite, x: number, y: number, r: number, nr: number, a: number): void {
  if (a <= 0.01 || r <= 0.1) return;
  ctx.globalAlpha = Math.min(1, a);
  blitScaled(ctx, sp, x, y, r / nr, r / nr);
  ctx.globalAlpha = 1;
}

/** Radial spark spray: `n` short bright streaks from (x, y), progress f 0..1, seeded by `seed`. */
export function sparks(ctx: Ctx, x: number, y: number, n: number, f: number, size: number, seed: number): void {
  if (f >= 1) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#FFD9A0';
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 1 - f;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const r0 = SCATTER[(seed + i) & 63];
    const ang = r0 * Math.PI * 2;
    const sp = (0.6 + SCATTER[(seed + i * 7 + 3) & 63] * 0.8) * size;
    const d0 = f * sp;
    const d1 = d0 + 4 + 6 * (1 - f);
    const gy = f * f * size * 0.5; // gravity sag
    ctx.moveTo(x + Math.cos(ang) * d0, y + Math.sin(ang) * d0 + gy);
    ctx.lineTo(x + Math.cos(ang) * d1, y + Math.sin(ang) * d1 + gy);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
