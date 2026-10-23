// Rhythm-lane extras for v2: ring / ball icons, move-badge chips, blocked-lane dots.
// Every cue pairs colour with a distinct shape or glyph so it stays colourblind-safe.
import type { Lane, MoveId } from '../types';
import { blitScaled, type SpriteCache } from './sprites';
import { circle, radGrad, roundRect, type Ctx } from './util';

const RAINBOW = ['#FF5E5B', '#FFB627', '#3DDC97', '#3BB8FF', '#7B61FF'];

export function ringIcon(ctx: Ctx): void {
  ctx.fillStyle = '#2B2160';
  circle(ctx, 0, 0, 14.5);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -4, -5, 1, 18, [[0, '#4A3DA0'], [1, '#231A55']]);
  circle(ctx, 0, 0, 13);
  ctx.fill();
  ctx.lineCap = 'butt';
  for (let i = 0; i < RAINBOW.length; i++) {
    ctx.strokeStyle = RAINBOW[i];
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.arc(0, 5, 10 - i * 1.8, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
}

export function ballIcon(ctx: Ctx): void {
  const cols = ['#FF5E5B', '#FFFFFF', '#FFD23F', '#FFFFFF', '#3BB8FF', '#FFFFFF'];
  ctx.fillStyle = '#5A2A6A';
  circle(ctx, 0, 0, 14.5);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const a = -0.4 + (i / 6) * Math.PI * 2;
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 13, a, a + Math.PI / 3 + 0.02);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  circle(ctx, -4.5, -5, 3.4);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, 0, 0, 2.4);
  ctx.fill();
}

const INK = '#2A1F5C';

function arrow(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.moveTo(x1 - Math.cos(a - 0.6) * 3, y1 - Math.sin(a - 0.6) * 3);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a + 0.6) * 3, y1 - Math.sin(a + 0.6) * 3);
  ctx.stroke();
}

const MOVES: readonly MoveId[] = ['tumble', 'side', 'cross', 'back', 'dd'];
const CHIP_KEYS = MOVES.map((m) => `chip-${m}`);

function chipSprite(ctx: Ctx, idx: number): void {
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, 0, 0, 7.6);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const move = MOVES[idx];
  if (move === 'tumble') arrow(ctx, 0, 4.2, 0, -4.2);
  else if (move === 'side') {
    arrow(ctx, 0.5, 0, -4.5, 0);
    arrow(ctx, -0.5, 0, 4.5, 0);
  } else if (move === 'cross') {
    ctx.beginPath();
    ctx.moveTo(-3.4, -3.4);
    ctx.lineTo(3.4, 3.4);
    ctx.moveTo(3.4, -3.4);
    ctx.lineTo(-3.4, 3.4);
    ctx.stroke();
  } else if (move === 'back') {
    ctx.beginPath();
    ctx.arc(0, 0.4, 3.6, -Math.PI * 0.2, Math.PI * 1.35);
    ctx.stroke();
    arrow(ctx, 3.2, -3.4, 3.1, -1.2);
  } else {
    ctx.beginPath();
    ctx.ellipse(-1.6, 1, 2.6, 4, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(1.6, -1, 2.6, 4, 0, 0, Math.PI);
    ctx.stroke();
  }
}

/** Small white chip with the move glyph; nothing for plain jumps / numerals / birds. */
export function drawMoveChip(ctx: Ctx, sprites: SpriteCache, move: MoveId, x: number, y: number, scale: number): void {
  const idx = MOVES.indexOf(move);
  if (idx < 0) return;
  blitScaled(ctx, sprites.get(CHIP_KEYS[idx], 18, 18, 9, 9, chipSprite, idx), x, y, scale, scale);
}

/** Three tiny lane markers: blocked lanes are red squares, free lanes white dots. */
export function drawBallDots(ctx: Ctx, x: number, y: number, lanes: readonly Lane[]): void {
  if (lanes.length === 0) return;
  for (let l = -1; l <= 1; l++) {
    const bx = x + l * 7;
    if (lanes.includes(l as Lane)) {
      ctx.fillStyle = '#FF4B5C';
      roundRect(ctx, bx - 2.6, y - 2.6, 5.2, 5.2, 1);
      ctx.fill();
      ctx.strokeStyle = '#5C0F14';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#FFFFFF';
      circle(ctx, bx, y, 1.9);
      ctx.fill();
    }
  }
}
