// Rhythm-lane glyphs for LASER ESCAPE. Shapes stay distinct without colour:
// circle = floor laser, rounded square = flying beam stack (numeral = level),
// hexagon-ish = slide hazards (with ↓), drone glyph, pickups in bubbles.
import type { LaserFrom, MoveId } from '../types';
import { bubble, clockIcon, coinFace, heartIcon, shieldIcon } from './icons';
import { blitScaled, type SpriteCache } from './sprites';
import { circle, FONT, LEVEL_DARK, LEVEL_FILL, LEVEL_LIGHT, outlinedText, radGrad, roundRect, type Ctx } from './util';

const R = 13;
const INK = '#1E1A3A';

function disc(ctx: Ctx, light: string, mid: string, dark: string, square: boolean): void {
  ctx.fillStyle = dark;
  if (square) roundRect(ctx, -R - 1.5, -R - 1.5, R * 2 + 3, R * 2 + 3, 8);
  else circle(ctx, 0, 0, R + 1.5);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -4, -5, 1, R * 1.4, [[0, light], [0.55, mid], [1, dark]]);
  if (square) roundRect(ctx, -R, -R, R * 2, R * 2, 6.5);
  else circle(ctx, 0, 0, R);
  ctx.fill();
}

function numeral(ctx: Ctx, n: number, y: number, stroke: string): void {
  ctx.font = `900 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  outlinedText(ctx, String(n), 0, y, '#FFFFFF', stroke, 3.2);
}

/** floor laser: circle with a vertical laser fence + numeral 1 */
export function floorIcon(ctx: Ctx): void {
  disc(ctx, '#FFB3C0', '#FF3358', '#8A0F2A', false);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const x of [-6, 0, 6]) {
    ctx.moveTo(x, 8);
    ctx.lineTo(x, -1);
  }
  ctx.stroke();
  ctx.fillStyle = '#2A2F3E';
  roundRect(ctx, -9, 8, 18, 3, 1.5);
  ctx.fill();
  numeral(ctx, 1, -5, '#8A0F2A');
}

/** flying beam stack: rounded square, level-coloured, numeral = stacked beams */
export function beamIcon(ctx: Ctx, level: number): void {
  disc(ctx, LEVEL_LIGHT[level], LEVEL_FILL[level], LEVEL_DARK[level], true);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < level; i++) {
    ctx.moveTo(-9, 8 - i * 3.2);
    ctx.lineTo(9, 8 - i * 3.2);
  }
  ctx.stroke();
  numeral(ctx, level, -2, LEVEL_DARK[level]);
}

/** slide hazards (head beam / ceiling): cyan shield shape with a big ↓ */
export function slideIcon(ctx: Ctx, ceiling: boolean): void {
  ctx.fillStyle = '#0A5A6E';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    ctx.lineTo(Math.cos(a) * (R + 2), Math.sin(a) * (R + 2));
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -4, -5, 1, R * 1.4, [[0, '#C8FAFF'], [0.55, '#2EE6FF'], [1, '#0A7A94']]);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (ceiling) {
    ctx.moveTo(-7, -9);
    ctx.lineTo(7, -9);
  } else {
    ctx.moveTo(-9, -7);
    ctx.lineTo(9, -7);
  }
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(0, 7);
  ctx.moveTo(-4.5, 3);
  ctx.lineTo(0, 7.5);
  ctx.lineTo(4.5, 3);
  ctx.stroke();
}

export function droneIcon(ctx: Ctx): void {
  disc(ctx, '#C9B8FF', '#7B61FF', '#3A2A8C', false);
  ctx.fillStyle = '#2A2F3E';
  roundRect(ctx, -9, -4, 18, 9, 4.5);
  ctx.fill();
  ctx.fillStyle = '#FF3358';
  circle(ctx, 1.5, 0.5, 2.6);
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-11, -8);
  ctx.lineTo(-3, -8);
  ctx.moveTo(3, -8);
  ctx.lineTo(11, -8);
  ctx.stroke();
}

export function pickupIcon(ctx: Ctx, kind: number): void {
  bubble(ctx, 11.5, 'rgba(255,255,255,0.18)');
  if (kind === 0) coinFace(ctx, 8.5);
  else if (kind === 1) shieldIcon(ctx, 7);
  else if (kind === 2) clockIcon(ctx, 6.5);
  else heartIcon(ctx, 7);
}

const CHIPS: readonly MoveId[] = ['gate', 'pulse', 'rear'];
const CHIP_KEYS = CHIPS.map((m) => `chip-${m}`);

function chipSprite(ctx: Ctx, idx: number): void {
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, 0, 0, 7.6);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.7;
  const m = CHIPS[idx];
  if (m === 'pulse') {
    ctx.beginPath();
    ctx.moveTo(1.5, -5);
    ctx.lineTo(-3, 1);
    ctx.lineTo(0.5, 1);
    ctx.lineTo(-1.5, 5.5);
    ctx.lineTo(3.5, -1);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();
  } else if (m === 'gate') {
    ctx.fillRect(-4.5, -4.5, 2, 9);
    ctx.fillRect(2.5, -4.5, 2, 9);
    ctx.fillRect(-4.5, -1, 9, 2);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0.5, 3.8, -Math.PI * 0.2, Math.PI * 1.35);
    ctx.stroke();
  }
}

export function drawChip(ctx: Ctx, sprites: SpriteCache, move: MoveId, x: number, y: number, s: number): void {
  const i = CHIPS.indexOf(move);
  if (i < 0) return;
  blitScaled(ctx, sprites.get(CHIP_KEYS[i], 18, 18, 9, 9, chipSprite, i), x, y, s, s);
}

/** Small arrow showing where the laser comes from (points the way it travels). */
export function drawFromArrow(ctx: Ctx, from: LaserFrom | null, x: number, y: number): void {
  if (!from) return;
  const dir = from === 'front' ? [-1, 0] : from === 'back' ? [1, 0] : from === 'top' ? [0, 1] : [0, -1];
  const ax = from === 'front' ? x + 17 : from === 'back' ? x - 17 : x;
  const ay = from === 'top' ? y - 17 : from === 'bottom' ? y + 17 : y;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ax + dir[0] * 5, ay + dir[1] * 5);
  ctx.lineTo(ax - dir[0] * 3 - dir[1] * 4.5, ay - dir[1] * 3 + dir[0] * 4.5);
  ctx.lineTo(ax - dir[0] * 3 + dir[1] * 4.5, ay - dir[1] * 3 - dir[0] * 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
